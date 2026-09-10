import { recommendationProviderError } from "@/utils/searchRecommendationPolicy";
import { supabase } from "@/lib/supabase";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import {
  collectRecommendationPages,
  type RecommendationContinuationPage
} from "@/utils/recommendationCollector";
import {
  createRecommendationIdentityAliases,
  type RecommendationFeedback,
  type RecommendationReason,
  type RecommendationSignal
} from "../../supabase/functions/_shared/recommendationEngine";
import { createPersonalizedRecommendationFeedbackBody } from "./personalizedRecommendationFeedback";

export type RecommendationProfileMode = "cold_start" | "light" | "personalized";

export interface PersonalizedRecommendation extends SearchResult {
  canonical_id: string;
  similarity_score: number;
  recommendation_reason: string;
  recommendation_signals?: RecommendationSignal[];
  recommendation_reason_detail?: RecommendationReason;
  themes?: import("../../supabase/functions/_shared/recommendationThemes").ContentTheme[];
  is_exploration?: boolean;
  preference_evidence?: "positive" | "negative" | "unknown";
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

export async function recordPersonalizedRecommendationFeedback(
  feedback: RecommendationFeedback | readonly RecommendationFeedback[]
): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ saved?: boolean }>(
    "personalized-recommendations",
    { body: createPersonalizedRecommendationFeedbackBody(feedback), timeout: 10_000 }
  );
  if (error) throw new Error(error.message || "추천 피드백을 저장하지 못했습니다");
  if (!data?.saved) throw new Error("추천 피드백 응답이 올바르지 않습니다");
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
  signal?: AbortSignal;
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
  let partial = false;
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
        cursor: continuation.cursor,
        ...(request.signal ? { signal: request.signal } : {})
      });
      page.failedSources.forEach((source) => failedSources.add(source));
      page.warnings.forEach((warning) => warnings.add(warning));
      broadened ||= page.broadened;
      partial ||= page.partial;
      scanBudgetReached ||= page.scanBudgetReached;
      profileMode = page.profileMode;
      return page;
    },
    {
      limit: request.limit,
      cursor: request.cursor ?? null,
      excludeIds: request.excludeIds,
      identityKeys: createRecommendationIdentityAliases,
      maxRequests: 1,
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
    partial: partial || failedSources.size > 0,
    failed_sources: [...failedSources],
    warnings: [...warnings]
  };
}

export async function recordPersonalizedRecommendationImpressions(
  items: readonly PersonalizedRecommendation[],
  signal?: AbortSignal
): Promise<void> {
  if (items.length === 0) return;
  const { data, error } = await supabase.functions.invoke<{ saved?: number }>(
    "personalized-recommendations",
    {
      timeout: 10_000,
      ...(signal ? { signal } : {}),
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
  signal?: AbortSignal;
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
    { body, timeout: 10_000, ...(input.signal ? { signal: input.signal } : {}) }
  );
  if (error) {
    const response = error.context instanceof Response ? error.context : null;
    const status = response?.status ?? null;
    if (__DEV__ && response) {
      const payload: unknown = await response.clone().json().catch(() => null);
      const code = payload && typeof payload === "object" && "error" in payload ? payload.error : null;
      const knownCodes = ["ALL_PROVIDERS_FAILED", "RECOMMENDATION_FAILED", "INVALID_CURSOR", "LIBRARY_QUERY_FAILED", "FEEDBACK_QUERY_FAILED", "UNAUTHORIZED", "INVALID_REQUEST"];
      console.warn("recommendation diagnostic", JSON.stringify({action:"recommend", status, code:typeof code === "string" && knownCodes.includes(code) ? code : "UNKNOWN"}));
    }
    throw new Error(status ? `추천 서버에 연결하지 못했습니다 (${status}). 다시 시도해 주세요.` : "추천 연결이 끊겼거나 응답 시간이 초과되었습니다. 다시 시도해 주세요.");
  }
  if (!data || !Array.isArray(data.items)) {
    throw new Error("개인화 추천 응답이 올바르지 않습니다");
  }

  if (__DEV__) console.info("recommendation response", JSON.stringify({
    action: "recommend", mediaType: input.mediaType, cursor: input.cursor ? "continuation" : "initial",
    count: data.items.length, hasMore: data.has_more, partial: data.partial,
    failedSources: (data.failed_sources ?? []).filter(source => ["tmdb", "anilist", "tmdb_kr", "tmdb_jp", "tmdb_movie"].includes(source))
  }));
  const providerError = recommendationProviderError(Boolean(data.providers_blocked), data.items.length);
  if (providerError) throw new Error(providerError);
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
