import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createRecommendationAddLock,
  createRecommendationPressGuard,
  retainRecommendationAddSlots
} from "./recommendationAddFlow";
import { sortRecommendationsByRelease } from "./recommendationOrder";

interface Recommendation {
  canonical_id: string;
  air_year: number | null;
  air_date?: string | null;
  added?: boolean;
}

function recommendation(id: string, date: string | null, year: number | null = null): Recommendation {
  return { canonical_id: id, air_date: date, air_year: year };
}

const ids = (items: readonly Recommendation[]) => items.map(item => item.canonical_id);

describe("personalized recommendation release ordering", () => {
  it("RO-1 sorts all twelve recommendations when eight older items precede four new ones", () => {
    const older = Array.from({ length: 8 }, (_, index) => recommendation(`older-${index}`, `${2025 - index}-06-01`));
    const newer = ["2026-01-01", "2026-03-01", "2026-02-01", "2026-04-01"]
      .map((date, index) => recommendation(`newer-${index}`, date));
    assert.deepEqual(ids(sortRecommendationsByRelease([...older, ...newer])), [
      "newer-3", "newer-1", "newer-2", "newer-0", ...ids(older)
    ]);
  });

  it("RO-2 moves a newer item from a later batch ahead of earlier 1992 recommendations", () => {
    const firstBatch = [recommendation("2025", "2025-12-01"), recommendation("1992", "1992-06-01")];
    const cumulative = [...firstBatch, recommendation("2026", "2026-02-01")];
    assert.deepEqual(ids(sortRecommendationsByRelease(cumulative)), ["2026", "2025", "1992"]);
  });

  it("RO-3 compares the complete calendar day within the same month", () => {
    assert.deepEqual(ids(sortRecommendationsByRelease([
      recommendation("early", "2026-05-01"),
      recommendation("late", "2026-05-31"),
      recommendation("middle", "2026-05-15")
    ])), ["late", "middle", "early"]);
  });

  it("RO-4 orders year-only items after dated items in that year and before earlier years", () => {
    assert.deepEqual(ids(sortRecommendationsByRelease([
      recommendation("unknown", null),
      recommendation("year-only", null, 2026),
      recommendation("older-date", "2025-12-31", 2025),
      recommendation("known-date", "2026-01-01", 2026)
    ])), ["known-date", "year-only", "older-date", "unknown"]);
  });

  it("RO-5 rejects impossible or malformed dates and falls back to a valid year", () => {
    assert.deepEqual(ids(sortRecommendationsByRelease([
      recommendation("bad-february", "2026-02-31", 2026),
      recommendation("bad-month", "2026-13-01", 2025),
      recommendation("valid-day", "2026-01-01", 2026),
      recommendation("non-leap", "2025-02-29", 2025),
      recommendation("zero-day", "2026-01-00"),
      recommendation("timestamp", "2026-12-01T00:00:00Z")
    ])), ["valid-day", "bad-february", "bad-month", "non-leap", "zero-day", "timestamp"]);
  });

  it("RO-6 validates Gregorian leap days, including century years, without local timezone parsing", () => {
    assert.deepEqual(ids(sortRecommendationsByRelease([
      recommendation("invalid-century", "1900-02-29"),
      recommendation("valid-leap", "2024-02-29"),
      recommendation("valid-century", "2000-02-29"),
      recommendation("not-a-leap-year", "2023-02-29")
    ])), ["valid-leap", "valid-century", "invalid-century", "not-a-leap-year"]);
  });

  it("RO-7 rejects invalid fallback years and keeps unknown dates last in input order", () => {
    const invalidYears = [null, Number.NaN, Number.POSITIVE_INFINITY, 0, -1, 2026.5, 10_000];
    const unknowns = invalidYears.map((year, index) => recommendation(`unknown-${index}`, null, year));
    assert.deepEqual(ids(sortRecommendationsByRelease([
      ...unknowns,
      recommendation("oldest-valid", null, 1),
      recommendation("latest-valid", null, 9999)
    ])), ["latest-valid", "oldest-valid", ...ids(unknowns)]);
  });

  it("RO-8 trusts a valid displayed release date over a conflicting fallback year", () => {
    assert.deepEqual(ids(sortRecommendationsByRelease([
      recommendation("date-2025", "2025-12-31", 2027),
      recommendation("date-2026", "2026-01-01", 2020)
    ])), ["date-2026", "date-2025"]);
  });

  it("RO-9 keeps incoming preference order for tied dates and does not mutate items or input", () => {
    const preferred = Object.freeze(recommendation("z-preferred", "2026-05-01"));
    const other = Object.freeze(recommendation("a-other", "2026-05-01"));
    const older = Object.freeze(recommendation("older", "2025-01-01"));
    const items = Object.freeze([older, preferred, other]);
    const sorted = sortRecommendationsByRelease(items);
    assert.deepEqual(ids(sorted), ["z-preferred", "a-other", "older"]);
    assert.deepEqual(items, [older, preferred, other]);
    assert.equal(sorted[0], preferred);
    assert.equal(sorted[1], other);
    assert.notEqual(sorted, items);
  });

  it("RO-10 sorts retained additions with the whole feed while preserving identity and added state", () => {
    const added = { ...recommendation("added", "2001-01-01"), added: true };
    const older = recommendation("older", "1992-06-01");
    const newer = recommendation("newer", "2026-02-01");
    const combined = retainRecommendationAddSlots([older, newer], [{ item: added, index: 0 }]);
    const sorted = sortRecommendationsByRelease(combined);
    assert.deepEqual(ids(sorted), ["newer", "added", "older"]);
    assert.equal(sorted[1], added);
    assert.equal(sorted[1]?.added, true);
    assert.equal(sorted.filter(item => item.canonical_id === "added").length, 1);
  });

  it("RO-11 rejects a press released on a different identity after chronological reordering", () => {
    const guard = createRecommendationPressGuard();
    const oldCard = recommendation("old", "1992-06-01");
    guard.begin(oldCard.canonical_id);
    const sorted = sortRecommendationsByRelease([oldCard, recommendation("new", "2026-02-01")]);
    assert.equal(guard.consume(sorted[0]!.canonical_id), false);
    assert.equal(guard.consume("new"), true);
  });

  it("RO-12 keeps the same-item add lock effective when the item's position changes", () => {
    const lock = createRecommendationAddLock();
    const item = recommendation("pending", "1992-06-01");
    assert.equal(lock.claim(item.canonical_id), true);
    const sorted = sortRecommendationsByRelease([item, recommendation("new", "2026-02-01")]);
    assert.equal(lock.claim(sorted[1]!.canonical_id), false);
    assert.equal(lock.claim(sorted[0]!.canonical_id), true);
    lock.release(item.canonical_id);
    assert.equal(lock.claim(item.canonical_id), true);
  });
});
