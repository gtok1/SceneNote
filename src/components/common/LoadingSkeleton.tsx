import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

type SkeletonVariant = "content-card" | "search-result" | "pin-item" | "episode-row";

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
}

export function LoadingSkeleton({ variant = "content-card", count = 3 }: LoadingSkeletonProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={`${variant}-${index}`} style={[styles.item, styles[variant]]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: spacing.lg
  },
  item: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md
  },
  "content-card": {
    height: 112
  },
  "search-result": {
    height: 104
  },
  "pin-item": {
    height: 128
  },
  "episode-row": {
    height: 72
  }
});
