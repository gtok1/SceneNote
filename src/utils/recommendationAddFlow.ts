export const RECOMMENDATION_REFILL_DEBOUNCE_MS = 800;
export const LIBRARY_REFRESH_DEBOUNCE_MS = 1_500;
export const RECOMMENDATION_TARGET_COUNT = 12;
export const RECOMMENDATION_ADDED_TOAST = "라이브러리에 추가했어요.";
export const RECOMMENDATION_ADD_FAILED_TOAST = "라이브러리에 추가하지 못했어요. 잠시 후 다시 시도해 주세요.";

export interface TimerApi {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

export function createTrailingScheduler(delayMs: number, timers: TimerApi): {
  schedule: (run: () => void) => void;
  cancel: () => void;
  isPending: () => boolean;
} {
  let handle: unknown;
  let pending = false;
  const cancel = () => {
    if (pending) timers.clear(handle);
    pending = false;
  };
  return {
    schedule(run) {
      cancel();
      pending = true;
      handle = timers.set(() => {
        pending = false;
        run();
      }, delayMs);
    },
    cancel,
    isPending: () => pending
  };
}

export function computeRefillLimit(visibleCount: number, target = RECOMMENDATION_TARGET_COUNT): number {
  const visible = Number.isFinite(visibleCount) && visibleCount > 0 ? Math.floor(visibleCount) : 0;
  return Math.max(0, Math.min(target, target - visible));
}

export function isRecommendationAddDisabled(input: {
  isPending: boolean;
  isAdded: boolean;
  isRefreshing: boolean;
}): boolean {
  return input.isPending || input.isAdded || input.isRefreshing;
}

/** Keep clicked cards as disabled slots until the user requests a new feed. */
export function retainRecommendationAddSlots<T extends { canonical_id: string }>(
  items: readonly T[],
  retained: readonly { item: T; index: number }[]
): T[] {
  const slots = [...new Map(retained.map(slot => [slot.item.canonical_id, slot])).values()]
    .sort((a, b) => a.index - b.index);
  const retainedIds = new Set(slots.map(slot => slot.item.canonical_id));
  const result = items.filter(item => !retainedIds.has(item.canonical_id));
  for (const slot of slots) result.splice(Math.max(0, Math.min(slot.index, result.length)), 0, slot.item);
  return result;
}

/** A recycled cell must not turn a press started on one title into another add. */
export function createRecommendationPressGuard() {
  let pressedIdentity: string | null = null;
  return {
    begin(identity: string) { pressedIdentity = identity; },
    consume(identity: string): boolean {
      const accepted = pressedIdentity === null || pressedIdentity === identity;
      pressedIdentity = null;
      return accepted;
    }
  };
}

export function createRecommendationAddLock() {
  const pending = new Set<string>();
  return {
    claim(identity: string): boolean {
      if (pending.has(identity)) return false;
      pending.add(identity);
      return true;
    },
    release(identity: string) { pending.delete(identity); }
  };
}

export function shouldDeferRecommendationRefill(input: {
  additionsInFlight: boolean;
  scheduled: boolean;
}): boolean {
  return input.additionsInFlight || input.scheduled;
}

export type RecommendationAddStatus = "wishlist" | "completed";
export const RECOMMENDATION_COMPLETED_TOAST = "완료로 기록했어요.";
export const RECOMMENDATION_COMPLETE_FAILED_TOAST = "완료로 기록하지 못했어요. 잠시 후 다시 시도해 주세요.";
export const RECOMMENDATION_ADD_HINT = "보고 싶음으로 라이브러리에 추가해요";
export const RECOMMENDATION_COMPLETE_HINT = "이미 본 작품으로 완료 처리해요";

export interface RecommendationActionState {
  addLabel: "추가" | "추가 중" | "추가됨";
  completeLabel: "완료" | "기록 중";
  disabled: boolean;
  busy: boolean;
}

export function getRecommendationActionState(input: {
  pendingStatus: RecommendationAddStatus | null;
  isAdded: boolean;
  isRefreshing: boolean;
}): RecommendationActionState {
  return {
    addLabel: input.pendingStatus === "wishlist" ? "추가 중" : input.isAdded ? "추가됨" : "추가",
    completeLabel: input.pendingStatus === "completed" ? "기록 중" : "완료",
    disabled: isRecommendationAddDisabled({ isPending: input.pendingStatus !== null, isAdded: input.isAdded, isRefreshing: input.isRefreshing }),
    busy: input.pendingStatus !== null
  };
}

export function recommendationAddSuccessToast(status: RecommendationAddStatus, title: string): string {
  const message = status === "completed" ? RECOMMENDATION_COMPLETED_TOAST : RECOMMENDATION_ADDED_TOAST;
  return title.trim() ? `${title.trim()} · ${message}` : message;
}

export function recommendationAddFailureToast(status: RecommendationAddStatus): string {
  return status === "completed" ? RECOMMENDATION_COMPLETE_FAILED_TOAST : RECOMMENDATION_ADD_FAILED_TOAST;
}
