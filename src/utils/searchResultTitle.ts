import type { SearchResult } from "../types/content";

export function formatSearchResultTitle(result: Pick<SearchResult, "title_primary" | "series_title">): string {
  const seriesTitle = result.series_title?.trim();
  return seriesTitle ? `${seriesTitle} ${result.title_primary}` : result.title_primary;
}
