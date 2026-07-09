import type { LibraryViewMode } from "@/stores/libraryUiStore";
import type { LibraryStatusFilter } from "@/types/library";
import type { DateSortOrder } from "@/utils/contentSort";
import { ALL_GENRE_FILTER } from "@/utils/genre";
import {
  CONTENT_TYPE_FILTERS,
  RATING_FILTERS,
  STATUS_FILTERS,
  type ContentTypeFilter,
  type LibraryFilterState,
  type RatingFilter
} from "@/utils/libraryFilters";

export type LibraryRouteParams = Record<string, string>;

export interface LibraryRouteState extends LibraryFilterState {
  viewMode?: LibraryViewMode | undefined;
}

type RawRouteParams = Record<string, string | string[] | undefined>;

const SORT_ORDERS: DateSortOrder[] = ["latest", "oldest"];
const VIEW_MODES: LibraryViewMode[] = ["detail", "gallery"];

export function createLibraryRouteParams(
  filters: LibraryFilterState,
  viewMode?: LibraryViewMode
): LibraryRouteParams {
  const params: LibraryRouteParams = {
    status: filters.statusFilter,
    libraryType: filters.contentTypeFilter,
    genre: filters.genreFilter,
    rating: String(filters.ratingFilter),
    sort: filters.sortOrder
  };

  if (filters.searchQuery.trim()) params.q = filters.searchQuery.trim();
  if (filters.year.trim()) params.year = filters.year.trim();
  if (viewMode) params.view = viewMode;

  return params;
}

export function parseLibraryRouteParams(params: RawRouteParams): LibraryRouteState {
  const state: LibraryRouteState = {
    statusFilter: parseStatusFilter(params.status),
    contentTypeFilter: parseContentTypeFilter(params.libraryType),
    genreFilter: parseGenreFilter(params.genre),
    ratingFilter: parseRatingFilter(params.rating),
    searchQuery: readParam(params.q),
    year: parseYear(readParam(params.year)),
    sortOrder: parseSortOrder(params.sort)
  };

  const viewMode = parseViewMode(params.view);
  if (viewMode) state.viewMode = viewMode;

  return state;
}

function readParam(value: string | string[] | undefined): string {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected?.trim() ?? "";
}

function parseStatusFilter(value: string | string[] | undefined): LibraryStatusFilter {
  const selected = readParam(value);
  return STATUS_FILTERS.includes(selected as LibraryStatusFilter) ? (selected as LibraryStatusFilter) : "all";
}

function parseContentTypeFilter(value: string | string[] | undefined): ContentTypeFilter {
  const selected = readParam(value);
  return CONTENT_TYPE_FILTERS.includes(selected as ContentTypeFilter) ? (selected as ContentTypeFilter) : "all";
}

function parseGenreFilter(value: string | string[] | undefined): string {
  return readParam(value) || ALL_GENRE_FILTER;
}

function parseRatingFilter(value: string | string[] | undefined): RatingFilter {
  const selected = readParam(value);
  if (selected === "all") return "all";
  const rating = Number(selected);
  return RATING_FILTERS.includes(rating as (typeof RATING_FILTERS)[number]) ? rating : "all";
}

function parseYear(value: string): string {
  return /^\d{4}$/.test(value) ? value : "";
}

function parseSortOrder(value: string | string[] | undefined): DateSortOrder {
  const selected = readParam(value);
  return SORT_ORDERS.includes(selected as DateSortOrder) ? (selected as DateSortOrder) : "latest";
}

function parseViewMode(value: string | string[] | undefined): LibraryViewMode | undefined {
  const selected = readParam(value);
  return VIEW_MODES.includes(selected as LibraryViewMode) ? (selected as LibraryViewMode) : undefined;
}
