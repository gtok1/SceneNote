import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { isSameRecommendationWork } from "../../supabase/functions/_shared/recommendationEngine";
import * as visibility from "./recommendationVisibility";
import { countVisibleRecommendationCandidates, filterVisibleRecommendationCandidates, findVisibleRecommendationReplacement, isRegisteredRecommendation, summarizeRecommendationVisibility } from "./recommendationVisibility";

const candidate = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  external_source: "anilist",
  external_id: "101",
  content_type: "anime",
  title_primary: "첫 번째 작품",
  title_original: null,
  poster_url: null,
  overview: null,
  air_year: 2026,
  has_seasons: true,
  episode_count: 12,
  genres: ["Drama"],
  ...overrides
});

const libraryItem = (overrides: Partial<LibraryListItem> = {}): LibraryListItem => ({
  source_api: "manual",
  source_id: "",
  content_type: "anime",
  title_primary: "첫번째작품",
  title_original: null,
  air_year: null,
  ...overrides
} as LibraryListItem);

it("V-1 hides a TV recommendation already registered as a same-title movie", () => {
  const result = candidate({ external_source: "tmdb", external_id: "333484", content_type: "kdrama", title_primary: "개인적인 택시", air_year: 2026 });
  const library = [libraryItem({ source_api: "tmdb", source_id: "1744241", content_type: "movie", title_primary: "개인적인 택시", air_year: 2026 })];
  assert.equal(isRegisteredRecommendation(result, library), true);
  assert.equal(countVisibleRecommendationCandidates([result], library, null), 0);
});

it("V-2 preserves separate anime and movie recommendations with the same title and year", () => {
  const result = candidate({ content_type: "movie", title_primary: "같은 제목", air_year: 2026 });
  const library = [libraryItem({ content_type: "anime", title_primary: "같은 제목", air_year: 2026 })];
  assert.equal(isRegisteredRecommendation(result, library), false);
  assert.equal(countVisibleRecommendationCandidates([result], library, null), 1);
});

