import { decodeTasteFillCursor, deriveTasteFillQueries, encodeTasteFillCursor, selectTasteFillItems, shouldRunTasteFill, type TasteFillQuery } from "../_shared/recommendationTasteFill.ts";
import {
  hasKoreanDisplayTitle,
  scanRecommendationCatalog,
  type RecommendationProvider,
  type RecommendationCatalogScanResult
} from "../_shared/recommendationCatalog.ts";
import {
  buildPreferenceProfile,
  rankCandidates,
  createRecommendationIdentityAliases,
  type RecommendationCandidate,
  type RecommendationLibraryItem,
  type RecommendationFeedback,
  type RecommendationFeedbackAction,
  type RecommendationMediaType
} from "../_shared/recommendationEngine.ts";
import {
  collectRecommendationImpressionIdentityKeys,
  createRecommendationImpressionRows,
  RECENT_RECOMMENDATION_IMPRESSION_LIMIT
} from "../_shared/recommendationImpressions.ts";
import {
  enrichTmdbRecommendationCandidates,
  fetchKrWatchRegion,
  fetchTasteFillPage,
  type CatalogRecommendationCandidate,
  fetchRecommendationProviderPage
} from "../_shared/recommendationProviders.ts";
import { attachKrOttProviders } from "../_shared/watchProviders.ts";
import { createPersistentRecommendationCache } from "../_shared/recommendationCache.ts";
import { discoveryFilterKey, matchesDiscoveryFilters, normalizeDiscoveryFilters, toAppliedDiscoveryFilters, type DiscoveryFilterInput } from "../_shared/discoveryFilters.ts";
import {
  filterRecommendationsForUser,
  isRecommendationExcludedForUser,
  userRecommendationFiltersFromFeedback
} from "../_shared/recommendationUserFilters.ts";
import { mergeLibraryRowsByContent } from "./libraryRowMerge.ts";
import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { createAdminClient, createUserClient, requireUser } from "../_shared/supabase.ts";

interface PersonalizedRecommendationRequest {
  action?: "recommend" | "record_impressions" | "record_feedback";
  limit?: number;
  media_type?: RecommendationMediaType;
  genre?: string;
  country?: string;
  genres?: string[];
  countries?: string[];
  mediaTypes?: ("anime" | "drama" | "movie")[];
  exclude_ids?: string[];
  cursor?: string | null;
  impressions?: RecommendationCandidate[];
  feedback?: RecommendationFeedback | RecommendationFeedback[];
}

interface RawExternalId {
  api_source?: string | null;
  external_id?: string | null;
}

interface RawGenreJoin {
  genres?: { name?: string | null } | { name?: string | null }[] | null;
}

interface RawSeason {
  episode_count?: number | null;
}

interface RawContentTheme {
  family: "relationship" | "tone" | "setting" | "narrative" | "occupation" | "audience" | "format";
  key: string;
  label: string;
  centrality: number;
  source: string;
  source_key: string;
}

interface RawContent {
  id?: string | null;
  content_type?: string | null;
  source_api?: string | null;
  source_id?: string | null;
  title_primary?: string | null;
  title_original?: string | null;
  air_year?: number | null;
  air_date?: string | null;
  content_external_ids?: RawExternalId[] | null;
  content_genres?: RawGenreJoin[] | null;
  seasons?: RawSeason[] | null;
  content_themes?: RawContentTheme[] | null;
}

interface RawLibraryRow {
  content_id?: string | null;
  status?: string | null;
  status_flags?: string[] | null;
  watch_count?: number | null;
  contents?: RawContent | RawContent[] | null;
}

interface ImpressionRow {
  canonical_content_id?: string | null;
  identity_keys?: string[] | null;
}

interface ValidatedRecommendationRequest {
  action: "recommend";
  limit: number;
  mediaType: RecommendationMediaType;
  discoveryFilters: DiscoveryFilterInput;
  excludeIds: string[];
  cursor: string | null;
}

interface ValidatedImpressionRequest {
  action: "record_impressions";
  impressions: RecommendationCandidate[];
}

interface ValidatedFeedbackRequest {
  action: "record_feedback";
  feedback: RecommendationFeedback[];
}

type ValidatedRequest = ValidatedRecommendationRequest | ValidatedImpressionRequest | ValidatedFeedbackRequest;

const MAX_EXCLUSION_IDS = 200;
const MAX_IMPRESSIONS_PER_REQUEST = 12;
const MAX_FEEDBACK_PER_REQUEST = 4;

