import { supabase } from "@/lib/supabase";
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

const KOREAN_TITLE_OVERRIDE_ENTRIES: readonly (readonly [string, string])[] = [
  ["Mushoku Tensei: Jobless Reincarnation Season 3", "무직전생 3기"],
  ["You and I Are Polar Opposites Season 2", "정반대의 너와 나 2기"],
  ["Daemons of the Shadow Realm", "황천의 츠가이"],
  ["The 100 Girlfriends Season 3", "너를 너무너무너무너무 좋아하는 100명의 그녀 3기"],
  ["That Time I Got Reincarnated as a Slime Season 4", "전생했더니 슬라임이었던 건에 대하여 4기"],
  ["The World's Strongest Rearguard", "세계 최강의 후위 ~미궁국의 신인 탐색자~"],
  ["Sparks of Tomorrow", "스파크스 오브 투모로우"],
  ["Black Torch", "블랙 토치"],
  ["BLACK TORCH", "블랙 토치"],
  ["Goodbye, Lara", "굿바이, 라라"],
  ["Chainsmoker Cat", "체인스모커 캣"],
  ["Kaiju Girl Caramelise", "괴수 소녀 카라멜라이즈"],
  ["Jaadugar: A Witch in Mongolia", "자두가르: 몽골의 마녀"],
  ["Super no Ura de Yani Suu Futari", "슈퍼 뒤에서 담배 피우는 두 사람"],
  ["Skeleton Knight in Another World Season 2", "해골기사님은 지금 이세계 모험 중 2기"],
  ["MARRIAGETOXIN", "매리지 톡신"],
  ["ONE PIECE HEROINES", "원피스 히로인즈"],
  ["The Ramparts of Ice", "얼음 성벽"],
  ["Welcome to Demon School Iruma-kun Season 4", "마계학교 이루마군 4기"],
  ["Welcome to Demon School! Iruma-kun Season 4", "마계학교 이루마군 4기"],
  ["I Want to End this Love Game", "이 사랑을 끝내고 싶어"],
  ["Witch Hat Atelier", "마녀의 모자 아틀리에"],
  ["Re:ZERO -Starting Life in Another World- Season 4", "Re:제로부터 시작하는 이세계 생활 4기"],
  ["Wistoria: Wand and Sword Season 2", "지팡이와 검의 위스토리아 2기"],
  ["Classroom of the Elite Season 4", "어서 오세요 실력지상주의 교실에 4기"],
  ["Ascendance of a Bookworm: Adopted Daughter of an Archduke", "책벌레의 하극상 영주의 양녀 편"],
  ["The Exiled Heavy Knight Knows How to Game the System", "추방된 전직 중기사는 게임 지식으로 무쌍한다"],
  ["The Cat and the Dragon", "고양이와 용"]
];

const KOREAN_TITLE_OVERRIDES = new Map<string, string>(
  KOREAN_TITLE_OVERRIDE_ENTRIES.map(([title, koreanTitle]) => [normalizeTitleForOverride(title), koreanTitle])
);

export async function getPopularRecommendations(): Promise<PopularRecommendationsResponse> {
  try {
    const { data, error } = await supabase.functions.invoke<PopularRecommendationsResponse>("popular-recommendations", {
      body: {}
    });

    if (error) throw new Error(error.message);
    if (!data) throw new Error("추천 응답이 비어 있습니다");

    const normalizedCategories = {
      drama: normalizeRecommendationDates(data.categories?.drama ?? []).map(applyKoreanTitleFallback),
      anime: normalizeRecommendationDates(data.categories?.anime ?? []).map(applyKoreanTitleFallback)
    };
    const categories = await fillRecommendationPools(normalizedCategories);

    return {
      ...data,
      categories,
      failedSources: data.failedSources ?? [],
      partial: Boolean(data.partial)
    };
  } catch (error) {
    return getFallbackRecommendations(error instanceof Error ? error.message : "추천을 불러오지 못했습니다");
  }
}

async function fillRecommendationPools(
  categories: Record<RecommendationCategory, PopularRecommendation[]>
): Promise<Record<RecommendationCategory, PopularRecommendation[]>> {
  const filledCategories = { ...categories };
  const categoriesToFill = (Object.keys(categories) as RecommendationCategory[]).filter(
    (category) => categories[category].length < RECOMMENDATION_POOL_LIMIT
  );

  const fallbackResults = await Promise.allSettled(
    categoriesToFill.map((category) => searchFallbackCategory(category))
  );

  fallbackResults.forEach((result, index) => {
    const category = categoriesToFill[index];
    if (!category || result.status !== "fulfilled") return;

    filledCategories[category] = normalizeCategory(
      [...filledCategories[category], ...result.value],
      category
    );
  });

  return filledCategories;
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
          air_date: item.air_date ?? createMonthStartDate(item.air_year, fallback?.releaseMonth ?? null),
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
    ...applyKoreanTitleFallback(item),
    category,
    rank: index + 1,
    air_date: item.air_date ?? createMonthStartDate(item.air_year, item.release_month ?? null)
  }));
}

function isCurrentRelease(item: SearchResult): boolean {
  return item.air_year === CURRENT_RELEASE_YEAR;
}

function compareRecommendationRecency(a: PopularRecommendation, b: PopularRecommendation): number {
  return getReleaseMonthScore(b) - getReleaseMonthScore(a) || a.rank - b.rank;
}

function getReleaseMonthScore(item: PopularRecommendation): number {
  const month = item.release_month ?? monthFromDate(item.air_date) ?? 0;
  if (month > 0 && month <= CURRENT_RELEASE_MONTH) return month;
  return 0;
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

  const koreanTitle = findKoreanTitleOverride(item);
  if (!koreanTitle) return item;

  return {
    ...item,
    title_primary: koreanTitle,
    title_original: item.title_original ?? item.title_primary
  };
}

function findKoreanTitleOverride(item: SearchResult): string | null {
  const candidates = [item.title_primary, item.title_original].filter(Boolean);
  for (const candidate of candidates) {
    const title = KOREAN_TITLE_OVERRIDES.get(normalizeTitleForOverride(candidate ?? ""));
    if (title) return title;
  }

  return null;
}

function hasHangul(value: string | null | undefined): boolean {
  return /[가-힣]/.test(value ?? "");
}

function normalizeTitleForOverride(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
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
