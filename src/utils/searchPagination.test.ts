import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SearchContentResponse, SearchResult } from "@/types/content";
import { mergeSearchPages } from "./searchPagination";

const result = (id: string): SearchResult => ({
  external_source: "tmdb",
  external_id: id,
  content_type: "movie",
  title_primary: id,
  title_original: null,
  poster_url: null,
  overview: null,
  air_year: null,
  has_seasons: false,
  episode_count: null
});

const page = (pageNumber: number, results: SearchResult[], hasNextPage: boolean): SearchContentResponse => ({
  results,
  sources: ["tmdb"],
  failedSources: [],
  cached: false,
  query: "test",
  normalizedQuery: "test",
  total: results.length,
  page: pageNumber,
  hasNextPage,
  partial: false
});

describe("search pagination", () => {
  it("appends pages without duplicating repeated provider IDs", () => {
    assert.deepEqual(
      mergeSearchPages([page(1, [result("1"), result("2")], true), page(2, [result("2"), result("3")], false)])
        .map((item) => item.external_id),
      ["1", "2", "3"]
    );
  });
});