describe("recommendation visibility parity", () => {
  it("uses the same multi-select union for visible cards, counts, and replacements", () => {
    const korean = candidate({ external_id: "kr", content_type: "kdrama", genres: ["Comedy"], origin_country: ["KR"] });
    const japanese = candidate({ external_id: "jp", genres: ["Mystery"], origin_country: ["JP"] });
    const film = candidate({ external_id: "film", content_type: "movie", genres: ["Comedy"], origin_country: ["JP"] });
    const excluded = candidate({ external_id: "excluded", genres: ["Comedy", "Romance"], origin_country: ["KR"] });
    const rows = [korean, japanese, film, excluded];
    const filters = { genres: ["comedy", "mystery"], countries: ["JP", "KR"], mediaTypes: ["drama", "anime"] as const };
    const exclusions = { excludedGenres: ["romance"], excludedThemeKeys: [] };
    assert.deepEqual(filterVisibleRecommendationCandidates(rows, [], exclusions, filters), [korean, japanese]);
    assert.equal(countVisibleRecommendationCandidates(rows, [], exclusions, filters), 2);
    assert.equal(findVisibleRecommendationReplacement(rows, [korean], [], exclusions, filters), japanese);
    assert.equal(summarizeRecommendationVisibility(rows, [], exclusions, filters).visible, 2);
  });

  it("counts and refills only candidates satisfying both positive filters, with exclusions taking priority", () => {
    const comedyKr = candidate({ external_id: "comedy-kr", genres: ["Comedy"], origin_country: ["KR"] });
    const comedyJp = candidate({ external_id: "comedy-jp", genres: ["Comedy"], origin_country: ["JP"] });
    const dramaKr = candidate({ external_id: "drama-kr", genres: ["Drama"], origin_country: ["KR"] });
    const rows = [comedyJp, dramaKr, comedyKr];
    const filters = { genre: "코미디", country: "KR" };
    assert.deepEqual(filterVisibleRecommendationCandidates(rows, [], null, filters), [comedyKr]);
    assert.equal(countVisibleRecommendationCandidates(rows, [], null, filters), 1);
    assert.equal(findVisibleRecommendationReplacement(rows, [], [], null, filters), comedyKr);
    assert.equal(countVisibleRecommendationCandidates(rows, [], { excludedGenres: ["comedy"], excludedThemeKeys: [] }, filters), 0);
    assert.equal(countVisibleRecommendationCandidates(rows, [], null), 3);
  });

  it("hides an already registered title even when the library year is unknown", () => {
    assert.equal(isRegisteredRecommendation(candidate(), [libraryItem()]), true);
    assert.equal(countVisibleRecommendationCandidates([candidate()], [libraryItem()], null), 0);
  });

  it("keeps a different year when both years are known", () => {
    assert.equal(isRegisteredRecommendation(candidate(), [libraryItem({ air_year: 2024 })]), false);
    assert.equal(countVisibleRecommendationCandidates([candidate()], [libraryItem({ air_year: 2024 })], null), 1);
  });

  it("counts only current-account eligible cards after genre and theme exclusions", () => {
    const rows = [
      candidate({ external_id: "101", title_primary: "첫 번째 작품" }),
      candidate({ external_id: "102", title_primary: "두 번째 작품", genres: ["Romance"] }),
      candidate({ external_id: "103", title_primary: "세 번째 작품", genres: ["Action"] })
    ];
    assert.equal(countVisibleRecommendationCandidates(rows, [libraryItem()], {
      excludedThemeKeys: [],
      excludedGenres: ["romance"]
    }), 1);
    assert.equal(countVisibleRecommendationCandidates(rows, [libraryItem()], null), 2);
    assert.deepEqual(filterVisibleRecommendationCandidates(rows, [libraryItem()], {
      excludedThemeKeys: [], excludedGenres: ["romance"]
    }).map((item) => item.external_id), ["103"]);
  });

  it("separates registered titles from missing-keyword TMDB exclusions", () => {
    const rows = [
      candidate(),
      { ...candidate({ external_source: "tmdb", external_id: "202", title_primary: "새 드라마", content_type: "kdrama" }), keywords: [] },
      candidate({ external_id: "303", title_primary: "새 애니", genres: ["Action"] })
    ];
    assert.deepEqual(summarizeRecommendationVisibility(rows, [libraryItem()], {
      excludedThemeKeys: ["boys-love"], excludedGenres: []
    }), { raw: 3, registered: 1, excluded: 1, visible: 1, unverifiableTmdb: 1 });
  });

  it("refills with the first visible new work instead of a hidden raw item", () => {
    const existing = candidate({ external_id: "existing", title_primary: "이미 표시한 작품" });
    const eligible = candidate({ external_id: "eligible", title_primary: "다른 새 작품" });
    const rows = [
      { ...candidate({ external_source: "tmdb", external_id: "unknown", title_primary: "테마 미확인" }), keywords: [] },
      candidate(),
      candidate({ external_id: "romance", title_primary: "제외 장르", genres: ["Romance"] }),
      { ...existing, external_id: "duplicate-source" },
      eligible
    ];
    assert.equal(findVisibleRecommendationReplacement(rows, [existing], [libraryItem()], {
      excludedThemeKeys: ["boys-love"], excludedGenres: ["romance"]
    }), eligible);
  });

  it("does not report a replacement when every candidate is hidden", () => {
    const unknown = { ...candidate({ external_source: "tmdb" }), keywords: [] };
    assert.equal(findVisibleRecommendationReplacement([unknown], [], [], {
      excludedThemeKeys: ["boys-love"], excludedGenres: []
    }), undefined);
    // The same title remains available to an account that did not exclude it.
    assert.equal(findVisibleRecommendationReplacement([unknown], [], [], {
      excludedThemeKeys: [], excludedGenres: []
    }), unknown);
  });
});

it("Y-5 stale provider responses and replacements never display outside the selected year", () => {
  const items = [1992, 1981, 2026, 2025, null].map((air_year, index) => candidate({ external_id: String(index), air_year }));
  assert.deepEqual(filterVisibleRecommendationCandidates(items, [], null, { year: 2025 }).map(item => item.air_year), [2025]);
  assert.equal(countVisibleRecommendationCandidates(items, [], null, { year: 2025 }), 1);
});

