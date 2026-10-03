import { normalizeWatchStatuses } from "@/constants/status";
import type { WatchStatus } from "@/types/library";
import { PRIMARY_WATCH_STATUSES } from "@/utils/contentDetailView";

const PRIMARY_WATCH_STATUS_SET = new Set<WatchStatus>(PRIMARY_WATCH_STATUSES);

export function createNextWatchStatuses(currentStatuses: readonly WatchStatus[], targetStatus: WatchStatus): WatchStatus[] {
  const current = normalizeWatchStatuses(currentStatuses);
  const active = current.includes(targetStatus);

  if (PRIMARY_WATCH_STATUS_SET.has(targetStatus)) {
    if (active) return current;
    return normalizeWatchStatuses([
      targetStatus,
      ...current.filter((status) => !PRIMARY_WATCH_STATUS_SET.has(status))
    ]);
  }

  if (active) {
    const next = current.filter((status) => status !== targetStatus);
    return next.length ? normalizeWatchStatuses(next) : current;
  }

  return normalizeWatchStatuses([...current, targetStatus]);
}

export function areSameWatchStatuses(left: readonly WatchStatus[], right: readonly WatchStatus[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((status) => rightSet.has(status));
}

