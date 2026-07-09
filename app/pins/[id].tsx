import { useRef } from "react";
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
      <PinComposer
        contentId={currentPin.content_id}
        defaultValues={currentPin}
        episodeId={currentPin.episode_id}
        mode="edit"
        onCancel={() => router.back()}
        onSuccess={(updated) => router.replace({ pathname: "/pins/[id]", params: { id: updated.id } })}
      />
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
  }
});
