CREATE TABLE IF NOT EXISTS favorite_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('tmdb', 'anilist')),
  external_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('actor', 'voice_actor')),
  name TEXT NOT NULL,
  original_name TEXT,
  profile_url TEXT,
  known_for TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT favorite_people_user_source_external_unique UNIQUE (user_id, source, external_id)
);

ALTER TABLE favorite_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorite_people_select_own" ON favorite_people
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "favorite_people_insert_own" ON favorite_people
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorite_people_update_own" ON favorite_people
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorite_people_delete_own" ON favorite_people
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_favorite_people_user_created
  ON favorite_people (user_id, created_at DESC);

CREATE TRIGGER trg_favorite_people_updated_at
  BEFORE UPDATE ON favorite_people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
