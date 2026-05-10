# SceneNote Development Next Steps

작성일: 2026-05-02

## 다음 개발자가 바로 이어서 할 일

1. 원격 DB에는 `0001_initial_schema.sql` 적용 완료. 이후 schema 변경은 새 migration 파일로 추가한다.
2. `search-content`, `add-to-library`, `get-content-detail`, `fetch-episodes` 배포 완료. 인증된 사용자로 호출 테스트한다.
3. Supabase generated type은 `src/types/database.ts`에 반영했고 `src/lib/supabase.ts`에 제네릭도 연결했다. schema 변경 후에는 다시 생성한다.
4. 검색 → 라이브러리 추가 → 에피소드 로드 → 핀 생성 E2E를 실제 Supabase 프로젝트에서 검증한다.
5. 앱 아이콘/splash, 비밀번호 재설정, 라이브러리 제거 플로우를 후속 구현한다.

## Supabase 프로젝트 연결 순서

1. Supabase Dashboard에서 새 프로젝트 생성.
2. Project Settings > API에서 Project URL과 anon public key 확인.
3. 로컬에 `.env` 또는 `.env.local` 생성:

```bash
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. service role key는 Expo 앱에 넣지 말고 Edge Function secret으로만 설정.

현재 `.env`에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`만 있다면 Expo 앱용으로 아래 두 줄도 같은 public 값으로 추가해야 한다:

```bash
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 환경변수 설정 방법

Expo 앱:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Supabase Edge Function secrets:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set TMDB_API_KEY=your-tmdb-api-key
supabase secrets set ANILIST_API_URL=https://graphql.anilist.co
supabase secrets set KITSU_API_URL=https://kitsu.io/api/edge
supabase secrets set TVMAZE_API_URL=https://api.tvmaze.com
```

인증된 Edge Function smoke test용 선택값:

```bash
SCENENOTE_TEST_EMAIL=qa@example.com
SCENENOTE_TEST_PASSWORD=qa-password
```

## Migration 적용 방법

```bash
supabase link --project-ref your-project-ref
supabase db push --dry-run
supabase db push
```

또는 Supabase SQL Editor에서 `supabase/migrations/0001_initial_schema.sql` 내용을 실행한다.

주의: 이전 Supabase 프로젝트에는 로컬에 없는 migration 이력이 있었다. 현재는 새 SceneNote 프로젝트에 연결되어 `0001` 적용이 완료됐다. 나중에 다른 프로젝트로 바꿀 때 `db push --dry-run`이 원격 migration 누락을 보고하면 바로 push하지 말고 먼저 reconcile한다:

```bash
supabase migration list
supabase db pull
```

## Edge Function 배포 방법

```bash
supabase functions deploy search-content
supabase functions deploy add-to-library
supabase functions deploy get-content-detail
supabase functions deploy fetch-episodes
```

배포는 완료됐고 `TMDB_API_KEY`도 Supabase Edge Function secret으로 설정 완료했다. 키를 교체해야 할 때는 아래 명령을 다시 실행한다:

```bash
supabase secrets set TMDB_API_KEY=your-tmdb-key
```

## 앱 실행 방법

```bash
npm install
npm run start
npm run web
```

현재 Expo web dev server는 `http://localhost:8081`에서 기동 확인됐다. 브라우저 확인이 목적이면 `npm run web -- --port 8081 --localhost`를 사용한다.

Cursor에서는 Command Palette > `Tasks: Run Task`에서 아래 작업을 실행할 수 있다:

- `Frontend: Expo Web`
- `Frontend: Expo Native`
- `Backend: Supabase Functions Serve`
- `Backend: Supabase Functions Deploy`
- `Quality: Typecheck Lint Test`

JetBrains 계열 IDE에서는 루트의 `.run/` 아래 실행 구성을 사용할 수 있다.

검증 명령어:

```bash
npm run typecheck
npm run lint
npm test
npx expo config --type public
npm run smoke:edge -- "Inception" movie
```

`smoke:edge`는 `.env` 또는 `.env.local`의 Supabase public 값과 `SCENENOTE_TEST_EMAIL`/`SCENENOTE_TEST_PASSWORD`로 로그인한 뒤 `search-content`를 호출한다. 실제 사용자 비밀번호 대신 전용 테스트 계정을 사용한다.

## QA 체크리스트

- 이메일 회원가입/로그인 후 세션 유지 확인.
- 인증 전 탭 화면 접근 차단 확인.
- `search-content`가 TMDB/AniList 결과를 반환하고 partial 실패를 표시하는지 확인.
- 라이브러리 추가 Edge Function 중복 추가 방지 확인.
- 시즌/에피소드 lazy load 후 진행률 체크/해제 확인.
- 핀 생성 시 `timestamp_seconds >= 0` 검증 확인.
- 타임스탬프와 메모가 모두 비어 있으면 저장 차단 확인.
- 동일 에피소드/동일 시간대 복수 핀 허용 확인.
- 스포일러 핀이 기본 가림 처리되고 보기 버튼으로 해제되는지 확인.
- 다른 사용자 데이터 접근이 RLS로 차단되는지 실제 계정 2개로 검증.
- 영화 핀은 `episode_id = NULL`로 저장되는지 확인.
- npm audit에 남은 moderate 취약점은 Expo SDK 호환성을 깨지 않는 업데이트 경로가 나올 때 재검토한다.
- 한글 메타데이터 QA: TMDB 검색 결과가 한국어 제목/개요로 표시되는지 확인한다. AniList/Kitsu는 TMDB 한국어 fallback을 시도하지만, TVmaze는 한국어 지원이 제한적이므로 영어가 섞일 수 있다.
- 기존에 영어로 저장된 콘텐츠가 있으면 관리용 메타데이터 refresh 기능을 추가하거나 해당 콘텐츠를 재동기화한다.
