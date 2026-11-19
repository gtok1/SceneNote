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

const misclassifiedRows = [
  row("korean", { title_primary: "한국 드라마", title_original: "한국 드라마", genres: ["Drama"], origin_country: ["KR"] }),
  row("gas", { title_primary: "가스인간", title_original: "ガス人間", genres: ["Sci-Fi & Fantasy", "범죄"], origin_country: ["JP", "KR"] }),
  row("romantic", { title_primary: "로맨틱 어나니머스", title_original: "匿名の恋人たち", genres: ["Drama", "Comedy"], origin_country: ["JP", "KR"] }),
  row("younger", { title_primary: "K-연하남 주의보", title_original: "韓ドラみたいな彼と私", genres: ["Drama"], origin_country: ["JP", "KR"] }),
  row("variety", { title_primary: "예능", genres: ["Reality", "Comedy"], origin_country: ["KR"] })
];

it("V-new Korean drama filtering hides old-server Japanese dramas and variety as filter mismatches", () => {
  const result = partitionSearchResults(misclassifiedRows, {
    ...input, discoveryFilters: { mediaTypes: ["drama"], countries: ["KR"] }
  });
  assert.deepEqual(ids(result.visible), ["korean"]);
  assert.deepEqual(ids(result.hidden), ["gas", "romantic", "younger", "variety"]);
  assert.deepEqual(result.hiddenByReason, { filters: 4, status: 0, year: 0 });
});

it("V-new Japanese drama filtering keeps the three coproductions and no filters preserve all results", () => {
  const japanese = partitionSearchResults(misclassifiedRows, {
    ...input, discoveryFilters: { mediaTypes: ["drama"], countries: ["JP"] }
  });
  assert.deepEqual(ids(japanese.visible), ["gas", "romantic", "younger"]);
  assert.deepEqual(ids(japanese.hidden), ["korean", "variety"]);
  const all = partitionSearchResults(misclassifiedRows, input);
  assert.deepEqual(all.visible, misclassifiedRows);
  assert.deepEqual(all.hidden, []);
});

it("V-new corrected drama filtering preserves status, year and first-hidden-reason precedence", () => {
  const gas = misclassifiedRows[1]!;
  const rows = [gas, row("old", { ...gas, external_id: "old", air_year: 2019 }),
    row("unregistered", { ...gas, external_id: "unregistered" }), misclassifiedRows[0]!];
  const result = partitionSearchResults(rows, {
    ...input, discoveryFilters: { mediaTypes: ["drama"], countries: ["JP"] }, statusFilter: "watching", year: 2024,
    libraryItems: [{ source_api: "tmdb", source_id: "gas", statuses: ["watching"] },
      { source_api: "tmdb", source_id: "old", statuses: ["watching"] }]
  });
  assert.deepEqual(ids(result.visible), ["gas"]);
  assert.deepEqual(ids(result.hidden), ["old", "unregistered", "korean"]);
  assert.deepEqual(result.hiddenByReason, { filters: 1, status: 1, year: 1 });
});
