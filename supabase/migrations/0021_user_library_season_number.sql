ALTER TABLE user_library_items
  ADD COLUMN IF NOT EXISTS season_number INTEGER;

ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_season_number_check;
ALTER TABLE user_library_items
  ADD CONSTRAINT user_library_items_season_number_check
  CHECK (season_number IS NULL OR (season_number >= 1 AND season_number <= 999));

-- Postgres treats NULLs as distinct in UNIQUE, so a single
-- UNIQUE (user_id, content_id, season_number) would allow duplicate whole-work rows.
-- Split into two partial indexes instead.
ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_user_content_unique;

CREATE UNIQUE INDEX IF NOT EXISTS user_library_items_user_content_whole_unique
  ON user_library_items (user_id, content_id)
  WHERE season_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_library_items_user_content_season_unique
  ON user_library_items (user_id, content_id, season_number)
  WHERE season_number IS NOT NULL;

COMMENT ON COLUMN user_library_items.season_number IS
  'NULL이면 작품 전체 등록(영화·단일 시즌·애니·기존 데이터). 1 이상이면 해당 시즌만 등록.';
