import assert from "node:assert/strict";
import test from "node:test";
import { buildSimilarityReason, rankSimilarWorks, scoreWork, type SimilarityWork } from "./similarityEngine";

const anchor: SimilarityWork = { external_source:"anilist", external_id:"1", content_type:"anime", title_primary:"기준", title_original:null, poster_url:null, overview:"디스토피아 세계에서 초능력으로 조직과 싸우는 청춘", air_year:2011, has_seasons:true, episode_count:22, genres:["Action","Romance"], tags:["Dystopian","Super Power"] };
const candidate: SimilarityWork = { ...anchor, external_id:"2", title_primary:"후보", overview:"디스토피아 조직에 맞서 초능력으로 싸운다", provider_recommended:true };

test("available signals are re-normalized and reason uses real matches", () => {
  const ranked = scoreWork(anchor, candidate, "mood");
  assert.ok(ranked.similarity_score > 0);
  assert.match(ranked.similarity_reason, /디스토피아|초능력/);
  assert.ok(ranked.shared_signals.some((signal) => signal.source === "anilist"));
});
test("anchor and cross-source duplicates are removed", () => {
  const duplicate = { ...anchor, external_source:"tmdb", external_id:"99" };
  assert.deepEqual(rankSimilarWorks(anchor, [anchor, duplicate, candidate], "balanced", "similarity").map((item) => item.external_id), ["2"]);
});
test("reason never exposes a fake percentage", () => { assert.doesNotMatch(buildSimilarityReason([{type:"genre",label:"SF",score:0.9,source:"metadata"}]), /%/); });
