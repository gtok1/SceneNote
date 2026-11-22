import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const snapshotInput = () => ({
  review: null,
  firstWatchedAt: null,
  lastWatchedAt: null,
  firstFallback: { year: "2016", month: "03", day: "05" },
  lastFallback: { year: "2016", month: "05", day: "01" }
});

it("86 T-1: an untouched draft is not dirty", async () => {
  const { createReviewDraftSnapshot, isReviewDraftDirty } = await import("./reviewDraft");
  const current = createReviewDraftSnapshot(snapshotInput());
  const baseline = createReviewDraftSnapshot(snapshotInput());
  assert.notStrictEqual(current.firstWatchedDate, baseline.firstWatchedDate);
  assert.notStrictEqual(current.lastWatchedDate, baseline.lastWatchedDate);
  assert.deepEqual(current, baseline);
  assert.equal(isReviewDraftDirty(current, baseline), false);
});

it("86 T-2: every field change makes the draft dirty", async () => {
  const { createReviewDraftSnapshot, isReviewDraftDirty } = await import("./reviewDraft");
  const baseline = createReviewDraftSnapshot({
    ...snapshotInput(),
    review: { rating: 4, one_line_review: "한줄 후기", body: "소감", is_spoiler: false }
  });
  const changes = [
    { ...baseline, rating: 7 },
    { ...baseline, oneLineReview: `${baseline.oneLineReview} ` },
    { ...baseline, body: "고친 소감" },
    { ...baseline, isSpoiler: true },
    { ...baseline, firstWatchedDate: { ...baseline.firstWatchedDate, year: "2017" } },
    { ...baseline, lastWatchedDate: { ...baseline.lastWatchedDate, day: "02" } }
  ];
  assert.equal(changes.length, 6);
  for (const current of changes) assert.equal(isReviewDraftDirty(current, baseline), true);
});

it("86 T-3: rebasing keeps user edits and refreshes untouched fields", async () => {
  const { createReviewDraftSnapshot, rebaseReviewDraft } = await import("./reviewDraft");
  const previous = createReviewDraftSnapshot(snapshotInput());
  const current = {
    ...previous,
    body: "사용자가 고친 소감",
    firstWatchedDate: { year: "2017", month: "01", day: "02" }
  };
  const next = createReviewDraftSnapshot({
    ...snapshotInput(),
    firstFallback: { year: "2016", month: "03", day: "04" },
    lastFallback: { year: "2016", month: "06", day: "01" }
  });
  assert.deepEqual(rebaseReviewDraft(current, previous, next), {
    ...current,
    lastWatchedDate: next.lastWatchedDate
  });
  const sameValues = createReviewDraftSnapshot(snapshotInput());
  assert.notStrictEqual(previous.firstWatchedDate, sameValues.firstWatchedDate);
  assert.deepEqual(rebaseReviewDraft(current, previous, sameValues), current);
});

it("86 T-4: snapshot uses saved values, then fallbacks", async () => {
  const { createReviewDraftSnapshot, parseWatchDateParts, EMPTY_WATCH_DATE } = await import("./reviewDraft");
  const input = snapshotInput();
  assert.deepEqual(createReviewDraftSnapshot(input), {
    rating: null,
    oneLineReview: "",
    body: "",
    isSpoiler: false,
    firstWatchedDate: input.firstFallback,
    lastWatchedDate: input.lastFallback
  });
  assert.deepEqual(createReviewDraftSnapshot({
    ...input,
    review: { rating: 8, one_line_review: "저장한 후기", body: "저장한 소감", is_spoiler: true },
    firstWatchedAt: "2026-01-01",
    lastWatchedAt: "2026-02-03"
  }), {
    rating: 8,
    oneLineReview: "저장한 후기",
    body: "저장한 소감",
    isSpoiler: true,
    firstWatchedDate: { year: "2026", month: "01", day: "01" },
    lastWatchedDate: { year: "2026", month: "02", day: "03" }
  });
  assert.deepEqual(createReviewDraftSnapshot({
    review: { rating: null, one_line_review: "", body: null, is_spoiler: false },
    firstWatchedAt: "",
    lastWatchedAt: null,
    firstFallback: null,
    lastFallback: null
  }), {
    rating: null, oneLineReview: "", body: "", isSpoiler: false,
    firstWatchedDate: EMPTY_WATCH_DATE, lastWatchedDate: EMPTY_WATCH_DATE
  });
  assert.strictEqual(parseWatchDateParts(null), EMPTY_WATCH_DATE);
  assert.strictEqual(parseWatchDateParts("", input.firstFallback), input.firstFallback);
});

it("86 T-5: a saved snapshot stays clean after the server catches up", async () => {
  const { createReviewDraftSnapshot, isReviewDraftDirty, rebaseReviewDraft } = await import("./reviewDraft");
  const savedInput = {
    ...snapshotInput(),
    review: { rating: 9, one_line_review: "저장된 후기", body: "저장된 소감", is_spoiler: true },
    firstWatchedAt: "2026-01-01",
    lastWatchedAt: "2026-01-03"
  };
  const saved = createReviewDraftSnapshot(savedInput);
  const server = createReviewDraftSnapshot(savedInput);
  assert.notStrictEqual(saved.firstWatchedDate, server.firstWatchedDate);
  assert.notStrictEqual(saved.lastWatchedDate, server.lastWatchedDate);
  const rebased = rebaseReviewDraft(saved, saved, server);
  assert.deepEqual(rebased, saved);
  assert.equal(isReviewDraftDirty(rebased, server), false);
});

it("86 T-6: the review editor wires the leave guard", () => {
  const source = readFileSync(fileURLToPath(new URL("../components/content/ContentReviewEditor.tsx", import.meta.url).href), "utf8");
  for (const marker of ["usePreventRemove(", "confirmDiscard(", '"beforeunload"', "isReviewDraftDirty(", "rebaseReviewDraft("]) {
    assert.ok(source.includes(marker), `Missing ${marker}`);
  }
  assert.equal(source.includes("useState<WatchDateParts>"), false);
});
