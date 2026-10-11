import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  annotateFilterMatches,
  compactResults,
  createSearchQueryVariants,
  filterResponseForVariant,
  filterResultsByCompactQuery,
  parseSeasonQuery,
  searchResultIdentity
} from "./normalize.ts";
import * as spacingContract from "./normalize.ts";
import type { SearchResult } from "./types.ts";

function result(
  titlePrimary: string,
  titleOriginal: string | null = null,
  overrides: Partial<SearchResult> = {}
): SearchResult {
  return {
    external_source: "tmdb",
    external_id: titlePrimary,
    content_type: "kdrama",
    title_primary: titlePrimary,
    title_original: titleOriginal,
    poster_url: null,
    overview: null,
    air_year: null,
    has_seasons: true,
    episode_count: null,
    ...overrides
  };
}

describe("search query normalization", () => {
  const seasonQueryCases = [
    ["촌구석 아저씨, 검성이 되다 2기", { baseQuery: "촌구석 아저씨, 검성이 되다", seasonNumber: 2 }],
    ["제목 시즌 3", { baseQuery: "제목", seasonNumber: 3 }],
    ["제목 시즌3", { baseQuery: "제목", seasonNumber: 3 }],
    ["제목 2期", { baseQuery: "제목", seasonNumber: 2 }],
    ["제목 1기", null],
    ["2기", null],
    ["제목 10기", null]
  ] as const;

  for (const [query, expected] of seasonQueryCases) {
    it(`parses the season query: ${query}`, () => {
      assert.deepEqual(parseSeasonQuery(query), expected);
    });
  }

  it("adds Korean spacing and compact-title fallback variants", () => {
    const variants = createSearchQueryVariants("신사의품격");

    assert.deepEqual(
      variants.map((variant) => [variant.query, variant.matchMode]),
      [
        ["신사의품격", "direct"],
        ["신사의 품격", "direct"],
        ["신사의", "compact-title"]
      ]
    );
  });

  it("adds anchor variants for Korean titles without particles", () => {
    const variants = createSearchQueryVariants("오징어게임");

    assert(variants.some((variant) => variant.query === "오징어" && variant.matchMode === "compact-title"));
  });

  it("filters fallback results by comparing titles without spaces", () => {
    const filtered = filterResultsByCompactQuery(
      [result("신사의 품격"), result("신사와 아가씨"), result("A Gentleman's Dignity", "신사의 품격")],
      "신사의품격"
    );

    assert.deepEqual(
      filtered.map((item) => item.title_primary),
      ["신사의 품격", "A Gentleman's Dignity"]
    );
  });

  it("keeps a result resolved through a season relation", () => {
    const filtered = filterResultsByCompactQuery(
      [result("Katainaka no Ossan, Kensei ni Naru II", null, { matched_via: "season_relation" })],
      "촌구석아저씨검성이되다2기"
    );

    assert.equal(filtered.length, 1);
  });

  it("matches direct results against match titles", () => {
    const filtered = filterResultsByCompactQuery(
      [result("Katainaka no Ossan, Kensei ni Naru II", null, {
        matched_via: "direct",
        match_titles: ["촌구석 아저씨, 검성이 되다 2기"]
      })],
      "촌구석아저씨검성이되다2기"
    );

    assert.equal(filtered.length, 1);
  });

  it("rejects unrelated results without match titles", () => {
    const filtered = filterResultsByCompactQuery(
      [result("Unrelated Anime")],
      "촌구석아저씨검성이되다2기"
    );

    assert.equal(filtered.length, 0);
  });

  it("compacts the same anime returned by TMDB and AniList into one result", () => {
    const compacted = compactResults([
      result("용사 파티에서 쫓겨난 다재무능", null, {
        external_source: "tmdb",
        external_id: "123",
        content_type: "anime",
        air_year: 2026
      }),
      result("용사 파티에서 쫓겨난 다재무능", null, {
        external_source: "anilist",
        external_id: "456",
        content_type: "anime",
        air_year: 2026
      })
    ]);

    assert.equal(compacted.length, 1);
    assert.equal(compacted[0]?.external_source, "anilist");
    assert.equal(compacted[0]?.duplicate_hint, true);
  });

  it("keeps works with the same title but different years separate", () => {
    const compacted = compactResults([
      result("신사의 품격", null, { external_id: "2012", air_year: 2012 }),
      result("신사의 품격", null, { external_id: "2026", air_year: 2026 })
    ]);

    assert.equal(compacted.length, 2);
  });

  it("T-1 keeps two seasons of the same TMDB show in adapter order", () => {
    const compacted = compactResults([
      result("재벌X형사 시즌 2", "재벌X형사", { external_id: "220074", season_number: 2, air_year: 2026 }),
      result("재벌X형사 시즌 1", "재벌X형사", { external_id: "220074", season_number: 1, air_year: 2024 })
    ]);
    assert.equal(compacted.length, 2);
    assert.deepEqual(compacted.map(item => item.season_number), [2, 1]);
    assert.deepEqual(compacted.map(item => item.title_primary), ["재벌X형사 시즌 2", "재벌X형사 시즌 1"]);
  });

  it("T-2 drops a whole-show card when season cards exist", () => {
    const compacted = compactResults([
      result("재벌X형사", "재벌X형사", { external_id: "220074", season_number: null }),
      result("재벌X형사 시즌 1", "재벌X형사", { external_id: "220074", season_number: 1 }),
      result("재벌X형사 시즌 2", "재벌X형사", { external_id: "220074", season_number: 2 })
    ]);
    assert.equal(compacted.length, 2);
    assert(compacted.every(item => item.season_number != null));
  });

  it("T-3 merges duplicate cards for the same season", () => {
    const compacted = compactResults([
      result("재벌X형사 시즌 1", "재벌X형사", { external_id: "220074", season_number: 1 }),
      result("재벌X형사 시즌 1", "재벌X형사", { external_id: "220074", season_number: 1, poster_url: "poster.jpg" })
    ]);
    assert.equal(compacted.length, 1);
    assert.equal(compacted[0]?.poster_url, "poster.jpg");
  });

  it("T-4 keeps two seasons airing in the same year", () => {
    const compacted = compactResults([
      result("X 시즌 1", "X", { external_id: "220074", season_number: 1, air_year: 2024, air_date: "2024-01-01" }),
      result("X 시즌 2", "X", { external_id: "220074", season_number: 2, air_year: 2024, air_date: "2024-10-01" })
    ]);
    assert.equal(compacted.length, 2);
  });

  it("T-5 still merges a TMDB season with a TVmaze whole-show duplicate", () => {
    const compacted = compactResults([
      result("재벌X형사 시즌 1", "재벌X형사", { external_source: "tmdb", external_id: "220074", season_number: 1, air_year: 2024 }),
      result("재벌X형사", "재벌X형사", { external_source: "tvmaze", external_id: "44", season_number: null, air_year: 2024 })
    ]);
    assert.equal(compacted.length, 1);
    assert.equal(compacted[0]?.external_source, "tmdb");
    assert.equal(compacted[0]?.season_number, 1);
    assert.equal(compacted[0]?.duplicate_hint, true);
  });
});

