import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAuthRedirectUrl } from "./authRedirect";

describe("auth redirect URL", () => {
  it("preserves the current localhost port", () => {
    assert.equal(
      buildAuthRedirectUrl("/reset-password", "http://localhost:8081"),
      "http://localhost:8081/reset-password"
    );
  });

  it("preserves 127.0.0.1 ports", () => {
    assert.equal(
      buildAuthRedirectUrl("/reset-password", "http://127.0.0.1:19006"),
      "http://127.0.0.1:19006/reset-password"
    );
  });

  it("removes trailing slashes from configured origins", () => {
    assert.equal(
      buildAuthRedirectUrl("/reset-password", "https://example.supabase.app/"),
      "https://example.supabase.app/reset-password"
    );
  });
});
