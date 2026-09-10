import { supabase } from "@/lib/supabase";
import { searchContent } from "@/services/contentSearch";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import type { SimilarityFocus, SimilarityModifier, SimilaritySort } from "@/utils/similarSearchIntent";

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
}
export interface SimilarContentResponse { mode:"similarity"; anchor:SearchResult; items:SimilarContentResult[]; has_more:boolean; next_cursor:string|null; warnings:string[]; ranking_version:string; }

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

export async function getSimilarContent(input:{anchor:SearchResult;targetMediaType:MediaTypeFilter;focus:SimilarityFocus;sort:SimilaritySort;modifiers:SimilarityModifier[];limit?:number;signal?:AbortSignal;}):Promise<SimilarContentResponse>{
  const {data,error}=await supabase.functions.invoke<SimilarContentResponse>("similar-content",{timeout:10_000,...(input.signal ? {signal:input.signal} : {}),body:{anchor:input.anchor,target_media_type:input.targetMediaType,focus:input.focus,sort:input.sort,filters:{modifiers:input.modifiers},limit:input.limit??12}});
  if(error) throw new Error(error.message||"유사 작품을 불러오지 못했습니다");
  if(!data||!Array.isArray(data.items)) throw new Error("유사 작품 응답이 올바르지 않습니다");
  return data;
}

function matchQuality(query:string,result:SearchResult):number { const titles=[result.title_primary,result.title_original??""].map(normalizeTitle); if(titles.includes(query))return 4; if(titles.some((t)=>t.startsWith(query)||query.startsWith(t)))return 3; if(titles.some((t)=>t.includes(query)||query.includes(t)))return 2; return 1; }
function normalizeTitle(value:string):string{return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu,"");}
