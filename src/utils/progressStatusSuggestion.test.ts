import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WatchStatus } from "@/types/library";

import { getProgressStatusSuggestion, type ProgressStatusSuggestion } from "./progressStatusSuggestion";

describe("getProgressStatusSuggestion", () => {
  const cases: {
    name: string;
    statuses: WatchStatus[];
    absoluteWatchedThrough: number;
    totalEpisodes: number | null;
    expected: ProgressStatusSuggestion;
  }[] = [
    { name: "suggests completed at the final episode", statuses: ["watching"], absoluteWatchedThrough: 24, totalEpisodes: 24, expected: "mark_completed" },
    { name: "does not suggest completed when already completed", statuses: ["completed"], absoluteWatchedThrough: 24, totalEpisodes: 24, expected: null },
    { name: "does not suggest completed before the final episode", statuses: ["watching"], absoluteWatchedThrough: 12, totalEpisodes: 24, expected: null },
    { name: "suggests watching after starting a wishlist item", statuses: ["wishlist"], absoluteWatchedThrough: 1, totalEpisodes: 24, expected: "mark_watching" },
    { name: "does not suggest watching at episode zero", statuses: ["wishlist"], absoluteWatchedThrough: 0, totalEpisodes: 24, expected: null },
    { name: "does not suggest watching when already watching", statuses: ["wishlist", "watching"], absoluteWatchedThrough: 5, totalEpisodes: 24, expected: null },
    { name: "prioritizes completed over watching", statuses: ["wishlist"], absoluteWatchedThrough: 24, totalEpisodes: 24, expected: "mark_completed" },
    { name: "does not suggest completed when total is unknown", statuses: ["watching"], absoluteWatchedThrough: 30, totalEpisodes: null, expected: null },
    { name: "suggests watching when total is unknown", statuses: ["wishlist"], absoluteWatchedThrough: 3, totalEpisodes: null, expected: "mark_watching" },
    { name: "does not suggest a status without a matching current status", statuses: [], absoluteWatchedThrough: 5, totalEpisodes: 24, expected: null },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      assert.equal(getProgressStatusSuggestion(testCase), testCase.expected);
    });
  }
});
