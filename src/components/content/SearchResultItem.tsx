import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing } from "@/constants/theme";
import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { createAirDateLabel, createEpisodeCountLabel, createLibraryWatchStateLabel } from "@/utils/contentMetaDisplay";
import { matchLibraryItemForSeason } from "@/utils/seasonLibraryMatch";

interface SearchResultItemProps {
  result: SearchResult;
  onPress: () => void;
  onAddToLibrary?: () => void;
  addLabel?: string;
  isAddDisabled?: boolean;
  libraryItems?: readonly LibraryListItem[];
  recommendationReason?: string | null;
  onFindSimilar?: () => void;
}

export const SearchResultItem = memo(function SearchResultItem({
  result,
  onPress,
  onAddToLibrary,
  addLabel = "추가",
  isAddDisabled = false,
  libraryItems = [],
  recommendationReason,
  onFindSimilar
}: SearchResultItemProps) {
  const episodeLabel = createEpisodeCountLabel(result.episode_count);
  const airDateLabel = createAirDateLabel(result.air_date, result.air_year);
  const watchCountLabel = createLibraryWatchStateLabel(
    matchLibraryItemForSeason(libraryItems, result.season_number)
  );

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={`${result.title_primary} 상세 보기`}
        accessibilityRole="button"
        onPress={onPress}
        style={styles.mainButton}
      >
        <Image
          accessibilityLabel={`${result.title_primary} 포스터`}
          source={result.poster_url ? { uri: result.poster_url } : null}
          style={styles.poster}
          contentFit="cover"
        />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text numberOfLines={2} style={styles.title}>
              {result.title_primary}
            </Text>
            <Text style={styles.source}>{result.external_source.toUpperCase()}</Text>
          </View>
          {result.title_original ? (
            <Text numberOfLines={1} style={styles.original}>
              {result.title_original}
            </Text>
          ) : null}
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
              {result.matched_people.join(", ")} 출연/참여
            </Text>
          ) : null}
          {result.duplicate_hint ? <Text style={styles.hint}>비슷한 검색 결과가 있습니다</Text> : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
      {onFindSimilar ? (
        <Pressable accessibilityLabel={`${result.title_primary} 비슷한 작품 찾기`} accessibilityRole="button" onPress={onFindSimilar} style={styles.similarButton}>
          <Text style={styles.similarText}>비슷한 작품</Text>
        </Pressable>
      ) : null}
      {onAddToLibrary ? (
        <Pressable
          accessibilityLabel={`${result.title_primary} ${addLabel}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: isAddDisabled, busy: addLabel.includes("중") }}
          disabled={isAddDisabled}
          onPress={onAddToLibrary}
          style={[styles.addButton, isAddDisabled ? styles.addButtonDisabled : null]}
        >
          <Text style={styles.addText}>{addLabel}</Text>
        </Pressable>
      ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md
  },
  mainButton: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md
  },
  poster: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 92,
    width: 62
  },
  body: {
    flex: 1,
    gap: spacing.xs
  },
  titleRow: {
    gap: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20
  },
  source: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  original: {
    color: colors.textMuted,
    fontSize: 12
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12
  },
  matchedPeople: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  recommendationReason: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16
  },
  hint: {
    color: colors.warning,
    fontSize: 12
  },
  addButton: {
    minHeight: 44,
    minWidth: 44,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  actions: { alignItems: "stretch", gap: spacing.xs },
  similarButton: { minHeight: 44, justifyContent: "center", borderColor: colors.primary, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  similarText: { color: colors.primary, fontSize: 11, fontWeight: "900", textAlign: "center" },
  addButtonDisabled: {
    opacity: 0.6
  },
  addText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "800"
  }
});
