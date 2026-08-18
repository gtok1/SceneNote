import type { RecommendationFeedback } from "../../supabase/functions/_shared/recommendationEngine";

export function createPersonalizedRecommendationFeedbackBody(
  feedback: RecommendationFeedback | readonly RecommendationFeedback[]
): { action: "record_feedback"; feedback: readonly RecommendationFeedback[] } {
  return {
    action: "record_feedback",
    feedback: Array.isArray(feedback) ? feedback : [feedback]
  };
}
