import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRecommendationPreferenceKey,
  parseRecommendationExclusions,
  recommendationExclusionTargetKey,
  updateRecommendationExclusions
} from "./recommendationPreferences";

test("preference keys use the same NFKC, case, and whitespace normalization as recommendation genres", () => {
  assert.equal(normalizeRecommendationPreferenceKey("  ＲＯＭＡＮＣＥ   Drama  "), "romance drama");
  assert.equal(recommendationExclusionTargetKey("genre", "  ＲＯＭＡＮＣＥ  "), "romance");
  assert.equal(recommendationExclusionTargetKey("theme", " Boys-Love "), "relationship:boys-love");
});

test("only relationship themes and genre exclusions are represented in preference state", () => {
  assert.deepEqual(
    parseRecommendationExclusions([
      { target_type: "theme", target_key: "relationship:boys-love" },
      { target_type: "theme", target_key: "RELATIONSHIP:BOYS-LOVE" },
      { target_type: "theme", target_key: "narrative:time-travel" },
      { target_type: "genre", target_key: "  ＲＯＭＡＮＣＥ " },
      { target_type: "content", target_key: "tmdb:10" }
    ]),
    { excludedThemeKeys: ["boys-love"], excludedGenres: ["romance"] }
  );
});

test("updating one exclusion preserves the other account setting categories", () => {
  const current = { excludedThemeKeys: ["boys-love"], excludedGenres: ["romance"] };
  assert.deepEqual(updateRecommendationExclusions(current, "theme", "girls-love", true), {
    excludedThemeKeys: ["boys-love", "girls-love"],
    excludedGenres: ["romance"]
  });
  assert.deepEqual(updateRecommendationExclusions(current, "genre", " ROMANCE ", false), {
    excludedThemeKeys: ["boys-love"],
    excludedGenres: []
  });
});
