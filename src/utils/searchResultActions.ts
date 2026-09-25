import type { LibraryListItem, WatchStatus } from "@/types/library";
import { matchLibraryItemForSeason } from "./seasonLibraryMatch";

export function getSearchResultActions(
  seasonNumber: number | null | undefined,
  libraryItems: readonly LibraryListItem[],
  recentStatus: WatchStatus | null,
  busy: boolean
): { libraryItem: LibraryListItem | null; wishlistDisabled: boolean; completedDisabled: boolean } {
  const match = matchLibraryItemForSeason(libraryItems, seasonNumber);
  const libraryItem = typeof seasonNumber === "number"
    ? match.kind === "season" ? match.item : null
    : match.kind === "whole-work" ? match.item : [...libraryItems].sort(
      (left, right) => (left.season_number ?? Infinity) - (right.season_number ?? Infinity)
    )[0] ?? null;
  const registered = libraryItem !== null || recentStatus !== null;

  return {
    libraryItem,
    wishlistDisabled: busy || registered,
    completedDisabled: busy || registered
  };
}
