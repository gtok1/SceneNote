import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { addSearchHistoryEntry, removeSearchHistoryEntry } from "@/utils/searchHistory";

interface SearchHistoryState {
  queries: string[];
  addQuery: (query: string) => void;
  removeQuery: (query: string) => void;
  clear: () => void;
}

const canUsePersistentStorage = Platform.OS !== "web" || typeof window !== "undefined";
const noopStorage = {
  getItem: async (_name: string) => null,
  setItem: async (_name: string, _value: string) => undefined,
  removeItem: async (_name: string) => undefined
};

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      queries: [],
      addQuery: (query) => set((state) => ({ queries: addSearchHistoryEntry(state.queries, query) })),
      removeQuery: (query) => set((state) => ({ queries: removeSearchHistoryEntry(state.queries, query) })),
      clear: () => set({ queries: [] })
    }),
    {
      name: "scenenote-search-history",
      storage: createJSONStorage(() => (canUsePersistentStorage ? AsyncStorage : noopStorage))
    }
  )
);
