CREATE TABLE IF NOT EXISTS user_recommendation_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canonical_content_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('anime', 'kdrama', 'jdrama', 'movie', 'other')),
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  identity_keys TEXT[] NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_recommendation_impressions_user_canonical_key
    UNIQUE (user_id, canonical_content_id)
);

CREATE INDEX IF NOT EXISTS idx_user_recommendation_impressions_user
  ON user_recommendation_impressions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_recommendation_impressions_identity_keys
  ON user_recommendation_impressions USING GIN(identity_keys);

ALTER TABLE user_recommendation_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_recommendation_impressions_select_own"
  ON user_recommendation_impressions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_recommendation_impressions_insert_own"
  ON user_recommendation_impressions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_recommendation_impressions_update_own"
  ON user_recommendation_impressions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_recommendation_impressions_delete_own"
  ON user_recommendation_impressions FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE user_recommendation_impressions IS
  'Account-scoped recommendation cards that were actually displayed to the user.';
