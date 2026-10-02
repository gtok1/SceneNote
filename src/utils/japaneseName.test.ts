import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatPersonName } from "./japaneseName";

describe("formatPersonName", () => {
  it("J-1 combines the Japanese original with a provided Korean name, in either field order", () => {
    const expected = {
      name: "堺雅人(사카이 마사토)",
      secondaryName: null,
      readingStatus: "provided",
      koreanName: "사카이 마사토",
      nativeName: "堺雅人"
    };
    assert.deepEqual(formatPersonName({ source: "tmdb", name: "사카이 마사토", original_name: "堺雅人" }), expected);
    assert.deepEqual(formatPersonName({ source: "tmdb", name: "堺雅人", original_name: "사카이 마사토" }), expected);
  });

  it("J-2 uses a stored estimated Korean name", () => {
    assert.deepEqual(
      formatPersonName({
        source: "tmdb",
        name: "長瀬智也",
        original_name: "長瀬智也",
        name_ko: "나가세 토모야",
        name_ko_source: "romaji"
      }),
      {
        name: "長瀬智也(나가세 토모야)",
        secondaryName: null,
        readingStatus: "estimated",
        koreanName: "나가세 토모야",
        nativeName: "長瀬智也"
      }
    );
  });

  it("J-3 marks a user-entered Korean name", () => {
    assert.deepEqual(
      formatPersonName({
        source: "tmdb",
        name: "마츠모토 준",
        original_name: "松本潤",
        name_ko: "마쓰모토 준",
        name_ko_source: "user"
      }),
      {
        name: "松本潤(마쓰모토 준)",
        secondaryName: null,
        readingStatus: "user",
        koreanName: "마쓰모토 준",
        nativeName: "松本潤"
      }
    );
  });

  it("J-4 romanizes AniList romaji when no Korean name is stored", () => {
    assert.deepEqual(formatPersonName({ source: "anilist", name: "花江夏樹", original_name: "Natsuki Hanae" }), {
      name: "花江夏樹(하나에 나츠키)",
      secondaryName: null,
      readingStatus: "estimated",
      koreanName: "하나에 나츠키",
      nativeName: "花江夏樹"
    });
  });

  it("J-5 does not romanize TMDB romaji on the client", () => {
    assert.deepEqual(formatPersonName({ source: "tmdb", name: "長瀬智也", original_name: "Tomoya Nagase" }), {
      name: "長瀬智也",
      secondaryName: "Tomoya Nagase",
      readingStatus: "missing",
      koreanName: null,
      nativeName: "長瀬智也"
    });
  });

  it("J-6 leaves non-Japanese people alone", () => {
    assert.deepEqual(formatPersonName({ source: "tmdb", name: "정소민", original_name: "Jung So-min" }), {
      name: "정소민",
      secondaryName: "Jung So-min",
      readingStatus: "not_applicable",
      koreanName: null,
      nativeName: null
    });
    assert.deepEqual(formatPersonName({ source: "tmdb", name: "정소민", original_name: null }), {
      name: "정소민",
      secondaryName: null,
      readingStatus: "not_applicable",
      koreanName: null,
      nativeName: null
    });
  });

  it("J-7 reports missing when only the Japanese name exists", () => {
    assert.deepEqual(formatPersonName({ source: "tmdb", name: "長瀬智也", original_name: "長瀬智也" }), {
      name: "長瀬智也",
      secondaryName: null,
      readingStatus: "missing",
      koreanName: null,
      nativeName: "長瀬智也"
    });
  });

  it("J-8 ignores blank or non-Hangul name_ko", () => {
    const base = { source: "tmdb" as const, name: "長瀬智也", original_name: "長瀬智也" };
    const expected = formatPersonName(base);
    assert.deepEqual(formatPersonName({ ...base, name_ko: "  ", name_ko_source: "romaji" }), expected);
    assert.deepEqual(formatPersonName({ ...base, name_ko: "Tomoya", name_ko_source: "romaji" }), expected);
  });

  it("J-9 treats tmdb and alias sources as provided", () => {
    const base = { source: "tmdb" as const, name: "長瀬智也", original_name: null, name_ko: "나가세 토모야" };
    assert.equal(formatPersonName({ ...base, name_ko_source: "alias" }).readingStatus, "provided");
    assert.equal(formatPersonName({ ...base, name_ko_source: "tmdb" }).readingStatus, "provided");
  });
});
