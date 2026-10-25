# AGENTS.md

## 적용 범위와 작업 시작

이 파일은 저장소 공통 개발 규칙이다. 시작할 때 `pwd`, `git rev-parse --show-toplevel`, `git status --short`로 경로와 기존 변경을 확인하고, 수정 대상 경로의 `AGENTS.override.md`·하위 `AGENTS.md`도 확인한다. 같은 위치의 override가 있으면 이 파일이 실제로 로드됐다고 가정하지 않는다. 일반 Markdown·과거 프롬프트·QA 기록은 자동 적용 지침이 아니다.

- 처음 진입: [README](README.md), [문서 목차](docs/README.md).
- 작업 재개·검증 범위·미완료 확인: [development_next_steps](docs/development_next_steps.md).
- 요청 목적·변경 범위·완료 조건을 정하고 관련 기능의 진입점부터 추적한다. 다른 세션의 변경이 보이면 해당 파일을 다시 읽고 겹치지 않는 부분만 수정한다.
- 코드 현황과 확정 요구사항이 다르면 요구사항을 낮추지 않는다. 오래된 설명, 미구현 요구사항, 결정이 필요한 충돌을 구분해 기록한다.

## 작업 지시 문서 — 항상 먼저 읽기

작업을 시작하기 전에 아래 표의 **해당 작업에 필요한 문서**를 반드시 확인한다. 모든 문서를 매번 읽는 목록이 아니다. 이 문서들이 화면·기능 구현의 source of truth이며, 이 파일의 규칙과 충돌하면 개별 명세서가 우선한다. 같은 기능의 후속 명세가 명시적으로 고친 항목은 후속 명세를 적용하고 나머지 기존 계약은 보존한다.

