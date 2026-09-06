import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import { getExternalContentDetail, searchContent } from "@/services/contentSearch";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import { mergeSearchPages } from "@/utils/searchPagination";
import { ALL_COUNTRY_FILTER, isBrowseMode } from "@/utils/countryFilter";

export function useContentSearch(
  query: string,
  mediaType: MediaTypeFilter = "all",
  country: string = ALL_COUNTRY_FILTER
) {
  const normalizedQuery = query.trim();
  const browsing = isBrowseMode(normalizedQuery, country);
  const searchQuery = useInfiniteQuery({
    queryKey: queryKeys.search.results(normalizedQuery, mediaType, 1, country),
    queryFn: ({ pageParam }) =>
      searchContent({ query: normalizedQuery, mediaType, page: pageParam, country }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    // Browse mode has no query to be long enough, the country stands in for it.
    enabled: browsing || normalizedQuery.length >= 2,
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
