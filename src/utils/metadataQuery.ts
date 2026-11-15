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
