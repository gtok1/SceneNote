import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  koreaDateOnly,
  releasedEpisodeFromAniList,
  releasedEpisodeFromDatedEpisodes,
  upcomingEpisodeFromAniList,
  upcomingEpisodeFromDatedEpisodes
} from "./episodeAvailability";

describe("released episode availability", () => {
  it("excludes AniList's next episode until its exact airing time", () => {
    assert.equal(releasedEpisodeFromAniList("RELEASING", 24, { episode: 13, airingAt: 2_000 }, 1_999), 12);
    assert.equal(releasedEpisodeFromAniList("RELEASING", 24, { episode: 13, airingAt: 2_000 }, 2_000), 13);
  });

  it("uses the total only after AniList marks a series finished", () => {
    assert.equal(releasedEpisodeFromAniList("FINISHED", 12, null, 2_000), 12);
    assert.equal(releasedEpisodeFromAniList("RELEASING", 12, null, 2_000), null);
    assert.equal(releasedEpisodeFromAniList("FINISHED", null, null, 2_000), null);
  });

  it("counts only dated episodes that have aired in Korea", () => {
    const episodes = [
      { episode_number: 1, air_date: "2026-09-23" },
      { episode_number: 2, air_date: "2026-09-24" },
      { episode_number: 3, air_date: "2026-09-25" },
      { episode_number: 4, air_date: null }
    ];
    assert.equal(releasedEpisodeFromDatedEpisodes(episodes, "2026-09-24"), 2);
    assert.equal(releasedEpisodeFromDatedEpisodes([{ episode_number: 1, air_date: null }], "2026-09-24"), null);
  });

  it("uses the Korean calendar day at midnight", () => {
    assert.equal(koreaDateOnly(new Date("2026-09-23T14:59:59Z")), "2026-09-23");
    assert.equal(koreaDateOnly(new Date("2026-09-23T15:00:00Z")), "2026-09-24");
  });

  it("returns the next AniList air date in Korea only before airing", () => {
    const next = { episode: 13, airingAt: Date.parse("2026-09-25T15:00:00Z") / 1000 };
    assert.deepEqual(upcomingEpisodeFromAniList(next, next.airingAt - 1), {
      episodeNumber: 13,
      airDate: "2026-09-26"
    });
    assert.equal(upcomingEpisodeFromAniList(next, next.airingAt), null);
    assert.equal(upcomingEpisodeFromAniList(null, next.airingAt - 1), null);
  });

  it("chooses the nearest future dated episode", () => {
    assert.deepEqual(upcomingEpisodeFromDatedEpisodes([
      { episode_number: 14, air_date: "2026-10-03" },
      { episode_number: 12, air_date: "2026-09-23" },
      { episode_number: 13, air_date: "2026-09-26" },
      { episode_number: 15, air_date: null }
    ], "2026-09-24"), { episodeNumber: 13, airDate: "2026-09-26" });
    assert.equal(upcomingEpisodeFromDatedEpisodes([{ episode_number: 12, air_date: "2026-09-23" }], "2026-09-24"), null);
  });
});
