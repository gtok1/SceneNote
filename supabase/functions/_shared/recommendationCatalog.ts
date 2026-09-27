import {
  buildPreferenceProfile,
  applyBatchDiversityConstraints,
  RECOMMENDATION_DIVERSITY_CONFIG,
  createRecommendationIdentityAliases,
  rankCandidates,
  type RankedRecommendation,
  type RecommendationCandidate,
  type RecommendationLibraryItem,
  type RecommendationFeedback,
  type RecommendationMediaType,
  type RecommendationProfileMode
} from "./recommendationEngine.ts";
import { discoveryFilterKey, matchesDiscoveryFilters, normalizeDiscoveryFilters, type DiscoveryFilterInput } from "./discoveryFilters.ts";
import { canFetchRecommendationProvider } from "./recommendationProviderFilters.ts";
import { userRecommendationFiltersFromFeedback } from "./recommendationUserFilters.ts";

export type RecommendationProvider = "tmdb_kr" | "tmdb_jp" | "anilist" | "tmdb_movie";

export interface RecommendationProviderPage<T extends RecommendationCandidate = RecommendationCandidate> {
  items: T[];
  hasMore: boolean;
  /** Cached page candidates still need a bounded metadata-verification pass. */
  pendingVerification?: boolean;
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
  discoveryFilters?: DiscoveryFilterInput;
  limit?: number;
  cursor?: string | null;
  now?: Date | string | number;
  minimumMonth?: string;
  maxMonthsPerRequest?: number;
  maxProviderRoundsPerRequest?: number;
  /** Checked after the first round so the caller can reserve response time. */
  canContinue?: () => boolean;
  libraryItems?: readonly RecommendationLibraryItem[];
  feedback?: readonly RecommendationFeedback[];
  excludeIds?: readonly string[];
  candidateFilter?: (candidate: T) => boolean;
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
  /** Optional so cursors issued before verification continuation remain valid. */
  verificationPass?: number;
}

interface RecommendationCursorState {
  version: 2;
  sortVersion: typeof RECOMMENDATION_SORT_VERSION;
  mediaType: RecommendationMediaType;
  discoveryFilterKey?: string;
  month: string;
  asOfDate: string;
  offset: number;
  providers: Record<RecommendationProvider, ProviderCursorState>;
}

export const RECOMMENDATION_SORT_VERSION = "latest-popular-v2" as const;
export const RECOMMENDATION_CATALOG_MINIMUM_MONTH = "1870-01";

export function hasKoreanDisplayTitle(candidate: RecommendationCandidate): boolean {
  return /[가-힣]/u.test(candidate.title_primary.normalize("NFKC"));
}

