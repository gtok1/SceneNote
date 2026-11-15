import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import { createPersistentMetadataStore, PersistentMetadataCacheError, readThroughPersistentMetadata } from "../_shared/persistentMetadataCache.ts";
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
  force_refresh?: boolean;
}

interface TmdbWatchProvidersResponse {
  id: number;
  results?: Record<string, TmdbWatchProviderRegion | undefined>;
}

interface WatchProviderPayload {
  lookup_version: 2;
  requested_season_number: number | null;
  external_source: "tmdb";
  external_id: string;
  tmdb_id: string | null;
  provider_scope: "content" | "season" | null;
  tmdb_season_number: number | null;
  region: "KR";
  link: string | null;
  providers: ReturnType<typeof mapKrWatchProvidersByCategory>;
  other_regions: string[];
  updated_at: string;
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
    || (input.force_refresh !== undefined && typeof input.force_refresh !== "boolean")
    || (input.air_date != null && (typeof input.air_date !== "string" || !isValidWatchAirDate(input.air_date)))) {
    return jsonError(400, "INVALID_REQUEST", "Invalid watch provider lookup metadata");
  }

  const source = input.api_source ?? input.external_source;
  const externalId = input.external_id.trim();
  const mediaType = input.media_type === "movie" ? "movie" : "tv";
  const title = input.title?.trim() || null;
  const titles = [input.original_title, title];
  const requestedSeasonNumber = resolveWatchSeasonNumber({ source, mediaType, titles, seasonNumber: input.season_number });

  if (source !== "tmdb" && source !== "anilist") {
    return json({ ...createEmptyResponse(externalId, requestedSeasonNumber), cache_policy: "manual-v1", from_cache: false });
  }
  if (!/^\d+$/.test(externalId)) return jsonError(400, "INVALID_REQUEST", "external_id must be numeric");

  try {
    const key = JSON.stringify([
      "watch-providers", "manual-v1", 2, source, mediaType, externalId, WATCH_REGION,
      requestedSeasonNumber, title, input.original_title?.trim() || null,
      input.air_year ?? null, input.air_date ?? null
    ]);
    const result = await readThroughPersistentMetadata({
      key,
      source,
      store: createPersistentMetadataStore(createAdminClient()),
      forceRefresh: input.force_refresh === true,
      isValid: (value): value is WatchProviderPayload => isWatchProviderPayload(value, source, externalId, requestedSeasonNumber),
      async fetchFresh(): Promise<WatchProviderPayload> {
        if (source === "anilist" && requestedSeasonNumber === null) {
          return createEmptyResponse(externalId, requestedSeasonNumber);
        }
        const apiKey = Deno.env.get("TMDB_API_KEY");
        if (!apiKey) throw new WatchProviderLookupError(500, "SERVER_MISCONFIGURED", "TMDB_API_KEY is not configured");
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
          if (result === null) return createEmptyResponse(externalId, requestedSeasonNumber);
          const regionData = result.payload.results?.[WATCH_REGION];
          return {
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
          };
        }
        const providerPath = requestedSeasonNumber === null
          ? `${mediaType}/${tmdbId}` : `tv/${tmdbId}/season/${requestedSeasonNumber}`;
        const url = new URL(`https://api.themoviedb.org/3/${providerPath}/watch/providers`);
        const headers = applyTmdbAuth(url, apiKey);
        const response = await fetch(url, { headers });
        if (requestedSeasonNumber !== null && response.status === 404) {
          return createEmptyResponse(externalId, requestedSeasonNumber);
        }

        if (!response.ok) {
          throw new Error(`TMDB watch providers error: ${response.status}`);
        }

        const payload = (await response.json()) as TmdbWatchProvidersResponse;
        const regionData = payload.results?.[WATCH_REGION];

        return {
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
        };
      }
    });
    return json({ ...result.data, cache_policy: "manual-v1", from_cache: result.fromCache });
  } catch (error) {
    if (error instanceof PersistentMetadataCacheError) {
      return jsonError(503, error.code, "Stored watch provider metadata could not be read or saved");
    }
    if (error instanceof WatchProviderLookupError) return jsonError(error.status, error.code, error.message);
    return jsonError(
      503,
      "TMDB_API_ERROR",
      error instanceof Error ? error.message : "Failed to fetch watch providers"
    );
  }
});

function createEmptyResponse(externalId: string, requestedSeasonNumber: number | null): WatchProviderPayload {
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

class WatchProviderLookupError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Never turn a corrupt or differently scoped DB row into confirmed season availability. */
function isWatchProviderPayload(value: unknown, source: "tmdb" | "anilist", externalId: string, seasonNumber: number | null): value is WatchProviderPayload {
  if (!isRecord(value) || value.lookup_version !== 2 || value.external_source !== "tmdb" ||
    value.external_id !== externalId || value.region !== WATCH_REGION ||
    value.requested_season_number !== seasonNumber || typeof value.updated_at !== "string" ||
    !Number.isFinite(Date.parse(value.updated_at)) || !isRecord(value.providers) ||
    !(value.link === null || typeof value.link === "string") ||
    !Array.isArray(value.other_regions) || !value.other_regions.every(region => typeof region === "string")) return false;

  for (const category of ["flatrate", "free", "rent", "buy"] as const) {
    const rows = value.providers[category];
    if (!Array.isArray(rows) || !rows.every(provider => isRecord(provider) &&
      Number.isSafeInteger(provider.provider_id) && (provider.provider_id as number) > 0 &&
      typeof provider.provider_name === "string" && provider.service_type === category &&
      typeof provider.service_type_label === "string" && typeof provider.display_priority === "number" &&
      Number.isFinite(provider.display_priority) && (provider.logo_url === null || typeof provider.logo_url === "string") &&
      (provider.link === null || typeof provider.link === "string"))) return false;
  }
  if (value.provider_scope === null) {
    return value.tmdb_id === null && value.tmdb_season_number === null && value.other_regions.length === 0 &&
      ["flatrate", "free", "rent", "buy"].every(category => (value.providers as Record<string, unknown[]>)[category]?.length === 0);
  }
  if (typeof value.tmdb_id !== "string" || !/^\d+$/.test(value.tmdb_id)) return false;
  if (source === "tmdb" && value.tmdb_id !== externalId) return false;
  return seasonNumber === null
    ? value.provider_scope === "content" && value.tmdb_season_number === null
    : value.provider_scope === "season" && Number.isSafeInteger(value.tmdb_season_number) &&
      (value.tmdb_season_number as number) >= 0 &&
      (source !== "tmdb" || value.tmdb_season_number === seasonNumber);
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
