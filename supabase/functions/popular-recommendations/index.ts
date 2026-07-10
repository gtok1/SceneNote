import { corsHeaders, json, jsonError } from "../_shared/http.ts";
import {
  addDays,
  DEFAULT_CANDIDATE_WINDOW_DAYS,
  formatDateInput,
  getCandidateWindowBounds,
  isWithinCandidateWindow,
  rankPopularRecommendations,
  toFuzzyDateNumber
} from "../_shared/popularRanking.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import { inferTmdbTvContentType } from "../_shared/tmdbClassification.ts";
import type { ContentType, ExternalSource } from "../_shared/types.ts";

type RecommendationCategory = "drama" | "anime";

interface PopularRecommendationsRequest {
  candidate_years?: number;
  candidate_days?: number;
  pool_limit?: number;
}

interface RecommendationOptions {
  candidateWindowDays: number;
  poolLimit: number;
  now: Date;
}

type CacheClient = ReturnType<typeof createAdminClient>;

interface PopularRecommendation {
  external_source: ExternalSource;
  external_id: string;
  content_type: ContentType;
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  localized_overview?: string | null;
  air_year: number | null;
  air_date: string | null;
  has_seasons: boolean;
  episode_count: number | null;
  genres?: string[];
  category: RecommendationCategory;
  rank: number;
  trend_source: string;
  release_month?: number | null;
  popularity?: number | null;
  trendingIndex?: number | null;
}

interface RecommendationsResponse {
  generated_at: string;
  categories: Record<RecommendationCategory, PopularRecommendation[]>;
  failedSources: ExternalSource[];
  partial: boolean;
}

type AnimeEnrichmentPayload = Partial<
  Pick<
    Omit<PopularRecommendation, "rank">,
    "title_primary" | "poster_url" | "overview" | "localized_overview" | "air_date" | "release_month"
  >
>;

interface TmdbTvItem {
  id: number;
  name?: string | null;
  original_name?: string | null;
  poster_path?: string | null;
  overview?: string | null;
  first_air_date?: string | null;
  origin_country?: string[] | null;
  genre_ids?: number[] | null;
  popularity?: number | null;
}

interface TmdbTvResponse {
  results?: TmdbTvItem[];
}

interface AniListMedia {
  id: number;
  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;
  coverImage?: {
    large?: string | null;
  } | null;
  description?: string | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  episodes?: number | null;
  format?: string | null;
  genres?: string[] | null;
}

interface AniListResponse {
  data?: {
    Page?: {
      media?: AniListMedia[];
    };
  };
  errors?: { message?: string }[];
}

interface TmdbAnimeSearchResponse {
  results?: {
    id: number;
    name?: string | null;
    overview?: string | null;
    poster_path?: string | null;
    first_air_date?: string | null;
  }[];
}

interface TmdbTranslationResponse {
  translations?: {
    translations?: {
      iso_639_1?: string | null;
      iso_3166_1?: string | null;
      data?: {
        name?: string | null;
        title?: string | null;
      } | null;
    }[];
  };
}

const TMDB_LANGUAGE = "ko-KR";
const TMDB_REGION = "KR";
const DEFAULT_CANDIDATE_YEARS = 1;
const MAX_CANDIDATE_YEARS = 5;
const MAX_CANDIDATE_WINDOW_DAYS = 365 * MAX_CANDIDATE_YEARS;
const DEFAULT_RECOMMENDATION_POOL_LIMIT = 30;
const MAX_RECOMMENDATION_POOL_LIMIT = 60;
const POPULAR_CACHE_TTL_MS = 30 * 60_000;
const POPULAR_CACHE_MAX_ENTRIES = 100;
const ANIME_KOREAN_ENRICHMENT_CACHE_TTL_MS = 7 * 24 * 60 * 60_000;
const ANIME_KOREAN_ENRICHMENT_CONCURRENCY = 5;
const POPULAR_CACHE_SOURCE: ExternalSource = "tmdb";
const ANILIST_KOREAN_CACHE_SOURCE: ExternalSource = "anilist";
const responseCache = new Map<string, { expiresAt: number; response: RecommendationsResponse }>();
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

