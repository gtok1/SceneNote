import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import { externalContentDetailQueryKey, fetchExternalContentDetail, getExternalContentDetail, searchContent } from "@/services/contentSearch";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import { mergeSearchPages } from "@/utils/searchPagination";
import { EDGE_LIST_QUERY_OPTIONS, MANUAL_METADATA_QUERY_OPTIONS } from "@/utils/metadataQuery";
import { discoveryFilterKey, normalizeDiscoveryFilters, type DiscoveryFilterInput } from "../../supabase/functions/_shared/discoveryFilters";

export function useContentSearch(
  query: string,
  mediaType: MediaTypeFilter = "all",
  countries: string | readonly string[] = [],
  options: DiscoveryFilterInput & { enabled?: boolean } = {}
) {
  const normalizedQuery = query.trim();
  const filters = normalizeDiscoveryFilters({ ...options, ...(typeof countries === "string" ? { country: countries } : { countries }) });
  const browsing = normalizedQuery.length === 0 && filters.countries.length > 0;
  const searchQuery = useInfiniteQuery({
    ...EDGE_LIST_QUERY_OPTIONS,
    queryKey: queryKeys.search.results(normalizedQuery, mediaType, 1, discoveryFilterKey(filters)),
    queryFn: ({ pageParam, signal }) =>
      searchContent({ query: normalizedQuery, mediaType, page: pageParam, ...filters, signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    // Browse mode has no query to be long enough, the country stands in for it.
    enabled: (options.enabled ?? true) && (browsing || normalizedQuery.length >= 2),
    staleTime: 5 * 60_000
  });

  const pages = searchQuery.data?.pages ?? [];
  const latestPage = pages.at(-1);
  const results = mergeSearchPages(pages);

  return {
    ...searchQuery,
    data: latestPage ? {
      ...latestPage,
      results,
      country_filter_limited: pages.some((page) => page.country_filter_limited),
      genre_filter_limited: pages.some((page) => page.genre_filter_limited),
      partial: pages.some((page) => page.partial),
      total: Math.max(latestPage.total, results.length)
    } : undefined
  };
}

export function useExternalContentDetail(
  source: SearchResult["external_source"] | undefined,
  externalId: string | undefined,
  mediaType?: string
) {
  const params = { source: source as SearchResult["external_source"], externalId: externalId ?? "", ...(mediaType ? { mediaType } : {}) };
  const query = useQuery({
    ...MANUAL_METADATA_QUERY_OPTIONS,
    queryKey: externalContentDetailQueryKey(params),
    queryFn: () => fetchExternalContentDetail(params),
    enabled: (current) => Boolean(source && externalId) && current.state.data === undefined && !current.state.error,
  });
  return {
    ...query,
    refresh: () => source && externalId
      ? getExternalContentDetail({ ...params, forceRefresh: true })
      : Promise.reject(new Error("작품 정보가 없어 다시 불러올 수 없어요."))
  };
}
