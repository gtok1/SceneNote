import assert from "node:assert/strict";
import { it } from "node:test";

const saved = { id: "pin-one", memo: "saved" };

it("PIN-D1: editing retains the last loaded pin during optimistic removal", async () => {
  const state = await import("./pinDetailState");
  assert.equal(state.pinForDetail(null, saved, "pin-one", true), saved);
});

it("PIN-D2: a last-loaded pin never leaks into a different pin route", async () => {
  const state = await import("./pinDetailState");
  assert.equal(state.pinForDetail(undefined, saved, "pin-two", true), null);
});

it("PIN-D3: a missing pin outside editing uses the recoverable empty state", async () => {
  const state = await import("./pinDetailState");
  assert.equal(state.pinForDetail(null, saved, "pin-one", false), null);
});

it("PIN-D4: freshly loaded data replaces the retained pin", async () => {
  const state = await import("./pinDetailState");
  const updated = { ...saved, memo: "updated" };
  assert.equal(state.pinForDetail(updated, saved, "pin-one", true), updated);
});
