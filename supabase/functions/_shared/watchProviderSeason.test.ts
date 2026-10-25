import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickTmdbSeasonForWatch, resolveWatchSeasonNumber } from "./watchProviderSeason.ts";

describe("requested watch season", () => {
  it("uses explicit title seasons ahead of AniList's virtual first season", () => {
    for (const title of ["作品 第3期", "作品 第３期", "作品 第三期", "작품 시즌 3", "작품 3기", "Title 3rd Season", "Title Season 3", "作品 シーズン3"]) {
      assert.equal(resolveWatchSeasonNumber({source:"anilist",mediaType:"tv",seasonNumber:1,titles:[title]}),3,title);
    }
  });
  it("ignores cour and part numbers when resolving seasons", () => {
    for (const title of ["作品 第1&2クール", "Title Part 2", "작품 2부"]) {
      assert.equal(resolveWatchSeasonNumber({source:"anilist",mediaType:"tv",titles:[title]}),1);
    }
    assert.equal(resolveWatchSeasonNumber({source:"anilist",mediaType:"tv",titles:["作品 第4期 第1&2クール"]}),4);
  });
  it("treats conflicting explicit title seasons as unknown", () => {
    for (const titles of [["作品 第2期","Title Season 3"],["Title Season 2 Season 3"]]) {
      assert.equal(resolveWatchSeasonNumber({source:"anilist",mediaType:"tv",seasonNumber:1,titles}),null);
    }
  });
  it("uses an explicit request then first season only for AniList TV", () => {
    assert.equal(resolveWatchSeasonNumber({source:"anilist",mediaType:"tv",seasonNumber:3,titles:["X"]}),3);
    assert.equal(resolveWatchSeasonNumber({source:"anilist",mediaType:"tv",titles:["X"]}),1);
    assert.equal(resolveWatchSeasonNumber({source:"tmdb",mediaType:"tv",titles:["X Season 3"]}),null);
    assert.equal(resolveWatchSeasonNumber({source:"tmdb",mediaType:"tv",seasonNumber:3,titles:["X"]}),3);
    assert.equal(resolveWatchSeasonNumber({source:undefined,mediaType:"tv",titles:[]}),null);
  });
  it("never infers a movie season and rejects invalid numbers", () => {
    for(const source of ["tmdb","anilist"]) {
      assert.equal(resolveWatchSeasonNumber({source,mediaType:"movie",seasonNumber:3,titles:["X Season 3"]}),null);
    }
    for(const seasonNumber of [-1,1.5,Number.NaN,Infinity]) {
      assert.equal(resolveWatchSeasonNumber({source:"tmdb",mediaType:"tv",seasonNumber,titles:[]}),null);
    }
    assert.equal(resolveWatchSeasonNumber({source:"tmdb",mediaType:"tv",seasonNumber:0,titles:[]}),0);
  });
});

