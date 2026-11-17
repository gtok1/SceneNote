import type { EpisodeMeta } from "./types.ts";

export const EPISODE_LIST_REFRESH_MS = 30 * 60 * 1000;
export function hasKnownEpisodeCount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 50_000;
}

/** A prefetched row is not a complete catalog. Unknown totals need a successful recent full sync. */
export function isEpisodeListReusable(
  rows: readonly { episode_number: number }[],
  episodeCount: number | null | undefined,
  episodesSyncedAt: string | null | undefined,
  now: Date = new Date(),
  publishedEpisodeNumbers?: readonly number[] | null
): boolean {
  if (hasKnownEpisodeCount(episodeCount)) {
    if (rows.length < episodeCount) return false;
    const numbers = new Set(rows.map(row => row.episode_number));
    for (let number = 1; number <= episodeCount; number += 1) if (!numbers.has(number)) return false;
    return true;
  }
  if (!Array.isArray(publishedEpisodeNumbers)) return false;
  const stored = new Set(rows.map(row => row.episode_number));
  if (publishedEpisodeNumbers.some(number => !Number.isInteger(number) || number < 1 || number > 50_000 || !stored.has(number))) return false;
  if (!episodesSyncedAt) return false;
  const age = now.getTime() - new Date(episodesSyncedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < EPISODE_LIST_REFRESH_MS;
}

/** Upserts keep episode IDs; generated null fields must not erase already-known dates or titles. */
export function mergeEpisodeRows(existing: readonly EpisodeMeta[], fresh: readonly EpisodeMeta[]): EpisodeMeta[] {
  const byNumber = new Map(existing.map(row => [row.episode_number, { ...row }]));
  for (const row of fresh) {
    const previous = byNumber.get(row.episode_number);
    byNumber.set(row.episode_number, {
      episode_number: row.episode_number,
      title: row.title ?? previous?.title ?? null,
      air_date: row.air_date ?? previous?.air_date ?? null,
      duration_seconds: row.duration_seconds ?? previous?.duration_seconds ?? null
    });
  }
  return [...byNumber.values()].sort((left, right) => left.episode_number - right.episode_number);
}
