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

const animeFollowUpInput = {
  query: "감정스킬로", fallbackRan: true, sources: ["tmdb", "anilist"], remainingMs: 5000,
  fallbackResults: [result("전생 귀족, 감정 스킬로 성공하다", null, { external_source: "tmdb", content_type: "anime" })],
  primaryVariants: createSearchQueryVariants("감정스킬로")
};
it("AF-1 follows a fallback TMDB anime with its Korean title", () => {
  assert.deepEqual(spacingContract.planAniListAnimeFollowUp(animeFollowUpInput), { reason: "run", variants: [
    { query: "전생 귀족, 감정 스킬로 성공하다", matchMode: "compact-title", compactQuery: "감정스킬로" }
  ] });
});
it("AF-2 requires a word-split fallback", () => {
  assert.deepEqual(spacingContract.planAniListAnimeFollowUp({ ...animeFollowUpInput, fallbackRan: false }), { variants: [], reason: "no_fallback" });
});
it("AF-3 requires AniList among primary sources", () => {
  assert.deepEqual(spacingContract.planAniListAnimeFollowUp({ ...animeFollowUpInput, sources: ["tmdb"] }), { variants: [], reason: "no_anilist" });
});
it("AF-4 rejects dramas, non-TMDB anime and non-Korean titles", () => {
  for (const item of [result("드라마"), result("애니", null, { external_source: "anilist", content_type: "anime" }), result("Tensei Kizoku", null, { content_type: "anime" })]) {
    assert.deepEqual(spacingContract.planAniListAnimeFollowUp({ ...animeFollowUpInput, fallbackResults: [item] }), { variants: [], reason: "no_anime" });
  }
});
it("AF-5 honors the 2500ms remaining-time boundary", () => {
  assert.deepEqual(spacingContract.planAniListAnimeFollowUp({ ...animeFollowUpInput, remainingMs: 2499 }), { variants: [], reason: "time" });
  assert.equal(spacingContract.planAniListAnimeFollowUp({ ...animeFollowUpInput, remainingMs: 2500 }).reason, "run");
});
it("AF-6 deduplicates compact titles and limits follow-up to two works", () => {
  const plan = spacingContract.planAniListAnimeFollowUp({ ...animeFollowUpInput, fallbackResults: ["애니 A", "애니  A", "애니 B", "애니 C"].map(title => result(title, null, { content_type: "anime" })) });
  assert.equal(plan.reason, "run");
  assert.deepEqual(plan.variants.map(v => v.query), ["애니 A", "애니 B"]);
});
it("AF-7 skips titles already queried in primary variants", () => {
  assert.deepEqual(spacingContract.planAniListAnimeFollowUp({ ...animeFollowUpInput, primaryVariants: [
    ...animeFollowUpInput.primaryVariants, { query: "전생 귀족, 감정 스킬로 성공하다", matchMode: "direct", compactQuery: "감정스킬로" }
  ] }), { variants: [], reason: "no_anime" });
});

