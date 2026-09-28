import assert from "node:assert/strict";
import { it } from "node:test";

import type { SearchResult } from "../types/content";
import { partitionSearchResults } from "./searchResultVisibility";

const row = (external_id: string, overrides: Partial<SearchResult> = {}): SearchResult => ({
  external_source: "tmdb", external_id, content_type: "kdrama", title_primary: external_id,
  title_original: null, poster_url: null, overview: null, air_year: 2024,
  has_seasons: true, episode_count: null, ...overrides
});
const input = { discoveryFilters: {}, statusFilter: "all" as const, year: null, libraryItems: [] };
const ids = (rows: readonly SearchResult[]) => rows.map(item => item.external_id);

it("V-1 shows all three results without filters", () => {
  const result = partitionSearchResults([row("1"), row("2"), row("3")], input);
  assert.deepEqual(ids(result.visible), ["1", "2", "3"]);
  assert.equal(result.hidden.length, 0);
});

it("V-2 hides one server-marked filter mismatch", () => {
  const result = partitionSearchResults([row("1"), row("2", { filter_match: false })], input);
  assert.deepEqual(ids(result.hidden), ["2"]);
  assert.equal(result.hiddenByReason.filters, 1);
});

it("V-3 hides movies under a drama media filter", () => {
  const result = partitionSearchResults([row("1", { content_type: "movie" }), row("2")], {
    ...input, discoveryFilters: { mediaTypes: ["drama"] }
  });
  assert.deepEqual(ids(result.visible), ["2"]);
  assert.deepEqual(ids(result.hidden), ["1"]);
});

it("V-4 keeps only matching library status", () => {
  const result = partitionSearchResults([row("1"), row("2")], {
    ...input, statusFilter: "watching", libraryItems: [{ source_api: "tmdb", source_id: "1", statuses: ["watching"] }]
  });
  assert.deepEqual(ids(result.visible), ["1"]);
  assert.equal(result.hiddenByReason.status, 1);
});

it("V-5 hides other and unknown years", () => {
  const result = partitionSearchResults([row("1"), row("2", { air_year: 2019 }), row("3", { air_year: null })], { ...input, year: 2024 });
  assert.deepEqual(ids(result.visible), ["1"]);
  assert.deepEqual(ids(result.hidden), ["2", "3"]);
  assert.equal(result.hiddenByReason.year, 2);
});

it("V-6 counts the first hiding reason only", () => {
  const result = partitionSearchResults([row("1", { filter_match: false, air_year: 2019 })], { ...input, year: 2024 });
  assert.deepEqual(result.hiddenByReason, { filters: 1, status: 0, year: 0 });
});

it("V-7 preserves input order in both partitions", () => {
  const result = partitionSearchResults([row("1"), row("2", { filter_match: false }), row("3"), row("4", { filter_match: false })], input);
  assert.deepEqual(ids(result.visible), ["1", "3"]);
  assert.deepEqual(ids(result.hidden), ["2", "4"]);
});

it("V-8 treats a series with content type other as drama", () => {
  const result = partitionSearchResults([row("1", { content_type: "other", has_seasons: true })], {
    ...input, discoveryFilters: { mediaTypes: ["drama"] }
  });
  assert.deepEqual(ids(result.visible), ["1"]);
});
