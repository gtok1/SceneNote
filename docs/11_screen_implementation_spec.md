# SceneNote MVP 화면 구현 명세서

**문서 버전:** 1.0.0
**작성일:** 2026-08-19
**상태:** 구현·QA 기준안
**대상:** Product, Design, React Native, Backend, QA
**핵심 원칙:** 검색은 기록을 시작하기 위한 도구이며, 제품의 중심은 개인 감상 기록과 타임라인 핀이다.

---

## 1. 프로젝트 개요

### 1.1 문서 목적

이 문서는 기존 제품·기술 문서와 현재 코드를 함께 감사한 결과를 바탕으로, SceneNote MVP 화면을 개발자가 구현하고 QA가 바로 검증할 수 있는 수준으로 정의한다. 현재 구현을 그대로 설명하는 문서가 아니라, MVP 출시를 위한 **목표 상태**와 화면 간 계약을 정의한다.

근거 문서는 [PRD](./01_product_requirements.md), [유저 스토리](./02_user_stories.md), [화면 흐름](./03_screen_flow.md), [아키텍처](./04_architecture.md), [ERD/RLS](./05_erd_rls.md), [백엔드 스키마](./06_backend_schema.sql), [Edge Function 설계](./07_edge_functions.md), [프론트엔드 아키텍처](./08_frontend_architecture.md), [핀 UX](./09_timeline_pin_ux.md), [MVP 통합 계획](./10_mvp_integration_plan.md)이다. 현재 구현 근거는 [라우트](../app), [공통 Query Key](../src/lib/query.ts), [핀 훅](../src/hooks/useTimelinePins.ts), [라이브러리 훅](../src/hooks/useLibrary.ts)을 기준으로 삼았다.

### 1.2 MVP 범위

**포함**

- 이메일 회원가입·로그인·비밀번호 재설정·세션 유지
- 외부 콘텐츠 검색, 20건 단위 페이지네이션, 콘텐츠 상세
- 라이브러리 추가, 네 가지 감상 상태 관리: `wishlist`, `watching`, `completed`, `dropped`
- 시즌·에피소드 조회 및 에피소드 완료 진행률
- 타임라인 핀 생성·조회·수정·삭제
- 핀의 시간값, 메모, 태그, 감정, 스포일러 처리
- 작품별·에피소드별·태그별 핀 조회
- 기본 프로필, 최소 통계, 로그아웃, 회원 탈퇴

**명시적 제외**

- 추천·유사 작품·취향 추천: **[MVP 제외 — Post-launch 검토]**
- 공유·공개 링크·취향 카드·핀 이미지 공유: **[MVP 제외 — Post-launch 검토]**
- 배우·성우·좋아하는 인물: **[MVP 제외 — Post-launch 검토]**
- 평점·한줄평·리뷰: **[MVP 제외 — Post-launch 검토]**
- 엑셀 대량 가져오기·사진 가져오기: **[MVP 제외 — Post-launch 검토]**
- Highlight Reel(명장면 모음), 소셜, 알림, Export, 다크 모드, 시청 회차: **[MVP 제외 — Post-launch 검토]**
- Kitsu·TVmaze 활성 연동, cross-API 자동 canonical 통합: **[MVP 제외 — Post-launch 검토]**

현재 코드에 존재하는 위 기능은 삭제 여부와 무관하게 MVP 내비게이션과 핵심 CTA에서 노출하지 않는다. 관련 경로 예시는 [인물 탭](<../app/(tabs)/people.tsx>), [공유 경로](../app/share), [대량 가져오기](../app/library/import.tsx), [사진 가져오기](../app/library/photo-import.tsx), [추천 제외 설정](../app/settings/excluded-recommendations.tsx)이다. 단순히 링크만 숨기지 않고 route feature flag와 서버 배포 경계를 함께 차단한다. 이미 발급된 공개 공유 링크의 유지·만료·회수 정책은 **[확인 필요]**이며, 정책 확정 전 신규 공유 발급을 허용하지 않는다.

### 1.3 출시 품질 기준

1. 인증 사용자가 검색 → 라이브러리 추가 → 에피소드 선택 → 핀 생성 → 목록 확인 → 수정·삭제를 중단 없이 완료한다.
2. 핀 메모는 스포일러 해제 전까지 홈 요약, 리스트, 타임라인, 태그 결과, 상세 패널과 상세 화면 모두에서 노출되지 않는다.
3. 유효하지 않은 비어 있지 않은 시간값은 빈 시간값과 절대 동일하게 취급하지 않는다.
4. 에피소드 길이가 존재하면 생성과 편집 모두 서버에서 조회한 최신 길이로 초과 입력을 차단한다.
5. 사용자 소유 데이터는 RLS로 다른 계정에서 조회·변경할 수 없다.
6. 모든 인터랙티브 요소의 최소 터치 영역은 44×44pt이다.

---

## 2. 충돌·불일치 및 코드 감사 결과

| 우선순위 | 항목                                                                             | 현재 근거                                                                                                                                                                                                                                                                                                                                                          | 목표 결정                                                                                                                                                                                                                                                               |
| -------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | 하단 내비게이션이 상세·작성 화면에도 표시됨                                      | 전역 렌더링: [`app/_layout.tsx`](../app/_layout.tsx), 탭 자체는 숨김: [`app/(tabs)/_layout.tsx`](<../app/(tabs)/_layout.tsx>)                                                                                                                                                                                                                                      | 하단 내비게이션은 `(tabs)` 화면에서만 표시한다. `/content/*`, `/pins/new`, `/pins/[id]`, 인증 화면과 모달에서는 숨긴다.                                                                                                                                                 |
| P0       | 비어 있지 않은 잘못된 시간값과 빈 값이 모두 `null`로 파싱됨                      | [`parseTimecodeToSeconds`](../src/utils/timecode.ts), [`PinComposer`](../src/components/pins/PinComposer.tsx)                                                                                                                                                                                                                                                      | `raw = ""`만 빈 값이다. `raw.trim() !== "" && parse = null`은 `invalid_nonempty` 오류로 저장을 차단한다.                                                                                                                                                                |
| P0       | 생성은 URL의 `duration`, 편집은 길이 없이 검증                                   | [`app/pins/new.tsx`](../app/pins/new.tsx), [`app/pins/[id].tsx`](../app/pins/[id].tsx)                                                                                                                                                                                                                                                                             | 생성·편집 모두 `episode_id`로 서버의 `episodes.duration_seconds`를 조회한다. URL 길이는 신뢰하지 않는다. 저장 직전에도 최신 서버값 기준 검증 계약을 유지한다. **[확인 필요][Tech Lead 검토 필요]** 권위 검증을 RPC/DB 함수/Edge Function 중 어디에서 보장할지 결정한다. |
| P0       | 스포일러가 일부 타임라인·상세 편집 폼에서 즉시 노출될 수 있음                    | [`app/(tabs)/pins.tsx`](<../app/(tabs)/pins.tsx>), [`app/pins/[id].tsx`](../app/pins/[id].tsx)                                                                                                                                                                                                                                                                     | 리스트·타임라인·상세 패널·상세 화면 모두 기본 가림. 편집 진입은 명시적 액션이며 그 이후에만 원문을 표시한다. 접근성 트리에서도 가린 메모를 제외한다.                                                                                                                    |
| P0       | 시즌 선택이 작품 구분 없는 단일 전역 상태                                        | [`episodeSelectionStore`](../src/stores/episodeSelectionStore.ts), [`episodes.tsx`](../app/content/[id]/episodes.tsx)                                                                                                                                                                                                                                              | 선택 시즌은 `contentId`별로 분리하거나 화면 로컬 상태로 둔다. 다른 작품 진입 시 해당 작품의 유효한 시즌으로 초기화한다.                                                                                                                                                 |
| P0       | 일반 작품 검색이 첫 페이지만 표시                                                | [`useContentSearch`](../src/hooks/useContentSearch.ts), [`app/search.tsx`](../app/search.tsx)                                                                                                                                                                                                                                                                      | 20건 단위 다음 페이지 로드, 중복 페이지 병합 방지, 페이지별 재시도, 종료 상태를 제공한다. 추천 피드의 추가 로드는 MVP 검색 페이지네이션으로 간주하지 않는다.                                                                                                            |
| P0       | 검색 캐시가 페이지 메타데이터를 버려 캐시 적중 시 다음 페이지가 사라짐           | 캐시는 `results`만 저장하고 응답의 `hasNextPage`는 fresh 응답만 계산: [`search-content`](../supabase/functions/search-content/index.ts)                                                                                                                                                                                                                            | 캐시에 `results`, `total`, `hasNextPage`를 함께 저장한다. cached/fresh 응답을 같은 타입으로 병합하고 캐시 적중·미적중의 페이지 종료 결과가 동일한지 회귀 테스트한다.                                                                                                    |
| P0       | 기본 검색 화면이 MVP 제외 추천을 호출하지만 원격 DB는 관련 마이그레이션이 누락됨 | 기본 피드: [`app/search.tsx`](../app/search.tsx), 테이블 참조: [`personalized-recommendations`](../supabase/functions/personalized-recommendations/index.ts), 로컬 전용 [`0017`](../supabase/migrations/0017_user_content_feedback.sql)·[`0018`](../supabase/migrations/0018_content_themes.sql)·[`0019`](../supabase/migrations/0019_backfill_content_themes.sql) | MVP에서는 빈 검색 상태의 추천 호출과 CTA를 제거한다. 추천을 유지하기로 범위를 바꾸면 `0017 → 0018 → 0019`, 타입 재생성, Function 배포, 인증 smoke test를 순서대로 통과하기 전 출시 금지. **[확인 필요]**                                                                |
| P0       | 핀 삭제 후 일부 캐시만 갱신                                                      | [`useDeletePin`](../src/hooks/useTimelinePins.ts), [Query Key](../src/lib/query.ts)                                                                                                                                                                                                                                                                                | 단건, 전체, 작품별, 에피소드별, 태그별, 프로필 통계, 라이브러리 핀 수, 홈 최근 핀 캐시를 일관되게 제거·무효화한다. 실패 시 삭제 전 상태를 복구한다.                                                                                                                     |
| P0       | 라이브러리 제거 시 기록 처리 문서와 코드가 상충                                  | [US-023](./02_user_stories.md), [데이터 무결성](./07_edge_functions.md), [`deleteLibraryItem`](../src/services/library.ts)                                                                                                                                                                                                                                         | 핀·진행률을 보존할지 함께 삭제할지 **[확인 필요]**. 결정 전에는 삭제 문구와 실제 동작을 확정하지 않으며, 출시 빌드에서 제거 CTA를 비활성 또는 숨긴다.                                                                                                                   |
| P1       | 모바일에서도 핀 상세 패널이 항상 함께 렌더링됨                                   | [`app/(tabs)/pins.tsx`](<../app/(tabs)/pins.tsx>)                                                                                                                                                                                                                                                                                                                  | 모바일은 단일 열 목록/타임라인만 사용한다. 상세 패널은 tablet 이상에서만 표시한다.                                                                                                                                                                                      |
| P1       | 36~42pt 인터랙션이 혼재                                                          | [`EpisodeSelector`](../src/components/content/EpisodeSelector.tsx), [`SeasonSelector`](../src/components/content/SeasonSelector.tsx), [`PinTimelineItem`](../src/components/pins/PinTimelineItem.tsx)                                                                                                                                                              | 시각 크기가 작아도 `hitSlop`을 포함한 실제 터치 영역은 44×44pt 이상으로 통일한다.                                                                                                                                                                                       |
| P1       | 검색이 제목 결과를 cross-API로 자동 병합                                         | [`mergeSearchResults`](../app/search.tsx)                                                                                                                                                                                                                                                                                                                          | MVP에서는 자동 canonical 병합을 하지 않는다. 출처별 카드를 모두 유지하고 사용자가 선택한 출처를 저장 기준으로 삼는다.                                                                                                                                                   |
| P1       | 핀 저장과 태그 교체가 여러 클라이언트 요청으로 분리됨                            | [`createPin`](../src/services/pins.ts), [`updatePin`](../src/services/pins.ts), [`replacePinTags`](../src/services/tags.ts)                                                                                                                                                                                                                                        | 핀과 태그 연결을 하나의 트랜잭션 RPC로 저장한다. 생성 재시도 중복과 수정 실패 시 기존 태그 유실을 막고 idempotency 정책을 둔다.                                                                                                                                         |
| P1       | `status`와 `status_flags`가 필터·통계에서 서로 다른 source of truth              | [`user_library_items`](../supabase/migrations/0002_library_status_flags.sql), [라이브러리 서비스](../src/services/library.ts)                                                                                                                                                                                                                                      | MVP 화면은 상호 배타적인 단일 `status`만 기준으로 읽고 쓴다. `status_flags` 유지·백필·제거 전략은 마이그레이션 전에 **[확인 필요][Tech Lead 검토 필요]**다.                                                                                                             |
| P1       | 홈·검색·프로필·상세가 범위 밖 기능을 핵심 영역에 노출                            | [홈](<../app/(tabs)/index.tsx>), [검색](../app/search.tsx), [프로필](<../app/(tabs)/profile.tsx>), [상세](../app/content/[id].tsx)                                                                                                                                                                                                                                 | 추천·공유·인물·리뷰·가져오기를 MVP 화면에서 제거하고 기록·핀 CTA에 우선순위를 준다.                                                                                                                                                                                     |
| P1       | 설계 문서의 인증 정책과 가입 화면 상태가 다를 수 있음                            | [MVP 통합 계획](./10_mvp_integration_plan.md), [가입 화면](<../app/(auth)/sign-up.tsx>), [로컬 Auth 설정](../supabase/config.toml)                                                                                                                                                                                                                                 | MVP는 이메일 확인 없이 즉시 세션 발급을 기준으로 한다. 배포 Supabase 설정 일치 여부는 출시 전 **[확인 필요]**.                                                                                                                                                          |
| P0       | 원격 `delete-account` 호출이 404를 반환                                          | 클라이언트 호출: [`src/services/account.ts`](../src/services/account.ts), 로컬 함수: [`supabase/functions/delete-account/index.ts`](../supabase/functions/delete-account/index.ts)                                                                                                                                                                                 | 원격 배포·라우팅·프로젝트 환경 연결을 확인하고 전용 테스트 계정으로 성공 smoke test를 통과하기 전 출시 금지. 404 원문은 사용자에게 노출하지 않고 세션과 데이터를 유지한 채 재시도 안내를 표시한다.                                                                      |
| P0       | TMDB v3 `api_key`가 query에 포함된 전체 URL이 오류·로그로 노출될 수 있음         | [`search-content` TMDB adapter](../supabase/functions/search-content/adapters/tmdb.ts), [공통 외부 콘텐츠 호출](../supabase/functions/_shared/externalContent.ts)                                                                                                                                                                                                  | 외부 API 오류 응답·로그에 전체 query URL, `api_key`, Authorization, provider 원문 body를 남기지 않는다. 비밀값 redaction 회귀 테스트 전 출시 금지. **[Tech Lead 검토 필요]**                                                                                            |
| P0       | Edge Functions가 앱 typecheck/lint에서 제외되고 별도 Deno 검사에서 8개 오류      | 제외 설정: [`tsconfig.json`](../tsconfig.json), [`eslint.config.js`](../eslint.config.js); 함수 소스: [`supabase/functions`](../supabase/functions)                                                                                                                                                                                                                | `backend:typecheck`와 고정 버전 import/lock을 CI 필수 단계로 추가하고 오류 0건 전에는 Function을 배포하지 않는다.                                                                                                                                                       |
| P1       | Expo가 읽는 루트 `.env`에 backend/admin secret도 함께 놓일 수 있음               | 예시·스크립트: [`.env.example`](../.env.example), [`package.json`](../package.json)                                                                                                                                                                                                                                                                                | Expo가 읽는 환경에는 두 `EXPO_PUBLIC_*` 값만 둔다. service role, Supabase access token·DB password, TMDB 키는 별도 ignored Edge/CLI 환경으로 분리하고 번들 secret 부재를 자동 검사한다.                                                                                 |
| P1       | 제외 기능의 취약한 워크북 파서와 영구 공개 공유 경로가 빌드에 남음               | [`xlsx` 의존성](../package.json), [워크북 파서](../src/utils/netflixBulkWorkbook.ts), [공유 경로](../app/share)                                                                                                                                                                                                                                                    | MVP 번들·route에서 제외한다. 추후 활성화 시 유지보수되는 파서, 파일 크기 제한, 공유 기본 만료·목록·회수·rate limit을 먼저 구현한다.                                                                                                                                     |

