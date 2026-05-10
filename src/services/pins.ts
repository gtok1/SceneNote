import { supabase } from "@/lib/supabase";
import { getExternalContentDetail } from "@/services/contentSearch";
import type { ExternalSource } from "@/types/content";
import type { PinInput, Tag, TimelinePin } from "@/types/pins";
import { extractGenreNames, type ContentGenreJoin } from "@/utils/genre";
import { formatSecondsToTimecode } from "@/utils/timecode";
import { attachTagsToPin, replacePinTags } from "./tags";

interface RawPinTag {
  tag_id: string;
  tags: Tag | null;
}

type RawPinRow = TimelinePin & {
  timeline_pin_tags?: RawPinTag[];
  contents?: {
    title_primary: string | null;
    source_api: string | null;
    source_id: string | null;
    content_genres?: ContentGenreJoin[] | null;
  } | null;
  episodes?: {
    episode_number: number | null;
    title: string | null;
  } | null;
};

const PIN_SELECT =
  "*,contents(title_primary,source_api,source_id,content_genres(genres(name))),episodes(episode_number,title),timeline_pin_tags(tag_id,tags(*))";

export async function getAllPins(): Promise<TimelinePin[]> {
  const { data, error } = await supabase
    .from("timeline_pins")
    .select(PIN_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return enrichLocalizedPinTitles(mapPins(data as unknown as RawPinRow[]));
}

export async function getPin(pinId: string): Promise<TimelinePin | null> {
  const { data, error } = await supabase
    .from("timeline_pins")
    .select(PIN_SELECT)
    .eq("id", pinId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const pins = await enrichLocalizedPinTitles(data ? [mapPin(data as unknown as RawPinRow)] : []);
  return pins[0] ?? null;
}

export async function getPinsByContent(contentId: string): Promise<TimelinePin[]> {
  const { data, error } = await supabase
    .from("timeline_pins")
    .select(PIN_SELECT)
    .eq("content_id", contentId)
    .order("timestamp_seconds", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return enrichLocalizedPinTitles(mapPins(data as unknown as RawPinRow[]));
}

export async function getPinsByEpisode(episodeId: string): Promise<TimelinePin[]> {
  const { data, error } = await supabase
    .from("timeline_pins")
    .select(PIN_SELECT)
    .eq("episode_id", episodeId)
    .order("timestamp_seconds", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return enrichLocalizedPinTitles(mapPins(data as unknown as RawPinRow[]));
}

export async function getPinsByTag(tagId: string): Promise<TimelinePin[]> {
  const { data, error } = await supabase
    .from("timeline_pin_tags")
    .select(`timeline_pins(${PIN_SELECT})`)
    .eq("tag_id", tagId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as { timeline_pins: RawPinRow | null }[];
  return enrichLocalizedPinTitles(rows.flatMap((row) => (row.timeline_pins ? [mapPin(row.timeline_pins)] : [])));
}

export async function createPin(input: PinInput): Promise<TimelinePin> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("로그인이 필요합니다");

  const { data, error } = await supabase
    .from("timeline_pins")
    .insert({
      user_id: user.id,
      content_id: input.content_id,
      episode_id: input.episode_id ?? null,
      timestamp_seconds: input.timestamp_seconds,
      display_time_label:
        input.timestamp_seconds === null ? null : formatSecondsToTimecode(input.timestamp_seconds),
      memo: input.memo?.trim() ? input.memo.trim() : null,
      emotion: input.emotion,
      is_spoiler: input.is_spoiler
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const tags = await attachTagsToPin(data.id, input.tagNames);
  return { ...(data as TimelinePin), tags };
}

export async function updatePin(pinId: string, input: Omit<PinInput, "content_id" | "episode_id">) {
  const { data, error } = await supabase
    .from("timeline_pins")
    .update({
      timestamp_seconds: input.timestamp_seconds,
      display_time_label:
        input.timestamp_seconds === null ? null : formatSecondsToTimecode(input.timestamp_seconds),
      memo: input.memo?.trim() ? input.memo.trim() : null,
      emotion: input.emotion,
      is_spoiler: input.is_spoiler
    })
    .eq("id", pinId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const tags = await replacePinTags(pinId, input.tagNames);
  return { ...(data as TimelinePin), tags };
}

export async function deletePin(pinId: string): Promise<void> {
  const { error } = await supabase.from("timeline_pins").delete().eq("id", pinId);
  if (error) throw new Error(error.message);
}

function mapPins(rows: RawPinRow[] | null): TimelinePin[] {
  return (rows ?? []).map(mapPin);
}

function mapPin(row: RawPinRow): TimelinePin {
  const tags =
    row.timeline_pin_tags?.flatMap((pinTag) => (pinTag.tags ? [pinTag.tags] : [])) ?? [];

  return {
    id: row.id,
    user_id: row.user_id,
    content_id: row.content_id,
    episode_id: row.episode_id,
    content_title: row.contents?.title_primary ?? row.content_title ?? null,
    content_source_api: (row.contents?.source_api ?? row.content_source_api ?? null) as TimelinePin["content_source_api"],
    content_source_id: row.contents?.source_id ?? row.content_source_id ?? null,
    genres: extractGenreNames(row.contents?.content_genres),
    episode_title: row.episodes?.title ?? row.episode_title ?? null,
    episode_number: row.episodes?.episode_number ?? row.episode_number ?? null,
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

async function enrichLocalizedPinTitles(pins: TimelinePin[]): Promise<TimelinePin[]> {
  const candidates = pins.filter(
    (pin) =>
      pin.content_source_api &&
      pin.content_source_api !== "manual" &&
      pin.content_source_id &&
      isLikelyEnglishTitle(pin.content_title)
  );

  if (!candidates.length) return pins;

  const titleByContentId = new Map<string, string>();
  await Promise.all(
    Array.from(new Map(candidates.map((pin) => [pin.content_id, pin])).values())
      .slice(0, 8)
      .map(async (pin) => {
        try {
          const detail = await getExternalContentDetail({
            source: pin.content_source_api as Exclude<ExternalSource, "manual">,
            externalId: pin.content_source_id ?? "",
            mediaType: "tv"
          });
          const localizedTitle = detail.content.title_primary?.trim();
          if (localizedTitle && !isLikelyEnglishTitle(localizedTitle)) {
            titleByContentId.set(pin.content_id, localizedTitle);
          }
        } catch {
          // Keep the stored title if localization refresh fails.
        }
      })
  );

  if (!titleByContentId.size) return pins;

  return pins.map((pin) => ({
    ...pin,
    content_title: titleByContentId.get(pin.content_id) ?? pin.content_title
  }));
}

function isLikelyEnglishTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return /[A-Za-z]/.test(title) && !/[가-힣]/.test(title);
}
