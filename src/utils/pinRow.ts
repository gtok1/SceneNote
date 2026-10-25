import { parseStoredCrew } from "../../supabase/functions/_shared/contentCrew";
import type { Tag, TimelinePin } from "../types/pins";
import { extractGenreNames, type ContentGenreJoin } from "./genre";

interface RawPinTag {
  tag_id: string;
  tags: Tag | null;
}

export type RawPinRow = TimelinePin & {
  timeline_pin_tags?: RawPinTag[];
  contents?: {
    content_type?: TimelinePin["content_type"];
    crew?: unknown;
    title_primary: string | null;
    poster_url: string | null;
    source_api: string | null;
    source_id: string | null;
    content_genres?: ContentGenreJoin[] | null;
  } | null;
  episodes?: {
    episode_number: number | null;
    title: string | null;
    seasons?: { season_number: number | null } | null;
  } | null;
};

export const PIN_SELECT =
  "*,contents(*,content_genres(genres(name))),episodes(episode_number,title,seasons(season_number)),timeline_pin_tags(tag_id,tags(*))";

export function mapPinRow(row: RawPinRow): TimelinePin {
  const tags =
    row.timeline_pin_tags?.flatMap((pinTag) => (pinTag.tags ? [pinTag.tags] : [])) ?? [];
  const contentType = row.contents?.content_type ?? row.content_type;

  return {
    id: row.id,
    user_id: row.user_id,
    content_id: row.content_id,
    episode_id: row.episode_id,
    ...(contentType ? { content_type: contentType } : {}),
    content_crew: parseStoredCrew(row.contents?.crew),
    content_title: row.contents?.title_primary ?? row.content_title ?? null,
    content_poster_url: row.contents?.poster_url ?? row.content_poster_url ?? null,
    content_source_api: (row.contents?.source_api ?? row.content_source_api ?? null) as TimelinePin["content_source_api"],
    content_source_id: row.contents?.source_id ?? row.content_source_id ?? null,
    genres: extractGenreNames(row.contents?.content_genres),
    episode_title: row.episodes?.title ?? row.episode_title ?? null,
    episode_number: row.episodes?.episode_number ?? row.episode_number ?? null,
    season_number: row.episodes?.seasons?.season_number ?? row.season_number ?? null,
    timestamp_seconds: row.timestamp_seconds,
    display_time_label: row.display_time_label,
    memo: row.memo,
    emotion: row.emotion,
    is_spoiler: row.is_spoiler,
    created_at: row.created_at,
    updated_at: row.updated_at,
    tags
  };
}

