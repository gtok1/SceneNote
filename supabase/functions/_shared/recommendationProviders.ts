import type {
  RecommendationProviderFetcher,
  RecommendationProviderPage,
  RecommendationProviderRequest
} from "./recommendationCatalog.ts";
import type { RecommendationCandidate } from "./recommendationEngine.ts";
import { inferTmdbTvContentType } from "./tmdbClassification.ts";
import { normalizeContentThemes } from "./recommendationThemes.ts";

export interface CatalogRecommendationCandidate extends RecommendationCandidate {
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  localized_overview?: string | null;
  air_year: number | null;
  air_date: string | null;
  has_seasons: boolean;
  episode_count: number | null;
  genres: string[];
  category: "drama" | "anime" | "movie";
  rank: number;
  trend_source: string;
  release_month: number | null;
  popularity: number;
  vote_count: number;
}

export interface TmdbTvItem {
  id: number;
  name?: string | null;
  original_name?: string | null;
  poster_path?: string | null;
  overview?: string | null;
  first_air_date?: string | null;
  origin_country?: string[] | null;
  genre_ids?: number[] | null;
  popularity?: number | null;
  vote_count?: number | null;
  vote_average?: number | null;
  original_language?: string | null;
}

interface TmdbMovieItem {
  id: number;
  title?: string | null;
  original_title?: string | null;
  poster_path?: string | null;
  overview?: string | null;
  release_date?: string | null;
  genre_ids?: number[] | null;
  popularity?: number | null;
  vote_count?: number | null;
  vote_average?: number | null;
  original_language?: string | null;
}

interface TmdbPage<T> {
  page?: number;
  results?: T[];
  total_pages?: number;
  total_results?: number;
}

export interface AniListMedia {
  id: number;
  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;
  coverImage?: { large?: string | null } | null;
  description?: string | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  episodes?: number | null;
  format?: string | null;
  genres?: string[] | null;
  popularity?: number | null;
  averageScore?: number | null;
  countryOfOrigin?: string | null;
  status?: string | null;
  duration?: number | null;
  tags?: {
    name?: string | null;
    rank?: number | null;
    isGeneralSpoiler?: boolean | null;
    isMediaSpoiler?: boolean | null;
  }[] | null;
  staff?: { nodes?: { name?: { full?: string | null } | null }[] | null } | null;
  studios?: { nodes?: { name?: string | null }[] | null } | null;
  stats?: { scoreDistribution?: { amount?: number | null }[] | null } | null;
  trailer?: { id?: string | null; site?: string | null } | null;
}

interface AniListPage {
  data?: {
    Page?: {
      pageInfo?: { hasNextPage?: boolean | null } | null;
      media?: AniListMedia[];
    };
  };
  errors?: { message?: string }[];
}

const TMDB_LANGUAGE = "ko-KR";
const TMDB_REGION = "KR";
const TMDB_PAGE_SIZE = 20;
const ANILIST_PAGE_SIZE = 50;
const TMDB_MAX_PAGE = 500;
const TMDB_ANIME_LOCALIZATION_PAGES = 3;
const PROVIDER_CACHE_TTL_MS = 10 * 60_000;
const PROVIDER_CACHE_MAX_ENTRIES = 300;

const providerPageCache = new Map<
  string,
  { expiresAt: number; promise: Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> }
>();
const animeLocalizationCache = new Map<
  string,
  { expiresAt: number; promise: Promise<TmdbTvItem[]> }
>();

const TMDB_GENRE_NAMES = new Map<number, string>([
  [12, "Adventure"],
  [14, "Fantasy"],
  [16, "Animation"],
  [18, "Drama"],
  [27, "Horror"],
  [28, "Action"],
  [35, "Comedy"],
  [36, "History"],
  [53, "Thriller"],
  [80, "Crime"],
  [878, "Science Fiction"],
  [9648, "Mystery"],
  [10749, "Romance"],
  [10751, "Family"],
  [10759, "Action & Adventure"],
  [10765, "Sci-Fi & Fantasy"],
  [10766, "Soap"],
  [10768, "War & Politics"]
]);

