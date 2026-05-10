import { create } from "zustand";

import type { MediaTypeFilter } from "@/types/content";
import type { LibraryStatusFilter } from "@/types/library";
import type { DateSortOrder } from "@/utils/contentSort";
import { ALL_GENRE_FILTER } from "@/utils/genre";

interface SearchUiState {
  query: string;
  mediaType: MediaTypeFilter;
  statusFilter: LibraryStatusFilter;
  genreFilter: string;
  year: string;
  sortOrder: DateSortOrder;
  setQuery: (query: string) => void;
  setMediaType: (mediaType: MediaTypeFilter) => void;
  setStatusFilter: (statusFilter: LibraryStatusFilter) => void;
  setGenreFilter: (genreFilter: string) => void;
  setYear: (year: string) => void;
  setSortOrder: (sortOrder: DateSortOrder) => void;
  reset: () => void;
}

export const useSearchUiStore = create<SearchUiState>((set) => ({
  query: "",
  mediaType: "all",
  statusFilter: "all",
  genreFilter: ALL_GENRE_FILTER,
  year: "",
  sortOrder: "latest",
  setQuery: (query) => set({ query }),
  setMediaType: (mediaType) => set({ mediaType }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setGenreFilter: (genreFilter) => set({ genreFilter }),
  setYear: (year) => set({ year: year.replace(/\D/g, "").slice(0, 4) }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  reset: () =>
    set({
      query: "",
      mediaType: "all",
      statusFilter: "all",
      genreFilter: ALL_GENRE_FILTER,
      year: "",
      sortOrder: "latest"
    })
}));
