import type { RefObject } from "react";
import { Platform, type View } from "react-native";

import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

export async function sharePinCardImage(cardRef: RefObject<View | null>): Promise<void> {
  if (Platform.OS === "web") {
    throw new Error("웹에서는 핀 이미지 공유를 지원하지 않습니다.");
  }

  if (!cardRef.current) {
    throw new Error("공유할 핀 카드를 준비하지 못했습니다.");
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("이 기기에서는 공유 시트를 열 수 없습니다.");
  }

  const uri = await captureRef(cardRef.current, {
    format: "png",
    height: 1350,
    quality: 1,
    result: "tmpfile",
    width: 1080
  });

  await Sharing.shareAsync(uri, {
    dialogTitle: "핀 공유",
    mimeType: "image/png",
    UTI: "public.png"
  });
}
