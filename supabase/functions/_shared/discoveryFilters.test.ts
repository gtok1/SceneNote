import assert from "node:assert/strict";
import test from "node:test";
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
