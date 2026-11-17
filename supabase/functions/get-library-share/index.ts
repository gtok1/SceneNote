import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { parseStoredCrew } from "../_shared/contentCrew.ts";
import { LIBRARY_SHARE_QUERY_CHUNK, chunk, selectSharedLibraryRows, sharedSeasonSummary } from "../_shared/libraryShare.ts";
import { readAllRows } from "../_shared/readAllRows.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import type { ContentType, WatchStatus } from "../_shared/types.ts";

interface GetLibraryShareRequest {
  id?: string;
}

interface ShareRow {
  id: string;
  owner_user_id: string;
  title: string;
  filters: Record<string, unknown>;
  content_ids: string[];
  library_item_ids: string[] | null;
  item_count: number;
  created_at: string;
  expires_at: string | null;
}

interface LibraryRow {
  id: string;
  user_id: string;
  content_id: string;
  status: WatchStatus;
  status_flags?: WatchStatus[] | null;
  watch_count?: number | null;
  season_number?: number | null;
  first_watched_at?: string | null;
  last_watched_at?: string | null;
  added_at: string;
  updated_at: string;
  contents: ContentRow | null;
}

interface ContentRow {
  crew?: unknown;
  id: string;
  content_type: ContentType;
  source_api: string;
  source_id: string;
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  air_year: number | null;
  air_date: string | null;
  end_date: string | null;
  content_genres?: { genres: { name: string } | { name: string }[] | null }[] | null;
}

interface ReviewRow {
  content_id: string;
  rating: number | null;
  one_line_review: string | null;
}

interface SeasonRow {
  content_id: string;
  season_number: number;
  episode_count: number | null;
  title: string | null;
  air_year: number | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WATCH_STATUS_OPTIONS: WatchStatus[] = [
  "wishlist",
  "watching",
  "dropped",
  "completed",
  "recommended",
  "not_recommended"
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");

  const body = await parseJson<GetLibraryShareRequest>(req);
  if (!body.ok) return jsonError(400, "INVALID_REQUEST", body.message);

  const shareId = String(body.value.id ?? "").trim();
  if (!UUID_PATTERN.test(shareId)) return jsonError(400, "INVALID_REQUEST", "Valid share id is required");

  const adminClient = createAdminClient();
  const { data: shareData, error: shareError } = await adminClient
    .from("library_shares")
    .select("id,owner_user_id,title,filters,content_ids,library_item_ids,item_count,created_at,expires_at")
    .eq("id", shareId)
    .maybeSingle();

  if (shareError) return jsonError(500, "DB_ERROR", shareError.message);
  if (!shareData) return jsonError(404, "NOT_FOUND", "Library share not found");

  const share = shareData as ShareRow;
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
    return jsonError(410, "EXPIRED", "Library share has expired");
  }

  const contentIds = share.content_ids ?? [];
  const idChunks = chunk(contentIds, LIBRARY_SHARE_QUERY_CHUNK);
  const registrationIds = Array.isArray(share.library_item_ids) ? share.library_item_ids : null;
  const libraryChunks = registrationIds === null ? idChunks : chunk(registrationIds, LIBRARY_SHARE_QUERY_CHUNK);
  const [profileResult, libraryResult, reviewsResult, seasonsResult] = await Promise.all([
    adminClient.from("profiles").select("display_name").eq("id", share.owner_user_id).maybeSingle(),
    selectInChunks(libraryChunks, (ids, from, to) =>
      adminClient
        .from("user_library_items")
        .select(
          "id,user_id,content_id,status,status_flags,watch_count,season_number,first_watched_at,last_watched_at,added_at,updated_at,contents(*,content_genres(genres(name)))"
        )
        .eq("user_id", share.owner_user_id)
        .in(registrationIds === null ? "content_id" : "id", ids)
        .order("id")
        .range(from, to)
    ),
    selectInChunks(idChunks, (ids, from, to) =>
      adminClient
        .from("reviews")
        .select("content_id,rating,one_line_review")
        .eq("user_id", share.owner_user_id)
        .in("content_id", ids)
        .order("id")
        .range(from, to)
    ),
    selectInChunks(idChunks, (ids, from, to) =>
      adminClient.from("seasons").select("content_id,season_number,episode_count,title,air_year")
        .in("content_id", ids).order("id").range(from, to)
    )
  ]);

