import { cleanText, parseSeasonQuery, yearFromDate } from "./normalize.ts";
import { hasTmdbAnimationGenreIds } from "../../_shared/tmdbClassification.ts";
import type { AdapterSearchParams, AdapterSearchResponse, ContentType, SearchResult } from "./types.ts";

const TMDB_LANGUAGE = "ko-KR";
const TMDB_REGION = "KR";
const TMDB_GENRE_NAMES = new Map<number, string>([
  [12, "Adventure"],
  [14, "Fantasy"],
  [16, "Animation"],
  [18, "Drama"],
  [27, "Horror"],
  [28, "Action"],
  [35, "Comedy"],
  [36, "History"],
  [37, "Western"],
  [53, "Thriller"],
  [80, "Crime"],
  [99, "Documentary"],
  [878, "Science Fiction"],
  [9648, "Mystery"],
  [10402, "Music"],
  [10749, "Romance"],
  [10751, "Family"],
  [10752, "War"],
  [10759, "Action & Adventure"],
  [10762, "Kids"],
  [10763, "News"],
  [10764, "Reality"],
  [10765, "Sci-Fi & Fantasy"],
  [10766, "Soap"],
  [10767, "Talk"],
  [10768, "War & Politics"],
  [10770, "TV Movie"]
]);

const TMDB_ANIMATION_GENRE_ID = 16;
// News, Reality, Talk
const TMDB_NON_SCRIPTED_GENRE_IDS = [10763, 10764, 10767];

interface TmdbSearchItem {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string | null;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  origin_country?: string[];
  genre_ids?: number[];
}

interface TmdbSearchResponse {
  page?: number;
  total_pages?: number;
  total_results?: number;
  results?: TmdbSearchItem[];
}

export interface TmdbSeason {
  season_number?: number | null;
  name?: string | null;
  air_date?: string | null;
  episode_count?: number | null;
}

interface TmdbTvDetailsResponse {
  seasons?: TmdbSeason[];
}

export async function searchTmdb({
  query,
  mediaType,
  page,
  signal,
  now = new Date()
}: AdapterSearchParams): Promise<AdapterSearchResponse> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) {
    throw new Error("TMDB_API_KEY is not configured");
  }

  const seasonQuery = mediaType === "movie" ? null : parseSeasonQuery(query);

  const endpoint =
    mediaType === "movie"
      ? "https://api.themoviedb.org/3/search/movie"
      : "https://api.themoviedb.org/3/search/multi";

  const url = new URL(endpoint);
  url.searchParams.set("query", seasonQuery?.baseQuery ?? query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("language", TMDB_LANGUAGE);
  url.searchParams.set("region", TMDB_REGION);
  url.searchParams.set("include_adult", "false");
  const headers = applyTmdbAuth(url, apiKey);

  const response = await fetch(url, {
    headers,
    signal
  });

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const payload = (await response.json()) as TmdbSearchResponse;
  const normalizedItems = (payload.results ?? [])
    .filter((item) => item.media_type !== "person")
    .map((item) => ({ item, result: normalizeTmdbItem(item, mediaType) }))
    .filter((entry): entry is { item: TmdbSearchItem; result: SearchResult } => entry.result !== null);
  const expanded = await Promise.all(normalizedItems.map(async ({ item, result }, index) => {
    if (index >= 3 || result.content_type === "movie") return [result];
    if (!seasonQuery && !result.has_seasons) return [result];

    const seasons = await fetchTmdbSeasons(item.id, apiKey, signal);
    if (!seasons) return [result];

    // An explicit "시즌N"/"N기" in the query pins one season; otherwise a returning show
    // is split into one card per aired season so the user can pick.
    if (seasonQuery) return [applyTmdbSeasonMetadata(result, seasons, seasonQuery.seasonNumber)];

    const cards = expandAiredSeasons(result, seasons, now);
    // Only one season has aired, so there is nothing to pick between — still correct the
    // premiere date to that season when it is a later one.
    return cards.length > 1 ? cards : [applyCurrentSeasonMetadata(result, seasons, now)];
  }));
  const results = expanded.flat();

  return {
    source: "tmdb",
    results,
    total: payload.total_results ?? results.length,
    hasNextPage: (payload.page ?? page) < (payload.total_pages ?? page)
  };
}

