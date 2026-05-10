-- ============================================================
-- SceneNote — Supabase Migration: Full Schema DDL
-- 버전: 1.0.0
-- 작성일: 2026-05-02
-- 작성자: Supabase Backend Architect
-- 기반 문서: 04_architecture.md, 05_erd_rls.md
--
-- 실행 순서:
-- 1. Extensions
-- 2. Enum Types
-- 3. Tables (FK 의존 순서 준수)
-- 4. updated_at 트리거 함수 및 각 테이블 적용
-- 5. profiles 자동 생성 트리거
-- 6. RLS 활성화 및 정책
-- 7. 인덱스
-- ============================================================


-- ============================================================
-- SECTION 1: Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 텍스트 유사도 검색 (Phase 2 전문 검색용)


-- ============================================================
-- SECTION 2: Enum Types
-- ============================================================

-- 콘텐츠 유형: 애니, 한국 드라마, 일본 드라마, 영화 등
CREATE TYPE content_type AS ENUM (
  'anime',   -- 애니메이션
  'kdrama',  -- 한국 드라마
  'jdrama',  -- 일본 드라마
  'movie',   -- 영화
  'other'    -- 분류 불명확 또는 기타
);

-- 감상 상태
CREATE TYPE watch_status AS ENUM (
  'wishlist',   -- 보고 싶음
  'watching',   -- 보는 중
  'completed',  -- 완료
  'dropped'     -- 드랍
);

-- 외부 API 소스
CREATE TYPE external_source AS ENUM (
  'tmdb',    -- The Movie Database
  'anilist', -- AniList (애니메이션 특화)
  'kitsu',   -- Kitsu (애니메이션)
  'tvmaze',  -- TVmaze (방영 스케줄 특화)
  'manual'   -- 수동 입력 (Phase 2 이후)
);

-- 핀 감정 레이블 (사전 정의 10종 + none)
CREATE TYPE emotion_type AS ENUM (
  'excited',   -- 설레는 / 흥분
  'moved',     -- 감동
  'funny',     -- 웃긴
  'sad',       -- 슬픈
  'surprised', -- 놀란
  'angry',     -- 화나는
  'scared',    -- 무서운
  'love',      -- 사랑스러운
  'boring',    -- 지루한
  'none'       -- 감정 없음 / 미선택
);


-- ============================================================
-- SECTION 3: Tables
-- ============================================================

-- ----------------------------------------------------------
-- 3.1 profiles
-- auth.users와 1:1 연결되는 사용자 프로필 테이블.
-- auth.users INSERT 트리거로 자동 생성됨.
-- ----------------------------------------------------------
CREATE TABLE profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  profiles                IS '사용자 프로필. auth.users와 1:1 연결.';
COMMENT ON COLUMN profiles.id            IS 'auth.users.id와 동일한 UUID';
COMMENT ON COLUMN profiles.display_name  IS '앱 내 표시 이름. nullable (미설정 시 이메일 앞부분 표시 가능)';
COMMENT ON COLUMN profiles.avatar_url    IS '프로필 이미지 URL. nullable';


-- ----------------------------------------------------------
-- 3.2 contents
-- 외부 API에서 가져온 콘텐츠 메타데이터.
-- 사용자가 라이브러리에 추가할 때만 생성됨 (bulk 캐싱 금지).
-- service_role(Edge Function)만 INSERT/UPDATE/DELETE 가능.
-- ----------------------------------------------------------
CREATE TABLE contents (
  id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type   content_type    NOT NULL,
  source_api     external_source NOT NULL,
  source_id      TEXT            NOT NULL,  -- 해당 API에서의 원본 ID (예: TMDB의 '1429')
  title_primary  TEXT            NOT NULL,  -- 앱에서 주로 사용하는 제목 (한국어 또는 영어)
  title_original TEXT,                       -- 원제 (일본어, 한국어 원제 등)
  poster_url     TEXT,                       -- 포스터 이미지 URL (외부 API 제공)
  overview       TEXT,                       -- 줄거리 요약
  air_year       INTEGER,                    -- 방영 연도
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),

  -- 동일 API의 동일 작품이 중복 저장되지 않도록 보장
  CONSTRAINT contents_source_unique UNIQUE (source_api, source_id)
);

