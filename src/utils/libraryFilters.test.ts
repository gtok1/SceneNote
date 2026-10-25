import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CrewMember } from "@/types/content";
import type { LibraryListItem } from "@/types/library";

import {
  filterLibraryItems,
  parseGenreFilters,
  serializeGenreFilters,
  type LibraryFilterState
} from "./libraryFilters";

const baseFilters: LibraryFilterState = {
  statusFilter: "all",
  contentTypeFilter: "all",
  genreFilter: "all",
  ratingFilter: "all",
  searchQuery: "",
  year: "",
  sortOrder: "latest"
};

describe("library filters", () => {
  for (const searchQuery of ["감정스킬로", "감정 스킬로", "감 정스킬로", "감정스", "  감정\t스킬로　 "]) {
    it(`finds a spaced title with query ${JSON.stringify(searchQuery)}`, () => {
      const anime = { ...item("appraisal", "anime", []), title_primary: "전생 귀족, 감정 스킬로 성공하다 3기" };
      const result = filterLibraryItems([anime, item("unrelated", "anime", [])], { ...baseFilters, searchQuery });
      assert.deepEqual(result.map((entry) => entry.content_id), ["appraisal"]);
    });
  }

  it("ignores whitespace in original titles, crew and cast while preserving case-insensitive search", () => {
    const entries = [
      { ...item("original", "anime", []), title_original: "The First Slam Dunk" },
      { ...item("crew", "movie", []), crew: [crewMember(1, "봉 준호")] },
      { ...item("cast", "movie", []), cast: [{ id: 2, name: "김 태리", original_name: "Kim Tae Ri", character: "구 산영", profile_url: null, order: 0 }] }
    ];
    for (const [searchQuery, expected] of [
      ["firstslamdunk", "original"], ["봉준호", "crew"], ["김태리", "cast"], ["KIMTAERI", "cast"], ["구산영", "cast"]
    ] as const) {
      assert.deepEqual(filterLibraryItems(entries, { ...baseFilters, searchQuery }).map((entry) => entry.content_id), [expected]);
    }
  });

  it("keeps other filters active and treats whitespace-only queries as empty", () => {
    const entries = [
      { ...item("anime", "anime", ["판타지"]), title_primary: "감정 스킬로", rating: 8 },
      { ...item("movie", "movie", ["판타지"]), title_primary: "감정 스킬로", rating: 8 }
    ];
    const filters = { ...baseFilters, contentTypeFilter: "anime" as const, genreFilter: "판타지", ratingFilter: 8, year: "2026" };
    for (const searchQuery of ["감정스킬로", " \t　"]) {
      assert.deepEqual(filterLibraryItems(entries, { ...filters, searchQuery }).map((entry) => entry.content_id), ["anime"]);
    }
    assert.deepEqual(filterLibraryItems(entries, { ...filters, searchQuery: "감정스킬로", year: "2025" }), []);
  });

  it("does not form compact matches across separate fields", () => {
    const entry = { ...item("split", "movie", []), title_primary: "감정", title_original: "스킬로" };
    assert.deepEqual(filterLibraryItems([entry], { ...baseFilters, searchQuery: "감정스킬로" }), []);
  });

  it("serializes multiple genres for URL-safe filter state", () => {
    const serialized = serializeGenreFilters(["드라마", "코미디", "드라마"]);
    assert.equal(serialized, "드라마|코미디");
    assert.deepEqual(parseGenreFilters(serialized), ["드라마", "코미디"]);
    assert.deepEqual(parseGenreFilters("all"), []);
  });

  it("matches any selected genre", () => {
    const result = filterLibraryItems(
      [item("drama", "kdrama", ["드라마"]), item("action", "anime", ["액션"])],
      { ...baseFilters, genreFilter: serializeGenreFilters(["코미디", "액션"]) }
    );
    assert.deepEqual(result.map((entry) => entry.content_id), ["action"]);
  });

  it("separates overseas dramas from other content without changing the DB content type", () => {
    const items = [item("foreign", "other", ["Drama"]), item("documentary", "other", ["다큐멘터리"])];
    const foreign = filterLibraryItems(items, { ...baseFilters, contentTypeFilter: "foreign_drama" });
    const other = filterLibraryItems(items, { ...baseFilters, contentTypeFilter: "other" });
    assert.deepEqual(foreign.map((entry) => entry.content_id), ["foreign"]);
    assert.deepEqual(other.map((entry) => entry.content_id), ["documentary"]);
  });
});

function item(contentId: string, contentType: LibraryListItem["content_type"], genres: string[]): LibraryListItem {
  return {
    library_item_id: `library-${contentId}`,
    status: "wishlist",
    statuses: ["wishlist"],
    added_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    first_watched_at: null,
    last_watched_at: null,
    content_id: contentId,
    title_primary: contentId,
    title_original: null,
    poster_url: null,
    content_type: contentType,
    source_api: "tmdb",
    source_id: contentId,
    air_year: 2026,
    air_date: "2026-01-01",
    end_date: null,
    cast: [],
    rating: null,
    one_line_review: null,
    episode_count: null,
    watched_episode_count: 0,
    derived_watched_through: null,
    next_episode_number: null,
    manual_watched_season_number: null,
    manual_watched_episode_number: null,
    manual_watched_absolute_number: null,
    progress_source: "none",
    effective_watched_through: 0,
    season_episode_counts: [],
    manual_progress_available: true,
    genres,
    watch_count: 0,
  season_number: null
  };
}

function crewMember(id: number, name: string, original_name: string | null = null): CrewMember {
  return {id,name,original_name,role:"director",job:"director",profile_url:null};
}
it("F-1 finds library items by crew names", () => {
  const withCrew = {...item("parasite","movie",[]),crew:[crewMember(1,"봉준호")]};
  assert.deepEqual(filterLibraryItems([withCrew,item("other","movie",[])], {...baseFilters,searchQuery:"봉준호"}).map(entry => entry.content_id), ["parasite"]);
});
it("F-2 finds original crew names without case sensitivity", () => {
  const withCrew = {...item("frieren","anime",[]),crew:[crewMember(2,"斎藤圭一郎","Keiichiro Saito")]};
  assert.deepEqual(filterLibraryItems([withCrew], {...baseFilters,searchQuery:"saito"}).map(entry => entry.content_id), ["frieren"]);
});