/**
 * Browse mode: no title to search, so list a country's titles with TMDB discover.
 * `search/*` cannot filter by country, only `discover/*` can.
 */
export async function discoverTmdb({
  country,
  mediaType,
  page,
  signal
}: {
  country: string;
  mediaType: AdapterSearchParams["mediaType"];
  page: number;
  signal: AbortSignal;
}): Promise<AdapterSearchResponse> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) {
    throw new Error("TMDB_API_KEY is not configured");
  }

  const endpoints: ("tv" | "movie")[] =
    mediaType === "movie" ? ["movie"] : mediaType === "all" ? ["tv", "movie"] : ["tv"];

  const pages = await Promise.all(
    endpoints.map((endpoint) => fetchTmdbDiscoverPage(endpoint, country, mediaType, page, apiKey, signal))
  );

  const results = pages.flatMap((entry) => entry.results);

  return {
    source: "tmdb",
    results,
    total: pages.reduce((sum, entry) => sum + entry.total, 0),
    hasNextPage: pages.some((entry) => entry.hasNextPage)
  };
}

async function fetchTmdbDiscoverPage(
  endpoint: "tv" | "movie",
  country: string,
  mediaType: AdapterSearchParams["mediaType"],
  page: number,
  apiKey: string,
  signal: AbortSignal
): Promise<{ results: SearchResult[]; total: number; hasNextPage: boolean }> {
  const url = new URL(`https://api.themoviedb.org/3/discover/${endpoint}`);
  url.searchParams.set("with_origin_country", country);
  url.searchParams.set("language", TMDB_LANGUAGE);
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("page", String(page));
  url.searchParams.set("include_adult", "false");

  if (endpoint === "tv") {
    if (mediaType === "anime") {
      url.searchParams.set("with_genres", String(TMDB_ANIMATION_GENRE_ID));
    } else if (mediaType === "drama") {
      // Country browse otherwise floods with variety and talk shows.
      url.searchParams.set("without_genres", TMDB_NON_SCRIPTED_GENRE_IDS.join(","));
    }
  }

  const response = await fetch(url, { headers: applyTmdbAuth(url, apiKey), signal });
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const payload = (await response.json()) as TmdbSearchResponse;
  const results = (payload.results ?? [])
    .map((item) => normalizeTmdbItem({ ...item, media_type: endpoint }, mediaType))
    .filter((result): result is SearchResult => result !== null)
    // discover/movie omits origin_country, but the query already constrained it.
    .map((result) => ({ ...result, origin_country: [country] }));

  return {
    results,
    total: payload.total_results ?? results.length,
    hasNextPage: (payload.page ?? page) < (payload.total_pages ?? page)
  };
}

export function applyTmdbSeasonMetadata(
  result: SearchResult,
  seasons: TmdbSeason[],
  seasonNumber: number
): SearchResult {
  const season = seasons.find((item) => item.season_number === seasonNumber);
  if (!season) return result;

  const suppliedTitle = season.name?.trim();
  const meaningfulKoreanTitle = suppliedTitle
    && hasHangul(suppliedTitle)
    && !/^(?:시즌|season)\s*\d+$/i.test(suppliedTitle)
    ? suppliedTitle
    : null;
  const synthesizedTitle = hasHangul(result.title_primary)
    ? `${result.title_primary} ${seasonNumber}기`
    : null;
  const titlePrimary = meaningfulKoreanTitle ?? synthesizedTitle ?? result.title_primary;
  const airDate = dateOnly(season.air_date);

  return {
    ...result,
    title_primary: titlePrimary,
    ...(synthesizedTitle && !meaningfulKoreanTitle ? { title_is_synthesized: true } : {}),
    match_titles: Array.from(new Set([...(result.match_titles ?? []), titlePrimary])),
    season_number: seasonNumber,
    air_year: yearFromDate(airDate) ?? result.air_year,
    air_date: airDate ?? result.air_date,
    episode_count: season.episode_count ?? result.episode_count
  };
}

