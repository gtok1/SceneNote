import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseJson } from "./http.ts";

function request(body: string) {
  return new Request("https://example.com/functions/v1/get-library-share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
}

describe("Edge JSON object request parsing", () => {
  it("accepts object fields for the handler's validation", async () => {
    const body = { id: "share-id", nested: { enabled: true }, ids: ["one", "two"] };
    assert.deepEqual(await parseJson(request(JSON.stringify(body))), { ok: true, value: body });
  });

  it("accepts an empty object for optional-body APIs", async () => {
    assert.deepEqual(await parseJson(request("{}")), { ok: true, value: {} });
  });

  for (const body of ["null", "[]", "[{}]", '"text"', "123", "true", "false"]) {
    it(`rejects ${body} before handlers access request properties`, async () => {
      assert.deepEqual(await parseJson(request(body)), {
        ok: false,
        message: "JSON body must be an object"
      });
    });
  }

  for (const body of ["", "{", "undefined"]) {
    it(`rejects malformed JSON ${JSON.stringify(body)}`, async () => {
      assert.deepEqual(await parseJson(request(body)), { ok: false, message: "Invalid JSON body" });
    });
  }
});
