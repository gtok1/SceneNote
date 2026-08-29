import { useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { PinComposer } from "@/components/pins/PinComposer";
import { PinShareCard } from "@/components/pins/PinShareCard";
import { colors, radius, spacing } from "@/constants/theme";
import { usePin } from "@/hooks/useTimelinePins";
import type { TimelinePin } from "@/types/pins";
import { sharePinCardImage } from "@/utils/pinShare";

export default function PinDetailScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const router = useRouter();
  const pin = usePin(id);
  const plainShareRef = useRef<View | null>(null);
  const maskedShareRef = useRef<View | null>(null);
  const [isSpoilerRevealed, setSpoilerRevealed] = useState(false);
  const [isEditing, setEditing] = useState(false);

  if (pin.isLoading) return <LoadingSkeleton variant="pin-item" />;
  if (pin.isError) return <ErrorState message={pin.error.message} onRetry={() => pin.refetch()} />;
  if (!pin.data) return <EmptyState title="핀을 찾을 수 없습니다" />;
  const currentPin = pin.data;

  const sharePin = (target: TimelinePin) => {
    if (Platform.OS === "web") return;

    const capture = async (maskMemo: boolean) => {
      try {
        await sharePinCardImage(maskMemo ? maskedShareRef : plainShareRef);
      } catch (error) {
        console.error("Pin share failed:", error);
        Alert.alert("공유 실패", error instanceof Error ? error.message : "핀 이미지를 공유하지 못했습니다.");
      }
    };

    if (!target.is_spoiler) {
      void capture(false);
      return;
    }

    Alert.alert("스포일러 핀입니다", "메모를 가린 카드로 공유할까요?", [
      { text: "취소", style: "cancel" },
      { text: "가리고 공유", onPress: () => void capture(true) },
      { text: "그대로 공유", onPress: () => void capture(false) }
    ]);
  };

  return (
    <View style={styles.container}>
      {Platform.OS !== "web" ? (
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" onPress={() => sharePin(currentPin)} style={styles.shareButton}>
            <Ionicons color={colors.surface} name="share-social-outline" size={18} />
            <Text style={styles.shareButtonText}>공유</Text>
          </Pressable>
        </View>
      ) : null}
      {isEditing ? (
        <PinComposer
          contentId={currentPin.content_id}
          defaultValues={currentPin}
          episodeId={currentPin.episode_id}
          mode="edit"
          onCancel={() => setEditing(false)}
          onSuccess={(updated) => {
            setEditing(false);
            router.replace({ pathname: "/pins/[id]", params: { id: updated.id } });
          }}
        />
      ) : (
        <View style={styles.detailBody}>
          <Text style={styles.detailLabel}>메모</Text>
          {currentPin.is_spoiler && !isSpoilerRevealed ? (
            <Pressable accessibilityRole="button" onPress={() => setSpoilerRevealed(true)} style={styles.spoilerGate}>
              <Text style={styles.spoilerGateText}>스포일러 포함 · 보기</Text>
            </Pressable>
          ) : (
            <Text style={styles.memo}>{currentPin.memo?.trim() || "메모 없음"}</Text>
          )}
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={styles.editButton}>
            <Text style={styles.editButtonText}>핀 편집</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>목록으로</Text>
          </Pressable>
        </View>
      )}
      <View pointerEvents="none" style={styles.captureLayer}>
        <PinShareCard pin={currentPin} ref={plainShareRef} />
        <PinShareCard maskMemo pin={currentPin} ref={maskedShareRef} />
      </View>
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
