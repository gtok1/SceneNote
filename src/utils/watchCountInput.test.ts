import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeWatchCountInput,
  resolveWatchCountSaveState,
  COMPLETED_MINIMUM_WATCH_COUNT
} from "./watchCountInput";

describe("watch count input normalization", () => {
  it("parses digits and floors to a non-negative integer", () => {
    assert.equal(normalizeWatchCountInput("3"), 3);
    assert.equal(normalizeWatchCountInput("012"), 12);
  });

  it("treats an empty or non-numeric value as zero", () => {
    assert.equal(normalizeWatchCountInput(""), 0);
    assert.equal(normalizeWatchCountInput("abc"), 0);
  });
});

describe("watch count save state", () => {
  it("is savable when the typed value differs from the saved value", () => {
    assert.deepEqual(resolveWatchCountSaveState("2", 1, false), { kind: "savable", value: 2 });
  });

  it("is unchanged when the typed value equals the saved value", () => {
    assert.deepEqual(resolveWatchCountSaveState("1", 1, false), { kind: "unchanged" });
  });

  it("blocks zero on a completed item instead of letting the database coerce it silently", () => {
    // migration 0010 installs a BEFORE UPDATE trigger that rewrites watch_count < 1 to 1
    // for completed items, so the write "succeeds" and the input silently snaps back.
    assert.deepEqual(resolveWatchCountSaveState("0", 1, true), {
      kind: "below-completed-minimum",
      minimum: COMPLETED_MINIMUM_WATCH_COUNT
    });
  });

  it("allows zero when the item is not completed", () => {
    assert.deepEqual(resolveWatchCountSaveState("0", 1, false), { kind: "savable", value: 0 });
  });

  it("reports the completed minimum before reporting unchanged", () => {
    assert.deepEqual(resolveWatchCountSaveState("0", 0, true), {
      kind: "below-completed-minimum",
      minimum: COMPLETED_MINIMUM_WATCH_COUNT
    });
  });
});