  if (profileResult.error) return jsonError(500, "DB_ERROR", profileResult.error.message);
  if (libraryResult.error) return jsonError(500, "DB_ERROR", libraryResult.error.message);
  if (reviewsResult.error) return jsonError(500, "DB_ERROR", reviewsResult.error.message);
  if (seasonsResult.error) return jsonError(500, "DB_ERROR", seasonsResult.error.message);

  const reviewsByContentId = new Map(
    ((reviewsResult.data ?? []) as ReviewRow[]).map((review) => [review.content_id, review])
  );
  const seasonsByContentId = new Map<string, SeasonRow[]>();
  for (const season of (seasonsResult.data ?? []) as SeasonRow[]) {
    const existing = seasonsByContentId.get(season.content_id) ?? [];
    existing.push(season);
    seasonsByContentId.set(season.content_id, existing);
  }
  const selectedRows = selectSharedLibraryRows(
    (libraryResult.data ?? []) as unknown as LibraryRow[], registrationIds, contentIds
  );
  const items = selectedRows.map(row => {
    const review = reviewsByContentId.get(row.content_id);
    const seasonNumber = row.season_number ?? null;
    const contentSeasons = seasonsByContentId.get(row.content_id) ?? [];
    const scopedSeasons = seasonNumber === null ? contentSeasons : contentSeasons.filter(season => season.season_number === seasonNumber);
    const summary = sharedSeasonSummary({
      title_primary: row.contents?.title_primary ?? "제목 없음",
      air_year: row.contents?.air_year ?? null,
      season_number: seasonNumber
    }, contentSeasons);
    return {
      library_item_id: row.id,
      status: row.status,
      statuses: normalizeWatchStatuses(row.status_flags?.length ? row.status_flags : [row.status]),
      added_at: row.added_at,
      updated_at: row.updated_at,
      first_watched_at: row.first_watched_at ?? null,
      last_watched_at: row.last_watched_at ?? null,
      content_id: row.content_id,
      ...summary,
      title_original: row.contents?.title_original ?? null,
      poster_url: row.contents?.poster_url ?? null,
      content_type: row.contents?.content_type ?? "other",
      source_api: row.contents?.source_api ?? "manual",
      source_id: row.contents?.source_id ?? "",
      air_date: seasonNumber === null ? row.contents?.air_date ?? null : null,
      end_date: row.contents?.end_date ?? null,
      cast: [],
      crew: parseStoredCrew(row.contents?.crew),
      rating: review?.rating ?? null,
      one_line_review: review?.one_line_review ?? null,
      watched_episode_count: 0,
      derived_watched_through: null,
      next_episode_number: null,
      manual_watched_season_number: null,
      manual_watched_episode_number: null,
      manual_watched_absolute_number: null,
      progress_source: "none",
      effective_watched_through: 0,
      season_episode_counts: scopedSeasons.map(season => ({ season_number: season.season_number, episode_count: season.episode_count })),
      manual_progress_available: false,
      season_number: seasonNumber,
      genres: extractGenreNames(row.contents?.content_genres),
      watch_count: row.watch_count ?? 0
    };
  });

  return json({
    contract_version: "library-share-v2",
    id: share.id,
    title: share.title,
    owner_display_name: profileResult.data?.display_name ?? "SceneNote 사용자",
    filters: share.filters,
    item_count: items.length,
    created_at: share.created_at,
    items
  });
});

function normalizeWatchStatuses(statuses: WatchStatus[] | null | undefined): WatchStatus[] {
  const normalized = Array.from(new Set(statuses ?? [])).filter((status) =>
    WATCH_STATUS_OPTIONS.includes(status)
  );
  return normalized.length > 0 ? normalized : ["wishlist"];
}

function extractGenreNames(contentGenres?: ContentRow["content_genres"]): string[] {
  if (!contentGenres) return [];

  return Array.from(
    new Set(
      contentGenres
        .flatMap((contentGenre) => {
          const genres = contentGenre.genres;
          if (Array.isArray(genres)) return genres.map((genre) => genre.name);
          return genres?.name ? [genres.name] : [];
        })
        .filter((name): name is string => Boolean(name?.trim()))
        .map((name) => name.trim())
    )
  );
}

// 공유 작품 ID를 한 번에 `in` 조건으로 보내면 URL이 길어져 실패한다(1000개 ≈ 37KB). 나눠 조회해 이어 붙인다.
async function selectInChunks<T>(
  idChunks: string[][],
  query: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const results = await Promise.all(idChunks.map(ids => readAllRows((from, to) => query(ids, from, to))));
  const error = results.find(result => result.error)?.error ?? null;
  return { data: error ? null : results.flatMap(result => result.data ?? []), error };
}
