import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export function ErrorState({
  message = "문제가 발생했습니다. 다시 시도해 주세요.",
  onRetry,
  fullScreen = false
}: ErrorStateProps) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
          <Text style={styles.buttonText}>다시 시도</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.xl
  },
  fullScreen: {
    flex: 1,
    justifyContent: "center"
  },
  message: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  button: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  buttonText: {
    color: colors.surface,
    fontWeight: "700"
  }
});
