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
