import type { SearchContentResponse, SearchResult } from "@/types/content";
import { searchSeasonIdentity } from "./searchRecommendationPolicy";

export function mergeSearchPages(pages: readonly SearchContentResponse[]): SearchResult[] {
  const byKey = new Map<string, SearchResult>();

  for (const item of pages.flatMap((page) => page.results)) {
    const key = searchSeasonIdentity(item);
    // First page wins: the server only applies season/air-date enrichment within a
    // page's own top 3, so an earlier page's copy of a work is never less complete
    // than the same work reappearing further down a later page.
    if (!byKey.has(key)) byKey.set(key, item);
  }

  const showsWithSeasons = new Set(
    [...byKey.values()]
      .filter(item => item.season_number != null)
      .map(item => `${item.external_source}:${item.external_id}`)
  );
  return [...byKey.values()].filter(item =>
    item.season_number != null || !showsWithSeasons.has(`${item.external_source}:${item.external_id}`)
  );
}
