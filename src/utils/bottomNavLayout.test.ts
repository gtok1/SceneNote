import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getBottomNavMetrics, getNavItemVisual } from "./bottomNavLayout";

describe("bottom navigation layout", () => {
  it("B-1 fits six tabs at 320 points", () => assert.deepEqual(getBottomNavMetrics(320, 6), { labelFontSize: 10, iconPillWidth: 44 }));
  it("B-2 uses standard text at 375 points", () => assert.deepEqual(getBottomNavMetrics(375, 6), { labelFontSize: 11, iconPillWidth: 53 }));
  it("B-3 caps the icon pill at 430 points", () => assert.deepEqual(getBottomNavMetrics(430, 6), { labelFontSize: 11, iconPillWidth: 56 }));
  it("B-4 caps the nav container at 640 points", () => assert.deepEqual(getBottomNavMetrics(1024, 6), { labelFontSize: 11, iconPillWidth: 56 }));
  it("B-5 preserves five-tab sizing at 320 points", () => assert.deepEqual(getBottomNavMetrics(320, 5), { labelFontSize: 11, iconPillWidth: 54 }));
  it("B-6 defaults invalid widths to 375", () => {
    const expected = { labelFontSize: 11, iconPillWidth: 53 };
    assert.deepEqual(getBottomNavMetrics(0, 6), expected);
    assert.deepEqual(getBottomNavMetrics(Number.NaN, 6), expected);
  });
  it("B-7 clamps zero tabs to one", () => assert.deepEqual(getBottomNavMetrics(375, 0), { labelFontSize: 11, iconPillWidth: 56 }));
});

describe("bottom navigation pill states", () => {
  it("B-8 preserves the active pill during hover and press", () => {
    assert.deepEqual(getNavItemVisual({ active: true, hovered: true, pressed: true, keyboardFocused: false }), { pill: "active", focusRing: false });
  });
  it("B-9 highlights only the inactive hovered pill", () => {
    assert.deepEqual(getNavItemVisual({ active: false, hovered: true, pressed: false, keyboardFocused: false }), { pill: "hover", focusRing: false });
  });
  it("B-10 highlights a pressed native pill without hover", () => {
    assert.deepEqual(getNavItemVisual({ active: false, hovered: undefined, pressed: true, keyboardFocused: false }), { pill: "hover", focusRing: false });
  });
  it("B-11 leaves the idle inactive pill unpainted", () => {
    assert.deepEqual(getNavItemVisual({ active: false, hovered: false, pressed: false, keyboardFocused: false }), { pill: "none", focusRing: false });
  });
  it("B-12 shows keyboard focus for active and inactive pills", () => {
    assert.deepEqual(getNavItemVisual({ active: true, keyboardFocused: true }), { pill: "active", focusRing: true });
    assert.deepEqual(getNavItemVisual({ active: false, keyboardFocused: true }), { pill: "none", focusRing: true });
  });
});
