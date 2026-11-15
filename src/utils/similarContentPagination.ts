import type { SimilaritySort } from "./similarSearchIntent";
import { searchSeasonIdentity } from "./searchRecommendationPolicy";

export const SIMILAR_PAGINATION_VERSION = "similarity-snapshot-v2";
export const SIMILAR_PAGE_SIZE = 12;

export function similarityAnchorKey(anchor: {
  external_source: string; external_id: string; content_type: string; season_number?: number | null;
} | null): string {
  return anchor ? `${anchor.external_source}:${anchor.content_type}:${anchor.external_id}:${anchor.season_number ?? "whole"}` : "";
}

interface SimilarPage {
  items: readonly { external_source: string; external_id: string; season_number?: number | null }[];
  has_more?: boolean;
  next_cursor?: string | null;
  pagination_version?: string;
  total_count?: number;
}

export class SimilarContentError extends Error {
  constructor(readonly code: string) {
    super(code === "SIMILARITY_RESTART_REQUIRED"
      ? "검색 결과가 갱신됐어요. 처음부터 다시 찾아 주세요."
      : code === "INVALID_RESPONSE"
        ? "비슷한 작품 응답을 확인하지 못했어요. 다시 시도해 주세요."
        : "비슷한 작품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    this.name = "SimilarContentError";
  }
}

export function isSimilarityRestartRequired(error: unknown): boolean {
  return error instanceof SimilarContentError && error.code === "SIMILARITY_RESTART_REQUIRED";
}

/** Keep server snapshot order. The same series' separate seasons are separate cards. */
export function mergeSimilarPages<T extends SimilarPage>(pages: readonly T[]): T["items"][number][] {
  const items = new Map<string, T["items"][number]>();
  for (const page of pages) for (const item of page.items) {
    const key = searchSeasonIdentity(item);
    if (!items.has(key)) items.set(key, item);
  }
  return [...items.values()];
}

export function nextSimilarCursor(lastPage: SimilarPage, pages: readonly SimilarPage[]): string | undefined {
  if (lastPage.pagination_version !== SIMILAR_PAGINATION_VERSION || !lastPage.has_more || !lastPage.next_cursor) return undefined;
  if (pages.slice(0, -1).some(page => page.next_cursor === lastPage.next_cursor)) return undefined;
  return lastPage.next_cursor;
}

export function similarPaginationUnavailable(pages: readonly SimilarPage[]): boolean {
  return pages.some(page => page.pagination_version !== SIMILAR_PAGINATION_VERSION);
}

/** Legacy deployments may still show their first results, but must not pretend to be complete. */
export function validateSimilarPage(page: SimilarPage): void {
  if (page.pagination_version === undefined) return;
  if (page.pagination_version !== SIMILAR_PAGINATION_VERSION ||
      !Number.isInteger(page.total_count) || (page.total_count ?? -1) < page.items.length ||
      typeof page.has_more !== "boolean" ||
      (page.has_more ? typeof page.next_cursor !== "string" || !page.next_cursor.trim() || page.items.length === 0 : page.next_cursor !== null)) {
    throw new SimilarContentError("INVALID_RESPONSE");
  }
}

export function similaritySortLabel(sort: SimilaritySort): string {
  return normalizeSimilaritySecondarySort(sort) === "popular" ? "인기순" : "최신순";
}

export function normalizeSimilaritySecondarySort(value: unknown): "latest" | "popular" {
  return value === "popular" ? "popular" : "latest";
}

export function similarResultsStatus(sort: SimilaritySort, count: number, total?: number): string {
  return `유사도 우선 · ${similaritySortLabel(sort)} · 비슷한 작품 ${count}${total === undefined ? "" : ` / ${total}`}개 표시`;
}

export function shouldLoadMoreSimilarOnScroll(input: {
  previousOffsetY: number | null; offsetY: number; viewportHeight: number; contentHeight: number;
}): boolean {
  return input.previousOffsetY !== null && input.offsetY > input.previousOffsetY + 1 &&
    input.offsetY + input.viewportHeight >= input.contentHeight - Math.max(80, input.viewportHeight * 0.35);
}
