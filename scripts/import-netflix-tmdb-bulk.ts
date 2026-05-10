import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type ContentType = "anime" | "kdrama" | "jdrama" | "movie" | "other";
type ExternalSource = "tmdb" | "anilist" | "kitsu" | "tvmaze" | "manual";
type WatchStatus = "wishlist" | "watching" | "completed" | "recommended" | "not_recommended" | "dropped";
type MediaHint = "tv" | "movie" | "unknown";
type TmdbMediaType = "tv" | "movie";

const DEFAULT_FILE = "docs/Netflix_TMDB_443Works_For_Codex_BulkRegister.xlsx";
const SHEET_NAME = "Works_To_Register";
const CACHE_DIR = ".cache/netflix-tmdb-bulk-import";
const TMDB_LANGUAGE = "ko-KR";
const TMDB_REGION = "KR";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const WATCH_STATUS_OPTIONS: WatchStatus[] = [
  "wishlist",
  "watching",
  "completed",
  "recommended",
  "not_recommended",
  "dropped"
];

interface CliOptions {
  file: string;
  commit: boolean;
  userId?: string;
  userEmail?: string;
  output?: string;
  cacheDir: string;
  limit?: number;
  confidenceThreshold: number;
}

interface WorkRow {
  rowNumber: number;
  workId: string;
  importSelected: boolean;
  desiredWatchStatus: WatchStatus;
  normalizedTitle: string;
  titleOverride: string | null;
  resolvedTitle: string;
  tmdbSearchQuery: string | null;
  mediaHint: MediaHint;
  viewCount: number;
  firstWatchedDate: string | null;
  lastWatchedDate: string | null;
  needsManualTitleReview: boolean;
  reviewFlag: string | null;
  sampleTitles: string | null;
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
  user_id: string;
  content_id: string;
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
  poster_path?: string | null;
  overview?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  genre_ids?: number[] | null;
  origin_country?: string[] | null;
  popularity?: number | null;
}

interface TmdbDetail {
  id: number;
  title?: string | null;
  name?: string | null;
  original_title?: string | null;
  original_name?: string | null;
  poster_path?: string | null;
  overview?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  genres?: { id?: number; name?: string | null }[] | null;
  origin_country?: string[] | null;
}

interface ExistingMatch {
  status: "none" | "matched" | "ambiguous";
  content?: ContentRecord;
  candidates?: ContentRecord[];
  reason: string;
}

