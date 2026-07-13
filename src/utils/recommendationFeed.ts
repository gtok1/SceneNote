export interface RecommendationFeedState<T> {
  items: T[];
  cursor: string | null;
  isExhausted: boolean;
  broadened: boolean;
  refreshError: string | null;
  refillError: string | null;
}

export interface RecommendationFeedBatch<T> {
  items: readonly T[];
  cursor?: string | null;
  isExhausted?: boolean;
  broadened?: boolean;
}

export interface RemovedFeedItem<T> {
  item: T;
  index: number;
}

export interface RemoveRecommendationFeedResult<T> {
  state: RecommendationFeedState<T>;
  removed: RemovedFeedItem<T> | null;
}

type RecommendationFeedSeed<T> = Partial<Omit<RecommendationFeedState<T>, "items">> & {
  items?: readonly T[];
};

export type EmptyRecommendationContinuationDecision =
  | "idle"
  | "loading"
  | "continue"
  | "stopped";

// The Edge Function intentionally scans one provider round per request, so an
// empty or partial batch must follow its cursor without allowing an unbounded loop.
export const MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS = 32;
export const MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS = 45_000;
export const PERSONALIZED_RECOMMENDATION_BATCH_SIZE = 12;

export interface EmptyRecommendationContinuationInput {
  hasData: boolean;
  itemCount: number;
  targetItemCount: number;
  isLoading: boolean;
  hasError: boolean;
  hasMore: boolean;
  nextCursor: string | null;
  isExhausted: boolean;
  continuationAttempts: number;
  maxContinuationAttempts: number;
  elapsedMs: number;
  maxDurationMs: number;
}

export function createRecommendationFeedState<T>(
  seed: RecommendationFeedSeed<T> = {}
): RecommendationFeedState<T> {
  return {
    items: [...(seed.items ?? [])],
    cursor: seed.cursor ?? null,
    isExhausted: seed.isExhausted ?? false,
    broadened: seed.broadened ?? false,
    refreshError: seed.refreshError ?? null,
    refillError: seed.refillError ?? null
  };
}

export function replaceRecommendationFeed<T>(
  state: RecommendationFeedState<T>,
  batch: RecommendationFeedBatch<T>
): RecommendationFeedState<T> {
  return {
    ...state,
    items: [...batch.items],
    cursor: batch.cursor ?? null,
    isExhausted: batch.isExhausted ?? false,
    broadened: batch.broadened ?? false,
    refreshError: null,
    refillError: null
  };
}

export function appendRecommendationFeed<T, TId>(
  state: RecommendationFeedState<T>,
  batch: RecommendationFeedBatch<T>,
  idSelector: (item: T) => TId
): RecommendationFeedState<T> {
  const knownIds = new Set(state.items.map(idSelector));
  const appended = batch.items.filter((item) => {
    const id = idSelector(item);
    if (knownIds.has(id)) return false;
    knownIds.add(id);
    return true;
  });

  return {
    ...state,
    items: [...state.items, ...appended],
    cursor: batch.cursor ?? null,
    isExhausted: batch.isExhausted ?? false,
    broadened: state.broadened || (batch.broadened ?? false)
  };
}

export function removeRecommendationFeedItem<T, TId>(
  state: RecommendationFeedState<T>,
  idSelector: (item: T) => TId,
  id: TId
): RemoveRecommendationFeedResult<T> {
  const index = state.items.findIndex((item) => Object.is(idSelector(item), id));
  if (index < 0) return { state, removed: null };

  const item = state.items[index];
  if (item === undefined) return { state, removed: null };

  return {
    state: {
      ...state,
      items: [...state.items.slice(0, index), ...state.items.slice(index + 1)],
      refillError: null
    },
    removed: { item, index }
  };
}

export function restoreRecommendationFeedItem<T>(
  state: RecommendationFeedState<T>,
  removed: RemovedFeedItem<T>
): RecommendationFeedState<T> {
  return insertRecommendationFeedItem(state, removed.index, removed.item);
}

export function refillRecommendationFeedItem<T>(
  state: RecommendationFeedState<T>,
  removed: RemovedFeedItem<T>,
  replacement: T
): RecommendationFeedState<T> {
  return {
    ...insertRecommendationFeedItem(state, removed.index, replacement),
    refillError: null
  };
}

export function setRecommendationRefreshError<T>(
  state: RecommendationFeedState<T>,
  error: string | null
): RecommendationFeedState<T> {
  return {
    ...state,
    refreshError: error
  };
}

export function setRecommendationRefillError<T>(
  state: RecommendationFeedState<T>,
  error: string | null
): RecommendationFeedState<T> {
  return {
    ...state,
    refillError: error
  };
}

export function shouldShowRecommendationFeed(query: string): boolean {
  return query.trim() === "";
}

export function decideEmptyRecommendationContinuation(
  input: EmptyRecommendationContinuationInput
): EmptyRecommendationContinuationDecision {
  if (
    !input.hasData ||
    input.itemCount >= input.targetItemCount ||
    input.isExhausted
  ) {
    return "idle";
  }
  if (input.isLoading) return "loading";
  if (input.hasError) return "stopped";
  if (
    input.hasMore &&
    Boolean(input.nextCursor) &&
    input.continuationAttempts < input.maxContinuationAttempts &&
    input.elapsedMs < input.maxDurationMs
  ) {
    return "continue";
  }
  return "stopped";
}

export function createRecommendationFeedKey<TMediaType extends string>(
  userId: string,
  mediaType: TMediaType
) {
  return ["recommendations", userId, "personalized", mediaType] as const;
}

function insertRecommendationFeedItem<T>(
  state: RecommendationFeedState<T>,
  requestedIndex: number,
  item: T
): RecommendationFeedState<T> {
  const index = Math.min(Math.max(requestedIndex, 0), state.items.length);

  return {
    ...state,
    items: [...state.items.slice(0, index), item, ...state.items.slice(index)]
  };
}
