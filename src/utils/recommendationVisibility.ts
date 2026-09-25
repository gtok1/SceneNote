import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import { isExcludedRecommendation, type RecommendationExclusions } from "@/utils/excludedThemes";

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

    if (item.content_type !== result.content_type) return false;
    if (item.air_year && result.air_year && item.air_year !== result.air_year) return false;

    const itemTitles = [item.title_primary, item.title_original]
      .map((title) => normalizeTitleForRecommendation(title ?? ""))
      .filter((title) => title.length >= 2);
    const resultTitles = [result.title_primary, result.title_original]
      .map((title) => normalizeTitleForRecommendation(title ?? ""))
      .filter((title) => title.length >= 2);

    return itemTitles.some((title) => resultTitles.includes(title));
  });
}

export function countVisibleRecommendationCandidates<T extends SearchResult>(
  items: readonly T[],
  libraryItems: readonly LibraryListItem[],
  exclusions: RecommendationExclusions | null
): number {
  return filterVisibleRecommendationCandidates(items, libraryItems, exclusions).length;
}

export function filterVisibleRecommendationCandidates<T extends SearchResult>(
  items: readonly T[],
  libraryItems: readonly LibraryListItem[],
  exclusions: RecommendationExclusions | null
): T[] {
  return items.filter((item) =>
    !isRegisteredRecommendation(item, libraryItems) &&
    (!exclusions || !isExcludedRecommendation(item, exclusions))
  );
}

/** Counts only; never logs titles, IDs, or account preferences. */
export function summarizeRecommendationVisibility<T extends SearchResult & { keywords?: readonly string[] | null }>(
  items: readonly T[],
  libraryItems: readonly LibraryListItem[],
  exclusions: RecommendationExclusions | null
): { raw: number; registered: number; excluded: number; visible: number; unverifiableTmdb: number } {
  let registered = 0;
  let excluded = 0;
  let visible = 0;
  let unverifiableTmdb = 0;
  for (const item of items) {
    if (isRegisteredRecommendation(item, libraryItems)) {
      registered += 1;
    } else if (exclusions && isExcludedRecommendation(item, exclusions)) {
      excluded += 1;
      if (
        item.external_source === "tmdb" &&
        exclusions.excludedThemeKeys.some((key) => key === "boys-love" || key === "girls-love" || key === "queer-romance") &&
        !item.keywords?.length
      ) unverifiableTmdb += 1;
    } else {
      visible += 1;
    }
  }
  return { raw: items.length, registered, excluded, visible, unverifiableTmdb };
}

function normalizeTitleForRecommendation(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}
