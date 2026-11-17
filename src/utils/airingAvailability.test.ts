import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as airingAvailability from "./airingAvailability";
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


it("season progress does not subtract the previous season again for release and schedule badges", () => {
  const item = {
    ...base, source_api: "tmdb" as const, season_number: 2,
    season_episode_counts: [{ season_number: 1, episode_count: 10 }, { season_number: 2, episode_count: 10 }],
    effective_watched_through: 3, next_episode_number: 4
  };
  assert.equal(releasedUnwatchedCount(item, 2, 5), 2);
  assert.equal(upcomingEpisodeDate(item, 2, { upcomingEpisodeNumber: 4, nextAirDate: "2026-10-28" }), "2026-10-28");
  assert.equal(upcomingEpisodeDate(item, 2, { upcomingEpisodeNumber: 1, nextAirDate: "2026-10-28" }), null);
});

it("AniList third-season registration checks its standalone actual season one", () => {
  const item = {
    ...base, source_api: "anilist" as const, season_number: 3,
    season_episode_counts: [{ season_number: 1, episode_count: 12 }],
    effective_watched_through: 3, next_episode_number: 4
  };
  assert.equal(seasonToCheck(item), 1);
  assert.equal(releasedUnwatchedCount(item, 1, 5), 2);
  assert.equal(upcomingEpisodeDate(item, 1, { upcomingEpisodeNumber: 4, nextAirDate: "2026-10-28" }), "2026-10-28");
});

it("a missing registered TMDB season does not borrow another season's availability", () => {
  assert.equal(seasonToCheck({ ...base, source_api: "tmdb", season_number: 3 }), null);
});

describe("docs/71 airing availability lookup plan", () => {
  const todayKst = "2026-11-16";
  const watching = {
    ...base,
    source_api: "anilist" as const,
    end_date: "2026-11-15",
    season_episode_counts: [{ season_number: 1, episode_count: 12 }],
    effective_watched_through: 5,
    next_episode_number: 6
  };

  it("T-16 skips completed works, movies, and unset progress", () => {
    assert.deepEqual(airingAvailability.planAiringAvailability({ ...watching, statuses: ["completed"] }, todayKst), { kind: "none" });
    assert.deepEqual(airingAvailability.planAiringAvailability({ ...watching, content_type: "movie" }, todayKst), { kind: "none" });
    assert.deepEqual(airingAvailability.planAiringAvailability({ ...watching, progress_source: "none" }, todayKst), { kind: "none" });
  });

  it("T-17 skips Kitsu availability requests", () => {
    assert.deepEqual(airingAvailability.planAiringAvailability({ ...watching, source_api: "kitsu" }, todayKst), { kind: "none" });
  });

  it("T-18 resolves completed AniList seasons locally with all episodes released", () => {
    assert.deepEqual(airingAvailability.planAiringAvailability(watching, todayKst), {
      kind: "local",
      seasonNumber: 1,
      availability: { releasedEpisodeNumber: 12, upcomingEpisodeNumber: null, nextAirDate: null }
    });
  });

  it("T-19 treats the AniList completion date as local on the same KST day", () => {
    assert.deepEqual(airingAvailability.planAiringAvailability({ ...watching, end_date: todayKst }, todayKst), {
      kind: "local",
      seasonNumber: 1,
      availability: { releasedEpisodeNumber: 12, upcomingEpisodeNumber: null, nextAirDate: null }
    });
  });

  it("T-20 remotely checks AniList seasons with a future completion date", () => {
    assert.deepEqual(airingAvailability.planAiringAvailability({ ...watching, end_date: "2026-11-17" }, todayKst), { kind: "remote", seasonNumber: 1 });
  });

  it("T-21 remotely checks ongoing AniList seasons without a completion date", () => {
    assert.deepEqual(airingAvailability.planAiringAvailability({ ...watching, end_date: null }, todayKst), { kind: "remote", seasonNumber: 1 });
  });

  it("T-22 remotely checks completed AniList seasons whose episode count is unknown", () => {
    assert.deepEqual(airingAvailability.planAiringAvailability({
      ...watching,
      season_episode_counts: [{ season_number: 1, episode_count: null }]
    }, todayKst), { kind: "remote", seasonNumber: 1 });
  });

  it("T-23 remotely checks AniList seasons with a malformed completion date", () => {
    assert.deepEqual(airingAvailability.planAiringAvailability({ ...watching, end_date: "2026" }, todayKst), { kind: "remote", seasonNumber: 1 });
  });

  it("T-24 never infers TMDB or TVmaze completion from a past end date", () => {
    assert.deepEqual(airingAvailability.planAiringAvailability({ ...watching, source_api: "tmdb" }, todayKst), { kind: "remote", seasonNumber: 1 });
    assert.deepEqual(airingAvailability.planAiringAvailability({ ...watching, source_api: "tvmaze" }, todayKst), { kind: "remote", seasonNumber: 1 });
  });

  it("T-25 remotely checks legacy items without a source API", () => {
    const { source_api: _sourceApi, ...legacyItem } = watching;
    assert.deepEqual(airingAvailability.planAiringAvailability(legacyItem, todayKst), { kind: "remote", seasonNumber: 1 });
  });

  it("T-26 shows seven unwatched released episodes from the local completed-season result", () => {
    const plan = airingAvailability.planAiringAvailability(watching, todayKst);
    assert.equal(plan.kind, "local");
    assert.equal(plan.kind === "local" ? releasedUnwatchedCount(watching, plan.seasonNumber, plan.availability.releasedEpisodeNumber) : null, 7);
  });

  it("T-27 settles a known season when every episode is released and no next date remains", () => {
    assert.equal(airingAvailability.isAvailabilitySettled({ releasedEpisodeNumber: 12, nextAirDate: null }, 12), true);
  });

  it("T-28 keeps refreshing when a known season still has unreleased episodes", () => {
    assert.equal(airingAvailability.isAvailabilitySettled({ releasedEpisodeNumber: 7, nextAirDate: null }, 12), false);
  });

  it("T-29 never settles a season with an unknown final episode count", () => {
    assert.equal(airingAvailability.isAvailabilitySettled({ releasedEpisodeNumber: 7, nextAirDate: null }, null), false);
    assert.equal(airingAvailability.isAvailabilitySettled({ releasedEpisodeNumber: 7, nextAirDate: null }, undefined), false);
  });

  it("T-30 keeps refreshing when a next airing date remains", () => {
    assert.equal(airingAvailability.isAvailabilitySettled({ releasedEpisodeNumber: 12, nextAirDate: "2026-11-22" }, 12), false);
  });

  it("T-31 does not settle without an availability response or a released episode number", () => {
    assert.equal(airingAvailability.isAvailabilitySettled(undefined, 12), false);
    assert.equal(airingAvailability.isAvailabilitySettled({ releasedEpisodeNumber: null, nextAirDate: null }, 12), false);
  });

  it("T-32 uses the KST calendar date across the UTC midnight boundary", () => {
    assert.equal(airingAvailability.koreaToday(new Date("2026-11-15T15:00:00Z")), "2026-11-16");
    assert.equal(airingAvailability.koreaToday(new Date("2026-11-15T14:59:59Z")), "2026-11-15");
  });
});
