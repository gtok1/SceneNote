import { supabase } from "@/lib/supabase";
import type { ContentReview, SaveContentReviewInput } from "@/types/reviews";
import { contentReviewSchema } from "@/utils/validation";

const REVIEW_SELECT = "id,user_id,content_id,rating,one_line_review,body,is_spoiler,created_at,updated_at";

export async function getContentReview(contentId: string): Promise<ContentReview | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_SELECT)
    .eq("content_id", contentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ContentReview | null;
}

export async function saveContentReview(input: SaveContentReviewInput): Promise<ContentReview> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("로그인이 필요합니다");

  const payload = {
    ...input,
    one_line_review: normalizeOptionalText(input.one_line_review),
    body: normalizeOptionalText(input.body)
  };
  const parsed = contentReviewSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "감상 기록을 확인해 주세요");
  }

  const { data, error } = await supabase
    .from("reviews")
    .upsert(
      {
        user_id: user.id,
        content_id: parsed.data.content_id,
        rating: parsed.data.rating,
        one_line_review: parsed.data.one_line_review,
        body: parsed.data.body,
        is_spoiler: parsed.data.is_spoiler
      },
      { onConflict: "user_id,content_id" }
    )
    .select(REVIEW_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as ContentReview;
}

function normalizeOptionalText(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}
