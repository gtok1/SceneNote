import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterRecommendationsForUser,
  isRecommendationExcludedForUser,
  normalizeRecommendationGenre,
  userRecommendationFiltersFromFeedback
} from "./recommendationUserFilters.ts";

describe("per-user recommendation exclusions", () => {
  const feedback = [
    { target_type: "theme", target_key: "relationship:boys-love", action: "exclude" },
    { target_type: "theme", target_key: "relationship:girls-love", action: "less" },
    { target_type: "theme", target_key: "narrative:revenge", action: "exclude" },
    { target_type: "genre", target_key: "  RoMance  ", action: "exclude" },
    { target_type: "content", target_key: "tmdb:123", action: "exclude" }
  ];
  const filters = userRecommendationFiltersFromFeedback(feedback);

  it("reads only the signed-in user's persisted hard-exclusion rows", () => {
    assert.deepEqual(filters, { excludedThemeKeys: ["boys-love"], excludedGenres: ["romance"] });
    assert.deepEqual(userRecommendationFiltersFromFeedback([]), {
      excludedThemeKeys: [], excludedGenres: []
    });
  });

  it("normalizes genres exactly without substring matching", () => {
    assert.equal(normalizeRecommendationGenre("  SCI-FI   &  FANTASY  "), "sci-fi & fantasy");
    assert.equal(isRecommendationExcludedForUser({ genres: ["Romance"] }, filters), true);
    assert.equal(isRecommendationExcludedForUser({ genres: ["Romance Comedy"] }, filters), false);
  });

  it("excludes provider-classified relationship themes for this user", () => {
    assert.equal(isRecommendationExcludedForUser({ keywords: ["boy's love"] }, filters), true);
    assert.equal(isRecommendationExcludedForUser({ keywords: ["lesbian"] }, filters), false);
  });

  it("hides unclassifiable TMDB rows when relationship exclusions are active", () => {
    assert.equal(isRecommendationExcludedForUser({ external_source: "tmdb", genres: ["Drama"] }, filters), true);
    assert.equal(isRecommendationExcludedForUser({ external_source: "tmdb", keywords: ["family"] }, filters), false);
    assert.equal(isRecommendationExcludedForUser({ external_source: "anilist", genres: ["Drama"] }, filters), false);
    assert.equal(isRecommendationExcludedForUser({ external_source: "tmdb" }, userRecommendationFiltersFromFeedback([])), false);
  });

  it("filters shared candidates independently for two users without mutating the cache", () => {
    const shared = [
      { external_source: "tmdb", keywords: ["gay"], genres: ["Drama"] },
      { external_source: "tmdb", keywords: ["family"], genres: ["Drama"] }
    ];
    const optedOut = userRecommendationFiltersFromFeedback([
      { target_type: "theme", target_key: "relationship:queer-romance", action: "exclude" }
    ]);
    assert.deepEqual(filterRecommendationsForUser(shared, optedOut), [shared[1]]);
    assert.deepEqual(filterRecommendationsForUser(shared, userRecommendationFiltersFromFeedback([])), shared);
    assert.equal(shared.length, 2);
  });
});
