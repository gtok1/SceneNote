import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LibraryListItem } from "@/types/library";
import { createLibraryWatchStateLabel } from "./contentMetaDisplay";

const item = (watchCount: number): LibraryListItem =>
  ({ watch_count: watchCount } as unknown as LibraryListItem);

describe("createLibraryWatchStateLabel", () => {
  it("shows the watch count for the season that is actually registered", () => {
    assert.equal(createLibraryWatchStateLabel({ kind: "season", item: item(2) }), "시청 2회");
  });

  it("says the whole work is registered rather than claiming this season is", () => {
    // Every row created before migration 0021 is a whole-work row. Reusing its watch
    // count on a season card would falsely claim that season has been watched.
    assert.equal(
      createLibraryWatchStateLabel({ kind: "whole-work", item: item(1) }),
      "작품 전체로 등록됨"
    );
  });

  it("shows nothing when the work is not registered at all", () => {
    assert.equal(createLibraryWatchStateLabel({ kind: "none" }), null);
  });
});
