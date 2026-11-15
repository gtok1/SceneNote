import assert from "node:assert/strict";
import test from "node:test";
import type { SimilarityWork } from "./similarityEngine.ts";
import {
  filterUnregisteredSimilarWorks,
  isSimilarWorkRegistered,
  similarityLibrarySignature,
  type SimilarityLibraryEntry
} from "./similarityLibrary.ts";

function candidate(overrides: Partial<SimilarityWork> = {}): SimilarityWork {
  return {
    external_source: "anilist", external_id: "1575", content_type: "anime",
    title_primary: "코드 기아스 반역의 를르슈", title_original: "コードギアス 反逆のルルーシュ",
    air_year: 2006, has_seasons: true, episode_count: 25, overview: null,
    poster_url: null, ...overrides
  };
}

function registration(overrides: Partial<SimilarityLibraryEntry> = {}): SimilarityLibraryEntry {
  return {
    source_api: "anilist", source_id: "1575", content_type: "anime",
    title_primary: "코드 기아스 반역의 를르슈", title_original: "コードギアス 反逆のルルーシュ",
    air_year: 2006, season_number: null, ...overrides
  };
}

test("every saved status excludes the registered anime, including Code Geass", () => {
  for (const status of ["wishlist", "watching", "completed", "recommended", "not_recommended", "dropped"]) {
    const entry = { ...registration(), status };
    assert.equal(isSimilarWorkRegistered(candidate(), [entry]), true, status);
  }
});

test("an empty library preserves all candidates without mutating inputs", () => {
  const items = [candidate(), candidate({ external_id: "other", title_primary: "다른 작품" })];
  const original = structuredClone(items);
  assert.deepEqual(filterUnregisteredSimilarWorks(items, []), items);
  assert.deepEqual(items, original);
});

test("cross-provider original titles match despite Korean and romanized display differences", () => {
  const entry = registration({ source_api: "tmdb", source_id: "31724", title_primary: "코드 기아스", has_seasons: true });
  assert.equal(isSimilarWorkRegistered(candidate({ title_primary: "Code Geass: Hangyaku no Lelouch" }), [entry]), true);
});

test("stored Korean English and native title aliases match exact normalized titles", () => {
  const entry = registration({ source_api: "manual", source_id: "", title_primary: "다른 표기", title_original: null,
    titles: ["코드 기아스", "Code Geass", "コードギアス"] });
  for (const title of ["코드기아스", "Ｃｏｄｅ－Ｇｅａｓｓ", "コードギアス"]) {
    assert.equal(isSimilarWorkRegistered(candidate({ title_primary: title, title_original: null }), [entry]), true, title);
  }
});

test("stored provider ID aliases identify a work even if displayed titles differ", () => {
  const entry = registration({ source_api: "tmdb", source_id: "31724", title_primary: "다른 번역", title_original: null,
    external_ids: [{ api_source: "anilist", external_id: "1575" }] });
  assert.equal(isSimilarWorkRegistered(candidate({ title_original: null }), [entry]), true);
});

test("merged candidate provider aliases preserve a registration hidden by the preferred provider", () => {
  const original = candidate({ external_id: "preferred", title_primary: "English title", title_original: null });
  const work = { ...original, identity_aliases: [{ external_source: "tmdb", external_id: "31724", content_type: "anime",
    has_seasons: true, title_primary: "버려진 한국어 제목", title_original: null, air_year: 2006 }] };
  assert.equal(isSimilarWorkRegistered(work, [registration({ source_api: "tmdb", source_id: "31724", title_primary: "등록 제목", title_original: null, has_seasons: true })]), true);
  assert.deepEqual(original, candidate({ external_id: "preferred", title_primary: "English title", title_original: null }));
});

