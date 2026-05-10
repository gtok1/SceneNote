import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EpisodeSelector } from "@/components/content/EpisodeSelector";
import { SeasonSelector } from "@/components/content/SeasonSelector";
import { colors, spacing } from "@/constants/theme";
import { useEpisodeProgress, useEpisodes, useSeasons, useToggleEpisodeProgress } from "@/hooks/useLibrary";
import { useEpisodeSelectionStore } from "@/stores/episodeSelectionStore";

export default function EpisodesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const selectedSeasonId = useEpisodeSelectionStore((state) => state.selectedSeasonId);
  const setSeason = useEpisodeSelectionStore((state) => state.setSeason);
  const seasons = useSeasons(id);
  const episodes = useEpisodes(id, selectedSeasonId);
  const progress = useEpisodeProgress(id);
  const toggleProgress = useToggleEpisodeProgress(id);

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
        onToggleProgress={(episode, watched) => toggleProgress.mutate({ episode, watched })}
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
