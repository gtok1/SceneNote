import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendRecommendationFeed,
  createRecommendationFeedKey,
  createRecommendationFeedState,
  decideEmptyRecommendationContinuation,
  advanceRecommendationNoProgressStreak,
  MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS,
  MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS,
  MAX_CONSECUTIVE_RECOMMENDATION_NO_PROGRESS_ATTEMPTS,
  MINIMUM_AUTOMATIC_RECOMMENDATION_REQUEST_BUDGET_MS,
  PERSONALIZED_RECOMMENDATION_BATCH_SIZE,
  refillRecommendationFeedItem,
  removeRecommendationFeedItem,
  replaceRecommendationFeed,
  restoreRecommendationFeedItem,
  setRecommendationRefillError,
  setRecommendationRefreshError,
  shouldAutoLoadNextRecommendationBatch,
  shouldResumeRecommendationSearchOnScroll,
  shouldShowRecommendationFeed
} from "./recommendationFeed";

interface FeedItem {
  id: number;
  title: string;
}

const itemId = (item: FeedItem) => item.id;

describe("recommendation feed state", () => {
  it("continues incomplete pages only within the bounded scan budget", () => {
    const base = {
      hasData: true,
      itemCount: 0,
      targetItemCount: PERSONALIZED_RECOMMENDATION_BATCH_SIZE,
      isLoading: false,
      hasError: false,
      hasMore: true,
      nextCursor: "page-2",
      isExhausted: false,
      continuationAttempts: 0,
      consecutiveNoProgressAttempts: 0,
      maxContinuationAttempts: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS,
      elapsedMs: 0,
      maxDurationMs: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS
    };

    assert.equal(decideEmptyRecommendationContinuation(base), "continue");
    assert.equal(
      decideEmptyRecommendationContinuation({
        ...base,
        continuationAttempts: 2,
        elapsedMs: 9_000
      }),
      "continue"
    );
    assert.equal(
      decideEmptyRecommendationContinuation({
        ...base,
        continuationAttempts: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS - 1,
        elapsedMs: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS - MINIMUM_AUTOMATIC_RECOMMENDATION_REQUEST_BUDGET_MS
      }),
      "continue"
    );
    assert.equal(MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS, 6);
    assert.equal(MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS, 45_000);
    assert.equal(
      decideEmptyRecommendationContinuation({
        ...base,
        elapsedMs: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS - MINIMUM_AUTOMATIC_RECOMMENDATION_REQUEST_BUDGET_MS + 1
      }),
      "stopped"
    );
    assert.equal(
      decideEmptyRecommendationContinuation({
        ...base,
        consecutiveNoProgressAttempts: MAX_CONSECUTIVE_RECOMMENDATION_NO_PROGRESS_ATTEMPTS
      }),
      "stopped"
    );
    assert.equal(
      decideEmptyRecommendationContinuation({ ...base, isLoading: true }),
      "loading"
    );
    assert.equal(
      decideEmptyRecommendationContinuation({
        ...base,
        continuationAttempts: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS
      }),
      "stopped"
    );
    assert.equal(
      decideEmptyRecommendationContinuation({
        ...base,
        elapsedMs: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS
      }),
      "stopped"
    );
    assert.equal(
      decideEmptyRecommendationContinuation({ ...base, hasError: true }),
      "stopped"
    );
    assert.equal(
      decideEmptyRecommendationContinuation({ ...base, nextCursor: null }),
      "stopped"
    );
    assert.equal(
      decideEmptyRecommendationContinuation({ ...base, itemCount: 1 }),
      "continue"
    );
    assert.equal(
      decideEmptyRecommendationContinuation({
        ...base,
        itemCount: PERSONALIZED_RECOMMENDATION_BATCH_SIZE
      }),
      "idle"
    );
    assert.equal(
      decideEmptyRecommendationContinuation({ ...base, isExhausted: true }),
      "idle"
    );
  });

  it("stops after three zero-growth rounds and resets the streak when visible cards grow", () => {
    assert.equal(MAX_CONSECUTIVE_RECOMMENDATION_NO_PROGRESS_ATTEMPTS, 3);
    let streak = 0;
    streak = advanceRecommendationNoProgressStreak(streak, 2, 2);
    assert.equal(streak, 1);
    streak = advanceRecommendationNoProgressStreak(streak, 2, 2);
    assert.equal(streak, 2);
    streak = advanceRecommendationNoProgressStreak(streak, 2, 3);
    assert.equal(streak, 0);
    streak = advanceRecommendationNoProgressStreak(streak, 3, 3);
    assert.equal(streak, 1);
    streak = advanceRecommendationNoProgressStreak(streak, 3, 3);
    streak = advanceRecommendationNoProgressStreak(streak, 3, 3);
    assert.equal(streak, 3);
  });

  it("does not restart short or failed recommendation scans from list end", () => {
    const ready = {
      visibleCount: PERSONALIZED_RECOMMENDATION_BATCH_SIZE,
      hasMore: true,
      nextCursor: "page-2",
      lastRequestedCursor: "page-1",
      isExhausted: false,
      isLoading: false,
      hasError: false,
      automaticSearchStopped: false,
      scrolledDown: true,
      nearEnd: true
    };
    assert.equal(shouldAutoLoadNextRecommendationBatch(ready), true);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, scrolledDown: false }), false);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, nearEnd: false }), false);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, lastRequestedCursor: "page-2" }), false);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, nextCursor: "page-3" }), true);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, visibleCount: 3 }), false);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, hasError: true }), false);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, automaticSearchStopped: true }), false);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, isLoading: true }), false);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, hasMore: false }), false);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, nextCursor: null }), false);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, nextCursor: "" }), false);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, isExhausted: true }), false);
  });

  it("resumes a stopped partial feed only after a new downward near-end scroll", () => {
    const ready = {
      visibleCount: 7,
      hasMore: true,
      nextCursor: "page-3",
      lastRequestedCursor: "page-2",
      isExhausted: false,
      isLoading: false,
      hasError: false,
      automaticSearchStopped: true,
      scrolledDown: true,
      nearEnd: true
    };

    assert.equal(shouldResumeRecommendationSearchOnScroll(ready), true);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, scrolledDown: false }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, nearEnd: false }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, lastRequestedCursor: "page-3" }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, isLoading: true }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, hasError: true }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, isExhausted: true }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, nextCursor: null }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, nextCursor: "" }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, hasMore: false }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, automaticSearchStopped: false }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, visibleCount: 0 }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...ready, visibleCount: PERSONALIZED_RECOMMENDATION_BATCH_SIZE }), false);
  });

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

  it("appends the next batch below existing cards without duplicates", () => {
    const initial = createRecommendationFeedState<FeedItem>({
      items: itemsFrom(1),
      cursor: "page-2"
    });
    const appended = appendRecommendationFeed(
      initial,
      { items: [item(12), ...itemsFrom(13)], cursor: "page-3", broadened: true },
      itemId
    );

    assert.deepEqual(appended.items.map(itemId), Array.from({ length: 24 }, (_, index) => index + 1));
    assert.equal(appended.cursor, "page-3");
    assert.equal(appended.broadened, true);
  });

  it("rejects cross-source identity aliases already shown or appended in the same batch", () => {
    interface CrossSourceItem {
      id: string;
      aliases: string[];
    }
    const first: CrossSourceItem = {
      id: "tmdb:tv:123",
      aliases: ["tmdb:tv:123", "title:shared-drama"]
    };
    const incoming: CrossSourceItem[] = [
      { id: "tvmaze:55", aliases: ["tvmaze:55", "title:shared-drama"] },
      { id: "anilist:10", aliases: ["anilist:10", "title:new-anime"] },
      { id: "kitsu:11", aliases: ["kitsu:11", "title:new-anime"] },
      { id: "tmdb:tv:999", aliases: ["tmdb:tv:999", "title:other-drama"] }
    ];
    const initial = createRecommendationFeedState<CrossSourceItem>({ items: [first] });

    const withAliases = appendRecommendationFeed(
      initial,
      { items: incoming, cursor: "page-3" },
      (item) => item.id,
      (item) => item.aliases
    );
    assert.deepEqual(withAliases.items.map((item) => item.id), ["tmdb:tv:123", "anilist:10", "tmdb:tv:999"]);

    const legacy = appendRecommendationFeed(initial, { items: incoming }, (item) => item.id);
    assert.equal(legacy.items.length, 5);
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
