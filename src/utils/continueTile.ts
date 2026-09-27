import type { LibraryListItem } from "@/types/library";

import { createContinueWatchingLabel } from "./continueWatching";

export type ContinueTileSource = Pick<
  LibraryListItem,
  | "title_primary"
  | "content_type"
  | "episode_count"
  | "statuses"
  | "watched_episode_count"
  | "progress_source"
  | "effective_watched_through"
  | "next_episode_number"
>;

export interface ContinueTileModel {
  title: string;
  badge: { tone: "new" | "upcoming"; text: string } | null;
  progress: number | null;
  caption: string | null;
  cta: {
    text: string;
    icon: "play" | "flag" | "check";
    action: "open_episodes" | "open_progress_setting";
    accessibilityLabel: string;
  } | null;
}

export function createContinueTileModel(
  item: ContinueTileSource,
  airing: { availableCount: number; upcomingLabel: string | null },
): ContinueTileModel {
  const upcoming = airing.upcomingLabel?.trim();
  const date = upcoming?.match(/^\d{2}\.(\d{2})\.(\d{2}) 공개 예정$/);
  const badge: ContinueTileModel["badge"] = airing.availableCount > 0
    ? { tone: "new", text: `새 회차 ${airing.availableCount}` }
    : upcoming
      ? { tone: "upcoming", text: date ? `${date[1]}.${date[2]} 공개` : upcoming }
      : null;
  const model: ContinueTileModel = {
    title: item.title_primary,
    badge,
    progress: null,
    caption: null,
    cta: null,
  };
  const label = createContinueWatchingLabel(item);
  if (!label) return model;

  const watched = Math.max(0, item.effective_watched_through);
  const total = item.episode_count;
  let text: string;
  let icon: NonNullable<ContinueTileModel["cta"]>["icon"];

  if (item.progress_source === "none") {
    text = "위치 설정";
    icon = "flag";
  } else if (watched === 0) {
    text = "1화";
    icon = "play";
    model.progress = total !== null ? 0 : null;
    model.caption = total !== null ? `총 ${total}화` : null;
  } else if (total !== null && watched >= total) {
    text = "다 봤어요";
    icon = "check";
    model.progress = 1;
    model.caption = `${total}/${total}화`;
  } else {
    text = `${item.next_episode_number ?? watched + 1}화`;
    icon = "play";
    model.progress = total !== null && total > 0 ? Math.min(1, watched / total) : null;
    model.caption = total !== null ? `${watched}/${total}화` : `${watched}화까지 봄`;
  }

  model.cta = {
    text,
    icon,
    action: label.action,
    accessibilityLabel: label.accessibilityLabel,
  };
  return model;
}
