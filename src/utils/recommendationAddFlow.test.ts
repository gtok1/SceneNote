import assert from "node:assert/strict";
import { it } from "node:test";
import * as completionFlow from "./recommendationAddFlow";
import {
  retainRecommendationAddSlots,
  createRecommendationPressGuard,
  createRecommendationAddLock,
  shouldDeferRecommendationRefill,
  computeRefillLimit,
  createTrailingScheduler,
  isRecommendationAddDisabled,
  LIBRARY_REFRESH_DEBOUNCE_MS,
  RECOMMENDATION_ADDED_TOAST,
  RECOMMENDATION_ADD_FAILED_TOAST,
  RECOMMENDATION_REFILL_DEBOUNCE_MS,
  RECOMMENDATION_TARGET_COUNT,
  type TimerApi
} from "./recommendationAddFlow";
import {
  advanceRecommendationNoProgressStreak,
  appendRecommendationFeed,
  countRecommendationDisplaySlots,
  createRecommendationFeedState,
  decideEmptyRecommendationContinuation,
  MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS,
  MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS,
  nextRecommendationBatchTarget,
  recommendationContinuationLimit,
  type EmptyRecommendationContinuationInput
} from "./recommendationFeed";

function fakeTimers() {
  let now = 0;
  const pending: { run: () => void; at: number; cancelled: boolean }[] = [];
  const timers: TimerApi = {
    set(run, ms) {
      const handle = { run, at: now + ms, cancelled: false };
      pending.push(handle);
      return handle;
    },
    clear(handle) {
      (handle as (typeof pending)[number]).cancelled = true;
    }
  };
  return {
    timers,
    advance(ms: number) {
      now += ms;
      for (const handle of [...pending]) {
        if (!handle.cancelled && handle.at <= now) {
          handle.cancelled = true;
          handle.run();
        }
      }
    }
  };
}

it("T-1 runs only the last trailing callback and clears pending state", () => {
  const clock = fakeTimers();
  const scheduler = createTrailingScheduler(800, clock.timers);
  const calls: string[] = [];
  scheduler.schedule(() => calls.push("A"));
  scheduler.schedule(() => calls.push("B"));
  scheduler.schedule(() => calls.push("C"));
  assert.equal(scheduler.isPending(), true);
  clock.advance(799);
  assert.deepEqual(calls, []);
  clock.advance(1);
  assert.deepEqual(calls, ["C"]);
  assert.equal(scheduler.isPending(), false);
});
it("T-1b cancels a trailing callback", () => {
  const clock = fakeTimers();
  const scheduler = createTrailingScheduler(800, clock.timers);
  let calls = 0;
  scheduler.schedule(() => { calls += 1; });
  scheduler.cancel();
  clock.advance(800);
  assert.equal(calls, 0);
  assert.equal(scheduler.isPending(), false);
});
it("T-2 computes only the available refill slots", () => {
  assert.deepEqual([11, 12, 3, 0, 15, NaN, 2.7].map(count => computeRefillLimit(count)), [1, 0, 9, 12, 0, 12, 10]);
  assert.equal(computeRefillLimit(5, 6), 1);
});
it("T-3 disables only pending, added or refreshing recommendation cards", () => {
  for (const isPending of [false, true]) {
    for (const isAdded of [false, true]) {
      for (const isRefreshing of [false, true]) {
        assert.equal(isRecommendationAddDisabled({ isPending, isAdded, isRefreshing }), isPending || isAdded || isRefreshing);
      }
    }
  }
});
it("T-4 exposes the agreed debounce delays and target count", () => {
  assert.equal(RECOMMENDATION_REFILL_DEBOUNCE_MS, 800);
  assert.equal(LIBRARY_REFRESH_DEBOUNCE_MS, 1500);
  assert.equal(RECOMMENDATION_TARGET_COUNT, 12);
});
it("T-5 uses fixed Korean recommendation add toasts", () => {
  assert.equal(RECOMMENDATION_ADDED_TOAST, "라이브러리에 추가했어요.");
  assert.equal(RECOMMENDATION_ADD_FAILED_TOAST, "라이브러리에 추가하지 못했어요. 잠시 후 다시 시도해 주세요.");
});