---

## 3. 용어 사전

| 용어                      | 정의·표기 규칙                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 콘텐츠                    | 애니메이션, 한국 드라마, 일본 드라마, 영화 메타데이터. UI에서는 문맥상 자연스러울 때만 “작품”을 병용한다.                                |
| 라이브러리                | 사용자가 기록 대상으로 선택한 콘텐츠의 개인 목록. `user_library_items`와 대응한다.                                                       |
| 감상 상태                 | `wishlist` 보고 싶음 / `watching` 보는 중 / `completed` 완료 / `dropped` 드랍. 다른 상태는 MVP에서 노출하지 않는다.                      |
| 핀                        | 특정 콘텐츠·에피소드의 시간 또는 메모에 연결한 개인 기록. “마커”라는 용어를 쓰지 않는다.                                                 |
| 시간값                    | 사용자가 입력·보는 `MM:SS` 또는 `HH:MM:SS`. 저장값은 `timestamp_seconds` 정수 초다.                                                      |
| 시간 미지정 핀            | `timestamp_seconds = null`이고 비어 있지 않은 메모가 있는 핀. 정렬 시 시간 지정 핀 뒤에 둔다.                                            |
| `invalid_nonempty` 시간값 | 원문이 비어 있지 않지만 지원 형식으로 파싱되지 않는 입력. `null`로 저장하지 않고 오류 처리한다.                                          |
| 스포일러 가림             | 원문 메모를 시각 UI와 접근성 트리 모두에서 제외하고 “스포일러 포함 · 보기” 대체 UI를 제공하는 상태.                                      |
| 서버 런타임               | `episodes.duration_seconds`에서 조회한 에피소드 길이. 라우트 파라미터나 화면 표시 문자열은 권위 데이터가 아니다.                         |
| API 출처                  | TMDB, AniList 등 검색 결과를 제공한 외부 서비스. 검색 카드에 항상 표시한다.                                                              |
| canonical 선택            | MVP에서는 동일 작품 후보 중 사용자가 선택해 라이브러리에 추가한 API 출처가 해당 저장 레코드의 기준 출처가 되는 것. 자동 통합하지 않는다. |
| 로딩                      | 최초 데이터가 없고 요청 중인 상태.                                                                                                       |
| 갱신 중                   | 기존 데이터가 보이는 상태에서 백그라운드 재조회 중인 상태. 기존 콘텐츠를 가리지 않는다.                                                  |
| 오프라인                  | 네트워크가 없으나 캐시를 읽을 수 있는 상태. MVP는 오프라인 쓰기 큐를 제공하지 않는다.                                                    |

---

## 4. 최종 화면 목록

### 4.1 탭 구조

MVP 하단 탭은 **홈 / 검색 / 라이브러리 / 핀 / 프로필** 다섯 개다. 검색은 기록 시작을 위한 유틸리티로 유지하되, 홈의 첫 콘텐츠는 최근 핀과 보는 중 기록으로 구성한다. 인물 탭은 제거한다.

| 화면 ID  | 화면명            | Route                                                         | 탭/Stack                        | MVP                               |
| -------- | ----------------- | ------------------------------------------------------------- | ------------------------------- | --------------------------------- |
| SCR-001  | 온보딩            | `/onboarding`                                                 | Auth Stack                      | Yes                               |
| SCR-002  | 이메일 인증       | `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` | Auth Stack                      | Yes                               |
| SCR-003  | 홈                | `/`                                                           | Tab                             | Yes                               |
| SCR-003L | 라이브러리        | `/library`                                                    | Tab                             | Yes                               |
| SCR-004  | 콘텐츠 검색       | `/search` 검색 전 상태                                        | Tab                             | Yes                               |
| SCR-005  | 검색 결과         | `/search` 검색 후 상태                                        | Tab                             | Yes                               |
| SCR-006  | 콘텐츠 상세       | `/content/[id]` 외부 결과 모드                                | Stack                           | Yes                               |
| SCR-007  | 라이브러리에 추가 | SCR-006 바텀 시트                                             | Modal                           | Yes                               |
| SCR-008  | 내 기록 상세      | `/content/[id]` 라이브러리 모드                               | Stack                           | Yes                               |
| SCR-009  | 에피소드 선택     | `/content/[id]/episodes`                                      | Stack                           | Yes, 시리즈 전용                  |
| SCR-010A | 핀 생성           | `/pins/new`                                                   | Stack                           | Yes                               |
| SCR-010B | 핀 상세·편집      | `/pins/[id]`                                                  | Stack                           | Yes                               |
| SCR-011  | 핀 목록           | `/pins`, `/content/[id]/pins`                                 | Tab/Stack                       | Yes                               |
| SCR-012  | Highlight Reel    | 경로 없음                                                     | 없음                            | **[MVP 제외 — Post-launch 검토]** |
| SCR-013  | 태그별 핀 목록    | `/pins?tagId=:tagId`                                          | SCR-011의 주소 가능한 필터 상태 | Yes, 최소 범위                    |
| SCR-014  | 프로필            | `/profile`                                                    | Tab                             | Yes                               |

### 4.2 내비게이션 노출 규칙

- `(tabs)` 그룹의 루트 다섯 화면에서만 하단 탭을 보인다.
- `/content/*`, `/pins/new`, `/pins/[id]`, 인증 화면, 바텀 시트에서는 하단 탭을 숨긴다.
- Stack 화면은 시스템 뒤로 가기와 헤더 뒤로 가기가 동일한 이전 컨텍스트로 복귀해야 한다.
- 딥링크로 진입해 이전 화면이 없으면 안전한 상위 화면으로 이동한다: 콘텐츠 → 라이브러리, 핀 → 핀 탭, 인증 성공 → 홈.

---

## 5. 데이터 모델 요약

세부 스키마와 RLS는 [ERD/RLS](./05_erd_rls.md)와 [백엔드 스키마](./06_backend_schema.sql)를 따른다. 화면은 아래 데이터 계약 외의 범위 밖 컬럼을 MVP 기능으로 노출하지 않는다.

| 데이터                  | 화면 사용                   | 핵심 계약                                     | 접근                                   |
| ----------------------- | --------------------------- | --------------------------------------------- | -------------------------------------- |
| `profiles`              | SCR-014                     | 본인 표시 이름·기본 프로필                    | 본인 R/W                               |
| `contents`              | SCR-003~011                 | 사용자가 선택한 콘텐츠만 내부 저장            | authenticated read, service role write |
| `content_external_ids`  | SCR-005~007                 | 출처+외부 ID 식별, 동일 외부 레코드 중복 방지 | authenticated read, service role write |
| `seasons`               | SCR-008~009                 | 콘텐츠별 시즌 목록                            | authenticated read, service role write |
| `episodes`              | SCR-009~010                 | 에피소드 번호·제목·`duration_seconds`         | authenticated read, service role write |
| `user_library_items`    | SCR-003, 003L, 006~009, 014 | 본인 콘텐츠와 네 가지 감상 상태               | 본인 R/W                               |
| `user_episode_progress` | SCR-003, 008~009, 014       | 에피소드 완료 여부                            | 본인 R/W                               |
| `timeline_pins`         | SCR-003, 008, 010~014       | 콘텐츠·에피소드·정수 초·메모·감정·스포일러    | 본인 R/W                               |
| `tags`                  | SCR-010~014                 | 사용자별 태그 이름, 최대 20자                 | 본인 R/W                               |
| `timeline_pin_tags`     | SCR-010~013                 | 핀과 태그 N:M                                 | 핀 소유자만 R/W                        |
| `external_search_cache` | SCR-004~006 간접            | 화면 직접 접근 금지                           | service role only                      |

필수 데이터 제약은 다음과 같다.

1. 영화 핀은 더미 에피소드 없이 `episode_id = null`이다.
2. `timestamp_seconds`와 비어 있지 않은 `memo` 중 하나는 반드시 존재한다.
3. `timestamp_seconds >= 0`이며 정수다.
4. 동일 사용자·에피소드·시간에 여러 핀을 허용하며 UNIQUE 제약을 두지 않는다.
5. 동일 시간 정렬은 `created_at ASC`이고, 완전한 결정성을 위해 마지막 동점은 `id ASC`로 표시한다.
6. 메모는 최대 500자, 태그는 핀당 최대 10개, 각 태그는 최대 20자다.
7. `episodes(season_id, content_id)`, `user_episode_progress(episode_id, content_id)`, `timeline_pins(episode_id, content_id)`는 같은 콘텐츠 관계를 DB 복합 FK 또는 동등한 제약으로 보장한다. 기존 데이터 검증 후 `NOT VALID → VALIDATE CONSTRAINT` 순서를 사용한다. **[Tech Lead 검토 필요]**
8. MVP 감상 상태의 source of truth는 단일 `user_library_items.status`다. `status_flags`가 남아 있는 동안 필터·통계가 서로 다른 컬럼을 읽지 않도록 호환 계층을 한 곳에 둔다. **[확인 필요][Tech Lead 검토 필요]**
9. 핀 본문과 `timeline_pin_tags` 변경은 하나의 트랜잭션으로 성공하거나 모두 실패해야 한다.

---

## 6. API·Edge Function 및 캐시 계약

| 기능                 | 호출 경계                              | 주요 테이블                                              | 성공 후 화면 캐시 계약                                                                                                         |
| -------------------- | -------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 이메일 인증          | Supabase Auth                          | `auth.users`, `profiles`                                 | 로그인 성공 시 사용자 범위 Query 활성화. 로그아웃·탈퇴 시 사용자 Query 캐시 제거                                               |
| 검색                 | `search-content`                       | `external_search_cache` 간접                             | `(query, mediaType, page)` 페이지 캐시. `results`와 `hasNextPage`·`total`을 함께 저장하며, 필터/검색어 변경 시 page 1부터 시작 |
| 외부 상세            | `get-content-detail`                   | 내부 콘텐츠가 있으면 `contents` 등                       | 상세 캐시 10분. 실패 시 검색 카드의 최소 메타데이터를 읽기 전용으로 표시 가능                                                  |
| 라이브러리 추가      | `add-to-library`                       | `contents`, `content_external_ids`, `user_library_items` | 전체·상태별 라이브러리, 해당 콘텐츠 상태, 프로필 통계 무효화                                                                   |
| 시즌·에피소드 동기화 | `fetch-episodes`                       | `seasons`, `episodes`                                    | 콘텐츠 시즌·에피소드 Query 무효화 후 서버 결과 표시                                                                            |
| 감상 상태 변경       | Supabase Client                        | `user_library_items`                                     | 전체·상태별 라이브러리, 상세, 홈, 프로필 통계 동기화. 실패 시 롤백                                                             |
| 에피소드 완료 토글   | Supabase Client                        | `user_episode_progress`                                  | 콘텐츠 진행률, 시즌 진행률, 라이브러리 진행 요약, 홈 동기화. 실패 시 롤백                                                      |
| 핀·태그 생성/수정    | 트랜잭션 RPC **[Tech Lead 검토 필요]** | `timeline_pins`, `tags`, `timeline_pin_tags`             | 아래 “핀 캐시 일관성 계약” 적용. 한 요청 전체 성공/실패                                                                        |
| 핀 삭제              | Supabase Client 또는 트랜잭션 RPC      | `timeline_pins`, `timeline_pin_tags`                     | FK cascade 확인 후 아래 “핀 캐시 일관성 계약” 적용                                                                             |
| 프로필 수정          | Supabase Client                        | `profiles`                                               | 프로필 단건 캐시 갱신                                                                                                          |
| 계정 삭제            | `delete-account`                       | 모든 사용자 소유 데이터                                  | 성공 후 인증·로컬 사용자 캐시 제거, `/onboarding` 이동                                                                         |

### 6.1 핀 캐시 일관성 계약

핀 생성·수정·삭제 후 다음 소비처는 한 화면 이동 안에 동일한 결과를 보여야 한다.

- `pins.all(userId)`
- `pins.byContent(userId, contentId)`
- `pins.byEpisode(userId, episodeId)` — 영화는 해당 없음
- 영향받은 모든 `pins.byTag(userId, tagId)`
- `pins.single(pinId)` — 삭제 성공 시 즉시 제거
- `tags.all(userId)`과 태그별 개수
- `profile.stats(userId)`의 총 핀 수
- 라이브러리 카드·내 기록 상세의 핀 수와 홈 최근 핀

삭제는 삭제 전 핀의 `content_id`, `episode_id`, 태그 ID를 확보한 뒤 수행해야 한다. 성공 시 선택된 상세 패널을 비우고 다음 유효 핀을 선택한다. 실패 시 목록과 단건을 삭제 전 상태로 복구하고 오류를 알린다. 현재 일부만 무효화하는 구현은 [`useDeletePin`](../src/hooks/useTimelinePins.ts)에서 개선 대상이다.

### 6.2 서버 런타임 검증 계약

- `/pins/new`의 신뢰 가능한 입력은 `contentId`, 선택적 `episodeId`뿐이다. `duration` URL 파라미터는 제거하거나 무시한다.
- 생성: `episodeId`가 있으면 서버의 해당 `episodes` 행을 조회해 `content_id` 일치와 `duration_seconds`를 확인한다.
- 편집: 핀을 조회한 뒤 그 핀의 `episode_id`로 동일 검증을 수행한다.
- 런타임이 양수이고 `timestamp_seconds > duration_seconds`이면 저장을 차단한다.
- 런타임이 `null` 또는 0이면 초과 검증을 생략하되 “에피소드 길이 정보가 없어 시간 초과 여부를 확인할 수 없습니다” 안내를 보인다.
- 화면 로드 시 조회한 값만 믿는 경우 저장 직전 메타데이터 변경과 경쟁할 수 있다. **[확인 필요][Tech Lead 검토 필요]** 최종 권위 검증 위치를 정하고 생성·편집에 동일하게 적용한다.

