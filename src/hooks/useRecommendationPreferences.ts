import { useRef } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getRecommendationExclusions, setRecommendationExclusion } from "@/services/recommendationPreferences";
import { useAuthStore } from "@/stores/authStore";
import {
  recommendationExclusionTargetKey,
  updateRecommendationExclusions,
  type RecommendationExclusionPreferences,
  type RecommendationExclusionTargetType
} from "@/utils/recommendationPreferences";

interface ExclusionMutation {
  userId: string;
  targetType: RecommendationExclusionTargetType;
  targetKey: string;
  excluded: boolean;
}

const EMPTY_PREFERENCES: RecommendationExclusionPreferences = {
  excludedThemeKeys: [],
  excludedGenres: []
};

function preferenceQueryKey(userId: string) {
  return ["recommendation-preferences", userId] as const;
}

export function useRecommendationPreferences() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const pendingToggle = useRef(false);
  const queryKey = preferenceQueryKey(userId ?? "anonymous");

  const query = useQuery({
    queryKey,
    queryFn: () => getRecommendationExclusions(userId ?? ""),
    enabled: Boolean(userId),
    retry: 1,
    staleTime: 0,
    refetchOnMount: "always"
  });

  const mutation = useMutation({
    mutationFn: (input: ExclusionMutation) =>
      setRecommendationExclusion(input.userId, input.targetType, input.targetKey, input.excluded),
    onMutate: async (input) => {
      // Prevent an older in-flight read from replacing the successful write in cache.
      await queryClient.cancelQueries({ queryKey: preferenceQueryKey(input.userId), exact: true });
    },
    onSuccess: (_data, input) => {
      const key = preferenceQueryKey(input.userId);
      queryClient.setQueryData<RecommendationExclusionPreferences>(key, (current) =>
        updateRecommendationExclusions(
          current ?? EMPTY_PREFERENCES,
          input.targetType,
          input.targetKey,
          input.excluded
        )
      );
      void queryClient.invalidateQueries({ queryKey: key, refetchType: "inactive" });
      void queryClient.invalidateQueries({ queryKey: ["recommendations", input.userId] });
    }
  });

  async function toggle(targetType: RecommendationExclusionTargetType, key: string): Promise<void> {
    if (!userId) throw new Error("로그인이 필요합니다.");
    if (!query.isSuccess) throw new Error("추천 제외 설정을 먼저 불러와 주세요.");
    if (pendingToggle.current) return;
    const targetKey = recommendationExclusionTargetKey(targetType, key);
    const selectedKey = targetType === "theme" ? targetKey.slice("relationship:".length) : targetKey;
    const selected = targetType === "theme"
      ? query.data.excludedThemeKeys.includes(selectedKey)
      : query.data.excludedGenres.includes(selectedKey);

    pendingToggle.current = true;
    try {
      await mutation.mutateAsync({ userId, targetType, targetKey, excluded: !selected });
    } finally {
      pendingToggle.current = false;
    }
  }

  return {
    excludedThemeKeys: query.data?.excludedThemeKeys ?? EMPTY_PREFERENCES.excludedThemeKeys,
    excludedGenres: query.data?.excludedGenres ?? EMPTY_PREFERENCES.excludedGenres,
    isReady: query.isSuccess,
    isLoading: Boolean(userId) && query.isPending,
    isError: Boolean(userId) && query.isError,
    error: query.error ?? mutation.error,
    isSaving: mutation.isPending,
    refetch: query.refetch,
    toggleTheme: (key: string) => toggle("theme", key),
    toggleGenre: (key: string) => toggle("genre", key)
  };
}
