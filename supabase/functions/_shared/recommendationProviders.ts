import { TASTE_FILL_TREND_SOURCE, type TasteFillQuery } from "./recommendationTasteFill.ts";
import type {
  RecommendationProviderPage,
  RecommendationProviderRequest
} from "./recommendationCatalog.ts";
import type { RecommendationCandidate } from "./recommendationEngine.ts";
import { inferTmdbTvContentType } from "./tmdbClassification.ts";
import { normalizeContentThemes, type ContentTheme } from "./recommendationThemes.ts";
import type { RecommendationCache } from "./recommendationCache.ts";
import { normalizeTitleForMatch } from "./titleMatch.ts";
import { applyKrOttDiscoverFilter, type TmdbWatchProviderRegion } from "./watchProviders.ts";
import type { UserRecommendationFilters } from "./recommendationUserFilters.ts";
import { discoveryFilterKey, matchesDiscoveryFilters, normalizeDiscoveryFilters, normalizeDiscoveryGenre, type DiscoveryFilterInput } from "./discoveryFilters.ts";
import {
  aniListIncludedGenre,
  aniListExcludedFilters,
  canFetchRecommendationProvider,
  recommendationProviderFilterKey,
  tmdbExcludedGenreIds,
  tmdbExcludedKeywordIds,
  tmdbIncludedGenreId,
  TMDB_TV_KEYWORD_GENRES,
  TMDB_RECOMMENDATION_GENRES
} from "./recommendationProviderFilters.ts";

export interface RecommendationProviderOptions {
  filters?: UserRecommendationFilters;
  discoveryFilters?: DiscoveryFilterInput;
  cache?: RecommendationCache;
  deadlineMs?: number;
}

export interface RecommendationKeywordOptions<T> {
  cache?: RecommendationCache;
  onDeferred?: (candidate: T) => void;
  deadlineMs?: number;
  lookupBudget?: { remaining: number };
}

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
const PROVIDER_FAILURE_TTL_MS = 60_000;
const PROVIDER_CACHE_VERSION = "recommendation-provider-v4";
const ANILIST_PROVIDER_CACHE_VERSION = "recommendation-provider-anilist-v5";
const KEYWORD_CACHE_VERSION = "recommendation-keywords-v1";
const LOCALIZATION_CACHE_VERSION = "recommendation-anime-ko-v3";
const KR_WATCH_CACHE_VERSION = "kr-ott-watch-v1";
const KR_WATCH_CACHE_TTL_MS = 24 * 60 * 60_000;
const PROVIDER_CACHE_MAX_ENTRIES = 300;
const TMDB_KEYWORD_CACHE_TTL_MS = 24 * 60 * 60_000;
const TMDB_KEYWORD_FAILURE_TTL_MS = 60_000;
const TMDB_KEYWORD_CACHE_MAX_ENTRIES = 2_000;
const TMDB_KEYWORD_CONCURRENCY = 8;
export const TMDB_RECOMMENDATION_KEYWORD_LOOKUP_LIMIT = 8;

const providerPageCache = new Map<
  string,
  { expiresAt: number; promise: Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> }
>();
const animeLocalizationCache = new Map<
  string,
  { expiresAt: number; promise: Promise<TmdbTvItem[]> }
>();
const tmdbKeywordCache = new Map<string, { expiresAt: number; promise: Promise<string[] | null> }>();
const tmdbKeywordWaiters: (() => void)[] = [];
let activeTmdbKeywordRequests = 0;

interface TmdbKeywordPayload {
  results?: { name?: string | null }[] | null;
  keywords?: { name?: string | null }[] | null;
}

export interface TmdbKeywordCandidate {
  external_source: string;
  external_id: string;
  content_type: string;
  genres?: readonly string[] | null;
  keywords?: readonly string[] | null;
  themes?: readonly ContentTheme[] | null;
}

// Discovery and trending endpoints only return broad genre IDs. Fetch structured
// keywords for users who enabled relationship exclusions; reuse them across
// personalized and popular requests without adding latency for other accounts.
export async function enrichTmdbRecommendationCandidates<T extends TmdbKeywordCandidate>(
  candidates: readonly T[],
  shouldLookup: (candidate: T) => boolean = () => true,
  options: RecommendationKeywordOptions<T> = {}
): Promise<(T & TmdbKeywordCandidate)[]> {
  // Check the entire page's reusable metadata first. Cached (including empty or
  // failed) results and already enriched candidates do not spend API requests.
  const cachedCandidates = await Promise.all(candidates.map(async (candidate) => {
    if (candidate.external_source !== "tmdb" || !/^\d+$/u.test(candidate.external_id) ||
      Array.isArray(candidate.keywords)) return null;
    const kind = candidate.content_type === "movie" ? "movie" : "tv";
    const cached = await readCachedTmdbKeywords(kind, candidate.external_id, options.cache, options.deadlineMs);
    return { kind, cached } as const;
  }));
  let lookupCount = 0;
  return Promise.all(candidates.map(async (candidate, index) => {
    const context = cachedCandidates[index];
    if (!context) return candidate;
    const { kind, cached } = context;
    let keywords: string[] | null;
    if (cached) {
      keywords = cached.keywords;
    } else {
      // A duplicate or concurrent caller may already have started this lookup.
      const inFlight = getMemoryTmdbKeywords(kind, candidate.external_id);
      try {
        if (inFlight) {
          keywords = await withinDeadline(() => inFlight.promise, options.deadlineMs);
        } else {
          // Exclusion suppresses new provider work, not reusable metadata. The
          // catalog's offset still needs the same verified pool on later pages.
          if (!shouldLookup(candidate)) return candidate;
          if (remainingTime(options.deadlineMs) < 500 ||
            lookupCount >= TMDB_RECOMMENDATION_KEYWORD_LOOKUP_LIMIT ||
            (options.lookupBudget && options.lookupBudget.remaining <= 0)) {
            options.onDeferred?.(candidate);
            return candidate;
          }
          lookupCount += 1;
          if (options.lookupBudget) options.lookupBudget.remaining -= 1;
          keywords = await fetchCachedTmdbKeywords(kind, candidate.external_id, options.cache, options.deadlineMs);
        }
      } catch (error) {
        if (!isDeadlineError(error)) throw error;
        options.onDeferred?.(candidate);
        return candidate;
      }
    }
    if (keywords === null) return candidate;
    return {
      ...candidate,
      keywords,
      themes: normalizeContentThemes({ external_source: "tmdb", genres: candidate.genres, keywords })
    };
  }));
}

