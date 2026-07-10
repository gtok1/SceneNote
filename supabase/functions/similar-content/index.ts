import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { rankSimilarWorks, type SimilarityFocus, type SimilaritySort, type SimilarityWork } from "../_shared/similarityEngine.ts";

interface SimilarRequest { anchor?: SimilarityWork; target_media_type?: "all"|"anime"|"drama"|"movie"; focus?: SimilarityFocus; sort?: SimilaritySort; limit?: number; filters?: { modifiers?: { key?: string; direction?: string }[] }; }
const corsHeaders = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const TMDB_GENRES = new Map<number,string>([[12,"Adventure"],[14,"Fantasy"],[16,"Animation"],[18,"Drama"],[27,"Horror"],[28,"Action"],[35,"Comedy"],[53,"Thriller"],[80,"Crime"],[878,"Science Fiction"],[9648,"Mystery"],[10749,"Romance"],[10751,"Family"],[10752,"War"],[10759,"Action & Adventure"],[10765,"Sci-Fi & Fantasy"]]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null,{headers:corsHeaders});
  if (req.method !== "POST") return json({error:"METHOD_NOT_ALLOWED",message:"POST method required"},405);
  const auth = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!auth?.startsWith("Bearer ") || !url || !anon) return json({error:"UNAUTHORIZED",message:"Valid JWT required"},401);
  const client = createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user}} = await client.auth.getUser();
  if (!user) return json({error:"UNAUTHORIZED",message:"Valid JWT required"},401);

  let body: SimilarRequest;
  try { body = await req.json() as SimilarRequest; } catch { return json({error:"INVALID_REQUEST",message:"Invalid JSON body"},400); }
  if (!body.anchor?.external_id || !body.anchor.title_primary) return json({error:"INVALID_REQUEST",message:"anchor is required"},400);
  const focus = body.focus ?? "balanced"; const sort = body.sort ?? "similarity"; const target = body.target_media_type ?? "all";
  if (!["balanced","mood","story","setting","relationship","genre","character"].includes(focus)) return json({error:"INVALID_REQUEST",message:"invalid focus"},400);
  if (!["similarity","latest","popular"].includes(sort)) return json({error:"INVALID_REQUEST",message:"invalid sort"},400);
  const limit = Math.min(24,Math.max(1,Math.floor(body.limit ?? 12)));
  try {
    const collected = body.anchor.external_source === "tmdb" ? await collectTmdb(body.anchor,target) : await collectAniList(body.anchor,target);
    const anchor = collected.anchor;
    const candidates = applyModifiers(collected.candidates.filter((item)=>matchesTarget(item,target)),body.filters?.modifiers ?? []);
    const ranked = rankSimilarWorks(anchor,candidates,focus,sort).slice(0,limit);
    return json({mode:"similarity",anchor,items:ranked,has_more:false,next_cursor:null,warnings:collected.warnings,ranking_version:"hybrid-v1-no-embeddings"});
  } catch (error) {
    return json({error:"SIMILARITY_PROVIDER_FAILED",message:error instanceof Error ? error.message : String(error)},503);
  }
});

async function collectTmdb(input: SimilarityWork,target:string): Promise<{anchor:SimilarityWork;candidates:SimilarityWork[];warnings:string[]}> {
  const key = Deno.env.get("TMDB_API_KEY"); if (!key) throw new Error("TMDB_API_KEY is not configured");
  const kind = input.content_type === "movie" ? "movie" : "tv";
  const detail = await tmdbFetch(`/${kind}/${input.external_id}`,key,{append_to_response:"keywords,credits,recommendations,similar",language:"ko-KR"});
  const anchor = normalizeTmdb(detail,kind,input);
  anchor.tags = keywordNames(detail.keywords); anchor.people = names(detail.credits?.cast).slice(0,12); anchor.studios = names(detail.production_companies);
  const candidates = [...(detail.recommendations?.results ?? []),...(detail.similar?.results ?? [])].map((item:any)=>normalizeTmdb(item,kind)).map((item,index)=>({...item,provider_recommended:index < (detail.recommendations?.results?.length ?? 0)}));
  if (target === "anime") candidates.push(...await fetchAniListDiscovery(anchor.genres ?? []));
  if ((target === "drama" || target === "movie") && target !== (kind === "movie" ? "movie" : "drama")) candidates.push(...await fetchTmdbDiscovery(anchor.genres ?? [],target,key));
  return {anchor,candidates,warnings:["벡터 인프라가 없어 제공처 추천·태그·장르·공식 줄거리 신호를 사용했습니다."]};
}

