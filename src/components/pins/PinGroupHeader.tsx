import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppImage } from "@/components/common/AppImage";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { PIN_CONTEXT_COPY, PIN_GROUP_POSTER_WIDTH, type PinListRow } from "@/utils/pinListUi";

export const PinGroupHeader = memo(function PinGroupHeader({
  row, onPress
}: {
  row: Extract<PinListRow, { type: "group" }>;
  onPress: (contentId: string) => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={row.accessibilityLabel}
      accessibilityHint={PIN_CONTEXT_COPY.groupHint} onPress={() => onPress(row.contentId)}
      style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        <AppImage source={row.posterUrl ? { uri: row.posterUrl } : null} contentFit="cover" style={styles.poster} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>{row.title}</Text>
        <Text style={styles.count}>{row.countLabel}</Text>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.textSubtle} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44, paddingTop: spacing.sm },
  pressed: { opacity: 0.72 },
  poster: { width: PIN_GROUP_POSTER_WIDTH, height: PIN_GROUP_POSTER_WIDTH * 1.5, borderRadius: radius.sm },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { ...typography.headline, color: colors.text },
  count: { ...typography.caption, color: colors.textMuted, fontVariant: ["tabular-nums"] }
});
