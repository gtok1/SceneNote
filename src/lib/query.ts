import { QueryClient } from "@tanstack/react-query";

import type { MediaTypeFilter } from "@/types/content";
import type { WatchStatus } from "@/types/library";
import { createRecommendationFeedKey } from "@/utils/recommendationFeed";

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
    results: (query: string, mediaType: MediaTypeFilter, page: number, country = "all") =>
      ["search", query, mediaType, page, country] as const,
    similar: (anchorKey: string, focus: string, mediaType: MediaTypeFilter, sort: string, filters: string) =>
      ["search", "similar", "hybrid-v1-no-embeddings", anchorKey, focus, mediaType, sort, filters] as const
  },
  recommendations: {
    popular: (userId: string) => ["recommendations", userId, "popular", "ko-title-v2"] as const,
    personalized: (userId: string, mediaType: MediaTypeFilter) =>
      [
        ...createRecommendationFeedKey(userId, mediaType),
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
    stats: (userId: string) => ["profile", userId, "stats"] as const
  },
  genreStats: (userId: string) => ["genre-stats", userId] as const
} as const;
