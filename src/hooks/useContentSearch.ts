import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import { getExternalContentDetail, searchContent } from "@/services/contentSearch";
import type { MediaTypeFilter, SearchResult } from "@/types/content";

export function useContentSearch(query: string, mediaType: MediaTypeFilter = "all", page = 1) {
  const normalizedQuery = query.trim();

  return useQuery({
    queryKey: queryKeys.search.results(normalizedQuery, mediaType, page),
    queryFn: () => searchContent({ query: normalizedQuery, mediaType, page }),
    enabled: normalizedQuery.length >= 2,
    staleTime: 5 * 60_000
  });
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
