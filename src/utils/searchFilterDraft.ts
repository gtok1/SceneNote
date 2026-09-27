import type { MediaTypeFilter } from "../types/content";
import type { LibraryStatusFilter } from "../types/library";
import type { DateSortOrder } from "./contentSort";
export type SelectedSearchMediaType = Exclude<MediaTypeFilter, "all">;

export interface SearchFilterDraft {
  mediaTypes: SelectedSearchMediaType[];
  genreFilters: string[];
  countryFilters: string[];
  statusFilter: LibraryStatusFilter;
  year: string;
  sortOrder: DateSortOrder;
}

/** Draft arrays never share references with the applied or default values. */
export function createSearchFilterDraft(filters: SearchFilterDraft): SearchFilterDraft {
  return {
    ...filters,
    mediaTypes: [...filters.mediaTypes],
    genreFilters: [...filters.genreFilters],
    countryFilters: [...filters.countryFilters]
  };
}

export const emptySearchFilters: SearchFilterDraft = {
  mediaTypes: [], genreFilters: [], countryFilters: [],
  statusFilter: "all", year: "", sortOrder: "latest"
};