describe("exact watch season match", () => {
  const seasons=[{season_number:1,air_date:"2024-04-07"},{season_number:2,air_date:"2024-10-01"},{season_number:3,air_date:"2026-04-01"}];
  it("requires matching season number and year", () => {
    assert.equal(pickTmdbSeasonForWatch(seasons,{seasonNumber:3,year:2026}),3);
    assert.equal(pickTmdbSeasonForWatch(seasons,{seasonNumber:3,year:2024}),null);
    assert.equal(pickTmdbSeasonForWatch(seasons,{seasonNumber:3,year:2025}),null);
    assert.equal(pickTmdbSeasonForWatch(seasons,{seasonNumber:2,year:2024}),2);
  });
  it("accepts a different numbering only with a unique exact date", () => {
    assert.equal(pickTmdbSeasonForWatch(seasons,{seasonNumber:3,year:2024,airDate:"2024-10-01"}),2);
    assert.equal(pickTmdbSeasonForWatch(seasons,{seasonNumber:3,year:2024,airDate:"2024-10-02"}),null);
    assert.equal(pickTmdbSeasonForWatch([{season_number:1,air_date:"2024-10-01"},{season_number:2,air_date:"2024-10-01"}],{seasonNumber:3,year:2024,airDate:"2024-10-01"}),null);
  });
  it("rejects unknown, conflicting, malformed or ambiguous metadata", () => {
    for(const input of [{seasonNumber:null,year:2024},{seasonNumber:3,year:null},{seasonNumber:3,year:2025,airDate:"2024-10-01"},{seasonNumber:3,year:2024,airDate:"2024-02-30"}]) {
      assert.equal(pickTmdbSeasonForWatch(seasons,input),null);
    }
    assert.equal(pickTmdbSeasonForWatch([{season_number:3,air_date:"2026-04-01"},{season_number:3,air_date:"2026-10-01"}],{seasonNumber:3,year:2026}),null);
    assert.equal(pickTmdbSeasonForWatch([{season_number:0,air_date:"2024-04-07"}],{seasonNumber:1,year:2024,airDate:"2024-04-07"}),null);
  });
  it("uses a complete air date when the separate year is absent", () => {
    assert.equal(pickTmdbSeasonForWatch(seasons,{seasonNumber:2,year:null,airDate:"2024-10-01"}),2);
  });
  it("prioritizes a unique exact date over same-number seasons from another month", () => {
    const split=[{season_number:2,air_date:"2024-04-01"},{season_number:3,air_date:"2024-10-01"}];
    assert.equal(pickTmdbSeasonForWatch(split,{seasonNumber:2,year:2024,airDate:"2024-10-01"}),3);
    assert.equal(pickTmdbSeasonForWatch([...split,{season_number:4,air_date:"2024-10-01"}],{seasonNumber:2,year:2024,airDate:"2024-10-01"}),null);
  });
  it("allows nearby same-number dates and rejects distant dates", () => {
    const split=[{season_number:2,air_date:"2024-04-01"}];
    assert.equal(pickTmdbSeasonForWatch(split,{seasonNumber:2,year:2024,airDate:"2024-04-02"}),2);
    assert.equal(pickTmdbSeasonForWatch(split,{seasonNumber:2,year:2024,airDate:"2024-10-01"}),null);
  });
});

describe("watch season premiere date tolerance", () => {
  it("accepts seven days in either direction across a month boundary", () => {
    for (const [airDate, tmdbDate] of [["2026-09-27", "2026-10-04"], ["2026-10-04", "2026-09-27"]]) {
      assert.equal(pickTmdbSeasonForWatch([{season_number:1,air_date:tmdbDate}], {seasonNumber:1,year:2026,airDate}), 1);
    }
  });

  it("rejects eight days in either direction even within the same month", () => {
    for (const [airDate, tmdbDate] of [["2026-10-01", "2026-10-09"], ["2026-10-09", "2026-10-01"], ["2026-09-27", "2026-10-05"], ["2026-10-05", "2026-09-27"]]) {
      assert.equal(pickTmdbSeasonForWatch([{season_number:1,air_date:tmdbDate}], {seasonNumber:1,year:2026,airDate}), null);
    }
  });

  it("rejects distant dates that happen to share a month", () => {
    assert.equal(pickTmdbSeasonForWatch([{season_number:1,air_date:"2026-10-30"}], {seasonNumber:1,year:2026,airDate:"2026-10-01"}), null);
  });

  it("does not extend date tolerance across airing years", () => {
    for (const [airDate, tmdbDate, year] of [["2026-12-28", "2027-01-02", 2026], ["2027-01-02", "2026-12-28", 2027]] as const) {
      assert.equal(pickTmdbSeasonForWatch([{season_number:1,air_date:tmdbDate}], {seasonNumber:1,year,airDate}), null);
    }
  });

  it("requires the same season number for nearby dates", () => {
    assert.equal(pickTmdbSeasonForWatch([{season_number:1,air_date:"2026-10-02"}], {seasonNumber:3,year:2026,airDate:"2026-09-27"}), null);
  });

  it("keeps unique exact dates ahead of same-number nearby matches", () => {
    const seasons = [{season_number:1,air_date:"2026-10-02"}, {season_number:2,air_date:"2026-09-27"}];
    const input = {seasonNumber:1,year:2026,airDate:"2026-09-27"};
    assert.equal(pickTmdbSeasonForWatch(seasons, input), 2);
    assert.equal(pickTmdbSeasonForWatch([...seasons, {season_number:3,air_date:"2026-09-27"}], input), null);
    assert.equal(pickTmdbSeasonForWatch([{season_number:1,air_date:"2026-10-02"}, {season_number:1,air_date:"2026-09-28"}], input), null);
  });
});