describe("Korean relaxed word fallback", () => {
  const query = "추방당한 치트";
  const fullQuery = "추방당한 치트 부여 마술사는 자유로운 세컨드 라이프를 구가한다";
  const title = "추방된 치트 부여 마술사는 제멋대로 세컨드 라이프를 구가한다.";
  const words = ["추방당한", "치트"];
  const fullWords = ["추방당한", "치트", "부여", "마술사는", "자유로운", "세컨드"];
  const variant = { query: "치트", matchMode: "relaxed-words", compactQuery: "추방당한치트", words } as const;
  const direct = { query: "치트", matchMode: "direct", compactQuery: variant.compactQuery } as const;
  const response = {
    source: "tmdb" as const, results: [result(title), result("더블 치트 -거짓 경관-")],
    total: 12, hasNextPage: true
  };
  const queries = (variants: readonly { query: string }[]) => variants.map(item => item.query);
  const titles = (results: SearchResult[]) => results.map(item => item.title_primary);

  it("RW-1 extracts two words", () => {
    assert.deepEqual(spacingContract.extractRelaxedSearchWords(query), words);
  });
  it("RW-2 splits whitespace and punctuation", () => {
    for (const input of ["  추방당한   치트 ", "추방당한, 치트!"]) {
      assert.deepEqual(spacingContract.extractRelaxedSearchWords(input), words);
    }
  });
  it("RW-3 keeps the first six words", () => {
    assert.deepEqual(spacingContract.extractRelaxedSearchWords(fullQuery), fullWords);
  });
  it("RW-4 removes one-character words and duplicates", () => {
    assert.deepEqual(spacingContract.extractRelaxedSearchWords("그 해 우리는"), ["우리는"]);
    assert.deepEqual(spacingContract.extractRelaxedSearchWords("치트 치트 부여"), ["치트", "부여"]);
  });
  it("RW-5 splits symbols and lowercases Latin words", () => {
    assert.deepEqual(spacingContract.extractRelaxedSearchWords("SPY×FAMILY 극장판"), ["spy", "family", "극장판"]);
  });
  it("RW-6 keeps a compact word and rejects empty input", () => {
    assert.deepEqual(spacingContract.extractRelaxedSearchWords("추방당한치트"), ["추방당한치트"]);
    assert.deepEqual(spacingContract.extractRelaxedSearchWords(""), []);
  });

  const stemCases = [
    ["ST-1 removes recognized endings", ["추방당한", "추방된", "자유로운", "마술사는", "파티에서", "구가한다"], ["추방", "추방", "자유", "마술사", "파티", "구가"]],
    ["ST-2 preserves words without an eligible ending", ["치트", "세컨드", "대한", "그는", "spy", "2기", "당한"], ["치트", "세컨드", "대한", "그는", "spy", "2기", "당한"]],
    ["ST-3 tries shorter endings when needed", ["못하는", "되는"], ["못하", "되는"]],
    ["ST-4 accepts heuristic noun stems", ["미식가", "고양이", "진격의"], ["미식", "고양", "진격"]]
  ] as const;
  for (const [name, inputs, expected] of stemCases) {
    it(name, () => assert.deepEqual(inputs.map(word => spacingContract.koreanWordStem(word)), expected));
  }

  it("RV-1 creates relaxed variants with matching metadata", () => {
    assert.deepEqual(spacingContract.createKoreanRelaxedWordVariants(query), [{ ...variant, query: "치트 추방" }, variant]);
  });
  const variantCases = [
    ["RV-2 caps queries at four", "추방당한 치트 부여 마술사", ["치트 부여 마술사 추방", "치트 부여 마술사", "부여 마술사", "치트 마술사"]],
    ["RV-3 caps words and core words", fullQuery, ["치트 부여 세컨드 추방", "치트 부여 세컨드 마술사", "치트 부여 세컨드", "부여 세컨드"]],
    ["RV-4 drops a different adjective", "자유로운 세컨드 라이프", ["세컨드 라이프 자유", "세컨드 라이프", "라이프", "세컨드"]],
    ["RV-5 handles the opposite verb form", "파티에서 추방된 치유사", ["치유사 파티", "치유사 추방", "치유사"]],
    ["RV-6 uses stems alone without core words", "추방당한 마술사는", ["추방", "마술사"]],
    ["RV-9 excludes stems already in the core", "치트는 치트 부여", ["치트 부여", "부여", "치트"]]
  ] as const;
  for (const [name, input, expected] of variantCases) {
    it(name, () => assert.deepEqual(queries(spacingContract.createKoreanRelaxedWordVariants(input)), expected));
  }
  it("RV-7 skips prior queries", () => {
    assert.deepEqual(queries(spacingContract.createKoreanRelaxedWordVariants(query, [direct])), ["치트 추방"]);
  });
  it("RV-8 requires two words", () => {
    for (const input of ["추방당한치트", "", "치"]) {
      assert.deepEqual(spacingContract.createKoreanRelaxedWordVariants(input), []);
    }
  });

  it("RF-1 requires both words and rejects unrelated works", () => {
    const candidates = [...response.results, result("파티에서 추방당한 그 치유사, 실은 최강인 것에 대하여")];
    assert.deepEqual(titles(spacingContract.filterResultsByRelaxedWords(candidates, words)), [title]);
  });
  it("RF-2 keeps two of three matches in result order", () => {
    const candidates = [result("어 세컨드 라이프"), result("자유로"), result(title)];
    assert.deepEqual(titles(spacingContract.filterResultsByRelaxedWords(candidates, ["자유로운", "세컨드", "라이프"])), ["어 세컨드 라이프", title]);
  });
  it("RF-3 requires four matches for six words", () => {
    const shortTitle = "추방된 치트 부여 마술사";
    const candidates = [result(title), result("치트 부여 세컨드"), result(shortTitle)];
    assert.deepEqual(titles(spacingContract.filterResultsByRelaxedWords(candidates, fullWords)), [title, shortTitle]);
  });
  it("RF-4 uses original titles, aliases and series titles", () => {
    const candidates = [
      result("Other", "추방된 치트 부여 마술사"), result("Other2", null, { match_titles: [title] }),
      result("시즌 2", null, { series_title: title }), result("무관")
    ];
    assert.deepEqual(titles(spacingContract.filterResultsByRelaxedWords(candidates, words)), ["Other", "Other2", "시즌 2"]);
  });
  it("RF-5 checks word coverage on season relations", () => {
    const candidate = result("용사 파티에 귀여운 애가 있어서, 고백해봤다. 2기", null, { matched_via: "season_relation" });
    assert.deepEqual(spacingContract.filterResultsByRelaxedWords([candidate], ["파티에서", "추방된", "치유사"]), []);
  });
  it("RF-6 rejects a single word", () => {
    assert.deepEqual(spacingContract.filterResultsByRelaxedWords([result(title)], ["치트"]), []);
  });
  it("RR-1 filters a relaxed response and preserves its pagination", () => {
    const filtered = spacingContract.filterResponseForVariant(response, variant);
    assert.deepEqual(titles(filtered.results), [title]);
    assert.equal(filtered.total, 1);
    assert.equal(filtered.hasNextPage, true);
  });
  it("RR-2 rejects a relaxed response without words", () => {
    const filtered = spacingContract.filterResponseForVariant(response, { ...direct, matchMode: "relaxed-words" });
    assert.deepEqual(filtered.results, []);
    assert.equal(filtered.total, 0);
  });
  it("CS-1 preserves direct and compact cache scopes", () => {
    const base = { query: "신사의 품격", matchMode: "direct", compactQuery: "신사의품격" } as const;
    assert.equal(spacingContract.searchCacheScope(base), "direct");
    assert.equal(spacingContract.searchCacheScope({ ...base, query: "신사의", matchMode: "compact-title" }), "compact-title:신사의품격");
  });
  it("CS-2 scopes relaxed cache entries by words", () => {
    assert.equal(spacingContract.searchCacheScope(variant), "relaxed-words:추방당한 치트");
  });

  const basePlan = {
    query, page: 1, sources: ["tmdb", "anilist"], remainingMs: 7000,
    existingVariants: createSearchQueryVariants(query), priorResults: [] as SearchResult[]
  };
  it("RP-1 runs when no earlier title matches", () => {
    const plan = spacingContract.planKoreanRelaxedWordFallback(basePlan);
    assert.equal(plan.reason, "run");
    assert.deepEqual(queries(plan.variants), ["치트 추방", "치트"]);
  });
  const skipCases: [string, Partial<typeof basePlan>[], string][] = [
    ["RP-2 skips later pages", [{ page: 2 }], "page"],
    ["RP-3 requires TMDB", [{ sources: ["anilist"] }], "no_tmdb"],
    ["RP-4 requires Hangul without composing jamo", [{ query: "squid game" }, { query: "추방당한 치ㅌ" }], "not_eligible"],
    ["RP-5 skips season searches", [{ query: "추방당한 치트 2기" }], "season"],
    ["RP-6 skips one-word searches", [{ query: "추방당한치트" }, { query: "그 해 우리는" }], "single_word"],
    ["RP-7 skips a forward title match", [{ priorResults: [result(fullQuery)] }], "has_match"]
  ];
  for (const [name, overrides, reason] of skipCases) {
    it(name, () => {
      for (const override of overrides) {
        assert.deepEqual(spacingContract.planKoreanRelaxedWordFallback({ ...basePlan, ...override }), { variants: [], reason });
      }
    });
  }
  it("RP-8 ignores a reverse inclusion match", () => {
    const input = "자유로운 세컨드 라이프";
    const priorResults = [result("자유로")];
    const plan = spacingContract.planKoreanRelaxedWordFallback({
      ...basePlan, query: input, existingVariants: createSearchQueryVariants(input), priorResults
    });
    assert.equal(plan.reason, "run");
    assert.deepEqual(queries(plan.variants), ["세컨드 라이프 자유", "세컨드 라이프", "라이프", "세컨드"]);
    assert.equal(filterResultsByCompactQuery(priorResults, "자유로운세컨드라이프").length, 1);
  });
  it("RP-9 ignores an unrelated AniList season relation", () => {
    const input = "파티에서 추방된 치유사";
    const priorResults = [result("용사 파티에 귀여운 애가 있어서, 고백해봤다. 2기", null, {
      external_source: "anilist", content_type: "anime", matched_via: "season_relation"
    })];
    const plan = spacingContract.planKoreanRelaxedWordFallback({
      ...basePlan, query: input, existingVariants: createSearchQueryVariants(input), priorResults
    });
    assert.equal(plan.reason, "run");
    assert.deepEqual(queries(plan.variants), ["치유사 파티", "치유사 추방", "치유사"]);
    assert.equal(filterResultsByCompactQuery(priorResults, "파티에서추방된치유사").length, 1);
  });
  it("RP-10 runs at the 2500ms boundary", () => {
    assert.deepEqual(spacingContract.planKoreanRelaxedWordFallback({ ...basePlan, remainingMs: 2499 }), { variants: [], reason: "time" });
    assert.equal(spacingContract.planKoreanRelaxedWordFallback({ ...basePlan, remainingMs: 2500 }).reason, "run");
  });
  it("RP-11 recognizes forward matches in alternate title fields", () => {
    const matchingTitle = "추방당한 치트 부여 마술사";
    for (const candidate of [
      result("Other", null, { match_titles: [matchingTitle] }),
      result("시즌 1", null, { series_title: matchingTitle }),
      result("Other", matchingTitle)
    ]) {
      assert.deepEqual(spacingContract.planKoreanRelaxedWordFallback({ ...basePlan, priorResults: [candidate] }), { variants: [], reason: "has_match" });
    }
  });
  it("RP-12 skips when all queries have already run", () => {
    const existingVariants = [
      ...basePlan.existingVariants, { ...direct, query: "치트 추방", matchMode: "compact-title" } as const, direct
    ];
    assert.deepEqual(spacingContract.planKoreanRelaxedWordFallback({ ...basePlan, existingVariants }), { variants: [], reason: "not_eligible" });
  });
});

