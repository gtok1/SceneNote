import assert from "node:assert/strict";
import test from "node:test";
import {
  createPersonalSimilarityScope,
  createSimilarityScope,
  createSimilaritySnapshot,
  decodeSimilarityCursor,
  pageSimilaritySnapshot,
  projectSimilaritySnapshot,
  SIMILARITY_PAGINATION_VERSION,
  SimilarContentPagingError,
  validateSimilarityLimit
} from "./similarContentPaging";

const NOW = Date.UTC(2026, 10, 15);
const ID = "ae81c955-c32c-4ad0-a785-893bf0a4b7ca";
const SCOPE = "a".repeat(64);
const ANCHOR = {
  external_source: "anilist",
  external_id: "10793",
  content_type: "anime",
  season_number: null
};
const scopeInput = {
  anchor: ANCHOR,
  target: "anime",
  focus: "mood",
  sort: "latest",
  modifiers: [],
  limit: 12
};
function snapshot(count: number) {
  return createSimilaritySnapshot({
    id: ID,
    scope: SCOPE,
    anchor: ANCHOR,
    items: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      air_date: `2026-${String(12 - Math.floor(index / 28)).padStart(2, "0")}-${String(28 - (index % 28)).padStart(2, "0")}`
    })),
    warnings: [],
    now: NOW
  });
}
function failure(status: number, code: string) {
  return (error: unknown) =>
    error instanceof SimilarContentPagingError && error.status === status && error.code === code;
}
function encode(value: unknown) {
  return (
    "sc2." + btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  );
}

test("empty and exact-size snapshots end without a cursor", () => {
  for (const count of [0, 12]) {
    const page = pageSimilaritySnapshot(snapshot(count), SCOPE, 12, null, NOW);
    assert.equal(page.items.length, count);
    assert.equal(page.total_count, count);
    assert.equal(page.has_more, false);
    assert.equal(page.next_cursor, null);
    assert.equal(page.pagination_version, SIMILARITY_PAGINATION_VERSION);
  }
});

test("13 candidates continue as 12 then 1 without repeating the first page", () => {
  const state = snapshot(13);
  const first = pageSimilaritySnapshot(state, SCOPE, 12, undefined, NOW);
  assert.equal(first.items.length, 12);
  assert.equal(first.has_more, true);
  assert.ok(first.next_cursor);
  const second = pageSimilaritySnapshot(state, SCOPE, 12, first.next_cursor, NOW);
  assert.deepEqual(
    second.items.map((item) => item.id),
    [13]
  );
  assert.equal(second.has_more, false);
  assert.equal(second.next_cursor, null);
});

test("25 candidates preserve the full sorted order across 12,12,1 pages", () => {
  const state = snapshot(25);
  const first = pageSimilaritySnapshot(state, SCOPE, 12, undefined, NOW);
  const second = pageSimilaritySnapshot(state, SCOPE, 12, first.next_cursor, NOW);
  const third = pageSimilaritySnapshot(state, SCOPE, 12, second.next_cursor, NOW);
  assert.deepEqual([first.items.length, second.items.length, third.items.length], [12, 12, 1]);
  assert.deepEqual([...first.items, ...second.items, ...third.items], state.items);
  assert.equal(
    new Set([...first.items, ...second.items, ...third.items].map((item) => item.id)).size,
    25
  );
  assert.equal(third.next_cursor, null);
});

test("limit validation rejects coercion, nonintegers, nonfinite and unsupported limits", () => {
  assert.equal(validateSimilarityLimit(undefined), 12);
  for (const value of [1, 12, 24]) assert.equal(validateSimilarityLimit(value), value);
  for (const value of [null, 0, -1, 25, 1.2, NaN, Infinity, -Infinity, "12", [], [12], {}, true]) {
    assert.throws(() => validateSimilarityLimit(value), failure(400, "INVALID_REQUEST"));
  }
});

test("cursor decoding rejects malformed data and invalid offsets rather than restarting silently", () => {
  assert.equal(decodeSimilarityCursor(undefined), null);
  assert.equal(decodeSimilarityCursor(null), null);
  for (const cursor of [
    "",
    "sc1.!",
    "other.a",
    "sc1." + "a".repeat(600),
    0,
    [],
    {},
    encode(null),
    encode({ snapshot: ID, offset: 0, scope: SCOPE }),
    encode({ snapshot: ID, offset: -1, scope: SCOPE }),
    encode({ snapshot: ID, offset: 12.5, scope: SCOPE }),
    encode({ snapshot: "not-a-uuid", offset: 12, scope: SCOPE }),
    encode({ snapshot: ID, offset: 12, scope: "invalid" })
  ]) {
    assert.throws(() => decodeSimilarityCursor(cursor), failure(400, "INVALID_REQUEST"));
  }
});

test("a valid legacy cursor requests a restart while malformed legacy data stays invalid", () => {
  const legacy = "sc1." + btoa(JSON.stringify({ snapshot: ID, offset: 12, scope: SCOPE })).replace(/=+$/, "");
  assert.throws(() => decodeSimilarityCursor(legacy), failure(409, "SIMILARITY_RESTART_REQUIRED"));
  assert.throws(() => decodeSimilarityCursor("sc1.!"), failure(400, "INVALID_REQUEST"));
});

