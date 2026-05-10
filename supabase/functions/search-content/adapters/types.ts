export type ExternalSource = "tmdb" | "anilist" | "kitsu" | "tvmaze";

export type ContentType = "anime" | "kdrama" | "jdrama" | "movie" | "other";

export type MediaTypeFilter = "all" | "anime" | "drama" | "movie";

export interface SearchResult {
  external_source: ExternalSource;
  external_id: string;
  content_type: ContentType;
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  localized_overview?: string | null;
  air_year: number | null;
  has_seasons: boolean;
  episode_count: number | null;
  genres?: string[];
  duplicate_hint?: boolean;
}

export interface AdapterSearchParams {
  query: string;
  mediaType: MediaTypeFilter;
  page: number;
  signal: AbortSignal;
}

export interface AdapterSearchResponse {
  source: ExternalSource;
  results: SearchResult[];
  total?: number;
  hasNextPage?: boolean;
}
