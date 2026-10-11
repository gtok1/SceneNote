ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS crew JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS crew_updated_at TIMESTAMPTZ;

ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_crew_is_array;
ALTER TABLE contents
  ADD CONSTRAINT contents_crew_is_array CHECK (jsonb_typeof(crew) = 'array');

COMMENT ON COLUMN contents.crew IS
  '외부 API 제작진 요약(감독·작가·원작·크리에이터). 역할당 최대 3명, 전체 최대 12명. get-content-detail·add-to-library·backfill-content-crew가 채운다.';
COMMENT ON COLUMN contents.crew_updated_at IS
  '제작진을 외부 API에서 마지막으로 가져온 시각. NULL이면 아직 가져온 적 없음(백필 대상).';

CREATE INDEX IF NOT EXISTS idx_contents_crew_pending
  ON contents (id)
  WHERE crew_updated_at IS NULL;
