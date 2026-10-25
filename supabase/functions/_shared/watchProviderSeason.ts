export interface WatchSeasonInput {
  source: string | undefined;
  mediaType: "movie" | "tv";
  seasonNumber?: number | null;
  titles: readonly (string | null | undefined)[];
}

function isSeasonNumber(value: number | null | undefined, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function parseSeasonDigits(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = "〇一二三四五六七八九";
  if (value === "十") return 10;
  const parts = value.split("十");
  if (parts.length === 2) {
    const tens = parts[0] ? digits.indexOf(parts[0]) : 1;
    const ones = parts[1] ? digits.indexOf(parts[1]) : 0;
    return tens > 0 && ones >= 0 ? tens * 10 + ones : Number.NaN;
  }
  return value.length === 1 ? digits.indexOf(value) : Number.NaN;
}

// AniList stores each TV work separately, often with a virtual library season 1.
// Explicit title markers describe that work more precisely than the virtual row.
export function resolveWatchSeasonNumber(input: WatchSeasonInput): number | null {
  if (input.mediaType === "movie") return null;
  if (input.source === "tmdb") return isSeasonNumber(input.seasonNumber) ? input.seasonNumber : null;
  if (input.source !== "anilist") return null;

  const seasons = new Set<number>();
  for (const title of input.titles) {
    const normalized = title?.normalize("NFKC") ?? "";
    const pattern = /第(\d+|[〇一二三四五六七八九十]+)期|\b(\d+)(?:st|nd|rd|th)\s+Season\b|\bSeason\s+(\d+)\b|シーズン\s*(\d+)|시즌\s*(\d+)|(\d+)기(?=$|\s|:|-)/gi;
    for (const match of normalized.matchAll(pattern)) {
      const value = match.slice(1).find(value => value !== undefined)!;
      const season = parseSeasonDigits(value);
      if (!isSeasonNumber(season, 1)) return null;
      seasons.add(season);
    }
  }
  if (seasons.size > 1) return null;
  if (seasons.size === 1) return [...seasons][0] ?? null;
  return isSeasonNumber(input.seasonNumber, 1) ? input.seasonNumber : 1;
}

export function isValidWatchAirDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function resolveWatchAirYear(year: number | null | undefined, airDate?: string | null): number | null {
  if (year != null && (!Number.isSafeInteger(year) || year <= 0)) return null;
  if (airDate != null && !isValidWatchAirDate(airDate)) return null;
  const dateYear = airDate ? Number(airDate.slice(0, 4)) : null;
  if (year != null && dateYear !== null && year !== dateYear) return null;
  return dateYear ?? year ?? null;
}

export function pickTmdbSeasonForWatch(
  seasons: readonly { season_number?: number | null; air_date?: string | null }[] | null | undefined,
  input: { seasonNumber: number | null; year: number | null; airDate?: string | null }
): number | null {
  const year = resolveWatchAirYear(input.year, input.airDate);
  if (!isSeasonNumber(input.seasonNumber, 1) || year === null || !seasons) return null;
  const candidates = seasons.filter((season): season is { season_number: number; air_date: string } =>
    isSeasonNumber(season.season_number, 1) && typeof season.air_date === "string" && isValidWatchAirDate(season.air_date));
  if (input.airDate) {
    const sameDate = candidates.filter(season => season.air_date === input.airDate);
    if (sameDate.length) return sameDate.length === 1 ? sameDate[0]?.season_number ?? null : null;
  }
  // Streaming premieres and TV broadcasts can straddle a month boundary.
  // Keep the season number and year strict, and allow at most one week between dates.
  const airDateMs = input.airDate ? Date.parse(`${input.airDate}T00:00:00.000Z`) : null;
  const sameNumber = candidates.filter(season => season.season_number === input.seasonNumber
    && Number(season.air_date.slice(0, 4)) === year
    && (airDateMs === null || Math.abs(Date.parse(`${season.air_date}T00:00:00.000Z`) - airDateMs) <= 7 * 24 * 60 * 60_000));
  return sameNumber.length === 1 ? sameNumber[0]?.season_number ?? null : null;
}
