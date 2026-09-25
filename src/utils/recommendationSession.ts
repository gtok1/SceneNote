import {
  createRecommendationIdentityAliases,
  type RecommendationCandidate
} from "../../supabase/functions/_shared/recommendationEngine";

const SESSION_STORAGE_PREFIX = "scenenote:taste-recommendations:seen";
const MAX_RECOMMENDATION_REQUEST_EXCLUSION_IDS = 200;

const memorySeenIds = new Map<string, string[]>();

export function collectRecommendationSessionSeenIds(
  items: readonly RecommendationCandidate[]
): string[] {
  return normalizeSeenIds(
    items.flatMap((item) => createRecommendationIdentityAliases(item))
  );
}

/** Keep the latest aliases within the Edge Function's per-request limit. */
export function limitRecommendationRequestExclusions(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const latestIds: string[] = [];

  for (
    let index = ids.length - 1;
    index >= 0 && latestIds.length < MAX_RECOMMENDATION_REQUEST_EXCLUSION_IDS;
    index -= 1
  ) {
    const id = ids[index]?.trim();
    if (!id || seen.has(id)) continue;

    seen.add(id);
    latestIds.push(id);
  }

  return latestIds.reverse();
}

export function readRecommendationSessionSeenIds(userId: string): string[] {
  const storageKey = createStorageKey(userId);
  const sessionStorage = getPersistentStorage();
  const memoryIds = memorySeenIds.get(storageKey) ?? [];

  if (!sessionStorage) {
    return [...memoryIds];
  }

  try {
    const storedValue = sessionStorage.getItem(storageKey);
    if (!storedValue) return [...memoryIds];

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [...memoryIds];

    return normalizeSeenIds([...parsedValue, ...memoryIds]);
  } catch {
    return [...memoryIds];
  }
}

export function rememberRecommendationSessionSeenIds(
  userId: string,
  ids: readonly string[]
): string[] {
  const storageKey = createStorageKey(userId);
  const nextIds = normalizeSeenIds([
    ...readRecommendationSessionSeenIds(userId),
    ...ids
  ]);
  const sessionStorage = getPersistentStorage();

  if (!sessionStorage) {
    memorySeenIds.set(storageKey, nextIds);
    return [...nextIds];
  }

  try {
    sessionStorage.setItem(storageKey, JSON.stringify(nextIds));
  } catch {
    memorySeenIds.set(storageKey, nextIds);
  }

  return [...nextIds];
}

export function clearRecommendationSessionSeenIds(userId: string): void {
  const storageKey = createStorageKey(userId);
  memorySeenIds.delete(storageKey);

  try {
    getPersistentStorage()?.removeItem(storageKey);
  } catch {
    // A disabled browser storage area should not prevent the feed from working.
  }
}

function createStorageKey(userId: string): string {
  return `${SESSION_STORAGE_PREFIX}:${userId}`;
}

function normalizeSeenIds(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
}

function getPersistentStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
