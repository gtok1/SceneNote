export interface SearchCachePayload<T> {
  results: T[];
  total: number;
  hasNextPage: boolean;
}

export function normalizeSearchCachePayload<T>(value: Partial<SearchCachePayload<T>>): SearchCachePayload<T> {
  const results = value.results ?? [];
  return {
    results,
    total: value.total ?? results.length,
    hasNextPage: Boolean(value.hasNextPage)
  };
}
