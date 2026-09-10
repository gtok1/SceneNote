import { SEARCH_RECOMMENDATIONS_ENABLED } from "@/constants/features";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { getSimilarContent } from "@/services/similarContent";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import type { SimilarityFocus, SimilarityModifier, SimilaritySort } from "@/utils/similarSearchIntent";

export function useSimilarContent(anchor:SearchResult|null,targetMediaType:MediaTypeFilter,focus:SimilarityFocus,sort:SimilaritySort,modifiers:SimilarityModifier[], options: { enabled?: boolean } = {}){
  const modifierKey=modifiers.map((item)=>`${item.direction}:${item.key}`).sort().join(",");
  const queryClient = useQueryClient();
  const anchorKey = anchor ? `${anchor.external_source}:${anchor.external_id}:${anchor.season_number ?? "whole"}` : "";
  const key = useMemo(() => queryKeys.search.similar(anchorKey, focus, targetMediaType, sort, modifierKey), [anchorKey, focus, targetMediaType, sort, modifierKey]);
  const enabled = SEARCH_RECOMMENDATIONS_ENABLED && Boolean(anchor) && (options.enabled ?? true);
  useEffect(() => () => { if (enabled) void queryClient.cancelQueries({queryKey:key, exact:true}); }, [enabled, key, queryClient]);
  return useQuery({queryKey:key,queryFn:({signal})=>getSimilarContent({signal,anchor:anchor as SearchResult,targetMediaType,focus,sort,modifiers}),enabled,retry:0,staleTime:10*60_000});
}
