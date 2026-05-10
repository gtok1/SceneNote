import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { searchAniList } from "./adapters/anilist.ts";
import { searchKitsu } from "./adapters/kitsu.ts";
import {
  compactResults,
  createSearchQueryVariants,
  filterResultsByCompactQuery
} from "./adapters/normalize.ts";
import { searchTmdb } from "./adapters/tmdb.ts";
import { searchTvmaze } from "./adapters/tvmaze.ts";
import type {
  AdapterSearchResponse,
  ExternalSource,
  MediaTypeFilter,
  SearchResult
} from "./adapters/types.ts";
import type { SearchQueryVariant as QueryVariant } from "./adapters/normalize.ts";

interface SearchRequest {
  query?: string;
  media_type?: MediaTypeFilter;
  category?: MediaTypeFilter;
  page?: number;
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
const SEARCH_CACHE_VERSION = "ko-v5-space-insensitive";

Deno.serve(async (req: Request) => {
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
  const mediaType = body.value.media_type ?? body.value.category ?? "all";
  const page = Math.max(1, Math.floor(body.value.page ?? 1));

  if (query.length < 1 || query.length > 100) {
    return jsonError(400, "INVALID_REQUEST", "query must be between 1 and 100 characters");
  }

  if (!["all", "anime", "drama", "movie"].includes(mediaType)) {
    return jsonError(400, "INVALID_REQUEST", "invalid media_type");
  }

  const normalizedQuery = query.replace(/\s+/g, " ").trim();
  const queryVariants = createSearchQueryVariants(normalizedQuery);
  const targetSources = getTargetSources(mediaType);
  const cachedResults: SearchResult[] = [];
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
        const cached = cacheRow.response_json as { results?: SearchResult[] };
        cachedResults.push(...(cached.results ?? []));
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
          response_json: { results: response.results },
          expires_at: expiresAt
        },
        { onConflict: "query_hash,source" }
      );
    }
  }

  const freshResults = freshResponses.flatMap((response) => response.results);
  const results = compactResults([...cachedResults, ...freshResults]);
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
    total: results.length,
    page,
    hasNextPage: freshResponses.some((item) => item.hasNextPage),
    partial: failedSources.length > 0
  };

  return json(response);
});

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
