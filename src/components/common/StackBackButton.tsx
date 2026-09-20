import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { colors, radius, spacing } from "@/constants/theme";

export function StackBackButton() {
  const router = useRouter();
  const path = usePathname();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="뒤로"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace(path.startsWith("/pins") ? "/pins" : "/library");
      }}
      style={({ hovered, pressed }) => [
        styles.button,
        hovered && styles.hovered,
        pressed && styles.pressed,
        focused && styles.focused
      ]}
    >
      <Ionicons name="arrow-back" size={18} color={colors.textMuted} accessible={false} aria-hidden />
      <Text style={styles.label}>뒤로</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    // Native Stack supplies its own safe-area margin; the web header does not.
    marginLeft: Platform.OS === "web" ? spacing.lg : 0,
    marginRight: spacing.md,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  },
  hovered: { backgroundColor: colors.surfaceMuted },
  pressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  focused: { borderColor: colors.primary }
});