it("85 T-7: indexed registration matches the full library scan", () => {
  const library = [
    libraryItem({ source_api: "tmdb", source_id: "333", content_type: "kdrama", title_primary: "개인적인 택시", air_year: 2026 }),
    libraryItem({ source_api: "manual", source_id: "999", content_type: "anime", title_primary: "수동 작품", air_year: null }),
    libraryItem({ source_api: "anilist", source_id: "10", content_type: "anime", title_primary: "같은 제목", air_year: 2026 }),
    libraryItem({ source_api: "tmdb", source_id: "20", content_type: "movie", title_primary: "영화 제목", air_year: 2024 }),
    libraryItem({ source_api: "tmdb", source_id: "30", content_type: "jdrama", title_primary: "원제만", title_original: "オリジナル", air_year: 2025 }),
    libraryItem({ source_api: "tmdb", source_id: "40", content_type: "anime", title_primary: "A", air_year: 2026 })
  ];
  const cases: { id: string; result: SearchResult; expected: boolean }[] = [
    { id: "a", result: candidate({ external_source: "tmdb", external_id: "333", content_type: "kdrama", title_primary: "다른 제목", air_year: 2026 }), expected: true },
    { id: "b", result: candidate({ external_source: "tmdb", external_id: "999", content_type: "anime", title_primary: "다른 작품", air_year: 2026 }), expected: false },
    { id: "c1", result: candidate({ external_source: "anilist", external_id: "11", content_type: "anime", title_primary: "같은 제목", air_year: 2026 }), expected: true },
    { id: "c2", result: candidate({ external_source: "anilist", external_id: "12", content_type: "anime", title_primary: "같은 제목", air_year: 2025 }), expected: false },
    { id: "c3", result: candidate({ external_source: "anilist", external_id: "13", content_type: "anime", title_primary: "같은 제목", air_year: null }), expected: true },
    { id: "d", result: candidate({ external_source: "tmdb", external_id: "14", content_type: "movie", title_primary: "같은 제목", air_year: 2026 }), expected: false },
    { id: "e1", result: candidate({ external_source: "tmdb", external_id: "21", content_type: "kdrama", title_primary: "영화 제목", air_year: 2025 }), expected: true },
    { id: "e2", result: candidate({ external_source: "tmdb", external_id: "22", content_type: "kdrama", title_primary: "영화 제목", air_year: 2026 }), expected: false },
    { id: "e3", result: candidate({ external_source: "tmdb", external_id: "23", content_type: "kdrama", title_primary: "영화 제목", air_year: null }), expected: false },
    { id: "f", result: candidate({ external_source: "tmdb", external_id: "31", content_type: "jdrama", title_primary: "다른 번역", title_original: "オリジナル", air_year: 2025 }), expected: true },
    { id: "g", result: candidate({ external_source: "anilist", external_id: "41", content_type: "anime", title_primary: "A", air_year: 2026 }), expected: false },
    { id: "h", result: candidate({ external_source: "anilist", external_id: "15", content_type: "anime", title_primary: "같은   제목!", air_year: 2026 }), expected: true },
    { id: "i", result: candidate({ external_source: "anilist", external_id: "77", content_type: "anime", title_primary: "수동 작품", air_year: null }), expected: true }
  ];
  const fullScan = (c: SearchResult, lib: readonly LibraryListItem[]) => lib.some((i) =>
    (i.source_api !== "manual" && `${i.source_api}:${i.source_id}` === `${c.external_source}:${c.external_id}`) ||
    isSameRecommendationWork(i, c));

  for (const { id, result, expected } of cases) {
    assert.equal(fullScan(result, library), expected, `${id}: fixed full-scan expectation`);
    assert.equal(isRegisteredRecommendation(result, library), fullScan(result, library), `${id}: indexed parity`);
    assert.equal(isRegisteredRecommendation(result, []), false, `${id}: empty library`);
  }
});

it("85 T-8: the library index is reused per array reference", () => {
  const library = [libraryItem()];
  const first = visibility.getRecommendationLibraryIndex(library);
  assert.strictEqual(visibility.getRecommendationLibraryIndex(library), first);
  assert.notStrictEqual(visibility.getRecommendationLibraryIndex([...library]), first);
});

it("85 T-9: same-work candidates come only from matching titles", () => {
  const matching = [
    libraryItem({ content_type: "anime", title_primary: "목표 작품", air_year: 2025 }),
    libraryItem({ content_type: "movie", title_primary: "목표 작품", air_year: 2025 })
  ];
  const library = [
    ...Array.from({ length: 2_000 }, (_, index) => libraryItem({
      source_id: String(index), title_primary: `서로 다른 작품 ${index}`
    })),
    ...matching
  ];
  const index = visibility.getRecommendationLibraryIndex(library);
  const result = candidate({ title_primary: "목표 작품", content_type: "anime", air_year: 2025 });
  const matches = visibility.findSameWorkLibraryCandidates(index, result);
  assert.equal(matches.length, 2);
  assert.deepEqual(new Set(matches), new Set(matching));
  assert.deepEqual(visibility.findSameWorkLibraryCandidates(index, candidate({ title_primary: "없는 제목" })), []);
});
