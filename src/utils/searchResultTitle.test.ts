import assert from "node:assert/strict";
import { it } from "node:test";

import { formatSearchResultTitle } from "./searchResultTitle";

it("F-1 prefixes a meaningful standalone season title", () => {
  assert.equal(formatSearchResultTitle({ title_primary: "4기: 합동 강화 훈련편", series_title: "귀멸의 칼날" }), "귀멸의 칼날 4기: 합동 강화 훈련편");
});

it("F-2 keeps the primary title when the series title is absent", () => {
  for (const series_title of [undefined, null, ""]) {
    assert.equal(formatSearchResultTitle({ title_primary: "제목", ...(series_title === undefined ? {} : { series_title }) }), "제목");
  }
});
