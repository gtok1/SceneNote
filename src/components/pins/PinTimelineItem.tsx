import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { EMOTION_LABELS } from "@/constants/emotions";
import { colors, radius, spacing } from "@/constants/theme";
import type { TimelinePin } from "@/types/pins";
import { formatSecondsToTimecode } from "@/utils/timecode";
import { PinMarker } from "./PinMarker";
import { TagChip } from "./TagChip";

interface PinTimelineItemProps {
  pin: TimelinePin;
  isSpoilerRevealed: boolean;
  onPress: () => void;
  onRevealSpoiler: () => void;
  compact?: boolean;
}

export const PinTimelineItem = memo(function PinTimelineItem({
  pin,
  isSpoilerRevealed,
  onPress,
  onRevealSpoiler,
  compact = false
}: PinTimelineItemProps) {
  const shouldHideMemo = pin.is_spoiler && !isSpoilerRevealed;
  const timeLabel =
    pin.display_time_label ??
    (pin.timestamp_seconds === null ? "시간 미지정" : formatSecondsToTimecode(pin.timestamp_seconds));
  const episodeLabel =
    pin.episode_number || pin.episode_title
      ? [pin.episode_number ? `${pin.episode_number}화` : null, pin.episode_title].filter(Boolean).join(" · ")
      : null;
  const contextLabel = [pin.content_title, episodeLabel].filter(Boolean).join(" · ");

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card, compact ? styles.cardCompact : null]}>
      <View style={[styles.timeline, compact ? styles.timelineCompact : null]}>
        <PinMarker active />
        <View style={styles.line} />
      </View>
      <View style={[styles.body, compact ? styles.bodyCompact : null]}>
        {contextLabel ? (
          <Text numberOfLines={1} style={[styles.context, compact ? styles.contextCompact : null]}>
            {contextLabel}
          </Text>
        ) : null}
        <View style={styles.header}>
          <Text style={[styles.time, compact ? styles.timeCompact : null]}>{timeLabel}</Text>
          {pin.emotion && pin.emotion !== "none" ? (
            <Text numberOfLines={1} style={styles.emotion}>{EMOTION_LABELS[pin.emotion]}</Text>
          ) : null}
        </View>
        {shouldHideMemo ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRevealSpoiler}
            style={[styles.spoilerBox, compact ? styles.spoilerBoxCompact : null]}
          >
            <Text style={styles.spoilerText}>스포일러 포함 · 보기</Text>
          </Pressable>
        ) : (
          <Text numberOfLines={compact ? 1 : 4} style={[styles.memo, compact ? styles.memoCompact : null]}>
            {pin.memo?.trim() || "메모 없음"}
          </Text>
        )}
        {!compact && pin.tags?.length ? (
          <View style={styles.tags}>
            {pin.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
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
    minHeight: 58,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  timeline: {
    alignItems: "center",
    width: 14
  },
  timelineCompact: {
    width: 12
  },
  line: {
    backgroundColor: colors.border,
    flex: 1,
    marginTop: spacing.xs,
    width: StyleSheet.hairlineWidth
  },
  body: {
    flex: 1,
    gap: spacing.sm
  },
  bodyCompact: {
    gap: 1
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  context: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  contextCompact: {
    fontSize: 12,
    lineHeight: 15
  },
  time: {
    color: colors.primary,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "800"
  },
  timeCompact: {
    fontSize: 13,
    lineHeight: 16
  },
  emotion: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  memo: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20
  },
  memoCompact: {
    fontSize: 12,
    lineHeight: 15
  },
  spoilerBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.md
  },
  spoilerBoxCompact: {
    padding: spacing.sm
  },
  spoilerText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center"
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  }
});
