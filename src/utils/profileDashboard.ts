import type { LibraryListItem } from "@/types/library";
import { createDisplayGenreNames } from "@/utils/genre";
import { getHomeLayout } from "@/utils/homeLayout";
import {
  type ContentTypeStat,
  type LibraryStatusSummary,
  isWatchedLibraryItem,
  yearFromDate
} from "@/utils/profileStats";

export const YEAR_CHART_MAX_BARS = 8;
export const YEAR_CHART_MAX_BARS_WIDE = 12;
export const GENRE_TOP_COUNT = 5;
// 타입별 분포와 겹치는 태그라 취향 장르 집계에서는 뺀다.
export const TYPE_OVERLAP_GENRES: readonly string[] = ["드라마", "애니메이션"];

export interface ProfileLayout {
  gutter: number;
  contentWidth: number;
  gap: number;
  metricColumns: 2 | 4;
  metricWidth: number;
  dashboardColumns: 1 | 2;
  panelWidth: number;
  panelWide: boolean;
}

export function getProfileLayout(width: number): ProfileLayout {
  const w = Number.isFinite(width) && width > 0 ? width : 375;
  const home = getHomeLayout(w);
  const gap = home.posterGap;
  const metricColumns = w < 600 ? 2 : 4;
  const dashboardColumns = w >= 960 ? 2 : 1;
  const panelWidth =
    dashboardColumns === 2 ? Math.floor((home.contentWidth - gap) / 2) : home.contentWidth;

  return {
    gutter: home.gutter,
    contentWidth: home.contentWidth,
    gap,
    metricColumns,
    metricWidth: Math.floor((home.contentWidth - gap * (metricColumns - 1)) / metricColumns),
    dashboardColumns,
    panelWidth,
    panelWide: panelWidth >= 440
  };
}

export type ProfileMetricIcon =
  | "albums-outline"
  | "eye-outline"
  | "checkmark-done-outline"
  | "pin-outline";

export interface ProfileMetric {
  key: "total" | "watched" | "completed" | "pins";
  label: string;
  value: string;
  caption: string | null;
  icon: ProfileMetricIcon;
}

export function formatCount(value: number | null | undefined): string {
  return value == null ? "--" : value.toLocaleString("ko-KR");
}

// 네 숫자가 서로 포함 관계로 읽히도록 캡션에 차이를 밝힌다: 등록 = 본 작품 + 보고 싶음, 본 작품 = 완료 + 그 외.
export function createProfileMetrics(input: {
  summary: LibraryStatusSummary | null;
  pins: number | null | undefined;
}): ProfileMetric[] {
  const { summary, pins } = input;

  return [
    {
      key: "total",
      label: "등록 작품",
      value: formatCount(summary?.total),
      caption: summary && summary.wishlistOnly > 0 ? `보고 싶음 ${formatCount(summary.wishlistOnly)}개 포함` : null,
      icon: "albums-outline"
    },
    {
      key: "watched",
      label: "본 작품",
      value: formatCount(summary?.watched),
      caption:
        summary && summary.watchedNotCompleted > 0
          ? `보는 중·보류 등 ${formatCount(summary.watchedNotCompleted)}개 포함`
          : null,
      icon: "eye-outline"
    },
    {
      key: "completed",
      label: "완료",
      value: formatCount(summary?.completed),
      caption:
        summary && summary.watched > 0
          ? `본 작품의 ${Math.round((summary.completed / summary.watched) * 100)}%`
          : null,
      icon: "checkmark-done-outline"
    },
    { key: "pins", label: "핀", value: formatCount(pins), caption: null, icon: "pin-outline" }
  ];
}

export function createTypeDistribution(stats: readonly ContentTypeStat[]): ContentTypeStat[] {
  return stats.filter((stat) => stat.count > 0).sort((a, b) => b.count - a.count);
}

export function formatPercent(percent: number): string {
  if (percent > 0 && percent < 1) return "1% 미만";
  return `${Math.round(percent)}%`;
}

export interface GenreRankRow {
  name: string;
  count: number;
  percent: number;
  colorIndex: number;
}

export interface GenreRanking {
  rows: GenreRankRow[];
  itemCount: number;
}

// RPC(get_genre_stats)는 content_id 기준이라 등록 작품 수와 기준이 다르다. 라이브러리 행에서 직접 세어 같은 분모를 쓴다.
export function createGenreRanking(
  items: readonly Pick<LibraryListItem, "genres">[],
  top = GENRE_TOP_COUNT
): GenreRanking {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    createDisplayGenreNames(item.genres)
      .filter((genre) => !TYPE_OVERLAP_GENRES.includes(genre))
      .forEach((genre) => counts.set(genre, (counts.get(genre) ?? 0) + 1));
  });

  const sorted = Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko-KR")
  );

  return {
    rows: sorted.slice(0, top).map((row, index) => ({
      ...row,
      percent: items.length > 0 ? (row.count / items.length) * 100 : 0,
      colorIndex: index
    })),
    itemCount: items.length
  };
}

