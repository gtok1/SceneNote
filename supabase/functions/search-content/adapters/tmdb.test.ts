import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyCurrentSeasonMetadata,
  applyTmdbSeasonMetadata,
  discoverTmdb,
  expandAiredSeasons,
  filterSearchResultsByDiscovery,
  MAX_EXPANDED_SEASONS,
  pickCurrentSeason
} from "./tmdb.ts";
import type { SearchResult } from "./types.ts";
import { normalizeDiscoveryFilters } from "../../_shared/discoveryFilters.ts";
import type { RecommendationCache } from "../../_shared/recommendationCache.ts";

const result: SearchResult = {
  external_source: "tmdb",
  external_id: "260823",
  content_type: "anime",
  title_primary: "촌구석 아저씨, 검성이 되다",
  title_original: "片田舎のおっさん、剣聖になる",
  poster_url: null,
  overview: null,
  air_year: 2025,
  air_date: "2025-04-05",
  has_seasons: true,
  episode_count: null
};

describe("applyTmdbSeasonMetadata", () => {
  it("applies the measured second-season date and episode count", () => {
    const updated = applyTmdbSeasonMetadata(result, [
      { season_number: 1, name: "시즌 1", air_date: "2025-04-05", episode_count: 12 },
      { season_number: 2, name: "시즌 2", air_date: "2026-07-08", episode_count: 12 }
    ], 2);

    assert.deepEqual(updated, {
      ...result,
      title_primary: "촌구석 아저씨, 검성이 되다 2기",
      title_is_synthesized: true,
      match_titles: ["촌구석 아저씨, 검성이 되다 2기"],
      season_number: 2,
      air_year: 2026,
      air_date: "2026-07-08",
      episode_count: 12
    });
  });

  it("keeps the base show when the requested season is absent", () => {
    assert.equal(applyTmdbSeasonMetadata(result, [
      { season_number: 1, name: "시즌 1", air_date: "2025-04-05", episode_count: 12 }
    ], 5), result);
  });

  it("prefers a meaningful Korean season title", () => {
    const updated = applyTmdbSeasonMetadata(result, [
      { season_number: 2, name: "검성의 귀환", air_date: "2026-07-08", episode_count: 12 }
    ], 2);

    assert.equal(updated.title_primary, "검성의 귀환");
    assert.equal(updated.title_is_synthesized, undefined);
  });

  it("keeps the original title when the base title is not Korean", () => {
    const englishResult = {
      ...result,
      title_primary: "Katainaka no Ossan, Kensei ni Naru"
    };
    const updated = applyTmdbSeasonMetadata(englishResult, [
      { season_number: 2, name: "Season 2", air_date: "2026-07-08", episode_count: 12 }
    ], 2);

    assert.equal(updated.title_primary, englishResult.title_primary);
    assert.equal(updated.title_is_synthesized, undefined);
  });
});

// VIVANT's real season lineup: season 1 aired 2023, season 2 aired 2026-07-19 (already
// airing as of "now" below), season 3 is announced for 2026-10-11 (has not started yet).
const VIVANT_SEASONS = [
  { season_number: 0, name: "스페셜", air_date: "2023-07-10", episode_count: 10 },
  { season_number: 1, name: "시즌 1", air_date: "2023-07-16", episode_count: 10 },
  { season_number: 2, name: "시즌 2", air_date: "2026-07-19", episode_count: 10 },
  { season_number: 3, name: "시즌 3", air_date: "2026-10-11", episode_count: 1 }
];
const NOW = new Date("2026-09-06T00:00:00Z");

describe("pickCurrentSeason", () => {
  it("picks the most recently started season, not the highest-numbered one", () => {
    const season = pickCurrentSeason(VIVANT_SEASONS, NOW);
    assert.equal(season?.season_number, 2);
  });

  it("excludes the specials season (0) even if it has the latest air date", () => {
    const withLateSpecial = [
      { season_number: 0, air_date: "2026-08-01", episode_count: 1 },
      { season_number: 1, air_date: "2023-07-16", episode_count: 10 }
    ];
    assert.equal(pickCurrentSeason(withLateSpecial, NOW)?.season_number, 1);
  });

  it("ignores seasons that have not started airing yet", () => {
    const onlyFuture = [{ season_number: 2, air_date: "2099-01-01", episode_count: 10 }];
    assert.equal(pickCurrentSeason(onlyFuture, NOW), null);
  });

  it("returns null when there is no dated, numbered season at all", () => {
    assert.equal(pickCurrentSeason([{ season_number: 0, air_date: "2023-01-01" }], NOW), null);
    assert.equal(pickCurrentSeason([], NOW), null);
  });
});

