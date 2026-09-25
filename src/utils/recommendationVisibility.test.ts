import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { countVisibleRecommendationCandidates, filterVisibleRecommendationCandidates, isRegisteredRecommendation, summarizeRecommendationVisibility } from "./recommendationVisibility";

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
});