describe("search filter annotations", () => {
  const a = result("A", null, { external_id: "1" });
  const b = result("B", null, { external_id: "2" });
  const c = result("C", null, { external_id: "3" });
  const enrichedB = { ...b, origin_country: ["KR"] };

  it("A-1 preserves all results and uses enriched matches", () => {
    const annotated = annotateFilterMatches([a, b, c], [enrichedB], true);
    assert.deepEqual(annotated.results.map(item => item.external_id), ["1", "2", "3"]);
    assert.deepEqual(annotated.results.map(item => item.filter_match), [false, true, false]);
    assert.deepEqual(annotated.results[1]?.origin_country, ["KR"]);
    assert.equal(annotated.filteredOutCount, 2);
  });

  it("A-2 leaves unfiltered objects and order unchanged", () => {
    const annotated = annotateFilterMatches([a, b, c], [enrichedB], false);
    assert.deepEqual(annotated.results, [a, b, c]);
    assert(annotated.results.every((item, index) => item === [a, b, c][index]));
    assert(annotated.results.every(item => !("filter_match" in item)));
    assert.equal(annotated.filteredOutCount, 0);
  });

  it("A-3 distinguishes seasons with the same provider id", () => {
    const first = { ...a, season_number: 1 };
    const second = { ...a, season_number: 2 };
    assert.deepEqual(annotateFilterMatches([first, second], [second], true).results.map(item => item.filter_match), [false, true]);
  });

  it("A-4 includes season identity or whole in a key", () => {
    assert.equal(searchResultIdentity({ ...a, season_number: null as unknown as number }), "tmdb:1:whole");
    assert.equal(searchResultIdentity({ ...a, season_number: 2 }), "tmdb:1:2");
  });

  it("N-1 returns a direct adapter response unchanged", () => {
    const response = { source: "tmdb" as const, results: [a], total: 4, hasNextPage: true };
    assert.equal(filterResponseForVariant(response, { query: "A", matchMode: "direct", compactQuery: "AAAA" }), response);
  });

  it("N-2 filters compact-title fallback and updates total", () => {
    const response = { source: "tmdb" as const, results: [result("신사의 품격"), result("신사와 아가씨")], total: 2 };
    const filtered = filterResponseForVariant(response, { query: "신사의", matchMode: "compact-title", compactQuery: "신사의품격" });
    assert.deepEqual(filtered.results.map(item => item.title_primary), ["신사의 품격"]);
    assert.equal(filtered.total, 1);
  });
});

