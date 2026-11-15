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

export interface PublishedEpisode {
  episode_number: number;
  title: string | null;
  air_date: string | null;
  url?: string | null;
}

export function publishedStreamingEpisodes(rows: readonly { title?: string | null; url?: string | null }[]): PublishedEpisode[] {
  const episodes = new Map<number, PublishedEpisode>();
  for (const row of rows) {
    if (!row.title || !row.url || !/^https?:\/\//i.test(row.url)) continue;
    const match = /^(?:episode\s+|ep\.?\s*|제|第)?(\d+)\s*(?:화|話|회|[-–—:.]|$)/i.exec(row.title.trim())
      ?? /^episode\s+(\d+)\b/i.exec(row.title.trim());
    const number = match ? Number(match[1]) : 0;
    if (!Number.isInteger(number) || number < 1 || episodes.has(number)) continue;
    episodes.set(number, { episode_number: number, title: row.title, air_date: null, url: row.url });
  }
  return [...episodes.values()].sort((a, b) => a.episode_number - b.episode_number);
}

export function publishedDatedEpisodes(rows: readonly PublishedEpisode[], today: string): PublishedEpisode[] {
  return rows.filter(row => Number.isInteger(row.episode_number) && row.episode_number > 0 &&
    row.air_date && /^\d{4}-\d{2}-\d{2}$/.test(row.air_date) && row.air_date <= today)
    .sort((a, b) => a.episode_number - b.episode_number);
}

interface AiringScheduleNode {
  episode?: number | null;
  airingAt?: number | null;
}

/**
 * AniList airingSchedule의 방영이 끝난 행을 공개 회차로 쓴다. 회차 번호와 방영 시각이 API에 그대로 있는 행만 쓰고
 * 빈 번호를 채우지 않는다. 다음 쪽이 남은 목록(장편)은 앞부분이 잘린 것이라 쓰지 않는다.
 */
export function publishedAiringScheduleEpisodes(
  schedule: { nodes?: readonly AiringScheduleNode[] | null; pageInfo?: { hasNextPage?: boolean | null } | null } | null | undefined,
  nowSeconds: number
): PublishedEpisode[] {
  if (!schedule?.nodes || schedule.pageInfo?.hasNextPage || !Number.isFinite(nowSeconds)) return [];
  const episodes = new Map<number, PublishedEpisode>();
  const rows = [...schedule.nodes].sort((a, b) => (a.airingAt ?? 0) - (b.airingAt ?? 0));
  for (const row of rows) {
    const number = row.episode;
    const airingAt = row.airingAt;
    if (typeof number !== "number" || !Number.isInteger(number) || number < 1 || episodes.has(number)) continue;
    if (typeof airingAt !== "number" || !Number.isFinite(airingAt) || airingAt > nowSeconds) continue;
    episodes.set(number, { episode_number: number, title: null, air_date: koreaDateOnly(new Date(airingAt * 1000)) });
  }
  return [...episodes.values()].sort((a, b) => a.episode_number - b.episode_number);
}

/** 스트리밍 목록(제목·링크)과 방영 일정(날짜)을 회차 번호로 합친다. */
export function mergePublishedEpisodes(
  streaming: readonly PublishedEpisode[],
  schedule: readonly PublishedEpisode[]
): PublishedEpisode[] {
  const episodes = new Map<number, PublishedEpisode>();
  for (const row of schedule) episodes.set(row.episode_number, { ...row });
  for (const row of streaming) {
    const dated = episodes.get(row.episode_number);
    episodes.set(row.episode_number, { ...row, air_date: row.air_date ?? dated?.air_date ?? null });
  }
  return [...episodes.values()].sort((a, b) => a.episode_number - b.episode_number);
}
