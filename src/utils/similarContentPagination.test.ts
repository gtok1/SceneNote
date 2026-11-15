import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeSimilarPages, nextSimilarCursor, similarPaginationUnavailable,
  similarResultsStatus, SimilarContentError, isSimilarityRestartRequired,
  validateSimilarPage, similarityAnchorKey, shouldLoadMoreSimilarOnScroll, normalizeSimilaritySecondarySort
} from "./similarContentPagination";

const item = (id: string, season?: number) => ({
  external_source: "anilist", external_id: id, ...(season ? { season_number: season } : {})
});
const page = (ids: string[], cursor: string | null, total = 25) => ({
  items: ids.map(id => item(id)), has_more: cursor !== null, next_cursor: cursor,
  pagination_version: "similarity-snapshot-v2", total_count: total
});

test("similar pages append 12 + 12 + 1 without losing server order", () => {
  const ids = Array.from({ length: 25 }, (_, i) => String(i + 1));
  const pages = [page(ids.slice(0, 12), "p12"), page(ids.slice(12, 24), "p24"), page(ids.slice(24), null)];
  assert.deepEqual(mergeSimilarPages(pages).map(i => i.external_id), ids);
  assert.equal(nextSimilarCursor(pages[0]!, [pages[0]!]), "p12");
  assert.equal(nextSimilarCursor(pages[1]!, pages.slice(0, 2)), "p24");
  assert.equal(nextSimilarCursor(pages[2]!, pages), undefined);
});

test("duplicate identities keep first copy while different seasons stay distinct", () => {
  const first = { ...item("1", 1), title: "first" };
  const result = mergeSimilarPages([
    { items: [first, { ...item("1", 2), title: "second season" }] },
    { items: [{ ...first, title: "later duplicate" }, { ...item("2"), title: "new" }] }
  ]);
  assert.deepEqual(result.map(i => i.title), ["first", "second season", "new"]);
});

test("repeating a continuation cursor cannot trigger a request loop", () => {
  const first = page(["1"], "same");
  const repeated = page(["2"], "same");
  assert.equal(nextSimilarCursor(repeated, [first, repeated]), undefined);
});

test("legacy response still renders but cannot claim pagination support", () => {
  const legacy = { items: [item("1")], has_more: false, next_cursor: null };
  assert.equal(similarPaginationUnavailable([legacy]), true);
  assert.equal(nextSimilarCursor(legacy, [legacy]), undefined);
  assert.deepEqual(mergeSimilarPages([legacy]), legacy.items);
  assert.equal(similarPaginationUnavailable([page(["1"], null, 1)]), false);
});

test("malformed new pagination contracts are rejected instead of silently ending", () => {
  for (const invalid of [
    { ...page(["1"], "next"), next_cursor: null },
    { ...page(["1"], null), next_cursor: "next" },
    { ...page(["1"], null), total_count: 0 },
    { ...page(["1"], null), total_count: 1.5 },
    { ...page([], "next"), total_count: 20 },
    { ...page(["1"], null), pagination_version: "unknown-v9" }
  ]) assert.throws(() => validateSimilarPage(invalid), /응답/);
  assert.doesNotThrow(() => validateSimilarPage(page(["1"], "next")));
  assert.doesNotThrow(() => validateSimilarPage(page([], null, 0)));
});

test("snapshot expiry is recoverable separately from network/provider failures", () => {
  assert.equal(isSimilarityRestartRequired(new SimilarContentError("SIMILARITY_RESTART_REQUIRED")), true);
  assert.equal(isSimilarityRestartRequired(new SimilarContentError("SIMILARITY_PROVIDER_FAILED")), false);
  assert.equal(isSimilarityRestartRequired(new Error("raw server error")), false);
  assert.doesNotMatch(new SimilarContentError("SIMILARITY_PROVIDER_FAILED").message, /Edge Function|raw server/);
});

test("visible status makes selected ordering and collected total explicit", () => {
  assert.equal(similarResultsStatus("latest", 24, 25), "유사도 우선 · 최신순 · 비슷한 작품 24 / 25개 표시");
  assert.equal(similarResultsStatus("similarity", 12), "유사도 우선 · 최신순 · 비슷한 작품 12개 표시");
  assert.equal(similarResultsStatus("popular", 1, 1), "유사도 우선 · 인기순 · 비슷한 작품 1 / 1개 표시");
});

test("old similarity links retain mandatory similarity and use latest as the tie breaker", () => {
  assert.equal(normalizeSimilaritySecondarySort("similarity"), "latest");
  assert.equal(normalizeSimilaritySecondarySort(undefined), "latest");
  assert.equal(normalizeSimilaritySecondarySort(["popular"]), "latest");
  assert.equal(normalizeSimilaritySecondarySort("popular"), "popular");
});

test("same TMDB number in movie and TV namespaces cannot share an anchor cache", () => {
  const base = { external_source: "tmdb", external_id: "42" };
  assert.notEqual(similarityAnchorKey({ ...base, content_type: "movie" }), similarityAnchorKey({ ...base, content_type: "anime" }));
  assert.notEqual(similarityAnchorKey({ ...base, content_type: "anime", season_number: 1 }), similarityAnchorKey({ ...base, content_type: "anime", season_number: 2 }));
  assert.equal(similarityAnchorKey(null), "");
});

test("automatic loading requires a downward scroll near the end, not a layout event", () => {
  const end = { previousOffsetY: 300, offsetY: 600, viewportHeight: 800, contentHeight: 1500 };
  assert.equal(shouldLoadMoreSimilarOnScroll(end), true);
  assert.equal(shouldLoadMoreSimilarOnScroll({ ...end, previousOffsetY: null }), false);
  assert.equal(shouldLoadMoreSimilarOnScroll({ ...end, offsetY: 300 }), false);
  assert.equal(shouldLoadMoreSimilarOnScroll({ ...end, offsetY: 200 }), false);
  assert.equal(shouldLoadMoreSimilarOnScroll({ ...end, contentHeight: 3000 }), false);
});