describe("applyCurrentSeasonMetadata", () => {
  it("updates the date and episode count to the currently airing season without renaming the title", () => {
    const updated = applyCurrentSeasonMetadata(result, VIVANT_SEASONS, NOW);
    assert.equal(updated.title_primary, result.title_primary);
    assert.equal(updated.title_is_synthesized, undefined);
    assert.equal(updated.season_number, undefined);
    assert.equal(updated.air_year, 2026);
    assert.equal(updated.air_date, "2026-07-19");
    assert.equal(updated.episode_count, 10);
  });

  it("leaves a single-season show untouched", () => {
    const singleSeason = [{ season_number: 1, air_date: "2025-04-05", episode_count: 12 }];
    assert.equal(applyCurrentSeasonMetadata(result, singleSeason, NOW), result);
  });

  it("leaves the show untouched when no season has started airing", () => {
    const onlyFuture = [{ season_number: 1, air_date: "2099-01-01", episode_count: 10 }];
    assert.equal(applyCurrentSeasonMetadata(result, onlyFuture, NOW), result);
  });
});

describe("expandAiredSeasons", () => {
  it("splits a show with two aired seasons into one card each and drops the unaired one", () => {
    const cards = expandAiredSeasons(result, VIVANT_SEASONS, NOW);
    assert.deepEqual(
      cards.map((card) => [card.season_number, card.air_date, card.episode_count]),
      [[2, "2026-07-19", 10], [1, "2023-07-16", 10]]
    );
  });

  it("keeps the show identity so the library still resolves to the same content", () => {
    for (const card of expandAiredSeasons(result, VIVANT_SEASONS, NOW)) {
      assert.equal(card.external_source, result.external_source);
      assert.equal(card.external_id, result.external_id);
    }
  });

  it("does not expand a single-season show", () => {
    const single = [{ season_number: 1, air_date: "2025-04-05", episode_count: 12 }];
    assert.deepEqual(expandAiredSeasons(result, single, NOW), [result]);
  });

  it("does not expand a movie", () => {
    const movie = { ...result, content_type: "movie" as const };
    assert.deepEqual(expandAiredSeasons(movie, VIVANT_SEASONS, NOW), [movie]);
  });

  it("caps a long-running series at the most recent aired seasons", () => {
    const many = Array.from({ length: 7 }, (_, index) => ({
      season_number: index + 1,
      air_date: `${2015 + index}-01-01`,
      episode_count: 10
    }));
    const cards = expandAiredSeasons(result, many, NOW);
    assert.equal(cards.length, MAX_EXPANDED_SEASONS);
    assert.deepEqual(cards.map((card) => card.season_number), [7, 6, 5, 4, 3]);
  });

  it("synthesizes a season title when the provider name is a generic placeholder", () => {
    const cards = expandAiredSeasons(result, VIVANT_SEASONS, NOW);
    assert.equal(cards[0]?.title_primary, "촌구석 아저씨, 검성이 되다 시즌 2");
  });

  it("prefers a meaningful season name over the synthesized one", () => {
    const named = [
      { season_number: 1, name: "시즌 1", air_date: "2023-07-16", episode_count: 10 },
      { season_number: 2, name: "별의 계승자", air_date: "2026-07-19", episode_count: 10 }
    ];
    assert.equal(expandAiredSeasons(result, named, NOW)[0]?.title_primary, "별의 계승자");
  });
});

