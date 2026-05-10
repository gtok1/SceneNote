# SceneNote Implementation Notes

작성일: 2026-05-02

## 읽은 설계 문서

- `CLAUDE.md`
- `docs/01_product_requirements.md`
- `docs/02_user_stories.md`
- `docs/03_screen_flow.md`
- `docs/04_architecture.md`
- `docs/05_erd_rls.md`
- `docs/06_backend_schema.sql`
- `docs/07_edge_functions.md`
- `docs/08_frontend_architecture.md`
- `docs/09_timeline_pin_ux.md`
- `docs/10_mvp_integration_plan.md`
- `docs/codex_prompt.md`

## MVP에서 반드시 구현할 기능

- 이메일 기반 회원가입/로그인과 Supabase 세션 유지.
- 외부 API 검색은 클라이언트에서 직접 호출하지 않고 `search-content` Edge Function을 경유.
- My Library: 작품 추가, 감상 상태 조회/변경, 상태별 목록 필터.
- 시즌/에피소드 목록과 에피소드 진행률 체크 구조.
- 타임라인 핀 생성/조회/수정/삭제: `timestamp_seconds`, 메모, 태그, 감정, 스포일러.
- 핀 목록은 `timestamp_seconds ASC NULLS LAST, created_at ASC` 기준.
- 동일 에피소드/동일 시간대의 여러 핀 허용.
- 사용자 기록 테이블 전체 RLS 적용.

## MVP에서 제외할 기능

- 소셜 공유, 팔로우, 커뮤니티, 추천 알고리즘.
- Highlight Reel, 알림, 오프라인 모드, 다크 모드, 핀 Export.
- cross-API canonical 콘텐츠 통합.
- Kitsu/TVmaze의 완전 통합은 Phase 2. MVP에서는 adapter 골격과 부분 검색만 제공.
- 개인 평점/리뷰 기능은 스키마만 준비하고 화면 기능은 제외.
- 스포일러 영구 해제, 진행바형 타임라인 뷰.

## 필요한 앱 화면 목록

- `app/(auth)/sign-in.tsx`
- `app/(auth)/sign-up.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/library.tsx`
- `app/(tabs)/pins.tsx`
- `app/(tabs)/profile.tsx`
- `app/search.tsx`
- `app/content/[id].tsx`
- `app/content/[id]/episodes.tsx`
- `app/content/[id]/pins.tsx`
- `app/pins/[id].tsx`

## 필요한 Supabase 테이블 목록

- `profiles`
- `contents`
- `content_external_ids`
- `content_titles`
- `seasons`
- `episodes`
- `user_library_items`
- `user_episode_progress`
- `reviews`
- `timeline_pins`
- `tags`
- `timeline_pin_tags`
- `external_search_cache`
- `metadata_sync_logs`

## 필요한 Edge Function 목록

- MVP 최종 설계 기준: `search-content`, `get-content-detail`, `add-to-library`, `fetch-episodes`
- 현재 구현/배포 범위: `search-content`, `get-content-detail`, `add-to-library`, `fetch-episodes`

## 구현 순서

1. 프로젝트 문서화: `implementation_notes.md`, `AGENTS.md`
2. Expo + React Native + TypeScript 스캐폴딩
3. Supabase migration 생성
4. Supabase client, React Query provider, 타입 정의
5. timecode/validation 유틸
6. `search-content` Edge Function 및 adapters
7. 서비스 레이어, React Query hooks, Zustand stores
8. 공통 UI와 콘텐츠/핀 컴포넌트
9. Expo Router 화면 구현
10. 타입체크/린트/실행 검증 및 다음 단계 문서화

## 설계 문서 간 충돌 또는 확인 필요 사항

