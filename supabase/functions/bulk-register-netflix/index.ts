import { fetchContentDetail } from "../_shared/externalContent.ts";
import { upsertGenres } from "../_shared/genres.ts";
import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import type { ContentMeta, ContentType, ExternalSource, WatchStatus } from "../_shared/types.ts";

type MediaHint = "tv" | "movie" | "unknown";
type TmdbMediaType = "tv" | "movie";

const TMDB_LANGUAGE = "ko-KR";
const TMDB_REGION = "KR";
const WATCH_STATUS_OPTIONS: WatchStatus[] = ["wishlist", "watching", "completed", "recommended", "not_recommended"];

interface BulkRegisterRequest {
  rows?: Record<string, unknown>[];
  commit?: boolean;
}

interface WorkRow {
  rowNumber: number;
  workId: string;
  importSelected: boolean;
  normalizedTitle: string;
  titleOverride: string | null;
  resolvedTitle: string;
  tmdbSearchQuery: string | null;
  mediaHint: MediaHint;
  existingAppContentId: string | null;
  tmdbId: string | null;
  tmdbMediaType: TmdbMediaType | null;
}

interface ContentRecord {
  id: string;
  content_type: ContentType;
  source_api: ExternalSource;
  source_id: string;
  title_primary: string;
  title_original: string | null;
  air_year: number | null;
  content_external_ids?: { api_source: ExternalSource; external_id: string }[] | null;
  content_titles?: { language_code: string; title: string }[] | null;
}

interface LibraryRecord {
  id: string;
  status: WatchStatus;
  status_flags?: WatchStatus[] | null;
  watch_count?: number | null;
}

interface TmdbSearchCandidate {
  id: number;
  media_type: TmdbMediaType;
  title?: string | null;
  name?: string | null;
  original_title?: string | null;
  original_name?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  poster_path?: string | null;
  overview?: string | null;
  popularity?: number | null;
}

interface RowResult {
  work_id: string;
  row_number: number;
  normalized_title: string;
  resolved_title: string;
  existing_app_content_id: string;
  resolved_tmdb_id: string;
  resolved_media_type: string;
  duplicate_check_result: string;
  import_result: string;
  status_result: string;
  failure_reason: string;
}

interface Summary {
  total_rows: number;
  selected_rows: number;
  existing_app_matches: number;
  tmdb_cache_hits: number;
  tmdb_api_calls: number;
  tmdb_matched_existing_content: number;
  new_content_to_create: number;
  new_content_created: number;
  status_to_update: number;
  status_updated: number;
  manual_review_required: number;
  skipped: number;
  failed: number;
}

