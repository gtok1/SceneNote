import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeTvmazeItem } from "./tvmaze.ts";

describe("origin_country from TVmaze network/webChannel", () => {
  it("reads the country code from the broadcast network", () => {
    const result = normalizeTvmazeItem({
      show: { id: 73519, name: "Vivant", network: { country: { code: "JP" } } }
    });
    assert.deepEqual(result?.origin_country, ["JP"]);
  });

  it("falls back to the streaming webChannel when there is no network", () => {
    const result = normalizeTvmazeItem({
      show: { id: 1, name: "Show", webChannel: { country: { code: "KR" } } }
    });
    assert.deepEqual(result?.origin_country, ["KR"]);
  });

  it("returns an empty array when neither carries a country", () => {
    const result = normalizeTvmazeItem({ show: { id: 1, name: "Show" } });
    assert.deepEqual(result?.origin_country, []);
  });
});
