import assert from "node:assert/strict";
import test from "node:test";

import type { LibraryListItem } from "@/types/library";
import type { PersonCredit } from "@/types/people";
import {
  createPersonCreditKey,
  dedupeValidPersonCredits,
  getPersonWorkStatus,
  matchesPersonCreditQuery,
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

test("빈 검색어는 모든 작품을 통과시킨다", () => {
  assert.equal(matchesPersonCreditQuery(credit, ""), true);
  assert.equal(matchesPersonCreditQuery(credit, "   "), true);
});

test("제목·원제·배역명 어느 쪽으로도 대소문자·공백 무관하게 검색된다", () => {
  assert.equal(matchesPersonCreditQuery(credit, "작품"), true);
  assert.equal(matchesPersonCreditQuery(credit, "WORK"), true);
  assert.equal(matchesPersonCreditQuery(credit, "  work  "), true);
  assert.equal(matchesPersonCreditQuery(credit, "주연"), true);
});

test("일치하지 않는 검색어는 걸러낸다", () => {
  assert.equal(matchesPersonCreditQuery(credit, "무관한작품"), false);
});

test("원제나 배역명이 없어도 오류 없이 처리한다", () => {
  const noExtras = { ...credit, original_title: null, role: null };
  assert.equal(matchesPersonCreditQuery(noExtras, "작품"), true);
  assert.equal(matchesPersonCreditQuery(noExtras, "work"), false);
});
