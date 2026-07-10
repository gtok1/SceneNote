import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createRecommendationImpressionLookupKeys,
  createRecommendationImpressionRows
} from "./recommendationImpressions.ts";
import type { RecommendationCandidate } from "./recommendationEngine.ts";

describe("recommendation impression rows", () => {
  it("builds one batch row per displayed canonical work", () => {
    const rows = createRecommendationImpressionRows(
      "user-1",
      Array.from({ length: 12 }, (_, index) => candidate(String(index + 1))),
      "2026-07-10T00:00:00.000Z"
    );

    assert.equal(rows.length, 12);
    assert(rows.every((row) => row.user_id === "user-1"));
    assert(rows.every((row) => row.identity_keys.includes(`anilist:${row.source_id}`)));
  });

  it("deduplicates repeated upsert input by canonical content ID", () => {
    const first = candidate("1", { canonical_id: "tmdb:100" });
    const duplicate = candidate("2", { canonical_id: "tmdb:100" });
    const rows = createRecommendationImpressionRows("user-1", [first, duplicate]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.canonical_content_id, "tmdb:100");
    assert.equal(rows[0]?.source_id, "2");
  });

  it("uses compact provider IDs for seen lookups instead of long title identities", () => {
    const keys = createRecommendationImpressionLookupKeys([
      candidate("178789", {
        title_primary: "매우 긴 작품 제목 ".repeat(80),
        title_original: "非常に長い作品名".repeat(80),
        canonical_id: `work:anime:${"long-title".repeat(100)}:2026`
      }),
      candidate("178789")
    ]);

    assert.deepEqual(keys, ["anilist:178789"]);
    assert(keys.every((key) => !key.startsWith("work:")));
  });
});

function candidate(id: string, overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    external_source: "anilist",
    external_id: id,
    content_type: "anime",
    title_primary: `작품 ${id}`,
    air_year: 2026,
    air_date: "2026-07-01",
    ...overrides
  };
}
