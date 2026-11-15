import { supabase } from "@/lib/supabase";
import { searchContent } from "@/services/contentSearch";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import type { SimilarityFocus, SimilarityModifier, SimilaritySort } from "@/utils/similarSearchIntent";
import { SIMILAR_PAGE_SIZE, SIMILAR_PAGINATION_VERSION, SimilarContentError, validateSimilarPage, normalizeSimilaritySecondarySort } from "@/utils/similarContentPagination";
import type { SimilarityIdentityAlias } from "../../supabase/functions/_shared/similarityEngine";

export interface SimilaritySignal { type: string; label: string; score: number; source: string; }
export interface SimilarContentResult extends SearchResult {
  similarity_score: number;
  shared_signals: SimilaritySignal[];
  similarity_reason: string;
  tags?: string[];
  people?: string[];
  studios?: string[];
  popularity?: number | null;
  vote_count?: number | null;
  identity_aliases?: SimilarityIdentityAlias[];
}
export interface SimilarContentResponse { mode:"similarity"; anchor:SearchResult; items:SimilarContentResult[]; has_more:boolean; next_cursor:string|null; warnings:string[]; ranking_version:string; pagination_version?:string; total_count?:number; }

export async function resolveSimilarityAnchors(anchorText:string, mediaType:MediaTypeFilter, signal?:AbortSignal):Promise<SearchResult[]> {
  const response = await searchContent({query:anchorText,mediaType,page:1,...(signal?{signal}:{})});
  const compact = normalizeTitle(anchorText);
  return response.results
    .map((result,index)=>({result,index,quality:matchQuality(compact,result)}))
    .sort((a,b)=>b.quality-a.quality||a.index-b.index)
    .slice(0,6).map((entry)=>entry.result);
}

export function shouldAutoSelectAnchor(anchorText:string,candidates:readonly SearchResult[]):boolean {
  if (candidates.length===1) return true; if (!candidates[0]) return false;
  const query=normalizeTitle(anchorText); const first=matchQuality(query,candidates[0]); const second=candidates[1]?matchQuality(query,candidates[1]):0;
  return first>=3 && first>second;
}

export async function getSimilarContent(input:{anchor:SearchResult;targetMediaType:MediaTypeFilter;focus:SimilarityFocus;sort:SimilaritySort;modifiers:SimilarityModifier[];limit?:number;cursor?:string|null;signal?:AbortSignal;}):Promise<SimilarContentResponse>{
  const {data,error}=await supabase.functions.invoke<SimilarContentResponse>("similar-content",{timeout:14_000,...(input.signal ? {signal:input.signal} : {}),body:{anchor:input.anchor,target_media_type:input.targetMediaType,focus:input.focus,sort:normalizeSimilaritySecondarySort(input.sort),pagination_version:SIMILAR_PAGINATION_VERSION,filters:{modifiers:input.modifiers},limit:input.limit??SIMILAR_PAGE_SIZE,...(input.cursor?{cursor:input.cursor}:{})}});
  if(error) {
    const response = error.context instanceof Response ? error.context : null;
    const payload: unknown = response ? await response.clone().json().catch(() => null) : null;
    const code = payload && typeof payload === "object" && "error" in payload && payload.error === "SIMILARITY_RESTART_REQUIRED"
      ? "SIMILARITY_RESTART_REQUIRED" : "SIMILARITY_PROVIDER_FAILED";
    throw new SimilarContentError(code);
  }
  if(!data || data.mode !== "similarity" || !Array.isArray(data.items) || !Array.isArray(data.warnings) ||
    data.warnings.some(warning => typeof warning !== "string") ||
    data.items.some(item => !item || typeof item.external_source !== "string" || typeof item.external_id !== "string" || typeof item.title_primary !== "string")) throw new SimilarContentError("INVALID_RESPONSE");
  validateSimilarPage(data);
  return data;
}

function matchQuality(query:string,result:SearchResult):number { const titles=[result.title_primary,result.title_original??""].map(normalizeTitle); if(titles.includes(query))return 4; if(titles.some((t)=>t.startsWith(query)||query.startsWith(t)))return 3; if(titles.some((t)=>t.includes(query)||query.includes(t)))return 2; return 1; }
function normalizeTitle(value:string):string{return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu,"");}
