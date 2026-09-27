import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useAuthStore } from "@/stores/authStore";
import { createSearchFilterDraft, emptySearchFilters, type SearchFilterDraft } from "@/utils/searchFilterDraft";
import { getSearchAccountTransition } from "@/utils/searchFilterPreferences";

export type SearchViewMode = "detail" | "gallery";

interface SearchUiState extends SearchFilterDraft {
  query: string;
  accountUserId: string | null;
  accountRevision: number;
  filterUserId: string | null;
  viewMode: SearchViewMode;
  setQuery: (query: string) => void;
  beginAccount: (userId: string | null) => void;
  hydrateFilters: (userId: string, filters: SearchFilterDraft) => void;
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
    (set, get) => ({
      ...createSearchFilterDraft(emptySearchFilters),
      query: "",
      accountUserId: useAuthStore.getState().user?.id ?? null,
      accountRevision: 0,
      filterUserId: null,
      viewMode: "detail",
      setQuery: (query) => set({ query }),
      beginAccount: (userId) => {
        const transition = getSearchAccountTransition(get(), userId);
        if (transition) set(transition);
      },
      hydrateFilters: (userId, filters) => {
        if (useAuthStore.getState().user?.id !== userId || get().accountUserId !== userId) return;
        set({ ...createSearchFilterDraft(filters), filterUserId: userId });
      },
      setViewMode: (viewMode) => set({ viewMode }),
      reset: () =>
        set({
          ...createSearchFilterDraft(emptySearchFilters), query: "", filterUserId: null
        })
    }),
    {
      name: "scenenote-search-ui",
      storage: createJSONStorage(() => (canUsePersistentStorage ? AsyncStorage : noopStorage)),
      partialize: (state) => ({ viewMode: state.viewMode })
    }
  )
);

// Keep account ownership correct even when the search screen is not mounted.
useAuthStore.subscribe((state, previous) => {
  const userId = state.user?.id ?? null;
  if (userId !== (previous.user?.id ?? null)) useSearchUiStore.getState().beginAccount(userId);
});
