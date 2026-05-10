import { useExternalContentDetail } from "@/hooks/useContentSearch";
import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";

export function useLibraryItemCast(item: LibraryListItem, limit = 2) {
  const source = item.source_api === "manual" ? undefined : item.source_api;
  const mediaType = item.content_type === "movie" ? "movie" : "tv";
  const externalDetail = useExternalContentDetail(
    source as SearchResult["external_source"] | undefined,
    source ? item.source_id : undefined,
    mediaType
  );
  const cast = item.cast.length ? item.cast : externalDetail.data?.content.cast ?? [];

  return cast.slice(0, limit);
}