test("a matching title retained only in a merged alias still excludes the whole work", () => {
  const work = { ...candidate({ external_id: "preferred", title_primary: "새로운 번역", title_original: null }),
    identity_aliases: [{ external_source: "tmdb", external_id: "31724", content_type: "anime", has_seasons: true,
      title_primary: "Code Geass", title_original: null, air_year: 2006 }] };
  assert.equal(isSimilarWorkRegistered(work, [registration({ source_api: "manual", source_id: "", title_primary: "Code Geass", title_original: null })]), true);
});

test("whole-work registrations cover explicit seasons but explicit other seasons stay available", () => {
  const seasonTwo = candidate({ external_source: "tmdb", external_id: "31724", season_number: 2 });
  const entry = registration({ source_api: "tmdb", source_id: "31724", has_seasons: true });
  assert.equal(isSimilarWorkRegistered(seasonTwo, [entry]), true);
  assert.equal(isSimilarWorkRegistered(seasonTwo, [{ ...entry, season_number: 2 }]), true);
  assert.equal(isSimilarWorkRegistered(seasonTwo, [{ ...entry, season_number: 1 }]), false);
});

test("an unnumbered series is not recommended again after registering one of its seasons", () => {
  assert.equal(isSimilarWorkRegistered(candidate({ external_source: "tmdb", external_id: "31724" }),
    [registration({ source_api: "tmdb", source_id: "31724", season_number: 2, has_seasons: true })]), true);
});

test("merged aliases do not erase the selected candidate season", () => {
  const work = { ...candidate({ external_id: "preferred", season_number: 2, title_primary: "별도 제목", title_original: null }),
    identity_aliases: [{ external_source: "tmdb", external_id: "31724", content_type: "anime", has_seasons: true,
      title_primary: "원래 제목", title_original: null, air_year: 2006 }] };
  assert.equal(isSimilarWorkRegistered(work, [registration({ source_api: "tmdb", source_id: "31724", season_number: 1, has_seasons: true })]), false);
});

test("TMDB movie and TV IDs occupy separate namespaces even when numbers coincide", () => {
  const movie = candidate({ external_source: "tmdb", external_id: "7", content_type: "movie", has_seasons: false, title_primary: "영화", title_original: null });
  const tv = registration({ source_api: "tmdb", source_id: "7", content_type: "jdrama", title_primary: "드라마", title_original: null, has_seasons: true });
  assert.equal(isSimilarWorkRegistered(movie, [tv]), false);
});

test("anime films and TV anime with the same title year and TMDB number remain separate", () => {
  const movie = candidate({ external_source: "tmdb", external_id: "7", has_seasons: false });
  const tv = registration({ source_api: "tmdb", source_id: "7", has_seasons: true });
  assert.equal(isSimilarWorkRegistered(movie, [tv]), false);
  assert.equal(isSimilarWorkRegistered(candidate({ has_seasons: false }), [tv]), false);
});

test("unknown anime TMDB medium does not turn an unrelated coincident ID into a registration", () => {
  const movie = candidate({ external_source: "tmdb", external_id: "7", has_seasons: false, title_primary: "영화", title_original: null });
  const unknown = registration({ source_api: "tmdb", source_id: "7", title_primary: "TV 작품", title_original: null });
  assert.equal(isSimilarWorkRegistered(movie, [unknown]), false);
});

test("known-year remakes remain separate while missing years preserve existing title matching", () => {
  const entry = registration({ source_api: "manual", source_id: "" });
  assert.equal(isSimilarWorkRegistered(candidate({ external_id: "remake", air_year: 2026 }), [entry]), false);
  assert.equal(isSimilarWorkRegistered(candidate({ external_id: "unknown", air_year: null }), [entry]), true);
});

test("different anime sequels and similar franchise titles are not fuzzy merged", () => {
  const sequel = candidate({ external_id: "2904", title_primary: "코드 기아스 반역의 를르슈 R2", title_original: "コードギアス 反逆のルルーシュ R2", air_year: 2008 });
  assert.equal(isSimilarWorkRegistered(sequel, [registration()]), false);
});

