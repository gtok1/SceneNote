import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { searchAniList } from "./adapters/anilist.ts";
import { searchKitsu } from "./adapters/kitsu.ts";
import {
  compactResults,
  createSearchQueryVariants,
  filterResultsByCompactQuery
} from "./adapters/normalize.ts";
import { discoverTmdb, filterSearchResultsByDiscovery, searchTmdb } from "./adapters/tmdb.ts";
import { searchTvmaze } from "./adapters/tvmaze.ts";
import type {
  AdapterSearchResponse,
  ExternalSource,
  MediaTypeFilter,
  SearchResult
} from "./adapters/types.ts";
import type { SearchQueryVariant as QueryVariant } from "./adapters/normalize.ts";
import { normalizeSearchCachePayload } from "../_shared/searchCacheMetadata.ts";
import { discoveryFilterKey, normalizeDiscoveryFilters, type DiscoveryFilterInput, type DiscoveryFilters } from "../_shared/discoveryFilters.ts";
import { createPersistentRecommendationCache } from "../_shared/recommendationCache.ts";

interface SearchRequest extends DiscoveryFilterInput {
  query?: string;
  media_type?: MediaTypeFilter;
  category?: MediaTypeFilter;
  page?: number;
  /** ISO 3166-1 alpha-2. With no query this switches the request into browse mode. */
  country?: string;
  genre?: string;
}

interface SearchResponse {
  results: SearchResult[];
  sources: ExternalSource[];
  failedSources: ExternalSource[];
  cached: boolean;
  query: string;
  normalizedQuery: string;
  total: number;
  page: number;
  hasNextPage: boolean;
  partial: boolean;
  country_filter_limited?: boolean;
  genre_filter_limited?: boolean;
}