// Namespace lookup keeps each missing-export regression visible before implementation.

const splitQueries = (query: string) => spacingContract.createKoreanWordSplitVariants(query).map(v => v.query);
const splitExpected = ["너 말", "너말 고", "너말고 다", "너말고다 른"];
it("WS-1 creates compact-title word splits with the full compact query", () => {
  assert.deepEqual(spacingContract.createKoreanWordSplitVariants("너말고다른"), splitExpected.map(query => ({ query, matchMode: "compact-title", compactQuery: "너말고다른" })));
});
it("WS-2 normalizes partial and repeated whitespace", () => {
  for (const q of ["너말고 다른", "  너말고   다른 "]) assert.deepEqual(splitQueries(q), splitExpected);
});
it("WS-3 caps longer titles at four splits", () => assert.deepEqual(splitQueries("선재업고튀어"), ["선 재", "선재 업", "선재업 고", "선재업고 튀"]));
it("WS-4 limits splits to the remaining characters", () => assert.deepEqual(splitQueries("그해우리"), ["그 해", "그해 우", "그해우 리"]));
it("WS-5 removes punctuation before splitting", () => assert.deepEqual(splitQueries("너말고, 다른!"), splitExpected));
it("WS-6 skips query strings already present in primary variants", () => {
  assert.deepEqual(spacingContract.createKoreanWordSplitVariants("너말고다른", [{ query: "너 말", matchMode: "direct", compactQuery: "너말고다른" }]).map(v => v.query), splitExpected.slice(1));
});
it("WS-7 rejects unsplittable and non-Korean queries", () => {
  for (const q of ["", "너", "abcd", "squidgame"]) assert.deepEqual(splitQueries(q), []);
});
it("WS-8 preserves digit character boundaries", () => assert.deepEqual(splitQueries("괴수8호"), ["괴 수", "괴수 8", "괴수8 호"]));
const splitPlanInput = { query: "너말고다른", page: 1, sources: ["tmdb", "anilist"], remainingMs: 7000, primaryVariants: createSearchQueryVariants("너말고다른"), primaryResults: [] as SearchResult[] };
it("WP-1 runs fallback with eligible primary results", () => {
  const plan = spacingContract.planKoreanWordSplitFallback(splitPlanInput);
  assert.equal(plan.reason, "run"); assert.deepEqual(plan.variants.map(v => v.query), splitExpected);
});
it("WP-2 rejects later pages", () => assert.deepEqual(spacingContract.planKoreanWordSplitFallback({ ...splitPlanInput, page: 2 }), { variants: [], reason: "page" }));
it("WP-3 requires TMDB among primary sources", () => assert.deepEqual(spacingContract.planKoreanWordSplitFallback({ ...splitPlanInput, sources: ["anilist"] }), { variants: [], reason: "no_tmdb" }));
it("WP-4 rejects ineligible queries", () => {
  for (const query of ["너", "squid game", "너말ㄱ"]) assert.deepEqual(spacingContract.planKoreanWordSplitFallback({ ...splitPlanInput, query }), { variants: [], reason: "not_eligible" });
});
it("WP-5 skips fallback when primary titles already match", () => assert.deepEqual(spacingContract.planKoreanWordSplitFallback({ ...splitPlanInput, primaryResults: [result("너 말고 다른 연애")] }), { variants: [], reason: "has_match" }));
it("WP-6 runs when primary results are unrelated", () => assert.equal(spacingContract.planKoreanWordSplitFallback({ ...splitPlanInput, primaryResults: [result("너 말고 니 언니")] }).reason, "run"));
it("WP-7 honors the 3000ms remaining-time boundary", () => {
  assert.deepEqual(spacingContract.planKoreanWordSplitFallback({ ...splitPlanInput, remainingMs: 2999 }), { variants: [], reason: "time" });
  assert.equal(spacingContract.planKoreanWordSplitFallback({ ...splitPlanInput, remainingMs: 3000 }).reason, "run");
});
it("WP-8 accepts primary alias title matches", () => assert.deepEqual(spacingContract.planKoreanWordSplitFallback({ ...splitPlanInput, primaryResults: [result("Other", null, { match_titles: ["너 말고 다른 연애"] })] }), { variants: [], reason: "has_match" }));