test("movie and drama duplicates keep the existing documented title-year exception", () => {
  const drama = candidate({ external_source: "tmdb", external_id: "333484", content_type: "kdrama", title_primary: "개인적인 택시", title_original: null, air_year: 2026 });
  const film = registration({ source_api: "tmdb", source_id: "1744241", content_type: "movie", title_primary: "개인적인 택시", title_original: null, air_year: 2025, has_seasons: false });
  assert.equal(isSimilarWorkRegistered(drama, [film]), true);
  assert.equal(isSimilarWorkRegistered({ ...drama, air_year: 2028 }, [film]), false);
});

test("multiple registrations filter only registered candidates and preserve ranked order", () => {
  const rows = [candidate({ external_id: "new-a", title_primary: "새 작품 A", title_original: null }), candidate(),
    candidate({ external_id: "new-b", title_primary: "새 작품 B", title_original: null })];
  const entries = [registration({ source_id: "unrelated", title_primary: "무관", title_original: null }), registration()];
  assert.deepEqual(filterUnregisteredSimilarWorks(rows, entries).map(item => item.external_id), ["new-a", "new-b"]);
});

test("library signatures ignore row status order and duplicate equivalent registrations", () => {
  const first = { ...registration(), status: "wishlist", updated_at: "2026-01-01" };
  const second = registration({ source_id: "2904", title_primary: "R2", title_original: null, air_year: 2008 });
  assert.equal(similarityLibrarySignature([first, second]), similarityLibrarySignature([second, { ...first, status: "completed", updated_at: "2026-11-15" }, first]));
});

test("signatures normalize title and alias order but change when registration identity changes", () => {
  const entry = registration({ titles: ["Code Geass", "코드 기아스"], external_ids: [{ api_source: "tmdb", external_id: "31724" }, { api_source: "anilist", external_id: "1575" }] });
  const reordered = { ...entry, titles: ["코드기아스", "Ｃｏｄｅ－Ｇｅａｓｓ"], external_ids: [...entry.external_ids!].reverse() };
  assert.equal(similarityLibrarySignature([entry]), similarityLibrarySignature([reordered]));
  for (const changed of [{ ...entry, source_id: "new" }, { ...entry, season_number: 2 }, { ...entry, air_year: 2008 }, { ...entry, titles: ["Different"] }]) {
    assert.notEqual(similarityLibrarySignature([entry]), similarityLibrarySignature([changed]));
  }
  assert.match(similarityLibrarySignature([entry]), /^sl1\.[a-f0-9]{16}$/);
  assert.equal(similarityLibrarySignature([]), similarityLibrarySignature([]));
});

test("large-library filtering indexes registration identities once rather than scanning every candidate", () => {
  let identityReads = 0;
  const entries: SimilarityLibraryEntry[] = Array.from({ length: 2000 }, (_, index) => ({
    source_api: "anilist", source_id: `saved-${index}`, content_type: "anime", air_year: 2020,
    get title_primary() { identityReads += 1; return `저장 작품 ${index}`; },
    get title_original() { identityReads += 1; return `Saved Original ${index}`; },
    get titles() { identityReads += 1; return [`Saved Alias ${index}`]; },
    get external_ids() { identityReads += 1; return [{ api_source: "tmdb", external_id: `external-${index}` }]; }
  }));
  const candidates = Array.from({ length: 150 }, (_, index) => candidate({
    external_id: `new-${index}`, title_primary: `새 작품 ${index}`, title_original: null, air_year: 2020,
    ...(index % 3 === 0 ? { external_id: `saved-${index}` } : {}),
    ...(index % 3 === 1 ? { title_primary: `Saved Alias ${index}` } : {})
  }));
  assert.deepEqual(filterUnregisteredSimilarWorks(candidates, entries).map(item => item.external_id),
    candidates.filter((_, index) => index % 3 === 2).map(item => item.external_id));
  assert.ok(identityReads <= entries.length * 8,
    `identity reads must stay linear in library size, got ${identityReads}`);
});
