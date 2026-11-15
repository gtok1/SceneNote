import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query";
import { MANUAL_METADATA_QUERY_OPTIONS } from "@/utils/metadataQuery";
import { normalizeDiscoveryFilters, type DiscoveryFilterInput } from "../../supabase/functions/_shared/discoveryFilters";
import type {
  MediaTypeFilter,
  CastMember,
  CrewMember,
  SearchContentResponse,
  SearchResult,
  Season
} from "@/types/content";

interface SearchContentParams extends DiscoveryFilterInput {
  query: string;
  signal?: AbortSignal;
  mediaType?: MediaTypeFilter;
  page?: number;
}

interface SearchContentFunctionResponse {
  results?: SearchResult[];
  sources?: string[];
  failedSources?: string[];
  cached?: boolean;
  query?: string;
  normalizedQuery?: string;
  total?: number;
  page?: number;
  hasNextPage?: boolean;
  partial?: boolean;
  country_filter_limited?: boolean;
  genre_filter_limited?: boolean;
  filtered_out_count?: number;
  from_cache?: boolean;
  has_next?: boolean;
}

export async function searchContent({
  query,
  mediaType = "all",
  page = 1,
  country,
  genre,
  countries,
  genres,
  mediaTypes,
  signal
}: SearchContentParams): Promise<SearchContentResponse> {
  const normalizedQuery = query.trim();
  const filters = normalizeDiscoveryFilters({ country, genre, countries, genres, mediaTypes });
  if (!normalizedQuery && filters.countries.length === 0) {
    return {
      results: [],
      sources: [],
      failedSources: [],
      cached: false,
      query,
      normalizedQuery: "",
      total: 0,
      page,
      hasNextPage: false,
      partial: false
    };
  }

  const { data, error } = await supabase.functions.invoke<SearchContentFunctionResponse>(
    "search-content",
    {
      ...(signal ? { signal } : {}),
      timeout: 14_000,
      body: {
        query: normalizedQuery,
        media_type: mediaType,
        page,
        ...filters
      }
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    results: (data?.results ?? []).filter(isWorkSearchResult),
    sources: data?.sources ?? [],
    failedSources: data?.failedSources ?? [],
    cached: Boolean(data?.cached ?? data?.from_cache),
    query,
    normalizedQuery: data?.normalizedQuery ?? normalizedQuery,
    total: data?.total ?? data?.results?.length ?? 0,
    page: data?.page ?? page,
    hasNextPage: Boolean(data?.hasNextPage ?? data?.has_next),
    partial: Boolean(data?.partial),
    country_filter_limited: Boolean(data?.country_filter_limited),
    genre_filter_limited: Boolean(data?.genre_filter_limited),
    filtered_out_count: data?.filtered_out_count ?? 0
  };
}

function isWorkSearchResult(result: SearchResult): boolean {
  if (result.external_source !== "tmdb") return true;

  const hasWorkSignal = Boolean(
    result.poster_url ||
      result.overview ||
      result.air_year ||
      result.has_seasons ||
      result.content_type !== "other"
  );

  return hasWorkSignal;
}

export interface ContentDetailResponse {
  content: SearchResult & {
    content_id?: string;
    cast?: CastMember[];
    crew?: CrewMember[];
    genres?: string[];
  };
  seasons: (Pick<Season, "season_number" | "title" | "episode_count" | "air_year"> & {
    season_id?: string;
  })[];
  from_db: boolean;
  from_cache?: boolean;
  cache_policy?: "manual-v1";
}

export interface ExternalContentDetailParams {
  source: SearchResult["external_source"];
  externalId: string;
  mediaType?: string;
  forceRefresh?: boolean;
}

export function externalContentDetailQueryKey(params: ExternalContentDetailParams) {
  return ["content", "external-detail", "manual-v1", params.source, params.externalId, params.mediaType] as const;
}

/** Direct service consumers (such as pin title enrichment) share the same cache as mounted cards. */
export function getExternalContentDetail(params: ExternalContentDetailParams): Promise<ContentDetailResponse> {
  const queryKey = externalContentDetailQueryKey(params);
  if (!params.forceRefresh) {
    const saved = queryClient.getQueryData<ContentDetailResponse>(queryKey);
    if (saved) return Promise.resolve(saved);
    const previous = queryClient.getQueryState(queryKey);
    if (previous?.status === "error") return Promise.reject(previous.error);
  }
  return queryClient.fetchQuery({
    ...MANUAL_METADATA_QUERY_OPTIONS,
    queryKey,
    queryFn: () => fetchExternalContentDetail(params),
    ...(params.forceRefresh ? { staleTime: 0 } : {})
  });
}

/** Raw query function: never call the cached wrapper from a query for the same key. */
export async function fetchExternalContentDetail(params: ExternalContentDetailParams): Promise<ContentDetailResponse> {
  const { data, error } = await supabase.functions.invoke<ContentDetailResponse>(
    "get-content-detail",
    {
      body: {
        api_source: params.source,
        external_id: params.externalId,
        media_type: params.mediaType,
        ...(params.forceRefresh ? { force_refresh: true } : {})
      }
    }
  );

  if (error) throw new Error(error.message);
  if (!data) throw new Error("콘텐츠 상세 응답이 비어 있습니다");
  return data;
}