### 6.3 외부 API 오류 정제·비밀값 보호 계약

- Edge Function이 클라이언트에 반환하는 오류는 안정된 제품 오류 코드와 사용자용 일반 메시지만 포함한다.
- 응답·서버 로그·분석 이벤트에 전체 요청 URL, query string, `api_key`, `access_token`, Authorization header, JWT, provider 응답 원문, stack trace를 포함하지 않는다.
- TMDB v3 키가 query 인증으로 사용되더라도 오류 문자열에 `URL.toString()` 또는 원본 fetch URL을 삽입하지 않는다. 로그가 필요하면 host·pathname·status·정제된 오류 코드만 기록한다.
- URL·객체·문자열을 기록하기 전 `api_key`, `key`, `token`, `authorization`, `jwt`, `secret` 계열 값을 일괄 redaction한다. exact key 이름 목록과 중첩 객체 처리는 **[Tech Lead 검토 필요]**다.
- 화면은 `SEARCH_UNAVAILABLE`, `CONTENT_DETAIL_UNAVAILABLE`, `EPISODES_UNAVAILABLE`처럼 기능 단위 메시지로 변환하고 raw `error.message`를 그대로 렌더링하지 않는다.
- **P0 릴리스 게이트:** 테스트용 가짜 secret을 주입한 실패 시나리오에서 클라이언트 응답, 함수 로그, 모니터링 이벤트 어느 곳에도 secret 전체·부분 문자열과 query URL이 나타나지 않아야 한다.

### 6.4 회원 탈퇴 가용성 계약

- 원격 `delete-account` 함수가 존재하고 현재 앱이 연결된 Supabase project에서 인증 요청을 수신해야 한다.
- 404, 함수 미배포, 라우팅 오류는 계정 삭제 성공으로 간주하지 않는다. 사용자의 세션과 모든 화면 데이터를 유지한다.
- 사용자 메시지는 “현재 회원 탈퇴를 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.”로 정제하고 HTTP URL·project ref·함수 내부 오류를 노출하지 않는다.
- **P0 릴리스 게이트:** 전용 테스트 계정으로 원격 탈퇴 성공, 탈퇴 후 세션 무효화, 사용자 소유 데이터 삭제, 공유 콘텐츠 메타데이터 유지까지 smoke test를 통과해야 한다.

### 6.5 핀·태그 원자성 계약

- 생성은 핀 행과 태그 upsert·연결을 한 서버 트랜잭션에서 처리한다. 어느 단계든 실패하면 핀과 연결 모두 남기지 않는다.
- 수정은 기존 핀 검증, 핀 필드 수정, 새 태그 upsert, 연결 교체를 한 트랜잭션에서 처리한다. 실패 시 기존 핀과 태그 연결을 그대로 보존한다.
- RPC는 `auth.uid()`로 소유자를 결정하고 클라이언트가 보낸 `user_id`를 신뢰하지 않는다. 기본은 `SECURITY INVOKER`이며, definer가 필요하면 고정 `search_path`, 완전 수식 이름, 최소 EXECUTE 권한을 적용한다.
- 동일 요청 재시도가 중복 핀을 만들지 않도록 클라이언트 생성 요청 ID 또는 동등한 idempotency 계약을 둔다. **[Tech Lead 검토 필요]**
- 화면은 부분 성공을 표시하지 않는다. 성공 응답을 받은 뒤에만 draft를 비우며, 실패 시 모든 입력을 유지한다.

### 6.6 배포·환경 계약