interface CachedKeywords {
  keywords: string[] | null;
  expiresAt: number;
}

function tmdbKeywordKey(kind: "tv" | "movie", id: string): string {
  return `${KEYWORD_CACHE_VERSION}:${kind}:${id}`;
}

function getMemoryTmdbKeywords(kind: "tv" | "movie", id: string) {
  const key = tmdbKeywordKey(kind, id);
  const cached = tmdbKeywordCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;
  if (cached) tmdbKeywordCache.delete(key);
  return null;
}

async function readCachedTmdbKeywords(
  kind: "tv" | "movie",
  id: string,
  cache?: RecommendationCache,
  deadlineMs?: number
): Promise<CachedKeywords | null> {
  const memory = getMemoryTmdbKeywords(kind, id);
  if (memory) {
    try {
      return { keywords: await withinDeadline(() => memory.promise, deadlineMs), expiresAt: memory.expiresAt };
    } catch (error) {
      if (isDeadlineError(error)) return null;
      throw error;
    }
  }
  const key = tmdbKeywordKey(kind, id);
  const persisted = await readPersisted<CachedKeywords>(cache, key, "tmdb", deadlineMs);
  if (!persisted || persisted.expiresAt <= Date.now() ||
    !(persisted.keywords === null || (Array.isArray(persisted.keywords) &&
      persisted.keywords.every((keyword) => typeof keyword === "string")))) return null;
  tmdbKeywordCache.set(key, {
    expiresAt: persisted.expiresAt,
    promise: Promise.resolve(persisted.keywords)
  });
  trimKeywordCache();
  return persisted;
}

async function fetchCachedTmdbKeywords(
  kind: "tv" | "movie",
  id: string,
  cache?: RecommendationCache,
  deadlineMs?: number
): Promise<string[] | null> {
  const key = tmdbKeywordKey(kind, id);
  const now = Date.now();
  const promise = (async () => {
    const keywords = await withTmdbKeywordSlot(() => fetchTmdbKeywords(kind, id, deadlineMs), deadlineMs);
    const ttlMs = keywords === null ? TMDB_KEYWORD_FAILURE_TTL_MS : TMDB_KEYWORD_CACHE_TTL_MS;
    const result = { keywords, expiresAt: Date.now() + ttlMs };
    await writePersisted(cache, key, "tmdb", result, ttlMs, deadlineMs);
    const current = tmdbKeywordCache.get(key);
    if (current) current.expiresAt = result.expiresAt;
    return keywords;
  })().catch((error: unknown) => {
    // A work item whose request budget expired remains eligible for a later pass.
    tmdbKeywordCache.delete(key);
    throw error;
  });
  tmdbKeywordCache.set(key, { expiresAt: now + TMDB_KEYWORD_CACHE_TTL_MS, promise });
  trimKeywordCache();
  return promise;
}

function trimKeywordCache(): void {
  while (tmdbKeywordCache.size > TMDB_KEYWORD_CACHE_MAX_ENTRIES) {
    const oldest = tmdbKeywordCache.keys().next().value;
    if (!oldest) break;
    tmdbKeywordCache.delete(oldest);
  }
}

async function withTmdbKeywordSlot<T>(task: () => Promise<T>, deadlineMs?: number): Promise<T> {
  if (remainingTime(deadlineMs) <= 0) throw deadlineError();
  if (activeTmdbKeywordRequests >= TMDB_KEYWORD_CONCURRENCY) {
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waiter = () => {
        if (timer !== undefined) clearTimeout(timer);
        resolve();
      };
      tmdbKeywordWaiters.push(waiter);
      if (Number.isFinite(deadlineMs)) {
        timer = setTimeout(() => {
          const index = tmdbKeywordWaiters.indexOf(waiter);
          if (index >= 0) tmdbKeywordWaiters.splice(index, 1);
          reject(deadlineError());
        }, remainingTime(deadlineMs));
      }
    });
  } else {
    activeTmdbKeywordRequests += 1;
  }
  try {
    if (remainingTime(deadlineMs) <= 0) throw deadlineError();
    return await task();
  } finally {
    const next = tmdbKeywordWaiters.shift();
    if (next) next();
    else activeTmdbKeywordRequests -= 1;
  }
}

