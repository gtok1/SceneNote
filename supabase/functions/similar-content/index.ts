import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  rankSimilarWorks,
  type SimilarityFocus,
  type SimilaritySort,
  type SimilarityWork
} from "../_shared/similarityEngine.ts";
import {
  createPersonalSimilarityScope,
  createSimilarityScope,
  createSimilaritySnapshot,
  decodeSimilarityCursor,
  pageSimilaritySnapshot,
  projectSimilaritySnapshot,
  SIMILARITY_PAGINATION_VERSION,
  SimilarContentPagingError,
  type SimilaritySnapshot,
  validateSimilarityLimit
} from "../_shared/similarContentPaging.ts";
import {
  filterUnregisteredSimilarWorks,
  similarityLibrarySignature,
  type SimilarityLibraryEntry
} from "../_shared/similarityLibrary.ts";
import { createAdminClient } from "../_shared/supabase.ts";

type Target = "all" | "anime" | "drama" | "movie";
type Modifier = { key: string; direction: string };
interface SimilarRequest {
  anchor: SimilarityWork & { season_number?: number | null };
  target_media_type?: Target;
  focus?: SimilarityFocus;
  sort?: SimilaritySort;
  limit?: number;
  cursor?: string | null;
  pagination_version?: typeof SIMILARITY_PAGINATION_VERSION;
  filters?: { modifiers?: Modifier[] };
}
type Snapshot = SimilaritySnapshot<ReturnType<typeof rankSimilarWorks>[number], SimilarityWork>;
interface Collection {
  anchor: SimilarityWork;
  candidates: SimilarityWork[];
  warnings: string[];
}
const RANKING_VERSION = "hybrid-v3-personal-evidence";
const LIBRARY_PAGE_SIZE = 1_000;
const MAX_LIBRARY_PAGES = 10_000;
let lastSnapshotCleanupAt = 0;
const PARTIAL_WARNING = "일부 제공처에 연결하지 못해 불러온 작품을 표시하고 있어요.";
const ANILIST_FIELDS = `id title{romaji english native} coverImage{large} description(asHtml:false) startDate{year month day} episodes format genres tags{name rank} studios{nodes{name}} averageScore popularity`;
const ANILIST_GENRES = new Set([
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller"
]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const TMDB_GENRES = new Map<number, string>([
  [12, "Adventure"],
  [14, "Fantasy"],
  [16, "Animation"],
  [18, "Drama"],
  [27, "Horror"],
  [28, "Action"],
  [35, "Comedy"],
  [53, "Thriller"],
  [80, "Crime"],
  [878, "Science Fiction"],
  [9648, "Mystery"],
  [10749, "Romance"],
  [10751, "Family"],
  [10752, "War"],
  [10759, "Action & Adventure"],
  [10765, "Sci-Fi & Fantasy"]
]);

Deno.serve(async (req: Request) => {
  const requestStarted = Date.now();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")
    return json({ error: "METHOD_NOT_ALLOWED", message: "POST method required" }, 405);
  const auth = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!auth?.startsWith("Bearer ") || !url || !anon)
    return json({ error: "UNAUTHORIZED", message: "Valid JWT required" }, 401);
  const client = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const {
    data: { user },
    error: authError
  } = await client.auth.getUser();
  if (authError || !user)
    return json({ error: "UNAUTHORIZED", message: "다시 로그인해 주세요." }, 401);
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw invalidRequest("검색 요청을 확인해 주세요.");
    }
    const body = validateRequest(raw);
    const focus = body.focus ?? "balanced",
      sort = body.sort ?? "similarity",
      target = body.target_media_type ?? "all";
    const limit = validateSimilarityLimit(body.limit),
      modifiers = body.filters?.modifiers ?? [];
    const publicScope = await createSimilarityScope({
      anchor: body.anchor,
      target,
      focus,
      sort,
      modifiers,
      limit,
      responseVersion: body.pagination_version
    });
    const library = await readCompleteLibrary(client, user.id);
    const responseScope = await createPersonalSimilarityScope(
      publicScope,
      user.id,
      similarityLibrarySignature(library)
    );
    const cursor = decodeSimilarityCursor(body.cursor);
    if (cursor) {
      if (cursor.scope !== responseScope) throw restartRequired();
      const snapshot = await readSnapshot(cursor.snapshot, body.anchor.external_source);
      // Validate the cached public pool before creating the in-memory user view.
      pageSimilaritySnapshot(snapshot, publicScope, limit);
      if (!snapshot) throw restartRequired();
      const projection = projectSimilaritySnapshot(
        snapshot,
        responseScope,
        filterUnregisteredSimilarWorks(snapshot.items, library)
      );
      return json({
        mode: "similarity",
        ...pageSimilaritySnapshot(projection, responseScope, limit, body.cursor),
        pagination_version: body.pagination_version ?? "similarity-snapshot-v1",
        ranking_version: RANKING_VERSION
      });
    }
    const deadline = requestStarted + 10_000;
    const collected = await collectCandidates(body.anchor, target, deadline);
    if (body.anchor.season_number !== undefined)
      collected.anchor.season_number = body.anchor.season_number;
    const candidates = applyModifiers(
      collected.candidates.filter(
        (item) => matchesTarget(item, target) && (sort !== "latest" || hasStarted(item))
      ),
      modifiers
    );
    // Collect and sort the entire bounded pool before slicing so every page
    // preserves the same dates, duplicate decisions, and diversity limits.
    const ranked = rankSimilarWorks(collected.anchor, candidates, focus, sort);
    const snapshot = createSimilaritySnapshot({
      id: crypto.randomUUID(),
      scope: publicScope,
      anchor: collected.anchor,
      items: ranked,
      warnings: [...new Set(collected.warnings)]
    });
    if (ranked.length > limit) await writeSnapshot(snapshot, body.anchor.external_source);
    const projection = projectSimilaritySnapshot(
      snapshot,
      responseScope,
      filterUnregisteredSimilarWorks(snapshot.items, library)
    );
    return json({
      mode: "similarity",
      ...pageSimilaritySnapshot(projection, responseScope, limit),
      pagination_version: body.pagination_version ?? "similarity-snapshot-v1",
      ranking_version: RANKING_VERSION
    });
  } catch (error) {
    if (error instanceof SimilarContentPagingError)
      return json({ error: error.code, message: error.message }, error.status);
    console.error(
      "similar-content provider request failed",
      error instanceof Error ? error.message : "Unknown provider failure"
    );
    return json(
      {
        error: "SIMILARITY_PROVIDER_FAILED",
        message: "비슷한 작품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
      },
      503
    );
  }
});

