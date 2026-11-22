import assert from "node:assert/strict";
import { it } from "node:test";

import { formatSearchResultTitle } from "./searchResultTitle";
import * as titleContract from "./searchResultTitle";

it("F-1 prefixes a meaningful standalone season title", () => {
  assert.equal(formatSearchResultTitle({ title_primary: "4기: 합동 강화 훈련편", series_title: "귀멸의 칼날" }), "귀멸의 칼날 4기: 합동 강화 훈련편");
});

it("F-2 keeps the primary title when the series title is absent", () => {
  for (const series_title of [undefined, null, ""]) {
    assert.equal(formatSearchResultTitle({ title_primary: "제목", ...(series_title === undefined ? {} : { series_title }) }), "제목");
  }
});

it("87 labels localized AniList seasons and split cours from their native title", () => {
  const base = { external_source: "anilist" as const, content_type: "anime" as const, title_primary: "무직전생", series_title: null };
  assert.equal(formatSearchResultTitle({ ...base, title_original: "無職転生Ⅲ ～異世界行ったら本気だす～" }), "무직전생 3기");
  assert.equal(formatSearchResultTitle({ ...base, title_original: "無職転生Ⅲ ～異世界行ったら本気だす～ 第2クール" }), "무직전생 3기 파트 2");
  assert.equal(formatSearchResultTitle({ ...base, title_primary: "무직전생 3기", title_is_synthesized: true, title_original: "無職転生Ⅱ ～異世界行ったら本気だす～", season_number: 3 }), "무직전생 2기");
});

it("87 labels first-season Part 2 and specials without changing non-anime titles", () => {
  const base = { external_source: "anilist" as const, content_type: "anime" as const, title_primary: "무직전생", series_title: null };
  assert.equal(formatSearchResultTitle({ ...base, title_original: "無職転生 ～異世界行ったら本気だす～ 第2クール" }), "무직전생 1기 파트 2");
  assert.equal(formatSearchResultTitle({ ...base, anime_format: "OVA" }), "무직전생 특별편");
  assert.equal(formatSearchResultTitle({ ...base, external_source: "tmdb", content_type: "movie", title_primary: "제목 III" }), "제목 III");
  const special = { ...base, title_original: "無職転生 ～異世界行ったら本気だす～ 第2クール", anime_format: "OVA" };
  const once = formatSearchResultTitle(special);
  assert.equal(formatSearchResultTitle({ ...special, title_primary: once }), once);
});

it("87 keeps the release label visible in card metadata before a long truncated title", () => {
  const getLabel = (titleContract as unknown as { searchResultReleaseLabel: (result: object) => string | null }).searchResultReleaseLabel;
  assert.equal(typeof getLabel, "function");
  assert.equal(getLabel({ external_source: "anilist", content_type: "anime", title_primary: "무직전생", title_original: "無職転生Ⅲ ～異世界行ったら本気だす～ 第2クール" }), "3기 파트 2");
  assert.equal(getLabel({ external_source: "anilist", content_type: "anime", title_primary: "Mushoku Tensei: Jobless Reincarnation Season 2 Part 2", title_original: "無職転生Ⅱ ～異世界行ったら本気だす～ 第2クール" }), "2기 파트 2");
  assert.equal(getLabel({ external_source: "tmdb", content_type: "anime", title_primary: "시리즈", season_number: 2 }), "시즌 2");
  assert.equal(getLabel({ external_source: "tmdb", content_type: "movie", title_primary: "영화" }), null);
});
