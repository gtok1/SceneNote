import { memo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { RecommendationCast } from "@/components/content/RecommendationCast";
import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing, typography } from "@/constants/theme";
import type { PersonalizedRecommendation } from "@/services/personalizedRecommendations";
import { createRecommendationPressGuard, RECOMMENDATION_ADD_HINT, RECOMMENDATION_COMPLETE_HINT } from "@/utils/recommendationAddFlow";
import { createDisplayGenreNames } from "@/utils/genre";
import type { RecommendationPresentation } from "@/utils/recommendationPresentation";

interface PersonalizedRecommendationGalleryCardProps {
  result: PersonalizedRecommendation;
  expanded?: boolean;
  presentation: RecommendationPresentation;
  onOpenQuickView: () => void;
  onAddToLibrary: () => void;
  onMarkCompleted: () => void;
  completeLabel: string;
  addLabel: string;
  isAddDisabled: boolean;
  onNotInterested: () => void;
  onMoreLikeThis: () => void;
  onReduceTheme?: () => void;
}

export const PersonalizedRecommendationGalleryCard = memo(
  function PersonalizedRecommendationGalleryCard({
    result,
    expanded = false,
    presentation,
    onOpenQuickView,
    onAddToLibrary,
    onMarkCompleted,
    completeLabel,
    addLabel,
    isAddDisabled,
    onNotInterested,
    onMoreLikeThis,
    onReduceTheme
  }: PersonalizedRecommendationGalleryCardProps) {
    const addPressGuard = useRef(createRecommendationPressGuard());
    const fullReactionLabel = presentation.ratingLabel ?? presentation.popularityLabel;
    const reactionLabel = fullReactionLabel?.split(" · ")[0]?.replace(/^평점\s*/, "");
    const genreLabel = expanded ? createDisplayGenreNames(result.genres ?? []).join(" · ") : "";
    const reasonLabel = presentation.reasonLabel ?? "추천 이유";

    return (
      <View style={[styles.cell, expanded && styles.expandedCell]}>
        <View testID="recommendation-gallery-card" style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="줄거리와 추천 이유, 출연진을 볼 수 있어요"
            accessibilityLabel={`${result.title_primary} 빠른 보기`}
            onPress={onOpenQuickView}
            style={({ pressed }) => [styles.mainButton, expanded && styles.expandedMain, pressed && styles.pressed]}
          >
            <View style={styles.summary}>
              <View style={[styles.posterArea, expanded && styles.expandedPosterArea]}>
                <Image
                  accessibilityLabel={`${result.title_primary} 포스터`}
                  contentFit="cover"
                  source={result.poster_url ? { uri: result.poster_url } : null}
                  style={[styles.poster, expanded && styles.expandedPoster]}
                />
                {presentation.statusBadges.length > 0 ? (
                  <Text numberOfLines={1} style={styles.statusBadge}>{presentation.statusBadges.join(" · ")}</Text>
                ) : null}
                {reactionLabel ? <Text accessibilityLabel={fullReactionLabel ?? undefined} numberOfLines={1} style={styles.reactionBadge}>{reactionLabel}</Text> : null}
              </View>
              <View style={styles.body}>
                <Text numberOfLines={2} style={styles.title}>{result.title_primary}</Text>
                {presentation.metadataLabel ? (
                  <Text numberOfLines={expanded ? 1 : 2} style={styles.meta}>{presentation.metadataLabel}</Text>
                ) : null}
                {presentation.watchProviderLabel ? (
                  <View accessibilityLabel={`시청 가능: ${presentation.watchProviderLabel}`} style={styles.watchProviderRow}>
                    <Ionicons name="tv-outline" size={12} color={colors.primary} />
                    <Text numberOfLines={1} style={styles.watchProviderText}>{presentation.watchProviderLabel}</Text>
                  </View>
                ) : null}
                {expanded ? <RecommendationCast compact result={result} /> : null}
                {expanded && presentation.hook ? <Text numberOfLines={2} style={styles.overview}>{presentation.hook}</Text> : null}
              </View>
            </View>
            {expanded ? (
              <>
                {genreLabel ? <Text numberOfLines={1} accessibilityLabel={`장르 ${genreLabel}`} style={styles.genres}>{genreLabel}</Text> : null}
                {presentation.personalizedReason ? (
                  <Text numberOfLines={1} accessibilityLabel={`${reasonLabel} ${presentation.personalizedReason}`} style={styles.reason}>
                    <Text style={styles.reasonLabel}>{reasonLabel} </Text>{presentation.personalizedReason}
                  </Text>
                ) : null}
              </>
            ) : <RecommendationCast compact result={result} />}
          </Pressable>

          <View style={[styles.footer, expanded && styles.expandedFooter]}>
            <View style={styles.footerTopRow}>
              <View style={styles.feedbackActions}>
                <Pressable accessibilityLabel={`${result.title_primary} 관심 없음`} accessibilityRole="button" onPress={onNotInterested} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                  <Ionicons color={colors.textMuted} name="close-circle-outline" size={18} />
                </Pressable>
                <Pressable accessibilityLabel={`${result.title_primary} 비슷한 작품 더 보기`} accessibilityRole="button" onPress={onMoreLikeThis} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                  <Ionicons color={colors.textMuted} name="git-compare-outline" size={18} />
                </Pressable>
                <Pressable
                  accessibilityHint={onReduceTheme ? "이 작품과 비슷한 테마의 추천을 줄입니다" : "이 작품에는 조절할 수 있는 테마 정보가 없습니다"}
                  accessibilityLabel={`${result.title_primary} 이런 요소 줄이기`}
                  accessibilityRole="button"
                  aria-disabled={!onReduceTheme}
                  disabled={!onReduceTheme}
                  onPress={onReduceTheme}
                  style={({ pressed }) => [styles.iconButton, !onReduceTheme && styles.disabledThemeIcon, pressed && styles.pressed]}
                >
                  <Ionicons color={colors.textMuted} name="options-outline" size={18} />
                </Pressable>
              </View>
            </View>
            <View style={[styles.addActions, expanded && styles.expandedAddActions]}>
              <Pressable
                accessibilityHint={RECOMMENDATION_ADD_HINT}
                accessibilityLabel={`${result.title_primary} ${addLabel}`}
                accessibilityRole="button"
                aria-disabled={isAddDisabled} aria-busy={addLabel.includes("중")}
                disabled={isAddDisabled}
                onPressIn={() => addPressGuard.current.begin(result.canonical_id)}
                onPress={() => {
                  if (addPressGuard.current.consume(result.canonical_id) && !isAddDisabled) onAddToLibrary();
                }}
                style={({ pressed }) => [styles.addButton, isAddDisabled && styles.disabled, pressed && styles.pressed]}
              >
                <Text numberOfLines={1} style={styles.addText}>{addLabel}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`${result.title_primary} ${completeLabel}`}
                accessibilityRole="button"
                accessibilityHint={RECOMMENDATION_COMPLETE_HINT}
                aria-disabled={isAddDisabled} aria-busy={completeLabel === "기록 중"}
                disabled={isAddDisabled}
                onPressIn={() => addPressGuard.current.begin(result.canonical_id)}
                onPress={() => {
                  if (addPressGuard.current.consume(result.canonical_id) && !isAddDisabled) onMarkCompleted();
                }}
                style={({ pressed }) => [styles.completeButton, isAddDisabled && styles.disabled, pressed && styles.pressed]}
              >
                <Text numberOfLines={1} style={styles.completeText}>{completeLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  cell: { flex: 1, padding: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1
  },
  mainButton: { flex: 1, minWidth: 0, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  expandedCell: { paddingVertical: spacing.xs },
  expandedMain: { gap: spacing.xs },
  expandedPosterArea: { width: 96 },
  expandedPoster: { width: 96, height: 144 },
  expandedFooter: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  expandedAddActions: { flex: 1, minWidth: 120 },
  overview: { ...typography.caption, color: colors.text, minWidth: 0 },
  genres: { ...typography.micro, color: colors.primary, minWidth: 0 },
  reason: { ...typography.caption, color: colors.textMuted, minWidth: 0 },
  reasonLabel: { ...typography.micro, color: colors.primary },
  summary: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  posterArea: { flexShrink: 0, position: "relative", width: 64 },
  poster: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 96, width: 64 },
  statusBadge: {
    ...typography.micro,
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.sm,
    color: colors.surface,
    bottom: spacing.xs,
    left: spacing.xs,
    right: spacing.xs,
    paddingHorizontal: spacing.xs,
    position: "absolute"
  },
  reactionBadge: {
    ...typography.micro,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.xs,
    position: "absolute",
    left: spacing.xs,
    right: spacing.xs,
    top: spacing.xs
  },
  body: { flex: 1, gap: spacing.xs, minWidth: 0 },
  title: { ...typography.headline, color: colors.text, minHeight: typography.headline.lineHeight * 2 },
  watchProviderRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minWidth: 0 },
  watchProviderText: { ...typography.caption, flexShrink: 1, color: colors.primary },
  meta: { ...typography.micro, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  footerTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "center" },
  feedbackActions: { flexDirection: "row" },
  iconButton: { alignItems: "center", minHeight: 44, justifyContent: "center", width: 44 },
  disabledThemeIcon: { opacity: 0.5 },
  addActions: { flexDirection: "row", gap: spacing.xs, alignItems: "stretch" },
  completeButton: { flex: 1, minWidth: 0, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.xs },
  completeText: { ...typography.label, color: colors.primary },
  addButton: { flex: 1, minWidth: 0, alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.xs },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
  addText: { ...typography.label, color: colors.surface }
});