/**
 * Picks the most recently STARTED numbered season (excludes the specials season 0 and
 * any season whose air_date is still in the future) so a returning show that has
 * announced-but-unaired next season doesn't jump ahead of what's actually airing.
 */
export function pickCurrentSeason(seasons: readonly TmdbSeason[], now: Date): TmdbSeason | null {
  const started = seasons.filter((season) => {
    if (!season.season_number || season.season_number < 1) return false;
    const airDate = dateOnly(season.air_date);
    return airDate !== null && new Date(airDate).getTime() <= now.getTime();
  });
  if (started.length === 0) return null;

  return started.reduce((latest, season) =>
    (dateOnly(season.air_date) as string) > (dateOnly(latest.air_date) as string) ? season : latest
  );
}

/**
 * For a bare title search (no explicit "시즌N"/"N기" in the query): if the show has
 * moved on to a later season than the one TMDB's own first_air_date reflects, surface
 * that season's air date/episode count instead of the stale series-premiere date.
 * Unlike applyTmdbSeasonMetadata this never renames the title — the user didn't ask
 * for a specific season, they just want to see what's actually airing now.
 */
export function applyCurrentSeasonMetadata(
  result: SearchResult,
  seasons: readonly TmdbSeason[],
  now: Date
): SearchResult {
  const current = pickCurrentSeason(seasons, now);
  if (!current || (current.season_number ?? 0) <= 1) return result;

  const airDate = dateOnly(current.air_date);
  return {
    ...result,
    air_year: yearFromDate(airDate) ?? result.air_year,
    air_date: airDate ?? result.air_date,
    episode_count: current.episode_count ?? result.episode_count
  };
}

export const MAX_EXPANDED_SEASONS = 5;

/**
 * A bare title search returns one TMDB show even when several of its seasons have aired,
 * so the user cannot pick a specific season. Split such a show into one card per aired
 * season. The show identity (external_source/external_id) is deliberately unchanged —
 * seasons are a user-record concept here, not a separate content identity.
 * See docs/17_season_library_tracking_spec.md D-4.
 */
export function expandAiredSeasons(
  result: SearchResult,
  seasons: readonly TmdbSeason[],
  now: Date
): SearchResult[] {
  if (result.content_type === "movie") return [result];

  const aired = seasons
    .filter((season) => {
      if (!season.season_number || season.season_number < 1) return false;
      const airDate = dateOnly(season.air_date);
      return airDate !== null && new Date(airDate).getTime() <= now.getTime();
    })
    .sort((left, right) => (dateOnly(right.air_date) ?? "").localeCompare(dateOnly(left.air_date) ?? ""))
    .slice(0, MAX_EXPANDED_SEASONS);

  if (aired.length <= 1) return [result];

  return aired.map((season) => {
    const seasonNumber = season.season_number as number;
    const airDate = dateOnly(season.air_date);
    const suppliedTitle = season.name?.trim();
    const meaningfulTitle = suppliedTitle && !/^(?:시즌|season)\s*\d+$/i.test(suppliedTitle)
      ? suppliedTitle
      : null;
    const titlePrimary = meaningfulTitle ?? `${result.title_primary} 시즌 ${seasonNumber}`;

    return {
      ...result,
      title_primary: titlePrimary,
      ...(meaningfulTitle ? {} : { title_is_synthesized: true }),
      match_titles: Array.from(new Set([...(result.match_titles ?? []), titlePrimary])),
      season_number: seasonNumber,
      air_year: yearFromDate(airDate) ?? result.air_year,
      air_date: airDate ?? result.air_date,
      episode_count: season.episode_count ?? result.episode_count
    };
  });
}