| 문서 | 내용 | 언제 읽나 |
|------|------|-----------|
| `docs/00_codex_doc_pattern.md` | 명세서 + Codex 프롬프트 짝의 작성 패턴·스켈레톤·체크리스트 | 새 명세서나 작업 지시문을 **쓰기 전에** |
| `docs/00_ui_style_rules.md` | **웹·앱 공통 UI 규칙(AI 작업용).** 토큰, 반응형 구간·레이아웃 함수, 안전 영역·하단 탭, 44pt·접근성, 키보드, `Alert.alert` 금지(토스트·`confirmDestructive`), 오류 문구, 공용 컴포넌트, 웹·앱 검증 절차, 완료 체크리스트 | 화면·컴포넌트를 만들거나 고칠 때, UI 명세·프롬프트를 쓸 때 **항상** |
| `docs/11_screen_implementation_spec.md` | MVP 전체 화면 구현·QA 기준안. 화면 명세 포맷의 원본 | 화면을 만들거나 고칠 때 항상 |
| `docs/12_episode_progress_spec.md` | 시청 진행 위치(몇 화까지 봤는지) 설정 기능 전체 명세 | 라이브러리·진행률·이어보기 관련 작업 |
| `docs/13_codex_prompt_episode_progress.md` | 위 기능의 Codex 작업 지시문 (복붙용 단일 프롬프트) | 위 기능을 구현할 때 |
| `docs/14_codex_prompt_episode_progress_fixes.md` | 위 구현의 검증 결과와 결함 5건(F-1~F-5) 수정 지시문 | 진행 위치 기능을 손볼 때 |
| `docs/15_season_search_spec.md` | 한국어 시즌 표기(`N기`/`시즌 N`) 검색 명세. AniList·TMDB 시즌 모델 차이와 SEQUEL 체인 해석 | 검색·외부 API 어댑터 관련 작업 |
| `docs/16_codex_prompt_season_search.md` | 위 기능의 Codex 작업 지시문 (복붙용 단일 프롬프트) | 위 기능을 구현할 때 |
| `docs/17_season_library_tracking_spec.md` | 시즌 단위 라이브러리 추적 명세. `user_library_items.season_number` 도입과 검색 시즌 펼치기 | 검색·등록·시즌 관련 작업 |
| `docs/18_codex_prompt_season_library_tracking.md` | 위 기능의 Codex 작업 지시문 (복붙용 단일 프롬프트) | 위 기능을 구현할 때 |
| `docs/19_mobile_usability_spec.md` | 모바일 레이아웃·입력·접근성 요구사항 | 모바일 화면·입력을 수정할 때 |
| `docs/22_search_recommendations_restore_spec.md` | 검색 탭 추천 복구 요구사항 | 검색 추천 진입·로딩·장애 처리를 수정할 때 |
| `docs/26_recommendation_and_season_lookup_fixes_spec.md` | 코드 리뷰 결함 3건 명세. 추천 제공처 복구 보고(F-1)와 시즌 라이브러리 조회 폴백(F-2·F-3) | 추천 장애 보고·시즌 등록 상태 조회 관련 작업 |
| `docs/27_excluded_relationship_themes_spec.md` | 추천 피드에서 BL·GL·백합·퀴어 테마 작품을 하드 제외하는 명세. 테마 별칭 확장과 서버·클라이언트 이중 적용 | 추천 후보 필터·테마 분류 관련 작업 |
| `docs/28_recommendation_scroll_pagination_fixes_spec.md` | 추천 피드 스크롤 추가 로딩과 카드 액션 정렬 회귀 수정 명세 | 검색 추천 피드·추천 카드 화면 작업 |
| `docs/29_codex_prompt_recommendation_scroll_pagination_fixes.md` | 위 회귀 수정의 Codex 작업 지시문 | 위 결함을 구현할 때 |
| `docs/30_recommendation_fill_and_action_consistency_fixes_spec.md` | 추천 12개 미달·탐색 시간 초과와 카드 세 번째 행동 아이콘 노출 재수정 명세 | 검색 추천 보충·카드 행동 작업 |
| `docs/31_usability_review_fixes_spec.md` | 사용성 검토 결함 U-1~U-11. 모바일 핀 열기, 라이브러리 삭제 확인, 회차·시즌 장면순 정렬, 핀 상세 편집/삭제 이동, 에피소드 다음 회차 스크롤, 태그 제안 | 핀 탭·핀 작성·작품 상세·에피소드 목록 작업 |
| `docs/32_home_modern_redesign_spec.md` | 홈 모던 스타일 개편 1단계. 디자인 토큰(radius·typography·elevation), 홈 단일 콘텐츠 컨테이너·포스터 타일 격자, 하단 탭 알약 선택 표시 | 홈·공통 테마·하단 탭·카드 스타일 작업 |
| `docs/33_kr_ott_availability_spec.md` | 추천 피드를 국내 OTT(정액제·무료·광고형) 시청 가능 작품으로 한정, "이번 달 인기 N위" 제거, 보러가기 광고형·해외 제공 안내·AniList 애니 조회·JustWatch 표기 | 추천 후보 수집·추천 카드·작품 상세 보러가기·TMDB 시청 제공처 작업 |
| `docs/34_search_seasons_and_people_restore_spec.md` | 검색 시즌 카드가 같은 TMDB id로 합쳐지는 결함 정정(서버·클라이언트), 배우·성우 검색과 좋아하는 인물 기능 복원(`PEOPLE_FEATURES_ENABLED`, 인물 탭 6번째 탭). docs/11·19의 인물 제외 결정을 인물 기능에 한해 대체 | 검색 결과 병합·시즌 카드·인물 검색·좋아하는 인물·하단 탭 작업 |
| `docs/35_search_completeness_and_deploy_drift_spec.md` | "TMDB에 있는데 검색 안 됨" 근본 정정: Edge Function 배포 불일치 점검(`npm run edge:drift`), 저장 필터가 결과를 조용히 버리지 않게(숨김 개수·모두 보기), 실사 일드 애니 오분류, 시즌 카드 시리즈명 표시, 검색 골든셋(`npm run search:golden`) | 검색 결과·검색 필터·Edge Function 배포 확인 작업 |
| `docs/36_people_tab_saas_redesign_spec.md` | 인물 탭 SaaS 스타일 개편(`docs/32` 2단계 첫 화면). 기본 헤더 제거·단일 콘텐츠 컨테이너, 검색 결과·좋아하는 인물 공용 `PersonCard` 격자(1/2/3열), ♥ 빼기 + 되돌리기 토스트, 분류 세그먼트를 좋아하는 인물에도 적용, 인물 검색 300ms 디바운스, 인물별 추가 중 상태 | 인물 탭·좋아하는 인물 UI 작업 |
| `docs/37_profile_dashboard_redesign_spec.md` | 프로필 탭 대시보드 개편. 기본 헤더 제거·단일 컨테이너, 숫자 카드 4개 + 타입·장르 2열 패널 + 연도 세로 막대(미상 묶음 각주), 해외 드라마 집계 정정(`libraryContentCategory`), 올해 본 작품 집계 일치, 장르 페이저 제거(TOP 5 + 그 외), 계정 목록 행·웹 회원 탈퇴 확인 | 프로필 탭·통계 패널·계정 행동 작업 |
| `docs/38_japanese_person_korean_name_spec.md` | 일본 인물 한글 이름 채우기. 출처 우선순위(직접 입력 > TMDB ko 번역 > 한글 별칭 > 가나 읽기 > 로마자), 관용 표기 변환기(`_shared/japaneseReading.ts`), `favorite_people.name_ko` 3칸 마이그레이션(0023), `resolve-person-names` 백필, 인물 상세 한글 이름 입력 | 인물 이름 표기·좋아하는 인물 데이터·인물 Edge Function 작업 |
| `docs/39_content_detail_saas_redesign_spec.md` | 작품 상세 SaaS 개편. 히어로(포스터 왼쪽·제목·한국어 메타·상태 세그먼트·행동 버튼) + 넓은 화면 2열(주: 진행·감상·줄거리·출연 / 옆: 보러가기·본 횟수·삭제), `docs/31` U-2 삭제 확인·U-5 상태 위치 흡수, 웹 `Alert` → 토스트 | 작품 상세 화면·상태 변경·삭제 작업 |
| `docs/40_content_detail_delete_zone_fixes_spec.md` | 작품 상세 "내 목록에서 삭제"를 다른 섹션과 같은 "목록 관리" 카드 + 빨간 테두리 알약 버튼으로 정정, 설명 문구·실패 토스트 한국어화 | 작품 상세 삭제 영역 작업 |
| `docs/41_taste_fill_recommendations_spec.md` | 검색 추천 빈 화면 정정: 원인 실측(운영 배포본 stale·월 커서 고정·테마 제외), 최신 레인 뒤 "취향 보충" 레인(취향 유형·장르 + 필터 + 국내 OTT, 기간 제한 없음), `tf1.` 결합 커서, `taste_fill_count` | 검색 추천·`personalized-recommendations` 작업 |
| `docs/43_recommendation_add_misclick_fixes_spec.md` | 추천 추가 중 카드 위치 유지·누르기 identity 검증·중복 잠금·자동 보충 경쟁 방지 | 추천 카드 추가·보충·셀 재사용 작업 |
| `docs/42_recommendation_add_latency_spec.md` | 검색 추천 "추가" 지연 개선: 카드 단위 잠금, 토스트 즉시, 보충 디바운스·일괄(목록 끝에), 라이브러리 재조회 디바운스(검색 화면만), `add-to-library` 빠른 경로·병렬 저장·응답 뒤 작업(`EdgeRuntime.waitUntil`) | 추천 추가·`add-to-library` 작업 |
| `docs/44_pins_tab_saas_redesign_spec.md` | 핀 탭 SaaS 개편: 감정 요약 카드+감정 필터를 개수 칩 한 줄로, 장르·태그는 접히는 "필터" 카드, 포스터·카드·미리보기 패널(960 이상) 토큰화, 좁은 화면 카드 누름 → 상세. `docs/31` U-1·U-7 흡수(필터 설계 대체), U-3의 `pinSort`·`pinLabels` 계약 사용 | 핀 탭 화면·핀 목록 UI 작업 |
| `docs/45_recommendation_year_filter_deploy_skew_fixes_spec.md` | 연도 선택 시 추천이 비는 문제: 원인은 앱(연도 재검사)·운영 서버(v20, 연도 미지원) 버전 어긋남(실측). 즉시 해결은 `personalized-recommendations` 재배포, 재발 방지로 응답 `applied_filters` + 앱 감지(`detectUnsupportedDiscoveryFilter`)·자동 이어 찾기 중단·전용 빈 상태("연도 해제") | 추천 발견 필터·서버 응답 계약·배포 순서 작업 |
| `docs/46_recommendation_complete_action_spec.md` | 검색 추천 카드·목록·빠른 보기에 "완료" 버튼(이미 본 작품을 `completed`로 바로 등록). "추가"는 그대로, 같은 잠금·자리 유지·보충 흐름, 상태별 문구 순수 함수. `docs/30` D-4의 추가 버튼 폭만 대체. 서버 변경 없음 | 추천 카드 행동·라이브러리 추가 상태 작업 |
| `docs/47_recommendation_batch_topup_spec.md` | 추천 스크롤 추가 묶음이 12개보다 짧게 붙는 문제: 자동 이어 찾기 목표를 "전체 12"에서 "묶음 목표(시작 시 보이는 개수+12)"로 일반화, 스크롤 판정 `targetCount`, 묶음별 원인 분해 개발 기록. 서버 변경 없음 | 추천 추가 로딩·자동 이어 찾기 작업 |
| `docs/48_content_detail_completed_progress_fixes_spec.md` | 작품 상세: "완료"면 모든 화를 본 것으로 **계산**(`resolveEpisodeProgress` `completed`, DB 쓰기 없음), 상태 변경 시 진행 캐시 재계산, 진행 카드 완료 모드, 웹에서 안 되던 `Alert` 확인(진행 되돌리기·에피소드 길게 누름)·감상 저장 오류 정정 | 작품 상세·시청 진행·상태 변경 작업 |
| `docs/49_content_crew_display_spec.md` | 감독·작가·원작(제작진) 1단계: TMDB `credits.crew`·AniList `staff` 매핑(`_shared/contentCrew.ts`), `get-content-detail` `crew`, 작품 상세 히어로·빠른 보기 표시. 목록 화면은 DB 저장 2단계 | 제작진 데이터·상세 표시·`get-content-detail` 작업 |
| `docs/50_content_crew_storage_list_display_spec.md` | 제작진 2단계: `contents.crew`·`crew_updated_at` 마이그레이션(0024, 작성만), Edge 최선 노력 저장(`saveContentCrew`), 방어적 읽기(`parseStoredCrew`), 라이브러리·핀 패널·공유 표시, 라이브러리 검색, 백필 스크립트(dry-run 기본). 적용·배포·백필은 사람 | 제작진 저장·목록 표시·백필 작업 |
| `docs/51_recommendation_cross_type_library_match_fixes_spec.md` | 라이브러리에 영화로 저장된 작품이 추천에 TV판으로 다시 뜨는 문제: 같은 작품 판정 공유 함수 `isSameRecommendationWork`(movie↔kdrama/jdrama/other, 연도 차 1년 이하·애니 제외), 앱 `isRegisteredRecommendation`·서버 `areSameWork` 적용 | 추천 라이브러리 제외·중복 판정 작업 |
| `docs/52_recommendation_first_batch_fill_spec.md` | 검색 추천 첫 응답이 2개만 오고 나머지가 늦게 붙는 문제: 준비 조회 병렬화, 취향 보충 페이지를 목록 탐색과 동시에 미리 받기(`planTasteFill`), 응답 `diagnostics`(단계별 시간·개수), 이어 찾기 중 스켈레톤 + "추천을 더 찾고 있어요 · n/목표" | 추천 첫 묶음 속도·채움 표시 작업 |
| `docs/53_recommendation_topup_skeleton_alignment_fixes_spec.md` | 이어 찾기 스켈레톤이 실제 카드보다 좌우 24px 안쪽인 문제: 첫 로딩 스켈레톤과 같은 감싸기(`sharedInset`)로 정렬, 꼬리말 좌우 여백 제거. 14장 Codex 실행 지시 포함 | 추천 스켈레톤·꼬리말 정렬 작업 |
| `docs/54_anime_sequel_watch_providers_fixes_spec.md` | AniList 후속 시즌 보완 매칭·라프텔 검색 연결. **15~16장(2026-10-20)**: 선택 시즌 제공처만 표시, 시리즈 대체/인접 연도 추정 금지, 시즌별 요청·캐시·구응답 검증. 템빨 선공개/방영일 7일 이내 보정·구응답 재조회. 14장 Codex 실행 지시는 후속 변경 우선 | 보러가기·OTT 제공처·AniList→TMDB 매칭 작업 |
| `docs/55_korean_search_spacing_fallback_spec.md` | 한국어 제목을 붙여 쓰면("너말고다른") 검색 0건인 문제: TMDB 단어 단위 일치 실측, 1단계에 맞는 결과가 없을 때만 "앞 k글자 + 공백 + 다음 1글자"(k=1~4) 질의를 TMDB에 2단계로 검색(`planKoreanWordSplitFallback`), `hasNextPage`는 1단계 기준, 골든 띄어쓰기 사례 7개. 14장 Codex 실행 지시 포함 | 검색어 변형·띄어쓰기·검색 누락 작업 |
| `docs/56_korean_search_spacing_length_fixes_spec.md` | docs/55 보정이 4글자 이상에만 실행되어 "너말고" 같은 짧은 검색어가 0건인 문제: 글자 수 조건 제거(기준은 공백 뺀 검색어 ⊂ 공백 뺀 제목), `filterResultsByCompactQuery`는 빈 검색어만 통과, 입력 중 자모는 제외, 짧은 골든 사례 4개. 14장 Codex 실행 지시 포함 | 검색어 변형·띄어쓰기·검색 누락 작업 |
| `docs/57_bottom_nav_state_style_fixes_spec.md` | 하단 탭 호버(셀 전체 사각형)·클릭 후 포커스 테두리(셀 전체, 아래 잘림)·선택 알약이 겹쳐 보이는 문제: 모든 상태를 아이콘 알약에만(선택 primarySoft, 호버·눌림 surfaceMuted, 키보드 포커스 테두리), 키보드 입력일 때만 테두리(`useInputModality`), 하단 여백 max(안전 영역, 6). 14장 Codex 실행 지시 포함 | 하단 탭·호버·포커스 표시 작업 |
| `docs/58_person_category_classification_fixes_spec.md` | 실사 배우(堺雅人 등)가 성우로 표시되는 문제: 서버 "목소리 3편 이상" 판정을 전체 출연작 비율(목소리·애니 ≥ 0.5, 본인·내레이션 제외) 양방향 판정으로 교체, 앱 대표작 문자열 추측 삭제, 등록 직후 서버 판정 확인, 작품 상세 출연진 `source`. 14장 Codex 실행 지시 포함 | 인물 배우·성우 판정·좋아하는 인물 작업 |
| `docs/59_favorite_person_category_sync_spec.md` | 서버 판정을 고쳐도 인물 탭 목록의 배우·성우가 안 바뀌는 문제(목록은 저장값만 읽음): 목록을 열 때 새 Edge Function `classify-people`로 TMDB 인물을 일괄 판정해 저장값과 다르면 고침(`useFavoriteCategorySync`), 등록 직후 상세 호출 삭제. 14장 Codex 실행 지시 포함 | 인물 배우·성우 판정·좋아하는 인물 작업 |
| `docs/60_pins_tab_context_and_grouping_fixes_spec.md` | 핀 탭 보완: 미리보기 패널이 카드 내용만 반복하는 문제 → "이 작품의 핀" 장면순 미니 타임라인(최신순·2개 이상, 최대 5행, 고르면 목록 스크롤)과 "작품 보기·핀 추가" 행동, "작품별" 정렬을 작품 머리글로 묶기, 375에서 잘리던 저장일을 메타 줄 상대 날짜로, `PIN_SELECT` 시즌 임베드(`src/utils/pinRow.ts`로 이동, `docs/31` U-3 일부). 14장 Codex 실행 지시 포함 | 핀 탭 화면·핀 목록 UI·핀 조회 select 작업 |
| `docs/61_pins_gallery_view_spec.md` | 핀 탭 갤러리 보기(기본) + 목록 전환: 라이브러리 갤러리와 같은 카드 틀·열 기준(1280→6, 960→5, 700→4, 그 외 2, 글자 배율 반영)의 포스터 격자, 갤러리는 모든 폭에서 패널 없이 카드 → 핀 상세, 보기 선택은 `pinsUiStore`(기기 저장), 작품별 갤러리는 한 줄 머리글(`span`) + 포스터 없는 장면 카드, 목록 패널 타임라인 간격 정리. 기존 테스트 수정 금지. 14장 Codex 실행 지시 포함 | 핀 탭 갤러리·보기 전환·핀 카드 UI 작업 |
| `docs/62_anime_search_all_seasons_fixes_spec.md` | 애니 검색에서 후속 시즌이 빠지는 문제(전생 귀족, 감정 스킬로 성공하다 1·2·3기): AniList 시즌 펼치기를 2기에서 이어지는 TV 시즌 전부(최대 8기)로, 붙여 쓴 검색어가 2단계에서 TMDB 애니를 찾으면 그 제목으로 AniList 3단계 검색(`planAniListAnimeFollowUp`), 캐시 버전 ko-v15. 14장 Codex 실행 지시 포함 | 애니 시즌 검색·AniList 시즌 해석 작업 |
| `docs/63_episode_progress_count_choices_fixes_spec.md` | 시청 진행 회차 버튼이 공개 에피소드 목록이 빌 때 사라지고 숫자 입력만 남는 문제: API 화수(시즌 화수→총 화수, 1~200)가 있으면 무조건 1~화수 버튼, 없으면 공개 목록, 둘 다 없을 때만 직접 입력(`resolveEpisodeChoiceMode`). 14장 Codex 실행 지시 포함 | 시청 진행 카드·회차 선택 작업 |
| `docs/64_recommendation_invocation_cost_fixes_spec.md` | 추천 호출 비용: 호출 수 집계(앱 이유별·서버 diagnostics), 노출 기록을 추천 응답에 합쳐 별도 호출 제거, 이어 찾기만 탐색 예산 확대(4초·키워드 32·6·6), 자동 호출 60초 12회 안전 상한. 12개 묶음·추가 후 묶음 규칙은 유지. 14장 Codex 실행 지시 포함 | 추천 호출 횟수·비용·이어 찾기 작업 |
| `docs/65_search_debounce_and_request_timeout_fixes_spec.md` | 검색 탭이 글자마다(한글 조합 중 포함) 작품·인물 검색 함수를 부르는 문제: 300ms 디바운스한 요청 검색어(`useSearchRequestQuery`), 조합 중 자모는 직전 값 유지, 검색 버튼·Enter·최근 검색어는 즉시. 추천·검색 호출 제한 10→14초, 추천 훅 제한·이어 찾기 최소 예산 12→15초. 14장 Codex 실행 지시 포함 | 검색 호출 비용·디바운스·요청 제한 시간 작업 |

