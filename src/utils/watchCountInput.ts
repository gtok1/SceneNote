/**
 * Save-button decision logic for the 본 횟수 field on the content detail screen.
 *
 * Extracted from the screen so it can be tested: the repo test runner only picks up
 * `.ts` files under `src/`, never `.tsx` or `app/`.
 */

/**
 * Migration 0010 installs a BEFORE INSERT/UPDATE trigger (`ensure_completed_watch_count`)
 * that rewrites `watch_count` below this floor to this floor for completed items. The
 * write reports success, so without a client-side guard the input silently snaps back
 * and the user sees nothing happen.
 */
export const COMPLETED_MINIMUM_WATCH_COUNT = 1;

export type WatchCountSaveState =
  | { kind: "savable"; value: number }
  | { kind: "unchanged" }
  | { kind: "below-completed-minimum"; minimum: number };

export function normalizeWatchCountInput(raw: string): number {
  const parsed = Number(raw.replace(/\D/gu, "") || "0");
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export function resolveWatchCountSaveState(
  raw: string,
  savedWatchCount: number,
  isCompleted: boolean
): WatchCountSaveState {
  const value = normalizeWatchCountInput(raw);

  // Checked before `unchanged` so a completed item sitting at an impossible value still
  // explains the floor rather than reporting "nothing to save".
  if (isCompleted && value < COMPLETED_MINIMUM_WATCH_COUNT) {
    return { kind: "below-completed-minimum", minimum: COMPLETED_MINIMUM_WATCH_COUNT };
  }

  if (value === savedWatchCount) return { kind: "unchanged" };

  return { kind: "savable", value };
}

export function describeWatchCountSaveState(state: WatchCountSaveState): string | null {
  switch (state.kind) {
    case "unchanged":
      return "저장할 변경사항이 없어요.";
    case "below-completed-minimum":
      return `완료한 작품은 최소 ${state.minimum}회예요. 0회로 두려면 완료 상태를 먼저 해제하세요.`;
    default:
      return null;
  }
}
