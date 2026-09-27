# SceneNote 문서 안내

문서는 **요구사항**, **코드 현황**, **당시 작업·검증 기록**을 구분해서 읽는다. 파일 존재나 체크리스트만으로 구현·배포 완료를 판단하지 않는다. 최초 실행은 [루트 README](../README.md), 공통 작업 규칙은 [AGENTS.md](../AGENTS.md)가 기준이다.

## 목적에 따라 시작하기

| 목적 | 읽을 문서 | 다음으로 확인할 근거 |
|------|-----------|--------------------|
| 프로젝트 파악·실행 | [README](../README.md), [04 아키텍처](04_architecture.md) | `package.json`, `app/_layout.tsx`, `src/providers/AppProviders.tsx` |
| 화면·기능 수정 | [11 화면 기준](11_screen_implementation_spec.md), 아래 해당 기능 명세, [08 프론트엔드](08_frontend_architecture.md) | 명세의 D-N·테스트 표와 해당 라우트/훅/서비스 |
| 결함 수정 | 해당 후속 fixes 명세, [검증 가이드](development_next_steps.md) | 재현 경로, 기존 순수 함수 테스트, 캐시·공통 모듈 사용처 |
| DB·외부 API 수정 | [05 ERD/RLS](05_erd_rls.md), [07 Edge Functions](07_edge_functions.md), [04 현황](04_architecture.md) | `supabase/migrations/`, `supabase/functions/`, `src/types/database.ts` |
| 작업 재개·출시 판단 | [development_next_steps](development_next_steps.md) | 마지막 실제 검증의 날짜·리비전·플랫폼·미실행 사유 |
| 새 명세·작업 지시 작성 | [00 작성 패턴](00_codex_doc_pattern.md) | 명세 파일 + 응답 본문 실행 프롬프트; AGENTS 표도 갱신 |

## 요구사항과 설계 문서

설계 결정은 코드와 다르다고 임의로 삭제하지 않는다. 같은 기능에 후속 명세가 있으면 그 문서가 명시적으로 수정한 항목을 적용하고 기존 나머지 계약은 유지한다. 해결 근거가 없는 충돌은 [다음 작업](development_next_steps.md)에 남긴다.

| 문서 | 역할·적용 조건 | 점검 상태 |
|------|---------------|-----------|
| [01 제품 요구사항](01_product_requirements.md), [02 유저 스토리](02_user_stories.md), [03 화면 흐름](03_screen_flow.md) | 초기 MVP 목표·요구사항. 현재 노출 기능 목록은 루트 README 확인 | 유지: 후속 명세와 함께 읽기 |
| [04 시스템 아키텍처](04_architecture.md), [08 프론트엔드 아키텍처](08_frontend_architecture.md) | 상단은 실제 경로·흐름, 기존 본문은 설계 원칙·예제 | 보완: 현황과 설계 구분 |
| [05 ERD/RLS](05_erd_rls.md), [06 초기 SQL](06_backend_schema.sql), [07 Edge Functions](07_edge_functions.md) | 초기 데이터·보안·API 계약. 현재 마이그레이션 전부를 대체하지 않음 | 유지: SQL 적용은 별도 작업 |
| [09 핀 UX](09_timeline_pin_ux.md), [10 MVP 통합 계획](10_mvp_integration_plan.md) | 초기 통합 결정과 핀 불변 조건. 과거 일정은 현재 일정이 아님 | 유지 |
| [11 화면 구현 기준](11_screen_implementation_spec.md) | 화면 수정의 공통 UX·QA 기준 | 유지 |
| [12 진행 위치](12_episode_progress_spec.md), [13 구현 지시](13_codex_prompt_episode_progress.md), [14 결함 수정](14_codex_prompt_episode_progress_fixes.md) | 시청 위치·완료 상태·이어보기 | 유지 |
| [15 시즌 검색](15_season_search_spec.md), [16 구현 지시](16_codex_prompt_season_search.md) | 한국어 시즌 표현, AniList/TMDB 차이 | 유지 |
| [17 시즌별 라이브러리](17_season_library_tracking_spec.md), [18 구현 지시](18_codex_prompt_season_library_tracking.md) | 시즌 등록·조회와 데이터 모델 | 유지 |
| [19 모바일 사용성](19_mobile_usability_spec.md), [20 구현 지시](20_codex_prompt_mobile_usability.md) | 좁은 화면·키보드·터치·접근성 | 유지 |
| [22 추천 복구](22_search_recommendations_restore_spec.md), [23 구현 지시](23_codex_prompt_search_recommendations_restore.md) | 검색 추천 탭·요청·오류 복구 | 유지 |
| [26 추천·시즌 조회 수정](26_recommendation_and_season_lookup_fixes_spec.md) | 제공처 복구 보고·시즌 라이브러리 조회 폴백 | 유지 |
| [27 추천 테마 제외](27_excluded_relationship_themes_spec.md) | 서버·클라이언트 테마 필터 계약 | 유지 |
| [28 추천 스크롤 회귀](28_recommendation_scroll_pagination_fixes_spec.md), [29 구현 지시](29_codex_prompt_recommendation_scroll_pagination_fixes.md), [30 추천 보충·행동 일관성](30_recommendation_fill_and_action_consistency_fixes_spec.md) | 추천 추가 로딩·12개 보충·카드 행동 | 유지: 30의 후속 수정 함께 확인 |
| [31 사용성 결함](31_usability_review_fixes_spec.md) | 핀 열기·삭제 확인·시즌/회차 정렬 등 U-1~U-11 | 요구사항 유지: U-1~U-3 코드 미충족 확인, 전체 완료 아님 |
| [32 홈 모던 개편](32_home_modern_redesign_spec.md) | 1단계: 디자인 토큰·홈 레이아웃·포스터 타일·하단 탭 스타일. 다른 화면은 2단계 | 신규: 미구현 |
| [장르 통계 설계](superpowers/specs/2026-05-03-genre-stats-design.md) | 장르 통계 설계 배경 | 참고: 현재 구현은 `src/hooks/useGenreStats.ts` 등과 대조 |