const DEFAULT_MAX_MONTHS_PER_REQUEST = 4;
const DEFAULT_MAX_PROVIDER_ROUNDS_PER_REQUEST = 8;
const MAX_CURSOR_PAGE = 500;
const MAX_CURSOR_OFFSET = 500;
const MAX_CURSOR_VERIFICATION_PASS = 100;
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
  let state = decodeRecommendationCursor(options.cursor, options.mediaType, now, options.discoveryFilters);
  if (compareMonths(state.month, currentMonth) > 0) {
    state = createInitialCursorState(options.mediaType, now, options.discoveryFilters);
  }

  const exclusions = userRecommendationFiltersFromFeedback(options.feedback ?? []);
  const activeProviders = getProvidersForMediaType(options.mediaType, options.discoveryFilters).filter((provider) =>
    canFetchRecommendationProvider(provider, options.discoveryFilters, exclusions)
  );
  const maxMonths = clampInteger(options.maxMonthsPerRequest ?? DEFAULT_MAX_MONTHS_PER_REQUEST, 1, 24);
  const maxRounds = clampInteger(
    options.maxProviderRoundsPerRequest ?? DEFAULT_MAX_PROVIDER_ROUNDS_PER_REQUEST,
    1,
    40
  );
  const profile = buildPreferenceProfile(options.libraryItems ?? [], options.feedback ?? []);
  if (activeProviders.length === 0) {
    return completedResult([], profile.mode, false, new Set(), new Set());
  }
  const excluded = createNormalizedSet(options.excludeIds ?? []);
  for (const feedback of options.feedback ?? []) {
    if (
      feedback.target_type === "content" &&
      (feedback.action === "not_interested" || feedback.action === "exclude")
    ) {
      addAll(excluded, [feedback.target_key, feedback.source_content_id ?? ""]);
    }
  }
  for (const item of options.libraryItems ?? []) {
    addAll(excluded, createRecommendationIdentityAliases(item));
  }

  const selected: RankedRecommendation<T>[] = [];
  const selectedIdentitySets: Set<string>[] = [];
  const warnings = new Set<string>();
  const failedProviders = new Set<RecommendationProvider>();
  for (const provider of activeProviders) {
    if (state.providers[provider].failures > 0) {
      failedProviders.add(provider);
      warnings.add(`${provider}:unavailable`);
    }
  }
  const visitedMonths = new Set<string>();
  let providerRounds = 0;
  let broadened = state.month !== currentMonth;
  let scanBudgetReached = false;

  while (selected.length < limit) {
    if (compareMonths(state.month, minimumMonth) < 0) {
      return completedResult(selected, profile.mode, broadened, warnings, failedProviders);
    }

    // A failed provider must not hold healthy providers at an exhausted month.
    // Keep failures distinct from done, so an entirely unavailable catalog still
    // returns a retryable error. A new month retries each provider once.
    const monthComplete = activeProviders.every((provider) => state.providers[provider].done);
    const healthyMonthComplete = activeProviders.every((provider) => {
      const providerState = state.providers[provider];
      return providerState.done || providerState.failures > 0;
    }) && activeProviders.some((provider) => state.providers[provider].done);
    if (monthComplete || healthyMonthComplete) {
      const previous = previousMonth(state.month);
      if (compareMonths(previous, minimumMonth) < 0 && monthComplete) {
        return completedResult(selected, profile.mode, broadened, warnings, failedProviders);
      }
      if (compareMonths(previous, minimumMonth) >= 0) {
        state = moveCursorToMonth(state, previous, activeProviders);
        broadened = true;
        continue;
      }
    }

    if (!visitedMonths.has(state.month)) {
      if (visitedMonths.size >= maxMonths) {
        scanBudgetReached = true;
        break;
      }
      visitedMonths.add(state.month);
    }

    if (providerRounds >= maxRounds || (providerRounds > 0 && options.canContinue?.() === false)) {
      scanBudgetReached = true;
      break;
    }

    const pendingProviders = activeProviders.filter((provider) => !state.providers[provider].done);
    const healthyPendingProviders = pendingProviders.filter((provider) => state.providers[provider].failures === 0);
    const attemptedProviders = healthyPendingProviders.length > 0 ? healthyPendingProviders : pendingProviders;
    const retryingFailedProvider = attemptedProviders.some((provider) => state.providers[provider].failures > 0);
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
        failedProviders.delete(provider);
        warnings.delete(`${provider}:unavailable`);
        return;
      }
      state.providers[provider].failures = Math.min(100, state.providers[provider].failures + 1);
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
        [...successfulPages.values()]
          .flatMap((page) => page.items)
          .filter((candidate) => matchesDiscoveryFilters(candidate, options.discoveryFilters))
          .filter((candidate) => options.candidateFilter?.(candidate) ?? true),
        {
          mediaType: options.discoveryFilters?.mediaTypes !== undefined ? "all" : options.mediaType,
          ...(options.libraryItems ? { libraryItems: options.libraryItems } : {})
        }
      )
    );

    if (rankedPage.length > 0 && options.resolveSeenIds) {
      addAll(excluded, await options.resolveSeenIds(rankedPage));
    }

    const pendingVerification = [...successfulPages.values()].some((page) => page.pendingVerification === true);
    const verificationPoolChanged = pendingVerification || activeProviders.some(
      (provider) => (state.providers[provider].verificationPass ?? 0) > 0
    );
    const providerPoolChanged = retryingFailedProvider || settledPages.some((page) => page.status === "rejected");
    // Verification may insert a newly eligible candidate before the previous
    // offset, while failed or recovered providers remove or insert entries. Revisit
    // the changed ranked pool and use identity exclusions instead.
    let consumedOffset = verificationPoolChanged || providerPoolChanged
      ? 0
      : Math.min(state.offset, rankedPage.length);
    for (let index = consumedOffset; index < rankedPage.length; index += 1) {
      const candidate = rankedPage[index];
      if (!candidate) continue;
      consumedOffset = index + 1;
      const identities = createNormalizedSet(createRecommendationIdentityAliases(candidate));
      if (intersects(identities, excluded) || selectedIdentitySets.some((set) => intersects(identities, set))) {
        continue;
      }

      const diversified = applyBatchDiversityConstraints(
        [...selected, candidate],
        limit,
        profile,
        RECOMMENDATION_DIVERSITY_CONFIG,
        false
      );
      if (!diversified.some((item) => item.canonical_id === candidate.canonical_id)) {
        continue;
      }

      selected.push(candidate);
      selectedIdentitySets.push(identities);
      addAll(excluded, identities);
      if (selected.length >= limit) break;
    }

    for (const [provider, page] of successfulPages) {
      const providerState = state.providers[provider];
      providerState.verificationPass = page.pendingVerification
        ? Math.min(MAX_CURSOR_VERIFICATION_PASS, (providerState.verificationPass ?? 0) + 1)
        : 0;
    }

    if (consumedOffset < rankedPage.length) {
      state.offset = pendingVerification ? 0 : consumedOffset;
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
      if (page.pendingVerification) continue;
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
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(state))));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeRecommendationCursor(
  cursor: string | null | undefined,
  mediaType: RecommendationMediaType,
  now: Date | string | number = new Date(),
  discoveryFilters?: DiscoveryFilterInput
): RecommendationCursorState {
  const parsedNow = toDate(now) ?? new Date();
  if (!cursor) return createInitialCursorState(mediaType, parsedNow, discoveryFilters);

  try {
    const base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const value = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)))) as unknown;
    if (!isCursorState(value) || value.mediaType !== mediaType) throw new Error("cursor mismatch");
    if (normalizeCatalogDiscoveryKey(value.discoveryFilterKey) !== catalogDiscoveryKey(discoveryFilters)) {
      throw new Error("cursor discovery filter mismatch");
    }
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

