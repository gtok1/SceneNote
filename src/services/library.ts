import { readAllRows, readBatchedRows } from "@/utils/batchedQuery";
import { contentIdsNeedingEpisodeAirDates } from "@/utils/libraryAirDates";
import { getSessionUserId } from "@/services/sessionUser";
import { assertLibraryWriteApplied } from "@/utils/libraryWrite";
import { hasKnownEpisodeCount, isEpisodeListReusable } from "../../supabase/functions/_shared/episodeCache";
import { requestMediaType } from "../../supabase/functions/_shared/contentIdentity";
import { getLibraryProgressFields, type LibraryProgressRow } from "@/utils/libraryProgress";
import { parseStoredCrew } from "../../supabase/functions/_shared/contentCrew";
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
import { createSeasonDisplayTitle } from "@/utils/seasonDisplay";
import { releasedEpisodeFromKnownDates, upcomingEpisodeFromKnownDates } from "@/utils/airingAvailability";
import {
  MAX_MANUAL_EPISODE_NUMBER
} from "@/utils/episodeProgress";

interface RawLibraryRow {
  id: string;
  user_id: string;
  content_id: string;
  status: WatchStatus;
  status_flags?: WatchStatus[] | null;
  watch_count?: number | null;
  season_number?: number | null;
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
  crew?: unknown;
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
  title: string | null;
  air_year: number | null;
}

interface EpisodeAirDateRow {
  content_id: string;
  air_date: string | null;
}

const LIBRARY_ITEM_SELECT =
  "id,user_id,content_id,status,status_flags,watch_count,season_number,first_watched_at,last_watched_at," +
  "manual_watched_season_number,manual_watched_episode_number,manual_progress_updated_at," +
  "added_at,updated_at,contents(*,content_genres(genres(name)))";

const LIBRARY_ITEM_FALLBACK_SELECT =
  "id,user_id,content_id,status,watch_count,added_at,updated_at,contents(*,content_genres(genres(name)))";

export async function getLibraryItems(status: LibraryStatusFilter): Promise<LibraryListItem[]> {
  // max_rows(1000)를 넘겨 읽는다. 잘린 목록을 성공으로 돌려주지 않는다(docs/72 D-1).
  let { data, error }: { data: unknown[] | null; error: { message: string } | null } = await readAllRows((from, to) => {
    let query = supabase
      .from("user_library_items")
      .select(LIBRARY_ITEM_SELECT)
      .order("updated_at", { ascending: false })
      .order("id");

    if (status !== "all") {
      query = query.contains("status_flags", [status]);
    }
    return query.range(from, to);
  }, { rowKey: row => (row as unknown as RawLibraryRow).id });

  if (error && isMissingOptionalLibraryColumnError(error.message)) {
    const fallback = await readAllRows((from, to) => {
      let fallbackQuery = supabase
        .from("user_library_items")
        .select(LIBRARY_ITEM_FALLBACK_SELECT)
        .order("updated_at", { ascending: false })
        .order("id");

      if (status !== "all") {
        fallbackQuery = fallbackQuery.eq("status", status);
      }
      return fallbackQuery.range(from, to);
    }, { rowKey: row => row.id });
    data = fallback.data;
    error = fallback.error;
  }

  if (error?.message === "ROW_LIMIT_EXCEEDED") throw new Error("라이브러리 작품이 너무 많아 불러오지 못했어요.");
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
      crew: parseStoredCrew(row.contents?.crew),
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
      watch_count: row.watch_count ?? 0,
      season_number: row.season_number ?? null
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
        watch_statuses: fallbackFunctionStatuses,
        // Season cards register that season only; whole-work cards omit it entirely.
        ...(typeof result.season_number === "number" ? { season_number: result.season_number } : {})
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

  const result = await supabase
    .from("user_library_items")
    .update(patch)
    .eq("id", libraryItemId)
    .select("id");

  if (result.error && result.error.message.includes("status_flags")) {
    const fallbackPatch: { status: WatchStatus; watch_count?: number } = { status: primaryStatus };
    if (options.watchCount !== undefined) {
      fallbackPatch.watch_count = Math.max(0, Math.floor(options.watchCount));
    }

    const fallback = await supabase
      .from("user_library_items")
      .update(fallbackPatch)
      .eq("id", libraryItemId)
      .select("id");

    assertLibraryWriteApplied(fallback, "상태를 저장하지 못했어요. 작품과 로그인 상태를 다시 확인해 주세요.");
    return;
  }

  assertLibraryWriteApplied(result, "상태를 저장하지 못했어요. 작품과 로그인 상태를 다시 확인해 주세요.");
}

