const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_CANDIDATE_WINDOW_DAYS = 180;
export const RECENT_RELEASE_DAYS = 28;
export const WARM_RELEASE_DAYS = 90;
export const RECENT_RELEASE_BOOST = 1.5;
export const WARM_RELEASE_BOOST = 1.2;

export interface PopularRankingItem {
  external_source?: string | null;
  air_year: number | null;
  air_date?: string | null;
  popularity?: number | null;
  trendingIndex?: number | null;
  rank?: number | null;
}

export interface RankPopularOptions {
  now?: Date;
  poolLimit?: number;
}

interface RankingEntry<T extends PopularRankingItem> {
  item: T;
  index: number;
  popularityScore: number;
  finalScore: number;
  airTime: number;
}

interface PopularitySignal {
  groupKey: string;
  value: number;
  higherIsBetter: boolean;
}

export function rankPopularRecommendations<T extends PopularRankingItem>(
  items: T[],
  options: RankPopularOptions = {}
): T[] {
  const now = options.now ?? new Date();
  const entries = items.map((item, index) => ({
    item,
    index,
    popularityScore: 0,
    finalScore: 0,
    airTime: getAirTime(item.air_date)
  }));
  const scoresByIndex = createPopularityScores(entries);

  entries.forEach((entry) => {
    entry.popularityScore = scoresByIndex.get(entry.index) ?? 0;
    entry.finalScore = entry.popularityScore * getFreshnessBoost(entry.item.air_date, now);
  });

  const ranked = entries.sort(compareRankingEntries);
  const limited = typeof options.poolLimit === "number" ? ranked.slice(0, options.poolLimit) : ranked;

  return limited.map((entry) => entry.item);
}

export function isWithinCandidateWindow(
  item: Pick<PopularRankingItem, "air_date" | "air_year">,
  now = new Date(),
  windowDays = DEFAULT_CANDIDATE_WINDOW_DAYS
): boolean {
  const { startTime, endTime } = getCandidateWindowBounds(now, windowDays);
  const airTime = getAirTime(item.air_date);

  if (airTime !== 0) return airTime >= startTime && airTime <= endTime;
  if (!item.air_year) return false;

  const yearStart = Date.UTC(item.air_year, 0, 1);
  const yearEnd = Date.UTC(item.air_year, 11, 31);
  return yearStart <= endTime && yearEnd >= startTime;
}

export function getCandidateWindowBounds(now = new Date(), windowDays = DEFAULT_CANDIDATE_WINDOW_DAYS) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const normalizedWindowDays = Math.max(1, Math.floor(windowDays));
  const startTime = today - normalizedWindowDays * DAY_MS;
  const endTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0);

  return {
    startTime,
    endTime,
    startDate: formatDateInput(new Date(startTime)),
    endDate: formatDateInput(new Date(endTime))
  };
}

export function formatDateInput(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

export function toFuzzyDateNumber(date: Date): number {
  return date.getUTCFullYear() * 10_000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function compareRankingEntries<T extends PopularRankingItem>(
  a: RankingEntry<T>,
  b: RankingEntry<T>
): number {
  return (
    b.finalScore - a.finalScore ||
    b.airTime - a.airTime ||
    a.index - b.index
  );
}

function createPopularityScores<T extends PopularRankingItem>(
  entries: RankingEntry<T>[]
): Map<number, number> {
  const groups = new Map<string, { entry: RankingEntry<T>; signal: PopularitySignal }[]>();

  entries.forEach((entry) => {
    const signal = getPopularitySignal(entry.item);
    if (!signal) return;

    const current = groups.get(signal.groupKey) ?? [];
    current.push({ entry, signal });
    groups.set(signal.groupKey, current);
  });

  const scores = new Map<number, number>();
  groups.forEach((group) => {
    const sortedValues = Array.from(new Set(group.map(({ signal }) => signal.value))).sort((a, b) =>
      group[0]?.signal.higherIsBetter ? b - a : a - b
    );
    const denominator = Math.max(1, sortedValues.length - 1);

    group.forEach(({ entry, signal }) => {
      const valueIndex = sortedValues.indexOf(signal.value);
      const score = sortedValues.length === 1 ? 1 : (denominator - valueIndex) / denominator;
      scores.set(entry.index, score);
    });
  });

  return scores;
}

function getPopularitySignal(item: PopularRankingItem): PopularitySignal | null {
  const source = item.external_source ?? "unknown";
  if (isFiniteNumber(item.trendingIndex)) {
    return {
      groupKey: `${source}:trending`,
      value: item.trendingIndex,
      higherIsBetter: false
    };
  }

  if (isFiniteNumber(item.popularity)) {
    return {
      groupKey: `${source}:popularity`,
      value: item.popularity,
      higherIsBetter: true
    };
  }

  if (isFiniteNumber(item.rank)) {
    return {
      groupKey: `${source}:rank`,
      value: item.rank,
      higherIsBetter: false
    };
  }

  return null;
}

function getFreshnessBoost(airDate: string | null | undefined, now: Date): number {
  const airTime = getAirTime(airDate);
  if (airTime === 0) return 1;

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceAir = Math.floor((today - airTime) / DAY_MS);

  if (daysSinceAir <= RECENT_RELEASE_DAYS) return RECENT_RELEASE_BOOST;
  if (daysSinceAir <= WARM_RELEASE_DAYS) return WARM_RELEASE_BOOST;
  return 1;
}

function getAirTime(value: string | null | undefined): number {
  if (!value) return 0;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match?.[1] || !match[2] || !match[3]) return 0;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return 0;

  return Date.UTC(year, month - 1, day);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
