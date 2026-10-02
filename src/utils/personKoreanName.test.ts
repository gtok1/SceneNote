import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FavoritePerson } from "@/types/people";

import {
  KOREAN_NAME_MAX_LENGTH,
  KOREAN_NAME_RECHECK_DAYS,
  KOREAN_NAME_RESOLVE_BATCH,
  koreanNameCaption,
  missingKoreanNameNotice,
  normalizeKoreanNameInput,
  pickKoreanName,
  selectFavoritesNeedingKoreanName
} from "./personKoreanName";

function favorite(overrides: Partial<FavoritePerson> = {}): FavoritePerson {
  return {
    id: "f1",
    user_id: "u1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    source: "tmdb",
    external_id: "1",
    category: "actor",
    name: "長瀬智也",
    original_name: "長瀬智也",
    profile_url: null,
    known_for: [],
    ...overrides
  };
}

describe("normalizeKoreanNameInput", () => {
  it("V-1 trims, collapses spaces and validates in order", () => {
    assert.deepEqual(normalizeKoreanNameInput("  나가세   토모야 "), { ok: true, value: "나가세 토모야" });
    assert.deepEqual(normalizeKoreanNameInput(""), { ok: false, message: "한글 이름을 입력해 주세요." });
    assert.deepEqual(normalizeKoreanNameInput("   "), { ok: false, message: "한글 이름을 입력해 주세요." });
    assert.deepEqual(normalizeKoreanNameInput("長瀬 토모야"), {
      ok: false,
      message: "일본어 표기는 빼고 한글로만 입력해 주세요."
    });
    assert.deepEqual(normalizeKoreanNameInput("Tomoya"), { ok: false, message: "한글이 들어간 이름을 입력해 주세요." });
    assert.deepEqual(normalizeKoreanNameInput("가".repeat(40)), { ok: true, value: "가".repeat(40) });
    assert.deepEqual(normalizeKoreanNameInput("가".repeat(41)), { ok: false, message: "40자 이하로 입력해 주세요." });
  });
});

describe("koreanNameCaption", () => {
  it("C-1 maps each status and favorited flag", () => {
    assert.deepEqual(koreanNameCaption("not_applicable", true), { caption: null, actionLabel: null });
    assert.deepEqual(koreanNameCaption("not_applicable", false), { caption: null, actionLabel: null });
    assert.deepEqual(koreanNameCaption("provided", true), { caption: null, actionLabel: "한글 이름 고치기" });
    assert.deepEqual(koreanNameCaption("provided", false), { caption: null, actionLabel: null });
    const estimated = "일본어 읽기를 자동으로 옮긴 한글 표기예요.";
    assert.deepEqual(koreanNameCaption("estimated", true), { caption: estimated, actionLabel: "고치기" });
    assert.deepEqual(koreanNameCaption("estimated", false), { caption: estimated, actionLabel: null });
    const user = "직접 입력한 한글 이름이에요.";
    assert.deepEqual(koreanNameCaption("user", true), { caption: user, actionLabel: "고치기" });
    assert.deepEqual(koreanNameCaption("user", false), { caption: user, actionLabel: null });
    assert.deepEqual(koreanNameCaption("missing", true), { caption: "한글 이름이 아직 없어요.", actionLabel: "한글 이름 넣기" });
    assert.deepEqual(koreanNameCaption("missing", false), {
      caption: "좋아하는 인물로 등록하면 한글 이름을 직접 넣을 수 있어요.",
      actionLabel: null
    });
  });
});

describe("selectFavoritesNeedingKoreanName", () => {
  const now = new Date("2026-10-01T12:00:00Z");

  it("S-1 selects missing/estimated rows that were not checked recently, skipping user names", () => {
    const a = favorite({ id: "a", external_id: "a" });
    const b = favorite({ id: "b", external_id: "b", name_ko_checked_at: "2026-09-25T00:00:00Z" });
    const c = favorite({
      id: "c",
      external_id: "c",
      name_ko: "나가세 토모야",
      name_ko_source: "romaji",
      name_ko_checked_at: "2026-08-01T00:00:00Z"
    });
    const d = favorite({
      id: "d",
      external_id: "d",
      name: "마츠모토 준",
      original_name: "松本潤",
      name_ko: "마쓰모토 준",
      name_ko_source: "user",
      name_ko_checked_at: null
    });
    const e = favorite({ id: "e", external_id: "e", name: "사카이 마사토", original_name: "堺雅人" });
    const f = favorite({ id: "f", external_id: "f", name: "정소민", original_name: null });
    const g = favorite({
      id: "g",
      external_id: "g",
      source: "anilist",
      category: "voice_actor",
      name: "花江夏樹",
      original_name: "Natsuki Hanae",
      name_ko_checked_at: null
    });
    const h = favorite({
      id: "h",
      external_id: "h",
      name_ko: "나가세 토모야",
      name_ko_source: "romaji",
      name_ko_checked_at: "2026-09-30T00:00:00Z"
    });
    assert.deepEqual(selectFavoritesNeedingKoreanName([a, b, c, d, e, f, g, h], now), [a, c, g]);
  });

  it("S-2 caps the batch", () => {
    const rows = Array.from({ length: 25 }, (_, index) => favorite({ id: `r${index}`, external_id: String(index) }));
    assert.deepEqual(selectFavoritesNeedingKoreanName(rows, now), rows.slice(0, 20));
  });

  it("S-3 exposes constants", () => {
    assert.equal(KOREAN_NAME_MAX_LENGTH, 40);
    assert.equal(KOREAN_NAME_RECHECK_DAYS, 30);
    assert.equal(KOREAN_NAME_RESOLVE_BATCH, 20);
  });
});

describe("missingKoreanNameNotice", () => {
  it("M-1 counts only missing rows", () => {
    const c = favorite({ id: "c", name_ko: "나가세 토모야", name_ko_source: "romaji" });
    const e = favorite({ id: "e", name: "사카이 마사토", original_name: "堺雅人" });
    const f = favorite({ id: "f", name: "정소민", original_name: null });
    assert.equal(missingKoreanNameNotice([c, e, f]), null);
    const missing = [1, 2, 3].map((n) => favorite({ id: `m${n}`, external_id: String(n) }));
    assert.equal(missingKoreanNameNotice(missing), "한글 이름이 없는 인물 3명은 인물 상세에서 이름을 넣을 수 있어요.");
  });
});

describe("pickKoreanName", () => {
  it("P-1 prefers user input, then detail, then favorite", () => {
    assert.deepEqual(
      pickKoreanName({ name_ko: "나가세 토모야", name_ko_source: "romaji" }, { name_ko: "나가세 도모야", name_ko_source: "user" }),
      { name_ko: "나가세 도모야", name_ko_source: "user" }
    );
    assert.deepEqual(
      pickKoreanName({ name_ko: "나가세 토모야", name_ko_source: "romaji" }, { name_ko: null, name_ko_source: null }),
      { name_ko: "나가세 토모야", name_ko_source: "romaji" }
    );
    assert.deepEqual(
      pickKoreanName({ name_ko: null, name_ko_source: null }, { name_ko: "나가세 토모야", name_ko_source: "romaji" }),
      { name_ko: "나가세 토모야", name_ko_source: "romaji" }
    );
    assert.deepEqual(pickKoreanName(undefined, undefined), { name_ko: null, name_ko_source: null });
  });
});
