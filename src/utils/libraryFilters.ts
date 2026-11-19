import { WATCH_STATUS_LABEL } from "@/constants/status";
import type { ContentType } from "@/types/content";
import type { LibraryListItem, LibraryStatusFilter } from "@/types/library";
import { filterByYear, normalizeYearFilter, sortByYear, type DateSortOrder } from "@/utils/contentSort";
import { ALL_GENRE_FILTER, createDisplayGenreNames } from "@/utils/genre";
import { hasJapaneseOriginalTitle, hasNonDramaGenre } from "../../supabase/functions/_shared/dramaClassification";

export type ContentTypeFilter = ContentType | "all" | "foreign_drama";
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
  foreign_drama: "해외 드라마",
  movie: "영화",
  other: "기타"
};

export const CONTENT_TYPE_FILTERS: ContentTypeFilter[] = [
  "all",
  "anime",
  "kdrama",
  "jdrama",
  "foreign_drama",
  "movie",
  "other"
];
export const RATING_FILTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function parseGenreFilters(value: string): string[] {
  if (!value || value === ALL_GENRE_FILTER) return [];
  return Array.from(new Set(value.split("|").map((genre) => genre.trim()).filter(Boolean)));
}

export function serializeGenreFilters(genres: readonly string[]): string {
  const normalized = Array.from(new Set(genres.map((genre) => genre.trim()).filter(Boolean)));
  return normalized.length ? normalized.join("|") : ALL_GENRE_FILTER;
}

export function filterLibraryItemsByStatus(items: LibraryListItem[], status: LibraryStatusFilter): LibraryListItem[] {
  return status === "all" ? items : items.filter((item) => item.statuses.includes(status));
}

export function filterLibraryItems(items: LibraryListItem[], filters: LibraryFilterState): LibraryListItem[] {
  const normalizedSearchQuery = filters.searchQuery.trim().toLocaleLowerCase();
  const compactSearchQuery = normalizedSearchQuery.replace(/\s+/gu, "");
  const yearFilter = normalizeYearFilter(filters.year);
  const selectedGenres = parseGenreFilters(filters.genreFilter);
  const searchedItems = items.filter((item) => {
    const contentTypeMatches = matchesContentTypeFilter(item, filters.contentTypeFilter);
    if (!contentTypeMatches) return false;
    if (selectedGenres.length) {
      const itemGenres = createDisplayGenreNames(item.genres);
      if (!selectedGenres.some((genre) => itemGenres.includes(genre))) return false;
    }
    if (filters.ratingFilter !== "all" && item.rating !== filters.ratingFilter) return false;
    if (!normalizedSearchQuery) return true;

    const searchableFields = [
      item.title_primary,
      item.title_original,
      ...(item.crew ?? []).flatMap((member) => [member.name, member.original_name]),
      ...(item.cast ?? []).flatMap((member) => [member.name, member.original_name, member.character])
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLocaleLowerCase());

    return searchableFields.join(" ").includes(normalizedSearchQuery) ||
      searchableFields.some((value) => value.replace(/\s+/gu, "").includes(compactSearchQuery));
  });

  return sortByYear(filterByYear(searchedItems, yearFilter), filters.sortOrder);
}

export function createLibraryShareTitle(filters: LibraryFilterState): string {
  const parts = [
    filters.statusFilter === "all" ? "전체" : WATCH_STATUS_LABEL[filters.statusFilter],
    filters.contentTypeFilter === "all" ? "전체 작품" : CONTENT_TYPE_LABELS[filters.contentTypeFilter],
    parseGenreFilters(filters.genreFilter).join(", "),
    filters.ratingFilter === "all" ? "" : `추천점수 ${filters.ratingFilter}/10`,
    filters.year.trim()
  ].filter(Boolean);

  return `${parts.join(" · ")} 공유`;
}

export type LibraryContentCategory = Exclude<ContentTypeFilter, "all">;

export function libraryContentCategory(
  item: Pick<LibraryListItem, "content_type" | "genres"> &
    Partial<Pick<LibraryListItem, "source_api" | "title_original">>
): LibraryContentCategory {
  if (item.content_type === "movie" || item.content_type === "anime") return item.content_type;

  const genres = createDisplayGenreNames(item.genres);
  // Older metadata classified every KR/JP TV show as a drama, including variety shows.
  if (hasNonDramaGenre(genres)) return "other";

  // Co-productions can be stored as kdrama despite a Japanese original title (docs/81).
  // Use actual kana letters, not punctuation or a translated display title. Keep ambiguous cases.
  if (item.content_type === "kdrama" && item.source_api === "tmdb" &&
    hasJapaneseOriginalTitle(item.title_original)) {
    return "jdrama";
  }

  if (item.content_type !== "other") return item.content_type;
  return genres.includes("드라마") ? "foreign_drama" : "other";
}

function matchesContentTypeFilter(item: LibraryListItem, filter: ContentTypeFilter): boolean {
  if (filter === "all") return true;
  return libraryContentCategory(item) === filter;
}
