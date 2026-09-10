import { EXTENDED_FEATURES_ENABLED } from "@/constants/features";
import { useExternalContentDetail } from "@/hooks/useContentSearch";
import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";

export function useLibraryItemCast(item: LibraryListItem, limit = 2) {
  const source = item.source_api === "manual" ? undefined : item.source_api;
  const mediaType = item.content_type === "movie" ? "movie" : "tv";
  const externalDetail = useExternalContentDetail(
    (EXTENDED_FEATURES_ENABLED ? source : undefined) as SearchResult["external_source"] | undefined,
    source ? item.source_id : undefined,
    mediaType
  );
  const cast = item.cast.length ? item.cast : externalDetail.data?.content.cast ?? [];

  return EXTENDED_FEATURES_ENABLED ? cast.slice(0, limit) : [];
}
