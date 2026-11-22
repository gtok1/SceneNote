import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { compactSearchResults, getSearchExternalKey, getSearchResultKey } from "../../supabase/functions/_shared/searchResultMerge";

type SearchIdentity = Pick<SearchResult, "external_source" | "external_id" | "content_type" | "season_number">;
type RegisteredSearchIdentity = Pick<LibraryListItem, "content_type" | "season_number">;

export function mergeSearchResults(
  titleResults: readonly SearchResult[],
  personResults: readonly SearchResult[]
): SearchResult[] {
  return compactSearchResults([...titleResults, ...personResults]);
}

/** Keep a merged card connected to its exact existing registration. */
export function preferRegisteredSearchResult(
  result: SearchResult,
  libraryItemsByExternalKey: ReadonlyMap<string, readonly RegisteredSearchIdentity[]>
): SearchResult {
  if (!result.equivalent_results?.length) return result;

  const identities = new Map<string, SearchIdentity>();
  const primary: SearchIdentity = {
    external_source: result.external_source,
    external_id: result.external_id,
    content_type: result.content_type,
    ...(result.season_number == null ? {} : { season_number: result.season_number })
  };
  for (const identity of [primary, ...result.equivalent_results]) {
    const key = getSearchResultKey(identity);
    if (!identities.has(key)) identities.set(key, identity);
  }

  const registered = [...identities.values()].find((identity) =>
    (libraryItemsByExternalKey.get(getSearchExternalKey(identity)) ?? []).some((item) =>
      (item.content_type === "movie") === (identity.content_type === "movie") &&
      (item.season_number ?? null) === (identity.season_number ?? null)
    )
  );
  if (!registered || getSearchResultKey(registered) === getSearchResultKey(primary)) return result;

  const preferred = { ...result, ...registered, equivalent_results: [...identities.values()] };
  if (registered.season_number == null) delete preferred.season_number;
  return preferred;
}