COMMENT ON TABLE  contents               IS '콘텐츠 메타데이터. 사용자 라이브러리 추가 시에만 생성. service_role 쓰기 전용.';
COMMENT ON COLUMN contents.source_api   IS '최초 추가에 사용된 외부 API 소스';
COMMENT ON COLUMN contents.source_id    IS '해당 외부 API에서의 콘텐츠 ID';
COMMENT ON COLUMN contents.air_year     IS '첫 방영 연도 (또는 개봉 연도). nullable';


-- ----------------------------------------------------------
-- 3.3 content_external_ids
-- 하나의 콘텐츠 레코드와 여러 외부 API ID 간의 매핑.
-- MVP: 1 contents → 1 content_external_ids.
-- Phase 2: cross-API 매핑 허브 역할.
-- ----------------------------------------------------------
CREATE TABLE content_external_ids (
  id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  UUID            NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  api_source  external_source NOT NULL,
  external_id TEXT            NOT NULL,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),

  -- 동일 API 출처의 동일 외부 ID는 단 하나의 레코드만 허용
  CONSTRAINT content_external_ids_source_unique UNIQUE (api_source, external_id)
);

COMMENT ON TABLE  content_external_ids            IS '콘텐츠와 외부 API ID 간의 매핑. Phase 2에서 cross-API 통합 허브.';
COMMENT ON COLUMN content_external_ids.content_id IS 'contents.id FK';
COMMENT ON COLUMN content_external_ids.api_source IS '외부 API 소스 (tmdb, anilist 등)';
COMMENT ON COLUMN content_external_ids.external_id IS '해당 API에서의 ID 문자열';


-- ----------------------------------------------------------
-- 3.4 content_titles
-- 다국어 제목 지원. Phase 1에서 스키마 준비, Phase 2에서 데이터 채움.
-- ----------------------------------------------------------
CREATE TABLE content_titles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id    UUID        NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  language_code TEXT        NOT NULL,  -- ISO 639-1 코드 (ko, ja, en, x-romaji)
  title         TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT content_titles_unique UNIQUE (content_id, language_code)
);

COMMENT ON TABLE  content_titles               IS '다국어 제목. Phase 2에서 전문 검색(GIN 인덱스)과 함께 활성화.';
COMMENT ON COLUMN content_titles.language_code IS 'ISO 639-1 언어 코드. x-romaji는 로마자 표기용 커스텀 코드.';


-- ----------------------------------------------------------
-- 3.5 seasons
-- 시리즈의 시즌 단위 메타데이터.
-- 에피소드 목록은 fetch-episodes Edge Function이 lazy load 방식으로 저장.
-- ----------------------------------------------------------
CREATE TABLE seasons (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id     UUID        NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  season_number  INTEGER     NOT NULL CHECK (season_number >= 1),
  title          TEXT,                    -- 시즌 제목 (없을 수 있음)
  episode_count  INTEGER     CHECK (episode_count IS NULL OR episode_count >= 0),
  air_year       INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 동일 콘텐츠에서 시즌 번호 중복 방지
  CONSTRAINT seasons_content_season_unique UNIQUE (content_id, season_number)
);

COMMENT ON TABLE  seasons              IS '시리즈 시즌 메타데이터. service_role 쓰기 전용.';
COMMENT ON COLUMN seasons.episode_count IS '시즌의 총 에피소드 수. 외부 API 제공 값. nullable';


-- ----------------------------------------------------------
-- 3.6 episodes
-- 에피소드 단위 메타데이터.
-- content_id는 직접 참조 (seasons JOIN 없이 content 단위 조회 최적화).
-- ----------------------------------------------------------
CREATE TABLE episodes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id        UUID        NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  content_id       UUID        NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  episode_number   INTEGER     NOT NULL CHECK (episode_number >= 1),
  title            TEXT,
  air_date         DATE,
  duration_seconds INTEGER     CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 동일 시즌 내 에피소드 번호 중복 방지
  CONSTRAINT episodes_season_episode_unique UNIQUE (season_id, episode_number)
);

COMMENT ON TABLE  episodes                  IS '에피소드 메타데이터. fetch-episodes Edge Function이 lazy load로 저장.';
COMMENT ON COLUMN episodes.content_id       IS 'seasons JOIN 없이 content 단위 조회를 위한 비정규화 FK';
COMMENT ON COLUMN episodes.duration_seconds IS '에피소드 재생 시간(초). timestamp_seconds 초과 검증에 사용. nullable';


