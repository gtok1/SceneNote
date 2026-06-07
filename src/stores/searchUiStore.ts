import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MediaTypeFilter } from "@/types/content";
import type { LibraryStatusFilter } from "@/types/library";
import type { DateSortOrder } from "@/utils/contentSort";
import { ALL_GENRE_FILTER } from "@/utils/genre";

export type SearchViewMode = "detail" | "gallery";

interface SearchUiState {
  query: string;
  mediaType: MediaTypeFilter;
  statusFilter: LibraryStatusFilter;
  genreFilter: string;
  year: string;
  sortOrder: DateSortOrder;
  viewMode: SearchViewMode;
  setQuery: (query: string) => void;
  setMediaType: (mediaType: MediaTypeFilter) => void;
  setStatusFilter: (statusFilter: LibraryStatusFilter) => void;
  setGenreFilter: (genreFilter: string) => void;
  setYear: (year: string) => void;
  setSortOrder: (sortOrder: DateSortOrder) => void;
  setViewMode: (viewMode: SearchViewMode) => void;
  reset: () => void;
}

const canUsePersistentStorage = Platform.OS !== "web" || typeof window !== "undefined";
const noopStorage = {
  getItem: async (_name: string) => null,
  setItem: async (_name: string, _value: string) => undefined,
  removeItem: async (_name: string) => undefined
};

export const useSearchUiStore = create<SearchUiState>()(
  persist(
    (set) => ({
      query: "",
      mediaType: "all",
      statusFilter: "all",
      genreFilter: ALL_GENRE_FILTER,
      year: "",
      sortOrder: "latest",
      viewMode: "detail",
      setQuery: (query) => set({ query }),
      setMediaType: (mediaType) => set({ mediaType }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      setGenreFilter: (genreFilter) => set({ genreFilter }),
      setYear: (year) => set({ year: year.replace(/\D/g, "").slice(0, 4) }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      setViewMode: (viewMode) => set({ viewMode }),
      reset: () =>
        set({
          query: "",
          mediaType: "all",
          statusFilter: "all",
          genreFilter: ALL_GENRE_FILTER,
          year: "",
          sortOrder: "latest"
        })
    }),
    {
      name: "scenenote-search-ui",
      storage: createJSONStorage(() => (canUsePersistentStorage ? AsyncStorage : noopStorage)),
      partialize: (state) => ({ viewMode: state.viewMode })
    }
  )
);
