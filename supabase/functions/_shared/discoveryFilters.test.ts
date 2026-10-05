import assert from "node:assert/strict";
import test, { it } from "node:test";
import * as discoveryContract from "./discoveryFilters.ts";
import { discoveryFilterKey, matchesDiscoveryFilters, normalizeDiscoveryFilters } from "./discoveryFilters";

test("positive filter defaults, Korean aliases and country casing share a cache identity", () => {
  assert.deepEqual(normalizeDiscoveryFilters(), { genres: [], countries: [], mediaTypes: [] });
  assert.equal(discoveryFilterKey({ genre: " SF ", country: "jp" }), discoveryFilterKey({ genre: "Science Fiction", country: "JP" }));
  assert.notEqual(discoveryFilterKey({ genre: "romance" }), discoveryFilterKey({ genre: "comedy" }));
  assert.notEqual(discoveryFilterKey({ country: "KR" }), discoveryFilterKey({ country: "JP" }));
});

test("genre and production country are an intersection across search and recommendation shapes", () => {
  const filters = { genre: "코미디", country: "KR" };
  assert.equal(matchesDiscoveryFilters({ genres: ["Comedy"], origin_country: ["KR"] }, filters), true);
  assert.equal(matchesDiscoveryFilters({ genres: ["Comedy"], countries: ["JP", "KR"] }, filters), true);
  assert.equal(matchesDiscoveryFilters({ genres: ["Comedy"], countries: ["JP"] }, filters), false);
  assert.equal(matchesDiscoveryFilters({ genres: ["Drama"], countries: ["KR"] }, filters), false);
});

test("selected filters require metadata while all preserves unclassified candidates", () => {
  assert.equal(matchesDiscoveryFilters({}), true);
  assert.equal(matchesDiscoveryFilters({}, { genre: "액션" }), false);
  assert.equal(matchesDiscoveryFilters({}, { country: "US" }), false);
  assert.equal(matchesDiscoveryFilters({ genres: ["Romance"] }, { genre: "unknown genre" }), false);
});

test("provider genre aliases and compound categories match consistently without merging unrelated genres", () => {
  assert.equal(matchesDiscoveryFilters({ genres: ["Action & Adventure"] }, { genre: "액션" }), true);
  assert.equal(matchesDiscoveryFilters({ genres: ["Action & Adventure"] }, { genre: "어드벤처" }), true);
  assert.equal(matchesDiscoveryFilters({ genres: ["Sci-Fi & Fantasy"] }, { genre: "판타지" }), true);
  assert.equal(matchesDiscoveryFilters({ genres: ["Science Fiction"] }, { genre: "SF" }), true);
  assert.equal(matchesDiscoveryFilters({ genres: ["Fantasy"] }, { genre: "SF" }), false);
  assert.equal(matchesDiscoveryFilters({ content_type: "anime", genres: ["Romance"] }, { genre: "애니메이션" }), true);
  assert.equal(matchesDiscoveryFilters({ genres: ["Romance"] }, { genre: "애니메이션" }), false);
});


test("multiselect OR dimensions intersect and explicit arrays replace legacy selections", () => {
  const filters = { genres: ["comedy", "romance"], countries: ["KR", "JP"], mediaTypes: ["drama", "anime"] as const };
  assert.equal(matchesDiscoveryFilters({ genres: ["Comedy"], countries: ["KR"], content_type: "kdrama" }, filters), true);
  assert.equal(matchesDiscoveryFilters({ genres: ["Romance"], countries: ["JP"], content_type: "anime" }, filters), true);
  assert.equal(matchesDiscoveryFilters({ genres: ["Romance"], countries: ["CN"], content_type: "anime" }, filters), false);
  assert.equal(matchesDiscoveryFilters({ genres: ["Drama"], countries: ["JP"], content_type: "anime" }, filters), false);
  assert.equal(matchesDiscoveryFilters({ genres: ["Romance"], countries: ["KR"], content_type: "movie" }, filters), false);
  assert.deepEqual(normalizeDiscoveryFilters({ genres: [], genre: "Romance", countries: [], country: "KR" }), { genres: [], countries: [], mediaTypes: [] });
});

test("canonical multiselect keys ignore order, duplicates, aliases and selection of all three types", () => {
  assert.equal(discoveryFilterKey({ genres: ["SF", "Comedy", "SF"], countries: ["jp", "KR", "JP"], mediaTypes: ["drama", "anime"] }),
    discoveryFilterKey({ genres: ["comedy", "Science Fiction"], countries: ["KR", "JP"], mediaTypes: ["anime", "drama"] }));
  assert.equal(discoveryFilterKey({ mediaTypes: ["movie", "drama", "anime"] }), discoveryFilterKey({ mediaTypes: [] }));
  assert.deepEqual(normalizeDiscoveryFilters({ genres: ["all", "romance"], countries: ["ALL", "JP"] }), { genres: [], countries: [], mediaTypes: [] });
  assert.notEqual(discoveryFilterKey({ mediaTypes: ["movie", "anime"] }), discoveryFilterKey({ mediaTypes: ["anime"] }));
});

