import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aniListExcludedFilters,
  recommendationProviderFilterKey,
  tmdbExcludedGenreIds,
  tmdbExcludedKeywordIds
} from "./recommendationProviderFilters.ts";

describe("upstream recommendation exclusions", () => {
  it("uses exact TMDB genre names and verified relationship keyword IDs", () => {
    const filters = { excludedGenres: ["  ROMANCE  ", "action", "unknown"], excludedThemeKeys: ["boys-love", "girls-love", "queer-romance"] };
    assert.deepEqual(tmdbExcludedGenreIds(filters), [28, 10749]);
    assert.deepEqual(tmdbExcludedKeywordIds(filters), [280003, 289844]);
    assert.deepEqual(tmdbExcludedKeywordIds({ excludedGenres: [], excludedThemeKeys: ["queer-romance"] }), []);
  });

  it("maps AniList genres and each selected relationship theme without inventing broad genres", () => {
    assert.deepEqual(aniListExcludedFilters({
      excludedGenres: ["comedy", "romance", "action & adventure"],
      excludedThemeKeys: ["boys-love", "girls-love", "queer-romance"]
    }), { genres: ["Comedy", "Romance"], tags: ["Boys' Love", "LGBTQ+ Themes", "Yuri"] });
    assert.deepEqual(aniListExcludedFilters({ excludedGenres: [], excludedThemeKeys: ["girls-love"] }), {
      genres: [], tags: ["Yuri"]
    });
  });

  it("leaves an unfiltered account unrestricted", () => {
    assert.deepEqual(tmdbExcludedGenreIds(), []);
    assert.deepEqual(tmdbExcludedKeywordIds(), []);
    assert.deepEqual(aniListExcludedFilters(), { genres: [], tags: [] });
  });

  it("shares equivalent filter cache keys and separates different account settings", () => {
    const a = recommendationProviderFilterKey({ excludedGenres: ["Romance", "drama"], excludedThemeKeys: ["boys-love", "girls-love"] });
    const b = recommendationProviderFilterKey({ excludedGenres: ["drama", "romance", "drama"], excludedThemeKeys: ["girls-love", "boys-love", "boys-love"] });
    assert.equal(a, b);
    assert.notEqual(a, recommendationProviderFilterKey());
    assert.notEqual(a, recommendationProviderFilterKey({ excludedGenres: ["drama"], excludedThemeKeys: ["boys-love"] }));
  });
});

describe("positive provider selection", () => {
  it("maps compound TV genres and equivalent science-fiction labels without using movie-only IDs", async () => {
    const { tmdbIncludedGenreId, aniListIncludedGenre } = await import("./recommendationProviderFilters.ts");
    assert.equal(tmdbIncludedGenreId("action", "tv"), 10759);
    assert.equal(tmdbIncludedGenreId("adventure", "tv"), 10759);
    assert.equal(tmdbIncludedGenreId("sci-fi", "tv"), 10765);
    assert.equal(tmdbIncludedGenreId("sci-fi", "movie"), 878);
    assert.equal(tmdbIncludedGenreId("romance", "tv"), null);
    assert.equal(tmdbIncludedGenreId("romance", "movie"), 10749);
    assert.equal(aniListIncludedGenre("Science Fiction"), "Sci-Fi");
    assert.equal(aniListIncludedGenre("animation"), undefined);
  });

  it("skips incompatible and explicitly excluded choices without broad requests", async () => {
    const { canFetchRecommendationProvider } = await import("./recommendationProviderFilters.ts");
    assert.equal(canFetchRecommendationProvider("tmdb_jp", { genre: "crime", country: "US" }), false);
    assert.equal(canFetchRecommendationProvider("tmdb_kr", { genre: "crime", country: "US" }), true);
    assert.equal(canFetchRecommendationProvider("tmdb_kr", { genre: "romance", country: "KR" }), true);
    assert.equal(canFetchRecommendationProvider("anilist", { genre: "crime", country: "all" }), false);
    assert.equal(canFetchRecommendationProvider("tmdb_kr", { genre: "animation", country: "all" }), false);
    assert.equal(canFetchRecommendationProvider("tmdb_kr", { genre: "romance", country: "KR" }, {
      excludedGenres: ["Romance"], excludedThemeKeys: []
    }), false);
  });
});
