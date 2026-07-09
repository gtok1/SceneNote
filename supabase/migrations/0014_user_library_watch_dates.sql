ALTER TABLE user_library_items
  ADD COLUMN IF NOT EXISTS first_watched_at DATE,
  ADD COLUMN IF NOT EXISTS last_watched_at DATE;

COMMENT ON COLUMN user_library_items.first_watched_at IS
  '처음 본 날. 연도만 아는 경우 해당 연도 1월 1일로 저장한다.';

COMMENT ON COLUMN user_library_items.last_watched_at IS
  '마지막으로 본 날. 연도별 감상 통계의 기록 모드 기준이며, 연도만 아는 경우 해당 연도 1월 1일로 저장한다.';

CREATE INDEX IF NOT EXISTS idx_user_library_items_user_last_watched_at
  ON user_library_items (user_id, last_watched_at DESC)
  WHERE last_watched_at IS NOT NULL;
