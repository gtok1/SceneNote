import assert from "node:assert/strict";
import { test } from "node:test";
import { createSearchFilterDraft, emptySearchFilters } from "./searchFilterDraft";
import { createSearchFilterPreferenceScope, getSearchAccountTransition, normalizeSavedSearchFilters, serializeSearchFilters } from "./searchFilterPreferences";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("saved filters round-trip all applied fields without query text or view mode", () => {
  const filters = { mediaTypes: ["drama", "anime"] as ("drama" | "anime")[], genreFilters: ["코미디", "로맨스"],
    countryFilters: ["JP", "KR"], statusFilter: "completed" as const, year: "2026", sortOrder: "oldest" as const };
  const saved = serializeSearchFilters({ ...filters, query: "private title", viewMode: "gallery" } as typeof filters);
  assert.deepEqual(normalizeSavedSearchFilters(saved), { ...filters, mediaTypes: ["anime", "drama"], genreFilters: ["로맨스", "코미디"] });
  assert.equal("query" in (saved as object), false);
  assert.equal("viewMode" in (saved as object), false);
});

test("untrusted persisted values normalize to safe deterministic filter arrays", () => {
  assert.deepEqual(normalizeSavedSearchFilters({ mediaTypes: ["movie", "all", "anime", "movie", 5],
    genreFilters: ["Comedy", "코미디", " ALL ", null, ""], countryFilters: ["kr", " KR ", "jP", "all", "한국"],
    statusFilter: "unsafe", year: "19999", sortOrder: "unsafe" }), {
    ...emptySearchFilters, mediaTypes: ["anime", "movie"], genreFilters: ["코미디"], countryFilters: ["JP", "KR"]
  });
  for (const value of [null, undefined, [], "bad", {}]) assert.deepEqual(normalizeSavedSearchFilters(value), emptySearchFilters);
  assert.deepEqual(normalizeSavedSearchFilters({ mediaTypes: ["movie", "drama", "anime"] }).mediaTypes, []);
  assert.equal(normalizeSavedSearchFilters({ genreFilters: Array.from({ length: 40 }, (_, i) => `genre${i}`) }).genreFilters.length, 30);
  assert.equal(normalizeSavedSearchFilters({ countryFilters: Array.from({ length: 20 }, (_, i) => `A${String.fromCharCode(65 + i)}`) }).countryFilters.length, 10);
});

test("account transition clears the active query and records both batched A to B to A transitions", () => {
  const original = { accountUserId: "A", accountRevision: 0, query: "A private query" };
  assert.equal(getSearchAccountTransition(original, "A"), null);
  const asB = getSearchAccountTransition(original, "B")!;
  const asA = getSearchAccountTransition(asB, "A")!;
  assert.equal(asB.query, ""); assert.equal(asA.query, "");
  assert.equal(asA.accountRevision, 2);
  assert.equal(asA.filterUserId, null);
  assert.deepEqual(asA.countryFilters, []);
});

test("reset and cancel drafts cannot mutate stored or default checkbox selections", () => {
  const saved = normalizeSavedSearchFilters({ mediaTypes: ["drama"], genreFilters: ["Comedy"], countryFilters: ["KR"] });
  const draft = createSearchFilterDraft(saved);
  draft.mediaTypes.push("movie"); draft.genreFilters.length = 0; draft.countryFilters.push("JP");
  assert.deepEqual(saved, { ...emptySearchFilters, mediaTypes: ["drama"], genreFilters: ["코미디"], countryFilters: ["KR"] });
  const reset = createSearchFilterDraft(emptySearchFilters);
  reset.mediaTypes.push("anime");
  assert.deepEqual(emptySearchFilters.mediaTypes, []);
});

test("save commits only after remote success, blocks duplicate writes and read overwrite", async () => {
  const scope = createSearchFilterPreferenceScope("A", () => "A");
  const pending = deferred<string>();
  const commits: string[] = [];
  const save = scope.save(() => pending.promise, (value) => commits.push(value));
  assert.equal(commits.length, 0);
  assert.equal(scope.hydrate("old read", (value) => commits.push(value)), false);
  await assert.rejects(scope.save(async () => "duplicate", (value) => commits.push(value)), /저장하는 중/);
  pending.resolve("new filters"); await save;
  assert.deepEqual(commits, ["new filters"]);
  assert.equal(scope.isSaving(), false);
});

test("failed write keeps the applied filters and permits a later retry", async () => {
  const scope = createSearchFilterPreferenceScope("A", () => "A");
  const applied = ["previous"];
  await assert.rejects(scope.save(async () => { throw new Error("network"); }, (value) => applied.push(value)), /network/);
  assert.deepEqual(applied, ["previous"]);
  await scope.save(async () => "retry", (value) => applied.push(value));
  assert.deepEqual(applied, ["previous", "retry"]);
});

test("late A load and save never apply to B", async () => {
  let userId = "A";
  const scopeA = createSearchFilterPreferenceScope("A", () => userId);
  const pending = deferred<string>();
  const commits: string[] = [];
  const save = scopeA.save(() => pending.promise, (value) => commits.push(value));
  userId = "B";
  assert.equal(scopeA.hydrate("A read", (value) => commits.push(value)), false);
  const scopeB = createSearchFilterPreferenceScope("B", () => userId);
  assert.equal(scopeB.hydrate("B read", (value) => commits.push(value)), true);
  pending.resolve("A write");
  await assert.rejects(save, /계정이 변경/);
  assert.deepEqual(commits, ["B read"]);
});

test("A to B to A cannot revive a closed account activation or unmounted response", async () => {
  let userId: string | null = "A";
  const oldA = createSearchFilterPreferenceScope("A", () => userId);
  const pending = deferred<string>();
  const commits: string[] = [];
  const save = oldA.save(() => pending.promise, (value) => commits.push(value));
  userId = "B"; oldA.close(); userId = "A";
  const newA = createSearchFilterPreferenceScope("A", () => userId);
  assert.equal(oldA.hydrate("stale", (value) => commits.push(value)), false);
  newA.hydrate("current", (value) => commits.push(value));
  pending.resolve("old save"); await assert.rejects(save, /계정이 변경/);
  newA.close();
  assert.equal(newA.hydrate("unmounted", (value) => commits.push(value)), false);
  assert.deepEqual(commits, ["current"]);
});

test("anonymous activation cannot load or write filters", async () => {
  const scope = createSearchFilterPreferenceScope(null, () => null);
  let wrote = false;
  assert.equal(scope.hydrate("value", () => { wrote = true; }), false);
  await assert.rejects(scope.save(async () => { wrote = true; return "value"; }, () => {}), /로그인/);
  assert.equal(wrote, false);
});
