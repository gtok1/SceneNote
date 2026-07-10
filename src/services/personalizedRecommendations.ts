import { supabase } from "@/lib/supabase";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import {
  collectRecommendationPages,
  type RecommendationContinuationPage
} from "@/utils/recommendationCollector";
import {
  createRecommendationIdentityAliases,
  type RecommendationSignal
} from "../../supabase/functions/_shared/recommendationEngine";

export type RecommendationProfileMode = "cold_start" | "light" | "personalized";

export interface PersonalizedRecommendation extends SearchResult {
  canonical_id: string;
  similarity_score: number;
  recommendation_reason: string;
  recommendation_signals?: RecommendationSignal[];
  popularity?: number | null;
  vote_count?: number | null;
  rating_score?: number | null;
  rating_scale?: 10 | 100 | null;
  rating_count?: number | null;
  popularity_count?: number | null;
  release_status?: string | null;
  format?: string | null;
  duration_minutes?: number | null;
  trailer_url?: string | null;
  keywords?: string[] | null;
  people?: string[] | null;
  studios?: string[] | null;
  category: "drama" | "anime" | "movie";
  rank: number;
  trend_source: string;
  release_month?: number | null;
}

export interface PersonalizedRecommendationsResponse {
  items: PersonalizedRecommendation[];
  next_cursor: string | null;
  has_more: boolean;
  is_exhausted: boolean;
  scan_budget_reached: boolean;
  broadened: boolean;
  profile_mode: RecommendationProfileMode;
  partial: boolean;
  failed_sources: string[];
  warnings: string[];
}

export interface PersonalizedRecommendationsRequest {
  userId: string;
  limit: number;
  mediaType: MediaTypeFilter;
  excludeIds: readonly string[];
  cursor?: string | null;
}

interface PersonalizedRecommendationsApiResponse {
  items?: PersonalizedRecommendation[];
  next_cursor?: string | null;
  has_more?: boolean;
  is_exhausted?: boolean;
  scan_budget_reached?: boolean;
  providers_blocked?: boolean;
  broadened?: boolean;
  profile_mode?: RecommendationProfileMode;
  partial?: boolean;
  failed_sources?: string[];
  warnings?: string[];
}

interface PersonalizedRecommendationPage
  extends RecommendationContinuationPage<PersonalizedRecommendation> {
  scanBudgetReached: boolean;
  broadened: boolean;
  profileMode: RecommendationProfileMode;
  partial: boolean;
  failedSources: string[];
  warnings: string[];
  providersBlocked: boolean;
}

export async function getPersonalizedRecommendations(
  request: PersonalizedRecommendationsRequest
): Promise<PersonalizedRecommendationsResponse> {
  const failedSources = new Set<string>();
  const warnings = new Set<string>();
  let broadened = false;
  let scanBudgetReached = false;
  let profileMode: RecommendationProfileMode = "cold_start";

  const collection = await collectRecommendationPages<
    PersonalizedRecommendation,
    PersonalizedRecommendationPage
  >(
    async (continuation) => {
      const page = await fetchPersonalizedRecommendationPage({
        limit: continuation.limit,
        mediaType: request.mediaType,
        excludeIds: continuation.excludeIds,
        cursor: continuation.cursor
      });
      page.failedSources.forEach((source) => failedSources.add(source));
      page.warnings.forEach((warning) => warnings.add(warning));
      broadened ||= page.broadened;
      scanBudgetReached ||= page.scanBudgetReached;
      profileMode = page.profileMode;
      return page;
    },
    {
      limit: request.limit,
      cursor: request.cursor ?? null,
      excludeIds: request.excludeIds,
      identityKeys: createRecommendationIdentityAliases,
      maxRequests: 500,
      shouldPause: (page) => page.providersBlocked
    }
  );

  return {
    items: collection.items,
    next_cursor: collection.nextCursor,
    has_more: collection.hasMore,
    is_exhausted: collection.exhausted,
    scan_budget_reached: scanBudgetReached,
    broadened,
    profile_mode: profileMode,
    partial: failedSources.size > 0 && collection.items.length < request.limit,
    failed_sources: [...failedSources],
    warnings: [...warnings]
  };
}

export async function recordPersonalizedRecommendationImpressions(
  items: readonly PersonalizedRecommendation[]
): Promise<void> {
  if (items.length === 0) return;
  const { data, error } = await supabase.functions.invoke<{ saved?: number }>(
    "personalized-recommendations",
    {
      body: {
        action: "record_impressions",
        impressions: items.slice(0, 12)
      }
    }
  );
  if (error) throw new Error(error.message || "추천 노출 기록을 저장하지 못했습니다");
  if (!data || typeof data.saved !== "number") {
    throw new Error("추천 노출 기록 응답이 올바르지 않습니다");
  }
}

async function fetchPersonalizedRecommendationPage(input: {
  limit: number;
  mediaType: MediaTypeFilter;
  excludeIds: readonly string[];
  cursor: string | null;
}): Promise<PersonalizedRecommendationPage> {
  const body: Record<string, unknown> = {
    action: "recommend",
    limit: Math.min(12, Math.max(1, Math.floor(input.limit))),
    media_type: input.mediaType,
    exclude_ids: Array.from(new Set(input.excludeIds))
  };
  if (input.cursor) body.cursor = input.cursor;

  const { data, error } = await supabase.functions.invoke<PersonalizedRecommendationsApiResponse>(
    "personalized-recommendations",
    { body }
  );
  if (error) throw new Error(error.message || "추천 데이터를 불러오지 못했습니다");
  if (!data || !Array.isArray(data.items)) {
    throw new Error("개인화 추천 응답이 올바르지 않습니다");
  }

  const exhausted = Boolean(data.is_exhausted);
  const nextCursor = data.next_cursor ?? null;
  const hasMore = data.has_more ?? (!exhausted && Boolean(nextCursor));
  if (hasMore && !nextCursor) {
    throw new Error("추천 탐색 커서가 누락되었습니다");
  }

  return {
    items: data.items,
    nextCursor,
    hasMore,
    exhausted,
    scanBudgetReached: Boolean(data.scan_budget_reached),
    broadened: Boolean(data.broadened),
    profileMode: data.profile_mode ?? "cold_start",
    partial: Boolean(data.partial),
    failedSources: data.failed_sources ?? [],
    warnings: data.warnings ?? [],
    providersBlocked: Boolean(data.providers_blocked)
  };
}
