import assert from "node:assert/strict";
import { it } from "node:test";

it("integrity PAGE-1 reads all 2500 server records with stable inclusive ranges", async () => {
  const pages = await import("./readAllRows.ts");
  const rows = Array.from({ length: 2500 }, (_, index) => ({ id: String(index) }));
  const calls: number[][] = [];
  const result = await pages.readAllRows((from, to) => { calls.push([from, to]); return Promise.resolve({ data: rows.slice(from, to + 1), error: null }); });
  assert.deepEqual(result, { data: rows, error: null });
  assert.deepEqual(calls, [[0,999],[1000,1999],[2000,2999]]);
});
it("integrity PAGE-2 discards all partial records if a later page fails", async () => {
  const pages = await import("./readAllRows.ts");
  const error = { message: "fixture failure" };
  assert.deepEqual(await pages.readAllRows((from) => Promise.resolve(from === 0 ? { data: [1,2], error: null } : { data: null, error }), { pageSize: 2 }), { data: null, error });
});
it("integrity PAGE-3 reports the safety limit instead of returning truncated success", async () => {
  const pages = await import("./readAllRows.ts");
  assert.deepEqual(await pages.readAllRows(() => Promise.resolve({ data: [1,2], error: null }), { pageSize: 2, maxPages: 2 }), { data: null, error: { message: "ROW_LIMIT_EXCEEDED" } });
});
it("integrity PAGE-4 preserves the first occurrence but uses raw page size for continuation", async () => {
  const pages = await import("./readAllRows.ts");
  const values = [[{id:"a"},{id:"b"}],[{id:"b"},{id:"c"}],[]];
  assert.deepEqual((await pages.readAllRows((from) => Promise.resolve({ data: values[from / 2]!, error: null }), { pageSize: 2, rowKey: row => row.id })).data, [{id:"a"},{id:"b"},{id:"c"}]);
});
it("integrity PAGE-5 rejects invalid query bounds", async () => {
  const pages = await import("./readAllRows.ts");
  for (const options of [{pageSize:0},{pageSize:1.5},{maxPages:-1}]) await assert.rejects(pages.readAllRows(() => Promise.resolve({ data: [], error: null }), options), /Invalid query page size/);
});