const ANILIST_MONTH_QUERY = `
  query RecommendationAnimeMonth(
    $page: Int!
    $perPage: Int!
    $startDateGreater: FuzzyDateInt!
    $startDateLesser: FuzzyDateInt!
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(
        type: ANIME
        sort: [POPULARITY_DESC, SCORE_DESC, START_DATE_DESC]
        isAdult: false
        startDate_greater: $startDateGreater
        startDate_lesser: $startDateLesser
      ) {
        id
        title { romaji english native }
        coverImage { large }
        description(asHtml: false)
        startDate { year month day }
        episodes
        format
        genres
        popularity
        averageScore
        countryOfOrigin
        status
        duration
        tags { name rank isGeneralSpoiler isMediaSpoiler }
        staff(perPage: 5, sort: [RELEVANCE]) { nodes { name { full } } }
        studios(isMain: true) { nodes { name } }
        stats { scoreDistribution { amount } }
        trailer { id site }
      }
    }
  }
`;

export const fetchRecommendationProviderPage: RecommendationProviderFetcher<CatalogRecommendationCandidate> = (
  request
) => getCachedProviderPage(request);

async function getCachedProviderPage(
  request: RecommendationProviderRequest
): Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> {
  const key = `${request.provider}:${request.month}:${request.page}:${request.asOfDate}`;
  const now = Date.now();
  for (const [cacheKey, entry] of providerPageCache) {
    if (entry.expiresAt <= now) providerPageCache.delete(cacheKey);
  }
  const cached = providerPageCache.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = fetchUncachedProviderPage(request);
  providerPageCache.set(key, { expiresAt: now + PROVIDER_CACHE_TTL_MS, promise });
  trimProviderCache();
  try {
    return await promise;
  } catch (error) {
    providerPageCache.delete(key);
    throw error;
  }
}

async function fetchUncachedProviderPage(
  request: RecommendationProviderRequest
): Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> {
  if (request.provider === "anilist") return fetchAniListMonth(request);
  if (request.provider === "tmdb_movie") return fetchTmdbMovieMonth(request);
  return fetchTmdbDramaMonth(request);
}

async function fetchTmdbDramaMonth(
  request: RecommendationProviderRequest
): Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> {
  const apiKey = requireTmdbApiKey();
  const bounds = getMonthBounds(request.month, request.asOfDate);
  const country = request.provider === "tmdb_jp" ? "JP" : "KR";
  const url = new URL("https://api.themoviedb.org/3/discover/tv");
  setCommonTmdbParams(url, request.page);
  url.searchParams.set("first_air_date.gte", bounds.startDate);
  url.searchParams.set("first_air_date.lte", bounds.endDate);
  url.searchParams.set("include_null_first_air_dates", "false");
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("watch_region", TMDB_REGION);
  url.searchParams.set("with_genres", "18");
  url.searchParams.set("with_origin_country", country);
  url.searchParams.set("without_genres", "16");

  // V3 authentication mutates the query string, so it must precede URL serialization.
  const headers = applyTmdbAuth(url, apiKey);
  const payload = await fetchJson<TmdbPage<TmdbTvItem>>(url.toString(), { headers });
  const items = (payload.results ?? [])
    .map((item, index) => normalizeTmdbDrama(item, request, index))
    .filter((item): item is CatalogRecommendationCandidate => Boolean(item));
  const totalPages = Math.min(TMDB_MAX_PAGE, Math.max(0, payload.total_pages ?? 0));
  return { items, hasMore: request.page < totalPages };
}

