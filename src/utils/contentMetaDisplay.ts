export function createEpisodeCountLabel(episodeCount: number | null | undefined): string | null {
  const totalCount = normalizeCount(episodeCount);
  return totalCount > 0 ? `${totalCount}화` : null;
}

export function createWatchCountLabel(
  watchCount: number | null | undefined,
  options: { includeZero?: boolean } = {}
): string | null {
  const normalizedCount = normalizeCount(watchCount);
  if (!options.includeZero && normalizedCount <= 0) return null;
  return `시청 ${normalizedCount}회`;
}

export function normalizeCount(count: number | null | undefined): number {
  if (typeof count !== "number" || !Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}