Deno.serve(async (req: Request) => {
  const requestDeadline = Date.now() + 8_500;
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");

  let user: { id: string; jwt: string };
  try {
    user = await requireUser(req);
  } catch {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const parsedBody = await parseJson<PersonalizedRecommendationRequest>(req);
  if (!parsedBody.ok) return jsonError(400, "INVALID_REQUEST", parsedBody.message);
  const validated = validateRequest(parsedBody.value);
  if (!validated.ok) return jsonError(400, "INVALID_REQUEST", validated.message);

  const userClient = createUserClient(user.jwt);

  if (validated.value.action === "record_impressions") {
    try {
      const saved = await recordRecommendationImpressions(
        userClient,
        user.id,
        validated.value.impressions
      );
      return json({ saved });
    } catch (error) {
      console.error("personalized-recommendations impression write failed:", error);
      return jsonError(500, "IMPRESSION_WRITE_FAILED", "Failed to save recommendation impressions");
    }
  }

  if (validated.value.action === "record_feedback") {
    try {
      await recordContentFeedback(userClient, user.id, validated.value.feedback);
      return json({ saved: true });
    } catch (error) {
      console.error("personalized-recommendations feedback write failed:", error);
      return jsonError(500, "FEEDBACK_WRITE_FAILED", "Failed to save recommendation feedback");
    }
  }

  try {
    const [libraryResult, feedbackResult] = await Promise.all([
      userClient
        .from("user_library_items")
        .select(
          "content_id,status,status_flags,watch_count,contents(id,content_type,source_api,source_id,title_primary,title_original,air_year,air_date,content_external_ids(api_source,external_id),content_genres(genres(name)),content_themes(family,key,label,centrality,source,source_key),seasons(episode_count))"
        )
        .eq("user_id", user.id),
      userClient
        .from("user_content_feedback")
        .select("target_type,target_key,action,weight,source_content_id,updated_at")
        .eq("user_id", user.id)
    ]);

    if (libraryResult.error) {
      console.error("personalized-recommendations library query failed:", libraryResult.error);
      return jsonError(500, "LIBRARY_QUERY_FAILED", "Failed to load the user library");
    }
    if (feedbackResult.error) {
      console.error("personalized-recommendations feedback query failed:", feedbackResult.error);
      return jsonError(500, "FEEDBACK_QUERY_FAILED", "Failed to load recommendation feedback");
    }

    const libraryItems = mergeLibraryRowsByContent((libraryResult.data ?? []) as unknown as RawLibraryRow[])
      .map(normalizeLibraryItem);
    const recentSeenIds = await loadRecentSeenIdentityKeys(userClient, user.id);
    const feedback = (feedbackResult.data ?? []) as RecommendationFeedback[];
    const filters = userRecommendationFiltersFromFeedback(feedback);
    const keywordLookupExclusions = new Set(
      [
        ...validated.value.excludeIds,
        ...recentSeenIds,
        ...libraryItems.flatMap(createRecommendationIdentityAliases),
        ...feedback
          .filter((item) => item.target_type === "content" &&
            (item.action === "not_interested" || item.action === "exclude"))
          .flatMap((item) => [item.target_key, item.source_content_id ?? ""])
      ].map(normalizeRecommendationIdentityKey).filter(Boolean)
    );
    // Cache only public provider metadata. Account filters and ranking are
    // applied below on every request; user records still use the RLS client.
    const cacheClient = createAdminClient();
    const providerCache = createPersistentRecommendationCache({
      async read(key, source) {
        const { data, error } = await cacheClient.from("external_search_cache")
          .select("response_json,expires_at")
          .eq("query_hash", key).eq("source", source)
          .gt("expires_at", new Date().toISOString()).maybeSingle();
        if (error) throw error;
        return data ? { value: data.response_json, expiresAt: data.expires_at } : null;
      },
      async write(key, source, value, expiresAt) {
        const { error } = await cacheClient.from("external_search_cache").upsert({
          query_hash: key, query_text: key, source,
          response_json: value, expires_at: expiresAt
        }, { onConflict: "query_hash,source" });
        if (error) throw error;
      }
    }, Date.now, 800, requestDeadline);
    let keywordLookupLimited = false;
    const keywordLookupBudget = { remaining: 16 };
    const scanStartedAt = Date.now();
    const discoveryFilters = validated.value.discoveryFilters;
    const needsKeywordLookup = (candidate: RecommendationCandidate) =>
      createRecommendationIdentityAliases(candidate)
        .every((identity) => !keywordLookupExclusions.has(normalizeRecommendationIdentityKey(identity)));
    const candidateFilter = (candidate: RecommendationCandidate) =>
      hasKoreanDisplayTitle(candidate) && matchesDiscoveryFilters(candidate, discoveryFilters) && !isRecommendationExcludedForUser(candidate, filters);
    const providerFetcher = async (request: Parameters<typeof fetchRecommendationProviderPage>[0]) => {
      const rawPage = await fetchRecommendationProviderPage(request, { filters, discoveryFilters, cache: providerCache, deadlineMs: requestDeadline });
      const page = { ...rawPage, items: rawPage.items.filter((candidate) => matchesDiscoveryFilters(candidate, discoveryFilters)) };
      if (filters.excludedThemeKeys.length === 0) return page;
      const visibleGenres = filterRecommendationsForUser(page.items, {
        excludedThemeKeys: [],
        excludedGenres: filters.excludedGenres
      }).filter(hasKoreanDisplayTitle);
      let pendingVerification = false;
      const enriched = await enrichTmdbRecommendationCandidates(
        visibleGenres,
        needsKeywordLookup,
        {
          cache: providerCache,
          deadlineMs: requestDeadline,
          lookupBudget: keywordLookupBudget,
          onDeferred: () => { pendingVerification = true; }
        }
      );
      if (pendingVerification || enriched.some((candidate) => candidate.external_source === "tmdb" &&
          needsKeywordLookup(candidate) && !candidate.keywords?.length)) {
        keywordLookupLimited = true;
      }
      return { ...page, items: enriched, pendingVerification };
    };
    const cursorState = decodeTasteFillCursor(validated.value.cursor);
    const profile = buildPreferenceProfile(libraryItems, feedback);
    const result: RecommendationCatalogScanResult<CatalogRecommendationCandidate> = cursorState.catalogDone ? {
      items: [], nextCursor: null, hasMore: false, exhausted: true,
      scanBudgetReached: false, broadened: false, warnings: [], failedProviders: [],
      allProvidersFailed: false, providersBlocked: false, profileMode: profile.mode
    } : await scanRecommendationCatalog(providerFetcher, {
      limit: validated.value.limit,
      mediaType: validated.value.mediaType,
      discoveryFilters,
      cursor: cursorState.catalog,
      excludeIds: [...validated.value.excludeIds, ...recentSeenIds],
      libraryItems,
      candidateFilter,
      maxMonthsPerRequest: 3,
      maxProviderRoundsPerRequest: 3,
      // Fast cache hits may fill the batch in this call. Reserve the full
      // provider/keyword timeout before starting any further cold round.
      canContinue: () => Date.now() - scanStartedAt < 1_000 && keywordLookupBudget.remaining > 0,
      feedback
    });

    const taste = { ...cursorState.taste };
    let queries: TasteFillQuery[] = [];
    let fill: typeof result.items = [];
    if (shouldRunTasteFill({ itemCount: result.items.length, limit: validated.value.limit, remainingMs: requestDeadline - Date.now() })) {
      queries = deriveTasteFillQueries({ profile, discoveryFilters, mediaType: validated.value.mediaType, userFilters: filters });
      const pending = queries.filter(query => !taste[query.key]?.done);
      const asOfDate = new Date(Date.now() + 9 * 60 * 60_000).toISOString().slice(0, 10);
      const pages = await Promise.allSettled(pending.map(query => fetchTasteFillPage(query, taste[query.key]?.page ?? 1, {
        filters, discoveryFilters, cache: providerCache, deadlineMs: requestDeadline, asOfDate
      })));
      let candidates: CatalogRecommendationCandidate[] = [];
      pages.forEach((page, index) => {
        if (page.status !== "fulfilled") return;
        const key = pending[index].key;
        taste[key] = { page: (taste[key]?.page ?? 1) + 1, done: !page.value.hasMore };
        candidates.push(...page.value.items);
      });
      candidates = candidates.filter(candidate => matchesDiscoveryFilters(candidate, discoveryFilters));
      if (filters.excludedThemeKeys.length) {
        candidates = filterRecommendationsForUser(candidates, {
          excludedThemeKeys: [], excludedGenres: filters.excludedGenres
        }).filter(hasKoreanDisplayTitle);
        let pendingVerification = false;
        candidates = await enrichTmdbRecommendationCandidates(candidates, needsKeywordLookup, {
          cache: providerCache, deadlineMs: requestDeadline, lookupBudget: keywordLookupBudget,
          onDeferred: () => { pendingVerification = true; }
        });
        if (pendingVerification || candidates.some(candidate => candidate.external_source === "tmdb" &&
          needsKeywordLookup(candidate) && !candidate.keywords?.length)) keywordLookupLimited = true;
      }
      const ranked = rankCandidates(profile, candidates.filter(candidateFilter), { mediaType: validated.value.mediaType, libraryItems });
      fill = selectTasteFillItems({
        ranked, existing: result.items, blockedIdentities: keywordLookupExclusions,
        need: validated.value.limit - result.items.length,
        identities: item => createRecommendationIdentityAliases(item).map(normalizeRecommendationIdentityKey)
      });
    }
    const items = [...result.items, ...fill];
    if (result.allProvidersFailed && items.length === 0) {
      return jsonError(503, "ALL_PROVIDERS_FAILED", "Recommendation data providers are unavailable");
    }

    const failedSources = normalizeFailedSources(result.failedProviders);
    const includeDebug = Deno.env.get("RECOMMENDATION_DEBUG") === "true";
    if (includeDebug) console.info("personalized-recommendations taste fill", { catalogItems: result.items.length, tasteFill: fill.length, queries: queries.length });
    const catalogDone = cursorState.catalogDone || !result.nextCursor || !result.hasMore;
    const nextCursor = encodeTasteFillCursor({ catalog: catalogDone ? null : result.nextCursor, catalogDone, taste });
    const itemsWithProviders = await attachKrOttProviders(
      items,
      (kind, tmdbId) => fetchKrWatchRegion(kind, tmdbId, { cache: providerCache, deadlineMs: requestDeadline }),
      { deadlineMs: requestDeadline }
    );
    return json({
      items: itemsWithProviders.map((item) => {
        if (includeDebug) return { ...item, origin_country: item.countries ?? [] };
        const { candidate_score: _candidateScore, ...publicItem } = item;
        return { ...publicItem, origin_country: item.countries ?? [] };
      }),
      next_cursor: nextCursor,
      has_more: nextCursor !== null,
      is_exhausted: nextCursor === null,
      taste_fill_count: fill.length,
      scan_budget_reached: result.scanBudgetReached,
      providers_blocked: result.providersBlocked,
      broadened: result.broadened,
      profile_mode: result.profileMode,
      warnings: result.warnings,
      filter_limited: keywordLookupLimited,
      applied_filters: toAppliedDiscoveryFilters(discoveryFilters),
      failed_sources: failedSources,
      partial: result.providersBlocked && failedSources.length > 0 && result.items.length < validated.value.limit
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_RECOMMENDATION_CURSOR") {
      return jsonError(400, "INVALID_CURSOR", "Recommendation cursor is invalid or does not match the filter");
    }
    console.error("personalized-recommendations failed:", error);
    return jsonError(
      503,
      "RECOMMENDATION_FAILED",
      error instanceof Error ? error.message : "Failed to build personalized recommendations"
    );
  }
});

function validateRequest(
  value: PersonalizedRecommendationRequest
): { ok: true; value: ValidatedRequest } | { ok: false; message: string } {
  const action = value.action ?? "recommend";
  if (action === "record_impressions") {
    if (!Array.isArray(value.impressions) || value.impressions.length < 1) {
      return { ok: false, message: "impressions must be a non-empty array" };
    }
    if (value.impressions.length > MAX_IMPRESSIONS_PER_REQUEST) {
      return { ok: false, message: `impressions cannot contain more than ${MAX_IMPRESSIONS_PER_REQUEST} items` };
    }
    if (!value.impressions.every(isRecommendationCandidate)) {
      return { ok: false, message: "impressions contain an invalid recommendation item" };
    }
    return { ok: true, value: { action, impressions: value.impressions } };
  }
  if (action === "record_feedback") {
    const feedback = Array.isArray(value.feedback) ? value.feedback : [value.feedback];
    if (feedback.length < 1 || feedback.length > MAX_FEEDBACK_PER_REQUEST) {
      return {
        ok: false,
        message: `feedback must contain between 1 and ${MAX_FEEDBACK_PER_REQUEST} items`
      };
    }
    if (!feedback.every(isRecommendationFeedback)) {
      return { ok: false, message: "feedback is invalid" };
    }
    return { ok: true, value: { action, feedback } };
  }
  if (action !== "recommend") return { ok: false, message: "action is invalid" };

  const limit = value.limit ?? 12;
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) {
    return { ok: false, message: "limit must be an integer between 1 and 12" };
  }
  const mediaType = value.media_type ?? "all";
  if (!["all", "drama", "anime", "movie"].includes(mediaType)) {
    return { ok: false, message: "media_type must be all, drama, anime, or movie" };
  }
  if (value.genre !== undefined && (typeof value.genre !== "string" || value.genre.length > 80)) {
    return { ok: false, message: "genre must be a string of at most 80 characters" };
  }
  if (value.country !== undefined && (typeof value.country !== "string" || !/^(?:all|[a-z]{2})$/i.test(value.country.trim()))) {
    return { ok: false, message: "country must be all or an ISO 3166-1 alpha-2 code" };
  }
  if (value.genres !== undefined && (!Array.isArray(value.genres) || value.genres.length > 40 || !value.genres.every((genre) => typeof genre === "string" && genre.length <= 80))) {
    return { ok: false, message: "genres must contain at most 40 genre strings" };
  }
  if (value.countries !== undefined && (!Array.isArray(value.countries) || value.countries.length > 20 || !value.countries.every((country) => typeof country === "string" && /^(?:all|[a-z]{2})$/i.test(country.trim())))) {
    return { ok: false, message: "countries must contain at most 20 ISO country codes" };
  }
  if (value.mediaTypes !== undefined && (!Array.isArray(value.mediaTypes) || value.mediaTypes.length > 3 || !value.mediaTypes.every((type) => ["anime", "drama", "movie"].includes(type)))) {
    return { ok: false, message: "mediaTypes must contain anime, drama, or movie" };
  }
  if (value.year !== undefined && value.year !== null && (!Number.isInteger(value.year) || value.year < 1900 || value.year > 2100)) {
    return { ok: false, message: "year must be an integer between 1900 and 2100 or null" };
  }
  const discoveryFilters = normalizeDiscoveryFilters(value);
  if (discoveryFilterKey(discoveryFilters).length > 1000) return { ok: false, message: "discovery filters are too long" };
  const excludeIds = validateIdArray(value.exclude_ids);
  if (!excludeIds.ok) return excludeIds;
  if (value.cursor !== undefined && value.cursor !== null && typeof value.cursor !== "string") {
    return { ok: false, message: "cursor must be a string or null" };
  }
  if (typeof value.cursor === "string" && value.cursor.length > 4096) {
    return { ok: false, message: "cursor is too long" };
  }

  return {
    ok: true,
    value: {
      action,
      limit,
      mediaType,
      discoveryFilters: {
        ...(discoveryFilters.year !== undefined ? { year: discoveryFilters.year } : {}),
        genres: discoveryFilters.genres,
        countries: discoveryFilters.countries,
        ...(value.mediaTypes !== undefined ? { mediaTypes: discoveryFilters.mediaTypes } : {})
      },
      excludeIds: excludeIds.value,
      cursor: value.cursor?.trim() || null
    }
  };
}

function isRecommendationFeedback(value: unknown): value is RecommendationFeedback {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const feedback = value as Partial<RecommendationFeedback>;
  return (
    ["content", "genre", "tag", "theme", "studio", "cast", "staff"].includes(feedback.target_type ?? "") &&
    typeof feedback.target_key === "string" && feedback.target_key.trim().length > 0 && feedback.target_key.length <= 300 &&
    ["more", "less", "exclude", "not_interested"].includes(feedback.action ?? "")
  );
}

async function recordContentFeedback(
  userClient: ReturnType<typeof createUserClient>,
  userId: string,
  feedback: readonly RecommendationFeedback[]
): Promise<void> {
  const updatedAt = new Date().toISOString();
  const rowsByTarget = new Map<string, {
    user_id: string;
    target_type: RecommendationFeedback["target_type"];
    target_key: string;
    action: RecommendationFeedbackAction;
    weight: number;
    source_content_id: string | null;
    updated_at: string;
  }>();

  for (const item of feedback) {
    const targetKey = item.target_key.trim().toLocaleLowerCase();
    rowsByTarget.set(`${item.target_type}:${targetKey}`, {
      user_id: userId,
      target_type: item.target_type,
      target_key: targetKey,
      action: item.action as RecommendationFeedbackAction,
      weight: item.weight ?? 1,
      source_content_id: item.source_content_id ?? null,
      updated_at: updatedAt
    });
  }

  // PostgREST executes this array upsert as one SQL statement, so the batch either
  // persists completely or fails without leaving a partial preference update.
  const { error } = await userClient
    .from("user_content_feedback")
    .upsert([...rowsByTarget.values()], {
      onConflict: "user_id,target_type,target_key",
      ignoreDuplicates: false
    });
  if (error) throw error;
}

function validateIdArray(
  value: string[] | undefined
): { ok: true; value: string[] } | { ok: false; message: string } {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return { ok: false, message: "exclude_ids must be an array of strings" };
  }
  if (value.length > MAX_EXCLUSION_IDS) {
    return { ok: false, message: `exclude_ids cannot contain more than ${MAX_EXCLUSION_IDS} items` };
  }
  return {
    ok: true,
    value: Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)))
  };
}

