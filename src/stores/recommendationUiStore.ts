import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface RecommendationUiState {
  excludedRecommendationKeys: string[];
  excludeRecommendation: (key: string) => void;
}

const canUsePersistentStorage = Platform.OS !== "web" || typeof window !== "undefined";
const noopStorage = {
  getItem: async (_name: string) => null,
  setItem: async (_name: string, _value: string) => undefined,
  removeItem: async (_name: string) => undefined
};

export const useRecommendationUiStore = create<RecommendationUiState>()(
  persist(
    (set) => ({
      excludedRecommendationKeys: [],
      excludeRecommendation: (key) =>
        set((state) => {
          if (state.excludedRecommendationKeys.includes(key)) return {};
          return { excludedRecommendationKeys: [...state.excludedRecommendationKeys, key] };
        })
    }),
    {
      name: "scenenote-recommendation-ui",
      storage: createJSONStorage(() => (canUsePersistentStorage ? AsyncStorage : noopStorage))
    }
  )
);
