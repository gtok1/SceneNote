import { QueryClient } from "@tanstack/react-query";

import type { MediaTypeFilter } from "@/types/content";
import type { WatchStatus } from "@/types/library";
import { createRecommendationFeedKey } from "@/utils/recommendationFeed";
import { LATEST_RECOMMENDATION_CACHE_VERSION } from "@/utils/latestRecommendationPolicy";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000
    },
    mutations: {
      retry: 0
    }
  }
});

export const queryKeys = {
  auth: {
    session: ["auth", "session"] as const
  },
  search: {
    results: (query: string, mediaType: MediaTypeFilter, page: number, discoverySignature = "[[],[],[]]") =>
      ["search", query, mediaType, page, discoverySignature] as const,
    similar: (userId: string, librarySignature: string, anchorKey: string, focus: string, mediaType: MediaTypeFilter, sort: string, filters: string) =>
      ["search", "similar", "similarity-snapshot-v2", userId, librarySignature, anchorKey, focus, mediaType, sort, filters] as const
  },
  recommendations: {
    personalized: (userId: string, mediaType: MediaTypeFilter, exclusionSignature = "[[],[]]", discoverySignature = "[[],[],[]]") =>
      [
        ...createRecommendationFeedKey(userId, mediaType, exclusionSignature, discoverySignature),
        LATEST_RECOMMENDATION_CACHE_VERSION,
        "ko-metadata-v2",
        "recent-impressions-v1"
      ] as const
  },
  library: {
    all: (userId: string) => ["library", userId] as const,
    byStatus: (userId: string, status: WatchStatus | "all") =>
      ["library", userId, "status", status] as const,
    item: (userId: string, contentId: string) => ["library", userId, contentId] as const
  },
  content: {
    watchProviders: (lookupKey: string) => ["content", "watch-providers", "manual-v1", lookupKey] as const,
    single: (contentId: string) => ["content", contentId] as const,
    seasons: (contentId: string) => ["content", contentId, "seasons"] as const,
    episodes: (contentId: string, seasonId: string | null) =>
      ["content", contentId, "episodes", seasonId] as const,
    episodeDuration: (episodeId: string) => ["content", "episode", episodeId, "duration"] as const
  },
  progress: {
    byContent: (userId: string, contentId: string) =>
      ["progress", userId, "content", contentId] as const
  },
  pins: {
    all: (userId: string) => ["pins", userId] as const,
    byContent: (userId: string, contentId: string) =>
      ["pins", userId, "content", contentId] as const,
    byEpisode: (userId: string, episodeId: string) =>
      ["pins", userId, "episode", episodeId] as const,
    byTag: (userId: string, tagId: string) => ["pins", userId, "tag", tagId] as const,
    single: (pinId: string) => ["pins", "single", pinId] as const
  },
  tags: {
    all: (userId: string) => ["tags", userId] as const
  },
  reviews: {
    byContent: (userId: string, contentId: string) =>
      ["reviews", userId, "content", contentId] as const
  },
  profile: {
    detail: (userId: string) => ["profile", userId, "detail"] as const,
    subscribedOtts: (userId: string) => ["profile", userId, "subscribed-otts"] as const,
    stats: (userId: string) => ["profile", userId, "stats"] as const
  },
  genreStats: (userId: string) => ["genre-stats", userId] as const
} as const;
