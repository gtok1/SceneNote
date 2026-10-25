import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as sequel from "./watchProviders.ts";
import type { AniListWatchLookupDeps, TmdbSeasonSummary, TmdbTvSearchItem, TmdbWatchProvidersPayload } from "./watchProviders.ts";

import {
  applyKrOttDiscoverFilter, attachKrOttProviders, createProviderLink, KR_OTT_PROVIDER_IDS,
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
  it("opens Disney's Korean homepage instead of constructing unsupported search URLs", () => {
    for (const provider of [p(337, "Disney Plus"), p(337, "디즈니+"), p(337)]) {
      assert.equal(createProviderLink(provider, "메이드 인 코리아"), "https://www.disneyplus.com/ko-kr");
      assert.equal(mapKrWatchProvidersByCategory({ flatrate: [provider] }, "메이드 인 코리아").flatrate[0]?.link, "https://www.disneyplus.com/ko-kr");
    }
    assert.equal(createProviderLink(p(8, "Netflix"), "무빙"), "https://www.netflix.com/search?q=%EB%AC%B4%EB%B9%99");
  });
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
  it("W-27 leaves non-TMDB anime series references unconfirmed", async () => {
    const calls:string[]=[];
    const result=await attachKrOttProviders([target("anilist","999","anime","260463"),target("kitsu","888","anime","260463")],async(kind,id)=>{calls.push(`${kind}:${id}`);return {flatrate:[p(8)]};});
    assert.deepEqual(calls,[]);
    assert.deepEqual(result.map(item=>item.watch_providers_kr),[null,null]);
  });
  it("does not fetch series providers for explicit season recommendations", async () => {
    const calls:string[]=[];
    const result=await attachKrOttProviders([{...target("tmdb","100","kdrama"),season_number:3},{...target("tmdb","200","movie"),season_number:1}],async(kind,id)=>{calls.push(`${kind}:${id}`);return {flatrate:[p(8)]};});
    assert.deepEqual(calls,["movie:200"]);
    assert.equal(result[0]?.watch_providers_kr,null);
    assert.deepEqual(result[1]?.watch_providers_kr,[{provider_id:8,name:"넷플릭스"}]);
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


const slimeOriginal = "転生したらスライムだった件 第4期 第1&2クール";
const slimeKorean = "전생했더니 슬라임이었던 건에 대하여";
const anime = (id: number, original_name: string, year: number, extra: Partial<TmdbTvSearchItem> = {}): TmdbTvSearchItem =>
  ({ id, original_name, first_air_date: `${year}-01-01`, genre_ids: [16], ...extra });
const slime = anime(82684, "転生したらスライムだった件", 2018, { name: slimeKorean, first_air_date: "2018-10-02" });
const diary = anime(118541, "転生したらスライムだった件 転スラ日記", 2021, { name: `${slimeKorean}: 전생슬라임 일기`, first_air_date: "2021-04-06" });
const season = (season_number: number, air_date: string | null): TmdbSeasonSummary => ({ season_number, air_date });
const slimeSeasons = [season(0,"2019-03-26"),season(1,"2018-10-02"),season(2,"2021-01-12"),season(3,"2024-04-05"),season(4,"2026-04-03")];
const kr = (...ids: number[]): TmdbWatchProvidersPayload => ({ results: { KR: { flatrate: ids.map(id => p(id)) } } });
function lookupFixture(options: {
  searches: Record<string, TmdbTvSearchItem[]>;
  seasons?: TmdbSeasonSummary[];
  provider?: (n: number | null) => TmdbWatchProvidersPayload;
}) {
  const calls: unknown[][] = [];
  const deps: AniListWatchLookupDeps = {
    async searchTv(query) { calls.push(["search", query]); return options.searches[query] ?? []; },
    async getTvSeasons(id) { calls.push(["seasons", id]); return options.seasons ?? []; },
    async getProviders(target) { calls.push(["providers", target]); return options.provider?.(target.seasonNumber) ?? kr(97); }
  };
  return { calls, deps };
}
function slimeFixture(emptySeason = false) {
  return lookupFixture({ searches: { [slimeOriginal]: [], [slimeKorean]: [slime,diary], "転生したらスライムだった件": [slime] }, seasons: slimeSeasons,
    provider: n => n === 4 ? (emptySeason ? { results: {} } : kr(97,1883)) : kr(8) });
}
const stripEquals = (title: string | null, base: string, hadMarker = true) => assert.deepEqual(sequel.stripAnimeSeasonMarkers(title), { base, hadMarker });

describe("anime sequel watch provider contracts", () => {
  it("W-32 strips Japanese season and cours", () => stripEquals(slimeOriginal,"転生したらスライムだった件"));
  it("W-33 strips English ordinal season and combined parts", () => stripEquals("Tensei Shitara Slime Datta Ken 4th Season Part 1 & 2","Tensei Shitara Slime Datta Ken"));
  it("W-34 strips English Season N", () => stripEquals("That Time I Got Reincarnated as a Slime Season 4","That Time I Got Reincarnated as a Slime"));
  it("W-35 strips Japanese and full-width season digits", () => { stripEquals("薬屋のひとりごと 第2期","薬屋のひとりごと"); stripEquals("葬送のフリーレン 第２期","葬送のフリーレン"); });
  it("W-36 strips Korean seasons and parts", () => { stripEquals("진격의 거인 시즌 3","진격의 거인"); stripEquals(`${slimeKorean} 2기 1부`,slimeKorean); });
  it("W-37 preserves internal colons and removes trailing separators", () => { stripEquals("Re:ゼロから始める異世界生活 3rd season","Re:ゼロから始める異世界生活"); stripEquals("Title: Season 2","Title"); });
  it("W-38 preserves titles without supported markers", () => { for(const title of ["うる星やつら","モブサイコ100 III","86―エイティシックス―"]) stripEquals(title,title,false); });
  it("W-39 strips parts but rejects marker-only titles", () => { stripEquals("86―エイティシックス― Part 2","86―エイティシックス―"); stripEquals("第4期","第4期",false); });
  it("W-40 handles missing and blank titles", () => { for(const title of [null,"","   "]) stripEquals(title,"",false); });
  it("W-41 strips kanji season numbers", () => stripEquals("X 第二期","X"));
  it("W-42 matches the main slime series rather than its spinoff", () => assert.equal(sequel.matchTmdbAnimeSeriesForSequel({titles:[slimeOriginal,slimeKorean],year:2026},[slime,diary]),82684));
  it("W-43 rejects remake matching without season markers", () => assert.equal(sequel.matchTmdbAnimeSeriesForSequel({titles:["うる星やつら"],year:2022},[anime(1,"うる星やつら",1981)]),null));
  it("W-44 rejects non-animation genres", () => assert.equal(sequel.matchTmdbAnimeSeriesForSequel({titles:["薬屋のひとりごと 第2期"],year:2025},[anime(2,"薬屋のひとりごと",2023,{genre_ids:[18]})]),null));
  it("W-45 rejects future series beyond one year", () => {
    assert.equal(sequel.matchTmdbAnimeSeriesForSequel({titles:["X 第2期"],year:2020},[anime(3,"X",2023)]),null);
    assert.equal(sequel.matchTmdbAnimeSeriesForSequel({titles:["X 第2期"],year:2020},[anime(3,"X",2021)]),3);
  });
  it("W-46 prefers the nearer remake over popularity", () => assert.equal(sequel.matchTmdbAnimeSeriesForSequel({titles:["フルーツバスケット 2nd season"],year:2020},[anime(10,"フルーツバスケット",2001,{popularity:50}),anime(11,"フルーツバスケット",2019,{popularity:5})]),11));
  it("W-47 prioritizes original title over display title", () => assert.equal(sequel.matchTmdbAnimeSeriesForSequel({titles:["Y 第2期"],year:2024},[anime(20,"Z",2022,{name:"Y"}),anime(21,"Y",2018)]),21));
  it("W-48 permits unknown source years", () => assert.equal(sequel.matchTmdbAnimeSeriesForSequel({titles:["X 第3期"],year:null},[anime(30,"X",2010)]),30));
  it("W-49 picks a unique exact air-year season", () => { assert.equal(sequel.pickTmdbSeasonForAirYear(slimeSeasons,2026),4); assert.equal(sequel.pickTmdbSeasonForAirYear(slimeSeasons,2024),3); });
  it("W-50 rejects distant seasons and specials", () => assert.equal(sequel.pickTmdbSeasonForAirYear([season(0,"2023-10-23"),season(1,"2023-10-22")],2025),null));
  it("W-51 never estimates an adjacent-year season", () => { assert.equal(sequel.pickTmdbSeasonForAirYear([season(1,"2022-01-01"),season(2,"2023-01-01")],2024),null); assert.equal(sequel.pickTmdbSeasonForAirYear([season(1,"2023-01-01"),season(2,"2025-01-01")],2024),null); });
  it("W-52 rejects multiple exact-year seasons", () => assert.equal(sequel.pickTmdbSeasonForAirYear([season(1,"2024-04-01"),season(2,"2024-10-01")],2024),null));
  it("W-53 rejects absent years, seasons, dates and specials", () => { assert.equal(sequel.pickTmdbSeasonForAirYear(slimeSeasons,null),null); assert.equal(sequel.pickTmdbSeasonForAirYear(null,2026),null); assert.equal(sequel.pickTmdbSeasonForAirYear([season(0,"2026-01-01")],2026),null); assert.equal(sequel.pickTmdbSeasonForAirYear([season(1,null)],2026),null); });
  it("W-54 resolves a direct match to its first season before fetching providers", async () => {
    const a=anime(260463,"黄泉のツガイ",2026,{name:"황천의 츠가이",first_air_date:"2026-04-04"});
    const f=lookupFixture({searches:{"黄泉のツガイ":[a],"황천의 츠가이":[a]},seasons:[season(1,"2026-04-04")]});
    assert.deepEqual(await sequel.lookupAniListWatchProviders({titles:["黄泉のツガイ","황천의 츠가이"],year:2026},f.deps),{tmdbId:260463,seasonNumber:1,scope:"season",payload:kr(97)});
    assert.deepEqual(f.calls,[["search","黄泉のツガイ"],["search","황천의 츠가이"],["seasons",260463],["providers",{tmdbId:260463,seasonNumber:1}]]);
  });
  it("W-55 fetches only the matched slime fourth season providers", async () => {
    const f=slimeFixture();
    assert.deepEqual(await sequel.lookupAniListWatchProviders({titles:[slimeOriginal,slimeKorean],year:2026},f.deps),{tmdbId:82684,seasonNumber:4,scope:"season",payload:kr(97,1883)});
    assert.deepEqual(f.calls,[["search",slimeOriginal],["search",slimeKorean],["search","転生したらスライムだった件"],["seasons",82684],["providers",{tmdbId:82684,seasonNumber:4}]]);
  });
  it("W-56 leaves merged apothecary seasons unconfirmed", async () => {
    const a=anime(220542,"薬屋のひとりごと",2023,{name:"약사의 혼잣말",first_air_date:"2023-10-22"});
    const f=lookupFixture({searches:{"薬屋のひとりごと 第2期":[a],"薬屋のひとりごと":[a]},seasons:[season(0,"2023-10-23"),season(1,"2023-10-22")],provider:()=>kr(8,283)});
    assert.equal(await sequel.lookupAniListWatchProviders({titles:["薬屋のひとりごと 第2期"],year:2025},f.deps),null);
    assert.deepEqual(f.calls,[["search","薬屋のひとりごと 第2期"],["search","薬屋のひとりごと"],["seasons",220542]]);
  });
  it("W-57 preserves confirmed empty season providers without series fallback", async () => {
    const f=slimeFixture(true);
    assert.deepEqual(await sequel.lookupAniListWatchProviders({titles:[slimeOriginal,slimeKorean],year:2026},f.deps),{tmdbId:82684,seasonNumber:4,scope:"season",payload:{results:{}}});
    assert.deepEqual(f.calls,[["search",slimeOriginal],["search",slimeKorean],["search","転生したらスライムだった件"],["seasons",82684],["providers",{tmdbId:82684,seasonNumber:4}]]);
  });
  it("W-58 performs no sequel calls for unmarked remakes", async () => { const f=lookupFixture({searches:{"うる星やつら":[anime(1,"うる星やつら",1981)]}}); assert.equal(await sequel.lookupAniListWatchProviders({titles:["うる星やつら"],year:2022},f.deps),null); assert.deepEqual(f.calls,[["search","うる星やつら"]]); });
  it("W-59 performs no season or provider calls without candidates", async () => { const f=lookupFixture({searches:{}}); assert.equal(await sequel.lookupAniListWatchProviders({titles:["X 第2期"],year:2025},f.deps),null); assert.deepEqual(f.calls,[["search","X 第2期"],["search","X"]]); });
  it("W-60 does not repeat an already searched base title", async () => { const f=lookupFixture({searches:{}}); assert.equal(await sequel.lookupAniListWatchProviders({titles:["X 第2期","X"],year:2025},f.deps),null); assert.deepEqual(f.calls,[["search","X 第2期"],["search","X"]]); });
  it("W-61 propagates TMDB dependency errors unchanged", async () => { const f=lookupFixture({searches:{}}); f.deps.searchTv=async()=>{throw Error("TMDB anime search error: 500");}; await assert.rejects(async()=>sequel.lookupAniListWatchProviders({titles:["X"],year:2025},f.deps),{message:"TMDB anime search error: 500"}); });
});


describe("season-specific watch provider regressions", () => {
  it("matches Tempal's advance premiere to season one and fetches only that season's Netflix providers", async () => {
    const original="テムパル～アイテムの力～";
    const title="템빨 ~아이템의 힘~";
    const a=anime(324502,original,2026,{name:title,first_air_date:"2026-10-02"});
    const f=lookupFixture({searches:{[original]:[a],[title]:[a]},seasons:[{...season(1,"2026-10-02"),episode_count:12}]});
    const paths:string[]=[];
    f.deps.getProviders=async({tmdbId,seasonNumber})=>{
      paths.push(`/tv/${tmdbId}/season/${seasonNumber}/watch/providers`);
      return kr(8,97,1796,1883);
    };
    assert.deepEqual(await sequel.lookupAniListWatchProviders({titles:[original,title],year:2026,airDate:"2026-09-27",seasonNumber:1},f.deps),
      {tmdbId:324502,seasonNumber:1,scope:"season",payload:kr(8,97,1796,1883)});
    assert.deepEqual(paths,["/tv/324502/season/1/watch/providers"]);
    assert.deepEqual(f.calls,[["search",original],["search",title],["seasons",324502]]);
  });
  it("preserves foreign providers from the matched season when KR is empty", async () => {
    const payload={results:{JP:{flatrate:[p(8)]}}};
    const f=slimeFixture();
    f.deps.getProviders=async()=>payload;
    assert.deepEqual(await sequel.lookupAniListWatchProviders({titles:[slimeOriginal,slimeKorean],year:2026},f.deps),{tmdbId:82684,seasonNumber:4,scope:"season",payload});
  });
  it("leaves a missing season provider endpoint unconfirmed", async () => {
    const f=slimeFixture();
    f.deps.getProviders=async()=>null;
    assert.equal(await sequel.lookupAniListWatchProviders({titles:[slimeOriginal,slimeKorean],year:2026},f.deps),null);
  });
  it("does not use a merged first season for the requested third work", async () => {
    const original="転生貴族、鑑定スキルで成り上がる 第3期";
    const base="転生貴族、鑑定スキルで成り上がる";
    const a=anime(237150,base,2024,{first_air_date:"2024-04-07"});
    const f=lookupFixture({searches:{[original]:[],[base]:[a]},seasons:[{...season(1,"2024-04-07"),episode_count:29}],provider:()=>kr(8,97,1883,283)});
    assert.equal(await sequel.lookupAniListWatchProviders({titles:[original],year:2026,seasonNumber:1},f.deps),null);
    assert.deepEqual(f.calls,[["search",original],["search",base],["seasons",237150]]);
  });
  it("requires a season match even when localized title directly matches", async () => {
    const f=lookupFixture({searches:{X:[anime(1,"X",2024)]},seasons:[season(1,"2024-04-07")]});
    assert.equal(await sequel.lookupAniListWatchProviders({titles:["X","X 第3期"],year:2024},f.deps),null);
    assert.equal(f.calls.some(call=>call[0]==="providers"),false);
  });
  it("matches differing season numbering only by a unique exact date", async () => {
    const f=lookupFixture({searches:{X:[anime(1,"X",2024)]},seasons:[season(2,"2024-10-01")]});
    assert.deepEqual(await sequel.lookupAniListWatchProviders({titles:["X","X 第3期"],year:2024,airDate:"2024-10-01"},f.deps),{tmdbId:1,seasonNumber:2,scope:"season",payload:kr(97)});
    assert.deepEqual(f.calls.at(-1),["providers",{tmdbId:1,seasonNumber:2}]);
  });
  it("does not query TV for AniList movies", async () => {
    const f=lookupFixture({searches:{X:[anime(1,"X",2024)]},seasons:[season(1,"2024-10-01")]});
    assert.equal(await sequel.lookupAniListWatchProviders({titles:["X"],year:2024,mediaType:"movie"},f.deps),null);
    assert.deepEqual(f.calls,[]);
  });
  it("rejects conflicting title seasons and absent dates before API calls", async () => {
    for(const input of [{titles:["X 第2期","X Season 3"],year:2024},{titles:["X"],year:null}]) {
      const f=lookupFixture({searches:{}});
      assert.equal(await sequel.lookupAniListWatchProviders(input,f.deps),null);
      assert.deepEqual(f.calls,[]);
    }
  });
});
