import { supabase } from "@/lib/supabase";
import type { SearchResult } from "@/types/content";
import type { WatchProvidersByCategory, WatchProvidersResponse } from "@/types/watchProviders";
import { isWatchProviderResponseCompatible, supportsWatchProviderLookup } from "@/utils/watchProviderLookup";

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
  airDate?: string | null;
  seasonNumber?: number | null;
  forceRefresh?: boolean;
}): Promise<WatchProvidersResponse> {
  if (!supportsWatchProviderLookup(params)) {
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
      air_date: params.airDate,
      season_number: params.seasonNumber,
      watch_region: "KR",
      force_refresh: params.forceRefresh ?? false
    }
  });

  if (error) throw new Error(error.message);
  if (!data || data.lookup_version !== 2 || !isWatchProviderResponseCompatible({
    response: data,
    seasonNumber: params.seasonNumber ?? null,
    requireSeasonMatch: params.seasonNumber != null || (params.source === "anilist" && params.mediaType === "tv")
  })) {
    throw new Error("시청 정보를 새로 확인하지 못했어요. 잠시 후 다시 확인해 주세요.");
  }
  return data;
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
