import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAuthLinkSession } from "./authLinkSession";

describe("auth link session parsing", () => {
  it("parses recovery tokens from URL fragments", () => {
    assert.deepEqual(
      getAuthLinkSession(
        "http://localhost:8081/reset-password#access_token=access&refresh_token=refresh&type=recovery"
      ),
      {
        kind: "tokens",
        access_token: "access",
        refresh_token: "refresh",
        shouldSetPassword: true
      }
    );
  });

  it("treats invite links as password setup links", () => {
    assert.deepEqual(getAuthLinkSession("scenenote://auth#access_token=a&refresh_token=r&type=invite"), {
      kind: "tokens",
      access_token: "a",
      refresh_token: "r",
      shouldSetPassword: true
    });
  });

  it("parses PKCE code links", () => {
    assert.deepEqual(getAuthLinkSession("http://localhost:8081/reset-password?code=auth-code"), {
      kind: "code",
      code: "auth-code",
      shouldSetPassword: true
    });
  });

  it("ignores auth links without session credentials", () => {
    assert.equal(getAuthLinkSession("http://localhost:8081/sign-in?type=signup"), null);
  });
});