test("international TV category and authoritative query evidence support positive filtering without fabricated metadata", () => {
  const movie = { content_type: "movie", genres: ["Drama"], matched_genres: ["romance", "thriller"], matched_countries: ["US", "KR"] };
  assert.equal(matchesDiscoveryFilters(movie, { mediaTypes: ["movie"], genres: ["romance", "thriller"], countries: ["US", "KR"] }), true);
  assert.equal(matchesDiscoveryFilters(movie, { countries: ["JP"] }), false);
  assert.equal(matchesDiscoveryFilters(movie, { countries: ["US"] }), false);
  assert.equal(matchesDiscoveryFilters(movie, { genres: ["romance"] }), false);
  assert.equal(matchesDiscoveryFilters({ content_type: "other", category: "drama", countries: ["US"] }, { mediaTypes: ["drama"] }), true);
  assert.equal(matchesDiscoveryFilters({ content_type: "other", has_seasons: true }, { mediaTypes: ["drama"] }), true);
  assert.equal(matchesDiscoveryFilters({ content_type: "anime", has_seasons: true }, { mediaTypes: ["drama"] }), false);
  assert.equal(matchesDiscoveryFilters({ content_type: "other" }, { mediaTypes: ["drama"] }), false);
});

test("Y-1 year choices normalize and isolate cache identities", () => {
  assert.equal(normalizeDiscoveryFilters({ year: 2025 }).year, 2025);
  for (const year of [null, undefined, 1899, 2101, 2025.5, NaN]) {
    assert.equal(normalizeDiscoveryFilters({ year }).year, undefined);
    assert.equal(discoveryFilterKey({ year }), discoveryFilterKey());
  }
  assert.notEqual(discoveryFilterKey({ year: 2025 }), discoveryFilterKey({ year: 2026 }));
  assert.notEqual(discoveryFilterKey({ year: 2025 }), discoveryFilterKey());
});

test("Y-2 selected year rejects older, newer and unknown years with other filters intersected", () => {
  for (const air_year of [1992, 1981, 2026, null, undefined]) {
    assert.equal(matchesDiscoveryFilters({ air_year }, { year: 2025 }), false);
  }
  assert.equal(matchesDiscoveryFilters({ air_year: 2025, countries: ['JP'] }, { year: 2025, countries: ['JP'] }), true);
  assert.equal(matchesDiscoveryFilters({ air_year: 2025, countries: ['US'] }, { year: 2025, countries: ['JP'] }), false);
  assert.equal(matchesDiscoveryFilters({ air_year: 1981 }), true);
});



it("A-1 applied filters normalize countries and retain year", () => {
  assert.deepEqual(discoveryContract.toAppliedDiscoveryFilters({ countries: ["kr", "JP", "jp"], year: 2025 }), { year: 2025, genres: [], countries: ["JP", "KR"], media_types: [] });
});
it("A-2 applied filter defaults use null year", () => {
  const expected = { year: null, genres: [], countries: [], media_types: [] };
  assert.deepEqual(discoveryContract.toAppliedDiscoveryFilters({}), expected);
  assert.deepEqual(discoveryContract.toAppliedDiscoveryFilters(), expected);
});
it("A-3 applied filters normalize all types, invalid year and Korean genre", () => {
  assert.deepEqual(discoveryContract.toAppliedDiscoveryFilters({ mediaTypes: ["anime", "drama", "movie"], year: 1800, genres: ["드라마"] }), { year: null, genres: ["drama"], countries: [], media_types: [] });
});
it("U-1 legacy server cannot acknowledge requested year", () => {
  assert.equal(discoveryContract.detectUnsupportedDiscoveryFilter({ countries: ["JP", "KR"], year: 2025 }, undefined), "year");
});
it("U-2 legacy server without requested year remains compatible", () => {
  assert.equal(discoveryContract.detectUnsupportedDiscoveryFilter({ countries: ["JP", "KR"] }, undefined), null);
});
it("U-3 matching applied filters are supported", () => {
  assert.equal(discoveryContract.detectUnsupportedDiscoveryFilter({ countries: ["JP", "KR"], year: 2025 }, { year: 2025, genres: [], countries: ["JP", "KR"], media_types: [] }), null);
});
it("U-4 missing applied year is unsupported", () => {
  assert.equal(discoveryContract.detectUnsupportedDiscoveryFilter({ year: 2025 }, { year: null, genres: [], countries: [], media_types: [] }), "year");
});
it("U-5 unapplied requested genre is unsupported", () => {
  assert.equal(discoveryContract.detectUnsupportedDiscoveryFilter({ genres: ["드라마"] }, { year: null, genres: [], countries: [], media_types: [] }), "filters");
});
it("U-6 malformed acknowledgements use the legacy year policy", () => {
  for (const applied of ["garbage", { year: "2025", genres: [], countries: [], media_types: [] }, null, { year: 2025, genres: "drama", countries: [], media_types: [] }]) {
    assert.equal(discoveryContract.detectUnsupportedDiscoveryFilter({ year: 2025 }, applied), "year");
  }
});
it("U-7 equivalent Korean genre and country case are supported", () => {
  assert.equal(discoveryContract.detectUnsupportedDiscoveryFilter({ countries: ["kr"], genres: ["드라마"] }, { year: null, genres: ["drama"], countries: ["KR"], media_types: [] }), null);
});
it("U-8 all-type normalization distinguishes restricted acknowledgement", () => {
  const requested = { mediaTypes: ["anime", "drama", "movie"] as const };
  assert.equal(discoveryContract.detectUnsupportedDiscoveryFilter(requested, { year: null, genres: [], countries: [], media_types: [] }), null);
  assert.equal(discoveryContract.detectUnsupportedDiscoveryFilter(requested, { year: null, genres: [], countries: [], media_types: ["anime"] }), "filters");
});
