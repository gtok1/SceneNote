import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { PinComposer } from "@/components/pins/PinComposer";
import { EMOTION_LABELS } from "@/constants/emotions";
import { usePinContext } from "@/hooks/usePinContext";
import { formatSecondsToTimecode } from "@/utils/timecode";
import { TagChip } from "@/components/pins/TagChip";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/constants/theme";
import { usePin } from "@/hooks/useTimelinePins";

export default function PinDetailScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const router = useRouter();
  const pin = usePin(id);
  const context = usePinContext(pin.data?.content_id ?? "", pin.data?.episode_id ?? null);
  const insets = useSafeAreaInsets();
  const [isSpoilerRevealed, setSpoilerRevealed] = useState(false);
  const [isEditing, setEditing] = useState(false);

  useFocusEffect(useCallback(() => { setSpoilerRevealed(false); return () => setSpoilerRevealed(false); }, []));

  if (pin.isLoading) return <LoadingSkeleton variant="pin-item" />;
  if (pin.isError) return <ErrorState message={pin.error.message} onRetry={() => pin.refetch()} />;
  if (!pin.data) return <EmptyState title="핀을 찾을 수 없습니다" />;
  const currentPin = pin.data;

  return (
    <View style={styles.container}>
      {isEditing ? (
        <PinComposer
          contentId={currentPin.content_id}
          defaultValues={currentPin}
          episodeId={currentPin.episode_id}
          mode="edit"
          onCancel={() => setEditing(false)}
          onSuccess={(updated) => {
            setEditing(false);
            router.dismissTo({ pathname: "/content/[id]/pins", params: { id: updated.content_id, ...(updated.episode_id ? { episodeId: updated.episode_id } : {}) } });
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={[styles.detailBody, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.memo}>{context.data?.title ?? currentPin.content_title ?? "작품"}</Text>
          <Text style={styles.detailLabel}>{context.data?.label ?? (currentPin.episode_id ? `${currentPin.episode_number ?? ""}화` : "영화")} · {currentPin.timestamp_seconds === null ? "시간 없음" : formatSecondsToTimecode(currentPin.timestamp_seconds)}</Text>
          <Text style={styles.detailLabel}>메모</Text>
          {currentPin.is_spoiler && !isSpoilerRevealed ? (
            <Pressable accessibilityRole="button" onPress={() => setSpoilerRevealed(true)} style={styles.spoilerGate}>
              <Text style={styles.spoilerGateText}>스포일러 포함 · 보기</Text>
            </Pressable>
          ) : (
            <Text style={styles.memo}>{currentPin.memo?.trim() || "메모 없음"}</Text>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{currentPin.tags?.map(tag => <TagChip key={tag.id} tag={tag} />)}</View>
          <Text style={styles.detailLabel}>감정 · {EMOTION_LABELS[currentPin.emotion ?? "none"]}</Text>
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={styles.editButton}>
            <Text style={styles.editButtonText}>핀 편집</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/pins")} style={styles.backButton}>
            <Text style={styles.backButtonText}>목록으로</Text>
          </Pressable>
        </ScrollView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.lg
  },
  shareButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900"
  },
  captureLayer: {
    left: -1200,
    opacity: 0,
    position: "absolute",
    top: 0
  },
  detailBody: { gap: spacing.md, padding: spacing.lg },
  detailLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
  memo: { color: colors.text, fontSize: 16, lineHeight: 25 },
  spoilerGate: { alignItems: "center", borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, justifyContent: "center", minHeight: 56 },
  spoilerGateText: { color: colors.primary, fontWeight: "800" },
  editButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.md, justifyContent: "center", minHeight: 48 },
  editButtonText: { color: colors.surface, fontWeight: "900" },
  backButton: { alignItems: "center", justifyContent: "center", minHeight: 44 },
  backButtonText: { color: colors.textMuted, fontWeight: "800" }
});