async function fetchTmdbKeywords(kind: "tv" | "movie", id: string, deadlineMs?: number): Promise<string[] | null> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return null;
  const url = new URL(`https://api.themoviedb.org/3/${kind}/${id}/keywords`);
  const headers = applyTmdbAuth(url, apiKey);
  try {
    const payload = await fetchJson<TmdbKeywordPayload>(url.toString(), { headers }, 2_500, deadlineMs);
    const tags = kind === "movie" ? payload.keywords : payload.results;
    if (!Array.isArray(tags)) return null;
    return [...new Set(tags.map((entry) => entry.name?.trim()).filter((name): name is string => Boolean(name)))];
  } catch (error) {
    if (isDeadlineError(error)) throw error;
    console.warn(`TMDB ${kind} keyword lookup failed for ${id}:`, error);
    return null;
  }
}

const ANILIST_MONTH_QUERY = `
  query RecommendationAnimeMonth(
    $page: Int!
    $perPage: Int!
    $startDateGreater: FuzzyDateInt!
    $startDateLesser: FuzzyDateInt!
    $excludedGenres: [String]
    $excludedTags: [String]
    $includedGenre: String
    $country: CountryCode
    $countries: [CountryCode]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(
        type: ANIME
        sort: [POPULARITY_DESC, SCORE_DESC, START_DATE_DESC]
        isAdult: false
        startDate_greater: $startDateGreater
        startDate_lesser: $startDateLesser
        genre_not_in: $excludedGenres
        tag_not_in: $excludedTags
        genre: $includedGenre
        countryOfOrigin: $country
        countryOfOrigin_in: $countries
        minimumTagRank: 0
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

export function fetchRecommendationProviderPage(
  request: RecommendationProviderRequest,
  options: RecommendationProviderOptions = {}
): Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> {
  if (!canFetchRecommendationProvider(request.provider, options.discoveryFilters, options.filters)) {
    return Promise.resolve({ items: [], hasMore: false });
  }
  return getCachedProviderPage(request, options);
}

interface PersistedProviderPage {
  page: RecommendationProviderPage<CatalogRecommendationCandidate> | null;
  expiresAt: number;
}

async function getCachedProviderPage(
  request: RecommendationProviderRequest,
  options: RecommendationProviderOptions
): Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> {
  const discovery = normalizeDiscoveryFilters(options.discoveryFilters);
  const discoveryKey = !discovery.genres.length && !discovery.countries.length && !discovery.mediaTypes.length && discovery.year === undefined ? "" : `:${discoveryFilterKey(discovery)}`;
  const cacheVersion = request.provider === "anilist" ? ANILIST_PROVIDER_CACHE_VERSION : PROVIDER_CACHE_VERSION;
  const key = `${cacheVersion}:${request.provider}:${request.month}:${request.page}:${request.asOfDate}:${recommendationProviderFilterKey(options.filters)}${discoveryKey}`;
  const source = request.provider === "anilist" ? "anilist" : "tmdb";
  const now = Date.now();
  for (const [cacheKey, entry] of providerPageCache) {
    if (entry.expiresAt <= now) providerPageCache.delete(cacheKey);
  }
  const cached = providerPageCache.get(key);
  if (cached && cached.expiresAt > now) return withinDeadline(() => cached.promise, options.deadlineMs);

  const promise = (async () => {
    const persisted = await readPersisted<PersistedProviderPage>(options.cache, key, source, options.deadlineMs);
    if (persisted && persisted.expiresAt > Date.now()) {
      if (!persisted.page) throw new Error("RECOMMENDATION_PROVIDER_RECENTLY_UNAVAILABLE");
      if (Array.isArray(persisted.page.items) && typeof persisted.page.hasMore === "boolean") {
        const entry = providerPageCache.get(key);
        if (entry) entry.expiresAt = persisted.expiresAt;
        return persisted.page;
      }
    }
    try {
      const page = await fetchUncachedProviderPage(request, options);
      await writePersisted(options.cache, key, source, {
        page, expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS
      }, PROVIDER_CACHE_TTL_MS, options.deadlineMs);
      return page;
    } catch (error) {
      if (isDeadlineError(error)) throw error;
      await writePersisted(options.cache, key, source, {
        page: null, expiresAt: Date.now() + PROVIDER_FAILURE_TTL_MS
      }, PROVIDER_FAILURE_TTL_MS, options.deadlineMs);
      throw error;
    }
  })();
  providerPageCache.set(key, { expiresAt: now + PROVIDER_CACHE_TTL_MS, promise });
  trimProviderCache();
  try {
    return await promise;
  } catch (error) {
    const entry = providerPageCache.get(key);
    if (isDeadlineError(error)) providerPageCache.delete(key);
    else if (entry) entry.expiresAt = Date.now() + PROVIDER_FAILURE_TTL_MS;
    throw error;
  }
}

async function fetchUncachedProviderPage(
  request: RecommendationProviderRequest,
  options: RecommendationProviderOptions
): Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> {
  if (request.provider === "anilist") return fetchAniListMonth(request, options);
  if (request.provider === "tmdb_movie") return fetchTmdbMovieMonth(request, options);
  return fetchTmdbDramaMonth(request, options);
}

async function fetchTmdbDramaMonth(
  request: RecommendationProviderRequest,
  options: RecommendationProviderOptions
): Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> {
  const apiKey = requireTmdbApiKey();
  const bounds = getMonthBounds(request.month, request.asOfDate);
  const discovery = normalizeDiscoveryFilters(options.discoveryFilters);
  const countries = discovery.countries.length ? discovery.countries : [request.provider === "tmdb_jp" ? "JP" : "KR"];
  const genres = eligibleDiscoveryGenres(discovery.genres, options.filters);
  const nativeIds = [...new Set(genres.map((genre) => tmdbIncludedGenreId(genre, "tv")).filter((id): id is number => typeof id === "number" && id !== 16))];
  const keywordGenres = genres.filter((genre) => TMDB_TV_KEYWORD_GENRES.has(genre));
  const keywordEntries = await Promise.all(keywordGenres.map(async (genre) => ({ genre, id: await resolveTmdbDiscoveryGenreKeyword(genre, options.cache, options.deadlineMs) })));
  const verified = keywordEntries.filter((entry): entry is { genre: string; id: number } => entry.id !== null);
  // Genre-ID and keyword predicates cannot express OR across TMDB parameters.
  // At most two discover lanes provide that union without a country/genre cross product.
  const lanes: { genreIds: number[]; keywords: typeof verified }[] = [];
  if (!discovery.genres.length || nativeIds.length) lanes.push({ genreIds: nativeIds.length ? nativeIds : [18], keywords: [] });
  if (verified.length) lanes.push({ genreIds: [18], keywords: verified });
  if (!lanes.length) return { items: [], hasMore: false };
  const pages = await Promise.all(lanes.map(async (lane) => {
    const url = new URL("https://api.themoviedb.org/3/discover/tv");
    setCommonTmdbParams(url, request.page);
    url.searchParams.set("first_air_date.gte", bounds.startDate);
    url.searchParams.set("first_air_date.lte", bounds.endDate);
    url.searchParams.set("include_null_first_air_dates", "false");
    url.searchParams.set("sort_by", "popularity.desc");
    applyKrOttDiscoverFilter(url);
    url.searchParams.set("with_genres", lane.genreIds.join("|"));
    url.searchParams.set("with_origin_country", countries.join("|"));
    if (lane.keywords.length) url.searchParams.set("with_keywords", lane.keywords.map((entry) => entry.id).join("|"));
    url.searchParams.set("without_genres", [...new Set([16, ...tmdbExcludedGenreIds(options.filters)])].join(","));
    setTmdbKeywordExclusions(url, options.filters);
    const headers = applyTmdbAuth(url, apiKey);
    const payload = await fetchJson<TmdbPage<TmdbTvItem>>(url.toString(), { headers }, 5_000, options.deadlineMs);
    const items = (payload.results ?? [])
      .map((item, index) => normalizeTmdbDrama(item, request, index, discovery.countries.length > 0, discovery.genres.length > 0))
      .filter((item): item is CatalogRecommendationCandidate => Boolean(item))
      .map((item) => lane.keywords.length === 1
        ? { ...item, genres: [...new Set([...item.genres, lane.keywords[0]!.genre])] }
        : lane.keywords.length ? { ...item, matched_genres: lane.keywords.map((entry) => entry.genre) } : item)
      .filter((item) => matchesDiscoveryFilters(item, discovery));
    return { items, hasMore: request.page < Math.min(TMDB_MAX_PAGE, Math.max(0, payload.total_pages ?? 0)) };
  }));
  return { items: pages.flatMap((page) => page.items), hasMore: pages.some((page) => page.hasMore) };
}

function eligibleDiscoveryGenres(genres: readonly string[], exclusions?: UserRecommendationFilters): string[] {
  return genres.filter((genre) => !exclusions?.excludedGenres.some((excluded) => normalizeDiscoveryGenre(excluded) === genre));
}

async function fetchTmdbMovieMonth(
  request: RecommendationProviderRequest,
  options: RecommendationProviderOptions
): Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> {
  const apiKey = requireTmdbApiKey();
  const bounds = getMonthBounds(request.month, request.asOfDate);
  const discovery = normalizeDiscoveryFilters(options.discoveryFilters);
  const url = new URL("https://api.themoviedb.org/3/discover/movie");
  setCommonTmdbParams(url, request.page);
  url.searchParams.set("primary_release_date.gte", bounds.startDate);
  url.searchParams.set("primary_release_date.lte", bounds.endDate);
  url.searchParams.set("sort_by", "popularity.desc");
  applyKrOttDiscoverFilter(url);
  if (discovery.countries.length) url.searchParams.set("with_origin_country", discovery.countries.join("|"));
  const includedIds = [...new Set(eligibleDiscoveryGenres(discovery.genres, options.filters).map((genre) => tmdbIncludedGenreId(genre, "movie")).filter((id): id is number => typeof id === "number"))];
  if (includedIds.length) url.searchParams.set("with_genres", includedIds.join("|"));
  const excludedGenres = tmdbExcludedGenreIds(options.filters);
  if (excludedGenres.length > 0) url.searchParams.set("without_genres", excludedGenres.join(","));
  setTmdbKeywordExclusions(url, options.filters);

  const headers = applyTmdbAuth(url, apiKey);
  const payload = await fetchJson<TmdbPage<TmdbMovieItem>>(url.toString(), { headers }, 5_000, options.deadlineMs);
  const items = (payload.results ?? [])
    .map((item, index) => normalizeTmdbMovie(item, request, index, discovery.countries))
    .filter((item): item is CatalogRecommendationCandidate => Boolean(item))
    .filter((item) => matchesDiscoveryFilters(item, discovery));
  const totalPages = Math.min(TMDB_MAX_PAGE, Math.max(0, payload.total_pages ?? 0));
  return { items, hasMore: request.page < totalPages };
}

async function fetchAniListMonth(
  request: RecommendationProviderRequest,
  options: RecommendationProviderOptions
): Promise<RecommendationProviderPage<CatalogRecommendationCandidate>> {
  const bounds = getMonthBounds(request.month, request.asOfDate);
  const endpoint = Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co";
  const excluded = aniListExcludedFilters(options.filters);
  const discovery = normalizeDiscoveryFilters(options.discoveryFilters);
  const selectedGenres = eligibleDiscoveryGenres(discovery.genres, options.filters);
  const genreLanes = selectedGenres.includes("animation") ? [] : [...new Set(selectedGenres.map(aniListIncludedGenre).filter((genre): genre is string => typeof genre === "string"))];
  const optionalVariables = {
    ...(excluded.genres.length ? { excludedGenres: excluded.genres } : {}),
    ...(excluded.tags.length ? { excludedTags: excluded.tags } : {}),
    ...(genreLanes.length === 1 ? { includedGenre: genreLanes[0] } : {}),
    ...(discovery.countries.length === 1 ? { country: discovery.countries[0] } : {}),
    ...(discovery.countries.length > 1 ? { countries: discovery.countries } : {})
  };
  const [payload, koreanAnimeItems] = await Promise.all([
    fetchJson<{ data?: Record<string, NonNullable<AniListPage["data"]>["Page"]>; errors?: { message?: string }[] }>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: buildAniListMonthQuery(genreLanes, optionalVariables),
        variables: {
          page: request.page,
          perPage: Math.max(1, Math.floor(ANILIST_PAGE_SIZE / Math.max(1, genreLanes.length))),
          startDateGreater: toAniListDate(previousDate(bounds.startDate)),
          startDateLesser: toAniListDate(nextDate(bounds.endDate)),
          ...optionalVariables
        }
      })
    }, 5_000, options.deadlineMs),
    getCachedKoreanAnimeItems(request, options.cache, options.deadlineMs, discovery.countries.length ? discovery.countries.join("|") : "JP")
  ]);
  if (payload.errors?.length) throw new Error(payload.errors[0]?.message ?? "AniList GraphQL request failed");
  const pages = Object.values(payload.data ?? {}).filter((page) => page !== undefined && page !== null);
  const page = { media: pages.flatMap((entry) => entry.media ?? []), pageInfo: { hasNextPage: pages.some((entry) => entry.pageInfo?.hasNextPage) } };
  const items = (page?.media ?? [])
    .map((item, index) =>
      normalizeAniListAnime(
        item,
        request,
        index,
        findTmdbKoreanAnimeLocalization(item, koreanAnimeItems)
      )
    )
    .filter((item): item is CatalogRecommendationCandidate => Boolean(item))
    .filter((item) => matchesDiscoveryFilters(item, discovery));
  return { items, hasMore: Boolean(page?.pageInfo?.hasNextPage) };
}

function buildAniListMonthQuery(genres: readonly string[], optionalVariables: Record<string, unknown>): string {
  let query = genres.length > 1 ? buildAniListGenreUnionQuery(genres) : ANILIST_MONTH_QUERY;
  // AniList's nullable schema does not imply null-safe resolvers: explicitly
  // passing countryOfOrigin_in: null returns HTTP 500. Omit absent arguments and
  // their declarations, including every aliased Page in a genre union.
  for (const [variable, type, argument] of [
    ["excludedGenres", "[String]", "genre_not_in"],
    ["excludedTags", "[String]", "tag_not_in"],
    ["includedGenre", "String", "genre"],
    ["country", "CountryCode", "countryOfOrigin"],
    ["countries", "[CountryCode]", "countryOfOrigin_in"]
  ] as const) {
    if (Object.hasOwn(optionalVariables, variable)) continue;
    query = query
      .replace(`    $${variable}: ${type}\n`, "")
      .replaceAll(`        ${argument}: $${variable}\n`, "");
  }
  return query;
}

/** One HTTP request and at most 50 candidates in total, with true OR semantics. */
function buildAniListGenreUnionQuery(genres: readonly string[]): string {
  const bodyStart = ANILIST_MONTH_QUERY.indexOf("    Page(");
  const header = ANILIST_MONTH_QUERY.slice(0, bodyStart).replace("    $includedGenre: String\n", "");
  const pageBody = ANILIST_MONTH_QUERY.slice(bodyStart, ANILIST_MONTH_QUERY.lastIndexOf("\n  }"));
  return header + genres.map((genre, index) => pageBody
    .replace("    Page(", `    genre${index}: Page(`)
    .replace("genre: $includedGenre", `genre: ${JSON.stringify(genre)}`)).join("\n") + "\n  }\n";
}

interface PersistedAnimeLocalization {
  items: TmdbTvItem[] | null;
  expiresAt: number;
}

async function getCachedKoreanAnimeItems(
  request: RecommendationProviderRequest,
  cache?: RecommendationCache,
  deadlineMs?: number,
  country = "JP"
): Promise<TmdbTvItem[]> {
  // Localization is shared raw metadata; no user's exclusions are applied here.
  const key = `${LOCALIZATION_CACHE_VERSION}:${request.month}:${request.asOfDate}${country === "JP" ? "" : `:${country}`}`;
  const now = Date.now();
  const cached = animeLocalizationCache.get(key);
  if (cached && cached.expiresAt > now) return withinDeadline(() => cached.promise, deadlineMs);

  const promise = (async () => {
    const persisted = await readPersisted<PersistedAnimeLocalization>(cache, key, "tmdb", deadlineMs);
    if (persisted && persisted.expiresAt > Date.now()) {
      if (!persisted.items) throw new Error("RECOMMENDATION_LOCALIZATION_RECENTLY_UNAVAILABLE");
      if (Array.isArray(persisted.items)) {
        const entry = animeLocalizationCache.get(key);
        if (entry) entry.expiresAt = persisted.expiresAt;
        return persisted.items;
      }
    }
    try {
      const items = await fetchTmdbKoreanAnimeMonth(request, deadlineMs, country);
      await writePersisted(cache, key, "tmdb", {
        items, expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS
      }, PROVIDER_CACHE_TTL_MS, deadlineMs);
      return items;
    } catch (error) {
      if (isDeadlineError(error)) throw error;
      await writePersisted(cache, key, "tmdb", {
        items: null, expiresAt: Date.now() + PROVIDER_FAILURE_TTL_MS
      }, PROVIDER_FAILURE_TTL_MS, deadlineMs);
      throw error;
    }
  })();
  animeLocalizationCache.set(key, { expiresAt: now + PROVIDER_CACHE_TTL_MS, promise });
  try {
    return await promise;
  } catch (error) {
    const entry = animeLocalizationCache.get(key);
    if (isDeadlineError(error)) animeLocalizationCache.delete(key);
    else if (entry) entry.expiresAt = Date.now() + PROVIDER_FAILURE_TTL_MS;
    throw error;
  }
}

async function fetchTmdbKoreanAnimeMonth(request: RecommendationProviderRequest, deadlineMs?: number, country = "JP"): Promise<TmdbTvItem[]> {
  const apiKey = requireTmdbApiKey();
  const bounds = getMonthBounds(request.month, request.asOfDate);
  const fetchPage = (page: number) => {
      const url = new URL("https://api.themoviedb.org/3/discover/tv");
      setCommonTmdbParams(url, page);
      url.searchParams.set("first_air_date.gte", bounds.startDate);
      url.searchParams.set("first_air_date.lte", bounds.endDate);
      url.searchParams.set("include_null_first_air_dates", "false");
      url.searchParams.set("sort_by", "popularity.desc");
      // 국내 OTT 제공 애니만 한국어 현지화 매칭 대상이 된다. 매칭되지 않은 AniList 후보는 normalizeAniListAnime에서 제외된다 (docs/33 D-3).
      applyKrOttDiscoverFilter(url);
      url.searchParams.set("with_origin_country", country);
      url.searchParams.set("with_genres", "16");
      const headers = applyTmdbAuth(url, apiKey);
      return fetchJson<TmdbPage<TmdbTvItem>>(url.toString(), { headers }, 5_000, deadlineMs);
  };
  const firstPage = await fetchPage(1);
  const pageCount = Math.min(TMDB_ANIME_LOCALIZATION_PAGES, Math.max(1, firstPage.total_pages ?? 1));
  const laterPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => fetchPage(index + 2))
  );
  return [firstPage, ...laterPages].flatMap((page) => page.results ?? []);
}

function normalizeTmdbDrama(
  item: TmdbTvItem,
  request: RecommendationProviderRequest,
  index: number,
  allowInternational = false,
  selectedGenre = false
): CatalogRecommendationCandidate | null {
  if (!item.id || !item.name?.trim() || item.genre_ids?.includes(16) || (!selectedGenre && !item.genre_ids?.includes(18))) return null;
  const contentType = inferTmdbTvContentType({
    originCountry: item.origin_country ?? null,
    genreIds: item.genre_ids
  });
  if (contentType !== "kdrama" && contentType !== "jdrama" && !(allowInternational && contentType === "other")) return null;
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
  index: number,
  countries: readonly string[] = []
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
    // TMDB movie discovery omits country metadata. A single-country query is
    // reliable inclusion evidence; language alone is never used as nationality.
    countries: countries.length === 1 ? [...countries] : [],
    ...(countries.length > 1 ? { matched_countries: [...countries] } : {}),
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
    // Even low-ranked provider tags are decisive for a user's hard exclusions.
    .filter((tag) => !tag.isGeneralSpoiler && !tag.isMediaSpoiler)
    .map((tag) => ({ name: tag.name?.trim() ?? "", source: "anilist", rank: tag.rank ?? null }))
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

function setTmdbKeywordExclusions(url: URL, filters?: UserRecommendationFilters): void {
  const keywords = tmdbExcludedKeywordIds(filters);
  if (keywords.length > 0) url.searchParams.set("without_keywords", keywords.join(","));
}

const discoveryKeywordCache = new Map<string, { expiresAt: number; promise: Promise<number | null> }>();

/** Resolve provider-owned IDs once instead of guessing keyword IDs or fetching every title's details. */
export async function resolveTmdbDiscoveryGenreKeyword(
  genre: string,
  cache?: RecommendationCache,
  deadlineMs?: number
): Promise<number | null> {
  if (!TMDB_TV_KEYWORD_GENRES.has(genre)) return null;
  const key = `discovery-genre-keyword-v1:${genre}`;
  const existing = discoveryKeywordCache.get(key);
  if (existing && existing.expiresAt > Date.now()) return withinDeadline(() => existing.promise, deadlineMs);
  const promise = (async () => {
    const stored = await readPersisted<{ id: number | null; expiresAt: number; failed?: boolean }>(cache, key, "tmdb", deadlineMs);
    if (stored && stored.expiresAt > Date.now()) {
      const entry = discoveryKeywordCache.get(key);
      if (entry) entry.expiresAt = stored.expiresAt;
      if (stored.failed) throw new Error("DISCOVERY_KEYWORD_RECENTLY_UNAVAILABLE");
      return stored.id;
    }
    const url = new URL("https://api.themoviedb.org/3/search/keyword");
    url.searchParams.set("query", genre);
    url.searchParams.set("page", "1");
    const headers = applyTmdbAuth(url, requireTmdbApiKey());
    const payload = await fetchJson<{ results?: { id?: number; name?: string }[] }>(
      url.toString(), { headers }, 2_500, deadlineMs
    );
    const id = payload.results?.find((item) => item.name?.trim().toLowerCase() === genre && Number.isInteger(item.id) && (item.id ?? 0) > 0)?.id ?? null;
    const ttl = id === null ? PROVIDER_FAILURE_TTL_MS : TMDB_KEYWORD_CACHE_TTL_MS;
    const expiresAt = Date.now() + ttl;
    const entry = discoveryKeywordCache.get(key);
    if (entry) entry.expiresAt = expiresAt;
    await writePersisted(cache, key, "tmdb", { id, expiresAt }, ttl, deadlineMs);
    return id;
  })();
  discoveryKeywordCache.set(key, { expiresAt: Date.now() + TMDB_KEYWORD_CACHE_TTL_MS, promise });
  try { return await promise; }
  catch (error) {
    if (isDeadlineError(error)) discoveryKeywordCache.delete(key);
    else {
      const entry = discoveryKeywordCache.get(key);
      const expiresAt = Date.now() + PROVIDER_FAILURE_TTL_MS;
      if (entry) entry.expiresAt = Math.min(entry.expiresAt, expiresAt);
      if (!(error instanceof Error && error.message === "DISCOVERY_KEYWORD_RECENTLY_UNAVAILABLE")) {
        await writePersisted(cache, key, "tmdb", { id: null, failed: true, expiresAt }, PROVIDER_FAILURE_TTL_MS, deadlineMs);
      }
    }
    throw error;
  }
}

async function readPersisted<T>(
  cache: RecommendationCache | undefined,
  key: string,
  source: "tmdb" | "anilist",
  deadlineMs?: number
): Promise<T | null> {
  if (!cache) return null;
  try {
    return await withinDeadline(() => cache.get<T>(key, source), deadlineMs);
  } catch (error) {
    if (!isDeadlineError(error)) console.warn("Recommendation provider cache read failed");
    return null;
  }
}

async function writePersisted<T>(
  cache: RecommendationCache | undefined,
  key: string,
  source: "tmdb" | "anilist",
  value: T,
  ttlMs: number,
  deadlineMs?: number
): Promise<void> {
  if (!cache) return;
  try {
    await withinDeadline(() => cache.set(key, source, value, ttlMs), deadlineMs);
  } catch (error) {
    if (!isDeadlineError(error)) console.warn("Recommendation provider cache write failed");
  }
}

export async function fetchKrWatchRegion(
  kind: "tv" | "movie",
  tmdbId: string,
  options: { cache?: RecommendationCache; deadlineMs?: number } = {}
): Promise<TmdbWatchProviderRegion | null> {
  const key = `${KR_WATCH_CACHE_VERSION}:${kind}:${tmdbId}`;
  const cached = await readPersisted<{ region: TmdbWatchProviderRegion | null }>(options.cache, key, "tmdb", options.deadlineMs);
  if (cached && typeof cached === "object" && "region" in cached) return cached.region ?? null;
  const apiKey = requireTmdbApiKey();
  const url = new URL(`https://api.themoviedb.org/3/${kind}/${tmdbId}/watch/providers`);
  const headers = applyTmdbAuth(url, apiKey);
  const payload = await fetchJson<{ results?: Record<string, TmdbWatchProviderRegion | undefined> }>(url.toString(), { headers }, 2_000, options.deadlineMs);
  const region = payload.results?.KR ?? null;
  await writePersisted(options.cache, key, "tmdb", { region }, KR_WATCH_CACHE_TTL_MS, options.deadlineMs);
  return region;
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

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 5_000, deadlineMs?: number): Promise<T> {
  const remainingMs = remainingTime(deadlineMs);
  if (remainingMs <= 0) throw deadlineError();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(timeoutMs, remainingMs));
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } catch (error) {
    if (remainingTime(deadlineMs) <= 0) throw deadlineError();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function remainingTime(deadlineMs?: number): number {
  return deadlineMs === undefined ? Number.POSITIVE_INFINITY : Math.max(0, deadlineMs - Date.now());
}

function deadlineError(): Error {
  return new Error("RECOMMENDATION_PROVIDER_DEADLINE");
}

function isDeadlineError(error: unknown): boolean {
  return error instanceof Error && error.message === "RECOMMENDATION_PROVIDER_DEADLINE";
}

async function withinDeadline<T>(task: () => Promise<T>, deadlineMs?: number): Promise<T> {
  const remainingMs = remainingTime(deadlineMs);
  if (remainingMs <= 0) throw deadlineError();
  if (!Number.isFinite(remainingMs)) return task();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(deadlineError()), remainingMs);
      })
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
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
  return Array.from(new Set((ids ?? []).map((id) => TMDB_RECOMMENDATION_GENRES.get(id)).filter((name): name is string => Boolean(name))));
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

