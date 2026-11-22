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

  it("G-1 keeps two seasons from the first page in order", () => {
    const merged = mergeSearchPages([page(1, [
      { ...result("220074"), season_number: 2 },
      { ...result("220074"), season_number: 1 }
    ], false)]);
    assert.deepEqual(merged.map(item => item.season_number), [2, 1]);
  });

  it("G-2 drops a later whole-show card when seasons came first", () => {
    const merged = mergeSearchPages([
      page(1, [{ ...result("220074"), season_number: 2 }, { ...result("220074"), season_number: 1 }], true),
      page(2, [result("220074")], false)
    ]);
    assert.deepEqual(merged.map(item => item.season_number), [2, 1]);
  });

  it("G-3 removes an earlier whole-show card when seasons arrive later", () => {
    const merged = mergeSearchPages([
      page(1, [result("220074")], true),
      page(2, [{ ...result("220074"), season_number: 1 }, { ...result("220074"), season_number: 2 }], false)
    ]);
    assert.deepEqual(merged.map(item => item.season_number), [1, 2]);
  });

  it("G-4 keeps the first page's duplicate season card", () => {
    const merged = mergeSearchPages([
      page(1, [{ ...result("220074"), season_number: 1, poster_url: "A" }], true),
      page(2, [{ ...result("220074"), season_number: 1, poster_url: "B" }], false)
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.poster_url, "A");
  });

  it("merges the same anime season from AniList and TMDB across pages", () => {
    const anilist = {
      ...result("178789"),
      external_source: "anilist" as const,
      content_type: "anime" as const,
      title_primary: "무직전생 ~이세계에 갔으면 최선을 다한다~",
      title_original: "無職転生Ⅲ ～異世界行ったら本気だす～",
      match_titles: ["無職転生 ～異世界行ったら本気だす～ 第3期", "Mushoku Tensei 3rd Season"],
      air_year: 2026,
      air_date: "2026-07-04",
      has_seasons: true,
      episode_count: 14
    };
    const tmdb = {
      ...result("94664"),
      content_type: "anime" as const,
      title_primary: "무직전생 ~이세계에 갔으면 최선을 다한다~ 시즌 3",
      title_original: "無職転生 ～異世界行ったら本気だす～",
      season_number: 3,
      air_year: 2026,
      air_date: "2026-07-03",
      has_seasons: true,
      episode_count: 14
    };

    for (const [first, second] of [[anilist, tmdb], [tmdb, anilist]]) {
      const merged = mergeSearchPages([page(1, [first!], true), page(2, [second!], false)]);
      assert.equal(merged.length, 1);
      assert.equal(merged[0]?.external_source, "anilist");
      assert.equal(merged[0]?.external_id, "178789");
      assert.equal(merged[0]?.season_number, undefined);
    }
  });

  it("keeps TMDB movie and TV records with the same numeric ID", () => {
    const movie = result("123");
    const show = { ...result("123"), content_type: "kdrama" as const };
    const merged = mergeSearchPages([page(1, [movie], true), page(2, [show], false)]);
    assert.deepEqual(merged.map(item => item.content_type), ["movie", "kdrama"]);

    const season = { ...show, season_number: 1 };
    const withSeason = mergeSearchPages([page(1, [movie], true), page(2, [season], false)]);
    assert.deepEqual(withSeason.map(item => item.content_type), ["movie", "kdrama"]);
  });

  it("keeps separate AniList entries for split parts even when their translated titles match", () => {
    const firstPart = {
      ...result("anime-part-1"), external_source: "anilist" as const, content_type: "anime" as const,
      title_primary: "어느 애니메이션 2기", title_original: "Anime 2nd Season", air_year: 2026,
      air_date: "2026-01-01", has_seasons: true, episode_count: 12
    };
    const secondPart = {
      ...firstPart, external_id: "anime-part-2", title_original: "Anime 2nd Season Part 2",
      air_date: "2026-07-01"
    };
    const merged = mergeSearchPages([page(1, [firstPart], true), page(2, [secondPart], false)]);
    assert.deepEqual(merged.map(item => item.external_id), ["anime-part-1", "anime-part-2"]);
  });

  it("keeps different explicit season numbers across anime providers", () => {
    const anilist = {
      ...result("anilist-season"), external_source: "anilist" as const, content_type: "anime" as const,
      title_primary: "같은 애니", season_number: 5, air_year: 2026
    };
    const tmdb = {
      ...result("tmdb-season"), content_type: "anime" as const,
      title_primary: "같은 애니", season_number: 3, air_year: 2026
    };
    const merged = mergeSearchPages([page(1, [anilist], true), page(2, [tmdb], false)]);
    assert.deepEqual(merged.map(item => item.season_number), [5, 3]);
  });
});
