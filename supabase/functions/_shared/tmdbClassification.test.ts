import assert from "node:assert/strict";
import test from "node:test";

import { inferTmdbTvContentType } from "./tmdbClassification.ts";

test("classifies TMDB Japanese animation genre as anime before country fallback", () => {
  assert.equal(inferTmdbTvContentType({ originCountry: ["JP"], genreIds: [16] }), "anime");
  assert.equal(inferTmdbTvContentType({ originCountry: ["JP"], genres: [{ id: 16, name: "Animation" }] }), "anime");
});

test("keeps non-animation TMDB Japanese series as jdrama", () => {
  assert.equal(inferTmdbTvContentType({ originCountry: ["JP"], genreIds: [18] }), "jdrama");
});
