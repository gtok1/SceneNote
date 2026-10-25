import type { RecommendationPreferenceProfile, RecommendationMediaType } from "./recommendationEngine.ts";
import { normalizeDiscoveryFilters, normalizeDiscoveryGenre, type DiscoveryFilterInput } from "./discoveryFilters.ts";
import type { UserRecommendationFilters } from "./recommendationUserFilters.ts";

export type TasteFillGroup = "drama-KR" | "drama-JP" | "drama" | "anime" | "movie";
export interface TasteFillQuery { key: string; group: TasteFillGroup; kind: "tv" | "movie"; countries: string[]; genres: string[] }
export const TASTE_FILL_MAX_QUERIES = 3;
export const TASTE_FILL_MIN_REMAINING_MS = 2_500;
export const TASTE_FILL_CURSOR_PREFIX = "tf1.";
export const TASTE_FILL_TREND_SOURCE = "취향 장르 인기작";

export function deriveTasteFillQueries(input: {
  profile: Pick<RecommendationPreferenceProfile, "content_type_scores" | "genre_scores">;
  discoveryFilters?: DiscoveryFilterInput;
  mediaType: RecommendationMediaType;
  userFilters: UserRecommendationFilters;
}): TasteFillQuery[] {
  const discovery = normalizeDiscoveryFilters(input.discoveryFilters);
  let groups: TasteFillGroup[] = [];
  if (discovery.mediaTypes.length) {
    if (discovery.mediaTypes.includes("drama")) groups.push(...(discovery.countries.length ? ["drama" as const] : ["drama-KR" as const, "drama-JP" as const]));
    if (discovery.mediaTypes.includes("anime") && (!discovery.countries.length || discovery.countries.includes("JP"))) groups.push("anime");
    if (discovery.mediaTypes.includes("movie")) groups.push("movie");
  } else {
    const order = ["kdrama", "jdrama", "anime", "movie"];
    const mapping: Record<string, TasteFillGroup> = { kdrama: "drama-KR", jdrama: "drama-JP", anime: "anime", movie: "movie" };
    groups = order.filter(type => (input.profile.content_type_scores.get(type) ?? 0) > 0)
      .sort((a, b) => (input.profile.content_type_scores.get(b) ?? 0) - (input.profile.content_type_scores.get(a) ?? 0))
      .slice(0, 2).map(type => mapping[type]);
    if (!groups.length) groups = ["drama-KR", "anime"];
  }
  groups = groups.filter(group => input.mediaType === "all" || (input.mediaType === "drama" ? group.startsWith("drama") : group === input.mediaType));
  const excluded = new Set(["drama", "animation", "all", ...input.userFilters.excludedGenres.map(normalizeDiscoveryGenre)]);
  const genres = discovery.genres.length ? discovery.genres : [...new Set([...input.profile.genre_scores]
    .filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1])
    .map(([genre]) => normalizeDiscoveryGenre(genre)).filter(genre => !excluded.has(genre)))].slice(0, 2);
  return groups.slice(0, TASTE_FILL_MAX_QUERIES).map(group => {
    const countries = group === "drama-KR" ? ["KR"] : group === "drama-JP" || group === "anime" ? ["JP"] : [...discovery.countries];
    return { key: `${group}:${countries.join(",")}:${genres.join("|")}`, group, kind: group === "movie" ? "movie" : "tv", countries, genres: [...genres] };
  });
}

export interface TasteFillCursorState { catalog: string | null; catalogDone: boolean; taste: Record<string, { page: number; done: boolean }> }

export function initializeTasteFillProgress(
  queries: readonly Pick<TasteFillQuery, "key">[],
  previous: TasteFillCursorState["taste"]
): TasteFillCursorState["taste"] {
  // A skipped or failed first fetch is still pending. Track every active query
  // before fetching so catalog exhaustion cannot discard its continuation.
  return Object.fromEntries(queries.map(({ key }) => [key, {
    ...(previous[key] ?? { page: 1, done: false })
  }]));
}

