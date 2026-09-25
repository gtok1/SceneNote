interface AiringEpisode {
  episode: number;
  airingAt: number;
}

export function releasedEpisodeFromAniList(
  status: string | null | undefined,
  totalEpisodes: number | null | undefined,
  nextAiringEpisode: AiringEpisode | null | undefined,
  nowSeconds: number
): number | null {
  if (nextAiringEpisode && Number.isInteger(nextAiringEpisode.episode) && nextAiringEpisode.episode > 0) {
    return Math.max(0, nextAiringEpisode.episode - (nextAiringEpisode.airingAt > nowSeconds ? 1 : 0));
  }
  return status === "FINISHED" && totalEpisodes && totalEpisodes > 0 ? totalEpisodes : null;
}

export function releasedEpisodeFromDatedEpisodes(
  episodes: { episode_number: number; air_date: string | null }[],
  todayInKorea: string
): number | null {
  let latest: number | null = null;
  for (const episode of episodes) {
    if (!Number.isInteger(episode.episode_number) || episode.episode_number < 1) continue;
    if (!episode.air_date || !/^\d{4}-\d{2}-\d{2}$/.test(episode.air_date)) continue;
    if (episode.air_date > todayInKorea) continue;
    latest = Math.max(latest ?? 0, episode.episode_number);
  }
  return latest;
}

export function koreaDateOnly(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function upcomingEpisodeFromAniList(
  nextAiringEpisode: AiringEpisode | null | undefined,
  nowSeconds: number
): { episodeNumber: number; airDate: string } | null {
  if (!nextAiringEpisode || !Number.isInteger(nextAiringEpisode.episode) || nextAiringEpisode.episode < 1) return null;
  if (!Number.isFinite(nextAiringEpisode.airingAt) || nextAiringEpisode.airingAt <= nowSeconds) return null;
  return {
    episodeNumber: nextAiringEpisode.episode,
    airDate: koreaDateOnly(new Date(nextAiringEpisode.airingAt * 1000))
  };
}

export function upcomingEpisodeFromDatedEpisodes(
  episodes: { episode_number: number; air_date: string | null }[],
  todayInKorea: string
): { episodeNumber: number; airDate: string } | null {
  const upcoming = episodes
    .filter((episode) => Number.isInteger(episode.episode_number) && episode.episode_number > 0)
    .filter((episode) => episode.air_date && /^\d{4}-\d{2}-\d{2}$/.test(episode.air_date) && episode.air_date > todayInKorea)
    .sort((a, b) => (a.air_date ?? "").localeCompare(b.air_date ?? "") || a.episode_number - b.episode_number)[0];
  return upcoming?.air_date ? { episodeNumber: upcoming.episode_number, airDate: upcoming.air_date } : null;
}