## 기록·과거 실행 지시

| 문서 | 역할과 주의 |
|------|------------|
| [implementation_notes](implementation_notes.md) | 2026-05-02 구현 기록. 당시 미구현·배포 상태를 현재 사실로 재사용하지 않음 |
| [development_next_steps](development_next_steps.md) | 상단은 현재 검증·후속 작업 기준, 하단 5월 기록은 역사 자료 |
| [21 모바일 QA](21_mobile_usability_qa_2026-09-09.md) | 2026-09-09 검증 범위와 로그인 이후 미검증 한계를 포함한 기록 |
| [24 추천 복구 QA](24_search_recommendations_restore_qa_2026-09-10.md), [25 추천 503 QA](25_recommendation_503_fix_qa_2026-09-10.md) | 날짜별 기록. 25는 24 이후 후속 QA이며 현재 서버의 보증이 아님 |
| [초기 Codex 프롬프트](codex_prompt.md), [설계 준수 수정 프롬프트](codex_implementation_prompt.md), [Cursor 검증 프롬프트](cursor_verification_prompt.md) | 참고 전용·중복 지시. 초기화/설치/과거 결함 단계를 통째로 재실행하지 않음 |
| [7월 로드맵](../migrations/7월/00_7월_개선_로드맵_개요.md)과 연결된 01~08 | 당시 기능 계획·요구사항. `migrations/7월/`은 Markdown 로드맵이며 DB 적용 파일은 `supabase/migrations/`에 있음. 제품 방향 관계는 판단 보류 |

## AI 지침과 스킬

- [AGENTS.md](../AGENTS.md): 공통 규칙과 작업별 읽기 경로. [CLAUDE.md](../CLAUDE.md): 같은 규칙을 참조하는 Claude용 안내.
- [.claude/agents](../.claude/agents/): 역할별 전문 지침. `.claude/agent-memory/`는 과거 기억이며 개인 메모를 새 문서로 복사하지 않는다.
- [Codex orchestrate](../.agents/skills/orchestrate/SKILL.md): 역할 산출물 통합의 진입점. [공통 절차](../.claude/skills/orchestrate/SKILL.md)를 참조한다. 일반 코드 수정·문서 점검에 강제 적용하지 않는다.
- 신규 스킬이나 별도 점검 보고서는 추가하지 않았다. 실행은 루트 README, 구조는 04/08, 검증·작업 재개는 development_next_steps에서 관리한다.

Codex 지침은 실행 시 구성되므로 편집 즉시 현재 세션에 재적용된다고 가정하지 않는다. 같은 위치의 override, 작업 디렉터리, 실제 로드한 지침 경로를 새 세션에서 확인한다. 저장소 스킬은 `.agents/skills` 아래에서 발견된다. 근거: [공식 AGENTS 안내](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [공식 스킬 안내](https://learn.chatgpt.com/docs/build-skills).
