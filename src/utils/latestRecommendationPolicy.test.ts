import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as policy from "./latestRecommendationPolicy";

describe("latest recommendation protocol", () => {
  it("LP-1 stamps every request as latest while preserving selected filters, cursor and exclusions", () => {
    const body = { limit: 12, media_type: "all", countries: ["JP", "KR"], year: 2026, cursor: "next", exclude_ids: ["example"] };
    assert.deepEqual(policy.createLatestRecommendationBody(body), { ...body, discovery_mode: "latest" });
    assert.deepEqual(body, { limit: 12, media_type: "all", countries: ["JP", "KR"], year: 2026, cursor: "next", exclude_ids: ["example"] });
  });

  it("LP-2 prevents old callers from requesting the mixed historical feed", () => {
    assert.equal(policy.createLatestRecommendationBody({ discovery_mode: "mixed" }).discovery_mode, "latest");
    assert.equal(policy.LATEST_RECOMMENDATION_CACHE_VERSION, "latest-catalog-v1");
  });

  it("LP-3 accepts only an explicit latest response acknowledgement", () => {
    assert.doesNotThrow(() => policy.assertLatestRecommendationMode("latest"));
  });

  it("LP-4 rejects legacy and malformed acknowledgements instead of rendering them as latest", () => {
    for (const mode of [undefined, null, "mixed", "LATEST", true, {}]) {
      assert.throws(() => policy.assertLatestRecommendationMode(mode), (error: unknown) =>
        error instanceof policy.RecommendationRequestError && error.code === "POLICY_UNAVAILABLE" &&
        error.message === policy.RECOMMENDATION_POLICY_UNAVAILABLE_MESSAGE);
    }
  });

  it("LP-5 exposes a typed invalid-cursor failure with a fixed Korean restart message", () => {
    const error = policy.createRecommendationRequestError(400, "INVALID_CURSOR");
    assert.ok(error instanceof policy.RecommendationRequestError);
    assert.equal(error.code, "INVALID_CURSOR");
    assert.equal(error.message, "추천 탐색 정보가 오래되었어요. 처음부터 다시 찾아 주세요.");
    assert.equal(policy.recommendationRequiresRestart(error), true);
  });

  it("LP-6 keeps restart detection when the hook stores the fixed error message", () => {
    const error = policy.createRecommendationRequestError(400, "INVALID_CURSOR");
    assert.equal(policy.recommendationRequiresRestart(error.message), true);
    assert.equal(policy.recommendationRequiresRestart(new Error("ordinary failure")), false);
    assert.equal(policy.recommendationRequiresRestart("INVALID_CURSOR raw response"), false);
  });

  it("LP-7 describes a server processing failure without mislabelling HTTP 546 as disconnected", () => {
    const error = policy.createRecommendationRequestError(546, "WORKER_LIMIT");
    assert.equal(error.code, "REQUEST_FAILED");
    assert.equal(error.message, "추천 서버가 처리를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.");
    assert.equal(policy.recommendationRequiresRestart(error), false);
  });

  it("LP-8 retains a separate fixed transport error and ignores untrusted server text", () => {
    const error = policy.createRecommendationRequestError(null, "private raw server error");
    assert.equal(error.message, "추천 연결이 끊겼거나 응답 시간이 초과되었습니다. 다시 시도해 주세요.");
    assert.equal(error.message.includes("private"), false);
  });

  it("LP-9 identifies policy errors for stopping automatic retries", () => {
    let failure: unknown;
    try { policy.assertLatestRecommendationMode(undefined); } catch (error) { failure = error; }
    assert.equal(policy.isLatestRecommendationPolicyError(failure), true);
    assert.equal(policy.isLatestRecommendationPolicyError(policy.RECOMMENDATION_POLICY_UNAVAILABLE_MESSAGE), true);
    assert.equal(policy.isLatestRecommendationPolicyError(new Error("another error")), false);
  });

  it("LP-10 restarts the versioned latest cursor after the server rejects its scope or direction", () => {
    const error = policy.createRecommendationRequestError(409, "INVALID_LATEST_RECOMMENDATION_CURSOR");
    assert.equal(error.code, "INVALID_CURSOR");
    assert.equal(policy.recommendationRequiresRestart(error), true);
    assert.equal(error.message, "추천 탐색 정보가 오래되었어요. 처음부터 다시 찾아 주세요.");
  });
});
