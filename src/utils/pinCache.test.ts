import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { removePinFromCachedValue } from "./pinCache";

describe("pin cache deletion", () => {
  it("removes a pin from list and single cache shapes", () => {
    const pins = [{ id: "delete" }, { id: "keep" }];
    assert.deepEqual(removePinFromCachedValue(pins, "delete"), [{ id: "keep" }]);
    assert.equal(removePinFromCachedValue({ id: "delete" }, "delete"), null);
    assert.deepEqual(removePinFromCachedValue({ id: "keep" }, "delete"), { id: "keep" });
  });
});