const ANILIST_TRENDING_QUERY = `
  query TrendingAnime($page: Int!, $perPage: Int!, $startDateGreater: FuzzyDateInt!, $startDateLesser: FuzzyDateInt!) {
    Page(page: $page, perPage: $perPage) {
      media(
        type: ANIME
        sort: [TRENDING_DESC, START_DATE_DESC]
        isAdult: false
        startDate_greater: $startDateGreater
        startDate_lesser: $startDateLesser
      ) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          large
        }
        description(asHtml: false)
        startDate {
          year
          month
          day
        }
        episodes
        format
        genres
      }
    }
  }
`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "POST or GET method required");
  }

  try {
    await requireUser(req);
  } catch {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const parsedOptions = await parseRecommendationOptions(req);
  if (!parsedOptions.ok) return jsonError(400, "INVALID_REQUEST", parsedOptions.message);
  const options = parsedOptions.value;
  const cacheKey = createPopularCacheKey(options);
  const cachedResponse = getCachedResponse(cacheKey);
  if (cachedResponse) return json(cachedResponse);
  const adminClient = createAdminClient();
  const persistedResponse = await getPersistedPopularResponse(adminClient, cacheKey);
  if (persistedResponse) {
    setCachedResponse(cacheKey, persistedResponse);
    return json(persistedResponse);
  }

  try {
    const [dramaResult, animeResult] = await Promise.allSettled([
      fetchDramaRecommendations(options),
      fetchAnimeRecommendations(options, adminClient)
    ]);

    const drama = dramaResult.status === "fulfilled" ? dramaResult.value : [];
    const anime = animeResult.status === "fulfilled" ? animeResult.value : [];

    const failedSources: ExternalSource[] = [];

    if (dramaResult.status === "rejected") {
      failedSources.push("tmdb");
      console.error("popular-recommendations drama failed:", dramaResult.reason);
    }

    if (animeResult.status === "rejected") {
      failedSources.push("anilist");
      console.error("popular-recommendations anime failed:", animeResult.reason);
    }

    if (drama.length === 0 && anime.length === 0 && failedSources.length > 0) {
      return jsonError(503, "ALL_APIS_FAILED", "Popular recommendation APIs failed");
    }

    const response: RecommendationsResponse = {
      generated_at: new Date().toISOString(),
      categories: {
        drama,
        anime
      },
      failedSources: Array.from(new Set(failedSources)),
      partial: failedSources.length > 0
    };

    setCachedResponse(cacheKey, response);
    await setPersistedPopularResponse(adminClient, cacheKey, response);
    return json(response);
  } catch (error) {
    console.error("popular-recommendations failed:", error);
    return jsonError(500, "RECOMMENDATION_FAILED", "Failed to build popular recommendations");
  }
});

async function fetchDramaRecommendations(options: RecommendationOptions): Promise<PopularRecommendation[]> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) throw new Error("TMDB_API_KEY is not configured");

  const windowBounds = getCandidateWindowBounds(options.now, options.candidateWindowDays);
  const fetchPages = getTmdbFetchPages(options.poolLimit);

  const [trendingResult, discoveredKrResult, discoveredJpResult] = await Promise.allSettled([
    fetchTmdbTvPages("/trending/tv/week", apiKey, {}, fetchPages),
    fetchTmdbTvPages("/discover/tv", apiKey, {
      "first_air_date.gte": windowBounds.startDate,
      "first_air_date.lte": windowBounds.endDate,
      include_null_first_air_dates: "false",
      sort_by: "popularity.desc",
      watch_region: TMDB_REGION,
      with_genres: "18",
      with_origin_country: "KR",
      without_genres: "16"
    }, fetchPages),
    fetchTmdbTvPages("/discover/tv", apiKey, {
      "first_air_date.gte": windowBounds.startDate,
      "first_air_date.lte": windowBounds.endDate,
      include_null_first_air_dates: "false",
      sort_by: "popularity.desc",
      watch_region: TMDB_REGION,
      with_genres: "18",
      with_origin_country: "JP",
      without_genres: "16"
    }, fetchPages)
  ]);

  const trending = settledItems(trendingResult, "TMDB weekly trending");
  const discoveredKr = settledItems(discoveredKrResult, "TMDB Korean drama discovery");
  const discoveredJp = settledItems(discoveredJpResult, "TMDB Japanese drama discovery");
  const discovered = [...discoveredKr, ...discoveredJp];

  if (trending.length === 0 && discovered.length === 0) {
    throw new Error("TMDB drama recommendation sources failed");
  }

  const candidates = [
    ...trending.map((item) => ({ item, trendSource: "TMDB 주간 트렌딩" })),
    ...discovered.map((item) => ({ item, trendSource: "TMDB 인기순" }))
  ];
  const merged = candidates
    .map(({ item, trendSource }) => normalizeTmdbDrama(item, trendSource))
    .filter((item): item is Omit<PopularRecommendation, "rank"> => Boolean(item))
    .filter((item) =>
      isWithinCandidateWindow(
        { air_date: item.air_date, air_year: item.air_year },
        options.now,
        options.candidateWindowDays
      )
    );

  return rankRecommendations(merged, "drama", options);
}

