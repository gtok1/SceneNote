import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { romanizeHangulPersonQuery } from "./personNameRomanization";

describe("Korean spelling fallback for Japanese person names", () => {
  it("romanizes 나가세 토모야 for a TMDB name search", () => {
    assert.equal(romanizeHangulPersonQuery("나가세 토모야"), "nagase tomoya");
  });
  it("handles common Japanese phonetic spellings", () => {
    assert.equal(romanizeHangulPersonQuery("아라가키 유이"), "aragaki yui");
    assert.equal(romanizeHangulPersonQuery("사토 타케루"), "sato takeru");
  });
  it("does not add fallback requests for single words or non-Hangul queries", () => {
    assert.equal(romanizeHangulPersonQuery("박신혜"), null);
    assert.equal(romanizeHangulPersonQuery("Tomoya Nagase"), null);
    assert.equal(romanizeHangulPersonQuery("나가세 2기"), null);
  });
});
