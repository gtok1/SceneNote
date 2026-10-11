import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createSeasonOffsetsByNumber,
  normalizeManualEpisodeInput,
  resolveEpisodeProgress,
  resolveLibraryItemProgress,
  syncManualProgressAfterToggle,
  toAbsoluteEpisodeNumber,
  toSeasonRelativeEpisodeNumber,
} from "./episodeProgress";

describe("resolveEpisodeProgress", () => {
  const cases = [
    ["tv 1", "other", 24, 0, null, null, "none", 0, 1],
    ["tv 2", "other", 24, 0, null, 0, "manual", 0, 1],
    ["tv 3", "other", 24, 0, null, 12, "manual", 12, 13],
    ["tv 4", "other", 24, 5, 5, null, "episode_progress", 5, 6],
    ["tv 5", "other", 24, 5, 5, 12, "manual", 12, 13],
    ["tv 6", "other", 24, 20, 20, 3, "manual", 3, 4],
    ["tv 7", "other", 24, 0, null, 24, "manual", 24, null],
    ["tv 8", "other", 24, 0, null, 99, "manual", 24, null],
    ["tv 9", "other", null, 0, null, 12, "manual", 12, 13],
    ["tv 10", "other", null, 3, null, null, "episode_progress", 3, 4],
    ["anime 11", "anime", 12, 12, 12, null, "episode_progress", 12, null],
    ["movie 12", "movie", null, 0, null, 5, "none", 0, null],
    ["tv 13", "other", 24, 0, null, -1, "manual", 0, 1],
  ] as const;

  for (const [name, contentType, episodeCount, watchedEpisodeCount, derived, manual, source, watched, next] of cases) {
    it(name, () => {
      const result = resolveEpisodeProgress({
        contentType,
        episodeCount,
        watchedEpisodeCount,
        derivedWatchedThrough: derived,
        manualWatchedThrough: manual,
      });

      assert.equal(result.source, source);
      assert.equal(result.watchedThrough, watched);
      assert.equal(result.nextEpisodeNumber, next);
    });
  }
});

describe("syncManualProgressAfterToggle", () => {
  const cases = [
    [null, 5, true, null],
    [null, 5, false, null],
    [3, 5, true, 5],
    [8, 5, true, 8],
    [5, 5, true, 5],
    [8, 5, false, 4],
    [5, 5, false, 4],
    [3, 5, false, 3],
    [1, 1, false, 0],
  ] as const;

  for (const [manualWatchedThrough, toggledAbsoluteNumber, watched, expected] of cases) {
    it(`${String(manualWatchedThrough)} / ${toggledAbsoluteNumber} / ${watched}`, () => {
      assert.equal(
        syncManualProgressAfterToggle({ manualWatchedThrough, toggledAbsoluteNumber, watched }),
        expected,
      );
    });
  }
});

describe("season-relative episode conversion", () => {
  const seasons = [
    { season_number: 1, episode_count: 12 },
    { season_number: 2, episode_count: 13 },
    { season_number: 3, episode_count: null },
  ];
  const offsets = createSeasonOffsetsByNumber(seasons);
  const cases = [
    [1, 5, 5],
    [2, 3, 15],
    [3, 1, 26],
    [null, 7, 7],
    [2, 0, 0],
    [1, null, null],
    [99, 4, 4],
  ] as const;

  it("creates cumulative offsets", () => {
    assert.deepEqual([...offsets.entries()], [[1, 0], [2, 12], [3, 25]]);
  });

  for (const [seasonNumber, episodeNumber, expected] of cases) {
    it(`converts (${String(seasonNumber)}, ${String(episodeNumber)}) to ${String(expected)}`, () => {
      assert.equal(toAbsoluteEpisodeNumber(seasonNumber, episodeNumber, offsets), expected);
    });
  }

  for (const [seasonNumber, episodeNumber] of cases.slice(0, 3)) {
    it(`round-trips (${String(seasonNumber)}, ${String(episodeNumber)})`, () => {
      const absolute = toAbsoluteEpisodeNumber(seasonNumber, episodeNumber, offsets);
      assert.notEqual(absolute, null);
      assert.deepEqual(toSeasonRelativeEpisodeNumber(absolute!, seasons), { seasonNumber, episodeNumber });
    });
  }
});

