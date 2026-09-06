import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_SEARCH_HISTORY_ENTRIES, addSearchHistoryEntry, removeSearchHistoryEntry } from "./searchHistory";

describe("addSearchHistoryEntry", () => {
  it("adds a trimmed query to the front", () => {
    assert.deepEqual(addSearchHistoryEntry([], "  vivant  "), ["vivant"]);
  });

  it("ignores blank queries", () => {
    assert.deepEqual(addSearchHistoryEntry(["a"], "   "), ["a"]);
    assert.deepEqual(addSearchHistoryEntry([], ""), []);
  });

  it("moves a re-searched query to the front instead of duplicating it", () => {
    assert.deepEqual(addSearchHistoryEntry(["a", "b", "c"], "b"), ["b", "a", "c"]);
  });

  it("de-duplicates case-insensitively but records the newly typed casing", () => {
    assert.deepEqual(addSearchHistoryEntry(["Vivant"], "vivant"), ["vivant"]);
  });

  it("caps the list at the configured maximum, dropping the oldest", () => {
    const full = Array.from({ length: MAX_SEARCH_HISTORY_ENTRIES }, (_, i) => `q${i}`);
    const result = addSearchHistoryEntry(full, "new");
    assert.equal(result.length, MAX_SEARCH_HISTORY_ENTRIES);
    assert.equal(result[0], "new");
    assert.equal(result.includes(`q${MAX_SEARCH_HISTORY_ENTRIES - 1}`), false);
  });
});

describe("removeSearchHistoryEntry", () => {
  it("removes a matching entry case-insensitively", () => {
    assert.deepEqual(removeSearchHistoryEntry(["Vivant", "b"], "vivant"), ["b"]);
  });

  it("leaves the list unchanged when nothing matches", () => {
    assert.deepEqual(removeSearchHistoryEntry(["a"], "z"), ["a"]);
  });
});
