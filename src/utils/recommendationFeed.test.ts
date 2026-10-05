import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendRecommendationFeed,
  createRecommendationFeedKey,
  createRecommendationFeedState,
  getRecommendationRetryAction,
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

import * as batchFlow from "./recommendationFeed";

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

    assert.deepEqual(dramaKey, ["recommendations", "user-1", "personalized", "drama", "[[],[]]", '[[],[],[]]']);
    assert.deepEqual(animeKey, ["recommendations", "user-1", "personalized", "anime", "[[],[]]", '[[],[],[]]']);
    assert.notDeepEqual(dramaKey, animeKey);
  });

  it("separates account filters without changing the account invalidation prefix", () => {
    const unrestricted = createRecommendationFeedKey("user-1", "all");
    const filtered = createRecommendationFeedKey("user-1", "all", '[["boys-love"],[]]');
    const otherUser = createRecommendationFeedKey("user-2", "all", '[["boys-love"],[]]');
    assert.notDeepEqual(unrestricted, filtered);
    assert.notDeepEqual(filtered, otherUser);
    assert.deepEqual(filtered.slice(0, 2), ["recommendations", "user-1"]);
  });

  it("keeps positive genre/country feeds and their scan cursors separate", () => {
    const krComedy = createRecommendationFeedKey("user-1", "all", "[[],[]]", '["comedy","KR"]');
    const jpComedy = createRecommendationFeedKey("user-1", "all", "[[],[]]", '["comedy","JP"]');
    const krDrama = createRecommendationFeedKey("user-1", "all", "[[],[]]", '["drama","KR"]');
    assert.notDeepEqual(krComedy, jpComedy);
    assert.notDeepEqual(krComedy, krDrama);
    assert.deepEqual(krComedy.slice(0, 2), ["recommendations", "user-1"]);
  });

  it("retries a zero-visible response from its saved continuation instead of page one", () => {
    assert.equal(getRecommendationRetryAction(undefined), "initial");
    assert.equal(getRecommendationRetryAction({ has_more: true, next_cursor: "older-month", is_exhausted: false }), "continue");
  });

  it("does not restart a completed scan when retry is repeated", () => {
    for (const page of [
      { has_more: false, next_cursor: "stale-cursor", is_exhausted: false },
      { has_more: true, next_cursor: null, is_exhausted: false },
      { has_more: true, next_cursor: "old-cursor", is_exhausted: true }
    ]) {
      assert.equal(getRecommendationRetryAction(page), "complete");
      assert.equal(getRecommendationRetryAction(page), "complete");
    }
  });
});

function itemsFrom(start: number): FeedItem[] {
  return Array.from({ length: 12 }, (_, index) => item(start + index));
}

function item(id: number): FeedItem {
  return { id, title: `작품 ${id}` };
}


const unsupportedFilterContinuationBase = {
  hasData: true, itemCount: 0, targetItemCount: 12, isLoading: false,
  hasError: false, hasMore: true, nextCursor: "page-2", isExhausted: false,
  continuationAttempts: 0, consecutiveNoProgressAttempts: 0,
  maxContinuationAttempts: 6, elapsedMs: 0, maxDurationMs: 45000
};
it("C-1 unsupported filter stops automatic continuation", () => {
  assert.equal(decideEmptyRecommendationContinuation({ ...unsupportedFilterContinuationBase, unsupportedFilter: true }), "stopped");
});
it("C-2 supported or absent filter flag preserves continuation", () => {
  assert.equal(decideEmptyRecommendationContinuation({ ...unsupportedFilterContinuationBase, unsupportedFilter: false }), "continue");
  assert.equal(decideEmptyRecommendationContinuation(unsupportedFilterContinuationBase), "continue");
});
it("C-3 a complete batch remains idle with unsupported filters", () => {
  assert.equal(decideEmptyRecommendationContinuation({ ...unsupportedFilterContinuationBase, unsupportedFilter: true, itemCount: 12 }), "idle");
});
it("C-4 loading takes precedence over unsupported filters", () => {
  assert.equal(decideEmptyRecommendationContinuation({ ...unsupportedFilterContinuationBase, unsupportedFilter: true, isLoading: true }), "loading");
});


