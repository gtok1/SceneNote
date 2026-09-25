import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LibraryListItem, WatchStatus } from "@/types/library";
import { getSearchResultActions } from "./searchResultActions";

const row = (season: number | null, status: WatchStatus): LibraryListItem => ({
  library_item_id: "item-1", season_number: season, status, statuses: [status], watch_count: status === "completed" ? 1 : 0
} as LibraryListItem);

describe("search result library actions", () => {
  it("allows both actions for a work that is not registered", () => {
    assert.deepEqual(getSearchResultActions(null, [], null, false), {
      libraryItem: null, wishlistDisabled: false, completedDisabled: false
    });
  });

  it("disables both actions for a wishlisted work", () => {
    const actions = getSearchResultActions(null, [row(null, "wishlist")], null, false);
    assert.equal(actions.wishlistDisabled, true);
    assert.equal(actions.completedDisabled, true);
    assert.equal(actions.libraryItem?.library_item_id, "item-1");
  });

  it("disables both actions for an already completed work", () => {
    const actions = getSearchResultActions(null, [row(null, "completed")], null, false);
    assert.equal(actions.wishlistDisabled, true);
    assert.equal(actions.completedDisabled, true);
  });

  it("does not claim a whole-work row belongs to a specific season", () => {
    const actions = getSearchResultActions(2, [row(null, "completed")], null, false);
    assert.equal(actions.wishlistDisabled, false);
    assert.equal(actions.completedDisabled, false);
  });

  it("disables both actions when an unnumbered work has an existing season row", () => {
    const actions = getSearchResultActions(null, [row(2, "wishlist")], null, false);
    assert.equal(actions.wishlistDisabled, true);
    assert.equal(actions.completedDisabled, true);
    assert.equal(actions.libraryItem?.season_number, 2);
  });

  it("holds both actions during a save and honors the most recent successful status", () => {
    const busy = getSearchResultActions(null, [], null, true);
    assert.equal(busy.wishlistDisabled, true);
    assert.equal(busy.completedDisabled, true);
    const completed = getSearchResultActions(null, [], "completed", false);
    assert.equal(completed.wishlistDisabled, true);
    assert.equal(completed.completedDisabled, true);
  });
});