- 라우트 구조: `docs/08_frontend_architecture.md`는 `(tabs)/search`와 `pins/new`를 제안하지만, 이번 요청은 `app/search.tsx`, `app/pins/[id].tsx` 중심이다. 요청 구조를 우선하고 필요한 진입은 search params로 처리한다.
- `search-content` 범위: `docs/10_mvp_integration_plan.md`는 TMDB + AniList를 MVP 필수, Kitsu/TVmaze는 Phase 2로 본다. 이번 요청은 4개 adapter 생성을 요구하므로 Kitsu/TVmaze는 best-effort adapter로 구현하되 운영 검증 TODO를 남긴다.
- 라이브러리 추가: 콘텐츠 메타데이터 쓰기는 service_role이 필요하므로 클라이언트 직접 insert가 불가하다. 현재는 `add-to-library` Edge Function이 콘텐츠/외부 ID/타이틀/시즌 기본값을 upsert한 뒤 `user_library_items`를 생성한다.
- 콘텐츠 상세/에피소드 lazy load: `get-content-detail`, `fetch-episodes` Edge Function을 구현했다. DB 캐시를 우선 사용하고, 비어 있으면 외부 API에서 가능한 범위로 보강한다.
- 감정 enum: DB 문서는 `excited`, `moved`, `funny`, `sad`, `surprised`, `angry`, `scared`, `love`, `boring`, `none`을 사용한다. UX 문서의 한국어 감정 10종과 일부 차이가 있어 DB enum을 우선한다.
- 타임스탬프/메모: 최종 통합 계획에 따라 둘 중 하나만 있으면 핀 저장 가능하다. 둘 다 비어 있으면 앱/DB에서 차단한다.
- 영화 핀: `episode_id = NULL` 방식이 최종 결정이다.

## 구현된 범위

- Expo + React Native + TypeScript + Expo Router 프로젝트 스캐폴딩.
- Supabase 초기 migration: `supabase/migrations/0001_initial_schema.sql`에 설계 SQL 반영.
- Supabase CLI 초기화: `supabase/config.toml`, 빈 `supabase/seed.sql` 생성.
- Supabase 클라이언트, TanStack Query client/provider, auth store.
- 이메일 sign-in/sign-up 화면과 기본 auth guard.
- 탭 화면: 홈, 라이브러리, 전체 핀, 프로필.
- 검색 화면: `search-content` Edge Function 호출, 결과 리스트, partial 실패 안내.
- 콘텐츠 상세 화면: DB 콘텐츠 상세 또는 검색 결과 snapshot 상세, 라이브러리 추가 CTA.
- 에피소드 화면: 시즌/에피소드 DB 조회, 진행률 토글, 핀 작성 진입.
- 핀 목록/상세/작성/수정/삭제 UI와 Supabase CRUD 서비스.
- 태그 find-or-create, 핀-태그 연결/교체 서비스.
- Timecode 유틸과 node:test 기반 테스트.
- Edge Functions: `search-content`, `add-to-library`, `get-content-detail`, `fetch-episodes` 구현.
- 프론트 에피소드 조회는 DB에 에피소드가 없을 때 `fetch-episodes`를 호출하도록 연결.
- 검색 결과 상세는 `get-content-detail` 호출 결과가 있으면 상세 메타데이터를 우선 사용.
- 원격 Supabase 스키마에서 TypeScript 타입을 생성해 `src/types/database.ts`에 반영했고, Supabase client에 `Database` 제네릭을 연결했다.
- 인증된 `search-content` 호출을 검증할 수 있는 `npm run smoke:edge -- "Inception" movie` 스크립트를 추가했다. 전용 테스트 계정 환경변수가 필요하다.
- Expo SDK 54 호환 버전으로 의존성을 정렬했고, web 실행을 위해 `react-dom`, `react-native-web`을 추가했다.
- Expo web SSR 단계에서 Supabase Auth storage가 `window`를 참조하지 않도록 noop storage fallback을 추가했다.
- 외부 콘텐츠 검색/상세는 TMDB 한국어(`ko-KR`, region `KR`)를 우선 사용한다. `search-content` 캐시 키에 한국어 버전을 포함해 이전 영어 캐시를 재사용하지 않도록 했다.
- AniList/Kitsu 상세는 TMDB 한국어 검색으로 제목/개요/포스터를 best-effort 보강한다. 기존 DB에 영어로 저장된 AniList/Kitsu 항목도 상세 조회 시 fresh Korean fallback을 먼저 시도한다.
- 웹에서 상태 선택 `Alert`가 동작하지 않는 문제를 피하기 위해 콘텐츠 상세의 라이브러리 추가 UI를 인라인 상태 버튼으로 변경했다. 검색 결과 카드의 `추가` 버튼은 부모 카드 클릭으로 전파되지 않게 처리했다.
- 루트에 `.run/` 실행 구성과 Cursor용 `.vscode/tasks.json`을 추가했다.

## 설계서와 달라진 점

