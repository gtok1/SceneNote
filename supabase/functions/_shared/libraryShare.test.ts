import assert from "node:assert/strict";
import { it } from "node:test";

import { LIBRARY_SHARE_MAX_ITEMS, LIBRARY_SHARE_QUERY_CHUNK, chunk } from "./libraryShare.ts";

it("LS-1 chunk splits in order and keeps the remainder", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 100), []);
  assert.deepEqual(chunk([1, 2], 100), [[1, 2]]);
});

it("LS-2 chunk rejects non-positive sizes", () => {
  assert.throws(() => chunk([1], 0), RangeError);
  assert.throws(() => chunk([1], 1.5), RangeError);
});

it("LS-3 share limits fit the query chunk", () => {
  assert.equal(LIBRARY_SHARE_MAX_ITEMS, 1000);
  assert.equal(LIBRARY_SHARE_QUERY_CHUNK, 100);
  assert.equal(chunk(Array.from({ length: LIBRARY_SHARE_MAX_ITEMS }), LIBRARY_SHARE_QUERY_CHUNK).length, 10);
});
