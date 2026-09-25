import { supabase } from "@/lib/supabase";
import {
  parseRecommendationExclusions,
  recommendationExclusionTargetKey,
  type RecommendationExclusionPreferences,
  type RecommendationExclusionTargetType
} from "@/utils/recommendationPreferences";

export async function getRecommendationExclusions(
  userId: string
): Promise<RecommendationExclusionPreferences> {
  const { data, error } = await supabase
    .from("user_content_feedback")
    .select("target_type,target_key")
    .eq("user_id", userId)
    .eq("action", "exclude")
    .in("target_type", ["theme", "genre"]);

  if (error) throw new Error("추천 제외 설정을 불러오지 못했습니다.");
  return parseRecommendationExclusions(data ?? []);
}

export async function setRecommendationExclusion(
  userId: string,
  targetType: RecommendationExclusionTargetType,
  key: string,
  excluded: boolean
): Promise<void> {
  const targetKey = recommendationExclusionTargetKey(targetType, key);
  if (excluded) {
    const { error } = await supabase.from("user_content_feedback").upsert(
      {
        user_id: userId,
        target_type: targetType,
        target_key: targetKey,
        action: "exclude",
        weight: 1,
        source_content_id: null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,target_type,target_key" }
    );
    if (error) throw new Error("추천 제외 설정을 저장하지 못했습니다.");
    return;
  }

  // A different feedback action for the same key is not this exclusion setting.
  const { error } = await supabase
    .from("user_content_feedback")
    .delete()
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_key", targetKey)
    .eq("action", "exclude");
  if (error) throw new Error("추천 제외 설정을 저장하지 못했습니다.");
}
