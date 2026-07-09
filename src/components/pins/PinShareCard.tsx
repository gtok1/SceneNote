import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { EMOTION_LABELS } from "@/constants/emotions";
import { colors, radius, spacing } from "@/constants/theme";
import type { TimelinePin } from "@/types/pins";
import { formatSecondsToTimecode } from "@/utils/timecode";

interface PinShareCardProps {
  pin: TimelinePin;
  maskMemo?: boolean;
}

export const PinShareCard = forwardRef<View, PinShareCardProps>(function PinShareCard(
  { pin, maskMemo = false },
  ref
) {
  const episodeLabel = getEpisodeLabel(pin);
  const timeLabel =
    pin.display_time_label ??
    (pin.timestamp_seconds === null ? "시간 미지정" : formatSecondsToTimecode(pin.timestamp_seconds));
  const memo = maskMemo
    ? "스포일러 방지를 위해 가려진 메모"
    : pin.memo?.trim() || "메모 없음";
  const emotionLabel = pin.emotion && pin.emotion !== "none" ? EMOTION_LABELS[pin.emotion] : null;

  return (
    <View collapsable={false} ref={ref} style={styles.card}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <View style={styles.header}>
        <Text numberOfLines={3} style={styles.title}>
          {pin.content_title ?? "제목 없음"}
        </Text>
        {episodeLabel ? (
          <Text numberOfLines={1} style={styles.episode}>
            {episodeLabel}
          </Text>
        ) : null}
      </View>

      <View style={styles.timeBlock}>
        <Text style={styles.timeLabel}>Scene pin</Text>
        <Text numberOfLines={1} style={styles.timeCode}>
          {timeLabel}
        </Text>
      </View>

      <View style={styles.memoBox}>
        <Text numberOfLines={4} style={[styles.memo, maskMemo ? styles.maskedMemo : null]}>
          {memo}
        </Text>
      </View>

      <View style={styles.footer}>
        {emotionLabel ? (
          <View style={styles.emotionBadge}>
            <Text numberOfLines={1} style={styles.emotionText}>
              {emotionLabel}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <Text style={styles.brand}>SceneNote</Text>
      </View>
    </View>
  );
});

function getEpisodeLabel(pin: TimelinePin): string | null {
  if (!pin.episode_number && !pin.episode_title) return null;
  return [pin.episode_number ? `${pin.episode_number}화` : null, pin.episode_title]
    .filter(Boolean)
    .join(" · ");
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 4 / 5,
    backgroundColor: "#F8FAFC",
    borderRadius: radius.lg,
    height: 1350,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: 72,
    width: 1080
  },
  glowTop: {
    backgroundColor: colors.primarySoft,
    borderRadius: 240,
    height: 420,
    opacity: 0.8,
    position: "absolute",
    right: -120,
    top: -150,
    width: 420
  },
  glowBottom: {
    backgroundColor: colors.warningSoft,
    borderRadius: 260,
    bottom: -160,
    height: 460,
    left: -150,
    opacity: 0.9,
    position: "absolute",
    width: 460
  },
  header: {
    gap: spacing.lg
  },
  title: {
    color: "#0F172A",
    fontSize: 78,
    fontWeight: "900",
    lineHeight: 92
  },
  episode: {
    color: "#475569",
    fontSize: 34,
    fontWeight: "800"
  },
  timeBlock: {
    alignItems: "flex-start",
    gap: spacing.md
  },
  timeLabel: {
    color: "#64748B",
    fontSize: 26,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  timeCode: {
    color: colors.primary,
    fontSize: 136,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
    lineHeight: 150
  },
  memoBox: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderColor: "rgba(148,163,184,0.45)",
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 250,
    paddingHorizontal: 44,
    paddingVertical: 38
  },
  memo: {
    color: "#172033",
    fontSize: 42,
    fontWeight: "700",
    lineHeight: 58
  },
  maskedMemo: {
    color: "#64748B"
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  emotionBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    maxWidth: 520,
    paddingHorizontal: 34,
    paddingVertical: 18
  },
  emotionText: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: "900"
  },
  brand: {
    color: "#0F172A",
    fontSize: 34,
    fontWeight: "900"
  }
});
