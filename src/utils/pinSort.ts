import type { PinSortMode, TimelinePin } from "../types/pins";

type ScenePin = Pick<TimelinePin, "id" | "season_number" | "episode_number" | "timestamp_seconds" | "created_at">;
type ListPin = ScenePin & Pick<TimelinePin, "content_id" | "content_title">;

function compareOptionalNumber(a: number | null | undefined, b: number | null | undefined, nullsLast = false): number {
  if (a == null && b == null) return 0;
  if (a == null) return nullsLast ? 1 : -1;
  if (b == null) return nullsLast ? -1 : 1;
  return a - b;
}

export function compareScenePins(a: ScenePin, b: ScenePin): number {
  return compareOptionalNumber(a.season_number, b.season_number)
    || compareOptionalNumber(a.episode_number, b.episode_number)
    || compareOptionalNumber(a.timestamp_seconds, b.timestamp_seconds, true)
    || a.created_at.localeCompare(b.created_at)
    || a.id.localeCompare(b.id);
}

export function sortPinsByScene<T extends ScenePin>(pins: readonly T[]): T[] {
  return [...pins].sort(compareScenePins);
}

export function sortPins<T extends ListPin>(pins: readonly T[], mode: PinSortMode): T[] {
  return [...pins].sort(mode === "latest"
    ? (a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)
    : (a, b) => (a.content_title ?? "").localeCompare(b.content_title ?? "", "ko")
      || a.content_id.localeCompare(b.content_id)
      || compareScenePins(a, b));
}
