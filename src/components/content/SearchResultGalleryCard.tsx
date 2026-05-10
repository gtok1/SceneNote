import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Image } from "expo-image";

import { GenreBadgeList } from "@/components/GenreBadge";
import { colors, radius, spacing } from "@/constants/theme";
import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { createEpisodeCountLabel, createWatchCountLabel } from "@/utils/contentMetaDisplay";

interface SearchResultGalleryCardProps {
  result: SearchResult;
  onPress: () => void;
  onAddToLibrary?: () => void;
  libraryItem?: LibraryListItem | null;
}

export const SearchResultGalleryCard = memo(function SearchResultGalleryCard({
  result,
  onPress,
  onAddToLibrary,
  libraryItem = null
}: SearchResultGalleryCardProps) {
  const episodeLabel = createEpisodeCountLabel(result.episode_count);
  const watchCountLabel = libraryItem
    ? createWatchCountLabel(libraryItem.watch_count, { includeZero: true })
    : null;

  return (
    <View style={styles.cell}>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
        <Image
          contentFit="cover"
          source={result.poster_url ? { uri: result.poster_url } : null}
          style={styles.poster}
        />
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>
            {result.title_primary}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {[result.air_year, result.content_type, episodeLabel, watchCountLabel].filter(Boolean).join(" · ")}
          </Text>
          <GenreBadgeList genres={result.genres} maxVisible={2} />
          {result.matched_people?.length ? (
            <Text numberOfLines={1} style={styles.matchedPeople}>
              {result.matched_people.join(", ")}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <Text style={styles.source}>{result.external_source.toUpperCase()}</Text>
            {onAddToLibrary ? (
              <Pressable accessibilityRole="button" onPress={onAddToLibrary} style={styles.addButton}>
                <Text style={styles.addText}>추가</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Pressable>
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
  footer: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between",
    marginTop: "auto"
  },
  source: {
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
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  addText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: "900"
  }
});
