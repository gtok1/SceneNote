import { useEffect } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EpisodeSelector } from "@/components/content/EpisodeSelector";
import { SeasonSelector } from "@/components/content/SeasonSelector";
import { colors, spacing } from "@/constants/theme";
import {
  useEpisodeProgress,
  useEpisodes,
  useLibrary,
  useSeasons,
  useToggleEpisodeProgress,
  useUpdateLibraryManualProgress
} from "@/hooks/useLibrary";
import { useEpisodeSelectionStore } from "@/stores/episodeSelectionStore";

export default function EpisodesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const selectedSeasonId = useEpisodeSelectionStore((state) => state.selectedSeasonId);
  const setSeason = useEpisodeSelectionStore((state) => state.setSeason);
  const seasons = useSeasons(id);
  const episodes = useEpisodes(id, selectedSeasonId);
  const progress = useEpisodeProgress(id);
  const library = useLibrary("all");
  const libraryItem = library.data?.find((item) => item.content_id === id);
  const toggleProgress = useToggleEpisodeProgress(id);
  const updateManualProgress = useUpdateLibraryManualProgress();
  const selectedSeason = seasons.data?.find((season) => season.id === selectedSeasonId);

  useEffect(() => {
    if (!selectedSeasonId && seasons.data?.[0]) {
      setSeason(seasons.data[0].id);
    }
  }, [seasons.data, selectedSeasonId, setSeason]);

  if (seasons.isLoading) return <LoadingSkeleton variant="episode-row" />;
  if (seasons.isError) return <ErrorState message={seasons.error.message} onRetry={() => seasons.refetch()} />;
  if (!seasons.data?.length) {
    return (
      <EmptyState
        description="외부 API에서 아직 시즌 정보를 찾지 못했거나, 이 작품은 에피소드 정보가 없는 형식입니다."
        title="시즌 정보가 없습니다"
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.notice}>에피소드 정보는 DB 캐시를 우선 사용하고, 비어 있으면 외부 API에서 불러옵니다.</Text>
      <SeasonSelector seasons={seasons.data} selectedSeasonId={selectedSeasonId} onSelect={setSeason} />
      {episodes.isLoading ? <LoadingSkeleton variant="episode-row" /> : null}
      {episodes.isError ? <ErrorState message={episodes.error.message} onRetry={() => episodes.refetch()} /> : null}
      <EpisodeSelector
        episodes={episodes.data ?? []}
        {...(libraryItem ? { libraryItem } : {})}
        onAddPin={(episode) =>
          router.push({
            pathname: "/pins/new",
            params: {
              contentId: id,
              episodeId: episode.id,
              duration: episode.duration_seconds ? String(episode.duration_seconds) : ""
            }
          })
        }
        onOpenPins={(episode) =>
          router.push({
            pathname: "/content/[id]/pins",
            params: { id, episodeId: episode.id }
          })
        }
        onOpenProgressSetting={() =>
          router.push({ pathname: "/content/[id]", params: { id, focus: "progress" } })
        }
        onSetManualProgress={(episode) => {
          if (!libraryItem) return;
          Alert.alert(
            "시청 진행 설정",
            `${episode.episode_number}화까지 봤음으로 표시할까요?`,
            [
              { text: "취소", style: "cancel" },
              {
                text: "설정",
                onPress: () => updateManualProgress.mutate(
                  {
                    libraryItemId: libraryItem.library_item_id,
                    progress: {
                      seasonNumber: selectedSeason?.season_number ?? null,
                      episodeNumber: episode.episode_number
                    }
                  },
                  { onError: (error) => Alert.alert("시청 진행 저장 실패", error.message) }
                )
              }
            ]
          );
        }}
        onToggleProgress={(episode, watched) =>
          toggleProgress.mutate({ episode, watched, ...(libraryItem ? { libraryItem } : {}) })
        }
        progress={progress.data ?? []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1
  },
  notice: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg
  }
});
