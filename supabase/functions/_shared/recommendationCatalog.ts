import {
  buildPreferenceProfile,
  createRecommendationIdentityAliases,
  rankCandidates,
  type RankedRecommendation,
  type RecommendationCandidate,
  type RecommendationLibraryItem,
  type RecommendationMediaType,
  type RecommendationProfileMode
} from "./recommendationEngine.ts";

export type RecommendationProvider = "tmdb_kr" | "tmdb_jp" | "anilist" | "tmdb_movie";

export interface RecommendationProviderPage<T extends RecommendationCandidate = RecommendationCandidate> {
  items: T[];
  hasMore: boolean;
}

export interface RecommendationProviderRequest {
  provider: RecommendationProvider;
  month: string;
  page: number;
  asOfDate: string;
}

export type RecommendationProviderFetcher<T extends RecommendationCandidate = RecommendationCandidate> = (
  request: RecommendationProviderRequest
) => Promise<RecommendationProviderPage<T>>;

export interface RecommendationCatalogScanOptions<T extends RecommendationCandidate = RecommendationCandidate> {
  mediaType: RecommendationMediaType;
  limit?: number;
  cursor?: string | null;
  now?: Date | string | number;
  minimumMonth?: string;
  maxMonthsPerRequest?: number;
  maxProviderRoundsPerRequest?: number;
  libraryItems?: readonly RecommendationLibraryItem[];
  excludeIds?: readonly string[];
  resolveSeenIds?: (candidates: readonly RankedRecommendation<T>[]) => Promise<readonly string[]>;
}

export interface RecommendationCatalogScanResult<T extends RecommendationCandidate = RecommendationCandidate> {
  items: RankedRecommendation<T>[];
  nextCursor: string | null;
  hasMore: boolean;
  exhausted: boolean;
  scanBudgetReached: boolean;
  broadened: boolean;
  warnings: string[];
  failedProviders: RecommendationProvider[];
  allProvidersFailed: boolean;
  providersBlocked: boolean;
  profileMode: RecommendationProfileMode;
}

interface ProviderCursorState {
  page: number;
  done: boolean;
  failures: number;
}

interface RecommendationCursorState {
  version: 2;
  sortVersion: typeof RECOMMENDATION_SORT_VERSION;
  mediaType: RecommendationMediaType;
  month: string;
  asOfDate: string;
  offset: number;
  providers: Record<RecommendationProvider, ProviderCursorState>;
}

export const RECOMMENDATION_SORT_VERSION = "latest-popular-v2" as const;
export const RECOMMENDATION_CATALOG_MINIMUM_MONTH = "1870-01";

const DEFAULT_MAX_MONTHS_PER_REQUEST = 4;
const DEFAULT_MAX_PROVIDER_ROUNDS_PER_REQUEST = 8;
const MAX_CURSOR_PAGE = 500;
const MAX_CURSOR_OFFSET = 500;
const KST_OFFSET_MINUTES = 9 * 60;
const ALL_PROVIDERS: RecommendationProvider[] = ["tmdb_kr", "tmdb_jp", "anilist", "tmdb_movie"];

