import {
  hasKoreanDisplayTitle,
  scanRecommendationCatalog,
  type RecommendationProvider
} from "../_shared/recommendationCatalog.ts";
import {
  type RecommendationCandidate,
  type RecommendationLibraryItem,
  type RecommendationMediaType
} from "../_shared/recommendationEngine.ts";
import {
  collectRecommendationImpressionIdentityKeys,
  createRecommendationImpressionRows,
  RECENT_RECOMMENDATION_IMPRESSION_LIMIT
} from "../_shared/recommendationImpressions.ts";
import { fetchRecommendationProviderPage } from "../_shared/recommendationProviders.ts";
import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { createUserClient, requireUser } from "../_shared/supabase.ts";

interface PersonalizedRecommendationRequest {
  action?: "recommend" | "record_impressions";
  limit?: number;
  media_type?: RecommendationMediaType;
  exclude_ids?: string[];
  cursor?: string | null;
  impressions?: RecommendationCandidate[];
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
  excludeIds: string[];
  cursor: string | null;
}

interface ValidatedImpressionRequest {
  action: "record_impressions";
  impressions: RecommendationCandidate[];
}

type ValidatedRequest = ValidatedRecommendationRequest | ValidatedImpressionRequest;

const MAX_EXCLUSION_IDS = 200;
const MAX_IMPRESSIONS_PER_REQUEST = 12;

Deno.serve(async (req: Request) => {
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

  try {
    const libraryResult = await userClient
      .from("user_library_items")
      .select(
        "content_id,status,status_flags,watch_count,contents(id,content_type,source_api,source_id,title_primary,title_original,air_year,air_date,content_external_ids(api_source,external_id),content_genres(genres(name)),seasons(episode_count))"
      )
      .eq("user_id", user.id);

    if (libraryResult.error) {
      console.error("personalized-recommendations library query failed:", libraryResult.error);
      return jsonError(500, "LIBRARY_QUERY_FAILED", "Failed to load the user library");
    }

    const libraryItems = ((libraryResult.data ?? []) as unknown as RawLibraryRow[]).map(normalizeLibraryItem);
    const recentSeenIds = await loadRecentSeenIdentityKeys(userClient, user.id);
    const result = await scanRecommendationCatalog(fetchRecommendationProviderPage, {
      limit: validated.value.limit,
      mediaType: validated.value.mediaType,
      cursor: validated.value.cursor,
      excludeIds: [...validated.value.excludeIds, ...recentSeenIds],
      libraryItems,
      candidateFilter: hasKoreanDisplayTitle,
      maxMonthsPerRequest: 1,
      maxProviderRoundsPerRequest: 1
    });

    if (result.allProvidersFailed) {
      return jsonError(503, "ALL_PROVIDERS_FAILED", "Recommendation data providers are unavailable");
    }

    const failedSources = normalizeFailedSources(result.failedProviders);
    return json({
      items: result.items,
      next_cursor: result.nextCursor,
      has_more: result.hasMore,
      is_exhausted: result.exhausted,
      scan_budget_reached: result.scanBudgetReached,
      providers_blocked: result.providersBlocked,
      broadened: result.broadened,
      profile_mode: result.profileMode,
      warnings: result.warnings,
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
  if (action !== "recommend") return { ok: false, message: "action is invalid" };

  const limit = value.limit ?? 12;
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) {
    return { ok: false, message: "limit must be an integer between 1 and 12" };
  }
  const mediaType = value.media_type ?? "all";
  if (!["all", "drama", "anime", "movie"].includes(mediaType)) {
    return { ok: false, message: "media_type must be all, drama, anime, or movie" };
  }
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
      excludeIds: excludeIds.value,
      cursor: value.cursor?.trim() || null
    }
  };
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
