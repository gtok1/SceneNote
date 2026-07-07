import { corsHeaders, json, jsonError } from "../_shared/http.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import { inferTmdbTvContentType } from "../_shared/tmdbClassification.ts";
import type { ContentType, ExternalSource } from "../_shared/types.ts";

type RecommendationCategory = "drama" | "anime";

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
  has_seasons: boolean;
  episode_count: number | null;
  genres?: string[];
  category: RecommendationCategory;
  rank: number;
  trend_source: string;
  release_month?: number | null;
}

interface RecommendationsResponse {
  generated_at: string;
  categories: Record<RecommendationCategory, PopularRecommendation[]>;
  failedSources: ExternalSource[];
  partial: boolean;
}

interface TmdbTvItem {
  id: number;
  name?: string | null;
  original_name?: string | null;
  poster_path?: string | null;
  overview?: string | null;
  first_air_date?: string | null;
  origin_country?: string[] | null;
  genre_ids?: number[] | null;
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

const TMDB_LANGUAGE = "ko-KR";
const TMDB_REGION = "KR";
const CURRENT_RELEASE_YEAR = new Date().getUTCFullYear();
const CURRENT_RELEASE_MONTH = new Date().getUTCMonth() + 1;
const CURRENT_RELEASE_MONTH_END_DATE = `${CURRENT_RELEASE_YEAR}-${String(CURRENT_RELEASE_MONTH).padStart(2, "0")}-${String(
  new Date(Date.UTC(CURRENT_RELEASE_YEAR, CURRENT_RELEASE_MONTH, 0)).getUTCDate()
).padStart(2, "0")}`;
const RECOMMENDATION_POOL_LIMIT = 30;
const TMDB_FETCH_PAGES = 2;
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
  query TrendingAnime($page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
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
    const user = await requireUser(req);
    const excludedKeys = await getUserLibraryExternalKeys(user.id);

    const [dramaResult, animeResult] = await Promise.allSettled([
      fetchDramaRecommendations(excludedKeys),
      fetchAnimeRecommendations(excludedKeys)
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

    return json(response);
  } catch {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }
});

async function fetchDramaRecommendations(excludedKeys: Set<string>): Promise<PopularRecommendation[]> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) throw new Error("TMDB_API_KEY is not configured");

  const [trendingResult, discoveredKrResult, discoveredJpResult] = await Promise.allSettled([
    fetchTmdbTvPages("/trending/tv/week", apiKey),
    fetchTmdbTvPages("/discover/tv", apiKey, {
      "first_air_date.gte": `${CURRENT_RELEASE_YEAR}-01-01`,
      "first_air_date.lte": CURRENT_RELEASE_MONTH_END_DATE,
      include_null_first_air_dates: "false",
      sort_by: "popularity.desc",
      watch_region: TMDB_REGION,
      with_genres: "18",
      with_origin_country: "KR",
      without_genres: "16"
    }),
    fetchTmdbTvPages("/discover/tv", apiKey, {
      "first_air_date.gte": `${CURRENT_RELEASE_YEAR}-01-01`,
      "first_air_date.lte": CURRENT_RELEASE_MONTH_END_DATE,
      include_null_first_air_dates: "false",
      sort_by: "popularity.desc",
      watch_region: TMDB_REGION,
      with_genres: "18",
      with_origin_country: "JP",
      without_genres: "16"
    })
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
    .filter((item) => item.air_year === CURRENT_RELEASE_YEAR);

  return rankRecommendations(merged, "drama", excludedKeys);
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
  pages = TMDB_FETCH_PAGES
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
    release_month: monthFromDate(item.first_air_date),
    has_seasons: true,
    episode_count: null,
    genres: genreNamesFromIds(item.genre_ids),
    category: "drama",
    trend_source: trendSource
  };
}