function sumPositiveAmounts(values: { amount?: number | null }[] | null | undefined): number | null {
  const total = (values ?? []).reduce((sum, value) => sum + Math.max(0, finiteOr(value.amount, 0)), 0);
  return total > 0 ? total : null;
}

/** Period-independent discovery for the supplemental taste lane. */
export function buildTasteFillDiscoverUrl(query: TasteFillQuery, page: number, filters?: UserRecommendationFilters, discoveryFilters?: DiscoveryFilterInput): URL {
  const url = new URL(`https://api.themoviedb.org/3/discover/${query.kind}`);
  setCommonTmdbParams(url, page);
  applyKrOttDiscoverFilter(url);
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("vote_count.gte", "50");
  const year = normalizeDiscoveryFilters(discoveryFilters).year;
  if (year !== undefined) {
    const date = query.kind === "tv" ? "first_air_date" : "primary_release_date";
    url.searchParams.set(`${date}.gte`, `${year}-01-01`);
    url.searchParams.set(`${date}.lte`, `${year}-12-31`);
  }
  setTmdbKeywordExclusions(url, filters);
  const genres = [...new Set(query.genres.map(genre => tmdbIncludedGenreId(genre, query.kind)).filter((id): id is number => typeof id === "number"))];
  let excluded = tmdbExcludedGenreIds(filters);
  if (query.group === "anime") {
    const firstGenre = tmdbIncludedGenreId(query.genres[0], "tv");
    url.searchParams.set("with_genres", [16, ...(typeof firstGenre === "number" ? [firstGenre] : [])].join(","));
    url.searchParams.set("with_origin_country", "JP");
  } else {
    if (query.kind === "tv") {
      url.searchParams.set("with_genres", (genres.length ? genres : [18]).join("|"));
      // 예능(Reality 10764·Talk 10767)도 코미디 장르를 달고 있어 드라마 취향 레인에서 뺀다.
      excluded = [...new Set([16, 10764, 10767, ...excluded])];
    } else if (genres.length) url.searchParams.set("with_genres", genres.join("|"));
    if (query.countries.length) url.searchParams.set("with_origin_country", query.countries.join("|"));
  }
  if (excluded.length) url.searchParams.set("without_genres", excluded.join(","));
  return url;
}

