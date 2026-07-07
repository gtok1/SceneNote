import type { LibraryListItem, LibraryStatusFilter } from "@/types/library";
import type { ContentTypeFilter, RatingFilter } from "@/utils/libraryFilters";
import type { DateSortOrder } from "@/utils/contentSort";

export interface LibraryShareFilters {
  statusFilter: LibraryStatusFilter;
  contentTypeFilter: ContentTypeFilter;
  genreFilter: string;
  ratingFilter: RatingFilter;
  searchQuery: string;
  year: string;
  sortOrder: DateSortOrder;
}

export interface LibraryShareSummary {
  id: string;
  title: string;
  itemCount: number;
  createdAt: string;
}

export interface LibraryShareDetail extends LibraryShareSummary {
  ownerDisplayName: string;
  filters: LibraryShareFilters;
  items: LibraryListItem[];
}
