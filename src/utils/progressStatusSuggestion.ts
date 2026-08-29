import type { WatchStatus } from "@/types/library";

export type ProgressStatusSuggestion = "mark_completed" | "mark_watching" | null;

export function getProgressStatusSuggestion(params: {
  statuses: WatchStatus[];
  absoluteWatchedThrough: number;
  totalEpisodes: number | null;
}): ProgressStatusSuggestion {
  if (
    params.totalEpisodes !== null
    && params.absoluteWatchedThrough >= params.totalEpisodes
    && !params.statuses.includes("completed")
  ) {
    return "mark_completed";
  }

  if (
    params.absoluteWatchedThrough > 0
    && params.statuses.includes("wishlist")
    && !params.statuses.includes("watching")
  ) {
    return "mark_watching";
  }

  return null;
}
