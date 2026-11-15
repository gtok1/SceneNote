import type { LibraryListItem, SeasonEpisodeCount } from "@/types/library";
import { createSeasonOffsetsByNumber, resolveLibraryItemProgress, selectLibraryProgressSeasons, toAbsoluteEpisodeNumber } from "./episodeProgress";

export interface LibraryProgressSeason extends SeasonEpisodeCount {
  id: string;
  content_id: string;
}

export interface LibraryProgressRow {
  content_id: string;
  episode_id: string;
  episodes?: { season_id: string | null; episode_number: number | null }
    | { season_id: string | null; episode_number: number | null }[] | null;
}

type ProgressItem = Pick<LibraryListItem, "content_type" | "source_api" | "season_number" | "statuses"
  | "manual_watched_season_number" | "manual_watched_episode_number">;

/** Pure service mapping: all counts and positions describe the same registration scope. */
export function getLibraryProgressFields(
  item: ProgressItem,
  seasons: readonly LibraryProgressSeason[],
  rows: readonly LibraryProgressRow[]
) {
  const seasonCounts = seasons.map(({ season_number, episode_count }) => ({ season_number, episode_count }))
    .sort((a, b) => a.season_number - b.season_number);
  const selectedSeasons = selectLibraryProgressSeasons(item, seasons);
  const selectedIds = new Set(selectedSeasons.map((season) => season.id));
  // An unknown season total is not replaced by another season or a partial whole-work sum.
  const episodeCount = selectedSeasons.length > 0 && selectedSeasons.every((season) => season.episode_count !== null)
    ? selectedSeasons.reduce((total, season) => total + Math.max(0, season.episode_count ?? 0), 0) || null
    : null;
  const offsets = createSeasonOffsetsByNumber(seasonCounts);
  const offsetsById = new Map(seasons.map((season) => [season.id, offsets.get(season.season_number) ?? 0]));
  const watchedIds = new Set<string>();
  let derived: number | null = null;
  for (const row of rows) {
    const episode = Array.isArray(row.episodes) ? row.episodes[0] : row.episodes;
    if (item.season_number !== null && (!episode?.season_id || !selectedIds.has(episode.season_id))) continue;
    watchedIds.add(row.episode_id);
    if (episode?.episode_number && episode.episode_number > 0) {
      const offset = item.season_number === null ? offsetsById.get(episode.season_id ?? "") ?? 0 : 0;
      derived = Math.max(derived ?? 0, offset + episode.episode_number);
    }
  }
  const fields = {
    episode_count: episodeCount,
    watched_episode_count: watchedIds.size,
    derived_watched_through: derived,
    manual_watched_absolute_number: toAbsoluteEpisodeNumber(
      item.manual_watched_season_number, item.manual_watched_episode_number, offsets
    ),
    season_episode_counts: seasonCounts
  };
  return { ...fields, ...resolveLibraryItemProgress({ ...item, ...fields }, item.statuses) };
}
