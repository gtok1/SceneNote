import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing } from "@/constants/theme";
import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { createAirDateLabel, createEpisodeCountLabel, createLibraryWatchStateLabel } from "@/utils/contentMetaDisplay";
import { matchLibraryItemForSeason } from "@/utils/seasonLibraryMatch";

interface SearchResultGalleryCardProps {
  result: SearchResult;
  onPress: () => void;
  onAddToWishlist?: () => void;
  onMarkCompleted?: () => void;
  areActionsDisabled?: boolean;
  isActionPending?: boolean;
  libraryItems?: readonly LibraryListItem[];
  recommendationReason?: string | null;
  onFindSimilar?: () => void;
}

export const SearchResultGalleryCard = memo(function SearchResultGalleryCard({
  result,
  onPress,
  onAddToWishlist,
  onMarkCompleted,
  areActionsDisabled = false,
  isActionPending = false,
  libraryItems = [],
  recommendationReason,
  onFindSimilar
}: SearchResultGalleryCardProps) {
  const episodeLabel = createEpisodeCountLabel(result.episode_count);
  const airDateLabel = createAirDateLabel(result.air_date, result.air_year);
  const watchCountLabel = createLibraryWatchStateLabel(
    matchLibraryItemForSeason(libraryItems, result.season_number)
  );

  return (
    <View style={styles.cell}>
      <View style={styles.card}>
        <Pressable
          accessibilityLabel={`${result.title_primary} 상세 보기`}
          accessibilityRole="button"
          onPress={onPress}
          style={styles.mainButton}
        >
          <Image
            accessibilityLabel={`${result.title_primary} 포스터`}
            contentFit="cover"
            source={result.poster_url ? { uri: result.poster_url } : null}
            style={styles.poster}
          />
          <View style={styles.body}>
            <Text numberOfLines={2} style={styles.title}>
              {result.title_primary}
            </Text>
            <Text numberOfLines={1} style={styles.meta}>
              {[airDateLabel, result.content_type, episodeLabel, watchCountLabel].filter(Boolean).join(" · ")}
            </Text>
            <GenreBadgeList genres={result.genres} maxVisible={2} />
            {recommendationReason !== undefined ? (
              <Text numberOfLines={1} style={styles.recommendationReason}>
                {recommendationReason?.trim() || "\u00A0"}
              </Text>
            ) : null}
            {result.matched_people?.length ? (
              <Text numberOfLines={1} style={styles.matchedPeople}>
                {result.matched_people.join(", ")}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.source}>{result.external_source.toUpperCase()}</Text>
          <View style={styles.actions}>
          {onFindSimilar ? (
            <Pressable accessibilityLabel={`${result.title_primary} 비슷한 작품 찾기`} accessibilityRole="button" onPress={onFindSimilar} style={styles.similarButton}>
              <Text style={styles.similarText}>비슷한 작품</Text>
            </Pressable>
          ) : null}
          {onAddToWishlist ? (
            <Pressable
              accessibilityLabel={`${result.title_primary} 보고 싶음`}
              accessibilityRole="button"
              accessibilityState={{ disabled: areActionsDisabled, busy: isActionPending }}
              disabled={areActionsDisabled}
              onPress={onAddToWishlist}
              style={[styles.addButton, areActionsDisabled ? styles.addButtonDisabled : null]}
            >
              <Text style={styles.addText}>보고 싶음</Text>
            </Pressable>
          ) : null}
          {onMarkCompleted ? (
            <Pressable
              accessibilityLabel={`${result.title_primary} 완료`}
              accessibilityRole="button"
              accessibilityState={{ disabled: areActionsDisabled, busy: isActionPending }}
              disabled={areActionsDisabled}
              onPress={onMarkCompleted}
              style={[styles.addButton, areActionsDisabled ? styles.addButtonDisabled : null]}
            >
              <Text style={styles.addText}>완료</Text>
            </Pressable>
          ) : null}
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    padding: spacing.sm
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  mainButton: {
    flex: 1
  },
  poster: {
    backgroundColor: colors.surfaceMuted,
    height: 154,
    width: "100%"
  },
  body: {
    gap: spacing.xs,
    minHeight: 86,
    padding: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17
  },
  meta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  matchedPeople: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800"
  },
  recommendationReason: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  footer: {
    alignItems: "stretch",
    flexDirection: "column",
    gap: spacing.xs,
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm
  },
  actions: { alignItems: "stretch", flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  similarButton: { alignItems: "center", minHeight: 44, justifyContent: "center", borderColor: colors.primary, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, width: "100%" },
  similarText: { color: colors.primary, fontSize: 10, fontWeight: "900" },
  source: {
    alignSelf: "flex-start",
    flexShrink: 0,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  addButton: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  addButtonDisabled: {
    opacity: 0.6
  },
  addText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: "900"
  }
});
