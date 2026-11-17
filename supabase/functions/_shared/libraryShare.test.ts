import assert from "node:assert/strict";
import { it } from "node:test";

import { LIBRARY_SHARE_MAX_ITEMS, LIBRARY_SHARE_QUERY_CHUNK, chunk } from "./libraryShare.ts";

it("LS-1 chunk splits in order and keeps the remainder", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 100), []);
  assert.deepEqual(chunk([1, 2], 100), [[1, 2]]);
});

it("LS-2 chunk rejects non-positive sizes", () => {
  assert.throws(() => chunk([1], 0), RangeError);
  assert.throws(() => chunk([1], 1.5), RangeError);
});

it("LS-3 share limits fit the query chunk", () => {
  assert.equal(LIBRARY_SHARE_MAX_ITEMS, 1000);
  assert.equal(LIBRARY_SHARE_QUERY_CHUNK, 100);
  assert.equal(chunk(Array.from({ length: LIBRARY_SHARE_MAX_ITEMS }), LIBRARY_SHARE_QUERY_CHUNK).length, 10);
});

it("LS-4 selected registration ids preserve exactly the requested season and order", async () => {
  const share = await import("./libraryShare.ts");
  const rows = [{ id: "s1", content_id: "work", season_number: 1 }, { id: "s2", content_id: "work", season_number: 2 }];
  assert.deepEqual(share.selectSharedLibraryRows(rows, ["s2"], ["work"]), [rows[1]]);
  assert.deepEqual(share.selectSharedLibraryRows(rows, ["s2", "s1"], ["work"]), [rows[1], rows[0]]);
});

it("LS-5 deleted selections are omitted and an empty explicit selection never widens to legacy content ids", async () => {
  const share = await import("./libraryShare.ts");
  const rows = [{ id: "s1", content_id: "work", season_number: 1 }];
  assert.deepEqual(share.selectSharedLibraryRows(rows, ["deleted"], ["work"]), []);
  assert.deepEqual(share.selectSharedLibraryRows(rows, [], ["work"]), []);
});

it("LS-6 legacy shares deterministically expand all registration scopes instead of choosing one season", async () => {
  const share = await import("./libraryShare.ts");
  const rows = [
    { id: "s2", content_id: "work", season_number: 2 },
    { id: "other", content_id: "other", season_number: null },
    { id: "s1", content_id: "work", season_number: 1 },
    { id: "whole", content_id: "work", season_number: null }
  ];
  assert.deepEqual(share.selectSharedLibraryRows(rows, null, ["other", "work"]).map(row => row.id), ["other", "whole", "s1", "s2"]);
  assert.deepEqual(share.selectSharedLibraryRows([...rows].reverse(), null, ["other", "work"]).map(row => row.id), ["other", "whole", "s1", "s2"]);
});

it("LS-7 duplicate requested ids do not repeat a shared registration", async () => {
  const share = await import("./libraryShare.ts");
  const rows = [{ id: "s1", content_id: "work", season_number: 1 }];
  assert.deepEqual(share.selectSharedLibraryRows(rows, ["s1", "s1"], ["work"]), rows);
  assert.deepEqual(share.selectSharedLibraryRows(rows, null, ["work", "work"]), rows);
});

it("LS-8 selected season metadata uses only that season's title, count, and year", async () => {
  const share = await import("./libraryShare.ts");
  const seasons = [{ season_number: 1, episode_count: 12, title: "시즌 1", air_year: 2020 }, { season_number: 2, episode_count: 12, title: "두 번째 이야기", air_year: 2022 }];
  assert.deepEqual(share.sharedSeasonSummary({ title_primary: "작품", air_year: 2020, season_number: 2 }, seasons), {
    title_primary: "두 번째 이야기", episode_count: 12, air_year: 2022
  });
});

it("LS-9 whole-work shares retain the series title and sum all known season counts", async () => {
  const share = await import("./libraryShare.ts");
  assert.deepEqual(share.sharedSeasonSummary({ title_primary: "작품", air_year: 2020, season_number: null }, [{ season_number: 1, episode_count: 12 }, { season_number: 2, episode_count: 12 }]), {
    title_primary: "작품", episode_count: 24, air_year: 2020
  });
});

it("LS-10 an unknown selected season never borrows the full-series episode total", async () => {
  const share = await import("./libraryShare.ts");
  assert.deepEqual(share.sharedSeasonSummary({ title_primary: "작품", air_year: 2020, season_number: 3 }, [{ season_number: 1, episode_count: 12 }]), {
    title_primary: "작품 시즌 3", episode_count: null, air_year: 2020
  });
});

it("LS-11 generic season labels use the same series-plus-season display as the library", async () => {
  const share = await import("./libraryShare.ts");
  assert.equal(share.sharedSeasonSummary({ title_primary: "작품", air_year: 2020, season_number: 2 }, [{ season_number: 2, episode_count: 8, title: "Season 2" }]).title_primary, "작품 시즌 2");
});
