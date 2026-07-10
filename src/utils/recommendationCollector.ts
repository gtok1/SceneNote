export interface RecommendationContinuationPage<T> {
  items: readonly T[];
  nextCursor: string | null;
  hasMore: boolean;
  exhausted: boolean;
}

export interface RecommendationContinuationRequest {
  cursor: string | null;
  limit: number;
  excludeIds: readonly string[];
}

export interface RecommendationCollectionResult<T, TPage extends RecommendationContinuationPage<T>> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  exhausted: boolean;
  page: TPage;
  requestCount: number;
}

export interface RecommendationCollectionOptions<
  T,
  TPage extends RecommendationContinuationPage<T> = RecommendationContinuationPage<T>
> {
  limit: number;
  cursor?: string | null;
  excludeIds?: readonly string[];
  identityKeys: (item: T) => readonly string[];
  maxRequests?: number;
  shouldPause?: (page: TPage, collectedItems: readonly T[]) => boolean;
}

const DEFAULT_MAX_REQUESTS = 120;

export async function collectRecommendationPages<
  T,
  TPage extends RecommendationContinuationPage<T>
>(
  fetchPage: (request: RecommendationContinuationRequest) => Promise<TPage>,
  options: RecommendationCollectionOptions<T, TPage>
): Promise<RecommendationCollectionResult<T, TPage>> {
  const limit = clampInteger(options.limit, 1, 12);
  const maxRequests = clampInteger(options.maxRequests ?? DEFAULT_MAX_REQUESTS, 1, 500);
  const excluded = new Set((options.excludeIds ?? []).map(normalizeIdentity).filter(Boolean));
  const collected: T[] = [];
  const collectedIdentitySets: Set<string>[] = [];
  const visitedCursors = new Set<string>();
  let cursor = options.cursor ?? null;
  let lastPage: TPage | null = null;

  for (let requestCount = 1; requestCount <= maxRequests; requestCount += 1) {
    const page = await fetchPage({
      cursor,
      limit: limit - collected.length,
      excludeIds: [...excluded]
    });
    lastPage = page;

    for (const item of page.items) {
      const identities = new Set(options.identityKeys(item).map(normalizeIdentity).filter(Boolean));
      if (intersects(identities, excluded) || collectedIdentitySets.some((set) => intersects(identities, set))) {
        continue;
      }
      collected.push(item);
      collectedIdentitySets.push(identities);
      for (const identity of identities) excluded.add(identity);
      if (collected.length >= limit) break;
    }

    if (
      collected.length >= limit ||
      page.exhausted ||
      !page.hasMore ||
      (collected.length > 0 && options.shouldPause?.(page, collected) === true)
    ) {
      return {
        items: collected,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        exhausted: page.exhausted,
        page,
        requestCount
      };
    }

    const nextCursor = page.nextCursor;
    if (!nextCursor || nextCursor === cursor || visitedCursors.has(nextCursor)) {
      throw new Error("RECOMMENDATION_CURSOR_DID_NOT_ADVANCE");
    }
    visitedCursors.add(nextCursor);
    cursor = nextCursor;
  }

  if (!lastPage) throw new Error("RECOMMENDATION_PAGE_MISSING");
  throw new Error("RECOMMENDATION_CONTINUATION_LIMIT_REACHED");
}

function intersects(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function normalizeIdentity(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}
