import assert from "node:assert/strict";
import { it } from "node:test";

it("IS-1 summarizes recommendation invocations by reason", async () => {
  const stats = await import("./recommendationInvocationStats");
  let log = stats.recordRecommendationInvocation({ scope: "A", entries: [] }, "A", "initial", 0);
  log = stats.recordRecommendationInvocation(log, "A", "continuation", 1000);
  log = stats.recordRecommendationInvocation(log, "A", "impressions", 2000);
  assert.deepEqual(stats.summarizeRecommendationInvocations(log), {
    total: 3, byReason: { initial: 1, continuation: 1, impressions: 1 }
  });
});

it("IS-2 starts a new invocation log when scope changes", async () => {
  const stats = await import("./recommendationInvocationStats");
  let log = stats.recordRecommendationInvocation({ scope: "A", entries: [] }, "A", "initial", 0);
  log = stats.recordRecommendationInvocation(log, "A", "continuation", 1000);
  log = stats.recordRecommendationInvocation(log, "A", "impressions", 2000);
  const next = stats.recordRecommendationInvocation(log, "B", "initial", 3000);
  assert.deepEqual(next, { scope: "B", entries: [{ reason: "initial", atMs: 3000 }] });
});

it("IS-3 retains only the latest 200 invocations", async () => {
  const stats = await import("./recommendationInvocationStats");
  let log = stats.recordRecommendationInvocation({ scope: "A", entries: [] }, "A", "initial", 0);
  for (let atMs = 1; atMs < 205; atMs++) {
    log = stats.recordRecommendationInvocation(log, "A", "continuation", atMs);
  }
  assert.equal(log.entries.length, 200);
  assert.equal(log.entries[0]?.atMs, 5);
  assert.equal(log.entries.at(-1)?.atMs, 204);
});

it("IS-4 blocks the thirteenth recent automatic invocation", async () => {
  const stats = await import("./recommendationInvocationStats");
  const nowMs = 100_000;
  let log = stats.recordRecommendationInvocation({ scope: "A", entries: [] }, "A", "continuation", nowMs - 10_000);
  for (let index = 1; index < 12; index++) {
    log = stats.recordRecommendationInvocation(log, "A", index < 6 ? "continuation" : "action_batch", nowMs - 10_000);
  }
  assert.equal(stats.canStartAutomaticRecommendationInvocation(log, "A", nowMs), false);
});

it("IS-5 permits automatic invocations after the 60-second window", async () => {
  const stats = await import("./recommendationInvocationStats");
  const nowMs = 100_000;
  let log = stats.recordRecommendationInvocation({ scope: "A", entries: [] }, "A", "continuation", nowMs - 61_000);
  for (let index = 1; index < 12; index++) {
    log = stats.recordRecommendationInvocation(log, "A", index < 6 ? "continuation" : "action_batch", nowMs - 61_000);
  }
  assert.equal(stats.canStartAutomaticRecommendationInvocation(log, "A", nowMs), true);
});

it("IS-6 excludes manual scroll refresh and resume from the automatic cap", async () => {
  const stats = await import("./recommendationInvocationStats");
  const nowMs = 100_000;
  const reasons = ["scroll_batch", "refresh", "resume"] as const;
  let log = stats.recordRecommendationInvocation({ scope: "A", entries: [] }, "A", "scroll_batch", nowMs - 5000);
  for (let index = 1; index < 20; index++) {
    log = stats.recordRecommendationInvocation(log, "A", reasons[index % reasons.length]!, nowMs - 5000);
  }
  assert.equal(log.entries.length, 20);
  assert.equal(stats.canStartAutomaticRecommendationInvocation(log, "A", nowMs), true);
});

it("IS-7 permits automatic invocations in a different scope", async () => {
  const stats = await import("./recommendationInvocationStats");
  const nowMs = 100_000;
  let log = stats.recordRecommendationInvocation({ scope: "A", entries: [] }, "A", "continuation", nowMs - 1000);
  for (let index = 1; index < 12; index++) {
    log = stats.recordRecommendationInvocation(log, "A", "action_batch", nowMs - 1000);
  }
  assert.equal(stats.canStartAutomaticRecommendationInvocation(log, "B", nowMs), true);
});
