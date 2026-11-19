import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ContentCast } from "@/components/content/ContentCast";
import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing, typography } from "@/constants/theme";
import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { createAirDateLabel, createEpisodeCountLabel, createLibraryWatchStateLabel } from "@/utils/contentMetaDisplay";
import { matchLibraryItemForSeason } from "@/utils/seasonLibraryMatch";
import { formatSearchResultTitle } from "@/utils/searchResultTitle";
import { getGenreDisplayName } from "@/utils/genre";

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
  expanded?: boolean;
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
  onFindSimilar,
  expanded = false
}: SearchResultGalleryCardProps) {
  const episodeLabel = createEpisodeCountLabel(result.episode_count);
  const displayTitle = formatSearchResultTitle(result);
  const airDateLabel = createAirDateLabel(result.air_date, result.air_year);
  const watchCountLabel = createLibraryWatchStateLabel(
    matchLibraryItemForSeason(libraryItems, result.season_number)
  );
  const overview = result.localized_overview ?? result.overview;
  const cast = (
    <ContentCast
      compact
      source={result.external_source}
      externalId={result.external_id}
      contentType={result.content_type}
      genres={result.genres ?? []}
    />
  );

  return (
    <View style={[styles.cell, expanded && styles.expandedCell]}>
      <View testID="search-result-gallery-card" style={styles.card}>
        <Pressable
          accessibilityLabel={`${displayTitle} 상세 보기`}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.mainButton, pressed && styles.pressed]}
        >
          <View style={styles.summary}>
            <Image
              accessibilityLabel={`${displayTitle} 포스터`}
              contentFit="cover"
              source={result.poster_url ? { uri: result.poster_url } : null}
              style={[styles.poster, expanded && styles.expandedPoster]}
            />
            <View style={styles.body}>
              <Text numberOfLines={2} style={styles.title}>{displayTitle}</Text>
              <Text numberOfLines={2} style={styles.meta}>
                {[airDateLabel, episodeLabel, watchCountLabel].filter(Boolean).join(" · ")}
              </Text>
              <Text numberOfLines={1} style={styles.source}>{result.external_source.toUpperCase()}</Text>
              {expanded ? cast : null}
              {expanded && overview ? <Text numberOfLines={2} style={styles.overview}>{overview}</Text> : null}
            </View>
          </View>
          {!expanded ? cast : null}
          {expanded && result.genres?.length ? (
            <Text numberOfLines={1} style={styles.genres}>{result.genres.map(getGenreDisplayName).join(" · ")}</Text>
          ) : null}
          {recommendationReason !== undefined ? (
            <Text numberOfLines={1} style={styles.recommendationReason}>
              {recommendationReason?.trim() || "\u00A0"}
            </Text>
          ) : null}
          {result.matched_people?.length ? (
            <Text numberOfLines={1} style={styles.matchedPeople}>{result.matched_people.join(", ")}</Text>
          ) : null}
        </Pressable>

        <View style={[styles.footer, expanded && styles.expandedFooter]}>
          {onFindSimilar ? (
            <Pressable
              accessibilityLabel={`${displayTitle} 비슷한 작품 찾기`}
              accessibilityRole="button"
              onPress={onFindSimilar}
              style={({ pressed }) => [styles.similarButton, expanded && styles.expandedSimilarButton, pressed && styles.pressed]}
            >
              {expanded ? <Ionicons name="git-compare-outline" size={18} color={colors.primary} /> : <Text style={styles.similarText}>비슷한 작품</Text>}
            </Pressable>
          ) : null}
          <View style={[styles.actions, expanded && styles.expandedActions]}>
            {onAddToWishlist ? (
              <Pressable
                accessibilityLabel={`${displayTitle} 보고 싶음`}
                accessibilityRole="button"
                aria-disabled={areActionsDisabled} aria-busy={isActionPending}
                disabled={areActionsDisabled}
                onPress={onAddToWishlist}
                style={({ pressed }) => [styles.addButton, areActionsDisabled && styles.disabled, pressed && styles.pressed]}
              >
                <Text numberOfLines={1} style={styles.addText}>보고 싶음</Text>
              </Pressable>
            ) : null}
            {onMarkCompleted ? (
              <Pressable
                accessibilityLabel={`${displayTitle} 완료`}
                accessibilityRole="button"
                aria-disabled={areActionsDisabled} aria-busy={isActionPending}
                disabled={areActionsDisabled}
                onPress={onMarkCompleted}
                style={({ pressed }) => [styles.completeButton, areActionsDisabled && styles.disabled, pressed && styles.pressed]}
              >
                <Text numberOfLines={1} style={styles.completeText}>완료</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cell: { flex: 1, padding: spacing.sm },
  expandedCell: { paddingVertical: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minWidth: 0
  },
  mainButton: { flex: 1, gap: spacing.xs, padding: spacing.sm },
  summary: { flexDirection: "row", gap: spacing.sm, minWidth: 0 },
  poster: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 96, width: 64 },
  expandedPoster: { height: 144, width: 96 },
  body: { flex: 1, gap: spacing.xs, minWidth: 0 },
  title: { ...typography.headline, color: colors.text },
  meta: { ...typography.micro, color: colors.textMuted },
  source: { ...typography.micro, color: colors.textMuted },
  overview: { ...typography.caption, color: colors.text },
  genres: { ...typography.micro, color: colors.primary },
  matchedPeople: { ...typography.micro, color: colors.primary },
  recommendationReason: { ...typography.micro, color: colors.primary },
  footer: { gap: spacing.xs, paddingBottom: spacing.sm, paddingHorizontal: spacing.sm },
  expandedFooter: { alignItems: "stretch", flexDirection: "row" },
  actions: { alignItems: "stretch", flexDirection: "row", gap: spacing.xs },
  expandedActions: { flex: 1, minWidth: 0 },
  expandedSimilarButton: { width: 44 },
  similarButton: {
    alignItems: "center", borderColor: colors.border, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, justifyContent: "center", minHeight: 44,
    paddingHorizontal: spacing.sm
  },
  similarText: { ...typography.caption, color: colors.primary },
  addButton: {
    alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.pill,
    flex: 1, justifyContent: "center", minHeight: 44, minWidth: 44, paddingHorizontal: spacing.xs
  },
  addText: { ...typography.label, color: colors.surface },
  completeButton: {
    alignItems: "center", backgroundColor: colors.surface, borderColor: colors.primary,
    borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, flex: 1,
    justifyContent: "center", minHeight: 44, minWidth: 44, paddingHorizontal: spacing.xs
  },
  completeText: { ...typography.label, color: colors.primary },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 }
});