-- ----------------------------------------------------------
-- 3.7 user_library_items
-- 사용자의 감상 상태 및 라이브러리 항목.
-- (user_id, content_id) UNIQUE 제약으로 동일 작품 중복 추가 방지.
-- ----------------------------------------------------------
CREATE TABLE user_library_items (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID         NOT NULL REFERENCES contents(id) ON DELETE RESTRICT,
  status     watch_status NOT NULL DEFAULT 'wishlist',
  added_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- 동일 사용자가 같은 콘텐츠를 중복 추가하지 못하도록 보장
  CONSTRAINT user_library_items_user_content_unique UNIQUE (user_id, content_id)
);

COMMENT ON TABLE  user_library_items          IS '사용자 라이브러리. 사용자와 콘텐츠의 연결 및 감상 상태 보유.';
COMMENT ON COLUMN user_library_items.status   IS 'wishlist | watching | completed | dropped';
COMMENT ON COLUMN user_library_items.added_at IS '라이브러리에 추가된 시각. updated_at과 구분.';

-- contents ON DELETE RESTRICT 이유:
-- 콘텐츠 메타데이터가 삭제될 경우 라이브러리 항목도 함께 사라지지 않도록 방어.
-- 실제 콘텐츠 삭제는 사용자 데이터 정리 후 service_role이 명시적으로 수행해야 함.


-- ----------------------------------------------------------
-- 3.8 user_episode_progress
-- 에피소드 단위 시청 완료 상태 기록.
-- (user_id, episode_id) UNIQUE: 동일 에피소드를 두 번 체크해도 하나의 레코드만 유지.
-- ----------------------------------------------------------
CREATE TABLE user_episode_progress (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id UUID        NOT NULL REFERENCES episodes(id) ON DELETE RESTRICT,
  content_id UUID        NOT NULL REFERENCES contents(id) ON DELETE RESTRICT,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_episode_progress_unique UNIQUE (user_id, episode_id)
);

COMMENT ON TABLE  user_episode_progress           IS '에피소드별 시청 완료 기록.';
COMMENT ON COLUMN user_episode_progress.content_id IS '조회 최적화를 위한 비정규화 FK. seasons JOIN 없이 content 단위 진행률 조회 가능.';
COMMENT ON COLUMN user_episode_progress.watched_at IS '시청 완료로 표시한 시각. 완료 → 미완료 전환 시 이 레코드를 DELETE.';


-- ----------------------------------------------------------
-- 3.9 reviews
-- 작품에 대한 사용자 개인 평점 및 리뷰.
-- MVP 제외 (Phase 2 활성화). 스키마는 미리 준비.
-- ----------------------------------------------------------
CREATE TABLE reviews (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID        NOT NULL REFERENCES contents(id) ON DELETE RESTRICT,
  rating     NUMERIC(3,1)           CHECK (rating IS NULL OR (rating >= 0.5 AND rating <= 10.0)),
  body       TEXT,
  is_spoiler BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 동일 사용자가 동일 작품에 리뷰 하나만 작성 가능 (MVP 정책)
  CONSTRAINT reviews_user_content_unique UNIQUE (user_id, content_id)
);

COMMENT ON TABLE  reviews         IS 'Phase 2에서 활성화. 작품 단위 개인 평점 및 리뷰.';
COMMENT ON COLUMN reviews.rating  IS '0.5~10.0, 0.5 단위. nullable (평점 없이 리뷰 본문만 작성 가능)';


-- ----------------------------------------------------------
-- 3.10 tags
-- 사용자가 생성한 개인 태그. 사용자별 독립 네임스페이스.
-- (user_id, name) UNIQUE: 동일 사용자는 같은 이름의 태그를 한 번만 생성 가능.
-- ----------------------------------------------------------
CREATE TABLE tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT tags_user_name_unique UNIQUE (user_id, name)
);

COMMENT ON TABLE  tags      IS '사용자 정의 태그. 사용자별 독립 네임스페이스. 이름은 최대 20자.';
COMMENT ON COLUMN tags.name IS '태그 이름. 1~20자. 사용자별 중복 불가.';


