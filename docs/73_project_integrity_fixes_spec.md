# 73. 프로젝트 정합성 점검 결함 11건 보완

작성일: 2026-11-16
기준: main + docs/71·72 작업 트리. 선행: [UI 규칙](00_ui_style_rules.md), [08](08_frontend_architecture.md), [17](17_season_library_tracking_spec.md), [31](31_usability_review_fixes_spec.md), [69](69_persistent_public_metadata_cache_fixes_spec.md), [71](71_meaningless_api_calls_and_usability_fixes_spec.md), [72](72_library_row_limit_and_redundant_reads_fixes_spec.md).

## 1. 문제 정의

| ID | 결함 |
|----|------|
| F-1 | TMDB movie/tv 동번호가 같은 콘텐츠에 연결되고 명시 갱신이 다른 종류의 메타데이터를 덮어씀 |
| F-2 | 늦은 Zustand 저장소 복원이 최신 SDK 인증 세션을 덮어씀 |
| F-3 | 등록 시 일부만 저장한 회차를 완전한 목록으로 취급해 1화에서 멈춤 |
| F-4 | 상태·직접 진행·시청일 UPDATE 적용 행이0개여도 성공 |
| F-5 | 실패한 변경의 전체 캐시 복구가 다른 성공 변경까지 되돌림 |
| F-6 | 회차/체크 목록이1000행에서 잘림 |
| F-7 | 추천 서버의 라이브러리/피드백 입력이1000행에서 잘림 |
| F-8 | 공유가 content_id 단위로 합쳐 선택한 시즌/상태/화수가 사라짐 |
| F-9 | 네이티브 공유가 상대 URL과 웹 전용 전달 경로를 사용 |
| F-10 | 핀 편집 저장이 상세를 이탈하고 삭제 시 편집기가 사라져 이동 불가 |
| F-11 | 핀 본문·태그 부분 저장으로 중복 핀 또는 기존 태그 소실 |

## 2. 근본 원인

`get-content-detail`·`add-to-library`의 종류 없는 외부 ID 조회와 DB unique, `authStore`의 별도 인증 영속화, `getEpisodes`/`fetch-episodes`의 nonempty 판정, UPDATE의 affected-row 미검사, `restoreLibraryQueries`의 전체 snapshot 교체, 페이지 없는 목록 읽기, 공유의 content_id Map, 웹 API만 쓰는 공유 서비스, 핀 단건 캐시 null에 의한 언마운트, 본문과 태그의 여러 DB 호출이다. 수정 전 실제 서비스·핸들러 재현은 `/tmp/scenenote-{metadata-audit-report,audit-auth-share-report,audit-records-report,audit-rowcaps-report,audit-pin-delete-report}.json`에 있다.

## 3. 재현 시나리오

영화123 뒤 TV123 조회/등록/명시갱신, A 저장소 복원 지연 중 B 로그인, 총12화의 DB에1화만 저장, 삭제된 라이브러리 항목에 UPDATE, A 진행 저장 대기→B 완료 성공→A 실패, 회차/체크1500행 조회, 라이브러리/피드백1000행 초과 추천, 시즌2만 공유, 네이티브 링크 생성/전달, 핀 편집/삭제, 태그 실패 뒤 생성 재시도를 각각 재현한다. 실제 계정 쓰기는 하지 않고 격리 경계로 실행한다.

## 4. 설계 결정

### D-1. 외부 숫자 ID는 종류와 함께 식별한다
TMDB는 `movie`/`tv`를 명시하고 DB unique와 모든 조회·등록이 같은 namespace를 사용한다. 비TMDB namespace는 빈 문자열로 고정해 중복 방지를 유지한다. 원래 source_id와 UUID·사용자 기록을 보존한다. 명시한 종류가 실패해도 반대 종류로 대체하지 않는다. 이미 오염됐을 가능성이 있는 메타데이터의 제목/종류를 자동 추정 복구하지 않는다.

### D-2. 인증 세션과 초기 로딩은 SDK가 결정한다
Zustand의 이전 세션 저장값은 인증 근거로 병합하지 않는다. 최신 SDK 이벤트와 캐시 초기화 순서를 보존하며 저장소 복원이 로딩을 먼저 끝내지 않는다.

### D-3. 성공은 실제 적용 행이 있을 때만 표시한다
상태·직접 진행·시청일 UPDATE와 구 스키마 폴백은 id를 반환받아0행이면 한국어 실패로 처리한다. RLS와 소유자 조건은 유지한다.

