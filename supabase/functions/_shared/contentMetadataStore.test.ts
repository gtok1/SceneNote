import assert from "node:assert/strict";
import { test } from "node:test";
import { contentMetadataCacheKey, readContentMetadata } from "./contentMetadataStore.ts";
import type { ContentMeta } from "./types.ts";

const fixture = (title = "저장 작품"): ContentMeta => ({
  external_source: "tmdb", external_id: "123", content_type: "jdrama",
  title_primary: title, title_original: "Original", poster_url: null, overview: "줄거리",
  localized_overview: null, air_year: 2026, air_date: "2026-10-01", end_date: null,
  has_seasons: true, episode_count: 10, genres: ["드라마"], seasons: [
    { season_number: 1, title: null, episode_count: 10, air_year: 2026 }
  ], cast: [], crew: []
});

function memoryStore() {
  const rows = new Map<string, unknown>();
  return {
    rows,
    reads: 0,
    writes: 0,
    async read(key: string, source: string) { this.reads++; return rows.get(`${source}:${key}`) ?? null; },
    async write(key: string, source: string, value: unknown) { this.writes++; rows.set(`${source}:${key}`, value); }
  };
}

test("CM-1 isolates source, movie, tv and external ids in the persisted key", () => {
  const keys = [
    contentMetadataCacheKey("tmdb", "123", "tv"),
    contentMetadataCacheKey("tmdb", "123", "movie"),
    contentMetadataCacheKey("anilist", "123", "tv"),
    contentMetadataCacheKey("tmdb", "456", "tv"),
    contentMetadataCacheKey("tmdb", "123")
  ];
  assert.equal(new Set(keys).size, keys.length);
  assert.match(keys[0]!, /content-metadata.*v1/);
});

test("CM-2 persists the first full metadata and reuses it without a second external call", async () => {
  const store = memoryStore(); let calls = 0;
  const read = () => readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv", store,
    fetchFresh: async () => { calls++; return fixture(); } });
  assert.equal((await read()).fromCache, false);
  assert.deepEqual((await read()).data, fixture());
  assert.equal((await read()).fromCache, true);
  assert.equal(calls, 1); assert.equal(store.writes, 1);
});

test("CM-3 reuses cast, crew, localized text and explicitly empty arrays", async () => {
  const store = memoryStore(); const value = fixture();
  value.localized_overview = "한국어 줄거리";
  value.cast = [{ source: "tmdb", id: 7, name: "배우", original_name: null, character: "주연", profile_url: null, order: 0 }];
  value.crew = [{ id: 8, name: "감독", original_name: null, role: "director", job: "Director", profile_url: null }];
  await readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv", store, fetchFresh: async () => value });
  const result = await readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv", store,
    fetchFresh: async () => { throw new Error("must not fetch"); } });
  assert.deepEqual(result.data, value); assert.equal(result.fromCache, true);
});

test("CM-4 explicit refresh replaces the previous snapshot only after success", async () => {
  const store = memoryStore();
  await readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv", store, fetchFresh: async () => fixture() });
  const result = await readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv", store,
    forceRefresh: true, fetchFresh: async () => fixture("새 작품 정보") });
  assert.equal(result.fromCache, false); assert.equal(result.data.title_primary, "새 작품 정보");
  assert.equal(store.writes, 2);
});

test("CM-5 refresh failure leaves the previous persisted value intact", async () => {
  const store = memoryStore();
  await readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv", store, fetchFresh: async () => fixture() });
  await assert.rejects(readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv", store,
    forceRefresh: true, fetchFresh: async () => { throw new Error("offline"); } }));
  const result = await readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv", store,
    fetchFresh: async () => { throw new Error("must not fetch"); } });
  assert.equal(result.data.title_primary, "저장 작품"); assert.equal(store.writes, 1);
});

test("CM-6 does not persist an invalid or mismatched fresh response", async () => {
  for (const patch of [ { external_id: "999" }, { external_source: "anilist" }, { cast: null }, { title_primary: "" }, { content_type: "movie" } ]) {
    const store = memoryStore();
    await assert.rejects(readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv", store,
      fetchFresh: async () => ({ ...fixture(), ...patch }) as ContentMeta }));
    assert.equal(store.writes, 0);
  }
});

test("CM-7 does not persist a content_id or a user's registered status", async () => {
  const store = memoryStore();
  const result = await readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv", store,
    fetchFresh: async () => ({ ...fixture(), content_id: "stale-id", registered: true }) as ContentMeta });
  assert.equal("content_id" in result.data, false);
  assert.equal("registered" in result.data, false);
});

test("CM-8 a database read failure must not silently trigger an external call", async () => {
  let calls = 0;
  await assert.rejects(readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv",
    store: { read: async () => { throw new Error("DB unavailable"); }, write: async () => undefined },
    fetchFresh: async () => { calls++; return fixture(); } }));
  assert.equal(calls, 0);
});

test("CM-9 rejects malformed nested cached cast, crew, season and tag entries without an external call", async () => {
  const invalid = [
    { cast: [null] }, { cast: [{ id: 1, name: 123 }] },
    { crew: [null] }, { crew: [{ id: 8, name: "감독", role: "unknown" }] },
    { seasons: [null] }, { seasons: [{ season_number: "1" }] },
    { source_tags: [null] }, { genres: [123] }, { episode_count: "10" }
  ];
  for (const patch of invalid) {
    const store = memoryStore(); let calls = 0;
    store.rows.set(`tmdb:${contentMetadataCacheKey("tmdb", "123", "tv")}`, { ...fixture(), ...patch });
    await assert.rejects(readContentMetadata({ source: "tmdb", externalId: "123", mediaType: "tv", store,
      fetchFresh: async () => { calls++; return fixture(); } }));
    assert.equal(calls, 0); assert.equal(store.writes, 0);
  }
});
