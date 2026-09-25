import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatUpcomingEpisodeDate,
  releasedEpisodeFromKnownDates,
  releasedUnwatchedCount,
  seasonToCheck,
  upcomingEpisodeDate,
  upcomingEpisodeFromKnownDates
} from "./airingAvailability";

const base = {
  content_type: "anime" as const,
  statuses: ["watching" as const],
  progress_source: "manual" as const,
  season_number: null,
  season_episode_counts: [{ season_number: 1, episode_count: 24 }],
  effective_watched_through: 12,
  next_episode_number: 13
};

describe("watching availability badge", () => {
  it("shows released unwatched episodes but excludes future ones", () => {
    assert.equal(seasonToCheck(base), 1);
    assert.equal(releasedUnwatchedCount(base, 1, 12), 0);
    assert.equal(releasedUnwatchedCount(base, 1, 13), 1);
    assert.equal(releasedUnwatchedCount(base, 1, 15), 3);
  });

  it("does not claim availability without verified release metadata", () => {
    assert.equal(releasedUnwatchedCount(base, 1, null), 0);
    assert.equal(releasedUnwatchedCount(base, 1, 30), 12);
  });

  it("uses the current season offset for a whole show", () => {
    const item = {
      ...base,
      content_type: "kdrama" as const,
      season_episode_counts: [
        { season_number: 1, episode_count: 12 },
        { season_number: 2, episode_count: 10 }
      ],
      effective_watched_through: 14,
      next_episode_number: 15
    };
    assert.equal(seasonToCheck(item), 2);
    assert.equal(releasedUnwatchedCount(item, 2, 4), 2);
    assert.equal(releasedUnwatchedCount(item, 1, 12), 0);
  });

  it("handles season-scoped registrations and unset or finished progress", () => {
    const seasonTwo = {
      ...base,
      season_number: 2,
      season_episode_counts: [
        { season_number: 1, episode_count: 12 },
        { season_number: 2, episode_count: 10 }
      ],
      effective_watched_through: 0,
      next_episode_number: 1
    };
    assert.equal(seasonToCheck(seasonTwo), 2);
    assert.equal(releasedUnwatchedCount(seasonTwo, 2, 3), 3);
    assert.equal(seasonToCheck({ ...base, progress_source: "none" }), null);
    assert.equal(seasonToCheck({ ...base, next_episode_number: null }), null);
    assert.equal(seasonToCheck({ ...base, statuses: ["completed"] }), null);
    assert.equal(seasonToCheck({ ...base, content_type: "movie" }), null);
  });

  it("uses dated episodes from an older server response without treating future episodes as released", () => {
    const episodes = [
      { episode_number: 12, air_date: "2026-09-23" },
      { episode_number: 13, air_date: "2026-09-24" },
      { episode_number: 14, air_date: "2026-09-25" },
      { episode_number: 15, air_date: null }
    ];
    assert.equal(releasedEpisodeFromKnownDates(episodes, new Date("2026-09-23T15:00:00Z")), 13);
    assert.equal(releasedEpisodeFromKnownDates([{ episode_number: 1, air_date: null }]), null);
  });

  it("shows the verified date only when it belongs to the next unwatched episode", () => {
    const schedule = { upcomingEpisodeNumber: 13, nextAirDate: "2026-09-26" };
    assert.equal(upcomingEpisodeDate(base, 1, schedule), "2026-09-26");
    assert.equal(formatUpcomingEpisodeDate("2026-09-26"), "26.09.26 공개 예정");
    assert.equal(upcomingEpisodeDate(base, 1, { ...schedule, upcomingEpisodeNumber: 14 }), null);
    assert.equal(upcomingEpisodeDate(base, 1, { ...schedule, nextAirDate: null }), null);
    assert.equal(upcomingEpisodeDate(base, 1, { ...schedule, nextAirDate: "invalid" }), null);
  });

  it("matches a season-scoped next episode without borrowing another season's schedule", () => {
    const item = {
      ...base,
      season_number: 2,
      season_episode_counts: [
        { season_number: 1, episode_count: 12 },
        { season_number: 2, episode_count: 10 }
      ],
      effective_watched_through: 0,
      next_episode_number: 1
    };
    assert.equal(upcomingEpisodeDate(item, 2, { upcomingEpisodeNumber: 1, nextAirDate: "2026-09-26" }), "2026-09-26");
    assert.equal(upcomingEpisodeDate(item, 1, { upcomingEpisodeNumber: 1, nextAirDate: "2026-09-26" }), null);
  });

  it("finds the nearest future date in a legacy episode response", () => {
    assert.deepEqual(upcomingEpisodeFromKnownDates([
      { episode_number: 14, air_date: "2026-10-03" },
      { episode_number: 13, air_date: "2026-09-26" },
      { episode_number: 12, air_date: "2026-09-23" }
    ], new Date("2026-09-23T15:00:00Z")), { episodeNumber: 13, airDate: "2026-09-26" });
  });
});
