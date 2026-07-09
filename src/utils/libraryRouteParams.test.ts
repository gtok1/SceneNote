import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createLibraryRouteParams, parseLibraryRouteParams } from "./libraryRouteParams";

describe("library route params", () => {
  it("round-trips library filters through URL params", () => {
    const params = createLibraryRouteParams(
      {
        statusFilter: "completed",
        contentTypeFilter: "kdrama",
        genreFilter: "Romance",
        ratingFilter: 7,
        searchQuery: "  채원  ",
        year: "2026",
        sortOrder: "oldest"
      },
      "gallery"
    );

    assert.deepEqual(params, {
      status: "completed",
      libraryType: "kdrama",
      genre: "Romance",
      rating: "7",
      q: "채원",
      year: "2026",
      sort: "oldest",
      view: "gallery"
    });
    assert.deepEqual(parseLibraryRouteParams(params), {
      statusFilter: "completed",
      contentTypeFilter: "kdrama",
      genreFilter: "Romance",
      ratingFilter: 7,
      searchQuery: "채원",
      year: "2026",
      sortOrder: "oldest",
      viewMode: "gallery"
    });
  });

  it("falls back to defaults for invalid params", () => {
    assert.deepEqual(
      parseLibraryRouteParams({
        status: "watched",
        libraryType: "series",
        rating: "11",
        year: "26",
        sort: "random",
        view: "table"
      }),
      {
        statusFilter: "all",
        contentTypeFilter: "all",
        genreFilter: "all",
        ratingFilter: "all",
        searchQuery: "",
        year: "",
        sortOrder: "latest"
      }
    );
  });
});
