import { matchesDiscoveryFilters, type DiscoveryFilterInput } from "../../supabase/functions/_shared/discoveryFilters";
import type { SearchResult } from "../types/content";
import type { LibraryListItem, LibraryStatusFilter } from "../types/library";

export type SearchHiddenReason = "filters" | "status" | "year";

export function partitionSearchResults<T extends SearchResult>(
  results: readonly T[],
  input: {
    discoveryFilters: DiscoveryFilterInput;
    statusFilter: LibraryStatusFilter;
    year: number | null;
    libraryItems: readonly Pick<LibraryListItem, "statuses" | "source_api" | "source_id">[];
  }
): { visible: T[]; hidden: T[]; hiddenByReason: Record<SearchHiddenReason, number> } {
  const visible: T[] = [];
  const hidden: T[] = [];
  const hiddenByReason = { filters: 0, status: 0, year: 0 };
  const wantedStatus = input.statusFilter;
  const statusMatches = wantedStatus === "all" ? null : new Set(
    input.libraryItems.filter(item => item.statuses.includes(wantedStatus))
      .map(item => `${item.source_api}:${item.source_id}`)
  );

  for (const item of results) {
    const reason: SearchHiddenReason | null =
      item.filter_match === false || !matchesDiscoveryFilters(item, input.discoveryFilters) ? "filters"
        : statusMatches && !statusMatches.has(`${item.external_source}:${item.external_id}`) ? "status"
          : input.year !== null && item.air_year !== input.year ? "year" : null;
    if (reason) {
      hidden.push(item);
      hiddenByReason[reason] += 1;
    } else visible.push(item);
  }
  return { visible, hidden, hiddenByReason };
}
