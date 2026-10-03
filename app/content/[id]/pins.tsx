import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useContent } from "@/hooks/useLibrary";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSetAtom } from "jotai";

import { revealedSpoilerPinIdsAtom } from "@/atoms/spoilerAtom";
import { PinTimelineList } from "@/components/pins/PinTimelineList";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { getHomeLayout, HOME_CONTENT_MAX_WIDTH } from "@/utils/homeLayout";
import { usePinsByContent, usePinsByEpisode } from "@/hooks/useTimelinePins";

export default function ContentPinsScreen() {
  const { id, episodeId } = useLocalSearchParams<{ id: string; episodeId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { gutter } = getHomeLayout(width);
  const content = useContent(id);
  const setRevealedIds = useSetAtom(revealedSpoilerPinIdsAtom);
  const contentPins = usePinsByContent(episodeId ? undefined : id);
  const episodePins = usePinsByEpisode(episodeId);
  const active = episodeId ? episodePins : contentPins;

  useFocusEffect(useCallback(() => () => setRevealedIds(new Set()), [setRevealedIds]));

  return (
    <View style={[styles.container, { paddingBottom: spacing.xl + insets.bottom, paddingLeft: Math.max(gutter, insets.left) - spacing.lg, paddingRight: Math.max(gutter, insets.right) - spacing.lg }]}>
      <Stack.Screen options={{ title: episodeId ? "에피소드 핀" : "작품 핀" }} />
      <View style={styles.header}>
        <Text numberOfLines={2} style={styles.title}>{content.data?.title_primary ?? "작품 정보 확인 중"}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            !episodeId && content.data?.content_type !== "movie" ? router.push({ pathname: "/content/[id]/episodes", params: { id } }) : router.push({
              pathname: "/pins/new",
              params: { contentId: id, episodeId: episodeId ?? "" }
            })
          }
          style={styles.addButton}
        >
          <Text style={styles.addText}>핀 추가</Text>
        </Pressable>
      </View>
      <PinTimelineList
        hasError={active.isError}
        isLoading={active.isLoading}
        onRetry={() => active.refetch()}
        onPinPress={(pin) => router.push({ pathname: "/pins/[id]", params: { id: pin.id } })}
        pins={active.data ?? []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    backgroundColor: colors.background,
    flex: 1,
    maxWidth: HOME_CONTENT_MAX_WIDTH,
    width: "100%"
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.lg
  },
  title: {
    ...typography.title,
    color: colors.text,
    flex: 1,
  },
  addButton: {
    minHeight: 48,
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  addText: {
    ...typography.label,
    color: colors.surface,
  }
});
