import assert from "node:assert/strict";
import { it } from "node:test";

import { enrichLocalizedPinTitles } from "./pinLocalization";
import { mapPinRow, type RawPinRow } from "./pinRow";
import { sortPinsByScene } from "./pinSort";

function row(overrides: Partial<RawPinRow> = {}): RawPinRow {
  return {
    id: "pin", user_id: "user", content_id: "movie", episode_id: null,
    timestamp_seconds: 60, display_time_label: "01:00", memo: null, emotion: null,
    is_spoiler: false, created_at: "2026-10-20T00:00:00Z", updated_at: "2026-10-20T00:00:00Z",
    contents: {
      content_type: "movie", title_primary: "English Movie", poster_url: null,
      source_api: "tmdb", source_id: "123"
    },
    ...overrides
  };
}

it("localizes movie pins with the movie endpoint even when a TV work shares the ID", async () => {
  const pin = mapPinRow(row());
  const requests: unknown[] = [];
  const result = await enrichLocalizedPinTitles([pin], async (request) => {
    requests.push(request);
    return { content: { title_primary: request.mediaType === "movie" ? "영화 제목" : "관계없는 드라마" } };
  });
  assert.deepEqual(requests, [{ source: "tmdb", externalId: "123", mediaType: "movie" }]);
  assert.equal(result[0]?.content_title, "영화 제목");
  assert.equal(pin.content_title, "English Movie");
});

it("keeps episode-free TV pins in the TV namespace and deduplicates shared work lookups", async () => {
  const pin = mapPinRow(row({ contents: { ...row().contents!, content_type: "jdrama" } }));
  let calls = 0;
  const result = await enrichLocalizedPinTitles([pin, { ...pin, id: "second" }], async (request) => {
    calls++;
    assert.equal(request.mediaType, "tv");
    return { content: { title_primary: "드라마 제목" } };
  });
  assert.equal(calls, 1);
  assert.deepEqual(result.map((item) => item.content_title), ["드라마 제목", "드라마 제목"]);
});

it("preserves stored titles when localization fails or still returns English", async () => {
  const pins = [mapPinRow(row()), mapPinRow(row({ content_id: "second" }))];
  let calls = 0;
  const result = await enrichLocalizedPinTitles(pins, async () => {
    if (++calls === 1) throw new Error("offline");
    return { content: { title_primary: "Still English" } };
  });
  assert.equal(result, pins);
});

it("skips localized/manual pins and bounds refreshes to eight distinct works", async () => {
  const english = mapPinRow(row());
  const pins = [
    { ...english, content_id: "localized", content_title: "한글 제목" },
    { ...english, content_id: "manual", content_source_api: "manual" },
    ...Array.from({ length: 10 }, (_, index) => ({ ...english, content_id: `work-${index}` }))
  ];
  let calls = 0;
  await enrichLocalizedPinTitles(pins, async () => {
    calls++;
    return { content: { title_primary: "제목" } };
  });
  assert.equal(calls, 8);
});

it("orders database pin rows by season and episode before timestamps", () => {
  const rows = [
    row({ id: "season-2", timestamp_seconds: 10, episodes: { episode_number: 1, title: null, seasons: { season_number: 2 } } }),
    row({ id: "season-1-late", timestamp_seconds: 20, episodes: { episode_number: 12, title: null, seasons: { season_number: 1 } } }),
    row({ id: "season-1-first", timestamp_seconds: 600, episodes: { episode_number: 1, title: null, seasons: { season_number: 1 } } })
  ];
  assert.deepEqual(sortPinsByScene(rows.map(mapPinRow)).map((pin) => pin.id), [
    "season-1-first", "season-1-late", "season-2"
  ]);
});
