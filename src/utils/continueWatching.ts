import type { LibraryListItem } from "@/types/library";

type ContinueWatchingItem = Pick<
  LibraryListItem,
  | "content_type"
  | "episode_count"
  | "statuses"
  | "watched_episode_count"
  | "progress_source"
  | "effective_watched_through"
  | "next_episode_number"
>;

export interface ContinueWatchingLabel {
  text: string;
  action: "open_episodes" | "open_progress_setting";
  accessibilityLabel: string;
}

export function createContinueWatchingLabel(
  item: ContinueWatchingItem,
): ContinueWatchingLabel | null {
  if (!item.statuses.includes("watching") || item.content_type === "movie") return null;

  const source = item.progress_source;
  const watchedThrough = Math.max(0, item.effective_watched_through);
  const total = item.episode_count;

  if (source === "none") {
    return {
      text: "시청 위치 설정",
      action: "open_progress_setting",
      accessibilityLabel: "시청 위치가 설정되지 않았습니다. 시청 위치를 설정해 주세요.",
    };
  }

  if (watchedThrough === 0) {
    return total === null
      ? {
          text: "1화부터 시작",
          action: "open_episodes",
          accessibilityLabel: "아직 시청한 회차가 없습니다. 1화부터 시작합니다.",
        }
      : {
          text: `1화부터 시작 · 총 ${total}화`,
          action: "open_episodes",
          accessibilityLabel: `총 ${total}화입니다. 아직 시청한 회차가 없습니다. 1화부터 시작합니다.`,
        };
  }

  if (total !== null && watchedThrough >= total) {
    return {
      text: "모든 화 시청",
      action: "open_episodes",
      accessibilityLabel: `총 ${total}화를 모두 시청했습니다.`,
    };
  }

  const next = item.next_episode_number ?? watchedThrough + 1;
  if (total === null) {
    return {
      text: `다음: ${next}화`,
      action: "open_episodes",
      accessibilityLabel: `${watchedThrough}화까지 시청했습니다. 다음은 ${next}화입니다.`,
    };
  }

  return {
    text: `다음: ${next}화 · ${watchedThrough}/${total}화`,
    action: "open_episodes",
    accessibilityLabel: `${total}화 중 ${watchedThrough}화까지 시청했습니다. 다음은 ${next}화입니다.`,
  };
}