interface SearchJob {
  source: ExternalSource;
  variant: QueryVariant;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const SEARCH_CACHE_VERSION = "ko-v13-season-expansion";

Deno.serve(async (req: Request) => {
  const requestDeadline = Date.now() + 8_500;
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError(500, "SERVER_MISCONFIGURED", "Supabase function secrets are missing");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const jwt = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const {
    data: { user },
    error: authError
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const body = await parseJson<SearchRequest>(req);
  if (!body.ok) return jsonError(400, "INVALID_REQUEST", body.message);

  const query = body.value.query?.trim() ?? "";
  let mediaType = body.value.media_type ?? body.value.category ?? "all";
  const page = Math.max(1, Math.floor(body.value.page ?? 1));

  if (body.value.country !== undefined && (typeof body.value.country !== "string" ||
      (body.value.country.trim().toLowerCase() !== "all" && normalizeCountry(body.value.country) === null))) {
    return jsonError(400, "INVALID_REQUEST", "country must be an ISO 3166-1 alpha-2 code");
  }
  if (body.value.genre !== undefined && (typeof body.value.genre !== "string" || body.value.genre.length > 60)) {
    return jsonError(400, "INVALID_REQUEST", "genre must be a string up to 60 characters");
  }
  for (const [name, values, max] of [
    ["genres", body.value.genres, 30], ["countries", body.value.countries, 10], ["mediaTypes", body.value.mediaTypes, 3]
  ] as const) {
    if (values !== undefined && (!Array.isArray(values) || values.length > max || values.some((value) =>
      typeof value !== "string" || value.length > 60 ||
      (name === "countries" && !normalizeCountry(value)) ||
      (name === "mediaTypes" && !["anime", "drama", "movie"].includes(value))))) {
      return jsonError(400, "INVALID_REQUEST", `invalid ${name}`);
    }
  }
  const filters = normalizeDiscoveryFilters(body.value);
  if (body.value.mediaTypes !== undefined) mediaType = filters.mediaTypes.length === 1 ? filters.mediaTypes[0]! : "all";
  const country = filters.countries.join("|");

  // Legacy browse endpoint; the app uses personalized recommendations when blank.
  const isBrowse = query.length === 0 && filters.countries.length > 0;

  if (!isBrowse && (query.length < 1 || query.length > 100)) {
    return jsonError(400, "INVALID_REQUEST", "query must be between 1 and 100 characters");
  }

  if (!["all", "anime", "drama", "movie"].includes(mediaType)) {
    return jsonError(400, "INVALID_REQUEST", "invalid media_type");
  }

  if (isBrowse && country) {
    return await respondWithCountryBrowse(adminClient, country, mediaType, page, filters, requestDeadline, req.signal);
  }

  const normalizedQuery = query.replace(/\s+/g, " ").trim();
  const queryVariants = createSearchQueryVariants(normalizedQuery);
  const targetSources = getTargetSources(mediaType).filter((source) => filters.mediaTypes.length === 0 ||
    source === "tmdb" || ((source === "anilist" || source === "kitsu") && filters.mediaTypes.includes("anime")) ||
    (source === "tvmaze" && filters.mediaTypes.includes("drama")));
  const cachedResults: SearchResult[] = [];
  const cachedTotals: number[] = [];
  const cachedHasNextPages: boolean[] = [];
  const sourcesFromCache: ExternalSource[] = [];
  const missedSearches: SearchJob[] = [];

  for (const source of targetSources) {
    for (const queryVariant of queryVariants) {
      const queryHash = await createQueryHash(queryVariant, mediaType, page, source);
      const { data: cacheRow } = await adminClient
        .from("external_search_cache")
        .select("response_json")
        .eq("query_hash", queryHash)
        .eq("source", source)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cacheRow?.response_json) {
        const cached = normalizeSearchCachePayload(cacheRow.response_json as {
          results?: SearchResult[];
          total?: number;
          hasNextPage?: boolean;
        });
        cachedResults.push(...cached.results);
        cachedTotals.push(cached.total);
        cachedHasNextPages.push(cached.hasNextPage);
        sourcesFromCache.push(source);
      } else {
        missedSearches.push({ source, variant: queryVariant });
      }
    }
  }

  const freshResponses: AdapterSearchResponse[] = [];
  const failedSourceCandidates: ExternalSource[] = [];

  if (missedSearches.length > 0) {
    const calls = missedSearches.map((job) => callAdapter(job.source, job.variant.query, mediaType, page));
    const settled = await Promise.allSettled(calls);

    for (const [index, result] of settled.entries()) {
      const searchJob = missedSearches[index];
      if (!searchJob) continue;

      if (result.status === "rejected") {
        const source = parseSourceFromError(result.reason);
        if (source) failedSourceCandidates.push(source);
        continue;
      }

      const response = filterResponseForVariant(result.value, searchJob.variant);
      freshResponses.push(response);
      const queryHash = await createQueryHash(searchJob.variant, mediaType, page, response.source);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await adminClient.from("external_search_cache").upsert(
        {
          query_hash: queryHash,
          query_text: searchJob.variant.query,
          source: response.source,
          response_json: {
            results: response.results,
            total: response.total,
            hasNextPage: response.hasNextPage
          },
          expires_at: expiresAt
        },
        { onConflict: "query_hash,source" }
      );
    }
  }

  const freshResults = freshResponses.flatMap((response) => response.results);
  const unfilteredResults = compactResults([...cachedResults, ...freshResults]);
  // Keep the provider page cache independent of the viewer's selected filters.
  // Only the small, reusable production-country evidence is cached separately.
  const countryCache = createSearchMetadataCache(adminClient, requestDeadline);
  const filtered = await filterSearchResultsByDiscovery(unfilteredResults, filters, {
    cache: countryCache, deadlineMs: requestDeadline, signal: req.signal
  });
  const results = filtered.results;
  const successfulSources = [
    ...sourcesFromCache,
    ...freshResponses.map((response) => response.source)
  ] as ExternalSource[];
  const failedSources = failedSourceCandidates.filter((source) => !successfulSources.includes(source));

  if (results.length === 0 && successfulSources.length === 0 && failedSources.length > 0) {
    return jsonError(503, "ALL_APIS_FAILED", "All external APIs failed");
  }

  const response: SearchResponse = {
    results,
    sources: [...new Set(successfulSources)],
    failedSources: [...new Set(failedSources)],
    cached: missedSearches.length === 0,
    query,
    normalizedQuery,
    total: Math.max(results.length, ...cachedTotals, ...freshResponses.map((item) => item.total ?? item.results.length)),
    page,
    hasNextPage: cachedHasNextPages.some(Boolean) || freshResponses.some((item) => item.hasNextPage),
    partial: failedSources.length > 0 || filtered.countryFilterLimited || filtered.genreFilterLimited,
    country_filter_limited: filtered.countryFilterLimited,
    genre_filter_limited: filtered.genreFilterLimited
  };

  return json(response);
});

function createSearchMetadataCache(adminClient: SupabaseClient, requestDeadline: number) {
  return createPersistentRecommendationCache({
    async read(key, source) {
      const { data, error } = await adminClient.from("external_search_cache")
        .select("response_json,expires_at").eq("query_hash", key).eq("source", source)
        .gt("expires_at", new Date().toISOString()).maybeSingle();
      if (error) throw error;
      return data ? { value: data.response_json, expiresAt: data.expires_at } : null;
    },
    async write(key, source, value, expiresAt) {
      const { error } = await adminClient.from("external_search_cache").upsert({
        query_hash: key, query_text: key, source, response_json: value, expires_at: expiresAt
      }, { onConflict: "query_hash,source" });
      if (error) throw error;
    }
  }, Date.now, 500, requestDeadline);
}

async function callAdapter(
  source: ExternalSource,
  query: string,
  mediaType: MediaTypeFilter,
  page: number
): Promise<AdapterSearchResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const params = { query, mediaType, page, signal: controller.signal };

