import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";
import type { Tag } from "@/types/pins";

interface TagChipProps {
  tag: Pick<Tag, "id" | "name">;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}

export const TagChip = memo(function TagChip({ tag, selected, onPress, onRemove }: TagChipProps) {
  const Container = onPress ? Pressable : View;

  return (
    <Container
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.text, selected && styles.selectedText]}>#{tag.name}</Text>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${tag.name} 삭제`} onPress={onRemove} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
          <Text style={styles.remove}>×</Text>
        </Pressable>
      ) : null}
    </Container>
  );
});

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  selected: {
    backgroundColor: colors.primary
  },
  text: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  selectedText: {
    color: colors.surface
  },
  remove: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 16
  }
});
