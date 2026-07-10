import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WatchStatus } from "@/types/library";
import { filterUpcomingAiringItems, formatUpcomingAiringLabel, isAiringToday } from "./upcomingAiring";

describe("upcoming airing utilities", () => {
  const today = new Date("2026-07-09T03:00:00.000Z");

  it("filters watching and wishlist items from yesterday through the next seven KST days", () => {
    const items = [
      item("yesterday", "2026-07-08", ["watching"]),
      item("today", "2026-07-09", ["wishlist"]),
      item("next-week", "2026-07-16", ["watching"]),
      item("too-late", "2026-07-17", ["watching"]),
      item("too-early", "2026-07-07", ["watching"]),
      item("completed", "2026-07-09", ["completed"])
    ];

    assert.deepEqual(
      filterUpcomingAiringItems(items, today).map((entry) => entry.id),
      ["yesterday", "today", "next-week"]
    );
  });

  it("sorts eligible items by air date ascending", () => {
    const items = [
      item("third", "2026-07-12", ["watching"]),
      item("first", "2026-07-09", ["watching"]),
      item("second", "2026-07-10", ["wishlist"])
    ];

    assert.deepEqual(
      filterUpcomingAiringItems(items, today).map((entry) => entry.id),
      ["first", "second", "third"]
    );
  });

  it("formats labels relative to KST dates", () => {
    assert.equal(formatUpcomingAiringLabel("2026-07-08", today), "어제 방영");
    assert.equal(formatUpcomingAiringLabel("2026-07-09", today), "오늘");
    assert.equal(formatUpcomingAiringLabel("2026-07-10", today), "내일");
    assert.equal(formatUpcomingAiringLabel("2026-07-12", today), "7월 12일 (일)");
  });

  it("detects items airing today in KST", () => {
    assert.equal(isAiringToday("2026-07-09", today), true);
    assert.equal(isAiringToday("2026-07-08", today), false);
    assert.equal(isAiringToday("2026-07-10", today), false);
    assert.equal(isAiringToday(null, today), false);
  });

  it("uses KST day boundaries", () => {
    const beforeKstMidnight = new Date("2026-07-08T14:59:00.000Z");
    const afterKstMidnight = new Date("2026-07-08T15:00:00.000Z");

    assert.equal(formatUpcomingAiringLabel("2026-07-08", beforeKstMidnight), "오늘");
    assert.equal(formatUpcomingAiringLabel("2026-07-09", afterKstMidnight), "오늘");
  });
});

function item(id: string, airDate: string, statuses: WatchStatus[]) {
  return {
    id,
    air_date: airDate,
    statuses
  };
}
