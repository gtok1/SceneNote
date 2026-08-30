import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyTmdbSeasonMetadata } from "./tmdb.ts";
import type { SearchResult } from "./types.ts";

const result: SearchResult = {
  external_source: "tmdb",
  external_id: "260823",
  content_type: "anime",
  title_primary: "촌구석 아저씨, 검성이 되다",
  title_original: "片田舎のおっさん、剣聖になる",
  poster_url: null,
  overview: null,
  air_year: 2025,
  air_date: "2025-04-05",
  has_seasons: true,
  episode_count: null
};

describe("applyTmdbSeasonMetadata", () => {
  it("applies the measured second-season date and episode count", () => {
    const updated = applyTmdbSeasonMetadata(result, [
      { season_number: 1, name: "시즌 1", air_date: "2025-04-05", episode_count: 12 },
      { season_number: 2, name: "시즌 2", air_date: "2026-07-08", episode_count: 12 }
    ], 2);

    assert.deepEqual(updated, {
      ...result,
      title_primary: "촌구석 아저씨, 검성이 되다 2기",
      title_is_synthesized: true,
      match_titles: ["촌구석 아저씨, 검성이 되다 2기"],
      season_number: 2,
      air_year: 2026,
      air_date: "2026-07-08",
      episode_count: 12
    });
  });

  it("keeps the base show when the requested season is absent", () => {
    assert.equal(applyTmdbSeasonMetadata(result, [
      { season_number: 1, name: "시즌 1", air_date: "2025-04-05", episode_count: 12 }
    ], 5), result);
  });

  it("prefers a meaningful Korean season title", () => {
    const updated = applyTmdbSeasonMetadata(result, [
      { season_number: 2, name: "검성의 귀환", air_date: "2026-07-08", episode_count: 12 }
    ], 2);

    assert.equal(updated.title_primary, "검성의 귀환");
    assert.equal(updated.title_is_synthesized, undefined);
  });

  it("keeps the original title when the base title is not Korean", () => {
    const englishResult = {
      ...result,
      title_primary: "Katainaka no Ossan, Kensei ni Naru"
    };
    const updated = applyTmdbSeasonMetadata(englishResult, [
      { season_number: 2, name: "Season 2", air_date: "2026-07-08", episode_count: 12 }
    ], 2);

    assert.equal(updated.title_primary, englishResult.title_primary);
    assert.equal(updated.title_is_synthesized, undefined);
  });
});
