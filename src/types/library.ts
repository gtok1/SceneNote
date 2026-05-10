import type { CastMember, Content, ContentType, ExternalSource } from "./content";

export type WatchStatus = "wishlist" | "watching" | "completed" | "recommended" | "not_recommended" | "dropped";

export type LibraryStatusFilter = WatchStatus | "all";

export interface LibraryItem {
  id: string;
  user_id: string;
  content_id: string;
  status: WatchStatus;
  status_flags: WatchStatus[];
  watch_count: number;
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
  content_id: string;
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  content_type: ContentType;
  source_api: ExternalSource;
  source_id: string;
  air_year: number | null;
  cast: CastMember[];
  rating: number | null;
  one_line_review: string | null;
  episode_count: number | null;
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
