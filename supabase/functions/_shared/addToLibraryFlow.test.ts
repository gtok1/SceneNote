import assert from "node:assert/strict";
import { it } from "node:test";
import { planAddToLibraryPath, runAfterResponse } from "./addToLibraryFlow.ts";

it("A-1 selects existing, fast insert and fetch insert paths", () => {
  assert.equal(planAddToLibraryPath({ existingContentId: "c1", existingLibraryItemId: "l1" }), "already_exists");
  assert.equal(planAddToLibraryPath({ existingContentId: "c1", existingLibraryItemId: null }), "fast_insert");
  assert.equal(planAddToLibraryPath({ existingContentId: null, existingLibraryItemId: null }), "fetch_and_insert");
  assert.equal(planAddToLibraryPath({ existingContentId: null, existingLibraryItemId: "l1" }), "fetch_and_insert");
});
it("B-1 awaits background work when waitUntil is unavailable", async () => {
  for (const runtime of [undefined, {}]) {
    let completed = false;
    await runAfterResponse(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      completed = true;
    }, runtime);
    assert.equal(completed, true);
  }
});
it("B-2 registers background work without waiting and catches its rejection", async () => {
  let completed = false;
  const captured: Promise<unknown>[] = [];
  let release!: () => void;
  const deferred = new Promise<void>(resolve => { release = resolve; });
  await runAfterResponse(async () => {
    await deferred;
    completed = true;
    throw new Error("background failure");
  }, { waitUntil: promise => { captured.push(promise); } });
  assert.equal(completed, false);
  assert.equal(captured.length, 1);
  release();
  await assert.doesNotReject(captured[0]);
  assert.equal(completed, true);
});
it("B-3 propagates task errors without waitUntil", async () => {
  const error = new Error("background failure");
  await assert.rejects(runAfterResponse(async () => { throw error; }, undefined), caught => caught === error);
});
