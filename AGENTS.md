# AGENTS.md

## 프로젝트 개요

SceneNote는 애니메이션, 한국 드라마, 일본 드라마, 영화 감상 기록을 관리하고 특정 장면에 타임라인 핀을 남기는 모바일 앱이다. 핵심 가치는 검색이 아니라 개인 감상 기록과 `timestamp_seconds` 기반 핀 경험이다. 상세 설계는 `docs/`의 01~10 문서를 우선 참고한다.

## 기술 스택

- Expo + React Native + Expo Router
- TypeScript strict mode
- Supabase Auth, PostgreSQL, RLS, Edge Functions
- TanStack Query v5
- Zustand
- React Hook Form + Zod
- FlashList

## 핵심 설계 원칙

- 외부 API 키는 프론트엔드에 노출하지 않는다.
- TMDB, AniList, Kitsu, TVmaze 호출은 Supabase Edge Function을 경유한다.
- 콘텐츠 메타데이터와 사용자 기록 데이터를 분리한다.
- 사용자 기록 테이블은 RLS-first로 설계한다.
- 핀 저장값은 문자열이 아니라 정수 초 `timestamp_seconds`다.
- 영화 핀은 가상 에피소드 없이 `episode_id = NULL`로 처리한다.
- 같은 에피소드와 같은 시간대의 복수 핀을 허용한다.

## 실행 명령어

- `npm install`
- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`

## 테스트 명령어

- `npm run typecheck`
- `npm run lint`
- 테스트 프레임워크가 추가되면 `npm test`

## 코드 스타일

- TypeScript 타입을 명확히 작성한다.
- 서버 데이터는 TanStack Query, UI 상태는 Zustand로 관리한다.
- 불확실한 외부 API 동작은 TODO와 문서에 남긴다.
- 큰 리팩터링보다 설계 문서에 맞는 작은 구현 단위를 선호한다.

## Supabase 주의사항

- `contents`, `content_external_ids`, `content_titles`, `seasons`, `episodes`는 authenticated read, service_role write다.
- `user_library_items`, `user_episode_progress`, `timeline_pins`, `tags`, `timeline_pin_tags`, `profiles`는 본인 데이터만 접근 가능해야 한다.
- `external_search_cache`, `metadata_sync_logs`는 일반 클라이언트 직접 접근을 허용하지 않는다.
- service_role key는 Edge Function secret으로만 사용한다.

## 외부 API 키 보안 원칙

- Expo 앱에는 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`만 둔다.
- `TMDB_API_KEY` 등 외부 API secret은 Edge Function 환경변수로만 설정한다.
- 실제 키를 코드, 문서, `.env.example`에 넣지 않는다.

## MVP 범위

- 이메일 인증
- 콘텐츠 검색
- 라이브러리 추가와 감상 상태 관리
- 에피소드 진행률
- 타임라인 핀 생성/조회/수정/삭제
- 태그, 감정, 스포일러 처리

## 금지사항

- `docs/`와 `.claude/` 삭제 또는 덮어쓰기 금지
- 외부 API 키 하드코딩 금지
- service_role key를 Expo 앱에 포함 금지
- RLS 없는 사용자 데이터 테이블 추가 금지
- 영화용 더미 에피소드 생성 금지
- 검색 결과를 `contents`에 bulk 저장 금지
- destructive command, 대규모 삭제, `git reset`, 강제 overwrite 금지