function isRecommendationCandidate(value: unknown): value is RecommendationCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<RecommendationCandidate>;
  return (
    typeof candidate.external_source === "string" &&
    Boolean(candidate.external_source.trim()) &&
    typeof candidate.external_id === "string" &&
    Boolean(candidate.external_id.trim()) &&
    typeof candidate.content_type === "string" &&
    typeof candidate.title_primary === "string" &&
    Boolean(candidate.title_primary.trim())
  );
}

async function loadRecentSeenIdentityKeys(
  userClient: ReturnType<typeof createUserClient>,
  userId: string
): Promise<string[]> {
  const { data, error } = await userClient
    .from("user_recommendation_impressions")
    .select("canonical_content_id,identity_keys")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .order("canonical_content_id", { ascending: true })
    .limit(RECENT_RECOMMENDATION_IMPRESSION_LIMIT);
  if (error) {
    console.warn("personalized-recommendations recent seen lookup skipped:", {
      code: error.code,
      message: error.message
    });
    return [];
  }

  return collectRecommendationImpressionIdentityKeys((data ?? []) as ImpressionRow[]);
}

async function recordRecommendationImpressions(
  userClient: ReturnType<typeof createUserClient>,
  userId: string,
  impressions: readonly RecommendationCandidate[]
): Promise<number> {
  const rows = createRecommendationImpressionRows(userId, impressions);
  if (rows.length === 0) return 0;

  const { error } = await userClient
    .from("user_recommendation_impressions")
    .upsert(rows, {
      onConflict: "user_id,canonical_content_id",
      ignoreDuplicates: false,
      defaultToNull: false
    });
  if (error) throw error;
  return rows.length;
}

