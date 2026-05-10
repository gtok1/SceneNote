export type ExternalSource = "tmdb" | "anilist" | "kitsu" | "tvmaze" | "manual";

export type ContentType = "anime" | "kdrama" | "jdrama" | "movie" | "other";

export type MediaTypeFilter = "all" | "anime" | "drama" | "movie";

export interface SearchResult {
  external_source: Exclude<ExternalSource, "manual">;
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
  matched_people?: string[];
}

export interface CastMember {
  id: number;
  name: string;
  original_name: string | null;
  character: string | null;
  profile_url: string | null;
  order: number;
}

export interface SearchContentResponse {
  results: SearchResult[];
  sources: string[];
  failedSources: string[];
  cached: boolean;
  query: string;
  normalizedQuery: string;
  total: number;
  page: number;
  hasNextPage: boolean;
  partial: boolean;
}

export interface Content {
  id: string;
  content_type: ContentType;
  source_api: ExternalSource;
  source_id: string;
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  air_year: number | null;
  genres?: string[];
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: string;
  content_id: string;
  season_number: number;
  title: string | null;
  episode_count: number | null;
  air_year: number | null;
  created_at: string;
  updated_at: string;
}

export interface Episode {
  id: string;
  season_id: string;
  content_id: string;
  episode_number: number;
  title: string | null;
  air_date: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}
