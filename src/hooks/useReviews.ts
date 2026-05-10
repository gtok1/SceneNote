import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import { getContentReview, saveContentReview } from "@/services/reviews";
import { useAuthStore } from "@/stores/authStore";
import type { LibraryListItem } from "@/types/library";
import type { SaveContentReviewInput } from "@/types/reviews";

export function useContentReview(contentId: string | undefined) {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.reviews.byContent(user?.id ?? "anonymous", contentId ?? ""),
    queryFn: () => getContentReview(contentId ?? ""),
    enabled: Boolean(user && contentId),
    staleTime: 60_000
  });
}

export function useSaveContentReview(contentId: string | undefined) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: (input: SaveContentReviewInput) => saveContentReview(input),
    onSuccess: (savedReview) => {
      if (user && contentId) {
        queryClient.setQueryData(queryKeys.reviews.byContent(user.id, contentId), savedReview);
        queryClient.setQueriesData<LibraryListItem[]>(
          { queryKey: queryKeys.library.all(user.id) },
          (items) =>
            items?.map((item) =>
              item.content_id === contentId
                ? {
                    ...item,
                    rating: savedReview.rating,
                    one_line_review: savedReview.one_line_review
                  }
                : item
            )
        );
        queryClient.invalidateQueries({
          queryKey: queryKeys.library.all(user.id),
          refetchType: "inactive"
        });
      }
    }
  });
}
