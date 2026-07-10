import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";
import type { SearchResult } from "@/types/content";
import {
  DEFAULT_CANDIDATE_WINDOW_DAYS,
  isWithinCandidateWindow,
  rankPopularRecommendations
} from "@/utils/popularRanking";

export type RecommendationCategory = "drama" | "anime";

export interface PopularRecommendation extends SearchResult {
  category: RecommendationCategory;
  rank: number;
  trend_source: string;
  release_month?: number | null;
  popularity?: number | null;
  trendingIndex?: number | null;
}

export interface PopularRecommendationsResponse {
  generated_at: string;
  categories: Record<RecommendationCategory, PopularRecommendation[]>;
  failedSources: string[];
  partial: boolean;
  stale?: boolean;
}

const RECOMMENDATION_POOL_LIMIT = 30;
const LAST_GOOD_RECOMMENDATIONS_KEY = "scenenote-popular-recommendations-last-good";

interface LastGoodRecommendationCache {
  savedAt: string;
  response: PopularRecommendationsResponse;
}

export async function getPopularRecommendations(): Promise<PopularRecommendationsResponse> {
  try {
    const { data, error } = await supabase.functions.invoke<PopularRecommendationsResponse>("popular-recommendations", {
      body: {
        candidate_days: DEFAULT_CANDIDATE_WINDOW_DAYS,
        pool_limit: RECOMMENDATION_POOL_LIMIT
      }
    });

    if (error) throw new Error(error.message);
    if (!data) throw new Error("추천 응답이 비어 있습니다");

    const normalizedCategories = {
      drama: normalizeRecommendationDates(data.categories?.drama ?? []).map(applyKoreanTitleFallback),
      anime: normalizeRecommendationDates(data.categories?.anime ?? []).map(applyKoreanTitleFallback)
    };
    const response = {
      ...data,
      categories: {
        drama: normalizeCategory(normalizedCategories.drama, "drama"),
        anime: normalizeCategory(normalizedCategories.anime, "anime")
      },
      failedSources: data.failedSources ?? [],
      partial: Boolean(data.partial),
      stale: false
    };

    await saveLastGoodRecommendations(response);
    return response;
  } catch (error) {
    return getLastGoodRecommendations(error instanceof Error ? error.message : "추천을 불러오지 못했습니다");
  }
}

async function getLastGoodRecommendations(reason?: string): Promise<PopularRecommendationsResponse> {
  const cached = await readLastGoodRecommendations();
  if (cached) {
    return {
      ...cached.response,
      failedSources: cached.response.failedSources ?? [],
      partial: true,
      stale: true
    };
  }

  if (reason) {
    console.warn("popular recommendations fallback has no cached response:", reason);
  }

  return {
    generated_at: new Date().toISOString(),
    categories: {
      drama: [],
      anime: []
    },
    failedSources: [],
    partial: true,
    stale: true
  };
}

function matchesCategory(item: SearchResult, category: RecommendationCategory): boolean {
  if (category === "anime") return item.content_type === "anime";
  return item.content_type === "kdrama" || item.content_type === "jdrama";
}

function normalizeCategory(
  items: PopularRecommendation[],
  category: RecommendationCategory
): PopularRecommendation[] {
  const seen = new Set<string>();
  const filtered = items
    .filter((item) => matchesCategory(item, category))
    .filter(isPopularCandidate)
    .filter((item) => {
      const key = `${item.external_source}:${item.external_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const ranked = rankPopularRecommendations(filtered, {
    poolLimit: RECOMMENDATION_POOL_LIMIT
  });

  return ranked.map((item, index) => ({
    ...applyKoreanTitleFallback(item),
    category,
    rank: index + 1,
    air_date: item.air_date ?? createMonthStartDate(item.air_year, item.release_month ?? null)
  }));
}

function isPopularCandidate(item: SearchResult): boolean {
  return isWithinCandidateWindow(
    { air_date: item.air_date ?? null, air_year: item.air_year },
    new Date(),
    DEFAULT_CANDIDATE_WINDOW_DAYS
  );
}

function normalizeRecommendationDates(items: PopularRecommendation[]): PopularRecommendation[] {
  return items.map((item) => ({
    ...item,
    release_month: item.release_month ?? monthFromDate(item.air_date),
    air_date: item.air_date ?? createMonthStartDate(item.air_year, item.release_month ?? null)
  }));
}

function applyKoreanTitleFallback<T extends PopularRecommendation>(item: T): T {
  if (hasHangul(item.title_primary)) return item;

  if (item.title_original && hasHangul(item.title_original)) {
    return {
      ...item,
      title_primary: item.title_original,
      title_original: item.title_primary
    };
  }

  return item;
}

function hasHangul(value: string | null | undefined): boolean {
  return /[가-힣]/.test(value ?? "");
}

function createMonthStartDate(year: number | null | undefined, month: number | null | undefined): string | null {
  if (!year || !month || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function monthFromDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^\d{4}-(\d{2})/.exec(value);
  if (!match?.[1]) return null;
  const month = Number.parseInt(match[1], 10);
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : null;
}

async function saveLastGoodRecommendations(response: PopularRecommendationsResponse): Promise<void> {
  try {
    const cache: LastGoodRecommendationCache = {
      savedAt: new Date().toISOString(),
      response: {
        ...response,
        stale: false
      }
    };

    await AsyncStorage.setItem(LAST_GOOD_RECOMMENDATIONS_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn("popular recommendations last-good cache write failed:", error);
  }
}

async function readLastGoodRecommendations(): Promise<LastGoodRecommendationCache | null> {
  try {
    const rawValue = await AsyncStorage.getItem(LAST_GOOD_RECOMMENDATIONS_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as Partial<LastGoodRecommendationCache>;
    if (!parsed.response?.categories) return null;

    return {
      savedAt: parsed.savedAt ?? new Date(0).toISOString(),
      response: {
        generated_at: parsed.response.generated_at ?? new Date(0).toISOString(),
        categories: {
          drama: normalizeCategory(parsed.response.categories.drama ?? [], "drama"),
          anime: normalizeCategory(parsed.response.categories.anime ?? [], "anime")
        },
        failedSources: parsed.response.failedSources ?? [],
        partial: true,
        stale: true
      }
    };
  } catch (error) {
    console.warn("popular recommendations last-good cache read failed:", error);
    return null;
  }
}
