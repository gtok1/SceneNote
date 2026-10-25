import assert from "node:assert/strict";
import { it } from "node:test";

it("RQ-1 clears the request query for empty whitespace or one-character input", async () => {
  const { nextSearchRequestQuery } = await import("./searchRequestQuery");
  for (const raw of ["", " ", "너"]) {
    assert.equal(nextSearchRequestQuery("너말고", raw), "");
  }
});

it("RQ-2 detects composing Hangul jamo without rejecting completed Korean or English", async () => {
  const { hasComposingHangulJamo } = await import("./searchRequestQuery");
  assert.equal(hasComposingHangulJamo("너말ㄱ"), true);
  assert.equal(hasComposingHangulJamo("ㄴㅁ"), true);
  assert.equal(hasComposingHangulJamo("너말고"), false);
  assert.equal(hasComposingHangulJamo("one piece"), false);
});

it("RQ-3 retains the previous request query while Hangul is composing", async () => {
  const { nextSearchRequestQuery } = await import("./searchRequestQuery");
  assert.equal(nextSearchRequestQuery("너말", "너말ㄱ"), "너말");
  assert.equal(nextSearchRequestQuery("너말", "ㄴㅁ"), "너말");
});

it("RQ-4 accepts completed Korean and English request queries", async () => {
  const { nextSearchRequestQuery } = await import("./searchRequestQuery");
  assert.equal(nextSearchRequestQuery("", "너말고"), "너말고");
  assert.equal(nextSearchRequestQuery("너말고", "one piece"), "one piece");
});

it("RQ-5 trims outer whitespace from the request query", async () => {
  const { nextSearchRequestQuery } = await import("./searchRequestQuery");
  assert.equal(nextSearchRequestQuery("", "  너말고  "), "너말고");
});

it("RQ-6 uses a 300ms search query debounce", async () => {
  const { SEARCH_QUERY_DEBOUNCE_MS } = await import("./searchRequestQuery");
  assert.equal(SEARCH_QUERY_DEBOUNCE_MS, 300);
});
