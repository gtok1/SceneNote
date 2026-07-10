import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createRecommendationFeedKey,
  createRecommendationFeedState,
  refillRecommendationFeedItem,
  removeRecommendationFeedItem,
  replaceRecommendationFeed,
  restoreRecommendationFeedItem,
  setRecommendationRefillError,
  setRecommendationRefreshError,
  shouldShowRecommendationFeed
} from "./recommendationFeed";

interface FeedItem {
  id: number;
  title: string;
}

const itemId = (item: FeedItem) => item.id;

describe("recommendation feed state", () => {
  it("replaces the current batch with twelve new recommendations", () => {
    const initial = createRecommendationFeedState<FeedItem>({
      items: itemsFrom(1),
      cursor: "old-cursor",
      refreshError: "old refresh error",
      refillError: "old refill error"
    });

    const next = replaceRecommendationFeed(initial, {
      items: itemsFrom(101),
      cursor: "next-cursor",
      isExhausted: true,
      broadened: true
    });

    assert.deepEqual(next.items.map(itemId), Array.from({ length: 12 }, (_, index) => 101 + index));
    assert.equal(next.cursor, "next-cursor");
    assert.equal(next.isExhausted, true);
    assert.equal(next.broadened, true);
    assert.equal(next.refreshError, null);
    assert.equal(next.refillError, null);
    assert.deepEqual(initial.items.map(itemId), Array.from({ length: 12 }, (_, index) => 1 + index));
  });

  it("keeps the current recommendations when refresh fails", () => {
    const initial = createRecommendationFeedState<FeedItem>({ items: itemsFrom(1) });
    const failed = setRecommendationRefreshError(initial, "새 추천을 불러오지 못했습니다");

    assert.strictEqual(failed.items, initial.items);
    assert.deepEqual(failed.items, initial.items);
    assert.equal(failed.refreshError, "새 추천을 불러오지 못했습니다");
  });

  it("optimistically removes an item and restores it at its original index", () => {
    const initial = createRecommendationFeedState<FeedItem>({ items: itemsFrom(1) });
    const removal = removeRecommendationFeedItem(initial, itemId, 6);

    assert(removal.removed);
    assert.equal(removal.removed.index, 5);
    assert.equal(removal.removed.item.id, 6);
    assert.deepEqual(removal.state.items.map(itemId), [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]);

    const restored = restoreRecommendationFeedItem(removal.state, removal.removed);
    assert.deepEqual(restored.items, initial.items);
  });

  it("refills an added item at the same index", () => {
    const initial = createRecommendationFeedState<FeedItem>({ items: itemsFrom(1) });
    const removal = removeRecommendationFeedItem(initial, itemId, 6);
    assert(removal.removed);

    const refilled = refillRecommendationFeedItem(removal.state, removal.removed, item(99));

    assert.equal(refilled.items.length, 12);
    assert.equal(refilled.items[5]?.id, 99);
    assert.deepEqual(refilled.items.map(itemId), [1, 2, 3, 4, 5, 99, 7, 8, 9, 10, 11, 12]);
    assert.equal(refilled.refillError, null);
  });

  it("keeps eleven items and exposes an error when refill fails", () => {
    const initial = createRecommendationFeedState<FeedItem>({ items: itemsFrom(1) });
    const removal = removeRecommendationFeedItem(initial, itemId, 6);
    const failed = setRecommendationRefillError(removal.state, "새 추천 한 작품을 불러오지 못했습니다");

    assert.equal(failed.items.length, 11);
    assert.equal(failed.items.some((entry) => entry.id === 6), false);
    assert.equal(failed.refillError, "새 추천 한 작품을 불러오지 못했습니다");
  });

  it("shows the feed only for an empty query and restores it immediately after clearing", () => {
    assert.equal(shouldShowRecommendationFeed(""), true);
    assert.equal(shouldShowRecommendationFeed("   "), true);
    assert.equal(shouldShowRecommendationFeed("가"), false);
    assert.equal(shouldShowRecommendationFeed(" 가 "), false);
    assert.equal(shouldShowRecommendationFeed(""), true);
  });

  it("separates query keys by media type", () => {
    const dramaKey = createRecommendationFeedKey("user-1", "drama");
    const animeKey = createRecommendationFeedKey("user-1", "anime");

    assert.deepEqual(dramaKey, ["recommendations", "user-1", "personalized", "drama"]);
    assert.deepEqual(animeKey, ["recommendations", "user-1", "personalized", "anime"]);
    assert.notDeepEqual(dramaKey, animeKey);
  });
});

function itemsFrom(start: number): FeedItem[] {
  return Array.from({ length: 12 }, (_, index) => item(start + index));
}

function item(id: number): FeedItem {
  return { id, title: `작품 ${id}` };
}
