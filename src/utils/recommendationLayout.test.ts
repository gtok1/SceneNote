import assert from "node:assert/strict";
import test from "node:test";

import { getResponsiveRecommendationColumns } from "./recommendationLayout";

test("recommendation grid uses six desktop columns and reduces columns on narrow screens", () => {
  assert.equal(getResponsiveRecommendationColumns(1440), 6);
  assert.equal(getResponsiveRecommendationColumns(1100), 5);
  assert.equal(getResponsiveRecommendationColumns(900), 4);
  assert.equal(getResponsiveRecommendationColumns(700), 3);
  assert.equal(getResponsiveRecommendationColumns(390), 2);
  assert.equal(getResponsiveRecommendationColumns(320), 1);
});
