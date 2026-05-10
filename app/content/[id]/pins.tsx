import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import { useSetAtom } from "jotai";

import { revealedSpoilerPinIdsAtom } from "@/atoms/spoilerAtom";
import { PinTimelineList } from "@/components/pins/PinTimelineList";
import { colors, radius, spacing } from "@/constants/theme";
import { usePinsByContent, usePinsByEpisode } from "@/hooks/useTimelinePins";

export default function ContentPinsScreen() {
  const { id, episodeId } = useLocalSearchParams<{ id: string; episodeId?: string }>();
  const router = useRouter();
  const setRevealedIds = useSetAtom(revealedSpoilerPinIdsAtom);
  const contentPins = usePinsByContent(episodeId ? undefined : id);
  const episodePins = usePinsByEpisode(episodeId);
  const active = episodeId ? episodePins : contentPins;

  useEffect(() => () => setRevealedIds(new Set()), [setRevealedIds]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{episodeId ? "에피소드 핀" : "작품 핀"}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
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
    backgroundColor: colors.background,
    flex: 1
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  addText: {
    color: colors.surface,
    fontWeight: "800"
  }
});
