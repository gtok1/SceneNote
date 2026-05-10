export type EmotionType =
  | "excited"
  | "moved"
  | "funny"
  | "sad"
  | "surprised"
  | "angry"
  | "scared"
  | "love"
  | "boring"
  | "none";

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface TimelinePinTag {
  pin_id: string;
  tag_id: string;
  tag?: Tag | null;
}

export interface TimelinePin {
  id: string;
  user_id: string;
  content_id: string;
  episode_id: string | null;
  content_title?: string | null | undefined;
  content_source_api?: string | null | undefined;
  content_source_id?: string | null | undefined;
  genres?: string[] | undefined;
  episode_title?: string | null | undefined;
  episode_number?: number | null | undefined;
  timestamp_seconds: number | null;
  display_time_label: string | null;
  memo: string | null;
  emotion: EmotionType | null;
  is_spoiler: boolean;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface PinInput {
  content_id: string;
  episode_id?: string | null;
  timestamp_seconds: number | null;
  memo: string | null;
  emotion: EmotionType | null;
  is_spoiler: boolean;
  tagNames: string[];
}

export type PinSortMode = "latest" | "timeline";
