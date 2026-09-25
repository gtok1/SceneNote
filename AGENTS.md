# AGENTS.md

## 작업 지시 문서 — 항상 먼저 읽기

작업을 시작하기 전에 아래 문서를 **반드시** 확인한다. 이 문서들이 화면·기능 구현의 source of truth이며, 이 파일의 규칙과 충돌하면 개별 명세서가 우선한다.

| 문서 | 내용 | 언제 읽나 |
|------|------|-----------|
| `docs/00_codex_doc_pattern.md` | 명세서 + Codex 프롬프트 짝의 작성 패턴·스켈레톤·체크리스트 | 새 명세서나 작업 지시문을 **쓰기 전에** |
| `docs/11_screen_implementation_spec.md` | MVP 전체 화면 구현·QA 기준안. 화면 명세 포맷의 원본 | 화면을 만들거나 고칠 때 항상 |
| `docs/12_episode_progress_spec.md` | 시청 진행 위치(몇 화까지 봤는지) 설정 기능 전체 명세 | 라이브러리·진행률·이어보기 관련 작업 |
| `docs/13_codex_prompt_episode_progress.md` | 위 기능의 Codex 작업 지시문 (복붙용 단일 프롬프트) | 위 기능을 구현할 때 |
| `docs/14_codex_prompt_episode_progress_fixes.md` | 위 구현의 검증 결과와 결함 5건(F-1~F-5) 수정 지시문 | 진행 위치 기능을 손볼 때 |
| `docs/15_season_search_spec.md` | 한국어 시즌 표기(`N기`/`시즌 N`) 검색 명세. AniList·TMDB 시즌 모델 차이와 SEQUEL 체인 해석 | 검색·외부 API 어댑터 관련 작업 |
| `docs/16_codex_prompt_season_search.md` | 위 기능의 Codex 작업 지시문 (복붙용 단일 프롬프트) | 위 기능을 구현할 때 |
| `docs/17_season_library_tracking_spec.md` | 시즌 단위 라이브러리 추적 명세. `user_library_items.season_number` 도입과 검색 시즌 펼치기 | 검색·등록·시즌 관련 작업 |
| `docs/18_codex_prompt_season_library_tracking.md` | 위 기능의 Codex 작업 지시문 (복붙용 단일 프롬프트) | 위 기능을 구현할 때 |
| `docs/26_recommendation_and_season_lookup_fixes_spec.md` | 코드 리뷰 결함 3건 명세. 추천 제공처 복구 보고(F-1)와 시즌 라이브러리 조회 폴백(F-2·F-3) | 추천 장애 보고·시즌 등록 상태 조회 관련 작업 |
| `docs/27_excluded_relationship_themes_spec.md` | 추천 피드에서 BL·GL·백합·퀴어 테마 작품을 하드 제외하는 명세. 테마 별칭 확장과 서버·클라이언트 이중 적용 | 추천 후보 필터·테마 분류 관련 작업 |
| `docs/28_recommendation_scroll_pagination_fixes_spec.md` | 추천 피드 스크롤 추가 로딩과 카드 액션 정렬 회귀 수정 명세 | 검색 추천 피드·추천 카드 화면 작업 |
| `docs/29_codex_prompt_recommendation_scroll_pagination_fixes.md` | 위 회귀 수정의 Codex 작업 지시문 | 위 결함을 구현할 때 |
| `docs/30_recommendation_fill_and_action_consistency_fixes_spec.md` | 추천 12개 미달·탐색 시간 초과와 카드 세 번째 행동 아이콘 노출 재수정 명세 | 검색 추천 보충·카드 행동 작업 |
| `docs/31_usability_review_fixes_spec.md` | 사용성 검토 결함 U-1~U-11. 모바일 핀 열기, 라이브러리 삭제 확인, 회차·시즌 장면순 정렬, 핀 상세 편집/삭제 이동, 에피소드 다음 회차 스크롤, 태그 제안 | 핀 탭·핀 작성·작품 상세·에피소드 목록 작업 |

**규칙**

- `docs/NN_*_spec.md`는 사람이 읽는 명세서, `docs/NN_codex_prompt_*.md`는 에이전트가 그대로 실행하는 지시문이다. 두 파일은 항상 짝으로 존재한다.
- 명세서의 **설계 결정(D-N) 항목은 임의로 바꾸지 않는다.** 바꿔야 한다고 판단되면 구현하지 말고 이유를 보고한다.
- 명세서에 테스트 표가 있으면 표의 모든 행을 테스트로 옮긴다. 임의로 줄이지 않는다.

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
- Codex/AI 세션에서 Expo 웹 서버를 재기동하거나 검증용으로 띄울 때는 반드시 `8081` 포트만 사용한다.
- 재기동 명령은 `npm run web -- --port 8081 --localhost --clear`를 기본으로 하고, 임의의 다른 포트로 새 서버를 띄우지 않는다.
- `8081` 포트가 이미 사용 중이면 다른 포트로 우회하지 말고 기존 8081 서버를 확인하거나 종료 후 같은 포트로 다시 띄운다.

## 테스트 명령어

- `npm test` — `tsx --test`로 `src/**/*.test.ts`, `scripts/**/*.test.ts`, `supabase/functions/**/*.test.ts` 실행
- `npm run typecheck`
- `npm run lint`

테스트는 `node:test` + `node:assert/strict`를 쓴다. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다** — 순수 함수만 테스트한다. 참고: `src/utils/pinCache.test.ts`

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
