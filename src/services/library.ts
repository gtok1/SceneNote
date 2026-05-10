import { getPrimaryWatchStatus, normalizeWatchStatuses } from "@/constants/status";
import { supabase } from "@/lib/supabase";
import type { ExternalSource, SearchResult, Season, Episode, Content } from "@/types/content";
import type {
  EpisodeProgress,
  LibraryListItem,
  LibraryStatusFilter,
  WatchStatus
} from "@/types/library";
import { extractGenreNames, type ContentGenreJoin } from "@/utils/genre";

interface RawLibraryRow {
  id: string;
  user_id: string;
  content_id: string;
  status: WatchStatus;
  status_flags?: WatchStatus[] | null;
  watch_count?: number | null;
  added_at: string;
  updated_at: string;
  contents: RawContentWithGenres | null;
}

type RawContentWithGenres = Content & {
  content_genres?: ContentGenreJoin[] | null;
};

interface AddToLibraryResponse {
  library_item_id: string;
  content_id: string;
  status: WatchStatus;
  statuses?: WatchStatus[];
  watch_count?: number;
}

interface LibraryReviewRow {
  content_id: string;
  rating: number | null;
  one_line_review: string | null;
}

interface LibrarySeasonRow {
  content_id: string;
  episode_count: number | null;
}

export async function getLibraryItems(status: LibraryStatusFilter): Promise<LibraryListItem[]> {
  let query = supabase
    .from("user_library_items")
    .select("id,user_id,content_id,status,status_flags,watch_count,added_at,updated_at,contents(*,content_genres(genres(name)))")
    .order("updated_at", { ascending: false });

  if (status !== "all") {
    query = query.contains("status_flags", [status]);
  }

  let { data, error } = await query;

  if (error && error.message.includes("status_flags")) {
    let fallbackQuery = supabase
      .from("user_library_items")
      .select("id,user_id,content_id,status,watch_count,added_at,updated_at,contents(*,content_genres(genres(name)))")
      .order("updated_at", { ascending: false });

    if (status !== "all") {
      fallbackQuery = fallbackQuery.eq("status", status);
    }

    const fallback = await fallbackQuery;
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);

  const items = ((data ?? []) as unknown as RawLibraryRow[])
    .map((row) => ({
      library_item_id: row.id,
      status: row.status,
      statuses: normalizeWatchStatuses(row.status_flags?.length ? row.status_flags : [row.status]),
      added_at: row.added_at,
      updated_at: row.updated_at,
      content_id: row.content_id,
      title_primary: row.contents?.title_primary ?? "제목 없음",
      title_original: row.contents?.title_original ?? null,
      poster_url: row.contents?.poster_url ?? null,
      content_type: row.contents?.content_type ?? "other",
      source_api: row.contents?.source_api ?? "manual",
      source_id: row.contents?.source_id ?? "",
      air_year: row.contents?.air_year ?? null,
      cast: [],
      rating: null,
      one_line_review: null,
      episode_count: null,
      genres: extractGenreNames(row.contents?.content_genres),
      watch_count: row.watch_count ?? 0
    }))
    .filter((item) => item.statuses.length > 0);

  return enrichLibraryMetadata(items);
}