- `docs/08_frontend_architecture.md`는 `(tabs)/search`, `pins/new`를 제안하지만 이번 요청 구조에 맞춰 `app/search.tsx`, `app/pins/[id].tsx`에서 `id = "new"`를 생성 모드로 처리한다.
- `docs/06_backend_schema.sql` 원문 대비 migration에 `pgcrypto`, 일부 `updated_at` 컬럼/트리거, `timeline_pin_tags` 태그 소유자 RLS 검증, `idx_timeline_pins_content_episode_ts`를 추가했다. 이는 초기 사용자 요청의 필수 조건과 보안 요구를 맞추기 위한 보강이다.
- 초기 수동 `Database` 타입은 원격 Supabase 스키마에서 생성한 타입으로 교체했다. 이후 schema 변경 시 `supabase gen types typescript --linked --schema public` 결과를 다시 반영해야 한다.
- Jotai는 설계 문서에 등장하지만 이번 요청의 상태 관리 후보는 Zustand였으므로 Zustand stores만 구현했다.

## 확인 필요 사항

- Supabase 프로젝트 URL/anon key는 실제 값으로 채우지 않는다.
- `SUPABASE_SERVICE_ROLE_KEY`는 Edge Function secret으로만 설정해야 하며 Expo 앱 `.env`에 넣지 않는다.
- TMDB rate limit, AniList rate limit, Kitsu/TVmaze 응답 정책은 운영 전에 실제 API 문서와 호출 테스트로 검증이 필요하다.
- 2026-05-02 추가 확인: 사용자가 새 Supabase 프로젝트로 `.env`를 교체했고, 새 프로젝트에는 원격 migration 이력이 없었다. `0001_initial_schema.sql`을 원격 DB에 적용했고 `supabase db lint --linked --schema public`이 통과했다.
- Edge Functions 4개(`search-content`, `add-to-library`, `get-content-detail`, `fetch-episodes`)를 새 프로젝트에 배포했다.
- 로컬 Supabase는 Docker daemon 미실행으로 `supabase start`와 `db lint --local`을 완료하지 못했다.
- 현재 `.env`에는 Expo 앱용 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`도 설정되어 있고 Expo config에서 로드가 확인됐다.
- `TMDB_API_KEY`를 `.env`에 추가했고 Supabase Edge Function secret으로 설정 완료했다. AniList/Kitsu/TVmaze URL도 secret으로 설정되어 있다.
- 인증된 사용자 계정으로 전체 앱 E2E 검증은 아직 남아 있다. Supabase CLI 2.98.0에는 `functions invoke` 명령이 없어 앱 로그인 또는 `smoke:edge` 스크립트로 확인한다.
- Expo app icon/splash 이미지는 아직 설정하지 않았다.
- `npm audit fix`를 실행했지만 moderate 취약점 13개가 남았다. 남은 fix는 `expo@49.0.23`으로 내리는 breaking-change 경로라 `npm audit fix --force`는 적용하지 않았다.
- Expo web dev server는 `http://localhost:8081`에서 200 OK 응답을 확인했다. 일반 `expo start`도 네트워크 허용 상태에서는 Metro가 기동된다.

## 아직 mock 또는 placeholder인 부분

- `.env.example`의 Supabase URL/anon key와 외부 API 값.
- 프로필 회원 탈퇴는 안내 Alert만 표시한다. `delete-account` Edge Function 또는 운영 절차가 필요하다.
- 콘텐츠 상세의 검색 결과 snapshot은 외부 상세 API가 아닌 검색 결과 데이터를 기반으로 한다.
- My Page 통계는 count 쿼리 기반이며 상세 통계는 placeholder 수준이다.
- `search-content`, `add-to-library`, `get-content-detail`, `fetch-episodes`의 Kitsu/TVmaze 경로는 best-effort이며 운영 전 API 정책 검증이 필요하다.
- AniList/Kitsu/TVmaze는 한국어 메타데이터가 제한적이다. AniList/Kitsu는 TMDB 한국어 fallback을 시도하지만, 매칭 실패 시 영어/일본어가 섞일 수 있다.
- 이미 영어로 저장된 기존 `contents` 레코드는 자동 번역되지 않는다. 필요하면 메타데이터 refresh 플로우 또는 관리용 재동기화 SQL/Edge Function을 추가한다.
- 소셜 로그인, 비밀번호 재설정, 라이브러리 제거 플로우는 아직 미구현이다.
