import { it } from "node:test";
import assert from "node:assert/strict";
import { createNextWatchStatuses, areSameWatchStatuses } from "./watchStatusSelection";
it("N-1: replace wishlist with watching", () => assert.deepEqual(createNextWatchStatuses(["wishlist"], "watching"), ["watching"]));
it("N-2: retain recommendation when switching primary", () => assert.deepEqual(createNextWatchStatuses(["completed", "recommended"], "watching"), ["watching", "recommended"]));
it("N-3: active primary remains selected", () => assert.deepEqual(createNextWatchStatuses(["completed"], "completed"), ["completed"]));
it("N-4: remove recommendation", () => assert.deepEqual(createNextWatchStatuses(["completed", "recommended"], "recommended"), ["completed"]));
it("N-5: retain final status", () => assert.deepEqual(createNextWatchStatuses(["recommended"], "recommended"), ["recommended"]));
it("N-6: add negative recommendation independently", () => {
  assert.deepEqual(createNextWatchStatuses(["completed"], "not_recommended"), ["completed", "not_recommended"]);
  assert.deepEqual(createNextWatchStatuses(["completed", "recommended"], "not_recommended"), ["completed", "recommended", "not_recommended"]);
});
it("N-7: select from empty statuses", () => assert.deepEqual(createNextWatchStatuses([], "wishlist"), ["wishlist"]));
it("A-1: compare status membership", () => {
  assert.equal(areSameWatchStatuses(["completed", "recommended"], ["recommended", "completed"]), true);
  assert.equal(areSameWatchStatuses(["completed"], ["completed", "recommended"]), false);
  assert.equal(areSameWatchStatuses([], []), true);
});
