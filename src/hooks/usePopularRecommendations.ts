import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import { getPopularRecommendations } from "@/services/popularRecommendations";
import { useAuthStore } from "@/stores/authStore";
import { useRecommendationPreferences } from "@/hooks/useRecommendationPreferences";

export function usePopularRecommendations() {
  const user = useAuthStore((state) => state.user);
  const preferences = useRecommendationPreferences();
  const exclusions = {
    excludedThemeKeys: preferences.excludedThemeKeys,
    excludedGenres: preferences.excludedGenres
  };
  const filterIdentity = JSON.stringify([
    [...exclusions.excludedThemeKeys].sort(),
    [...exclusions.excludedGenres].sort()
  ]);

  return useQuery({
    queryKey: [...queryKeys.recommendations.popular(user?.id ?? "anonymous"), filterIdentity],
    queryFn: () => getPopularRecommendations(user?.id ?? "anonymous", exclusions),
    enabled: Boolean(user && preferences.isReady),
    staleTime: 30 * 60_000
  });
}
