import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

type SkeletonVariant = "content-card" | "search-result" | "pin-item" | "episode-row" | "recommendation-card";

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
  columns?: number;
  compact?: boolean;
  expanded?: boolean;
  accessibilityLabel?: string;
}

export function LoadingSkeleton({
  variant = "content-card",
  count = 3,
  columns = 3,
  compact = false,
  expanded = false,
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
      aria-busy
      style={[styles.container, isRecommendationGrid ? styles.recommendationGrid : null]}
    >
      {Array.from({ length: count }).map((_, index) =>
        isRecommendationGrid ? (
          <View key={`${variant}-${index}`} style={[styles.recommendationCell, expanded && styles.expandedCell, { width: cellWidth }]}>
            <View accessibilityElementsHidden style={styles.recommendationCard}>
              {expanded ? (
                <>
                  <View style={styles.expandedBody}>
                    <View style={styles.compactSummary}>
                      <View style={styles.expandedPoster} />
                      <View style={styles.expandedText}>
                        <View style={[styles.recommendationLine, styles.recommendationTitleLine]} />
                        <View style={[styles.recommendationLine, styles.recommendationTitleLine]} />
                        <View style={[styles.recommendationLine, styles.recommendationMetaLine]} />
                        <View style={[styles.recommendationLine, styles.recommendationMetaLine]} />
                        <View style={[styles.recommendationLine, styles.expandedCast]} />
                        <View style={[styles.recommendationLine, styles.expandedOverview]} />
                      </View>
                    </View>
                    <View style={[styles.recommendationLine, styles.expandedGenres]} />
                    <View style={[styles.recommendationLine, styles.expandedReason]} />
                  </View>
                  <View style={styles.expandedFooter}>
                    <View style={styles.compactActions}>
                      <View style={[styles.recommendationLine, styles.compactFeedback]} />
                      <View style={[styles.recommendationLine, styles.compactFeedback]} />
                      <View style={[styles.recommendationLine, styles.compactFeedback]} />
                    </View>
                    <View style={styles.expandedAddActions}>
                      <View style={styles.compactAddButton} />
                      <View style={styles.compactAddButton} />
                    </View>
                  </View>
                </>
              ) : compact ? (
                <>
                  <View style={styles.compactBody}>
                    <View style={styles.compactSummary}>
                      <View style={styles.compactPoster} />
                      <View style={styles.compactText}>
                        <View style={[styles.recommendationLine, styles.recommendationTitleLine]} />
                        <View style={[styles.recommendationLine, styles.recommendationTitleLine]} />
                        <View style={[styles.recommendationLine, styles.recommendationMetaLine]} />
                      </View>
                    </View>
                    <View style={[styles.recommendationLine, styles.compactCast]} />
                  </View>
                  <View style={styles.compactFooter}>
                    <View style={styles.compactActions}>
                      <View style={[styles.recommendationLine, styles.compactFeedback]} />
                      <View style={[styles.recommendationLine, styles.compactFeedback]} />
                      <View style={[styles.recommendationLine, styles.compactFeedback]} />
                    </View>
                    <View style={styles.compactActions}>
                      <View style={styles.compactAddButton} />
                      <View style={styles.compactAddButton} />
                    </View>
                  </View>
                </>
              ) : (
                <>
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
                </>
              )}
            </View>
          </View>
        ) : (
          <View accessibilityElementsHidden key={`${variant}-${index}`} style={[styles.item, styles[variant]]} />
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
  },
  expandedCell: { paddingVertical: spacing.xs },
  expandedBody: { gap: spacing.xs, padding: spacing.sm },
  expandedPoster: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 144, width: 96 },
  expandedText: { flex: 1, gap: spacing.xs, minWidth: 0 },
  expandedCast: { height: 32, width: "100%" },
  expandedOverview: { height: 32, width: "100%" },
  expandedGenres: { height: 14, width: "62%" },
  expandedReason: { height: 16, width: "92%" },
  expandedFooter: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  expandedAddActions: { flex: 1, flexDirection: "row", gap: spacing.xs, minWidth: 120 },
  compactBody: { gap: spacing.xs, padding: spacing.sm },
  compactSummary: { flexDirection: "row", gap: spacing.sm },
  compactPoster: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 96, width: 64 },
  compactText: { flex: 1, gap: spacing.sm, minWidth: 0 },
  compactCast: { height: 32, width: "100%" },
  compactFooter: { gap: spacing.xs, paddingBottom: spacing.sm, paddingHorizontal: spacing.sm },
  compactActions: { flexDirection: "row", gap: spacing.xs, minHeight: 44 },
  compactFeedback: { alignSelf: "center", height: 20, width: 20, marginHorizontal: spacing.md },
  compactAddButton: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, flex: 1, height: 44 }
});