**규칙**

- UI 작업(화면·컴포넌트·스타일)은 [docs/00_ui_style_rules.md](docs/00_ui_style_rules.md)를 따른다. 웹과 iOS·Android 앱을 함께 만족해야 완료다. UI 명세·프롬프트는 이 문서를 READ FIRST에 넣고 규칙을 다시 풀어 쓰지 않는다(다른 점만 쓴다).
- 명세 작성 방식의 기준은 [docs/00_codex_doc_pattern.md](docs/00_codex_doc_pattern.md)다. 새 명세는 **명세 파일(14장 "Codex 실행 지시" 포함) + 응답 본문의 짧은 복붙 프롬프트(명세 경로 지시)**로 제공한다. 기존 `NN_codex_prompt_*.md` 파일은 보존하되, 새 프롬프트 파일 생성은 요구하지 않는다. 기존 프롬프트를 사용할 때는 후속 명세와 현재 코드를 먼저 대조한다.
- 명세서의 **설계 결정(D-N) 항목은 임의로 바꾸지 않는다.** 바꿔야 한다고 판단되면 구현하지 말고 이유를 보고한다.
- 명세서에 테스트 표가 있으면 표의 모든 행을 테스트로 옮긴다. 임의로 줄이지 않는다.

## 프로젝트 개요

