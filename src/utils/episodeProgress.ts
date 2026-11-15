import type { ContentType } from "@/types/content";
import type { EpisodeProgressSource, LibraryListItem, SeasonEpisodeCount, WatchStatus } from "@/types/library";

export const MAX_MANUAL_EPISODE_NUMBER = 9999;

export interface EpisodeProgressInput {
  contentType: ContentType;
  episodeCount: number | null;
  watchedEpisodeCount: number;
  derivedWatchedThrough: number | null;
  manualWatchedThrough: number | null;
  completed?: boolean;
}

export interface ResolvedEpisodeProgress {
  source: EpisodeProgressSource;
  watchedThrough: number;
  nextEpisodeNumber: number | null;
  totalEpisodes: number | null;
  isComplete: boolean;
  progressRatio: number | null;
}

export type ManualProgressError =
  | "empty"
  | "not_a_number"
  | "negative"
  | "exceeds_season_total"
  | "exceeds_max";

export function resolveEpisodeProgress(input: EpisodeProgressInput): ResolvedEpisodeProgress {
  if (input.contentType === "movie") {
    return {
      source: "none",
      watchedThrough: 0,
      nextEpisodeNumber: null,
      totalEpisodes: null,
      isComplete: false,
      progressRatio: null,
    };
  }

  if (input.completed && input.episodeCount !== null && input.episodeCount > 0) {
    return {
      source: "completed",
      watchedThrough: input.episodeCount,
      nextEpisodeNumber: null,
      totalEpisodes: input.episodeCount,
      isComplete: true,
      progressRatio: 1,
    };
  }

  let source: EpisodeProgressSource = "none";
  let watchedThrough = 0;

  if (input.manualWatchedThrough !== null) {
    source = "manual";
    watchedThrough = clamp(
      input.manualWatchedThrough,
      0,
      input.episodeCount ?? MAX_MANUAL_EPISODE_NUMBER,
    );
  } else if (input.derivedWatchedThrough !== null && input.derivedWatchedThrough > 0) {
    source = "episode_progress";
    watchedThrough = Math.max(0, input.derivedWatchedThrough);
  } else if (input.watchedEpisodeCount > 0) {
    source = "episode_progress";
    watchedThrough = Math.max(0, input.watchedEpisodeCount);
  }

  const isComplete = input.episodeCount !== null && watchedThrough >= input.episodeCount;
  const nextEpisodeNumber = isComplete ? null : watchedThrough + 1;
  const progressRatio = input.episodeCount
    ? Math.min(1, watchedThrough / input.episodeCount)
    : null;

  return {
    source,
    watchedThrough,
    nextEpisodeNumber,
    totalEpisodes: input.episodeCount,
    isComplete,
    progressRatio,
  };
}

export function resolveLibraryItemProgress(
  item: Pick<LibraryListItem, "content_type" | "episode_count" | "watched_episode_count" | "derived_watched_through" | "manual_watched_absolute_number"> & Partial<Pick<LibraryListItem,
    "season_number" | "source_api" | "season_episode_counts" | "manual_watched_season_number" | "manual_watched_episode_number">>,
  statuses: readonly WatchStatus[]
): Pick<LibraryListItem, "progress_source" | "effective_watched_through" | "next_episode_number"> {
  const resolved = resolveEpisodeProgress({
    contentType: item.content_type, episodeCount: item.episode_count,
    watchedEpisodeCount: item.watched_episode_count, derivedWatchedThrough: item.derived_watched_through,
    manualWatchedThrough: manualProgressInLibraryScope(item), completed: statuses.includes("completed")
  });
  return { progress_source: resolved.source, effective_watched_through: resolved.watchedThrough, next_episode_number: resolved.nextEpisodeNumber };
}

/** Registration identity stays unchanged; AniList sequel IDs can own a single actual season 1. */
export function selectLibraryProgressSeasons<T extends SeasonEpisodeCount>(
  item: { season_number?: number | null; source_api?: string },
  seasons: readonly T[]
): T[] {
  if (item.season_number == null) return [...seasons];
  const exact = seasons.find((season) => season.season_number === item.season_number);
  if (exact) return [exact];
  return item.source_api === "anilist" && seasons.length === 1 ? [...seasons] : [];
}

function manualProgressInLibraryScope(item: Pick<LibraryListItem, "manual_watched_absolute_number"> & Partial<Pick<LibraryListItem,
  "season_number" | "source_api" | "season_episode_counts" | "manual_watched_season_number" | "manual_watched_episode_number">>): number | null {
  const absolute = item.manual_watched_absolute_number;
  if (absolute === null || item.season_number == null) return absolute;
  const seasons = item.season_episode_counts ?? [];
  const selectedSeason = selectLibraryProgressSeasons(item, seasons)[0];
  const actualSeason = selectedSeason?.season_number ?? item.season_number;
  // A same-season input is already relative, including a legacy null season pointer.
  if (item.manual_watched_episode_number != null &&
      (item.manual_watched_season_number == null || item.manual_watched_season_number === actualSeason)) {
    return item.manual_watched_episode_number;
  }
  if (!selectedSeason || seasons.some((season) => season.season_number < actualSeason && season.episode_count === null)) return null;
  const offset = createSeasonOffsetsByNumber(seasons).get(actualSeason) ?? 0;
  return Math.max(0, absolute - offset);
}

