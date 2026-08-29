import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldShowPinDetailPanel } from "./pinResponsive";

describe("pin responsive layout", () => {
  it("uses one column below tablet width and a detail panel from 768pt", () => {
    assert.equal(shouldShowPinDetailPanel(767), false);
    assert.equal(shouldShowPinDetailPanel(768), true);
  });
});
