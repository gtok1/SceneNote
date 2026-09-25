import { useQuery } from "@tanstack/react-query";

import { useSeasons } from "@/hooks/useLibrary";
import { getEpisodeAvailability } from "@/services/library";
import { useAuthStore } from "@/stores/authStore";
import type { LibraryListItem } from "@/types/library";
import {
  formatUpcomingEpisodeDate,
  releasedUnwatchedCount,
  seasonToCheck,
  upcomingEpisodeDate
} from "@/utils/airingAvailability";

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export function useAiringAvailability(item: LibraryListItem): { availableCount: number; upcomingLabel: string | null } {
  const userId = useAuthStore((state) => state.user?.id);
  const seasonNumber = seasonToCheck(item);
  const seasons = useSeasons(seasonNumber === null ? undefined : item.content_id);
  const season = seasons.data?.find((candidate) => candidate.season_number === seasonNumber);
  const availability = useQuery({
    queryKey: ["airing-availability", userId, item.content_id, season?.id],
    queryFn: () => getEpisodeAvailability(item.content_id, season!.id),
    enabled: Boolean(userId && season),
    staleTime: REFRESH_INTERVAL_MS,
    refetchInterval: REFRESH_INTERVAL_MS
  });

  if (seasonNumber === null || !availability.data) return { availableCount: 0, upcomingLabel: null };
  const availableCount = releasedUnwatchedCount(item, seasonNumber, availability.data.releasedEpisodeNumber);
  const nextAirDate = availableCount === 0 ? upcomingEpisodeDate(item, seasonNumber, availability.data) : null;
  return { availableCount, upcomingLabel: nextAirDate ? formatUpcomingEpisodeDate(nextAirDate) : null };
}
