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

export type ContentLibraryMatch =
  | { kind: "library-item"; item: LibraryListItem }
  | { kind: "season"; item: LibraryListItem }
  | { kind: "whole-work"; item: LibraryListItem }
  | { kind: "other-season"; item: LibraryListItem }
  | { kind: "none" };

export function resolveContentLibraryItem(
  items: readonly LibraryListItem[],
  params: {
    contentId: string;
    libraryItemId?: string | null | undefined;
    seasonNumber?: number | null | undefined;
    externalSource?: LibraryListItem["source_api"] | undefined;
    externalId?: string | undefined;
    mediaType?: "movie" | "tv" | undefined;
  }
): ContentLibraryMatch {
  let rows = items.filter((item) => item.content_id === params.contentId);
  if (rows.length === 0 && params.externalSource && params.externalSource !== "manual" && params.externalId) {
    // Public detail snapshots can predate registration. Resolve today's user records independently.
    rows = items.filter(item => item.source_api === params.externalSource && item.source_id === params.externalId &&
      (!params.mediaType || (params.mediaType === "movie" ? item.content_type === "movie" : item.content_type !== "movie")));
  }
  if (params.libraryItemId) {
    const exact = rows.find((item) => item.library_item_id === params.libraryItemId);
    if (exact) return { kind: "library-item", item: exact };
  }

  if (rows.length === 0) return { kind: "none" };

  if (typeof params.seasonNumber === "number" && Number.isFinite(params.seasonNumber)) {
    const exact = rows.find((item) => item.season_number === params.seasonNumber);
    if (exact) return { kind: "season", item: exact };
    // D-5: a whole-work row or another season cannot prove this season is registered.
    return { kind: "none" };
  }

  const wholeWork = rows.find((item) => item.season_number == null);
  if (wholeWork) return { kind: "whole-work", item: wholeWork };

  const firstSeason = rows.reduce((first, item) =>
    (item.season_number ?? Infinity) < (first.season_number ?? Infinity) ? item : first
  );
  return { kind: "other-season", item: firstSeason };
}
