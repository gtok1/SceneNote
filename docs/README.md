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
| 화면·컴포넌트·UI 명세 | [00 UI 스타일 규칙](00_ui_style_rules.md) (웹·앱 공통, AI 작업용) | 토큰·레이아웃 함수·`Alert` 금지·검증 절차·완료 체크리스트 |

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
| [33 국내 OTT 시청 가능 우선](33_kr_ott_availability_spec.md) | 추천 후보를 국내 OTT 제공작으로 한정, 상대 순위 라벨 제거, 보러가기 광고형·해외 제공 안내·AniList 조회 | 신규: 미구현 |
| [34 검색 시즌·인물 복원](34_search_seasons_and_people_restore_spec.md) | 시즌 카드 합쳐짐 정정, 배우·성우 검색·좋아하는 인물·인물 탭 복원. 11·19의 인물 제외를 인물 기능에 한해 대체 | 신규: 미구현 |
| [35 검색 누락·배포 불일치](35_search_completeness_and_deploy_drift_spec.md) | 배포 불일치 점검 도구, 저장 필터의 숨김 결과 표시, 애니 오분류, 시즌 카드 시리즈명, 검색 골든셋 | 신규: 미구현 |
| [36 인물 탭 SaaS 개편](36_people_tab_saas_redesign_spec.md) | 32의 토큰·격자 구간으로 인물 탭 재구성, 공용 인물 카드, 빼기 되돌리기, 분류 세그먼트, 검색 디바운스 | 신규: 미구현 |
| [37 프로필 대시보드 개편](37_profile_dashboard_redesign_spec.md) | 32·36의 토큰·격자로 프로필 재구성, 해외 드라마·올해 본 작품 집계 정정, 연도 그래프 미상 묶음 제외, 장르 TOP 5, 계정 행·웹 탈퇴 확인 | 신규: 미구현 |
| [38 일본 인물 한글 이름](38_japanese_person_korean_name_spec.md) | 한글 이름 출처 우선순위·관용 표기 변환·저장 칸(0023)·기존 좋아하는 인물 백필·직접 입력 | 신규: 미구현 |
| [39 작품 상세 SaaS 개편](39_content_detail_saas_redesign_spec.md) | 히어로 + 2열 배치, 상태 세그먼트, 삭제 확인(31 U-2)·상태 위치(31 U-5), 한국어 메타, 웹 피드백 토스트 | 신규: 미구현 |
| [40 작품 상세 삭제 영역 정정](40_content_detail_delete_zone_fixes_spec.md) | 39의 삭제 버튼을 "목록 관리" 카드 + 빨간 테두리 버튼으로, 설명·실패 문구 | 신규: 미구현 |
| [41 추천 취향 보충 레인](41_taste_fill_recommendations_spec.md) | 빈 추천 원인 실측, 최신 레인 뒤 취향·필터·국내 OTT 보충, 결합 커서 | 신규: 미구현 |
| [42 추천 추가 지연 개선](42_recommendation_add_latency_spec.md) | 카드 단위 잠금·즉시 토스트·일괄 보충·라이브러리 재조회 디바운스·서버 빠른 경로/병렬/응답 뒤 작업 | 신규: 미구현 |
| [43 추천 추가 오입력 방지](43_recommendation_add_misclick_fixes_spec.md) | 클릭한 카드 위치 유지·identity 검증·동기 중복 잠금·자동 보충 경쟁 방지 | 구현 및 격리 웹 검사, 실제 계정·네이티브 미검증 |
| [44 핀 탭 SaaS 개편](44_pins_tab_saas_redesign_spec.md) | 감정 개수 칩·접히는 필터 카드·포스터 카드·960 미리보기 패널, 좁은 화면 카드 → 상세, 31 U-1·U-7 흡수 | 구현·커밋(`c6a0e7e`, `pinListUi` 테스트 통과 확인). 수동 확인 기록 없음 |
| [45 추천 연도 필터 배포 어긋남](45_recommendation_year_filter_deploy_skew_fixes_spec.md) | 연도 선택 시 빈 추천 원인 실측(운영 v20 연도 미지원), 재배포 + `applied_filters` 감지·전용 빈 상태 | 구현, `personalized-recommendations` v21 배포(2026-10-05 11:30). 웹 M-1은 사용자 캡처로 2025년 추천 표시 확인, iOS(M-3) 남음 |
| [46 추천 카드 완료 버튼](46_recommendation_complete_action_spec.md) | 추천 카드·빠른 보기에 "완료"(바로 완료 등록), "추가"는 그대로, 상태별 문구·잠금 공유 | 구현(코드 확인), 수동 미검증 |
| [47 추천 추가 묶음 12개 채우기](47_recommendation_batch_topup_spec.md) | 스크롤 묶음 목표(보이는 개수+12)까지 자동 이어 찾기, 스크롤 판정 목표 기준, 원인 분해 개발 기록 | 신규: 미구현 |
| [48 작품 상세 완료·진행 정정](48_content_detail_completed_progress_fixes_spec.md) | 완료면 모든 화 시청으로 계산, 진행 카드 완료 모드, 웹 `Alert` 확인 정정 | 신규: 미구현 |
| [49 제작진 표시 1단계](49_content_crew_display_spec.md) | 감독·작가·원작 매핑, 작품 상세·빠른 보기 표시(`get-content-detail` 재배포 필요), 목록은 2단계 | 구현(코드 확인), 재배포 전 |
| [50 제작진 2단계 저장·목록 표시](50_content_crew_storage_list_display_spec.md) | DB 저장(0024)·백필 스크립트·라이브러리/핀/공유 표시·검색 | 구현(코드 확인), 마이그레이션·배포·백필 전 |
| [51 추천 영화↔드라마 같은 작품 제외](51_recommendation_cross_type_library_match_fixes_spec.md) | 라이브러리 영화 항목과 추천 TV 항목 같은 작품 판정, 앱·서버 공유 함수 | 구현, `personalized-recommendations` v22 배포(2026-10-10). 수동 확인 남음 |
| [52 추천 첫 묶음 채우기](52_recommendation_first_batch_fill_spec.md) | 취향 보충 미리 받기·준비 조회 병렬화·진단 값, 이어 찾기 중 빈자리 스켈레톤 | 구현, `personalized-recommendations` v22 배포(2026-10-10 17:43). 로그인 수동 확인(M-1~M-3) 남음 |
| [53 이어 찾기 스켈레톤 정렬](53_recommendation_topup_skeleton_alignment_fixes_spec.md) | 스켈레톤을 첫 로딩과 같은 감싸기로 실제 카드 열에 맞춤 | 신규: 미구현 |
| [54 애니 후속 시즌 보러가기·라프텔 찾아보기](54_anime_sequel_watch_providers_fixes_spec.md) | **15~16장 후속 정정:** 선택 시즌 검증, 시리즈 대체 금지·캐시 분리, 템빨의 선공개/TV 방영일 차이 보정·구응답 재조회. 라프텔은 검색 링크로만 | get-watch-providers v5 배포·템빨 및 3기 실응답 확인(2026-10-20). 추천 함수 배포는 별도, 자세한 검증은 development_next_steps 참조 |
| [55 붙여 쓴 한국어 검색어 띄어쓰기 보정](55_korean_search_spacing_fallback_spec.md) | 1단계에 맞는 결과가 없을 때만 TMDB 2단계 띄어쓰기 질의, 골든 띄어쓰기 사례 7개 | 구현(`npm test` 1125/1126, 골든 19/19), `search-content` v27 배포(2026-10-11 22:53). 로그인 수동 확인(M-1~M-4) 남음 |
| [56 붙여 쓴 검색어 글자 수 조건 제거](56_korean_search_spacing_length_fixes_spec.md) | 짧은 검색어("너말고")도 공백 뺀 제목 기준으로 2단계 보정, 입력 중 자모 제외 | 구현·커밋(`bfcc3fd`). `search-content` 재배포 전(운영 v27은 docs/55까지) |
| [57 하단 탭 상태 표시 정리](57_bottom_nav_state_style_fixes_spec.md) | 호버·선택·키보드 포커스를 아이콘 알약 하나로 통일, 클릭 후 테두리 제거, 하단 여백 | 구현(코드 확인, 클라이언트만). 웹·앱 수동 확인 남음 |
| [58 배우·성우 판정 정정](58_person_category_classification_fixes_spec.md) | TMDB 출연작 비율로 양방향 판정, 앱 추측 삭제, 등록 직후 확인, 출연진 출처 | 구현(`npm test` 1162/1163), `get-person-detail` v11 배포(2026-10-13 20:15). 출연진 출처는 `get-content-detail` 배포(docs/50 순서) 후 반영. 수동 확인 M-1~M-5 남음 |
| [59 좋아하는 인물 판정 동기화](59_favorite_person_category_sync_spec.md) | 인물 탭을 열 때 서버 판정(`classify-people`)으로 저장된 배우·성우를 맞춤 | 구현(`npm test` 1166/1167), `classify-people` v1 배포(2026-10-13 20:45, 무인증 401 확인). 로그인 수동 확인 M-1~M-3 남음 |
| [60 핀 탭 맥락 패널·작품별 묶음·시즌 표기](60_pins_tab_context_and_grouping_fixes_spec.md) | 패널 "이 작품의 핀" 타임라인·작품 보기·핀 추가, 작품별 머리글 묶음, 카드 상대 날짜, `PIN_SELECT` 시즌 임베드(운영 구문 200 확인) | 구현(미커밋). 2026-10-15 검증: `npm test` 1199/1200(무관 기존 실패 1), typecheck·lint 통과, 토큰 검사 0줄. 사용자 캡처로 웹 패널 타임라인·상대 날짜·시즌 표기("시즌 3 · 86화") 확인. 작품별 묶음·375·iOS 수동 확인 남음 |
| [61 핀 탭 갤러리 보기](61_pins_gallery_view_spec.md) | 포스터 격자 갤러리를 기본으로(라이브러리 갤러리와 같은 틀·열), 목록 전환·기기 저장, 작품별 장면 카드, 목록 패널 간격 | 구현(미커밋, 2026-10-15 Claude 직접). `npm test` 1221/1222(무관 기존 실패 1), typecheck·lint 통과, 토큰 검사 0줄, 웹 번들 빌드 확인. 로그인 화면 수동 확인 M-1~M-5 남음 |
| [62 애니 검색 후속 시즌 누락](62_anime_search_all_seasons_fixes_spec.md) | AniList 시즌 펼치기 2기→전체(최대 8기), 붙여 쓴 검색어의 AniList 3단계 | 신규: 미구현. 구현 후 `search-content` 재배포 필요 |
| [63 회차 선택 API 화수 우선](63_episode_progress_count_choices_fixes_spec.md) | 화수가 있으면 1~화수 버튼, 없을 때만 공개 목록·직접 입력 | 신규: 미구현(앱만, 배포 불필요) |
| [64 추천 호출 비용 검증·정정](64_recommendation_invocation_cost_fixes_spec.md) | 호출 수 집계, 노출 기록 합치기, 이어 찾기 예산 확대, 자동 호출 상한 | 구현(`npm test` 1349/1349, 새 테스트 13개), `personalized-recommendations` v23 배포(2026-10-24 20:03, 무인증 401 확인). 로그인 측정 M-1~M-3 남음 |
| [65 검색 디바운스·요청 제한 시간](65_search_debounce_and_request_timeout_fixes_spec.md) | 검색 탭 300ms 디바운스·자모 제외·즉시 검색, 추천·검색 호출 제한 시간 여유 | 신규: 미구현(앱만, 배포 불필요) |
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
