import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

import { createReviewLabel } from "./reviewDisplay";

it("91 T-1: spoiler one-liners stay hidden until revealed", async () => {
  const { createSharedReviewView } = await import("./sharedReviewDisplay");
  const review = "결말에 주인공이 죽는다";
  const rated = { rating: 8, oneLineReview: review, isSpoiler: true };
  assert.deepEqual(createSharedReviewView({ ...rated, revealed: false }), {
    label: createReviewLabel(8, null), spoilerHidden: true
  });
  assert.deepEqual(createSharedReviewView({ ...rated, revealed: true }), {
    label: createReviewLabel(8, review), spoilerHidden: false
  });
  const unrated = { rating: null, oneLineReview: "결말", isSpoiler: true };
  assert.deepEqual(createSharedReviewView({ ...unrated, revealed: false }), {
    label: null, spoilerHidden: true
  });
  assert.deepEqual(createSharedReviewView({ ...unrated, revealed: true }), {
    label: createReviewLabel(null, "결말"), spoilerHidden: false
  });
  for (const oneLineReview of ["", "   ", null, undefined]) {
    assert.deepEqual(createSharedReviewView({ ...rated, oneLineReview, revealed: false }), {
      label: createReviewLabel(8, oneLineReview), spoilerHidden: false
    });
  }
  for (const isSpoiler of [false, undefined, null]) {
    assert.deepEqual(createSharedReviewView({ rating: 8, oneLineReview: "좋았다", isSpoiler, revealed: false }), {
      label: createReviewLabel(8, "좋았다"), spoilerHidden: false
    });
  }
  assert.deepEqual(createSharedReviewView({ rating: null, oneLineReview: null, isSpoiler: true, revealed: false }), {
    label: null, spoilerHidden: false
  });
});

it("91 T-2: the share function sends the spoiler flag without a contract bump", () => {
  const handler = readFileSync("supabase/functions/get-library-share/index.ts", "utf8");
  assert.ok(handler.includes('.select("content_id,rating,one_line_review,is_spoiler")'), "review query omits is_spoiler");
  assert.match(handler, /interface ReviewRow\s*\{[^}]*\bis_spoiler:\s*boolean\s*\|\s*null/);
  assert.ok(handler.includes("review_is_spoiler: review?.is_spoiler === true"));
  assert.ok(handler.includes('contract_version: "library-share-v2"'));
  assert.ok(!handler.includes("library-share-v3"));
});

it("91 T-3: shared cards use the spoiler view", () => {
  const screen = readFileSync("src/components/library/LibraryShareScreenContent.tsx", "utf8");
  assert.ok(screen.includes("createSharedReviewView("), "shared cards bypass the spoiler view");
  assert.ok(screen.includes("SHARED_REVIEW_COPY.reveal"));
  assert.ok(!screen.includes("createReviewLabel(item.rating, item.one_line_review)"));
  const types = readFileSync("src/types/libraryShare.ts", "utf8");
  assert.ok(types.includes("review_is_spoiler?: boolean"));
  assert.ok(types.includes("items: SharedLibraryItem[]"));
  assert.ok(!readFileSync("src/types/library.ts", "utf8").includes("review_is_spoiler"));
});

it("91 T-4: reveal copy matches pins", async () => {
  const { SHARED_REVIEW_COPY } = await import("./sharedReviewDisplay");
  assert.equal(SHARED_REVIEW_COPY.reveal, "스포일러 포함 · 보기");
  assert.ok(readFileSync("src/components/pins/PinTimelineItem.tsx", "utf8").includes(SHARED_REVIEW_COPY.reveal));
});
