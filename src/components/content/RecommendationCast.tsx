import { memo } from "react";
import { ContentCast } from "@/components/content/ContentCast";
import type { SearchResult } from "@/types/content";

export const RecommendationCast = memo(function RecommendationCast({ result, compact = false }: { result: SearchResult; compact?: boolean }) {
  return <ContentCast compact={compact} source={result.external_source} externalId={result.external_id} contentType={result.content_type} genres={result.genres ?? []} />;
});
