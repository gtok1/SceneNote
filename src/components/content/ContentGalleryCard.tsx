import { EXTENDED_FEATURES_ENABLED } from "@/constants/features";
import { memo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { colors, elevation, radius, spacing, typography } from "@/constants/theme";
import { useAiringAvailability } from "@/hooks/useAiringAvailability";
import { useLibraryItemCast } from "@/hooks/useLibraryItemCast";
import type { LibraryListItem } from "@/types/library";
import {
  createAirDateLabel,
  createEpisodeCountLabel,
  createWatchCountLabel
} from "@/utils/contentMetaDisplay";
import { createContinueWatchingLabel } from "@/utils/continueWatching";
import { createReviewLabel } from "@/utils/reviewDisplay";
import { WatchStatusBadge } from "./WatchStatusBadge";

interface ContentGalleryCardProps {
  item: LibraryListItem;
  onPress: () => void;
  onOpenEpisodes?: () => void;
  onOpenProgressSetting?: () => void;
  onAddPin?: () => void;
  bodyMinHeight?: number;
  onBodyHeight?: (height: number) => void;
}

export const ContentGalleryCard = memo(function ContentGalleryCard({
  item,
  onPress,
  onOpenEpisodes,
  onOpenProgressSetting,
  onAddPin,
  bodyMinHeight = 0,
  onBodyHeight
}: ContentGalleryCardProps) {
  const { fontScale } = useWindowDimensions();
  const cast = useLibraryItemCast(item, 2);
  const reviewLabel = createReviewLabel(item.rating, item.one_line_review);
  const airDateLabel = createAirDateLabel(item.air_date, item.air_year);
  const episodeLabel = createEpisodeCountLabel(item.episode_count);
  const watchCountLabel = createWatchCountLabel(item.watch_count, { includeZero: true });
  const continueLabel = createContinueWatchingLabel(item);
  const { availableCount, upcomingLabel } = useAiringAvailability(item);
  const onOpenContinue =
    continueLabel?.action === "open_progress_setting"
      ? (onOpenProgressSetting ?? onOpenEpisodes)
      : onOpenEpisodes;

  return (
    <View style={styles.cell}>
      <View style={styles.card}>
        <Pressable
          accessibilityLabel={`${item.title_primary} 상세 보기`}
          accessibilityRole="button"
          onPress={onPress}
        >
          <Image
            contentFit="cover"
            source={item.poster_url ? { uri: item.poster_url } : null}
            style={styles.poster}
          />
        </Pressable>
        <View style={[styles.body, { minHeight: bodyMinHeight }]}>
          <View
            onLayout={(event) =>
              onBodyHeight?.(Math.ceil(event.nativeEvent.layout.height) + spacing.sm * 2)
            }
            style={styles.bodyContent}
          >
            <Pressable
              accessibilityLabel={`${item.title_primary} 상세 보기`}
              accessibilityRole="button"
              onPress={onPress}
              style={styles.details}
            >
              <Text
                numberOfLines={2}
                style={[styles.title, { minHeight: typography.label.lineHeight * 2 * fontScale }]}
              >
                {item.title_primary}
                {item.season_number != null ? ` · 시즌 ${item.season_number}` : ""}
              </Text>
              {availableCount > 0 ? (
                <Text
                  accessibilityLabel={`공개된 미시청 회차 ${availableCount}개`}
                  style={styles.availableBadge}
                >
                  새 회차 · 지금 볼 {availableCount}개
                </Text>
              ) : upcomingLabel ? (
                <Text accessibilityLabel={`다음 화 ${upcomingLabel}`} style={styles.upcomingBadge}>
                  {upcomingLabel}
                </Text>
              ) : null}
              <Text numberOfLines={1} style={styles.meta}>
                {[airDateLabel, item.content_type, episodeLabel, watchCountLabel]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <GenreBadgeList genres={item.genres} maxVisible={2} />
              {cast.length ? (
                <Text numberOfLines={1} style={styles.cast}>
                  {item.content_type === "anime" ? "성우" : "출연"}:{" "}
                  {cast.map((member) => member.name).join(", ")}
                </Text>
              ) : null}
              {EXTENDED_FEATURES_ENABLED && reviewLabel ? (
                <Text numberOfLines={1} style={styles.review}>
                  {reviewLabel}
                </Text>
              ) : null}
            </Pressable>
            {continueLabel && onOpenContinue ? (
              <Pressable
                accessibilityLabel={`${item.title_primary} ${continueLabel.accessibilityLabel}`}
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation();
                  onOpenContinue();
                }}
                style={[
                  styles.continueButton,
                  continueLabel.action === "open_progress_setting" ? styles.continueButtonCta : null
                ]}
              >
                <Text numberOfLines={1} style={styles.continueText}>
                  {continueLabel.text}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.badges}>
              {item.statuses.slice(0, 2).map((status) => (
                <WatchStatusBadge key={status} status={status} size="sm" />
              ))}
            </View>
          </View>
        </View>
        {onAddPin ? (
          <Pressable
            accessibilityLabel={`${item.title_primary} 핀 추가`}
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
    alignSelf: "stretch",
    minWidth: 0,
    padding: spacing.sm
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1
  },
  pinButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: spacing.sm,
    ...elevation.card,
    top: spacing.sm,
    width: 44
  },
  poster: {
    aspectRatio: 2 / 3,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    width: "100%"
  },
  body: {
    padding: spacing.sm,
    minWidth: 0
  },
  bodyContent: {
    gap: spacing.xs,
    minWidth: 0
  },
  details: {
    gap: spacing.xs,
    minWidth: 0
  },
  title: {
    color: colors.text,
    ...typography.label
  },
  meta: {
    color: colors.textMuted,
    ...typography.micro
  },
  availableBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    color: colors.success,
    ...typography.micro,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  upcomingBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    color: colors.primary,
    ...typography.micro,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  review: {
    color: colors.primary,
    ...typography.micro
  },
  cast: {
    color: colors.textMuted,
    ...typography.micro
  },
  continueButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    maxWidth: "100%",
    paddingHorizontal: spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: spacing.xs
  },
  continueButtonCta: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1
  },
  continueText: {
    color: colors.primary,
    ...typography.micro
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    minHeight: 22
  }
});
