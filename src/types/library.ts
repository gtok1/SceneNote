import type { CastMember, Content, ContentType, ExternalSource } from "./content";

export type WatchStatus = "wishlist" | "watching" | "completed" | "recommended" | "not_recommended" | "dropped";

export type LibraryStatusFilter = WatchStatus | "all";

export type EpisodeProgressSource = "manual" | "episode_progress" | "none";

export interface SeasonEpisodeCount {
  season_number: number;
  episode_count: number | null;
}

export interface LibraryItem {
  id: string;
  user_id: string;
  content_id: string;
  status: WatchStatus;
  status_flags: WatchStatus[];
  watch_count: number;
  first_watched_at: string | null;
  last_watched_at: string | null;
  manual_watched_season_number: number | null;
  manual_watched_episode_number: number | null;
  manual_progress_updated_at: string | null;
  added_at: string;
  updated_at: string;
  content: Content | null;
}

export interface LibraryListItem {
  library_item_id: string;
  status: WatchStatus;
  statuses: WatchStatus[];
  added_at: string;
  updated_at: string;
  first_watched_at: string | null;
  last_watched_at: string | null;
  content_id: string;
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  content_type: ContentType;
  source_api: ExternalSource;
  source_id: string;
  air_year: number | null;
  air_date: string | null;
  end_date: string | null;
  cast: CastMember[];
  rating: number | null;
  one_line_review: string | null;
  episode_count: number | null;
  watched_episode_count: number;
  derived_watched_through: number | null;
  next_episode_number: number | null;
  manual_watched_season_number: number | null;
  manual_watched_episode_number: number | null;
  manual_watched_absolute_number: number | null;
  progress_source: EpisodeProgressSource;
  effective_watched_through: number;
  season_episode_counts: SeasonEpisodeCount[];
  manual_progress_available: boolean;
  genres: string[];
  watch_count: number;
  pin_count?: number;
}

export interface EpisodeProgress {
  id: string;
  user_id: string;
  episode_id: string;
  content_id: string;
  watched_at: string;
  created_at: string;
}
