import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterExcludedRecommendations, isExcludedRecommendation, normalizeRecommendationGenre } from "./excludedThemes";

const relationshipExclusions = {
  excludedThemeKeys: ["boys-love", "girls-love", "queer-romance"],
  excludedGenres: []
};

describe("client recommendation theme filter", () => {
  it("T-20 keeps eligible recommendations in their original order", () => {
    const first = { external_source: "tmdb", genres: ["Drama"], keywords: ["family"] };
    const excluded = { external_source: "anilist", genres: ["Boys' Love"] };
    const last = { external_source: "tmdb", genres: ["Romance"], keywords: ["office"] };
    assert.deepEqual(filterExcludedRecommendations([first, excluded, last], relationshipExclusions), [first, last]);
  });

  it("matches T-1 for an existing relationship theme", () => {
    assert.equal(isExcludedRecommendation({ themes: [{ family: "relationship", key: "boys-love" }] }, relationshipExclusions), true);
  });

  it("matches T-4 for a provider keyword", () => {
    assert.equal(isExcludedRecommendation({ keywords: ["lgbt"] }, relationshipExclusions), true);
  });

  it("matches T-11 for an unrelated keyword", () => {
    assert.equal(isExcludedRecommendation({ keywords: ["gaya"] }, relationshipExclusions), false);
  });

  it("matches T-14 for missing theme metadata", () => {
    assert.equal(isExcludedRecommendation({}, relationshipExclusions), false);
  });

  it("keeps one account's exclusions away from another account", () => {
    const bl = { external_source: "anilist", genres: ["Boys' Love"] };
    assert.equal(isExcludedRecommendation(bl, relationshipExclusions), true);
    assert.equal(isExcludedRecommendation(bl, { excludedThemeKeys: [], excludedGenres: [] }), false);
  });

  it("matches selected genres exactly after normalizing case and spaces", () => {
    assert.equal(normalizeRecommendationGenre("  Ｒｏｍａｎｃｅ  "), "romance");
    assert.equal(isExcludedRecommendation({ genres: ["Romance"] }, { excludedThemeKeys: [], excludedGenres: ["romance"] }), true);
    assert.equal(isExcludedRecommendation({ genres: ["Romance Comedy"] }, { excludedThemeKeys: [], excludedGenres: ["romance"] }), false);
  });

  it("hides unclassified TMDB candidates when relationship themes are excluded", () => {
    assert.equal(isExcludedRecommendation({ external_source: "tmdb", genres: ["Drama"] }, relationshipExclusions), true);
    assert.equal(isExcludedRecommendation({ external_source: "tmdb", genres: ["Drama"], keywords: [] }, relationshipExclusions), true);
    assert.equal(isExcludedRecommendation({ external_source: "tmdb", genres: ["Drama"], keywords: ["office"] }, relationshipExclusions), false);
    assert.equal(isExcludedRecommendation({ external_source: "tmdb", genres: ["Drama"] }, { excludedThemeKeys: [], excludedGenres: [] }), false);
  });
});
