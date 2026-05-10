import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";

import { GenreFilterChips } from "@/components/common/GenreFilterChips";
import { PinTimelineList } from "@/components/pins/PinTimelineList";
import { TagChip } from "@/components/pins/TagChip";
import { colors, radius, spacing } from "@/constants/theme";
import { useTags } from "@/hooks/useTags";
import { useAllPins, usePinsByTag } from "@/hooks/useTimelinePins";
import type { PinSortMode } from "@/types/pins";
import { ALL_GENRE_FILTER, matchesGenreFilter } from "@/utils/genre";

export default function PinsScreen() {
  const [sortMode, setSortMode] = useState<PinSortMode>("latest");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState(ALL_GENRE_FILTER);
  const allPins = useAllPins();
  const taggedPins = usePinsByTag(selectedTagId ?? undefined);
  const tags = useTags();
  const router = useRouter();

  const activePins = selectedTagId ? taggedPins.data : allPins.data;
  const genreOptions = useMemo(
    () => (activePins ?? []).flatMap((pin) => pin.genres ?? []),
    [activePins]
  );
  const genreFilteredPins = useMemo(
    () => (activePins ?? []).filter((pin) => matchesGenreFilter(pin.genres, genreFilter)),
    [activePins, genreFilter]
  );
  const sortedPins = useMemo(() => {
    const pins = [...genreFilteredPins];
    if (sortMode === "timeline") {
      return pins.sort((a, b) => {
        const aTime = a.timestamp_seconds ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.timestamp_seconds ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime || a.created_at.localeCompare(b.created_at);
      });
    }
    return pins.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [genreFilteredPins, sortMode]);

  const isLoading = selectedTagId ? taggedPins.isLoading : allPins.isLoading;
  const isError = selectedTagId ? taggedPins.isError : allPins.isError;
  const hasActiveFilter = Boolean(selectedTagId) || genreFilter !== ALL_GENRE_FILTER;

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSortMode("latest")}
          style={[styles.segment, sortMode === "latest" && styles.segmentSelected]}
        >
          <Text style={[styles.segmentText, sortMode === "latest" && styles.segmentTextSelected]}>
            최신순
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSortMode("timeline")}
          style={[styles.segment, sortMode === "timeline" && styles.segmentSelected]}
        >
          <Text style={[styles.segmentText, sortMode === "timeline" && styles.segmentTextSelected]}>
            시간순
          </Text>
        </Pressable>
      </View>

      <View style={styles.genreFilters}>
        <GenreFilterChips genres={genreOptions} onChange={setGenreFilter} value={genreFilter} />
      </View>

      <ScrollView contentContainerStyle={styles.tags} horizontal showsHorizontalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedTagId(null)}
          style={[styles.allTag, !selectedTagId && styles.allTagSelected]}
        >
          <Text style={[styles.allTagText, !selectedTagId && styles.allTagTextSelected]}>전체</Text>
        </Pressable>
        {tags.data?.map((tag) => (
          <TagChip
            key={tag.id}
            onPress={() => setSelectedTagId(tag.id)}
            selected={selectedTagId === tag.id}
            tag={tag}
          />
        ))}
      </ScrollView>

      <PinTimelineList
        hasError={isError}
        isLoading={isLoading}
        onRetry={() => (selectedTagId ? taggedPins.refetch() : allPins.refetch())}
        onPinPress={(pin) => router.push({ pathname: "/pins/[id]", params: { id: pin.id } })}
        emptyTitle={hasActiveFilter ? "조건에 맞는 핀이 없어요" : "아직 핀이 없어요"}
        emptyDescription={hasActiveFilter ? "장르나 태그 조건을 바꿔 보세요." : "첫 장면 기록을 남겨보세요."}
        pins={sortedPins}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1
  },
  toolbar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm
  },
  genreFilters: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  segment: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  segmentSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  segmentText: {
    color: colors.textMuted,
    fontWeight: "800"
  },
  segmentTextSelected: {
    color: colors.surface
  },
  tags: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md
  },
  allTag: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  allTagSelected: {
    backgroundColor: colors.primary
  },
  allTagText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  allTagTextSelected: {
    color: colors.surface
  }
});
