import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useAuthStore } from "@/stores/authStore";
import {
  addSearchHistoryEntry, removeSearchHistoryEntry, getAccountSearchHistory,
  normalizeAccountSearchHistory, updateAccountSearchHistory, type AccountSearchHistory
} from "@/utils/searchHistory";

interface SearchHistoryState extends AccountSearchHistory {
  ownerId: string | null;
  hasHydrated: boolean;
  queries: string[];
  setUser: (userId: string | null) => void;
  setHydrated: () => void;
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
      ownerId: null,
      hasHydrated: false,
      queriesByUserId: {},
      legacyQueries: [],
      queries: [],
      setUser: (ownerId) => set((state) => ({ ownerId, queries: getAccountSearchHistory(state, ownerId) })),
      setHydrated: () => set({ hasHydrated: true }),
      addQuery: (query) => set((state) => {
        const userId = useAuthStore.getState().user?.id ?? null;
        if (userId !== state.ownerId) return state;
        const next = updateAccountSearchHistory(state, userId, (queries) => addSearchHistoryEntry(queries, query));
        return { ...next, queries: getAccountSearchHistory(next, userId) };
      }),
      removeQuery: (query) => set((state) => {
        const userId = useAuthStore.getState().user?.id ?? null;
        if (userId !== state.ownerId) return state;
        const next = updateAccountSearchHistory(state, userId, (queries) => removeSearchHistoryEntry(queries, query));
        return { ...next, queries: getAccountSearchHistory(next, userId) };
      }),
      clear: () => set((state) => {
        const userId = useAuthStore.getState().user?.id ?? null;
        if (userId !== state.ownerId) return state;
        const next = updateAccountSearchHistory(state, userId, () => []);
        return { ...next, queries: getAccountSearchHistory(next, userId) };
      })
    }),
    {
      name: "scenenote-search-history",
      version: 1,
      storage: createJSONStorage(() => (canUsePersistentStorage ? AsyncStorage : noopStorage)),
      partialize: (state) => ({ queriesByUserId: state.queriesByUserId, legacyQueries: state.legacyQueries }),
      migrate: (persisted) => normalizeAccountSearchHistory(persisted),
      merge: (persisted, current) => {
        const saved = normalizeAccountSearchHistory(persisted);
        const next = { ...current, ...saved, queriesByUserId: { ...saved.queriesByUserId, ...current.queriesByUserId } };
        return { ...next, queries: getAccountSearchHistory(next, current.ownerId) };
      },
      onRehydrateStorage: () => (state) => (state ?? useSearchHistoryStore.getState()).setHydrated()
    }
  )
);

useAuthStore.subscribe((state, previous) => {
  const userId = state.user?.id ?? null;
  if (userId !== (previous.user?.id ?? null)) useSearchHistoryStore.getState().setUser(userId);
});
