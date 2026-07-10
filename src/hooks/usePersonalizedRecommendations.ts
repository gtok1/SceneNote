import { useEffect, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import {
  getPersonalizedRecommendations,
  recordPersonalizedRecommendationImpressions,
  type PersonalizedRecommendation,
  type PersonalizedRecommendationsRequest,
  type PersonalizedRecommendationsResponse
} from "@/services/personalizedRecommendations";
import { useAuthStore } from "@/stores/authStore";
import type { MediaTypeFilter } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import {
  createRecommendationFeedState,
  refillRecommendationFeedItem,
  removeRecommendationFeedItem,
  restoreRecommendationFeedItem,
  type RemovedFeedItem
} from "@/utils/recommendationFeed";
import {
  collectRecommendationSessionSeenIds,
  rememberRecommendationSessionSeenIds
} from "@/utils/recommendationSession";

type RecommendationQueryKey = ReturnType<typeof queryKeys.recommendations.personalized>;

interface RecommendationMutationVariables {
  cacheKey: RecommendationQueryKey;
  mediaType: MediaTypeFilter;
  request: PersonalizedRecommendationsRequest;
}

export type RecommendationRefillResult = "refilled" | "exhausted" | "failed";

export function usePersonalizedRecommendations(
  mediaType: MediaTypeFilter,
  _libraryItems: readonly LibraryListItem[],
  options: { enabled?: boolean } = {}
) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.recommendations.personalized(user?.id ?? "anonymous", mediaType);
  const [refreshErrors, setRefreshErrors] = useState<Partial<Record<MediaTypeFilter, string | null>>>({});
  const [refillErrors, setRefillErrors] = useState<Partial<Record<MediaTypeFilter, string | null>>>({});
  const lastFailedRefills = useRef(
    new Map<MediaTypeFilter, RemovedFeedItem<PersonalizedRecommendation>>()
  );
  const refreshInFlight = useRef(false);
  const refillInFlight = useRef(false);
  const impressionBatchesInFlight = useRef(new Set<string>());
  const recordedImpressionBatches = useRef(new Set<string>());

  const recommendationQuery = useQuery({
    queryKey: cacheKey,
    queryFn: () =>
      getPersonalizedRecommendations(
        createRequest({
          userId: user?.id ?? "anonymous",
          cursor: null,
          excludeIds: [],
          limit: 12,
          mediaType
        })
      ),
    enabled: Boolean(user && (options.enabled ?? true)),
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
      refreshInFlight.current ||
      refillInFlight.current
    ) {
      return false;
    }

    refreshInFlight.current = true;

    try {
      await queryClient.cancelQueries({ queryKey: cacheKey, exact: true });
      const current = queryClient.getQueryData<PersonalizedRecommendationsResponse>(cacheKey);
      if (!current) {
        const result = await recommendationQuery.refetch();
        return Boolean(result.data);
      }

      rememberRecommendationSessionSeenIds(
        user.id,
        collectRecommendationSessionSeenIds(current.items)
      );

      const request = createRequest({
        userId: user.id,
        cursor: current.next_cursor,
        excludeIds: collectRecommendationSessionSeenIds(current.items),
        limit: 12,
        mediaType
      });
      const variables = { cacheKey, mediaType, request };
      setRefreshError(mediaType, null);

      try {
        const next = await refreshMutation.mutateAsync(variables);
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
      refillInFlight.current ||
      refreshInFlight.current
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

      const request = createRequest({
        userId: user.id,
        cursor: current.next_cursor,
        excludeIds: [
          ...collectRecommendationSessionSeenIds(current.items),
          ...removedIds
        ],
        limit: 1,
        mediaType
      });
      const variables = { cacheKey, mediaType, request };
      setRefillError(mediaType, null);

      try {
        const next = await refillMutation.mutateAsync(variables);
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

  const refreshVariables = refreshMutation.variables;
  const refillVariables = refillMutation.variables;

  return {
    ...recommendationQuery,
    recommendations: recommendationQuery.data?.items ?? [],
    isInitialLoading: recommendationQuery.isLoading,
    isRefreshing:
      refreshMutation.isPending && refreshVariables?.mediaType === mediaType,
    isRefilling:
      refillMutation.isPending && refillVariables?.mediaType === mediaType,
    refreshError: refreshErrors[mediaType] ?? null,
    refillError: refillErrors[mediaType] ?? null,
    currentRecommendationIds:
      collectRecommendationSessionSeenIds(recommendationQuery.data?.items ?? []),
    recommendationCursor: recommendationQuery.data?.next_cursor ?? null,
    isExhausted: recommendationQuery.data?.is_exhausted ?? false,
    refresh,
    removeOptimistically,
    restore,
    refill,
    retryRefill
  };

  function setRefreshError(targetMediaType: MediaTypeFilter, message: string | null) {
    setRefreshErrors((current) => ({ ...current, [targetMediaType]: message }));
  }

  function setRefillError(targetMediaType: MediaTypeFilter, message: string | null) {
    setRefillErrors((current) => ({ ...current, [targetMediaType]: message }));
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
