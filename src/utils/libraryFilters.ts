import { WATCH_STATUS_LABEL } from "@/constants/status";
import type { ContentType } from "@/types/content";
import type { LibraryListItem, LibraryStatusFilter } from "@/types/library";
import { filterByYear, normalizeYearFilter, sortByYear, type DateSortOrder } from "@/utils/contentSort";
import { ALL_GENRE_FILTER, matchesGenreFilter } from "@/utils/genre";

export type ContentTypeFilter = ContentType | "all";
export type RatingFilter = number | "all";

export interface LibraryFilterState {
  statusFilter: LibraryStatusFilter;
  contentTypeFilter: ContentTypeFilter;
  genreFilter: string;
  ratingFilter: RatingFilter;
  searchQuery: string;
  year: string;
  sortOrder: DateSortOrder;
}

export const STATUS_FILTERS: LibraryStatusFilter[] = [
  "all",
  "watching",
  "dropped",
  "wishlist",
  "completed",
  "recommended",
  "not_recommended"
];

export const CONTENT_TYPE_LABELS: Record<ContentTypeFilter, string> = {
  all: "전체",
  anime: "애니",
  kdrama: "한국 드라마",
  jdrama: "일본 드라마",
  movie: "영화",
  other: "기타"
};

export const CONTENT_TYPE_FILTERS: ContentTypeFilter[] = ["all", "anime", "kdrama", "jdrama", "movie", "other"];
export const RATING_FILTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function filterLibraryItems(items: LibraryListItem[], filters: LibraryFilterState): LibraryListItem[] {
  const normalizedSearchQuery = filters.searchQuery.trim().toLocaleLowerCase();
  const yearFilter = normalizeYearFilter(filters.year);
  const searchedItems = items.filter((item) => {
    const contentTypeMatches =
      filters.contentTypeFilter === "all" ? true : item.content_type === filters.contentTypeFilter;
    if (!contentTypeMatches) return false;
    if (!matchesGenreFilter(item.genres, filters.genreFilter)) return false;
    if (filters.ratingFilter !== "all" && item.rating !== filters.ratingFilter) return false;
    if (!normalizedSearchQuery) return true;

    const searchableText = [
      item.title_primary,
      item.title_original,
      ...(item.cast ?? []).flatMap((member) => [member.name, member.original_name, member.character])
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();

    return searchableText.includes(normalizedSearchQuery);
  });

  return sortByYear(filterByYear(searchedItems, yearFilter), filters.sortOrder);
}

export function createLibraryShareTitle(filters: LibraryFilterState): string {
  const parts = [
    filters.statusFilter === "all" ? "전체" : WATCH_STATUS_LABEL[filters.statusFilter],
    filters.contentTypeFilter === "all" ? "전체 작품" : CONTENT_TYPE_LABELS[filters.contentTypeFilter],
    filters.genreFilter === ALL_GENRE_FILTER ? "" : filters.genreFilter,
    filters.ratingFilter === "all" ? "" : `추천점수 ${filters.ratingFilter}/10`,
    filters.year.trim()
  ].filter(Boolean);

  return `${parts.join(" · ")} 공유`;
}