async function fetchTmdbMovieMonth(
  request: RecommendationProviderRequest
): Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> {
  const apiKey = requireTmdbApiKey();
  const bounds = getMonthBounds(request.month, request.asOfDate);
  const url = new URL("https://api.themoviedb.org/3/discover/movie");
  setCommonTmdbParams(url, request.page);
  url.searchParams.set("primary_release_date.gte", bounds.startDate);
  url.searchParams.set("primary_release_date.lte", bounds.endDate);
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("watch_region", TMDB_REGION);

  const headers = applyTmdbAuth(url, apiKey);
  const payload = await fetchJson<TmdbPage<TmdbMovieItem>>(url.toString(), { headers });
  const items = (payload.results ?? [])
    .map((item, index) => normalizeTmdbMovie(item, request, index))
    .filter((item): item is CatalogRecommendationCandidate => Boolean(item));
  const totalPages = Math.min(TMDB_MAX_PAGE, Math.max(0, payload.total_pages ?? 0));
  return { items, hasMore: request.page < totalPages };
}

async function fetchAniListMonth(
  request: RecommendationProviderRequest
): Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> {
  const bounds = getMonthBounds(request.month, request.asOfDate);
  const endpoint = Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co";
  const [payload, koreanAnimeItems] = await Promise.all([
    fetchJson<AniListPage>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: ANILIST_MONTH_QUERY,
        variables: {
          page: request.page,
          perPage: ANILIST_PAGE_SIZE,
          startDateGreater: toAniListDate(previousDate(bounds.startDate)),
          startDateLesser: toAniListDate(nextDate(bounds.endDate))
        }
      })
    }),
    getCachedKoreanAnimeItems(request)
  ]);
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "AniList GraphQL request failed");
  }

  const page = payload.data?.Page;
  const items = (page?.media ?? [])
    .map((item, index) =>
      normalizeAniListAnime(
        item,
        request,
        index,
        findTmdbKoreanAnimeLocalization(item, koreanAnimeItems)
      )
    )
    .filter((item): item is CatalogRecommendationCandidate => Boolean(item));
  return { items, hasMore: Boolean(page?.pageInfo?.hasNextPage) };
}

async function getCachedKoreanAnimeItems(request: RecommendationProviderRequest): Promise<TmdbTvItem[]> {
  const key = `${request.month}:${request.asOfDate}`;
  const now = Date.now();
  const cached = animeLocalizationCache.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = fetchTmdbKoreanAnimeMonth(request);
  animeLocalizationCache.set(key, { expiresAt: now + PROVIDER_CACHE_TTL_MS, promise });
  try {
    return await promise;
  } catch (error) {
    animeLocalizationCache.delete(key);
    throw error;
  }
}

async function fetchTmdbKoreanAnimeMonth(request: RecommendationProviderRequest): Promise<TmdbTvItem[]> {
  const apiKey = requireTmdbApiKey();
  const bounds = getMonthBounds(request.month, request.asOfDate);
  const pages = await Promise.all(
    Array.from({ length: TMDB_ANIME_LOCALIZATION_PAGES }, (_, index) => {
      const url = new URL("https://api.themoviedb.org/3/discover/tv");
      setCommonTmdbParams(url, index + 1);
      url.searchParams.set("first_air_date.gte", bounds.startDate);
      url.searchParams.set("first_air_date.lte", bounds.endDate);
      url.searchParams.set("include_null_first_air_dates", "false");
      url.searchParams.set("sort_by", "popularity.desc");
      url.searchParams.set("watch_region", TMDB_REGION);
      url.searchParams.set("with_origin_country", "JP");
      url.searchParams.set("with_genres", "16");
      const headers = applyTmdbAuth(url, apiKey);
      return fetchJson<TmdbPage<TmdbTvItem>>(url.toString(), { headers });
    })
  );
  return pages.flatMap((page) => page.results ?? []);
}

