import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import { getExternalContentDetail, searchContent } from "@/services/contentSearch";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import { mergeSearchPages } from "@/utils/searchPagination";
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
  return useQuery({
    queryKey: ["content", "external-detail", "v2-anime-voice-type", source, externalId, mediaType] as const,
    queryFn: () => {
      const params: {
        source: SearchResult["external_source"];
        externalId: string;
        mediaType?: string;
      } = {
        source: source as SearchResult["external_source"],
        externalId: externalId ?? ""
      };
      if (mediaType) params.mediaType = mediaType;
      return getExternalContentDetail(params);
    },
    enabled: Boolean(source && externalId),
    staleTime: 10 * 60_000
  });
}
