import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing } from "@/constants/theme";
import type { PersonalizedRecommendation } from "@/services/personalizedRecommendations";
import type { RecommendationPresentation } from "@/utils/recommendationPresentation";

interface Props {
  result: PersonalizedRecommendation;
  presentation: RecommendationPresentation;
  onOpenQuickView: () => void;
  onAddToLibrary: () => void;
  addLabel: string;
  isAddDisabled: boolean;
}

export const PersonalizedRecommendationListItem = memo(function PersonalizedRecommendationListItem({
  result,
  presentation,
  onOpenQuickView,
  onAddToLibrary,
  addLabel,
  isAddDisabled
}: Props) {
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
          {presentation.hook ? <Text numberOfLines={2} style={styles.hook}>{presentation.hook}</Text> : null}
          <Text numberOfLines={2} style={styles.meta}>
            {[reactionLabel, presentation.metadataLabel].filter(Boolean).join(" · ")}
          </Text>
          <GenreBadgeList genres={result.genres} maxVisible={3} />
          {presentation.personalizedReason ? (
            <View style={styles.reasonRow}>
              <Ionicons color={colors.primary} name="sparkles-outline" size={12} />
              <Text numberOfLines={2} style={styles.reasonText}>{presentation.personalizedReason}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable accessibilityLabel={`${result.title_primary} 빠른 보기`} onPress={onOpenQuickView} style={styles.quickButton}>
          <Ionicons color={colors.text} name="eye-outline" size={15} />
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
  );
});

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
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
  reasonText: { color: colors.text, flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  actions: { alignItems: "stretch", gap: spacing.sm },
  quickButton: { alignItems: "center", flexDirection: "row", gap: spacing.xs, justifyContent: "center", padding: spacing.xs },
  quickText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  addButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  disabled: { opacity: 0.55 },
  addText: { color: colors.surface, fontSize: 12, fontWeight: "900" }
});