  try {
    switch (source) {
      case "tmdb":
        return await searchTmdb(params);
      case "anilist":
        return await searchAniList(params);
      case "kitsu":
        return await searchKitsu(params);
      case "tvmaze":
        return await searchTvmaze(params);
      default:
        throw new Error(`${source}: unsupported source`);
    }
  } catch (error) {
    throw new Error(`${source}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

function getTargetSources(mediaType: MediaTypeFilter): ExternalSource[] {
  const includePhase2Sources = Deno.env.get("ENABLE_PHASE2_SEARCH_SOURCES") === "true";

  switch (mediaType) {
    case "anime":
      return includePhase2Sources ? ["anilist", "tmdb", "kitsu"] : ["anilist", "tmdb"];
    case "drama":
      return includePhase2Sources ? ["tmdb", "tvmaze"] : ["tmdb"];
    case "movie":
      return ["tmdb"];
    case "all":
    default:
      return includePhase2Sources ? ["tmdb", "anilist", "kitsu", "tvmaze"] : ["tmdb", "anilist"];
  }
}

function normalizeCountry(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
}

async function createCountryBrowseHash(
  country: string,
  mediaType: MediaTypeFilter,
  page: number,
  signature = "[[],[],[]]"
): Promise<string> {
  const encoded = new TextEncoder().encode(
    `${SEARCH_CACHE_VERSION}:browse:tmdb:${mediaType}:${page}:${country}:${signature}`
  );
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function respondWithCountryBrowse(
  adminClient: SupabaseClient,
  country: string,
  mediaType: MediaTypeFilter,
  page: number,
  filters: DiscoveryFilters,
  requestDeadline: number,
  signal: AbortSignal
): Promise<Response> {
  const queryHash = await createCountryBrowseHash(country, mediaType, page, discoveryFilterKey(filters));
  const { data: cacheRow } = await adminClient
    .from("external_search_cache")
    .select("response_json")
    .eq("query_hash", queryHash)
    .eq("source", "tmdb")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  const cached = cacheRow ? normalizeSearchCachePayload<SearchResult>(cacheRow.response_json) : null;
  const metadataOptions = { cache: createSearchMetadataCache(adminClient, requestDeadline), deadlineMs: requestDeadline, signal };
  if (cached) {
    const filtered = await filterSearchResultsByDiscovery(compactResults(cached.results), filters, metadataOptions);
    return browseResponse(filtered.results, country, page, cached.total, cached.hasNextPage, true, [], filtered);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await discoverTmdb({ ...filters, mediaType, page, signal: controller.signal });
    await adminClient.from("external_search_cache").upsert(
      {
        query_hash: queryHash,
        query_text: `browse:${country}`,
        source: "tmdb",
        response_json: {
          results: response.results,
          total: response.total,
          hasNextPage: response.hasNextPage
        },
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      },
      { onConflict: "query_hash,source" }
    );

    const filtered = await filterSearchResultsByDiscovery(compactResults(response.results), filters, metadataOptions);
    return browseResponse(
      filtered.results,
      country,
      page,
      response.total ?? response.results.length,
      Boolean(response.hasNextPage),
      false,
      [],
      filtered
    );
  } catch (error) {
    console.error("country browse failed:", error);
    return browseResponse([], country, page, 0, false, false, ["tmdb"]);
  } finally {
    clearTimeout(timeout);
  }
}

function browseResponse(
  results: SearchResult[],
  country: string,
  page: number,
  total: number,
  hasNextPage: boolean,
  cached: boolean,
  failedSources: ExternalSource[],
  limited?: { countryFilterLimited: boolean; genreFilterLimited: boolean }
): Response {
  const payload: SearchResponse = {
    results,
    sources: failedSources.length > 0 ? [] : ["tmdb"],
    failedSources,
    cached,
    query: "",
    normalizedQuery: `browse:${country}`,
    total,
    page,
    hasNextPage,
    partial: failedSources.length > 0 || Boolean(limited?.countryFilterLimited || limited?.genreFilterLimited),
    country_filter_limited: Boolean(limited?.countryFilterLimited),
    genre_filter_limited: Boolean(limited?.genreFilterLimited)
  };

  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function createQueryHash(
  variant: QueryVariant,
  mediaType: MediaTypeFilter,
  page: number,
  source: ExternalSource
): Promise<string> {
  const cacheScope =
    variant.matchMode === "compact-title"
      ? `${variant.matchMode}:${variant.compactQuery}`
      : variant.matchMode;
  const encoded = new TextEncoder().encode(
    `${SEARCH_CACHE_VERSION}:${source}:${mediaType}:${page}:${cacheScope}:${variant.query.toLowerCase()}`
  );
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function filterResponseForVariant(
  response: AdapterSearchResponse,
  variant: QueryVariant
): AdapterSearchResponse {
  if (variant.matchMode !== "compact-title") return response;

  const results = filterResultsByCompactQuery(response.results, variant.compactQuery);
  return {
    ...response,
    results,
    total: results.length
  };
}

function parseSourceFromError(reason: unknown): ExternalSource | null {
  const message = reason instanceof Error ? reason.message : String(reason);
  const [source] = message.split(":");
  return ["tmdb", "anilist", "kitsu", "tvmaze"].includes(source) ? (source as ExternalSource) : null;
}

async function parseJson<T>(req: Request): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  try {
    return { ok: true, value: (await req.json()) as T };
  } catch {
    return { ok: false, message: "Invalid JSON body" };
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return json({ error: code, message }, status);
}
