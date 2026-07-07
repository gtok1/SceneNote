import { searchContent } from "@/services/contentSearch";
import type { SearchResult } from "@/types/content";

export type RecommendationCategory = "drama" | "anime";

export interface PopularRecommendation extends SearchResult {
  category: RecommendationCategory;
  rank: number;
  trend_source: string;
  release_month?: number | null;
}

export interface PopularRecommendationsResponse {
  generated_at: string;
  categories: Record<RecommendationCategory, PopularRecommendation[]>;
  failedSources: string[];
  partial: boolean;
}

const CURRENT_RELEASE_YEAR = new Date().getFullYear();
const CURRENT_RELEASE_MONTH = new Date().getMonth() + 1;
const RECOMMENDATION_POOL_LIMIT = 30;
const FALLBACK_SEARCH_BATCH_SIZE = 6;

interface FallbackQuery {
  query: string;
  releaseMonth: number;
}

const FALLBACK_QUERIES: Record<RecommendationCategory, FallbackQuery[]> = {
  drama: [
    { query: "아파트", releaseMonth: 7 },
    { query: "결혼의 완성", releaseMonth: 7 },
    { query: "공감세포", releaseMonth: 7 },
    { query: "그대에게 드림", releaseMonth: 7 },
    { query: "새디스틱 뷰티", releaseMonth: 7 },
    { query: "오싹한 연애", releaseMonth: 7 },
    { query: "가족관계증명서", releaseMonth: 7 },
    { query: "죄와 사랑", releaseMonth: 7 },
    { query: "최애 데뷔", releaseMonth: 7 },
    { query: "스트렌지 이토 준지", releaseMonth: 7 },
    { query: "The Husband", releaseMonth: 7 },
    { query: "Love in Sync", releaseMonth: 7 },
    { query: "The East Palace", releaseMonth: 7 },
    { query: "동궁", releaseMonth: 7 },
    { query: "김부장", releaseMonth: 6 },
    { query: "검사실의 제안", releaseMonth: 6 },
    { query: "참교육", releaseMonth: 6 },
    { query: "맨 끝줄 소년", releaseMonth: 6 },
    { query: "내일도 출근", releaseMonth: 6 },
    { query: "닥터 섬보이", releaseMonth: 6 },
    { query: "Mercy for None", releaseMonth: 6 },
    { query: "Good Boy", releaseMonth: 6 },
    { query: "Our Movie", releaseMonth: 6 },
    { query: "The First Night With the Duke", releaseMonth: 6 },
    { query: "Head Over Heels", releaseMonth: 6 },
    { query: "Agent Kim Reactivated", releaseMonth: 6 },
    { query: "Spring Fever", releaseMonth: 6 }
  ],
  anime: [
    { query: "Mushoku Tensei: Jobless Reincarnation Season 3", releaseMonth: 7 },
    { query: "You and I Are Polar Opposites Season 2", releaseMonth: 7 },
    { query: "Daemons of the Shadow Realm", releaseMonth: 7 },
    { query: "The 100 Girlfriends Season 3", releaseMonth: 7 },
    { query: "That Time I Got Reincarnated as a Slime Season 4", releaseMonth: 7 },
    { query: "The World's Strongest Rearguard", releaseMonth: 7 },
    { query: "Sparks of Tomorrow", releaseMonth: 7 },
    { query: "Black Torch", releaseMonth: 7 },
    { query: "Goodbye, Lara", releaseMonth: 7 },
    { query: "Chainsmoker Cat", releaseMonth: 7 },
    { query: "Kaiju Girl Caramelise", releaseMonth: 7 },
    { query: "Jaadugar: A Witch in Mongolia", releaseMonth: 7 },
    { query: "Super no Ura de Yani Suu Futari", releaseMonth: 7 },
    { query: "Skeleton Knight in Another World Season 2", releaseMonth: 7 },
    { query: "MARRIAGETOXIN", releaseMonth: 7 },
    { query: "ONE PIECE HEROINES", releaseMonth: 7 },
    { query: "The Ramparts of Ice", releaseMonth: 7 },
    { query: "Welcome to Demon School Iruma-kun Season 4", releaseMonth: 7 },
    { query: "I Want to End this Love Game", releaseMonth: 7 },
    { query: "Witch Hat Atelier", releaseMonth: 6 },
    { query: "Re:ZERO -Starting Life in Another World- Season 4", releaseMonth: 6 },
    { query: "Wistoria: Wand and Sword Season 2", releaseMonth: 6 },
    { query: "Classroom of the Elite Season 4", releaseMonth: 6 },
    { query: "Ascendance of a Bookworm: Adopted Daughter of an Archduke", releaseMonth: 6 },
    { query: "Daemons of the Shadow Realm", releaseMonth: 6 }
  ]
};