SceneNote는 애니메이션, 한국 드라마, 일본 드라마, 영화 감상 기록을 관리하고 특정 장면에 타임라인 핀을 남기는 모바일 앱이다. 핵심 가치는 검색이 아니라 개인 감상 기록과 `timestamp_seconds` 기반 핀 경험이다. 상세 설계는 `docs/`의 01~10 문서를 우선 참고한다.

## 기술 스택

- Expo + React Native + Expo Router
- TypeScript strict mode
- Supabase Auth, PostgreSQL, RLS, Edge Functions
- TanStack Query v5
- Zustand + 기존 Jotai atoms (사용처는 `docs/08_frontend_architecture.md`)
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
- `npm run build` — 웹 정적 export. 네이티브 스토어 빌드 명령이 아니다.
- Codex/AI 세션에서 Expo 웹 서버를 재기동하거나 검증용으로 띄울 때는 반드시 `8081` 포트만 사용한다.
- 재기동 명령은 `npm run web -- --port 8081 --localhost --clear`를 기본으로 하고, 임의의 다른 포트로 새 서버를 띄우지 않는다.
- `8081` 포트가 이미 사용 중이면 다른 포트로 우회하지 말고 기존 8081 서버를 확인하거나 종료 후 같은 포트로 다시 띄운다.
- 기존 서버를 재사용할 수 있는지 먼저 확인한다. `restart`, `web:restart`, `dev:restart` 스크립트는 이름으로 여러 프로세스를 종료할 수 있으므로 공유 작업 중 무심코 실행하지 않는다. 서버 종료·재기동이 요청 범위에 포함될 때만 대상 프로세스를 확인하고 수행한다.
- `backend:deploy`, `smoke:edge`, `import:netflix`, DB/secret 명령은 일반 정적 검증이 아니다. 부작용과 필요한 환경은 [검증·작업 재개 가이드](docs/development_next_steps.md)를 확인한다.