Deno.serve(async (req: Request) => {
  try {
    return await handleRequest(req);
  } catch (error) {
    return jsonError(500, "BULK_IMPORT_FAILED", createServerErrorMessage(error));
  }
});

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");

  let userId: string;
  try {
    userId = (await requireUser(req)).id;
  } catch {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const body = await parseJson<BulkRegisterRequest>(req);
  if (!body.ok) return jsonError(400, "INVALID_REQUEST", body.message);

  const rawRows = body.value.rows ?? [];
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return jsonError(400, "INVALID_REQUEST", "rows are required");
  }
  if (rawRows.length > 600) {
    return jsonError(400, "INVALID_REQUEST", "Too many rows. Upload up to 600 rows.");
  }

  const commit = Boolean(body.value.commit);
  const adminClient = createAdminClient();
  const rows = normalizeRows(rawRows);
  const selectedRows = rows.filter((row) => row.importSelected);
  const contents = await fetchAllContents(adminClient);
  const tmdb = new TmdbClient();
  const resultRows: RowResult[] = [];
  const summary: Summary = {
    total_rows: rows.length,
    selected_rows: selectedRows.length,
    existing_app_matches: 0,
    tmdb_cache_hits: 0,
    tmdb_api_calls: 0,
    tmdb_matched_existing_content: 0,
    new_content_to_create: 0,
    new_content_created: 0,
    status_to_update: 0,
    status_updated: 0,
    manual_review_required: 0,
    skipped: rows.length - selectedRows.length,
    failed: 0
  };

  for (const row of selectedRows) {
    try {
      const result = await processRow({ row, contents, adminClient, userId, tmdb, commit });
      resultRows.push(result.row);
      addSummary(summary, result.summary);
    } catch (error) {
      summary.failed += 1;
      resultRows.push({
        work_id: row.workId,
        row_number: row.rowNumber,
        normalized_title: row.normalizedTitle,
        resolved_title: row.resolvedTitle,
        existing_app_content_id: "",
        resolved_tmdb_id: "",
        resolved_media_type: "",
        duplicate_check_result: "failed",
        import_result: "failed",
        status_result: "failed",
        failure_reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  summary.tmdb_api_calls = tmdb.apiCalls;
  return json({ mode: commit ? "commit" : "dry-run", summary, rows: resultRows });
}

async function processRow({
  row,
  contents,
  adminClient,
  userId,
  tmdb,
  commit
}: {
  row: WorkRow;
  contents: ContentRecord[];
  adminClient: ReturnType<typeof createAdminClient>;
  userId: string;
  tmdb: TmdbClient;
  commit: boolean;
}): Promise<{ row: RowResult; summary: Partial<Summary> }> {
  const base = createBaseRowResult(row);
  const providedContent = row.existingAppContentId
    ? contents.find((content) => content.id === row.existingAppContentId)
    : undefined;

  if (providedContent) {
    const statusResult = await maybeUpsertCompletedStatus(adminClient, commit, userId, providedContent.id);
    return {
      row: {
        ...base,
        existing_app_content_id: providedContent.id,
        duplicate_check_result: "provided_existing_app_content_id",
        import_result: commit ? "duplicate_existing_updated" : "dry_run_existing_status_update",
        status_result: statusResult
      },
      summary: { existing_app_matches: 1, status_to_update: 1, status_updated: commit ? 1 : 0 }
    };
  }

  const existingBeforeTmdb = findExistingContentForRow(row, contents);
  if (existingBeforeTmdb.status === "ambiguous") {
    return {
      row: {
        ...base,
        duplicate_check_result: "ambiguous_existing_match",
        import_result: "manual_review",
        status_result: "skipped_manual_review",
        failure_reason: existingBeforeTmdb.reason
      },
      summary: { manual_review_required: 1 }
    };
  }
  if (existingBeforeTmdb.status === "matched" && existingBeforeTmdb.content) {
    const statusResult = await maybeUpsertCompletedStatus(adminClient, commit, userId, existingBeforeTmdb.content.id);
    return {
      row: {
        ...base,
        existing_app_content_id: existingBeforeTmdb.content.id,
        duplicate_check_result: "existing_app_match",
        import_result: commit ? "duplicate_existing_updated" : "dry_run_existing_status_update",
        status_result: statusResult
      },
      summary: { existing_app_matches: 1, status_to_update: 1, status_updated: commit ? 1 : 0 }
    };
  }

  const tmdbMatch = await resolveTmdbMatch(row, tmdb);
  const tmdbSummary: Partial<Summary> = { tmdb_cache_hits: tmdbMatch.cacheHit ? 1 : 0 };
  if (tmdbMatch.status !== "matched" || !tmdbMatch.candidate) {
    return {
      row: {
        ...base,
        duplicate_check_result: "no_existing_match",
        import_result: "manual_review",
        status_result: "skipped_manual_review",
        failure_reason: tmdbMatch.reason
      },
      summary: { ...tmdbSummary, manual_review_required: 1 }
    };
  }

  const tmdbId = String(tmdbMatch.candidate.id);
  const mediaType = tmdbMatch.candidate.media_type;
  const existingAfterTmdb = findContentByTmdb(contents, tmdbId, mediaType);

  if (existingAfterTmdb) {
    const statusResult = await maybeUpsertCompletedStatus(adminClient, commit, userId, existingAfterTmdb.id);
    return {
      row: {
        ...base,
        existing_app_content_id: existingAfterTmdb.id,
        resolved_tmdb_id: tmdbId,
        resolved_media_type: mediaType,
        duplicate_check_result: "tmdb_existing_match",
        import_result: commit ? "tmdb_matched_existing_updated" : "dry_run_tmdb_existing_status_update",
        status_result: statusResult
      },
      summary: {
        ...tmdbSummary,
        tmdb_matched_existing_content: 1,
        status_to_update: 1,
        status_updated: commit ? 1 : 0
      }
    };
  }

  if (!commit) {
    return {
      row: {
        ...base,
        resolved_tmdb_id: tmdbId,
        resolved_media_type: mediaType,
        duplicate_check_result: "no_existing_match",
        import_result: "dry_run_new_content_to_create",
        status_result: "would_update_completed"
      },
      summary: { ...tmdbSummary, new_content_to_create: 1, status_to_update: 1 }
    };
  }

  const content = await createTmdbContent(adminClient, tmdbId, mediaType);
  contents.push(content);
  const statusResult = await maybeUpsertCompletedStatus(adminClient, true, userId, content.id);

  return {
    row: {
      ...base,
      existing_app_content_id: content.id,
      resolved_tmdb_id: tmdbId,
      resolved_media_type: mediaType,
      duplicate_check_result: "no_existing_match",
      import_result: "new_content_created",
      status_result: statusResult
    },
    summary: {
      ...tmdbSummary,
      new_content_to_create: 1,
      new_content_created: 1,
      status_to_update: 1,
      status_updated: 1
    }
  };
}

async function createTmdbContent(
  adminClient: ReturnType<typeof createAdminClient>,
  tmdbId: string,
  mediaType: TmdbMediaType
): Promise<ContentRecord> {
  const contentMeta = await fetchContentDetail("tmdb", tmdbId, mediaType);
  const { data: contentRow, error: contentError } = await adminClient
    .from("contents")
    .upsert(
      {
        content_type: contentMeta.content_type,
        source_api: "tmdb",
        source_id: tmdbId,
        title_primary: contentMeta.title_primary,
        title_original: contentMeta.title_original,
        poster_url: contentMeta.poster_url,
        overview: contentMeta.overview,
        air_year: contentMeta.air_year
      },
      { onConflict: "source_api,source_id" }
    )
    .select("id,content_type,source_api,source_id,title_primary,title_original,air_year")
    .single();

  if (contentError || !contentRow) {
    throw new Error(contentError?.message ?? "content upsert failed");
  }

  const contentId = contentRow.id as string;
  await upsertGenres(adminClient, contentId, contentMeta.genres);

  const { error: externalIdError } = await adminClient.from("content_external_ids").upsert(
    {
      content_id: contentId,
      api_source: "tmdb",
      external_id: tmdbId
    },
    { onConflict: "api_source,external_id", ignoreDuplicates: true }
  );
  if (externalIdError) throw new Error(externalIdError.message);

  await upsertSeasons(adminClient, contentId, contentMeta);
  return contentRow as ContentRecord;
}

async function upsertSeasons(
  adminClient: ReturnType<typeof createAdminClient>,
  contentId: string,
  contentMeta: ContentMeta
): Promise<void> {
  if (!contentMeta.seasons.length) return;

  const { error } = await adminClient.from("seasons").upsert(
    contentMeta.seasons.map((season) => ({
      content_id: contentId,
      season_number: season.season_number,
      title: season.title,
      episode_count: season.episode_count,
      air_year: season.air_year
    })),
    { onConflict: "content_id,season_number" }
  );
  if (error) throw new Error(error.message);
}

async function maybeUpsertCompletedStatus(
  adminClient: ReturnType<typeof createAdminClient>,
  commit: boolean,
  userId: string,
  contentId: string
): Promise<string> {
  if (!commit) return "would_update_completed";

  const { data: existing, error: lookupError } = await adminClient
    .from("user_library_items")
    .select("id,status,status_flags,watch_count")
    .eq("user_id", userId)
    .eq("content_id", contentId)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  const existingRow = existing as LibraryRecord | null;
  const statusFlags = completedStatusFlags(existingRow?.status_flags ?? (existingRow ? [existingRow.status] : []));
  const watchCount = Math.max(1, existingRow?.watch_count ?? 0);

  if (existingRow) {
    const { error } = await adminClient
      .from("user_library_items")
      .update({ status: "completed", status_flags: statusFlags, watch_count: watchCount })
      .eq("id", existingRow.id);
    if (error) throw new Error(error.message);
    return "updated_completed";
  }

  const { error } = await adminClient.from("user_library_items").insert({
    user_id: userId,
    content_id: contentId,
    status: "completed",
    status_flags: ["completed"],
    watch_count: 1
  });
  if (error) {
    if (error.code === "23505") return "already_exists_race_skipped";
    throw new Error(error.message);
  }

  return "created_completed";
}

class TmdbClient {
  apiCalls = 0;
  private readonly searchCache = new Map<string, TmdbSearchCandidate[]>();
  private lastRequestAt = 0;

  async search(query: string, mediaHint: MediaHint): Promise<{ results: TmdbSearchCandidate[]; cacheHit: boolean }> {
    const key = `${mediaHint}:${normalizeTitleForLookup(query)}`;
    const cached = this.searchCache.get(key);
    if (cached) return { results: cached, cacheHit: true };

    const endpoint = mediaHint === "movie" ? "search/movie" : mediaHint === "tv" ? "search/tv" : "search/multi";
    const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
    url.searchParams.set("query", query);
    url.searchParams.set("language", TMDB_LANGUAGE);
    url.searchParams.set("region", TMDB_REGION);
    url.searchParams.set("include_adult", "false");

    const payload = await this.fetchJson<{ results?: TmdbSearchCandidate[] }>(url);
    const results = (payload.results ?? [])
      .map((candidate) => ({
        ...candidate,
        media_type: mediaHint === "movie" ? "movie" : mediaHint === "tv" ? "tv" : candidate.media_type
      }))
      .filter((candidate) => candidate.media_type === "tv" || candidate.media_type === "movie")
      .slice(0, 10);

    this.searchCache.set(key, results);
    return { results, cacheHit: false };
  }

  private async fetchJson<T>(url: URL, attempt = 0): Promise<T> {
    const apiKey = Deno.env.get("TMDB_API_KEY");
    if (!apiKey) throw new Error("TMDB_API_KEY is not configured");

    await this.rateLimit();
    const requestUrl = new URL(url.toString());
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (looksLikeJwt(apiKey)) {
      headers.Authorization = `Bearer ${apiKey}`;
    } else {
      requestUrl.searchParams.set("api_key", apiKey);
    }

    this.apiCalls += 1;
    const response = await fetch(requestUrl, { headers });
    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000 * 2 ** attempt);
      return this.fetchJson<T>(url, attempt + 1);
    }
    if (response.status >= 500 && attempt < 3) {
      await sleep(500 * 2 ** attempt);
      return this.fetchJson<T>(url, attempt + 1);
    }
    if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
    return (await response.json()) as T;
  }

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const waitMs = Math.max(0, 250 - elapsed);
    if (waitMs > 0) await sleep(waitMs);
    this.lastRequestAt = Date.now();
  }
}

