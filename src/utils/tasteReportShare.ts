import type { RefObject } from "react";
import { Platform, type View } from "react-native";

import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

type WebSharePayload = {
  title?: string;
  text?: string;
  files?: File[];
};

type WebNavigatorWithShare = Navigator & {
  canShare?: (data: WebSharePayload) => boolean;
  share?: (data: WebSharePayload) => Promise<void>;
};

export type TasteReportShareResult = "downloaded" | "shared";

export async function shareTasteReportImage(cardRef: RefObject<View | null>): Promise<TasteReportShareResult> {
  if (!cardRef.current) {
    throw new Error("공유할 취향 카드를 준비하지 못했습니다.");
  }

  if (Platform.OS === "web") {
    const dataUri = await captureTasteReport(cardRef.current, "data-uri");
    return shareTasteReportImageOnWeb(dataUri);
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("이 기기에서는 공유 시트를 열 수 없습니다.");
  }

  const uri = await captureTasteReport(cardRef.current, "tmpfile");

  await Sharing.shareAsync(uri, {
    dialogTitle: "취향 카드 공유",
    mimeType: "image/png",
    UTI: "public.png"
  });
  return "shared";
}

async function shareTasteReportImageOnWeb(dataUri: string): Promise<TasteReportShareResult> {
  const blob = await dataUriToBlob(dataUri);
  const file = new File([blob], "scenenote-taste-card.png", { type: "image/png" });
  const webNavigator = navigator as WebNavigatorWithShare;
  const payload: WebSharePayload = {
    files: [file],
    text: "SceneNote 취향 카드",
    title: "SceneNote 취향 카드"
  };

  if (webNavigator.share && (!webNavigator.canShare || webNavigator.canShare(payload))) {
    try {
      await webNavigator.share(payload);
      return "shared";
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") throw error;
    }
  }

  downloadDataUri(dataUri, file.name);
  return "downloaded";
}

async function captureTasteReport(
  view: View,
  result: "data-uri" | "tmpfile"
): Promise<string> {
  if (Platform.OS === "web") {
    return withTimeout(
      captureTasteReportOnWeb(view),
      12_000,
      "취향 카드 이미지를 만드는 데 시간이 너무 오래 걸립니다."
    );
  }

  return withTimeout(
    captureRef(view, {
      format: "png",
      height: 1350,
      quality: 1,
      result,
      width: 1080
    }),
    12_000,
    "취향 카드 이미지를 만드는 데 시간이 너무 오래 걸립니다."
  );
}

async function captureTasteReportOnWeb(view: View): Promise<string> {
  const element = resolveWebElement(view);
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    height: 1350,
    scale: 1,
    width: 1080,
    windowHeight: Math.max(document.documentElement.clientHeight, 1350),
    windowWidth: Math.max(document.documentElement.clientWidth, 1080)
  });

  return canvas.toDataURL("image/png", 1);
}

function resolveWebElement(view: View): HTMLElement {
  const candidate = view as unknown;
  if (typeof HTMLElement !== "undefined" && candidate instanceof HTMLElement) {
    return candidate;
  }

  const maybeNodeProvider = candidate as {
    getNode?: () => unknown;
    getScrollableNode?: () => unknown;
  };
  const node = maybeNodeProvider.getNode?.() ?? maybeNodeProvider.getScrollableNode?.();
  if (typeof HTMLElement !== "undefined" && node instanceof HTMLElement) {
    return node;
  }

  throw new Error("공유할 취향 카드의 웹 요소를 찾지 못했습니다.");
}

async function dataUriToBlob(dataUri: string): Promise<Blob> {
  const response = await fetch(dataUri);
  return response.blob();
}

function downloadDataUri(dataUri: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUri;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timeoutId));
  });
}