async function fetchAnimeRecommendations(excludedKeys: Set<string>): Promise<PopularRecommendation[]> {
  const configuredEndpoint = Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co";
  const endpointCandidates = Array.from(new Set([configuredEndpoint, "https://graphql.anilist.co"]));
  const payload = await fetchFirstAniListPayload(endpointCandidates);

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "AniList GraphQL error");
  }

  const baseResults = (payload.data?.Page?.media ?? [])
    .map(normalizeAniListAnime)
    .filter((item): item is Omit<PopularRecommendation, "rank"> => Boolean(item))
    .filter((item) => item.air_year === CURRENT_RELEASE_YEAR);

  const enrichedResults = await Promise.all(baseResults.map(enrichAnimeWithTmdbKorean));

  return rankRecommendations(enrichedResults, "anime", excludedKeys);
}

async function fetchFirstAniListPayload(endpoints: string[]): Promise<AniListResponse> {
  let lastError: unknown;

  for (const endpoint of endpoints) {
    try {
      return await fetchJson<AniListResponse>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: ANILIST_TRENDING_QUERY,
          variables: { page: 1, perPage: RECOMMENDATION_POOL_LIMIT }
        })
      });
    } catch (error) {
      lastError = error;
      console.error(`AniList endpoint failed (${endpoint}):`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AniList endpoints failed");
}

function normalizeAniListAnime(item: AniListMedia): Omit<PopularRecommendation, "rank"> | null {
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
    release_month: item.startDate?.month ?? null,
    has_seasons: item.format !== "MOVIE",
    episode_count: item.episodes ?? null,
    genres: Array.from(new Set(item.genres ?? [])),
    category: "anime",
    trend_source: "AniList 트렌딩"
  };
}

async function enrichAnimeWithTmdbKorean(
  item: Omit<PopularRecommendation, "rank">
): Promise<Omit<PopularRecommendation, "rank">> {
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

      return {
        ...item,
        title_primary: match.name?.trim() || item.title_primary,
        poster_url: match.poster_path
          ? `https://image.tmdb.org/t/p/w500${match.poster_path}`
          : item.poster_url,
        overview: cleanText(match.overview) ?? item.overview,
        localized_overview: cleanText(match.overview),
        release_month: monthFromDate(match.first_air_date) ?? item.release_month
      };
    } catch {
      // Korean metadata is a best-effort enhancement; keep the AniList row.
    }
  }

  return item;
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

async function getUserLibraryExternalKeys(userId: string): Promise<Set<string>> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("user_library_items")
      .select("contents(source_api,source_id)")
      .eq("user_id", userId);

    if (error) throw error;

    return new Set(
      ((data ?? []) as { contents?: { source_api?: string | null; source_id?: string | null } | null }[])
        .map((row) => {
          const source = row.contents?.source_api;
          const id = row.contents?.source_id;
          return source && id && source !== "manual" ? `${source}:${id}` : null;
        })
        .filter((key): key is string => Boolean(key))
    );
  } catch (error) {
    console.error("popular-recommendations library exclusion failed:", error);
    return new Set();
  }
}

function rankRecommendations(
  items: Omit<PopularRecommendation, "rank">[],
  category: RecommendationCategory,
  excludedKeys: Set<string>
): PopularRecommendation[] {
  const seen = new Set<string>();
  return items
    .filter((item) => item.category === category)
    .filter((item) => item.air_year === CURRENT_RELEASE_YEAR)
    .filter((item) => {
      const key = `${item.external_source}:${item.external_id}`;
      if (excludedKeys.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(compareRecommendationRecency)
    .slice(0, RECOMMENDATION_POOL_LIMIT)
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }));
}

function compareRecommendationRecency(
  a: Omit<PopularRecommendation, "rank">,
  b: Omit<PopularRecommendation, "rank">
): number {
  return getReleaseMonthScore(b) - getReleaseMonthScore(a);
}

function getReleaseMonthScore(item: Omit<PopularRecommendation, "rank">): number {
  const month = item.release_month ?? 0;
  if (month > 0 && month <= CURRENT_RELEASE_MONTH) return month;
  return 0;
}
