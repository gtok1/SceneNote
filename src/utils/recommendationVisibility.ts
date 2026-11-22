import { matchesDiscoveryFilters, type DiscoveryFilterInput } from "../../supabase/functions/_shared/discoveryFilters";
import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { isExcludedRecommendation, type RecommendationExclusions } from "@/utils/excludedThemes";
import { createRecommendationIdentityAliases, isSameRecommendationWork, recommendationSameWorkTitleKeys } from "../../supabase/functions/_shared/recommendationEngine";

export interface RecommendationLibraryIndex {
  externalKeys: ReadonlySet<string>;
  byTitleKey: ReadonlyMap<string, readonly LibraryListItem[]>;
}

const libraryIndexes = new WeakMap<readonly LibraryListItem[], RecommendationLibraryIndex>();

/** Query data is immutable; a new library array gets its own index. */
export function getRecommendationLibraryIndex(libraryItems: readonly LibraryListItem[]): RecommendationLibraryIndex {
  const cached = libraryIndexes.get(libraryItems);
  if (cached) return cached;

  const externalKeys = new Set<string>();
  const byTitleKey = new Map<string, LibraryListItem[]>();
  for (const item of libraryItems) {
    if (item.source_api !== "manual") externalKeys.add(`${item.source_api}:${item.source_id}`);
    for (const key of recommendationSameWorkTitleKeys(item)) {
      const items = byTitleKey.get(key);
      if (items) items.push(item);
      else byTitleKey.set(key, [item]);
    }
  }
  const index: RecommendationLibraryIndex = { externalKeys, byTitleKey };
  libraryIndexes.set(libraryItems, index);
  return index;
}

/** Only shared title keys can match; keep type/year checks in the existing matcher. */
export function findSameWorkLibraryCandidates(
  index: RecommendationLibraryIndex,
  result: SearchResult
): LibraryListItem[] {
  const candidates = new Set<LibraryListItem>();
  for (const key of recommendationSameWorkTitleKeys(result)) {
    for (const item of index.byTitleKey.get(key) ?? []) candidates.add(item);
  }
  return [...candidates];
}

/** Keep the feed's library check identical in its UI and refill policy. */
export function isRegisteredRecommendation(
  result: SearchResult,
  libraryItems: readonly LibraryListItem[]
): boolean {
  const index = getRecommendationLibraryIndex(libraryItems);
  if (index.externalKeys.has(`${result.external_source}:${result.external_id}`)) return true;
  return findSameWorkLibraryCandidates(index, result).some((item) => isSameRecommendationWork(item, result));
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