export interface YearComparisonBar {
  year: number;
  watchedCount: number;
  releasedCount: number;
  watchedRatio: number;
  releasedRatio: number;
}

export interface YearComparisonModel {
  bars: YearComparisonBar[];
  watchedTotal: number;
  datedCount: number;
  undatedCount: number;
  unknownReleaseCount: number;
  omittedYearCount: number;
  firstVisibleYear: number | null;
  peakWatchedYear: number | null;
  peakReleasedYear: number | null;
  currentYear: number;
  currentYearWatched: number;
}

// 본 작품 한 묶음을 "본 해"(마지막 감상일)와 "공개 연도"(방영·개봉) 두 기준으로 같은 축에 나란히 센다.
export function createYearComparisonModel(
  items: readonly LibraryListItem[],
  options: { maxBars?: number; now?: Date } = {}
): YearComparisonModel {
  const maxBars = options.maxBars ?? YEAR_CHART_MAX_BARS;
  const currentYear = (options.now ?? new Date()).getFullYear();
  const watchedByYear = new Map<number, number>();
  const releasedByYear = new Map<number, number>();
  let watchedTotal = 0;
  let datedCount = 0;
  let unknownReleaseCount = 0;

  items.forEach((item) => {
    if (!isWatchedLibraryItem(item)) return;
    watchedTotal += 1;

    const watchedYear = yearFromDate(item.last_watched_at);
    if (watchedYear) {
      datedCount += 1;
      watchedByYear.set(watchedYear, (watchedByYear.get(watchedYear) ?? 0) + 1);
    }

    if (item.air_year) {
      releasedByYear.set(item.air_year, (releasedByYear.get(item.air_year) ?? 0) + 1);
    } else {
      unknownReleaseCount += 1;
    }
  });

  const years = Array.from(new Set([...watchedByYear.keys(), ...releasedByYear.keys()])).sort((a, b) => b - a);
  const visibleYears = years.slice(0, maxBars).reverse();
  const maxCount = Math.max(
    1,
    ...visibleYears.map((year) => Math.max(watchedByYear.get(year) ?? 0, releasedByYear.get(year) ?? 0))
  );

  return {
    bars: visibleYears.map((year) => {
      const watchedCount = watchedByYear.get(year) ?? 0;
      const releasedCount = releasedByYear.get(year) ?? 0;
      return {
        year,
        watchedCount,
        releasedCount,
        watchedRatio: watchedCount / maxCount,
        releasedRatio: releasedCount / maxCount
      };
    }),
    watchedTotal,
    datedCount,
    undatedCount: watchedTotal - datedCount,
    unknownReleaseCount,
    omittedYearCount: years.length - visibleYears.length,
    firstVisibleYear: visibleYears[0] ?? null,
    peakWatchedYear: peakYear(watchedByYear),
    peakReleasedYear: peakYear(releasedByYear),
    currentYear,
    currentYearWatched: watchedByYear.get(currentYear) ?? 0
  };
}

function peakYear(counts: ReadonlyMap<number, number>): number | null {
  let peak: { year: number; count: number } | null = null;
  for (const [year, count] of counts) {
    if (!peak || count > peak.count || (count === peak.count && year > peak.year)) peak = { year, count };
  }
  return peak?.year ?? null;
}

export function yearComparisonFootnotes(model: YearComparisonModel): string[] {
  const notes: string[] = [];
  if (model.undatedCount > 0) {
    notes.push(
      `감상일이 기록된 작품은 ${formatCount(model.datedCount)}개예요. 나머지 ${formatCount(model.undatedCount)}개는 '본 해'에 나오지 않아요.`
    );
  }
  if (model.unknownReleaseCount > 0) {
    notes.push(`공개 연도를 모르는 ${formatCount(model.unknownReleaseCount)}개는 '공개 연도'에서 뺐어요.`);
  }
  if (model.omittedYearCount > 0 && model.firstVisibleYear !== null) {
    notes.push(`${model.firstVisibleYear}년보다 이전 연도 ${model.omittedYearCount}개는 생략했어요.`);
  }
  return notes;
}

export function yearComparisonAccessibilityLabel(model: YearComparisonModel): string {
  if (model.bars.length === 0) return "연도별 본 작품 기록이 없어요";
  return `연도별 본 작품: ${model.bars
    .map((bar) => `${bar.year}년 본 해 ${bar.watchedCount}개, 공개 ${bar.releasedCount}개`)
    .join(" / ")}`;
}

export function userFacingErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && /[가-힣]/.test(error.message) ? error.message : fallback;
}