function validateRequest(value: unknown): SimilarRequest {
  if (!isRecord(value) || !isRecord(value.anchor))
    throw invalidRequest("기준 작품을 선택해 주세요.");
  const anchor = value.anchor;
  if (
    !isOneOf(anchor.external_source, ["tmdb", "anilist"]) ||
    typeof anchor.external_id !== "string" ||
    !/^[1-9]\d{0,10}$/.test(anchor.external_id) ||
    typeof anchor.title_primary !== "string" ||
    !anchor.title_primary.trim() ||
    anchor.title_primary.length > 500 ||
    !isOneOf(anchor.content_type, ["anime", "kdrama", "jdrama", "movie", "other"]) ||
    (anchor.season_number !== undefined &&
      anchor.season_number !== null &&
      (typeof anchor.season_number !== "number" ||
        !Number.isSafeInteger(anchor.season_number) ||
        anchor.season_number < 0))
  )
    throw invalidRequest("기준 작품 정보가 올바르지 않아요.");
  if (
    value.focus !== undefined &&
    !isOneOf(value.focus, [
      "balanced",
      "mood",
      "story",
      "setting",
      "relationship",
      "genre",
      "character"
    ])
  )
    throw invalidRequest("검색 기준을 확인해 주세요.");
  if (value.sort !== undefined && !isOneOf(value.sort, ["similarity", "latest", "popular"]))
    throw invalidRequest("정렬 기준을 확인해 주세요.");
  if (value.pagination_version !== undefined && value.pagination_version !== SIMILARITY_PAGINATION_VERSION)
    throw invalidRequest("이어 찾기 요청을 확인해 주세요.");
  if (
    value.target_media_type !== undefined &&
    !isOneOf(value.target_media_type, ["all", "anime", "drama", "movie"])
  )
    throw invalidRequest("작품 유형을 확인해 주세요.");
  validateSimilarityLimit(value.limit);
  decodeSimilarityCursor(value.cursor);
  if (value.filters !== undefined) {
    if (!isRecord(value.filters)) throw invalidRequest("검색 조건을 확인해 주세요.");
    const modifiers = value.filters.modifiers;
    if (
      modifiers !== undefined &&
      (!Array.isArray(modifiers) ||
        modifiers.length > 10 ||
        modifiers.some(
          (item) =>
            !isRecord(item) ||
            !isOneOf(item.key, [
              "romance",
              "comedy",
              "violence",
              "school",
              "short",
              "completed",
              "korean"
            ]) ||
            !isOneOf(item.direction, ["include", "exclude"])
        ))
    )
      throw invalidRequest("검색 조건을 확인해 주세요.");
  }
  return value as unknown as SimilarRequest;
}

