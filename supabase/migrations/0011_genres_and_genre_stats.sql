CREATE TABLE IF NOT EXISTS genres (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_genres (
  content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  genre_id   UUID NOT NULL REFERENCES genres(id)   ON DELETE CASCADE,
  PRIMARY KEY (content_id, genre_id)
);

ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_genres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "genres_select" ON genres;
CREATE POLICY "genres_select" ON genres
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "content_genres_select" ON content_genres;
CREATE POLICY "content_genres_select" ON content_genres
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_content_genres_content_id
  ON content_genres(content_id);

CREATE INDEX IF NOT EXISTS idx_content_genres_genre_id
  ON content_genres(genre_id);

CREATE OR REPLACE FUNCTION get_genre_stats()
RETURNS TABLE(genre_name TEXT, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.name                         AS genre_name,
    COUNT(DISTINCT uli.content_id) AS count
  FROM user_library_items uli
  JOIN content_genres cg ON cg.content_id = uli.content_id
  JOIN genres g ON g.id = cg.genre_id
  WHERE uli.user_id = auth.uid()
  GROUP BY g.name
  ORDER BY count DESC, g.name ASC;
$$;

GRANT EXECUTE ON FUNCTION get_genre_stats() TO authenticated;