const card = (canonical_id: string) => ({ canonical_id });
it("MC-1 keeps the clicked card in place instead of moving the next card under the pointer", () => {
  const a = card("A"), b = card("B"), c = card("C");
  assert.deepEqual(retainRecommendationAddSlots([b, c], [{ item: a, index: 0 }]), [a, b, c]);
});
it("MC-2 preserves multiple clicked positions regardless of completion order", () => {
  const a = card("A"), b = card("B"), c = card("C"), d = card("D");
  assert.deepEqual(retainRecommendationAddSlots([b, d], [{ item: c, index: 2 }, { item: a, index: 0 }]), [a, b, c, d]);
});
it("MC-3 appends refill cards after the existing stable slots", () => {
  const a = card("A"), b = card("B"), c = card("C"), d = card("D");
  assert.deepEqual(retainRecommendationAddSlots([b, c, d], [{ item: a, index: 0 }]), [a, b, c, d]);
});
it("MC-4 does not duplicate a restored card or mutate cached items", () => {
  const a = card("A"), b = card("B");
  const items = Object.freeze([a, b]);
  assert.deepEqual(retainRecommendationAddSlots(items, [{ item: a, index: 0 }, { item: a, index: 0 }]), [a, b]);
  assert.deepEqual(items, [a, b]);
});
it("MC-5 rejects a release on a different recycled card", () => {
  const guard = createRecommendationPressGuard();
  guard.begin("A");
  assert.equal(guard.consume("B"), false);
});
it("MC-6 accepts a release on the same card", () => {
  const guard = createRecommendationPressGuard();
  guard.begin("A");
  assert.equal(guard.consume("A"), true);
});
it("MC-7 allows keyboard and accessibility activation without pointer-down", () => {
  assert.equal(createRecommendationPressGuard().consume("A"), true);
});
it("MC-8 defers automatic refill only while additions or the scheduled refill are pending", () => {
  for (const additionsInFlight of [false, true]) for (const scheduled of [false, true]) {
    assert.equal(shouldDeferRecommendationRefill({ additionsInFlight, scheduled }), additionsInFlight || scheduled);
  }
});
it("MC-9 locks the same card synchronously while allowing another card", () => {
  const lock = createRecommendationAddLock();
  assert.equal(lock.claim("A"), true);
  assert.equal(lock.claim("A"), false);
  assert.equal(lock.claim("B"), true);
  lock.release("A");
  assert.equal(lock.claim("A"), true);
  assert.equal(lock.claim("B"), false);
});