- 현재 원격 마이그레이션 이력과 로컬 소스가 일치하지 않는 상태에서는 새 Function을 배포하지 않는다. MVP에서 추천을 제외하면 빈 검색 화면이 `personalized-recommendations`를 호출하지 않는지 먼저 검증한다.
- 추천을 유지하는 범위 변경이 승인되면 `0017 → 0018 → 0019` 적용, linked DB 타입 재생성, Function 배포, 인증 smoke test 순서를 지킨다.
- 원격 `delete-account` 존재 여부는 소스 파일이나 배포 스크립트가 아니라 실제 인증 호출 결과로 판정한다.
- Client 정적 검사와 별도로 모든 Edge Function에 Deno typecheck를 실행하며 오류 0건을 배포 조건으로 한다. 원격 import는 정확한 버전과 lockfile로 고정한다.
- Expo 환경은 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`만 읽는다. Backend secret은 별도 ignored 환경 파일/secret store로 분리한다.
- 배포 순서는 migration 확인·적용 → schema cache 확인 → Function 배포 → 인증/RLS/smoke다. 어느 단계든 실패하면 다음 환경으로 승격하지 않는다.

### 6.7 검색 페이지네이션 계약

- 클라이언트와 서버 모두 정규화된 검색어 2~100자를 허용한다. 서버 `page`에는 정수 상한을 두고 사용자별 rate limit을 적용한다. 구체 상한·quota는 **[Tech Lead 검토 필요]**다.
- 외부 provider 한 페이지를 합친 서버 응답은 20건을 넘을 수 있다. Query 계층은 `(external_source, external_id)`로만 중복을 제거한 뒤 화면에 **20건씩** 노출하고, 이미 받은 잔여 결과를 먼저 소비한 다음 서버의 다음 provider page를 요청한다.
- 서버 캐시는 결과뿐 아니라 각 응답의 `total`, `hasNextPage`, 성공·실패 source를 저장한다. 모든 값은 fresh와 cache hit에서 동일해야 한다.
- `getNextPageParam`은 일반 검색 응답의 `hasNextPage`와 클라이언트 잔여 buffer를 사용한다. 개인화 추천의 추가 로드 상태를 재사용하지 않는다.
- 검색어·유형이 바뀌면 화면 누적 결과와 buffer를 새 Query key로 전환하되 이전 검색 Query 자체는 TTL 동안 보존한다.

---

## 7. 4주 개발 순서

### 1주차 — 범위 정리와 기반

1. 빈 검색의 개인화 추천 호출을 제거하고 원격/로컬 migration drift와 `delete-account` 배포 상태를 출시 게이트로 고정한다.
2. Edge Deno 오류를 0건으로 만들고 Client·Backend·migration drift·2-user RLS·원격 smoke CI 뼈대를 추가한다.
3. Expo 공개 환경과 Backend secret 환경을 분리하고 가짜 secret 번들·로그 회귀를 추가한다.
4. 범위 밖 탭·CTA·route를 MVP 내비게이션과 배포에서 격리한다.
5. 전역 하단 내비게이션을 `(tabs)` 소유로 이동하고 Stack 화면 노출을 차단한다.
6. 공통 breakpoint, Safe Area, 44pt 터치 영역, 로딩·빈 상태·오류·오프라인 패턴을 적용한다.
7. 이메일 인증·라우트 가드·로그아웃 캐시 삭제·RLS 회귀 환경을 안정화한다.
8. 라이브러리 제거 정책과 단일 감상 상태 source of truth를 **[확인 필요]** 의사결정 항목으로 상정한다.

### 2주차 — 검색과 라이브러리 기록

1. 일반 검색 캐시 메타데이터를 보존하고 결과 buffer를 포함한 20건 단위 페이지네이션으로 전환한다.
2. 검색 결과의 자동 cross-API 병합을 중단하고 출처를 명확히 표시한다.
3. 콘텐츠 상세과 라이브러리 추가 바텀 시트의 로딩·중복·실패 상태를 완성한다.
4. 홈을 최근 핀·보는 중 중심으로 단순화하고 라이브러리 상태 필터를 안정화한다.
5. 검색 → 추가 → 내 기록 상세 전환의 캐시를 통합 검증한다.

### 3주차 — 에피소드와 핀 핵심

1. 콘텐츠별 로컬 시즌 선택과 에피소드 진행률 롤백을 구현한다.
2. 시간값 상태를 `empty / valid / invalid_nonempty`로 분리하고 테스트한다.
3. 생성·편집 서버 런타임 검증을 동일하게 적용한다.
4. 핀·태그 생성/수정 트랜잭션 RPC와 idempotency 계약을 적용한다.
5. 영화 핀과 시리즈 핀 생성·수정 흐름을 완성한다.
6. 동일 에피소드·동일 시간 복수 핀 정렬을 검증한다.

### 4주차 — 스포일러·삭제 일관성·회귀

1. 홈, 리스트, 타임라인, 태그 결과, 상세 패널, 상세 화면의 스포일러 가림을 통합한다.
2. 핀 삭제 캐시 일관성과 실패 롤백을 완성한다.
3. 프로필 최소 기능과 계정 삭제를 검증한다.
4. 모바일 단일 열·tablet+ 상세 패널·Safe Area·키보드·접근성 QA를 수행한다.
5. P0 회귀 시나리오와 다른 사용자 RLS 접근 테스트를 통과한다.

---

## 8. 리스크

| 리스크                                                            | 영향/가능성    | 대응                                                                                                                   |
| ----------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 라이브러리 제거가 핀·진행률을 의도치 않게 삭제하거나 고아화       | 높음/높음      | 정책 확정 전 CTA 차단. DB FK와 사용자 기대를 함께 검토 **[확인 필요][Tech Lead 검토 필요]**                            |
| 에피소드 길이 데이터가 없거나 부정확                              | 높음/중간      | null/0은 안내 후 허용, 양수는 hard block. 데이터 신뢰도 모니터링 **[Tech Lead 검토 필요]**                             |
| 직접 Client 핀 CRUD에서 최신 런타임을 권위 있게 재검증하기 어려움 | 높음/중간      | 생성·편집 공통 검증 경계 결정 **[확인 필요][Tech Lead 검토 필요]**                                                     |
| 동일 작품 heuristic 병합의 오탐으로 사용자가 원하는 출처를 잃음   | 높음/중간      | MVP 자동 병합 금지, 출처 카드 유지                                                                                     |
| 페이지 간 같은 결과 재등장                                        | 중간/중간      | `(external_source, external_id)` 기준으로 표시 중복만 제거하고 API별 원본 출처는 유지                                  |
| 스포일러 원문이 접근성 레이블·미리보기·상세 편집에서 누출         | 높음/중간      | 가림 컴포넌트 단일화, 접근성 트리 회귀 테스트                                                                          |
| 삭제 후 여러 Query가 서로 다른 핀 수를 표시                       | 높음/높음      | 6.1 캐시 계약과 P0 삭제 회귀 테스트 적용                                                                               |
| 모바일에서 tablet 레이아웃이 압축되어 조작 불가                   | 중간/높음      | 768pt 미만 단일 열 강제, 44pt 터치 영역                                                                                |
| 추천·공유·인물·리뷰 코드가 MVP 핵심 흐름에 다시 노출              | 중간/중간      | 최종 화면 목록 기반 route/nav snapshot 회귀                                                                            |
| 배포 Auth 이메일 확인 설정이 로컬과 다름                          | 높음/중간      | 배포 프로젝트 설정 사전 점검 **[확인 필요]**                                                                           |
| 원격 `delete-account`가 404라 회원 탈퇴가 실행되지 않음           | 높음/현재 확인 | 함수 배포·라우팅·환경 연결 수정 후 전용 계정 원격 smoke test. 통과 전 출시 금지                                        |
| TMDB query `api_key`가 오류 응답·로그에 노출                      | 매우 높음/중간 | 전체 URL·raw 오류 기록 금지, 중앙 redaction, 가짜 secret 누출 회귀 테스트. 통과 전 출시 금지 **[Tech Lead 검토 필요]** |
| 원격 DB가 `0016`에 머문 상태에서 관련 추천 Function이 실행        | 높음/현재 확인 | MVP 추천 호출 제거. 유지 승인 시 0017~0019 순차 적용·타입 재생성·배포 smoke 전 출시 금지                               |
| 캐시 적중 검색이 `hasNextPage=false`로 조기 종료                  | 높음/높음      | 캐시에 페이지 메타데이터 저장, fresh/cache 동일 계약 테스트                                                            |
| 핀 저장 성공 뒤 태그 실패로 부분 데이터·재시도 중복 발생          | 높음/중간      | 트랜잭션 RPC, idempotency key, 실패 시 draft 유지                                                                      |
| Edge Function 타입 오류가 Client 검사 통과 뒤 배포됨              | 높음/현재 확인 | 별도 Deno typecheck·정확한 import 버전·CI 배포 차단                                                                    |
| Expo 빌드 프로세스가 불필요한 admin/provider secret을 읽음        | 매우 높음/중간 | 환경 파일 분리, 번들 문자열 검사, 로그 redaction                                                                       |
| 만료 검색 캐시가 계속 누적되어 저장공간·조회 비용 증가            | 중간/높음      | 운영 플랜의 `pg_cron` 지원 확인 후 정기 삭제, 불가하면 Scheduled Function **[확인 필요]**                              |

---

## 9. 최종 체크리스트

### Product·Design

- [ ] 모든 화면에 상황·목표·행동·기대 결과와 Acceptance Criteria가 있다.
- [ ] 기록과 핀이 홈·상세 CTA에서 검색·추천보다 우선한다.
- [ ] 네 가지 감상 상태 외 상태가 MVP UI에 없다.
- [ ] 라이브러리 제거의 기록 보존/삭제 정책이 확정되기 전 CTA가 활성화되지 않는다.
- [ ] Highlight Reel, 추천, 공유, 인물, 리뷰, 가져오기가 **[MVP 제외 — Post-launch 검토]**로 표시된다.

### Frontend

- [ ] 하단 탭은 탭 화면에만 보인다.
- [ ] 모바일 핀 화면은 단일 열이며 tablet+에서만 상세 패널이 보인다.
- [ ] 시즌 선택이 콘텐츠별 또는 화면 로컬이다.
- [ ] `invalid_nonempty` 시간값이 `null`로 저장되지 않는다.
- [ ] 생성·편집 모두 서버 런타임을 사용한다.
- [ ] 스포일러 원문이 리스트·타임라인·상세·접근성 트리에서 가려진다.
- [ ] 모든 터치 영역이 최소 44×44pt다.
- [ ] 일반 검색 다음 페이지와 페이지 오류 재시도가 동작한다.
- [ ] 동일 검색의 fresh 응답과 cache hit 응답이 같은 다음 페이지 상태를 보인다.
- [ ] 핀 삭제 후 모든 관련 화면과 통계가 일치한다.
- [ ] 핀·태그 저장이 전부 성공하거나 전부 실패하고 재시도 중복 핀을 만들지 않는다.

### Backend·Security

- [ ] 외부 API 키와 service role key가 클라이언트에 없다.
- [ ] 사용자 소유 테이블 RLS를 두 사용자 계정으로 검증한다.
- [ ] 동일 에피소드·동일 시간 복수 핀을 DB가 허용한다.
- [ ] 영화 핀은 `episode_id = null`이며 더미 에피소드가 없다.
- [ ] 런타임 권위 검증 위치가 생성·편집에 동일하게 적용된다. **[확인 필요][Tech Lead 검토 필요]**
- [ ] 핀 삭제 시 `timeline_pin_tags`가 함께 정리된다.
- [ ] 원격 `delete-account`가 404 없이 전용 테스트 계정의 탈퇴를 완료한다. 실패 시 P0 출시 차단이다.
- [ ] 외부 API 오류 응답과 로그에서 URL query, `api_key`, Authorization, JWT가 정제된다.
- [ ] 가짜 TMDB secret을 사용한 오류 회귀에서 응답·로그·모니터링에 secret이 없다.
- [ ] 빈 검색 화면이 MVP 제외 `personalized-recommendations`를 호출하지 않는다.
- [ ] 추천 유지가 승인된 경우에만 원격 0017~0019 적용·타입 재생성·Function smoke를 모두 통과한다. **[확인 필요]**
- [ ] Edge Functions Deno typecheck가 오류 0건이고 원격 import 버전이 고정돼 있다.
- [ ] Expo가 읽는 환경에는 두 `EXPO_PUBLIC_*` 값 외 secret이 없고 번들 secret 검사가 통과한다.
- [ ] 감상 상태 필터와 프로필 통계가 같은 canonical 상태 컬럼을 사용한다. **[확인 필요][Tech Lead 검토 필요]**
- [ ] 만료된 `external_search_cache`를 정기 정리하는 운영 작업과 보존 기간이 설정돼 있다. **[확인 필요]**

### QA

- [ ] 15장의 모든 P0 회귀 시나리오가 iOS와 Android에서 통과한다.
- [ ] 768pt 경계 전후 레이아웃과 키보드·Safe Area를 검증한다.
- [ ] VoiceOver/TalkBack에서 가린 스포일러 원문이 읽히지 않는다.
- [ ] 네트워크 단절 시 캐시 읽기와 쓰기 차단 메시지를 구분한다.
- [ ] 50개 라이브러리, 200개 에피소드, 100개 핀에서 조작 가능성과 스크롤을 확인한다.
- [ ] 회원 탈퇴 404 시 세션·데이터를 유지하고 정제된 재시도 메시지를 표시한다.
- [ ] 검색·상세·에피소드 API 실패 화면에 raw provider 오류나 비밀 query가 보이지 않는다.
- [ ] 첫 검색과 동일 검색 재진입에서 결과 수·다음 페이지·종료 문구가 동일하다.
- [ ] 핀·태그 저장의 각 중간 단계 실패를 주입해 부분 핀·태그 유실·중복이 없음을 확인한다.

---

## 10. 공통 화면 구현 규칙

### 10.1 공통 레이아웃과 반응형 breakpoint

| 구간     |           폭 | 레이아웃 계약                                                      |
| -------- | -----------: | ------------------------------------------------------------------ |
| Mobile   |    `< 768pt` | 한 열, 좌우 16pt, 폼·카드 full width, 핀 상세 패널 없음            |
| Tablet   | `768~1199pt` | 좌우 24pt, 최대 2열, 핀 목록+360pt 상세 패널 허용                  |
| Wide/Web |  `>= 1200pt` | 콘텐츠 최대 1280pt 중앙 정렬, 폼 최대 720pt, 불필요한 열 증가 금지 |

- breakpoint는 화면별 임의 숫자 대신 위 세 구간을 공통 사용한다.
- Mobile 핀의 list/timeline 모드는 모두 단일 열이다.
- Tablet 이상에서 상세 패널이 들어갈 유효 폭이 부족하면 단일 열로 fallback한다. **[Tech Lead 검토 필요]** 최소 본문 폭 360pt 유지 방식 확인.
- 포스터가 없는 경우 레이아웃 크기를 유지하는 플레이스홀더를 쓴다.
- 목록은 현재 스택에 이미 채택된 FlashList를 사용하되, 가변 높이와 스크린 리더 동작을 실제 데이터로 검증한다.

### 10.2 Safe Area와 키보드

- 모든 화면 최상단은 상단 inset을, 탭 화면은 하단 탭 높이+하단 inset을 반영한다.
- Stack 상세·작성 화면은 하단 탭 여백을 추가하지 않는다.
- 바텀 시트와 고정 저장 버튼은 하단 inset 위에 위치한다.
- 핀·인증 폼은 키보드가 포커스 필드와 오류 메시지, 저장 버튼을 가리지 않도록 스크롤·회피 동작을 제공한다.
- 기기 회전, Dynamic Type 확대, 웹 주소창 높이 변화에서도 CTA가 화면 밖에 고정되지 않아야 한다.

### 10.3 접근성

1. 모든 Pressable, 체크박스, 칩, 아이콘 버튼은 실제 터치 영역 44×44pt 이상이다.
2. 아이콘 전용 버튼은 행동을 설명하는 `accessibilityLabel`을 갖는다.
3. 선택 칩·탭은 `selected`, 체크는 `checked`, 로딩은 `busy`, 펼침은 `expanded` 상태를 전달한다.
4. 오류는 색상만 쓰지 않고 텍스트와 필드 연결을 제공한다. 주요 오류·결과 개수는 live region으로 알린다.
5. 스포일러 가림 상태에서는 원문을 렌더링하거나 접근성 레이블에 포함하지 않는다.
6. 포스터 설명은 작품명을 사용하며 장식 이미지는 접근성 트리에서 제외한다.
7. 텍스트 확대 시 잘림보다 줄바꿈을 우선하고, 시간값은 tabular numerals를 사용한다.
8. 포커스 순서는 헤더 → 핵심 내용 → 기본 CTA → 보조/위험 액션 순이다.

### 10.4 공통 상태 정의

| 상태                  | UI 계약                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Loading               | 화면 구조를 닮은 skeleton. 중복 제출 방지. 300ms 미만의 짧은 갱신에는 전체 화면 로더 금지 |
| Empty                 | “데이터 없음”과 “필터 결과 없음”을 다른 문구·CTA로 표시                                   |
| Error                 | 사용자 행동 가능한 재시도. 인증·권한·네트워크·데이터 없음 메시지 구분                     |
| Offline with cache    | 기존 데이터를 읽기 전용으로 유지하고 “저장된 정보” 배너 표시                              |
| Offline without cache | 명시적 연결 안내와 재시도. 검색·저장·수정·삭제 비활성                                     |
| Refreshing            | 기존 데이터를 유지하고 작은 갱신 표시만 제공                                              |

MVP는 오프라인 쓰기 큐와 충돌 해결을 제공하지 않는다. 이는 **[MVP 제외 — Post-launch 검토]**다.

### 10.5 분석 이벤트 공통 원칙

- 아래 화면 명세에 적은 **이벤트 이름만** 수집한다.
- 이메일, 메모, 태그 원문, 검색어 원문, 콘텐츠 제목, 외부 ID, 사용자 ID 등 개인정보·사용자 입력값을 이벤트에 넣지 않는다.
- 실패 이벤트에 서버 오류 원문을 넣지 않는다.
- 분석 SDK·보존 기간·동의 방식은 **[확인 필요][Tech Lead 검토 필요]**다.

---

## 11. 핵심 사용자 흐름

### 11.1 첫 기록 만들기

`온보딩 → 이메일 가입/로그인 → 홈 → 검색 → 검색 결과 → 콘텐츠 상세 → 라이브러리에 추가 → 내 기록 상세`

성공 기준은 콘텐츠가 검색 결과가 아니라 라이브러리와 홈의 개인 기록으로 보이는 것이다.

### 11.2 시리즈 핀 만들기

`내 기록 상세 → 에피소드 선택 → 시즌 선택 → 핀 추가 → 시간/메모 입력 → 저장 → 에피소드 핀 목록`

`episodeId`와 서버 에피소드가 일치하고, 서버 런타임이 있으면 초과 시간이 차단되어야 한다.

### 11.3 영화 핀 만들기

`내 기록 상세 → 핀 추가 → 시간/메모 입력 → 저장 → 작품 핀 목록`

영화는 `episode_id = null`이며 에피소드 화면을 거치거나 더미 에피소드를 만들지 않는다.

### 11.4 핀 다시 보기·편집·삭제

`핀 탭 또는 작품 핀 목록 → 스포일러라면 보기 → 핀 상세 → 편집 → 저장/삭제 → 원래 목록`

삭제 후 홈, 핀 탭, 작품·에피소드·태그 목록, 통계에서 같은 핀이 남아 있지 않아야 한다.

### 11.5 진행률 기록

`내 기록 상세 → 에피소드 선택 → 완료 체크 → 시즌 진행률 갱신 → 마지막 화라면 완료 전환 제안`

완료 전환은 사용자 확인 후에만 수행한다. 기존 핀은 상태 전환의 영향을 받지 않는다.

---

## 12. 화면별 상세 구현 명세

## SCR-001 — 온보딩

- **화면명 (Screen Name):** 온보딩
- **화면 ID / Route:** SCR-001 / `/onboarding`; 현재 경로: [`app/(auth)/onboarding.tsx`](<../app/(auth)/onboarding.tsx>)
- **진입 경로 (Entry Path):** 최초 실행, 로그아웃, 인증 만료 후 보호 경로 접근
- **진입 조건:** 유효 세션 없음. 유효 세션이 있으면 홈으로 즉시 대체 이동
- **상황:** 신규 사용자가 SceneNote의 쓰임을 아직 모른다.
- **목표:** 개인 감상 기록과 핀의 가치를 이해하고 이메일 인증으로 진입한다.
- **행동:** 핵심 가치 슬라이드를 넘기고 계정 만들기 또는 로그인을 선택한다.
- **기대 결과:** 추천·검색보다 기록과 핀을 먼저 이해하고 인증 화면으로 이동한다.
- **데이터 의존성:** 정적 콘텐츠, 인증 세션 상태
- **레이아웃:** Mobile 한 열, Tablet+ 중앙 최대 560pt. 마지막 CTA는 Safe Area 위에 둔다.
- **주요 UI 요소 (Key UI Elements):** SceneNote 로고, 감상 기록/에피소드 진행률/스포일러 핀 3장, 페이지 표시, 다음, 계정 만들기, 로그인
- **사용자 액션 (User Actions):** 다음, 스와이프, 계정 만들기, 로그인
- **다음 화면 (Next Screens):** `/sign-up`, `/sign-in`, 세션 보유 시 `/`
- **상태:** Loading—세션 확인 중 전체 중립 로더; Empty—해당 없음; Error—세션 확인 실패 시 다시 시도/로그인; Offline—정적 슬라이드는 표시, 인증 CTA 탭 시 연결 안내
- **Validation:** 마지막 슬라이드가 아니어도 로그인 링크는 접근 가능. 중복 탭 내비게이션 방지
- **캐시 무효화:** 없음
- **분석 이벤트:** `onboarding_viewed`, `onboarding_advanced`, `onboarding_signup_selected`, `onboarding_signin_selected`
- **엣지 케이스 (Edge Cases):** 복원 세션 발견 시 슬라이드 미노출, Dynamic Type에서 CTA 잘림 금지
- **MVP 포함 여부 (MVP Inclusion):** Yes — 신규 사용자에게 핵심 가치를 전달하는 진입점

**Acceptance Criteria**

1. 유효 세션이 있으면 온보딩 콘텐츠를 노출하지 않고 홈으로 이동한다.
2. 세 장 모두 검색·추천이 아니라 기록·진행률·핀을 설명한다.
3. 모든 CTA 터치 영역이 44×44pt 이상이다.
4. 오프라인 인증 시도 시 화면을 잃지 않고 연결 안내를 표시한다.

## SCR-002 — 이메일 인증

- **화면명 (Screen Name):** 이메일 로그인 / 회원가입 / 비밀번호 재설정
- **화면 ID / Route:** SCR-002 / `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`; 현재 경로: [`app/(auth)`](<../app/(auth)>)
- **진입 경로 (Entry Path):** 온보딩 CTA, 로그아웃, 보호 경로의 인증 리디렉션, 이메일 재설정 링크
- **진입 조건:** 로그인·가입·요청 화면은 세션 없음, 새 비밀번호 화면은 유효한 복구 세션 필요
- **상황:** 사용자가 계정을 만들거나 기존 개인 기록으로 돌아오려 한다.
- **목표:** 이메일과 비밀번호로 안전하게 인증하거나 비밀번호를 재설정한다.
- **행동:** 폼 입력, 비밀번호 보기/숨기기, 제출, 재설정 링크 요청
- **기대 결과:** 성공 시 홈과 본인 기록에 접근하고, 실패 시 입력을 유지한 명확한 오류를 본다.
- **데이터 의존성:** Supabase Auth, auth store, 인증 딥링크 처리
- **레이아웃:** 한 열 폼 최대 480pt, 키보드 회피, 첫 오류로 포커스 이동
- **주요 UI 요소 (Key UI Elements):** 이메일, 비밀번호, 비밀번호 확인, 보기/숨기기, 기본 CTA, 재설정 링크, 상태 메시지
- **사용자 액션 (User Actions):** 로그인, 가입, 재설정 요청, 새 비밀번호 저장, 이전 화면
- **다음 화면 (Next Screens):** 성공 `/`, 실패 현재 화면, 로그인이 필요하면 `/sign-in`
- **상태:** Loading—제출 버튼 busy/disabled; Empty—해당 없음; Error—필드 오류와 인증 오류 분리; Offline—제출 차단, 입력 유지
- **Validation:** 이메일 형식, 비밀번호 8자 이상, 확인 일치, 앞뒤 공백 정리. 오류 메시지는 계정 존재 여부를 과도하게 노출하지 않는다 **[Tech Lead 검토 필요]**.
- **캐시 무효화:** 로그인 시 사용자 Query 활성화. 로그아웃·계정 전환 시 이전 사용자의 Query와 스포일러 해제 상태, 폼 draft 제거
- **분석 이벤트:** `auth_signin_submitted`, `auth_signin_succeeded`, `auth_signin_failed`, `auth_signup_submitted`, `auth_signup_succeeded`, `auth_signup_failed`, `auth_password_reset_requested`, `auth_password_updated`
- **엣지 케이스 (Edge Cases):** 만료·재사용 딥링크, 이미 가입된 이메일, 연속 제출, 앱 재개 시 복구 세션, 배포 이메일 확인 설정 불일치 **[확인 필요]**
- **MVP 포함 여부 (MVP Inclusion):** Yes — 모든 개인 기록 접근의 전제

**Acceptance Criteria**

1. 이메일·비밀번호가 유효하지 않으면 네트워크 호출 전 인라인 오류를 표시한다.
2. 인증 성공 시 뒤로 가기로 인증 폼에 재진입하지 않고 홈으로 이동한다.
3. 비밀번호 입력 필드마다 보기/숨기기 버튼과 접근성 레이블이 있다.
4. 네트워크 오류 후 이메일 입력값을 유지하며 비밀번호 보존 여부는 보안 검토 기준을 따른다. **[Tech Lead 검토 필요]**
5. MVP 화면에 소셜 로그인 CTA를 노출하지 않는다.

## SCR-003 — 홈

- **화면명 (Screen Name):** 홈
- **화면 ID / Route:** SCR-003 / `/`; 현재 경로: [`app/(tabs)/index.tsx`](<../app/(tabs)/index.tsx>)
- **진입 경로 (Entry Path):** 인증 성공, 홈 탭, 앱 재실행
- **진입 조건:** 유효 세션
- **상황:** 사용자가 앱을 열어 최근 기록과 이어 볼 콘텐츠를 확인한다.
- **목표:** 검색을 탐색하기보다 자신의 기록에 빠르게 복귀한다.
- **행동:** 최근 핀 열기, 스포일러 보기, 보는 중 콘텐츠 열기, 라이브러리/검색 이동
- **기대 결과:** 최근 활동과 다음 기록 행동이 한 화면에 보인다.
- **데이터 의존성:** 전체 라이브러리 요약, 보는 중 항목, 최근 핀 3개, 에피소드 진행률 요약
- **레이아웃:** Mobile 단일 열; Tablet+ 섹션 내부 2~3열 허용. 첫 섹션은 최근 핀 또는 보는 중이며 추천 섹션은 없음
- **주요 UI 요소 (Key UI Elements):** 최근 핀, 보는 중, 빈 상태 검색 CTA, 전체 라이브러리/핀 이동
- **사용자 액션 (User Actions):** 핀 열기·스포일러 해제, 콘텐츠 열기, 검색, 전체 보기
- **다음 화면 (Next Screens):** `/pins/[id]`, `/pins`, `/content/[id]`, `/library`, `/search`
- **상태:** Loading—섹션별 skeleton; Empty—“첫 작품을 추가해 보세요”; Error—성공한 섹션은 유지하고 실패 섹션만 재시도; Offline—캐시 요약 표시, 쓰기 CTA는 연결 안내
- **Validation:** 스포일러 최근 핀 메모는 기본 가림. 핀 없는 경우 빈 최근 핀 섹션보다 보는 중을 우선
- **캐시 무효화:** 라이브러리·진행률·핀 mutation의 소비처. 화면 focus 시 stale 데이터만 갱신
- **분석 이벤트:** `home_viewed`, `home_recent_pin_opened`, `home_spoiler_revealed`, `home_watching_opened`, `home_search_selected`
- **엣지 케이스 (Edge Cases):** 핀 삭제 직후 재등장 금지, 포스터 실패, 모든 데이터 없음, 일부 Query 실패
- **MVP 포함 여부 (MVP Inclusion):** Yes — 기록 중심 재진입점

**Acceptance Criteria**

1. 추천·인물·공유 섹션을 노출하지 않는다.
2. 스포일러 핀 원문은 보기 전 시각·접근성 트리에 없다.
3. 핀 삭제·진행률 변경·상태 변경 결과가 홈 복귀 시 일치한다.
4. 하단 탭이 보이고 Safe Area를 침범하지 않는다.

## SCR-003L — 라이브러리

- **화면명 (Screen Name):** 내 라이브러리
- **화면 ID / Route:** SCR-003L / `/library`; 현재 경로: [`app/(tabs)/library.tsx`](<../app/(tabs)/library.tsx>)
- **진입 경로 (Entry Path):** 라이브러리 탭, 홈 전체 보기, 라이브러리 추가 완료
- **진입 조건:** 유효 세션
- **상황:** 사용자가 저장한 모든 콘텐츠와 감상 상태를 관리한다.
- **목표:** 보고 싶음·보는 중·완료·드랍 기록을 빠르게 찾고 상세로 이동한다.
- **행동:** 상태 필터, 로컬 제목 검색, 목록/갤러리 전환, 콘텐츠 열기, 상태 변경, 제거 요청
- **기대 결과:** 현재 필터에 맞는 본인 콘텐츠만 일관된 상태·진행률·핀 수로 보인다.
- **데이터 의존성:** `user_library_items`+`contents`, 진행률 요약, 핀 수
- **레이아웃:** Mobile 단일 열 또는 2열 포스터 갤러리, Tablet+ 적응형. 범위 밖 필터·공유·가져오기 CTA 제거
- **주요 UI 요소 (Key UI Elements):** 전체/보는 중/완료/보고 싶음/드랍 필터, 검색, 카드, 상태 배지, 진행률, 핀 수, 빈 상태
- **사용자 액션 (User Actions):** 필터·검색·보기 전환, 상세 진입, 상태 변경, 제거 요청
- **다음 화면 (Next Screens):** `/content/[id]`, `/search`, 상태 변경 바텀 시트
- **상태:** Loading—카드 skeleton; Empty—전체 없음과 필터 없음 구분; Error—재시도; Offline—캐시 목록 읽기만 허용
- **Validation:** 로컬 검색은 외부 검색 호출 금지. 상태는 네 가지로 제한. 제거는 정책 확정 전 비활성/숨김
- **캐시 무효화:** 추가·상태 변경·진행률·핀 생성/삭제 후 관련 카드 갱신. 낙관적 변경 실패 시 이전 카드·필터 목록 모두 복구
- **분석 이벤트:** `library_viewed`, `library_filter_changed`, `library_search_used`, `library_item_opened`, `library_status_changed`, `library_remove_requested`
- **엣지 케이스 (Edge Cases):** 50개+, 필터 결과 0, 포스터 없음, 동일 외부 ID 중복, 제거 기록 정책 **[확인 필요]**
- **MVP 포함 여부 (MVP Inclusion):** Yes — 감상 기록의 중심 목록

**Acceptance Criteria**

1. 네 가지 상태 필터가 각각 정확한 항목만 보인다.
2. 외부 검색·공유·엑셀·사진 가져오기·추천 상태 UI를 노출하지 않는다.
3. 필터·검색을 해제하면 전체 목록과 원래 스크롤 컨텍스트로 복귀할 수 있다.
4. 정책 확정 전 라이브러리 제거가 실제 mutation을 호출하지 않는다.

## SCR-004 — 콘텐츠 검색

- **화면명 (Screen Name):** 콘텐츠 검색
- **화면 ID / Route:** SCR-004 / `/search` 검색 전 상태; 현재 진입: [`app/(tabs)/search.tsx`](<../app/(tabs)/search.tsx>), 구현 본체: [`app/search.tsx`](../app/search.tsx)
- **진입 경로 (Entry Path):** 검색 탭, 홈/라이브러리 빈 상태 CTA
- **진입 조건:** 유효 세션
- **상황:** 기록할 콘텐츠를 라이브러리에 추가하려 한다.
- **목표:** 제목과 유형으로 원하는 콘텐츠를 찾는다.
- **행동:** 검색어 입력, 유형 선택, 검색 제출
- **기대 결과:** 2자 이상 검색어에 대한 첫 20개 결과로 전환한다.
- **데이터 의존성:** 검색 폼 UI 상태, `search-content`
- **레이아웃:** 검색창을 첫 포커스로 두고 추천 피드 없이 간단한 안내를 표시
- **주요 UI 요소 (Key UI Elements):** 검색 입력, 지우기, 유형 칩(전체/애니/드라마/영화), 제출, 검색 안내
- **사용자 액션 (User Actions):** 입력·지우기·필터·제출
- **다음 화면 (Next Screens):** SCR-005 동일 route 상태
- **상태:** Loading—제출 후 SCR-005 skeleton; Empty—검색 전 안내; Error—호출 전 없음; Offline—검색 비활성, 캐시된 동일 query가 있으면 결과 보기 가능
- **Validation:** trim 후 2자 이상. 공백만/1자는 호출하지 않고 인라인 안내. 검색어 원문은 분석 이벤트로 전송 금지
- **캐시 무효화:** 검색어·유형 변경 시 표시 페이지를 page 1로 초기화. 이전 Query 캐시는 정책 시간 동안 유지
- **분석 이벤트:** `search_viewed`, `search_submitted`, `search_type_changed`, `search_cleared`
- **엣지 케이스 (Edge Cases):** 한글 조합 중 제출, 연속 제출, 매우 긴 검색어, 특수문자, 오프라인
- **MVP 포함 여부 (MVP Inclusion):** Yes — 기록 시작 보조 도구

**Acceptance Criteria**

1. 2자 미만 입력은 네트워크를 호출하지 않는다.
2. 추천·비슷한 작품·인물 검색 결과를 노출하지 않는다.
3. 키보드 검색 액션과 화면 CTA가 동일하게 동작한다.
4. 하단 탭이 보이며 검색 입력이 키보드에 가리지 않는다.

## SCR-005 — 검색 결과

- **화면명 (Screen Name):** 검색 결과
- **화면 ID / Route:** SCR-005 / `/search` 결과 상태
- **진입 경로 (Entry Path):** SCR-004 유효 검색 제출
- **진입 조건:** 유효 세션, trim 2자 이상 검색어
- **상황:** 결과가 적거나 수백 건일 수 있고 여러 API에 같은 제목이 존재할 수 있다.
- **목표:** 출처와 메타데이터를 비교해 기록할 정확한 결과를 선택한다.
- **행동:** 결과 열기, 다음 20건 불러오기, 페이지 재시도, 검색어·유형 변경
- **기대 결과:** 자동 병합으로 후보가 사라지지 않고 사용자가 기준 출처를 결정한다.
- **데이터 의존성:** 페이지별 `search-content` 응답: 결과, page, hasNextPage, partial, failedSources
- **레이아웃:** Mobile 단일 열 카드, Tablet+ 2열 허용. 각 카드에 포스터·제목·원제·연도·유형·API 출처 표시
- **주요 UI 요소 (Key UI Elements):** 검색창, 유형 칩, 결과 수, 결과 카드, partial 배너, 다음 페이지 로더/재시도/종료 문구
- **사용자 액션 (User Actions):** 카드 열기, 추가 페이지, 재시도, 조건 변경
- **다음 화면 (Next Screens):** `/content/[id]` 외부 결과 모드
- **상태:** Loading—첫 페이지 skeleton/추가 페이지 하단 로더; Empty—“검색 결과가 없습니다. 다른 키워드로 검색해 보세요”; Error—첫 페이지 전체 오류 또는 페이지 하단 오류; Offline—누적 캐시 유지, 다음 페이지 차단
- **Validation:** 페이지당 최대 20개. 페이지 병합 시 동일 `(source,id)`만 표시 중복 제거하고 다른 API 출처는 유지
- **캐시 무효화:** page 단위 캐시. query/type 변경 시 누적 결과 초기화. 라이브러리 추가 성공 시 카드의 추가 상태만 동기화
- **분석 이벤트:** `search_results_viewed`, `search_result_opened`, `search_next_page_requested`, `search_next_page_failed`, `search_results_exhausted`, `search_partial_results_shown`, `search_no_results_shown`
- **엣지 케이스 (Edge Cases):** 모든 API 0건, 수백 건, 같은 제목 다중 API, 일부 API 실패, 다음 페이지 중복·실패
- **MVP 포함 여부 (MVP Inclusion):** Yes

**Acceptance Criteria**

1. 첫 페이지는 최대 20개이며 끝 도달 시 `hasNextPage`가 true일 때만 다음 페이지를 요청한다.
2. 다음 페이지 실패 시 기존 결과를 유지하고 하단에 재시도만 표시한다.
3. `hasNextPage = false`이면 “모든 결과를 확인했습니다”를 한 번 표시한다.
4. 동일 작품 후보라도 출처가 다르면 별도 카드와 출처 레이블을 유지한다.
5. 모든 API가 0건인 상태와 모든 API 실패 상태가 다른 UI다.

## SCR-006 — 콘텐츠 상세

- **화면명 (Screen Name):** 콘텐츠 상세
- **화면 ID / Route:** SCR-006 / `/content/[id]` 외부 결과 모드; 현재 경로: [`app/content/[id].tsx`](../app/content/[id].tsx)
- **진입 경로 (Entry Path):** 검색 결과 카드
- **진입 조건:** `source + externalId` 또는 이미 저장된 내부 content ID 중 하나가 유효. 제목·포스터 route params는 권위 데이터가 아님
- **상황:** 사용자가 검색 후보가 원하는 콘텐츠인지 확인한다.
- **목표:** 최소 메타데이터와 출처를 확인해 라이브러리 추가를 결정한다.
- **행동:** 줄거리 확인, 라이브러리에 추가, 이미 추가된 콘텐츠 열기
- **기대 결과:** 선택한 출처 기준으로 저장되거나 기존 내 기록으로 이동한다.
- **데이터 의존성:** `get-content-detail`, 현재 라이브러리 중복 상태
- **레이아웃:** Mobile 포스터 위·정보 아래, Tablet+ 포스터/정보 2열, CTA는 Safe Area 위에서 접근 가능
- **주요 UI 요소 (Key UI Elements):** 뒤로, 포스터, 제목·원제·연도·장르·줄거리·출처, 시즌/에피소드 수 또는 영화 런타임, 추가 CTA
- **사용자 액션 (User Actions):** 추가 시트 열기, 내 기록 열기, 뒤로
- **다음 화면 (Next Screens):** SCR-007, SCR-008, 검색 결과
- **상태:** Loading—상세 skeleton; Empty—필수 식별자 없음/콘텐츠 없음; Error—재시도 및 검색 카드 최소 정보; Offline—캐시 상세만 읽기, 추가 비활성
- **Validation:** 영화에는 에피소드 CTA 없음. 자동 cross-API canonical 통합 금지
- **캐시 무효화:** 추가 성공 시 라이브러리 상태와 상세 CTA 갱신
- **분석 이벤트:** `content_detail_viewed`, `content_add_sheet_opened`, `content_library_record_opened`
- **엣지 케이스 (Edge Cases):** 포스터·줄거리·에피소드 수 없음, 기존 항목, 같은 제목 다른 출처, 외부 상세 partial
- **MVP 포함 여부 (MVP Inclusion):** Yes

**Acceptance Criteria**

1. 카드에서 선택한 API 출처를 상세에 계속 표시한다.
2. 이미 같은 `(source, externalId)`가 라이브러리에 있으면 추가 대신 내 기록 열기를 표시한다.
3. 추천, 배우·성우 등록, 리뷰, 공유 CTA를 노출하지 않는다.
4. 상세 실패 시 잘못된 내부 레코드를 만들 수 있는 추가 CTA를 활성화하지 않는다.

## SCR-007 — 라이브러리에 추가

- **화면명 (Screen Name):** 라이브러리에 추가
- **화면 ID / Route:** SCR-007 / SCR-006 바텀 시트
- **진입 경로 (Entry Path):** 콘텐츠 상세의 “라이브러리에 추가”
- **진입 조건:** 유효 세션, 저장 가능한 외부 콘텐츠 식별자, 아직 같은 외부 레코드 미등록
- **상황:** 사용자가 콘텐츠를 어떤 감상 상태로 기록할지 정한다.
- **목표:** 한 번의 선택으로 개인 라이브러리 기록을 시작한다.
- **행동:** 네 가지 상태 중 하나 선택, 저장, 취소
- **기대 결과:** 선택 콘텐츠만 내부 DB에 저장되고 내 기록 상세로 이어진다.
- **데이터 의존성:** 선택 콘텐츠 최소 메타데이터, `add-to-library`
- **레이아웃:** Mobile 하단 시트, Tablet+ 중앙 dialog 가능. 제목·출처 확인 영역과 44pt 이상 상태 행
- **주요 UI 요소 (Key UI Elements):** 콘텐츠 썸네일·제목·출처, 보고 싶음/보는 중/완료/드랍, 취소, 저장 진행 상태
- **사용자 액션 (User Actions):** 상태 선택, 취소, 실패 재시도
- **다음 화면 (Next Screens):** 성공 SCR-008, 취소 SCR-006
- **상태:** Loading—선택 후 시트 유지·행 busy; Empty—해당 없음; Error—입력 유지·재시도; Offline—선택 비활성
- **Validation:** 중복 제출 차단, 네 가지 상태만 허용, 사용자 ID는 클라이언트 입력을 신뢰하지 않음
- **캐시 무효화:** 전체·상태별 라이브러리, 상세 라이브러리 상태, 홈, 프로필 통계
- **분석 이벤트:** `library_add_started`, `library_add_status_selected`, `library_add_succeeded`, `library_add_failed`, `library_add_cancelled`
- **엣지 케이스 (Edge Cases):** 동시 중복 추가, 일부 메타데이터 없음, 요청 중 닫기/뒤로, API source 충돌
- **MVP 포함 여부 (MVP Inclusion):** Yes

**Acceptance Criteria**

1. 저장 요청 중 시트를 닫거나 상태를 중복 제출할 수 없다.
2. 성공 시 상세 CTA와 라이브러리 목록이 같은 상태를 보인다.
3. 실패 시 시트와 선택 상태를 유지한다.
4. 검색 결과 전체가 아니라 사용자가 선택한 콘텐츠 하나만 저장한다.

## SCR-008 — 내 기록 상세

- **화면명 (Screen Name):** 현재 시청 중 상세 / 내 기록 상세
- **화면 ID / Route:** SCR-008 / `/content/[id]` 라이브러리 모드
- **진입 경로 (Entry Path):** 홈·라이브러리 카드, 콘텐츠 상세의 내 기록 열기
- **진입 조건:** 본인의 `user_library_items`가 해당 content에 존재
- **상황:** 사용자가 한 콘텐츠의 상태·진행률·핀을 이어서 기록한다.
- **목표:** 다음 에피소드로 가거나 핀을 추가·조회하고 감상 상태를 갱신한다.
- **행동:** 상태 변경, 에피소드 열기, 핀 추가·전체 보기, 제거 요청
- **기대 결과:** 콘텐츠 컨텍스트 안에서 모든 개인 기록이 일관되게 연결된다.
- **데이터 의존성:** 콘텐츠, 라이브러리 항목, 시즌/진행률 요약, 최근 핀, 핀 수
- **레이아웃:** 상단 메타데이터, 핵심 기록 CTA, 진행률, 최근 핀. 범위 밖 상세 섹션 제거
- **주요 UI 요소 (Key UI Elements):** 상태 배지·변경, 진행률, 에피소드 목록(시리즈), 핀 추가(영화 직접), 핀 전체 보기, 최근 핀, 제거
- **사용자 액션 (User Actions):** 상태 변경, 에피소드/핀 이동, 스포일러 보기, 제거 요청
- **다음 화면 (Next Screens):** SCR-009, SCR-010A, SCR-011, 라이브러리
- **상태:** Loading—상세 skeleton; Empty—라이브러리 항목 없으면 SCR-006 또는 라이브러리로 안전 이동; Error—섹션별 재시도; Offline—캐시 읽기, mutation 차단
- **Validation:** 영화는 에피소드 버튼 미노출·`episode_id=null` 핀 CTA. `completed → watching`에서도 기존 진행률·핀 유지
- **캐시 무효화:** 상태·진행률·핀 mutation 후 상세 요약 갱신
- **분석 이벤트:** `record_detail_viewed`, `record_status_change_started`, `record_status_changed`, `record_episodes_opened`, `record_pin_create_started`, `record_pins_opened`, `record_remove_requested`
- **엣지 케이스 (Edge Cases):** 핀 0, 시즌 정보 실패, 영화, completed 전환, 제거 정책 **[확인 필요]**
- **MVP 포함 여부 (MVP Inclusion):** Yes — 기록과 핀의 허브

**Acceptance Criteria**

1. 시리즈와 영화의 CTA가 올바르게 분기한다.
2. 최근 핀 스포일러 메모는 기본 가림이다.
3. 감상 상태 변경 실패 시 이전 상태와 모든 필터 목록을 복구한다.
4. 제거 정책 확정 전 실제 제거 mutation을 실행하지 않는다.
5. 인물·리뷰·공유·추천 UI를 노출하지 않는다.

## SCR-009 — 에피소드 선택

- **화면명 (Screen Name):** 에피소드 선택
- **화면 ID / Route:** SCR-009 / `/content/[id]/episodes`; 현재 경로: [`app/content/[id]/episodes.tsx`](../app/content/[id]/episodes.tsx)
- **진입 경로 (Entry Path):** 내 기록 상세의 에피소드 목록
- **진입 조건:** 본인 라이브러리의 시리즈 콘텐츠. 영화 진입 차단
- **상황:** 사용자가 어디까지 봤는지 기록하거나 특정 에피소드에 핀을 남기려 한다.
- **목표:** 시즌·에피소드를 정확히 선택하고 진행률 또는 핀 행동을 수행한다.
- **행동:** 시즌 선택, 완료 토글, 에피소드 핀 목록, 핀 추가
- **기대 결과:** 해당 콘텐츠에만 유효한 시즌 선택과 최신 진행률이 보인다.
- **데이터 의존성:** `fetch-episodes`, seasons, episodes, `user_episode_progress`, 에피소드별 핀 수
- **레이아웃:** 시즌 selector + 진행률 + FlashList. Mobile 한 열, 각 행 체크·정보·핀 CTA가 44pt 이상
- **주요 UI 요소 (Key UI Elements):** 뒤로, 시즌 선택, 시즌 완료 수/전체 수, 에피소드 번호·제목·방영일·런타임, 완료 체크, 핀 수, 핀 추가
- **사용자 액션 (User Actions):** 시즌 전환, 완료/미완료, 핀 추가, 핀 목록
- **다음 화면 (Next Screens):** SCR-010A, SCR-011, SCR-008
- **상태:** Loading—시즌/행 skeleton; Empty—시즌 없음과 선택 시즌 에피소드 없음 구분; Error—시즌/에피소드/진행률별 재시도; Offline—캐시 읽기, 완료 토글·핀 생성 차단
- **Validation:** 선택 시즌 ID가 현재 content의 seasons에 없으면 첫 유효 시즌으로 초기화. 다른 content의 이전 선택 재사용 금지
- **캐시 무효화:** 완료 토글 후 진행률·라이브러리·홈 갱신. 핀 CRUD 후 행 핀 수 갱신
- **분석 이벤트:** `episodes_viewed`, `episode_season_changed`, `episode_progress_toggled`, `episode_pins_opened`, `episode_pin_create_started`
- **엣지 케이스 (Edge Cases):** 1개/8개+/200화, 제목·런타임 없음, 다른 작품에서 전환, 마지막 화 완료
- **MVP 포함 여부 (MVP Inclusion):** Yes, 시리즈 전용

**Acceptance Criteria**

1. 작품 A의 시즌 선택 후 작품 B로 이동해도 A의 season ID로 B 에피소드를 요청하지 않는다.
2. 단일 시즌이면 불필요한 selector를 숨기되 시즌 진행률은 표시한다.
3. 완료 토글은 즉시 피드백하고 실패 시 정확히 롤백한다.
4. 마지막 에피소드 완료 시 상태 완료 전환을 제안하되 사용자 확인 전 변경하지 않는다.
5. 핀 생성 route에는 `duration` 값을 권위 파라미터로 전달하지 않는다.

## SCR-010A — 핀 생성

- **화면명 (Screen Name):** 타임라인 핀 생성
- **화면 ID / Route:** SCR-010A / `/pins/new`; 현재 경로: [`app/pins/new.tsx`](../app/pins/new.tsx), [`PinComposer`](../src/components/pins/PinComposer.tsx)
- **진입 경로 (Entry Path):** 에피소드 행 핀 추가, 영화 내 기록 상세 핀 추가, 핀 목록 추가 CTA
- **진입 조건:** 본인 라이브러리 content ID, 시리즈는 해당 content 소속 episode ID 필수, 영화는 episode ID 없음
- **상황:** 사용자가 기억할 장면이나 시간 없는 감상 메모를 남기려 한다.
- **목표:** 시간·메모 중 하나 이상과 선택 속성을 안전하게 저장한다.
- **행동:** 시간값, 메모, 태그, 감정, 스포일러 입력 후 저장
- **기대 결과:** 올바른 콘텐츠·에피소드에 핀이 저장되고 관련 목록에 즉시 나타난다.
- **데이터 의존성:** content 최소 정보, episode 서버 행·duration, 기존 tags, 핀 생성 mutation
- **레이아웃:** 탭 없는 Stack, 폼 최대 720pt, 하단 저장 CTA, 키보드 회피. 상단에 콘텐츠·시즌/에피소드 컨텍스트
- **주요 UI 요소 (Key UI Elements):** 시간값, 메모(500자 카운터), 태그(20자/10개), 감정 1개, 스포일러, 저장, 취소, 런타임 상태 안내
- **사용자 액션 (User Actions):** 입력·태그 추가/삭제·감정 선택/해제·스포일러 토글·저장·취소
- **다음 화면 (Next Screens):** 성공 원래 에피소드/작품 핀 목록, 취소 이전 화면
- **상태:** Loading—컨텍스트·런타임 확인 전 skeleton, 저장 busy; Empty—잘못된 content/episode는 복구 CTA; Error—조회 오류와 저장 오류 분리, draft 유지; Offline—폼 입력 가능하되 저장 차단·현재 화면 draft 유지
- **Validation:** 아래 시간값 상태표와 서버 런타임 계약, 시간·메모 둘 다 비면 오류, 동일 시간 핀은 허용
- **캐시 무효화:** 6.1 관련 목록·태그·통계·홈 갱신. 생성은 서버 성공 전 목록에 확정 표시하지 않음
- **분석 이벤트:** `pin_create_viewed`, `pin_timecode_validation_failed`, `pin_create_submitted`, `pin_create_succeeded`, `pin_create_failed`, `pin_create_cancelled`
- **엣지 케이스 (Edge Cases):** 동일 에피소드 복수, 동일 시간 복수, invalid nonempty, 길이 초과, 런타임 없음, 영화, 저장 실패
- **MVP 포함 여부 (MVP Inclusion):** Yes — 핵심 가치

**시간값 상태 계약**

| Raw input                                    | 상태               | 저장값/응답                                                      |
| -------------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| `""` 또는 공백                               | `empty`            | `timestamp_seconds = null`; 단 메모가 비어 있지 않아야 저장 가능 |
| `14:32`, `1:02:30`, `90`, `1432`             | `valid`            | blur 또는 저장 시 정규화 후 정수 초 저장                         |
| `12:60`, `1:60:00`, `12:3x`, `::`, 숫자 과다 | `invalid_nonempty` | 인라인 형식 오류, 저장 불가, 절대 `null`로 대체 금지             |
| 유효하지만 서버 런타임 초과                  | `out_of_range`     | 실제/최대 시간을 함께 표시, 저장 불가                            |

**Acceptance Criteria**

1. 비어 있지 않은 잘못된 시간값과 빈 시간값을 서로 다른 상태·메시지로 처리한다.
2. 생성 모드는 episode ID로 서버 런타임을 조회하며 URL `duration`을 신뢰하지 않는다.
3. 서버 런타임이 3,600초일 때 3,601초는 차단하고 3,600초는 허용한다.
4. 런타임이 없으면 안내를 표시하고 유효한 형식의 시간은 저장할 수 있다.
5. 같은 에피소드·같은 시간 핀을 경고 없이 추가할 수 있다.
6. 저장 실패 후 모든 입력을 유지한다.
7. 저장 성공 후 원래 컨텍스트 목록에 새 핀이 한 번만 나타난다.

## SCR-010B — 핀 상세·편집

- **화면명 (Screen Name):** 타임라인 핀 상세 / 편집
- **화면 ID / Route:** SCR-010B / `/pins/[id]`; 현재 경로: [`app/pins/[id].tsx`](../app/pins/[id].tsx)
- **진입 경로 (Entry Path):** 홈 최근 핀, 핀 목록·타임라인·태그 결과·상세 패널
- **진입 조건:** 본인 소유 pin ID
- **상황:** 사용자가 핀 전체 내용을 확인하거나 수정·삭제한다.
- **목표:** 스포일러를 통제하면서 기존 기록을 정확히 변경한다.
- **행동:** 스포일러 보기, 편집 진입, 저장, 삭제, 뒤로
- **기대 결과:** 상세은 안전하게 가려지고, 편집 결과가 모든 목록에 일관되게 반영된다.
- **데이터 의존성:** pin 단건+태그, content/episode 컨텍스트, 서버 episode duration
- **레이아웃:** 최초 상세 모드와 명시적 편집 모드를 구분. 하단 탭 없음. 위험 삭제는 편집 하단 분리
- **주요 UI 요소 (Key UI Elements):** 컨텍스트, 시간, 감정, 태그, 스포일러 gate/메모, 편집, 삭제 확인, 저장·취소
- **사용자 액션 (User Actions):** 보기, 편집, 속성 수정, 저장, 삭제
- **다음 화면 (Next Screens):** 원래 핀 목록 또는 안전한 `/pins`
- **상태:** Loading—단건 skeleton; Empty—삭제됨/권한 없음 구분 없는 안전 메시지; Error—재시도; Offline—캐시 상세 읽기, 편집·삭제 차단
- **Validation:** 생성과 동일한 `invalid_nonempty`·서버 런타임 검증. 연결 content/episode 변경 불가. 변경 후 나가기는 확인
- **캐시 무효화:** 수정은 이전·새 태그 캐시 모두 갱신. 삭제는 6.1 전체 계약 및 single 제거
- **분석 이벤트:** `pin_detail_viewed`, `pin_detail_spoiler_revealed`, `pin_edit_started`, `pin_edit_submitted`, `pin_edit_succeeded`, `pin_edit_failed`, `pin_delete_requested`, `pin_delete_succeeded`, `pin_delete_failed`
- **엣지 케이스 (Edge Cases):** 스포일러 딥링크, 다른 기기 삭제, 편집 중 런타임 변경, 태그 변경, 삭제 실패
- **MVP 포함 여부 (MVP Inclusion):** Yes

**Acceptance Criteria**

1. 스포일러 핀 딥링크 진입 시 상세 원문을 먼저 노출하지 않는다.
2. 가린 메모는 접근성 트리에서도 읽히지 않는다.
3. 편집 시 서버 episode duration을 다시 조회하고 생성과 같은 초과 규칙을 적용한다.
4. 시간 변경 후 모든 시간순 목록이 재정렬된다.
5. 삭제 성공 후 단건·전체·작품·에피소드·태그·홈·통계 어디에도 핀이 남지 않는다.
6. 삭제 실패 시 핀은 모든 목록과 상세에 복원된다.

## SCR-011 — 핀 목록

- **화면명 (Screen Name):** 타임라인 핀 목록
- **화면 ID / Route:** SCR-011 / `/pins`, `/content/[id]/pins`; 현재 경로: [`app/(tabs)/pins.tsx`](<../app/(tabs)/pins.tsx>), [`app/content/[id]/pins.tsx`](../app/content/[id]/pins.tsx)
- **진입 경로 (Entry Path):** 핀 탭, 내 기록 상세, 에피소드 행, 핀 저장 완료
- **진입 조건:** 유효 세션. content/episode 필터가 있으면 현재 사용자에게 접근 가능한 컨텍스트
- **상황:** 사용자가 전체 또는 특정 작품·에피소드 핀을 시간 흐름이나 최신순으로 돌아본다.
- **목표:** 메모·태그·감정을 탐색하고 상세·생성으로 이동한다.
- **행동:** list/timeline 모드, 정렬, 작품·에피소드·태그·감정 필터, 스포일러 보기, 핀 열기·추가
- **기대 결과:** 필터에 맞는 모든 핀이 누락 없이 안전하게 보인다.
- **데이터 의존성:** all/byContent/byEpisode pins, tags, content/episode context
- **레이아웃:** Mobile list/timeline 모두 단일 열, 상세 패널 없음. Tablet+ 목록+360pt 상세 패널. 진행바형 타임라인은 **[MVP 제외 — Post-launch 검토]**
- **주요 UI 요소 (Key UI Elements):** 제목·컨텍스트, 결과 수, 정렬, 필터, list/timeline 전환, 핀 카드, 스포일러 gate, 추가 CTA, tablet+ 상세 패널
- **사용자 액션 (User Actions):** 필터·정렬·모드, 스포일러 해제, 선택·상세, 핀 추가
- **다음 화면 (Next Screens):** SCR-010A, SCR-010B, SCR-013 상태
- **상태:** Loading—핀 skeleton; Empty—전체 없음/필터 없음/에피소드 없음 구분; Error—재시도; Offline—캐시 읽기와 필터 허용, 생성·수정 차단
- **Validation:** episode filter는 content 소속 확인. 같은 시간 핀 모두 표시. 시간 미지정은 시간 지정 뒤
- **캐시 무효화:** 핀 CRUD 후 6.1 적용. 필터 Query가 stale한 삭제 항목을 재표시하지 않음
- **분석 이벤트:** `pins_viewed`, `pins_view_mode_changed`, `pins_sort_changed`, `pins_filter_changed`, `pins_spoiler_revealed`, `pins_pin_opened`, `pins_create_started`
- **엣지 케이스 (Edge Cases):** 복수 핀, 동일 시간, 100개+, 스포일러, 필터 0건, 삭제 후 선택 패널, 모바일 폭
- **MVP 포함 여부 (MVP Inclusion):** Yes

**Acceptance Criteria**

1. 동일 episode ID의 모든 핀을 `timestamp_seconds ASC NULLS LAST, created_at ASC, id ASC`로 표시한다.
2. 같은 시간 핀을 그룹으로 접거나 덮어쓰지 않고 각각 표시한다.
3. list, timeline, tablet 상세 패널 모두 스포일러 원문을 기본 가린다.
4. 768pt 미만에서는 상세 패널 없이 단일 열이다.
5. 상세·작성 화면에서는 하단 탭이 보이지 않고, `/pins` 탭 화면에서만 보인다.
6. 삭제 후 선택 핀이 사라지면 다음 유효 핀을 선택하거나 빈 상세를 표시한다.

## SCR-012 — Highlight Reel

- **화면명 (Screen Name):** 명장면 모음 (Highlight Reel)
- **화면 ID / Route:** SCR-012 / 경로 없음
- **진입 경로 (Entry Path):** MVP에는 없음
- **진입 조건:** 없음
- **상황:** 개인 핀을 편집·공유형 모음으로 재구성하려는 니즈다.
- **목표:** Post-launch 별도 검증
- **행동:** MVP에는 없음
- **기대 결과:** MVP 내비게이션과 화면에서 기능이 노출되지 않는다.
- **데이터 의존성:** 정의하지 않음
- **레이아웃:** 정의하지 않음
- **주요 UI 요소 (Key UI Elements):** 없음
- **사용자 액션 (User Actions):** 없음
- **다음 화면 (Next Screens):** 없음
- **상태:** 해당 없음
- **Validation:** route·CTA·딥링크 미제공
- **캐시 무효화:** 없음
- **분석 이벤트:** 없음
- **엣지 케이스 (Edge Cases):** 스포일러 공유 정책과 공개 범위는 별도 기획 필요
- **MVP 포함 여부 (MVP Inclusion):** No — **[MVP 제외 — Post-launch 검토]**. 개인 기록과 기본 핀 CRUD 안정화가 우선

**Acceptance Criteria**

1. MVP 탭, 홈, 핀 목록, 프로필에 Highlight Reel CTA가 없다.
2. 관련 route가 공개 딥링크로 등록되지 않는다.

## SCR-013 — 태그별 핀 목록

- **화면명 (Screen Name):** 태그별 핀 목록
- **화면 ID / Route:** SCR-013 / `/pins?tagId=:tagId`; 현재 기반: [`usePinsByTag`](../src/hooks/useTimelinePins.ts), [`app/(tabs)/pins.tsx`](<../app/(tabs)/pins.tsx>)
- **진입 경로 (Entry Path):** 핀 목록 태그 칩, 핀 카드 태그, 프로필 태그 요약(제공 시)
- **진입 조건:** 본인 태그 ID. 잘못되거나 타인 태그면 안전한 빈/없음 상태
- **상황:** 사용자가 특정 의미로 묶은 장면을 콘텐츠 경계 없이 보고 싶다.
- **목표:** 선택 태그가 연결된 본인 핀만 탐색한다.
- **행동:** 태그 전환·해제, 스포일러 보기, 핀 상세 열기
- **기대 결과:** 선택 태그 이름과 결과 수가 주소 가능한 상태로 유지된다.
- **데이터 의존성:** tags, pins by tag
- **레이아웃:** SCR-011과 동일 반응형. 별도 대형 태그 관리 화면은 만들지 않는다.
- **주요 UI 요소 (Key UI Elements):** 선택 태그, 전체 해제, 결과 수, 핀 list/timeline, 스포일러 gate
- **사용자 액션 (User Actions):** 태그 변경·해제, 핀 열기, 스포일러 보기
- **다음 화면 (Next Screens):** SCR-010B, SCR-011 전체 상태
- **상태:** Loading—태그/핀 skeleton; Empty—태그 없음과 결과 없음 구분; Error—재시도; Offline—캐시 태그 필터 허용
- **Validation:** MVP는 한 번에 태그 1개 필터로 제한한다. 다중 AND/OR는 **[MVP 제외 — Post-launch 검토]**
- **캐시 무효화:** 핀 태그 수정·삭제 시 해당 이전/새 태그 Query와 태그 개수 갱신
- **분석 이벤트:** `tag_pins_viewed`, `tag_pins_filter_changed`, `tag_pins_filter_cleared`, `tag_pins_spoiler_revealed`, `tag_pins_pin_opened`
- **엣지 케이스 (Edge Cases):** 삭제된 태그, 결과 0, 삭제 핀 캐시 잔존, 스포일러, 타인 tag ID
- **MVP 포함 여부 (MVP Inclusion):** Yes, 최소 범위 — 태그 기반 개인 기록 회수에 직접 기여

**Acceptance Criteria**

1. 선택 태그에 연결된 본인 핀만 표시한다.
2. URL 또는 route params로 필터 상태를 복원할 수 있다.
3. 스포일러 메모는 list/timeline/detail에서 기본 가림이다.
4. 핀에서 태그를 제거하거나 핀을 삭제하면 해당 목록에서 즉시 사라지고 결과 수가 갱신된다.

## SCR-014 — 프로필

- **화면명 (Screen Name):** 프로필
- **화면 ID / Route:** SCR-014 / `/profile`; 현재 경로: [`app/(tabs)/profile.tsx`](<../app/(tabs)/profile.tsx>)
- **진입 경로 (Entry Path):** 프로필 탭
- **진입 조건:** 유효 세션
- **상황:** 사용자가 계정과 개인 기록 규모를 확인하고 계정 작업을 수행한다.
- **목표:** 기본 프로필, 최소 통계, 로그아웃, 회원 탈퇴에 접근한다.
- **행동:** 표시 이름 수정, 로그아웃, 탈퇴
- **기대 결과:** 불필요한 취향 분석 없이 계정·기록 요약을 명확히 본다.
- **데이터 의존성:** profile, 총 라이브러리 수, 완료 수, 총 핀 수, 총 태그 수, Auth
- **레이아웃:** Mobile 한 열, Tablet+ 최대 720pt. 일반 액션과 위험 액션을 분리
- **주요 UI 요소 (Key UI Elements):** 표시 이름·이메일, 4개 최소 통계, 로그아웃, 회원 탈퇴
- **사용자 액션 (User Actions):** 이름 편집, 로그아웃, 2단계 탈퇴 확인
- **다음 화면 (Next Screens):** 로그아웃·탈퇴 후 `/onboarding`
- **상태:** Loading—통계별 skeleton; Empty—0 표시; Error—실패 수치 `--`와 재시도. 탈퇴 404/함수 미배포 시 정제된 가용성 메시지를 표시하고 세션·데이터 유지; Offline—캐시 프로필·통계, 계정 mutation 차단
- **Validation:** 표시 이름 1~24자 **[확인 필요]** 허용 문자 정책, 탈퇴는 명확한 비가역 경고
- **캐시 무효화:** 이름 성공 시 profile 갱신. 로그아웃·탈퇴 성공 시 모든 사용자 캐시·draft·스포일러 해제 상태 제거
- **분석 이벤트:** `profile_viewed`, `profile_name_update_submitted`, `profile_name_updated`, `profile_signout_requested`, `profile_signout_succeeded`, `profile_delete_requested`, `profile_delete_succeeded`, `profile_delete_failed`
- **엣지 케이스 (Edge Cases):** 통계 일부 실패, 로그아웃 중 중복 탭, 탈퇴 실패, 다른 기기 세션, 캐시 누출
- **MVP 포함 여부 (MVP Inclusion):** Yes — 기본 계정 관리

**Acceptance Criteria**

1. 추천 제외, 취향 카드 공유, 장르·연도 취향 리포트 등 범위 밖 UI를 노출하지 않는다.
2. 통계는 총 라이브러리·완료·핀·태그의 최소 네 가지로 제한한다.
3. 로그아웃 후 이전 사용자의 라이브러리·핀·스포일러 해제 상태가 보이지 않는다.
4. 탈퇴는 두 단계 확인 후 실행하고, 성공 시 인증 경로로 이동한다.
5. 원격 함수가 404 또는 비정상 응답이면 성공 UI·로그아웃을 실행하지 않고, 데이터와 세션을 유지하며 재시도를 제공한다.

---

## 13. 화면–API–테이블 추적표

| 화면        | Read                             | Write                        | Edge Function / Auth                 | 테이블                                                                                |
| ----------- | -------------------------------- | ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| SCR-001     | 세션                             | 없음                         | Supabase Auth                        | 없음                                                                                  |
| SCR-002     | 세션                             | 가입·로그인·비밀번호         | Supabase Auth                        | `auth.users`, `profiles`                                                              |
| SCR-003     | 라이브러리 요약, 최근 핀, 진행률 | 없음                         | 없음                                 | `user_library_items`, `contents`, `timeline_pins`, `user_episode_progress`            |
| SCR-003L    | 라이브러리, 진행률·핀 수         | 상태 변경, 정책 확정 후 제거 | 없음                                 | `user_library_items`, `contents`, `user_episode_progress`, `timeline_pins`            |
| SCR-004/005 | 외부 검색 페이지                 | 없음                         | `search-content`                     | `external_search_cache` 간접                                                          |
| SCR-006     | 외부/내부 상세, 등록 상태        | 없음                         | `get-content-detail`                 | `contents`, `content_external_ids`, `user_library_items`                              |
| SCR-007     | 선택 콘텐츠                      | 라이브러리 추가              | `add-to-library`                     | `contents`, `content_external_ids`, `user_library_items`, 필요 시 `seasons`           |
| SCR-008     | 콘텐츠·라이브러리·진행률·핀      | 상태 변경                    | 필요 시 `fetch-episodes`             | `contents`, `user_library_items`, `seasons`, `user_episode_progress`, `timeline_pins` |
| SCR-009     | 시즌·에피소드·진행률·핀 수       | 완료 upsert/delete           | `fetch-episodes`                     | `seasons`, `episodes`, `user_episode_progress`, `timeline_pins`                       |
| SCR-010A    | 콘텐츠·episode duration·tags     | 핀·태그 생성                 | 없음, 권위 검증 경계 **[확인 필요]** | `episodes`, `timeline_pins`, `tags`, `timeline_pin_tags`                              |
| SCR-010B    | 핀·episode duration·tags         | 핀·태그 수정·삭제            | 없음, 권위 검증 경계 **[확인 필요]** | `episodes`, `timeline_pins`, `tags`, `timeline_pin_tags`                              |
| SCR-011     | 전체/작품/에피소드 핀·tags       | 없음                         | 없음                                 | `timeline_pins`, `timeline_pin_tags`, `tags`, `contents`, `episodes`                  |
| SCR-013     | tags, tag별 핀                   | 없음                         | 없음                                 | `tags`, `timeline_pin_tags`, `timeline_pins`                                          |
| SCR-014     | profile·통계                     | profile, 로그아웃, 탈퇴      | Supabase Auth, `delete-account`      | `profiles` 및 사용자 소유 테이블                                                      |

---

## 14. 필수 엣지 케이스 결정표

| 엣지 케이스                      | 감지 조건                                                                  | UI 응답                                                                                      | Tech Lead 검토                                                                  |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 동일 에피소드 내 복수 핀         | 같은 사용자·`episode_id`에 핀 2개 이상                                     | 모두 표시, `timestamp_seconds ASC NULLS LAST`, 동점 `created_at ASC`, 핀 수 배지 갱신        | No — UNIQUE 금지 여부 스키마 회귀만 확인                                        |
| 동일 시간대 복수 핀              | 같은 사용자·`episode_id`·`timestamp_seconds` 핀 2개 이상                   | 경고·병합 없이 각 카드 표시, 생성순. 덮어쓰기·그룹 접기 금지                                 | No                                                                              |
| 타임스탬프가 에피소드 길이 초과  | 서버 `duration_seconds > 0`이고 입력 초가 더 큼                            | 필드 오류, 입력/최대 시간 표시, 저장 차단. 생성·편집 동일                                    | Yes — 권위 검증 위치 **[확인 필요][Tech Lead 검토 필요]**                       |
| 비어 있지 않은 잘못된 타임스탬프 | `raw.trim() !== ""`이고 parser가 유효 초를 만들지 못함                     | 형식 오류, 저장 차단. 빈 값으로 변환 금지                                                    | No                                                                              |
| 에피소드 길이 없음               | 서버 `duration_seconds IS NULL OR <= 0`                                    | 검증 불가 안내, 형식이 유효하면 저장 허용                                                    | Yes — 메타데이터 신뢰도·갱신 **[Tech Lead 검토 필요]**                          |
| 외부 API 결과 0건                | 모든 성공 소스의 결과 합계 0이며 실패가 전부는 아님                        | 검색어 유지, “검색 결과가 없습니다”, 다른 키워드 안내                                        | No                                                                              |
| 외부 API 결과 수백 건            | 첫 응답 `hasNextPage=true` 또는 total > 20                                 | 20건 단위 무한 스크롤, 하단 로더·재시도·종료 문구                                            | Yes — API별 page 정합성·중복 페이지 **[Tech Lead 검토 필요]**                   |
| 동일 제목이 여러 API에 존재      | 다른 source이며 제목 정규화+연도+유형이 같거나 API가 `duplicate_hint` 제공 | 카드를 분리 유지, 출처 레이블과 “동일 작품 후보” 보조 문구. 사용자가 추가한 출처가 저장 기준 | Yes — 감지 heuristic은 안내용이며 자동 canonical 금지 **[Tech Lead 검토 필요]** |
| 스포일러 핀                      | `is_spoiler=true`이고 현재 화면의 revealed set에 없음                      | 홈/list/timeline/tag/detail에서 원문 제거+보기 CTA. 화면 이탈 시 다시 가림                   | Yes — 공통 revealed 수명·접근성 테스트 **[Tech Lead 검토 필요]**                |
| 핀 삭제 후 캐시 불일치           | 삭제 ID가 임의의 소비 Query에 남음                                         | 즉시 제거, 선택 패널 정리, 관련 count 갱신. 실패 시 전체 롤백                                | Yes — prefix 무효화 범위·비용 **[Tech Lead 검토 필요]**                         |
| 라이브러리 제거                  | 사용자가 제거 확인을 시도                                                  | 기록 보존/삭제가 확정되기 전 CTA 비활성/숨김                                                 | Yes — **[확인 필요][Tech Lead 검토 필요]**                                      |
| 영화 핀                          | content type `movie`, `episode_id=null`                                    | 내 기록 상세에서 직접 핀 생성, 에피소드 UI 없음                                              | No                                                                              |

---

## 15. P0 회귀 시나리오

| ID         | Given                                                 | When                                          | Then                                                                                       |
| ---------- | ----------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| REG-P0-001 | 유효 세션 없음                                        | `/pins` 딥링크                                | 인증 화면으로 이동하고 핀 데이터가 보이지 않는다                                           |
| REG-P0-002 | 유효 세션 있음                                        | 앱 재실행                                     | 온보딩 없이 홈과 본인 데이터가 보인다                                                      |
| REG-P0-003 | 탭 화면                                               | 화면 확인                                     | 하단 탭이 Safe Area 위에 보인다                                                            |
| REG-P0-004 | 콘텐츠 상세·에피소드·핀 생성·핀 상세                  | 화면 확인                                     | 하단 탭이 보이지 않는다                                                                    |
| REG-P0-005 | 검색어 1자                                            | 제출                                          | API를 호출하지 않고 2자 안내를 보인다                                                      |
| REG-P0-006 | 모든 API 결과 0                                       | 검색 완료                                     | 오류가 아닌 결과 없음 UI와 유지된 검색어가 보인다                                          |
| REG-P0-007 | 검색 결과 21개 이상                                   | 첫 20개 끝 도달                               | 다음 페이지를 한 번 요청하고 결과를 누적한다                                               |
| REG-P0-008 | 2페이지 호출 실패                                     | 끝 도달                                       | 1페이지를 유지하고 하단 재시도를 보인다                                                    |
| REG-P0-009 | 제목·연도·유형이 같은 TMDB/AniList 결과               | 검색 완료                                     | 두 출처 카드가 각각 보인다                                                                 |
| REG-P0-010 | 미등록 검색 결과                                      | 상태 선택·추가                                | 한 콘텐츠만 저장되고 상세·라이브러리 상태가 일치한다                                       |
| REG-P0-011 | 작품 A 시즌 2 선택                                    | 작품 B 에피소드 진입                          | 작품 B의 유효 시즌으로 초기화한다                                                          |
| REG-P0-012 | 미시청 에피소드                                       | 완료 탭·서버 실패                             | 즉시 체크 후 실패 시 미시청으로 롤백한다                                                   |
| REG-P0-013 | 핀 폼 시간 `""`, 메모 있음                            | 저장                                          | `timestamp_seconds=null` 핀이 저장된다                                                     |
| REG-P0-014 | 핀 폼 시간 `""`, 메모 공백                            | 저장                                          | 하나 이상 필수 오류로 저장되지 않는다                                                      |
| REG-P0-015 | 핀 폼 시간 `12:60`, 메모 있음                         | 저장                                          | `invalid_nonempty` 오류이며 null 핀으로 저장되지 않는다                                    |
| REG-P0-016 | 서버 런타임 3,600초                                   | 생성에서 1:00:01 저장                         | 초과 오류로 차단한다                                                                       |
| REG-P0-017 | 서버 런타임 3,600초                                   | 편집에서 1:00:01 저장                         | 생성과 동일하게 차단한다                                                                   |
| REG-P0-018 | 서버 런타임 없음                                      | 10:00+메모 저장                               | 검증 불가 안내 후 저장 가능하다                                                            |
| REG-P0-019 | 같은 episode에 기존 핀                                | 다른 시간 핀 추가                             | 두 핀이 시간순으로 보인다                                                                  |
| REG-P0-020 | 같은 episode·같은 시간 기존 핀                        | 새 핀 추가                                    | 경고 없이 두 핀이 생성순으로 보인다                                                        |
| REG-P0-021 | 스포일러 핀                                           | 홈·list·timeline·tag·detail 순회              | 보기 전 어느 표면·스크린 리더에서도 메모 원문이 노출되지 않는다                            |
| REG-P0-022 | 스포일러 보기 완료                                    | 화면을 나갔다 재진입                          | 다시 가림 상태다                                                                           |
| REG-P0-023 | 핀이 여러 캐시에 존재                                 | 삭제 성공                                     | 전체·작품·에피소드·태그·홈·통계·단건에서 사라진다                                          |
| REG-P0-024 | 핀이 여러 캐시에 존재                                 | 삭제 실패                                     | 모든 위치에 복구되고 오류가 보인다                                                         |
| REG-P0-025 | 영화 라이브러리 항목                                  | 핀 생성                                       | `episode_id=null`이며 에피소드 화면이 없다                                                 |
| REG-P0-026 | 폭 767pt 핀 화면                                      | 목록 확인                                     | 단일 열이고 상세 패널이 없다                                                               |
| REG-P0-027 | 폭 768pt 이상·유효 본문 폭                            | 핀 선택                                       | 오른쪽 상세 패널이 보이고 메모 스포일러 규칙을 지킨다                                      |
| REG-P0-028 | 모든 화면                                             | 터치 영역 측정                                | 모든 인터랙션이 44×44pt 이상이다                                                           |
| REG-P0-029 | 사용자 A/B 데이터 존재                                | B 세션으로 A ID 직접 조회                     | RLS가 조회·수정·삭제를 차단한다                                                            |
| REG-P0-030 | 라이브러리 제거 정책 미확정                           | 제거 UI 접근                                  | mutation을 실행할 수 없다                                                                  |
| REG-P0-031 | 사용자 A 로그아웃 후 B 로그인                         | 홈·핀·프로필 확인                             | A 데이터·draft·revealed set이 보이지 않는다                                                |
| REG-P0-032 | 네트워크 단절·캐시 있음                               | 홈/라이브러리/핀 진입                         | 캐시를 읽기 전용으로 보이고 mutation을 큐잉하지 않는다                                     |
| REG-P0-033 | 원격 `delete-account`가 404                           | 탈퇴 최종 확인                                | 성공 처리·로그아웃하지 않고 세션·데이터를 유지하며 정제된 오류와 재시도를 보인다           |
| REG-P0-034 | 외부 API가 테스트 secret이 든 query URL로 실패        | 검색·상세·에피소드 오류 처리                  | 클라이언트 응답, 화면, 함수 로그, 모니터링 어디에도 secret·전체 query URL이 없다           |
| REG-P0-035 | 검색 첫 응답이 fresh이고 다음 페이지가 있음           | 같은 조건으로 캐시 적중 재검색                | 결과 수와 `hasNextPage`가 같고 두 경우 모두 다음 20건을 볼 수 있다                         |
| REG-P0-036 | 핀 본문 저장 뒤 태그 단계에 실패를 주입               | 핀 생성·수정                                  | 생성은 부분 핀을 남기지 않고, 수정은 기존 본문·태그를 보존하며 재시도해도 중복 핀이 없다   |
| REG-P0-037 | 검색어가 비어 있음                                    | 검색 탭 진입                                  | 개인화 추천 Function을 호출하지 않고 검색 안내만 보인다                                    |
| REG-P0-038 | Client 검사는 통과하지만 Edge 소스에 타입 오류가 있음 | 배포 파이프라인 실행                          | Deno typecheck 단계가 Function 배포를 차단한다                                             |
| REG-P0-039 | Expo 공개 환경과 가짜 backend secret이 분리돼 있음    | web/native production bundle 생성·문자열 검사 | bundle과 source map에 backend secret 값이 없고 Expo 프로세스가 해당 환경을 로드하지 않는다 |

---

## 16. 의존성 기준 구현 순서

1. **배포 기준선:** MVP 추천 호출 제거 또는 migration 적용 결정, Edge 타입 오류 0건, 환경 분리, 원격 함수 smoke.
2. **라우트·범위 가드:** 탭 소유권, 인증 가드, 범위 밖 route 비노출.
3. **공통 UI 계약:** breakpoint, Safe Area, 44pt, 공통 상태, 스포일러 gate.
4. **Query 계약:** 사용자 범위 key, 로그아웃 clear, 검색 캐시 메타데이터, 핀·라이브러리 invalidation helper.
5. **검색 기록 진입:** page 1/next page, 20건 buffer, 출처 분리, 상세, 라이브러리 추가.
6. **개인 기록 허브:** 홈, 라이브러리, 내 기록 상세, 단일 canonical 상태.
7. **에피소드:** content-local 시즌, 진행률, 서버 런타임 조회.
8. **핀 쓰기:** 원자적 RPC, idempotency, 3상태 시간값, 영화 분기, 생성·편집 동일 검증.
9. **핀 회수:** 전체·작품·에피소드·태그 list/timeline/detail과 스포일러.
10. **삭제·통계:** 전 소비처 캐시 일관성, 프로필 최소 통계.
11. **P0 회귀·RLS·접근성:** 15장 전체 통과 후 범위 밖 기능을 별도 backlog로 이동.

---

## 17. 미결정 사항

| ID       | 질문                                                                                               | 출시 영향                                                                                            | 담당                           |
| -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------ |
| OPEN-001 | 라이브러리 제거 시 핀·에피소드 진행률을 보존할지 함께 삭제할지                                     | P0 차단. 카피·DB 동작·캐시 계약 모두 달라짐 **[확인 필요]**                                          | Product + Tech Lead            |
| OPEN-002 | 생성·편집 저장 직전 서버 런타임 권위 검증을 어느 경계에서 보장할지                                 | P0. 화면 우회·경쟁 조건 방지 **[확인 필요][Tech Lead 검토 필요]**                                    | Tech Lead + Backend            |
| OPEN-003 | 배포 Supabase가 이메일 확인 없이 즉시 세션을 발급하는지                                            | P0 인증 흐름 **[확인 필요]**                                                                         | Tech Lead                      |
| OPEN-004 | 마지막 에피소드 완료 시 감상 상태 전환 제안 후 기본 포커스와 취소 정책                             | P1 카피·접근성 **[확인 필요]**                                                                       | Product + Design               |
| OPEN-005 | 방영 중 콘텐츠의 episode metadata 수동 갱신 CTA를 MVP에 둘지                                       | P1. stale 에피소드 위험 **[확인 필요][Tech Lead 검토 필요]**                                         | Product + Backend              |
| OPEN-006 | 동일 작품 후보 안내용 heuristic을 서버 `duplicate_hint`로 제공할지                                 | P1. 자동 병합은 금지로 확정, 안내 정확도만 미결정 **[확인 필요][Tech Lead 검토 필요]**               | Product + Tech Lead            |
| OPEN-007 | 프로필 표시 이름 허용 문자와 공백 정규화                                                           | P1 validation **[확인 필요]**                                                                        | Product                        |
| OPEN-008 | 분석 SDK, 동의, 보존 기간                                                                          | 기능 출시와 분리 가능하나 개인정보 검토 필요 **[확인 필요][Tech Lead 검토 필요]**                    | Product + Legal + Tech Lead    |
| OPEN-009 | 외부 API 오류 redaction을 적용할 중앙 경계와 허용 로그 필드                                        | P0 보안. 결정과 회귀 테스트 필요 **[확인 필요][Tech Lead 검토 필요]**                                | Tech Lead + Backend + Security |
| OPEN-010 | `status` 단일값과 `status_flags` 다중값 중 MVP canonical 상태를 무엇으로 확정할지                  | P0 데이터·필터·통계 일치. 본 문서는 단일 `status`를 목표로 제안 **[확인 필요][Tech Lead 검토 필요]** | Product + Tech Lead + Backend  |
| OPEN-011 | 이미 발급된 공개 공유 링크를 만료·회수할지 기존 동작으로 유지할지                                  | P0 개인정보. 신규 공유는 MVP 제외지만 기존 bearer link 처리 필요 **[확인 필요]**                     | Product + Security + Backend   |
| OPEN-012 | 다중 provider 응답을 20건 UI batch로 노출할 때 서버 cursor로 전환할지 클라이언트 buffer를 유지할지 | P1 페이지 누락·중복·복잡도 **[확인 필요][Tech Lead 검토 필요]**                                      | Tech Lead + Frontend + Backend |

---

## 18. 자체 검토 결과

- 상황·목표·행동·기대 결과와 번호형 Acceptance Criteria를 모든 구현 대상 화면에 포함했다.
- 동일 에피소드 복수 핀, 동일 시간 복수 핀, 길이 초과, 검색 0건/수백 건, 다중 API 동일 작품을 감지 조건·UI·Tech Lead 검토 여부로 정의했다.
- 이메일 인증, 검색, 라이브러리·상태, 진행률, 핀 CRUD, 태그·감정·스포일러, 기본 프로필 외 기능을 Post-launch로 격리했다.
- `invalid_nonempty` 시간값, 서버 런타임 생성·편집 공통 검증, 모든 핀 표면의 스포일러 가림, 콘텐츠별 시즌, 탭 전용 하단 nav, 모바일 단일 열, tablet+ 상세 패널, 44pt, 검색 페이지네이션, 삭제 캐시 일관성을 명시했다.
- 라이브러리 제거 정책과 권위 런타임 검증 위치는 임의 결정하지 않고 출시 차단 **[확인 필요]** 항목으로 남겼다.
- 원격 `delete-account` 404와 TMDB query secret 노출 위험을 P0 릴리스 게이트·화면 오류 계약·회귀 시나리오에 추가했다.
- 검색 캐시의 페이지 메타데이터 유실, 원격 0017~0019 drift, Edge Deno 오류, Expo/Backend 환경 혼합, 핀·태그 비원자 저장을 프로젝트 출시 게이트와 회귀 시나리오에 반영했다.
