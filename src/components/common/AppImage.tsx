import { Image as ExpoImage, type ImageProps as ExpoImageProps } from "expo-image";
import {
  Image as ReactNativeImage,
  Platform,
  type ImageResizeMode,
  type ImageSourcePropType
} from "react-native";

type AppImageProps = Pick<
  ExpoImageProps,
  "accessibilityLabel" | "contentFit" | "source" | "style" | "testID"
>;

export function AppImage({ contentFit = "cover", source, style, ...props }: AppImageProps) {
  if (Platform.OS === "web") {
    return (
      <ReactNativeImage
        {...props}
        resizeMode={getResizeMode(contentFit)}
        source={getReactNativeImageSource(source)}
        style={style}
      />
    );
  }

  return <ExpoImage {...props} contentFit={contentFit} source={source ?? null} style={style} />;
}

function getResizeMode(contentFit: AppImageProps["contentFit"]): ImageResizeMode | undefined {
  switch (contentFit) {
    case "cover":
      return "cover";
    case "contain":
    case "scale-down":
      return "contain";
    case "fill":
      return "stretch";
    case "none":
      return "center";
    default:
      return undefined;
  }
}

function getReactNativeImageSource(source: AppImageProps["source"]): ImageSourcePropType | undefined {
  if (!source) return undefined;
  if (typeof source === "string") return { uri: source };

  return source as ImageSourcePropType;
}
