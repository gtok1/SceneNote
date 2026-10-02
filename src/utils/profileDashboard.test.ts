import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LibraryListItem, WatchStatus } from "@/types/library";

import {
  GENRE_TOP_COUNT,
  YEAR_CHART_MAX_BARS,
  YEAR_CHART_MAX_BARS_WIDE,
  createGenreRanking,
  createProfileMetrics,
  createTypeDistribution,
  createYearComparisonModel,
  formatPercent,
  getProfileLayout,
  userFacingErrorMessage,
  yearComparisonAccessibilityLabel,
  yearComparisonFootnotes
} from "./profileDashboard";
import type { ContentTypeStat, LibraryStatusSummary } from "./profileStats";

function libraryItem(overrides: Partial<LibraryListItem>): LibraryListItem {
  return {
    content_type: "anime",
    genres: [],
    statuses: ["completed"] as WatchStatus[],
    watch_count: 0,
    last_watched_at: null,
    added_at: "2020-01-15T12:00:00Z",
    air_year: null,
    ...overrides
  } as LibraryListItem;
}

const layout = (
  gutter: number,
  contentWidth: number,
  gap: number,
  metricColumns: 2 | 4,
  metricWidth: number,
  dashboardColumns: 1 | 2,
  panelWidth: number,
  panelWide: boolean
) => ({ gutter, contentWidth, gap, metricColumns, metricWidth, dashboardColumns, panelWidth, panelWide });

describe("getProfileLayout", () => {
  it("L-1 375", () => assert.deepEqual(getProfileLayout(375), layout(16, 343, 12, 2, 165, 1, 343, false)));
  it("L-2 599", () => assert.deepEqual(getProfileLayout(599), layout(16, 567, 12, 2, 277, 1, 567, true)));
  it("L-3 600", () => assert.deepEqual(getProfileLayout(600), layout(24, 552, 16, 4, 126, 1, 552, true)));
  it("L-4 768", () => assert.deepEqual(getProfileLayout(768), layout(24, 720, 16, 4, 168, 1, 720, true)));
  it("L-5 959", () => assert.deepEqual(getProfileLayout(959), layout(24, 911, 16, 4, 215, 1, 911, true)));
  it("L-6 960", () => assert.deepEqual(getProfileLayout(960), layout(24, 912, 16, 4, 216, 2, 448, true)));
  it("L-7 2000", () => assert.deepEqual(getProfileLayout(2000), layout(24, 1152, 16, 4, 276, 2, 568, true)));
  it("L-8 invalid widths fall back to 375", () => {
    const expected = getProfileLayout(375);
    assert.deepEqual(getProfileLayout(NaN), expected);
    assert.deepEqual(getProfileLayout(0), expected);
    assert.deepEqual(getProfileLayout(-1), expected);
  });
});

describe("createProfileMetrics", () => {
  const summary: LibraryStatusSummary = { total: 560, watched: 536, wishlistOnly: 24, completed: 514, watchedNotCompleted: 22 };

  it("M-1 nests registered, watched and completed counts", () => {
    assert.deepEqual(createProfileMetrics({ summary, pins: 3 }), [
      { key: "total", label: "등록 작품", value: "560", caption: "보고 싶음 24개 포함", icon: "albums-outline" },
      { key: "watched", label: "본 작품", value: "536", caption: "보는 중·보류 등 22개 포함", icon: "eye-outline" },
      { key: "completed", label: "완료", value: "514", caption: "본 작품의 96%", icon: "checkmark-done-outline" },
      { key: "pins", label: "핀", value: "3", caption: null, icon: "pin-outline" }
    ]);
  });
  it("M-2 shows -- and no captions before the library loads", () => {
    const metrics = createProfileMetrics({ summary: null, pins: undefined });
    assert.deepEqual(metrics.map((m) => m.value), ["--", "--", "--", "--"]);
    assert.ok(metrics.every((m) => m.caption === null));
  });
  it("M-3 omits empty differences and formats thousands", () => {
    const zero = createProfileMetrics({
      summary: { total: 0, watched: 0, wishlistOnly: 0, completed: 0, watchedNotCompleted: 0 },
      pins: 0
    });
    assert.ok(zero.every((m) => m.caption === null));
    const big = createProfileMetrics({
      summary: { total: 1234, watched: 1000, wishlistOnly: 234, completed: 1000, watchedNotCompleted: 0 },
      pins: 0
    });
    assert.deepEqual(big.map((m) => m.value), ["1,234", "1,000", "1,000", "0"]);
    assert.deepEqual(big.map((m) => m.caption), ["보고 싶음 234개 포함", null, "본 작품의 100%", null]);
  });
});

