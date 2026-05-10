-- Add a short review line while keeping reviews.body for longer impressions.

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS one_line_review TEXT;

DO $$
BEGIN
  ALTER TABLE reviews
    ADD CONSTRAINT reviews_one_line_review_length
    CHECK (one_line_review IS NULL OR char_length(one_line_review) <= 120);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN reviews.one_line_review IS '작품 단위 한줄 후기. 최대 120자.';
