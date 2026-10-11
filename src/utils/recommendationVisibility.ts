import { matchesDiscoveryFilters, type DiscoveryFilterInput } from "../../supabase/functions/_shared/discoveryFilters";
import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { isExcludedRecommendation, type RecommendationExclusions } from "@/utils/excludedThemes";
import { createRecommendationIdentityAliases, isSameRecommendationWork } from "../../supabase/functions/_shared/recommendationEngine";

/** Keep the feed's library check identical in its UI and refill policy. */
export function isRegisteredRecommendation(
  result: SearchResult,
  libraryItems: readonly LibraryListItem[]
): boolean {
  return libraryItems.some((item) => {
    if (
      item.source_api !== "manual" &&
      `${item.source_api}:${item.source_id}` === `${result.external_source}:${result.external_id}`
    ) {
      return true;
    }

    return isSameRecommendationWork(item, result);
  });
}

export function countVisibleRecommendationCandidates<T extends SearchResult>(
  items: readonly T[],
  libraryItems: readonly LibraryListItem[],
  exclusions: RecommendationExclusions | null,
  discoveryFilters?: DiscoveryFilterInput
): number {
  return filterVisibleRecommendationCandidates(items, libraryItems, exclusions, discoveryFilters).length;
}

export function filterVisibleRecommendationCandidates<T extends SearchResult>(
  items: readonly T[],
  libraryItems: readonly LibraryListItem[],
  exclusions: RecommendationExclusions | null,
  discoveryFilters?: DiscoveryFilterInput
): T[] {
  return items.filter((item) =>
    !isRegisteredRecommendation(item, libraryItems) &&
    (!exclusions || !isExcludedRecommendation(item, exclusions)) && matchesDiscoveryFilters(item, discoveryFilters)
  );
}

export function findVisibleRecommendationReplacement<T extends SearchResult>(
  candidates: readonly T[],
  existingItems: readonly T[],
  libraryItems: readonly LibraryListItem[],
  exclusions: RecommendationExclusions | null,
  discoveryFilters?: DiscoveryFilterInput
): T | undefined {
  const existingIdentities = new Set(existingItems.flatMap(createRecommendationIdentityAliases));
  return filterVisibleRecommendationCandidates(candidates, libraryItems, exclusions, discoveryFilters)
    .find((item) => createRecommendationIdentityAliases(item).every((identity) => !existingIdentities.has(identity)));
}

/** Counts only; never logs titles, IDs, or account preferences. */
export function summarizeRecommendationVisibility<T extends SearchResult & { keywords?: readonly string[] | null }>(
  items: readonly T[],
  libraryItems: readonly LibraryListItem[],
  exclusions: RecommendationExclusions | null,
  discoveryFilters?: DiscoveryFilterInput
): { raw: number; registered: number; excluded: number; visible: number; unverifiableTmdb: number } {
  let registered = 0;
  let excluded = 0;
  let visible = 0;
  let unverifiableTmdb = 0;
  for (const item of items) {
    if (isRegisteredRecommendation(item, libraryItems)) {
      registered += 1;
    } else if ((exclusions && isExcludedRecommendation(item, exclusions)) || !matchesDiscoveryFilters(item, discoveryFilters)) {
      excluded += 1;
      if (
        item.external_source === "tmdb" &&
        exclusions?.excludedThemeKeys.some((key) => key === "boys-love" || key === "girls-love" || key === "queer-romance") &&
        !item.keywords?.length
      ) unverifiableTmdb += 1;
    } else {
      visible += 1;
    }
  }
  return { raw: items.length, registered, excluded, visible, unverifiableTmdb };
}
