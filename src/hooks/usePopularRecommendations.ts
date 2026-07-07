import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import { getPopularRecommendations } from "@/services/popularRecommendations";
import { useAuthStore } from "@/stores/authStore";

export function usePopularRecommendations() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.recommendations.popular(user?.id ?? "anonymous"),
    queryFn: getPopularRecommendations,
    enabled: Boolean(user),
    staleTime: 30 * 60_000
  });
}