interface TmdbMatch {
  status: "matched" | "manual_review";
  candidate?: TmdbSearchCandidate;
  score: number;
  secondScore: number;
  reason: string;
  cacheHit: boolean;
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

interface ImportReport {
  summary: Summary;
  rows: RowResult[];
  outputPath: string;
}

interface TmdbSearchCacheEntry {
  results: TmdbSearchCandidate[];
}

interface TmdbDetailCacheEntry {
  detail: TmdbDetail;
}

type JsonRecord = Record<string, unknown>;

interface ParsedWorkbook {
  sheets: Record<string, JsonRecord[]>;
}

export async function runNetflixBulkImport(options: CliOptions): Promise<ImportReport> {
  loadEnvFile();

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL/EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const userId = await resolveTargetUserId(supabase, options);
  const workbook = parseWorksWorkbook(readFileSync(options.file));
  const allRows = normalizeWorkRows(workbook.sheets[SHEET_NAME] ?? []);
  const selectedRows = allRows.filter((row) => row.importSelected).slice(0, options.limit);
  const contents = await fetchAllContents(supabase);
  const cache = new ImportCache(options.cacheDir);
  const tmdb = new TmdbClient(cache);
  const rows: RowResult[] = [];
  const summary: Summary = {
    total_rows: allRows.length,
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
    skipped: allRows.length - selectedRows.length,
    failed: 0
  };

  for (const row of selectedRows) {
    try {
      const result = await processRow({
        row,
        contents,
        supabase,
        userId,
        tmdb,
        options
      });
      rows.push(result.rowResult);
      addSummary(summary, result.summaryPatch);
    } catch (error) {
      summary.failed += 1;
      rows.push({
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
  await cache.save();

  const outputPath = writeResultCsv(rows, options);
  return { summary, rows, outputPath };
}

async function processRow({
  row,
  contents,
  supabase,
  userId,
  tmdb,
  options
}: {
  row: WorkRow;
  contents: ContentRecord[];
  supabase: SupabaseClient;
  userId: string;
  tmdb: TmdbClient;
  options: CliOptions;
}): Promise<{ rowResult: RowResult; summaryPatch: Partial<Summary> }> {
  const base: RowResult = {
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

  const providedContent = row.existingAppContentId
    ? contents.find((content) => content.id === row.existingAppContentId)
    : undefined;

  if (providedContent) {
    const statusResult = await maybeUpsertCompletedStatus(supabase, {
      commit: options.commit,
      userId,
      contentId: providedContent.id
    });
    return {
      rowResult: {
        ...base,
        existing_app_content_id: providedContent.id,
        duplicate_check_result: "provided_existing_app_content_id",
        import_result: options.commit ? "duplicate_existing_updated" : "dry_run_existing_status_update",
        status_result: statusResult
      },
      summaryPatch: {
        existing_app_matches: 1,
        status_to_update: 1,
        status_updated: options.commit ? 1 : 0
      }
    };
  }

  const existingBeforeTmdb = findExistingContentForRow(row, contents);
  if (existingBeforeTmdb.status === "ambiguous") {
    return {
      rowResult: {
        ...base,
        duplicate_check_result: "ambiguous_existing_match",
        import_result: "manual_review",
        status_result: "skipped_manual_review",
        failure_reason: existingBeforeTmdb.reason
      },
      summaryPatch: { manual_review_required: 1 }
    };
  }

  if (existingBeforeTmdb.status === "matched" && existingBeforeTmdb.content) {
    const statusResult = await maybeUpsertCompletedStatus(supabase, {
      commit: options.commit,
      userId,
      contentId: existingBeforeTmdb.content.id
    });
    return {
      rowResult: {
        ...base,
        existing_app_content_id: existingBeforeTmdb.content.id,
        duplicate_check_result: "existing_app_match",
        import_result: options.commit ? "duplicate_existing_updated" : "dry_run_existing_status_update",
        status_result: statusResult
      },
      summaryPatch: {
        existing_app_matches: 1,
        status_to_update: 1,
        status_updated: options.commit ? 1 : 0
      }
    };
  }

  const tmdbMatch = await resolveTmdbMatch(row, tmdb, options.confidenceThreshold);
  const tmdbPatch: Partial<Summary> = {
    tmdb_cache_hits: tmdbMatch.cacheHit ? 1 : 0
  };

  if (tmdbMatch.status !== "matched" || !tmdbMatch.candidate) {
    return {
      rowResult: {
        ...base,
        duplicate_check_result: "no_existing_match",
        import_result: "manual_review",
        status_result: "skipped_manual_review",
        failure_reason: tmdbMatch.reason
      },
      summaryPatch: { ...tmdbPatch, manual_review_required: 1 }
    };
  }

  const tmdbId = String(tmdbMatch.candidate.id);
  const mediaType = tmdbMatch.candidate.media_type;
  const existingAfterTmdb = findContentByTmdb(contents, tmdbId);

  if (existingAfterTmdb) {
    const statusResult = await maybeUpsertCompletedStatus(supabase, {
      commit: options.commit,
      userId,
      contentId: existingAfterTmdb.id
    });
    return {
      rowResult: {
        ...base,
        existing_app_content_id: existingAfterTmdb.id,
        resolved_tmdb_id: tmdbId,
        resolved_media_type: mediaType,
        duplicate_check_result: "tmdb_existing_match",
        import_result: options.commit ? "tmdb_matched_existing_updated" : "dry_run_tmdb_existing_status_update",
        status_result: statusResult
      },
      summaryPatch: {
        ...tmdbPatch,
        tmdb_matched_existing_content: 1,
        status_to_update: 1,
        status_updated: options.commit ? 1 : 0
      }
    };
  }

  if (!options.commit) {
    return {
      rowResult: {
        ...base,
        resolved_tmdb_id: tmdbId,
        resolved_media_type: mediaType,
        duplicate_check_result: "no_existing_match",
        import_result: "dry_run_new_content_to_create",
        status_result: "would_update_completed"
      },
      summaryPatch: {
        ...tmdbPatch,
        new_content_to_create: 1,
        status_to_update: 1
      }
    };
  }

  const detail = await tmdb.detail(tmdbId, mediaType);
  const content = await createOrUpdateTmdbContent(supabase, tmdbId, mediaType, detail);
  contents.push(content);
  const statusResult = await maybeUpsertCompletedStatus(supabase, {
    commit: true,
    userId,
    contentId: content.id
  });

  return {
    rowResult: {
      ...base,
      existing_app_content_id: content.id,
      resolved_tmdb_id: tmdbId,
      resolved_media_type: mediaType,
      duplicate_check_result: "no_existing_match",
      import_result: "new_content_created",
      status_result: statusResult
    },
    summaryPatch: {
      ...tmdbPatch,
      new_content_to_create: 1,
      new_content_created: 1,
      status_to_update: 1,
      status_updated: 1
    }
  };
}

export function parseWorksWorkbook(buffer: Buffer): ParsedWorkbook {
  const zip = readZip(buffer);
  const workbookXml = zip.get("xl/workbook.xml")?.toString("utf8");
  const relsXml = zip.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!workbookXml || !relsXml) throw new Error("Invalid XLSX: workbook metadata missing");

  const rels = parseWorkbookRels(relsXml);
  const sheets: Record<string, JsonRecord[]> = {};
  const sharedStrings = parseSharedStrings(zip.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
  const sheetRegex = /<(?:\w+:)?sheet\b([^>]*)\/?>/g;
  let match: RegExpExecArray | null;

  while ((match = sheetRegex.exec(workbookXml))) {
    const attrs = parseAttrs(match[1] ?? "");
    const name = attrs.name;
    const relId = attrs["r:id"];
    if (!name || !relId || !rels[relId]) continue;
    const target = rels[relId].startsWith("xl/")
      ? rels[relId]
      : `xl/${rels[relId].replace(/^\/?xl\//, "")}`;
    const sheetXml = zip.get(target)?.toString("utf8");
    if (sheetXml) sheets[name] = parseSheetRows(sheetXml, sharedStrings);
  }

  return { sheets };
}

export function normalizeWorkRows(rows: JsonRecord[]): WorkRow[] {
  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const normalizedTitle = readString(row.normalized_title);
    const titleOverride = nullableString(row.title_override);
    const resolvedTitle = titleOverride ?? normalizedTitle;
    const desiredWatchStatus = normalizeWatchStatus(readString(row.desired_watch_status) || "completed");

    return {
      rowNumber,
      workId: nullableString(row.work_id) ?? String(index + 1),
      importSelected: readBoolean(row.import_selected),
      desiredWatchStatus,
      normalizedTitle,
      titleOverride,
      resolvedTitle,
      tmdbSearchQuery: nullableString(row.tmdb_search_query),
      mediaHint: normalizeMediaHint(row.media_hint),
      viewCount: readInteger(row.view_count, 0),
      firstWatchedDate: normalizeIsoDate(row.first_watched_date),
      lastWatchedDate: normalizeIsoDate(row.last_watched_date),
      needsManualTitleReview: readBoolean(row.needs_manual_title_review),
      reviewFlag: nullableString(row.review_flag),
      sampleTitles: nullableString(row.sample_titles),
      existingAppContentId: nullableString(row.existing_app_content_id),
      tmdbId: nullableString(row.tmdb_id),
      tmdbMediaType: normalizeTmdbMediaType(row.tmdb_media_type)
    };
  });
}

export function findExistingContentForRow(row: WorkRow, contents: ContentRecord[]): ExistingMatch {
  if (row.tmdbId) {
    const tmdbMatch = findContentByTmdb(contents, row.tmdbId);
    if (tmdbMatch) {
      return { status: "matched", content: tmdbMatch, reason: "tmdb_id matched existing content" };
    }
  }

  const titleKeys = rowTitleCandidates(row).map(normalizeTitleForLookup).filter(Boolean);
  if (!titleKeys.length) return { status: "none", reason: "no title candidates" };

  const matches = uniqueById(
    contents.filter((content) => {
      const contentTitleKeys = contentTitleCandidates(content).map(normalizeTitleForLookup).filter(Boolean);
      return titleKeys.some((title) => contentTitleKeys.includes(title));
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
    candidates,
    reason: `multiple existing candidates: ${candidates.map((candidate) => candidate.id).join(", ")}`
  };
}

export function selectBestTmdbCandidate(
  row: WorkRow,
  candidates: TmdbSearchCandidate[],
  confidenceThreshold: number
): TmdbMatch {
  const scored = candidates
    .filter((candidate) => candidate.media_type === "tv" || candidate.media_type === "movie")
    .map((candidate) => ({
      candidate,
      score: scoreTmdbCandidate(row, candidate)
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) {
    return {
      status: "manual_review",
      score: 0,
      secondScore: 0,
      reason: "no TMDB movie/tv candidates",
      cacheHit: false
    };
  }

  const secondScore = scored[1]?.score ?? 0;
  const confident = best.score >= confidenceThreshold && best.score - secondScore >= 10;
  if (!confident) {
    return {
      status: "manual_review",
      score: best.score,
      secondScore,
      reason: `low or ambiguous TMDB confidence: best=${best.score}, second=${secondScore}`,
      cacheHit: false
    };
  }

  return {
    status: "matched",
    candidate: best.candidate,
    score: best.score,
    secondScore,
    reason: "confident TMDB match",
    cacheHit: false
  };
}

async function resolveTmdbMatch(row: WorkRow, tmdb: TmdbClient, confidenceThreshold: number): Promise<TmdbMatch> {
  if (row.tmdbId && row.tmdbMediaType) {
    return {
      status: "matched",
      candidate: {
        id: Number(row.tmdbId),
        media_type: row.tmdbMediaType
      },
      score: 100,
      secondScore: 0,
      reason: "provided tmdb_id/tmdb_media_type",
      cacheHit: true
    };
  }

  const query = row.tmdbSearchQuery ?? row.resolvedTitle;
  const search = await tmdb.search(query, row.mediaHint);
  const match = selectBestTmdbCandidate(row, search.results, confidenceThreshold);
  return { ...match, cacheHit: search.cacheHit };
}

async function maybeUpsertCompletedStatus(
  supabase: SupabaseClient,
  params: {
    commit: boolean;
    userId: string;
    contentId: string;
  }
): Promise<string> {
  if (!params.commit) return "would_update_completed";

  const { data: existing, error: lookupError } = await supabase
    .from("user_library_items")
    .select("id,user_id,content_id,status,status_flags,watch_count")
    .eq("user_id", params.userId)
    .eq("content_id", params.contentId)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  const existingRow = existing as LibraryRecord | null;
  const nextFlags = completedStatusFlags(existingRow?.status_flags ?? (existingRow ? [existingRow.status] : []));
  const watchCount = Math.max(1, existingRow?.watch_count ?? 0);

  if (existingRow) {
    const { error } = await supabase
      .from("user_library_items")
      .update({
        status: "completed",
        status_flags: nextFlags,
        watch_count: watchCount
      })
      .eq("id", existingRow.id);
    if (error) throw new Error(error.message);
    return "updated_completed";
  }

  const { error } = await supabase.from("user_library_items").insert({
    user_id: params.userId,
    content_id: params.contentId,
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

async function createOrUpdateTmdbContent(
  supabase: SupabaseClient,
  tmdbId: string,
  mediaType: TmdbMediaType,
  detail: TmdbDetail
): Promise<ContentRecord> {
  const isMovie = mediaType === "movie";
  const contentType = isMovie ? "movie" : inferTmdbTvContentType(detail);
  const titlePrimary = (isMovie ? detail.title : detail.name)?.trim() || "제목 없음";
  const titleOriginal = ((isMovie ? detail.original_title : detail.original_name) ?? null)?.trim() || null;

  const { data, error } = await supabase
    .from("contents")
    .upsert(
      {
        content_type: contentType,
        source_api: "tmdb",
        source_id: tmdbId,
        title_primary: titlePrimary,
        title_original: titleOriginal,
        poster_url: detail.poster_path ? `${TMDB_IMAGE_BASE}${detail.poster_path}` : null,
        overview: cleanText(detail.overview),
        air_year: yearFromDate(isMovie ? detail.release_date : detail.first_air_date)
      },
      { onConflict: "source_api,source_id" }
    )
    .select("id,content_type,source_api,source_id,title_primary,title_original,air_year")
    .single();

  if (error || !data) throw new Error(error?.message ?? "content upsert failed");

  const content = data as ContentRecord;

  const { error: externalError } = await supabase.from("content_external_ids").upsert(
    {
      content_id: content.id,
      api_source: "tmdb",
      external_id: tmdbId
    },
    { onConflict: "api_source,external_id", ignoreDuplicates: true }
  );
  if (externalError) throw new Error(externalError.message);

  await upsertGenres(supabase, content.id, (detail.genres ?? []).map((genre) => genre.name ?? ""));
  return content;
}

async function upsertGenres(supabase: SupabaseClient, contentId: string, genreNames: string[]): Promise<void> {
  const names = Array.from(new Set(genreNames.map((name) => name.trim()).filter(Boolean)));
  if (!names.length) return;

  const { data: genres, error: genreError } = await supabase
    .from("genres")
    .upsert(names.map((name) => ({ name })), { onConflict: "name" })
    .select("id,name");
  if (genreError || !genres) throw new Error(genreError?.message ?? "genre upsert failed");

  const { error: joinError } = await supabase
    .from("content_genres")
    .upsert(
      genres.map((genre) => ({
        content_id: contentId,
        genre_id: genre.id
      })),
      { onConflict: "content_id,genre_id", ignoreDuplicates: true }
    );
  if (joinError) throw new Error(joinError.message);
}

async function fetchAllContents(supabase: SupabaseClient): Promise<ContentRecord[]> {
  const rows: ContentRecord[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
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

async function resolveTargetUserId(supabase: SupabaseClient, options: CliOptions): Promise<string> {
  if (options.userId) return options.userId;

  const envUserId = process.env.BULK_IMPORT_USER_ID;
  if (envUserId) return envUserId;

  const userEmail = options.userEmail ?? process.env.BULK_IMPORT_USER_EMAIL;
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);

  if (userEmail) {
    const user = data.users.find((candidate) => candidate.email?.toLocaleLowerCase() === userEmail.toLocaleLowerCase());
    if (!user) throw new Error(`No auth user found for email ${userEmail}`);
    return user.id;
  }

  if (data.users.length === 1 && data.users[0]) return data.users[0].id;

  throw new Error("Target user is ambiguous. Pass --user-id, --user-email, BULK_IMPORT_USER_ID, or BULK_IMPORT_USER_EMAIL.");
}

export class ImportCache {
  private searchCache: Record<string, TmdbSearchCacheEntry>;
  private detailCache: Record<string, TmdbDetailCacheEntry>;

  constructor(private readonly cacheDir: string) {
    this.searchCache = readJsonFile<Record<string, TmdbSearchCacheEntry>>(this.searchPath, {});
    this.detailCache = readJsonFile<Record<string, TmdbDetailCacheEntry>>(this.detailPath, {});
  }

  get searchPath(): string {
    return resolve(this.cacheDir, "tmdb-search-cache.json");
  }

  get detailPath(): string {
    return resolve(this.cacheDir, "tmdb-detail-cache.json");
  }

  getSearch(key: string): TmdbSearchCacheEntry | undefined {
    return this.searchCache[key];
  }

  setSearch(key: string, entry: TmdbSearchCacheEntry): void {
    this.searchCache[key] = entry;
  }

  getDetail(key: string): TmdbDetailCacheEntry | undefined {
    return this.detailCache[key];
  }

  setDetail(key: string, entry: TmdbDetailCacheEntry): void {
    this.detailCache[key] = entry;
  }

  async save(): Promise<void> {
    writeJsonFile(this.searchPath, this.searchCache);
    writeJsonFile(this.detailPath, this.detailCache);
  }
}

export class TmdbClient {
  apiCalls = 0;
  private lastRequestAt = 0;

  constructor(private readonly cache: ImportCache) {}

  async search(query: string, mediaHint: MediaHint): Promise<{ results: TmdbSearchCandidate[]; cacheHit: boolean }> {
    const key = `${mediaHint}:${normalizeTitleForLookup(query)}`;
    const cached = this.cache.getSearch(key);
    if (cached) return { results: cached.results, cacheHit: true };

    const endpoint =
      mediaHint === "movie"
        ? "search/movie"
        : mediaHint === "tv"
          ? "search/tv"
          : "search/multi";
    const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
    url.searchParams.set("query", query);
    url.searchParams.set("language", TMDB_LANGUAGE);
    url.searchParams.set("region", TMDB_REGION);
    url.searchParams.set("include_adult", "false");

    const payload = await this.fetchJson<{ results?: TmdbSearchCandidate[] }>(url);
    const results = (payload.results ?? [])
      .filter((result) => {
        if (mediaHint === "movie") result.media_type = "movie";
        if (mediaHint === "tv") result.media_type = "tv";
        return result.media_type === "movie" || result.media_type === "tv";
      })
      .slice(0, 10);

    this.cache.setSearch(key, { results });
    return { results, cacheHit: false };
  }

  async detail(tmdbId: string, mediaType: TmdbMediaType): Promise<TmdbDetail> {
    const key = `${mediaType}:${tmdbId}`;
    const cached = this.cache.getDetail(key);
    if (cached) return cached.detail;

    const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}`);
    url.searchParams.set("language", TMDB_LANGUAGE);
    const detail = await this.fetchJson<TmdbDetail>(url);
    this.cache.setDetail(key, { detail });
    return detail;
  }

  private async fetchJson<T>(url: URL, attempt = 0): Promise<T> {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error("TMDB_API_KEY is required for TMDB matching");

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

    if (!response.ok) {
      throw new Error(`TMDB request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const waitMs = Math.max(0, 250 - elapsed);
    if (waitMs > 0) await sleep(waitMs);
    this.lastRequestAt = Date.now();
  }
}

export function scoreTmdbCandidate(row: WorkRow, candidate: TmdbSearchCandidate): number {
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

  const popularityScore = Math.min(6, Math.max(0, candidate.popularity ?? 0) / 20);
  const score = titleScore + mediaScore + popularityScore;
  return Math.round(score);
}

function rowTitleCandidates(row: WorkRow): string[] {
  return uniqueStrings([
    row.titleOverride,
    row.normalizedTitle,
    row.resolvedTitle,
    row.tmdbSearchQuery
  ]);
}

function contentTitleCandidates(content: ContentRecord): string[] {
  return uniqueStrings([
    content.title_primary,
    content.title_original,
    ...(content.content_titles ?? []).map((title) => title.title)
  ]);
}

function tmdbCandidateTitles(candidate: TmdbSearchCandidate): string[] {
  return uniqueStrings([
    candidate.title,
    candidate.name,
    candidate.original_title,
    candidate.original_name
  ]);
}

function findContentByTmdb(contents: ContentRecord[], tmdbId: string): ContentRecord | undefined {
  return contents.find((content) => {
    if (content.source_api === "tmdb" && content.source_id === tmdbId) return true;
    return content.content_external_ids?.some(
      (externalId) => externalId.api_source === "tmdb" && externalId.external_id === tmdbId
    );
  });
}

function filterByMediaHint(contents: ContentRecord[], mediaHint: MediaHint): ContentRecord[] {
  if (mediaHint === "unknown") return contents;
  if (mediaHint === "movie") return contents.filter((content) => content.content_type === "movie");
  return contents.filter((content) => content.content_type !== "movie");
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function completedStatusFlags(existingFlags: WatchStatus[]): WatchStatus[] {
  const preserved = existingFlags.filter((status) => status === "recommended" || status === "not_recommended");
  return Array.from(new Set<WatchStatus>(["completed", ...preserved])).filter((status) =>
    WATCH_STATUS_OPTIONS.includes(status)
  );
}

function inferTmdbTvContentType(detail: TmdbDetail): ContentType {
  if (detail.genres?.some((genre) => genre.id === 16 || /animation|애니메이션/i.test(genre.name ?? ""))) return "anime";
  if (detail.origin_country?.includes("KR")) return "kdrama";
  if (detail.origin_country?.includes("JP")) return "jdrama";
  return "other";
}

function normalizeWatchStatus(value: string): WatchStatus {
  return value === "completed" || value === "watched" || value === "시청완료" ? "completed" : "completed";
}

function normalizeMediaHint(value: unknown): MediaHint {
  const normalized = readString(value).toLocaleLowerCase();
  if (normalized === "tv" || normalized === "show" || normalized === "series") return "tv";
  if (normalized === "movie" || normalized === "film") return "movie";
  return "unknown";
}

function normalizeTmdbMediaType(value: unknown): TmdbMediaType | null {
  const normalized = readString(value).toLocaleLowerCase();
  if (normalized === "tv" || normalized === "movie") return normalized;
  return null;
}

function normalizeTitleExact(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().toLocaleLowerCase();
}

function normalizeTitleForLookup(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return text || null;
}

function yearFromDate(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 4) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function parseSheetRows(sheetXml: string, sharedStrings: string[]): JsonRecord[] {
  const rows: string[][] = [];
  const rowRegex = /<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(sheetXml))) {
    const cells: string[] = [];
    const cellRegex = /<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1] ?? ""))) {
      const attrs = parseAttrs(cellMatch[1] ?? "");
      const col = columnIndexFromCellRef(attrs.r);
      cells[col] = parseCellValue(cellMatch[2] ?? "", attrs, sharedStrings);
    }
    rows.push(cells);
  }

  const headers = (rows[0] ?? []).map((header) => normalizeHeader(header));
  return rows.slice(1).map((row) => {
    const object: JsonRecord = {};
    headers.forEach((header, index) => {
      if (header) object[header] = row[index] ?? "";
    });
    return object;
  });
}

function parseCellValue(xml: string, attrs: Record<string, string>, sharedStrings: string[]): string {
  if (attrs.t === "s") {
    const index = Number(xml.match(/<(?:\w+:)?v[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1] ?? "");
    return sharedStrings[index] ?? "";
  }
  if (attrs.t === "inlineStr") return xmlText(xml);
  const value = xml.match(/<(?:\w+:)?v[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
  return decodeXml(value ?? xmlText(xml));
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  const siRegex = /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g;
  let match: RegExpExecArray | null;
  while ((match = siRegex.exec(xml))) {
    strings.push(xmlText(match[1] ?? ""));
  }
  return strings;
}

function parseWorkbookRels(xml: string): Record<string, string> {
  const rels: Record<string, string> = {};
  const relRegex = /<Relationship\b([^>]*)\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = relRegex.exec(xml))) {
    const attrs = parseAttrs(match[1] ?? "");
    if (attrs.Id && attrs.Target) rels[attrs.Id] = attrs.Target;
  }
  return rels;
}

function parseAttrs(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([:\w-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(input))) {
    if (match[1]) attrs[match[1]] = decodeXml(match[2] ?? "");
  }
  return attrs;
}

function xmlText(xml: string): string {
  const text = Array.from(xml.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)).map((match) => match[1] ?? "").join("");
  return decodeXml(text || xml.replace(/<[^>]+>/g, ""));
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/\s+/g, "_").toLocaleLowerCase();
}

function columnIndexFromCellRef(ref: string | undefined): number {
  const letters = (ref ?? "A").match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64;
  }
  return Math.max(0, index - 1);
}

function readZip(buffer: Buffer): Map<string, Buffer> {
  const eocdOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset < 0) throw new Error("Invalid XLSX: ZIP end record missing");

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const files = new Map<string, Buffer>();
  let offset = centralDirOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid XLSX: central directory corrupt");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (data) files.set(fileName, data);

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

export function createStoredZipForTest(files: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const compressed = deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + compressed.length;
  }

  const centralDirOffset = offset;
  const centralDir = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(centralDirOffset, 16);
  return Buffer.concat([...localParts, centralDir, end]);
}

function readString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function nullableString(value: unknown): string | null {
  const text = readString(value);
  if (!text || text.toLocaleLowerCase() === "pending") return null;
  return text;
}

function readBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const text = readString(value).toLocaleLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "y";
}

function readInteger(value: unknown, fallback: number): number {
  const number = Number.parseInt(readString(value), 10);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeIsoDate(value: unknown): string | null {
  const text = nullableString(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 0) {
    const date = new Date(Date.UTC(1899, 11, 30 + serial));
    return date.toISOString().slice(0, 10);
  }
  return text;
}

function addSummary(summary: Summary, patch: Partial<Summary>): void {
  for (const [key, value] of Object.entries(patch) as [keyof Summary, number][]) {
    summary[key] += value;
  }
}

function writeResultCsv(rows: RowResult[], options: CliOptions): string {
  const outputPath =
    options.output ??
    resolve(
      "docs/import-results",
      `netflix_tmdb_bulk_${options.commit ? "commit" : "dry_run"}_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`
    );
  mkdirSync(dirname(outputPath), { recursive: true });

  const headers: (keyof RowResult)[] = [
    "work_id",
    "row_number",
    "normalized_title",
    "resolved_title",
    "existing_app_content_id",
    "resolved_tmdb_id",
    "resolved_media_type",
    "duplicate_check_result",
    "import_result",
    "status_result",
    "failure_reason"
  ];
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");

  writeFileSync(outputPath, csv);
  return outputPath;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function readJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function looksLikeJwt(value: string): boolean {
  return value.startsWith("eyJ") || value.split(".").length === 3;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function loadEnvFile(): void {
  const path = resolve(".env");
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    file: resolve(DEFAULT_FILE),
    commit: false,
    cacheDir: resolve(CACHE_DIR),
    confidenceThreshold: 65
  };

  for (const arg of argv) {
    if (arg === "--commit") {
      options.commit = true;
    } else if (arg.startsWith("--file=")) {
      options.file = resolve(arg.slice("--file=".length));
    } else if (arg.startsWith("--user-id=")) {
      options.userId = arg.slice("--user-id=".length);
    } else if (arg.startsWith("--user-email=")) {
      options.userEmail = arg.slice("--user-email=".length);
    } else if (arg.startsWith("--output=")) {
      options.output = resolve(arg.slice("--output=".length));
    } else if (arg.startsWith("--cache-dir=")) {
      options.cacheDir = resolve(arg.slice("--cache-dir=".length));
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number.parseInt(arg.slice("--limit=".length), 10);
    } else if (arg.startsWith("--confidence=")) {
      options.confidenceThreshold = Number.parseInt(arg.slice("--confidence=".length), 10);
    }
  }

  return options;
}

function printReport(report: ImportReport, options: CliOptions): void {
  console.log(JSON.stringify({ mode: options.commit ? "commit" : "dry-run", ...report.summary, output_path: report.outputPath }, null, 2));
  const manualRows = report.rows.filter((row) => row.import_result === "manual_review" || row.import_result === "failed");
  if (manualRows.length) {
    console.log("\nmanual_review_or_failed:");
    for (const row of manualRows.slice(0, 50)) {
      console.log(`- row ${row.row_number} ${row.resolved_title}: ${row.failure_reason}`);
    }
    if (manualRows.length > 50) console.log(`...and ${manualRows.length - 50} more`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = await runNetflixBulkImport(options);
  printReport(report, options);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
