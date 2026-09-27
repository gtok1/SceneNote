import { memo } from "react";
import { type GestureResponderEvent, Pressable, StyleSheet, Text, View } from "react-native";

import { AppImage as Image } from "@/components/common/AppImage";
import { EMOTION_LABELS } from "@/constants/emotions";
import { colors, elevation, radius, spacing, typography } from "@/constants/theme";
import type { TimelinePin } from "@/types/pins";
import { formatSecondsToTimecode } from "@/utils/timecode";

interface RecentPinCardProps {
  pin: TimelinePin;
  isSpoilerRevealed: boolean;
  onPress: () => void;
  onRevealSpoiler: () => void;
}

export const RecentPinCard = memo(function RecentPinCard({
  pin,
  isSpoilerRevealed,
  onPress,
  onRevealSpoiler
}: RecentPinCardProps) {
  const shouldHideMemo = pin.is_spoiler && !isSpoilerRevealed;
  const episodeLabel = pin.episode_number ? `${pin.episode_number}화` : null;
  const memoText = pin.memo?.trim() ?? "";
  const timeLabel =
    pin.display_time_label ??
    (pin.timestamp_seconds === null ? "시간 미지정" : formatSecondsToTimecode(pin.timestamp_seconds));

  const revealSpoiler = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onRevealSpoiler();
  };

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <Image
        accessibilityLabel={pin.content_title ?? "작품 포스터"}
        contentFit="cover"
        source={pin.content_poster_url ? { uri: pin.content_poster_url } : null}
        style={styles.poster}
      />
      <View style={styles.body}>
        <View style={styles.header}>
          <Text numberOfLines={1} style={styles.title}>
            {pin.content_title ?? "제목 없음"}
          </Text>
          {pin.emotion && pin.emotion !== "none" ? (
            <Text numberOfLines={1} style={styles.emotion}>
              {EMOTION_LABELS[pin.emotion]}
            </Text>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          {episodeLabel ? <Text style={styles.meta}>{episodeLabel}</Text> : null}
          <Text style={styles.time}>{timeLabel}</Text>
        </View>
        {shouldHideMemo ? (
          <Pressable accessibilityRole="button" onPress={revealSpoiler} style={styles.spoiler}>
            <Text style={styles.spoilerText}>스포일러 포함 · 탭해서 보기</Text>
          </Pressable>
        ) : memoText ? (
          <Text numberOfLines={2} style={styles.memo}>
            {memoText}
          </Text>
        ) : null}
        <Text style={styles.date}>{formatPinDate(pin.created_at)}</Text>
      </View>
    </Pressable>
  );
});

function formatPinDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}. ${month}. ${day}`;
}

const styles = StyleSheet.create({
  card: {
    ...elevation.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexGrow: 1,
    gap: spacing.md,
    minHeight: 108,
    padding: spacing.md
  },
  poster: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 78,
    width: 52
  },
  body: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  emotion: {
    ...typography.micro,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    color: colors.primary,
    flexShrink: 0,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  title: {
    ...typography.headline,
    color: colors.text,
    flexShrink: 1
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted
  },
  time: {
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
    color: colors.primary,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  memo: {
    ...typography.body,
    color: colors.text
  },
  date: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: "auto"
  },
  spoiler: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  spoilerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  }
});
