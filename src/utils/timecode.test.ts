import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  formatSecondsToTimecode,
  isTimeWithinEpisode,
  normalizeTimecodeInput,
  parseTimecodeToSeconds
} from "./timecode";

describe("timecode utilities", () => {
  it("parses colon timecodes", () => {
    assert.equal(parseTimecodeToSeconds("12:30"), 750);
    assert.equal(parseTimecodeToSeconds("1:02:30"), 3750);
    assert.equal(parseTimecodeToSeconds("00:00"), 0);
  });

  it("parses digits-only input with UX normalization", () => {
    assert.equal(parseTimecodeToSeconds("1230"), 750);
    assert.equal(parseTimecodeToSeconds("90"), 90);
  });

  it("rejects invalid timecodes", () => {
    assert.equal(parseTimecodeToSeconds(""), null);
    assert.equal(parseTimecodeToSeconds("abc"), null);
    assert.equal(parseTimecodeToSeconds("12:99"), null);
  });

  it("formats seconds for display", () => {
    assert.equal(formatSecondsToTimecode(750), "12:30");
    assert.equal(formatSecondsToTimecode(3750), "1:02:30");
  });

  it("normalizes digits-only values", () => {
    assert.equal(normalizeTimecodeInput("7"), "00:07");
    assert.equal(normalizeTimecodeInput("532"), "05:32");
    assert.equal(normalizeTimecodeInput("90"), "01:30");
    assert.equal(normalizeTimecodeInput("12345"), "1:23:45");
  });

  it("checks episode duration bounds", () => {
    assert.equal(isTimeWithinEpisode(30, 90), true);
    assert.equal(isTimeWithinEpisode(120, 90), false);
    assert.equal(isTimeWithinEpisode(120, null), true);
  });
});