-- ----------------------------------------------------------
-- 3.11 timeline_pins
-- SceneNote 핵심 자산.
-- 특정 에피소드(또는 영화)의 특정 시간에 사용자가 남긴 기록.
--
-- 핵심 설계 결정:
--   - timestamp_seconds: INT (정수 초). NULL 허용 (시간 미지정 핀).
--   - episode_id: NULL 허용 (영화 핀 — 가상 에피소드 생성 금지).
--   - 동일 에피소드/시간대 복수 핀 허용 (UNIQUE 제약 없음).
--   - 정렬: timestamp_seconds ASC NULLS LAST, created_at ASC.
-- ----------------------------------------------------------
CREATE TABLE timeline_pins (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id         UUID         NOT NULL REFERENCES contents(id) ON DELETE RESTRICT,
  episode_id         UUID         REFERENCES episodes(id) ON DELETE SET NULL,
  -- episode_id ON DELETE SET NULL 이유:
  -- 에피소드 메타데이터가 삭제될 경우 핀 자체는 보존.
  -- 영화 핀은 처음부터 episode_id = NULL.
  timestamp_seconds  INTEGER      CHECK (timestamp_seconds IS NULL OR timestamp_seconds >= 0),
  display_time_label TEXT,        -- 클라이언트가 생성한 표시용 문자열 예: "14:32", "1:23:45"
  memo               TEXT         CHECK (memo IS NULL OR char_length(memo) <= 500),
  emotion            emotion_type,
  is_spoiler         BOOLEAN      NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- timestamp_seconds와 memo가 모두 NULL인 핀은 의미가 없음.
  -- 앱 레벨에서 강제하지만 DB 체크로도 방어.
  CONSTRAINT timeline_pins_content_required
    CHECK (timestamp_seconds IS NOT NULL OR memo IS NOT NULL)
);

COMMENT ON TABLE  timeline_pins                     IS 'SceneNote 핵심 자산. 에피소드/영화의 특정 시간 기록.';
COMMENT ON COLUMN timeline_pins.episode_id          IS 'NULL 허용: 영화 핀은 episode_id = NULL. 가상 에피소드 레코드 생성 금지.';
COMMENT ON COLUMN timeline_pins.timestamp_seconds   IS '정수 초 단위. NULL 허용(시간 미지정 핀). CHECK >= 0.';
COMMENT ON COLUMN timeline_pins.display_time_label  IS '표시용 문자열. 저장은 클라이언트가 생성. 예: "14:32", "1:23:45".';
COMMENT ON COLUMN timeline_pins.memo                IS '핀 메모. 최대 500자. NULL 허용.';
COMMENT ON COLUMN timeline_pins.emotion             IS 'emotion_type enum. NULL = 감정 미선택.';
COMMENT ON COLUMN timeline_pins.is_spoiler          IS '스포일러 플래그. 클라이언트에서 블러 처리.';


-- ----------------------------------------------------------
-- 3.12 timeline_pin_tags
-- timeline_pins와 tags의 N:M 연결 테이블.
-- 복합 PK (pin_id, tag_id): 동일 핀에 동일 태그 중복 불가.
-- ----------------------------------------------------------
CREATE TABLE timeline_pin_tags (
  pin_id UUID NOT NULL REFERENCES timeline_pins(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

  PRIMARY KEY (pin_id, tag_id)
);

COMMENT ON TABLE  timeline_pin_tags        IS '핀과 태그의 N:M 연결. 복합 PK로 중복 방지.';
COMMENT ON COLUMN timeline_pin_tags.pin_id IS 'timeline_pins.id FK. 핀 삭제 시 CASCADE.';
COMMENT ON COLUMN timeline_pin_tags.tag_id IS 'tags.id FK. 태그 삭제 시 CASCADE.';


-- ----------------------------------------------------------
-- 3.13 external_search_cache
-- 외부 API 검색 결과 TTL 캐싱.
-- service_role(Edge Function)만 접근 가능.
-- TTL 기본값: 검색 결과 1시간, 콘텐츠 상세 24시간.
-- ----------------------------------------------------------
CREATE TABLE external_search_cache (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash    TEXT            NOT NULL,  -- SHA-256(query + source + content_type) 등
  query_text    TEXT            NOT NULL,  -- 원본 검색어 (디버깅용)
  source        external_source NOT NULL,  -- 어느 API의 캐시인지
  response_json JSONB           NOT NULL,  -- 정규화된 검색 결과 JSON
  expires_at    TIMESTAMPTZ     NOT NULL,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),

  CONSTRAINT external_search_cache_hash_source_unique UNIQUE (query_hash, source)
);

