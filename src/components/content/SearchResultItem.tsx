import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Image } from "expo-image";

import { GenreBadgeList } from "@/components/GenreBadge";
import { colors, radius, spacing } from "@/constants/theme";
import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { createEpisodeCountLabel, createWatchCountLabel } from "@/utils/contentMetaDisplay";

interface SearchResultItemProps {
  result: SearchResult;
  onPress: () => void;
  onAddToLibrary?: () => void;
  libraryItem?: LibraryListItem | null;
}

export const SearchResultItem = memo(function SearchResultItem({
  result,
  onPress,
  onAddToLibrary,
  libraryItem = null
}: SearchResultItemProps) {
  const episodeLabel = createEpisodeCountLabel(result.episode_count);
  const watchCountLabel = libraryItem
    ? createWatchCountLabel(libraryItem.watch_count, { includeZero: true })
    : null;

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.mainButton}>
        <Image
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
            {[result.air_year, result.content_type, episodeLabel, watchCountLabel].filter(Boolean).join(" · ")}
          </Text>
          <GenreBadgeList genres={result.genres} maxVisible={2} />
          {result.matched_people?.length ? (
            <Text numberOfLines={1} style={styles.matchedPeople}>
              {result.matched_people.join(", ")} 출연/참여
            </Text>
          ) : null}
          {result.duplicate_hint ? <Text style={styles.hint}>비슷한 검색 결과가 있습니다</Text> : null}
        </View>
      </Pressable>
      {onAddToLibrary ? (
        <Pressable accessibilityRole="button" onPress={onAddToLibrary} style={styles.addButton}>
          <Text style={styles.addText}>추가</Text>
        </Pressable>
      ) : null}
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
  hint: {
    color: colors.warning,
    fontSize: 12
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  addText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "800"
  }
});