### D-4. 캐시 복구는 실패한 항목·필드의 소유권을 확인한다
다른 항목의 성공을 복구 대상에 넣지 않는다. 같은 항목의 더 최신 변경은 과거 snapshot으로 덮지 않으며, 오류가 있는 계정의 pending 변경이 끝나면 활성 DB 조회로 재조정한다. docs/72의 단일 전체 캐시·select와 즉시 상태 필터 반영을 유지한다.

### D-5. 회차의 존재와 목록 완전성을 구분한다
알려진 총 화수는1..N 누락 여부를 검사한다. 미정 작품은 실제 공개 번호를 별도 배열에 저장하고 전체 동기화 시각을30분 재사용한다. 기존 미공개/레거시 회차 행은 지우지 않고 화면 목록만 공개 번호로 제한한다. 1화 prefetch는 완전성 표시를 만들지 않는다. 기존 episode UUID·핀·시청 체크를 보존하며 null 메타데이터로 기존 날짜를 지우지 않는다. 회차·진행·추천 입력은 안정 정렬해 끝까지 읽고 안전 상한/오류는 부분 성공으로 처리하지 않는다.

### D-6. 공유 단위는 라이브러리 등록 항목이다
새 공유는 `library_item_ids`의 순서와 시즌 범위를 보존한다. 소유자는 서버에서 확인한다. 기존 content_ids 공유는 임의의 한 시즌을 고르지 않고 동일 작품의 등록 범위를 결정적으로 펼친다. 공개 응답에 비공개 소유자 키·감상 본문을 추가하지 않는다. 네이티브에는 공개 HTTPS origin 설정과 RN Share 경로를 사용하고, origin 미설정이면 상대 URL을 보내지 않는다.

### D-7. 핀 본문·태그는 한 트랜잭션으로 저장한다
`SECURITY INVOKER` RPC가 auth.uid()·핀/태그 소유권·회차와 작품의 관계를 검증한다. 생성은 폼의 안정 UUID로 재시도하며 같은 id에 다른 payload는 충돌로 거절한다. 실패하면 본문과 태그를 모두 복구한다. RPC가 없을 때 예전 여러 호출로 조용히 우회하지 않는다.

### D-8. 핀 저장/삭제 후 화면 이동을 분리한다
편집 저장은 같은 상세, 삭제 성공은 이전 목록 또는 핀 탭으로 이동한다. 낙관적 삭제 중에도 편집기를 보존하고, 이미 없는 핀에는 목록으로 가는 행동을 제공한다. docs/31 U-4의 계약을 구현한다.

## 5. 기각한 대안

종류 불일치를 제목으로 추정, 일부 회차를 완전 캐시로 재사용, 전체 snapshot 무조건 복원, RPC 실패 시 비원자적 폴백, 사용자 기록 UUID 재생성, 서명 없는 공개 공유에 owner_id를 요청대로 신뢰, 정식 주소 대신 localhost/추측 도메인 전송을 쓰지 않는다.

## 6. 계약

`contents.source_media_type`, `content_external_ids.media_type`는 TMDB movie/tv 또는 비TMDB 빈 문자열이다. `seasons.episodes_synced_at`은 전체 회차 동기화에만 기록하고 `published_episode_numbers`와 함께 사용한다. 미정 작품은 두 값이 모두 유효하고 공개 번호에 대응하는 행이 모두 있을 때만 30분 재사용한다. 빈 공개 배열은 공개된 회차가 없다는 완전 조회 결과이며, null은 완전 조회 증거가 없는 상태다. 공용 `isEpisodeListReusable`·`mergeEpisodeRows`를 서버와 앱이 사용한다. `library_shares.library_item_ids`는 새 공유의 등록 id 배열, null은 기존 공유다. `save_timeline_pin`은 핀 본문/태그/안정 id를 받아 같은 트랜잭션으로 결과를 반환한다. 구체 타입은 각 공용 helper·`src/types/database.ts`·마이그레이션에 대응한다.

## 7. 데이터 모델 / SQL

