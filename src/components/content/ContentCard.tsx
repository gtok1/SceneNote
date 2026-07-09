import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing } from "@/constants/theme";
import { useLibraryItemCast } from "@/hooks/useLibraryItemCast";
import type { LibraryListItem } from "@/types/library";
import { createAirDateLabel, createEpisodeCountLabel, createWatchCountLabel } from "@/utils/contentMetaDisplay";
import { createContinueWatchingLabel } from "@/utils/continueWatching";
import { createReviewLabel } from "@/utils/reviewDisplay";
import { WatchStatusBadge } from "./WatchStatusBadge";

interface ContentCardProps {
  item: LibraryListItem;
  onPress: () => void;
  onOpenEpisodes?: () => void;
  compact?: boolean;
}

export const ContentCard = memo(function ContentCard({
  item,
  onPress,
  onOpenEpisodes,
  compact = false
}: ContentCardProps) {
  const cast = useLibraryItemCast(item, 2);
  const reviewLabel = createReviewLabel(item.rating, item.one_line_review);
  const airDateLabel = createAirDateLabel(item.air_date, item.air_year);
  const episodeLabel = createEpisodeCountLabel(item.episode_count);
  const watchCountLabel = createWatchCountLabel(item.watch_count, { includeZero: true });
  const continueLabel = createContinueWatchingLabel(item);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card, compact ? styles.cardCompact : null]}>
      <Image
        source={item.poster_url ? { uri: item.poster_url } : null}
        style={[styles.poster, compact ? styles.posterCompact : null]}
        contentFit="cover"
      />
      <View style={[styles.body, compact ? styles.bodyCompact : null]}>
        <Text numberOfLines={compact ? 1 : 2} style={[styles.title, compact ? styles.titleCompact : null]}>
          {item.title_primary}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, compact ? styles.metaCompact : null]}>
          {[airDateLabel, item.content_type, episodeLabel, watchCountLabel].filter(Boolean).join(" · ")}
        </Text>
        <GenreBadgeList genres={item.genres} maxVisible={2} />
        {cast.length ? (
          <Text numberOfLines={1} style={[styles.cast, compact ? styles.castCompact : null]}>
            {item.content_type === "anime" ? "성우" : "출연"}:{" "}
            {cast.map((member) => member.name).join(", ")}
          </Text>
        ) : null}
        {reviewLabel ? (
          <Text numberOfLines={1} style={[styles.review, compact ? styles.reviewCompact : null]}>
            {reviewLabel}
          </Text>
        ) : null}
        {continueLabel && onOpenEpisodes ? (
          <Pressable
            accessibilityLabel={`${item.title_primary} 이어보기`}
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation();
              onOpenEpisodes();
            }}
            style={[styles.continueButton, compact ? styles.continueButtonCompact : null]}
          >
            <Text numberOfLines={1} style={[styles.continueText, compact ? styles.continueTextCompact : null]}>
              {continueLabel}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.badges}>
          {item.statuses.map((status) => (
            <WatchStatusBadge key={status} status={status} size="sm" />
          ))}
        </View>
      </View>
    </Pressable>
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
  cardCompact: {
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  poster: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 88,
    width: 60
  },
  posterCompact: {
    height: 48,
    width: 34
  },
  body: {
    flex: 1,
    gap: spacing.sm
  },
  bodyCompact: {
    gap: 2
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21
  },
  titleCompact: {
    fontSize: 14,
    lineHeight: 17
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13
  },
  metaCompact: {
    fontSize: 11
  },
  cast: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  castCompact: {
    fontSize: 11
  },
  review: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  reviewCompact: {
    fontSize: 11
  },
  continueButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5
  },
  continueButtonCompact: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 3
  },
  continueText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  continueTextCompact: {
    fontSize: 11
  }
});
