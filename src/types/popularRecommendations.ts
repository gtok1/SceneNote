import type { SearchResult } from "./content";

export type RecommendationCategory = "drama" | "anime";

export interface PopularRecommendation extends SearchResult {
  keywords?: string[] | null;
  themes?: { family?: string | null; key?: string | null }[] | null;
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
