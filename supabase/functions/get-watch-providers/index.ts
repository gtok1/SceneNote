import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import type { ExternalSource } from "../_shared/types.ts";
import { isValidWatchAirDate, resolveWatchSeasonNumber } from "../_shared/watchProviderSeason.ts";
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
  air_date?: string | null;
  season_number?: number | null;
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
  const input = body.value;
  if (typeof input.external_id !== "string" || !input.external_id.trim()) {
    return jsonError(400, "INVALID_REQUEST", "external_id must be a non-empty string");
  }
  if ([input.api_source, input.external_source, input.title, input.original_title, input.watch_region]
    .some(value => value != null && typeof value !== "string")
    || (input.media_type !== undefined && input.media_type !== "movie" && input.media_type !== "tv")
    || (input.season_number != null && (!Number.isSafeInteger(input.season_number) || input.season_number < 0))
    || (input.air_year != null && (!Number.isSafeInteger(input.air_year) || input.air_year < 1 || input.air_year > 9999))
    || (input.air_date != null && (typeof input.air_date !== "string" || !isValidWatchAirDate(input.air_date)))) {
    return jsonError(400, "INVALID_REQUEST", "Invalid watch provider lookup metadata");
  }

  const source = input.api_source ?? input.external_source;
  const externalId = input.external_id.trim();
  const mediaType = input.media_type === "movie" ? "movie" : "tv";
  const title = input.title?.trim() || null;
  const titles = [input.original_title, title];
  const requestedSeasonNumber = resolveWatchSeasonNumber({ source, mediaType, titles, seasonNumber: input.season_number });

  if (source !== "tmdb" && source !== "anilist") return json(createEmptyResponse(externalId, requestedSeasonNumber));
  if (!/^\d+$/.test(externalId)) return jsonError(400, "INVALID_REQUEST", "external_id must be numeric");
  if (source === "anilist" && requestedSeasonNumber === null) {
    return json(createEmptyResponse(externalId, requestedSeasonNumber));
  }

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return jsonError(500, "SERVER_MISCONFIGURED", "TMDB_API_KEY is not configured");

  try {
    const tmdbId = externalId;
    if (source === "anilist") {
      const result = await lookupAniListWatchProviders({
        titles, mediaType, year: input.air_year ?? null, airDate: input.air_date, seasonNumber: requestedSeasonNumber
      }, {
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
          if (response.status === 404) return [];
          if (!response.ok) throw new Error(`TMDB season lookup error: ${response.status}`);
          const payload = await response.json() as { seasons?: TmdbSeasonSummary[] };
          return payload.seasons ?? [];
        },
        async getProviders({ tmdbId, seasonNumber }) {
          const path = `tv/${tmdbId}/season/${seasonNumber}`;
          const url = new URL(`https://api.themoviedb.org/3/${path}/watch/providers`);
          const response = await fetch(url, { headers: applyTmdbAuth(url, apiKey) });
          if (response.status === 404) return null;
          if (!response.ok) throw new Error(`TMDB watch providers error: ${response.status}`);
          return await response.json() as TmdbWatchProvidersResponse;
        }
      });
      if (result === null) return json(createEmptyResponse(externalId, requestedSeasonNumber));
      const regionData = result.payload.results?.[WATCH_REGION];
      return json({
        lookup_version: 2,
        requested_season_number: requestedSeasonNumber,
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
    const providerPath = requestedSeasonNumber === null
      ? `${mediaType}/${tmdbId}` : `tv/${tmdbId}/season/${requestedSeasonNumber}`;
    const url = new URL(`https://api.themoviedb.org/3/${providerPath}/watch/providers`);
    const headers = applyTmdbAuth(url, apiKey);
    const response = await fetch(url, { headers });
    if (requestedSeasonNumber !== null && response.status === 404) {
      return json(createEmptyResponse(externalId, requestedSeasonNumber));
    }

    if (!response.ok) {
      return jsonError(503, "TMDB_API_ERROR", `TMDB watch providers error: ${response.status}`);
    }

    const payload = (await response.json()) as TmdbWatchProvidersResponse;
    const regionData = payload.results?.[WATCH_REGION];

    return json({
      lookup_version: 2,
      requested_season_number: requestedSeasonNumber,
      external_source: "tmdb",
      external_id: externalId,
      tmdb_id: tmdbId,
      provider_scope: requestedSeasonNumber === null ? "content" : "season",
      tmdb_season_number: requestedSeasonNumber,
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

function createEmptyResponse(externalId: string, requestedSeasonNumber: number | null) {
  return {
    lookup_version: 2,
    requested_season_number: requestedSeasonNumber,
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
