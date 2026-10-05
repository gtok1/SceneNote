import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createRecommendationRequestScope } from "@/utils/searchRecommendationPolicy";
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
import { isExcludedRecommendation, type RecommendationExclusions } from "@/utils/excludedThemes";
import {
  advanceRecommendationNoProgressStreak,
  appendRecommendationFeed,
  createRecommendationFeedState,
  countRecommendationDisplaySlots,
  decideEmptyRecommendationContinuation,
  getRecommendationRetryAction,
  MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS,
  MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS,
  PERSONALIZED_RECOMMENDATION_BATCH_SIZE,
  nextRecommendationBatchTarget,
  recommendationContinuationLimit,
  refillRecommendationFeedItem,
  removeRecommendationFeedItem,
  restoreRecommendationFeedItem,
  type RemovedFeedItem
} from "@/utils/recommendationFeed";
import {
  collectRecommendationSessionSeenIds,
  limitRecommendationRequestExclusions,
  rememberRecommendationSessionSeenIds
} from "@/utils/recommendationSession";
import {
  createRecommendationIdentityAliases,
  type RecommendationFeedback
} from "../../supabase/functions/_shared/recommendationEngine";
import { isUserActionableTheme } from "../../supabase/functions/_shared/recommendationThemes";
import { filterVisibleRecommendationCandidates, findVisibleRecommendationReplacement, summarizeRecommendationVisibility } from "@/utils/recommendationVisibility";
import { discoveryFilterKey, matchesDiscoveryFilters, normalizeDiscoveryFilters, type DiscoveryFilterInput } from "../../supabase/functions/_shared/discoveryFilters";
import { recommendationExclusionSignature } from "@/utils/recommendationPreferences";

import { createTrailingScheduler, RECOMMENDATION_REFILL_DEBOUNCE_MS, shouldDeferRecommendationRefill } from "@/utils/recommendationAddFlow";

type RecommendationQueryKey = ReturnType<typeof queryKeys.recommendations.personalized>;

interface RecommendationMutationVariables {
  cacheKey: RecommendationQueryKey;
  mediaType: MediaTypeFilter;
  request: PersonalizedRecommendationsRequest;
}

export type RecommendationRefillResult = "refilled" | "pending" | "exhausted" | "failed";