export async function getPopularRecommendations(): Promise<PopularRecommendationsResponse> {
  return getFallbackRecommendations();
}

async function getFallbackRecommendations(reason?: string): Promise<PopularRecommendationsResponse> {
  const [drama, anime] = await Promise.all([
    searchFallbackCategory("drama"),
    searchFallbackCategory("anime")
  ]);

  if (!drama.length && !anime.length) {
    if (reason) throw new Error(reason);
  }

  return {
    generated_at: new Date().toISOString(),
    categories: {
      drama,
      anime
    },
    failedSources: [],
    partial: false
  };
}

async function searchFallbackCategory(category: RecommendationCategory): Promise<PopularRecommendation[]> {
  const seen = new Set<string>();
  const items: PopularRecommendation[] = [];

  for (let index = 0; index < FALLBACK_QUERIES[category].length; index += FALLBACK_SEARCH_BATCH_SIZE) {
    const queryBatch = FALLBACK_QUERIES[category].slice(index, index + FALLBACK_SEARCH_BATCH_SIZE);
    const settledResults = await Promise.allSettled(
      queryBatch.map(({ query }) =>
        searchContent({
          query,
          mediaType: category === "anime" ? "anime" : "drama"
        })
      )
    );

    settledResults.forEach((result, batchIndex) => {
      if (result.status !== "fulfilled") return;

      const fallback = queryBatch[batchIndex];
      result.value.results.forEach((item) => {
        if (!matchesCategory(item, category)) return;
        if (!isCurrentRelease(item)) return;

        const key = `${item.external_source}:${item.external_id}`;
        if (seen.has(key)) return;
        seen.add(key);

        items.push({
          ...item,
          category,
          rank: items.length + 1,
          release_month: fallback?.releaseMonth ?? null,
          trend_source: fallback?.releaseMonth
            ? `${CURRENT_RELEASE_YEAR}년 ${fallback.releaseMonth}월 인기 신작`
            : "최신 검색 기반"
        });
      });
    });

    if (items.length >= RECOMMENDATION_POOL_LIMIT) break;
  }

  return normalizeCategory(items, category);
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
    .filter(isCurrentRelease)
    .filter((item) => {
      const key = `${item.external_source}:${item.external_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(compareRecommendationRecency)
    .slice(0, RECOMMENDATION_POOL_LIMIT);

  return filtered.map((item, index) => ({
    ...item,
    category,
    rank: index + 1
  }));
}

function isCurrentRelease(item: SearchResult): boolean {
  return item.air_year === CURRENT_RELEASE_YEAR;
}

function compareRecommendationRecency(a: PopularRecommendation, b: PopularRecommendation): number {
  return getReleaseMonthScore(b) - getReleaseMonthScore(a) || a.rank - b.rank;
}

function getReleaseMonthScore(item: PopularRecommendation): number {
  const month = item.release_month ?? 0;
  if (month > 0 && month <= CURRENT_RELEASE_MONTH) return month;
  return 0;
}