export async function fetchTasteFillPage(
  query: TasteFillQuery,
  page: number,
  options: RecommendationProviderOptions & { asOfDate: string }
): Promise<{ items: CatalogRecommendationCandidate[]; hasMore: boolean }> {
  const key = `taste-fill-v2:${query.key}:${page}:${recommendationProviderFilterKey(options.filters)}:${discoveryFilterKey(options.discoveryFilters)}`;
  const cached = await readPersisted<{ items: CatalogRecommendationCandidate[]; hasMore: boolean }>(options.cache, key, "tmdb", options.deadlineMs);
  if (cached) return cached;
  const url = buildTasteFillDiscoverUrl(query, page, options.filters, options.discoveryFilters);
  const headers = applyTmdbAuth(url, requireTmdbApiKey());
  const payload = await fetchJson<TmdbPage<TmdbTvItem & TmdbMovieItem>>(url.toString(), { headers }, 5_000, options.deadlineMs);
  const request: RecommendationProviderRequest = {
    provider: query.kind === "movie" ? "tmdb_movie" : "tmdb_kr",
    month: options.asOfDate.slice(0, 7), page, asOfDate: options.asOfDate
  };
  const items = (payload.results ?? []).map((item, index) => {
    const candidate = query.kind === "movie" ? normalizeTmdbMovie(item, request, index, query.countries)
      : query.group === "anime" ? normalizeTasteFillAnime(item, request, index)
      : normalizeTmdbDrama(item, request, index, query.group === "drama", query.genres.length > 0);
    return candidate ? { ...candidate, trend_source: TASTE_FILL_TREND_SOURCE } : null;
  }).filter((candidate): candidate is CatalogRecommendationCandidate => candidate !== null);
  const result = { items, hasMore: page < Math.min(500, payload.total_pages ?? 0) };
  await writePersisted(options.cache, key, "tmdb", result, 24 * 60 * 60_000, options.deadlineMs);
  return result;
}

function normalizeTasteFillAnime(
  item: TmdbTvItem,
  request: RecommendationProviderRequest,
  index: number
): CatalogRecommendationCandidate | null {
  if (!item.id || !item.name?.trim() || inferTmdbTvContentType({ originCountry: item.origin_country, genreIds: item.genre_ids }) !== "anime") return null;
  const providerRank = (request.page - 1) * TMDB_PAGE_SIZE + index + 1;
  return {
    external_source: "tmdb",
    external_id: String(item.id),
    content_type: "anime",
    title_primary: item.name.trim(),
    title_original: item.original_name?.trim() || null,
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    overview: cleanText(item.overview),
    air_year: yearFromDate(item.first_air_date),
    air_date: dateOnly(item.first_air_date),
    has_seasons: true,
    episode_count: null,
    genres: genreNamesFromIds(item.genre_ids),
    category: "anime",
    rank: providerRank,
    trend_source: TASTE_FILL_TREND_SOURCE,
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
