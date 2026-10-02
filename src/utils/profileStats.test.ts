import assert from "node:assert/strict";
import { it } from "node:test";

import type { LibraryListItem, WatchStatus } from "@/types/library";

import { libraryContentCategory } from "./libraryFilters";
import {
  countCurrentYearWatchedItems,
  createContentTypeStats,
  createLibraryStatusSummary
} from "./profileStats";

function item(overrides: Partial<LibraryListItem>): LibraryListItem {
  return {
    content_type: "anime",
    genres: [],
    statuses: [],
    watch_count: 0,
    last_watched_at: null,
    added_at: "2020-01-15T12:00:00Z",
    air_year: null,
    ...overrides
  } as LibraryListItem;
}

const completed: WatchStatus[] = ["completed"];
const wishlist: WatchStatus[] = ["wishlist"];
const NOW = new Date("2026-10-01T12:00:00Z");

it("S-1 counts foreign dramas separately from other", () => {
  const stats = createContentTypeStats([
    item({ content_type: "anime" }),
    item({ content_type: "kdrama" }),
    item({ content_type: "other", genres: ["드라마"] }),
    item({ content_type: "movie" }),
    item({ content_type: "other", genres: ["다큐멘터리"] })
  ]);
  assert.deepEqual(stats.map((s) => s.type), ["anime", "kdrama", "jdrama", "foreign_drama", "movie", "other"]);
  assert.deepEqual(stats.map((s) => s.count), [1, 1, 0, 1, 1, 1]);
  assert.deepEqual(stats.map((s) => s.percent), [20, 20, 0, 20, 20, 20]);
  assert.equal(stats[3]!.label, "해외 드라마");
});

it("S-2 returns six zero rows for an empty library", () => {
  const stats = createContentTypeStats([]);
  assert.equal(stats.length, 6);
  assert.ok(stats.every((s) => s.count === 0 && s.percent === 0));
});

it("S-3 classifies library content categories", () => {
  assert.equal(libraryContentCategory({ content_type: "other", genres: ["드라마"] }), "foreign_drama");
  assert.equal(libraryContentCategory({ content_type: "other", genres: [] }), "other");
  assert.equal(libraryContentCategory({ content_type: "other", genres: ["Drama"] }), "foreign_drama");
  assert.equal(libraryContentCategory({ content_type: "jdrama", genres: ["드라마"] }), "jdrama");
});

const yearItems = [
  item({ statuses: completed, last_watched_at: "2026-03-15T12:00:00Z" }),
  item({ statuses: wishlist, watch_count: 0, last_watched_at: "2026-05-15T12:00:00Z" }),
  item({ statuses: completed, last_watched_at: "2025-12-15T12:00:00Z" })
];

it("S-4 counts only watched items in the current year", () => {
  assert.equal(countCurrentYearWatchedItems(yearItems, NOW), 1);
});

it("S-5 returns null when no item has a watched date", () => {
  assert.equal(countCurrentYearWatchedItems([item({ added_at: "2026-02-15T12:00:00Z" })], NOW), null);
});

it("S-6 status summary nests completed inside watched inside registered", () => {
  const items = [
    item({ statuses: ["completed"] }),
    item({ statuses: ["completed", "recommended"] }),
    item({ statuses: ["watching"] }),
    item({ statuses: ["dropped"] }),
    item({ statuses: ["recommended"] }),
    item({ statuses: ["wishlist"], watch_count: 1 }),
    item({ statuses: ["wishlist"] }),
    item({ statuses: ["wishlist"] })
  ];
  assert.deepEqual(createLibraryStatusSummary(items), {
    total: 8,
    watched: 6,
    wishlistOnly: 2,
    completed: 2,
    watchedNotCompleted: 4
  });
  assert.deepEqual(createLibraryStatusSummary([]), {
    total: 0,
    watched: 0,
    wishlistOnly: 0,
    completed: 0,
    watchedNotCompleted: 0
  });
});
