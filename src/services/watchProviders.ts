import { supabase } from "@/lib/supabase";
import type { SearchResult } from "@/types/content";
import type { WatchProvidersByCategory, WatchProvidersResponse } from "@/types/watchProviders";

export const emptyWatchProviders: WatchProvidersByCategory = {
  flatrate: [],
  free: [],
  rent: [],
  buy: []
};

export async function getWatchProviders(params: {
  source: SearchResult["external_source"];
  externalId: string;
  mediaType: "movie" | "tv";
  title: string | null | undefined;
  originalTitle?: string | null;
  airYear?: number | null;
}): Promise<WatchProvidersResponse> {
  if (params.source !== "tmdb" && params.source !== "anilist") {
    return createEmptyWatchProviders(params.externalId);
  }

  const { data, error } = await supabase.functions.invoke<WatchProvidersResponse>("get-watch-providers", {
    body: {
      api_source: params.source,
      external_id: params.externalId,
      media_type: params.mediaType,
      title: params.title,
      original_title: params.originalTitle,
      air_year: params.airYear,
      watch_region: "KR"
    }
  });

  if (error) throw new Error(error.message);
  return data ?? createEmptyWatchProviders(params.externalId);
}

export function createEmptyWatchProviders(externalId: string): WatchProvidersResponse {
  return {
    external_source: "tmdb",
    external_id: externalId,
    tmdb_id: null,
    other_regions: [],
    region: "KR",
    link: null,
    providers: emptyWatchProviders,
    updated_at: new Date().toISOString()
  };
}
