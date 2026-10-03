import type { ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/constants/theme";
import { getHomeLayout, HOME_CONTENT_MAX_WIDTH } from "@/utils/homeLayout";

// Existing loading/error/empty components supply their own 16pt horizontal inset.
export function ScreenStateFrame({ children, maxWidth = HOME_CONTENT_MAX_WIDTH }: { children: ReactNode; maxWidth?: number }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { gutter } = getHomeLayout(width);
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ alignSelf: "center", width: "100%", maxWidth, paddingLeft: Math.max(gutter, insets.left) - spacing.lg, paddingRight: Math.max(gutter, insets.right) - spacing.lg }}>{children}</View>
  </View>;
}
