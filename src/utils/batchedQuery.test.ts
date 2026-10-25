import { it } from "node:test";
import assert from "node:assert/strict";
import { readBatchedRows } from "./batchedQuery";

it("splits 628 content IDs into bounded queries without omissions", async () => {
  const ids = Array.from({ length: 628 }, (_, i) => `content-${i}`);
  const batches: string[][] = [];
  const result = await readBatchedRows(ids, async (batch, from, to) => {
    batches.push(batch);
    assert.equal(from, 0);
    assert.equal(to, 999);
    assert.ok(batch.length <= 100);
    return { data: batch, error: null };
  });
  assert.deepEqual(batches.map(batch => batch.length), [100, 100, 100, 100, 100, 100, 28]);
  assert.deepEqual(result.data, ids);
});
it("reads additional pages and resets pagination for each ID batch", async () => {
  const calls: [string[], number, number][] = [];
  const result = await readBatchedRows(["a", "b"], async (ids, from, to) => {
    calls.push([ids, from, to]);
    const rows = ids[0] === "a" ? [1, 2, 3] : [4];
    return { data: rows.slice(from, to + 1), error: null };
  }, 1, 2);
  assert.deepEqual(result.data, [1, 2, 3, 4]);
  assert.deepEqual(calls, [[["a"], 0, 1], [["a"], 2, 3], [["b"], 0, 1]]);
});
it("does not return partial success when a later batch fails", async () => {
  const result = await readBatchedRows(["a", "b", "c"], async ids => ids[0] === "b"
    ? { data: null, error: { message: "Bad Request" } }
    : { data: ids, error: null }, 1);
  assert.deepEqual(result, { data: null, error: { message: "Bad Request" } });
});
it("skips empty input and deduplicates content IDs", async () => {
  assert.deepEqual(await readBatchedRows([], async () => { throw Error("Unexpected query"); }), { data: [], error: null });
  assert.deepEqual(await readBatchedRows(["a", "a"], async ids => ({ data: ids, error: null })), { data: ["a"], error: null });
});
it("validates batch and page sizes", async () => {
  await assert.rejects(readBatchedRows([], async () => ({ data: [], error: null }), 0), /Invalid/);
  await assert.rejects(readBatchedRows([], async () => ({ data: [], error: null }), 100, 0), /Invalid/);
});