export async function scanRecommendationCatalog<T extends RecommendationCandidate>(
  fetchProviderPage: RecommendationProviderFetcher<T>,
  options: RecommendationCatalogScanOptions<T>
): Promise<RecommendationCatalogScanResult<T>> {
  const limit = clampInteger(options.limit ?? 12, 1, 12);
  const now = toDate(options.now) ?? new Date();
  const currentMonth = getKstMonthKey(now);
  const minimumMonth = isMonthKey(options.minimumMonth) ? options.minimumMonth : RECOMMENDATION_CATALOG_MINIMUM_MONTH;
  let state = decodeRecommendationCursor(options.cursor, options.mediaType, now);
  if (compareMonths(state.month, currentMonth) > 0) {
    state = createInitialCursorState(options.mediaType, now);
  }

  const activeProviders = getProvidersForMediaType(options.mediaType);
  const maxMonths = clampInteger(options.maxMonthsPerRequest ?? DEFAULT_MAX_MONTHS_PER_REQUEST, 1, 24);
  const maxRounds = clampInteger(
    options.maxProviderRoundsPerRequest ?? DEFAULT_MAX_PROVIDER_ROUNDS_PER_REQUEST,
    1,
    40
  );
  const profile = buildPreferenceProfile(options.libraryItems ?? []);
  const excluded = createNormalizedSet(options.excludeIds ?? []);
  for (const item of options.libraryItems ?? []) {
    addAll(excluded, createRecommendationIdentityAliases(item));
  }

  const selected: RankedRecommendation<T>[] = [];
  const selectedIdentitySets: Set<string>[] = [];
  const warnings = new Set<string>();
  const failedProviders = new Set<RecommendationProvider>();
  const visitedMonths = new Set<string>();
  let providerRounds = 0;
  let broadened = state.month !== currentMonth;
  let scanBudgetReached = false;

  while (selected.length < limit) {
    if (compareMonths(state.month, minimumMonth) < 0) {
      return completedResult(selected, profile.mode, broadened, warnings, failedProviders);
    }

    if (!visitedMonths.has(state.month)) {
      if (visitedMonths.size >= maxMonths) {
        scanBudgetReached = true;
        break;
      }
      visitedMonths.add(state.month);
    }

    if (activeProviders.every((provider) => state.providers[provider].done)) {
      const previous = previousMonth(state.month);
      if (compareMonths(previous, minimumMonth) < 0) {
        return completedResult(selected, profile.mode, broadened, warnings, failedProviders);
      }
      state = moveCursorToMonth(state, previous, activeProviders);
      broadened = true;
      continue;
    }

    if (providerRounds >= maxRounds) {
      scanBudgetReached = true;
      break;
    }

    const attemptedProviders = activeProviders.filter((provider) => !state.providers[provider].done);
    const settledPages = await Promise.allSettled(
      attemptedProviders.map((provider) =>
        fetchProviderPage({
          provider,
          month: state.month,
          page: state.providers[provider].page,
          asOfDate: state.asOfDate
        })
      )
    );
    providerRounds += 1;

    const successfulPages = new Map<RecommendationProvider, RecommendationProviderPage<T>>();
    settledPages.forEach((result, index) => {
      const provider = attemptedProviders[index];
      if (!provider) return;
      if (result.status === "fulfilled") {
        successfulPages.set(provider, result.value);
        state.providers[provider].failures = 0;
        return;
      }
      state.providers[provider].failures += 1;
      failedProviders.add(provider);
      warnings.add(`${provider}:unavailable`);
    });

    if (successfulPages.size === 0) {
      return pendingResult({
        selected,
        state,
        profileMode: profile.mode,
        broadened,
        warnings,
        failedProviders,
        scanBudgetReached: false,
        allProvidersFailed: selected.length === 0,
        providersBlocked: true
      });
    }

    const rankedPage = dedupeRanked(
      rankCandidates(
        profile,
        [...successfulPages.values()].flatMap((page) => page.items),
        { mediaType: options.mediaType, libraryItems: options.libraryItems }
      )
    );

    if (rankedPage.length > 0 && options.resolveSeenIds) {
      addAll(excluded, await options.resolveSeenIds(rankedPage));
    }

    let consumedOffset = Math.min(state.offset, rankedPage.length);
    for (let index = consumedOffset; index < rankedPage.length; index += 1) {
      const candidate = rankedPage[index];
      if (!candidate) continue;
      consumedOffset = index + 1;
      const identities = createNormalizedSet(createRecommendationIdentityAliases(candidate));
      if (intersects(identities, excluded) || selectedIdentitySets.some((set) => intersects(identities, set))) {
        continue;
      }

      selected.push(candidate);
      selectedIdentitySets.push(identities);
      addAll(excluded, identities);
      if (selected.length >= limit) break;
    }

    if (consumedOffset < rankedPage.length) {
      state.offset = consumedOffset;
      return pendingResult({
        selected,
        state,
        profileMode: profile.mode,
        broadened,
        warnings,
        failedProviders,
        scanBudgetReached: false,
        allProvidersFailed: false,
        providersBlocked: false
      });
    }

    state.offset = 0;
    for (const [provider, page] of successfulPages) {
      const providerState = state.providers[provider];
      providerState.done = !page.hasMore;
      if (page.hasMore) providerState.page = clampInteger(providerState.page + 1, 1, MAX_CURSOR_PAGE);
    }

    if (selected.length >= limit) {
      if (
        activeProviders.every((provider) => state.providers[provider].done) &&
        compareMonths(previousMonth(state.month), minimumMonth) < 0
      ) {
        return completedResult(selected, profile.mode, broadened, warnings, failedProviders);
      }
      return pendingResult({
        selected,
        state,
        profileMode: profile.mode,
        broadened,
        warnings,
        failedProviders,
        scanBudgetReached: false,
        allProvidersFailed: false,
        providersBlocked: false
      });
    }
  }

  return pendingResult({
    selected,
    state,
    profileMode: profile.mode,
    broadened,
    warnings,
    failedProviders,
    scanBudgetReached,
    allProvidersFailed: false,
    providersBlocked: false
  });
}