export async function getContentById(contentId: string): Promise<Content | null> {
  const { data, error } = await supabase
    .from("contents")
    .select("*,content_genres(genres(name))")
    .eq("id", contentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as RawContentWithGenres;
  const { content_genres: _contentGenres, ...content } = row;
  return {
    ...content,
    genres: extractGenreNames(_contentGenres)
  };
}

export async function addContentToLibrary(
  result: SearchResult,
  status: WatchStatus = "wishlist",
  statuses?: WatchStatus[]
): Promise<AddToLibraryResponse> {
  const normalizedStatuses = normalizeWatchStatuses(statuses ?? [status]);
  const primaryStatus = getPrimaryWatchStatus(normalizedStatuses) ?? "wishlist";
  const { data, error } = await supabase.functions.invoke<AddToLibraryResponse>("add-to-library", {
      body: {
        api_source: result.external_source,
        external_id: result.external_id,
        media_type: result.content_type === "movie" ? "movie" : "tv",
        watch_status: primaryStatus,
        watch_statuses: normalizedStatuses
      }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("라이브러리 추가 응답이 비어 있습니다");
  }

  return data;
}

export async function updateLibraryStatus(
  libraryItemId: string,
  status: WatchStatus
): Promise<void> {
  return updateLibraryStatuses(libraryItemId, [status]);
}

export async function updateLibraryStatuses(
  libraryItemId: string,
  statuses: WatchStatus[],
  options: { watchCount?: number } = {}
): Promise<void> {
  const normalizedStatuses = normalizeWatchStatuses(statuses);
  const primaryStatus = getPrimaryWatchStatus(normalizedStatuses) ?? "wishlist";
  const patch: { status: WatchStatus; status_flags: WatchStatus[]; watch_count?: number } = {
    status: primaryStatus,
    status_flags: normalizedStatuses
  };
  if (options.watchCount !== undefined) {
    patch.watch_count = Math.max(0, Math.floor(options.watchCount));
  }

  const { error } = await supabase
    .from("user_library_items")
    .update(patch)
    .eq("id", libraryItemId);

  if (error && error.message.includes("status_flags")) {
    const fallbackPatch: { status: WatchStatus; watch_count?: number } = { status: primaryStatus };
    if (options.watchCount !== undefined) {
      fallbackPatch.watch_count = Math.max(0, Math.floor(options.watchCount));
    }

    const fallback = await supabase
      .from("user_library_items")
      .update(fallbackPatch)
      .eq("id", libraryItemId);

    if (fallback.error) throw new Error(fallback.error.message);
    return;
  }

  if (error) throw new Error(error.message);
}

export async function updateLibraryWatchCount(
  libraryItemId: string,
  watchCount: number
): Promise<void> {
  const normalizedCount = Math.max(0, Math.floor(watchCount));
  const { error } = await supabase
    .from("user_library_items")
    .update({ watch_count: normalizedCount })
    .eq("id", libraryItemId);

  if (error) throw new Error(error.message);
}

export async function deleteLibraryItem(libraryItemId: string): Promise<void> {
  const { error } = await supabase
    .from("user_library_items")
    .delete()
    .eq("id", libraryItemId);

  if (error) throw new Error(error.message);
}

export async function getLibraryStatusByExternalId(
  source: ExternalSource,
  externalId: string
): Promise<LibraryListItem | null> {
  const { data: externalRow, error: externalError } = await supabase
    .from("content_external_ids")
    .select("content_id")
    .eq("api_source", source)
    .eq("external_id", externalId)
    .maybeSingle();

  if (externalError) throw new Error(externalError.message);
  if (!externalRow) return null;

  const { data, error } = await supabase
    .from("user_library_items")
    .select("id,user_id,content_id,status,status_flags,watch_count,added_at,updated_at,contents(*,content_genres(genres(name)))")
    .eq("content_id", externalRow.content_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as RawLibraryRow;
  const item: LibraryListItem = {
    library_item_id: row.id,
    status: row.status,
    statuses: normalizeWatchStatuses(row.status_flags?.length ? row.status_flags : [row.status]),
    added_at: row.added_at,
    updated_at: row.updated_at,
    content_id: row.content_id,
    title_primary: row.contents?.title_primary ?? "제목 없음",
    title_original: row.contents?.title_original ?? null,
    poster_url: row.contents?.poster_url ?? null,
    content_type: row.contents?.content_type ?? "other",
    source_api: row.contents?.source_api ?? "manual",
    source_id: row.contents?.source_id ?? "",
    air_year: row.contents?.air_year ?? null,
    cast: [],
    rating: null,
    one_line_review: null,
    episode_count: null,
    genres: extractGenreNames(row.contents?.content_genres),
    watch_count: row.watch_count ?? 0
  };

  const [enrichedItem] = await enrichLibraryMetadata([item]);
  return enrichedItem ?? item;
}

async function enrichLibraryMetadata(items: LibraryListItem[]): Promise<LibraryListItem[]> {
  if (items.length === 0) return items;

  const contentIds = Array.from(new Set(items.map((item) => item.content_id)));
  const [reviewsResult, seasonsResult] = await Promise.all([
    supabase
      .from("reviews")
      .select("content_id,rating,one_line_review")
      .in("content_id", contentIds),
    supabase
      .from("seasons")
      .select("content_id,episode_count")
      .in("content_id", contentIds)
  ]);

  if (reviewsResult.error) throw new Error(reviewsResult.error.message);
  if (seasonsResult.error) throw new Error(seasonsResult.error.message);

  const reviewsByContentId = new Map(
    ((reviewsResult.data ?? []) as LibraryReviewRow[]).map((review) => [review.content_id, review])
  );
  const episodeCountsByContentId = new Map<string, number>();

  for (const season of (seasonsResult.data ?? []) as LibrarySeasonRow[]) {
    if (!season.episode_count) continue;
    episodeCountsByContentId.set(
      season.content_id,
      (episodeCountsByContentId.get(season.content_id) ?? 0) + season.episode_count
    );
  }

  return items.map((item) => {
    const review = reviewsByContentId.get(item.content_id);
    const episodeCount = episodeCountsByContentId.get(item.content_id) ?? null;

    return {
      ...item,
      rating: review?.rating ?? null,
      one_line_review: review?.one_line_review ?? null,
      episode_count: episodeCount
    };
  });
}

export async function getSeasons(contentId: string): Promise<Season[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("content_id", contentId)
    .order("season_number", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Season[];
}

export async function getEpisodes(contentId: string, seasonId: string): Promise<Episode[]> {
  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("content_id", contentId)
    .eq("season_id", seasonId)
    .order("episode_number", { ascending: true });

  if (error) throw new Error(error.message);
  if (data && data.length > 0) return data as Episode[];

  const { data: functionData, error: functionError } = await supabase.functions.invoke<{
    episodes: Episode[];
    from_db: boolean;
    season_id: string;
    warning?: string;
  }>("fetch-episodes", {
    body: {
      content_id: contentId,
      season_id: seasonId
    }
  });

  if (functionError) throw new Error(functionError.message);
  return functionData?.episodes ?? [];
}

export async function getEpisodeProgress(contentId: string): Promise<EpisodeProgress[]> {
  const { data, error } = await supabase
    .from("user_episode_progress")
    .select("*")
    .eq("content_id", contentId);

  if (error) throw new Error(error.message);
  return (data ?? []) as EpisodeProgress[];
}

export async function toggleEpisodeProgress(
  episode: Episode,
  currentlyWatched: boolean
): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("로그인이 필요합니다");

  if (currentlyWatched) {
    const { error } = await supabase
      .from("user_episode_progress")
      .delete()
      .eq("episode_id", episode.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("user_episode_progress").upsert(
    {
      user_id: user.id,
      episode_id: episode.id,
      content_id: episode.content_id,
      watched_at: new Date().toISOString()
    },
    {
      onConflict: "user_id,episode_id"
    }
  );

  if (error) throw new Error(error.message);
}

export async function getLibraryStats(): Promise<{
  total: number;
  completed: number;
  pins: number;
  tags: number;
}> {
  const [{ count: total }, { count: completed }, { count: pins }, { count: tags }] =
    await Promise.all([
      supabase.from("user_library_items").select("id", { count: "exact", head: true }),
      supabase
        .from("user_library_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      supabase.from("timeline_pins").select("id", { count: "exact", head: true }),
      supabase.from("tags").select("id", { count: "exact", head: true })
    ]);

  return {
    total: total ?? 0,
    completed: completed ?? 0,
    pins: pins ?? 0,
    tags: tags ?? 0
  };
}
