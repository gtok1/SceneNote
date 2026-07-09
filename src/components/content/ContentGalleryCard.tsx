import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing } from "@/constants/theme";
import { useLibraryItemCast } from "@/hooks/useLibraryItemCast";
import type { LibraryListItem } from "@/types/library";
import { createAirDateLabel, createEpisodeCountLabel, createWatchCountLabel } from "@/utils/contentMetaDisplay";
import { createContinueWatchingLabel } from "@/utils/continueWatching";
import { createReviewLabel } from "@/utils/reviewDisplay";
import { WatchStatusBadge } from "./WatchStatusBadge";

interface ContentGalleryCardProps {
  item: LibraryListItem;
  onPress: () => void;
  onOpenEpisodes?: () => void;
  onAddPin?: () => void;
}

export const ContentGalleryCard = memo(function ContentGalleryCard({
  item,
  onPress,
  onOpenEpisodes,
  onAddPin
}: ContentGalleryCardProps) {
  const cast = useLibraryItemCast(item, 2);
  const reviewLabel = createReviewLabel(item.rating, item.one_line_review);
  const airDateLabel = createAirDateLabel(item.air_date, item.air_year);
  const episodeLabel = createEpisodeCountLabel(item.episode_count);
  const watchCountLabel = createWatchCountLabel(item.watch_count, { includeZero: true });
  const continueLabel = createContinueWatchingLabel(item);

  return (
    <View style={styles.cell}>
      <View style={styles.card}>
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.contentButton}>
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
            {[airDateLabel, item.content_type, episodeLabel, watchCountLabel].filter(Boolean).join(" · ")}
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
          {continueLabel && onOpenEpisodes ? (
            <Pressable
              accessibilityLabel={`${item.title_primary} 이어보기`}
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation();
                onOpenEpisodes();
              }}
              style={styles.continueButton}
            >
              <Text numberOfLines={1} style={styles.continueText}>
                {continueLabel}
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.badges}>
            {item.statuses.slice(0, 2).map((status) => (
              <WatchStatusBadge key={status} status={status} size="sm" />
            ))}
          </View>
        </View>
        </Pressable>
        {onAddPin ? (
          <Pressable
            accessibilityLabel="핀 추가"
            accessibilityRole="button"
            onPress={onAddPin}
            style={styles.pinButton}
          >
            <Ionicons color={colors.primary} name="pin" size={16} />
          </Pressable>
        ) : null}
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
  contentButton: {
    flex: 1
  },
  pinButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: "center",
    position: "absolute",
    right: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    top: spacing.sm,
    width: 32
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
  continueButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    maxWidth: "100%",
    paddingHorizontal: spacing.xs,
    paddingVertical: 4
  },
  continueText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900"
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    minHeight: 22
  }
});
