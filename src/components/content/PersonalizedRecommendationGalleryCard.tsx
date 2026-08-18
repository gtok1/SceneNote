import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing } from "@/constants/theme";
import type { PersonalizedRecommendation } from "@/services/personalizedRecommendations";
import type { RecommendationPresentation } from "@/utils/recommendationPresentation";

interface PersonalizedRecommendationGalleryCardProps {
  result: PersonalizedRecommendation;
  presentation: RecommendationPresentation;
  onOpenQuickView: () => void;
  onAddToLibrary: () => void;
  addLabel: string;
  isAddDisabled: boolean;
  onNotInterested: () => void;
  onMoreLikeThis: () => void;
  onReduceTheme?: () => void;
}

export const PersonalizedRecommendationGalleryCard = memo(
  function PersonalizedRecommendationGalleryCard({
    result,
    presentation,
    onOpenQuickView,
    onAddToLibrary,
    addLabel,
    isAddDisabled,
    onNotInterested,
    onMoreLikeThis,
    onReduceTheme
  }: PersonalizedRecommendationGalleryCardProps) {
    const reactionLabel = presentation.ratingLabel ?? presentation.popularityLabel;

    return (
      <View style={styles.cell}>
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
              {presentation.statusBadges.length > 0 ? (
                <View style={styles.statusRow}>
                  {presentation.statusBadges.map((badge) => (
                    <Text key={badge} style={styles.statusBadge}>{badge}</Text>
                  ))}
                </View>
              ) : null}
              {reactionLabel ? <Text style={styles.reactionBadge}>{reactionLabel}</Text> : null}
            </View>

            <View style={styles.body}>
              <Text numberOfLines={2} style={styles.title}>{result.title_primary}</Text>
              {presentation.hook ? (
                <Text numberOfLines={2} style={styles.hook}>{presentation.hook}</Text>
              ) : null}
              {presentation.metadataLabel ? (
                <Text numberOfLines={2} style={styles.meta}>{presentation.metadataLabel}</Text>
              ) : null}
              <GenreBadgeList genres={result.genres} maxVisible={3} />
              {presentation.personalizedReason ? (
                <View style={[styles.reasonBox, presentation.reasonConfidence === "weak" ? styles.reasonBoxWeak : null]}>
                  <View style={styles.reasonLabelRow}>
                    <Ionicons color={colors.primary} name="sparkles-outline" size={12} />
                    <Text style={styles.reasonLabel}>{presentation.reasonLabel ?? "추천 이유"}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.reasonText}>{presentation.personalizedReason}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>

          <View style={styles.footer}>
            <Pressable accessibilityLabel={`${result.title_primary} 관심 없음`} accessibilityRole="button" onPress={onNotInterested} style={styles.iconButton}>
              <Ionicons color={colors.textMuted} name="close-circle-outline" size={18} />
            </Pressable>
            <Pressable accessibilityLabel={`${result.title_primary} 비슷한 작품 더 보기`} accessibilityRole="button" onPress={onMoreLikeThis} style={styles.iconButton}>
              <Ionicons color={colors.textMuted} name="git-compare-outline" size={18} />
            </Pressable>
            {onReduceTheme ? (
              <Pressable accessibilityLabel={`${result.title_primary} 이런 요소 줄이기`} accessibilityRole="button" onPress={onReduceTheme} style={styles.iconButton}>
                <Ionicons color={colors.textMuted} name="options-outline" size={18} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel={`${result.title_primary} 빠른 보기`}
              accessibilityRole="button"
              onPress={onOpenQuickView}
              style={styles.quickButton}
            >
              <Ionicons color={colors.text} name="eye-outline" size={14} />
              <Text style={styles.quickText}>빠른 보기</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`${result.title_primary} ${addLabel}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isAddDisabled, busy: addLabel.includes("중") }}
              disabled={isAddDisabled}
              onPress={onAddToLibrary}
              style={[styles.addButton, isAddDisabled ? styles.disabled : null]}
            >
              <Text style={styles.addText}>{addLabel}</Text>
            </Pressable>
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
    flex: 1,
    overflow: "hidden"
  },
  mainButton: { flex: 1 },
  posterArea: { position: "relative" },
  poster: { backgroundColor: colors.surfaceMuted, height: 164, width: "100%" },
  statusRow: { bottom: spacing.sm, flexDirection: "row", gap: spacing.xs, left: spacing.sm, position: "absolute" },
  statusBadge: {
    backgroundColor: "rgba(23, 23, 23, 0.82)",
    borderRadius: radius.sm,
    color: colors.surface,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  reactionBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm
  },
  body: { gap: 6, minHeight: 196, padding: spacing.sm },
  title: { color: colors.text, fontSize: 14, fontWeight: "900", lineHeight: 18, minHeight: 36 },
  hook: { color: colors.text, fontSize: 12, lineHeight: 17, minHeight: 34 },
  meta: { color: colors.textMuted, fontSize: 11, fontWeight: "700", lineHeight: 15 },
  reasonBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    gap: 3,
    marginTop: spacing.xs,
    minHeight: 59,
    padding: spacing.sm
  },
  reasonBoxWeak: { backgroundColor: colors.surfaceMuted },
  reasonLabelRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  reasonLabel: { color: colors.primary, fontSize: 10, fontWeight: "900" },
  reasonText: { color: colors.text, fontSize: 11, fontWeight: "700", lineHeight: 15 },
  footer: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between",
    padding: spacing.sm
  },
  quickButton: { alignItems: "center", flexDirection: "row", gap: 4, paddingVertical: spacing.xs },
  iconButton: { alignItems: "center", height: 32, justifyContent: "center", width: 28 },
  quickText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  addButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  disabled: { opacity: 0.55 },
  addText: { color: colors.surface, fontSize: 11, fontWeight: "900" }
});
