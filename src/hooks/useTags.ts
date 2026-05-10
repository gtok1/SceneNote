import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import { createTag, getTags } from "@/services/tags";
import { useAuthStore } from "@/stores/authStore";

export function useTags() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.tags.all(user?.id ?? "anonymous"),
    queryFn: getTags,
    enabled: Boolean(user),
    staleTime: 2 * 60_000
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tags.all(user.id) });
      }
    }
  });
}