export async function updateLibraryWatchCount(
  libraryItemId: string,
  watchCount: number
): Promise<void> {
  const normalizedCount = Math.max(0, Math.floor(watchCount));
  // `.select()` matters: an update that matches no row (revoked session, RLS, deleted
  // item) resolves with error === null, so without it a write that never happened is
  // reported as success.
  const { data, error } = await supabase
    .from("user_library_items")
    .update({ watch_count: normalizedCount })
    .eq("id", libraryItemId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("본 횟수를 저장하지 못했습니다. 로그인 상태를 확인해 주세요.");
  }
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

  const result = await supabase
    .from("user_library_items")
    .update(patch)
    .eq("id", libraryItemId)
    .select("id");

  if (result.error && isMissingOptionalLibraryColumnError(result.error.message)) {
    throw new Error("시청 진행 위치 기능은 서버 업데이트 후 사용할 수 있습니다.");
  }
  assertLibraryWriteApplied(result, "시청 위치를 저장하지 못했어요. 작품과 로그인 상태를 다시 확인해 주세요.");
}

export async function updateLibraryWatchDates(
  libraryItemId: string,
  dates: { firstWatchedAt: string | null; lastWatchedAt: string | null }
): Promise<void> {
  const result = await supabase
    .from("user_library_items")
    .update({
      first_watched_at: dates.firstWatchedAt,
      last_watched_at: dates.lastWatchedAt
    })
    .eq("id", libraryItemId)
    .select("id");

  assertLibraryWriteApplied(result, "본 시기를 저장하지 못했어요. 작품과 로그인 상태를 다시 확인해 주세요.");
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
  externalId: string,
  mediaType?: "movie" | "tv"
): Promise<LibraryListItem | null> {
  const namespace = requestMediaType(source, mediaType);
  if (namespace === null) throw new Error("영화 또는 TV 종류를 선택해 주세요.");
  const { data: externalRow, error: externalError } = await supabase
    .from("content_external_ids")
    .select("content_id")
    .eq("api_source", source)
    .eq("external_id", externalId)
    .eq("media_type", namespace)
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
    crew: parseStoredCrew(row.contents?.crew),
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
    watch_count: row.watch_count ?? 0,
    season_number: row.season_number ?? null
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
  const episodeAirDateContentIds = contentIdsNeedingEpisodeAirDates(items);
  const [reviewsResult, seasonsResult, progressResult, episodeAirDatesResult] = await Promise.all([
    readBatchedRows(contentIds, (ids, from, to) => supabase
      .from("reviews")
      .select("content_id,rating,one_line_review")
      .in("content_id", ids)
      .order("id")
      .range(from, to)),
    readBatchedRows(contentIds, (ids, from, to) => supabase
      .from("seasons")
      .select("id,content_id,season_number,episode_count,title,air_year")
      .in("content_id", ids)
      .order("id")
      .range(from, to)),
    readBatchedRows(contentIds, (ids, from, to) => supabase
      .from("user_episode_progress")
      .select("content_id,episode_id,episodes(season_id,episode_number)")
      .in("content_id", ids)
      .order("id")
      .range(from, to)),
    readBatchedRows(episodeAirDateContentIds, (ids, from, to) => supabase
      .from("episodes")
      .select("content_id,air_date")
      .in("content_id", ids)
      .not("air_date", "is", null)
      .order("id")
      .range(from, to))
  ]);

  if (reviewsResult.error) throw new Error(reviewsResult.error.message);
  if (seasonsResult.error) throw new Error(seasonsResult.error.message);
  if (progressResult.error) throw new Error(progressResult.error.message);
  if (episodeAirDatesResult.error) throw new Error(episodeAirDatesResult.error.message);

  const reviewsByContentId = new Map(
    ((reviewsResult.data ?? []) as LibraryReviewRow[]).map((review) => [review.content_id, review])
  );
  const firstAirDateByContentId = createFirstAirDateByContentId(
    (episodeAirDatesResult.data ?? []) as EpisodeAirDateRow[]
  );
  const lastAirDateByContentId = createLastAirDateByContentId(
    (episodeAirDatesResult.data ?? []) as EpisodeAirDateRow[]
  );
  const seasonsByContentId = new Map<string, LibrarySeasonRow[]>();
  for (const season of (seasonsResult.data ?? []) as LibrarySeasonRow[]) {
    const contentSeasons = seasonsByContentId.get(season.content_id) ?? [];
    contentSeasons.push(season);
    seasonsByContentId.set(season.content_id, contentSeasons);
  }
  const progressByContentId = new Map<string, LibraryProgressRow[]>();
  for (const row of (progressResult.data ?? []) as unknown as LibraryProgressRow[]) {
    const contentProgress = progressByContentId.get(row.content_id) ?? [];
    contentProgress.push(row);
    progressByContentId.set(row.content_id, contentProgress);
  }

  return items.map((item) => {
    const review = reviewsByContentId.get(item.content_id);
    const contentSeasons = seasonsByContentId.get(item.content_id) ?? [];
    const matchedSeason = typeof item.season_number === "number"
      ? contentSeasons.find((season) => season.season_number === item.season_number)
      : undefined;
    const progressFields = getLibraryProgressFields(item, contentSeasons, progressByContentId.get(item.content_id) ?? []);

    return {
      ...item,
      title_primary: createSeasonDisplayTitle(item.title_primary, item.season_number, matchedSeason?.title ?? null),
      air_date: matchedSeason ? null : item.air_date ?? firstAirDateByContentId.get(item.content_id) ?? null,
      air_year: matchedSeason?.air_year ?? item.air_year,
      end_date: item.source_api === "anilist"
        ? item.end_date
        : item.end_date ??
          lastAirDateByContentId.get(item.content_id) ??
          (item.content_type === "movie" ? (item.air_date ?? firstAirDateByContentId.get(item.content_id) ?? null) : null),
      rating: review?.rating ?? null,
      one_line_review: review?.one_line_review ?? null,
      ...progressFields
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
  const [episodesResult, seasonResult] = await Promise.all([
    readAllRows((from, to) => supabase
      .from("episodes")
      .select("*")
      .eq("content_id", contentId)
      .eq("season_id", seasonId)
      .order("episode_number", { ascending: true })
      .order("id")
      .range(from, to), { rowKey: row => row.id }),
    supabase.from("seasons")
      .select("episode_count,episodes_synced_at,published_episode_numbers")
      .eq("id", seasonId).eq("content_id", contentId).maybeSingle()
  ]);
  if (episodesResult.error?.message === "ROW_LIMIT_EXCEEDED") throw new Error("회차가 너무 많아 불러오지 못했어요.");
  if (episodesResult.error) throw new Error(episodesResult.error.message);

  // A staged app may run before the new sync-marker columns have been applied.
  let season: { episode_count: number | null; episodes_synced_at?: string | null; published_episode_numbers?: number[] | null } | null = seasonResult.data;
  if (seasonResult.error && /episodes_synced_at|published_episode_numbers/.test(seasonResult.error.message)) {
    const legacy = await supabase.from("seasons").select("episode_count")
      .eq("id", seasonId).eq("content_id", contentId).maybeSingle();
    if (legacy.error) throw new Error(legacy.error.message);
    season = legacy.data;
  } else if (seasonResult.error) throw new Error(seasonResult.error.message);
  if (!season) throw new Error("시즌 정보를 찾지 못했어요. 작품을 다시 확인해 주세요.");

  const episodes = (episodesResult.data ?? []) as Episode[];
  if (isEpisodeListReusable(episodes, season.episode_count, season.episodes_synced_at, new Date(), season.published_episode_numbers)) {
    if (!hasKnownEpisodeCount(season.episode_count)) {
      const published = new Set(season.published_episode_numbers ?? []);
      return episodes.filter(episode => published.has(episode.episode_number));
    }
    return episodes;
  }

  const { data: functionData, error: functionError } = await supabase.functions.invoke<{
    episodes: Episode[];
    from_db: boolean;
    season_id: string;
    warning?: string;
  }>("fetch-episodes", {
    body: {
      content_id: contentId,
      season_id: seasonId,
      force_refresh: true
    }
  });

  if (functionError) throw new Error(functionError.message);
  const fresh = functionData?.episodes ?? [];
  if (hasKnownEpisodeCount(season.episode_count) && !isEpisodeListReusable(fresh, season.episode_count, null)) {
    throw new Error("회차 목록을 모두 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  return fresh;
}

export interface EpisodeAvailability {
  releasedEpisodes: { episode_number: number; title: string | null; air_date: string | null; url?: string | null }[];
  releasedEpisodesSource: string | null;
  releasedEpisodeNumber: number | null;
  upcomingEpisodeNumber: number | null;
  nextAirDate: string | null;
}

export async function getEpisodeAvailability(contentId: string, seasonId: string): Promise<EpisodeAvailability> {
  const { data, error } = await supabase.functions.invoke<{
    released_episodes?: EpisodeAvailability["releasedEpisodes"];
    released_episodes_source?: string;
    released_episode_number?: number | null;
    upcoming_episode_number?: number | null;
    next_air_date?: string | null;
    episodes?: Episode[];
  }>("fetch-episodes", {
    body: { content_id: contentId, season_id: seasonId, availability_only: true }
  });

  if (error) throw new Error(error.message);
  const fallbackEpisodes = data?.episodes ?? [];
  const fallbackUpcoming = upcomingEpisodeFromKnownDates(fallbackEpisodes);
  return {
    releasedEpisodes: data?.released_episodes ?? [],
    releasedEpisodesSource: data?.released_episodes_source ?? null,
    releasedEpisodeNumber: typeof data?.released_episode_number === "number"
      ? data.released_episode_number
      : releasedEpisodeFromKnownDates(fallbackEpisodes),
    upcomingEpisodeNumber: data?.upcoming_episode_number ?? fallbackUpcoming?.episodeNumber ?? null,
    nextAirDate: data?.next_air_date ?? fallbackUpcoming?.airDate ?? null
  };
}

export async function getEpisodeProgress(contentId: string): Promise<EpisodeProgress[]> {
  const { data, error } = await readAllRows((from, to) => supabase
    .from("user_episode_progress")
    .select("*")
    .eq("content_id", contentId)
    .order("id")
    .range(from, to), { rowKey: row => row.id });

  if (error?.message === "ROW_LIMIT_EXCEEDED") throw new Error("시청 기록이 너무 많아 불러오지 못했어요.");
  if (error) throw new Error(error.message);
  return (data ?? []) as EpisodeProgress[];
}

export async function toggleEpisodeProgress(
  episode: Episode,
  currentlyWatched: boolean
): Promise<void> {
  const { userId } = await getSessionUserId();
  if (!userId) throw new Error("로그인이 필요합니다");

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
      user_id: userId,
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