it("R-1 idle recommendation actions", () => assert.deepEqual(completionFlow.getRecommendationActionState({ pendingStatus: null, isAdded: false, isRefreshing: false }), { addLabel: "추가", completeLabel: "완료", disabled: false, busy: false }));
it("R-2 wishlist pending disables both actions", () => assert.deepEqual(completionFlow.getRecommendationActionState({ pendingStatus: "wishlist", isAdded: false, isRefreshing: false }), { addLabel: "추가 중", completeLabel: "완료", disabled: true, busy: true }));
it("R-3 completed pending disables both actions", () => assert.deepEqual(completionFlow.getRecommendationActionState({ pendingStatus: "completed", isAdded: false, isRefreshing: false }), { addLabel: "추가", completeLabel: "기록 중", disabled: true, busy: true }));
it("R-4 registered actions stay disabled", () => assert.deepEqual(completionFlow.getRecommendationActionState({ pendingStatus: null, isAdded: true, isRefreshing: false }), { addLabel: "추가됨", completeLabel: "완료", disabled: true, busy: false }));
it("R-5 refreshing disables both actions", () => assert.deepEqual(completionFlow.getRecommendationActionState({ pendingStatus: null, isAdded: false, isRefreshing: true }), { addLabel: "추가", completeLabel: "완료", disabled: true, busy: false }));
it("R-6 wishlist success keeps existing copy", () => assert.equal(completionFlow.recommendationAddSuccessToast("wishlist", "무빙"), "무빙 · 라이브러리에 추가했어요."));
it("R-7 completed success names the work", () => assert.equal(completionFlow.recommendationAddSuccessToast("completed", "무빙"), "무빙 · 완료로 기록했어요."));
it("R-8 empty titles omit the separator", () => {
  assert.equal(completionFlow.recommendationAddSuccessToast("completed", "  "), "완료로 기록했어요.");
  assert.equal(completionFlow.recommendationAddSuccessToast("wishlist", ""), "라이브러리에 추가했어요.");
});
it("R-9 wishlist failure keeps existing copy", () => assert.equal(completionFlow.recommendationAddFailureToast("wishlist"), RECOMMENDATION_ADD_FAILED_TOAST));
it("R-10 completed failure copy", () => assert.equal(completionFlow.recommendationAddFailureToast("completed"), "완료로 기록하지 못했어요. 잠시 후 다시 시도해 주세요."));
it("R-11 completion toast and accessibility hints", () => {
  assert.equal(completionFlow.RECOMMENDATION_COMPLETED_TOAST, "완료로 기록했어요.");
  assert.equal(completionFlow.RECOMMENDATION_ADD_HINT, "보고 싶음으로 라이브러리에 추가해요");
  assert.equal(completionFlow.RECOMMENDATION_COMPLETE_HINT, "이미 본 작품으로 완료 처리해요");
});

const batchCards = (count: number, offset = 0) => Array.from({ length: count }, (_, index) => card(`batch-${offset + index}`));
const continuationInput = (itemCount: number, targetItemCount: number): EmptyRecommendationContinuationInput => ({
  hasData: true,
  itemCount,
  targetItemCount,
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
});

it("AB-1 a completed card retains its slot while the scheduled batch requests twelve new cards", () => {
  const clock = fakeTimers();
  const scheduler = createTrailingScheduler(RECOMMENDATION_REFILL_DEBOUNCE_MS, clock.timers);
  const completed = card("batch-0");
  const candidates = batchCards(11, 1);
  const displayed = retainRecommendationAddSlots(candidates, [{ item: completed, index: 0 }]);
  const starts: { target: number; limit: number }[] = [];
  scheduler.schedule(() => {
    const count = countRecommendationDisplaySlots(candidates.map(item => item.canonical_id), [completed.canonical_id]);
    const target = nextRecommendationBatchTarget(count, 12);
    starts.push({ target, limit: recommendationContinuationLimit(count, target) });
  });
  clock.advance(800);
  assert.deepEqual(displayed, [completed, ...candidates]);
  assert.deepEqual(starts, [{ target: 24, limit: 12 }]);
});

it("AB-2 consecutive add and complete settlements share one trailing twelve-card batch", () => {
  const clock = fakeTimers();
  const scheduler = createTrailingScheduler(RECOMMENDATION_REFILL_DEBOUNCE_MS, clock.timers);
  const candidates = batchCards(33, 3);
  const retainedIds = batchCards(3).map(item => item.canonical_id);
  const starts: number[] = [];
  const start = () => starts.push(nextRecommendationBatchTarget(countRecommendationDisplaySlots(candidates.map(item => item.canonical_id), retainedIds), 36));
  scheduler.schedule(start);
  clock.advance(300);
  scheduler.schedule(start);
  clock.advance(300);
  scheduler.schedule(start);
  clock.advance(799);
  assert.deepEqual(starts, []);
  clock.advance(1);
  assert.deepEqual(starts, [48]);
});

