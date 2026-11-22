import type { SearchResult } from "../types/content";
import { animeReleaseLabel, formatAnimeSearchTitle } from "../../supabase/functions/_shared/searchResultMerge";

export function formatSearchResultTitle(result: Pick<SearchResult, "title_primary" | "series_title"> & Partial<SearchResult>): string {
  const seriesTitle = result.series_title?.trim();
  const title = formatAnimeSearchTitle(result);
  return seriesTitle ? `${seriesTitle} ${title}` : title;
}

/** The title can be truncated on a two-column phone grid; put its release unit first in metadata. */
export function searchResultReleaseLabel(result: Pick<SearchResult, "title_primary"> & Partial<SearchResult>): string | null {
  if (result.content_type === "movie" || result.anime_format === "MOVIE") return null;
  const officialLabel = animeReleaseLabel(result);
  if (officialLabel) return officialLabel;
  if (result.content_type === "anime") {
    const title = formatAnimeSearchTitle(result);
    const label = /(?:^|\s)(\d+기(?: 파트 \d+)?(?: 특별편)?|특별편)$/.exec(title)?.[1];
    if (label) return label;
  }
  return result.season_number != null ? `시즌 ${result.season_number}` : null;
}
