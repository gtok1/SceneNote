import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LibraryListItem } from "@/types/library";
import { matchLibraryItemForSeason } from "./seasonLibraryMatch";

const item = (seasonNumber: number | null, id: string): LibraryListItem =>
  ({ library_item_id: id, season_number: seasonNumber, watch_count: 1 } as unknown as LibraryListItem);

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
