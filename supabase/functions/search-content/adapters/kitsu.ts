// Phase 2 — not active in MVP. Kitsu/TVmaze integration deferred.
// See docs/10_mvp_integration_plan.md §1.3 MVP 제외 목록

import { cleanText } from "./normalize.ts";
import type { AdapterSearchParams, AdapterSearchResponse, SearchResult } from "./types.ts";

const KITSU_API_URL = Deno.env.get("KITSU_API_URL") ?? "https://kitsu.io/api/edge";

interface KitsuAnime {
  id: string;
  attributes?: {
    canonicalTitle?: string;
    titles?: Record<string, string | undefined>;
    posterImage?: {
      medium?: string;
      large?: string;
    };
    synopsis?: string;
    startDate?: string;
    episodeCount?: number | null;
    subtype?: string;
  };
}

interface KitsuResponse {
  data?: KitsuAnime[];
  meta?: {
    count?: number;
  };
}

export async function searchKitsu({
  query,
  mediaType,
  page,
  signal
}: AdapterSearchParams): Promise<AdapterSearchResponse> {
  if (mediaType !== "all" && mediaType !== "anime") {
    return { source: "kitsu", results: [], total: 0, hasNextPage: false };
  }

  // TODO: Verify Kitsu rate limits and JSON:API pagination behavior before production use.
  const url = new URL(`${KITSU_API_URL}/anime`);
  url.searchParams.set("filter[text]", query);
  url.searchParams.set("page[limit]", "20");
  url.searchParams.set("page[offset]", String((page - 1) * 20));

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.api+json"
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`Kitsu API error: ${response.status}`);
  }

  const payload = (await response.json()) as KitsuResponse;
  const results = (payload.data ?? []).map(normalizeKitsuItem);

  return {
    source: "kitsu",
    results,
    total: payload.meta?.count ?? results.length,
    hasNextPage: results.length === 20
  };
}

function normalizeKitsuItem(item: KitsuAnime): SearchResult {
  const attributes = item.attributes;

  return {
    external_source: "kitsu",
    external_id: item.id,
    content_type: attributes?.subtype === "movie" ? "movie" : "anime",
    title_primary:
      attributes?.titles?.ko_kr ??
      attributes?.titles?.ko ??
      attributes?.titles?.en ??
      attributes?.titles?.en_jp ??
      attributes?.titles?.ja_jp ??
      attributes?.canonicalTitle ??
      "Untitled",
    title_original: attributes?.titles?.ja_jp ?? null,
    poster_url: attributes?.posterImage?.large ?? attributes?.posterImage?.medium ?? null,
    overview: cleanText(attributes?.synopsis),
    air_year: attributes?.startDate ? Number.parseInt(attributes.startDate.slice(0, 4), 10) : null,
    has_seasons: attributes?.subtype !== "movie",
    episode_count: attributes?.episodeCount ?? null
  };
}
