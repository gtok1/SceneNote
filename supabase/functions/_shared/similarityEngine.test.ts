import assert from "node:assert/strict";
import test from "node:test";
import { buildSimilarityReason, rankSimilarWorks, scoreWork, type SimilarityWork } from "./similarityEngine";

const anchor: SimilarityWork = { external_source:"anilist", external_id:"1", content_type:"anime", title_primary:"기준", title_original:null, poster_url:null, overview:"디스토피아 세계에서 초능력으로 조직과 싸우는 청춘", air_year:2011, has_seasons:true, episode_count:22, genres:["Action","Romance"], tags:["Dystopian","Super Power"] };
const candidate: SimilarityWork = { ...anchor, external_id:"2", title_primary:"후보", overview:"디스토피아 조직에 맞서 초능력으로 싸운다", provider_recommended:true };

test("available signals are re-normalized and reason uses real matches", () => {
  const ranked = scoreWork(anchor, candidate, "mood");
  assert.ok(ranked.similarity_score > 0);
  assert.match(ranked.similarity_reason, /디스토피아|초능력/);
  assert.ok(ranked.shared_signals.some((signal) => signal.source === "anilist"));
});
test("anchor and cross-source duplicates are removed", () => {
  const duplicate = { ...anchor, external_source:"tmdb", external_id:"99" };
  assert.deepEqual(rankSimilarWorks(anchor, [anchor, duplicate, candidate], "balanced", "similarity").map((item) => item.external_id), ["2"]);
});
test("reason never exposes a fake percentage", () => { assert.doesNotMatch(buildSimilarityReason([{type:"genre",label:"SF",score:0.9,source:"metadata"}]), /%/); });

function work(id: string, overrides: Partial<SimilarityWork> = {}): SimilarityWork {
  return {
    external_source: "anilist", external_id: id, content_type: "anime", title_primary: `작품 ${id}`,
    title_original: null, poster_url: null, overview: null, air_year: 2020,
    has_seasons: true, episode_count: 12, ...overrides
  };
}

test("mood ranking prefers concrete shared evidence over a provider-only perfect normalized score", () => {
  const providerOnly = work("provider", { provider_recommended: true, popularity: 100_000 });
  const moodMatch = work("mood", { genres: anchor.genres, tags: anchor.tags, overview: anchor.overview });
  assert.equal(scoreWork(anchor, providerOnly, "mood").similarity_score, 1);
  assert.equal(scoreWork(anchor, work("genre", { genres: anchor.genres }), "mood").similarity_score, 1);
  assert.deepEqual(rankSimilarWorks(anchor, [providerOnly, moodMatch], "mood", "similarity").map((item) => item.external_id), ["mood", "provider"]);
});

test("generic discovery without shared evidence is omitted while a genuine metadata-poor provider recommendation remains", () => {
  const unrelated = work("unrelated", { genres: ["Comedy"], tags: ["Cooking"], overview: "바다에서 요리하는 일상" });
  const providerOnly = work("provider", { provider_recommended: true });
  assert.deepEqual(rankSimilarWorks(anchor, [unrelated, providerOnly, work("empty")], "balanced", "latest").map((item) => item.external_id), ["provider"]);
});

test("aliases of one external identity are merged with their evidence without mutating inputs", () => {
  const first = work("same", { title_primary: "한국어 제목", genres: ["Action"], provider_recommended: true });
  const alias = work("same", { title_primary: "English title", tags: ["Dystopian"], studios: ["Studio"], overview: anchor.overview });
  const snapshot = structuredClone([first, alias]);
  const ranked = rankSimilarWorks(anchor, [first, alias], "mood", "similarity");
  assert.equal(ranked.length, 1);
  assert.ok(ranked[0].shared_signals.some((signal) => signal.type === "genre"));
  assert.ok(ranked[0].shared_signals.some((signal) => signal.type === "tag"));
  assert.ok(ranked[0].shared_signals.some((signal) => signal.type === "provider_recommendation"));
  assert.deepEqual([first, alias], snapshot);
});

test("cross-source original title and year dedup keeps richer AniList metadata independent of arrival order", () => {
  const tmdb = work("tmdb-id", { external_source: "tmdb", title_primary: "다른 번역명", title_original: "同じ原題", genres: ["Action"], provider_recommended: true, popularity: 300 });
  const anilist = work("anilist-id", { title_primary: "Original Romaji", title_original: "同じ原題", genres: ["Action", "Romance"], tags: anchor.tags, overview: anchor.overview, studios: ["Production I.G"] });
  for (const candidates of [[tmdb, anilist], [anilist, tmdb]]) {
    const ranked = rankSimilarWorks(anchor, candidates, "mood", "similarity");
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].external_source, "anilist");
    assert.equal(ranked[0].external_id, "anilist-id");
    assert.equal(ranked[0].title_primary, "다른 번역명");
    assert.deepEqual(ranked[0].tags, anchor.tags);
    assert.equal(ranked[0].provider_recommended, true);
    assert.equal(ranked[0].shared_signals.find((signal) => signal.type === "provider_recommendation")?.source, "tmdb");
    assert.equal(ranked[0].popularity, 300);
  }
});

