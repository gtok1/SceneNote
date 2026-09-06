import type { LibraryListItem } from "@/types/library";

/**
 * The library stores one row per (user, content, season). A season_number of null means
 * the whole work was registered — that is what every row created before
 * migration 0021 looks like, so it must never be presented as proof that a specific
 * season is registered. See docs/17_season_library_tracking_spec.md D-5.
 */
export type SeasonLibraryMatch =
  | { kind: "season"; item: LibraryListItem }
  | { kind: "whole-work"; item: LibraryListItem }
  | { kind: "none" };

export function matchLibraryItemForSeason(
  items: readonly LibraryListItem[],
  seasonNumber: number | null | undefined
): SeasonLibraryMatch {
  if (typeof seasonNumber === "number") {
    const exact = items.find((item) => item.season_number === seasonNumber);
    if (exact) return { kind: "season", item: exact };
  }

  const wholeWork = items.find((item) => item.season_number === null || item.season_number === undefined);
  if (wholeWork) return { kind: "whole-work", item: wholeWork };

  return { kind: "none" };
}