function normalizeTmdbDrama(
  item: TmdbTvItem,
  request: RecommendationProviderRequest,
  index: number
): CatalogRecommendationCandidate | null {
  if (!item.id || !item.name?.trim() || item.genre_ids?.includes(16) || !item.genre_ids?.includes(18)) return null;
  const contentType = inferTmdbTvContentType({
    originCountry: item.origin_country,
    genreIds: item.genre_ids
  });
  if (contentType !== "kdrama" && contentType !== "jdrama") return null;
  const providerRank = (request.page - 1) * TMDB_PAGE_SIZE + index + 1;
  return {
    external_source: "tmdb",
    external_id: String(item.id),
    content_type: contentType,
    title_primary: item.name.trim(),
    title_original: item.original_name?.trim() || null,
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    overview: cleanText(item.overview),
    air_year: yearFromDate(item.first_air_date),
    air_date: dateOnly(item.first_air_date),
    has_seasons: true,
    episode_count: null,
    genres: genreNamesFromIds(item.genre_ids),
    category: "drama",
    rank: providerRank,
    trend_source: `${request.month} TMDB 인기순`,
    release_month: monthFromDate(item.first_air_date),
    popularity: normalizedProviderPopularity(providerRank, item.popularity),
    vote_count: finiteOr(item.vote_count, 0),
    countries: item.origin_country ?? [],
    languages: item.original_language ? [item.original_language] : [],
    rating_score: positiveFiniteOrNull(item.vote_average),
    rating_scale: 10,
    rating_count: positiveFiniteOrNull(item.vote_count),
    release_status: inferReleaseStatus(item.first_air_date, request.asOfDate)
  };
}

function normalizeTmdbMovie(
  item: TmdbMovieItem,
  request: RecommendationProviderRequest,
  index: number
): CatalogRecommendationCandidate | null {
  if (!item.id || !item.title?.trim()) return null;
  const providerRank = (request.page - 1) * TMDB_PAGE_SIZE + index + 1;
  return {
    external_source: "tmdb",
    external_id: String(item.id),
    content_type: "movie",
    title_primary: item.title.trim(),
    title_original: item.original_title?.trim() || null,
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    overview: cleanText(item.overview),
    air_year: yearFromDate(item.release_date),
    air_date: dateOnly(item.release_date),
    has_seasons: false,
    episode_count: null,
    genres: genreNamesFromIds(item.genre_ids),
    category: "movie",
    rank: providerRank,
    trend_source: `${request.month} TMDB 영화 인기순`,
    release_month: monthFromDate(item.release_date),
    popularity: normalizedProviderPopularity(providerRank, item.popularity),
    vote_count: finiteOr(item.vote_count, 0),
    languages: item.original_language ? [item.original_language] : [],
    rating_score: positiveFiniteOrNull(item.vote_average),
    rating_scale: 10,
    rating_count: positiveFiniteOrNull(item.vote_count),
    release_status: inferReleaseStatus(item.release_date, request.asOfDate)
  };
}