test("duplicate merging preserves the richer candidate's Korean title when both providers have Korean titles", () => {
  const tmdb = work("tmdb-id", { external_source: "tmdb", title_primary: "다른 한국어 번역", title_original: "同じ原題", genres: ["Action"], provider_recommended: true });
  const anilist = work("anilist-id", { title_primary: "풍부한 정보의 한국어 제목", title_original: "同じ原題", genres: anchor.genres, tags: anchor.tags, overview: anchor.overview });
  const ranked = rankSimilarWorks(anchor, [tmdb, anilist], "mood", "similarity");
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].external_id, "anilist-id");
  assert.equal(ranked[0].title_primary, anilist.title_primary);
});

test("same titles in different years and TMDB movie and TV id namespaces remain distinct", () => {
  const remakes = [work("old", { title_primary: "같은 제목", air_year: 1990, genres: anchor.genres }), work("new", { title_primary: "같은 제목", air_year: 2020, genres: anchor.genres })];
  assert.equal(rankSimilarWorks(anchor, remakes, "balanced", "latest").length, 2);
  const namespaced = [work("7", { external_source: "tmdb", title_primary: "TV", genres: anchor.genres }), work("7", { external_source: "tmdb", content_type: "movie", title_primary: "영화", genres: anchor.genres })];
  assert.equal(rankSimilarWorks(anchor, namespaced, "balanced", "similarity").length, 2);
});

test("a cross-source anchor alias with an unknown year is excluded without excluding a known remake", () => {
  const alias = { ...anchor, external_source: "tmdb", external_id: "alias", air_year: null };
  const remake = { ...alias, external_id: "remake", air_year: 2025 };
  assert.deepEqual(rankSimilarWorks(anchor, [alias, remake], "balanced", "similarity").map((item) => item.external_id), ["remake"]);
});

test("candidate dedup preserves explicit seasons while excluding every candidate with the anchor catalog identity", () => {
  const series = work("series", { external_source: "tmdb", title_primary: "시리즈", season_number: 1, genres: anchor.genres });
  const secondSeason = { ...series, season_number: 2 };
  assert.deepEqual(rankSimilarWorks(series, [series, secondSeason], "balanced", "similarity"), []);
  assert.deepEqual(rankSimilarWorks(anchor, [series, secondSeason], "balanced", "similarity").map((item) => item.season_number), [1, 2]);
});

test("a selected AniList season excludes the same catalog work when discovery omits season metadata", () => {
  const selected = work("selected", { season_number: 3, genres: anchor.genres });
  const discovery = work("selected", { genres: anchor.genres });
  const otherSeason = work("another-anilist-season", { season_number: 2, genres: anchor.genres });
  assert.deepEqual(rankSimilarWorks(selected, [discovery, otherSeason], "balanced", "similarity").map((item) => item.external_id), ["another-anilist-season"]);
});

test("a selected TMDB season excludes its whole-series discovery entry while preserving the movie id namespace", () => {
  const selected = work("10", { external_source: "tmdb", season_number: 3, genres: anchor.genres });
  const wholeSeries = work("10", { external_source: "tmdb", genres: anchor.genres });
  const movie = work("10", { external_source: "tmdb", content_type: "movie", genres: anchor.genres });
  assert.deepEqual(rankSimilarWorks(selected, [wholeSeries, movie], "balanced", "similarity").map((item) => item.content_type), ["movie"]);
});

test("latest sorts the entire 25-item result by real dates with missing dates last", () => {
  const dated = Array.from({ length: 25 }, (_, index) => work(`date-${String(index).padStart(2, "0")}`, {
    air_year: 2025, air_date: `2025-01-${String(index + 1).padStart(2, "0")}`, genres: anchor.genres
  }));
  const missing = work("missing", { air_year: null, genres: anchor.genres });
  const invalid = work("invalid", { air_year: null, air_date: "not-a-date", genres: anchor.genres });
  const ranked = rankSimilarWorks(anchor, [missing, invalid, ...dated], "balanced", "latest");
  assert.deepEqual(ranked.slice(0, 25).map((item) => item.external_id), dated.toReversed().map((item) => item.external_id));
  assert.deepEqual(ranked.slice(25).map((item) => item.external_id), ["invalid", "missing"]);
});

test("latest rejects invalid calendar dates and safely falls back to a known year", () => {
  const ranked = rankSimilarWorks(anchor, [
    work("unknown", { air_year: null, air_date: "2025-02-30", genres: anchor.genres }),
    work("year", { air_year: 2020, air_date: "invalid", genres: anchor.genres }),
    work("valid", { air_year: 2019, air_date: "2019-12-31", genres: anchor.genres })
  ], "balanced", "latest");
  assert.deepEqual(ranked.map((item) => item.external_id), ["year", "valid", "unknown"]);
});