## 테스트 명령어

- `npm test` — `tsx --test`로 `src/**/*.test.ts`, `scripts/**/*.test.ts`, `supabase/functions/**/*.test.ts`, `supabase/functions/search-content/adapters/*.test.ts` 실행
- `npm run typecheck`
- `npm run lint`

테스트는 `node:test` + `node:assert/strict`를 쓴다. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다** — 순수 함수만 테스트한다. 참고: `src/utils/pinCache.test.ts`

`typecheck`와 `lint`는 설정상 `supabase/functions`를 제외한다. `npm test`도 화면 `.tsx`, 실제 Deno 핸들러 실행, 원격 RLS 검증을 대신하지 않는다. 문서만 바꾸면 경로·링크·명령·diff를 검사하고, 기능 코드를 바꾸면 관련 테스트와 타입/린트를 실행한다. 명세의 테스트 표는 자동/수동 결과를 모두 대응시키며, 실행하지 못한 행은 이유를 남긴다.

## 기능별 탐색과 공통 변경 영향

| 작업 | 먼저 볼 코드 | 함께 확인할 공통 영역 |
|------|-------------|----------------------|
| 인증·세션 | `app/_layout.tsx`, `src/providers/AppProviders.tsx`, `src/hooks/useAuth.ts` | `src/lib/supabase.ts`, `src/utils/authLinks.ts`, `src/stores/authStore.ts` |
| 검색·추천·시즌 등록 | `app/search.tsx`, `src/hooks/useContentSearch.ts`, `src/hooks/usePersonalizedRecommendations.ts` | `src/services/contentSearch.ts`, `src/services/library.ts`, `supabase/functions/search-content/`, `supabase/functions/_shared/` |
| 라이브러리·진행률 | `app/(tabs)/library.tsx`, `app/content/[id].tsx`, `app/content/[id]/episodes.tsx`, `src/hooks/useLibrary.ts` | `src/services/library.ts`, `src/utils/episodeProgress.ts`, `src/utils/seasonLibraryMatch.ts` |
| 핀·태그 | `app/(tabs)/pins.tsx`, `app/pins/new.tsx`, `app/pins/[id].tsx`, `src/components/pins/PinComposer.tsx` | `src/hooks/useTimelinePins.ts`, `src/services/pins.ts`, `src/utils/pinCache.ts`, `src/utils/timecode.ts` |
| DB·외부 API | `supabase/migrations/`, `supabase/functions/` | `src/types/database.ts`, `src/types/content.ts`, `supabase/functions/_shared/types.ts` |

