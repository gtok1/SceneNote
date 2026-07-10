import {
  createExternalRecommendationKey,
  createRecommendationIdentityAliases,
  type RecommendationCandidate
} from "./recommendationEngine.ts";

export interface RecommendationImpressionRow {
  user_id: string;
  canonical_content_id: string;
  media_type: string;
  source: string;
  source_id: string;
  identity_keys: string[];
  last_seen_at: string;
}

export function createRecommendationImpressionRows(
  userId: string,
  impressions: readonly RecommendationCandidate[],
  now = new Date().toISOString()
): RecommendationImpressionRow[] {
  const rows = new Map<string, RecommendationImpressionRow>();
  for (const impression of impressions) {
    const identityKeys = createRecommendationIdentityAliases(impression);
    const canonicalContentId = impression.canonical_id?.trim() || identityKeys[0];
    if (!canonicalContentId) continue;
    rows.set(canonicalContentId, {
      user_id: userId,
      canonical_content_id: canonicalContentId,
      media_type: normalizeContentType(impression.content_type),
      source: impression.external_source.trim().toLocaleLowerCase(),
      source_id: impression.external_id.trim(),
      identity_keys: Array.from(new Set([canonicalContentId, ...identityKeys])),
      last_seen_at: now
    });
  }
  return [...rows.values()];
}

export function createRecommendationImpressionLookupKeys(
  candidates: readonly RecommendationCandidate[]
): string[] {
  return Array.from(
    new Set(candidates.map(createExternalRecommendationKey).filter(Boolean))
  );
}

function normalizeContentType(value: string): string {
  const normalized = value.trim().toLocaleLowerCase();
  return ["anime", "kdrama", "jdrama", "movie"].includes(normalized) ? normalized : "other";
}
