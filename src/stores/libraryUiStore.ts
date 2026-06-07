import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type LibraryViewMode = "detail" | "gallery";

interface LibraryUiState {
  viewMode: LibraryViewMode;
  setViewMode: (viewMode: LibraryViewMode) => void;
}

const canUsePersistentStorage = Platform.OS !== "web" || typeof window !== "undefined";
const noopStorage = {
  getItem: async (_name: string) => null,
  setItem: async (_name: string, _value: string) => undefined,
  removeItem: async (_name: string) => undefined
};

export const useLibraryUiStore = create<LibraryUiState>()(
  persist(
    (set) => ({
      viewMode: "detail",
      setViewMode: (viewMode) => set({ viewMode })
    }),
    {
      name: "scenenote-library-ui",
      storage: createJSONStorage(() => (canUsePersistentStorage ? AsyncStorage : noopStorage))
    }
  )
);
