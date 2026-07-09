import { memo } from "react";
import { type GestureResponderEvent, Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { EMOTION_LABELS } from "@/constants/emotions";
import { colors, radius, spacing } from "@/constants/theme";
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
  const timeLabel =
    pin.display_time_label ??
    (pin.timestamp_seconds === null ? "시간 미지정" : formatSecondsToTimecode(pin.timestamp_seconds));

  const revealSpoiler = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onRevealSpoiler();
  };

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.pinIcon}>
          <Ionicons color={colors.primary} name="pin" size={15} />
        </View>
        {pin.emotion && pin.emotion !== "none" ? (
          <Text numberOfLines={1} style={styles.emotion}>
            {EMOTION_LABELS[pin.emotion]}
          </Text>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {pin.content_title ?? "제목 없음"}
      </Text>
      <View style={styles.metaRow}>
        {episodeLabel ? <Text style={styles.meta}>{episodeLabel}</Text> : null}
        <Text style={styles.time}>{timeLabel}</Text>
      </View>
      {shouldHideMemo ? (
        <Pressable accessibilityRole="button" onPress={revealSpoiler} style={styles.spoiler}>
          <Text style={styles.spoilerText}>스포일러 포함 · 탭해서 보기</Text>
        </Pressable>
      ) : (
        <Text numberOfLines={1} style={styles.memo}>
          {pin.memo?.trim() || "메모 없음"}
        </Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    minHeight: 118,
    padding: spacing.md
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  pinIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  emotion: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  time: {
    color: colors.primary,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "900"
  },
  memo: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  },
  spoiler: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
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
