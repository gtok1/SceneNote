import assert from "node:assert/strict";
import { it } from "node:test";

import type { SearchResult } from "../src/types/content";
import { evaluateGoldenCase, SEARCH_GOLDEN_CASES } from "./searchGolden";

const row = (external_id: string, season_number?: number, overrides: Partial<SearchResult> = {}): SearchResult => ({
  external_source: "tmdb", external_id, ...(season_number === undefined ? {} : { season_number }), content_type: "jdrama",
  title_primary: "제목", title_original: null, poster_url: null, overview: null,
  air_year: 2024, has_seasons: true, episode_count: null, ...overrides
});

it("G-1 accepts both expected seasons", () => {
  assert.equal(evaluateGoldenCase([row("220074", 1), row("220074", 2)], SEARCH_GOLDEN_CASES[0]!).ok, true);
});
it("G-2 reports a missing first season", () => {
  const result = evaluateGoldenCase([row("220074", 2)], SEARCH_GOLDEN_CASES[0]!);
  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 1);
  assert(result.failures[0]?.includes("220074 S1 없음"));
});
it("G-3 reports a content type mismatch", () => {
  const result = evaluateGoldenCase([row("55582", undefined, { content_type: "anime" })], SEARCH_GOLDEN_CASES[2]!);
  assert(result.failures[0]?.includes("content_type anime ≠ jdrama"));
});
it("G-4 checks the formatted series and season title", () => {
  const result = evaluateGoldenCase([row("1429", 4, { title_primary: "시즌 4 (The Final Season)", series_title: "진격의 거인" })], SEARCH_GOLDEN_CASES[4]!);
  assert.equal(result.ok, true);
});
it("G-5 requires a whole-work card when seasonNumber is null", () => {
  const result = evaluateGoldenCase([row("x", 1)], { query: "x", mustInclude: [{ externalId: "x", seasonNumber: null }] });
  assert.equal(result.ok, false);
});
it("G-6 preserves the twelve specified golden queries and ids", () => {
  assert.equal(SEARCH_GOLDEN_CASES.length, 12);
  assert.deepEqual(SEARCH_GOLDEN_CASES.map(item => [item.query, item.mustInclude.map(expected => expected.externalId)]), [
    ["재벌X형사", ["220074", "220074"]], ["결혼 못하는", ["13372", "13372", "31618"]],
    ["고독한 미식가", ["55582"]], ["중쇄를 찍자", ["67504"]], ["진격의 거인", ["1429"]],
    ["귀멸의 칼날", ["85937"]], ["브레이킹 배드", ["1396"]], ["기생충", ["496243"]],
    ["파묘", ["838209"]], ["랑야방", ["64197"]], ["눈물의 여왕", ["215720"]], ["셜록", ["19885"]]
  ]);
});
