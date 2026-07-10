import assert from "node:assert/strict";
import test from "node:test";

import type { LibraryListItem } from "@/types/library";
import type { PersonCredit } from "@/types/people";
import {
  createPersonCreditKey,
  dedupeValidPersonCredits,
  getPersonWorkStatus,
  parsePersonCreditFilter
} from "./personCredits";

const credit: PersonCredit = {
  external_source: "tmdb",
  external_id: "42",
  title: "작품",
  original_title: "Work",
  poster_url: null,
  content_type: "movie",
  air_year: 2025,
  air_date: "2025-01-01",
  role: "주연"
};

test("인물 작품활동은 외부 작품 ID 기준으로 한 번만 집계한다", () => {
  const duplicate = { ...credit, role: "특별출연" };
  const invalid = { ...credit, external_id: "", title: "삭제된 작품" };

  assert.deepEqual(dedupeValidPersonCredits([credit, duplicate, invalid]), [credit]);
  assert.equal(createPersonCreditKey(credit), "tmdb:42");
});

test("복수 상태에서는 감상 완료 상태를 우선 표시한다", () => {
  const item = {
    statuses: ["wishlist", "completed"]
  } as LibraryListItem;

  assert.equal(getPersonWorkStatus(item), "completed");
  assert.equal(getPersonWorkStatus(undefined), null);
});

test("작품활동 필터 query parameter를 안전하게 해석한다", () => {
  assert.equal(parsePersonCreditFilter("watched"), "watched");
  assert.equal(parsePersonCreditFilter(["library", "all"]), "library");
  assert.equal(parsePersonCreditFilter("unknown"), "all");
});
