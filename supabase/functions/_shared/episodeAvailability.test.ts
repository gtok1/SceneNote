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

it("published stream rows preserve sparse episode numbers without filling gaps", async () => {
  const { publishedStreamingEpisodes } = await import("./episodeAvailability");
  const rows = publishedStreamingEpisodes([
    { title: "Episode 3 - Third", url: "https://example.org/3" },
    { title: "Episode 1 - First", url: "http://example.org/1" },
    { title: "Episode 3 - Duplicate", url: "https://example.org/duplicate" },
    { title: "Trailer", url: "https://example.org/trailer" },
    { title: "Episode 4 - No link", url: null }
  ]);
  assert.deepEqual(rows.map(row => row.episode_number), [1, 3]);
  assert.deepEqual(publishedStreamingEpisodes([]), []);
});
it("published episode rows exclude future and undated entries", async () => {
  const { publishedDatedEpisodes } = await import("./episodeAvailability");
  const rows = publishedDatedEpisodes([
    { episode_number: 1, title: "One", air_date: "2026-10-01" },
    { episode_number: 3, title: "Three", air_date: "2026-10-14" },
    { episode_number: 4, title: "Four", air_date: "2026-10-21" },
    { episode_number: 2, title: "Unknown", air_date: null }
  ], "2026-10-16");
  assert.deepEqual(rows.map(row => row.episode_number), [1, 3]);
});

describe("AniList airing schedule as published episodes", () => {
  // 실측 2026-11-15: AniList 185756(전생 귀족 3기)은 episodes=null, streamingEpisodes=[] 이지만 airingSchedule 12행을 준다.
  const now = Date.UTC(2026, 10, 15, 2, 0, 0) / 1000;
  const at = (month: number, day: number) => Date.UTC(2026, month - 1, day, 15, 30, 0) / 1000;
  const nodes = [
    { episode: 1, airingAt: at(9, 27) }, { episode: 2, airingAt: at(10, 4) }, { episode: 3, airingAt: at(10, 11) },
    { episode: 4, airingAt: at(10, 18) }, { episode: 5, airingAt: at(10, 25) }, { episode: 6, airingAt: at(11, 1) },
    { episode: 7, airingAt: at(11, 8) }, { episode: 8, airingAt: at(11, 15) }, { episode: 9, airingAt: at(11, 22) }
  ];

  it("AS-1 keeps only aired rows with their Korea air date", async () => {
    const { publishedAiringScheduleEpisodes } = await import("./episodeAvailability");
    const rows = publishedAiringScheduleEpisodes({ nodes, pageInfo: { hasNextPage: false } }, now);
    assert.deepEqual(rows.map(row => row.episode_number), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(rows[0], { episode_number: 1, title: null, air_date: "2026-09-28" });
  });

  it("AS-2 an incomplete page is not used", async () => {
    const { publishedAiringScheduleEpisodes } = await import("./episodeAvailability");
    assert.deepEqual(publishedAiringScheduleEpisodes({ nodes, pageInfo: { hasNextPage: true } }, now), []);
  });

  it("AS-3 ignores invalid rows, keeps gaps, removes duplicates, sorts", async () => {
    const { publishedAiringScheduleEpisodes } = await import("./episodeAvailability");
    const rows = publishedAiringScheduleEpisodes({ nodes: [
      { episode: 3, airingAt: at(10, 11) }, { episode: 1, airingAt: at(9, 27) }, { episode: 1, airingAt: at(9, 28) },
      { episode: 0, airingAt: at(9, 27) }, { episode: 2.5, airingAt: at(9, 27) }, { episode: null, airingAt: at(9, 27) },
      { episode: 4, airingAt: null }, { episode: 5, airingAt: Number.NaN }
    ] }, now);
    assert.deepEqual(rows.map(row => row.episode_number), [1, 3]);
    assert.equal(rows[0]?.air_date, "2026-09-28");
  });

  it("AS-4 empty or missing schedule gives no rows", async () => {
    const { publishedAiringScheduleEpisodes } = await import("./episodeAvailability");
    assert.deepEqual(publishedAiringScheduleEpisodes(null, now), []);
    assert.deepEqual(publishedAiringScheduleEpisodes({ nodes: [] }, now), []);
    assert.deepEqual(publishedAiringScheduleEpisodes({ nodes }, Number.NaN), []);
  });

  it("AS-5 merge keeps streaming title and link, adds schedule dates and numbers", async () => {
    const { mergePublishedEpisodes } = await import("./episodeAvailability");
    const merged = mergePublishedEpisodes(
      [{ episode_number: 1, title: "Episode 1 - Start", air_date: null, url: "https://example.com/1" }],
      [{ episode_number: 1, title: null, air_date: "2026-09-28" }, { episode_number: 2, title: null, air_date: "2026-10-05" }]
    );
    assert.deepEqual(merged, [
      { episode_number: 1, title: "Episode 1 - Start", air_date: "2026-09-28", url: "https://example.com/1" },
      { episode_number: 2, title: null, air_date: "2026-10-05" }
    ]);
    assert.deepEqual(mergePublishedEpisodes([], []), []);
  });
});
