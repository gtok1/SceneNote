import { createElement } from "react";
import { Image as ExpoImage, type ImageProps as ExpoImageProps } from "expo-image";
import {
  Platform,
  StyleSheet,
  type ImageStyle
} from "react-native";

type AppImageProps = Pick<
  ExpoImageProps,
  "accessibilityLabel" | "contentFit" | "source" | "style" | "testID"
>;

export function AppImage({ contentFit = "cover", source, style, ...props }: AppImageProps) {
  if (Platform.OS === "web") {
    const uri = getImageUri(source);
    const flattenedStyle = StyleSheet.flatten(style) as ImageStyle | undefined;

    if (!uri) {
      return createElement("div", {
        "aria-label": props.accessibilityLabel,
        style: flattenedStyle
      });
    }

    return createElement("img", {
      alt: props.accessibilityLabel ?? "",
      draggable: false,
      src: uri,
      style: {
        ...flattenedStyle,
        display: "block",
        objectFit: getObjectFit(contentFit)
      }
    });
  }

  return <ExpoImage {...props} contentFit={contentFit} source={source ?? null} style={style} />;
}

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
