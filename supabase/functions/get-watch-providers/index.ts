import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import type { ExternalSource } from "../_shared/types.ts";

type WatchProviderCategory = "flatrate" | "free" | "rent" | "buy";

interface WatchProviderRequest {
  api_source?: ExternalSource;
  external_source?: ExternalSource;
  external_id?: string;
  media_type?: "movie" | "tv" | string;
  title?: string | null;
  watch_region?: string;
}

interface TmdbProvider {
  display_priority?: number;
  logo_path?: string | null;
  provider_id?: number;
  provider_name?: string | null;
}

interface TmdbWatchProviderRegion {
  link?: string;
  flatrate?: TmdbProvider[];
  free?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
}

interface TmdbWatchProvidersResponse {
  id: number;
  results?: Record<string, TmdbWatchProviderRegion | undefined>;
}

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";
const TMDB_LANGUAGE = "ko-KR";
const WATCH_REGION = "KR";
const CATEGORIES: WatchProviderCategory[] = ["flatrate", "free", "rent", "buy"];
const CATEGORY_LABELS: Record<WatchProviderCategory, string> = {
  flatrate: "정액제",
  free: "무료",
  rent: "대여",
  buy: "구매"
};

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
  const mediaType = body.value.media_type === "movie" ? "movie" : "tv";
  const title = body.value.title?.trim() || null;

  if (!externalId) return jsonError(400, "INVALID_REQUEST", "external_id is required");
  if (source !== "tmdb") return json(createEmptyResponse(externalId));

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return jsonError(500, "SERVER_MISCONFIGURED", "TMDB_API_KEY is not configured");

  try {
    const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${externalId}/watch/providers`);
    url.searchParams.set("language", TMDB_LANGUAGE);
    url.searchParams.set("watch_region", WATCH_REGION);
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
      region: WATCH_REGION,
      link: regionData?.link ?? null,
      providers: mapProviders(regionData, title),
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

function mapProviders(regionData: TmdbWatchProviderRegion | undefined, title: string | null) {
  return Object.fromEntries(
    CATEGORIES.map((category) => [
      category,
      dedupeProviders(regionData?.[category] ?? []).map((provider) => ({
        provider_id: provider.provider_id ?? 0,
        provider_name: provider.provider_name?.trim() || "Unknown",
        logo_url: provider.logo_path ? `${TMDB_IMAGE_BASE_URL}${provider.logo_path}` : null,
        service_type: category,
        service_type_label: CATEGORY_LABELS[category],
        display_priority: provider.display_priority ?? 9999,
        link: createProviderLink(provider, title) ?? regionData?.link ?? null
      }))
    ])
  );
}

function createProviderLink(provider: TmdbProvider, title: string | null): string | null {
  if (!title) return null;

  const encodedTitle = encodeURIComponent(title);
  const providerName = provider.provider_name?.toLocaleLowerCase() ?? "";

  if (providerName.includes("netflix")) return `https://www.netflix.com/search?q=${encodedTitle}`;
  if (providerName.includes("disney")) return `https://www.disneyplus.com/search?q=${encodedTitle}`;
  if (providerName.includes("watcha") || providerName.includes("왓챠")) return `https://watcha.com/search?query=${encodedTitle}`;
  if (providerName.includes("wavve") || providerName.includes("웨이브")) return `https://www.wavve.com/search?searchWord=${encodedTitle}`;
  if (providerName.includes("tving") || providerName.includes("티빙")) return `https://www.tving.com/search?keyword=${encodedTitle}`;
  if (providerName.includes("coupang") || providerName.includes("쿠팡")) {
    return `https://www.coupangplay.com/search?query=${encodedTitle}`;
  }
  if (providerName.includes("apple tv")) return `https://tv.apple.com/kr/search?term=${encodedTitle}`;
  if (providerName.includes("google play")) return `https://play.google.com/store/search?q=${encodedTitle}&c=movies`;
  if (providerName.includes("naver") || providerName.includes("네이버")) {
    return `https://serieson.naver.com/v3/search?keyword=${encodedTitle}`;
  }
  if (providerName.includes("laftel") || providerName.includes("라프텔")) return `https://laftel.net/search?keyword=${encodedTitle}`;
  if (providerName.includes("prime video") || providerName.includes("amazon")) {
    return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodedTitle}`;
  }
  if (providerName.includes("youtube")) return `https://www.youtube.com/results?search_query=${encodedTitle}`;

  return null;
}

function dedupeProviders(providers: TmdbProvider[]): TmdbProvider[] {
  const byId = new Map<number, TmdbProvider>();

  providers
    .filter((provider) => typeof provider.provider_id === "number")
    .sort((a, b) => (a.display_priority ?? 9999) - (b.display_priority ?? 9999))
    .forEach((provider) => byId.set(provider.provider_id as number, provider));

  return Array.from(byId.values());
}

function createEmptyResponse(externalId: string) {
  return {
    external_source: "tmdb",
    external_id: externalId,
    region: WATCH_REGION,
    link: null,
    providers: {
      flatrate: [],
      free: [],
      rent: [],
      buy: []
    },
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
