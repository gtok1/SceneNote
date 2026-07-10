import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getLibraryResponsiveLayout } from "./libraryResponsive";

describe("library responsive layout", () => {
  it("uses the mobile toolbar at every requested phone width", () => {
    for (const width of [360, 375, 390, 430]) {
      assert.deepEqual(getLibraryResponsiveLayout(width), {
        breakpoint: "mobile",
        galleryColumns: 2,
        isDesktop: false,
        isMobile: true
      });
    }
  });

  it("uses the tablet layout at 768px", () => {
    assert.deepEqual(getLibraryResponsiveLayout(768), {
      breakpoint: "tablet",
      galleryColumns: 4,
      isDesktop: false,
      isMobile: false
    });
  });

  it("keeps the desktop toolbar from 1024px", () => {
    assert.deepEqual(getLibraryResponsiveLayout(1024), {
      breakpoint: "desktop",
      galleryColumns: 5,
      isDesktop: true,
      isMobile: false
    });
  });
});
