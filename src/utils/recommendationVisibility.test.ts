import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
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
