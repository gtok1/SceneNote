import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import type { ExternalSource } from "../_shared/types.ts";
import {
  listOtherAvailableRegions,
  mapKrWatchProvidersByCategory,
  lookupAniListWatchProviders,
  type TmdbSeasonSummary,
  type TmdbTvSearchItem,
  type TmdbWatchProviderRegion
} from "../_shared/watchProviders.ts";

interface WatchProviderRequest {
  api_source?: ExternalSource;
  external_source?: ExternalSource;
  external_id?: string;
  media_type?: "movie" | "tv" | string;
  title?: string | null;
  original_title?: string | null;
  air_year?: number | null;
  watch_region?: string;
}

interface TmdbWatchProvidersResponse {
  id: number;
  results?: Record<string, TmdbWatchProviderRegion | undefined>;
}

const TMDB_LANGUAGE = "ko-KR";
const WATCH_REGION = "KR";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");

  try {
    await requireUser(req);
  } catch {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const body = await parseJson<WatchProviderRequest>(req);
  if (!body.ok) return jsonError(400, "INVALID_REQUEST", body.message);

  const source = body.value.api_source ?? body.value.external_source;
  const externalId = body.value.external_id?.trim();
  let mediaType = body.value.media_type === "movie" ? "movie" : "tv";
  const title = body.value.title?.trim() || null;

  if (!externalId) return jsonError(400, "INVALID_REQUEST", "external_id is required");
  if (source !== "tmdb" && source !== "anilist") return json(createEmptyResponse(externalId));

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return jsonError(500, "SERVER_MISCONFIGURED", "TMDB_API_KEY is not configured");

  try {
    let tmdbId = externalId;
    if (source === "anilist") {
      mediaType = "tv";
      const titles = [body.value.original_title, title];
      const result = await lookupAniListWatchProviders({ titles, year: body.value.air_year ?? null }, {
        async searchTv(query) {
          const searchUrl = new URL("https://api.themoviedb.org/3/search/tv");
          searchUrl.searchParams.set("query", query);
          searchUrl.searchParams.set("language", TMDB_LANGUAGE);
          searchUrl.searchParams.set("include_adult", "false");
          const response = await fetch(searchUrl, { headers: applyTmdbAuth(searchUrl, apiKey) });
          if (!response.ok) throw new Error(`TMDB anime search error: ${response.status}`);
          const payload = await response.json() as { results?: TmdbTvSearchItem[] };
          return payload.results ?? [];
        },
        async getTvSeasons(id) {
          const url = new URL(`https://api.themoviedb.org/3/tv/${id}`);
          url.searchParams.set("language", TMDB_LANGUAGE);
          const response = await fetch(url, { headers: applyTmdbAuth(url, apiKey) });
          if (!response.ok) throw new Error(`TMDB season lookup error: ${response.status}`);
          const payload = await response.json() as { seasons?: TmdbSeasonSummary[] };
          return payload.seasons ?? [];
        },
        async getProviders({ tmdbId, seasonNumber }) {
          const path = seasonNumber === null ? `tv/${tmdbId}` : `tv/${tmdbId}/season/${seasonNumber}`;
          const url = new URL(`https://api.themoviedb.org/3/${path}/watch/providers`);
          const response = await fetch(url, { headers: applyTmdbAuth(url, apiKey) });
          if (!response.ok) throw new Error(`TMDB watch providers error: ${response.status}`);
          return await response.json() as TmdbWatchProvidersResponse;
        }
      });
      if (result === null) return json(createEmptyResponse(externalId));
      const regionData = result.payload.results?.[WATCH_REGION];
      return json({
        external_source: "tmdb",
        external_id: externalId,
        tmdb_id: String(result.tmdbId),
        provider_scope: result.scope,
        tmdb_season_number: result.seasonNumber,
        region: WATCH_REGION,
        link: regionData?.link ?? null,
        providers: mapKrWatchProvidersByCategory(regionData, title),
        other_regions: listOtherAvailableRegions(result.payload.results),
        updated_at: new Date().toISOString()
      });
    }
    const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers`);
    const headers = applyTmdbAuth(url, apiKey);
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return jsonError(503, "TMDB_API_ERROR", `TMDB watch providers error: ${response.status}`);
    }

    const payload = (await response.json()) as TmdbWatchProvidersResponse;
    const regionData = payload.results?.[WATCH_REGION];

    return json({
      external_source: "tmdb",
      external_id: externalId,
      tmdb_id: tmdbId,
      provider_scope: "content",
      tmdb_season_number: null,
      region: WATCH_REGION,
      link: regionData?.link ?? null,
      providers: mapKrWatchProvidersByCategory(regionData, title),
      other_regions: listOtherAvailableRegions(payload.results),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    return jsonError(
      503,
      "TMDB_API_ERROR",
      error instanceof Error ? error.message : "Failed to fetch watch providers"
    );
  }
});

function createEmptyResponse(externalId: string) {
  return {
    external_source: "tmdb",
    external_id: externalId,
    tmdb_id: null,
    provider_scope: null,
    tmdb_season_number: null,
    region: WATCH_REGION,
    link: null,
    providers: {
      flatrate: [],
      free: [],
      rent: [],
      buy: []
    },
    other_regions: [],
    updated_at: new Date().toISOString()
  };
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