/** Keep a season registration's saved pointer inside its actual season, including episode zero. */
export function libraryManualProgressAfterToggle(
  item: LibraryListItem,
  seasonNumber: number | null,
  episodeNumber: number,
  watched: boolean
): { seasonNumber: number | null; episodeNumber: number } | null {
  if (item.manual_watched_episode_number === null) return null;
  if (item.season_number !== null) {
    const actualSeason = selectLibraryProgressSeasons(item, item.season_episode_counts)[0]?.season_number;
    if (actualSeason === undefined || actualSeason !== seasonNumber) return null;
    const manual = manualProgressInLibraryScope(item);
    const next = syncManualProgressAfterToggle({ manualWatchedThrough: manual, toggledAbsoluteNumber: episodeNumber, watched });
    return next === null || next === manual ? null : { seasonNumber: actualSeason, episodeNumber: next };
  }
  const absolute = toAbsoluteEpisodeNumber(seasonNumber, episodeNumber, createSeasonOffsetsByNumber(item.season_episode_counts));
  if (absolute === null) return null;
  const next = syncManualProgressAfterToggle({
    manualWatchedThrough: item.manual_watched_absolute_number, toggledAbsoluteNumber: absolute, watched
  });
  return next === null || next === item.manual_watched_absolute_number
    ? null : toSeasonRelativeEpisodeNumber(next, item.season_episode_counts);
}

/** Used by the optimistic cache and the same resolver as the initial service mapping. */
export function withLibraryManualProgress<T extends LibraryListItem>(
  item: T,
  progress: { seasonNumber: number | null; episodeNumber: number } | null
): T {
  const updated = {
    ...item,
    manual_watched_season_number: progress?.seasonNumber ?? null,
    manual_watched_episode_number: progress?.episodeNumber ?? null,
    manual_watched_absolute_number: progress === null ? null : toAbsoluteEpisodeNumber(
      progress.seasonNumber, progress.episodeNumber, createSeasonOffsetsByNumber(item.season_episode_counts)
    ),
    manual_progress_available: true
  };
  return { ...updated, ...resolveLibraryItemProgress(updated, updated.statuses) };
}

export function createSeasonOffsetsByNumber(
  seasons: SeasonEpisodeCount[],
): Map<number, number> {
  const offsets = new Map<number, number>();
  let offset = 0;

  for (const season of [...seasons].sort((a, b) => a.season_number - b.season_number)) {
    offsets.set(season.season_number, offset);
    offset += Math.max(0, season.episode_count ?? 0);
  }

  return offsets;
}

export function toAbsoluteEpisodeNumber(
  seasonNumber: number | null,
  episodeNumber: number | null,
  offsetsBySeasonNumber: Map<number, number>,
): number | null {
  if (episodeNumber === null) return null;
  if (episodeNumber === 0) return 0;
  return Math.max(0, offsetsBySeasonNumber.get(seasonNumber ?? Number.NaN) ?? 0) + episodeNumber;
}

export function toSeasonRelativeEpisodeNumber(
  absolute: number,
  seasons: SeasonEpisodeCount[],
): { seasonNumber: number | null; episodeNumber: number } {
  const normalizedAbsolute = Math.max(0, Math.floor(absolute));
  if (seasons.length === 0) {
    return { seasonNumber: null, episodeNumber: normalizedAbsolute };
  }

  const sortedSeasons = [...seasons].sort((a, b) => a.season_number - b.season_number);
  const offsets = createSeasonOffsetsByNumber(sortedSeasons);
  let selected = sortedSeasons[0]!;

  for (const season of sortedSeasons) {
    const offset = offsets.get(season.season_number) ?? 0;
    if (normalizedAbsolute > offset) selected = season;
  }

  const selectedOffset = offsets.get(selected.season_number) ?? 0;
  return {
    seasonNumber: selected.season_number,
    episodeNumber: normalizedAbsolute === 0 ? 0 : normalizedAbsolute - selectedOffset,
  };
}

export function syncManualProgressAfterToggle(params: {
  manualWatchedThrough: number | null;
  toggledAbsoluteNumber: number;
  watched: boolean;
}): number | null {
  const { manualWatchedThrough, toggledAbsoluteNumber, watched } = params;
  if (manualWatchedThrough === null) return null;

  if (watched) {
    return toggledAbsoluteNumber > manualWatchedThrough
      ? toggledAbsoluteNumber
      : manualWatchedThrough;
  }

  return manualWatchedThrough >= toggledAbsoluteNumber
    ? Math.max(0, toggledAbsoluteNumber - 1)
    : manualWatchedThrough;
}

export function normalizeManualEpisodeInput(params: {
  rawEpisodeNumber: string;
  seasonNumber: number | null;
  seasons: SeasonEpisodeCount[];
  totalEpisodes?: number | null;
}): { ok: true; episodeNumber: number } | { ok: false; reason: ManualProgressError } {
  const raw = params.rawEpisodeNumber.trim();
  if (!raw) return { ok: false, reason: "empty" };
  if (!/^-?\d+$/.test(raw)) return { ok: false, reason: "not_a_number" };

  const episodeNumber = Number(raw);
  if (!Number.isSafeInteger(episodeNumber)) return { ok: false, reason: "not_a_number" };
  if (episodeNumber < 0) return { ok: false, reason: "negative" };
  if (episodeNumber > MAX_MANUAL_EPISODE_NUMBER) return { ok: false, reason: "exceeds_max" };

  const selectedSeason = params.seasons.find(
    (season) => season.season_number === params.seasonNumber,
  );
  const upperBound = selectedSeason?.episode_count
    ?? params.totalEpisodes
    ?? MAX_MANUAL_EPISODE_NUMBER;
  if (episodeNumber > upperBound) {
    return { ok: false, reason: "exceeds_season_total" };
  }

  return { ok: true, episodeNumber };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
