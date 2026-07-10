import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { getSimilarContent } from "@/services/similarContent";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import type { SimilarityFocus, SimilarityModifier, SimilaritySort } from "@/utils/similarSearchIntent";

export function useSimilarContent(anchor:SearchResult|null,targetMediaType:MediaTypeFilter,focus:SimilarityFocus,sort:SimilaritySort,modifiers:SimilarityModifier[]){
  const modifierKey=modifiers.map((item)=>`${item.direction}:${item.key}`).sort().join(",");
  return useQuery({queryKey:queryKeys.search.similar(anchor?`${anchor.external_source}:${anchor.external_id}`:"",focus,targetMediaType,sort,modifierKey),queryFn:()=>getSimilarContent({anchor:anchor as SearchResult,targetMediaType,focus,sort,modifiers}),enabled:Boolean(anchor),staleTime:10*60_000});
}
