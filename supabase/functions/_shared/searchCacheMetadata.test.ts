import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeSearchCachePayload } from "./searchCacheMetadata.ts";

describe("search cache metadata", () => {
  it("preserves total and hasNextPage on a cache hit", () => {
    assert.deepEqual(
      normalizeSearchCachePayload({ results: ["a"], total: 42, hasNextPage: true }),
      { results: ["a"], total: 42, hasNextPage: true }
    );
  });

  it("keeps legacy result-only cache rows safe", () => {
    assert.deepEqual(normalizeSearchCachePayload({ results: ["a", "b"] }), {
      results: ["a", "b"], total: 2, hasNextPage: false
    });
  });
});