interface RawLibraryContent extends Omit<SimilarityLibraryEntry, "external_ids" | "titles" | "season_number"> {
  content_external_ids?: SimilarityLibraryEntry["external_ids"];
  content_titles?: { title?: string | null }[] | null;
}
interface RawLibraryRow {
  season_number: number | null;
  contents: RawLibraryContent | RawLibraryContent[] | null;
}

async function readCompleteLibrary(
  client: ReturnType<typeof createClient<any>>,
  userId: string
): Promise<SimilarityLibraryEntry[]> {
  const library: SimilarityLibraryEntry[] = [];
  let offset = 0;
  let total: number | null = null;
  try {
    for (let page = 0; page < MAX_LIBRARY_PAGES; page += 1) {
      // The authenticated client and explicit owner filter retain RLS. The
      // service-role cache client must never read this private relation.
      const { data, count, error } = await client
        .from("user_library_items")
        .select(
          "id,season_number,contents(content_type,source_api,source_id,title_primary,title_original,air_year,air_date,content_external_ids(api_source,external_id),content_titles(title))",
          page === 0 ? { count: "exact" } : undefined
        )
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(offset, offset + LIBRARY_PAGE_SIZE - 1)
        .abortSignal(AbortSignal.timeout(2_000));
      if (error || !Array.isArray(data)) throw error ?? new Error("Library response unavailable");
      if (page === 0 && typeof count === "number") total = count;
      for (const row of data as unknown as RawLibraryRow[]) {
        const content = Array.isArray(row.contents) ? row.contents[0] : row.contents;
        if (!content) throw new Error("Library content unavailable");
        library.push({
          content_type: content.content_type,
          source_api: content.source_api,
          source_id: content.source_id,
          title_primary: content.title_primary,
          title_original: content.title_original,
          air_year: content.air_year,
          air_date: content.air_date,
          season_number: row.season_number,
          external_ids: content.content_external_ids ?? [],
          titles: (content.content_titles ?? []).map((item) => item.title).filter((title): title is string => typeof title === "string")
        });
      }
      offset += data.length;
      if (total !== null ? offset >= total : data.length < LIBRARY_PAGE_SIZE) return library;
      if (data.length === 0) throw new Error("Library response incomplete");
    }
    throw new Error("Library pagination safety limit exceeded");
  } catch {
    throw new SimilarContentPagingError(
      503,
      "SIMILARITY_LIBRARY_UNAVAILABLE",
      "내 목록을 확인하지 못했어요. 잠시 후 다시 시도해 주세요."
    );
  }
}

