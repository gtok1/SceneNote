import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyKrOttDiscoverFilter, attachKrOttProviders, KR_OTT_PROVIDER_IDS,
  listOtherAvailableRegions, mapKrWatchProvidersByCategory,
  matchTmdbAnimeForAniList, summarizeKrOttProviders,
  type TmdbProvider, type TmdbWatchProviderRegion
} from "./watchProviders.ts";

const p = (id: number, name = "x", priority = 1): TmdbProvider => ({
  provider_id: id, provider_name: name, display_priority: priority, logo_path: null
});

const summary = (region: TmdbWatchProviderRegion | null | undefined) =>
  summarizeKrOttProviders(region).map(({ provider_id, name }) => [provider_id, name]);

const target = (external_source: string, external_id: string, content_type = "anime", tmdb?: string) => ({
  external_source, external_id, content_type, ...(tmdb ? { external_ids: { tmdb } } : {})
});

describe("KR OTT provider contracts", () => {
  it("W-1 sets only the three KR discover parameters", () => {
    const url = new URL("https://x/discover/tv?page=2");
    applyKrOttDiscoverFilter(url);
    assert.equal(url.searchParams.get("watch_region"), "KR");
    assert.equal(url.searchParams.get("with_watch_providers"), "8|1796|1883|1881|356|337|97|350|119|283");
    assert.equal(url.searchParams.get("with_watch_monetization_types"), "flatrate|free|ads");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal([...url.searchParams.keys()].length, 4);
  });
  it("W-2 preserves the whitelist order", () => assert.deepEqual(KR_OTT_PROVIDER_IDS, [8,1796,1883,1881,356,337,97,350,119,283]));
  it("W-3 empty summaries", () => { assert.deepEqual(summary(undefined), []); assert.deepEqual(summary(null), []); });
  it("W-4 groups Netflix variants", () => assert.deepEqual(summary({ flatrate: [p(8),p(1796),p(1883)] }), [[8,"넷플릭스"],[1883,"티빙"]]));
  it("W-5 includes ads in summary", () => assert.deepEqual(summary({ flatrate:[p(97)], ads:[p(283)] }), [[97,"왓챠"],[283,"크런치롤"]]));
  it("W-6 excludes rent and buy from summary", () => assert.deepEqual(summary({ rent:[p(8)], buy:[p(350)] }), []));
  it("W-7 excludes non-whitelist providers", () => assert.deepEqual(summary({ flatrate:[p(315,"Hoichoi")] }), []));
  it("W-8 normalizes ads-only Netflix variant to group", () => assert.deepEqual(summary({ flatrate:[p(1796)] }), [[8,"넷플릭스"]]));
  it("W-9 sorts summary by whitelist", () => assert.deepEqual(summary({flatrate:[p(337),p(8)],free:[p(356)]}), [[8,"넷플릭스"],[356,"웨이브"],[337,"디즈니+"]]));
  it("W-10 combines free and ads without duplicating the same provider", () => {
    const free = mapKrWatchProvidersByCategory({free:[p(538,"Plex")],ads:[p(283),p(538,"Plex")]},null).free;
    assert.deepEqual(free.map(({provider_name,service_type_label,service_type}) => [provider_name,service_type_label,service_type]), [["크런치롤","무료(광고)","free"],["Plex","무료","free"]]);
    const differentPriorities = mapKrWatchProvidersByCategory({free:[p(538,"Plex",9)],ads:[p(538,"Plex",1)]},null).free;
    assert.equal(differentPriorities[0]?.service_type_label, "무료");
  });
  it("W-11 drops Netflix ads variant only when base is present", () => {
    assert.deepEqual(mapKrWatchProvidersByCategory({flatrate:[p(8),p(1796)]},null).flatrate.map(v=>v.provider_name), ["넷플릭스"]);
    assert.deepEqual(mapKrWatchProvidersByCategory({flatrate:[p(1796)]},null).flatrate.map(v=>v.provider_name), ["넷플릭스(광고형)"]);
  });
  it("W-12 sorts whitelist before other providers by priority", () => assert.deepEqual(mapKrWatchProvidersByCategory({flatrate:[p(700," Zeta ",3),p(356),p(701,"Alpha",1)]},null).flatrate.map(v=>v.provider_name), ["웨이브","Alpha","Zeta"]));
  it("W-13 returns four empty categories", () => assert.deepEqual(mapKrWatchProvidersByCategory(undefined,null), {flatrate:[],free:[],rent:[],buy:[]}));
  it("W-14 uses direct links then region fallback", () => {
    const mapped=mapKrWatchProvidersByCategory({link:"https://tmdb/x",flatrate:[p(8),p(538,"Plex")]},"무빙").flatrate;
    assert.equal(mapped[0]?.link,"https://www.netflix.com/search?q=%EB%AC%B4%EB%B9%99");
    assert.equal(mapped[1]?.link,"https://tmdb/x");
  });
  it("W-15 excludes KR and rent-only regions", () => assert.deepEqual(listOtherAvailableRegions({KR:{flatrate:[p(8)]},JP:{flatrate:[p(1)]},US:{rent:[p(2)]},FR:{ads:[p(3)]},BR:{flatrate:[p(4)]}}), ["JP","FR","BR"]));
  it("W-16 prioritizes configured countries and limits to five", () => assert.deepEqual(listOtherAvailableRegions(Object.fromEntries(["JP","US","TW","BR","AR","CL","MX"].map(code=>[code,{flatrate:[p(1)]}]))),["JP","US","TW","AR","BR"]));
  it("W-17 handles absent region data", () => assert.deepEqual(listOtherAvailableRegions(undefined),[]));
  it("W-18 matches the original title and animation genre", () => assert.equal(matchTmdbAnimeForAniList({titles:["黄泉のツガイ"],year:2026},[{id:260463,original_name:"黄泉のツガイ",name:"황천의 츠가이",first_air_date:"2026-04-04",genre_ids:[16,10759]}]),260463));
  it("W-19 rejects live action with matching title", () => assert.equal(matchTmdbAnimeForAniList({titles:["薬屋のひとりごと"],year:2023},[{id:333686,original_name:"薬屋のひとりごと",genre_ids:[18]},{id:220542,original_name:"薬屋のひとりごと",first_air_date:"2023-10-22",genre_ids:[16,18]}]),220542));
  it("W-20 rejects years beyond tolerance", () => assert.equal(matchTmdbAnimeForAniList({titles:["黄泉のツガイ"],year:2023},[{id:260463,original_name:"黄泉のツガイ",first_air_date:"2026-04-04",genre_ids:[16]}]),null));
  it("W-21 prefers an original-title match to a display-title match", () => assert.equal(matchTmdbAnimeForAniList({titles:["X"],year:null},[{id:1,name:"X",original_name:"Y",genre_ids:[16]},{id:2,original_name:"X",genre_ids:[16]}]),2));
  it("W-22 resolves ties by year then popularity", () => {
    assert.equal(matchTmdbAnimeForAniList({titles:["X"],year:2026},[{id:5,original_name:"X",first_air_date:"2025-01-01",genre_ids:[16],popularity:1},{id:6,original_name:"X",first_air_date:"2026-01-01",genre_ids:[16],popularity:9}]),6);
    assert.equal(matchTmdbAnimeForAniList({titles:["X"],year:2026},[{id:5,original_name:"X",first_air_date:"2026-01-01",genre_ids:[16],popularity:1},{id:6,original_name:"X",first_air_date:"2026-01-01",genre_ids:[16],popularity:9}]),6);
  });
  it("W-23 rejects blank titles", () => assert.equal(matchTmdbAnimeForAniList({titles:["",null,"  "],year:null},[]),null));
  it("W-24 permits any candidate year when source year is unknown", () => assert.equal(matchTmdbAnimeForAniList({titles:["X"],year:null},[{id:7,original_name:"X",first_air_date:"2019-01-01",genre_ids:[16]}]),7));
  it("W-25 resolves TMDB TV and attaches a summary", async () => {
    const calls: string[]=[];const result=await attachKrOttProviders([target("tmdb","100","kdrama")],async (kind,id)=>{calls.push(`${kind}:${id}`);return {flatrate:[p(8)]};});
    assert.deepEqual(calls,["tv:100"]);assert.deepEqual(result[0]?.watch_providers_kr,[{provider_id:8,name:"넷플릭스"}]);
  });
  it("W-26 resolves TMDB movies", async () => {
    const calls:string[]=[];await attachKrOttProviders([target("tmdb","200","movie")],async(kind,id)=>{calls.push(`${kind}:${id}`);return null;});assert.deepEqual(calls,["movie:200"]);
  });
  it("W-27 resolves AniList items with a TMDB external id", async () => {
    const calls:string[]=[];await attachKrOttProviders([target("anilist","999","anime","260463")],async(kind,id)=>{calls.push(`${kind}:${id}`);return null;});assert.deepEqual(calls,["tv:260463"]);
  });
  it("W-28 leaves unmatched AniList items without a fetch", async () => {
    let calls=0;const result=await attachKrOttProviders([target("anilist","999")],async()=>{calls++;return null;});assert.equal(calls,0);assert.equal(result[0]?.watch_providers_kr,null);
  });
  it("W-29 preserves count and order on per-item errors", async () => {
    const result=await attachKrOttProviders([target("tmdb","1"),target("tmdb","2"),target("tmdb","3")],async(_kind,id)=>{if(id==="2")throw Error("failed");return {flatrate:[p(8)]};});
    assert.deepEqual(result.map(v=>v.external_id),["1","2","3"]);assert.deepEqual(result.map(v=>v.watch_providers_kr?.[0]?.provider_id ?? null),[8,null,8]);
  });
  it("W-30 skips fetches near the deadline", async () => {
    let calls=0;const result=await attachKrOttProviders([target("tmdb","1")],async()=>{calls++;return null;},{deadlineMs:Date.now()+500});assert.equal(calls,0);assert.equal(result[0]?.watch_providers_kr,null);
  });
  it("W-31 treats an empty successful response as known empty", async () => {
    const result=await attachKrOttProviders([target("tmdb","1")],async()=>null);assert.deepEqual(result[0]?.watch_providers_kr,[]);
  });
});
