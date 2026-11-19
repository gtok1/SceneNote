import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, spacing, typography } from "@/constants/theme";

interface WatchNowButtonProps {
  label: string;
  icon: "play" | "search";
  onPress: () => void;
}

export const WatchNowButton = memo(function WatchNowButton({ label, icon, onPress }: WatchNowButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <Ionicons accessible={false} color={colors.primary} name={icon} size={16} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 6,
    maxWidth: "100%",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  label: { ...typography.label, color: colors.primary, flexShrink: 1, minWidth: 0 }
});