function createInitialCursorState(mediaType: RecommendationMediaType, now: Date, discoveryFilters?: DiscoveryFilterInput): RecommendationCursorState {
  return {
    version: 2,
    sortVersion: RECOMMENDATION_SORT_VERSION,
    mediaType,
    ...(catalogDiscoveryKey(discoveryFilters) !== discoveryFilterKey() ? { discoveryFilterKey: catalogDiscoveryKey(discoveryFilters) } : {}),
    month: getKstMonthKey(now),
    asOfDate: getKstDateKey(now),
    offset: 0,
    providers: createProviderStates(getProvidersForMediaType(mediaType, discoveryFilters))
  };
}

function createProviderStates(activeProviders: readonly RecommendationProvider[]): Record<RecommendationProvider, ProviderCursorState> {
  const active = new Set(activeProviders);
  return {
    tmdb_kr: { page: 1, done: !active.has("tmdb_kr"), failures: 0, verificationPass: 0 },
    tmdb_jp: { page: 1, done: !active.has("tmdb_jp"), failures: 0, verificationPass: 0 },
    anilist: { page: 1, done: !active.has("anilist"), failures: 0, verificationPass: 0 },
    tmdb_movie: { page: 1, done: !active.has("tmdb_movie"), failures: 0, verificationPass: 0 }
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

function normalizeCatalogDiscoveryKey(key?: string): string {
  if (key === undefined) return discoveryFilterKey();
  try {
    const legacy = JSON.parse(key) as unknown;
    if (Array.isArray(legacy) && legacy.length === 2 && legacy.every((value) => typeof value === "string")) {
      return discoveryFilterKey({ genre: legacy[0], country: legacy[1] });
    }
  } catch { /* New signatures may carry a media-selection suffix. */ }
  return key;
}

function catalogDiscoveryKey(input?: DiscoveryFilterInput): string {
  return discoveryFilterKey(input) + (input?.mediaTypes !== undefined ? ":media-selection" : "");
}

function getProvidersForMediaType(mediaType: RecommendationMediaType, input?: DiscoveryFilterInput): RecommendationProvider[] {
  if (input?.mediaTypes !== undefined) {
    const types = normalizeDiscoveryFilters(input).mediaTypes;
    return ALL_PROVIDERS.filter((provider) => !types.length || types.includes(provider === "anilist" ? "anime" : provider === "tmdb_movie" ? "movie" : "drama"));
  }
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
    (cursor.discoveryFilterKey !== undefined && (typeof cursor.discoveryFilterKey !== "string" || cursor.discoveryFilterKey.length > 1200)) ||
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
    (state.failures ?? 0) <= 100 &&
    (state.verificationPass === undefined || (
      Number.isInteger(state.verificationPass) &&
      state.verificationPass >= 0 &&
      state.verificationPass <= MAX_CURSOR_VERIFICATION_PASS
    ))
  );
}

function cloneCursorState(state: RecommendationCursorState): RecommendationCursorState {
  return {
    ...state,
    providers: {
      tmdb_kr: { verificationPass: 0, ...state.providers.tmdb_kr },
      tmdb_jp: { verificationPass: 0, ...state.providers.tmdb_jp },
      anilist: { verificationPass: 0, ...state.providers.anilist },
      tmdb_movie: { verificationPass: 0, ...state.providers.tmdb_movie }
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
