import type { LibraryListItem } from "@/types/library";

export function contentIdsNeedingEpisodeAirDates(
  items: readonly Pick<LibraryListItem, "content_id" | "source_api" | "air_date" | "end_date">[]
): string[] {
  return [...new Set(items
    .filter((item) => item.air_date == null || (item.source_api !== "anilist" && item.end_date == null))
    .map((item) => item.content_id))];
}
