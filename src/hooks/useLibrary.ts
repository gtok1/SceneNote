import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { getPrimaryWatchStatus, normalizeWatchStatuses } from "@/constants/status";
import { queryKeys } from "@/lib/query";
import {
  addContentToLibrary,
  deleteLibraryItem,
  getContentById,
  getEpisodeProgress,
  getEpisodes,
  getLibraryItems,
  getLibraryStats,
  getSeasons,
  toggleEpisodeProgress,
  updateLibraryStatus,
  updateLibraryStatuses,
  updateLibraryWatchCount
} from "@/services/library";
import { useAuthStore } from "@/stores/authStore";
import type { Episode, SearchResult } from "@/types/content";
import type { LibraryListItem, LibraryStatusFilter, WatchStatus } from "@/types/library";

export function useLibrary(status: LibraryStatusFilter = "all") {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.library.byStatus(user?.id ?? "anonymous", status),
    queryFn: () => getLibraryItems(status),
    enabled: Boolean(user),
    staleTime: 60_000
  });
}

export function useContent(contentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.content.single(contentId ?? ""),
    queryFn: () => getContentById(contentId ?? ""),
    enabled: Boolean(contentId),
    staleTime: 10 * 60_000
  });
}

export function useSeasons(contentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.content.seasons(contentId ?? ""),
    queryFn: () => getSeasons(contentId ?? ""),
    enabled: Boolean(contentId),
    staleTime: 10 * 60_000
  });
}

export function useEpisodes(contentId: string | undefined, seasonId: string | null) {
  return useQuery({
    queryKey: queryKeys.content.episodes(contentId ?? "", seasonId),
    queryFn: () => getEpisodes(contentId ?? "", seasonId ?? ""),
    enabled: Boolean(contentId && seasonId),
    staleTime: 10 * 60_000
  });
}

export function useEpisodeProgress(contentId: string | undefined) {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.progress.byContent(user?.id ?? "anonymous", contentId ?? ""),
    queryFn: () => getEpisodeProgress(contentId ?? ""),
    enabled: Boolean(user && contentId),
    staleTime: 30_000
  });
}

export function useAddToLibrary() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({ result, status }: { result: SearchResult; status?: WatchStatus }) =>
      addContentToLibrary(result, status),
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id) });
      }
    }
  });
}

export function useUpdateLibraryStatus() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({ libraryItemId, status }: { libraryItemId: string; status: WatchStatus }) =>
      updateLibraryStatus(libraryItemId, status),
    onMutate: async ({ libraryItemId, status }) => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: queryKeys.library.all(user.id) });
      const snapshots = snapshotLibraryQueries(queryClient, user.id);
      updateLibraryItemStatusesInCache(queryClient, user.id, libraryItemId, [status]);
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshots) restoreLibraryQueries(queryClient, context.snapshots);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id), refetchType: "inactive" });
      }
    }
  });
}

export function useUpdateLibraryStatuses() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({
      libraryItemId,
      statuses,
      watchCount
    }: {
      libraryItemId: string;
      statuses: WatchStatus[];
      watchCount?: number;
    }) => updateLibraryStatuses(libraryItemId, statuses, watchCount === undefined ? {} : { watchCount }),
    onMutate: async ({ libraryItemId, statuses, watchCount }) => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: queryKeys.library.all(user.id) });
      const snapshots = snapshotLibraryQueries(queryClient, user.id);
      updateLibraryItemStatusesInCache(queryClient, user.id, libraryItemId, statuses, watchCount);
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshots) restoreLibraryQueries(queryClient, context.snapshots);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id), refetchType: "inactive" });
      }
    }
  });
}

export function useDeleteLibraryItem() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({ libraryItemId }: { libraryItemId: string }) => deleteLibraryItem(libraryItemId),
    onMutate: async ({ libraryItemId }) => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: queryKeys.library.all(user.id) });
      const snapshots = snapshotLibraryQueries(queryClient, user.id);
      removeLibraryItemFromCache(queryClient, user.id, libraryItemId);
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshots) restoreLibraryQueries(queryClient, context.snapshots);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id), refetchType: "inactive" });
      }
    }
  });
}

export function useToggleEpisodeProgress(contentId: string | undefined) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({ episode, watched }: { episode: Episode; watched: boolean }) =>
      toggleEpisodeProgress(episode, watched),
    onSuccess: () => {
      if (user && contentId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.progress.byContent(user.id, contentId)
        });
      }
    }
  });
}

export function useUpdateLibraryWatchCount() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({ libraryItemId, watchCount }: { libraryItemId: string; watchCount: number }) =>
      updateLibraryWatchCount(libraryItemId, watchCount),
    onMutate: async ({ libraryItemId, watchCount }) => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: queryKeys.library.all(user.id) });
      const snapshots = snapshotLibraryQueries(queryClient, user.id);
      updateLibraryItemWatchCountInCache(queryClient, user.id, libraryItemId, watchCount);
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshots) restoreLibraryQueries(queryClient, context.snapshots);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id), refetchType: "inactive" });
      }
    }
  });
}

export function useLibraryStats() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.profile.stats(user?.id ?? "anonymous"),
    queryFn: getLibraryStats,
    enabled: Boolean(user),
    staleTime: 5 * 60_000
  });
}

function snapshotLibraryQueries(queryClient: QueryClient, userId: string) {
  return queryClient.getQueriesData<LibraryListItem[]>({ queryKey: queryKeys.library.all(userId) });
}

function restoreLibraryQueries(
  queryClient: QueryClient,
  snapshots: ReturnType<typeof snapshotLibraryQueries>
) {
  snapshots.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });
}

function updateLibraryItemStatusesInCache(
  queryClient: QueryClient,
  userId: string,
  libraryItemId: string,
  statuses: WatchStatus[],
  watchCount?: number
) {
  const normalizedStatuses = normalizeWatchStatuses(statuses);
  const primaryStatus = getPrimaryWatchStatus(normalizedStatuses) ?? "wishlist";
  const updatedAt = new Date().toISOString();

  queryClient.setQueriesData<LibraryListItem[]>(
    { queryKey: queryKeys.library.all(userId) },
    (items) =>
      items?.map((item) =>
        item.library_item_id === libraryItemId
          ? {
              ...item,
              status: primaryStatus,
              statuses: normalizedStatuses,
              watch_count:
                watchCount !== undefined
                  ? Math.max(0, Math.floor(watchCount))
                  : normalizedStatuses.includes("completed")
                    ? Math.max(1, item.watch_count ?? 0)
                    : item.watch_count,
              updated_at: updatedAt
            }
          : item
      )
  );
}

function removeLibraryItemFromCache(queryClient: QueryClient, userId: string, libraryItemId: string) {
  queryClient.setQueriesData<LibraryListItem[]>(
    { queryKey: queryKeys.library.all(userId) },
    (items) => items?.filter((item) => item.library_item_id !== libraryItemId)
  );
}

function updateLibraryItemWatchCountInCache(
  queryClient: QueryClient,
  userId: string,
  libraryItemId: string,
  watchCount: number
) {
  queryClient.setQueriesData<LibraryListItem[]>(
    { queryKey: queryKeys.library.all(userId) },
    (items) =>
      items?.map((item) =>
        item.library_item_id === libraryItemId
          ? {
              ...item,
              watch_count: item.statuses.includes("completed")
                ? Math.max(1, Math.floor(watchCount))
                : Math.max(0, Math.floor(watchCount))
            }
          : item
      )
  );
}
