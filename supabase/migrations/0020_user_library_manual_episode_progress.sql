ALTER TABLE user_library_items
  ADD COLUMN IF NOT EXISTS manual_watched_season_number INTEGER,
  ADD COLUMN IF NOT EXISTS manual_watched_episode_number INTEGER,
  ADD COLUMN IF NOT EXISTS manual_progress_updated_at TIMESTAMPTZ;

ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_manual_watched_episode_number_check;
ALTER TABLE user_library_items
  ADD CONSTRAINT user_library_items_manual_watched_episode_number_check
  CHECK (
    manual_watched_episode_number IS NULL
    OR (manual_watched_episode_number >= 0 AND manual_watched_episode_number <= 9999)
  );

ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_manual_watched_season_number_check;
ALTER TABLE user_library_items
  ADD CONSTRAINT user_library_items_manual_watched_season_number_check
  CHECK (
    manual_watched_season_number IS NULL
    OR (manual_watched_season_number >= 0 AND manual_watched_season_number <= 999)
  );

-- Prevent a season-only partial progress value.
ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_manual_progress_pair_check;
ALTER TABLE user_library_items
  ADD CONSTRAINT user_library_items_manual_progress_pair_check
  CHECK (
    manual_watched_season_number IS NULL
    OR manual_watched_episode_number IS NOT NULL
  );

COMMENT ON COLUMN user_library_items.manual_watched_season_number IS
  '사용자가 직접 설정한 진행 위치의 시즌 번호. 시즌 정보가 없거나 단일 시즌이면 NULL. 표시·재편집용이며 정렬 기준이 아니다.';
COMMENT ON COLUMN user_library_items.manual_watched_episode_number IS
  '사용자가 직접 설정한 "여기까지 봤음" 회차(해당 시즌 내 상대 회차). NULL = 설정한 적 없음(파생 진행률 사용), 0 = 명시적으로 아직 안 봄.';
COMMENT ON COLUMN user_library_items.manual_progress_updated_at IS
  '수동 진행 위치를 마지막으로 저장한 시각. 진단 보조용이며 우선순위 판정에는 사용하지 않는다.';

CREATE INDEX IF NOT EXISTS idx_user_library_items_manual_progress
  ON user_library_items (user_id, manual_progress_updated_at DESC)
  WHERE manual_watched_episode_number IS NOT NULL;