describe("AniList expanded season filtering", () => {
  const ani = (title: string, id: string, overrides: Partial<SearchResult> = {}) =>
    result(title, null, { external_source: "anilist", external_id: id, content_type: "anime", ...overrides });
  const aniSeason = (title: string, id: string, baseId: string, seasonNumber: number) =>
    ani(title, id, { matched_via: "season_relation", resolved_from_id: baseId, season_number: seasonNumber });
  const ids = (results: SearchResult[]) => results.map(item => item.external_id);

  const healerQuery = "파티에서 추방된 치유사";
  const compactHealerQuery = "파티에서추방된치유사";
  const unrelatedParty = [
    ani("용사 파티에 귀여운 애가 있어서, 고백해봤다.", "195515"),
    aniSeason("용사 파티에 귀여운 애가 있어서, 고백해봤다. 2기", "219679", "195515", 2)
  ];
  const unrelatedDemonLord = ani("알바 뛰는 마왕님!", "15809");
  const unrelatedDemonLordSeason = aniSeason("알바 뛰는 마왕님!", "130592", "15809", 2);
  const retryBase = ani("마왕님 리트라이!", "104252");
  const explicitSeason = aniSeason("Katainaka no Ossan, Kensei ni Naru II", "194829", "179955", 2);

  it("SR-1 drops an unrelated expanded season with its base", () => {
    assert.deepEqual(ids(filterResultsByCompactQuery(unrelatedParty, compactHealerQuery)), []);
  });
  it("SR-2 drops multiple unrelated seasons before their base", () => {
    const candidates = [
      unrelatedDemonLordSeason,
      aniSeason("The Devil is a Part-Timer! Season 2 Part 2", "155168", "15809", 3),
      unrelatedDemonLord
    ];
    assert.deepEqual(ids(filterResultsByCompactQuery(candidates, "마왕님리트라이")), []);
  });
  it("SR-3 keeps a romaji season when its base matches", () => {
    const candidates = [retryBase, aniSeason("Maou-sama, Retry! R", "168500", "104252", 2)];
    assert.deepEqual(ids(filterResultsByCompactQuery(candidates, "마왕님리트라이")), ["104252", "168500"]);
  });
  it("SR-4 keeps matching cards in order among unrelated cards", () => {
    const candidates = [
      retryBase, aniSeason("마왕님 리트라이! 2기", "168500", "104252", 2),
      unrelatedDemonLordSeason, unrelatedDemonLord
    ];
    assert.deepEqual(ids(filterResultsByCompactQuery(candidates, "마왕님리트라이")), ["104252", "168500"]);
  });
  it("SR-5 keeps a season whose own title matches", () => {
    const candidates = [
      ani("Kimetsu no Yaiba", "101922"), aniSeason("귀멸의 칼날 환락의 거리편", "142329", "101922", 2)
    ];
    assert.deepEqual(ids(filterResultsByCompactQuery(candidates, "환락의거리편")), ["142329"]);
  });
  it("SR-6 keeps an explicit season result without its base", () => {
    assert.deepEqual(ids(filterResultsByCompactQuery([explicitSeason], "촌구석아저씨검성이되다2기")), ["194829"]);
  });
  it("SR-7 ignores base IDs from another source", () => {
    const candidates = [result("무관한 드라마", null, { external_id: "179955" }), explicitSeason];
    assert.deepEqual(ids(filterResultsByCompactQuery(candidates, "촌구석아저씨검성이되다2기")), ["194829"]);
  });
  it("SR-8 keeps a season without a resolved base ID", () => {
    const candidates = [
      ani("Unrelated", "1"), ani("Some Sequel II", "2", { matched_via: "season_relation", season_number: 2 })
    ];
    assert.deepEqual(ids(filterResultsByCompactQuery(candidates, "촌구석아저씨")), ["2"]);
  });
  it("SR-9 keeps a season when any duplicate base matches", () => {
    const candidates = [
      ani("Yuusha Party wo Oidasareta Kiyou Binbou", "187264"),
      ani("용사 파티에서 쫓겨난 다재무능", "187264"),
      aniSeason("Jack-of-All-Trades, Party of None Season 2", "209670", "187264", 2)
    ];
    const filtered = filterResultsByCompactQuery(candidates, "용사파티에서쫓겨난");
    assert.deepEqual(ids(filtered), ["187264", "209670"]);
    assert.deepEqual(filtered.map(item => item.title_primary), [
      "용사 파티에서 쫓겨난 다재무능", "Jack-of-All-Trades, Party of None Season 2"
    ]);
  });
  it("SR-10 filters compact-title results and updates the total", () => {
    const filtered = filterResponseForVariant(
      { source: "anilist", results: unrelatedParty, total: 2, hasNextPage: false },
      { query: "파티에", matchMode: "compact-title", compactQuery: compactHealerQuery }
    );
    assert.deepEqual({ results: ids(filtered.results), total: filtered.total }, { results: [], total: 0 });
  });
  it("SR-11 allows spacing fallback when only unrelated seasons were found", () => {
    const plan = spacingContract.planKoreanWordSplitFallback({
      query: healerQuery, page: 1, sources: ["tmdb", "anilist"], remainingMs: 7000,
      primaryVariants: createSearchQueryVariants(healerQuery), primaryResults: unrelatedParty
    });
    assert.equal(plan.reason, "run");
    assert.deepEqual(plan.variants.map(variant => variant.query), ["파 티", "파티 에", "파티에 서", "파티에서 추"]);
  });
});