describe("recommendation batch top-up", () => {
  const ready = {
    visibleCount: 12, hasMore: true, nextCursor: "page-2",
    lastRequestedCursor: "page-1", isExhausted: false, isLoading: false,
    hasError: false, automaticSearchStopped: false, scrolledDown: true, nearEnd: true
  };
  const stoppedReady = {
    ...ready, visibleCount: 7, nextCursor: "page-3",
    lastRequestedCursor: "page-2", automaticSearchStopped: true
  };
  const base = {
    hasData: true, itemCount: 0, targetItemCount: PERSONALIZED_RECOMMENDATION_BATCH_SIZE,
    isLoading: false, hasError: false, hasMore: true, nextCursor: "page-2",
    isExhausted: false, continuationAttempts: 0, consecutiveNoProgressAttempts: 0,
    maxContinuationAttempts: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS,
    elapsedMs: 0, maxDurationMs: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS
  };

  it("B-1 advances the target by twelve visible cards without lowering it", () => {
    for (const [visible, target, expected] of [
      [12, 12, 24], [17, 24, 29], [24, 36, 36], [0, 12, 12],
      [NaN, 12, 12], [13, 12, 25], [12.7, 12, 24]
    ] as const) assert.equal(batchFlow.nextRecommendationBatchTarget(visible, target), expected);
  });
  it("B-2 starts a new batch only when the current target is reached", () => {
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, visibleCount: 17, targetCount: 24 }), false);
    assert.equal(shouldAutoLoadNextRecommendationBatch({ ...ready, visibleCount: 24, targetCount: 24 }), true);
    assert.equal(shouldAutoLoadNextRecommendationBatch(ready), true);
  });
  it("B-3 resumes a stopped partial batch below its current target", () => {
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...stoppedReady, visibleCount: 17, targetCount: 24 }), true);
    assert.equal(shouldResumeRecommendationSearchOnScroll({ ...stoppedReady, visibleCount: 24, targetCount: 24 }), false);
    assert.equal(shouldResumeRecommendationSearchOnScroll(stoppedReady), true);
  });
  it("B-4 preserves continuation below a supplied target and idle at that target", () => {
    assert.equal(decideEmptyRecommendationContinuation({ ...base, itemCount: 17, targetItemCount: 24 }), "continue");
    assert.equal(decideEmptyRecommendationContinuation({ ...base, itemCount: 24, targetItemCount: 24 }), "idle");
  });
  it("B-5 limits continuation to the missing count with a twelve-card cap", () => {
    for (const [visible, target, expected] of [
      [17, 24, 7], [0, 12, 12], [24, 24, 0], [5, 36, 12], [30, 24, 0], [NaN, 12, 12]
    ] as const) assert.equal(batchFlow.recommendationContinuationLimit(visible, target), expected);
  });
});


describe("recommendation displayed batch count", () => {
  it("counts retained added cards once alongside remaining recommendations", () => {
    assert.equal(batchFlow.countRecommendationDisplaySlots(["b", "c"], ["a"]), 3);
    assert.equal(batchFlow.countRecommendationDisplaySlots(["a", "b"], ["a", "a"]), 2);
  });
  it("does not refill a twelve-card screen just because one card was registered", () => {
    const visible = Array.from({ length: 11 }, (_, index) => `remaining-${index}`);
    const displayed = batchFlow.countRecommendationDisplaySlots(visible, ["added"]);
    assert.equal(displayed, 12);
    assert.equal(batchFlow.recommendationContinuationLimit(displayed, 12), 0);
    assert.equal(batchFlow.nextRecommendationBatchTarget(displayed, 12), 24);
  });
  it("keeps the displayed target after three registered cards and fills only missing slots", () => {
    const retained = ["added-a", "added-b", "added-c"];
    const displayed = batchFlow.countRecommendationDisplaySlots(
      Array.from({ length: 33 }, (_, index) => `remaining-${index}`), retained
    );
    assert.equal(displayed, 36);
    assert.equal(batchFlow.nextRecommendationBatchTarget(displayed, 36), 48);
    assert.equal(batchFlow.recommendationContinuationLimit(displayed + 5, 48), 7);
  });
  it("allows two empty advancing pages above twelve cards and stops on the third", () => {
    const base = { ...unsupportedFilterContinuationBase, itemCount: 17, targetItemCount: 24 };
    assert.equal(decideEmptyRecommendationContinuation({ ...base, consecutiveNoProgressAttempts: 1 }), "continue");
    assert.equal(decideEmptyRecommendationContinuation({ ...base, consecutiveNoProgressAttempts: 2 }), "continue");
    assert.equal(decideEmptyRecommendationContinuation({ ...base, consecutiveNoProgressAttempts: 3 }), "stopped");
  });
});
