import assert from "node:assert/strict";
import { it } from "node:test";

import { selectionAriaProps } from "./selectionAria";

it("76 T-1: web buttons expose true and false pressed states", () => {
  assert.deepEqual(selectionAriaProps("button", true, "web"), { "aria-pressed": true });
  assert.deepEqual(selectionAriaProps("button", false, "web"), { "aria-pressed": false });
});

it("76 T-2: iOS and Android buttons preserve true and false selected states", () => {
  assert.deepEqual(selectionAriaProps("button", true, "ios"), { "aria-selected": true });
  assert.deepEqual(selectionAriaProps("button", false, "android"), { "aria-selected": false });
});

it("76 T-3: current web buttons omit selection and pressed states", () => {
  assert.deepEqual(selectionAriaProps("button", true, "web", { current: true }), {});
  assert.deepEqual(selectionAriaProps("button", false, "web", { current: true }), {});
});

it("76 T-4: web radios expose checked state only", () => {
  assert.deepEqual(selectionAriaProps("radio", true, "web"), { "aria-checked": true });
});

it("76 T-5: plain elements omit web state and preserve native selected state", () => {
  assert.deepEqual(selectionAriaProps("plain", true, "web"), {});
  assert.deepEqual(selectionAriaProps("plain", true, "ios"), { "aria-selected": true });
});

it("76 T-6: macOS and Windows follow the non-web selection contract", () => {
  assert.deepEqual(selectionAriaProps("button", true, "macos"), { "aria-selected": true });
  assert.deepEqual(selectionAriaProps("button", true, "windows"), { "aria-selected": true });
});

it("76 T-7: native radios preserve false selected and checked states", () => {
  assert.deepEqual(selectionAriaProps("radio", false, "ios"), {
    "aria-selected": false,
    "aria-checked": false
  });
});

it("76 T-8: current native buttons preserve selected state", () => {
  assert.deepEqual(selectionAriaProps("button", true, "ios", { current: true }), { "aria-selected": true });
});
