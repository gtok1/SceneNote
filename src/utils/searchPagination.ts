import type { SearchContentResponse, SearchResult } from "@/types/content";
import { compactSearchResults } from "../../supabase/functions/_shared/searchResultMerge";

export function mergeSearchPages(pages: readonly SearchContentResponse[]): SearchResult[] {
  // The server only enriches the first few entries of each page. Retain the first
  // copy of an exact provider identity while sharing cross-provider season rules.
  return compactSearchResults(pages.flatMap((page) => page.results), { exactFirstWins: true });
}
