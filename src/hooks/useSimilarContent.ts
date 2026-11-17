import { SEARCH_RECOMMENDATIONS_ENABLED } from "@/constants/features";
import { useEffect, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { getSimilarContent } from "@/services/similarContent";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import type { SimilarityFocus, SimilarityModifier, SimilaritySort } from "@/utils/similarSearchIntent";
import { isSimilarityRestartRequired, mergeSimilarPages, nextSimilarCursor, similarPaginationUnavailable, similarityAnchorKey, normalizeSimilaritySecondarySort } from "@/utils/similarContentPagination";
import { filterUnregisteredSimilarWorks, similarityLibrarySignature, type SimilarityLibraryEntry } from "../../supabase/functions/_shared/similarityLibrary";

export function useSimilarContent(anchor:SearchResult|null,targetMediaType:MediaTypeFilter,focus:SimilarityFocus,sort:SimilaritySort,modifiers:SimilarityModifier[], options: { enabled?: boolean; userId?: string | undefined; libraryItems?: readonly SimilarityLibraryEntry[]; libraryReady?: boolean } = {}){
  const modifierKey=modifiers.map((item)=>`${item.direction}:${item.key}`).sort().join(",");
  const queryClient = useQueryClient();
  const anchorKey = similarityAnchorKey(anchor);
  const userId = options.userId ?? "";
  const librarySignature = useMemo(() => similarityLibrarySignature(options.libraryItems ?? []), [options.libraryItems]);
  const secondarySort = normalizeSimilaritySecondarySort(sort);
  const key = useMemo(() => queryKeys.search.similar(userId, librarySignature, anchorKey, focus, targetMediaType, secondarySort, modifierKey), [userId, librarySignature, anchorKey, focus, targetMediaType, secondarySort, modifierKey]);
  const canRead = Boolean(userId) && options.libraryReady === true;
  const enabled = SEARCH_RECOMMENDATIONS_ENABLED && Boolean(anchor) && canRead && (options.enabled ?? true);
  useEffect(() => () => { if (enabled) void queryClient.cancelQueries({queryKey:key, exact:true}); }, [enabled, key, queryClient]);
  const queryOptions = {
    queryKey: key,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) => getSimilarContent({
      signal, anchor: anchor as SearchResult, targetMediaType, focus, sort: secondarySort, modifiers, cursor: pageParam
    }),
    initialPageParam: null as string | null,
    getNextPageParam: nextSimilarCursor,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 10 * 60_000
  };
  const query = useInfiniteQuery({ ...queryOptions, enabled });
  const pages = query.data?.pages;
  const data = useMemo(() => {
    const lastPage = pages?.at(-1);
    if (!canRead || !lastPage || !pages) return undefined;
    const merged = mergeSimilarPages(pages);
    const items = filterUnregisteredSimilarWorks(merged, options.libraryItems ?? []);
    const { total_count: total, ...rest } = lastPage;
    // The server total counts the user's filtered projection. If a stale cached
    // page needs extra client-side exclusion, don't present that old total as exact.
    return { ...rest, ...(items.length === merged.length && total !== undefined ? { total_count: total } : {}), items, warnings: [...new Set(pages.flatMap(page => page.warnings))] };
    // Identity signature deliberately ignores statuses, row order and duplicate rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, canRead, librarySignature]);
  const stalled = Boolean(pages?.length && pages.at(-1)?.has_more && !query.hasNextPage);
  return {
    ...query,
    data,
    restartRequired: isSimilarityRestartRequired(query.error) || stalled,
    paginationUnavailable: similarPaginationUnavailable(pages ?? []),
    fetchNextPage: () => {
      if (!enabled || query.isFetching || !query.hasNextPage || stalled || isSimilarityRestartRequired(query.error)) return Promise.resolve(undefined);
      return query.fetchNextPage({ cancelRefetch: false });
    },
    // A new snapshot starts at page one. Failed refreshes leave the old cards readable.
    refetch: () => enabled
      ? queryClient.fetchInfiniteQuery({ ...queryOptions, pages: 1, staleTime: 0 }).catch(() => undefined)
      : Promise.resolve(undefined)
  };
}
