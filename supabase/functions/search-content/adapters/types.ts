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
  air_date?: string | null;
  end_date?: string | null;
  has_seasons: boolean;
  episode_count: number | null;
  genres?: string[];
  /** ISO 3166-1 alpha-2 codes, from TMDB `origin_country`. */
  origin_country?: string[];
  duplicate_hint?: boolean;
  match_titles?: string[];
  matched_via?: "direct" | "season_relation";
  season_number?: number;
  title_is_synthesized?: boolean;
  resolved_from_id?: string;
}

export interface AdapterSearchParams {
  query: string;
  mediaType: MediaTypeFilter;
  page: number;
  signal: AbortSignal;
  /** Injectable for tests; defaults to the real current time. */
  now?: Date;
}

export interface AdapterSearchResponse {
  source: ExternalSource;
  results: SearchResult[];
  total?: number;
  hasNextPage?: boolean;
}
