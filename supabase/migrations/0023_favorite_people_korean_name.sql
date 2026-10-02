-- docs/38: 일본 인물 한글 이름과 출처. 원본 name/original_name은 그대로 둔다.
ALTER TABLE favorite_people
  ADD COLUMN IF NOT EXISTS name_ko TEXT,
  ADD COLUMN IF NOT EXISTS name_ko_source TEXT,
  ADD COLUMN IF NOT EXISTS name_ko_checked_at TIMESTAMPTZ;

ALTER TABLE favorite_people
  DROP CONSTRAINT IF EXISTS favorite_people_name_ko_source_check,
  ADD CONSTRAINT favorite_people_name_ko_source_check
    CHECK (name_ko_source IS NULL OR name_ko_source IN ('user', 'tmdb', 'alias', 'kana', 'romaji'));

ALTER TABLE favorite_people
  DROP CONSTRAINT IF EXISTS favorite_people_name_ko_length_check,
  ADD CONSTRAINT favorite_people_name_ko_length_check
    CHECK (name_ko IS NULL OR char_length(name_ko) BETWEEN 1 AND 40);

ALTER TABLE favorite_people
  DROP CONSTRAINT IF EXISTS favorite_people_name_ko_pair_check,
  ADD CONSTRAINT favorite_people_name_ko_pair_check
    CHECK ((name_ko IS NULL) = (name_ko_source IS NULL));
