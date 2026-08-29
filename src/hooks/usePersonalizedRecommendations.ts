import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import {
  getPersonalizedRecommendations,
  recordPersonalizedRecommendationFeedback,
  recordPersonalizedRecommendationImpressions,
  type PersonalizedRecommendation,
  type PersonalizedRecommendationsRequest,
  type PersonalizedRecommendationsResponse
} from "@/services/personalizedRecommendations";
import { useAuthStore } from "@/stores/authStore";
import type { MediaTypeFilter } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import {
  appendRecommendationFeed,
  createRecommendationFeedState,
  decideEmptyRecommendationContinuation,
  MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS,
  MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS,
  PERSONALIZED_RECOMMENDATION_BATCH_SIZE,
  refillRecommendationFeedItem,
  removeRecommendationFeedItem,
  restoreRecommendationFeedItem,
  type RemovedFeedItem
} from "@/utils/recommendationFeed";
import {
  collectRecommendationSessionSeenIds,
  rememberRecommendationSessionSeenIds
} from "@/utils/recommendationSession";
import {
  createRecommendationIdentityAliases,
  type RecommendationFeedback
} from "../../supabase/functions/_shared/recommendationEngine";
import { isUserActionableTheme } from "../../supabase/functions/_shared/recommendationThemes";

type RecommendationQueryKey = ReturnType<typeof queryKeys.recommendations.personalized>;

interface RecommendationMutationVariables {
  cacheKey: RecommendationQueryKey;
  mediaType: MediaTypeFilter;
  request: PersonalizedRecommendationsRequest;
}

export type RecommendationRefillResult = "refilled" | "exhausted" | "failed";

