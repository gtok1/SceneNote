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

  it("keeps the earlier page's copy when the same work reappears on a later page", () => {
    // The server only enriches a candidate's season/air-date within the top 3 of each
    // page it's returned on. A generic query can legitimately return the same work again
    // deep in a later page, where it lands outside that page's top 3 and comes back
    // un-enriched. The earlier (enriched) copy must win, not whichever page loaded last.
    const enriched = { ...result("218038"), air_year: 2026, air_date: "2026-07-19" };
    const staleDuplicate = { ...result("218038"), air_year: 2023, air_date: "2023-07-16" };

    const merged = mergeSearchPages([
      page(1, [enriched], true),
      page(5, [staleDuplicate], false)
    ]);

    assert.deepEqual(
      merged.find((item) => item.external_id === "218038"),
      enriched
    );
  });
});
