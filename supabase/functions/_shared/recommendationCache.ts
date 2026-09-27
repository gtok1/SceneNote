export type RecommendationCacheSource = "tmdb" | "anilist";

/** Public provider metadata only; never store a user's ranked feed here. */
export interface RecommendationCache {
  get<T>(key: string, source: RecommendationCacheSource): Promise<T | null>;
  set<T>(key: string, source: RecommendationCacheSource, value: T, ttlMs: number): Promise<void>;
}

export interface RecommendationCacheStore {
  read(key: string, source: RecommendationCacheSource): Promise<{
    value: unknown;
    expiresAt: string;
  } | null>;
  write(key: string, source: RecommendationCacheSource, value: unknown, expiresAt: string): Promise<void>;
}

export function createPersistentRecommendationCache(
  store: RecommendationCacheStore,
  now: () => number = Date.now,
  timeoutMs = 800,
  deadlineMs = Number.POSITIVE_INFINITY
): RecommendationCache {
  const remainingTime = () => Math.max(0, Math.min(timeoutMs, deadlineMs - now()));
  return {
    async get<T>(key: string, source: RecommendationCacheSource): Promise<T | null> {
      const row = await boundedCacheOperation(() => store.read(key, source), null, remainingTime());
      if (!row || !(Date.parse(row.expiresAt) > now())) return null;
      return row.value as T;
    },
    async set<T>(key: string, source: RecommendationCacheSource, value: T, ttlMs: number): Promise<void> {
      if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
      await boundedCacheOperation(
        () => store.write(key, source, value, new Date(now() + ttlMs).toISOString()),
        undefined,
        remainingTime()
      );
    }
  };
}

async function boundedCacheOperation<T>(
  operation: () => Promise<T>,
  fallback: T,
  timeoutMs: number
): Promise<T> {
  if (timeoutMs <= 0) return fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation).catch(() => fallback),
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs); })
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
