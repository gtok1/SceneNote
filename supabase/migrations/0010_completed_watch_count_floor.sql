UPDATE user_library_items
SET watch_count = 1
WHERE watch_count = 0
  AND (
    status = 'completed'::watch_status
    OR status_flags @> ARRAY['completed'::watch_status]
  );

CREATE OR REPLACE FUNCTION ensure_completed_watch_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    NEW.status = 'completed'::watch_status
    OR COALESCE(NEW.status_flags, ARRAY[]::watch_status[]) @> ARRAY['completed'::watch_status]
  ) AND COALESCE(NEW.watch_count, 0) < 1 THEN
    NEW.watch_count := 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_library_items_completed_watch_count ON user_library_items;

CREATE TRIGGER trg_user_library_items_completed_watch_count
  BEFORE INSERT OR UPDATE OF status, status_flags, watch_count ON user_library_items
  FOR EACH ROW
  EXECUTE FUNCTION ensure_completed_watch_count();

COMMENT ON FUNCTION ensure_completed_watch_count() IS
  '완료 상태인 라이브러리 항목은 작품 전체를 최소 1회 이상 시청한 것으로 보정한다.';
