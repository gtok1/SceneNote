import { supabase } from "@/lib/supabase";
import type {
  MediaTypeFilter,
  CastMember,
  SearchContentResponse,
  SearchResult,
  Season
} from "@/types/content";

interface SearchContentParams {
  query: string;
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
  from_cache?: boolean;
  has_next?: boolean;
}

export async function searchContent({
  query,
  mediaType = "all",
  page = 1
}: SearchContentParams): Promise<SearchContentResponse> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
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
      body: {
        query: normalizedQuery,
        media_type: mediaType,
        page
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
    partial: Boolean(data?.partial)
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
    genres?: string[];
  };
  seasons: (Pick<Season, "season_number" | "title" | "episode_count" | "air_year"> & {
    season_id?: string;
  })[];
  from_db: boolean;
}

export async function getExternalContentDetail(params: {
  source: SearchResult["external_source"];
  externalId: string;
  mediaType?: string;
}): Promise<ContentDetailResponse> {
  const { data, error } = await supabase.functions.invoke<ContentDetailResponse>(
    "get-content-detail",
    {
      body: {
        api_source: params.source,
        external_id: params.externalId,
        media_type: params.mediaType
      }
    }
  );

  if (error) throw new Error(error.message);
  if (!data) throw new Error("콘텐츠 상세 응답이 비어 있습니다");
  return data;
}
