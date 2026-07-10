import assert from "node:assert/strict";
import test from "node:test";

import {
  clearRecommendationSessionSeenIds,
  collectRecommendationSessionSeenIds,
  readRecommendationSessionSeenIds,
  rememberRecommendationSessionSeenIds
} from "./recommendationSession";

test("recommendation session preserves insertion order and removes duplicates", () => {
  const userId = `session-test-${Date.now()}`;
  clearRecommendationSessionSeenIds(userId);

  rememberRecommendationSessionSeenIds(userId, ["work:one", "work:two", "work:one"]);
  rememberRecommendationSessionSeenIds(userId, ["work:three", "work:two"]);

  assert.deepEqual(readRecommendationSessionSeenIds(userId), [
    "work:one",
    "work:two",
    "work:three"
  ]);

  clearRecommendationSessionSeenIds(userId);
  assert.deepEqual(readRecommendationSessionSeenIds(userId), []);
});

test("recommendation session stores canonical, external, and title identity aliases", () => {
  const ids = collectRecommendationSessionSeenIds([
    {
      external_source: "tmdb",
      external_id: "1234",
      content_type: "kdrama",
      title_primary: "테스트 드라마",
      title_original: "Test Drama",
      air_year: 2026,
      air_date: "2026-06-01"
    }
  ]);

  assert(ids.includes("tmdb:1234"));
  assert(ids.includes("work:kdrama:테스트드라마:2026"));
  assert(ids.includes("work:kdrama:testdrama:2026"));
});

test("recommendation session falls back to memory when localStorage writes fail", () => {
  const userId = `storage-failure-${Date.now()}`;
  const originalWindow = globalThis.window;
  const failingStorage: Storage = {
    length: 0,
    clear: () => undefined,
    getItem: () => null,
    key: () => null,
    removeItem: () => undefined,
    setItem: () => {
      throw new Error("storage disabled");
    }
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: failingStorage }
  });

  try {
    rememberRecommendationSessionSeenIds(userId, ["tmdb:storage-test"]);
    assert.deepEqual(readRecommendationSessionSeenIds(userId), ["tmdb:storage-test"]);
  } finally {
    clearRecommendationSessionSeenIds(userId);
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow
      });
    }
  }
});

test("recommendation session keeps the complete seen history for a long session", () => {
  const userId = `long-session-${Date.now()}`;
  const ids = Array.from({ length: 750 }, (_, index) => `tmdb:${index + 1}`);

  try {
    rememberRecommendationSessionSeenIds(userId, ids);

    assert.deepEqual(readRecommendationSessionSeenIds(userId), ids);
  } finally {
    clearRecommendationSessionSeenIds(userId);
  }
});
