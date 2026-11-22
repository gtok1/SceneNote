import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";

import { SHARE_FEATURES_ENABLED } from "@/constants/features";
import { queryKeys } from "@/lib/query";
import { deleteLibraryShare, listMyLibraryShares } from "@/services/libraryShare";
import { useAuthStore } from "@/stores/authStore";
import type { MyLibraryShare } from "@/types/libraryShare";
import { removeLibraryShare } from "@/utils/libraryShareManagement";

export function useMyLibraryShares() {
  const userId = useAuthStore(state => state.user?.id ?? null);
  return useQuery({
    queryKey: queryKeys.libraryShares.mine(userId ?? "anonymous"),
    queryFn: ({ signal }) => listMyLibraryShares(userId, signal),
    enabled: SHARE_FEATURES_ENABLED && userId !== null,
    staleTime: 60_000
  });
}

interface StopShareInput {
  id: string;
  ownerId: string;
}

export function useDeleteLibraryShare() {
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const mutationKey = ["library-shares", userId, "delete"] as const;
  const mutation = useMutation({
    mutationKey,
    mutationFn: ({ id, ownerId }: StopShareInput) => deleteLibraryShare(id, ownerId),
    onSuccess: async (_, { id, ownerId }) => {
      const queryKey = queryKeys.libraryShares.mine(ownerId);
      await client.cancelQueries({ queryKey, exact: true });
      client.setQueryData<MyLibraryShare[]>(queryKey, rows => rows && removeLibraryShare(rows, id));
      client.removeQueries({ queryKey: ["library-share", id], exact: true });
      // The latest 100 may now include an older link.
      void client.invalidateQueries({ queryKey, exact: true });
    }
  });

  const pendingIds = useMutationState({
    filters: { mutationKey, exact: true, status: "pending" },
    select: entry => (entry.state.variables as StopShareInput).id
  });
  return {
    pendingIds: new Set(pendingIds),
    mutateAsync: async (id: string) => {
      if (!userId || useAuthStore.getState().user?.id !== userId) {
        throw new Error("로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.");
      }
      await mutation.mutateAsync({ id, ownerId: userId });
    }
  };
}