describe("normalizeManualEpisodeInput", () => {
  const seasons = [{ season_number: 1, episode_count: 12 }];

  it("rejects empty input", () => {
    assert.deepEqual(normalizeManualEpisodeInput({ rawEpisodeNumber: "", seasonNumber: 1, seasons }), { ok: false, reason: "empty" });
  });

  it("rejects non-numeric input", () => {
    assert.deepEqual(normalizeManualEpisodeInput({ rawEpisodeNumber: "abc", seasonNumber: 1, seasons }), { ok: false, reason: "not_a_number" });
  });

  it("rejects negative input", () => {
    assert.deepEqual(normalizeManualEpisodeInput({ rawEpisodeNumber: "-1", seasonNumber: 1, seasons }), { ok: false, reason: "negative" });
  });

  it("rejects input above the selected season total", () => {
    assert.deepEqual(normalizeManualEpisodeInput({ rawEpisodeNumber: "13", seasonNumber: 1, seasons }), { ok: false, reason: "exceeds_season_total" });
  });

  it("rejects input above the global maximum", () => {
    assert.deepEqual(normalizeManualEpisodeInput({ rawEpisodeNumber: "10000", seasonNumber: null, seasons: [] }), { ok: false, reason: "exceeds_max" });
  });

  it("uses the total episode count when the selected season total is unknown", () => {
    assert.deepEqual(normalizeManualEpisodeInput({ rawEpisodeNumber: "25", seasonNumber: 1, seasons: [{ season_number: 1, episode_count: null }], totalEpisodes: 24 }), { ok: false, reason: "exceeds_season_total" });
  });

  it("accepts the total episode count boundary when the selected season total is unknown", () => {
    assert.deepEqual(normalizeManualEpisodeInput({ rawEpisodeNumber: "24", seasonNumber: 1, seasons: [{ season_number: 1, episode_count: null }], totalEpisodes: 24 }), { ok: true, episodeNumber: 24 });
  });

  it("prefers the selected season total over the content total", () => {
    assert.deepEqual(normalizeManualEpisodeInput({ rawEpisodeNumber: "13", seasonNumber: 1, seasons: [{ season_number: 1, episode_count: 12 }], totalEpisodes: 24 }), { ok: false, reason: "exceeds_season_total" });
  });

  it("accepts 500 when no total is known", () => {
    assert.deepEqual(normalizeManualEpisodeInput({ rawEpisodeNumber: "500", seasonNumber: null, seasons: [], totalEpisodes: null }), { ok: true, episodeNumber: 500 });
  });

  it("still rejects the global maximum when no total is known", () => {
    assert.deepEqual(normalizeManualEpisodeInput({ rawEpisodeNumber: "10000", seasonNumber: null, seasons: [], totalEpisodes: null }), { ok: false, reason: "exceeds_max" });
  });
});

// Keep the spec's non-movie "drama" fixture without widening the app ContentType enum.
const completedBase = {
  contentType: "drama" as import("@/types/content").ContentType,
  episodeCount: 10, watchedEpisodeCount: 3, derivedWatchedThrough: 3, manualWatchedThrough: 8
};
const manualExpected = {source:"manual",watchedThrough:8,nextEpisodeNumber:9,totalEpisodes:10,isComplete:false,progressRatio:0.8};
it("P-1 completed status takes precedence over saved manual progress", () => {
  assert.deepEqual(resolveEpisodeProgress({...completedBase,completed:true}), {source:"completed",watchedThrough:10,nextEpisodeNumber:null,totalEpisodes:10,isComplete:true,progressRatio:1});
});
it("P-2 preserves manual progress without completed status", () => {
  assert.deepEqual(resolveEpisodeProgress({...completedBase,completed:false}), manualExpected);
});
it("P-3 preserves unknown episode totals when completed", () => {
  const result=resolveEpisodeProgress({...completedBase,episodeCount:null,completed:true});
  assert.equal(result.source,"manual"); assert.equal(result.watchedThrough,8);
  assert.equal(result.isComplete,false); assert.equal(result.totalEpisodes,null);
});
it("P-4 preserves movie progress behavior when completed", () => {
  const result=resolveEpisodeProgress({...completedBase,contentType:"movie",completed:true});
  assert.equal(result.source,"none"); assert.equal(result.watchedThrough,0); assert.equal(result.progressRatio,null);
});
it("P-5 completes newly added anime without existing progress", () => {
  const result=resolveEpisodeProgress({contentType:"anime",episodeCount:12,watchedEpisodeCount:0,derivedWatchedThrough:null,manualWatchedThrough:null,completed:true});
  assert.equal(result.source,"completed"); assert.equal(result.watchedThrough,12); assert.equal(result.nextEpisodeNumber,null);
});
it("P-6 preserves default behavior without a completed input", () => {
  assert.deepEqual(resolveEpisodeProgress(completedBase), manualExpected);
});
it("P-7 recalculates library progress when completed is toggled", () => {
  const item={content_type:completedBase.contentType,episode_count:10,watched_episode_count:3,derived_watched_through:3,manual_watched_absolute_number:8};
  assert.deepEqual(resolveLibraryItemProgress(item,["completed","recommended"]), {progress_source:"completed",effective_watched_through:10,next_episode_number:null});
  assert.deepEqual(resolveLibraryItemProgress(item,["watching"]), {progress_source:"manual",effective_watched_through:8,next_episode_number:9});
});
it("P-8 preserves zero-total clamping when completed", () => {
  const result=resolveEpisodeProgress({...completedBase,completed:true,episodeCount:0});
  assert.equal(result.source,"manual"); assert.equal(result.watchedThrough,0);
});
