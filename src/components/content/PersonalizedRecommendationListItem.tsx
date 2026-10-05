import { memo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing, typography } from "@/constants/theme";
import type { PersonalizedRecommendation } from "@/services/personalizedRecommendations";
import { createRecommendationPressGuard, RECOMMENDATION_ADD_HINT, RECOMMENDATION_COMPLETE_HINT } from "@/utils/recommendationAddFlow";
import type { RecommendationPresentation } from "@/utils/recommendationPresentation";

interface Props {
  result: PersonalizedRecommendation;
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

export const PersonalizedRecommendationListItem = memo(function PersonalizedRecommendationListItem({
  result,
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
}: Props) {
  const addPressGuard = useRef(createRecommendationPressGuard());
  const reactionLabel = presentation.ratingLabel ?? presentation.popularityLabel;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityHint="빠른 보기 창을 엽니다"
        accessibilityLabel={`${result.title_primary} 빠른 보기`}
        onPress={onOpenQuickView}
        style={styles.mainButton}
      >
        <View style={styles.posterArea}>
          <Image
            accessibilityLabel={`${result.title_primary} 포스터`}
            contentFit="cover"
            source={result.poster_url ? { uri: result.poster_url } : null}
            style={styles.poster}
          />
          {presentation.statusBadges[0] ? <Text style={styles.statusBadge}>{presentation.statusBadges[0]}</Text> : null}
        </View>
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>{result.title_primary}</Text>
          {presentation.watchProviderLabel ? (
            <View accessibilityLabel={`시청 가능: ${presentation.watchProviderLabel}`} style={styles.watchProviderRow}>
              <Ionicons name="tv-outline" size={12} color={colors.primary} />
              <Text numberOfLines={1} style={styles.watchProviderText}>{presentation.watchProviderLabel}</Text>
            </View>
          ) : null}
          {presentation.hook ? <Text numberOfLines={2} style={styles.hook}>{presentation.hook}</Text> : null}
          <Text numberOfLines={2} style={styles.meta}>
            {[reactionLabel, presentation.metadataLabel].filter(Boolean).join(" · ")}
          </Text>
          <GenreBadgeList genres={result.genres} maxVisible={3} />
          {presentation.personalizedReason ? (
            <View style={[styles.reasonRow, presentation.reasonConfidence === "weak" ? styles.reasonRowWeak : null]}>
              <Ionicons color={colors.primary} name="sparkles-outline" size={12} />
              <View style={styles.reasonContent}>
                <Text style={styles.reasonLabel}>{presentation.reasonLabel ?? "추천 이유"}</Text>
                <Text numberOfLines={2} style={styles.reasonText}>{presentation.personalizedReason}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        <View style={styles.feedbackActions}>
          <Pressable accessibilityLabel={`${result.title_primary} 관심 없음`} onPress={onNotInterested} style={styles.iconButton}><Ionicons color={colors.textMuted} name="close-circle-outline" size={18} /></Pressable>
          <Pressable accessibilityLabel={`${result.title_primary} 비슷한 작품 더 보기`} onPress={onMoreLikeThis} style={styles.iconButton}><Ionicons color={colors.textMuted} name="git-compare-outline" size={18} /></Pressable>
          <Pressable
            accessibilityHint={onReduceTheme ? "이 작품과 비슷한 테마의 추천을 줄입니다" : "이 작품에는 조절할 수 있는 테마 정보가 없습니다"}
            accessibilityLabel={`${result.title_primary} 이런 요소 줄이기`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !onReduceTheme }}
            disabled={!onReduceTheme}
            onPress={onReduceTheme}
            style={[styles.iconButton, !onReduceTheme ? styles.disabledThemeIcon : null]}
          >
            <Ionicons color={colors.textMuted} name="options-outline" size={18} />
          </Pressable>
        </View>
        <Pressable accessibilityLabel={`${result.title_primary} 빠른 보기`} onPress={onOpenQuickView} style={styles.quickButton}>
          <Ionicons color={colors.text} name="eye-outline" size={15} />
          <Text style={styles.quickText}>빠른 보기</Text>
        </Pressable>
        <Pressable
          accessibilityHint={RECOMMENDATION_ADD_HINT}
              accessibilityLabel={`${result.title_primary} ${addLabel}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: isAddDisabled, busy: addLabel.includes("중") }}
          disabled={isAddDisabled}
          onPressIn={() => addPressGuard.current.begin(result.canonical_id)}
              onPress={() => {
                if (addPressGuard.current.consume(result.canonical_id) && !isAddDisabled) onAddToLibrary();
              }}
          style={[styles.addButton, isAddDisabled ? styles.disabled : null]}
        >
          <Text numberOfLines={1} style={styles.addText}>{addLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`${result.title_primary} ${completeLabel}`}
          accessibilityRole="button"
          accessibilityHint={RECOMMENDATION_COMPLETE_HINT}
          accessibilityState={{ disabled: isAddDisabled, busy: completeLabel === "기록 중" }}
          disabled={isAddDisabled}
          onPressIn={() => addPressGuard.current.begin(result.canonical_id)}
          onPress={() => {
            if (addPressGuard.current.consume(result.canonical_id) && !isAddDisabled) onMarkCompleted();
          }}
          style={[styles.completeButton, isAddDisabled ? styles.disabled : null]}
        >
          <Text numberOfLines={1} style={styles.completeText}>{completeLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "column",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md
  },
  mainButton: { alignItems: "flex-start", flex: 1, flexDirection: "row", gap: spacing.md, minWidth: 0 },
  posterArea: { flexShrink: 0, position: "relative" },
  poster: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, height: 126, width: 84 },
  statusBadge: {
    backgroundColor: "rgba(23, 23, 23, 0.82)",
    borderRadius: radius.sm,
    color: colors.surface,
    fontSize: 10,
    fontWeight: "900",
    left: 5,
    overflow: "hidden",
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: "absolute",
    top: 5
  },
  body: { flex: 1, gap: spacing.xs, minWidth: 0 },
  title: { color: colors.text, fontSize: 15, fontWeight: "900", lineHeight: 20 },
  hook: { color: colors.text, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  reasonRow: { alignItems: "flex-start", backgroundColor: colors.primarySoft, borderRadius: radius.md, flexDirection: "row", gap: spacing.xs, padding: spacing.sm },
  reasonRowWeak: { backgroundColor: colors.surfaceMuted },
  reasonContent: { flex: 1, gap: 2 },
  reasonLabel: { color: colors.primary, fontSize: 10, fontWeight: "900" },
  reasonText: { color: colors.text, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: spacing.sm },
  watchProviderRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  watchProviderText: { flexShrink: 1, fontSize: 12, fontWeight: "700", color: colors.primary },
  quickButton: { minHeight: 44, alignItems: "center", flexDirection: "row", gap: spacing.xs, justifyContent: "center", padding: spacing.xs },
  feedbackActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  iconButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  disabledThemeIcon: { opacity: 0.4 },
  quickText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  completeButton: { minHeight: 44, justifyContent: "center", alignItems: "center", backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  completeText: { ...typography.label, color: colors.primary },
  addButton: { justifyContent: "center", alignItems: "center", minHeight: 44, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  disabled: { opacity: 0.55 },
  addText: { ...typography.label, color: colors.surface }
});