`src/lib/query.ts`의 query key, 공통 UI/테마, 서비스 계약, 상태 저장소, `_shared` 모듈을 바꾸면 사용처를 검색하고 관련 화면·캐시 무효화·서버 응답·테스트까지 영향 범위를 확인한다. 라우트와 호출 흐름 상세는 [04](docs/04_architecture.md), [08](docs/08_frontend_architecture.md)에 있다.

## 코드 스타일

- TypeScript 타입을 명확히 작성한다.
- 서버 데이터는 TanStack Query, UI 상태는 Zustand로 관리한다.
- 기존 Jotai 기반 폼·스포일러 상태는 관련 작업 없이 이관하지 않는다. `watchProvidersAtom`의 서버 응답 캐시는 현재 원칙과 다른 구현으로, 새 서버 상태의 표준으로 복제하지 않는다.
- 기존 구조·명명·UI 동작을 우선하고 무관한 리팩터링이나 중복 유틸을 섞지 않는다. 오류를 숨기는 임시 우회로 완료 처리하지 않는다.
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

## 완료 보고와 문서 갱신

- 변경 파일·이유, 실제 실행한 검사·결과, 플랫폼별 수동 검증, 미실행 사유·남은 문제를 보고한다. 코드 존재, 정적 검토, 실행 성공, 동작 확인은 서로 다른 상태다.
- 기능 계약·설계 변경은 해당 명세, 경로·데이터 흐름 변경은 04/08, 실행·환경 변경은 README, 다음 작업·검증 증거는 `docs/development_next_steps.md`의 해당 항목만 갱신한다. 새 명세는 위 표와 문서 목차에 연결한다.
- 완료 이력과 테스트 개수를 모든 문서에 반복하지 않는다. QA 기록의 날짜·범위는 유지하며 현재 결과처럼 재사용하지 않는다.
- 지침 편집이 현재 세션에 자동 재적용됐다고 가정하지 않는다. 새 세션에서 실제 로드한 지침 경로와 우선순위를 확인한다.
