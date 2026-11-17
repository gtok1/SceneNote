import assert from "node:assert/strict";
import { it } from "node:test";

import type { LibraryListItem } from "@/types/library";

type AirDateItem = Pick<LibraryListItem, "content_id" | "source_api" | "air_date" | "end_date">;

function item(contentId: string, sourceApi: AirDateItem["source_api"], airDate: string | null, endDate: string | null): AirDateItem {
  return { content_id: contentId, source_api: sourceApi, air_date: airDate, end_date: endDate };
}

it("72 T-15: a TMDB work without an air date needs episode air dates", async () => {
  const libraryAirDates = await import("./libraryAirDates");
  assert.deepEqual(libraryAirDates.contentIdsNeedingEpisodeAirDates([item("tmdb", "tmdb", null, "2026-11-15")]), ["tmdb"]);
});

it("72 T-16: a TMDB work without an end date needs episode air dates", async () => {
  const libraryAirDates = await import("./libraryAirDates");
  assert.deepEqual(libraryAirDates.contentIdsNeedingEpisodeAirDates([item("tmdb", "tmdb", "2026-09-01", null)]), ["tmdb"]);
});

it("72 T-17: a TMDB work with both dates skips episode air dates", async () => {
  const libraryAirDates = await import("./libraryAirDates");
  assert.deepEqual(libraryAirDates.contentIdsNeedingEpisodeAirDates([item("tmdb", "tmdb", "2026-09-01", "2026-11-15")]), []);
});

it("72 T-18: an AniList work with an air date never infers its missing end date", async () => {
  const libraryAirDates = await import("./libraryAirDates");
  assert.deepEqual(libraryAirDates.contentIdsNeedingEpisodeAirDates([item("anilist", "anilist", "2026-09-01", null)]), []);
});

it("72 T-19: an AniList work without an air date needs episode air dates", async () => {
  const libraryAirDates = await import("./libraryAirDates");
  assert.deepEqual(libraryAirDates.contentIdsNeedingEpisodeAirDates([item("anilist", "anilist", null, null)]), ["anilist"]);
});

it("72 T-20: episode air-date targets deduplicate season registrations in first-seen order", async () => {
  const libraryAirDates = await import("./libraryAirDates");
  const entries = [
    item("first", "tmdb", null, null),
    item("first", "tmdb", "2026-09-01", null),
    item("second", "anilist", null, null)
  ];
  assert.deepEqual(libraryAirDates.contentIdsNeedingEpisodeAirDates(entries), ["first", "second"]);
});

it("72 T-21: complete-date and empty lists have no episode air-date targets", async () => {
  const libraryAirDates = await import("./libraryAirDates");
  assert.deepEqual(libraryAirDates.contentIdsNeedingEpisodeAirDates([
    item("tmdb", "tmdb", "2026-09-01", "2026-11-15"),
    item("anilist", "anilist", "2026-09-01", "2026-11-15")
  ]), []);
  assert.deepEqual(libraryAirDates.contentIdsNeedingEpisodeAirDates([]), []);
});
