ALTER TABLE user_library_items
  ADD COLUMN IF NOT EXISTS watch_count INTEGER NOT NULL DEFAULT 0
  CHECK (watch_count >= 0);

COMMENT ON COLUMN user_library_items.watch_count IS
  '사용자가 해당 작품 전체를 감상한 횟수. 에피소드 진행률과 별개로 관리한다.';
