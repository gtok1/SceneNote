import { useCallback, useMemo } from "react";

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
  updateLibraryManualProgress,
  updateLibraryStatus,
  updateLibraryStatuses,
  updateLibraryWatchCount,
  updateLibraryWatchDates
} from "@/services/library";
import { useAuthStore } from "@/stores/authStore";
import type { Episode, SearchResult, Season } from "@/types/content";
import type { LibraryListItem, LibraryStatusFilter, WatchStatus } from "@/types/library";
import {
  libraryManualProgressAfterToggle,
  resolveLibraryItemProgress,
  withLibraryManualProgress
} from "@/utils/episodeProgress";
import { createTrailingScheduler, LIBRARY_REFRESH_DEBOUNCE_MS } from "@/utils/recommendationAddFlow";
import { filterUpcomingAiringItems } from "@/utils/upcomingAiring";
import { EDGE_LIST_QUERY_OPTIONS } from "@/utils/metadataQuery";
import { filterLibraryItemsByStatus } from "@/utils/libraryFilters";
import { createLibraryMutationJournal, rollbackLibraryItem, type LibraryMutationOperation } from "@/utils/libraryRollback";

export function useLibrary(status: LibraryStatusFilter = "all") {
  const user = useAuthStore((state) => state.user);
  const select = useCallback((items: LibraryListItem[]) => filterLibraryItemsByStatus(items, status), [status]);

  return useQuery({
    queryKey: queryKeys.library.byStatus(user?.id ?? "anonymous", "all"),
    queryFn: () => getLibraryItems("all"),
    select,
    enabled: Boolean(user),
    staleTime: 60_000
  });
}

export function useUpcomingAiring(items: LibraryListItem[] | undefined) {
  return useMemo(() => filterUpcomingAiringItems(items ?? []), [items]);
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
    ...EDGE_LIST_QUERY_OPTIONS,
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

const libraryRefreshSchedulers = new Map<string, ReturnType<typeof createTrailingScheduler>>();

export function useAddToLibrary(options?: { libraryRefresh?: "immediate" | "debounced" }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({ result, status }: { result: SearchResult; status?: WatchStatus }) =>
      addContentToLibrary(result, status),
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.stats(user.id) });
        if (options?.libraryRefresh === "debounced") {
          let scheduler = libraryRefreshSchedulers.get(user.id);
          if (!scheduler) {
            scheduler = createTrailingScheduler(LIBRARY_REFRESH_DEBOUNCE_MS, {
              set: (run, ms) => setTimeout(run, ms),
              clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>)
            });
            libraryRefreshSchedulers.set(user.id, scheduler);
          }
          scheduler.schedule(() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id) });
          });
        } else {
          queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id) });
        }
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
      return captureLibraryMutation(queryClient, user.id, libraryItemId, snapshots);
    },
    onError: (_error, _variables, context) => {
      restoreLibraryQueries(queryClient, context);
    },
    onSettled: (_data, _error, _variables, context) => {
      settleLibraryMutation(queryClient, context);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id), refetchType: "inactive" });
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.stats(user.id) });
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
      return captureLibraryMutation(queryClient, user.id, libraryItemId, snapshots);
    },
    onError: (_error, _variables, context) => {
      restoreLibraryQueries(queryClient, context);
    },
    onSettled: (_data, _error, _variables, context) => {
      settleLibraryMutation(queryClient, context);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id), refetchType: "inactive" });
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.stats(user.id) });
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
      return captureLibraryMutation(queryClient, user.id, libraryItemId, snapshots);
    },
    onError: (_error, _variables, context) => {
      restoreLibraryQueries(queryClient, context);
    },
    onSettled: (_data, _error, _variables, context) => {
      settleLibraryMutation(queryClient, context);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id), refetchType: "inactive" });
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.stats(user.id) });
      }
    }
  });
}

export function useToggleEpisodeProgress(contentId: string | undefined) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      episode,
      watched,
      libraryItem
    }: {
      episode: Episode;
      watched: boolean;
      libraryItem?: LibraryListItem;
    }) => {
      await toggleEpisodeProgress(episode, watched);

      if (!libraryItem || libraryItem.manual_watched_episode_number === null) return;

      const seasons = queryClient.getQueryData<Season[]>(
        queryKeys.content.seasons(contentId ?? episode.content_id)
      ) ?? [];
      const seasonNumber = seasons.find((season) => season.id === episode.season_id)?.season_number ?? null;
      const nextManual = libraryManualProgressAfterToggle(libraryItem, seasonNumber, episode.episode_number, !watched);
      if (nextManual === null) return;

      try {
        await updateLibraryManualProgress(libraryItem.library_item_id, nextManual);
      } catch (error) {
        console.warn("에피소드 체크 후 수동 진행 위치 동기화에 실패했습니다.", error);
        if (user) {
          await queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id) });
        }
      }
    },
    onSuccess: () => {
      if (user && contentId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.progress.byContent(user.id, contentId)
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.library.all(user.id)
        });
      }
    }
  });
}