describe("type distribution", () => {
  const stat = (type: ContentTypeStat["type"], count: number): ContentTypeStat => ({
    type,
    label: type,
    count,
    percent: 0
  });
  it("T-1 hides zero and sorts by count", () => {
    const rows = createTypeDistribution([
      stat("anime", 155),
      stat("kdrama", 273),
      stat("jdrama", 70),
      stat("foreign_drama", 0),
      stat("movie", 53),
      stat("other", 9)
    ]);
    assert.deepEqual(rows.map((r) => r.type), ["kdrama", "anime", "jdrama", "movie", "other"]);
  });
  it("T-2 keeps input order on ties", () => {
    const rows = createTypeDistribution([stat("anime", 2), stat("kdrama", 2)]);
    assert.deepEqual(rows.map((r) => r.type), ["anime", "kdrama"]);
  });
  it("T-3 formats percents", () => {
    assert.equal(formatPercent(48.75), "49%");
    assert.equal(formatPercent(0.4), "1% 미만");
    assert.equal(formatPercent(0), "0%");
    assert.equal(formatPercent(100), "100%");
  });
});

describe("createGenreRanking", () => {
  const withGenres = (...genres: string[]) => ({ genres });

  it("G-1 counts library rows per genre with the registered total as denominator", () => {
    const ranking = createGenreRanking([
      withGenres("Comedy", "로맨스"),
      withGenres("코미디"),
      withGenres("코미디", "액션"),
      withGenres()
    ]);
    assert.equal(ranking.itemCount, 4);
    assert.deepEqual(
      ranking.rows.map((row) => [row.name, row.count, row.percent, row.colorIndex]),
      [
        ["코미디", 3, 75, 0],
        ["로맨스", 1, 25, 1],
        ["액션", 1, 25, 2]
      ]
    );
  });
  it("G-2 keeps the top five only", () => {
    const ranking = createGenreRanking([
      withGenres("코미디", "로맨스", "액션", "스릴러", "범죄", "판타지"),
      withGenres("코미디")
    ]);
    assert.equal(ranking.rows.length, GENRE_TOP_COUNT);
    assert.equal(ranking.rows[0]!.name, "코미디");
  });
  it("G-3 ties sort by Korean name", () => {
    const ranking = createGenreRanking([withGenres("액션", "로맨스")]);
    assert.deepEqual(ranking.rows.map((row) => row.name), ["로맨스", "액션"]);
  });
  it("G-4 excludes genres that duplicate the type distribution", () => {
    const ranking = createGenreRanking([withGenres("드라마", "애니메이션", "로맨스"), withGenres("드라마")]);
    assert.deepEqual(ranking.rows.map((row) => [row.name, row.percent]), [["로맨스", 50]]);
  });
  it("G-5 empty input", () => {
    assert.deepEqual(createGenreRanking([]), { rows: [], itemCount: 0 });
  });
});