it("WS-9 creates full compact-query variants for three characters", () => {
  assert.deepEqual(spacingContract.createKoreanWordSplitVariants("너말고"), ["너 말", "너말 고"].map(query => ({ query, matchMode: "compact-title", compactQuery: "너말고" })));
});
it("WS-10 splits two- and three-character queries", () => {
  assert.deepEqual(splitQueries("너말"), ["너 말"]);
  assert.deepEqual(splitQueries("그해우"), ["그 해", "그해 우"]);
});
it("WS-11 preserves rejection of composing jamo input", () => {
  for (const query of ["너말ㄱ", "너ㅁ"]) assert.deepEqual(splitQueries(query), []);
});
const shortSplitPlanInput = { ...splitPlanInput, query: "너말고", primaryVariants: createSearchQueryVariants("너말고"), primaryResults: [] as SearchResult[] };
it("WP-9 runs fallback for three-character queries", () => {
  const plan = spacingContract.planKoreanWordSplitFallback(shortSplitPlanInput);
  assert.equal(plan.reason, "run"); assert.deepEqual(plan.variants.map(v => v.query), ["너 말", "너말 고"]);
});
it("WP-10 skips fallback for matching short primary titles", () => {
  assert.deepEqual(spacingContract.planKoreanWordSplitFallback({ ...shortSplitPlanInput, primaryResults: [result("너 말고 다른 연애")] }), { variants: [], reason: "has_match" });
});
it("WP-11 runs short fallback when primary titles are unrelated", () => {
  assert.equal(spacingContract.planKoreanWordSplitFallback({ ...shortSplitPlanInput, primaryResults: [result("Unrelated Anime")] }).reason, "run");
});
it("WP-12 runs fallback for two-character queries", () => {
  const plan = spacingContract.planKoreanWordSplitFallback({ ...splitPlanInput, query: "너말", primaryVariants: createSearchQueryVariants("너말"), primaryResults: [] });
  assert.equal(plan.reason, "run"); assert.deepEqual(plan.variants.map(v => v.query), ["너 말"]);
});
it("CF-1 filters unrelated titles for three-character compact queries", () => {
  assert.deepEqual(filterResultsByCompactQuery([result("너 말고 다른 연애"), result("너의 이름은")], "너말고").map(v => v.title_primary), ["너 말고 다른 연애"]);
});
it("CF-2 filters unrelated titles for two-character compact queries", () => {
  assert.deepEqual(filterResultsByCompactQuery([result("너 말고 다른 연애"), result("오징어 게임")], "너말").map(v => v.title_primary), ["너 말고 다른 연애"]);
});
it("CF-3 preserves all results for empty compact queries", () => {
  const rows = [result("A"), result("B")];
  assert.deepEqual(filterResultsByCompactQuery(rows, ""), rows);
});
