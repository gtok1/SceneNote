CREATE TABLE IF NOT EXISTS library_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

COMMENT ON TABLE library_shares IS '사용자가 현재 라이브러리 필터 결과를 외부 공유하기 위한 스냅샷.';
COMMENT ON COLUMN library_shares.content_ids IS '공유 시점의 필터 결과 content_id 목록. 배열 순서가 표시 순서.';

DROP TRIGGER IF EXISTS trg_library_shares_updated_at ON library_shares;
CREATE TRIGGER trg_library_shares_updated_at
  BEFORE UPDATE ON library_shares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE library_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "library_shares_select_own" ON library_shares;
CREATE POLICY "library_shares_select_own" ON library_shares
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "library_shares_insert_own" ON library_shares;
CREATE POLICY "library_shares_insert_own" ON library_shares
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "library_shares_update_own" ON library_shares;
CREATE POLICY "library_shares_update_own" ON library_shares
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "library_shares_delete_own" ON library_shares;
CREATE POLICY "library_shares_delete_own" ON library_shares
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE INDEX IF NOT EXISTS idx_library_shares_owner_recent
  ON library_shares (owner_user_id, created_at DESC);
