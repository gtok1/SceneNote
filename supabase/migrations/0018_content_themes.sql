CREATE TABLE IF NOT EXISTS content_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  family TEXT NOT NULL CHECK (family IN ('relationship', 'tone', 'setting', 'narrative', 'occupation', 'audience', 'format')),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  centrality NUMERIC NOT NULL CHECK (centrality >= 0 AND centrality <= 1),
  source TEXT NOT NULL,
  source_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT content_themes_content_key_unique UNIQUE (content_id, family, key)
);

CREATE INDEX IF NOT EXISTS idx_content_themes_content_id ON content_themes(content_id);
CREATE INDEX IF NOT EXISTS idx_content_themes_family_key ON content_themes(family, key);

ALTER TABLE content_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_themes_select_authenticated"
  ON content_themes FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE content_themes IS
  'Canonical narrative metadata about a work. These rows describe content, not user identity.';
