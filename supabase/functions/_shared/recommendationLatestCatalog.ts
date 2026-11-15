import {
  getKstDateKey,
  getKstMonthKey,
  previousMonth,
  RECOMMENDATION_CATALOG_MINIMUM_MONTH,
  hasKoreanDisplayTitle,
  type RecommendationCatalogScanResult,
  type RecommendationProvider,
  type RecommendationProviderPage,
  type RecommendationProviderRequest
} from "./recommendationCatalog.ts";
import {
  buildPreferenceProfile,
  createRecommendationIdentityAliases,
  createRecommendationLibraryContext,
  rankCandidates,
  type RecommendationCandidate,
  type RecommendationFeedback,
  type RecommendationLibraryContext,
  type RecommendationLibraryItem,
  type RecommendationMediaType,
  type RecommendationPreferenceProfile
} from "./recommendationEngine.ts";
import {
  discoveryFilterKey,
  matchesDiscoveryFilters,
  normalizeDiscoveryFilters,
  type DiscoveryFilterInput
} from "./discoveryFilters.ts";
import {
  canFetchRecommendationProvider,
  recommendationProviderFilterKey
} from "./recommendationProviderFilters.ts";
import { getLatestRecommendationProviderLanes } from "./recommendationProviders.ts";
import {
  userRecommendationFiltersFromFeedback,
  type UserRecommendationFilters
} from "./recommendationUserFilters.ts";

export interface LatestRecommendationStream {
  key: string;
  provider: RecommendationProvider;
  lane: string;
}
export interface LatestRecommendationRequest extends RecommendationProviderRequest {
  lane: string;
}
export type LatestRecommendationFetcher<
  T extends RecommendationCandidate = RecommendationCandidate
> = (request: LatestRecommendationRequest) => Promise<RecommendationProviderPage<T>>;
interface StreamPosition {
  page: number;
  offset: number;
  done: boolean;
  frontier: string | null;
  fingerprint: string | null;
}
interface LatestCursor {
  version: 1;
  mode: "latest";
  policy: "kst-released-v1";
  fingerprintPolicy: "jsonb-canonical-v1";
  mediaType: RecommendationMediaType;
  scope: string;
  asOfDate: string;
  month: string;
  lastReturned: string | null;
  streams: Record<string, StreamPosition>;
}
export interface LatestRecommendationOptions<T extends RecommendationCandidate> {
  mediaType: RecommendationMediaType;
  discoveryFilters?: DiscoveryFilterInput;
  limit?: number;
  cursor?: string | null;
  now?: Date | string | number;
  minimumMonth?: string;
  maxMonthsPerRequest?: number;
  maxProviderRoundsPerRequest?: number;
  canContinue?: () => boolean;
  libraryItems?: readonly RecommendationLibraryItem[];
  feedback?: readonly RecommendationFeedback[];
  excludeIds?: readonly string[];
  candidateFilter?: (candidate: T) => boolean;
  knownCandidateFilter?: (candidate: T) => boolean;
  verifyCandidate?: (candidate: T) => Promise<{ candidate: T; pending: boolean }>;
  libraryContext?: RecommendationLibraryContext;
  profile?: RecommendationPreferenceProfile;
  scopeKey?: string;
}

export function createLatestRecommendationStreams(
  mediaType: RecommendationMediaType,
  filters: DiscoveryFilterInput = {},
  exclusions?: UserRecommendationFilters
): LatestRecommendationStream[] {
  const types = normalizeDiscoveryFilters(filters).mediaTypes;
  return (["tmdb_kr", "tmdb_jp", "anilist", "tmdb_movie"] as const)
    .filter((provider) => {
      const type = provider === "anilist" ? "anime" : provider === "tmdb_movie" ? "movie" : "drama";
      return (
        (filters.mediaTypes !== undefined
          ? !types.length || types.includes(type)
          : mediaType === "all" || mediaType === type) &&
        canFetchRecommendationProvider(provider, filters, exclusions)
      );
    })
    .flatMap((provider) =>
      getLatestRecommendationProviderLanes(provider, {
        discoveryFilters: filters,
        ...(exclusions ? { filters: exclusions } : {})
      }).map((lane) => ({ key: `${provider}:${lane}`, provider, lane }))
    );
}

