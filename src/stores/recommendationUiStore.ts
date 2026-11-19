import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  createRecommendationExclusionActions,
  type RecommendationExclusion,
  type RecommendationExclusionActions,
  type RecommendationExclusionSlice
} from "@/utils/recommendationExclusionActions";

export type { RecommendationExclusion } from "@/utils/recommendationExclusionActions";

type RecommendationUiState = RecommendationExclusionSlice & RecommendationExclusionActions;

const canUsePersistentStorage = Platform.OS !== "web" || typeof window !== "undefined";
const noopStorage = {
  getItem: async (_name: string) => null,
  setItem: async (_name: string, _value: string) => undefined,
  removeItem: async (_name: string) => undefined
};

export const useRecommendationUiStore = create<RecommendationUiState>()(
  persist(
    (set) => ({
      excludedRecommendations: [],
      excludedRecommendationKeys: [],
      ...createRecommendationExclusionActions(set)
    }),
    {
      name: "scenenote-recommendation-ui",
      version: 2,
      migrate: (persistedState) => migrateRecommendationUiState(persistedState),
      storage: createJSONStorage(() => (canUsePersistentStorage ? AsyncStorage : noopStorage))
    }
  )
);

function migrateRecommendationUiState(persistedState: unknown): Partial<RecommendationUiState> {
  const legacyState = persistedState as Partial<RecommendationUiState> & {
    excludedRecommendationKeys?: unknown;
    excludedRecommendations?: unknown;
  };
  const excludedRecommendations = normalizeExcludedRecommendations(
    legacyState.excludedRecommendations,
    legacyState.excludedRecommendationKeys
  );

  return {
    excludedRecommendations,
    excludedRecommendationKeys: excludedRecommendations.map((item) => item.key)
  };
}

function normalizeExcludedRecommendations(
  currentValue: unknown,
  legacyKeys: unknown
): RecommendationExclusion[] {
  if (Array.isArray(currentValue)) {
    return currentValue
      .map((item): RecommendationExclusion | null => {
        if (!item || typeof item !== "object") return null;
        const candidate = item as Partial<RecommendationExclusion>;
        if (!candidate.key) return null;
        return {
          key: candidate.key,
          title: candidate.title?.trim() || "제목 없는 작품",
          excludedAt: candidate.excludedAt ?? new Date(0).toISOString()
        };
      })
      .filter((item): item is RecommendationExclusion => Boolean(item));
  }

  if (!Array.isArray(legacyKeys)) return [];

  return legacyKeys
    .filter((key): key is string => typeof key === "string" && key.length > 0)
    .map((key) => ({
      key,
      title: key,
      excludedAt: new Date(0).toISOString()
    }));
}
