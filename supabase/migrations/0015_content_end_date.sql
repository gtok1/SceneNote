ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS end_date DATE;

COMMENT ON COLUMN contents.end_date IS '작품 마지막 방영일 또는 개봉일. 마지막 본 시기 기본값과 정렬 보조값으로 사용한다.';

UPDATE contents
SET end_date = air_date
WHERE content_type = 'movie'
  AND end_date IS NULL
  AND air_date IS NOT NULL;

UPDATE contents AS c
SET end_date = episode_dates.last_air_date
FROM (
  SELECT
    content_id,
    MAX(air_date) AS last_air_date
  FROM episodes
  WHERE air_date IS NOT NULL
  GROUP BY content_id
) AS episode_dates
WHERE c.id = episode_dates.content_id
  AND c.end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_contents_end_date
  ON contents (end_date DESC);
