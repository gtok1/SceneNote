import assert from "node:assert/strict";
import { test } from "node:test";

import { extractPhotoTitleCandidates } from "./photoTitleCandidates";

test("extracts likely Korean title lines before short noise", () => {
  const candidates = extractPhotoTitleCandidates(`
    NETFLIX ORIGINAL
    폭싹 속았수다
    시즌 1
    2025
  `);

  assert.equal(candidates[0], "폭싹 속았수다");
});

test("keeps English title candidates and removes duplicated lines", () => {
  const candidates = extractPhotoTitleCandidates(`
    The Glory
    Official Trailer
    THE GLORY
  `);

  assert.deepEqual(candidates, ["The Glory"]);
});
