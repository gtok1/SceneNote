import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LibraryListItem } from "@/types/library";
import { matchLibraryItemForSeason, resolveContentLibraryItem } from "./seasonLibraryMatch";

const item = (seasonNumber: number | null, id: string): LibraryListItem =>
  ({ library_item_id: id, season_number: seasonNumber, watch_count: 1 } as unknown as LibraryListItem);

const row = (contentId: string, seasonNumber: number | null, id: string): LibraryListItem =>
  ({ library_item_id: id, content_id: contentId, season_number: seasonNumber, watch_count: 1 } as unknown as LibraryListItem);

describe("matchLibraryItemForSeason", () => {
  it("matches the row registered for that exact season", () => {
    const match = matchLibraryItemForSeason([item(2, "s2"), item(null, "whole")], 2);
    assert.equal(match.kind, "season");
    assert.equal(match.kind === "season" ? match.item.library_item_id : null, "s2");
  });

  it("does not treat another season's row as this season's", () => {
    assert.equal(matchLibraryItemForSeason([item(2, "s2")], 1).kind, "none");
  });

  it("reports a whole-work row separately instead of claiming the season is registered", () => {
    // Pre-existing rows are all season_number NULL; they must not masquerade as season 2.
    const match = matchLibraryItemForSeason([item(null, "whole")], 2);
    assert.equal(match.kind, "whole-work");
    assert.equal(match.kind === "whole-work" ? match.item.library_item_id : null, "whole");
  });

  it("prefers the exact season row over the whole-work row", () => {
    const match = matchLibraryItemForSeason([item(null, "whole"), item(2, "s2")], 2);
    assert.equal(match.kind, "season");
  });

  it("matches the whole-work row when the card itself is not season specific", () => {
    assert.equal(matchLibraryItemForSeason([item(null, "whole")], null).kind, "whole-work");
  });

  it("returns none when nothing is registered", () => {
    assert.equal(matchLibraryItemForSeason([], 2).kind, "none");
  });
});

describe("resolveContentLibraryItem", () => {
  it("T-4 prefers the explicit library item", () => {
    const match = resolveContentLibraryItem([row("c1", 2, "a"), row("c1", 3, "b")],
      { contentId: "c1", libraryItemId: "b" });
    assert.equal(match.kind, "library-item");
    assert.equal(match.kind === "library-item" ? match.item.library_item_id : null, "b");
  });

  it("T-5 falls through when the library item id is stale", () => {
    const match = resolveContentLibraryItem([row("c1", 2, "a")],
      { contentId: "c1", libraryItemId: "zzz" });
    assert.equal(match.kind, "other-season");
    assert.equal(match.kind === "other-season" ? match.item.library_item_id : null, "a");
  });

  it("T-6 matches an explicitly requested season", () => {
    const match = resolveContentLibraryItem([row("c1", 2, "a"), row("c1", 3, "b")],
      { contentId: "c1", seasonNumber: 3 });
    assert.equal(match.kind, "season");
    assert.equal(match.kind === "season" ? match.item.library_item_id : null, "b");
  });

  it("T-7 does not substitute a whole-work row for a requested season", () => {
    assert.equal(resolveContentLibraryItem([row("c1", null, "a")],
      { contentId: "c1", seasonNumber: 2 }).kind, "none");
  });

  it("T-8 does not substitute another season for a requested season", () => {
    assert.equal(resolveContentLibraryItem([row("c1", 1, "a")],
      { contentId: "c1", seasonNumber: 2 }).kind, "none");
  });

  it("T-9 prefers a whole-work row when no season is requested", () => {
    const match = resolveContentLibraryItem([row("c1", null, "a"), row("c1", 2, "b")],
      { contentId: "c1" });
    assert.equal(match.kind, "whole-work");
    assert.equal(match.kind === "whole-work" ? match.item.library_item_id : null, "a");
  });

  it("T-10 chooses the smallest season when only season rows exist", () => {
    const match = resolveContentLibraryItem([row("c1", 3, "a"), row("c1", 2, "b")],
      { contentId: "c1" });
    assert.equal(match.kind, "other-season");
    assert.equal(match.kind === "other-season" ? match.item.library_item_id : null, "b");
  });

  it("T-11 ignores rows for another content id", () => {
    assert.equal(resolveContentLibraryItem([row("c2", 2, "a")], { contentId: "c1" }).kind, "none");
  });

  it("T-12 returns none for an empty library", () => {
    assert.equal(resolveContentLibraryItem([], { contentId: "c1" }).kind, "none");
  });

  it("T-13 treats an explicit null season as unspecified", () => {
    assert.equal(resolveContentLibraryItem([row("c1", null, "a")],
      { contentId: "c1", seasonNumber: null }).kind, "whole-work");
  });

  it("T-14 treats NaN as an unspecified season", () => {
    assert.equal(resolveContentLibraryItem([row("c1", 2, "a")],
      { contentId: "c1", seasonNumber: Number.NaN }).kind, "other-season");
  });
});
