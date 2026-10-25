import assert from "node:assert/strict";
import { it } from "node:test";
import type { RawPinRow } from "./pinRow";

function base(overrides: Partial<RawPinRow> = {}): RawPinRow {
  return {
    id: "p1", user_id: "u1", content_id: "c1", episode_id: "e1",
    timestamp_seconds: 2530, display_time_label: "42:10", memo: "메모", emotion: "moved",
    is_spoiler: false, created_at: "2026-10-02T12:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z",
    contents: {
      crew: null, title_primary: "무빙", poster_url: "https://p", source_api: "tmdb", source_id: "123",
      content_genres: [{ genres: { name: "드라마" } }]
    },
    episodes: { episode_number: 7, title: "감정선", seasons: { season_number: 1 } },
    timeline_pin_tags: [
      { tag_id: "t1", tags: { id: "t1", user_id: "u1", name: "눈물", created_at: "2026-10-02T12:00:00.000Z" } },
      { tag_id: "t2", tags: null }
    ],
    ...overrides
  };
}

it("S-1 preserves the exact season-embedded select contract", async () => {
  const { PIN_SELECT } = await import("./pinRow");
  assert.equal(PIN_SELECT, "*,contents(*,content_genres(genres(name))),episodes(episode_number,title,seasons(season_number)),timeline_pin_tags(tag_id,tags(*))");
});
it("S-2 maps season two and its episode metadata", async () => {
  const { mapPinRow } = await import("./pinRow");
  const result = mapPinRow(base({ episodes: { episode_number: 3, title: "각성", seasons: { season_number: 2 } } }));
  assert.equal(result.season_number, 2);
  assert.equal(result.episode_number, 3);
  assert.equal(result.episode_title, "각성");
});
it("S-3 maps episode-free movie pins without a season", async () => {
  const { mapPinRow } = await import("./pinRow");
  const result = mapPinRow(base({ episode_id: null, episodes: null }));
  assert.equal(result.season_number, null);
  assert.equal(result.episode_number, null);
  assert.equal(result.episode_title, null);
});
it("S-4 tolerates a null season embed", async () => {
  const { mapPinRow } = await import("./pinRow");
  const result = mapPinRow(base({ episodes: { episode_number: 5, title: null, seasons: null } }));
  assert.equal(result.season_number, null);
  assert.equal(result.episode_number, 5);
});
it("S-5 preserves all existing mapping fields and excludes null tags", async () => {
  const { mapPinRow } = await import("./pinRow");
  assert.deepEqual(mapPinRow(base()), {
    id: "p1", user_id: "u1", content_id: "c1", episode_id: "e1",
    content_crew: [], content_title: "무빙", content_poster_url: "https://p",
    content_source_api: "tmdb", content_source_id: "123", genres: ["드라마"],
    episode_title: "감정선", episode_number: 7, season_number: 1,
    timestamp_seconds: 2530, display_time_label: "42:10", memo: "메모", emotion: "moved",
    is_spoiler: false, created_at: "2026-10-02T12:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z",
    tags: [{ id: "t1", user_id: "u1", name: "눈물", created_at: "2026-10-02T12:00:00.000Z" }]
  });
});