const initialState = (): TasteFillCursorState => ({ catalog: null, catalogDone: false, taste: {} });
export function decodeTasteFillCursor(raw: string | null | undefined): TasteFillCursorState {
  if (!raw) return initialState();
  if (!raw.startsWith(TASTE_FILL_CURSOR_PREFIX)) return { catalog: raw, catalogDone: false, taste: {} };
  try {
    const encoded = raw.slice(TASTE_FILL_CURSOR_PREFIX.length);
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return initialState();
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
    const state = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!state || typeof state !== "object" || Array.isArray(state) ||
      !(state.catalog === null || typeof state.catalog === "string") || typeof state.catalogDone !== "boolean" ||
      !state.taste || typeof state.taste !== "object" || Array.isArray(state.taste)) return initialState();
    const entries = Object.entries(state.taste);
    if (!entries.every(([, value]) => {
      const v = value as { page?: unknown; done?: unknown } | null;
      return v && typeof v === "object" && !Array.isArray(v) && typeof v.page === "number" && Number.isInteger(v.page) && v.page >= 1 && v.page <= 500 && typeof v.done === "boolean";
    })) return initialState();
    return { catalog: state.catalog, catalogDone: state.catalogDone, taste: Object.fromEntries(entries.map(([key, value]) => {
      const v = value as { page: number; done: boolean };
      return [key, { page: v.page, done: v.done }];
    })) };
  } catch { return initialState(); }
}
export function encodeTasteFillCursor(state: TasteFillCursorState): string | null {
  if (state.catalogDone && Object.values(state.taste).every(value => value.done)) return null;
  const taste = Object.fromEntries(Object.keys(state.taste).sort().map(key => [key, state.taste[key]]));
  const bytes = new TextEncoder().encode(JSON.stringify({ catalog: state.catalog, catalogDone: state.catalogDone, taste }));
  return TASTE_FILL_CURSOR_PREFIX + btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function shouldRunTasteFill(input: { itemCount: number; limit: number; remainingMs: number }): boolean {
  return input.itemCount < input.limit && input.remainingMs >= TASTE_FILL_MIN_REMAINING_MS;
}
export function selectTasteFillItems<T>(input: { ranked: readonly T[]; existing: readonly T[]; blockedIdentities: ReadonlySet<string>; need: number; identities: (item: T) => readonly string[] }): T[] {
  const blocked = new Set([...input.blockedIdentities, ...input.existing.flatMap(item => [...input.identities(item)])]);
  const selected: T[] = [];
  for (const item of input.ranked) {
    if (selected.length >= input.need) break;
    const identities = input.identities(item);
    if (identities.some(identity => blocked.has(identity))) continue;
    selected.push(item);
    identities.forEach(identity => blocked.add(identity));
  }
  return selected;
}

export function shouldPrefetchTasteFill(input: { remainingMs: number; pendingQueryCount: number }): boolean {
  return input.pendingQueryCount > 0 && input.remainingMs >= TASTE_FILL_MIN_REMAINING_MS;
}

export type TasteFillAction = "skip" | "use_prefetch" | "fetch_now";
export type TasteFillReason = "full" | "no_queries" | "prefetched" | "fetched" | "time";
export function planTasteFill(input: {
  itemCount: number; limit: number; remainingMs: number; pendingQueryCount: number; prefetched: boolean;
}): { action: TasteFillAction; reason: TasteFillReason } {
  if (input.itemCount >= input.limit) return { action: "skip", reason: "full" };
  if (input.pendingQueryCount === 0) return { action: "skip", reason: "no_queries" };
  if (input.prefetched) return { action: "use_prefetch", reason: "prefetched" };
  if (input.remainingMs >= TASTE_FILL_MIN_REMAINING_MS) return { action: "fetch_now", reason: "fetched" };
  return { action: "skip", reason: "time" };
}

export interface RecommendationScanBudget {
  scanMs: number;
  keywordLookups: number;
  maxMonths: number;
  maxRounds: number;
  label: "first" | "continuation";
}

export function recommendationScanBudget(input: { hasCursor: boolean }): RecommendationScanBudget {
  return input.hasCursor
    ? { scanMs: 4_000, keywordLookups: 32, maxMonths: 6, maxRounds: 6, label: "continuation" }
    : { scanMs: 1_000, keywordLookups: 16, maxMonths: 3, maxRounds: 3, label: "first" };
}