async function fetchTmdbSeasons(
  tmdbId: number,
  apiKey: string,
  signal: AbortSignal
): Promise<TmdbSeason[] | null> {
  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}`);
  url.searchParams.set("language", TMDB_LANGUAGE);

  try {
    const response = await fetch(url, { headers: applyTmdbAuth(url, apiKey), signal });
    if (!response.ok) return null;
    const payload = (await response.json()) as TmdbTvDetailsResponse;
    return payload.seasons ?? [];
  } catch {
    return null;
  }
}

function normalizeTmdbItem(
  item: TmdbSearchItem,
  mediaType: AdapterSearchParams["mediaType"]
): SearchResult | null {
  const isMovie = item.media_type === "movie" || Boolean(item.title);
  const isTv = item.media_type === "tv" || (item.media_type !== "person" && Boolean(item.name));

  if (!isMovie && !isTv) return null;
  if (mediaType === "movie" && !isMovie) return null;
  if (mediaType === "drama" && !isTv) return null;

  const titlePrimary = isMovie ? item.title : item.name;
  if (!titlePrimary) return null;

  const contentType = inferTmdbContentType(item, isMovie);

  return {
    external_source: "tmdb",
    external_id: String(item.id),
    content_type: contentType,
    title_primary: titlePrimary,
    title_original: isMovie ? item.original_title ?? null : item.original_name ?? null,
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    overview: cleanText(item.overview),
    air_year: isMovie ? yearFromDate(item.release_date) : yearFromDate(item.first_air_date),
    air_date: isMovie ? dateOnly(item.release_date) : dateOnly(item.first_air_date),
    has_seasons: isTv,
    episode_count: null,
    genres: genreNamesFromIds(item.genre_ids),
    origin_country: item.origin_country ?? []
  };
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function genreNamesFromIds(genreIds?: number[]): string[] {
  return Array.from(
    new Set((genreIds ?? []).map((id) => TMDB_GENRE_NAMES.get(id)).filter((name): name is string => Boolean(name)))
  );
}

function inferTmdbContentType(item: TmdbSearchItem, isMovie: boolean): ContentType {
  if (isMovie) return "movie";

  if (isLikelyAnime(item)) return "anime";
  if (item.origin_country?.includes("KR")) return "kdrama";
  if (item.origin_country?.includes("JP")) return "jdrama";
  return "other";
}

function isLikelyAnime(item: TmdbSearchItem): boolean {
  if (hasTmdbAnimationGenreIds(item.genre_ids)) return true;

  const text = [item.title, item.name, item.original_title, item.original_name, item.overview]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\banime\b|animation|애니|アニメ|만화/.test(text)) return true;

  const animeTitleHints = [
    "츠가이",
    "ブリーチ",
    "bleach",
    "鬼滅",
    "ポケットモンスター",
    "naruto",
    "one piece"
  ];

  return Boolean(item.origin_country?.includes("JP") && animeTitleHints.some((hint) => text.includes(hint.toLowerCase())));
}

function applyTmdbAuth(url: URL, apiKeyOrToken: string): HeadersInit {
  if (looksLikeJwt(apiKeyOrToken)) {
    return {
      Authorization: `Bearer ${apiKeyOrToken}`,
      "Content-Type": "application/json"
    };
  }

  url.searchParams.set("api_key", apiKeyOrToken);
  return {
    "Content-Type": "application/json"
  };
}

function looksLikeJwt(value: string): boolean {
  return value.startsWith("eyJ") || value.split(".").length === 3;
}

function hasHangul(value: string): boolean {
  return /[가-힣]/.test(value);
}
