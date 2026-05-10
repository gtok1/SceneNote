// Phase 2 — not active in MVP. Kitsu/TVmaze integration deferred.
// See docs/10_mvp_integration_plan.md §1.3 MVP 제외 목록

import { cleanText } from "./normalize.ts";
import type { AdapterSearchParams, AdapterSearchResponse, ContentType, SearchResult } from "./types.ts";

const TVMAZE_API_URL = Deno.env.get("TVMAZE_API_URL") ?? "https://api.tvmaze.com";

interface TvmazeSearchItem {
  show?: {
    id: number;
    name?: string;
    type?: string;
    language?: string;
    genres?: string[];
    premiered?: string;
    summary?: string | null;
    image?: {
      medium?: string;
      original?: string;
    } | null;
    externals?: {
      thetvdb?: number | null;
      imdb?: string | null;
    };
  };
}

export async function searchTvmaze({
  query,
  mediaType,
  signal
}: AdapterSearchParams): Promise<AdapterSearchResponse> {
  if (mediaType === "movie" || mediaType === "anime") {
    return { source: "tvmaze", results: [], total: 0, hasNextPage: false };
  }

  // TODO: TVmaze is show-focused and not localized for Korean/Japanese titles.
  const url = new URL(`${TVMAZE_API_URL}/search/shows`);
  url.searchParams.set("q", query);

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`TVmaze API error: ${response.status}`);
  }

  const payload = (await response.json()) as TvmazeSearchItem[];
  const results = payload.map(normalizeTvmazeItem).filter((item): item is SearchResult => item !== null);

  return {
    source: "tvmaze",
    results,
    total: results.length,
    hasNextPage: false
  };
}

function normalizeTvmazeItem(item: TvmazeSearchItem): SearchResult | null {
  const show = item.show;
  if (!show?.id || !show.name) return null;

  return {
    external_source: "tvmaze",
    external_id: String(show.id),
    content_type: inferTvmazeContentType(show),
    title_primary: show.name,
    title_original: null,
    poster_url: show.image?.original ?? show.image?.medium ?? null,
    overview: cleanText(show.summary),
    air_year: show.premiered ? Number.parseInt(show.premiered.slice(0, 4), 10) : null,
    has_seasons: true,
    episode_count: null,
    genres: Array.from(new Set(show.genres ?? []))
  };
}

function inferTvmazeContentType(show: NonNullable<TvmazeSearchItem["show"]>): ContentType {
  if (show.genres?.some((genre) => genre.toLocaleLowerCase().includes("anime"))) return "anime";
  return "other";
}