test("personal continuation scopes are stable only for the same account and normalized library", async () => {
  const expected = await createPersonalSimilarityScope(SCOPE, "account-a", "normalized-library-a");
  assert.equal(await createPersonalSimilarityScope(SCOPE, "account-a", "normalized-library-a"), expected);
  const publicState = snapshot(25);
  const projection = projectSimilaritySnapshot(publicState, expected, publicState.items);
  const first = pageSimilaritySnapshot(projection, expected, 12, undefined, NOW);
  assert.equal(pageSimilaritySnapshot(projection, expected, 12, first.next_cursor, NOW).items.length, 12);
  for (const changed of [
    await createPersonalSimilarityScope(SCOPE, "account-b", "normalized-library-a"),
    await createPersonalSimilarityScope(SCOPE, "account-a", "normalized-library-b"),
    await createPersonalSimilarityScope("b".repeat(64), "account-a", "normalized-library-a")
  ]) {
    assert.notEqual(changed, expected);
    assert.throws(
      () => pageSimilaritySnapshot(projectSimilaritySnapshot(publicState, changed, publicState.items), changed, 12, first.next_cursor, NOW),
      failure(409, "SIMILARITY_RESTART_REQUIRED")
    );
  }
});

test("a personal filtered projection pages 13 remaining works as 12 then 1 without changing the public cache", async () => {
  const publicState = snapshot(15);
  const original = structuredClone(publicState);
  const personalScope = await createPersonalSimilarityScope(SCOPE, "account-a", "two-registered-works");
  const projection = projectSimilaritySnapshot(publicState, personalScope, publicState.items.filter((item) => item.id > 2));
  const first = pageSimilaritySnapshot(projection, personalScope, 12, undefined, NOW);
  const second = pageSimilaritySnapshot(projection, personalScope, 12, first.next_cursor, NOW);
  assert.deepEqual([first.items.length, second.items.length], [12, 1]);
  assert.equal(first.total_count, 13);
  assert.equal(second.total_count, 13);
  assert.deepEqual(second.items.map((item) => item.id), [15]);
  assert.equal(second.has_more, false);
  projection.warnings.push("response only");
  projection.items.pop();
  assert.deepEqual(publicState, original);
  assert.equal(publicState.scope, SCOPE);
  assert.equal(publicState.items.length, 15);
  assert.equal(projection.expires_at, publicState.expires_at);
});

test("missing, expired, changed-scope or replaced snapshots require explicit restart", () => {
  const state = snapshot(25);
  const cursor = pageSimilaritySnapshot(state, SCOPE, 12, undefined, NOW).next_cursor;
  for (const value of [
    null,
    { ...state, scope: "b".repeat(64) },
    { ...state, id: "baab495c-38cc-4799-82d4-48f9a5e33110" },
    { ...state, expires_at: new Date(NOW).toISOString() },
    { ...state, expires_at: "invalid" },
    { ...state, pagination_version: "stale" }
  ]) {
    assert.throws(
      () => pageSimilaritySnapshot(value as typeof state, SCOPE, 12, cursor, NOW),
      failure(409, "SIMILARITY_RESTART_REQUIRED")
    );
  }
  assert.throws(
    () => pageSimilaritySnapshot(state, "c".repeat(64), 12, cursor, NOW),
    failure(409, "SIMILARITY_RESTART_REQUIRED")
  );
  assert.throws(
    () => pageSimilaritySnapshot(state, SCOPE, 12, cursor, NOW + 15 * 60_000),
    failure(409, "SIMILARITY_RESTART_REQUIRED")
  );
});

test("cursor offsets cannot skip arbitrary rows or continue beyond the snapshot", () => {
  for (const offset of [1, 13, 25, 36]) {
    assert.throws(
      () =>
        pageSimilaritySnapshot(
          snapshot(25),
          SCOPE,
          12,
          encode({ snapshot: ID, offset, scope: SCOPE }),
          NOW
        ),
      failure(409, "SIMILARITY_RESTART_REQUIRED")
    );
  }
});

test("request scope canonicalizes modifier order and duplicates", async () => {
  const modifiers = [
    { key: "romance", direction: "exclude" },
    { key: "short", direction: "include" }
  ];
  const first = await createSimilarityScope({ ...scopeInput, modifiers });
  const second = await createSimilarityScope({
    ...scopeInput,
    modifiers: [modifiers[1]!, modifiers[0]!, modifiers[1]!]
  });
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
});

test("every request identity or ranking change receives a different scope", async () => {
  const expected = await createSimilarityScope(scopeInput);
  for (const changed of [
    { ...scopeInput, anchor: { ...ANCHOR, external_source: "tmdb" } },
    { ...scopeInput, anchor: { ...ANCHOR, external_id: "2" } },
    { ...scopeInput, anchor: { ...ANCHOR, content_type: "movie" } },
    { ...scopeInput, anchor: { ...ANCHOR, season_number: 2 } },
    { ...scopeInput, target: "all" },
    { ...scopeInput, focus: "story" },
    { ...scopeInput, sort: "similarity" },
    { ...scopeInput, modifiers: [{ key: "romance", direction: "exclude" }] },
    { ...scopeInput, responseVersion: "similarity-snapshot-v2" },
    { ...scopeInput, limit: 24 }
  ])
    assert.notEqual(await createSimilarityScope(changed), expected);
});

test("snapshot and response own their arrays so paging does not mutate the ranked input", () => {
  const items = [{ id: 1 }],
    warnings = ["부분 장애"];
  const state = createSimilaritySnapshot({
    id: ID,
    scope: SCOPE,
    anchor: ANCHOR,
    items,
    warnings,
    now: NOW
  });
  items.push({ id: 2 });
  warnings.push("추가 알림");
  const page = pageSimilaritySnapshot(state, SCOPE, 12, undefined, NOW);
  assert.deepEqual(page.items, [{ id: 1 }]);
  page.items.push({ id: 3 });
  page.warnings.push("로컬 알림");
  assert.deepEqual(state.items, [{ id: 1 }]);
  assert.deepEqual(state.warnings, ["부분 장애"]);
});
