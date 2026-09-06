import type { SeasonLibraryMatch } from "./seasonLibraryMatch";

export function createEpisodeCountLabel(episodeCount: number | null | undefined): string | null {
  const totalCount = normalizeCount(episodeCount);
  return totalCount > 0 ? `${totalCount}화` : null;
}

export function createAirDateLabel(
  airDate: string | null | undefined,
  airYear: number | null | undefined
): string | null {
  const monthMatch = typeof airDate === "string" ? /^(\d{4})-(\d{2})/.exec(airDate) : null;
  if (monthMatch?.[1] && monthMatch[2]) return `${monthMatch[1]}.${monthMatch[2]}`;
  return typeof airYear === "number" && Number.isFinite(airYear) ? String(airYear) : null;
}

export function createWatchCountLabel(
  watchCount: number | null | undefined,
  options: { includeZero?: boolean } = {}
): string | null {
  const normalizedCount = normalizeCount(watchCount);
  if (!options.includeZero && normalizedCount <= 0) return null;
  return `시청 ${normalizedCount}회`;
}

/**
 * The library holds one row per (user, content, season); a season_number of null means
 * the whole work was registered. A whole-work row must never be presented as proof that
 * the displayed season is registered — see docs/17_season_library_tracking_spec.md D-5.
 */
export function createLibraryWatchStateLabel(match: SeasonLibraryMatch): string | null {
  switch (match.kind) {
    case "season":
      return createWatchCountLabel(match.item.watch_count, { includeZero: true });
    case "whole-work":
      return "작품 전체로 등록됨";
    default:
      return null;
  }
}

export function normalizeCount(count: number | null | undefined): number {
  if (typeof count !== "number" || !Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}
