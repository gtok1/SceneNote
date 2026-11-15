import assert from "node:assert/strict";
import test from "node:test";

import { getResponsiveRecommendationColumns, getSearchGalleryLayout } from "./recommendationLayout";

test("recommendation grid uses six desktop columns and reduces columns on narrow screens", () => {
  assert.equal(getResponsiveRecommendationColumns(1440), 6);
  assert.equal(getResponsiveRecommendationColumns(1100), 5);
  assert.equal(getResponsiveRecommendationColumns(900), 4);
  assert.equal(getResponsiveRecommendationColumns(700), 3);
  assert.equal(getResponsiveRecommendationColumns(390), 2);
  assert.equal(getResponsiveRecommendationColumns(320), 1);
});


test("web search gallery shows three information cards per desktop row", () => {
  for (const width of [960, 1024, 1280, 1440, 1496, 2000]) {
    assert.deepEqual(getSearchGalleryLayout(width, 1, true), { columns: 3, expanded: true });
  }
});

test("search gallery keeps compact responsive columns on narrow web and native", () => {
  for (const width of [375, 599, 600, 768, 959]) {
    assert.deepEqual(getSearchGalleryLayout(width, 1, true), {
      columns: getResponsiveRecommendationColumns(width), expanded: false
    });
  }
  assert.deepEqual(getSearchGalleryLayout(1440, 1, false), { columns: 6, expanded: false });
});

test("search gallery reduces density for enlarged text", () => {
  assert.deepEqual(getSearchGalleryLayout(1440, 1.3, true), { columns: 3, expanded: true });
  assert.deepEqual(getSearchGalleryLayout(960, 1.3, true), { columns: 3, expanded: false });
  assert.deepEqual(getSearchGalleryLayout(375, 1.3, true), { columns: 1, expanded: false });
});

test("search gallery normalizes invalid viewport and font scale", () => {
  for (const width of [NaN, 0, -1, Infinity]) {
    assert.deepEqual(getSearchGalleryLayout(width, 1, true), { columns: 2, expanded: false });
  }
  for (const scale of [NaN, 0, -1, Infinity]) {
    assert.deepEqual(getSearchGalleryLayout(1440, scale, true), { columns: 3, expanded: true });
  }
});
