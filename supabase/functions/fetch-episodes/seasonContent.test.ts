import assert from "node:assert/strict";
import { it } from "node:test";
import { resolveSeasonContent } from "./seasonContent.ts";

it("reads the same provider identity from object and single-array content embeds", () => {
  for (const source_api of ["tmdb", "anilist", "kitsu", "tvmaze"] as const) {
    const content = { source_api, source_id: "123" };
    assert.deepEqual(resolveSeasonContent(content), content);
    assert.deepEqual(resolveSeasonContent([content]), content);
  }
});

it("treats absent or ambiguous content embeds as unavailable", () => {
  const content = { source_api: "tmdb", source_id: "123" };
  for (const value of [null, undefined, [], [null], [content, content], "tmdb:123", 123]) {
    assert.equal(resolveSeasonContent(value), null);
  }
});

it("rejects unsupported sources and missing external identifiers before provider calls", () => {
  for (const value of [
    {},
    { source_api: "unknown", source_id: "123" },
    { source_api: "tmdb", source_id: null },
    { source_api: "tmdb", source_id: 123 },
    { source_api: "tmdb", source_id: "  " }
  ]) {
    assert.equal(resolveSeasonContent(value), null);
  }
  assert.deepEqual(resolveSeasonContent({ source_api: "anilist", source_id: " 123 " }), {
    source_api: "anilist", source_id: "123"
  });
});
