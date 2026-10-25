import assert from "node:assert/strict";
import { it } from "node:test";

it("SIM-1 fills the first 12 cards with one recommendation invocation", async () => {
  const { simulateRecommendationBatch } = await import("./recommendationInvocationStats");
  const result = simulateRecommendationBatch({
    trigger: "initial", startVisible: 0, target: 12, yields: [12],
    log: { scope: "A", entries: [] }, scope: "A", startMs: 0
  });
  assert.equal(result.calls, 1);
  assert.equal(result.finalVisible, 12);
  assert.equal(result.stoppedBy, "target");
  assert.equal(result.endMs, 1000);
  assert.deepEqual(result.log.entries, [{ reason: "initial", atMs: 0 }]);
});

it("SIM-2 fills 12 cards through three four-card responses", async () => {
  const { simulateRecommendationBatch } = await import("./recommendationInvocationStats");
  const result = simulateRecommendationBatch({
    trigger: "initial", startVisible: 0, target: 12, yields: [4, 4, 4],
    log: { scope: "A", entries: [] }, scope: "A", startMs: 0
  });
  assert.equal(result.calls, 3);
  assert.equal(result.finalVisible, 12);
  assert.equal(result.stoppedBy, "target");
  assert.equal(result.endMs, 3000);
  assert.deepEqual(result.log.entries.map(entry => entry.reason), ["initial", "continuation", "continuation"]);
});

it("SIM-3 stops a scroll batch after three no-progress responses", async () => {
  const { simulateRecommendationBatch } = await import("./recommendationInvocationStats");
  const result = simulateRecommendationBatch({
    trigger: "scroll_batch", startVisible: 5, target: 12, yields: [0, 0, 0, 0],
    log: { scope: "A", entries: [] }, scope: "A", startMs: 0
  });
  assert.equal(result.calls, 3);
  assert.equal(result.finalVisible, 5);
  assert.equal(result.stoppedBy, "no_progress");
  assert.equal(result.endMs, 3000);
});

it("SIM-4 caps three consecutive action batches at twelve automatic invocations", async () => {
  const stats = await import("./recommendationInvocationStats");
  const first = stats.simulateRecommendationBatch({
    trigger: "action_batch", startVisible: 0, target: 12, yields: Array.from({ length: 12 }, () => 1),
    log: { scope: "A", entries: [] }, scope: "A", startMs: 0
  });
  const second = stats.simulateRecommendationBatch({
    trigger: "action_batch", startVisible: first.finalVisible, target: first.finalVisible + 12,
    yields: Array.from({ length: 12 }, () => 1), log: first.log, scope: "A", startMs: first.endMs
  });
  const third = stats.simulateRecommendationBatch({
    trigger: "action_batch", startVisible: second.finalVisible, target: second.finalVisible + 12,
    yields: Array.from({ length: 12 }, () => 1), log: second.log, scope: "A", startMs: second.endMs
  });
  assert.deepEqual([first.calls, second.calls, third.calls], [6, 6, 0]);
  assert.deepEqual([first.stoppedBy, second.stoppedBy, third.stoppedBy], ["attempts", "attempts", "cap"]);
  assert.equal(third.finalVisible, 12);
  assert.equal(third.endMs, 12_000);
  assert.equal(stats.summarizeRecommendationInvocations(third.log).total, 12);
  assert.equal(third.log.entries.filter(entry => entry.reason === "continuation" || entry.reason === "action_batch").length, 12);
});