describe("positive filters over reusable title-search results", () => {
  it("filters genres without country calls and does not mutate cached pages", async () => {
    const raw = [movie("1", ["Comedy"]), movie("2", ["Drama"])];
    const snapshot = structuredClone(raw);
    await withMockTmdb(async () => { assert.fail("no country selected must make zero metadata calls"); }, async () => {
      const filtered = await filterSearchResultsByDiscovery(raw, normalizeDiscoveryFilters({ genre: "코미디" }));
      assert.deepEqual(filtered.results.map((item) => item.external_id), ["1"]);
      assert.equal(filtered.countryFilterLimited, false);
      const unfiltered = await filterSearchResultsByDiscovery(raw, normalizeDiscoveryFilters());
      assert.equal(unfiltered.results.length, 2);
    });
    assert.deepEqual(raw, snapshot);
  });

  it("applies genre AND country to cached AniList and expanded TMDB season cards", async () => {
    const seasons = expandAiredSeasons({ ...result, genres: ["Comedy"], origin_country: ["JP"] }, VIVANT_SEASONS, NOW);
    const raw = [...seasons, { ...result, external_source: "anilist" as const, external_id: "8", origin_country: ["KR"], genres: ["Comedy"] }];
    await withMockTmdb(async () => { assert.fail("known countries must not cause detail requests"); }, async () => {
      const filtered = await filterSearchResultsByDiscovery(raw, normalizeDiscoveryFilters({ genre: "코미디", country: "jp" }));
      assert.deepEqual(filtered.results.map((item) => item.season_number), [2, 1]);
      assert(filtered.results.every((item) => item.external_id === result.external_id));
    });
  });

  it("only enriches genre-matching movies and uses production countries, not language", async () => {
    const calls: string[] = [];
    await withMockTmdb(async (input) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      assert.equal(url.searchParams.get("api_key"), "test-only-key");
      return Response.json({ original_language: "en", production_countries: [{ iso_3166_1: "KR" }, { iso_3166_1: "US" }] });
    }, async () => {
      const filtered = await filterSearchResultsByDiscovery([movie("1", ["Comedy"]), movie("2", ["Drama"])], normalizeDiscoveryFilters({ genre: "코미디", country: "KR" }));
      assert.deepEqual(calls, ["/3/movie/1"]);
      assert.deepEqual(filtered.results[0]?.origin_country, ["KR", "US"]);
      assert.equal(filtered.countryFilterLimited, false);
    });
  });

  it("reuses cached production countries after changing the selected country", async () => {
    const cache = countryCache();
    let calls = 0;
    await withMockTmdb(async () => { calls += 1; return Response.json({ production_countries: [{ iso_3166_1: "KR" }] }); }, async () => {
      const raw = [movie("1")];
      assert.equal((await filterSearchResultsByDiscovery(raw, normalizeDiscoveryFilters({ country: "KR" }), { cache })).results.length, 1);
      assert.equal((await filterSearchResultsByDiscovery(raw, normalizeDiscoveryFilters({ country: "US" }), { cache })).results.length, 0);
      assert.equal(calls, 1);
      assert.equal(cache.writes[0]?.ttlMs, 86_400_000);
      assert.deepEqual(raw[0]?.origin_country, []);
    });
  });

  it("keeps empty production evidence empty and never substitutes the selected country", async () => {
    const cache = countryCache();
    let calls = 0;
    await withMockTmdb(async () => { calls += 1; return Response.json({ original_language: "ko", production_countries: [] }); }, async () => {
      const raw = [movie("3")];
      assert.equal((await filterSearchResultsByDiscovery(raw, normalizeDiscoveryFilters({ country: "KR" }), { cache })).results.length, 0);
      assert.equal((await filterSearchResultsByDiscovery(raw, normalizeDiscoveryFilters({ country: "JP" }), { cache })).results.length, 0);
      assert.equal(calls, 1);
    });
  });

  it("bounds new movie lookups at eight/four concurrent and resumes missing metadata on retry", async () => {
    const cache = countryCache();
    let calls = 0;
    let active = 0;
    let maxActive = 0;
    await withMockTmdb(async () => {
      calls += 1;
      active += 1;
      maxActive = Math.max(active, maxActive);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return Response.json({ production_countries: [{ iso_3166_1: "US" }] });
    }, async () => {
      const raw = Array.from({ length: 10 }, (_, index) => movie(String(index)));
      const filters = normalizeDiscoveryFilters({ country: "US" });
      const first = await filterSearchResultsByDiscovery(raw, filters, { cache });
      assert.equal(first.results.length, 8);
      assert.equal(first.countryFilterLimited, true);
      assert.equal(calls, 8);
      const second = await filterSearchResultsByDiscovery(raw, filters, { cache });
      assert.equal(second.results.length, 10);
      assert.equal(second.countryFilterLimited, false);
      assert.equal(calls, 10);
      assert(maxActive <= 4);
    });
  });

  it("marks real provider failures partial and reuses a short-lived failure cache", async () => {
    const cache = countryCache();
    let calls = 0;
    await withMockTmdb(async () => { calls += 1; return new Response(null, { status: 503 }); }, async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const filtered = await filterSearchResultsByDiscovery([movie("1")], normalizeDiscoveryFilters({ country: "US" }), { cache });
        assert.deepEqual(filtered.results, []);
        assert.equal(filtered.countryFilterLimited, true);
      }
      assert.equal(calls, 1);
      assert.equal(cache.writes[0]?.ttlMs, 60_000);
    });
  });

  it("stops a stalled lookup at the shared deadline without poisoning the cache", async () => {
    const cache = countryCache();
    await withMockTmdb(async () => new Promise<Response>(() => undefined), async () => {
      const start = Date.now();
      const filtered = await filterSearchResultsByDiscovery([movie("1")], normalizeDiscoveryFilters({ country: "US" }), { cache, deadlineMs: Date.now() + 20 });
      assert.equal(filtered.countryFilterLimited, true);
      assert.equal(cache.writes.length, 0);
      assert(Date.now() - start < 1_000);
    });
  });

  it("pushes genre and country into country discovery and verifies returned genres", async () => {
    await withMockTmdb(async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("with_origin_country"), "KR");
      assert.equal(url.searchParams.get("with_genres"), "35");
      return Response.json({ page: 1, total_pages: 2, total_results: 30, results: [
        { id: 1, title: "한국 코미디", genre_ids: [35] },
        { id: 2, title: "다른 장르", genre_ids: [18] }
      ] });
    }, async () => {
      const response = await discoverTmdb({ country: "KR", genre: "코미디", mediaType: "movie", page: 1, signal: new AbortController().signal });
      assert.deepEqual(response.results.map((item) => item.external_id), ["1"]);
      assert.deepEqual(response.results[0]?.origin_country, ["KR"]);
      assert.equal(response.hasNextPage, true);
    });
  });

  it("verifies a Korean TV romance through cached structured keywords instead of rejecting the Drama genre", async () => {
    const cache = countryCache();
    const tv = { ...result, external_id: "999910001", genres: ["Drama"], origin_country: ["KR"] };
    let calls = 0;
    await withMockTmdb(async (input) => {
      calls += 1;
      assert.equal(new URL(String(input)).pathname, "/3/tv/999910001/keywords");
      return Response.json({ results: [{ name: "romance" }] });
    }, async () => {
      const filters = normalizeDiscoveryFilters({ genre: "로맨스", country: "KR" });
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const filtered = await filterSearchResultsByDiscovery([tv], filters, { cache });
        assert.equal(filtered.results.length, 1);
        assert.deepEqual(filtered.results[0]?.genres, ["Drama", "romance"]);
        assert.equal(filtered.genreFilterLimited, false);
      }
      assert.equal(calls, 1);
      assert.deepEqual(tv.genres, ["Drama"]);
    });
  });

  it("does not fetch TV keywords for another country or accept vague plot text as genre evidence", async () => {
    const korean = { ...result, external_id: "999910002", genres: ["Drama"], origin_country: ["KR"], overview: "로맨스가 시작된다" };
    const japanese = { ...korean, external_id: "999910003", origin_country: ["JP"] };
    const calls: string[] = [];
    await withMockTmdb(async (input) => {
      calls.push(new URL(String(input)).pathname);
      return Response.json({ results: [{ name: "family" }] });
    }, async () => {
      const filtered = await filterSearchResultsByDiscovery([korean, japanese], normalizeDiscoveryFilters({ genre: "로맨스", country: "KR" }));
      assert.deepEqual(filtered.results, []);
      assert.equal(filtered.genreFilterLimited, false);
      assert.deepEqual(calls, ["/3/tv/999910002/keywords"]);
    });
  });

  it("reports missing TV keyword metadata and shares the eight-lookup cap with movie-country verification", async () => {
    const tvs = Array.from({ length: 8 }, (_, index) => ({ ...result, external_id: String(999910100 + index), genres: ["Drama"], origin_country: ["KR"] }));
    let calls = 0;
    await withMockTmdb(async (input) => {
      calls += 1;
      assert(new URL(String(input)).pathname.endsWith("/keywords"));
      return Response.json({ results: [{ name: "romance" }] });
    }, async () => {
      const filtered = await filterSearchResultsByDiscovery([...tvs, movie("999910200", ["Romance"])], normalizeDiscoveryFilters({ genre: "로맨스", country: "KR" }));
      assert.equal(filtered.results.length, 8);
      assert.equal(filtered.countryFilterLimited, true);
      assert.equal(calls, 8);
    });
  });

  it("combines selected genres and countries with OR while keeping type constraints", async () => {
    const korean = { ...result, external_id: "999920001", content_type: "kdrama" as const, genres: ["Comedy"], origin_country: ["KR"] };
    const japanese = { ...result, external_id: "999920002", content_type: "jdrama" as const, genres: ["Mystery"], origin_country: ["JP"] };
    const american = { ...result, external_id: "999920003", genres: ["Comedy"], origin_country: ["US"] };
    const wrongGenre = { ...result, external_id: "999920004", genres: ["Action"], origin_country: ["JP"] };
    const selectedMovie = { ...movie("999920005", ["Comedy"]), origin_country: ["KR"] };
    await withMockTmdb(async () => { throw new Error("Known evidence must not trigger external lookups"); }, async () => {
      const filtered = await filterSearchResultsByDiscovery([korean, japanese, american, wrongGenre, selectedMovie], {
        genres: ["코미디", "미스터리"], countries: ["KR", "JP"], mediaTypes: ["drama"]
      });
      assert.deepEqual(filtered.results.map((item) => item.external_id), ["999920001", "999920002"]);
      assert.equal(filtered.genreFilterLimited, false);
      assert.equal(filtered.countryFilterLimited, false);
    });
  });

  it("does not verify keyword alternatives for an already matching selected genre", async () => {
    const comedy = { ...result, external_id: "999920101", genres: ["Comedy"], origin_country: ["KR"] };
    const romantic = { ...result, external_id: "999920102", genres: ["Drama"], origin_country: ["JP"] };
    const calls: string[] = [];
    await withMockTmdb(async (input) => {
      calls.push(new URL(String(input)).pathname);
      return Response.json({ results: [{ name: "romance" }] });
    }, async () => {
      const filtered = await filterSearchResultsByDiscovery([comedy, romantic], {
        genres: ["comedy", "romance", "thriller"], countries: ["KR", "JP"]
      });
      assert.deepEqual(filtered.results.map((item) => item.external_id), ["999920101", "999920102"]);
      assert.deepEqual(calls, ["/3/tv/999920102/keywords"]);
      assert.deepEqual(filtered.results[1]?.genres, ["Drama", "romance"]);
      assert(!filtered.results[1]?.genres?.includes("thriller"));
    });
  });
});

function movie(id: string, genres = ["Drama"]): SearchResult {
  return { ...result, external_id: id, content_type: "movie", has_seasons: false, origin_country: [], genres };
}

function countryCache(): RecommendationCache & { writes: { key: string; ttlMs: number }[] } {
  const data = new Map<string, unknown>();
  const writes: { key: string; ttlMs: number }[] = [];
  return {
    writes,
    async get<T>(key: string) { return data.get(key) as T ?? null; },
    async set(key, _source, value, ttlMs) { data.set(key, value); writes.push({ key, ttlMs }); }
  };
}

async function withMockTmdb(fetchMock: typeof fetch, run: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalDeno = Object.getOwnPropertyDescriptor(globalThis, "Deno");
  globalThis.fetch = fetchMock;
  Object.defineProperty(globalThis, "Deno", { configurable: true, value: { env: { get: () => "test-only-key" } } });
  try { await run(); } finally {
    globalThis.fetch = originalFetch;
    if (originalDeno) Object.defineProperty(globalThis, "Deno", originalDeno);
    else Reflect.deleteProperty(globalThis, "Deno");
  }
}
