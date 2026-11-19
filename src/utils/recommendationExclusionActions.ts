export interface RecommendationExclusion {
  key: string;
  title: string;
  excludedAt: string;
}

export interface RecommendationExclusionSlice {
  excludedRecommendations: RecommendationExclusion[];
  excludedRecommendationKeys: string[];
}

export interface RecommendationExclusionActions {
  excludeRecommendation: (key: string, title?: string) => void;
  removeExclusion: (key: string) => void;
  clearExclusions: () => void;
}

export type RecommendationExclusionSet = (
  partial:
    | Partial<RecommendationExclusionSlice>
    | ((state: RecommendationExclusionSlice) => Partial<RecommendationExclusionSlice>)
) => void;

export function createRecommendationExclusionActions(
  set: RecommendationExclusionSet,
  now: () => Date = () => new Date()
): RecommendationExclusionActions {
  return {
    excludeRecommendation: (key, title = "제목 없는 작품") =>
      set((state) => {
        if (state.excludedRecommendations.some((item) => item.key === key)) return {};

        const excludedRecommendations = [
          ...state.excludedRecommendations,
          {
            key,
            title,
            excludedAt: now().toISOString()
          }
        ];

        return {
          excludedRecommendations,
          excludedRecommendationKeys: excludedRecommendations.map((item) => item.key)
        };
      }),
    removeExclusion: (key) =>
      set((state) => {
        const excludedRecommendations = state.excludedRecommendations.filter((item) => item.key !== key);
        return {
          excludedRecommendations,
          excludedRecommendationKeys: excludedRecommendations.map((item) => item.key)
        };
      }),
    clearExclusions: () =>
      set({
        excludedRecommendations: [],
        excludedRecommendationKeys: []
      })
  };
}