COMMENT ON TABLE  external_search_cache              IS '외부 API 검색 결과 TTL 캐시. service_role 전용.';
COMMENT ON COLUMN external_search_cache.query_hash   IS 'SHA-256 해시 또는 유사 결정적 키. 빠른 캐시 lookup용.';
COMMENT ON COLUMN external_search_cache.expires_at   IS 'TTL 기준. 검색: 1시간, 콘텐츠 상세: 24시간.';


-- ----------------------------------------------------------
-- 3.14 metadata_sync_logs
-- 콘텐츠 메타데이터 동기화 및 라이브러리 추가 작업의 감사 로그.
-- 불변(append-only). service_role 전용.
-- ----------------------------------------------------------
CREATE TABLE metadata_sync_logs (
  id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id        UUID            REFERENCES contents(id) ON DELETE SET NULL,
  api_source        external_source,
  operation         TEXT            NOT NULL,  -- 'add_to_library', 'upsert_content', 'fetch_episodes' 등
  status            TEXT            NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  request_payload   JSONB,                     -- Edge Function에 전달된 요청 데이터
  response_snapshot JSONB,                     -- 외부 API 응답 스냅샷 (디버깅용)
  error_message     TEXT,                      -- 실패 시 에러 메시지
  synced_at         TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  metadata_sync_logs                  IS '메타데이터 동기화 감사 로그. 불변(append-only). service_role 전용.';
COMMENT ON COLUMN metadata_sync_logs.content_id       IS '관련 콘텐츠. 콘텐츠 삭제 시 SET NULL (로그는 보존).';
COMMENT ON COLUMN metadata_sync_logs.operation        IS '작업 유형: add_to_library, upsert_content, fetch_episodes 등';
COMMENT ON COLUMN metadata_sync_logs.status           IS 'success | partial | failed';
COMMENT ON COLUMN metadata_sync_logs.response_snapshot IS '외부 API 응답 원본 스냅샷. 크기 제한 고려 (대용량은 Phase 2에서 별도 처리).';


-- ============================================================
-- SECTION 4: updated_at 자동 업데이트 트리거
-- ============================================================

-- 트리거 함수 (공용)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- profiles
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- contents
CREATE TRIGGER trg_contents_updated_at
  BEFORE UPDATE ON contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- seasons
CREATE TRIGGER trg_seasons_updated_at
  BEFORE UPDATE ON seasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- episodes
CREATE TRIGGER trg_episodes_updated_at
  BEFORE UPDATE ON episodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- user_library_items
CREATE TRIGGER trg_user_library_items_updated_at
  BEFORE UPDATE ON user_library_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- reviews
CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- timeline_pins
CREATE TRIGGER trg_timeline_pins_updated_at
  BEFORE UPDATE ON timeline_pins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- SECTION 5: profiles 자동 생성 트리거
-- auth.users에 새 사용자가 INSERT될 때 profiles 레코드를 자동 생성.
-- display_name은 이메일 앞부분을 초기값으로 사용.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    -- 소셜 로그인: full_name 사용. 이메일 가입: 이메일 앞부분 사용.
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING; -- 중복 실행 방어
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users INSERT 시 프로필 자동 생성
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- SECTION 6: RLS 활성화 및 정책
-- ============================================================

-- ----------------------------------------------------------
-- 6.1 profiles
-- ----------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE는 handle_new_user 트리거와 auth.users CASCADE가 처리.
-- 직접 삭제는 service_role을 통한 명시적 계정 삭제 플로우에서만 허용.


-- ----------------------------------------------------------
-- 6.2 contents (콘텐츠 메타데이터 — service_role 쓰기 전용)
-- ----------------------------------------------------------
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contents_select_authenticated" ON contents
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE 정책 없음 → authenticated 역할에서 쓰기 차단됨
-- service_role은 RLS를 우회하므로 Edge Function에서 직접 UPSERT 가능


-- ----------------------------------------------------------
-- 6.3 content_external_ids
-- ----------------------------------------------------------
ALTER TABLE content_external_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_external_ids_select_authenticated" ON content_external_ids
  FOR SELECT TO authenticated
  USING (true);

-- 쓰기 정책 없음 → service_role만 가능


-- ----------------------------------------------------------
-- 6.4 content_titles
-- ----------------------------------------------------------
ALTER TABLE content_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_titles_select_authenticated" ON content_titles
  FOR SELECT TO authenticated
  USING (true);

-- 쓰기 정책 없음 → service_role만 가능


-- ----------------------------------------------------------
-- 6.5 seasons
-- ----------------------------------------------------------
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons_select_authenticated" ON seasons
  FOR SELECT TO authenticated
  USING (true);

-- 쓰기 정책 없음 → service_role만 가능


-- ----------------------------------------------------------
-- 6.6 episodes
-- ----------------------------------------------------------
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "episodes_select_authenticated" ON episodes
  FOR SELECT TO authenticated
  USING (true);

-- 쓰기 정책 없음 → service_role만 가능


-- ----------------------------------------------------------
-- 6.7 user_library_items
-- ----------------------------------------------------------
ALTER TABLE user_library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_library_items_select_own" ON user_library_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_library_items_insert_own" ON user_library_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_library_items_update_own" ON user_library_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_library_items_delete_own" ON user_library_items
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 주의: add-to-library Edge Function은 service_role 사용.
-- user_id는 반드시 JWT에서 추출한 auth.uid()로 강제 설정해야 함.


-- ----------------------------------------------------------
-- 6.8 user_episode_progress
-- ----------------------------------------------------------
ALTER TABLE user_episode_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_episode_progress_select_own" ON user_episode_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_episode_progress_insert_own" ON user_episode_progress
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_episode_progress_update_own" ON user_episode_progress
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_episode_progress_delete_own" ON user_episode_progress
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 6.9 reviews
-- ----------------------------------------------------------
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_own" ON reviews
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- Phase 3: 공개 리뷰를 허용할 때 is_public = true 조건의 별도 SELECT 정책 추가

CREATE POLICY "reviews_insert_own" ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_delete_own" ON reviews
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 6.10 timeline_pins
-- ----------------------------------------------------------
ALTER TABLE timeline_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_pins_select_own" ON timeline_pins
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "timeline_pins_insert_own" ON timeline_pins
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "timeline_pins_update_own" ON timeline_pins
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "timeline_pins_delete_own" ON timeline_pins
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 6.11 tags
-- ----------------------------------------------------------
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_own" ON tags
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "tags_insert_own" ON tags
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags_update_own" ON tags
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags_delete_own" ON tags
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 6.12 timeline_pin_tags
-- user_id 컬럼이 없으므로 핀 소유자를 경유한 간접 정책 사용.
-- ----------------------------------------------------------
ALTER TABLE timeline_pin_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_pin_tags_select_own" ON timeline_pin_tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timeline_pins
      WHERE timeline_pins.id = timeline_pin_tags.pin_id
        AND timeline_pins.user_id = auth.uid()
    )
  );

