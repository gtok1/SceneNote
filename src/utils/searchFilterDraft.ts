import type { MediaTypeFilter } from "../types/content";
import type { LibraryStatusFilter } from "../types/library";
import type { DateSortOrder } from "./contentSort";
export interface SearchFilterDraft { mediaType: MediaTypeFilter; countryFilter: string; genreFilter: string; statusFilter: LibraryStatusFilter; year: string; sortOrder: DateSortOrder }
export function createSearchFilterDraft(filters: SearchFilterDraft): SearchFilterDraft { return { ...filters }; }
export const emptySearchFilters: SearchFilterDraft = { mediaType: "all", countryFilter: "all", genreFilter: "all", statusFilter: "all", year: "", sortOrder: "latest" };
