CREATE TABLE IF NOT EXISTS user_content_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('content', 'genre', 'tag', 'theme', 'studio', 'cast', 'staff')),
  target_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('more', 'less', 'exclude', 'not_interested')),
  weight NUMERIC NOT NULL DEFAULT 1,
  source_content_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_content_feedback_target_unique UNIQUE (user_id, target_type, target_key)
);

CREATE INDEX IF NOT EXISTS idx_user_content_feedback_user
  ON user_content_feedback(user_id);

ALTER TABLE user_content_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_content_feedback_select_own"
  ON user_content_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_content_feedback_insert_own"
  ON user_content_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_content_feedback_update_own"
  ON user_content_feedback FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_content_feedback_delete_own"
  ON user_content_feedback FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE user_content_feedback IS
  'Explicit recommendation preferences for content metadata, including relationship themes; these rows must not be interpreted as user identity or sexual orientation.';
