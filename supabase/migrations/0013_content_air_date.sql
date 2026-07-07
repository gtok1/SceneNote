ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS air_date DATE;

COMMENT ON COLUMN contents.air_date IS '작품 첫 방영일 또는 개봉일. 월 단위 라이브러리 정렬에 사용한다.';

UPDATE contents AS c
SET air_date = first_episode.first_air_date
FROM (
  SELECT
    content_id,
    MIN(air_date) AS first_air_date
  FROM episodes
  WHERE air_date IS NOT NULL
  GROUP BY content_id
) AS first_episode
WHERE c.id = first_episode.content_id
  AND c.air_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_contents_air_date
  ON contents (air_date DESC);
