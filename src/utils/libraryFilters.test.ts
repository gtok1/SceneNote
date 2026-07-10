import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LibraryListItem } from "@/types/library";

import {
  filterLibraryItems,
  parseGenreFilters,
  serializeGenreFilters,
  type LibraryFilterState
} from "./libraryFilters";

const baseFilters: LibraryFilterState = {
  statusFilter: "all",
  contentTypeFilter: "all",
  genreFilter: "all",
  ratingFilter: "all",
  searchQuery: "",
  year: "",
  sortOrder: "latest"
};

describe("library filters", () => {
  it("serializes multiple genres for URL-safe filter state", () => {
    const serialized = serializeGenreFilters(["드라마", "코미디", "드라마"]);
    assert.equal(serialized, "드라마|코미디");
    assert.deepEqual(parseGenreFilters(serialized), ["드라마", "코미디"]);
    assert.deepEqual(parseGenreFilters("all"), []);
  });

  it("matches any selected genre", () => {
    const result = filterLibraryItems(
      [item("drama", "kdrama", ["드라마"]), item("action", "anime", ["액션"])],
      { ...baseFilters, genreFilter: serializeGenreFilters(["코미디", "액션"]) }
    );
    assert.deepEqual(result.map((entry) => entry.content_id), ["action"]);
  });

  it("separates overseas dramas from other content without changing the DB content type", () => {
    const items = [item("foreign", "other", ["Drama"]), item("documentary", "other", ["다큐멘터리"])];
    const foreign = filterLibraryItems(items, { ...baseFilters, contentTypeFilter: "foreign_drama" });
    const other = filterLibraryItems(items, { ...baseFilters, contentTypeFilter: "other" });
    assert.deepEqual(foreign.map((entry) => entry.content_id), ["foreign"]);
    assert.deepEqual(other.map((entry) => entry.content_id), ["documentary"]);
  });
});

function item(contentId: string, contentType: LibraryListItem["content_type"], genres: string[]): LibraryListItem {
  return {
    library_item_id: `library-${contentId}`,
    status: "wishlist",
    statuses: ["wishlist"],
    added_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    first_watched_at: null,
    last_watched_at: null,
    content_id: contentId,
    title_primary: contentId,
    title_original: null,
    poster_url: null,
    content_type: contentType,
    source_api: "tmdb",
    source_id: contentId,
    air_year: 2026,
    air_date: "2026-01-01",
    end_date: null,
    cast: [],
    rating: null,
    one_line_review: null,
    episode_count: null,
    watched_episode_count: 0,
    next_episode_number: null,
    genres,
    watch_count: 0
  };
}
