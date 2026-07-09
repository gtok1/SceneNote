import type { LibraryListItem } from "@/types/library";

type ContinueWatchingItem = Pick<
  LibraryListItem,
  "content_type" | "episode_count" | "next_episode_number" | "statuses" | "watched_episode_count"
>;

export function createContinueWatchingLabel(item: ContinueWatchingItem): string | null {
  if (!item.statuses.includes("watching")) return null;
  if (item.content_type === "movie") return null;

  const watchedCount = Math.max(0, item.watched_episode_count);
  if (watchedCount === 0) return "1화부터 시작";

  if (item.next_episode_number !== null) {
    const nextLabel = `다음: ${item.next_episode_number}화`;
    if (!item.episode_count) return nextLabel;
    return `${nextLabel} · ${watchedCount}/${item.episode_count}화 시청`;
  }

  if (item.episode_count && watchedCount >= item.episode_count) {
    return "모든 화 시청";
  }

  return null;
}