CREATE POLICY "timeline_pin_tags_insert_own" ON timeline_pin_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM timeline_pins
      WHERE timeline_pins.id = timeline_pin_tags.pin_id
        AND timeline_pins.user_id = auth.uid()
    )
  );

-- UPDATE는 핀-태그 관계 변경 시 삭제 후 재삽입 전략을 사용하므로 별도 정책 불필요.

CREATE POLICY "timeline_pin_tags_delete_own" ON timeline_pin_tags
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timeline_pins
      WHERE timeline_pins.id = timeline_pin_tags.pin_id
        AND timeline_pins.user_id = auth.uid()
    )
  );


-- ----------------------------------------------------------
-- 6.13 external_search_cache (service_role 전용)
-- ----------------------------------------------------------
ALTER TABLE external_search_cache ENABLE ROW LEVEL SECURITY;

-- 모든 정책 없음 → authenticated 접근 완전 차단
-- service_role은 RLS를 우회하므로 Edge Function에서 읽기/쓰기 가능
-- 명시적으로 주석으로 의도를 문서화
-- (선택적) 아래처럼 deny-all 정책을 명시할 수도 있음:
-- CREATE POLICY "external_search_cache_deny_all" ON external_search_cache
--   FOR ALL TO authenticated USING (false);


-- ----------------------------------------------------------
-- 6.14 metadata_sync_logs (service_role 전용)
-- ----------------------------------------------------------
ALTER TABLE metadata_sync_logs ENABLE ROW LEVEL SECURITY;

-- 모든 정책 없음 → authenticated 접근 완전 차단
-- service_role만 접근 가능


-- ============================================================
-- SECTION 7: 인덱스
-- ============================================================

-- ----------------------------------------------------------
-- timeline_pins 인덱스
-- ----------------------------------------------------------

-- IDX-01: 특정 사용자의 모든 핀 — 최근 순 (My Page 통계, 태그별 전체 핀)
CREATE INDEX idx_timeline_pins_user_recent
  ON timeline_pins (user_id, created_at DESC);

