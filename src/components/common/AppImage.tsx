import { createElement, useState } from "react";
import { Image as ExpoImage, type ImageProps as ExpoImageProps } from "expo-image";
import {
  Platform,
  StyleSheet,
  type ImageStyle
} from "react-native";

import { colors } from "@/constants/theme";

type AppImageProps = Pick<
  ExpoImageProps,
  "accessibilityLabel" | "contentFit" | "source" | "style" | "testID"
>;

export function AppImage({ contentFit = "cover", source, style, ...props }: AppImageProps) {
  const sourceKey = getImageSourceKey(source);
  const [failedSourceKey, setFailedSourceKey] = useState<string | null>(null);
  const sourceFailed = failedSourceKey === sourceKey;

  if (Platform.OS === "web") {
    const uri = getImageUri(source);
    const flattenedStyle = StyleSheet.flatten(style) as ImageStyle | undefined;

    if (!uri || sourceFailed) {
      return createElement("div", {
        "aria-label": props.accessibilityLabel ?? "이미지 없음",
        "data-testid": props.testID,
        role: "img",
        style: {
          ...flattenedStyle,
          backgroundColor: colors.surfaceMuted
        }
      });
    }

    return createElement("img", {
      alt: props.accessibilityLabel ?? "",
      "data-testid": props.testID,
      draggable: false,
      onError: () => setFailedSourceKey(sourceKey),
      src: uri,
      style: {
        ...flattenedStyle,
        display: "block",
        objectFit: getObjectFit(contentFit)
      }
    });
  }

  if (!source || sourceFailed) {
    return (
      <ExpoImage
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? "이미지 없음"}
        contentFit={contentFit}
        source={null}
        style={[style, styles.placeholder]}
      />
    );
  }

  return (
    <ExpoImage
      {...props}
      contentFit={contentFit}
      onError={() => setFailedSourceKey(sourceKey)}
      source={source}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.surfaceMuted
  }
});

function getObjectFit(contentFit: AppImageProps["contentFit"]) {
  switch (contentFit) {
    case "cover":
      return "cover";
    case "contain":
    case "scale-down":
      return "contain";
    case "fill":
      return "fill";
    case "none":
      return "none";
    default:
      return undefined;
  }
}

function getImageUri(source: AppImageProps["source"]) {
  if (!source) return undefined;
  if (typeof source === "string") return source;
  if (typeof source === "number") return undefined;
  if (Array.isArray(source)) return getImageUri(source[0]);
  if ("uri" in source) return source.uri;

  return undefined;
}

function getImageSourceKey(source: AppImageProps["source"]): string {
  const uri = getImageUri(source);
  if (uri) return `uri:${uri}`;
  if (typeof source === "number") return `asset:${source}`;
  if (Array.isArray(source)) return source.map(getImageSourceKey).join("|");
  if (!source) return "empty";

  try {
    return `source:${JSON.stringify(source)}`;
  } catch {
    return "source:unknown";
  }
}
