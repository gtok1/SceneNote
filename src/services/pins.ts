import { supabase } from "@/lib/supabase";
import { getExternalContentDetail } from "@/services/contentSearch";
import { getSessionUserId } from "@/services/sessionUser";
import type { PinInput, TimelinePin } from "@/types/pins";
import { readAllRows } from "@/utils/batchedQuery";
import { atomicPinSaveArgs, atomicPinSaveError, createPinSaveIdentity } from "@/utils/pinSave";
import { enrichLocalizedPinTitles } from "@/utils/pinLocalization";
import { mapPinRow, PIN_SELECT, type RawPinRow } from "@/utils/pinRow";
import { sortPinsByScene } from "@/utils/pinSort";

const createIdentities = new WeakMap<PinInput, ReturnType<typeof createPinSaveIdentity>>();

export async function getAllPins(): Promise<TimelinePin[]> {
  const { data, error } = await readAllRows((from, to) => supabase
    .from("timeline_pins")
    .select(PIN_SELECT)
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to), { rowKey: row => row.id });

  if (error) throw new Error(error.message === "ROW_LIMIT_EXCEEDED" ? "핀이 너무 많아 불러오지 못했어요." : error.message);
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
  const { data, error } = await readAllRows((from, to) => supabase
    .from("timeline_pin_tags")
    .select(`timeline_pins(${PIN_SELECT})`)
    .eq("tag_id", tagId)
    .order("pin_id")
    .range(from, to), { rowKey: row => row.timeline_pins?.id });

  if (error) throw new Error(error.message === "ROW_LIMIT_EXCEEDED" ? "핀이 너무 많아 불러오지 못했어요." : error.message);

  const rows = (data ?? []) as unknown as { timeline_pins: RawPinRow | null }[];
  return enrichLocalizedPinTitles(
    rows.flatMap((row) => (row.timeline_pins ? [mapPinRow(row.timeline_pins)] : [])), getExternalContentDetail
  );
}

export async function createPin(input: PinInput): Promise<TimelinePin> {
  const { userId } = await getSessionUserId();

  if (!userId) throw new Error("로그인이 필요합니다");

  let identity = createIdentities.get(input);
  if (!identity) {
    identity = createPinSaveIdentity();
    createIdentities.set(input, identity);
  }
  return savePinAtomically(input.client_request_id ?? identity.getId(), input, true);
}

export async function updatePin(pinId: string, input: Omit<PinInput, "content_id" | "episode_id">) {
  const { userId } = await getSessionUserId();
  if (!userId) throw new Error("로그인이 필요합니다");
  return savePinAtomically(pinId, input, false);
}

async function savePinAtomically(pinId: string, input: PinInput | Omit<PinInput, "content_id" | "episode_id">, isCreate: boolean): Promise<TimelinePin> {
  const { data, error } = await supabase.rpc("save_timeline_pin", atomicPinSaveArgs(pinId, input, isCreate));
  // A missing RPC must not fall back to the former partially committing multi-write path.
  if (error) throw new Error(atomicPinSaveError(error));
  if (!data || typeof data !== "object" || Array.isArray(data) || data.id !== pinId) {
    throw new Error("핀 저장 결과를 확인하지 못했어요. 같은 화면에서 다시 시도해 주세요.");
  }
  return data as unknown as TimelinePin;
}

export async function deletePin(pinId: string): Promise<void> {
  const { error } = await supabase.from("timeline_pins").delete().eq("id", pinId);
  if (error) throw new Error(error.message);
}

function mapPins(rows: RawPinRow[] | null): TimelinePin[] {
  return (rows ?? []).map(mapPinRow);
}
