import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LibraryListItem } from "@/types/library";
import { libraryManualProgressAfterToggle, resolveLibraryItemProgress, withLibraryManualProgress } from "./episodeProgress";
import { getLibraryProgressFields, type LibraryProgressRow } from "./libraryProgress";

const seasons = [
  { id: "s1", content_id: "work", season_number: 1, episode_count: 10 },
  { id: "s2", content_id: "work", season_number: 2, episode_count: 10 }
];
const rows: LibraryProgressRow[] = seasons.flatMap((season, index) =>
  Array.from({ length: index === 0 ? 10 : 3 }, (_, i) => ({
    content_id: "work", episode_id: `${season.id}-${i + 1}`,
    episodes: { season_id: season.id, episode_number: i + 1 }
  }))
);
const raw = {
  content_type: "jdrama" as const, source_api: "tmdb" as const, season_number: 2,
  statuses: ["watching" as const], manual_watched_season_number: null as number | null,
  manual_watched_episode_number: null as number | null
};
const map = (item = raw) => getLibraryProgressFields(item, seasons, rows);
const view = (fields: ReturnType<typeof map>) => [fields.effective_watched_through, fields.episode_count, fields.next_episode_number];

describe("library service progress mapping and cache updates", () => {
  it("keeps two season registrations and the whole-work registration in their own scope", () => {
    const snapshot = structuredClone({ seasons, rows, raw });
    assert.deepEqual(view(map({ ...raw, season_number: 1 })), [10, 10, null]);
    assert.deepEqual(view(map()), [3, 10, 4]);
    assert.deepEqual(view(getLibraryProgressFields({ ...raw, season_number: null }, seasons, rows)), [13, 20, 14]);
    assert.equal(map().watched_episode_count, 3);
    assert.deepEqual({ seasons, rows, raw }, snapshot);
  });

  it("does not infer earlier season progress from a later season's checked episodes", () => {
    const laterOnly = rows.filter((row) => row.episodes && !Array.isArray(row.episodes) && row.episodes.season_id === "s2");
    assert.deepEqual(view(getLibraryProgressFields({ ...raw, season_number: 1 }, seasons, laterOnly)), [0, 10, 1]);
  });

  it("matches a manual cache update to a fresh service mapping and preserves the other registrations", () => {
    const initial = { ...raw, ...map(), library_item_id: "season-two" } as LibraryListItem;
    const other = getLibraryProgressFields({ ...raw, season_number: 1 }, seasons, rows);
    const snapshot = structuredClone({ initial, other });
    const cached = withLibraryManualProgress(initial, { seasonNumber: 2, episodeNumber: 4 });
    const reloaded = map({ ...raw, manual_watched_season_number: 2, manual_watched_episode_number: 4 });
    assert.deepEqual(view(cached), [4, 10, 5]);
    assert.deepEqual(view(cached), view(reloaded));
    assert.equal(cached.manual_watched_absolute_number, 14);
    assert.deepEqual({ initial, other }, snapshot);
  });

  it("completed then watching restores the saved manual position after reload", () => {
    const saved = { ...raw, manual_watched_season_number: 2, manual_watched_episode_number: 3 };
    const mapped = map(saved);
    const item = { ...saved, ...mapped };
    const complete = resolveLibraryItemProgress(item, ["completed"]);
    const completedReload = getLibraryProgressFields({ ...saved, statuses: ["completed"] }, seasons, rows);
    assert.equal(complete.effective_watched_through, 10);
    assert.equal(complete.effective_watched_through, completedReload.effective_watched_through);
    assert.equal(resolveLibraryItemProgress(item, ["watching"]).effective_watched_through, 3);
    assert.equal(item.manual_watched_absolute_number, 13);
    assert.equal(item.manual_watched_episode_number, 3);
  });

  it("resetting manual progress returns to the same season's checked position", () => {
    const initial = { ...raw, ...map(), library_item_id: "season-two" } as LibraryListItem;
    const changed = withLibraryManualProgress(initial, { seasonNumber: 2, episodeNumber: 1 });
    const reset = withLibraryManualProgress(changed, null);
    assert.deepEqual(view(reset), [3, 10, 4]);
    assert.equal(reset.progress_source, "episode_progress");
    assert.equal(reset.manual_watched_absolute_number, null);
  });

  it("does not borrow whole-work totals or progress when the selected season metadata is missing", () => {
    const missing = getLibraryProgressFields(raw, seasons.slice(0, 1), rows);
    assert.deepEqual(view(missing), [0, null, 1]);
    assert.equal(missing.watched_episode_count, 0);
    assert.equal(missing.derived_watched_through, null);
    const unknown = getLibraryProgressFields(raw, [seasons[0]!, { ...seasons[1]!, episode_count: null }], rows);
    assert.deepEqual(view(unknown), [3, null, 4]);
  });

  it("preserves an AniList third installment's actual season 1 and registration identity", () => {
    const anime = { ...raw, source_api: "anilist" as const, content_type: "anime" as const, season_number: 3,
      manual_watched_season_number: 1, manual_watched_episode_number: 3 };
    const fields = getLibraryProgressFields(anime, seasons.slice(0, 1), rows.slice(0, 3));
    assert.deepEqual(view(fields), [3, 10, 4]);
    assert.equal(anime.season_number, 3);
    assert.equal(fields.manual_watched_absolute_number, 3);
  });

  it("normalizes joined episode arrays and ignores unassigned episodes for a season", () => {
    const fields = getLibraryProgressFields(raw, seasons, [
      { content_id: "work", episode_id: "s2-3", episodes: [{ season_id: "s2", episode_number: 3 }] },
      { content_id: "work", episode_id: "unknown", episodes: null }
    ]);
    assert.deepEqual(view(fields), [3, 10, 4]);
    assert.equal(fields.watched_episode_count, 1);
  });
});


describe("season manual pointer synchronization", () => {
  it("keeps season two episode zero in season two after unchecking its first episode", () => {
    const saved = { ...raw, manual_watched_season_number: 2, manual_watched_episode_number: 1 };
    const item = { ...saved, ...map(saved) } as LibraryListItem;
    assert.deepEqual(libraryManualProgressAfterToggle(item, 2, 1, false), { seasonNumber: 2, episodeNumber: 0 });
    assert.equal(libraryManualProgressAfterToggle(item, 1, 1, false), null);
    assert.equal(item.manual_watched_absolute_number, 11);
  });

  it("synchronizes legacy null-season manual positions in the registration's relative scope", () => {
    const saved = { ...raw, manual_watched_season_number: null, manual_watched_episode_number: 3 };
    const item = { ...saved, ...map(saved) } as LibraryListItem;
    assert.deepEqual(libraryManualProgressAfterToggle(item, 2, 3, false), { seasonNumber: 2, episodeNumber: 2 });
    assert.equal(item.manual_watched_season_number, null);
    assert.equal(item.manual_watched_absolute_number, 3);
  });

  it("does not borrow a different season's manual position without selected-season metadata", () => {
    const saved = { ...raw, manual_watched_season_number: 1, manual_watched_episode_number: 3 };
    const fields = getLibraryProgressFields(saved, seasons.slice(0, 1), rows);
    assert.deepEqual(view(fields), [0, null, 1]);
    assert.equal(fields.manual_watched_absolute_number, 3);
    assert.equal(fields.progress_source, "none");
  });
});
