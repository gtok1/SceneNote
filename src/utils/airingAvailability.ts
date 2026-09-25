import type { LibraryListItem, SeasonEpisodeCount } from "@/types/library";
import { createSeasonOffsetsByNumber, toSeasonRelativeEpisodeNumber } from "@/utils/episodeProgress";

type WatchingItem = Pick<
  LibraryListItem,
  "content_type" | "statuses" | "progress_source" | "season_number" |
  "season_episode_counts" | "effective_watched_through" | "next_episode_number"
>;

export function seasonToCheck(item: WatchingItem): number | null {
  if (!item.statuses.includes("watching") || item.content_type === "movie") return null;
  if (item.progress_source === "none" || item.next_episode_number === null) return null;
  if (item.season_number !== null) return item.season_number;
  return toSeasonRelativeEpisodeNumber(item.next_episode_number, item.season_episode_counts).seasonNumber;
}

export function releasedUnwatchedCount(
  item: WatchingItem,
  seasonNumber: number,
  releasedEpisodeNumber: number | null
): number {
  if (seasonToCheck(item) !== seasonNumber || releasedEpisodeNumber === null) return 0;
  const offsets = createSeasonOffsetsByNumber(item.season_episode_counts);
  const seasonOffset = offsets.get(seasonNumber) ?? 0;
  const season = item.season_episode_counts.find((candidate: SeasonEpisodeCount) => candidate.season_number === seasonNumber);
  const released = Math.min(releasedEpisodeNumber, season?.episode_count ?? releasedEpisodeNumber);
  const watchedInSeason = Math.max(0, item.effective_watched_through - seasonOffset);
  return Math.max(0, released - watchedInSeason);
}

export function releasedEpisodeFromKnownDates(
  episodes: { episode_number: number; air_date: string | null }[],
  now: Date = new Date()
): number | null {
  const todayInKorea = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let latest: number | null = null;
  for (const episode of episodes) {
    if (!Number.isInteger(episode.episode_number) || episode.episode_number < 1) continue;
    if (!episode.air_date || !/^\d{4}-\d{2}-\d{2}$/.test(episode.air_date)) continue;
    if (episode.air_date > todayInKorea) continue;
    latest = Math.max(latest ?? 0, episode.episode_number);
  }
  return latest;
}

export function upcomingEpisodeFromKnownDates(
  episodes: { episode_number: number; air_date: string | null }[],
  now: Date = new Date()
): { episodeNumber: number; airDate: string } | null {
  const todayInKorea = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const next = episodes
    .filter((episode) => Number.isInteger(episode.episode_number) && episode.episode_number > 0)
    .filter((episode) => episode.air_date && /^\d{4}-\d{2}-\d{2}$/.test(episode.air_date) && episode.air_date > todayInKorea)
    .sort((a, b) => (a.air_date ?? "").localeCompare(b.air_date ?? "") || a.episode_number - b.episode_number)[0];
  return next?.air_date ? { episodeNumber: next.episode_number, airDate: next.air_date } : null;
}

export function upcomingEpisodeDate(
  item: WatchingItem,
  seasonNumber: number,
  availability: { upcomingEpisodeNumber: number | null; nextAirDate: string | null }
): string | null {
  if (seasonToCheck(item) !== seasonNumber || !availability.nextAirDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(availability.nextAirDate)) return null;
  const seasonOffset = createSeasonOffsetsByNumber(item.season_episode_counts).get(seasonNumber) ?? 0;
  const expectedEpisode = Math.max(0, item.effective_watched_through - seasonOffset) + 1;
  return availability.upcomingEpisodeNumber === expectedEpisode ? availability.nextAirDate : null;
}

export function formatUpcomingEpisodeDate(date: string): string {
  return `${date.slice(2, 4)}.${date.slice(5, 7)}.${date.slice(8, 10)} 공개 예정`;
}
