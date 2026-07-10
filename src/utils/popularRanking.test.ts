import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWithinCandidateWindow, rankPopularRecommendations } from "./popularRanking";

describe("popular ranking utilities", () => {
  const now = new Date("2026-07-10T00:00:00.000Z");

  it("keeps last month's most popular work above this month's weakest work", () => {
    const ranked = rankPopularRecommendations(
      [
        item("current-low", { air_date: "2026-07-05", popularity: 1 }),
        item("last-month-top", { air_date: "2026-06-20", popularity: 100 })
      ],
      { now }
    );

    assert.equal(ranked[0]?.id, "last-month-top");
  });

  it("boosts a recent release above an older work with the same popularity", () => {
    const ranked = rankPopularRecommendations(
      [
        item("older", { air_date: "2026-03-01", popularity: 50 }),
        item("recent", { air_date: "2026-07-01", popularity: 50 })
      ],
      { now }
    );

    assert.equal(ranked[0]?.id, "recent");
  });

  it("keeps December releases eligible across the January boundary", () => {
    const newYear = new Date("2027-01-01T00:00:00.000Z");

    assert.equal(
      isWithinCandidateWindow({ air_date: "2026-12-15", air_year: 2026 }, newYear),
      true
    );
  });

  it("allows year-only rows when their year overlaps the rolling window", () => {
    const newYear = new Date("2027-01-01T00:00:00.000Z");

    assert.equal(isWithinCandidateWindow({ air_date: null, air_year: 2026 }, newYear), true);
  });
});

function item(id: string, overrides: Partial<TestPopularItem> = {}): TestPopularItem {
  return {
    id,
    external_source: "tmdb",
    air_year: 2026,
    air_date: "2026-07-01",
    popularity: 1,
    rank: 1,
    ...overrides
  };
}

interface TestPopularItem {
  id: string;
  external_source: string;
  air_year: number | null;
  air_date: string | null;
  popularity: number | null;
  rank: number | null;
}
