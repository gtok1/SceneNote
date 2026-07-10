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
