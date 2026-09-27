import assert from "node:assert/strict";
import { it } from "node:test";

import { getHomeLayout } from "./homeLayout";

const mobileLayout = {
  gutter: 16,
  contentWidth: 343,
  posterColumns: 3,
  posterGap: 12,
  posterWidth: 106,
  pinColumns: 1,
  pinWidth: 343,
  continueLimit: 6,
  railTileWidth: 120,
};

it("T-1: lays out width 375 with three poster columns and two rows", () => {
  assert.deepEqual(getHomeLayout(375), mobileLayout);
});

it("T-2: keeps three poster columns at width 320", () => {
  assert.deepEqual(getHomeLayout(320), {
    gutter: 16, contentWidth: 288, posterColumns: 3, posterGap: 12,
    posterWidth: 88, pinColumns: 1, pinWidth: 288, continueLimit: 6, railTileWidth: 120,
  });
});

it("T-3: retains mobile spacing through width 599", () => {
  assert.deepEqual(getHomeLayout(599), {
    gutter: 16, contentWidth: 567, posterColumns: 3, posterGap: 12,
    posterWidth: 181, pinColumns: 1, pinWidth: 567, continueLimit: 6, railTileWidth: 120,
  });
});

it("T-4: switches to four poster columns at width 600", () => {
  assert.deepEqual(getHomeLayout(600), {
    gutter: 24, contentWidth: 552, posterColumns: 4, posterGap: 16,
    posterWidth: 126, pinColumns: 2, pinWidth: 268, continueLimit: 4, railTileWidth: 148,
  });
});

it("T-5: uses five poster columns and three pin columns at width 1024", () => {
  assert.deepEqual(getHomeLayout(1024), {
    gutter: 24, contentWidth: 976, posterColumns: 5, posterGap: 16,
    posterWidth: 182, pinColumns: 3, pinWidth: 314, continueLimit: 5, railTileWidth: 148,
  });
});

it("T-6: caps the content container and uses six poster columns at width 1440", () => {
  assert.deepEqual(getHomeLayout(1440), {
    gutter: 24, contentWidth: 1152, posterColumns: 6, posterGap: 16,
    posterWidth: 178, pinColumns: 3, pinWidth: 373, continueLimit: 6, railTileWidth: 148,
  });
});

it("T-7: falls back to width 375 for zero, NaN, and negative widths", () => {
  for (const width of [0, NaN, -10]) {
    assert.deepEqual(getHomeLayout(width), mobileLayout);
  }
});

it("T-8: changes poster and pin columns at the 959/960 boundary", () => {
  assert.deepEqual(getHomeLayout(959), {
    gutter: 24, contentWidth: 911, posterColumns: 4, posterGap: 16,
    posterWidth: 215, pinColumns: 2, pinWidth: 447, continueLimit: 4, railTileWidth: 148,
  });
  assert.deepEqual(getHomeLayout(960), {
    gutter: 24, contentWidth: 912, posterColumns: 5, posterGap: 16,
    posterWidth: 169, pinColumns: 3, pinWidth: 293, continueLimit: 5, railTileWidth: 148,
  });
});

it("T-9: changes poster columns at the 1279/1280 boundary", () => {
  assert.deepEqual(getHomeLayout(1279), {
    gutter: 24, contentWidth: 1152, posterColumns: 5, posterGap: 16,
    posterWidth: 217, pinColumns: 3, pinWidth: 373, continueLimit: 5, railTileWidth: 148,
  });
  assert.deepEqual(getHomeLayout(1280), {
    gutter: 24, contentWidth: 1152, posterColumns: 6, posterGap: 16,
    posterWidth: 178, pinColumns: 3, pinWidth: 373, continueLimit: 6, railTileWidth: 148,
  });
});