async function collectAniList(input: SimilarityWork,target:string): Promise<{anchor:SimilarityWork;candidates:SimilarityWork[];warnings:string[]}> {
  const endpoint = Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co";
  const query = `query($id:Int!){Media(id:$id,type:ANIME){id title{romaji english native} coverImage{large} description(asHtml:false) startDate{year month day} episodes format genres tags{name rank} studios{nodes{name}} staff(perPage:12){nodes{name{full}}} recommendations(perPage:40,sort:RATING_DESC){nodes{mediaRecommendation{id title{romaji english native} coverImage{large} description(asHtml:false) startDate{year month day} episodes format genres tags{name rank} studios{nodes{name}} averageScore popularity}}}}}`;
  const response = await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,variables:{id:Number(input.external_id)}})});
  if (!response.ok) throw new Error(`AniList API error: ${response.status}`); const payload:any = await response.json();
  if (payload.errors?.length || !payload.data?.Media) throw new Error(payload.errors?.[0]?.message ?? "AniList content not found");
  const media = payload.data.Media; const anchor = normalizeAniList(media,input); anchor.people = media.staff?.nodes?.map((n:any)=>n.name?.full).filter(Boolean) ?? [];
  const candidates = (media.recommendations?.nodes ?? []).map((node:any)=>({...normalizeAniList(node.mediaRecommendation),provider_recommended:true}));
  const tmdbKey=Deno.env.get("TMDB_API_KEY");
  if(tmdbKey){const tmdbAnchor=await findTmdbTvAnchor([media.title?.native,media.title?.romaji,media.title?.english],tmdbKey);if(tmdbAnchor){const tmdbCollection=await collectTmdb(tmdbAnchor,target);candidates.unshift(...tmdbCollection.candidates);anchor.title_primary=input.title_primary||tmdbCollection.anchor.title_primary;anchor.overview=input.overview??tmdbCollection.anchor.overview??anchor.overview;}}
  if (target === "anime" || target === "all") candidates.push(...await fetchAniListDiscovery(anchor.genres ?? []));
  if (target === "drama" || target === "movie") { if(tmdbKey) candidates.push(...await fetchTmdbDiscovery(anchor.genres ?? [],target,tmdbKey)); }
  return {anchor,candidates,warnings:["벡터 인프라가 없어 제공처 추천·태그·장르·공식 줄거리 신호를 사용했습니다."]};
}

async function fetchAniListDiscovery(genres:string[]): Promise<SimilarityWork[]> {
  const endpoint=Deno.env.get("ANILIST_API_URL")??"https://graphql.anilist.co";
  const query=`query($genres:[String]){Page(page:1,perPage:36){media(type:ANIME,genre_in:$genres,sort:POPULARITY_DESC){id title{romaji english native} coverImage{large} description(asHtml:false) startDate{year month day} episodes format genres tags{name rank} studios{nodes{name}} averageScore popularity}}}`;
  const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,variables:{genres:genres.slice(0,3)}})}); if(!res.ok)return[]; const p:any=await res.json(); return (p.data?.Page?.media??[]).map((m:any)=>normalizeAniList(m));
}

async function fetchTmdbDiscovery(genres:string[],target:string,key:string): Promise<SimilarityWork[]> {
  const kind=target==="movie"?"movie":"tv"; const ids=[...TMDB_GENRES.entries()].filter(([,name])=>genres.some((g)=>g.toLowerCase()===name.toLowerCase())).map(([id])=>id);
  const p=await tmdbFetch(`/discover/${kind}`,key,{language:"ko-KR",sort_by:"popularity.desc",with_genres:ids.slice(0,3).join("|")}); return (p.results??[]).map((m:any)=>normalizeTmdb(m,kind));
}
async function findTmdbTvAnchor(titles:(string|null|undefined)[],key:string):Promise<SimilarityWork|null>{for(const title of titles.filter(Boolean)){const p=await tmdbFetch("/search/tv",key,{language:"ko-KR",query:String(title)});const item=p.results?.[0];if(item)return normalizeTmdb(item,"tv");}return null;}