export function useUpdateLibraryManualProgress() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({
      libraryItemId,
      progress
    }: {
      libraryItemId: string;
      progress: { seasonNumber: number | null; episodeNumber: number } | null;
    }) => updateLibraryManualProgress(libraryItemId, progress),
    onMutate: async ({ libraryItemId, progress }) => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: queryKeys.library.all(user.id) });
      const snapshots = snapshotLibraryQueries(queryClient, user.id);
      updateLibraryItemManualProgressInCache(queryClient, user.id, libraryItemId, progress);
      return captureLibraryMutation(queryClient, user.id, libraryItemId, snapshots);
    },
    onError: (_error, _variables, context) => {
      restoreLibraryQueries(queryClient, context);
    },
    onSettled: (_data, _error, _variables, context) => {
      settleLibraryMutation(queryClient, context);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.library.all(user.id),
          refetchType: "inactive"
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
      return captureLibraryMutation(queryClient, user.id, libraryItemId, snapshots);
    },
    onError: (_error, _variables, context) => {
      restoreLibraryQueries(queryClient, context);
    },
    onSettled: (_data, _error, _variables, context) => {
      settleLibraryMutation(queryClient, context);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id), refetchType: "inactive" });
      }
    }
  });
}

export function useUpdateLibraryWatchDates() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({
      libraryItemId,
      firstWatchedAt,
      lastWatchedAt
    }: {
      libraryItemId: string;
      firstWatchedAt: string | null;
      lastWatchedAt: string | null;
    }) => updateLibraryWatchDates(libraryItemId, { firstWatchedAt, lastWatchedAt }),
    onMutate: async ({ libraryItemId, firstWatchedAt, lastWatchedAt }) => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: queryKeys.library.all(user.id) });
      const snapshots = snapshotLibraryQueries(queryClient, user.id);
      updateLibraryItemWatchDatesInCache(queryClient, user.id, libraryItemId, firstWatchedAt, lastWatchedAt);
      return captureLibraryMutation(queryClient, user.id, libraryItemId, snapshots);
    },
    onError: (_error, _variables, context) => {
      restoreLibraryQueries(queryClient, context);
    },
    onSettled: (_data, _error, _variables, context) => {
      settleLibraryMutation(queryClient, context);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id), refetchType: "inactive" });
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.stats(user.id) });
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

const libraryMutationJournals = new WeakMap<QueryClient, ReturnType<typeof createLibraryMutationJournal>>();

function mutationJournal(queryClient: QueryClient) {
  let journal = libraryMutationJournals.get(queryClient);
  if (!journal) {
    journal = createLibraryMutationJournal();
    libraryMutationJournals.set(queryClient, journal);
  }
  return journal;
}

interface LibraryMutationContext {
  snapshots: ReturnType<typeof snapshotLibraryQueries>;
  optimistic: ReturnType<typeof snapshotLibraryQueries>;
  operation: LibraryMutationOperation;
}

function captureLibraryMutation(
  queryClient: QueryClient,
  userId: string,
  libraryItemId: string,
  snapshots: ReturnType<typeof snapshotLibraryQueries>
): LibraryMutationContext {
  return {
    snapshots,
    optimistic: snapshotLibraryQueries(queryClient, userId),
    operation: mutationJournal(queryClient).begin(userId, libraryItemId)
  };
}

function restoreLibraryQueries(queryClient: QueryClient, context: LibraryMutationContext | undefined) {
  if (!context) return;
  const journal = mutationJournal(queryClient);
  journal.failed(context.operation);
  if (!journal.canRollback(context.operation)) return;
  context.snapshots.forEach(([queryKey, before]) => {
    const optimistic = context.optimistic.find(([key]) => key === queryKey)?.[1];
    queryClient.setQueryData<LibraryListItem[]>(queryKey, current =>
      rollbackLibraryItem(current, before, optimistic, context.operation.libraryItemId).items
    );
  });
}

function settleLibraryMutation(queryClient: QueryClient, context: LibraryMutationContext | undefined) {
  if (!context || !mutationJournal(queryClient).settle(context.operation)) return;
  // Reconcile failures once all concurrent writes have settled; do not refetch over
  // another pending optimistic change or restore an entire stale list (docs/73).
  void queryClient.invalidateQueries({ queryKey: queryKeys.library.all(context.operation.userId), refetchType: "active" });
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
              ...resolveLibraryItemProgress(item, normalizedStatuses),
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

function updateLibraryItemWatchDatesInCache(
  queryClient: QueryClient,
  userId: string,
  libraryItemId: string,
  firstWatchedAt: string | null,
  lastWatchedAt: string | null
) {
  const updatedAt = new Date().toISOString();

  queryClient.setQueriesData<LibraryListItem[]>(
    { queryKey: queryKeys.library.all(userId) },
    (items) =>
      items?.map((item) =>
        item.library_item_id === libraryItemId
          ? {
              ...item,
              first_watched_at: firstWatchedAt,
              last_watched_at: lastWatchedAt,
              updated_at: updatedAt
            }
          : item
      )
  );
}

function updateLibraryItemManualProgressInCache(
  queryClient: QueryClient,
  userId: string,
  libraryItemId: string,
  progress: { seasonNumber: number | null; episodeNumber: number } | null
) {
  queryClient.setQueriesData<LibraryListItem[]>(
    { queryKey: queryKeys.library.all(userId) },
    (items) =>
      items?.map((item) => {
        if (item.library_item_id !== libraryItemId) return item;

        return withLibraryManualProgress(item, progress);
      })
  );
}
