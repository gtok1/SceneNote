import { supabase } from "@/lib/supabase";
import { getExternalContentDetail } from "@/services/contentSearch";
import type { PinInput, TimelinePin } from "@/types/pins";
import { enrichLocalizedPinTitles } from "@/utils/pinLocalization";
import { mapPinRow, PIN_SELECT, type RawPinRow } from "@/utils/pinRow";
import { sortPinsByScene } from "@/utils/pinSort";
import { formatSecondsToTimecode } from "@/utils/timecode";
import { attachTagsToPin, replacePinTags } from "./tags";

export async function getAllPins(): Promise<TimelinePin[]> {
  const { data, error } = await supabase
    .from("timeline_pins")
    .select(PIN_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return enrichLocalizedPinTitles(mapPins(data as unknown as RawPinRow[]), getExternalContentDetail);
}

export async function getPin(pinId: string): Promise<TimelinePin | null> {
  const { data, error } = await supabase
    .from("timeline_pins")
    .select(PIN_SELECT)
    .eq("id", pinId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const pins = await enrichLocalizedPinTitles(
    data ? [mapPinRow(data as unknown as RawPinRow)] : [], getExternalContentDetail
  );
  return pins[0] ?? null;
}

export async function getEpisodeDurationSeconds(episodeId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("episodes")
    .select("duration_seconds")
    .eq("id", episodeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { duration_seconds?: number | null } | null)?.duration_seconds ?? null;
}

export async function getPinsByContent(contentId: string): Promise<TimelinePin[]> {
  const { data, error } = await supabase
    .from("timeline_pins")
    .select(PIN_SELECT)
    .eq("content_id", contentId)
    .order("timestamp_seconds", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return enrichLocalizedPinTitles(
    sortPinsByScene(mapPins(data as unknown as RawPinRow[])), getExternalContentDetail
  );
}

export async function getPinsByEpisode(episodeId: string): Promise<TimelinePin[]> {
  const { data, error } = await supabase
    .from("timeline_pins")
    .select(PIN_SELECT)
    .eq("episode_id", episodeId)
    .order("timestamp_seconds", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return enrichLocalizedPinTitles(mapPins(data as unknown as RawPinRow[]), getExternalContentDetail);
}

export async function getPinsByTag(tagId: string): Promise<TimelinePin[]> {
  const { data, error } = await supabase
    .from("timeline_pin_tags")
    .select(`timeline_pins(${PIN_SELECT})`)
    .eq("tag_id", tagId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as { timeline_pins: RawPinRow | null }[];
  return enrichLocalizedPinTitles(
    rows.flatMap((row) => (row.timeline_pins ? [mapPinRow(row.timeline_pins)] : [])), getExternalContentDetail
  );
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
  return (rows ?? []).map(mapPinRow);
}
