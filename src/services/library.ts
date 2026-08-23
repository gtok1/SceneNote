import { getPrimaryWatchStatus, normalizeWatchStatuses } from "@/constants/status";
import { supabase } from "@/lib/supabase";
import type { ExternalSource, SearchResult, Season, Episode, Content } from "@/types/content";
import type {
  EpisodeProgress,
  LibraryListItem,
  LibraryStatusFilter,
  SeasonEpisodeCount,
  WatchStatus
} from "@/types/library";
import { extractGenreNames, type ContentGenreJoin } from "@/utils/genre";
import {
  MAX_MANUAL_EPISODE_NUMBER,
  createSeasonOffsetsByNumber,
  resolveEpisodeProgress,
  toAbsoluteEpisodeNumber
} from "@/utils/episodeProgress";

interface RawLibraryRow {
  id: string;
  user_id: string;
  content_id: string;
  status: WatchStatus;
  status_flags?: WatchStatus[] | null;
  watch_count?: number | null;
  first_watched_at?: string | null;
  last_watched_at?: string | null;
  manual_watched_season_number?: number | null;
  manual_watched_episode_number?: number | null;
  manual_progress_updated_at?: string | null;
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
  id: string;
  content_id: string;
  season_number: number;
  episode_count: number | null;
}

interface LibraryProgressRow {
  content_id: string;
  episode_id: string;
  episodes?: {
    season_id: string | null;
    episode_number: number | null;
  } | {
    season_id: string | null;
    episode_number: number | null;
  }[] | null;
}

interface EpisodeAirDateRow {
  content_id: string;
  air_date: string | null;
}

interface EpisodeProgressSummary {
  watchedEpisodeIds: Set<string>;
  maxWatchedEpisodeNumber: number | null;
}

const LIBRARY_ITEM_SELECT =
  "id,user_id,content_id,status,status_flags,watch_count,first_watched_at,last_watched_at," +
  "manual_watched_season_number,manual_watched_episode_number,manual_progress_updated_at," +
  "added_at,updated_at,contents(*,content_genres(genres(name)))";

const LIBRARY_ITEM_FALLBACK_SELECT =
  "id,user_id,content_id,status,watch_count,added_at,updated_at,contents(*,content_genres(genres(name)))";

