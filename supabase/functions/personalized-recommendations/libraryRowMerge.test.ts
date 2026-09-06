import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeLibraryRowsByContent } from "./libraryRowMerge.ts";

describe("mergeLibraryRowsByContent", () => {
  it("merges a whole-work row and a season row for the same content into one entry", () => {
    // VIVANT: a whole-work row (completed, watch_count 1) plus a season-2 row
    // (wishlist, watch_count 0) — without this, buildPreferenceProfile would count the
    // show's genres twice, once per row. See docs/17_season_library_tracking_spec.md 10장.
    const merged = mergeLibraryRowsByContent([
      { content_id: "vivant", status: "completed", status_flags: ["completed"], watch_count: 1 },
      { content_id: "vivant", status: "wishlist", status_flags: ["wishlist"], watch_count: 0 }
    ]);

    assert.equal(merged.length, 1);
    assert.deepEqual(new Set(merged[0]?.status_flags), new Set(["completed", "wishlist"]));
    assert.equal(merged[0]?.watch_count, 1);
  });

  it("keeps unrelated content ids separate", () => {
    const merged = mergeLibraryRowsByContent([
      { content_id: "a", status: "completed", status_flags: ["completed"], watch_count: 1 },
      { content_id: "b", status: "wishlist", status_flags: ["wishlist"], watch_count: 0 }
    ]);
    assert.equal(merged.length, 2);
  });

  it("leaves a single row for a content id untouched", () => {
    const row = { content_id: "a", status: "completed", status_flags: ["completed"], watch_count: 3 };
    assert.deepEqual(mergeLibraryRowsByContent([row]), [row]);
  });

  it("takes the highest watch_count across merged rows rather than summing them", () => {
    // Summing would let registering more seasons inflate the show's watch_count.
    const merged = mergeLibraryRowsByContent([
      { content_id: "a", status: "completed", status_flags: ["completed"], watch_count: 3 },
      { content_id: "a", status: "completed", status_flags: ["completed"], watch_count: 5 }
    ]);
    assert.equal(merged[0]?.watch_count, 5);
  });

  it("carries the content relation through from whichever row has it", () => {
    const contents = { id: "a", content_type: "kdrama" };
    const merged = mergeLibraryRowsByContent([
      { content_id: "a", status: "completed", status_flags: ["completed"], watch_count: 1, contents },
      { content_id: "a", status: "wishlist", status_flags: ["wishlist"], watch_count: 0 }
    ]);
    assert.equal(merged[0]?.contents, contents);
  });
});
