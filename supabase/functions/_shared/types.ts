export type ExternalSource = "tmdb" | "anilist" | "kitsu" | "tvmaze";
export type ContentType = "anime" | "kdrama" | "jdrama" | "movie" | "other";
export type WatchStatus = "wishlist" | "watching" | "completed" | "recommended" | "not_recommended" | "dropped";

export interface SeasonMeta {
  season_number: number;
  title: string | null;
  episode_count: number | null;
  air_year: number | null;
}

export interface EpisodeMeta {
  episode_number: number;
  title: string | null;
  air_date: string | null;
  duration_seconds: number | null;
}

export interface CastMemberMeta {
  id: number;
  name: string;
  original_name: string | null;
  character: string | null;
  profile_url: string | null;
  order: number;
}

export interface ContentMeta {
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
  genres: string[];
  seasons: SeasonMeta[];
  cast: CastMemberMeta[];
}
