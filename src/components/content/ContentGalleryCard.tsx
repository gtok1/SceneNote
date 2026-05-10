import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Image } from "expo-image";

import { GenreBadgeList } from "@/components/GenreBadge";
import { colors, radius, spacing } from "@/constants/theme";
import { useLibraryItemCast } from "@/hooks/useLibraryItemCast";
import type { LibraryListItem } from "@/types/library";
import { createEpisodeCountLabel, createWatchCountLabel } from "@/utils/contentMetaDisplay";
import { createReviewLabel } from "@/utils/reviewDisplay";
import { WatchStatusBadge } from "./WatchStatusBadge";

interface ContentGalleryCardProps {
  item: LibraryListItem;
  onPress: () => void;
}

export const ContentGalleryCard = memo(function ContentGalleryCard({
  item,
  onPress
}: ContentGalleryCardProps) {
  const cast = useLibraryItemCast(item, 2);
  const reviewLabel = createReviewLabel(item.rating, item.one_line_review);
  const episodeLabel = createEpisodeCountLabel(item.episode_count);
  const watchCountLabel = createWatchCountLabel(item.watch_count, { includeZero: true });

  return (
    <View style={styles.cell}>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
        <Image
          contentFit="cover"
          source={item.poster_url ? { uri: item.poster_url } : null}
          style={styles.poster}
        />
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>
            {item.title_primary}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {[item.air_year, item.content_type, episodeLabel, watchCountLabel].filter(Boolean).join(" · ")}
          </Text>
          <GenreBadgeList genres={item.genres} maxVisible={2} />
          {cast.length ? (
            <Text numberOfLines={1} style={styles.cast}>
              {item.content_type === "anime" ? "성우" : "출연"}:{" "}
              {cast.map((member) => member.name).join(", ")}
            </Text>
          ) : null}
          {reviewLabel ? (
            <Text numberOfLines={1} style={styles.review}>
              {reviewLabel}
            </Text>
          ) : null}
          <View style={styles.badges}>
            {item.statuses.slice(0, 2).map((status) => (
              <WatchStatusBadge key={status} status={status} size="sm" />
            ))}
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
    aspectRatio: 2 / 3,
    backgroundColor: colors.surfaceMuted,
    width: "100%"
  },
  body: {
    gap: spacing.xs,
    minHeight: 92,
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
  review: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800"
  },
  cast: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    minHeight: 22
  }
});