// Public search metadata only: no user ID, library, token, or private feed.
async function writeSnapshot(snapshot: Snapshot, source: string): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("external_search_cache")
      .upsert(
        {
          query_hash: snapshotKey(snapshot.id),
          query_text: "similarity public result snapshot",
          source,
          response_json: snapshot,
          expires_at: snapshot.expires_at
        },
        { onConflict: "query_hash,source" }
      )
      .abortSignal(AbortSignal.timeout(2_000));
    if (error) throw error;
  } catch {
    throw new SimilarContentPagingError(
      503,
      "SIMILARITY_CACHE_UNAVAILABLE",
      "이어 찾기를 준비하지 못했어요. 잠시 후 다시 시도해 주세요."
    );
  }
  await cleanupExpiredSnapshots();
}
async function cleanupExpiredSnapshots(): Promise<void> {
  const now = Date.now();
  if (now - lastSnapshotCleanupAt < 15 * 60_000) return;
  lastSnapshotCleanupAt = now;
  try {
    // Only expired public similarity snapshots, never other provider caches.
    await createAdminClient()
      .from("external_search_cache")
      .delete()
      .like("query_hash", "similarity:snapshot:v2:%")
      .lt("expires_at", new Date(now).toISOString())
      .abortSignal(AbortSignal.timeout(500));
  } catch {
    /* Cleanup cannot invalidate a successfully persisted cursor. */
  }
}
async function readSnapshot(id: string, source: string): Promise<Snapshot | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("external_search_cache")
      .select("response_json,expires_at")
      .eq("query_hash", snapshotKey(id))
      .eq("source", source)
      .gt("expires_at", new Date().toISOString())
      .abortSignal(AbortSignal.timeout(2_000))
      .maybeSingle();
    if (error) throw error;
    return data && isRecord(data.response_json) && isRecord(data.response_json.anchor)
      ? (data.response_json as unknown as Snapshot)
      : null;
  } catch {
    throw new SimilarContentPagingError(
      503,
      "SIMILARITY_CACHE_UNAVAILABLE",
      "이어 찾기 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
    );
  }
}
function snapshotKey(id: string): string {
  return `similarity:snapshot:v2:${id}`;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isOneOf(value: unknown, choices: readonly string[]): value is string {
  return typeof value === "string" && choices.includes(value);
}
function invalidRequest(message: string) {
  return new SimilarContentPagingError(400, "INVALID_REQUEST", message);
}
function restartRequired() {
  return new SimilarContentPagingError(
    409,
    "SIMILARITY_RESTART_REQUIRED",
    "검색 조건이 바뀌었어요. 처음부터 다시 찾아 주세요."
  );
}

async function collectCandidates(
  input: SimilarityWork,
  target: Target,
  deadline: number
): Promise<Collection> {
  try {
    return input.external_source === "tmdb"
      ? await collectTmdb(input, target, deadline)
      : await collectAniList(input, target, deadline);
  } catch {
    const key = Deno.env.get("TMDB_API_KEY");
    const match =
      input.external_source === "anilist" && key
        ? await findTmdbAnchor(input, key, deadline)
        : input.external_source === "tmdb" && input.content_type === "anime"
          ? await findAniListAnchor(input, deadline)
          : null;
    if (!match) throw new Error("No verified alternate similarity anchor");
    const fallback =
      match.external_source === "tmdb"
        ? await collectTmdb(match, target, deadline)
        : await collectAniList(match, target, deadline, false);
    return { ...fallback, warnings: [PARTIAL_WARNING, ...fallback.warnings] };
  }
}

async function collectTmdb(
  input: SimilarityWork,
  target: Target,
  deadline: number,
  includeAnimeDiscovery = true
): Promise<Collection> {
  const key = Deno.env.get("TMDB_API_KEY");
  if (!key) throw new Error("TMDB API key unavailable");
  const kind = input.content_type === "movie" ? "movie" : "tv";
  const detail = await tmdbFetch(
    `/${kind}/${input.external_id}`,
    key,
    { append_to_response: "keywords,credits,recommendations,similar", language: "ko-KR" },
    deadline
  );
  const anchor = normalizeTmdb(detail, kind);
  anchor.tags = keywordNames(detail.keywords);
  anchor.people = names(detail.credits?.cast).slice(0, 12);
  anchor.studios = names(detail.production_companies);
  const candidates = tmdbRelated(detail.recommendations?.results, kind, true).concat(
    tmdbRelated(detail.similar?.results, kind, false)
  );
  const jobs: Promise<SimilarityWork[]>[] = [];
  for (const lane of ["recommendations", "similar"] as const) {
    if ((detail[lane]?.total_pages ?? 1) > 1)
      jobs.push(
        tmdbFetch(
          `/${kind}/${input.external_id}/${lane}`,
          key,
          { language: "ko-KR", page: "2" },
          deadline
        ).then((page) => tmdbRelated(page.results, kind, lane === "recommendations"))
      );
  }
  const discoveryTarget =
    target === "all"
      ? anchor.content_type === "anime"
        ? "anime"
        : kind === "movie"
          ? "movie"
          : "drama"
      : target;
  jobs.push(...tmdbDiscoveryJobs(anchor.genres ?? [], discoveryTarget, key, deadline));
  if (
    includeAnimeDiscovery &&
    (target === "anime" || (target === "all" && anchor.content_type === "anime"))
  )
    jobs.push(...aniListDiscoveryJobs(anchor.genres ?? [], deadline));
  const extra = await collectAvailable(jobs);
  candidates.push(...extra.items);
  return { anchor, candidates, warnings: extra.partial ? [PARTIAL_WARNING] : [] };
}

async function collectAniList(
  input: SimilarityWork,
  target: Target,
  deadline: number,
  includeTmdb = true
): Promise<Collection> {
  const payload = await aniListFetch(
    `query($id:Int!){Media(id:$id,type:ANIME){${ANILIST_FIELDS} staff(perPage:12){nodes{name{full}}} recommendations(perPage:50,sort:RATING_DESC){nodes{mediaRecommendation{${ANILIST_FIELDS}}}}}}`,
    { id: Number(input.external_id) },
    deadline
  );
  const media = payload.Media;
  if (!media?.id) throw new Error("AniList anchor unavailable");
  const anchor = normalizeAniList(media);
  anchor.people = (media.staff?.nodes ?? []).map((node: any) => node.name?.full).filter(Boolean);
  const candidates: SimilarityWork[] = (media.recommendations?.nodes ?? [])
    .filter((node: any) => node.mediaRecommendation?.id)
    .map((node: any) => ({
      ...normalizeAniList(node.mediaRecommendation),
      provider_recommended: true
    }));
  const jobs: Promise<SimilarityWork[]>[] = [],
    warnings: string[] = [];
  if (target === "anime" || target === "all")
    jobs.push(...aniListDiscoveryJobs(anchor.genres ?? [], deadline));
  const key = Deno.env.get("TMDB_API_KEY");
  if (key && includeTmdb)
    jobs.push(
      (async () => {
        const match = await findTmdbAnchor(anchor, key, deadline);
        if (!match) return [];
        const alternate = await collectTmdb(match, target, deadline, false);
        anchor.title_primary = alternate.anchor.title_primary;
        if (alternate.anchor.overview) anchor.overview = alternate.anchor.overview;
        warnings.push(...alternate.warnings);
        return alternate.candidates;
      })()
    );
  if (key && (target === "drama" || target === "movie"))
    jobs.push(...tmdbDiscoveryJobs(anchor.genres ?? [], target, key, deadline));
  const extra = await collectAvailable(jobs);
  candidates.push(...extra.items);
  if (extra.partial) warnings.push(PARTIAL_WARNING);
  return { anchor, candidates, warnings };
}

function aniListDiscoveryJobs(genres: string[], deadline: number): Promise<SimilarityWork[]>[] {
  const matching = [
    ...new Set(
      genres
        .map((genre) =>
          genre === "Science Fiction" || genre === "Sci-Fi & Fantasy"
            ? "Sci-Fi"
            : genre === "Action & Adventure"
              ? "Action"
              : genre
        )
        .filter((genre) => ANILIST_GENRES.has(genre))
    )
  ].slice(0, 3);
  if (!matching.length) return [];
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const before = Number(tomorrow.toISOString().slice(0, 10).replace(/-/g, ""));
  return ["POPULARITY_DESC", "START_DATE_DESC"].map((sort) =>
    aniListFetch(
      `query($genres:[String],$before:FuzzyDateInt){Page(page:1,perPage:50){media(type:ANIME,genre_in:$genres,startDate_lesser:$before,sort:${sort}){${ANILIST_FIELDS}}}}`,
      { genres: matching, before },
      deadline
    ).then((payload) =>
      (payload.Page?.media ?? [])
        .filter((item: any) => item?.id)
        .map((item: any) => normalizeAniList(item))
    )
  );
}

function tmdbDiscoveryJobs(
  genres: string[],
  target: Exclude<Target, "all">,
  key: string,
  deadline: number
): Promise<SimilarityWork[]>[] {
  const kind = target === "movie" ? "movie" : "tv";
  const ids = [...TMDB_GENRES].filter(([, name]) => genres.includes(name)).map(([id]) => id);
  // Animation is mandatory; recent discovery must also retain the anchor's
  // specific genres instead of treating all newly aired anime as similar.
  const genreIds =
    target === "anime"
      ? [16, ...ids.filter((id) => id !== 16).slice(0, 2)].join(",")
      : ids
          .filter((id) => id !== 16)
          .slice(0, 3)
          .join("|");
  if (!genreIds) return [];
  const dateField = kind === "movie" ? "primary_release_date" : "first_air_date";
  return ["popularity.desc", `${dateField}.desc`].map((sort) =>
    tmdbFetch(
      `/discover/${kind}`,
      key,
      {
        language: "ko-KR",
        sort_by: sort,
        with_genres: genreIds,
        [`${dateField}.lte`]: today(),
        ...(target === "drama" ? { without_genres: "16" } : {}),
        "vote_count.gte": "5"
      },
      deadline
    ).then((page) => tmdbRelated(page.results, kind, false))
  );
}
async function collectAvailable(
  jobs: Promise<SimilarityWork[]>[]
): Promise<{ items: SimilarityWork[]; partial: boolean }> {
  const results = await Promise.allSettled(jobs);
  return {
    items: results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
    partial: results.some((result) => result.status === "rejected")
  };
}

async function findTmdbAnchor(
  input: SimilarityWork,
  key: string,
  deadline: number
): Promise<SimilarityWork | null> {
  const kind = input.content_type === "movie" ? "movie" : "tv",
    titles = anchorTitles(input);
  const pages = await Promise.allSettled(
    titles.map((query) => tmdbFetch(`/search/${kind}`, key, { language: "ko-KR", query }, deadline))
  );
  for (const page of pages) {
    if (page.status !== "fulfilled") continue;
    for (const item of page.value.results ?? []) {
      const work = normalizeTmdb(item, kind);
      if (
        isVerifiedAnchorMatch(input, work) &&
        (input.content_type !== "anime" || work.content_type === "anime")
      )
        return work;
    }
  }
  return null;
}
async function findAniListAnchor(
  input: SimilarityWork,
  deadline: number
): Promise<SimilarityWork | null> {
  const pages = await Promise.allSettled(
    anchorTitles(input).map((search) =>
      aniListFetch(
        `query($search:String){Page(page:1,perPage:5){media(type:ANIME,search:$search){${ANILIST_FIELDS}}}}`,
        { search },
        deadline
      )
    )
  );
  for (const page of pages) {
    if (page.status !== "fulfilled") continue;
    for (const item of page.value.Page?.media ?? []) {
      const work = normalizeAniList(item);
      if (isVerifiedAnchorMatch(input, work)) return work;
    }
  }
  return null;
}
function anchorTitles(input: SimilarityWork): string[] {
  return [
    ...new Set(
      [input.title_original, input.title_primary].filter(
        (value): value is string => typeof value === "string" && Boolean(value.trim())
      )
    )
  ];
}
function compactTitle(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}
function isVerifiedAnchorMatch(left: SimilarityWork, right: SimilarityWork): boolean {
  return (
    typeof left.air_year === "number" &&
    left.air_year === right.air_year &&
    anchorTitles(left).some((title) =>
      anchorTitles(right).some((other) => compactTitle(title) === compactTitle(other))
    )
  );
}
function tmdbRelated(items: any, kind: "movie" | "tv", recommended: boolean): SimilarityWork[] {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.id)
    .map((item) => ({ ...normalizeTmdb(item, kind), provider_recommended: recommended }));
}

