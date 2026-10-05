import assert from "node:assert/strict";
import { it } from "node:test";
import { getListRestoreOffset } from "./listScrollPosition";

it("waits for layout instead of losing the saved position", () => {
  assert.equal(getListRestoreOffset({ offset: 1400, itemCount: 24 }, 0, 600, 24), null);
  assert.equal(getListRestoreOffset({ offset: 1400, itemCount: 24 }, 2400, 0, 24), null);
});
it("waits for saved pagination before restoring a deep position", () => {
  assert.equal(getListRestoreOffset({ offset: 1400, itemCount: 24 }, 1000, 600, 8), null);
  assert.equal(getListRestoreOffset({ offset: 1400, itemCount: 24 }, 2400, 600, 24), 1400);
});
it("clamps when the restored list becomes shorter", () => {
  assert.equal(getListRestoreOffset({ offset: 1400, itemCount: 24 }, 1800, 600, 24), 1200);
});
it("new searches start at zero, including a list shorter than the viewport", () => {
  assert.equal(getListRestoreOffset({ offset: 0, itemCount: 0 }, 200, 600, 3), 0);
});
