import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

type SkeletonVariant = "content-card" | "search-result" | "pin-item" | "episode-row" | "recommendation-card";

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
  columns?: number;
  accessibilityLabel?: string;
}

export function LoadingSkeleton({
  variant = "content-card",
  count = 3,
  columns = 3,
  accessibilityLabel
}: LoadingSkeletonProps) {
  const isRecommendationGrid = variant === "recommendation-card";
  const normalizedColumns = Math.max(1, Math.floor(columns));
  const cellWidth = `${100 / normalizedColumns}%` as `${number}%`;
  const loadingLabel = accessibilityLabel ?? (
    isRecommendationGrid ? "추천 작품을 불러오는 중입니다" : "콘텐츠를 불러오는 중입니다"
  );

  return (
    <View
      accessibilityLabel={loadingLabel}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      aria-busy
      style={[styles.container, isRecommendationGrid ? styles.recommendationGrid : null]}
    >
      {Array.from({ length: count }).map((_, index) =>
        isRecommendationGrid ? (
          <View key={`${variant}-${index}`} style={[styles.recommendationCell, { width: cellWidth }]}>
            <View accessible={false} style={styles.recommendationCard}>
              <View style={styles.recommendationPoster} />
              <View style={styles.recommendationBody}>
                <View style={[styles.recommendationLine, styles.recommendationTitleLine]} />
                <View style={[styles.recommendationLine, styles.recommendationMetaLine]} />
                <View style={styles.recommendationTags}>
                  <View style={styles.recommendationTag} />
                  <View style={styles.recommendationTag} />
                </View>
                <View style={[styles.recommendationLine, styles.recommendationReasonLine]} />
              </View>
              <View style={styles.recommendationFooter} />
            </View>
          </View>
        ) : (
          <View accessible={false} key={`${variant}-${index}`} style={[styles.item, styles[variant]]} />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: spacing.lg
  },
  recommendationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
    padding: spacing.sm
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
  },
  "recommendation-card": {
    height: 300
  },
  recommendationCell: {
    padding: spacing.sm
  },
  recommendationCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  recommendationPoster: {
    backgroundColor: colors.surfaceMuted,
    height: 154,
    width: "100%"
  },
  recommendationBody: {
    gap: spacing.sm,
    minHeight: 108,
    padding: spacing.sm
  },
  recommendationLine: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm
  },
  recommendationTitleLine: {
    height: 14,
    width: "82%"
  },
  recommendationMetaLine: {
    height: 10,
    width: "62%"
  },
  recommendationTags: {
    flexDirection: "row",
    gap: spacing.xs
  },
  recommendationTag: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    height: 18,
    width: 44
  },
  recommendationReasonLine: {
    height: 10,
    width: "92%"
  },
  recommendationFooter: {
    backgroundColor: colors.primarySoft,
    height: 38,
    margin: spacing.sm,
    marginTop: 0
  }
});
