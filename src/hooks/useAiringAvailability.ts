import { useQuery } from "@tanstack/react-query";

import { useSeasons } from "@/hooks/useLibrary";
import { getEpisodeAvailability } from "@/services/library";
import { useAuthStore } from "@/stores/authStore";
import type { LibraryListItem } from "@/types/library";
import {
  formatUpcomingEpisodeDate,
  isAvailabilitySettled,
  koreaToday,
  planAiringAvailability,
  releasedUnwatchedCount,
  upcomingEpisodeDate
} from "@/utils/airingAvailability";
import { EDGE_LIST_QUERY_OPTIONS } from "@/utils/metadataQuery";

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export function useAiringAvailability(item: LibraryListItem): { availableCount: number; upcomingLabel: string | null } {
  // 답이 정해진 작품은 서버에 묻지 않는다(docs/71 D-2).
  const plan = planAiringAvailability(item, koreaToday());
  const availability = useEpisodeAvailability(item.content_id, plan.kind === "remote" ? plan.seasonNumber : null);

  if (plan.kind === "none") return { availableCount: 0, upcomingLabel: null };
  const data = plan.kind === "local" ? plan.availability : availability.data;
  if (!data) return { availableCount: 0, upcomingLabel: null };
  const availableCount = releasedUnwatchedCount(item, plan.seasonNumber, data.releasedEpisodeNumber);
  const nextAirDate = availableCount === 0 ? upcomingEpisodeDate(item, plan.seasonNumber, data) : null;
  return { availableCount, upcomingLabel: nextAirDate ? formatUpcomingEpisodeDate(nextAirDate) : null };
}

/** Also available before viewing starts, for ongoing works with no final episode total. */
export function useEpisodeAvailability(contentId: string, seasonNumber: number | null, enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  const seasons = useSeasons(enabled && seasonNumber !== null ? contentId : undefined);
  const season = seasons.data?.find(candidate => candidate.season_number === seasonNumber);
  return useQuery({
    ...EDGE_LIST_QUERY_OPTIONS,
    queryKey: ["airing-availability", "published-list-v1", userId, contentId, season?.id],
    queryFn: () => getEpisodeAvailability(contentId, season!.id),
    enabled: Boolean(enabled && userId && season),
    staleTime: REFRESH_INTERVAL_MS,
    refetchInterval: (query) => enabled && !isAvailabilitySettled(query.state.data, season?.episode_count) ? REFRESH_INTERVAL_MS : false
  });
}
