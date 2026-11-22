import assert from "node:assert/strict";
import { it } from "node:test";
import { compactResults } from "../search-content/adapters/normalize.ts";
import type { SearchResult } from "../search-content/adapters/types.ts";
import { normalizeAniListItem } from "../search-content/adapters/anilist.ts";
import { annotateFilterMatches } from "../search-content/adapters/normalize.ts";
import { formatAnimeSearchTitle } from "./searchResultMerge.ts";

const title = "무직전생 ~이세계에 갔으면 최선을 다한다~";
const original = "無職転生 ～異世界行ったら本気だす～";
const ani = (patch: Partial<SearchResult> = {}): SearchResult => ({
  external_source: "anilist", external_id: "178789", content_type: "anime",
  title_primary: title, title_original: "無職転生Ⅲ ～異世界行ったら本気だす～",
  air_date: "2026-07-04", air_year: 2026, episode_count: 14,
  has_seasons: true, poster_url: null, overview: null,
  match_titles: ["Mushoku Tensei: Isekai Ittara Honki Dasu 3rd Season"], ...patch
});
const tmdb = (patch: Partial<SearchResult> = {}): SearchResult => ({
  ...ani(), external_source: "tmdb", external_id: "94664", season_number: 3,
  title_primary: `${title} 시즌 3`, title_original: original, air_date: "2026-07-03",
  match_titles: [`${title} 시즌 3`], ...patch
});

it("87 T1 merges the observed Mushoku season 3 despite localized/native title differences", () => {
  for (const results of [[ani(), tmdb()], [tmdb(), ani()]]) {
    const merged = compactResults(results);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.external_source, "anilist");
    assert.equal(merged[0]?.external_id, "178789");
  }
});

it("87 T2 preserves Mushoku season 3 Part 2, specials, and season 2 split coverage", () => {
  const part2 = ani({ external_id: "217434", title_original: "無職転生Ⅲ ～異世界行ったら本気だす～ 第2クール", air_date: null, air_year: 2027, episode_count: null });
  assert.equal(compactResults([ani(), part2, tmdb()]).length, 2);
  const second = ani({ external_id: "146065", title_primary: `${title} 3기`, title_original: "無職転生Ⅱ ～異世界行ったら本気だす～", air_year: 2023, air_date: "2023-07-03", episode_count: 13, season_number: 3 });
  const secondPart = ani({ external_id: "166873", title_primary: title, title_original: "無職転生Ⅱ ～異世界行ったら本気だす～ 第2クール", air_year: 2024, air_date: "2024-04-08", episode_count: 12 });
  assert.equal(compactResults([second, secondPart, tmdb({ season_number: 2, air_year: 2023, air_date: "2023-07-10", episode_count: 24 })]).length, 3);
  assert.equal(compactResults([ani(), ani({ external_id: "special", title_original: `${original} OVA`, episode_count: 1 })]).length, 2);
});

it("87 T3 never collapses separate AniList media IDs through an enriched series title", () => {
  assert.equal(compactResults([ani(), ani({ external_id: "part2", title_original: "無職転生Ⅲ ～異世界行ったら本気だす～ 第2クール", air_date: "2026-10-04" })]).length, 2);
});

it("87 T4 requires matching release evidence for normalized anime titles", () => {
  for (const patch of [
    { episode_count: 28 }, { air_date: "2026-10-03" }, { air_year: 2025 },
    { air_year: null, air_date: null }, { episode_count: null }, { air_date: null },
    { title_original: "別の作品 第3期", title_primary: "別の作品", match_titles: [title] }
  ]) assert.equal(compactResults([ani(), tmdb(patch)]).length, 2, JSON.stringify(patch));
});

it("87 T5 preserves unequal explicit season identities even with matching release metadata", () => {
  assert.equal(compactResults([ani({ season_number: 5 }), tmdb()]).length, 2);
});

it("87 T6 separates TMDB movie and TV numeric ID namespaces before exact merging", () => {
  const movie = tmdb({ external_id: "same", content_type: "movie", season_number: undefined, has_seasons: false });
  const tv = tmdb({ external_id: "same", content_type: "anime", season_number: undefined });
  assert.equal(compactResults([movie, tv]).length, 2);
  assert.equal(compactResults([movie, tmdb({ external_id: "same", season_number: 3 })]).length, 2);
});