function normalizeAniListAnime(
  item: AniListMedia,
  request: RecommendationProviderRequest,
  index: number,
  koreanItem: TmdbTvItem | null
): CatalogRecommendationCandidate | null {
  const title = koreanItem?.name?.trim();
  if (!item.id || !title || !hasHangul(title)) return null;
  const providerRank = (request.page - 1) * ANILIST_PAGE_SIZE + index + 1;
  const localizedOverview = hasHangul(koreanItem?.overview) ? cleanText(koreanItem?.overview) : null;
  const sourceTags = (item.tags ?? [])
    .filter((tag) => !tag.isGeneralSpoiler && !tag.isMediaSpoiler && finiteOr(tag.rank, 0) >= 40)
    .map((tag) => ({ name: tag.name?.trim() ?? "", source: "anilist", rank: tag.rank }))
    .filter((tag) => Boolean(tag.name));
  return {
    external_source: "anilist",
    external_id: String(item.id),
    content_type: "anime",
    title_primary: title,
    title_original: item.title?.native?.trim() || item.title?.romaji?.trim() || null,
    poster_url: koreanItem?.poster_path
      ? `https://image.tmdb.org/t/p/w500${koreanItem.poster_path}`
      : item.coverImage?.large ?? null,
    overview: localizedOverview,
    localized_overview: localizedOverview,
    air_year: item.startDate?.year ?? null,
    air_date: dateFromParts(item.startDate),
    has_seasons: item.format !== "MOVIE",
    episode_count: item.episodes ?? null,
    genres: Array.from(new Set(item.genres ?? [])),
    category: "anime",
    rank: providerRank,
    trend_source: `${request.month} AniList 인기순`,
    release_month: item.startDate?.month ?? null,
    popularity: normalizedProviderPopularity(providerRank, item.popularity),
    vote_count: 0,
    rating_score: positiveFiniteOrNull(item.averageScore),
    rating_scale: 100,
    rating_count: sumPositiveAmounts(item.stats?.scoreDistribution),
    popularity_count: positiveFiniteOrNull(item.popularity),
    release_status: item.status?.trim() || null,
    format: item.format?.trim() || null,
    duration_minutes: positiveFiniteOrNull(item.duration),
    countries: item.countryOfOrigin ? [item.countryOfOrigin] : [],
    keywords: (item.tags ?? [])
      .filter((tag) => !tag.isGeneralSpoiler && !tag.isMediaSpoiler && finiteOr(tag.rank, 0) >= 50)
      .map((tag) => tag.name?.trim())
      .filter((name): name is string => Boolean(name))
      .slice(0, 8),
    source_tags: sourceTags,
    themes: normalizeContentThemes({ external_source: "anilist", source_tags: sourceTags }),
    people: (item.staff?.nodes ?? [])
      .map((person) => person.name?.full?.trim())
      .filter((name): name is string => Boolean(name)),
    studios: (item.studios?.nodes ?? [])
      .map((studio) => studio.name?.trim())
      .filter((name): name is string => Boolean(name)),
    trailer_url: createAniListTrailerUrl(item.trailer),
    external_ids: {
      anilist: String(item.id),
      tmdb: koreanItem?.id ? String(koreanItem.id) : null
    }
  };
}

export function findTmdbKoreanAnimeLocalization(
  item: Pick<AniListMedia, "title" | "startDate">,
  candidates: readonly TmdbTvItem[]
): TmdbTvItem | null {
  const titles = [item.title?.native, item.title?.romaji, item.title?.english]
    .map((title) => normalizeTitleForMatch(title))
    .filter(Boolean);
  if (titles.length === 0) return null;

  return candidates
    .map((candidate) => {
      if (!hasHangul(candidate.name)) return { candidate, score: -1 };
      const candidateYear = yearFromDate(candidate.first_air_date);
      const expectedYear = item.startDate?.year ?? null;
      if (candidateYear && expectedYear && Math.abs(candidateYear - expectedYear) > 1) {
        return { candidate, score: -1 };
      }
      const originalTitle = normalizeTitleForMatch(candidate.original_name);
      const displayTitle = normalizeTitleForMatch(candidate.name);
      const score = titles.includes(originalTitle)
        ? 100
        : titles.includes(displayTitle)
          ? 80
          : -1;
      return {
        candidate,
        score: score + (hasHangul(candidate.overview) ? 1 : 0)
      };
    })
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score)[0]?.candidate ?? null;
}

function inferReleaseStatus(date: string | null | undefined, asOfDate: string): string | null {
  const normalizedDate = dateOnly(date);
  return normalizedDate && normalizedDate > asOfDate ? "NOT_YET_RELEASED" : null;
}

function createAniListTrailerUrl(trailer: AniListMedia["trailer"]): string | null {
  const id = trailer?.id?.trim();
  if (!id) return null;
  const site = trailer?.site?.trim().toLocaleLowerCase();
  if (site === "youtube") return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  if (site === "dailymotion") return `https://www.dailymotion.com/video/${encodeURIComponent(id)}`;
  return null;
}

