import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyCurrentSeasonMetadata,
  applyTmdbSeasonMetadata,
  expandAiredSeasons,
  MAX_EXPANDED_SEASONS,
  pickCurrentSeason
} from "./tmdb.ts";
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

// VIVANT's real season lineup: season 1 aired 2023, season 2 aired 2026-07-19 (already
// airing as of "now" below), season 3 is announced for 2026-10-11 (has not started yet).
const VIVANT_SEASONS = [
  { season_number: 0, name: "스페셜", air_date: "2023-07-10", episode_count: 10 },
  { season_number: 1, name: "시즌 1", air_date: "2023-07-16", episode_count: 10 },
  { season_number: 2, name: "시즌 2", air_date: "2026-07-19", episode_count: 10 },
  { season_number: 3, name: "시즌 3", air_date: "2026-10-11", episode_count: 1 }
];
const NOW = new Date("2026-09-06T00:00:00Z");

describe("pickCurrentSeason", () => {
  it("picks the most recently started season, not the highest-numbered one", () => {
    const season = pickCurrentSeason(VIVANT_SEASONS, NOW);
    assert.equal(season?.season_number, 2);
  });

  it("excludes the specials season (0) even if it has the latest air date", () => {
    const withLateSpecial = [
      { season_number: 0, air_date: "2026-08-01", episode_count: 1 },
      { season_number: 1, air_date: "2023-07-16", episode_count: 10 }
    ];
    assert.equal(pickCurrentSeason(withLateSpecial, NOW)?.season_number, 1);
  });

  it("ignores seasons that have not started airing yet", () => {
    const onlyFuture = [{ season_number: 2, air_date: "2099-01-01", episode_count: 10 }];
    assert.equal(pickCurrentSeason(onlyFuture, NOW), null);
  });

  it("returns null when there is no dated, numbered season at all", () => {
    assert.equal(pickCurrentSeason([{ season_number: 0, air_date: "2023-01-01" }], NOW), null);
    assert.equal(pickCurrentSeason([], NOW), null);
  });
});

describe("applyCurrentSeasonMetadata", () => {
  it("updates the date and episode count to the currently airing season without renaming the title", () => {
    const updated = applyCurrentSeasonMetadata(result, VIVANT_SEASONS, NOW);
    assert.equal(updated.title_primary, result.title_primary);
    assert.equal(updated.title_is_synthesized, undefined);
    assert.equal(updated.season_number, undefined);
    assert.equal(updated.air_year, 2026);
    assert.equal(updated.air_date, "2026-07-19");
    assert.equal(updated.episode_count, 10);
  });

  it("leaves a single-season show untouched", () => {
    const singleSeason = [{ season_number: 1, air_date: "2025-04-05", episode_count: 12 }];
    assert.equal(applyCurrentSeasonMetadata(result, singleSeason, NOW), result);
  });

  it("leaves the show untouched when no season has started airing", () => {
    const onlyFuture = [{ season_number: 1, air_date: "2099-01-01", episode_count: 10 }];
    assert.equal(applyCurrentSeasonMetadata(result, onlyFuture, NOW), result);
  });
});

describe("expandAiredSeasons", () => {
  it("splits a show with two aired seasons into one card each and drops the unaired one", () => {
    const cards = expandAiredSeasons(result, VIVANT_SEASONS, NOW);
    assert.deepEqual(
      cards.map((card) => [card.season_number, card.air_date, card.episode_count]),
      [[2, "2026-07-19", 10], [1, "2023-07-16", 10]]
    );
  });

  it("keeps the show identity so the library still resolves to the same content", () => {
    for (const card of expandAiredSeasons(result, VIVANT_SEASONS, NOW)) {
      assert.equal(card.external_source, result.external_source);
      assert.equal(card.external_id, result.external_id);
    }
  });

  it("does not expand a single-season show", () => {
    const single = [{ season_number: 1, air_date: "2025-04-05", episode_count: 12 }];
    assert.deepEqual(expandAiredSeasons(result, single, NOW), [result]);
  });

  it("does not expand a movie", () => {
    const movie = { ...result, content_type: "movie" as const };
    assert.deepEqual(expandAiredSeasons(movie, VIVANT_SEASONS, NOW), [movie]);
  });

  it("caps a long-running series at the most recent aired seasons", () => {
    const many = Array.from({ length: 7 }, (_, index) => ({
      season_number: index + 1,
      air_date: `${2015 + index}-01-01`,
      episode_count: 10
    }));
    const cards = expandAiredSeasons(result, many, NOW);
    assert.equal(cards.length, MAX_EXPANDED_SEASONS);
    assert.deepEqual(cards.map((card) => card.season_number), [7, 6, 5, 4, 3]);
  });

  it("synthesizes a season title when the provider name is a generic placeholder", () => {
    const cards = expandAiredSeasons(result, VIVANT_SEASONS, NOW);
    assert.equal(cards[0]?.title_primary, "촌구석 아저씨, 검성이 되다 시즌 2");
  });

  it("prefers a meaningful season name over the synthesized one", () => {
    const named = [
      { season_number: 1, name: "시즌 1", air_date: "2023-07-16", episode_count: 10 },
      { season_number: 2, name: "별의 계승자", air_date: "2026-07-19", episode_count: 10 }
    ];
    assert.equal(expandAiredSeasons(result, named, NOW)[0]?.title_primary, "별의 계승자");
  });
});
