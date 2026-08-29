import type { SearchContentResponse, SearchResult } from "@/types/content";

export function mergeSearchPages(pages: readonly SearchContentResponse[]): SearchResult[] {
  return Array.from(new Map(
    pages.flatMap((page) => page.results)
      .map((item) => [`${item.external_source}:${item.external_id}`, item])
  ).values());
}
