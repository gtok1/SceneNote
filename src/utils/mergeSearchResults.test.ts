import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { mergeSearchResults, preferRegisteredSearchResult } from "./mergeSearchResults";
import { getSearchResultActions } from "./searchResultActions";
import { partitionSearchResults } from "./searchResultVisibility";
import { getSearchExternalKey } from "../../supabase/functions/_shared/searchResultMerge";

const result = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  external_source: "anilist", external_id: "178789", content_type: "anime",
  title_primary: "무직전생 ~이세계에 갔으면 최선을 다한다~",
  title_original: "無職転生Ⅲ ～異世界行ったら本気だす～", poster_url: "anilist-poster",
  overview: null, air_year: 2026, air_date: "2026-07-04", has_seasons: true, episode_count: 14,
  ...overrides
});

const tmdbSeason = (): SearchResult => result({
  external_source: "tmdb", external_id: "94664", season_number: 3, has_seasons: true,
  title_primary: "무직전생 ~이세계에 갔으면 최선을 다한다~ 시즌 3",
  title_original: "無職転生 ～異世界行ったら本気だす～", air_date: "2026-07-03",
  poster_url: "tmdb-poster"
});

const registered = (content_type: SearchResult["content_type"], season_number: number | null): LibraryListItem => ({
  library_item_id: "registered-work", content_type, season_number,
  status: "completed", statuses: ["completed"]
} as LibraryListItem);

describe("combined title and person search results", () => {
  it("merges the same anime season and keeps people and both registration identities", () => {
    const merged = mergeSearchResults([result({ matched_people: ["배우 A"] })], [
      { ...tmdbSeason(), matched_people: ["배우 B", "배우 A"] }
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.external_source, "anilist");
    assert.equal(merged[0]?.season_number, undefined);
    assert.deepEqual(new Set(merged[0]?.matched_people), new Set(["배우 A", "배우 B"]));
    assert.ok(merged[0]?.equivalent_results?.some(item =>
      item.external_source === "tmdb" && item.external_id === "94664" && item.season_number === 3
    ));
  });

  it("unions matched people when the exact provider card appears in both searches", () => {
    const merged = mergeSearchResults([result({ matched_people: ["성우 A"] })], [
      result({ overview: "소개", matched_people: ["성우 B"] })
    ]);
    assert.equal(merged.length, 1);
    assert.deepEqual(new Set(merged[0]?.matched_people), new Set(["성우 A", "성우 B"]));
    assert.equal(merged[0]?.overview, "소개");
  });

  it("keeps distinct provider entries, explicit seasons, and TMDB movie/TV namespaces", () => {
    const splitPart = result({ external_id: "other-part", title_original: "無職転生 Part 2" });
    assert.equal(mergeSearchResults([result()], [splitPart]).length, 2);
    assert.equal(mergeSearchResults([result({ season_number: 5 })], [tmdbSeason()]).length, 2);

    const movie = result({ external_source: "tmdb", external_id: "123", content_type: "movie", has_seasons: false });
    const tv = { ...movie, content_type: "jdrama" as const, has_seasons: true };
    assert.deepEqual(mergeSearchResults([movie], [tv]).map(item => item.content_type), ["movie", "jdrama"]);
  });
});

describe("merged result registration identity", () => {
  it("uses the registered equivalent season so the card stays registered after merging", () => {
    const merged = mergeSearchResults([result()], [tmdbSeason()])[0]!;
    const libraryItem = { ...registered("anime", 3), source_api: "tmdb" as const, source_id: "94664" };
    const library = new Map([["tmdb:tv:94664", [libraryItem]]]);
    const preferred = preferRegisteredSearchResult(merged, library);

    assert.equal(preferred.external_source, "tmdb");
    assert.equal(preferred.external_id, "94664");
    assert.equal(preferred.season_number, 3);
    assert.equal(preferred.poster_url, "anilist-poster");
    assert.ok(preferred.equivalent_results?.some(item => item.external_source === "anilist" && item.external_id === "178789"));
    const actions = getSearchResultActions(preferred.season_number, library.get("tmdb:tv:94664")!, null, false);
    assert.equal(actions.libraryItem?.library_item_id, "registered-work");
    assert.equal(actions.completedDisabled, true);
    assert.deepEqual(partitionSearchResults([preferred], {
      discoveryFilters: {}, statusFilter: "completed", year: 2026, libraryItems: [libraryItem]
    }).visible, [preferred]);
  });

  it("does not claim a different season, a whole-show row, or an identically numbered movie", () => {
    const merged = mergeSearchResults([result()], [tmdbSeason()])[0]!;
    for (const item of [registered("anime", 2), registered("anime", null), registered("movie", 3)]) {
      const key = item.content_type === "movie" ? "tmdb:movie:94664" : "tmdb:tv:94664";
      const library = new Map([[key, [item]]]);
      assert.equal(preferRegisteredSearchResult(merged, library), merged);
    }
  });

  it("keeps a TV card unregistered when only the identically numbered movie is registered", () => {
    const movie = result({ external_source: "tmdb", external_id: "123", content_type: "movie", has_seasons: false });
    const tv = { ...movie, content_type: "jdrama" as const, has_seasons: true };
    const results = mergeSearchResults([movie], [tv]);
    const library = new Map([[getSearchExternalKey(movie), [registered("movie", null)]]]);

    assert.equal(results.length, 2);
    const movieActions = getSearchResultActions(movie.season_number, library.get(getSearchExternalKey(movie)) ?? [], null, false);
    const tvActions = getSearchResultActions(tv.season_number, library.get(getSearchExternalKey(tv)) ?? [], null, false);
    assert.equal(movieActions.completedDisabled, true);
    assert.equal(tvActions.libraryItem, null);
    assert.equal(tvActions.completedDisabled, false);

    const mergedAnime = mergeSearchResults([result()], [tmdbSeason()])[0]!;
    const unrelatedMovie = new Map([[getSearchExternalKey({ ...tmdbSeason(), content_type: "movie" }), [registered("movie", 3)]]]);
    assert.equal(preferRegisteredSearchResult(mergedAnime, unrelatedMovie), mergedAnime);
  });

  it("uses a whole-work equivalent only for a whole-work registration and removes the former season", () => {
    const merged = {
      ...tmdbSeason(),
      equivalent_results: [{ external_source: "anilist" as const, external_id: "178789", content_type: "anime" as const }]
    };
    const unrelatedSeason = new Map([["anilist:178789", [registered("anime", 2)]]]);
    assert.equal(preferRegisteredSearchResult(merged, unrelatedSeason), merged);

    const library = new Map([["anilist:178789", [registered("anime", null)]]]);
    const preferred = preferRegisteredSearchResult(merged, library);
    assert.equal(preferred.external_source, "anilist");
    assert.equal(preferred.season_number, undefined);
    assert.ok(preferred.equivalent_results?.some(item => item.external_source === "tmdb" && item.season_number === 3));
    assert.equal(preferRegisteredSearchResult(preferred, library), preferred);
  });
});
