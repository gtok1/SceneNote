/** Saved public metadata changes only after an explicit refresh; user records use their own queries. */
export const MANUAL_METADATA_QUERY_OPTIONS = {
  staleTime: Infinity,
  gcTime: 24 * 60 * 60_000,
  retry: false,
  retryOnMount: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false
} as const;

/** 외부 API를 부르는 Edge 목록 조회. 실패는 화면의 다시 시도로만 다시 부른다(docs/71 D-6). */
export const EDGE_LIST_QUERY_OPTIONS = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false
} as const;