export async function getLibraryItems(status: LibraryStatusFilter): Promise<LibraryListItem[]> {
  let query = supabase
    .from("user_library_items")
    .select(LIBRARY_ITEM_SELECT)
    .order("updated_at", { ascending: false });

  if (status !== "all") {
    query = query.contains("status_flags", [status]);
  }

  let { data, error } = await query;

  if (error && isMissingOptionalLibraryColumnError(error.message)) {
    let fallbackQuery = supabase
      .from("user_library_items")
      .select(LIBRARY_ITEM_FALLBACK_SELECT)
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
      rating: null,
      one_line_review: null,
      episode_count: null,
      watched_episode_count: 0,
      derived_watched_through: null,
      next_episode_number: null,
      manual_watched_season_number: row.manual_watched_season_number ?? null,
      manual_watched_episode_number: row.manual_watched_episode_number ?? null,
      manual_watched_absolute_number: null,
      progress_source: "none" as const,
      effective_watched_through: 0,
      season_episode_counts: [],
      manual_progress_available: hasManualProgressColumns(row),
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
  const [firstEpisodeAirDate, lastEpisodeAirDate] = await Promise.all([
    content.air_date ? Promise.resolve(null) : getFirstEpisodeAirDate(contentId),
    content.end_date ? Promise.resolve(null) : getLastEpisodeAirDate(contentId)
  ]);
  const airDate = content.air_date ?? firstEpisodeAirDate ?? null;
  return {
    ...content,
    air_date: airDate,
    end_date: content.end_date ?? lastEpisodeAirDate ?? (content.content_type === "movie" ? airDate : null),
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
  const requiresDirectStatusUpdate = normalizedStatuses.includes("dropped");
  const functionStatuses = requiresDirectStatusUpdate
    ? normalizeWatchStatuses(normalizedStatuses.filter((item) => item !== "dropped"))
    : normalizedStatuses;
  const fallbackFunctionStatuses: WatchStatus[] = functionStatuses.length ? functionStatuses : ["wishlist"];
  const functionPrimaryStatus = getPrimaryWatchStatus(fallbackFunctionStatuses) ?? "wishlist";
  const { data, error } = await supabase.functions.invoke<AddToLibraryResponse>("add-to-library", {
      body: {
        api_source: result.external_source,
        external_id: result.external_id,
        media_type: result.content_type === "movie" ? "movie" : "tv",
        watch_status: functionPrimaryStatus,
        watch_statuses: fallbackFunctionStatuses
      }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("라이브러리 추가 응답이 비어 있습니다");
  }

  if (requiresDirectStatusUpdate) {
    await updateLibraryStatuses(data.library_item_id, normalizedStatuses);
    return {
      ...data,
      status: primaryStatus,
      statuses: normalizedStatuses
    };
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

export async function updateLibraryManualProgress(
  libraryItemId: string,
  progress: { seasonNumber: number | null; episodeNumber: number } | null
): Promise<void> {
  const patch = progress === null
    ? {
        manual_watched_season_number: null,
        manual_watched_episode_number: null,
        manual_progress_updated_at: null
      }
    : {
        manual_watched_season_number: progress.seasonNumber,
        manual_watched_episode_number: Math.max(0, Math.floor(progress.episodeNumber)),
        manual_progress_updated_at: new Date().toISOString()
      };

  if (
    patch.manual_watched_episode_number !== null
    && patch.manual_watched_episode_number > MAX_MANUAL_EPISODE_NUMBER
  ) {
    throw new Error("회차는 9999 이하로 입력해 주세요");
  }

  const { error } = await supabase
    .from("user_library_items")
    .update(patch)
    .eq("id", libraryItemId);

  if (error && isMissingOptionalLibraryColumnError(error.message)) {
    throw new Error("시청 진행 위치 기능은 서버 업데이트 후 사용할 수 있습니다.");
  }
  if (error) throw new Error(error.message);
}

export async function updateLibraryWatchDates(
  libraryItemId: string,
  dates: { firstWatchedAt: string | null; lastWatchedAt: string | null }
): Promise<void> {
  const { error } = await supabase
    .from("user_library_items")
    .update({
      first_watched_at: dates.firstWatchedAt,
      last_watched_at: dates.lastWatchedAt
    })
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

  let { data, error } = await supabase
    .from("user_library_items")
    .select(LIBRARY_ITEM_SELECT)
    .eq("content_id", externalRow.content_id)
    .maybeSingle();

  if (error && isMissingOptionalLibraryColumnError(error.message)) {
    const fallback = await supabase
      .from("user_library_items")
      .select(LIBRARY_ITEM_FALLBACK_SELECT)
      .eq("content_id", externalRow.content_id)
      .maybeSingle();
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as RawLibraryRow;
  const item: LibraryListItem = {
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
    rating: null,
    one_line_review: null,
    episode_count: null,
    watched_episode_count: 0,
    derived_watched_through: null,
    next_episode_number: null,
    manual_watched_season_number: row.manual_watched_season_number ?? null,
    manual_watched_episode_number: row.manual_watched_episode_number ?? null,
    manual_watched_absolute_number: null,
    progress_source: "none",
    effective_watched_through: 0,
    season_episode_counts: [],
    manual_progress_available: hasManualProgressColumns(row),
    genres: extractGenreNames(row.contents?.content_genres),
    watch_count: row.watch_count ?? 0
  };

  const [enrichedItem] = await enrichLibraryMetadata([item]);
  return enrichedItem ?? item;
}

function isMissingOptionalLibraryColumnError(message: string): boolean {
  return [
    "status_flags",
    "first_watched_at",
    "last_watched_at",
    "manual_watched_season_number",
    "manual_watched_episode_number",
    "manual_progress_updated_at"
  ].some((column) => message.includes(column));
}

function hasManualProgressColumns(row: RawLibraryRow): boolean {
  return Object.prototype.hasOwnProperty.call(row, "manual_watched_episode_number");
}

async function enrichLibraryMetadata(items: LibraryListItem[]): Promise<LibraryListItem[]> {
  if (items.length === 0) return items;

  const contentIds = Array.from(new Set(items.map((item) => item.content_id)));
  const [reviewsResult, seasonsResult, progressResult, episodeAirDatesResult] = await Promise.all([
    supabase
      .from("reviews")
      .select("content_id,rating,one_line_review")
      .in("content_id", contentIds),
    supabase
      .from("seasons")
      .select("id,content_id,season_number,episode_count")
      .in("content_id", contentIds),
    supabase
      .from("user_episode_progress")
      .select("content_id,episode_id,episodes(season_id,episode_number)")
      .in("content_id", contentIds),
    supabase
      .from("episodes")
      .select("content_id,air_date")
      .in("content_id", contentIds)
      .not("air_date", "is", null)
  ]);

  if (reviewsResult.error) throw new Error(reviewsResult.error.message);
  if (seasonsResult.error) throw new Error(seasonsResult.error.message);
  if (progressResult.error) throw new Error(progressResult.error.message);
  if (episodeAirDatesResult.error) throw new Error(episodeAirDatesResult.error.message);

  const reviewsByContentId = new Map(
    ((reviewsResult.data ?? []) as LibraryReviewRow[]).map((review) => [review.content_id, review])
  );
  const episodeCountsByContentId = new Map<string, number>();
  const firstAirDateByContentId = createFirstAirDateByContentId(
    (episodeAirDatesResult.data ?? []) as EpisodeAirDateRow[]
  );
  const lastAirDateByContentId = createLastAirDateByContentId(
    (episodeAirDatesResult.data ?? []) as EpisodeAirDateRow[]
  );
  const seasonOffsetsBySeasonId = createSeasonOffsets((seasonsResult.data ?? []) as LibrarySeasonRow[]);
  const seasonCountsByContentId = new Map<string, SeasonEpisodeCount[]>();

  for (const season of (seasonsResult.data ?? []) as LibrarySeasonRow[]) {
    const seasonCounts = seasonCountsByContentId.get(season.content_id) ?? [];
    seasonCounts.push({
      season_number: season.season_number,
      episode_count: season.episode_count
    });
    seasonCountsByContentId.set(season.content_id, seasonCounts);

    if (!season.episode_count) continue;
    episodeCountsByContentId.set(
      season.content_id,
      (episodeCountsByContentId.get(season.content_id) ?? 0) + season.episode_count
    );
  }

  const progressByContentId = createProgressSummaries(
    (progressResult.data ?? []) as unknown as LibraryProgressRow[],
    seasonOffsetsBySeasonId
  );
  for (const seasonCounts of seasonCountsByContentId.values()) {
    seasonCounts.sort((a, b) => a.season_number - b.season_number);
  }

  return items.map((item) => {
    const review = reviewsByContentId.get(item.content_id);
    const episodeCount = episodeCountsByContentId.get(item.content_id) ?? null;
    const progress = progressByContentId.get(item.content_id);
    const watchedEpisodeCount = progress?.watchedEpisodeIds.size ?? 0;
    const seasonCounts = seasonCountsByContentId.get(item.content_id) ?? [];
    const manualAbsolute = toAbsoluteEpisodeNumber(
      item.manual_watched_season_number,
      item.manual_watched_episode_number,
      createSeasonOffsetsByNumber(seasonCounts)
    );
    const resolved = resolveEpisodeProgress({
      contentType: item.content_type,
      episodeCount,
      watchedEpisodeCount,
      derivedWatchedThrough: progress?.maxWatchedEpisodeNumber ?? null,
      manualWatchedThrough: manualAbsolute
    });

    return {
      ...item,
      air_date: item.air_date ?? firstAirDateByContentId.get(item.content_id) ?? null,
      end_date:
        item.end_date ??
        lastAirDateByContentId.get(item.content_id) ??
        (item.content_type === "movie" ? (item.air_date ?? firstAirDateByContentId.get(item.content_id) ?? null) : null),
      rating: review?.rating ?? null,
      one_line_review: review?.one_line_review ?? null,
      episode_count: episodeCount,
      watched_episode_count: watchedEpisodeCount,
      derived_watched_through: progress?.maxWatchedEpisodeNumber ?? null,
      next_episode_number: resolved.nextEpisodeNumber,
      manual_watched_absolute_number: manualAbsolute,
      progress_source: resolved.source,
      effective_watched_through: resolved.watchedThrough,
      season_episode_counts: seasonCounts
    };
  });
}

async function getFirstEpisodeAirDate(contentId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("episodes")
    .select("air_date")
    .eq("content_id", contentId)
    .not("air_date", "is", null)
    .order("air_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as { air_date?: string | null } | null)?.air_date ?? null;
}

async function getLastEpisodeAirDate(contentId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("episodes")
    .select("air_date")
    .eq("content_id", contentId)
    .not("air_date", "is", null)
    .order("air_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as { air_date?: string | null } | null)?.air_date ?? null;
}

function createFirstAirDateByContentId(rows: EpisodeAirDateRow[]): Map<string, string> {
  const firstAirDateByContentId = new Map<string, string>();

  for (const row of rows) {
    if (!row.air_date) continue;
    const current = firstAirDateByContentId.get(row.content_id);
    if (!current || row.air_date < current) {
      firstAirDateByContentId.set(row.content_id, row.air_date);
    }
  }

  return firstAirDateByContentId;
}

function createLastAirDateByContentId(rows: EpisodeAirDateRow[]): Map<string, string> {
  const lastAirDateByContentId = new Map<string, string>();

  for (const row of rows) {
    if (!row.air_date) continue;
    const current = lastAirDateByContentId.get(row.content_id);
    if (!current || row.air_date > current) {
      lastAirDateByContentId.set(row.content_id, row.air_date);
    }
  }

  return lastAirDateByContentId;
}

function createSeasonOffsets(seasons: LibrarySeasonRow[]): Map<string, number> {
  const seasonsByContentId = new Map<string, LibrarySeasonRow[]>();
  for (const season of seasons) {
    const contentSeasons = seasonsByContentId.get(season.content_id) ?? [];
    contentSeasons.push(season);
    seasonsByContentId.set(season.content_id, contentSeasons);
  }

  const offsets = new Map<string, number>();
  for (const contentSeasons of seasonsByContentId.values()) {
    let offset = 0;
    for (const season of contentSeasons.sort((a, b) => a.season_number - b.season_number)) {
      offsets.set(season.id, offset);
      offset += Math.max(0, season.episode_count ?? 0);
    }
  }

  return offsets;
}

function createProgressSummaries(
  rows: LibraryProgressRow[],
  seasonOffsetsBySeasonId: Map<string, number>
): Map<string, EpisodeProgressSummary> {
  const summaries = new Map<string, EpisodeProgressSummary>();

  for (const row of rows) {
    const summary = summaries.get(row.content_id) ?? {
      watchedEpisodeIds: new Set<string>(),
      maxWatchedEpisodeNumber: null
    };

    summary.watchedEpisodeIds.add(row.episode_id);

    const episode = normalizeJoinedEpisode(row.episodes);
    const episodeNumber = episode?.episode_number ?? null;
    const seasonId = episode?.season_id ?? null;
    if (episodeNumber && episodeNumber > 0) {
      const seasonOffset = seasonId ? seasonOffsetsBySeasonId.get(seasonId) ?? 0 : 0;
      const normalizedEpisodeNumber = seasonOffset + episodeNumber;
      summary.maxWatchedEpisodeNumber =
        summary.maxWatchedEpisodeNumber === null
          ? normalizedEpisodeNumber
          : Math.max(summary.maxWatchedEpisodeNumber, normalizedEpisodeNumber);
    }

    summaries.set(row.content_id, summary);
  }

  return summaries;
}

function normalizeJoinedEpisode(episode: LibraryProgressRow["episodes"]) {
  if (Array.isArray(episode)) return episode[0] ?? null;
  return episode ?? null;
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
