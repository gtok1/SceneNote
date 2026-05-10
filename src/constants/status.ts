import type { WatchStatus } from "@/types/library";

export const WATCH_STATUS_LABEL: Record<WatchStatus, string> = {
  wishlist: "보고 싶음",
  watching: "보는 중",
  completed: "완료",
  recommended: "추천",
  not_recommended: "비추천",
  dropped: "삭제됨"
};

export const WATCH_STATUS_OPTIONS: WatchStatus[] = [
  "wishlist",
  "watching",
  "completed",
  "recommended",
  "not_recommended"
];

export const DEPRECATED_WATCH_STATUS_OPTIONS: WatchStatus[] = ["dropped"];

const WATCH_STATUS_ORDER = new Map(WATCH_STATUS_OPTIONS.map((status, index) => [status, index]));

export function normalizeWatchStatuses(statuses: readonly WatchStatus[] | null | undefined): WatchStatus[] {
  return Array.from(new Set(statuses ?? [])).filter((status) => !DEPRECATED_WATCH_STATUS_OPTIONS.includes(status)).sort(
    (a, b) => (WATCH_STATUS_ORDER.get(a) ?? 0) - (WATCH_STATUS_ORDER.get(b) ?? 0)
  );
}

export function getPrimaryWatchStatus(statuses: readonly WatchStatus[]): WatchStatus | null {
  return normalizeWatchStatuses(statuses)[0] ?? null;
}