/** Date-ordered upstream streams are merged at their heads, including the OR lanes inside a provider. */
export async function scanLatestRecommendationCatalog<T extends RecommendationCandidate>(
  fetcher: LatestRecommendationFetcher<T>,
  options: LatestRecommendationOptions<T>
): Promise<RecommendationCatalogScanResult<T>> {
  const now = new Date(options.now ?? Date.now());
  const filters = normalizeDiscoveryFilters(options.discoveryFilters);
  const exclusions = userRecommendationFiltersFromFeedback(options.feedback ?? []);
  const streams = createLatestRecommendationStreams(
    options.mediaType,
    options.discoveryFilters,
    exclusions
  );
  const scope = await digest(
    JSON.stringify([
      "latest-public-v1",
      options.scopeKey ?? "",
      discoveryFilterKey(options.discoveryFilters),
      recommendationProviderFilterKey(exclusions)
    ])
  );
  const state = decodeCursor(options.cursor, options.mediaType, scope, streams, now, filters.year);
  const minimumMonth =
    filters.year !== undefined
      ? `${filters.year}-01`
      : validMonth(options.minimumMonth)
        ? options.minimumMonth
        : RECOMMENDATION_CATALOG_MINIMUM_MONTH;
  const limit = clamp(options.limit ?? 12, 1, 12);
  const maxRounds = clamp(options.maxProviderRoundsPerRequest ?? 6, 1, 40);
  const maxMonths = clamp(options.maxMonthsPerRequest ?? 6, 1, 24);
  const context =
    options.libraryContext ?? createRecommendationLibraryContext(options.libraryItems ?? []);
  const profile =
    options.profile ??
    buildPreferenceProfile(options.libraryItems ?? [], options.feedback ?? [], context);
  const excluded = new Set((options.excludeIds ?? []).map(identity));
  for (const item of options.libraryItems ?? [])
    for (const alias of createRecommendationIdentityAliases(item)) excluded.add(identity(alias));
  for (const item of options.feedback ?? [])
    if (
      item.target_type === "content" &&
      (item.action === "not_interested" || item.action === "exclude")
    ) {
      excluded.add(identity(item.target_key));
      if (item.source_content_id) excluded.add(identity(item.source_content_id));
    }
  const selected: T[] = [];
  const pages = new Map<string, RecommendationProviderPage<T>>();
  const visitedMonths = new Set<string>();
  const checkedClosedStreams = new Set<string>();
  const failed = new Set<RecommendationProvider>();
  const warnings = new Set<string>();
  let rounds = 0;
  let blocked = false;
  let budgetReached = false;
  let exhausted = streams.length === 0 || minimumMonth > state.asOfDate.slice(0, 7);
  let considered = 0;

  const result = (): RecommendationCatalogScanResult<T> => ({
    items: rankCandidates(profile, selected, {
      mediaType: options.discoveryFilters?.mediaTypes !== undefined ? "all" : options.mediaType,
      ordering: "latest",
      libraryItems: options.libraryItems ?? [],
      libraryContext: context
    }),
    nextCursor: exhausted ? null : encodeCursor(state),
    hasMore: !exhausted,
    exhausted,
    scanBudgetReached: budgetReached,
    broadened: state.month !== state.asOfDate.slice(0, 7),
    warnings: [...warnings],
    failedProviders: [...failed],
    allProvidersFailed: blocked && selected.length === 0 && failed.size > 0,
    providersBlocked: blocked,
    profileMode: profile.mode
  });

  while (!exhausted && selected.length < limit) {
    if (state.month < minimumMonth) {
      exhausted = true;
      break;
    }
    if (!visitedMonths.has(state.month)) {
      if (visitedMonths.size >= maxMonths) {
        budgetReached = true;
        break;
      }
      visitedMonths.add(state.month);
    }
    const missing: LatestRecommendationStream[] = [];
    const heads: { stream: LatestRecommendationStream; candidate: T; date: string }[] = [];
    for (const stream of streams) {
      const position = state.streams[stream.key]!;
      if (position.done) {
        // Recheck only the final page retained for this still-open month, using the shared
        // provider cache. Never replay the full history of already consumed pages/months.
        if (position.fingerprint !== null && !checkedClosedStreams.has(stream.key))
          missing.push(stream);
        continue;
      }
      const page = pages.get(stream.key);
      if (!page) {
        missing.push(stream);
        continue;
      }
      if (page.pendingVerification) {
        budgetReached = true;
        blocked = true;
        break;
      }
      while (position.offset < page.items.length) {
        const candidate = page.items[position.offset]!;
        const date = candidateDate(candidate, state.month, state.asOfDate);
        const aliases = createRecommendationIdentityAliases(candidate).map(identity);
        if (
          !date ||
          !hasKoreanDisplayTitle(candidate) ||
          !matchesDiscoveryFilters(candidate, options.discoveryFilters) ||
          aliases.some((alias) => excluded.has(alias)) ||
          options.knownCandidateFilter?.(candidate) === false
        ) {
          position.offset++;
          considered++;
          continue;
        }
        if (position.frontier !== null && date > position.frontier) throw invalidCursor();
        heads.push({ stream, candidate, date });
        break;
      }
      if (position.offset >= page.items.length) {
        pages.delete(stream.key);
        if (page.hasMore) {
          if (position.page >= 500) throw invalidCursor();
          position.page++;
          position.offset = 0;
          position.fingerprint = null;
          missing.push(stream);
        } else {
          position.done = true;
          checkedClosedStreams.add(stream.key);
        }
      }
    }
    if (blocked) break;
    if (considered >= 1_000) {
      budgetReached = true;
      break;
    }
    if (missing.length) {
      if (rounds >= maxRounds || (rounds > 0 && options.canContinue?.() === false)) {
        budgetReached = true;
        break;
      }
      const month = state.month;
      const settled = await Promise.allSettled(
        missing.map((stream) =>
          fetcher({
            provider: stream.provider,
            lane: stream.lane,
            month,
            page: state.streams[stream.key]!.page,
            asOfDate: state.asOfDate
          })
        )
      );
      rounds++;
      for (const [index, entry] of settled.entries()) {
        const stream = missing[index]!;
        if (
          entry.status === "rejected" ||
          !Array.isArray(entry.value.items) ||
          typeof entry.value.hasMore !== "boolean"
        ) {
          failed.add(stream.provider);
          warnings.add(`${stream.provider}:unavailable`);
          blocked = true;
          continue;
        }
        // Upstream ordering is date-based. Local stable sorting handles optional dates within a page;
        // persisted raw offsets never depend on mutable eligibility or keyword enrichment.
        const items = [...entry.value.items].sort((left, right) =>
          (candidateDate(right, month, state.asOfDate) ?? "").localeCompare(
            candidateDate(left, month, state.asOfDate) ?? ""
          )
        );
        const position = state.streams[stream.key]!;
        const fingerprint = await pageFingerprint(items, entry.value.hasMore);
        if (position.fingerprint !== null && position.fingerprint !== fingerprint)
          throw invalidCursor();
        position.fingerprint = fingerprint;
        if (position.done) checkedClosedStreams.add(stream.key);
        pages.set(stream.key, { ...entry.value, items });
      }
      if (blocked) break;
      continue;
    }
    if (heads.length === 0) {
      const previous = previousMonth(state.month);
      if (previous < minimumMonth) {
        exhausted = true;
        break;
      }
      state.month = previous;
      state.streams = positions(streams);
      pages.clear();
      checkedClosedStreams.clear();
      continue;
    }
    heads.sort(
      (left, right) =>
        right.date.localeCompare(left.date) || left.stream.key.localeCompare(right.stream.key)
    );
    const head = heads[0]!;
    if (state.lastReturned !== null && head.date > state.lastReturned) throw invalidCursor();
    let verified = head.candidate;
    if (options.verifyCandidate) {
      try {
        const verification = await options.verifyCandidate(head.candidate);
        if (verification.pending) {
          budgetReached = true;
          break;
        }
        verified = verification.candidate;
      } catch {
        failed.add(head.stream.provider);
        warnings.add(`${head.stream.provider}:verification-unavailable`);
        blocked = true;
        break;
      }
    }
    const position = state.streams[head.stream.key]!;
    position.offset++;
    position.frontier = head.date;
    considered++;
    if (options.candidateFilter?.(verified) === false) continue;
    selected.push(verified);
    state.lastReturned = head.date;
    for (const alias of createRecommendationIdentityAliases(verified))
      excluded.add(identity(alias));
  }
  // Completing an already-loaded final page does not require another provider call just to say done.
  if (
    !blocked &&
    !budgetReached &&
    state.month === minimumMonth &&
    streams.every((stream) => {
      const position = state.streams[stream.key]!;
      const page = pages.get(stream.key);
      return (
        position.done || Boolean(page && !page.hasMore && position.offset >= page.items.length)
      );
    })
  )
    exhausted = true;
  return result();
}

