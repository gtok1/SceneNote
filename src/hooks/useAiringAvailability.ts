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
  const seasonNumber = seasonToCheck(item);
  const availability = useEpisodeAvailability(item.content_id, seasonNumber);

  if (seasonNumber === null || !availability.data) return { availableCount: 0, upcomingLabel: null };
  const availableCount = releasedUnwatchedCount(item, seasonNumber, availability.data.releasedEpisodeNumber);
  const nextAirDate = availableCount === 0 ? upcomingEpisodeDate(item, seasonNumber, availability.data) : null;
  return { availableCount, upcomingLabel: nextAirDate ? formatUpcomingEpisodeDate(nextAirDate) : null };
}

/** Also available before viewing starts, for ongoing works with no final episode total. */
export function useEpisodeAvailability(contentId: string, seasonNumber: number | null, enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  const seasons = useSeasons(enabled && seasonNumber !== null ? contentId : undefined);
  const season = seasons.data?.find(candidate => candidate.season_number === seasonNumber);
  return useQuery({
    queryKey: ["airing-availability", "published-list-v1", userId, contentId, season?.id],
    queryFn: () => getEpisodeAvailability(contentId, season!.id),
    enabled: Boolean(enabled && userId && season),
    staleTime: REFRESH_INTERVAL_MS,
    refetchInterval: enabled ? REFRESH_INTERVAL_MS : false
  });
}
