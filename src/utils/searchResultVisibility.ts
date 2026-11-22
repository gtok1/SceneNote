import { matchesDiscoveryFilters, type DiscoveryFilterInput } from "../../supabase/functions/_shared/discoveryFilters";
import type { SearchResult } from "../types/content";
import type { LibraryListItem, LibraryStatusFilter } from "../types/library";
import { getSearchExternalKey, getSearchResultKey } from "../../supabase/functions/_shared/searchResultMerge";

export type SearchHiddenReason = "filters" | "status" | "year";

export function partitionSearchResults<T extends SearchResult>(
  results: readonly T[],
  input: {
    discoveryFilters: DiscoveryFilterInput;
    statusFilter: LibraryStatusFilter;
    year: number | null;
    libraryItems: readonly (Pick<LibraryListItem, "statuses" | "source_api" | "source_id"> & Partial<Pick<LibraryListItem, "content_type" | "season_number">>)[];
  }
): { visible: T[]; hidden: T[]; hiddenByReason: Record<SearchHiddenReason, number> } {
  const visible: T[] = [];
  const hidden: T[] = [];
  const hiddenByReason = { filters: 0, status: 0, year: 0 };
  const wantedStatus = input.statusFilter;
  const statusItems = wantedStatus === "all" ? [] : input.libraryItems.filter(item => item.statuses.includes(wantedStatus));
  const statusMatches = wantedStatus === "all" ? null : new Set(
    statusItems
      .map(item => getSearchExternalKey({ external_source: item.source_api, external_id: item.source_id,
        ...(item.content_type ? { content_type: item.content_type } : {}) }))
  );
  // Legacy primary matching keeps its work-level scope. An alternate provider must
  // prove its exact media namespace and registration season, including explicit whole work.
  const equivalentStatusMatches = new Set(statusItems
    .filter(item => item.content_type !== undefined && item.season_number !== undefined)
    .map(item => getSearchResultKey({ external_source: item.source_api, external_id: item.source_id,
      ...(item.content_type !== undefined ? { content_type: item.content_type } : {}),
      ...(item.season_number !== undefined ? { season_number: item.season_number } : {}) })));

  for (const item of results) {
    const matchesStatus = statusMatches === null || statusMatches.has(getSearchExternalKey(item)) ||
      statusMatches.has(`${item.external_source}:${item.external_id}`) ||
      item.equivalent_results?.some(identity => equivalentStatusMatches.has(getSearchResultKey(identity))) === true;
    const reason: SearchHiddenReason | null =
      item.filter_match === false || !matchesDiscoveryFilters(item, input.discoveryFilters) ? "filters"
        : !matchesStatus ? "status"
          : input.year !== null && item.air_year !== input.year ? "year" : null;
    if (reason) {
      hidden.push(item);
      hiddenByReason[reason] += 1;
    } else visible.push(item);
  }
  return { visible, hidden, hiddenByReason };
}
