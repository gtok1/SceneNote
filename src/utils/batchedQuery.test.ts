import { it } from "node:test";
import assert from "node:assert/strict";
import { readBatchedRows } from "./batchedQuery";
import * as batchedQuery from "./batchedQuery";

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

it("72 T-1: reads an empty result once using the default inclusive range", async () => {
  const calls: [number, number][] = [];
  const result = await batchedQuery.readAllRows(async (from, to) => {
    calls.push([from, to]);
    return { data: [], error: null };
  });
  assert.deepEqual(result, { data: [], error: null });
  assert.deepEqual(calls, [[0, 999]]);
});

it("72 T-2: reads an empty terminal page after exactly one thousand rows", async () => {
  const rows = Array.from({ length: 1000 }, (_, index) => index);
  const calls: [number, number][] = [];
  const result = await batchedQuery.readAllRows(async (from, to) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  });
  assert.deepEqual(result, { data: rows, error: null });
  assert.deepEqual(calls, [[0, 999], [1000, 1999]]);
});

it("72 T-3: reads all two thousand five hundred rows in input order", async () => {
  const rows = Array.from({ length: 2500 }, (_, index) => `row-${index}`);
  const calls: [number, number][] = [];
  const result = await batchedQuery.readAllRows(async (from, to) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  }, { pageSize: 1000 });
  assert.deepEqual(result, { data: rows, error: null });
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

it("72 T-4: discards earlier rows when the second page fails", async () => {
  const error = { message: "second page failed" };
  const calls: [number, number][] = [];
  const result = await batchedQuery.readAllRows(async (from, to) => {
    calls.push([from, to]);
    return from === 0
      ? { data: ["a", "b"], error: null }
      : { data: null, error };
  }, { pageSize: 2 });
  assert.equal(result.data, null);
  assert.equal(result.error, error);
  assert.deepEqual(calls, [[0, 1], [2, 3]]);
});

it("72 T-5: keeps the first row per id while paginating by raw page size", async () => {
  const pages = [[{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }], [{ id: "d" }]];
  const calls: [number, number][] = [];
  const result = await batchedQuery.readAllRows(async (from, to) => {
    calls.push([from, to]);
    return { data: pages[from / 2] ?? [], error: null };
  }, { pageSize: 2, rowKey: row => row.id });
  assert.deepEqual(result.data, [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]);
  assert.equal(result.error, null);
  assert.deepEqual(calls, [[0, 1], [2, 3], [4, 5]]);
});

it("72 T-6: preserves every row whose key is null, undefined, or empty", async () => {
  const rows = [
    { id: null, value: 1 }, { id: null, value: 2 },
    { id: undefined, value: 3 }, { id: undefined, value: 4 },
    { id: "", value: 5 }, { id: "", value: 6 }
  ];
  const result = await batchedQuery.readAllRows(async () => ({ data: rows, error: null }), {
    rowKey: row => row.id
  });
  assert.deepEqual(result, { data: rows, error: null });
});

it("72 T-7: returns an error instead of a truncated list at the page ceiling", async () => {
  const calls: [number, number][] = [];
  const result = await batchedQuery.readAllRows(async (from, to) => {
    calls.push([from, to]);
    return { data: [from, from + 1], error: null };
  }, { pageSize: 2, maxPages: 2 });
  assert.deepEqual(result, { data: null, error: { message: "ROW_LIMIT_EXCEEDED" } });
  assert.deepEqual(calls, [[0, 1], [2, 3]]);
});

it("72 T-8: rejects invalid page sizes and maximum page counts", async () => {
  for (const options of [
    { pageSize: 0 }, { pageSize: 1.5 }, { pageSize: -1 },
    { maxPages: 0 }, { maxPages: 1.5 }, { maxPages: -1 }
  ]) {
    await assert.rejects(async () => batchedQuery.readAllRows(async () => ({ data: [], error: null }), options), {
      message: "Invalid query page size"
    });
  }
});

it("72 T-22: preserves the empty-id batch fast path without making a query", async () => {
  let calls = 0;
  const result = await readBatchedRows([], async () => {
    calls += 1;
    return { data: [], error: null };
  });
  assert.deepEqual(result, { data: [], error: null });
  assert.equal(calls, 0);
});
