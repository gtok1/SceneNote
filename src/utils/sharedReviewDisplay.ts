import { createReviewLabel } from "@/utils/reviewDisplay";

export const SHARED_REVIEW_COPY = { reveal: "스포일러 포함 · 보기" } as const;

export interface SharedReviewView {
  label: string | null;
  spoilerHidden: boolean;
}

export function createSharedReviewView(input: {
  rating: number | null | undefined;
  oneLineReview: string | null | undefined;
  isSpoiler: boolean | null | undefined;
  revealed: boolean;
}): SharedReviewView {
  const spoilerHidden = input.isSpoiler === true && !input.revealed &&
    typeof input.oneLineReview === "string" && input.oneLineReview.trim() !== "";
  return {
    label: createReviewLabel(input.rating, spoilerHidden ? null : input.oneLineReview),
    spoilerHidden
  };
}
