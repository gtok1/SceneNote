import assert from "node:assert/strict";
import { it } from "node:test";

it("72 T-9: missing sessions, users, or user ids do not identify a user", async () => {
  const sessionUser = await import("./sessionUser");
  for (const session of [null, undefined, {}, { user: null }, { user: {} }, { user: { id: "" } }]) {
    assert.equal(sessionUser.sessionUserId(session), null);
  }
});

it("72 T-10: a stored session returns its nonempty user id", async () => {
  const sessionUser = await import("./sessionUser");
  assert.equal(sessionUser.sessionUserId({ user: { id: "u1" } }), "u1");
});
