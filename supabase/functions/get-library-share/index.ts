import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
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
  first_watched_at?: string | null;
  last_watched_at?: string | null;
  added_at: string;
  updated_at: string;
  contents: ContentRow | null;
}

interface ContentRow {
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
  episode_count: number | null;
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
    .select("id,owner_user_id,title,filters,content_ids,item_count,created_at,expires_at")
    .eq("id", shareId)
    .maybeSingle();

  if (shareError) return jsonError(500, "DB_ERROR", shareError.message);
  if (!shareData) return jsonError(404, "NOT_FOUND", "Library share not found");

  const share = shareData as ShareRow;
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
    return jsonError(410, "EXPIRED", "Library share has expired");
  }

  const contentIds = share.content_ids ?? [];
  const [profileResult, libraryResult, reviewsResult, seasonsResult] = await Promise.all([
    adminClient.from("profiles").select("display_name").eq("id", share.owner_user_id).maybeSingle(),
    adminClient
      .from("user_library_items")
      .select(
        "id,user_id,content_id,status,status_flags,watch_count,first_watched_at,last_watched_at,added_at,updated_at,contents(*,content_genres(genres(name)))"
      )
      .eq("user_id", share.owner_user_id)
      .in("content_id", contentIds),
    adminClient
      .from("reviews")
      .select("content_id,rating,one_line_review")
      .eq("user_id", share.owner_user_id)
      .in("content_id", contentIds),
    adminClient
      .from("seasons")
      .select("content_id,episode_count")
      .in("content_id", contentIds)
  ]);

  if (profileResult.error) return jsonError(500, "DB_ERROR", profileResult.error.message);
  if (libraryResult.error) return jsonError(500, "DB_ERROR", libraryResult.error.message);
  if (reviewsResult.error) return jsonError(500, "DB_ERROR", reviewsResult.error.message);
  if (seasonsResult.error) return jsonError(500, "DB_ERROR", seasonsResult.error.message);

  const reviewsByContentId = new Map(
    ((reviewsResult.data ?? []) as ReviewRow[]).map((review) => [review.content_id, review])
  );
  const episodeCountsByContentId = new Map<string, number>();
  for (const season of (seasonsResult.data ?? []) as SeasonRow[]) {
    if (!season.episode_count) continue;
    episodeCountsByContentId.set(
      season.content_id,
      (episodeCountsByContentId.get(season.content_id) ?? 0) + season.episode_count
    );
  }

  const itemsByContentId = new Map(
    ((libraryResult.data ?? []) as unknown as LibraryRow[]).map((row) => {
      const review = reviewsByContentId.get(row.content_id);
      return [
        row.content_id,
        {
          library_item_id: row.id,
          status: row.status,
          statuses: normalizeWatchStatuses(row.status_flags?.length ? row.status_flags : [row.status]),
          added_at: row.added_at,
          updated_at: row.updated_at,
          first_watched_at: row.first_watched_at ?? null,
          last_watched_at: row.last_watched_at ?? null,
          content_id: row.content_id,
          title_primary: row.contents?.title_primary ?? "제목 없음",
          title_original: row.contents?.title_original ?? null,
          poster_url: row.contents?.poster_url ?? null,
          content_type: row.contents?.content_type ?? "other",
          source_api: row.contents?.source_api ?? "manual",
          source_id: row.contents?.source_id ?? "",
          air_year: row.contents?.air_year ?? null,
          air_date: row.contents?.air_date ?? null,
          end_date: row.contents?.end_date ?? null,
          cast: [],
          rating: review?.rating ?? null,
          one_line_review: review?.one_line_review ?? null,
          episode_count: episodeCountsByContentId.get(row.content_id) ?? null,
          watched_episode_count: 0,
          next_episode_number: null,
          genres: extractGenreNames(row.contents?.content_genres),
          watch_count: row.watch_count ?? 0
        }
      ];
    })
  );

  const items = contentIds
    .map((contentId) => itemsByContentId.get(contentId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return json({
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
