import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/constants/theme";
import type { Tag } from "@/types/pins";

interface TagChipProps {
  tag: Pick<Tag, "id" | "name">;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}

export const TagChip = memo(function TagChip({ tag, selected, disabled = false, onPress, onRemove }: TagChipProps) {
  const Container = onPress ? Pressable : View;

  return (
    <Container
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ selected: Boolean(selected), disabled }}
      onPress={disabled ? undefined : onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.text, selected && styles.selectedText]}>#{tag.name}</Text>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${tag.name} 삭제`} accessibilityState={{ disabled }} disabled={disabled} onPress={onRemove} style={[styles.removeButton, disabled && styles.disabled]}>
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
    ...typography.caption,
    color: colors.textMuted,
  },
  selectedText: {
    color: colors.surface
  },
  remove: {
    ...typography.headline,
    color: colors.textMuted,
  },
  removeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  disabled: {
    opacity: 0.5
  }
});
