import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StackBackButton } from "@/components/common/StackBackButton";
import { colors, spacing, typography } from "@/constants/theme";
import { getHomeLayout, HOME_CONTENT_MAX_WIDTH } from "@/utils/homeLayout";

interface ScreenHeaderProps {
  title: string;
  maxWidth?: number;
  showBack?: boolean;
}

// Keep this in the navigator's header slot so keyboard offsets still use its measured height.
export function ScreenHeader({ title, maxWidth = HOME_CONTENT_MAX_WIDTH, showBack = true }: ScreenHeaderProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { gutter } = getHomeLayout(width);

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={[styles.content, { maxWidth, paddingLeft: Math.max(gutter, insets.left), paddingRight: Math.max(gutter, insets.right) }]}>
        {showBack ? <StackBackButton /> : null}
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
        {width >= 960 && title !== "SceneNote" ? <Text style={styles.brand}>SceneNote</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.background },
  content: {
    alignSelf: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: 10,
    width: "100%"
  },
  title: { ...typography.headline, color: colors.text, flex: 1, minWidth: 0 },
  brand: { ...typography.label, color: colors.textMuted }
});