const INITIAL_LOADING_DEADLINE_MS = 12_000;
const MUTATION_LOADING_DEADLINE_MS = 12_000;
export function usePersonalizedRecommendations(
  mediaType: MediaTypeFilter,
  libraryItems: readonly LibraryListItem[],
  options: DiscoveryFilterInput & { enabled?: boolean; exclusions?: RecommendationExclusions; additionsInFlight?: boolean; retainedIds?: readonly string[] } = {}
) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const exclusions = options.exclusions;
  const exclusionIdentity = recommendationExclusionSignature(exclusions);
  const discoveryFilters = useMemo(() => normalizeDiscoveryFilters({ year: options.year, genre: options.genre, country: options.country, genres: options.genres, countries: options.countries, mediaTypes: options.mediaTypes }), [options.year, options.genre, options.country, options.genres, options.countries, options.mediaTypes]);
  const discoveryIdentity = discoveryFilterKey(discoveryFilters);
  const cacheKey = useMemo(
    () => queryKeys.recommendations.personalized(user?.id ?? "anonymous", mediaType, exclusionIdentity, discoveryIdentity),
    [exclusionIdentity, discoveryIdentity, mediaType, user?.id]
  );
  const cacheIdentity = JSON.stringify(cacheKey);
  const enabled = Boolean(user && (options.enabled ?? true));
  // Each user/filter/activation receives a distinct request lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scope = useMemo(() => createRecommendationRequestScope(), [cacheIdentity, enabled]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const isCurrent = () => enabled && scope.isActive() && currentScope.current === scope;
  useEffect(() => () => {
    scope.close();
    if (enabled) void queryClient.cancelQueries({ queryKey: cacheKey, exact: true });
  }, [scope, enabled, queryClient, cacheKey]);
  const [timedOutCacheIdentity, setTimedOutCacheIdentity] = useState<string | null>(null);
  const initialLoadingTimedOut = timedOutCacheIdentity === cacheIdentity;
  const [emptyContinuationStopped, setEmptyContinuationStopped] = useState(false);
  const [refreshErrors, setRefreshErrors] = useState<Partial<Record<MediaTypeFilter, string | null>>>({});
  const [refillErrors, setRefillErrors] = useState<Partial<Record<MediaTypeFilter, string | null>>>({});
  const [loadMoreErrors, setLoadMoreErrors] = useState<Partial<Record<MediaTypeFilter, string | null>>>({});
  const lastFailedRefills = useRef(
    new Map<MediaTypeFilter, RemovedFeedItem<PersonalizedRecommendation>>()
  );
  const refillScheduler = useRef<ReturnType<typeof createTrailingScheduler> | null>(null);
  if (!refillScheduler.current) {
    refillScheduler.current = createTrailingScheduler(RECOMMENDATION_REFILL_DEBOUNCE_MS, {
      set: (run, ms) => setTimeout(run, ms),
      clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>)
    });
  }
  const [scheduledRefillPending, setScheduledRefillPending] = useState(false);
  const scheduledRefillRunner = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    setScheduledRefillPending(false);
    return () => refillScheduler.current?.cancel();
  }, [scope]);
  const scheduleRefill = () => {
    if (!isCurrent()) return;
    setScheduledRefillPending(true);
    refillScheduler.current?.schedule(() => {
      if (!isCurrent()) return;
      setScheduledRefillPending(false);
      void scheduledRefillRunner.current();
    });
  };
  const refreshInFlight = useRef(false);
  const refillInFlight = useRef(false);
  const loadMoreInFlight = useRef(false);
  const [requestSettlementRevision, setRequestSettlementRevision] = useState(0);
  const impressionBatchesInFlight = useRef(new Set<string>());
  const recordedImpressionBatches = useRef(new Set<string>());
  const emptyContinuationAttempts = useRef(0);
  const emptyContinuationStartedAt = useRef<number | null>(null);
  const emptyContinuationNoProgressStreak = useRef(0);
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
          ...discoveryFilters,
          userId: user?.id ?? "anonymous",
          cursor: null,
          excludeIds: [],
          limit: PERSONALIZED_RECOMMENDATION_BATCH_SIZE,
          mediaType,
          signal
        })
      ),
    enabled,
    retry: 0,
    staleTime: 10 * 60_000,
    // Cached pages include the scan cursor. Lifecycle refetches must not start
    // over at page one and repeat provider work; refresh is an explicit action.
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
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
    emptyContinuationNoProgressStreak.current = 0;
    setRefreshErrors({}); setRefillErrors({}); setLoadMoreErrors({});
    lastFailedRefills.current.clear();
  }, [cacheIdentity]);

  useEffect(() => {
    if (!enabled || !recommendationQuery.isLoading || recommendationQuery.data || initialLoadingTimedOut) return;
    const timeoutId = setTimeout(() => {
      setTimedOutCacheIdentity(cacheIdentity);
      void queryClient.cancelQueries({ queryKey: cacheKey, exact: true });
    }, INITIAL_LOADING_DEADLINE_MS);
    return () => clearTimeout(timeoutId);
  }, [enabled, cacheIdentity, cacheKey, initialLoadingTimedOut, queryClient, recommendationQuery.data, recommendationQuery.isLoading]);

  useEffect(() => {
    if (!enabled || !user || !recommendationQuery.data?.items.length) return;
    const items = recommendationQuery.data.items.filter((item) =>
      (!exclusions || !isExcludedRecommendation(item, exclusions)) && matchesDiscoveryFilters(item, discoveryFilters)
    );
    rememberRecommendationSessionSeenIds(
      user.id,
      collectRecommendationSessionSeenIds(items)
    );
    const identity = (item: PersonalizedRecommendation) => `${user.id}:${mediaType}:${item.canonical_id}`;
    const unseen = items.filter(item =>
      createRecommendationIdentityAliases(item).every(key => !libraryIdentityKeys.has(key)) &&
      !recordedImpressionBatches.current.has(identity(item)) &&
      !impressionBatchesInFlight.current.has(identity(item))
    );
    if (!unseen.length) return;
    const controller = scope.controller();
    unseen.forEach(item => impressionBatchesInFlight.current.add(identity(item)));
    void (async () => {
      for (let offset = 0; offset < unseen.length && !controller.signal.aborted; offset += 12) {
        const batch = unseen.slice(offset, offset + 12);
        await recordImpressionsWithRetry(batch, controller.signal);
        if (!controller.signal.aborted) batch.forEach(item => recordedImpressionBatches.current.add(identity(item)));
      }
    })().catch((error) => {
      if (!controller.signal.aborted) console.error("recommendation impression persistence failed:", error);
    }).finally(() => {
      unseen.forEach(item => impressionBatchesInFlight.current.delete(identity(item)));
      scope.release(controller);
    });
  }, [enabled, scope, mediaType, recommendationQuery.data?.items, libraryIdentityKeys, user, exclusions, discoveryFilters]);

  const countDisplayedRecommendations = (items: readonly PersonalizedRecommendation[]) =>
    countRecommendationDisplaySlots(
      filterVisibleRecommendationCandidates(items, libraryItems, exclusions ?? null, discoveryFilters)
        .map(item => item.canonical_id),
      options.retainedIds ?? []
    );

  const refresh = async (): Promise<boolean> => {
    if (
      !isCurrent() || !user ||
      refreshMutation.isPending ||
      refillMutation.isPending ||
      loadMoreMutation.isPending ||
      refreshInFlight.current ||
      refillInFlight.current ||
      loadMoreInFlight.current
    ) {
      return false;
    }

    setRecommendationBatchTarget(PERSONALIZED_RECOMMENDATION_BATCH_SIZE);
    refillScheduler.current?.cancel();
    setScheduledRefillPending(false);
    refreshInFlight.current = true;
    emptyContinuationAttempts.current = 0;
    emptyContinuationStartedAt.current = null;
    emptyContinuationNoProgressStreak.current = 0;
    setEmptyContinuationStopped(false);

    try {
      await queryClient.cancelQueries({ queryKey: cacheKey, exact: true });
      if (!isCurrent()) return false;
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

      const controller = scope.controller();
      const request = createRequest({
        ...discoveryFilters,
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
        scope.release(controller);
        if (!isCurrent()) return false;
        queryClient.setQueryData(cacheKey, next);
        rememberRecommendationSessionSeenIds(
          user.id,
          collectRecommendationSessionSeenIds(next.items)
        );
        lastFailedRefills.current.delete(mediaType);
        setRefillError(mediaType, null);
        return true;
      } catch (error) {
        if (!isCurrent()) return false;
        scope.release(controller);
        setRefreshError(mediaType, toErrorMessage(error, "새 추천을 불러오지 못했습니다"));
        return false;
      }
    } finally {
      refreshInFlight.current = false;
      setRequestSettlementRevision((revision) => revision + 1);
    }
  };

  const removeOptimistically = (
    recommendationId: string
  ): RemovedFeedItem<PersonalizedRecommendation> | null => {
    if (!isCurrent()) return null;
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
      !isCurrent() || !user ||
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
      if (!isCurrent()) return "failed";
      const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
      if (!current) return "failed";
      if (getRecommendationRetryAction(current) === "complete") return "exhausted";

      const removedIds = collectRecommendationSessionSeenIds([removed.item]);
      rememberRecommendationSessionSeenIds(user.id, [
        ...collectRecommendationSessionSeenIds(current.items),
        ...removedIds
      ]);

      const controller = scope.controller();
      const request = createRequest({
        ...discoveryFilters,
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
        scope.release(controller);
        if (!isCurrent()) return "failed";
        const replacement = findVisibleRecommendationReplacement(
          next.items, [...current.items, removed.item], libraryItems, exclusions ?? null, discoveryFilters
        );

        if (!replacement) {
          const appended = appendRecommendationFeed(
            createRecommendationFeedState({ items: current.items }),
            { items: next.items },
            (item) => item.canonical_id,
            createRecommendationIdentityAliases
          );
          queryClient.setQueryData<PersonalizedRecommendationsResponse>(cacheKey, {
            ...current,
            items: appended.items,
            next_cursor: next.next_cursor,
            has_more: next.has_more,
            is_exhausted: next.is_exhausted,
            broadened: next.broadened,
            partial: current.partial || next.partial,
            filter_limited: Boolean(current.filter_limited || next.filter_limited),
            unsupported_filter: next.unsupported_filter ?? null,
            failed_sources: Array.from(new Set([...current.failed_sources, ...next.failed_sources]))
          });
          lastFailedRefills.current.delete(mediaType);
          // The normal, bounded fill effect continues from this cursor. A raw
          // item hidden by account filters is never reported as a filled slot.
          return getRecommendationRetryAction(next) === "continue" ? "pending" : "exhausted";
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
          has_more: next.has_more,
          is_exhausted: next.is_exhausted,
          broadened: next.broadened,
          profile_mode: next.profile_mode,
          partial: current.partial || next.partial,
          filter_limited: Boolean(current.filter_limited || next.filter_limited),
          unsupported_filter: next.unsupported_filter ?? null,
          failed_sources: Array.from(new Set([...current.failed_sources, ...next.failed_sources]))
        });
        rememberRecommendationSessionSeenIds(
          user.id,
          collectRecommendationSessionSeenIds([replacement])
        );
        lastFailedRefills.current.delete(mediaType);
        return "refilled";
      } catch (error) {
        if (!isCurrent()) return "failed";
        scope.release(controller);
        lastFailedRefills.current.set(mediaType, removed);
        setRefillError(mediaType, toErrorMessage(error, "새 추천 한 작품을 불러오지 못했습니다"));
        return "failed";
      }
    } finally {
      refillInFlight.current = false;
      setRequestSettlementRevision((revision) => revision + 1);
    }
  };

  const runScheduledRefill = async (): Promise<void> => {
    if (!isCurrent() || !user) return;
    if (options.additionsInFlight || recommendationQuery.isFetching ||
      refreshMutation.isPending || loadMoreMutation.isPending || refillMutation.isPending ||
      refreshInFlight.current || loadMoreInFlight.current || refillInFlight.current) {
      scheduleRefill();
      return;
    }
    const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
    if (!current || current.unsupported_filter || getRecommendationRetryAction(current) !== "continue") return;
    setRefillError(mediaType, null);
    // A successful action group starts one full batch, just like scrolling.
    // Short/empty responses continue toward that same target in the effect below.
    await loadNextBatch();
  };
  scheduledRefillRunner.current = runScheduledRefill;

  const retryRefill = async (): Promise<RecommendationRefillResult> => {
    const removed = lastFailedRefills.current.get(mediaType);
    if (!removed) return "failed";
    return refill(removed);
  };

  const loadMore = async (limit = PERSONALIZED_RECOMMENDATION_BATCH_SIZE): Promise<boolean> => {
    if (
      !isCurrent() || !user ||
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

    const requestTarget = batchTargetRef.current.key === cacheIdentity
      ? batchTargetRef.current.target
      : PERSONALIZED_RECOMMENDATION_BATCH_SIZE;
    loadMoreInFlight.current = true;
    setEmptyContinuationStopped(false);
    setLoadMoreError(mediaType, null);
    let requestController: AbortController | null = null;
    try {
      await queryClient.cancelQueries({ queryKey: cacheKey, exact: true });
      if (!isCurrent()) return false;
      const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
      if (getRecommendationRetryAction(current) !== "continue" || !current) return false;

      const deadlineMs = getLoadMoreDeadlineMs();
      if (deadlineMs < MUTATION_LOADING_DEADLINE_MS) {
        setEmptyContinuationStopped(true);
        return false;
      }
      const controller = scope.controller();
      requestController = controller;
      const request = createRequest({
        ...discoveryFilters,
        userId: user.id,
        cursor: current.next_cursor,
        excludeIds: collectRecommendationSessionSeenIds(current.items),
        limit,
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
      if (!isCurrent()) return false;
      let appendedItemCount = 0;
      let previousVisibleCount = countDisplayedRecommendations(current.items);
      let nextVisibleCount = previousVisibleCount;
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
          (item) => item.canonical_id,
          createRecommendationIdentityAliases
        );
        appendedItemCount = appended.items.length - base.items.length;
        previousVisibleCount = countDisplayedRecommendations(base.items);
        nextVisibleCount = countDisplayedRecommendations(appended.items);
        return {
          ...base,
          ...next,
          items: appended.items,
          next_cursor: appended.cursor,
          broadened: appended.broadened,
          is_exhausted: appended.isExhausted,
          partial: base.partial || next.partial,
          filter_limited: Boolean(base.filter_limited || next.filter_limited),
          unsupported_filter: next.unsupported_filter ?? null,
          failed_sources: Array.from(new Set([...base.failed_sources, ...next.failed_sources])),
          warnings: Array.from(new Set([...base.warnings, ...next.warnings]))
        };
      });
      if (__DEV__) {
        const hidden = summarizeRecommendationVisibility(next.items, libraryItems, exclusions ?? null, discoveryFilters);
        console.info("recommendation batch", JSON.stringify({
          requested: limit,
          serverItems: next.items.length,
          appended: appendedItemCount,
          duplicates: next.items.length - appendedItemCount,
          hidden: {
            registered: hidden.registered,
            excluded: hidden.excluded,
            unverifiableTmdb: hidden.unverifiableTmdb
          },
          visibleBefore: previousVisibleCount,
          visibleAfter: nextVisibleCount,
          target: requestTarget
        }));
      }
      emptyContinuationNoProgressStreak.current = advanceRecommendationNoProgressStreak(
        emptyContinuationNoProgressStreak.current,
        previousVisibleCount,
        nextVisibleCount
      );
      rememberRecommendationSessionSeenIds(user.id, collectRecommendationSessionSeenIds(next.items));

      if (next.has_more && !next.is_exhausted && next.next_cursor === current.next_cursor) {
        setLoadMoreError(mediaType, "다음 추천으로 이동하지 못했습니다. 다시 시도해 주세요.");
      }

      return appendedItemCount > 0;
    } catch (error) {
      if (!isCurrent()) return false;
      setLoadMoreError(mediaType, toErrorMessage(error, "다음 추천을 불러오지 못했습니다"));
      return false;
    } finally {
      if (requestController) scope.release(requestController);
      loadMoreInFlight.current = false;
      setRequestSettlementRevision((revision) => revision + 1);
    }
  };

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  const visibleRecommendationCount = countDisplayedRecommendations(recommendationQuery.data?.items ?? []);
  const [batchTarget, setBatchTarget] = useState(() => ({
    key: cacheIdentity, target: PERSONALIZED_RECOMMENDATION_BATCH_SIZE
  }));
  const batchTargetRef = useRef(batchTarget);
  batchTargetRef.current = batchTarget;
  const setRecommendationBatchTarget = (target: number) => {
    const next = { key: cacheIdentity, target };
    batchTargetRef.current = next;
    setBatchTarget(next);
  };
  const visibleTarget = batchTarget.key === cacheIdentity
    ? batchTarget.target
    : PERSONALIZED_RECOMMENDATION_BATCH_SIZE;
  const loadNextBatch = async (): Promise<boolean> => {
    if (!isCurrent() || !user || options.additionsInFlight || refillScheduler.current?.isPending() ||
      recommendationQuery.isFetching || refreshMutation.isPending || refillMutation.isPending || loadMoreMutation.isPending ||
      refreshInFlight.current || refillInFlight.current || loadMoreInFlight.current) return false;
    const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
    if (!current || current.unsupported_filter || getRecommendationRetryAction(current) !== "continue") return false;
    const currentTarget = batchTargetRef.current.key === cacheIdentity
      ? batchTargetRef.current.target
      : PERSONALIZED_RECOMMENDATION_BATCH_SIZE;
    const target = nextRecommendationBatchTarget(countDisplayedRecommendations(current.items), currentTarget);
    setRecommendationBatchTarget(target);
    emptyContinuationAttempts.current = 1;
    emptyContinuationStartedAt.current = Date.now();
    emptyContinuationNoProgressStreak.current = 0;
    setEmptyContinuationStopped(false);
    setLoadMoreError(mediaType, null);
    return loadMore(PERSONALIZED_RECOMMENDATION_BATCH_SIZE);
  };
  const deferAutomaticRefill = shouldDeferRecommendationRefill({
    additionsInFlight: options.additionsInFlight ?? false,
    scheduled: scheduledRefillPending
  });
  const emptyContinuationDecision = decideEmptyRecommendationContinuation({
    unsupportedFilter: Boolean(recommendationQuery.data?.unsupported_filter),
    hasData: Boolean(recommendationQuery.data),
    itemCount: visibleRecommendationCount,
    targetItemCount: visibleTarget,
    isLoading:
      deferAutomaticRefill || recommendationQuery.isFetching ||
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
    consecutiveNoProgressAttempts: emptyContinuationNoProgressStreak.current,
    maxContinuationAttempts: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS,
    elapsedMs:
      emptyContinuationStartedAt.current === null
        ? 0
        : Date.now() - emptyContinuationStartedAt.current,
    maxDurationMs: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS
  });

  useEffect(() => {
    if (!enabled || deferAutomaticRefill) return;
    if (emptyContinuationDecision === "idle") {
      emptyContinuationAttempts.current = 0;
      emptyContinuationStartedAt.current = null;
      emptyContinuationNoProgressStreak.current = 0;
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
    void loadMoreRef.current(recommendationContinuationLimit(visibleRecommendationCount, visibleTarget));
    // Mutation observers/cache updates may render before the async finally
    // releases its ref lock. Re-evaluate after settlement even when visible
    // count and decision are unchanged, so a short page cannot remain stuck.
  }, [enabled, deferAutomaticRefill, emptyContinuationDecision, visibleRecommendationCount, visibleTarget, requestSettlementRevision]);

  const feedbackInFlight = useRef(false);
  const submitFeedback = async (
    item: PersonalizedRecommendation,
    input: { targetType: "content" | "theme"; targetKey: string; action: "more" | "less" | "exclude" | "not_interested"; remove: boolean }
  ): Promise<RecommendationRefillResult | "saved"> => {
    if (!isCurrent() || feedbackInFlight.current) throw new Error("지금은 추천 피드백을 저장할 수 없습니다. 연결 상태를 확인해 주세요.");
    feedbackInFlight.current = true;
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
      if (!isCurrent()) return "saved";
      if (removed) return refill(removed);
      return "saved";
    } catch (error) {
      if (removed) restore(removed);
      throw error;
    } finally { feedbackInFlight.current = false; }
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
    if (!isCurrent()) return { data: undefined };
    const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
    if (current) {
      if (getRecommendationRetryAction(current) === "continue") await retryEmptyContinuation();
      return { data: queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey) };
    }
    setTimedOutCacheIdentity(null);
    setEmptyContinuationStopped(false);
    emptyContinuationAttempts.current = 0;
    emptyContinuationStartedAt.current = null;
    emptyContinuationNoProgressStreak.current = 0;
    return recommendationQuery.refetch();
  };

  const retryEmptyContinuation = async (): Promise<boolean> => {
    if (!isCurrent()) return false;
    const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
    const action = getRecommendationRetryAction(current);
    if (action === "complete") return false;
    setEmptyContinuationStopped(false);
    emptyContinuationAttempts.current = 1;
    emptyContinuationStartedAt.current = Date.now();
    emptyContinuationNoProgressStreak.current = 0;
    if (action === "continue") {
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
      refreshMutation.isPending && JSON.stringify(refreshVariables?.cacheKey) === cacheIdentity,
    isRefilling:
      refillMutation.isPending && JSON.stringify(refillVariables?.cacheKey) === cacheIdentity,
    isLoadingMore:
      loadMoreMutation.isPending && JSON.stringify(loadMoreVariables?.cacheKey) === cacheIdentity,
    isBatchScheduled: scheduledRefillPending,
    refreshError: refreshErrors[mediaType] ?? null,
    refillError: refillErrors[mediaType] ?? null,
    loadMoreError: loadMoreErrors[mediaType] ?? null,
    emptyContinuationStopped,
    unsupportedFilter: recommendationQuery.data?.unsupported_filter ?? null,
    currentRecommendationIds:
      collectRecommendationSessionSeenIds(recommendationQuery.data?.items ?? []),
    recommendationCursor: recommendationQuery.data?.next_cursor ?? null,
    isExhausted: getRecommendationRetryAction(recommendationQuery.data) === "complete",
    refresh,
    removeOptimistically,
    restore,
    refill,
    scheduleRefill,
    retryRefill,
    loadMore,
    loadNextBatch,
    visibleTarget,
    visibleCount: visibleRecommendationCount,
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
    excludeIds: limitRecommendationRequestExclusions(request.excludeIds)
  };
}

async function recordImpressionsWithRetry(
  items: readonly PersonalizedRecommendation[],
  signal: AbortSignal
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (signal.aborted) return;
    try {
      await recordPersonalizedRecommendationImpressions(items, signal);
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