CLI로 생성한 다음 파일을 순서대로 검증하고 운영에는 별도 승인 후 반영한다. 기존 migration을 덮어쓰지 않는다. 아래 SQL은 해당 migration 파일과 일치해야 한다. 운영의 기존 0001~0022만으로도 적용 가능하며, 이번 작업과 무관한 0023·0024를 같이 적용하지 않는다. 사용자 승인 후 적용한 운영 이력 버전에 로컬 파일명을 맞췄으며 SQL 전문과 해시는 변경하지 않았다. 적용 증거는 [현황](development_next_steps.md#운영-반영-완료와-남은-설정)에 있다.

<details>
<summary>20261116124736_metadata_identity_scope.sql</summary>

원본: [20261116114112_metadata_identity_scope](../supabase/migrations/20261116124736_metadata_identity_scope.sql)

```sql
-- Preserve contents UUIDs and every user record. This migration classifies the current
-- stored representation; it does not guess or repair metadata corrupted before this fix.
ALTER TABLE public.contents ADD COLUMN source_media_type text NOT NULL DEFAULT '';
UPDATE public.contents
SET source_media_type = CASE WHEN source_api = 'tmdb'
  THEN CASE WHEN content_type = 'movie' THEN 'movie' ELSE 'tv' END ELSE '' END;
ALTER TABLE public.contents
  ADD CONSTRAINT contents_source_media_type_check CHECK (
    (source_api = 'tmdb' AND source_media_type = CASE WHEN content_type = 'movie' THEN 'movie' ELSE 'tv' END)
    OR (source_api <> 'tmdb' AND source_media_type = '')
  );
ALTER TABLE public.contents DROP CONSTRAINT contents_source_unique;
ALTER TABLE public.contents ADD CONSTRAINT contents_source_unique UNIQUE (source_api, source_id, source_media_type);

ALTER TABLE public.content_external_ids ADD COLUMN media_type text NOT NULL DEFAULT '';
UPDATE public.content_external_ids AS external_id
SET media_type = CASE WHEN external_id.api_source = 'tmdb'
  THEN CASE WHEN content.content_type = 'movie' THEN 'movie' ELSE 'tv' END ELSE '' END
FROM public.contents AS content WHERE content.id = external_id.content_id;
ALTER TABLE public.content_external_ids
  ADD CONSTRAINT content_external_ids_media_type_check CHECK (
    (api_source = 'tmdb' AND media_type IN ('movie', 'tv')) OR (api_source <> 'tmdb' AND media_type = '')
  );
ALTER TABLE public.content_external_ids DROP CONSTRAINT content_external_ids_source_unique;
ALTER TABLE public.content_external_ids ADD CONSTRAINT content_external_ids_source_unique UNIQUE (api_source, external_id, media_type);

-- Even a stale or mismatched refresh must never turn a registered movie into a TV work.
CREATE FUNCTION public.guard_tmdb_content_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.source_api = 'tmdb' AND (
    NEW.source_api IS DISTINCT FROM OLD.source_api
    OR NEW.source_id IS DISTINCT FROM OLD.source_id
    OR NEW.source_media_type IS DISTINCT FROM OLD.source_media_type
  ) THEN
    RAISE EXCEPTION 'CONTENT_IDENTITY_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_tmdb_content_identity
BEFORE UPDATE ON public.contents FOR EACH ROW EXECUTE FUNCTION public.guard_tmdb_content_identity();
REVOKE ALL ON FUNCTION public.guard_tmdb_content_identity() FROM PUBLIC;

ALTER TABLE public.seasons ADD COLUMN episodes_synced_at timestamptz;
ALTER TABLE public.seasons ADD COLUMN published_episode_numbers integer[];
ALTER TABLE public.seasons ADD CONSTRAINT seasons_published_episode_numbers_check
  CHECK (published_episode_numbers IS NULL OR (
    array_position(published_episode_numbers, NULL) IS NULL
    AND (cardinality(published_episode_numbers) = 0 OR (0 < ALL(published_episode_numbers) AND 50000 >= ALL(published_episode_numbers)))
  ));
COMMENT ON COLUMN public.seasons.episodes_synced_at IS 'Successful complete episode-list sync. First-episode prefetch never sets this marker; unknown totals refresh after 30 minutes.';
COMMENT ON COLUMN public.seasons.published_episode_numbers IS 'Actual published episode numbers from a successful unknown-total provider sync; other stored episode IDs remain untouched.';
COMMENT ON COLUMN public.contents.source_media_type IS 'TMDB movie/tv namespace; empty string for other providers. Raw source_id stays unchanged.';
COMMENT ON COLUMN public.content_external_ids.media_type IS 'TMDB movie/tv namespace; empty string for other providers. Raw external_id stays unchanged.';
```

</details>

<details>
<summary>20261116124742_atomic_pin_save.sql</summary>

원본: [20261116114134_atomic_pin_save](../supabase/migrations/20261116124742_atomic_pin_save.sql)

```sql
-- Pin contents and tag links commit together. Retried creates keep one client-generated id.
CREATE OR REPLACE FUNCTION public.save_timeline_pin(
  p_pin_id uuid,
  p_is_create boolean,
  p_content_id uuid,
  p_episode_id uuid,
  p_timestamp_seconds integer,
  p_memo text,
  p_emotion public.emotion_type,
  p_is_spoiler boolean,
  p_tag_names text[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pin public.timeline_pins%ROWTYPE;
  v_memo text := nullif(btrim(p_memo), '');
  v_names text[];
  v_existing_names text[];
  v_tag_id uuid;
  v_name text;
  v_created boolean := false;
  v_content_id uuid;
  v_episode_id uuid;
  v_content_type public.content_type;
  v_duration integer;
  v_label text;
  v_tags jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'LOGIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_pin_id IS NULL OR p_is_create IS NULL
    OR (p_timestamp_seconds IS NULL AND v_memo IS NULL)
    OR p_timestamp_seconds < 0 OR char_length(v_memo) > 500 THEN
    RAISE EXCEPTION 'PIN_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(p_tag_names, ARRAY[]::text[])) AS input(name)
    WHERE name IS NULL OR char_length(btrim(name)) NOT BETWEEN 1 AND 20
  ) THEN
    RAISE EXCEPTION 'PIN_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(name ORDER BY name), ARRAY[]::text[]) INTO v_names
  FROM (SELECT DISTINCT btrim(name) AS name FROM unnest(coalesce(p_tag_names, ARRAY[]::text[])) AS input(name)) AS names;
  IF cardinality(v_names) > 10 THEN
    RAISE EXCEPTION 'PIN_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pin FROM public.timeline_pins
    WHERE id = p_pin_id AND user_id = v_user_id FOR UPDATE;
  IF NOT p_is_create AND NOT FOUND THEN
    RAISE EXCEPTION 'PIN_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT p_is_create AND p_content_id IS NOT NULL AND p_content_id <> v_pin.content_id THEN
    RAISE EXCEPTION 'PIN_CONTENT_MISMATCH' USING ERRCODE = '22023';
  END IF;
  v_content_id := CASE WHEN p_is_create THEN p_content_id ELSE v_pin.content_id END;
  v_episode_id := CASE WHEN p_is_create THEN p_episode_id ELSE v_pin.episode_id END;
  SELECT content_type INTO v_content_type FROM public.contents WHERE id = v_content_id;
  IF NOT FOUND OR (v_content_type = 'movie' AND v_episode_id IS NOT NULL) THEN
    RAISE EXCEPTION 'PIN_CONTENT_MISMATCH' USING ERRCODE = '22023';
  END IF;
  IF v_episode_id IS NOT NULL THEN
    SELECT duration_seconds INTO v_duration FROM public.episodes
      WHERE id = v_episode_id AND content_id = v_content_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PIN_CONTENT_MISMATCH' USING ERRCODE = '22023';
    END IF;
    IF v_duration > 0 AND p_timestamp_seconds > v_duration THEN
      RAISE EXCEPTION 'PIN_INVALID_INPUT' USING ERRCODE = '22023';
    END IF;
  END IF;
  v_label := CASE
    WHEN p_timestamp_seconds IS NULL THEN NULL
    WHEN p_timestamp_seconds >= 3600 THEN (p_timestamp_seconds / 3600)::text || ':' ||
      lpad(((p_timestamp_seconds % 3600) / 60)::text, 2, '0') || ':' || lpad((p_timestamp_seconds % 60)::text, 2, '0')
    ELSE lpad((p_timestamp_seconds / 60)::text, 2, '0') || ':' || lpad((p_timestamp_seconds % 60)::text, 2, '0')
  END;

  IF p_is_create THEN
    INSERT INTO public.timeline_pins(id, user_id, content_id, episode_id, timestamp_seconds, display_time_label, memo, emotion, is_spoiler)
    VALUES (p_pin_id, v_user_id, v_content_id, v_episode_id, p_timestamp_seconds, v_label, v_memo, p_emotion, coalesce(p_is_spoiler, false))
    ON CONFLICT (id) DO NOTHING RETURNING * INTO v_pin;
    v_created := FOUND;
    IF NOT v_created THEN
      -- A concurrent identical retry waits for the first transaction, then reads its complete result.
      SELECT * INTO v_pin FROM public.timeline_pins
        WHERE id = p_pin_id AND user_id = v_user_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PIN_NOT_FOUND' USING ERRCODE = 'P0002';
      END IF;
      SELECT coalesce(array_agg(t.name ORDER BY t.name), ARRAY[]::text[]) INTO v_existing_names
      FROM public.timeline_pin_tags AS pt JOIN public.tags AS t ON t.id = pt.tag_id WHERE pt.pin_id = p_pin_id;
      IF v_pin.content_id IS DISTINCT FROM v_content_id OR v_pin.episode_id IS DISTINCT FROM v_episode_id
        OR v_pin.timestamp_seconds IS DISTINCT FROM p_timestamp_seconds OR v_pin.memo IS DISTINCT FROM v_memo
        OR v_pin.emotion IS DISTINCT FROM p_emotion OR v_pin.is_spoiler IS DISTINCT FROM coalesce(p_is_spoiler, false)
        OR v_existing_names IS DISTINCT FROM v_names THEN
        RAISE EXCEPTION 'PIN_REQUEST_CONFLICT' USING ERRCODE = '22023';
      END IF;
    END IF;
  ELSE
    UPDATE public.timeline_pins SET timestamp_seconds = p_timestamp_seconds, display_time_label = v_label,
      memo = v_memo, emotion = p_emotion, is_spoiler = coalesce(p_is_spoiler, false)
      WHERE id = p_pin_id AND user_id = v_user_id RETURNING * INTO v_pin;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PIN_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_created OR NOT p_is_create THEN
    -- Any error below rolls back the pin body and the old links as part of this function call.
    DELETE FROM public.timeline_pin_tags WHERE pin_id = p_pin_id;
    FOREACH v_name IN ARRAY v_names LOOP
      INSERT INTO public.tags(user_id, name) VALUES (v_user_id, v_name)
        ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
      INSERT INTO public.timeline_pin_tags(pin_id, tag_id) VALUES (p_pin_id, v_tag_id);
    END LOOP;
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.name), '[]'::jsonb) INTO v_tags
    FROM public.timeline_pin_tags AS pt JOIN public.tags AS t ON t.id = pt.tag_id WHERE pt.pin_id = p_pin_id;
  RETURN to_jsonb(v_pin) || jsonb_build_object('tags', v_tags);
END;
$$;

REVOKE ALL ON FUNCTION public.save_timeline_pin(uuid, boolean, uuid, uuid, integer, text, public.emotion_type, boolean, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_timeline_pin(uuid, boolean, uuid, uuid, integer, text, public.emotion_type, boolean, text[]) TO authenticated;
```

</details>

<details>
<summary>20261116124751_season_scoped_library_shares.sql</summary>

원본: [20261116114158_season_scoped_library_shares](../supabase/migrations/20261116124751_season_scoped_library_shares.sql)

```sql
-- NULL preserves existing content_ids links; new shares retain registration identity and order.
ALTER TABLE public.library_shares
  ADD COLUMN library_item_ids uuid[];

COMMENT ON COLUMN public.library_shares.library_item_ids IS
  'Ordered selected user_library_items ids. NULL identifies legacy content_ids shares.';

ALTER TABLE public.library_shares
  ADD CONSTRAINT library_shares_registration_limit CHECK (
    library_item_ids IS NULL OR cardinality(library_item_ids) BETWEEN 1 AND 1000
  );

-- Direct authenticated fallback must validate the same ownership boundary as the Edge handler.
DROP POLICY IF EXISTS library_shares_insert_own ON public.library_shares;
CREATE POLICY library_shares_insert_own ON public.library_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND (
      library_item_ids IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM unnest(library_item_ids) AS selected(library_item_id)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.user_library_items AS item
          WHERE item.id = selected.library_item_id AND item.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS library_shares_update_own ON public.library_shares;
CREATE POLICY library_shares_update_own ON public.library_shares
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (
    auth.uid() = owner_user_id
    AND (
      library_item_ids IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM unnest(library_item_ids) AS selected(library_item_id)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.user_library_items AS item
          WHERE item.id = selected.library_item_id AND item.user_id = auth.uid()
        )
      )
    )
  );
```

</details>

## 8. 화면 명세

UI 규칙을 따른다. 핀 상세의 편집/삭제/누락 행동만 바꾸고 폼 입력·초·스포일러·44pt를 유지한다. 라이브러리 공유는 선택한 등록 id를 전달한다. 네이티브 공유 취소는 오류로 취급하지 않는다. 나머지 화면은 같은 API·상태 인터페이스를 유지한다.

## 9. 엣지 케이스

동번호 영화/TV와 빠진 media_type, 비TMDB 중복, 구스키마·기존 UUID, 지연 계정 A와 최신 B, SDK 로딩 전 복원, 적용0행·DB 오류·구스키마 폴백, 서로 다른 항목/같은 필드/삭제의 동시 쓰기,1화/중간 누락/완전/미정/오래된 동기화·미래 marker,0/1000/1500행·중간 오류·상한, 같은 작품 두 시즌 공유·삭제된 항목·타인 항목·기존 링크, origin 미설정/웹/네이티브/공유 취소, 핀 재시도·동일 id 다른 payload·태그 실패·소유자 불일치·낙관적 삭제를 포함한다.

## 10. 테스트 표

모든 행을 순수 함수 테스트 및 실제 코드 격리 실행으로 옮긴다. 줄이지 않는다. 기존 단언은 보존한다.

| 범위 | 필수 회귀 |
|------|-----------|
| ID | movie/tv 동번호 분리, 명시 종류 실패 시 반대 폴백0, 불일치 갱신0, 비TMDB 호환 |
| AUTH | 늦은 A 복원이 B/로딩을 덮지 않음, SDK 이벤트 후 캐시 계정 일치 |
| WRITE | 상태/진행/날짜 및 폴백0행 실패, 실제 적용 성공, 원래 DB 오류 유지 |
| ROLLBACK | A실패 뒤 B성공 보존, 같은 항목 최신 작업/삭제 보존, 오류 settle 뒤 DB 재조정 |
| EP | 부분1화/중간 누락 수선, 완전 목록 재사용, 미정 공개 회차·marker30분, episode id 보존 |
| PAGE | 회차/체크/추천 입력의1000초과·중간 오류·상한·동률 정렬 |
| SHARE | 시즌2 선택/두 시즌 동시/순서/타인 거절/구 링크/삭제된 항목, HTTPS URL/미설정/전달·취소 |
| PIN | 생성 멱등성·payload 충돌·SQL rollback·RLS·기존 태그 보존·편집 저장/삭제 이동·빈 상세 행동 |

### 자동 검증 대응 파일

| 10장 범위 | 테스트 / 실제 코드 격리 실행 |
|-----------|---------------------------|
| ID | `contentIdentity.test.ts`, `recommendationEngine.test.ts`, `scripts/metadataIntegrityIntegration.test.ts`, `scripts/import-netflix-tmdb-bulk.test.ts` |
| AUTH | `scripts/authHydrationIntegration.test.ts` |
| WRITE | `src/utils/libraryWrite.test.ts`, `scripts/libraryIntegrityIntegration.test.ts` |
| ROLLBACK | `src/utils/libraryRollback.test.ts`, 실제 `useLibrary`/QueryCore mutation fixture |
| EP | `episodeCache.test.ts`, 실제 메타데이터 핸들러와 `libraryIntegrityIntegration.test.ts` |
| PAGE | 서버 `readAllRows.test.ts`, 실제 추천 핸들러 및 라이브러리 서비스 fixture |
| SHARE | 공용 `libraryShare.test.ts`, `src/utils/libraryShareUrl.test.ts`, 실제 create/get/service fixture |
| PIN | `pinSave.test.ts`, `pinDetailState.test.ts`, 실제 service/detail fixture와 임시 PostgreSQL RPC/RLS 검사 |

### 수동 확인 표

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹1440·375 | 로그인 복원·동시 변경·시즌 공유·핀 편집/삭제를 실제 화면에서 확인한다. 사용자 시청을 방해하지 않도록 이번에는 브라우저를 열지 않는다. |
| M-2 | iOS 세로 | 공유 시트·취소·핀 저장/삭제·계정 전환을 실기기에서 확인한다. 공개 웹 origin 설정 후 실행한다. |
| M-3 | Android | 공유 시트·취소·핀 저장/삭제·계정 전환을 실기기에서 확인한다. 공개 웹 origin 설정 후 실행한다. |

## 11. 변경 파일 목록

시작 snapshot 대비 이번 보완에서 변경하는 파일이다. 기존 docs/71·72 미커밋 파일 중 이번에 고치지 않은 파일은 포함하지 않는다. 외부 키·환경 secret은 변경하지 않는다.

```text
AGENTS.md
README.md
app.config.ts
app/(tabs)/library.tsx
app/pins/[id].tsx
docs/04_architecture.md
docs/08_frontend_architecture.md
docs/73_project_integrity_fixes_spec.md
docs/README.md
docs/development_next_steps.md
scripts/authHydrationIntegration.test.ts
scripts/import-netflix-tmdb-bulk.test.ts
scripts/import-netflix-tmdb-bulk.ts
scripts/libraryIntegrityIntegration.test.ts
scripts/metadataIntegrityIntegration.test.ts
src/components/pins/PinComposer.tsx
src/hooks/useLibrary.ts
src/services/library.ts
src/services/libraryShare.ts
src/services/pins.ts
src/stores/authStore.ts
src/types/database.ts
src/types/libraryShare.ts
src/types/pins.ts
src/utils/libraryRollback.test.ts
src/utils/libraryRollback.ts
src/utils/libraryShareUrl.test.ts
src/utils/libraryShareUrl.ts
src/utils/libraryWrite.test.ts
src/utils/libraryWrite.ts
src/utils/pinDetailState.test.ts
src/utils/pinDetailState.ts
src/utils/pinSave.test.ts
src/utils/pinSave.ts
supabase/functions/_shared/contentIdentity.test.ts
supabase/functions/_shared/contentIdentity.ts
supabase/functions/_shared/episodeCache.test.ts
supabase/functions/_shared/episodeCache.ts
supabase/functions/_shared/externalContent.ts
supabase/functions/_shared/libraryShare.test.ts
supabase/functions/_shared/libraryShare.ts
supabase/functions/_shared/readAllRows.test.ts
supabase/functions/_shared/readAllRows.ts
supabase/functions/_shared/recommendationEngine.test.ts
supabase/functions/_shared/recommendationEngine.ts
supabase/functions/add-to-library/index.ts
supabase/functions/bulk-register-netflix/index.ts
supabase/functions/create-library-share/index.ts
supabase/functions/fetch-episodes/index.ts
supabase/functions/get-content-detail/index.ts
supabase/functions/get-library-share/index.ts
supabase/functions/personalized-recommendations/index.ts
supabase/migrations/20261116124736_metadata_identity_scope.sql
supabase/migrations/20261116124742_atomic_pin_save.sql
supabase/migrations/20261116124751_season_scoped_library_shares.sql
```

## 12. 범위 밖

이미 훼손됐을 가능성이 있는 운영 메타데이터를 자동으로 추정 복원하거나 사용자 감상 기록을 수정하지 않는다. 브라우저/실기기/운영 DB를 검증용으로 조작하지 않는다. unrelated UI 토큰 일괄 정리·새 기능·프레임워크 교체는 하지 않는다.

## 13. 별도 확인 필요

공개 웹 origin은 사용자의 설정이 필요하다. 운영의 과거 TMDB 충돌 흔적은 별도 읽기 전용 진단이 필요하다. SQL은 임시 메모리 PostgreSQL로 실행 검증하되 실제 Supabase/PostgREST·실기기 동작을 대체하지 않는다.

## 14. Codex 실행 지시

### ROLE & GOAL

SceneNote의 정합성 결함 F-1~F-11을 보완한다. 사용자 감상 기록과 기존 UUID를 보존하고, 실패를 성공처럼 처리하거나 다른 성공을 복구 과정에서 덮지 않게 한다. 기존 docs/71·72의 동작 계약을 유지한다.

### READ FIRST

1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙.
2. 이 문서 전체와 `AGENTS.md`, `docs/development_next_steps.md`.
3. `docs/08_frontend_architecture.md`, `docs/17_season_library_tracking_spec.md`, `docs/31_usability_review_fixes_spec.md`, `docs/69_persistent_public_metadata_cache_fixes_spec.md`, `docs/71_meaningless_api_calls_and_usability_fixes_spec.md`, `docs/72_library_row_limit_and_redundant_reads_fixes_spec.md`.
4. 11장의 실제 서비스·훅·핸들러와 공용 helper. D-1~D-8은 임의로 바꾸지 말고 필요하면 구현 전에 보고한다.

### STEP 0 — 시작과 범위

`pwd`, `git rev-parse --show-toplevel`, `git status --short`와 소스 snapshot을 기록한다. 하위 지침을 확인하고 `npm test` 기준선을 남긴다. 시작 시 기대 기준선은 1690개이며 기존 테스트의 시간 의존 실패는 분리 실행으로 판별하고 단언을 완화하지 않는다. 다른 세션의 변경은 보존한다. 사용자 브라우저·시청 앱·서버를 실행하거나 조작하지 않는다.

### STEP 1 — 실제 실패부터

10장 각 행의 회귀를 순수 함수 또는 실제 코드를 격리한 fixture로 먼저 작성하고 실패 출력을 저장한다. 기존 단언과 테스트를 보존한다. 테스트가 처음부터 통과한다면 그 경계를 새 회귀 실패라고 보고하지 않는다. RN·Supabase 런타임을 테스트에서 직접 import하지 않는다.

### STEP 2 — 식별자·인증·쓰기·복구

D-1~D-4에 따라 TMDB namespace와 SDK 세션 소유권을 통일하고, UPDATE 0행을 실패로 처리한다. 변경 전후 값과 작업 세대로 항목별 복구를 제한한다. 일괄 등록 CLI/Edge의 모든 TMDB 조회도 같은 종류 판정을 사용한다. 미상 종류를 첫 숫자 ID 일치로 확정하지 않는다.

### STEP 3 — 회차·추천 입력·공유·핀

D-5~D-8에 따라 완전 회차 증거와 페이지 읽기를 보완하고 공유는 등록 단위로 저장한다. 핀은 안정 생성 ID와 원자적 RPC를 사용한다. 편집 저장/삭제 후 이동을 분리한다. 공개 웹 origin은 확인된 주소만 설정하고 미설정 시 네이티브 상대 URL을 보내지 않는다.

### STEP 4 — SQL과 운영 후보

새 migration 세 개만 순서대로 검증한다. 기존 ID·RLS·기존 링크·중복 재시도·태그 실패 rollback을 임시 PostgreSQL에서 실행한다. 운영 migration 목록은 읽기 전용 확인 후 같은 기준 스키마로도 검증한다. 대상 함수의 현재 원본을 백업하고 정확한 변경 소스와 해시를 준비한다. 구체 후보를 준비한 뒤 운영 반영 승인을 요청한다.

### 검증 명령

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

추가로 Edge 모든 진입점을 Deno strict 검사하고 임시 PostgreSQL에서 migration·권한·트랜잭션을 실행한다. 외부 요청은 격리 fixture에서 차단한다. 웹1440·375, iOS 세로, Android의 수동 확인은 실행 여부와 미실행 사유를 각각 보고한다.

### DEFINITION OF DONE

- [ ] 10장 모든 행에 회귀/격리 실행 근거가 있다.
- [ ] 기존 단언을 보존하고 전체 테스트·타입·린트·웹 export·Deno 검사가 통과한다.
- [ ] 기존 UUID·사용자 기록을 보존하고 실패 시 부분 핀/태그가 남지 않는다.
- [ ] 새 SQL은 운영과 같은 선행 스키마에서도 실행 검증한다.
- [ ] 새 UI 추가 코드의 UI-13.2 토큰·`Alert` 위반이 없다.
- [ ] 웹·iOS·Android 수동 확인 표와 필요한 공개 origin 설정을 보고한다.
- [ ] 배포/DB 적용 여부를 코드 구현과 구분하고 운영 반영은 별도 승인 후 수행한다.

### 변경 파일

11장의 파일 목록에 한정한다. 생성 산출물·캐시·사용자 환경 파일을 구현 소스로 취급하지 않는다. 관련 없는 기존 미커밋 변경을 되돌리거나 커밋에 섞지 않는다.

### 보고 항목

1. F-1~F-11의 변경과 이유, 실제 회귀 실패 출력.
2. 테스트 before/after와 타입·린트·웹 export·Deno·SQL 결과 및 한계.
3. 웹·iOS·Android 수동 확인 여부·미실행 사유.
4. D-1~D-8의 변경 필요 여부와 남은 과거 데이터 진단·공개 origin 설정.
5. 운영 migration/함수의 정확한 대상·순서·현재 적용 상태.

### 금지사항

운영 승인 없는 배포/DB 적용, 사용자 기록을 검증용으로 변경, 기존 migration/UUID/원시 ID 덮어쓰기, 테스트 단언 완화·누락, 비원자적 핀 저장 폴백, 무관한 리팩터링, 추측 도메인 설정, 브라우저/시청 앱 제어를 하지 않는다.