function normalizeFailedSources(providers: readonly RecommendationProvider[]): string[] {
  return Array.from(
    new Set(providers.map((provider) => (provider.startsWith("tmdb_") ? "tmdb" : provider)))
  );
}

function normalizeRecommendationIdentityKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function normalizeLibraryItem(row: RawLibraryRow): RecommendationLibraryItem {
  const content = unwrapRelation(row.contents);
  const seasons = content?.seasons ?? [];
  const episodeCounts = seasons
    .map((season) => season.episode_count)
    .filter((count): count is number => typeof count === "number" && Number.isFinite(count) && count >= 0);

  return {
    content_id: row.content_id ?? content?.id ?? null,
    source_api: content?.source_api ?? null,
    source_id: content?.source_id ?? null,
    content_type: content?.content_type ?? null,
    title_primary: content?.title_primary ?? null,
    title_original: content?.title_original ?? null,
    air_year: content?.air_year ?? null,
    air_date: content?.air_date ?? null,
    genres: extractGenreNames(content?.content_genres),
    themes: content?.content_themes ?? [],
    episode_count: episodeCounts.length > 0 ? episodeCounts.reduce((sum, count) => sum + count, 0) : null,
    season_count: seasons.length || null,
    status: row.status ?? null,
    status_flags: row.status_flags ?? null,
    watch_count: row.watch_count ?? 0,
    content_external_ids: content?.content_external_ids ?? []
  };
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function extractGenreNames(contentGenres: RawGenreJoin[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (contentGenres ?? [])
        .flatMap((join) => (Array.isArray(join.genres) ? join.genres : [join.genres]))
        .map((genre) => genre?.name?.trim())
        .filter((name): name is string => Boolean(name))
    )
  );
}
