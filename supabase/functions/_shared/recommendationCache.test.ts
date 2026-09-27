import assert from "node:assert/strict";
import { it } from "node:test";

import { createPersistentRecommendationCache, type RecommendationCacheStore } from "./recommendationCache.ts";

it("reuses provider metadata across cache instances and keeps provider keys isolated", async () => {
  const rows = new Map<string, { value: unknown; expiresAt: string }>();
  const store: RecommendationCacheStore = {
    async read(key, source) { return rows.get(`${source}:${key}`) ?? null; },
    async write(key, source, value, expiresAt) { rows.set(`${source}:${key}`, { value, expiresAt }); }
  };
  const firstInstance = createPersistentRecommendationCache(store, () => 1_000);
  await firstInstance.set("page:filters-a", "tmdb", { items: ["eligible"] }, 10_000);
  const coldInstance = createPersistentRecommendationCache(store, () => 2_000);
  assert.deepEqual(await coldInstance.get("page:filters-a", "tmdb"), { items: ["eligible"] });
  assert.equal(await coldInstance.get("page:filters-a", "anilist"), null);
  assert.equal(await coldInstance.get("page:filters-b", "tmdb"), null);
  const expiredInstance = createPersistentRecommendationCache(store, () => 11_000);
  assert.equal(await expiredInstance.get("page:filters-a", "tmdb"), null);
});

it("preserves cached empty metadata and negative lookups instead of treating them as a cache miss", async () => {
  const values = [{ keywords: [] }, { keywords: null }];
  for (const value of values) {
    const cache = createPersistentRecommendationCache({
      async read() { return { value, expiresAt: new Date(10_000).toISOString() }; },
      async write() {}
    }, () => 1_000);
    assert.deepEqual(await cache.get("keyword", "tmdb"), value);
  }
});

it("treats unavailable or stalled cache storage as a bounded miss", async () => {
  const failing = createPersistentRecommendationCache({
    async read() { throw new Error("storage unavailable"); },
    async write() { throw new Error("storage unavailable"); }
  });
  assert.equal(await failing.get("page", "tmdb"), null);
  await assert.doesNotReject(failing.set("page", "tmdb", {}, 1_000));
  const stalled = createPersistentRecommendationCache({
    read: () => new Promise(() => {}),
    write: () => new Promise(() => {})
  }, Date.now, 5);
  assert.equal(await stalled.get("page", "tmdb"), null);
  await stalled.set("page", "tmdb", {}, 1_000);
});

it("does not start cache operations after the response deadline", async () => {
  let operations = 0;
  const cache = createPersistentRecommendationCache({
    async read() { operations += 1; return null; },
    async write() { operations += 1; }
  }, () => 5_000, 800, 5_000);
  assert.equal(await cache.get("page", "tmdb"), null);
  await cache.set("page", "tmdb", {}, 1_000);
  assert.equal(operations, 0);
});
