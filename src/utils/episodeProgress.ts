import type { ContentType } from "@/types/content";
import type { EpisodeProgressSource, SeasonEpisodeCount } from "@/types/library";

export const MAX_MANUAL_EPISODE_NUMBER = 9999;

export interface EpisodeProgressInput {
  contentType: ContentType;
  episodeCount: number | null;
  watchedEpisodeCount: number;
  derivedWatchedThrough: number | null;
  manualWatchedThrough: number | null;
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
  if (
    selectedSeason?.episode_count !== null
    && selectedSeason?.episode_count !== undefined
    && episodeNumber > selectedSeason.episode_count
  ) {
    return { ok: false, reason: "exceeds_season_total" };
  }

  return { ok: true, episodeNumber };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