it("87 T7 does not merge same-year remakes with conflicting dates or unknown years", () => {
  assert.equal(compactResults([ani(), tmdb({ title_primary: title, air_date: "2026-01-01" })]).length, 2);
  assert.equal(compactResults([ani(), tmdb({ title_primary: title, air_year: null, air_date: null })]).length, 2);
});

it("87 T8 retains legacy exact-title anime matches and does not mutate inputs", () => {
  const left = ani({ title_original: original, air_date: null, episode_count: null });
  const right = tmdb({ title_primary: title, air_date: null, episode_count: null, season_number: undefined });
  const before = JSON.stringify([left, right]);
  assert.equal(compactResults([left, right]).length, 1);
  assert.equal(JSON.stringify([left, right]), before);
});

it("87 T9 merges confirmed animation movies without merging films into TV or specials", () => {
  const film = ani({ anime_format: "MOVIE", has_seasons: false, title_primary: "애니 영화", title_original: "映画", episode_count: 1 });
  const movie = tmdb({ content_type: "movie", has_seasons: false, title_primary: "애니 영화", title_original: "映画", episode_count: null, genres: ["Animation"] });
  delete movie.season_number;
  for (const pair of [[film, movie], [movie, film]]) {
    const merged = compactResults(pair);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.external_source, "anilist");
  }
  assert.equal(compactResults([{ ...film, anime_format: "OVA" }, movie]).length, 2);
  assert.equal(compactResults([{ ...film, anime_format: "TV", has_seasons: true }, movie]).length, 2);
});

it("87 T10 preserves provider formats and canonical titles as non-query matching evidence", () => {
  const normalized = normalizeAniListItem({ id: 1, format: "MOVIE", title: { native: "映画", english: "Film", romaji: "Eiga" } });
  assert.equal(normalized.anime_format, "MOVIE");
  assert.equal(normalized.has_seasons, false);
  for (const alias of ["映画", "Film", "Eiga"]) assert.ok(normalized.match_titles?.includes(alias));
});

it("87 T11 filter annotations keep movie and TV matches separate for equal TMDB IDs", () => {
  const movie = tmdb({ content_type: "movie", has_seasons: false });
  delete movie.season_number;
  const tv = tmdb(); delete tv.season_number;
  const annotated = annotateFilterMatches([movie, tv], [tv], true);
  assert.deepEqual(annotated.results.map(item => item.filter_match), [false, true]);
});

it("87 T12 an equivalent provider cannot bridge two distinct IDs from another provider", () => {
  const first = tmdb({ external_id: "tv1", season_number: undefined, title_primary: title, title_original: original });
  const second = tmdb({ external_id: "tv2", season_number: undefined, title_primary: title, title_original: original });
  const equivalent = ani({ title_original: original });
  for (const items of [[first, equivalent, second], [equivalent, first, second], [first, second, equivalent]]) {
    assert.equal(compactResults(items).length, 2);
  }
});

it("87 T13 preserves proper-title X instead of inventing a tenth season", () => {
  const gundam = ani({ title_primary: "기동신세기 건담 X", title_original: "機動新世紀ガンダムX", match_titles: [] });
  assert.equal(formatAnimeSearchTitle(gundam), "기동신세기 건담 X");
  assert.equal(compactResults([gundam, tmdb({ title_primary: "기동신세기 건담 X", title_original: "機動新世紀ガンダムX", season_number: 1 })]).length, 1);
});

it("87 T14 ambiguous season aliases cannot become an implicit first-season proof", () => {
  assert.equal(compactResults([ani({ title_original: original, match_titles: ["Anime Season 2", "Anime Season 3"] }),
    tmdb({ title_primary: title, title_original: original, season_number: 1 })]).length, 2);
});

it("87 T15 explicit seasons remain incompatible across an already-merged provider group", () => {
  const other = { ...ani(), external_source: "kitsu" as const, external_id: "other", season_number: 4 };
  assert.equal(compactResults([ani(), tmdb(), other]).length, 2);
});

it("87 T16 normalized season matching accepts seven days and rejects eight", () => {
  assert.equal(compactResults([ani(), tmdb({ air_date: "2026-07-11" })]).length, 1);
  assert.equal(compactResults([ani(), tmdb({ air_date: "2026-07-12" })]).length, 2);
});