it("AB-3 a busy batch reservation starts from the latest displayed feed after the busy request settles", () => {
  const clock = fakeTimers();
  const scheduler = createTrailingScheduler(RECOMMENDATION_REFILL_DEBOUNCE_MS, clock.timers);
  let feed = createRecommendationFeedState({ items: batchCards(23, 1) });
  const retainedIds = ["batch-0"];
  let busy = true;
  let target = 24;
  const requests: number[] = [];
  const startWhenIdle = () => {
    if (busy) {
      scheduler.schedule(startWhenIdle);
      return;
    }
    const count = countRecommendationDisplaySlots(feed.items.map(item => item.canonical_id), retainedIds);
    target = nextRecommendationBatchTarget(count, target);
    requests.push(recommendationContinuationLimit(count, target));
  };
  scheduler.schedule(startWhenIdle);
  clock.advance(800);
  assert.equal(scheduler.isPending(), true);
  assert.equal(target, 24);
  assert.deepEqual(requests, []);
  feed = appendRecommendationFeed(feed, { items: batchCards(12, 24) }, item => item.canonical_id);
  busy = false;
  clock.advance(800);
  assert.equal(target, 48);
  assert.deepEqual(requests, [12]);
});

it("AB-4 a short action batch continues for seven cards and becomes idle only at its unchanged target", () => {
  let feed = createRecommendationFeedState({ items: batchCards(11, 1) });
  const retainedIds = ["batch-0"];
  const displayedCount = () => countRecommendationDisplaySlots(feed.items.map(item => item.canonical_id), retainedIds);
  const target = nextRecommendationBatchTarget(displayedCount(), 12);
  const requests = [recommendationContinuationLimit(displayedCount(), target)];
  feed = appendRecommendationFeed(feed, { items: batchCards(5, 12), cursor: "page-2" }, item => item.canonical_id);
  assert.equal(decideEmptyRecommendationContinuation(continuationInput(displayedCount(), target)), "continue");
  requests.push(recommendationContinuationLimit(displayedCount(), target));
  feed = appendRecommendationFeed(feed, { items: batchCards(7, 17), cursor: "page-3" }, item => item.canonical_id);
  assert.deepEqual(requests, [12, 7]);
  assert.equal(target, 24);
  assert.equal(displayedCount(), 24);
  assert.equal(decideEmptyRecommendationContinuation(continuationInput(displayedCount(), target)), "idle");
});

it("AB-5 failed settlements leave no reservation and a cancelled success reservation starts no batch", () => {
  const clock = fakeTimers();
  const scheduler = createTrailingScheduler(RECOMMENDATION_REFILL_DEBOUNCE_MS, clock.timers);
  let starts = 0;
  const reserveForSettlement = (succeeded: boolean) => {
    if (succeeded) scheduler.schedule(() => { starts += 1; });
  };
  reserveForSettlement(false);
  assert.equal(scheduler.isPending(), false);
  clock.advance(800);
  assert.equal(starts, 0);
  reserveForSettlement(true);
  scheduler.cancel();
  clock.advance(800);
  assert.equal(starts, 0);
  assert.equal(scheduler.isPending(), false);
});

it("AB-6 advancing empty pages keep the action target and stop after three responses without visible progress", () => {
  let feed = createRecommendationFeedState({ items: batchCards(11, 1), cursor: "page-0" });
  const retainedIds = ["batch-0"];
  const displayedCount = () => countRecommendationDisplaySlots(feed.items.map(item => item.canonical_id), retainedIds);
  const target = nextRecommendationBatchTarget(displayedCount(), 12);
  let attempts = 0;
  let noProgress = 0;
  const requests: number[] = [];
  const decision = () => decideEmptyRecommendationContinuation({
    ...continuationInput(displayedCount(), target),
    nextCursor: feed.cursor,
    continuationAttempts: attempts,
    consecutiveNoProgressAttempts: noProgress
  });
  while (decision() === "continue") {
    requests.push(recommendationContinuationLimit(displayedCount(), target));
    const before = displayedCount();
    attempts += 1;
    feed = appendRecommendationFeed(feed, { items: [], cursor: `page-${attempts}` }, item => item.canonical_id);
    noProgress = advanceRecommendationNoProgressStreak(noProgress, before, displayedCount());
  }
  assert.deepEqual(requests, [12, 12, 12]);
  assert.equal(feed.cursor, "page-3");
  assert.equal(target, 24);
  assert.equal(decision(), "stopped");
});
