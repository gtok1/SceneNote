import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAuthSessionSync } from "./authSessionSync";

interface TestSession {
  user: { id: string };
  token: string;
}

const firstSession: TestSession = { user: { id: "first-user" }, token: "first-token" };
const secondSession: TestSession = { user: { id: "second-user" }, token: "second-token" };

function setup(initialSession: TestSession | null = null) {
  let currentSession = initialSession;
  const applied: (TestSession | null)[] = [];
  const cacheClearedFor: (string | null)[] = [];
  const sync = createAuthSessionSync<TestSession>({
    getCurrentUserId: () => currentSession?.user.id ?? null,
    setSession: (session) => {
      currentSession = session;
      applied.push(session);
    },
    clearUserCache: () => cacheClearedFor.push(currentSession?.user.id ?? null)
  });
  return { sync, applied, cacheClearedFor };
}

describe("auth session synchronization", () => {
  it("does not overwrite a new sign-in with a delayed empty startup snapshot", () => {
    const { sync, applied } = setup();
    sync.onAuthStateChange(firstSession);
    sync.onInitialSession(null);
    sync.onInitializationTimeout();
    assert.deepEqual(applied, [firstSession]);
  });

  it("does not restore a signed-out user from the startup snapshot", () => {
    const { sync, applied, cacheClearedFor } = setup(firstSession);
    sync.onAuthStateChange(null);
    sync.onInitialSession(firstSession);
    assert.deepEqual(applied, [null]);
    assert.deepEqual(cacheClearedFor, ["first-user"]);
  });

  it("accepts a late startup session after the loader timeout", () => {
    const { sync, applied } = setup();
    sync.onInitializationTimeout();
    sync.onInitialSession(firstSession);
    assert.deepEqual(applied, [null, firstSession]);
  });

  it("ignores the timeout after a successful startup restore", () => {
    const { sync, applied } = setup();
    sync.onInitialSession(firstSession);
    sync.onInitializationTimeout();
    assert.deepEqual(applied, [firstSession]);
  });

  it("clears the previous user's cache before applying an account switch", () => {
    const { sync, applied, cacheClearedFor } = setup(firstSession);
    sync.onAuthStateChange(secondSession);
    assert.deepEqual(cacheClearedFor, ["first-user"]);
    assert.deepEqual(applied, [secondSession]);
  });

  it("preserves cached data when the same user's token refreshes", () => {
    const { sync, applied, cacheClearedFor } = setup(firstSession);
    const refreshed = { ...firstSession, token: "refreshed-token" };
    sync.onAuthStateChange(refreshed);
    assert.deepEqual(applied, [refreshed]);
    assert.deepEqual(cacheClearedFor, []);
  });

  it("ignores all outstanding work after unmount", () => {
    const { sync, applied, cacheClearedFor } = setup(firstSession);
    sync.dispose();
    sync.onInitialSession(null);
    sync.onInitializationTimeout();
    sync.onAuthStateChange(secondSession);
    assert.deepEqual(applied, []);
    assert.deepEqual(cacheClearedFor, []);
  });
});
