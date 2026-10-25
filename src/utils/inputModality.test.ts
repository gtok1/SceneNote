import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("input modality", () => {
  it("IM-1 starts with pointer input", async () => {
    const { INITIAL_INPUT_MODALITY } = await import("./inputModality");
    assert.equal(INITIAL_INPUT_MODALITY, "pointer");
  });
  it("IM-2 switches to keyboard on an unmodified keydown", async () => {
    const { nextInputModality } = await import("./inputModality");
    assert.equal(nextInputModality("pointer", { type: "keydown" }), "keyboard");
  });
  it("IM-3 preserves modality for Meta, Ctrl and Alt shortcuts", async () => {
    const { nextInputModality } = await import("./inputModality");
    assert.equal(nextInputModality("pointer", { type: "keydown", metaKey: true }), "pointer");
    assert.equal(nextInputModality("keyboard", { type: "keydown", ctrlKey: true }), "keyboard");
    assert.equal(nextInputModality("pointer", { type: "keydown", altKey: true }), "pointer");
  });
  it("IM-4 switches to pointer for pointerdown, mousedown and touchstart", async () => {
    const { nextInputModality } = await import("./inputModality");
    for (const type of ["pointerdown", "mousedown", "touchstart"]) {
      assert.equal(nextInputModality("keyboard", { type }), "pointer");
    }
  });
  it("IM-5 preserves modality for unrelated events", async () => {
    const { nextInputModality } = await import("./inputModality");
    assert.equal(nextInputModality("keyboard", { type: "focus" }), "keyboard");
    assert.equal(nextInputModality("pointer", { type: "scroll" }), "pointer");
  });
});