function settledItems<T>(result: PromiseSettledResult<T[]>, sourceName: string): T[] {
  if (result.status === "fulfilled") return result.value;
  console.error(`${sourceName} failed:`, result.reason);
  return [];
}

async function fetchTmdbTv(
  path: string,
  apiKey: string,
  extraParams: Record<string, string> = {},
  page = 1
): Promise<TmdbTvItem[]> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("language", TMDB_LANGUAGE);
  url.searchParams.set("region", TMDB_REGION);
  url.searchParams.set("page", String(page));
  url.searchParams.set("include_adult", "false");
  Object.entries(extraParams).forEach(([key, value]) => url.searchParams.set(key, value));

  const payload = await fetchJson<TmdbTvResponse>(url.toString(), {
    headers: applyTmdbAuth(url, apiKey)
  });

  return payload.results ?? [];
}

async function fetchTmdbTvPages(
  path: string,
  apiKey: string,
  extraParams: Record<string, string> = {},
  pages = 1
): Promise<TmdbTvItem[]> {
  const settled = await Promise.allSettled(
    Array.from({ length: pages }, (_, index) => fetchTmdbTv(path, apiKey, extraParams, index + 1))
  );

  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

function normalizeTmdbDrama(
  item: TmdbTvItem,
  trendSource: string
): Omit<PopularRecommendation, "rank"> | null {
  if (!item.id || !item.name?.trim()) return null;
  if (item.genre_ids?.includes(16)) return null;
  if (!item.genre_ids?.includes(18)) return null;

  const contentType = inferTmdbTvContentType({
    originCountry: item.origin_country,
    genreIds: item.genre_ids
  });

  if (contentType !== "kdrama" && contentType !== "jdrama") return null;

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
    release_month: monthFromDate(item.first_air_date),
    has_seasons: true,
    episode_count: null,
    genres: genreNamesFromIds(item.genre_ids),
    category: "drama",
    trend_source: trendSource,
    popularity: positiveFiniteOrNull(item.popularity)
  };
}

async function fetchAnimeRecommendations(
  options: RecommendationOptions,
  adminClient: CacheClient
): Promise<PopularRecommendation[]> {
  const configuredEndpoint = Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co";
  const endpointCandidates = Array.from(new Set([configuredEndpoint, "https://graphql.anilist.co"]));
  const perPage = Math.min(50, options.poolLimit);
  const pages = Math.max(1, Math.ceil(options.poolLimit / perPage));
  const windowBounds = getCandidateWindowBounds(options.now, options.candidateWindowDays);
  const startDateGreater = toFuzzyDateNumber(addDays(new Date(windowBounds.startTime), -1));
  const startDateLesser = toFuzzyDateNumber(addDays(new Date(windowBounds.endTime), 1));
  const settledPayloads = await Promise.allSettled(
    Array.from({ length: pages }, (_, index) =>
      fetchFirstAniListPayload(
        endpointCandidates,
        index + 1,
        perPage,
        startDateGreater,
        startDateLesser
      )
    )
  );
  const payloads = settledPayloads.flatMap((result) => {
    if (result.status === "fulfilled") return [result.value];
    console.error("AniList recommendation page failed:", result.reason);
    return [];
  });
  if (payloads.length === 0) throw new Error("AniList recommendation pages failed");

  const mediaItems = payloads.flatMap((payload) => payload.data?.Page?.media ?? []);
  const baseResults = mediaItems
    .map((item, index) => normalizeAniListAnime(item, index))
    .filter((item): item is Omit<PopularRecommendation, "rank"> => Boolean(item))
    .filter((item) =>
      isWithinCandidateWindow(
        { air_date: item.air_date, air_year: item.air_year },
        options.now,
        options.candidateWindowDays
      )
    );

  const enrichedResults = await mapWithConcurrency(
    baseResults,
    ANIME_KOREAN_ENRICHMENT_CONCURRENCY,
    (item) => enrichAnimeWithTmdbKorean(item, adminClient)
  );

  return rankRecommendations(enrichedResults, "anime", options);
}

