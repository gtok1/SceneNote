import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

import { createReviewDraftSnapshot, EMPTY_WATCH_DATE } from "./reviewDraft";

const editorPath = "src/components/content/ContentReviewEditor.tsx";

it("92 T-1: today fills the local date", async () => {
  const { todayWatchDateParts, WATCH_DATE_INPUT_COPY } = await import("./watchDateInput");
  assert.deepEqual(todayWatchDateParts(new Date(2026, 10, 22, 23, 59)), { year: "2026", month: "11", day: "22" });
  assert.deepEqual(todayWatchDateParts(new Date(2026, 0, 5, 0, 0)), { year: "2026", month: "1", day: "5" });
  assert.deepEqual(todayWatchDateParts(new Date(2025, 11, 31, 23, 59)), { year: "2025", month: "12", day: "31" });
  assert.deepEqual(WATCH_DATE_INPUT_COPY, {
    emptyYear: "기록 안 함",
    today: "오늘",
    todayAccessibilityLabel: "마지막 본 시기를 오늘로 채우기"
  });
});

it("92 T-2: the editor no longer pre-fills watch dates", () => {
  const editor = readFileSync(editorPath, "utf8");
  for (const marker of [
    "firstFallback: null", "lastFallback: null",
    "parseWatchDateParts(nextFirstWatchedAt, null)", "parseWatchDateParts(nextLastWatchedAt, null)",
    "nextFirstWatchedAt !== (firstWatchedAt ?? null)", "nextLastWatchedAt !== (lastWatchedAt ?? null)"
  ]) assert.ok(editor.includes(marker), `missing ${marker}`);
  for (const fallback of [
    "firstFallback: releaseWatchDate", "lastFallback: completionWatchDate",
    "parseWatchDateParts(nextFirstWatchedAt, releaseWatchDate)", "parseWatchDateParts(nextLastWatchedAt, completionWatchDate)"
  ]) assert.ok(!editor.includes(fallback), fallback);

  const snapshot = createReviewDraftSnapshot({
    review: { rating: 8, one_line_review: null, body: null, is_spoiler: false },
    firstWatchedAt: null, lastWatchedAt: null, firstFallback: null, lastFallback: null
  });
  assert.deepEqual(snapshot.firstWatchedDate, EMPTY_WATCH_DATE);
  assert.deepEqual(snapshot.lastWatchedDate, EMPTY_WATCH_DATE);
});

it("92 T-3: empty year label is configurable and filters keep theirs", () => {
  const yearSelect = readFileSync("src/components/common/YearSelect.tsx", "utf8");
  assert.ok(/emptyLabel\s*=\s*"전체 연도"/.test(yearSelect), "missing default emptyLabel");
  assert.doesNotMatch(yearSelect, />\s*전체 연도\s*</);
  const editor = readFileSync(editorPath, "utf8");
  assert.ok(editor.includes("emptyLabel={WATCH_DATE_INPUT_COPY.emptyYear}"));
  assert.ok(editor.includes("onPickToday"));

  for (const file of [
    "app/(tabs)/library.tsx", "src/components/content/ContentSearchBar.tsx", "src/components/library/LibraryFilterBottomSheet.tsx"
  ]) {
    const selectors = readFileSync(file, "utf8").match(/<YearSelect\b[\s\S]*?\/>/g) ?? [];
    assert.ok(selectors.length > 0, file);
    for (const selector of selectors) assert.doesNotMatch(selector, /\bemptyLabel\b/, file);
  }
});
