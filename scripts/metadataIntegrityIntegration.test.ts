import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url).href);
const projectRequire = createRequire(import.meta.url);
const tsxRequire = createRequire(projectRequire.resolve("tsx"));
const esbuild = tsxRequire("esbuild") as { build(options: object): Promise<unknown> };

it("integrity handlers keep TMDB kinds separate, repair partial episodes, and page recommendation inputs", async () => {
  const directory = mkdtempSync(join(tmpdir(), "scenenote-metadata-integrity-"));
  const scenario = `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const root = ${JSON.stringify(root)};
const directory = ${JSON.stringify(directory)};
const { build } = createRequire(join(root, 'package.json'))('esbuild');
let handler, state, nextId=0, checks=0;
const check=(value,expected,label)=>{assert.deepEqual(value,expected,label);checks++;};
let networkCalls=0;
globalThis.fetch=()=>{networkCalls++;throw Error('Real network is forbidden');};
globalThis.Deno={serve:fn=>handler=fn,env:{get:()=>undefined}};
function meta(kind='tv',id='123') {return {external_source:'tmdb',external_id:id,content_type:kind==='movie'?'movie':'jdrama',title_primary:kind+' '+id,title_original:null,poster_url:null,overview:null,localized_overview:null,air_year:2026,air_date:'2026-01-01',end_date:null,has_seasons:kind!=='movie',episode_count:kind==='movie'?null:12,genres:[],seasons:kind==='movie'?[]:[{season_number:1,title:null,episode_count:12,air_year:2026}],cast:[],crew:[]};}
function reset(){state={calls:[],fetches:[],tables:{contents:[{id:'movie-content',source_api:'tmdb',source_id:'123',source_media_type:'movie',content_type:'movie',title_primary:'original movie',crew:[]}],content_external_ids:[{content_id:'movie-content',api_source:'tmdb',external_id:'123',media_type:'movie'}],user_library_items:[{id:'movie-item',user_id:'fixture-user',content_id:'movie-content',season_number:null,status:'completed',status_flags:['completed']}],seasons:[],episodes:[],external_search_cache:[],metadata_sync_logs:[],content_titles:[],content_themes:[],user_content_feedback:[],user_recommendation_impressions:[]},publishedCount:8};}
class Query {
 constructor(table){this.table=table;this.filters=[];this.orders=[];this.action='select';this.one=false;this.bounds=null;}
 select(value){this.selection=value;return this;} eq(column,value){this.filters.push([column,'eq',value]);return this;} filter(column,op,value){this.filters.push([column,op,value]);return this;} in(column,value){this.filters.push([column,'in',value]);return this;} not(){return this;} order(...args){this.orders.push(args);return this;} limit(){return this;} range(from,to){this.bounds=[from,to];return this;} maybeSingle(){this.one=true;return this;} single(){this.one=true;return this;}
 update(value){this.action='update';this.value=value;return this;} insert(value){this.action='insert';this.value=value;return this;} upsert(value,options){this.action='upsert';this.value=value;this.options=options;return this;}
 then(resolve,reject){return Promise.resolve().then(()=>{
  const call={table:this.table,action:this.action,filters:this.filters,orders:this.orders,bounds:this.bounds,selection:this.selection};state.calls.push(call);
  if(state.failFeedback && this.table==='user_content_feedback' && this.bounds?.[0]===1000)return {data:null,error:{message:'fixture feedback page failed'}};
  const table=state.tables[this.table]??(state.tables[this.table]=[]);
  const matches=row=>this.filters.every(([key,op,value])=>op==='in'?value.includes(row[key]):op==='is'?row[key]===null:row[key]===value);
  let rows=table.filter(matches);
  if(this.action==='select' && state.repeatEpisodes && this.table==='episodes')rows=table;
  if(this.action==='update')for(const row of rows)Object.assign(row,this.value);
  if(this.action==='upsert' || this.action==='insert'){
   rows=[];
   for(const value of Array.isArray(this.value)?this.value:[this.value]){
    const keys=this.options?.onConflict?.split(',')??[];
    let row=this.action==='upsert'?table.find(item=>keys.length&&keys.every(key=>item[key]===value[key])):null;
    if(!row){row={id:'new-'+(++nextId),...value};table.push(row);}else if(!this.options?.ignoreDuplicates)Object.assign(row,value);
    rows.push(row);
   }
  }
  if(this.table==='content_external_ids' && this.selection?.includes('contents('))rows=rows.map(row=>({...row,contents:state.tables.contents.find(c=>c.id===row.content_id)}));
  if(this.table==='seasons' && this.selection?.includes('contents('))rows=rows.map(row=>({...row,contents:state.tables.contents.find(c=>c.id===row.content_id)}));
  if(this.bounds && !(state.repeatEpisodes && this.table==='episodes'))rows=rows.slice(this.bounds[0],this.bounds[1]+1);
  return {data:this.one?rows[0]??null:rows,error:null};
 }).then(resolve,reject);}
}
globalThis.__metadata={db:{from:table=>new Query(table)},fetchDetail:async(source,id,kind)=>{state.fetches.push(['detail',source,id,kind]);return meta(kind,id);},fetchEpisodes:async(params)=>{state.fetches.push(['episodes',params]);if(state.failEpisodes)throw Error('fixture provider failure');return Array.from({length:params.episodeCount??state.publishedCount},(_,i)=>({episode_number:i+1,title:null,air_date:null,duration_seconds:null}));},availability:async()=>({releasedEpisodes:[]})};
const plugin={name:'metadata-boundaries',setup(b){b.onResolve({filter:/.*/},a=>a.path.endsWith('/_shared/supabase.ts')?{path:'db',namespace:'fixture'}:a.path.endsWith('/_shared/externalContent.ts')?{path:'external',namespace:'fixture'}:a.path.endsWith('/_shared/genres.ts')?{path:'genres',namespace:'fixture'}:null);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='db'?'export const createAdminClient=()=>globalThis.__metadata.db;export const createUserClient=()=>globalThis.__metadata.db;export const requireUser=async()=>({id:"fixture-user",jwt:"fixture"});':a.path==='external'?'export const fetchContentDetail=(...args)=>globalThis.__metadata.fetchDetail(...args);export const fetchEpisodesForSeason=params=>globalThis.__metadata.fetchEpisodes(params);export const fetchEpisodeAvailability=params=>globalThis.__metadata.availability(params);':'export const upsertGenres=async()=>{};export const extractGenreNames=()=>[];'}));}};
async function load(entry,name){const output=join(directory,name+'.mjs');await build({entryPoints:[join(root,entry)],outfile:output,bundle:true,platform:'node',format:'esm',tsconfig:join(root,'tsconfig.json'),plugins:[plugin],logLevel:'silent'});await import(output);return handler;}
const detail=await load('supabase/functions/get-content-detail/index.ts','detail');
const add=await load('supabase/functions/add-to-library/index.ts','add');
const episodes=await load('supabase/functions/fetch-episodes/index.ts','episodes');
const recommend=await load('supabase/functions/personalized-recommendations/index.ts','recommend');
const bulk=await load('supabase/functions/bulk-register-netflix/index.ts','bulk');
const request=body=>new Request('https://fixture.local/function',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
reset();
let response=await detail(request({api_source:'tmdb',external_id:'123',media_type:'tv',force_refresh:true}));let data=await response.json();
check(response.status,200,'different TV metadata remains readable');check(data.content.content_id,undefined,'TV is never attached to movie internal id');check(state.tables.contents[0].title_primary,'original movie','TV refresh never overwrites the movie');
response=await add(request({api_source:'tmdb',external_id:'123',media_type:'tv'}));data=await response.json();
check(response.status,201,'TV123 can register beside movie123');const tvId=data.content_id;assert.notEqual(tvId,'movie-content');checks++;
check(state.tables.contents.length,2,'two separate internal works');check(state.tables.contents.find(c=>c.id===tvId).source_media_type,'tv','new TV namespace stored');check(state.tables.content_external_ids.map(x=>x.media_type).sort(),['movie','tv'],'external mapping key also scoped');
response=await add(request({api_source:'tmdb',external_id:'123',media_type:'tv'}));data=await response.json();check(data.already_exists,true,'same TV registration reuses TV');check(data.content_id,tvId,'repeat registration uses right content');
response=await add(request({api_source:'tmdb',external_id:'123',media_type:'movie'}));data=await response.json();check(data.content_id,'movie-content','movie registration still resolves old UUID');
response=await detail(request({api_source:'tmdb',external_id:'123'}));check(response.status,400,'untyped TMDB request cannot guess a namespace');
state.tables.content_external_ids.push({content_id:'movie-content',api_source:'tmdb',external_id:'999',media_type:'tv'});const writesBefore=state.calls.filter(c=>c.action!=='select').length;
response=await detail(request({api_source:'tmdb',external_id:'999',media_type:'tv',force_refresh:true}));check(response.status,409,'contradictory stored mapping rejects before writes');check(state.calls.filter(c=>c.action!=='select').length,writesBefore,'bad mapping performs no writes');
reset();state.tables.contents=[{id:'anime-content',source_api:'anilist',source_id:'185756',content_type:'anime'}];state.tables.seasons=[{id:'s1',content_id:'anime-content',season_number:1,episode_count:12,episodes_synced_at:null,published_episode_numbers:null}];state.tables.episodes=[{id:'saved-e1',content_id:'anime-content',season_id:'s1',episode_number:1,title:'saved title',air_date:'2026-09-27',duration_seconds:1440}];
response=await episodes(request({content_id:'anime-content',season_id:'s1'}));data=await response.json();check(data.episodes.length,12,'partial one-row cache expands to known final count');check(data.episodes[0].id,'saved-e1','repair preserves episode FK identity');check(data.episodes[0].air_date,'2026-09-27','generated null does not erase known air date');const knownFetches=state.fetches.length;
response=await episodes(request({content_id:'anime-content',season_id:'s1'}));data=await response.json();check(data.episodes.length,12,'complete known list comes from DB');check(state.fetches.length,knownFetches,'complete known list spends no extra provider call');
state.tables.seasons[0].episode_count=null;state.tables.seasons[0].episodes_synced_at=null;
response=await episodes(request({content_id:'anime-content',season_id:'s1'}));data=await response.json();check(data.episodes.map(e=>e.episode_number),[1,2,3,4,5,6,7,8],'unknown total shows actual published list only');check(state.tables.episodes.length,12,'future legacy IDs remain stored for user FKs');check(state.tables.seasons[0].published_episode_numbers,[1,2,3,4,5,6,7,8],'published mask persisted separately');const unknownFetches=state.fetches.length;
response=await episodes(request({content_id:'anime-content',season_id:'s1'}));data=await response.json();check(data.episodes.length,8,'unknown recent DB cache also applies mask');check(state.fetches.length,unknownFetches,'unknown recent full sync spends no extra API call');
state.tables.seasons[0].episodes_synced_at='2000-01-01T00:00:00Z';state.publishedCount=9;
response=await episodes(request({content_id:'anime-content',season_id:'s1'}));data=await response.json();check(data.episodes.length,9,'expired unknown cache learns newly published episode');check(data.episodes[0].id,'saved-e1','new release keeps earlier checked/pinned identity');
state.failEpisodes=true;const marker=state.tables.seasons[0].episodes_synced_at;response=await episodes(request({content_id:'anime-content',season_id:'s1',force_refresh:true}));check(response.status,503,'provider failure is not a successful empty snapshot');check(state.tables.seasons[0].episodes_synced_at,marker,'failed refresh leaves last sync marker intact');
reset();state.tables.user_library_items=Array.from({length:2500},(_,i)=>({id:'l'+i,user_id:'fixture-user'}));state.tables.user_content_feedback=Array.from({length:1200},(_,i)=>({id:'f'+i,user_id:'fixture-user',target_type:'content',target_key:String(i),action:'exclude'}));state.failFeedback=true;
response=await recommend(request({limit:12}));check(response.status,500,'later feedback-page failure stops recommendation calculation');check(state.calls.filter(c=>c.table==='user_library_items').map(c=>c.bounds),[[0,999],[1000,1999],[2000,2999]],'recommendation reads the entire library');check(state.calls.filter(c=>c.table==='user_content_feedback').map(c=>c.bounds),[[0,999],[1000,1999]],'feedback does not stop at 1000');check(networkCalls,0,'real network remains forbidden');
for(const typeFields of [{tmdb_media_type:'tv'},{media_hint:'tv'}]){
 reset();state.tables.contents[0].title_primary='registered work';state.tables.contents.push({id:'tv-content',source_api:'tmdb',source_id:'123',source_media_type:'tv',content_type:'jdrama',title_primary:'registered work'});state.tables.user_library_items[0].status='watching';state.tables.user_library_items.push({id:'tv-item',user_id:'fixture-user',content_id:'tv-content',status:'watching',status_flags:['watching']});
 response=await bulk(request({commit:true,rows:[{import_selected:true,normalized_title:'registered work',tmdb_id:'123',...typeFields}]}));data=await response.json();
 check(response.status,200,'bulk request resolves with a typed identity');check(data.rows[0].existing_app_content_id,'tv-content','bulk selects exact TV namespace');check(state.tables.user_library_items[0].status,'watching','bulk leaves same-id movie status untouched');check(state.tables.user_library_items[1].status,'completed','bulk updates only the requested TV registration');
}
reset();state.tables.contents[0].title_primary='registered work';state.tables.contents.push({id:'tv-content',source_api:'tmdb',source_id:'123',source_media_type:'tv',content_type:'jdrama',title_primary:'registered work'});state.tables.user_library_items[0].status='watching';
response=await bulk(request({commit:true,rows:[{import_selected:true,normalized_title:'registered work',tmdb_id:'123'}]}));data=await response.json();
check(data.rows[0].import_result,'manual_review','untyped same-id movie and TV require review');check(state.calls.filter(c=>c.table==='user_library_items'&&c.action!=='select').length,0,'ambiguous bulk import never writes user records');check(state.tables.user_library_items[0].status,'watching','ambiguous import preserves the existing movie status');check(networkCalls,0,'bulk boundary tests spend no real network requests');
console.log(JSON.stringify({checks,networkCalls}));
`;
  const path = join(directory, "scenario.mjs");
  try {
    await esbuild.build({ stdin: { contents: scenario, sourcefile: "metadata-integrity-scenario.mjs", resolveDir: root }, outfile: path, platform: "node", format: "esm", bundle: true, logLevel: "silent" });
    const output = execFileSync(process.execPath, [path], { encoding: "utf8", cwd: root, timeout: 25_000 });
    const report = JSON.parse(output.trim()) as { checks: number; networkCalls: number };
    assert.ok(report.checks >= 42);
    assert.equal(report.networkCalls, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