function decodeCursor(
  raw: string | null | undefined,
  mediaType: RecommendationMediaType,
  scope: string,
  streams: LatestRecommendationStream[],
  now: Date,
  year?: number
): LatestCursor {
  if (!raw) {
    const asOfDate = getKstDateKey(now);
    return {
      version: 1,
      mode: "latest",
      policy: "kst-released-v1",
      fingerprintPolicy: "jsonb-canonical-v1",
      mediaType,
      scope,
      asOfDate,
      month:
        year === undefined || year === Number(asOfDate.slice(0, 4))
          ? getKstMonthKey(now)
          : `${year}-12`,
      lastReturned: null,
      streams: positions(streams)
    };
  }
  try {
    if (!raw.startsWith("lc1.")) throw invalidCursor();
    const encoded = raw.slice(4);
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw invalidCursor();
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), (char) =>
          char.charCodeAt(0)
        )
      )
    );
    if (
      !record(value) ||
      value.version !== 1 ||
      value.mode !== "latest" ||
      value.policy !== "kst-released-v1" ||
      value.fingerprintPolicy !== "jsonb-canonical-v1" ||
      value.mediaType !== mediaType ||
      value.scope !== scope ||
      !validDate(value.asOfDate) ||
      value.asOfDate > getKstDateKey(now) ||
      !validMonth(value.month) ||
      value.month > value.asOfDate.slice(0, 7) ||
      !(value.lastReturned === null || validDate(value.lastReturned)) ||
      !record(value.streams) ||
      Object.keys(value.streams).sort().join(",") !==
        streams
          .map((stream) => stream.key)
          .sort()
          .join(",")
    )
      throw invalidCursor();
    for (const position of Object.values(value.streams))
      if (
        !record(position) ||
        !integer(position.page, 1, 500) ||
        !integer(position.offset, 0, 500) ||
        typeof position.done !== "boolean" ||
        !(position.frontier === null || validDate(position.frontier)) ||
        !(
          position.fingerprint === null ||
          (typeof position.fingerprint === "string" && /^[a-f0-9]{16}$/.test(position.fingerprint))
        ) ||
        (position.done && position.fingerprint === null)
      )
        throw invalidCursor();
    return value as unknown as LatestCursor;
  } catch {
    throw invalidCursor();
  }
}
function encodeCursor(value: LatestCursor): string {
  return (
    "lc1." +
    btoa(
      Array.from(new TextEncoder().encode(JSON.stringify(value)), (byte) =>
        String.fromCharCode(byte)
      ).join("")
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  );
}
function positions(streams: LatestRecommendationStream[]): Record<string, StreamPosition> {
  return Object.fromEntries(
    streams.map((stream) => [
      stream.key,
      { page: 1, offset: 0, done: false, frontier: null, fingerprint: null }
    ])
  );
}
function candidateDate(
  candidate: RecommendationCandidate,
  month: string,
  asOf: string
): string | null {
  const actual = candidate.release_date ?? candidate.air_date;
  if (validDate(actual)) return actual.slice(0, 7) === month && actual <= asOf ? actual : null;
  return null;
}
async function pageFingerprint(
  items: readonly RecommendationCandidate[],
  hasMore: boolean
): Promise<string> {
  const values = items.map((candidate) => {
    const row = candidate as RecommendationCandidate & Record<string, unknown>;
    return [
      "external_source",
      "external_id",
      "content_type",
      "title_primary",
      "title_original",
      "air_year",
      "air_date",
      "release_date",
      "genres",
      "countries",
      "origin_country",
      "matched_countries",
      "matched_genres",
      "keywords",
      "source_tags",
      "themes",
      "external_ids",
      "has_seasons"
    ].map((key) => row[key] ?? null);
  });
  return digest(canonicalJson([hasMore, values]), 8);
}
/** JSONB reorders object keys; only array order and actual values belong in a page fingerprint. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) =>
    !record(nested)
      ? nested
      : Object.fromEntries(
          Object.keys(nested)
            .sort()
            .map((key) => [key, nested[key]])
        )
  );
}
async function digest(value: string, bytes = 32): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash).slice(0, bytes), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
function clamp(value: number, min: number, max: number) {
  return integer(value, min, max) ? value : min;
}
function identity(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}
function invalidCursor(): Error {
  return new Error("INVALID_LATEST_RECOMMENDATION_CURSOR");
}
