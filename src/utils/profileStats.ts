import type { GenreStat } from "@/types/genre";
import type { LibraryListItem, WatchStatus } from "@/types/library";
import { getGenreDisplayName } from "@/utils/genre";
import {
  CONTENT_TYPE_FILTERS,
  CONTENT_TYPE_LABELS,
  libraryContentCategory,
  type LibraryContentCategory
} from "@/utils/libraryFilters";

export interface ContentTypeStat {
  type: LibraryContentCategory;
  label: string;
  count: number;
  percent: number;
}

/** 프로필 숫자 카드의 단일 출처. 등록 = 본 작품 + 보고 싶음, 완료 ⊂ 본 작품. */
export interface LibraryStatusSummary {
  total: number;
  watched: number;
  wishlistOnly: number;
  completed: number;
  watchedNotCompleted: number;
}

export const WATCHED_STATUSES = new Set<WatchStatus>([
  "watching",
  "completed",
  "recommended",
  "not_recommended",
  "dropped"
]);

const CONTENT_TYPE_STAT_ORDER = CONTENT_TYPE_FILTERS.filter(
  (type): type is LibraryContentCategory => type !== "all"
);

export function createContentTypeStats(items: LibraryListItem[]): ContentTypeStat[] {
  const total = items.length;
  const counts = new Map<LibraryContentCategory, number>();

  items.forEach((item) => {
    const category = libraryContentCategory(item);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  });

  return CONTENT_TYPE_STAT_ORDER.map((type) => {
    const count = counts.get(type) ?? 0;
    return {
      type,
      label: CONTENT_TYPE_LABELS[type],
      count,
      percent: total > 0 ? (count / total) * 100 : 0
    };
  });
}

export function createDisplayGenreStats(stats: GenreStat[]): GenreStat[] {
  const counts = new Map<string, number>();

  stats.forEach((stat) => {
    const displayName = getGenreDisplayName(stat.genre_name);
    if (!displayName) return;

    counts.set(displayName, (counts.get(displayName) ?? 0) + Number(stat.count));
  });

  return Array.from(counts, ([genre_name, count]) => ({ genre_name, count })).sort(
    (a, b) => b.count - a.count || a.genre_name.localeCompare(b.genre_name, "ko-KR")
  );
}

export function createLibraryStatusSummary(items: readonly LibraryListItem[]): LibraryStatusSummary {
  let watched = 0;
  let completed = 0;

  items.forEach((item) => {
    if (!isWatchedLibraryItem(item)) return;
    watched += 1;
    if (item.statuses.includes("completed")) completed += 1;
  });

  return {
    total: items.length,
    watched,
    wishlistOnly: items.length - watched,
    completed,
    watchedNotCompleted: watched - completed
  };
}

export function countCurrentYearWatchedItems(
  items: LibraryListItem[],
  now = new Date()
): number | null {
  const watchedDateItems = items.filter((item) => yearFromDate(item.last_watched_at));
  if (watchedDateItems.length === 0) return null;

  const currentYear = now.getFullYear();
  return countWatchedInYear(watchedDateItems, currentYear);
}

function countWatchedInYear(items: LibraryListItem[], year: number): number {
  return items.filter((item) => isWatchedLibraryItem(item) && yearFromDate(item.last_watched_at) === year)
    .length;
}

export function isWatchedLibraryItem(item: LibraryListItem): boolean {
  if ((item.watch_count ?? 0) > 0) return true;
  return item.statuses.some((status) => WATCHED_STATUSES.has(status));
}

export function yearFromDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const year = new Date(value).getFullYear();
  return Number.isFinite(year) ? year : null;
}

export function displayNameFromEmail(email: string | null | undefined): string {
  const localPart = email?.split("@")[0]?.trim();
  return localPart || "SceneNote 사용자";
}
