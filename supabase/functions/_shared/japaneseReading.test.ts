import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasHangul,
  hasJapaneseScript,
  isKanaOnly,
  kanaToHangul,
  resolveKoreanName,
  romajiToHangul
} from "./japaneseReading.ts";

describe("romajiToHangul", () => {
  it("R-1 converts given-family romaji to family-first customary hangul", () => {
    const cases: [string, string][] = [
      ["Natsuki Hanae", "하나에 나츠키"],
      ["Tomoya Nagase", "나가세 토모야"],
      ["Masato Sakai", "사카이 마사토"],
      ["Shun Oguri", "오구리 슌"],
      ["Jun Matsumoto", "마츠모토 준"],
      ["Erika Toda", "토다 에리카"],
      ["Hiroshi Abe", "아베 히로시"],
      ["Riho Yoshioka", "요시오카 리호"],
      ["Nana Mizuki", "미즈키 나나"],
      ["Megumi Hayashibara", "하야시바라 메구미"]
    ];
    for (const [input, expected] of cases) assert.equal(romajiToHangul(input, "given-family"), expected, input);
  });

  it("R-2 handles long vowels, ou before a vowel, geminates and n'", () => {
    const cases: [string, string][] = [
      ["Kenji Satou", "사토 켄지"],
      ["Ryuuichi Kondō", "콘도 류이치"],
      ["Kappa Ichiro", "이치로 캇파"],
      ["Kyoko Shimizu", "시미즈 쿄코"],
      ["Shouta Sometani", "소메타니 쇼타"],
      ["Masahiro Inoue", "이노우에 마사히로"],
      ["Shin'ichi Okada", "오카다 신이치"]
    ];
    for (const [input, expected] of cases) assert.equal(romajiToHangul(input, "given-family"), expected, input);
  });

  it("R-3 respects order and single tokens, rejects unconvertible romaji", () => {
    assert.equal(romajiToHangul("Matsumoto Jun", "family-given"), "마츠모토 준");
    assert.equal(romajiToHangul("Kanna", "given-family"), "칸나");
    assert.equal(romajiToHangul("Gackt", "given-family"), null);
  });

  it("R-4 returns null for empty or unconvertible input", () => {
    assert.equal(romajiToHangul("", "given-family"), null);
    assert.equal(romajiToHangul("  ", "given-family"), null);
    assert.equal(romajiToHangul("Xyz Qw", "given-family"), null);
  });
});

describe("kanaToHangul", () => {
  it("R-5 converts kana readings and rejects mixed script", () => {
    assert.equal(kanaToHangul("さかい まさと"), "사카이 마사토");
    assert.equal(kanaToHangul("まつもと じゅん"), "마츠모토 준");
    assert.equal(kanaToHangul("ながせ ともや"), "나가세 토모야");
    assert.equal(kanaToHangul("こんどう けんじ"), "콘도 켄지");
    assert.equal(kanaToHangul("いのうえ"), "이노우에");
    assert.equal(kanaToHangul("ハナエ・ナツキ"), "하나에 나츠키");
    assert.equal(kanaToHangul("きっかわ"), "킷카와");
    assert.equal(kanaToHangul("しんいち"), "신이치");
    assert.equal(kanaToHangul("ゆうき"), "유키");
    assert.equal(kanaToHangul("堺 まさと"), null);
  });
});

describe("script helpers", () => {
  it("R-6 detects hangul, japanese script and kana-only text", () => {
    assert.equal(hasHangul("사카이"), true);
    assert.equal(hasHangul("堺"), false);
    assert.equal(hasJapaneseScript("堺雅人"), true);
    assert.equal(hasJapaneseScript("まさと"), true);
    assert.equal(hasJapaneseScript("Masato"), false);
    assert.equal(isKanaOnly("まつもと じゅん"), true);
    assert.equal(isKanaOnly("松本 潤"), false);
    assert.equal(isKanaOnly(""), false);
  });
});

describe("resolveKoreanName", () => {
  it("R-7 follows the source priority tmdb > alias > kana > romaji > kana", () => {
    // a) TMDB ko-KR translation wins
    assert.deepEqual(
      resolveKoreanName({
        nativeName: "堺雅人",
        localizedName: "사카이 마사토",
        aliases: ["さかい まさと"],
        romaji: { text: "Masato Sakai", order: "given-family" }
      }),
      { nameKo: "사카이 마사토", source: "tmdb" }
    );
    // b) untranslated -> romaji
    assert.deepEqual(
      resolveKoreanName({
        nativeName: "長瀬智也",
        localizedName: "長瀬智也",
        aliases: [],
        romaji: { text: "Tomoya Nagase", order: "given-family" }
      }),
      { nameKo: "나가세 토모야", source: "romaji" }
    );
    // c) Hangul-only alias, skipping mixed aliases
    assert.deepEqual(
      resolveKoreanName({
        nativeName: "花江夏樹",
        localizedName: null,
        aliases: ["Peroperonchino (ペロペロンチーノ)", "Haruki Matsuda (松田春樹)", "Hana-chan", "하나에 나츠키"],
        romaji: { text: "Hanae Natsuki", order: "family-given" }
      }),
      { nameKo: "하나에 나츠키", source: "alias" }
    );
    // d) spaced kana beats romaji
    assert.deepEqual(
      resolveKoreanName({
        nativeName: "松本潤",
        localizedName: "松本潤",
        aliases: ["松本 潤", "まつもと じゅん", "MatsuJun"],
        romaji: { text: "Jun Matsumoto", order: "given-family" }
      }),
      { nameKo: "마츠모토 준", source: "kana" }
    );
    // e) unspaced kana: romaji first, kana as last resort
    const unspaced = {
      nativeName: "松本潤",
      localizedName: "松本潤",
      aliases: ["まつもとじゅん"]
    };
    assert.deepEqual(
      resolveKoreanName({ ...unspaced, romaji: { text: "Jun Matsumoto", order: "given-family" } }),
      { nameKo: "마츠모토 준", source: "romaji" }
    );
    assert.deepEqual(resolveKoreanName({ ...unspaced, romaji: null }), { nameKo: "마츠모토준", source: "kana" });
    // f) not Japanese
    assert.equal(resolveKoreanName({ nativeName: "정소민", localizedName: "정소민" }), null);
    assert.equal(resolveKoreanName({ nativeName: "Tom Cruise", localizedName: "톰 크루즈" }), null);
    // g) no clue at all
    assert.equal(resolveKoreanName({ nativeName: "長瀬智也", localizedName: null, aliases: [], romaji: null }), null);
    // h) alias with latin/japanese is skipped
    assert.deepEqual(
      resolveKoreanName({
        nativeName: "松本潤",
        localizedName: "松本潤",
        aliases: ["마츠준 (MatsuJun)", "松潤", "마츠모토 준"],
        romaji: null
      }),
      { nameKo: "마츠모토 준", source: "alias" }
    );
    // i) unconvertible romaji
    assert.equal(
      resolveKoreanName({
        nativeName: "長瀬智也",
        localizedName: "長瀬智也",
        aliases: [],
        romaji: { text: "Gackt", order: "given-family" }
      }),
      null
    );
  });
});
