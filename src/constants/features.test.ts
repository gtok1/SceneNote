import assert from "node:assert/strict";
import { it } from "node:test";

import { EXTENDED_FEATURES_ENABLED, SHARE_FEATURES_ENABLED } from "./features";

it("SHARE-01 라이브러리 공유는 확장 기능과 별개로 켜져 있다", () => {
  assert.equal(SHARE_FEATURES_ENABLED, true);
  assert.equal(EXTENDED_FEATURES_ENABLED, false);
});
