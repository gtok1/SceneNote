-- Existing library content predates content_themes. Backfill only specific genres
-- that map deterministically to canonical themes; broad genres remain genre signals.
INSERT INTO content_themes (content_id, family, key, label, centrality, source, source_key)
SELECT
  cg.content_id,
  mapping.family,
  mapping.key,
  mapping.label,
  0.3,
  'genre_backfill',
  g.name
FROM content_genres cg
JOIN genres g ON g.id = cg.genre_id
JOIN (
  VALUES
    ('historical', 'setting', 'historical-period', '시대극'),
    ('school', 'setting', 'school', '학원물'),
    ('military', 'setting', 'military', '군대물'),
    ('medical', 'occupation', 'medical', '의료물'),
    ('legal', 'occupation', 'legal', '법정물')
) AS mapping(alias, family, key, label)
  ON lower(trim(g.name)) = mapping.alias
ON CONFLICT (content_id, family, key) DO NOTHING;