describe("year comparison", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const items = [
    libraryItem({ last_watched_at: "2026-03-15T12:00:00Z", air_year: 2024 }),
    libraryItem({ last_watched_at: "2026-05-15T12:00:00Z", air_year: 2026 }),
    libraryItem({ last_watched_at: "2025-05-15T12:00:00Z", air_year: 2024 }),
    libraryItem({ air_year: 2024 }),
    libraryItem({ air_year: null }),
    libraryItem({ statuses: ["wishlist"], air_year: 2026, last_watched_at: "2026-06-15T12:00:00Z" })
  ];
  const model = createYearComparisonModel(items, { now });

  it("Y-1 counts watched items by watched year and release year on one axis", () => {
    assert.deepEqual(model.bars, [
      { year: 2024, watchedCount: 0, releasedCount: 3, watchedRatio: 0, releasedRatio: 1 },
      { year: 2025, watchedCount: 1, releasedCount: 0, watchedRatio: 1 / 3, releasedRatio: 0 },
      { year: 2026, watchedCount: 2, releasedCount: 1, watchedRatio: 2 / 3, releasedRatio: 1 / 3 }
    ]);
  });
  it("Y-2 summarizes the same watched population", () => {
    assert.deepEqual(
      {
        watchedTotal: model.watchedTotal,
        datedCount: model.datedCount,
        undatedCount: model.undatedCount,
        unknownReleaseCount: model.unknownReleaseCount,
        peakWatchedYear: model.peakWatchedYear,
        peakReleasedYear: model.peakReleasedYear,
        currentYear: model.currentYear,
        currentYearWatched: model.currentYearWatched
      },
      {
        watchedTotal: 5,
        datedCount: 3,
        undatedCount: 2,
        unknownReleaseCount: 1,
        peakWatchedYear: 2026,
        peakReleasedYear: 2024,
        currentYear: 2026,
        currentYearWatched: 2
      }
    );
  });
  it("Y-3 keeps the latest years and reports omitted ones", () => {
    const many = Array.from({ length: 10 }, (_, i) => libraryItem({ air_year: 2026 - i }));
    const limited = createYearComparisonModel(many, { now });
    assert.deepEqual(limited.bars.map((bar) => bar.year), [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    assert.equal(limited.omittedYearCount, 2);
    assert.equal(limited.firstVisibleYear, 2019);
    assert.equal(createYearComparisonModel(many, { now, maxBars: YEAR_CHART_MAX_BARS_WIDE }).bars.length, 10);
  });
  it("Y-4 peak ties go to the later year", () => {
    const tie = createYearComparisonModel(
      [libraryItem({ air_year: 2024 }), libraryItem({ air_year: 2025 })],
      { now }
    );
    assert.equal(tie.peakReleasedYear, 2025);
    assert.equal(tie.peakWatchedYear, null);
  });
  it("Y-5 empty model", () => {
    assert.deepEqual(createYearComparisonModel([], { now }), {
      bars: [],
      watchedTotal: 0,
      datedCount: 0,
      undatedCount: 0,
      unknownReleaseCount: 0,
      omittedYearCount: 0,
      firstVisibleYear: null,
      peakWatchedYear: null,
      peakReleasedYear: null,
      currentYear: 2026,
      currentYearWatched: 0
    });
  });
  it("Y-6 footnotes explain what the bars leave out", () => {
    assert.deepEqual(yearComparisonFootnotes(model), [
      "감상일이 기록된 작품은 3개예요. 나머지 2개는 '본 해'에 나오지 않아요.",
      "공개 연도를 모르는 1개는 '공개 연도'에서 뺐어요."
    ]);
    const many = Array.from({ length: 10 }, (_, i) => libraryItem({ air_year: 2026 - i, last_watched_at: "2026-03-15T12:00:00Z" }));
    assert.deepEqual(yearComparisonFootnotes(createYearComparisonModel(many, { now })), [
      "2019년보다 이전 연도 2개는 생략했어요."
    ]);
    assert.deepEqual(yearComparisonFootnotes(createYearComparisonModel([], { now })), []);
  });
  it("Y-7 accessibility label", () => {
    assert.equal(
      yearComparisonAccessibilityLabel(model),
      "연도별 본 작품: 2024년 본 해 0개, 공개 3개 / 2025년 본 해 1개, 공개 0개 / 2026년 본 해 2개, 공개 1개"
    );
    assert.equal(yearComparisonAccessibilityLabel(createYearComparisonModel([], { now })), "연도별 본 작품 기록이 없어요");
  });
});

it("E-1 userFacingErrorMessage keeps Korean error messages only", () => {
  assert.equal(userFacingErrorMessage(new Error("닉네임을 입력해 주세요."), "fb"), "닉네임을 입력해 주세요.");
  assert.equal(userFacingErrorMessage(new Error("duplicate key value"), "fb"), "fb");
  assert.equal(userFacingErrorMessage("오류", "fb"), "fb");
  assert.equal(userFacingErrorMessage(null, "fb"), "fb");
});

it("C-1 constants", () => {
  assert.equal(YEAR_CHART_MAX_BARS, 8);
  assert.equal(YEAR_CHART_MAX_BARS_WIDE, 12);
  assert.equal(GENRE_TOP_COUNT, 5);
});
