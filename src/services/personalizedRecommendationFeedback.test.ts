import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPersonalizedRecommendationFeedbackBody } from "./personalizedRecommendationFeedback";

const contentFeedback = {
  target_type: "content" as const,
  target_key: "tmdb:123",
  action: "more" as const,
  source_content_id: "tmdb:123",
  weight: 1
};
const themeFeedback = {
  target_type: "theme" as const,
  target_key: "narrative:revenge",
  action: "more" as const,
  source_content_id: "tmdb:123",
  weight: 0.8
};

describe("personalized recommendation feedback request", () => {
  it("keeps a single feedback item backward compatible", () => {
    assert.deepEqual(createPersonalizedRecommendationFeedbackBody(contentFeedback), {
      action: "record_feedback",
      feedback: [contentFeedback]
    });
  });

  it("keeps all feedback items in one request body", () => {
    assert.deepEqual(
      createPersonalizedRecommendationFeedbackBody([contentFeedback, themeFeedback]),
      { action: "record_feedback", feedback: [contentFeedback, themeFeedback] }
    );
  });
});
