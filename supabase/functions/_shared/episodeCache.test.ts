import assert from "node:assert/strict";
import { it } from "node:test";

it("integrity EP-1 never treats a prefetched first episode as a complete twelve-episode season", async () => {
  const episodes = await import("./episodeCache.ts");
  assert.equal(episodes.isEpisodeListReusable([{ episode_number: 1 }], 12, null, new Date("2026-11-16T00:00:00Z")), false);
});
it("integrity EP-2 reuses a complete known sequence without an external refresh", async () => {
  const episodes = await import("./episodeCache.ts");
  assert.equal(episodes.isEpisodeListReusable(Array.from({ length: 12 }, (_, i) => ({ episode_number: i + 1 })), 12, null), true);
});
it("integrity EP-3 does not mistake a duplicate or a hole for a complete sequence", async () => {
  const episodes = await import("./episodeCache.ts");
  assert.equal(episodes.isEpisodeListReusable([{ episode_number: 1 }, { episode_number: 1 }, { episode_number: 3 }], 3, null), false);
});
it("integrity EP-4 unknown totals require a recent complete sync marker", async () => {
  const episodes = await import("./episodeCache.ts");
  const now = new Date("2026-11-16T00:30:00Z");
  const rows = [{ episode_number: 1 }];
  assert.equal(episodes.isEpisodeListReusable(rows, null, null, now), false);
  assert.equal(episodes.isEpisodeListReusable(rows, null, "2026-11-16T00:00:01Z", now, [1]), true);
  assert.equal(episodes.isEpisodeListReusable(rows, null, "2026-11-16T00:00:00Z", now, [1]), false);
  assert.equal(episodes.isEpisodeListReusable(rows, null, "2026-11-16T00:31:00Z", now, [1]), false);
});
it("integrity EP-5 preserves stored useful metadata and existing episode numbers while adding new rows", async () => {
  const episodes = await import("./episodeCache.ts");
  assert.deepEqual(episodes.mergeEpisodeRows([
    { episode_number: 1, title: "첫 화", air_date: "2026-09-27", duration_seconds: 1440 },
    { episode_number: 9, title: "기존 기록", air_date: null, duration_seconds: null }
  ], [
    { episode_number: 1, title: null, air_date: null, duration_seconds: null },
    { episode_number: 2, title: null, air_date: null, duration_seconds: null }
  ]), [
    { episode_number: 1, title: "첫 화", air_date: "2026-09-27", duration_seconds: 1440 },
    { episode_number: 2, title: null, air_date: null, duration_seconds: null },
    { episode_number: 9, title: "기존 기록", air_date: null, duration_seconds: null }
  ]);
});
it("integrity EP-6 a new non-null episode field replaces older metadata without deleting other stored fields", async () => {
  const episodes = await import("./episodeCache.ts");
  assert.deepEqual(episodes.mergeEpisodeRows([{ episode_number: 1, title: "old", air_date: "2026-09-27", duration_seconds: 1440 }], [{ episode_number: 1, title: "new", air_date: null, duration_seconds: null }]), [{ episode_number: 1, title: "new", air_date: "2026-09-27", duration_seconds: 1440 }]);
});
it("integrity EP-7 unknown cached rows need an explicit published-number mask", async () => {
  const episodes = await import("./episodeCache.ts");
  assert.equal(episodes.isEpisodeListReusable([{ episode_number: 1 }], null, "2026-11-16T00:00:00Z", new Date("2026-11-16T00:01:00Z"), null), false);
});
it("integrity EP-8 every published-number mask entry must be valid and stored", async () => {
  const episodes = await import("./episodeCache.ts");
  const now = new Date("2026-11-16T00:01:00Z");
  for (const mask of [[1,2], [0], [1.5], [50_001]]) assert.equal(episodes.isEpisodeListReusable([{ episode_number: 1 }], null, "2026-11-16T00:00:00Z", now, mask), false);
});
it("integrity EP-9 a recent successful zero-release sync is reusable without inventing episodes", async () => {
  const episodes = await import("./episodeCache.ts");
  assert.equal(episodes.isEpisodeListReusable([], null, "2026-11-16T00:00:00Z", new Date("2026-11-16T00:01:00Z"), []), true);
});