export function encodeRecommendationCursor(state: RecommendationCursorState): string {
  const encoded = btoa(JSON.stringify(state));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeRecommendationCursor(
  cursor: string | null | undefined,
  mediaType: RecommendationMediaType,
  now: Date | string | number = new Date()
): RecommendationCursorState {
  const parsedNow = toDate(now) ?? new Date();
  if (!cursor) return createInitialCursorState(mediaType, parsedNow);

  try {
    const base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const value = JSON.parse(atob(padded)) as unknown;
    if (!isCursorState(value) || value.mediaType !== mediaType) throw new Error("cursor mismatch");
    return cloneCursorState(value);
  } catch {
    throw new Error("INVALID_RECOMMENDATION_CURSOR");
  }
}

export function getKstMonthKey(now: Date | string | number = new Date()): string {
  const date = toDate(now) ?? new Date();
  const shifted = new Date(date.getTime() + KST_OFFSET_MINUTES * 60_000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getKstDateKey(now: Date | string | number = new Date()): string {
  const date = toDate(now) ?? new Date();
  const shifted = new Date(date.getTime() + KST_OFFSET_MINUTES * 60_000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(
    shifted.getUTCDate()
  ).padStart(2, "0")}`;
}

export function previousMonth(month: string): string {
  if (!isMonthKey(month)) throw new Error("INVALID_RECOMMENDATION_MONTH");
  const [yearValue, monthValue] = month.split("-");
  const year = Number.parseInt(yearValue ?? "", 10);
  const numericMonth = Number.parseInt(monthValue ?? "", 10);
  const date = new Date(Date.UTC(year, numericMonth - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function createInitialCursorState(mediaType: RecommendationMediaType, now: Date): RecommendationCursorState {
  return {
    version: 2,
    sortVersion: RECOMMENDATION_SORT_VERSION,
    mediaType,
    month: getKstMonthKey(now),
    asOfDate: getKstDateKey(now),
    offset: 0,
    providers: createProviderStates(getProvidersForMediaType(mediaType))
  };
}

function createProviderStates(activeProviders: readonly RecommendationProvider[]): Record<RecommendationProvider, ProviderCursorState> {
  const active = new Set(activeProviders);
  return {
    tmdb_kr: { page: 1, done: !active.has("tmdb_kr"), failures: 0 },
    tmdb_jp: { page: 1, done: !active.has("tmdb_jp"), failures: 0 },
    anilist: { page: 1, done: !active.has("anilist"), failures: 0 },
    tmdb_movie: { page: 1, done: !active.has("tmdb_movie"), failures: 0 }
  };
}

function moveCursorToMonth(
  state: RecommendationCursorState,
  month: string,
  activeProviders: readonly RecommendationProvider[]
): RecommendationCursorState {
  return {
    ...state,
    month,
    offset: 0,
    providers: createProviderStates(activeProviders)
  };
}

function getProvidersForMediaType(mediaType: RecommendationMediaType): RecommendationProvider[] {
  if (mediaType === "anime") return ["anilist"];
  if (mediaType === "drama") return ["tmdb_kr", "tmdb_jp"];
  if (mediaType === "movie") return ["tmdb_movie"];
  return ["tmdb_kr", "tmdb_jp", "anilist"];
}

function dedupeRanked<T extends RecommendationCandidate>(
  candidates: readonly RankedRecommendation<T>[]
): RankedRecommendation<T>[] {
  const accepted: RankedRecommendation<T>[] = [];
  const acceptedIdentities: Set<string>[] = [];
  for (const candidate of candidates) {
    const identities = createNormalizedSet(createRecommendationIdentityAliases(candidate));
    if (acceptedIdentities.some((set) => intersects(identities, set))) continue;
    accepted.push(candidate);
    acceptedIdentities.push(identities);
  }
  return accepted;
}

function pendingResult<T extends RecommendationCandidate>(input: {
  selected: RankedRecommendation<T>[];
  state: RecommendationCursorState;
  profileMode: RecommendationProfileMode;
  broadened: boolean;
  warnings: Set<string>;
  failedProviders: Set<RecommendationProvider>;
  scanBudgetReached: boolean;
  allProvidersFailed: boolean;
  providersBlocked: boolean;
}): RecommendationCatalogScanResult<T> {
  return {
    items: input.selected,
    nextCursor: encodeRecommendationCursor(input.state),
    hasMore: true,
    exhausted: false,
    scanBudgetReached: input.scanBudgetReached,
    broadened: input.broadened,
    warnings: [...input.warnings],
    failedProviders: [...input.failedProviders],
    allProvidersFailed: input.allProvidersFailed,
    providersBlocked: input.providersBlocked,
    profileMode: input.profileMode
  };
}

function completedResult<T extends RecommendationCandidate>(
  items: RankedRecommendation<T>[],
  profileMode: RecommendationProfileMode,
  broadened: boolean,
  warnings: Set<string>,
  failedProviders: Set<RecommendationProvider>
): RecommendationCatalogScanResult<T> {
  return {
    items,
    nextCursor: null,
    hasMore: false,
    exhausted: true,
    scanBudgetReached: false,
    broadened,
    warnings: [...warnings],
    failedProviders: [...failedProviders],
    allProvidersFailed: false,
    providersBlocked: false,
    profileMode
  };
}

function isCursorState(value: unknown): value is RecommendationCursorState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const cursor = value as Partial<RecommendationCursorState>;
  if (
    cursor.version !== 2 ||
    cursor.sortVersion !== RECOMMENDATION_SORT_VERSION ||
    !["all", "drama", "anime", "movie"].includes(cursor.mediaType ?? "") ||
    !isMonthKey(cursor.month) ||
    !isDateKey(cursor.asOfDate) ||
    !Number.isInteger(cursor.offset) ||
    (cursor.offset ?? -1) < 0 ||
    (cursor.offset ?? 0) > MAX_CURSOR_OFFSET ||
    !cursor.providers ||
    typeof cursor.providers !== "object"
  ) {
    return false;
  }
  return ALL_PROVIDERS.every((provider) => isProviderCursorState(cursor.providers?.[provider]));
}

function isProviderCursorState(value: unknown): value is ProviderCursorState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<ProviderCursorState>;
  return (
    Number.isInteger(state.page) &&
    (state.page ?? 0) >= 1 &&
    (state.page ?? 0) <= MAX_CURSOR_PAGE &&
    typeof state.done === "boolean" &&
    Number.isInteger(state.failures) &&
    (state.failures ?? -1) >= 0 &&
    (state.failures ?? 0) <= 100
  );
}

function cloneCursorState(state: RecommendationCursorState): RecommendationCursorState {
  return {
    ...state,
    providers: {
      tmdb_kr: { ...state.providers.tmdb_kr },
      tmdb_jp: { ...state.providers.tmdb_jp },
      anilist: { ...state.providers.anilist },
      tmdb_movie: { ...state.providers.tmdb_movie }
    }
  };
}

function compareMonths(left: string, right: string): number {
  return left.localeCompare(right);
}

function isMonthKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  return true;
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value);
}

function createNormalizedSet(values: Iterable<string>): Set<string> {
  const result = new Set<string>();
  addAll(result, values);
  return result;
}

function addAll(target: Set<string>, values: Iterable<string>): void {
  for (const value of values) {
    const normalized = value.normalize("NFKC").trim().toLocaleLowerCase();
    if (normalized) target.add(normalized);
  }
}

function intersects(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function toDate(value: Date | string | number | undefined): Date | null {
  if (value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}