function normalizeTmdb(item: any, kind: "movie" | "tv"): SimilarityWork {
  const date = kind === "movie" ? item.release_date : item.first_air_date,
    countries: string[] = item.origin_country ?? [];
  const ids: number[] = item.genre_ids ?? (item.genres ?? []).map((genre: any) => genre.id);
  return {
    external_source: "tmdb",
    external_id: String(item.id),
    content_type:
      kind === "movie"
        ? "movie"
        : ids.includes(16)
          ? "anime"
          : countries.includes("KR")
            ? "kdrama"
            : countries.includes("JP")
              ? "jdrama"
              : "other",
    title_primary: (kind === "movie" ? item.title : item.name) || "Untitled",
    title_original: (kind === "movie" ? item.original_title : item.original_name) ?? null,
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    overview: clean(item.overview),
    air_year: date ? Number(String(date).slice(0, 4)) : null,
    air_date: date || null,
    has_seasons: kind === "tv",
    episode_count: item.number_of_episodes ?? null,
    genres: [
      ...new Set(
        ids.map((id) => TMDB_GENRES.get(id)).filter((value): value is string => Boolean(value))
      )
    ],
    popularity: item.popularity ?? null,
    vote_count: item.vote_count ?? null,
    studios: names(item.production_companies)
  };
}
function normalizeAniList(item: any): SimilarityWork {
  const title = item.title ?? {},
    d = item.startDate;
  return {
    external_source: "anilist",
    external_id: String(item.id),
    content_type: "anime",
    title_primary: title.english ?? title.romaji ?? title.native ?? "Untitled",
    title_original: title.native ?? null,
    poster_url: item.coverImage?.large ?? null,
    overview: clean(item.description),
    air_year: d?.year ?? null,
    air_date:
      d?.year && d?.month
        ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day ?? 1).padStart(2, "0")}`
        : null,
    has_seasons: item.format !== "MOVIE",
    episode_count: item.episodes ?? null,
    genres: item.genres ?? [],
    tags: (item.tags ?? []).filter((t: any) => (t.rank ?? 0) >= 50).map((t: any) => t.name),
    studios: item.studios?.nodes?.map((n: any) => n.name) ?? [],
    popularity: item.popularity ?? null,
    vote_count: item.averageScore ?? null
  };
}
async function aniListFetch(
  query: string,
  variables: Record<string, unknown>,
  deadline: number
): Promise<any> {
  const response = await fetch(Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "SceneNote/1.0"
    },
    body: JSON.stringify({ query, variables }),
    signal: providerSignal(deadline)
  });
  if (!response.ok) throw new Error(`AniList API error: ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length || !payload.data) throw new Error("AniList response unavailable");
  return payload.data;
}
async function tmdbFetch(
  path: string,
  key: string,
  params: Record<string, string>,
  deadline: number
): Promise<any> {
  const u = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => v && u.searchParams.set(k, v));
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (key.startsWith("eyJ") || key.split(".").length === 3)
    (headers as Record<string, string>).Authorization = `Bearer ${key}`;
  else u.searchParams.set("api_key", key);
  const r = await fetch(u, { headers, signal: providerSignal(deadline) });
  if (!r.ok) throw new Error(`TMDB API error: ${r.status}`);
  return r.json();
}
function providerSignal(deadline: number): AbortSignal {
  return AbortSignal.timeout(Math.max(1, Math.min(4_500, deadline - Date.now())));
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function hasStarted(item: SimilarityWork): boolean {
  return item.air_date
    ? item.air_date <= today()
    : !item.air_year || item.air_year <= new Date().getUTCFullYear();
}
function keywordNames(value: any): string[] {
  return (value?.keywords ?? value?.results ?? []).map((v: any) => v.name).filter(Boolean);
}
function names(value: any): string[] {
  return (value ?? []).map((v: any) => v.name).filter(Boolean);
}
function clean(v: any): string | null {
  return typeof v === "string"
    ? v
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim() || null
    : null;
}
function matchesTarget(item: SimilarityWork, target: string): boolean {
  return target === "all"
    ? true
    : target === "drama"
      ? ["kdrama", "jdrama", "other"].includes(item.content_type)
      : item.content_type === target;
}
function applyModifiers(
  items: SimilarityWork[],
  modifiers: { key?: string; direction?: string }[]
): SimilarityWork[] {
  return items.filter((item) => {
    const features = [...(item.genres ?? []), ...(item.tags ?? [])].map((value) =>
      value.toLowerCase()
    );
    for (const modifier of modifiers) {
      if (modifier.key === "short" && item.episode_count && item.episode_count > 12) return false;
      if (
        modifier.key === "romance" &&
        modifier.direction === "exclude" &&
        features.some((value) => value.includes("romance") || value.includes("로맨스"))
      )
        return false;
      if (
        modifier.key === "violence" &&
        modifier.direction === "exclude" &&
        features.some((value) => /gore|violence|고어|잔혹/.test(value))
      )
        return false;
      if (
        modifier.key === "school" &&
        modifier.direction === "exclude" &&
        features.some((value) => /school|학원|학교/.test(value))
      )
        return false;
      if (
        modifier.key === "comedy" &&
        modifier.direction === "include" &&
        !features.some((value) => value.includes("comedy") || value.includes("코미디"))
      )
        return false;
    }
    return true;
  });
}
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store"
    }
  });
}