const INITIAL_LOADING_DEADLINE_MS = 12_000;
const MUTATION_LOADING_DEADLINE_MS = 12_000;
export function usePersonalizedRecommendations(
  mediaType: MediaTypeFilter,
  libraryItems: readonly LibraryListItem[],
  options: { enabled?: boolean } = {}
) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const cacheKey = useMemo(
    () => queryKeys.recommendations.personalized(user?.id ?? "anonymous", mediaType),
    [mediaType, user?.id]
  );
  const cacheIdentity = cacheKey.join(":");
  const [timedOutCacheIdentity, setTimedOutCacheIdentity] = useState<string | null>(null);
  const initialLoadingTimedOut = timedOutCacheIdentity === cacheIdentity;
  const [emptyContinuationStopped, setEmptyContinuationStopped] = useState(false);
  const [refreshErrors, setRefreshErrors] = useState<Partial<Record<MediaTypeFilter, string | null>>>({});
  const [refillErrors, setRefillErrors] = useState<Partial<Record<MediaTypeFilter, string | null>>>({});
  const [loadMoreErrors, setLoadMoreErrors] = useState<Partial<Record<MediaTypeFilter, string | null>>>({});
  const lastFailedRefills = useRef(
    new Map<MediaTypeFilter, RemovedFeedItem<PersonalizedRecommendation>>()
  );
  const refreshInFlight = useRef(false);
  const refillInFlight = useRef(false);
  const loadMoreInFlight = useRef(false);
  const impressionBatchesInFlight = useRef(new Set<string>());
  const recordedImpressionBatches = useRef(new Set<string>());
  const emptyContinuationAttempts = useRef(0);
  const emptyContinuationStartedAt = useRef<number | null>(null);
  const libraryIdentityKeys = useMemo(
    () =>
      new Set(
        libraryItems.flatMap((item) => createRecommendationIdentityAliases(item))
      ),
    [libraryItems]
  );

  const recommendationQuery = useQuery({
    queryKey: cacheKey,
    queryFn: ({ signal }) =>
      getPersonalizedRecommendations(
        createRequest({
          userId: user?.id ?? "anonymous",
          cursor: null,
          excludeIds: [],
          limit: PERSONALIZED_RECOMMENDATION_BATCH_SIZE,
          mediaType,
          signal
        })
      ),
    enabled: Boolean(user && (options.enabled ?? true)),
    retry: 0,
    staleTime: 10 * 60_000
  });

  const refreshMutation = useMutation({
    mutationFn: ({ request }: RecommendationMutationVariables) =>
      getPersonalizedRecommendations(request)
  });
  const refillMutation = useMutation({
    mutationFn: ({ request }: RecommendationMutationVariables) =>
      getPersonalizedRecommendations(request)
  });
  const loadMoreMutation = useMutation({
    mutationFn: ({ request }: RecommendationMutationVariables) =>
      getPersonalizedRecommendations(request)
  });

  useEffect(() => {
    setTimedOutCacheIdentity(null);
    setEmptyContinuationStopped(false);
    emptyContinuationAttempts.current = 0;
    emptyContinuationStartedAt.current = null;
  }, [cacheIdentity]);

  useEffect(() => {
    if (!recommendationQuery.isLoading || recommendationQuery.data || initialLoadingTimedOut) return;
    const timeoutId = setTimeout(() => {
      setTimedOutCacheIdentity(cacheIdentity);
      void queryClient.cancelQueries({ queryKey: cacheKey, exact: true });
    }, INITIAL_LOADING_DEADLINE_MS);
    return () => clearTimeout(timeoutId);
  }, [cacheIdentity, cacheKey, initialLoadingTimedOut, queryClient, recommendationQuery.data, recommendationQuery.isLoading]);

  useEffect(() => {
    if (!user || !recommendationQuery.data?.items.length) return;
    const items = recommendationQuery.data.items;
    rememberRecommendationSessionSeenIds(
      user.id,
      collectRecommendationSessionSeenIds(items)
    );
    const batchKey = `${mediaType}:${items.map((item) => item.canonical_id).sort().join("|")}`;
    if (
      recordedImpressionBatches.current.has(batchKey) ||
      impressionBatchesInFlight.current.has(batchKey)
    ) {
      return;
    }
    impressionBatchesInFlight.current.add(batchKey);
    void recordImpressionsWithRetry(items)
      .then(() => recordedImpressionBatches.current.add(batchKey))
      .catch((error) => console.error("recommendation impression persistence failed:", error))
      .finally(() => impressionBatchesInFlight.current.delete(batchKey));
  }, [mediaType, recommendationQuery.data?.items, user]);

  const refresh = async (): Promise<boolean> => {
    if (
      !user ||
      refreshMutation.isPending ||
      refillMutation.isPending ||
      loadMoreMutation.isPending ||
      refreshInFlight.current ||
      refillInFlight.current ||
      loadMoreInFlight.current
    ) {
      return false;
    }

    refreshInFlight.current = true;
    emptyContinuationAttempts.current = 0;
    emptyContinuationStartedAt.current = null;
    setEmptyContinuationStopped(false);

    try {
      await queryClient.cancelQueries({ queryKey: cacheKey, exact: true });
      const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
      if (!current) {
        setTimedOutCacheIdentity(null);
        const result = await recommendationQuery.refetch();
        return Boolean(result.data);
      }

      rememberRecommendationSessionSeenIds(
        user.id,
        collectRecommendationSessionSeenIds(current.items)
      );

      const controller = new AbortController();
      const request = createRequest({
        userId: user.id,
        cursor: current.next_cursor,
        excludeIds: collectRecommendationSessionSeenIds(current.items),
        limit: PERSONALIZED_RECOMMENDATION_BATCH_SIZE,
        mediaType,
        signal: controller.signal
      });
      const variables = { cacheKey, mediaType, request };
      setRefreshError(mediaType, null);

      try {
        const next = await runWithDeadline(
          refreshMutation.mutateAsync(variables),
          MUTATION_LOADING_DEADLINE_MS,
          () => {
            controller.abort();
            refreshMutation.reset();
          }
        );
        queryClient.setQueryData(cacheKey, next);
        rememberRecommendationSessionSeenIds(
          user.id,
          collectRecommendationSessionSeenIds(next.items)
        );
        lastFailedRefills.current.delete(mediaType);
        setRefillError(mediaType, null);
        return true;
      } catch (error) {
        setRefreshError(mediaType, toErrorMessage(error, "새 추천을 불러오지 못했습니다"));
        return false;
      }
    } finally {
      refreshInFlight.current = false;
    }
  };

  const removeOptimistically = (
    recommendationId: string
  ): RemovedFeedItem<PersonalizedRecommendation> | null => {
    const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
    if (!current) return null;

    const removal = removeRecommendationFeedItem(
      createRecommendationFeedState({
        items: current.items,
        cursor: current.next_cursor,
        isExhausted: current.is_exhausted,
        broadened: current.broadened
      }),
      (item) => item.canonical_id,
      recommendationId
    );

    if (!removal.removed) return null;
    queryClient.setQueryData<PersonalizedRecommendationsResponse>(cacheKey, {
      ...current,
      items: removal.state.items
    });
    setRefillError(mediaType, null);
    return removal.removed;
  };

  const restore = (removed: RemovedFeedItem<PersonalizedRecommendation>) => {
    const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
    if (!current) return;

    const restored = restoreRecommendationFeedItem(
      createRecommendationFeedState({
        items: current.items,
        cursor: current.next_cursor,
        isExhausted: current.is_exhausted,
        broadened: current.broadened
      }),
      removed
    );
    queryClient.setQueryData<PersonalizedRecommendationsResponse>(cacheKey, {
      ...current,
      items: restored.items
    });
    lastFailedRefills.current.delete(mediaType);
    setRefillError(mediaType, null);
  };

  const refill = async (
    removed: RemovedFeedItem<PersonalizedRecommendation>
  ): Promise<RecommendationRefillResult> => {
    if (
      !user ||
      refillMutation.isPending ||
      refreshMutation.isPending ||
      loadMoreMutation.isPending ||
      refillInFlight.current ||
      refreshInFlight.current ||
      loadMoreInFlight.current
    ) {
      return "failed";
    }

    refillInFlight.current = true;

    try {
      await queryClient.cancelQueries({ queryKey: cacheKey, exact: true });
      const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
      if (!current) return "failed";

      const removedIds = collectRecommendationSessionSeenIds([removed.item]);
      rememberRecommendationSessionSeenIds(user.id, [
        ...collectRecommendationSessionSeenIds(current.items),
        ...removedIds
      ]);

      const controller = new AbortController();
      const request = createRequest({
        userId: user.id,
        cursor: current.next_cursor,
        excludeIds: [
          ...collectRecommendationSessionSeenIds(current.items),
          ...removedIds
        ],
        limit: 1,
        mediaType,
        signal: controller.signal
      });
      const variables = { cacheKey, mediaType, request };
      setRefillError(mediaType, null);

      try {
        const next = await runWithDeadline(
          refillMutation.mutateAsync(variables),
          MUTATION_LOADING_DEADLINE_MS,
          () => {
            controller.abort();
            refillMutation.reset();
          }
        );
        const replacement = next.items[0];

        if (!replacement) {
          queryClient.setQueryData<PersonalizedRecommendationsResponse>(cacheKey, {
            ...current,
            next_cursor: next.next_cursor,
            is_exhausted: next.is_exhausted,
            broadened: next.broadened,
            partial: current.partial || next.partial,
            failed_sources: Array.from(new Set([...current.failed_sources, ...next.failed_sources]))
          });
          lastFailedRefills.current.delete(mediaType);
          return "exhausted";
        }

        const refilled = refillRecommendationFeedItem(
          createRecommendationFeedState({
            items: current.items,
            cursor: next.next_cursor,
            isExhausted: next.is_exhausted,
            broadened: next.broadened
          }),
          removed,
          replacement
        );
        queryClient.setQueryData<PersonalizedRecommendationsResponse>(cacheKey, {
          ...current,
          items: refilled.items,
          next_cursor: next.next_cursor,
          is_exhausted: next.is_exhausted,
          broadened: next.broadened,
          profile_mode: next.profile_mode,
          partial: current.partial || next.partial,
          failed_sources: Array.from(new Set([...current.failed_sources, ...next.failed_sources]))
        });
        rememberRecommendationSessionSeenIds(
          user.id,
          collectRecommendationSessionSeenIds([replacement])
        );
        lastFailedRefills.current.delete(mediaType);
        return "refilled";
      } catch (error) {
        lastFailedRefills.current.set(mediaType, removed);
        setRefillError(mediaType, toErrorMessage(error, "새 추천 한 작품을 불러오지 못했습니다"));
        return "failed";
      }
    } finally {
      refillInFlight.current = false;
    }
  };

  const retryRefill = async (): Promise<RecommendationRefillResult> => {
    const removed = lastFailedRefills.current.get(mediaType);
    if (!removed) return "failed";
    return refill(removed);
  };

  const loadMore = async (): Promise<boolean> => {
    if (
      !user ||
      recommendationQuery.isFetching ||
      refreshMutation.isPending ||
      refillMutation.isPending ||
      loadMoreMutation.isPending ||
      refreshInFlight.current ||
      refillInFlight.current ||
      loadMoreInFlight.current
    ) {
      return false;
    }

    loadMoreInFlight.current = true;
    setEmptyContinuationStopped(false);
    setLoadMoreError(mediaType, null);
    try {
      await queryClient.cancelQueries({ queryKey: cacheKey, exact: true });
      const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
      if (!current || current.is_exhausted || !current.next_cursor) return false;

      const deadlineMs = getLoadMoreDeadlineMs();
      if (deadlineMs <= 0) {
        setLoadMoreError(mediaType, "새 추천 탐색 시간이 초과되었습니다. 다시 시도해 주세요.");
        return false;
      }
      const controller = new AbortController();
      const request = createRequest({
        userId: user.id,
        cursor: current.next_cursor,
        excludeIds: collectRecommendationSessionSeenIds(current.items),
        limit: PERSONALIZED_RECOMMENDATION_BATCH_SIZE,
        mediaType,
        signal: controller.signal
      });
      const next = await runWithDeadline(
        loadMoreMutation.mutateAsync({ cacheKey, mediaType, request }),
        deadlineMs,
        () => {
          controller.abort();
          loadMoreMutation.reset();
        }
      );
      let appendedItemCount = 0;
      queryClient.setQueryData<PersonalizedRecommendationsResponse>(cacheKey, (latest) => {
        const base = latest ?? current;
        const appended = appendRecommendationFeed(
          createRecommendationFeedState({
            items: base.items,
            cursor: base.next_cursor,
            isExhausted: base.is_exhausted,
            broadened: base.broadened
          }),
          {
            items: next.items,
            cursor: next.next_cursor,
            isExhausted: next.is_exhausted,
            broadened: next.broadened
          },
          (item) => item.canonical_id
        );
        appendedItemCount = appended.items.length - base.items.length;
        return {
          ...base,
          ...next,
          items: appended.items,
          next_cursor: appended.cursor,
          broadened: appended.broadened,
          is_exhausted: appended.isExhausted,
          partial: base.partial || next.partial,
          failed_sources: Array.from(new Set([...base.failed_sources, ...next.failed_sources])),
          warnings: Array.from(new Set([...base.warnings, ...next.warnings]))
        };
      });
      rememberRecommendationSessionSeenIds(user.id, collectRecommendationSessionSeenIds(next.items));
      void recordImpressionsWithRetry(next.items).catch((error) =>
        console.error("appended recommendation impression persistence failed:", error)
      );
      return appendedItemCount > 0;
    } catch (error) {
      setLoadMoreError(mediaType, toErrorMessage(error, "다음 추천을 불러오지 못했습니다"));
      return false;
    } finally {
      loadMoreInFlight.current = false;
    }
  };

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  const visibleRecommendationCount = countVisibleRecommendations(
    recommendationQuery.data?.items ?? [],
    libraryIdentityKeys
  );
  const emptyContinuationDecision = decideEmptyRecommendationContinuation({
    hasData: Boolean(recommendationQuery.data),
    itemCount: visibleRecommendationCount,
    targetItemCount: PERSONALIZED_RECOMMENDATION_BATCH_SIZE,
    isLoading:
      recommendationQuery.isFetching ||
      refreshMutation.isPending ||
      refillMutation.isPending ||
      loadMoreMutation.isPending ||
      refreshInFlight.current ||
      refillInFlight.current ||
      loadMoreInFlight.current,
    hasError: Boolean(loadMoreErrors[mediaType]),
    hasMore: recommendationQuery.data?.has_more ?? false,
    nextCursor: recommendationQuery.data?.next_cursor ?? null,
    isExhausted: recommendationQuery.data?.is_exhausted ?? false,
    continuationAttempts: emptyContinuationAttempts.current,
    maxContinuationAttempts: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS,
    elapsedMs:
      emptyContinuationStartedAt.current === null
        ? 0
        : Date.now() - emptyContinuationStartedAt.current,
    maxDurationMs: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS
  });

  useEffect(() => {
    if (emptyContinuationDecision === "idle") {
      emptyContinuationAttempts.current = 0;
      emptyContinuationStartedAt.current = null;
      setEmptyContinuationStopped(false);
      return;
    }
    if (emptyContinuationDecision === "loading") {
      setEmptyContinuationStopped(false);
      return;
    }
    if (emptyContinuationDecision === "stopped") {
      setEmptyContinuationStopped(true);
      return;
    }
    if (refreshInFlight.current || refillInFlight.current || loadMoreInFlight.current) return;

    emptyContinuationStartedAt.current ??= Date.now();
    emptyContinuationAttempts.current += 1;
    setEmptyContinuationStopped(false);
    void loadMoreRef.current();
  }, [emptyContinuationDecision]);

  const submitFeedback = async (
    item: PersonalizedRecommendation,
    input: { targetType: "content" | "theme"; targetKey: string; action: "more" | "less" | "exclude" | "not_interested"; remove: boolean }
  ): Promise<RecommendationRefillResult | "saved"> => {
    const removed = input.remove ? removeOptimistically(item.canonical_id) : null;
    try {
      const feedback: RecommendationFeedback[] = [{
        target_type: input.targetType,
        target_key: input.targetKey,
        action: input.action,
        source_content_id: item.canonical_id,
        weight: 1
      }];
      if (input.action === "more" && input.targetType === "content") {
        feedback.push(...(item.themes ?? [])
          .filter(isUserActionableTheme)
          .slice(0, 3)
          .map((theme) => ({
            target_type: "theme" as const,
            target_key: `${theme.family}:${theme.key}`,
            action: "more" as const,
            source_content_id: item.canonical_id,
            weight: theme.centrality
          })));
      }
      await recordPersonalizedRecommendationFeedback(feedback);
      if (removed) return refill(removed);
      return "saved";
    } catch (error) {
      if (removed) restore(removed);
      throw error;
    }
  };
  const refreshVariables = refreshMutation.variables;
  const refillVariables = refillMutation.variables;
  const loadMoreVariables = loadMoreMutation.variables;
  const initialTimeoutError = initialLoadingTimedOut
    ? new Error(
        `추천 조회가 ${INITIAL_LOADING_DEADLINE_MS / 1_000}초를 초과해 중단되었습니다. 다시 시도해 주세요.`
      )
    : null;

  const retryInitial = async () => {
    setTimedOutCacheIdentity(null);
    setEmptyContinuationStopped(false);
    emptyContinuationAttempts.current = 0;
    emptyContinuationStartedAt.current = null;
    return recommendationQuery.refetch();
  };

  const retryEmptyContinuation = async (): Promise<boolean> => {
    setEmptyContinuationStopped(false);
    emptyContinuationAttempts.current = 1;
    emptyContinuationStartedAt.current = Date.now();
    const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
    if (current?.has_more && current.next_cursor && !current.is_exhausted) {
      return loadMore();
    }
    const result = await retryInitial();
    return Boolean(result.data);
  };

  return {
    ...recommendationQuery,
    error: initialTimeoutError ?? recommendationQuery.error,
    isError: recommendationQuery.isError || initialLoadingTimedOut,
    refetch: retryInitial,
    recommendations: recommendationQuery.data?.items ?? [],
    isInitialLoading: recommendationQuery.isLoading && !initialLoadingTimedOut,
    isRefreshing:
      refreshMutation.isPending && refreshVariables?.mediaType === mediaType,
    isRefilling:
      refillMutation.isPending && refillVariables?.mediaType === mediaType,
    isLoadingMore:
      loadMoreMutation.isPending && loadMoreVariables?.mediaType === mediaType,
    refreshError: refreshErrors[mediaType] ?? null,
    refillError: refillErrors[mediaType] ?? null,
    loadMoreError: loadMoreErrors[mediaType] ?? null,
    emptyContinuationStopped,
    currentRecommendationIds:
      collectRecommendationSessionSeenIds(recommendationQuery.data?.items ?? []),
    recommendationCursor: recommendationQuery.data?.next_cursor ?? null,
    isExhausted: recommendationQuery.data?.is_exhausted ?? false,
    refresh,
    removeOptimistically,
    restore,
    refill,
    retryRefill,
    loadMore,
    retryEmptyContinuation,
    submitFeedback
  };

  function setRefreshError(targetMediaType: MediaTypeFilter, message: string | null) {
    setRefreshErrors((current) => ({ ...current, [targetMediaType]: message }));
  }

  function setRefillError(targetMediaType: MediaTypeFilter, message: string | null) {
    setRefillErrors((current) => ({ ...current, [targetMediaType]: message }));
  }

  function setLoadMoreError(targetMediaType: MediaTypeFilter, message: string | null) {
    setLoadMoreErrors((current) => ({ ...current, [targetMediaType]: message }));
  }

  function getLoadMoreDeadlineMs(): number {
    if (emptyContinuationStartedAt.current === null) return MUTATION_LOADING_DEADLINE_MS;
    const remainingMs =
      MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS -
      (Date.now() - emptyContinuationStartedAt.current);
    return Math.min(MUTATION_LOADING_DEADLINE_MS, Math.max(0, remainingMs));
  }
}

function createRequest(
  request: PersonalizedRecommendationsRequest
): PersonalizedRecommendationsRequest {
  return {
    ...request,
    excludeIds: Array.from(new Set(request.excludeIds))
  };
}

function countVisibleRecommendations(
  items: readonly PersonalizedRecommendation[],
  libraryIdentityKeys: ReadonlySet<string>
): number {
  return items.filter((item) =>
    createRecommendationIdentityAliases(item).every(
      (identity) => !libraryIdentityKeys.has(identity)
    )
  ).length;
}

async function recordImpressionsWithRetry(
  items: readonly PersonalizedRecommendation[]
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await recordPersonalizedRecommendationImpressions(items);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("추천 노출 기록을 저장하지 못했습니다");
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

async function runWithDeadline<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          onTimeout();
          reject(new Error("추천 조회 시간이 초과되었습니다. 다시 시도해 주세요."));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
