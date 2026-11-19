import assert from "node:assert/strict";
import { it } from "node:test";

import {
  createRecommendationExclusionActions,
  type RecommendationExclusion,
  type RecommendationExclusionSet,
  type RecommendationExclusionSlice
} from "./recommendationExclusionActions";

const FIXED_TIME = "2026-11-19T00:00:00.000Z";

function exclusion(key: string): RecommendationExclusion {
  return { key, title: `작품 ${key}`, excludedAt: FIXED_TIME };
}

function createFakeStore(items: RecommendationExclusion[] = []) {
  let state: RecommendationExclusionSlice = {
    excludedRecommendations: items.map(item => ({ ...item })),
    excludedRecommendationKeys: items.map(item => item.key)
  };
  const calls: Parameters<RecommendationExclusionSet>[0][] = [];
  const set: RecommendationExclusionSet = partial => {
    calls.push(partial);
    const next = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...next };
  };
  const actions = createRecommendationExclusionActions(set, () => new Date(FIXED_TIME));
  return { get state() { return state; }, calls, actions };
}

it("79 T-1: clearExclusions empties exclusions and keys", () => {
  const store = createFakeStore([exclusion("a"), exclusion("b")]);
  store.actions.clearExclusions();
  assert.deepEqual(store.state.excludedRecommendations, []);
  assert.deepEqual(store.state.excludedRecommendationKeys, []);
});

it("79 T-2: clearExclusions updates the store exactly once", () => {
  const store = createFakeStore([exclusion("a")]);
  store.actions.clearExclusions();
  assert.equal(store.calls.length, 1);
});

it("79 T-3: excludeRecommendation appends with default title, injected time and synced keys", () => {
  const store = createFakeStore();
  store.actions.excludeRecommendation("k1");
  assert.deepEqual(store.state.excludedRecommendations, [
    { key: "k1", title: "제목 없는 작품", excludedAt: "2026-11-19T00:00:00.000Z" }
  ]);
  assert.deepEqual(store.state.excludedRecommendationKeys, ["k1"]);
});

it("79 T-4: excludeRecommendation ignores a duplicate key", () => {
  const store = createFakeStore([exclusion("a")]);
  const before: RecommendationExclusionSlice = {
    excludedRecommendations: store.state.excludedRecommendations.map(item => ({ ...item })),
    excludedRecommendationKeys: [...store.state.excludedRecommendationKeys]
  };
  store.actions.excludeRecommendation("a", "다른 제목");
  assert.deepEqual(store.state, before);
});

it("79 T-5: removeExclusion removes only the given key and keeps order", () => {
  const a = exclusion("a");
  const b = exclusion("b");
  const c = exclusion("c");
  const store = createFakeStore([a, b, c]);
  store.actions.removeExclusion("b");
  assert.deepEqual(store.state.excludedRecommendations, [a, c]);
  assert.deepEqual(store.state.excludedRecommendationKeys, ["a", "c"]);
});

it("79 T-6: clearExclusions on an empty state stays empty", () => {
  const store = createFakeStore();
  assert.doesNotThrow(() => store.actions.clearExclusions());
  assert.deepEqual(store.state.excludedRecommendations, []);
  assert.deepEqual(store.state.excludedRecommendationKeys, []);
});
