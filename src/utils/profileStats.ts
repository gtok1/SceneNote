import type { ContentType } from "@/types/content";
import type { GenreStat } from "@/types/genre";
import type { LibraryListItem, WatchStatus } from "@/types/library";
import { getGenreDisplayName } from "@/utils/genre";
import { CONTENT_TYPE_FILTERS, CONTENT_TYPE_LABELS } from "@/utils/libraryFilters";

export interface ContentTypeStat {
  type: ContentType;
  label: string;
  count: number;
  percent: number;
}

export interface CurrentYearSummary {
  label: "올해 본 작품" | "올해 등록";
  value: number;
  source: "watched_at" | "added_at";
}

export const WATCHED_STATUSES = new Set<WatchStatus>([
  "watching",
  "completed",
  "recommended",
  "not_recommended",
  "dropped"
]);

const CONTENT_TYPE_STAT_ORDER = CONTENT_TYPE_FILTERS.filter(
  (type): type is ContentType => type !== "all"
);

export function createContentTypeStats(items: LibraryListItem[]): ContentTypeStat[] {
  const total = items.length;
  const counts = new Map<ContentType, number>();

  items.forEach((item) => {
    counts.set(item.content_type, (counts.get(item.content_type) ?? 0) + 1);
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

export function createCurrentYearSummary(
  items: LibraryListItem[],
  now = new Date()
): CurrentYearSummary {
  const currentYear = now.getFullYear();
  const watchedDateItems = items.filter((item) => yearFromDate(item.last_watched_at));

  if (watchedDateItems.length > 0) {
    return {
      label: "올해 본 작품",
      source: "watched_at",
      value: watchedDateItems.filter((item) => yearFromDate(item.last_watched_at) === currentYear).length
    };
  }

  return {
    label: "올해 등록",
    source: "added_at",
    value: items.filter((item) => yearFromDate(item.added_at) === currentYear).length
  };
}

export function countCurrentYearWatchedItems(
  items: LibraryListItem[],
  now = new Date()
): number | null {
  const watchedDateItems = items.filter((item) => yearFromDate(item.last_watched_at));
  if (watchedDateItems.length === 0) return null;

  const currentYear = now.getFullYear();
  return watchedDateItems.filter((item) => yearFromDate(item.last_watched_at) === currentYear).length;
}

export function countItemsWithWatchedDate(items: LibraryListItem[]): number {
  return items.filter((item) => yearFromDate(item.last_watched_at)).length;
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