test("all sort modes have deterministic identity ties independent of provider order", () => {
  const items = [work("c", { genres: anchor.genres }), work("a", { genres: anchor.genres }), work("b", { genres: anchor.genres })];
  for (const sort of ["similarity", "latest", "popular"] as const) {
    assert.deepEqual(rankSimilarWorks(anchor, items, "balanced", sort).map((item) => item.external_id), ["a", "b", "c"]);
    assert.deepEqual(rankSimilarWorks(anchor, items.toReversed(), "balanced", sort).map((item) => item.external_id), ["a", "b", "c"]);
  }
});

test("popular keeps shared evidence primary and treats non-finite provider metrics as unknown", () => {
  const popular = work("popular", { provider_recommended: true, popularity: 200, vote_count: 100, air_year: 2000 });
  const close = work("close", { tags: anchor.tags, genres: anchor.genres, popularity: 1, air_year: 2030 });
  const invalid = work("invalid", { genres: anchor.genres, popularity: Number.NaN, vote_count: Number.POSITIVE_INFINITY });
  assert.deepEqual(rankSimilarWorks(anchor, [invalid, close, popular], "mood", "popular").map((item) => item.external_id), ["close", "popular", "invalid"]);
});

test("latest and popular always rank stronger shared evidence ahead of newer or more popular weak matches", () => {
  const close = work("close", { tags: anchor.tags, genres: anchor.genres, overview: anchor.overview, air_date: "2001-01-01", popularity: 1 });
  const weak = work("weak", { provider_recommended: true, air_date: "2026-11-15", popularity: 1_000_000 });
  const unrelated = work("unrelated", { genres: ["Comedy"], air_date: "2026-11-15", popularity: 9_000_000 });
  for (const sort of ["similarity", "latest", "popular"] as const) {
    assert.deepEqual(rankSimilarWorks(anchor, [unrelated, weak, close], "mood", sort).map((item) => item.external_id), ["close", "weak"]);
  }
});

test("equal evidence uses latest dates by default and popularity only when requested", () => {
  const olderPopular = work("popular", { genres: anchor.genres, air_date: "2020-01-01", popularity: 10_000 });
  const newer = work("newer", { genres: anchor.genres, air_date: "2025-01-01", popularity: 1 });
  for (const sort of ["similarity", "latest"] as const) {
    assert.deepEqual(rankSimilarWorks(anchor, [olderPopular, newer], "mood", sort).map((item) => item.external_id), ["newer", "popular"]);
  }
  assert.deepEqual(rankSimilarWorks(anchor, [olderPopular, newer], "mood", "popular").map((item) => item.external_id), ["popular", "newer"]);
});

test("four-decimal evidence equality applies the selected secondary order", () => {
  const tagAnchor = work("anchor", { tags: ["shared"] });
  const strongerOlder = work("older", { tags: ["shared", ...Array.from({ length: 99 }, (_, index) => `old-tag-${index}`)], air_date: "2020-01-01" });
  const weakerNewer = work("newer", { tags: ["shared", ...Array.from({ length: 100 }, (_, index) => `new-tag-${index}`)], air_date: "2025-01-01" });
  assert.deepEqual(rankSimilarWorks(tagAnchor, [strongerOlder, weakerNewer], "mood", "latest").map((item) => item.external_id), ["newer", "older"]);
});

test("merged public identities preserve every provider and preexisting alias for library matching", () => {
  const tmdb = work("tmdb-id", { external_source: "tmdb", title_primary: "한국어 번역", title_original: "同じ作品", genres: anchor.genres, season_number: 2 });
  const anilist = work("anilist-id", { title_primary: "English title", title_original: "同じ作品", genres: anchor.genres, tags: anchor.tags, season_number: 2, identity_aliases: [{ external_source: "anilist", external_id: "previous-alias", content_type: "anime", title_primary: "다른 이름", title_original: null, air_year: 2020, season_number: 2 }] });
  const original = structuredClone([tmdb, anilist]);
  for (const candidates of [[tmdb, anilist], [anilist, tmdb]]) {
    const result = rankSimilarWorks(anchor, candidates, "mood", "latest");
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].identity_aliases?.map((alias) => `${alias.external_source}:${alias.external_id}`).sort(), ["anilist:anilist-id", "anilist:previous-alias", "tmdb:tmdb-id"]);
    assert.ok(result[0].identity_aliases?.every((alias) => alias.season_number === 2));
  }
  assert.deepEqual([tmdb, anilist], original);
});

test("latest stays descending after franchise diversification across more than one page", () => {
  const items = Array.from({ length: 25 }, (_, index) => work(`series-${index}`, {
    title_original: index < 3 ? `Same Franchise Season ${index + 1}` : `Other Original ${index}`,
    air_year: 2025, air_date: `2025-01-${String(25 - index).padStart(2, "0")}`, genres: anchor.genres
  }));
  const ranked = rankSimilarWorks(anchor, items.toReversed(), "balanced", "latest");
  assert.equal(ranked.length, 24);
  assert.equal(ranked.filter((item) => item.title_original?.startsWith("Same Franchise")).length, 2);
  for (let index = 1; index < ranked.length; index += 1) assert.ok(ranked[index - 1].air_date! > ranked[index].air_date!);
});