async function fetchAllContents(adminClient: ReturnType<typeof createAdminClient>): Promise<ContentRecord[]> {
  const rows: ContentRecord[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await adminClient
      .from("contents")
      .select(
        "id,content_type,source_api,source_id,title_primary,title_original,air_year,content_external_ids(api_source,external_id),content_titles(language_code,title)"
      )
      .range(from, from + pageSize - 1)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as unknown as ContentRecord[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

function findExistingContentForRow(
  row: WorkRow,
  contents: ContentRecord[]
): { status: "none" | "matched" | "ambiguous"; content?: ContentRecord; reason: string } {
  if (row.tmdbId) {
    const tmdbMatch = findContentByTmdb(contents, row.tmdbId, row.tmdbMediaType ?? undefined);
    if (tmdbMatch) return { status: "matched", content: tmdbMatch, reason: "tmdb_id matched existing content" };
  }

  const rowTitles = rowTitleCandidates(row).map(normalizeTitleForLookup).filter(Boolean);
  if (!rowTitles.length) return { status: "none", reason: "no title candidates" };

  const matches = uniqueById(
    contents.filter((content) => {
      const contentTitles = contentTitleCandidates(content).map(normalizeTitleForLookup).filter(Boolean);
      return rowTitles.some((title) => contentTitles.includes(title));
    })
  );
  if (!matches.length) return { status: "none", reason: "no exact title match" };

  const mediaMatches = filterByMediaHint(matches, row.mediaHint);
  const candidates = mediaMatches.length ? mediaMatches : matches;
  if (candidates.length === 1 && candidates[0]) {
    return { status: "matched", content: candidates[0], reason: "single exact title match" };
  }
  return {
    status: "ambiguous",
    reason: `multiple existing candidates: ${candidates.map((candidate) => candidate.id).join(", ")}`
  };
}

async function resolveTmdbMatch(
  row: WorkRow,
  tmdb: TmdbClient
): Promise<{
  status: "matched" | "manual_review";
  candidate?: TmdbSearchCandidate;
  score: number;
  secondScore: number;
  reason: string;
  cacheHit: boolean;
}> {
  if (row.tmdbId && row.tmdbMediaType) {
    return {
      status: "matched",
      candidate: { id: Number(row.tmdbId), media_type: row.tmdbMediaType },
      score: 100,
      secondScore: 0,
      reason: "provided tmdb_id/tmdb_media_type",
      cacheHit: true
    };
  }

  const search = await tmdb.search(row.tmdbSearchQuery ?? row.resolvedTitle, row.mediaHint);
  const scored = search.results
    .map((candidate) => ({ candidate, score: scoreTmdbCandidate(row, candidate) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) {
    return { status: "manual_review", score: 0, secondScore: 0, reason: "no TMDB movie/tv candidates", cacheHit: search.cacheHit };
  }

  const secondScore = scored[1]?.score ?? 0;
  if (best.score < 65 || best.score - secondScore < 10) {
    return {
      status: "manual_review",
      score: best.score,
      secondScore,
      reason: `low or ambiguous TMDB confidence: best=${best.score}, second=${secondScore}`,
      cacheHit: search.cacheHit
    };
  }

  return {
    status: "matched",
    candidate: best.candidate,
    score: best.score,
    secondScore,
    reason: "confident TMDB match",
    cacheHit: search.cacheHit
  };
}

function scoreTmdbCandidate(row: WorkRow, candidate: TmdbSearchCandidate): number {
  const rowTitles = rowTitleCandidates(row);
  const candidateTitles = tmdbCandidateTitles(candidate);
  let mediaScore = 0;
  let titleScore = 0;

  if (row.mediaHint !== "unknown" && row.mediaHint === candidate.media_type) mediaScore += 22;
  if (row.mediaHint !== "unknown" && row.mediaHint !== candidate.media_type) mediaScore -= 18;

  for (const rowTitle of rowTitles) {
    const rowExact = normalizeTitleExact(rowTitle);
    const rowLoose = normalizeTitleForLookup(rowTitle);
    for (const candidateTitle of candidateTitles) {
      const candidateExact = normalizeTitleExact(candidateTitle);
      const candidateLoose = normalizeTitleForLookup(candidateTitle);
      if (rowExact && rowExact === candidateExact) titleScore = Math.max(titleScore, 82);
      if (rowLoose && rowLoose === candidateLoose) titleScore = Math.max(titleScore, 72);
      if (rowLoose && candidateLoose && (candidateLoose.includes(rowLoose) || rowLoose.includes(candidateLoose))) {
        titleScore = Math.max(titleScore, 48);
      }
    }
  }

  return Math.round(titleScore + mediaScore + Math.min(6, Math.max(0, candidate.popularity ?? 0) / 20));
}

function findContentByTmdb(
  contents: ContentRecord[],
  tmdbId: string,
  mediaType?: TmdbMediaType
): ContentRecord | undefined {
  return contents.find((content) => {
    if (mediaType && contentMediaType(content.content_type) !== mediaType) return false;
    if (content.source_api === "tmdb" && content.source_id === tmdbId) return true;
    return content.content_external_ids?.some(
      (externalId) => externalId.api_source === "tmdb" && externalId.external_id === tmdbId
    );
  });
}

function contentMediaType(contentType: ContentType): TmdbMediaType {
  return contentType === "movie" ? "movie" : "tv";
}

function normalizeRows(rows: Record<string, unknown>[]): WorkRow[] {
  return rows.map((row, index) => {
    const normalizedTitle = readString(row.normalized_title);
    const titleOverride = nullableString(row.title_override);
    const resolvedTitle = titleOverride ?? normalizedTitle;
    return {
      rowNumber: index + 2,
      workId: nullableString(row.work_id) ?? String(index + 1),
      importSelected: readBoolean(row.import_selected),
      normalizedTitle,
      titleOverride,
      resolvedTitle,
      tmdbSearchQuery: nullableString(row.tmdb_search_query),
      mediaHint: normalizeMediaHint(row.media_hint),
      existingAppContentId: nullableString(row.existing_app_content_id),
      tmdbId: nullableString(row.tmdb_id),
      tmdbMediaType: normalizeTmdbMediaType(row.tmdb_media_type)
    };
  });
}

function createBaseRowResult(row: WorkRow): RowResult {
  return {
    work_id: row.workId,
    row_number: row.rowNumber,
    normalized_title: row.normalizedTitle,
    resolved_title: row.resolvedTitle,
    existing_app_content_id: "",
    resolved_tmdb_id: "",
    resolved_media_type: "",
    duplicate_check_result: "",
    import_result: "",
    status_result: "",
    failure_reason: ""
  };
}

function rowTitleCandidates(row: WorkRow): string[] {
  return uniqueStrings([row.titleOverride, row.normalizedTitle, row.resolvedTitle, row.tmdbSearchQuery]);
}

function contentTitleCandidates(content: ContentRecord): string[] {
  return uniqueStrings([
    content.title_primary,
    content.title_original,
    ...(content.content_titles ?? []).map((title) => title.title)
  ]);
}

function tmdbCandidateTitles(candidate: TmdbSearchCandidate): string[] {
  return uniqueStrings([candidate.title, candidate.name, candidate.original_title, candidate.original_name]);
}

function filterByMediaHint(contents: ContentRecord[], mediaHint: MediaHint): ContentRecord[] {
  if (mediaHint === "unknown") return contents;
  if (mediaHint === "movie") return contents.filter((content) => content.content_type === "movie");
  return contents.filter((content) => content.content_type !== "movie");
}

function completedStatusFlags(existingFlags: WatchStatus[]): WatchStatus[] {
  const preserved = existingFlags.filter((status) => status === "recommended" || status === "not_recommended");
  return Array.from(new Set<WatchStatus>(["completed", ...preserved])).filter((status) =>
    WATCH_STATUS_OPTIONS.includes(status)
  );
}

function normalizeMediaHint(value: unknown): MediaHint {
  const text = readString(value).toLowerCase();
  if (text === "tv" || text === "show" || text === "series") return "tv";
  if (text === "movie" || text === "film") return "movie";
  return "unknown";
}

function normalizeTmdbMediaType(value: unknown): TmdbMediaType | null {
  const text = readString(value).toLowerCase();
  if (text === "tv" || text === "movie") return text;
  return null;
}

function readString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function nullableString(value: unknown): string | null {
  const text = readString(value);
  if (!text || text.toLowerCase() === "pending") return null;
  return text;
}

function readBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const text = readString(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "y";
}

function normalizeTitleExact(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().toLowerCase();
}

function normalizeTitleForLookup(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function addSummary(summary: Summary, patch: Partial<Summary>): void {
  for (const [key, value] of Object.entries(patch) as [keyof Summary, number][]) {
    summary[key] += value;
  }
}

function createServerErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing/i.test(message)) {
    return "서버에 Supabase 관리자 설정이 누락되어 대량 등록을 진행할 수 없습니다.";
  }
  if (/TMDB_API_KEY is not configured/i.test(message)) {
    return "서버에 TMDB API 키가 설정되어 있지 않아 작품 매칭을 진행할 수 없습니다.";
  }
  if (/permission denied|row-level security/i.test(message)) {
    return `데이터베이스 권한 문제로 대량 등록을 진행할 수 없습니다. 상세: ${message}`;
  }
  if (/relation .* does not exist|schema cache/i.test(message)) {
    return `데이터베이스 구조를 찾지 못했습니다. 상세: ${message}`;
  }
  return `대량 등록 서버 처리 중 오류가 발생했습니다. 상세: ${message}`;
}

function looksLikeJwt(value: string): boolean {
  return value.startsWith("eyJ") || value.split(".").length === 3;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