function normalizeTmdb(item:any,kind:"movie"|"tv",fallback?:SimilarityWork): SimilarityWork { const date=kind==="movie"?item.release_date:item.first_air_date; const countries=(item.origin_country??[]); return {external_source:"tmdb",external_id:String(item.id??fallback?.external_id),content_type:kind==="movie"?"movie":countries.includes("KR")?"kdrama":countries.includes("JP")?"jdrama":((item.genre_ids??item.genres?.map((g:any)=>g.id)??[]).includes(16)?"anime":"other"),title_primary:(kind==="movie"?item.title:item.name)||fallback?.title_primary||"Untitled",title_original:(kind==="movie"?item.original_title:item.original_name)??fallback?.title_original??null,poster_url:item.poster_path?`https://image.tmdb.org/t/p/w500${item.poster_path}`:fallback?.poster_url??null,overview:clean(item.overview)??fallback?.overview??null,air_year:date?Number(String(date).slice(0,4)):fallback?.air_year??null,air_date:date??fallback?.air_date??null,has_seasons:kind==="tv",episode_count:item.number_of_episodes??null,genres:(item.genres??[]).map((g:any)=>g.name??TMDB_GENRES.get(g)).filter(Boolean).concat((item.genre_ids??[]).map((id:number)=>TMDB_GENRES.get(id)).filter(Boolean)),popularity:item.popularity??null,vote_count:item.vote_count??null,studios:names(item.production_companies)}; }
function normalizeAniList(item:any,fallback?:SimilarityWork): SimilarityWork { const title=item.title??{}; const d=item.startDate; return {external_source:"anilist",external_id:String(item.id??fallback?.external_id),content_type:"anime",title_primary:title.english??title.romaji??title.native??fallback?.title_primary??"Untitled",title_original:title.native??fallback?.title_original??null,poster_url:item.coverImage?.large??fallback?.poster_url??null,overview:clean(item.description)??fallback?.overview??null,air_year:d?.year??fallback?.air_year??null,air_date:d?.year&&d?.month?`${d.year}-${String(d.month).padStart(2,"0")}-${String(d.day??1).padStart(2,"0")}`:null,has_seasons:item.format!=="MOVIE",episode_count:item.episodes??null,genres:item.genres??[],tags:(item.tags??[]).filter((t:any)=>(t.rank??0)>=50).map((t:any)=>t.name),studios:item.studios?.nodes?.map((n:any)=>n.name)??[],popularity:item.popularity??null,vote_count:item.averageScore??null}; }
async function tmdbFetch(path:string,key:string,params:Record<string,string>):Promise<any>{const u=new URL(`https://api.themoviedb.org/3${path}`);Object.entries(params).forEach(([k,v])=>v&&u.searchParams.set(k,v));const headers:HeadersInit={"Content-Type":"application/json"};if(key.startsWith("eyJ")||key.split(".").length===3)(headers as Record<string,string>).Authorization=`Bearer ${key}`;else u.searchParams.set("api_key",key);const r=await fetch(u,{headers});if(!r.ok)throw new Error(`TMDB API error: ${r.status}`);return r.json();}
function keywordNames(value:any):string[]{return (value?.keywords??value?.results??[]).map((v:any)=>v.name).filter(Boolean);} function names(value:any):string[]{return (value??[]).map((v:any)=>v.name).filter(Boolean);} function clean(v:any):string|null{return typeof v==="string"?v.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()||null:null;}
function matchesTarget(item:SimilarityWork,target:string):boolean{return target==="all"?true:target==="drama"?["kdrama","jdrama","other"].includes(item.content_type):item.content_type===target;}
function applyModifiers(items:SimilarityWork[],modifiers:{key?:string;direction?:string}[]):SimilarityWork[]{return items.filter((item)=>{const features=[...(item.genres??[]),...(item.tags??[])].map((value)=>value.toLowerCase());for(const modifier of modifiers){if(modifier.key==="short"&&item.episode_count&&item.episode_count>12)return false;if(modifier.key==="romance"&&modifier.direction==="exclude"&&features.some((value)=>value.includes("romance")||value.includes("로맨스")))return false;if(modifier.key==="violence"&&modifier.direction==="exclude"&&features.some((value)=>/gore|violence|고어|잔혹/.test(value)))return false;if(modifier.key==="school"&&modifier.direction==="exclude"&&features.some((value)=>/school|학원|학교/.test(value)))return false;if(modifier.key==="comedy"&&modifier.direction==="include"&&!features.some((value)=>value.includes("comedy")||value.includes("코미디")))return false;}return true;});}
function json(payload:unknown,status=200){return new Response(JSON.stringify(payload),{status,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"private, max-age=60"}});}
