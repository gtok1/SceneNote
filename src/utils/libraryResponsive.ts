export type LibraryBreakpoint = "mobile" | "tablet" | "desktop";

export interface LibraryResponsiveLayout {
  breakpoint: LibraryBreakpoint;
  galleryColumns: number;
  isDesktop: boolean;
  isMobile: boolean;
}

export function getLibraryResponsiveLayout(width: number): LibraryResponsiveLayout {
  const breakpoint: LibraryBreakpoint = width <= 767 ? "mobile" : width <= 1023 ? "tablet" : "desktop";
  return {
    breakpoint,
    galleryColumns: width >= 1280 ? 6 : width >= 960 ? 5 : width >= 700 ? 4 : 2,
    isDesktop: breakpoint === "desktop",
    isMobile: breakpoint === "mobile"
  };
}
