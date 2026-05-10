# SceneNote — MVP 통합 계획 (Integration Plan)

**버전:** 1.0.0
**작성일:** 2026-05-02
**작성자:** MVP 통합 조율자
**상태:** 확정 (MVP 기준)
**기반 문서:** 01~09 전체 산출물

---

## 1. 프로젝트 개요

### 1.1 앱 목적

SceneNote는 애니메이션, 한국 드라마, 일본 드라마, 영화를 시청하는 사용자가 **개인 감상 기록과 타임라인 핀**을 체계적으로 관리하는 모바일 앱이다. 검색은 기록을 시작하기 위한 진입 도구이며, 앱의 핵심 가치는 타임라인 핀 경험에 있다.

### 1.2 대상 사용자

18~35세, 애니/K-드라마/J-드라마/영화를 주 3회 이상 시청하며 감상 기록 습관이 있는 사용자. "이 장면이 몇 화 몇 분이었지?"를 자주 묻는 사용자가 핵심 타겟이다.

### 1.3 MVP 정의 경계

**MVP 포함 (6대 핵심 기능):**

1. 외부 API(AniList, TMDB)를 통한 콘텐츠 검색
2. My Library — 개인 라이브러리에 콘텐츠 저장
3. 감상 상태 관리 (보는 중 / 완료 / 보고 싶음 / 드랍)
4. 시즌/에피소드 진행률 추적
5. 특정 타임스탬프에 타임라인 핀 메모 작성
6. 태그 / 메모 / 스포일러 관리

**MVP 제외 (명시적 제외 목록):**

| 기능 | 예정 Phase |
|------|-----------|
| 소셜 공유 / 팔로우 / 커뮤니티 | Phase 3 |
| 추천 알고리즘 | Phase 3 |
| Highlight Reel (명장면 공유) | Phase 2 |
| 알림 / 신작 알림 | Phase 2 |
| 오프라인 모드 | Phase 2 |
| 커스텀 태그 색상 | Phase 2 |
| 다크 모드 | Phase 2 |
| 핀 Export (CSV, PDF) | Phase 2 |
| 다국어 지원 (영어 등) | Phase 2 |
| Kitsu, TVmaze API 통합 | Phase 2 |
| cross-API canonical 콘텐츠 통합 | Phase 2 |
| 개인 평점 / 리뷰 기능 | Phase 2 |
| 시청 타이머 / 통합 재생 | Phase 3 |
| 스포일러 블러 영구 해제 옵션 | Phase 2 |
| 핀 목록 진행바형 뷰 | Phase 2 |
| 검색어 자동완성 | Phase 2 |
| 시청 회차 개념 (1회차, 2회차) | Phase 2 |

### 1.4 핵심 아키텍처 결정 사항

**콘텐츠 전체 DB를 만들지 않는 MVP 전략**
사용자가 라이브러리에 추가하는 콘텐츠만 DB에 저장한다. 검색 결과를 bulk 캐싱하지 않는다. 외부 API가 콘텐츠 DB 역할을 수행하며, Supabase는 사용자 기록 데이터만 보관한다.

**사용자가 선택한 콘텐츠만 저장하는 전략**
`contents`, `seasons`, `episodes` 테이블은 사용자가 "라이브러리에 추가" 액션을 취할 때만 레코드가 생성된다. 에피소드는 사용자가 에피소드 목록 화면에 진입할 때 lazy load 방식으로 저장된다.

**외부 API 검색 결과 중복 처리 방식 (MVP)**
자동 중복 제거를 구현하지 않는다. 각 검색 결과 카드에 출처 API 레이블(TMDB, AniList)을 표시하고 사용자가 직접 선택한다. `(api_source, external_id)` UNIQUE 제약으로 DB 레벨 중복만 방지한다. Phase 2에서 cross-API 매핑을 검토한다.

**시즌/에피소드 정보가 없는 작품 처리 방식**
영화 또는 단편: `seasons`/`episodes` 레코드를 생성하지 않는다. 타임라인 핀은 `episode_id = NULL`로 저장하고 `content_id`로 직접 식별한다. 가상 에피소드 레코드 생성 방식은 채택하지 않는다.

**timestamp_seconds 저장 원칙**
타임스탬프는 항상 정수(INT) 초 단위로 DB에 저장한다. 화면 표시 시 클라이언트에서 MM:SS 또는 HH:MM:SS 형식으로 변환한다. DB에는 문자열 형태로 저장하지 않는다. `CHECK (timestamp_seconds IS NULL OR timestamp_seconds >= 0)` DB 제약과 앱 레벨 Zod 검증으로 이중 보호한다.

**동일 에피소드 내 여러 핀 허용 원칙**
에피소드 단위 복수 핀은 제한 없이 허용한다. `(user_id, episode_id, timestamp_seconds)` 조합에 UNIQUE 제약을 두지 않는다. 이는 SceneNote의 핵심 사용 패턴이다.

**같은 시간대 여러 핀 허용 원칙**
동일 `timestamp_seconds` 값의 핀을 제한 없이 허용한다. 경고 메시지 없이 생성 순서(`created_at ASC`)로 나열한다. 그룹핑 UI는 Phase 2에서 검토한다.

**Supabase RLS 적용 범위**
사용자 기록 테이블 5종(`user_library_items`, `user_episode_progress`, `timeline_pins`, `tags`, `timeline_pin_tags`) 및 `profiles`에는 `auth.uid() = user_id` 기반 RLS를 반드시 적용한다. 콘텐츠 메타데이터 테이블 4종(`contents`, `content_external_ids`, `seasons`, `episodes`)은 authenticated 읽기 / service_role 쓰기 정책을 적용한다. `external_search_cache`, `metadata_sync_logs`는 service_role 전용이다.

---

## 2. 충돌 및 불일치 정리