async function fetchFirstAniListPayload(
  endpoints: string[],
  page: number,
  perPage: number,
  startDateGreater: number,
  startDateLesser: number
): Promise<AniListResponse> {
  let lastError: unknown;

  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson<AniListResponse>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: ANILIST_TRENDING_QUERY,
          variables: { page, perPage, startDateGreater, startDateLesser }
        })
      });
      if (payload.errors?.length) {
        throw new Error(payload.errors[0]?.message ?? "AniList GraphQL error");
      }
      return payload;
    } catch (error) {
      lastError = error;
      console.error(`AniList endpoint failed (${endpoint}):`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AniList endpoints failed");
}

function normalizeAniListAnime(
  item: AniListMedia,
  trendingIndex: number
): Omit<PopularRecommendation, "rank"> | null {
  if (!item.id) return null;

  const title = item.title?.english ?? item.title?.romaji ?? item.title?.native;
  if (!title?.trim()) return null;

  return {
    external_source: "anilist",
    external_id: String(item.id),
    content_type: "anime",
    title_primary: title.trim(),
    title_original: item.title?.native?.trim() || null,
    poster_url: item.coverImage?.large ?? null,
    overview: cleanText(item.description),
    air_year: item.startDate?.year ?? null,
    air_date: dateFromParts(item.startDate),
    release_month: item.startDate?.month ?? null,
    has_seasons: item.format !== "MOVIE",
    episode_count: item.episodes ?? null,
    genres: Array.from(new Set(item.genres ?? [])),
    category: "anime",
    trend_source: "AniList 트렌딩",
    trendingIndex
  };
}

async function enrichAnimeWithTmdbKorean(
  item: Omit<PopularRecommendation, "rank">,
  adminClient: CacheClient
): Promise<Omit<PopularRecommendation, "rank">> {
  const cacheKey = createAnimeKoreanCacheKey(item.external_id);
  const cachedItem = await getPersistedAnimeEnrichment(adminClient, cacheKey);
  if (cachedItem) {
    return {
      ...item,
      ...cachedItem
    };
  }

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return item;

  const queries = [item.title_original, item.title_primary].filter((title): title is string =>
    Boolean(title?.trim())
  );

  for (const query of Array.from(new Set(queries))) {
    const url = new URL("https://api.themoviedb.org/3/search/tv");
    url.searchParams.set("query", query);
    url.searchParams.set("language", TMDB_LANGUAGE);
    url.searchParams.set("region", TMDB_REGION);
    url.searchParams.set("include_adult", "false");

    try {
      const payload = await fetchJson<TmdbAnimeSearchResponse>(
        url.toString(),
        {
          headers: applyTmdbAuth(url, apiKey)
        },
        3000
      );
      const match =
        payload.results?.find((result) =>
          isCloseYear(yearFromDate(result.first_air_date), item.air_year)
        ) ?? payload.results?.[0];
      if (!match) continue;
      const koreanTitle = await fetchTmdbKoreanTitle(match.id, apiKey);

      const enrichedItem = {
        ...item,
        title_primary: (koreanTitle ?? match.name?.trim()) || item.title_primary,
        poster_url: match.poster_path
          ? `https://image.tmdb.org/t/p/w500${match.poster_path}`
          : item.poster_url,
        overview: cleanText(match.overview) ?? item.overview,
        localized_overview: cleanText(match.overview),
        air_date: dateOnly(match.first_air_date) ?? item.air_date,
        release_month: monthFromDate(match.first_air_date) ?? item.release_month
      };
      await setPersistedAnimeEnrichment(adminClient, cacheKey, createAnimeEnrichmentPayload(enrichedItem));
      return enrichedItem;
    } catch {
      // Korean metadata is a best-effort enhancement; keep the AniList row.
    }
  }

  return item;
}

async function fetchTmdbKoreanTitle(tmdbId: number, apiKey: string): Promise<string | null> {
  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}`);
  url.searchParams.set("language", TMDB_LANGUAGE);
  url.searchParams.set("append_to_response", "translations");

  try {
    const payload = await fetchJson<TmdbTranslationResponse>(
      url.toString(),
      { headers: applyTmdbAuth(url, apiKey) },
      3000
    );

    const translations = payload.translations?.translations ?? [];
    const korean = translations.find(
      (translation) => translation.iso_639_1 === "ko" || translation.iso_3166_1 === "KR"
    );
    const title = korean?.data?.name?.trim() || korean?.data?.title?.trim();

    return title && hasHangul(title) ? title : null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function genreNamesFromIds(genreIds?: number[] | null): string[] {
  return Array.from(
    new Set(
      (genreIds ?? [])
        .map((id) => TMDB_GENRE_NAMES.get(id))
        .filter((name): name is string => Boolean(name))
    )
  );
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 0 ? stripped : null;
}

function yearFromDate(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 4) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function monthFromDate(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 7) return null;
  const month = Number.parseInt(value.slice(5, 7), 10);
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : null;
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function dateFromParts(parts?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  const year = parts?.year;
  const month = parts?.month;
  if (!year || !month) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(parts?.day ?? 1).padStart(2, "0")}`;
}