-- IDX-02: 특정 사용자의 특정 작품 핀 — 시간순 (작품 단위 핀 목록 SCR-011)
CREATE INDEX idx_timeline_pins_user_content_ts
  ON timeline_pins (user_id, content_id, timestamp_seconds ASC NULLS LAST);

-- IDX-03: 특정 사용자의 특정 에피소드 핀 — 시간순 (에피소드 단위 핀 목록 SCR-011)
-- MVP에서 가장 빈번한 핀 조회 패턴. 반드시 생성.
CREATE INDEX idx_timeline_pins_user_episode_ts
  ON timeline_pins (user_id, episode_id, timestamp_seconds ASC NULLS LAST);

-- IDX-04: 영화 핀 조회 (episode_id IS NULL) — Partial Index
CREATE INDEX idx_timeline_pins_movie
  ON timeline_pins (user_id, content_id, timestamp_seconds ASC NULLS LAST)
  WHERE episode_id IS NULL;


-- ----------------------------------------------------------
-- timeline_pin_tags 인덱스
-- ----------------------------------------------------------

-- IDX-05: 태그별 핀 조회 (tag_id → pin_id 방향)
-- 복합 PK (pin_id, tag_id)는 자동 인덱스 생성. (tag_id, pin_id) 방향만 추가.
CREATE INDEX idx_timeline_pin_tags_tag_pin
  ON timeline_pin_tags (tag_id, pin_id);


-- ----------------------------------------------------------
-- user_library_items 인덱스
-- ----------------------------------------------------------

-- IDX-06: 라이브러리 목록 — 상태 필터 (SCR-003 감상 상태 탭)
CREATE INDEX idx_user_library_items_user_status
  ON user_library_items (user_id, status);


-- ----------------------------------------------------------
-- user_episode_progress 인덱스
-- ----------------------------------------------------------

-- IDX-07: 콘텐츠별 에피소드 진행률 조회 (SCR-009 시즌 진행률 표시)
-- UNIQUE (user_id, episode_id) 인덱스는 자동 생성. content_id 기준 추가.
CREATE INDEX idx_user_episode_progress_user_content
  ON user_episode_progress (user_id, content_id);


-- ----------------------------------------------------------
-- external_search_cache 인덱스
-- ----------------------------------------------------------

-- IDX-08: 캐시 lookup (query_hash + source + TTL 체크)
CREATE INDEX idx_external_search_cache_lookup
  ON external_search_cache (query_hash, source, expires_at);

-- IDX-09: 만료된 캐시 레코드 정리용
CREATE INDEX idx_external_search_cache_expires
  ON external_search_cache (expires_at);


-- ----------------------------------------------------------
-- contents 인덱스 (UNIQUE 제약으로 자동 생성 확인)
-- ----------------------------------------------------------
-- contents (source_api, source_id) UNIQUE 제약이 B-tree 인덱스를 자동 생성.
-- 별도 CREATE INDEX 불필요.

-- content_external_ids (api_source, external_id) UNIQUE 제약도 자동 인덱스 생성.


-- ----------------------------------------------------------
-- 추가: RLS 간접 정책을 위한 timeline_pins 서브쿼리 최적화
-- ----------------------------------------------------------
-- timeline_pin_tags의 RLS 정책이 EXISTS (SELECT 1 FROM timeline_pins WHERE id = pin_id AND user_id = auth.uid()) 사용.
-- timeline_pins의 PK 인덱스(id)가 이미 있으므로 별도 인덱스 불필요.
-- 단, user_id가 포함된 인덱스가 없으면 성능 저하 가능. idx_timeline_pins_user_recent가 커버.


-- ============================================================
-- SECTION 8: 추가 제약 사항 메모
-- ============================================================

-- TBD-003: 태그 최대 글자 수 → 20자 (tags.name CHECK 적용됨)
-- TBD-004: 핀 하나에 태그 최대 개수 → 앱 레벨에서 10개 제한 (DB 제약은 성능 부담으로 생략)
-- TBD-001: timestamp_seconds NULL 허용됨 (시간 미지정 핀)
-- TBD-002: memo NULL 허용됨, 단 timestamp_seconds와 memo 모두 NULL인 경우 CHECK 제약으로 차단
-- TBD-007: completed → watching 전환 시 user_episode_progress는 유지 (삭제 안 함)

-- ============================================================
-- END OF MIGRATION
-- ============================================================
