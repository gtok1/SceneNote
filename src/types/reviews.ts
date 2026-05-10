export interface ContentReview {
  id: string;
  user_id: string;
  content_id: string;
  rating: number | null;
  one_line_review: string | null;
  body: string | null;
  is_spoiler: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaveContentReviewInput {
  content_id: string;
  rating: number | null;
  one_line_review: string | null;
  body: string | null;
  is_spoiler: boolean;
}