function isCloseYear(candidate: number | null, expected?: number | null): boolean {
  if (!candidate || !expected) return true;
  return Math.abs(candidate - expected) <= 1;
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

function positiveFiniteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function rankRecommendations(
  items: Omit<PopularRecommendation, "rank">[],
  category: RecommendationCategory,
  options: RecommendationOptions
): PopularRecommendation[] {
  const seen = new Set<string>();
  const eligibleItems = items
    .filter((item) => item.category === category)
    .filter((item) =>
      isWithinCandidateWindow(
        { air_date: item.air_date, air_year: item.air_year },
        options.now,
        options.candidateWindowDays
      )
    )
    .filter((item) => {
      const key = `${item.external_source}:${item.external_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return rankPopularRecommendations(eligibleItems, {
    now: options.now,
    poolLimit: options.poolLimit
  }).map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}

async function parseRecommendationOptions(
  req: Request
): Promise<{ ok: true; value: RecommendationOptions } | { ok: false; message: string }> {
  let value: PopularRecommendationsRequest = {};

  if (req.method === "GET") {
    const url = new URL(req.url);
    const candidateYears = url.searchParams.get("candidate_years");
    const candidateDays = url.searchParams.get("candidate_days");
    const poolLimit = url.searchParams.get("pool_limit");
    value = {
      ...(candidateYears === null ? {} : { candidate_years: Number(candidateYears) }),
      ...(candidateDays === null ? {} : { candidate_days: Number(candidateDays) }),
      ...(poolLimit === null ? {} : { pool_limit: Number(poolLimit) })
    };
  } else {
    const rawBody = await req.text();
    if (rawBody.trim()) {
      try {
        const parsed = JSON.parse(rawBody) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return { ok: false, message: "Request body must be a JSON object" };
        }
        value = parsed as PopularRecommendationsRequest;
      } catch {
        return { ok: false, message: "Invalid JSON body" };
      }
    }
  }

  const candidateYears = value.candidate_years ?? DEFAULT_CANDIDATE_YEARS;
  const candidateWindowDays =
    value.candidate_days ?? (value.candidate_years === undefined ? DEFAULT_CANDIDATE_WINDOW_DAYS : candidateYears * 365);
  const poolLimit = value.pool_limit ?? DEFAULT_RECOMMENDATION_POOL_LIMIT;
  if (!Number.isInteger(candidateYears) || candidateYears < 1 || candidateYears > MAX_CANDIDATE_YEARS) {
    return { ok: false, message: `candidate_years must be an integer between 1 and ${MAX_CANDIDATE_YEARS}` };
  }
  if (
    !Number.isInteger(candidateWindowDays) ||
    candidateWindowDays < 1 ||
    candidateWindowDays > MAX_CANDIDATE_WINDOW_DAYS
  ) {
    return {
      ok: false,
      message: `candidate_days must be an integer between 1 and ${MAX_CANDIDATE_WINDOW_DAYS}`
    };
  }
  if (!Number.isInteger(poolLimit) || poolLimit < 1 || poolLimit > MAX_RECOMMENDATION_POOL_LIMIT) {
    return { ok: false, message: `pool_limit must be an integer between 1 and ${MAX_RECOMMENDATION_POOL_LIMIT}` };
  }

  return {
    ok: true,
    value: {
      candidateWindowDays,
      poolLimit,
      now: new Date()
    }
  };
}

function createPopularCacheKey(options: RecommendationOptions): string {
  return [
    "popular-recommendations",
    "v2",
    formatDateInput(options.now),
    options.candidateWindowDays,
    options.poolLimit
  ].join(":");
}

function createAnimeKoreanCacheKey(anilistId: string): string {
  return `anilist-ko:${anilistId}`;
}

async function getPersistedPopularResponse(
  adminClient: CacheClient,
  cacheKey: string
): Promise<RecommendationsResponse | null> {
  const cached = await getExternalCache<{ response?: RecommendationsResponse }>(
    adminClient,
    cacheKey,
    POPULAR_CACHE_SOURCE
  );
  return cached?.response ?? null;
}

async function setPersistedPopularResponse(
  adminClient: CacheClient,
  cacheKey: string,
  response: RecommendationsResponse
): Promise<void> {
  await setExternalCache(adminClient, cacheKey, POPULAR_CACHE_SOURCE, { response }, POPULAR_CACHE_TTL_MS);
}

async function getPersistedAnimeEnrichment(
  adminClient: CacheClient,
  cacheKey: string
): Promise<AnimeEnrichmentPayload | null> {
  const cached = await getExternalCache<{ item?: AnimeEnrichmentPayload }>(
    adminClient,
    cacheKey,
    ANILIST_KOREAN_CACHE_SOURCE
  );
  return cached?.item ?? null;
}

async function setPersistedAnimeEnrichment(
  adminClient: CacheClient,
  cacheKey: string,
  item: AnimeEnrichmentPayload
): Promise<void> {
  await setExternalCache(
    adminClient,
    cacheKey,
    ANILIST_KOREAN_CACHE_SOURCE,
    { item },
    ANIME_KOREAN_ENRICHMENT_CACHE_TTL_MS
  );
}

async function getExternalCache<T>(
  adminClient: CacheClient,
  cacheKey: string,
  source: ExternalSource
): Promise<T | null> {
  try {
    const { data, error } = await adminClient
      .from("external_search_cache")
      .select("response_json")
      .eq("query_hash", cacheKey)
      .eq("source", source)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) throw error;
    return (data?.response_json as T | undefined) ?? null;
  } catch (error) {
    console.error(`popular recommendation cache read failed (${cacheKey}):`, error);
    return null;
  }
}

async function setExternalCache(
  adminClient: CacheClient,
  cacheKey: string,
  source: ExternalSource,
  responseJson: Record<string, unknown>,
  ttlMs: number
): Promise<void> {
  try {
    const { error } = await adminClient.from("external_search_cache").upsert(
      {
        query_hash: cacheKey,
        query_text: cacheKey,
        source,
        response_json: responseJson,
        expires_at: new Date(Date.now() + ttlMs).toISOString()
      },
      { onConflict: "query_hash,source" }
    );

    if (error) throw error;
  } catch (error) {
    console.error(`popular recommendation cache write failed (${cacheKey}):`, error);
  }
}

function createAnimeEnrichmentPayload(item: Omit<PopularRecommendation, "rank">): AnimeEnrichmentPayload {
  return {
    title_primary: item.title_primary,
    poster_url: item.poster_url,
    overview: item.overview,
    localized_overview: item.localized_overview,
    air_date: item.air_date,
    release_month: item.release_month
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (item === undefined) continue;
        results[index] = await mapper(item, index);
      }
    })
  );

  return results;
}

function getTmdbFetchPages(poolLimit: number): number {
  return Math.max(1, Math.min(3, Math.ceil(poolLimit / 20)));
}

function getCachedResponse(cacheKey: string): RecommendationsResponse | null {
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }

  const entry = responseCache.get(cacheKey);
  if (!entry) return null;
  responseCache.delete(cacheKey);
  responseCache.set(cacheKey, entry);
  return entry.response;
}

function setCachedResponse(cacheKey: string, response: RecommendationsResponse): void {
  responseCache.delete(cacheKey);
  responseCache.set(cacheKey, {
    expiresAt: Date.now() + POPULAR_CACHE_TTL_MS,
    response
  });

  while (responseCache.size > POPULAR_CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    responseCache.delete(oldestKey);
  }
}