function getMonthBounds(month: string, asOfDate: string): { startDate: string; endDate: string } {
  const [yearValue, monthValue] = month.split("-");
  const year = Number.parseInt(yearValue ?? "", 10);
  const numericMonth = Number.parseInt(monthValue ?? "", 10);
  if (!Number.isInteger(year) || numericMonth < 1 || numericMonth > 12) {
    throw new Error("INVALID_RECOMMENDATION_MONTH");
  }
  const lastDay = new Date(Date.UTC(year, numericMonth, 0)).getUTCDate();
  const startDate = `${month}-01`;
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
  const endDate = asOfDate.startsWith(`${month}-`) && asOfDate < monthEnd ? asOfDate : monthEnd;
  if (endDate < startDate) throw new Error("INVALID_RECOMMENDATION_DATE_RANGE");
  return { startDate, endDate };
}

function setCommonTmdbParams(url: URL, page: number): void {
  url.searchParams.set("language", TMDB_LANGUAGE);
  url.searchParams.set("region", TMDB_REGION);
  url.searchParams.set("page", String(page));
  url.searchParams.set("include_adult", "false");
}

function requireTmdbApiKey(): string {
  const value = Deno.env.get("TMDB_API_KEY");
  if (!value) throw new Error("TMDB_API_KEY is not configured");
  return value;
}

function applyTmdbAuth(url: URL, apiKeyOrToken: string): HeadersInit {
  if (apiKeyOrToken.startsWith("eyJ") || apiKeyOrToken.split(".").length === 3) {
    return { Authorization: `Bearer ${apiKeyOrToken}`, "Content-Type": "application/json" };
  }
  url.searchParams.set("api_key", apiKeyOrToken);
  return { "Content-Type": "application/json" };
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 5_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function trimProviderCache(): void {
  while (providerPageCache.size > PROVIDER_CACHE_MAX_ENTRIES) {
    const oldest = providerPageCache.keys().next().value as string | undefined;
    if (!oldest) break;
    providerPageCache.delete(oldest);
  }
}

function normalizedProviderPopularity(providerRank: number, rawPopularity: number | null | undefined): number {
  const rankScore = Math.max(0, 1_000_000 - providerRank);
  const rawTieBreaker = Math.min(0.999, Math.log1p(Math.max(0, finiteOr(rawPopularity, 0))) / 100);
  return rankScore + rawTieBreaker;
}

function genreNamesFromIds(ids?: number[] | null): string[] {
  return Array.from(new Set((ids ?? []).map((id) => TMDB_GENRE_NAMES.get(id)).filter((name): name is string => Boolean(name))));
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return stripped || null;
}

function yearFromDate(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 4) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function monthFromDate(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 7) return null;
  const month = Number.parseInt(value.slice(5, 7), 10);
  return month >= 1 && month <= 12 ? month : null;
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match?.[1] && match[2] && match[3] ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function dateFromParts(parts?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!parts?.year || !parts.month) return null;
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day ?? 1).padStart(2, "0")}`;
}

function previousDate(value: string): string {
  return shiftDate(value, -1);
}

function nextDate(value: string): string {
  return shiftDate(value, 1);
}

function shiftDate(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) throw new Error("INVALID_RECOMMENDATION_DATE_RANGE");
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function toAniListDate(value: string): number {
  return Number.parseInt(value.replace(/-/g, ""), 10);
}

function finiteOr(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveFiniteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function hasHangul(value: string | null | undefined): boolean {
  return /[가-힣]/u.test(value ?? "");
}

function normalizeTitleForMatch(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function sumPositiveAmounts(values: { amount?: number | null }[] | null | undefined): number | null {
  const total = (values ?? []).reduce((sum, value) => sum + Math.max(0, finiteOr(value.amount, 0)), 0);
  return total > 0 ? total : null;
}
