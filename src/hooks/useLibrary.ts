import { useMemo } from "react";

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
  createSeasonOffsetsByNumber,
  resolveEpisodeProgress,
  syncManualProgressAfterToggle,
  toAbsoluteEpisodeNumber,
  toSeasonRelativeEpisodeNumber
} from "@/utils/episodeProgress";
import { filterUpcomingAiringItems } from "@/utils/upcomingAiring";

export function useLibrary(status: LibraryStatusFilter = "all") {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.library.byStatus(user?.id ?? "anonymous", status),
    queryFn: () => getLibraryItems(status),
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
      const absolute = toAbsoluteEpisodeNumber(
        seasonNumber,
        episode.episode_number,
        createSeasonOffsetsByNumber(libraryItem.season_episode_counts)
      );
      if (absolute === null) return;

      const nextManual = syncManualProgressAfterToggle({
        manualWatchedThrough: libraryItem.manual_watched_absolute_number,
        toggledAbsoluteNumber: absolute,
        watched: !watched
      });
      if (nextManual === libraryItem.manual_watched_absolute_number || nextManual === null) return;

      try {
        await updateLibraryManualProgress(
          libraryItem.library_item_id,
          toSeasonRelativeEpisodeNumber(nextManual, libraryItem.season_episode_counts)
        );
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
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshots) restoreLibraryQueries(queryClient, context.snapshots);
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
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshots) restoreLibraryQueries(queryClient, context.snapshots);
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

        const manualAbsolute = progress === null
          ? null
          : toAbsoluteEpisodeNumber(
              progress.seasonNumber,
              progress.episodeNumber,
              createSeasonOffsetsByNumber(item.season_episode_counts)
            );
        const resolved = resolveEpisodeProgress({
          contentType: item.content_type,
          episodeCount: item.episode_count,
          watchedEpisodeCount: item.watched_episode_count,
          derivedWatchedThrough: progress === null ? item.derived_watched_through : null,
          manualWatchedThrough: manualAbsolute
        });

        return {
          ...item,
          manual_watched_season_number: progress?.seasonNumber ?? null,
          manual_watched_episode_number: progress?.episodeNumber ?? null,
          manual_watched_absolute_number: manualAbsolute,
          progress_source: resolved.source,
          effective_watched_through: resolved.watchedThrough,
          next_episode_number: resolved.nextEpisodeNumber,
          manual_progress_available: true
        };
      })
  );
}