| 항목 | PM 입장 | 개발팀 입장 | 최종 결정 | 근거 |
|------|---------|------------|----------|------|
| 영화 핀의 episode_id 처리 | `content_id` 직접 참조 또는 가상 에피소드 생성 여부 [Tech Lead 검토 필요]로 표시 | `episode_id = NULL` 방식 채택 (04_architecture.md §8.3) | `episode_id = NULL` 채택 | 스키마 단순성 유지. 가상 레코드는 의미 없는 데이터를 생성하며 유지 관리 부담. 06_backend_schema.sql에 이미 반영됨. |
| 메모 필수 여부 | "메모 없이 저장 가능" [확실하지 않음] (02_user_stories.md US-040 AC#4) | `memo IS NULL` 허용, 단 `timestamp_seconds`와 `memo` 모두 NULL이면 DB CHECK로 차단 (06_backend_schema.sql §3.11) | 메모 선택 사항. DB CHECK로 이중 방어 | 타임스탬프만으로도 유의미한 기록. 타임스탬프 없는 핀도 메모가 있으면 허용. DB CHECK: `timestamp_seconds IS NOT NULL OR memo IS NOT NULL` |
| 타임스탬프 필수 여부 | [확실하지 않음 — TBD-001, TBD-002] | null 허용 권고. null 핀은 목록 맨 뒤 배치 (04_architecture.md §8.1) | 타임스탬프 선택 사항 (null 허용), 목록에서 NULLS LAST 정렬 | 유연한 메모 기록 허용으로 진입 장벽 낮춤. 06_backend_schema.sql에 이미 반영됨. |
| 소셜 로그인 우선순위 | Google/Apple 로그인 P1 (01_product_requirements.md §4.1) | 4주차 작업으로 배치 (04_architecture.md §15) | P1이지만 4주차에 구현. 이메일 로그인(P0)을 먼저 안정화. | 소셜 로그인 OAuth 설정은 독립 작업. 이메일 로그인 없이 테스트 불가 상황을 방지. |
| `emotion` 컬럼 타입 | VARCHAR(30)으로 자유 문자열 저장 (04_architecture.md §8.1) | `emotion_type` ENUM으로 정의 (06_backend_schema.sql §2) | ENUM 채택 (`emotion_type`) | ENUM이 DB 레벨 유효성 보장. 값 목록 변경 시 ALTER TYPE 필요하지만 MVP에서는 10개 고정 감정이 확정됨. |
| SCR-013 태그별 핀 목록 우선순위 | MVP 포함 Yes (03_screen_flow.md §2.13), P2 표기 | 4주차 작업 | P2 (4주차 구현). P0, P1 완성 후 진행. | SCR-011 태그 필터 기능이 P1이며 SCR-013은 그 확장. P2로 분류해도 MVP 출시 조건 충족. |
| `display_time_label` 컬럼 존재 | PM/FE 산출물에 언급 없음 | 06_backend_schema.sql에 `display_time_label TEXT` 컬럼이 timeline_pins 테이블에 추가됨 | 유지. 클라이언트가 저장 시점에 생성하는 표시용 문자열. | 성능 최적화 목적. 표시 시마다 변환 연산 생략 가능. 04_architecture.md §8.2의 변환 로직과 함께 사용. |
| `content_titles` 테이블 | 언급 없음 | 05_erd_rls.md, 06_backend_schema.sql에 정의됨 (Phase 2 활성화 예정) | 스키마는 MVP에 포함, 데이터는 Phase 2에 채움 | 다국어 제목 지원을 위한 미래 확장성. 스키마 준비 비용은 낮음. |
| `reviews` 테이블 | MVP 제외 (04_architecture.md §2.8) | 06_backend_schema.sql에 스키마 정의 및 RLS 적용됨 | 스키마는 MVP에 포함, 기능은 Phase 2에 활성화 | 스키마 준비 비용 낮음. Phase 2 기능 추가 시 마이그레이션 불필요. |
| `metadata_sync_logs` 테이블 | 언급 없음 | 05_erd_rls.md, 06_backend_schema.sql에 정의됨 | MVP에 포함 (디버깅 및 감사 로그용) | add-to-library Edge Function 디버깅에 필수. 운영 초기 문제 추적 용이. |
| 검색 페이지당 결과 수 | 20건/페이지 (02_user_stories.md US-012) | 페이지네이션 offset 방식, 20건 단위 (07_edge_functions.md §2.1) | 20건/페이지, offset 방식 | Phase 2에서 cursor 방식 전환 검토 (EF-TBD-004). |

---

## 3. 통일된 용어 사전

| 통일 용어 | PM 표현 | FE 표현 | BE 표현 | 정의 |
|----------|--------|--------|--------|-----|
| **timeline_pin** (타임라인 핀) | 타임라인 핀, 핀 | Pin, PinCard, PinComposer | timeline_pins 테이블 | 특정 에피소드(또는 영화)의 특정 시간(timestamp_seconds)에 사용자가 남긴 감상 기록 |
| **timestamp_seconds** | 타임스탬프 (시간값) | TimecodeInput, timestamp | timestamp_seconds (INT) | 에피소드 시작 기준 경과 초 수를 정수로 저장한 값. 화면에서는 MM:SS 또는 HH:MM:SS 형식으로 표시 |
| **watch_status** (감상 상태) | 감상 상태, 시청 상태 | WatchStatusBadge, status | watch_status ENUM | wishlist(보고 싶음) / watching(보는 중) / completed(완료) / dropped(드랍) 중 하나 |
| **contents** (콘텐츠) | 작품, 콘텐츠 | ContentCard, content | contents 테이블 | 외부 API에서 가져온 작품 메타데이터. 사용자가 라이브러리에 추가할 때만 DB에 저장됨 |
| **user_library_items** (라이브러리 항목) | 라이브러리, My Library | useLibrary, LibraryItem | user_library_items 테이블 | 사용자와 콘텐츠의 연결 레코드. 감상 상태를 보유 |
| **user_episode_progress** (에피소드 진행률) | 에피소드 진행률, 시청 완료 | EpisodeCheckbox, progress | user_episode_progress 테이블 | 사용자가 특정 에피소드를 시청 완료로 체크한 기록 |
| **source_api / api_source** (API 출처) | 출처 API, TMDB, AniList | external_source, apiSource | source_api (contents), api_source (content_external_ids) | 콘텐츠 데이터를 가져온 외부 API. tmdb / anilist / kitsu / tvmaze 중 하나 |
| **external_id** (외부 ID) | 외부 API ID | externalId | source_id (contents), external_id (content_external_ids) | 외부 API에서 해당 콘텐츠를 식별하는 원본 ID 문자열 |
| **emotion** (감정) | 감정 | EmotionSelector, emotion | emotion_type ENUM | 핀에 기록하는 감정. 10종 사전 정의 (감동, 설렘, 긴장, 놀람, 즐거움, 슬픔, 분노, 공포, 공감, 최고) |
| **is_spoiler** (스포일러 플래그) | 스포일러 여부, 스포일러 | SpoilerToggle, isSpoiler | is_spoiler BOOLEAN | 핀의 메모에 스포일러가 포함되었는지 여부. 목록에서 블러 처리의 기준 |
| **tags** (태그) | 태그 | TagChip, TagInput | tags 테이블, timeline_pin_tags 테이블 | 사용자가 핀에 자유롭게 입력하는 텍스트 레이블. 핀 필터링에 사용 |
| **service_role** | Edge Function 권한 | (FE 미사용) | service_role (Supabase) | RLS를 우회하여 모든 테이블에 읽기/쓰기 가능한 Supabase 서버 전용 권한. 클라이언트에 절대 노출 불가 |
| **Edge Function** | 서버 API | supabase.functions.invoke() | Supabase Edge Functions (Deno 런타임) | 외부 API 키 보호와 콘텐츠 메타데이터 쓰기(service_role 필요)를 처리하는 서버리스 함수 |
| **episode_id = null** (영화 핀) | 영화 타임라인 핀 | episodeId = null | episode_id IS NULL (timeline_pins) | 에피소드가 없는 영화/단편의 핀. episode_id를 null로 저장하고 content_id로 직접 식별 |

---

## 4. MVP 최종 범위

### P0 — 런칭 필수

앱이 존재하기 위한 최소 조건. P0 없이는 다른 기능 테스트 불가.

- 이메일 회원가입 / 로그인 (Supabase Auth)
- 세션 유지 (authStore Zustand)
- 콘텐츠 검색 (search-content Edge Function — TMDB + AniList)
- 검색 결과 목록 표시 (출처 API 레이블 포함)
- My Library에 작품 추가 (add-to-library Edge Function)
- 감상 상태 설정 (wishlist / watching / completed / dropped)
- My Library 목록 조회 (상태 탭 필터 포함)
- 타임라인 핀 생성 (timestamp_seconds + memo)
- 타임라인 핀 목록 조회 (timestamp_seconds ASC 정렬)
- 에피소드 단위 시청 완료 체크 (user_episode_progress)
- 전체 DB 마이그레이션 실행 (06_backend_schema.sql)
- 전체 사용자 데이터 테이블 RLS 적용 (P0 블로커 — 미적용 시 출시 불가)

### P1 — 중요하지만 연기 가능

핵심 가치 구현에 필수. P0 위에 올라가는 기능.

- 핀 수정 / 삭제
- 핀 태그 입력 및 저장 (tags, timeline_pin_tags)
- 핀 감정(emotion) 선택
- 핀 스포일러 플래그 + 목록에서 블러 처리
- 태그별 핀 필터링 (SCR-011 태그 칩)
- 감상 상태 변경 (상태 전환 규칙 적용)
- 에피소드 진행률 조회 (시즌 헤더 진행률 표시)
- 콘텐츠 상세 화면 (SCR-006 / SCR-008 통합)
- 에피소드 선택 화면 (SCR-009)
- My Page 화면 (SCR-014 — 통계 + 로그아웃 + 회원 탈퇴)
- Apple / Google 소셜 로그인 (P1 기능, 4주차 구현)
- 검색 결과 없음 / 에러 빈 상태 UI
- 라이브러리 작품 제거 (관련 핀 동시 삭제)
- fetch-episodes Edge Function (에피소드 lazy load)
- get-content-detail Edge Function (콘텐츠 상세)

### P2 — Post-MVP (Phase 2)

일정이 허용되면 포함. 없어도 앱은 동작하지만 완성도가 올라감.

- 태그별 핀 목록 화면 (SCR-013 — My Page에서 진입)
- 라이브러리 정렬 옵션 (추가일 / 이름 / 최근 활동)
- 콘텐츠 유형별 필터 (라이브러리)
- 최근 검색어 저장 (로컬 저장)
- 태그 자동완성 (기존 사용 태그 제안)
- 라이브러리 내 검색 (로컬 필터링)
- My Page 전체 태그 목록 조회 (US-061)
- Highlight Reel (SCR-012) [MVP 제외 — Post-launch 검토]

### MVP 제외 기능

- [MVP 제외 — Post-launch 검토] 소셜 공유 / 팔로우 / 커뮤니티
- [MVP 제외 — Post-launch 검토] 추천 알고리즘
- [MVP 제외 — Post-launch 검토] 알림 / 신작 알림
- [MVP 제외 — Post-launch 검토] 오프라인 모드
- [MVP 제외 — Post-launch 검토] 다크 모드
- [MVP 제외 — Post-launch 검토] 핀 Export (CSV, PDF)
- [MVP 제외 — Post-launch 검토] 다국어 지원 (영어 등)
- [MVP 제외 — Post-launch 검토] 시청 회차 개념
- [MVP 제외 — Post-launch 검토] 스포일러 블러 영구 해제
- [MVP 제외 — Post-launch 검토] 핀 목록 진행바형 뷰

---

## 5. 최종 화면 목록

### MVP 포함 화면

| 화면명 | route | 주요 기능 | 연결 화면 | 우선순위 |
|--------|-------|---------|----------|---------|
| 온보딩 | `(auth)/onboarding` | 앱 소개 슬라이드, 로그인/회원가입 진입 | 로그인/회원가입 | P0 |
| 로그인/회원가입 | `(auth)/login` | 이메일 폼, 소셜 로그인 버튼 | 홈/라이브러리 | P0 |
| 홈/라이브러리 | `(tabs)/index` | 라이브러리 목록, 감상 상태 필터 탭 | 콘텐츠 상세/시청 중, 검색 | P0 |
| 콘텐츠 검색 | `(tabs)/search` | 키워드 검색 입력, 유형 필터 칩 | 검색 결과 (동일 화면) | P0 |
| 검색 결과 | `(tabs)/search` (상태) | 결과 카드 목록, 출처 레이블, 무한 스크롤 | 콘텐츠 상세 | P0 |
| 콘텐츠 상세 | `content/[id]/index` | 포스터, 줄거리, 라이브러리 추가 버튼 | 라이브러리 추가 바텀 시트, 현재 시청 중 상세 | P1 |
| 현재 시청 중 상세 | `content/[id]/index` (라이브러리 진입) | 감상 상태 변경, 핀 요약, 에피소드 목록 버튼 | 에피소드 선택, 핀 목록 | P1 |
| 라이브러리 추가 (바텀 시트) | 모달 (SCR-007) | 감상 상태 선택 후 즉시 저장 | 콘텐츠 상세 (업데이트됨) | P0 |
| 에피소드 선택 | `content/[id]/episodes` | 시즌 탭, 에피소드 체크박스, 핀 수 배지 | 핀 생성, 핀 목록 (에피소드 단위) | P1 |
| 타임라인 핀 생성/편집 | `pins/new`, `pins/[id]` | 타임스탬프 입력, 메모, 태그, 감정, 스포일러 토글 | 핀 목록 | P0/P1 |
| 타임라인 핀 목록 | `content/[id]/pins` | 핀 카드 목록, 태그 필터, 스포일러 블러 | 핀 생성/편집 | P0 |
| 태그별 핀 목록 | `tags/[tagId]` | 선택 태그 핀 목록, 태그 전환 | 핀 편집, 콘텐츠 상세 | P2 |
| My Page | `(tabs)/profile` | 감상 통계, 로그아웃, 회원 탈퇴 | 태그별 핀 목록, 온보딩 | P1 |

### MVP 제외 화면

| 화면명 | 제외 이유 | 예정 Phase |
|--------|---------|-----------|
| 명장면 모음 (Highlight Reel, SCR-012) | 소셜 요소 포함. 개인 기록 경험 안정화 우선 | Phase 2 |
| 설정 화면 (다크 모드, 알림) | UX 개선 항목. MVP 필수 아님 | Phase 2 |
| 핀 Export 화면 | 니즈 검증 후 판단 | Phase 2 |
| 비밀번호 찾기/재설정 (별도 화면) | 이메일 링크 방식으로 인라인 처리 가능 | MVP에서 인라인 처리 |

---

## 6. 최종 데이터 모델

### MVP 포함 테이블

```
[profiles] — 사용자 프로필 (auth.users와 1:1 연결)
핵심 컬럼: id (uuid PK, auth.users.id 참조), display_name, avatar_url, created_at, updated_at
RLS: SELECT/INSERT/UPDATE — auth.uid() = id. DELETE 없음 (auth.users CASCADE 처리).
```

```
[contents] — 외부 API 콘텐츠 메타데이터 (사용자 라이브러리 추가 시에만 생성)
핵심 컬럼: id (uuid PK), content_type (enum), source_api (enum), source_id, title_primary, title_original, poster_url, overview, air_year, created_at, updated_at
UNIQUE: (source_api, source_id)
RLS: SELECT — authenticated. INSERT/UPDATE/DELETE — service_role만 (정책 없음 = 차단).
```

```
[content_external_ids] — 콘텐츠 ↔ 외부 API ID 매핑
핵심 컬럼: id (uuid PK), content_id (FK → contents), api_source (enum), external_id
UNIQUE: (api_source, external_id)
RLS: SELECT — authenticated (검색 결과 라이브러리 중복 체크용). 쓰기 — service_role만.
```

```
[seasons] — 시리즈 시즌 메타데이터
핵심 컬럼: id (uuid PK), content_id (FK → contents CASCADE), season_number, title, episode_count, air_year, created_at, updated_at
UNIQUE: (content_id, season_number)
RLS: SELECT — authenticated. 쓰기 — service_role만 (fetch-episodes Edge Function).
```

```
[episodes] — 에피소드 메타데이터 (fetch-episodes Edge Function이 lazy load로 저장)
핵심 컬럼: id (uuid PK), season_id (FK → seasons CASCADE), content_id (FK → contents CASCADE), episode_number, title, air_date, duration_seconds, created_at, updated_at
UNIQUE: (season_id, episode_number)
RLS: SELECT — authenticated. 쓰기 — service_role만.
```

```
[user_library_items] — 사용자 라이브러리 항목 및 감상 상태
핵심 컬럼: id (uuid PK), user_id (FK → auth.users CASCADE), content_id (FK → contents RESTRICT), status (watch_status enum), added_at, updated_at
UNIQUE: (user_id, content_id)
RLS: SELECT/INSERT/UPDATE/DELETE — auth.uid() = user_id.
```

```
[user_episode_progress] — 에피소드별 시청 완료 기록
핵심 컬럼: id (uuid PK), user_id (FK → auth.users CASCADE), episode_id (FK → episodes RESTRICT), content_id (FK → contents RESTRICT, 비정규화), watched_at, created_at
UNIQUE: (user_id, episode_id)
RLS: SELECT/INSERT/UPDATE/DELETE — auth.uid() = user_id.
```

```
[timeline_pins] — SceneNote 핵심 자산. 타임라인 핀.
핵심 컬럼: id (uuid PK), user_id (FK → auth.users CASCADE), content_id (FK → contents RESTRICT), episode_id (FK → episodes SET NULL, nullable — 영화 핀), timestamp_seconds (INT, nullable, CHECK >= 0), display_time_label, memo (nullable, 최대 500자), emotion (emotion_type enum, nullable), is_spoiler (BOOLEAN, DEFAULT false), created_at, updated_at
CHECK: timestamp_seconds IS NOT NULL OR memo IS NOT NULL (둘 다 null 불가)
UNIQUE 제약 없음 (동일 시간대 복수 핀 허용)
RLS: SELECT/INSERT/UPDATE/DELETE — auth.uid() = user_id.
```

```
[tags] — 사용자 정의 태그
핵심 컬럼: id (uuid PK), user_id (FK → auth.users CASCADE), name (1~20자 CHECK), created_at
UNIQUE: (user_id, name)
RLS: SELECT/INSERT/UPDATE/DELETE — auth.uid() = user_id.
```

```
[timeline_pin_tags] — timeline_pins ↔ tags N:M 연결
핵심 컬럼: pin_id (FK → timeline_pins CASCADE), tag_id (FK → tags CASCADE)
PRIMARY KEY: (pin_id, tag_id)
RLS: SELECT/INSERT/DELETE — EXISTS (SELECT 1 FROM timeline_pins WHERE id = pin_id AND user_id = auth.uid()). user_id 컬럼 없으므로 핀 소유자 경유 간접 정책 사용.
```

```
[external_search_cache] — 외부 API 검색 결과 TTL 캐싱
핵심 컬럼: id (uuid PK), query_hash, query_text, source (enum), response_json (JSONB), expires_at, created_at
UNIQUE: (query_hash, source)
RLS: 모든 정책 없음 → authenticated 완전 차단. service_role만 접근 (Edge Function).
```

```
[metadata_sync_logs] — 콘텐츠 동기화 감사 로그 (불변, append-only)
핵심 컬럼: id (uuid PK), content_id (FK SET NULL), api_source, operation, status, request_payload (JSONB), response_snapshot (JSONB), error_message, synced_at
RLS: 모든 정책 없음 → service_role만 접근.
```

### 추후 확장 테이블

- `content_titles` — 다국어 제목 지원 (스키마는 MVP에 포함, Phase 2에서 데이터 활성화)
- `reviews` — 개인 평점/리뷰 (스키마는 MVP에 포함, Phase 2에서 기능 활성화)
- `pin_likes` — 핀 좋아요 (Phase 2 공개 핀 기능 시)
- `user_follows` — 팔로우 (Phase 3 소셜 기능 시)
- `content_pin_stats` — 콘텐츠별 핀 집계 (Phase 2 공개 핀 시 materialized view)

---

## 7. 최종 API / Edge Function 목록

### MVP 필수

| 구분 | 이름 | 목적 | 우선순위 |
|------|------|------|---------|
| Edge Function | `search-content` | 외부 API(TMDB + AniList) 검색 결과 통합 반환. TTL 캐시 활용 | P0 |
| Edge Function | `add-to-library` | 콘텐츠 메타데이터 저장(UPSERT) + user_library_items 생성. JWT에서 user_id 추출 | P0 |
| Edge Function | `get-content-detail` | 특정 콘텐츠 상세 정보 조회 (DB 우선, 없으면 외부 API) | P0 |
| Edge Function | `fetch-episodes` | 특정 시즌 에피소드 lazy load (DB 우선, 없으면 외부 API 후 저장) | P0 |
| Supabase Client | `timeline_pins` CRUD | 핀 생성/조회/수정/삭제 — RLS로 본인만 접근. Edge Function 불필요. | P0 |
| Supabase Client | `user_library_items` 상태 변경 | 감상 상태 UPDATE — RLS로 본인만 수정. 직접 SDK 호출. | P0 |
| Supabase Client | `user_episode_progress` 체크/언체크 | 에피소드 UPSERT/DELETE — RLS로 본인만 접근. 직접 SDK 호출. | P0 |
| Supabase Client | `tags` + `timeline_pin_tags` 관리 | 태그 find-or-create, 핀-태그 연결. 직접 SDK 호출. | P1 |
| Supabase Client | `user_library_items` 조회 | 라이브러리 목록, 상태 필터. 직접 SDK 호출. | P0 |
| Supabase Auth | 이메일 로그인/회원가입 | Supabase Auth 직접 연동 | P0 |
| Supabase Auth | Google / Apple 소셜 로그인 | OAuth 2.0 / Apple Sign-In | P1 |

### 추후 확장

- `delete-account` Edge Function — 계정 삭제 플로우 (auth.users DELETE + CASCADE) (Phase 1 강화)
- `sync-episode-metadata` Edge Function — 방영 중 작품 에피소드 갱신 스케줄러 (Phase 2)
- `export-pins` Edge Function — 핀 데이터 CSV/PDF 내보내기 (Phase 2)
- `send-notification` Edge Function — 신작 알림 (Phase 2)

---

## 8. 4주 개발 순서

### 1주차 — 기반 구축

- [ ] Expo 프로젝트 초기화 (Expo Router, TypeScript strict)
- [ ] Supabase 프로젝트 생성 및 로컬 환경 설정 (.env.local, supabase start)
- [ ] 전체 DB 마이그레이션 실행 (06_backend_schema.sql — 전체 섹션 1~8)
- [ ] RLS 정책 검증 (각 테이블 SELECT/INSERT/UPDATE/DELETE 정책 확인)
- [ ] Supabase Auth (이메일 로그인) 연동
- [ ] authStore (Zustand) 구현 — 세션, user, setSession
- [ ] 로그인 / 회원가입 화면 구현 (SCR-001, SCR-002) — React Hook Form + Zod
- [ ] Root layout — 인증 상태에 따른 라우트 보호 (auth guard)
- [ ] 탭 네비게이션 뼈대 (홈 / 검색 / My Page 탭 셸)

### 2주차 — 콘텐츠 검색 및 라이브러리

- [ ] search-content Edge Function 구현 (TMDB + AniList 병렬 호출, TTL 캐시)
- [ ] 콘텐츠 검색 화면 구현 (SCR-004/005 통합) — TanStack Query useInfiniteQuery
- [ ] 검색 결과 카드 컴포넌트 (출처 API 레이블, 라이브러리 상태 배지)
- [ ] get-content-detail Edge Function 구현
- [ ] 콘텐츠 상세 화면 구현 (SCR-006) — 포스터, 줄거리, 라이브러리 추가 버튼
- [ ] add-to-library Edge Function 구현
- [ ] 라이브러리 추가 바텀 시트 (SCR-007) — 감상 상태 선택
- [ ] 홈/라이브러리 화면 구현 (SCR-003) — FlashList, 상태 탭 필터
- [ ] 감상 상태 변경 기능 — Optimistic Update 적용
- [ ] 검색/라이브러리 빈 상태 / 에러 상태 UI

### 3주차 — 핵심: 타임라인 핀

- [ ] fetch-episodes Edge Function 구현
- [ ] 현재 시청 중 상세 화면 구현 (SCR-008) — 감상 상태, 핀 요약, 에피소드 버튼
- [ ] 에피소드 선택 화면 구현 (SCR-009) — 시즌 탭, 체크박스, 핀 수 배지
- [ ] 에피소드 진행률 체크/언체크 — UPSERT/DELETE, Optimistic Update
- [ ] TimecodeInput 컴포넌트 구현 — 자동 포맷(blur 시), MM:SS/HH:MM:SS 변환
- [ ] PinComposer 화면 구현 (SCR-010 생성 모드) — timestamp, memo, tag, emotion, spoiler
- [ ] 핀 목록 화면 구현 (SCR-011) — FlashList, timestamp_seconds ASC 정렬
- [ ] 스포일러 블러 처리 — Jotai revealedSpoilerPinIdsAtom
- [ ] 핀 수정 화면 (SCR-010 편집 모드) — 기존 값 로드, 변경 감지 경고
- [ ] 핀 삭제 — 확인 팝업, timeline_pin_tags CASCADE 확인
- [ ] 태그 입력 컴포넌트 — 자유 입력, 칩 추가/제거, tags find-or-create
- [ ] 태그별 핀 필터링 (SCR-011 태그 칩)
- [ ] 감정(emotion) 선택 UI — 수평 스크롤 10종

**⚠️ 3주차 커트 권고:** 태그 필터링(SCR-011), 스포일러 블러, 핀 편집 모두를 3주차에 완성하는 것은 일정이 빡빡하다. 핀 생성/조회를 3주차 초반에 완성하고, 핀 수정/태그 필터/감정은 4주차 초반으로 이월할 것을 권고한다.

### 4주차 — 통합, QA, 배포 준비

- [ ] Apple / Google 소셜 로그인 통합 — OAuth 설정, Supabase Auth 연동
- [ ] My Page 화면 구현 (SCR-014) — 통계 쿼리, 로그아웃, 회원 탈퇴
- [ ] 태그별 핀 목록 화면 (SCR-013, P2) — 일정 여유 시 포함
- [ ] 전체 플로우 통합 테스트 — 검색 → 라이브러리 추가 → 핀 생성 → 핀 조회
- [ ] RLS 보안 검증 — 다른 사용자 데이터 접근 불가 실제 쿼리 테스트
- [ ] 에러 상태 / 빈 상태 전체 적용 (모든 화면)
- [ ] 외부 API 장애 시 graceful degradation 확인 (partial=true 배너)
- [ ] 영화 핀 플로우 확인 (episodeId=null)
- [ ] FlashList 성능 확인 (핀 20개+ 시나리오)
- [ ] timestamp_seconds >= 0 검증 확인 (DB CHECK + Zod)
- [ ] 동일 에피소드 복수 핀 / 동일 시간대 복수 핀 허용 확인
- [ ] Expo EAS Build 설정 (eas.json, app.json)
- [ ] TestFlight / Google Play 내부 테스트 등록

**⚠️ 4주 현실성 경고:** Apple/Google 소셜 로그인은 OAuth 앱 등록, App Store Connect 설정, 기기 테스트가 필요하다. 최소 2~3일을 별도로 확보해야 한다. EAS Build 초기 설정도 1일 이상 소요될 수 있다. P2 항목(SCR-013, 라이브러리 정렬 등)은 4주 내 구현이 불확실하므로 Phase 2로 확실히 분리하는 것을 권고한다.

---

## 9. 리스크 목록

- **리스크**: AniList 에피소드 목록 API 미지원 가능성. AniList는 시즌 단위 분리가 아닌 작품 단위로 에피소드 총 수만 제공할 수 있다.
- **영향도**: 높음
- **발생 가능성**: 높음
- **대응 방안**: AniList 작품은 단일 시즌(season_number=1)으로 저장하고 에피소드 수는 episodes 필드로 처리. 에피소드별 제목/방영일은 TMDB 또는 Kitsu(Phase 2)에서 보완. fetch-episodes 구현 전 AniList relations API 검증 필수 (EF-TBD-002 결정).
- **담당 역할**: Tech Lead, BE

---

- **리스크**: 외부 API Rate Limit 초과 시 검색 기능 장애. TMDB 40 req/sec, AniList 90 req/min 추정값이 실제와 다를 수 있다.
- **영향도**: 높음
- **발생 가능성**: 중간
- **대응 방안**: TTL 1시간 캐싱으로 동일 검색어 반복 호출 차단. Promise.allSettled로 일부 API 실패 시 나머지 결과 반환(partial=true). 베타 출시 후 실제 Rate Limit 한도 검증 필요.
- **담당 역할**: BE, Tech Lead

---

- **리스크**: 4주 일정 내 Apple/Google 소셜 로그인 완성 실패. OAuth 앱 등록 지연 또는 Apple 심사 정책 변경.
- **영향도**: 중간
- **발생 가능성**: 중간
- **대응 방안**: 이메일 로그인(P0)을 먼저 안정화하고 소셜 로그인은 P1로 분리. TestFlight 배포 전 소셜 로그인 미완성 시에도 이메일 로그인만으로 내부 테스트 가능. Apple Sign-In은 iOS 앱 스토어 심사 정책상 필수이므로 앱 스토어 공개 전 반드시 완성.
- **담당 역할**: FE, PM

---

- **리스크**: Supabase Edge Function CPU 사용량이 무료 플랜 한도(500,000 CPU ms/월)를 초과할 가능성. search-content 함수가 캐시 미스 시 최대 10,000ms 소비.
- **영향도**: 중간
- **발생 가능성**: 중간
- **대응 방안**: 캐시 TTL 기간 내 동일 검색어 반복 요청 캐시 히트 유도. add-to-library에서 클라이언트가 이미 조회한 메타데이터를 함께 전달하여 외부 API 재호출 생략(prefetched_meta 옵션). MAU > 500명 시 Pro 플랜($25/월) 전환 기준 설정.
- **담당 역할**: BE, Tech Lead

---

- **리스크**: RLS 정책 누락으로 사용자 데이터 노출. 특히 `timeline_pin_tags`의 간접 정책이 복잡하여 실수 가능성 존재.
- **영향도**: 높음
- **발생 가능성**: 낮음
- **대응 방안**: [P0 블로커] RLS 미적용 시 출시 불가. 4주차에 다른 사용자 계정으로 실제 쿼리 테스트 필수. timeline_pin_tags는 EXISTS 서브쿼리 방식으로 구현 완료됨(06_backend_schema.sql §6.12). `supabase db test` 또는 별도 RLS 테스트 스크립트 작성 권장.
- **담당 역할**: BE, Tech Lead

---

- **리스크**: FlashList 동적 크기 핀 카드에서 성능 저하. 핀 카드는 메모 길이, 태그 수, 스포일러 여부에 따라 크기가 가변적.
- **영향도**: 중간
- **발생 가능성**: 중간
- **대응 방안**: `estimatedItemSize`를 핀 카드 평균 높이(약 100~120px)로 설정. 실제 핀 20개+ 시나리오로 성능 측정. 기준 미달 시 FlatList로 fallback 또는 핀 카드 레이아웃 단순화. 4주차 성능 테스트 항목에 포함.
- **담당 역할**: FE

---

- **리스크**: TMDB의 한국 드라마 vs. 일본 드라마 자동 구분 실패. `origin_country` 필드 기반 구분은 완전하지 않을 수 있다.
- **영향도**: 낮음
- **발생 가능성**: 높음
- **대응 방안**: MVP에서는 드라마 유형을 `other`로 저장하고 콘텐츠 상세 화면에서 유형 표시 없이 진행. 유형 구분은 Phase 2에서 `origin_country` + 추가 메타데이터로 처리. 사용자 경험에 미치는 영향 낮음 (핵심 기능은 핀임).
- **담당 역할**: BE, PM

---

- **리스크**: 에피소드 정보가 없는 방영 중 작품의 새 에피소드 반영 불가. fetch-episodes는 DB에 없을 때만 외부 API를 호출하므로 초기 로드 후 신규 에피소드 갱신 미지원.
- **영향도**: 중간
- **발생 가능성**: 높음
- **대응 방안**: MVP 한계로 명시. UI에서 "에피소드 정보는 처음 로드 시점 기준" 안내 표시 검토. Phase 2에서 `pg_cron` 기반 정기 갱신 스케줄러 구현. 사용자가 에피소드 화면에서 "새로고침" 버튼으로 수동 재조회 옵션 추가 가능.
- **담당 역할**: BE, PM

---

- **리스크**: EAS Build 설정 복잡도로 인한 배포 지연. eas.json 설정, 인증서 관리, 스토어 앱 등록이 처음이면 상당한 시간 소요.
- **영향도**: 중간
- **발생 가능성**: 중간
- **대응 방안**: 4주차 초반(4-A 이전)에 EAS Build 환경 설정을 시작. TestFlight는 Apple Developer 계정($99/년) 필수이므로 사전 계정 준비. Google Play 내부 테스트는 Play Console 계정($25 일회성) 필요. 배포 문서 미리 검토.
- **담당 역할**: FE, PM

---

## 10. 최종 개발 체크리스트

### PM / 서비스 기획 체크리스트

- [ ] 모든 P0 화면 정의서 완성 (SCR-001~011, SCR-014)
- [ ] 엣지 케이스 처리 정책 확정 (09_timeline_pin_ux.md EC-001~EC-012)
- [ ] MVP 출시 기준 (DoD) 팀 합의 완료 (01_product_requirements.md §8)
- [ ] TBD-001 (타임스탬프 null 허용) 확정 → 최종 결정: null 허용, NULLS LAST 정렬
- [ ] TBD-002 (메모 null 허용) 확정 → 최종 결정: null 허용, DB CHECK로 방어
- [ ] TBD-005 (태그 구분자) 확정 → 최종 결정: Enter, 쉼표만 허용 (스페이스 제외)
- [ ] TBD-006 (이메일 인증 필수 여부) 확정 → 최종 결정: 즉시 로그인 (이메일 인증 없음)
- [ ] TBD-007 (completed → watching 전환 시 진행률) 확정 → 최종 결정: 기존 기록 유지
- [ ] 영화 핀 진입 경로 화면 정의 확정 (SCR-008에서 "핀 추가" 버튼 노출 여부)
- [ ] 라이브러리 제거 시 핀 삭제 경고 문구 확정
- [ ] AniList 콘텐츠 시즌 구조 처리 정책 사용자 공지 여부 결정

### Mobile App Architect 체크리스트

- [ ] ERD 최종 확정 (content_titles, reviews, metadata_sync_logs 포함)
- [ ] RLS 정책 전체 테이블 커버 (profiles 포함 12개 테이블 전체)
- [ ] Edge Function 경계 결정 확정 — 핀 CRUD는 직접 SDK, 메타데이터 쓰기는 EF
- [ ] TBD-001, TBD-002 미결 사항 최종 결정 반영 (위 PM 체크리스트와 동기)
- [ ] EF-TBD-001 (TMDB TV/Movie 구분) 결정 → add-to-library Request Body에 media_type 추가 권장
- [ ] EF-TBD-002 (AniList 시즌 구조) 결정 → season_number=1 단일 시즌 처리 권장
- [ ] TanStack Query staleTime 설정 팀 합의 (핀 30초, 라이브러리 60초 등)
- [ ] Optimistic Update 적용 범위 확정 (에피소드 체크, 핀 삭제, 감상 상태 변경)
- [ ] 인덱스 우선순위 P0 3개 (IDX-01, IDX-02, IDX-03) 마이그레이션 포함 확인
- [ ] 계정 삭제 CASCADE 체인 검증 계획 수립

### Supabase Backend Architect 체크리스트

- [ ] 전체 마이그레이션 SQL 실행 검증 (로컬 supabase start 환경)
- [ ] RLS 정책 실제 쿼리로 검증 (다른 user_id로 데이터 접근 시도 테스트)
- [ ] search-content Edge Function 구현 완료 (TMDB + AniList 병렬, TTL 캐시, 07_edge_functions.md §3 참조)
- [ ] add-to-library Edge Function 구현 완료 (07_edge_functions.md §4 참조)
- [ ] get-content-detail Edge Function 구현 완료
- [ ] fetch-episodes Edge Function 구현 완료
- [ ] Supabase Secrets에 API 키 등록 (TMDB_API_KEY — 부록 A 체크리스트)
- [ ] external_search_cache 만료 레코드 정리 전략 결정 (pg_cron 지원 여부 확인)
- [ ] metadata_sync_logs INSERT가 실제로 동작하는지 add-to-library 호출로 확인
- [ ] AniList 에피소드 목록 API 지원 여부 실제 검증 (EF-TBD-002)
- [ ] TMDB TV/Movie 구분 로직 검증 (EF-TBD-001)
- [ ] Supabase 무료 플랜 Edge Function CPU 한도 모니터링 대시보드 설정

### RN Expo UI Architect 체크리스트

- [ ] TimecodeInput 컴포넌트 구현 및 테스트 (자동 포맷, blur 시 변환, MM:SS/HH:MM:SS)
- [ ] PinComposer 폼 유효성 검증 확인 (React Hook Form + Zod, createPinSchema)
- [ ] FlashList 성능 확인 (핀 20개+ 시나리오, estimatedItemSize 설정)
- [ ] 스포일러 블러 동작 확인 (Jotai revealedSpoilerPinIdsAtom, 화면 재진입 시 재블러)
- [ ] 영화 핀 (episodeId=null) 플로우 확인 — pins/new.tsx에서 episodeId 없을 때 처리
- [ ] authStore Zustand persist 동작 확인 (앱 재실행 시 세션 유지)
- [ ] TanStack Query 캐시 무효화 패턴 구현 (04_architecture.md §12 참조)
- [ ] Expo Router 라우트 보호 (인증 전 접근 차단) 확인
- [ ] 에러/빈/로딩 상태 컴포넌트 전체 화면 적용 확인
- [ ] 동일 시간대 복수 핀 목록 정렬 표시 확인 (created_at ASC 동점 처리)
- [ ] 에피소드 런타임 없을 때 타임스탬프 초과 검증 생략 확인

### QA 체크리스트

- [ ] 핵심 플로우 E2E: 검색 → 라이브러리 추가 → 핀 생성 → 핀 조회
- [ ] RLS: 다른 사용자 데이터 접근 불가 확인 (직접 Supabase 쿼리로 검증)
- [ ] 외부 API 장애 시 에러 상태 표시 확인 (TMDB 오프라인 시뮬레이션)
- [ ] 동일 에피소드 복수 핀 / 동일 시간대 복수 핀 허용 확인
- [ ] timestamp_seconds >= 0 검증 확인 (음수 입력 거부)
- [ ] 영화 핀 생성 플로우 (episode_id = null) 확인
- [ ] 스포일러 핀 블러 표시 및 "보기" 버튼 해제 확인
- [ ] 라이브러리 50개 이상 보유 시 FlashList 스크롤 성능 확인
- [ ] 핀 삭제 시 timeline_pin_tags CASCADE 삭제 확인
- [ ] 에피소드 마지막 화 체크 시 "완료 상태 변경?" 팝업 표시 확인
- [ ] 네트워크 없는 상태에서 검색 시도 시 에러 토스트 표시 확인
- [ ] iOS / Android 양쪽 빌드 정상 확인 (EAS Build)
- [ ] timestamp_seconds > episode_duration_seconds 시 저장 불가 확인 (런타임 있는 경우)
- [ ] 회원 탈퇴 후 모든 사용자 데이터 삭제 확인 (contents는 유지)
- [ ] 앱 재실행 시 로그인 세션 자동 유지 확인
