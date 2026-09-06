import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSeasonDisplayTitle } from "./seasonDisplay";

describe("createSeasonDisplayTitle", () => {
  it("synthesizes a season title when the stored season name is a generic placeholder", () => {
    assert.equal(createSeasonDisplayTitle("VIVANT", 2, "시즌 2"), "VIVANT 시즌 2");
  });

  it("synthesizes when the season has no stored name at all", () => {
    assert.equal(createSeasonDisplayTitle("VIVANT", 2, null), "VIVANT 시즌 2");
  });

  it("prefers a meaningful stored season name", () => {
    assert.equal(createSeasonDisplayTitle("어떤 작품", 2, "별의 계승자"), "별의 계승자");
  });

  it("returns the base title unchanged when there is no season number (whole-work row)", () => {
    assert.equal(createSeasonDisplayTitle("VIVANT", null, "시즌 2"), "VIVANT");
  });
});
