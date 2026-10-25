import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PinViewMode } from "@/types/pins";

interface PinsUiState {
  viewMode: PinViewMode;
  setViewMode: (viewMode: PinViewMode) => void;
}

const canUsePersistentStorage = Platform.OS !== "web" || typeof window !== "undefined";
const noopStorage = {
  getItem: async (_name: string) => null,
  setItem: async (_name: string, _value: string) => undefined,
  removeItem: async (_name: string) => undefined
};

export const usePinsUiStore = create<PinsUiState>()(
  persist(
    (set) => ({
      viewMode: "gallery",
      setViewMode: (viewMode) => set({ viewMode })
    }),
    {
      name: "scenenote-pins-ui",
      version: 1,
      migrate: () => ({ viewMode: "gallery" as const }),
      storage: createJSONStorage(() => (canUsePersistentStorage ? AsyncStorage : noopStorage))
    }
  )
);
