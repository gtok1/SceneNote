# 검색 추천 복원 QA — 2026-09-10

22·23번 명세에 따른 후속 구현 기록이다. 21번 모바일 QA와 기존 명세서는 변경하지 않았다.

## 구현 결과

- 검색 추천 정책만 기본 활성화했다. 개인화 false는 모바일 개선 전 HEAD에도 있던 값이며 이번에 복원했다. 전역 확장 기능은 false를 유지했다.
- 빈/공백 검색에서 로그인·라이브러리 준비·화면 활성·온라인일 때 개인화를 요청한다. 일반 1자는 안내, 제목 2자 이상은 일반 검색, 자연어 유사 의도는 기준 탐색으로 분리했다.
- 기존 parser가 `한자와나오키`의 `와`를 유사 문법으로 오인하던 문제를 수정했다. `와/과`는 비교 문맥이 이어질 때만 trigger로 사용한다.
- 유사 카드·개인화 행동·예시·최근 검색어·URL 경로를 연결했다. 시즌을 URL/요청/캐시/카드/상세 경로에 보존하고, 검색 결과 병합과 낙관적 등록 키의 시즌 충돌도 수정했다.
- 개인화 자동 보충·수동 갱신·다음 배치·노출 기록은 동일 활성 수명을 따른다. 이탈/모드/인증 변화는 진행 요청을 abort하고 늦은 응답의 캐시 교체를 막는다. 추가 배치의 노출 기록은 ID 중복 제거 후 12개씩 처리한다. 피드백에 중복 제출 잠금과 10초 timeout을 적용했다.
- 오류와 0건을 구분하고 기존 카드 보존/재시도를 유지했다. 모든 공급자 차단 0건은 정상 empty로 처리하지 않는다.
- 복원된 버튼 44 이상, 글자 확대 시 열 축소, 모달 safe area/스크롤/focus 복귀를 적용했다. 검색창은 고정하고 늘어나는 추천 헤더/기록은 목록 안에서 스크롤한다.

주요 변경 파일: `app/search.tsx`, `src/constants/features.ts`, `src/hooks/usePersonalizedRecommendations.ts`, `src/hooks/useSimilarContent.ts`, `src/hooks/useNetworkOnline.ts`, `src/hooks/useContentSearch.ts`, `src/services/{personalizedRecommendations,similarContent,contentSearch}.ts`, 추천 카드/quick view/ThemeReductionSheet, `src/utils/{searchRecommendationPolicy,similarSearchIntent,recommendationLayout}.ts`.

## 실제 서버/환경 확인

- 기존 localhost:8081 서버와 로그인된 Chrome 탭 사용. 다른 포트/서버를 만들지 않았다.
- `supabase migration list --linked`: 로컬/원격 0001~0021 일치. 요청된 0017·0018·0019 모두 적용됨. 이는 migration 이력 확인이며 모든 테이블/RLS를 직접 SQL로 재검증한 것은 아니다.
- `supabase functions list`: personalized-recommendations ACTIVE v11, similar-content ACTIVE v3.
- 실제 로그인 UI: 한자와나오키 일반 검색 성공(일부 공급자 실패 안내), 시즌 2 기반 유사 결과 12개 성공. 도깨비 자연어 질의도 기준 TMDB 67915로 유사 12개 성공.
- Supabase 대시보드 Invocations에서도 18:43:06 / 18:51:21 / 18:53:02 POST 503 확인. 18:43:05 POST 200도 있으나 개인화 카드 성공을 뜻하지는 않는다. Function Logs에는 boot/shutdown만 있어 공급자별 오류 상세가 없다.
- 개인화는 실제 UI에서 HTTP 503을 반환했다. 로컬 Edge 코드에는 ALL_PROVIDERS_FAILED와 catch의 RECOMMENDATION_FAILED 두 503 분기가 있다. 후속 진단에서 실제 응답 body.error=ALL_PROVIDERS_FAILED를 확인했다. 세부 근거와 수정은 아래 후속 진단 절에 기록한다. 화면은 오류와 재시도를 표시한다. **개인화 서비스 완전 복구는 미완료**이다.
- SCENENOTE_TEST_EMAIL/PASSWORD가 설정되지 않았다. 실사용 계정의 라이브러리 추가/삭제, feedback 변경은 테스트하지 않았다. 검색 실행은 최근 검색어를 갱신한다. 개인화 화면 조회에는 정상 제품 동작인 자동 노출 기록 가능성이 있으므로 읽기 전용 DB 검사와 동일하다고 취급하지 않는다.
- 배포/마이그레이션 실행/RLS 우회/키 출력/커밋 없음.

## 자동 검증 및 기존 기대 변경

- `npm test`: 387/387 통과 (기존 379 + 신규 8). 기존 테스트 삭제/축소 없음.
- `npm run typecheck`: 통과.
- `npm run lint`: 통과, 경고 0.
- `src/utils/searchRecommendationPolicy.test.ts`: SRR-01/02/03/04/05/06/13/15/16/17/18/21/22 정책·파서·수명·레이아웃·시즌 키 회귀.
- 기존 `recommendationFeed`, `recommendationCollector`, `recommendationSession`, `recommendationPresentation`, `similarSearchIntent`, `seasonLibraryMatch`, `searchPagination`, `mobileInput` 및 Edge recommendation/similarity 테스트 전체 유지.
- **REG-P0-037**: 21번 문서의 과거 “빈 검색 추천 미호출” 기록은 역사적 결과로 남긴다. 최신 실행 기대는 22번 결정에 따라 “로그인/활성/온라인/빈 검색에는 추천 허용; 1자 일반 검색은 API 요청 금지”로 변경했다. 신규 테스트 이름에 기존 ID와 변경 이유를 포함했다.

## SRR 수용 테스트 전체 이관

통과는 표에 명시한 자동/웹 범위만 의미한다. 부분 통과의 미검증 항목을 실기기·통합 통과로 확대 해석하지 않는다.

| ID | 시나리오 | 최신 기대 결과 | 지정 검증 | 이번 결과/제한 |
|---|---|---|---|---|
| SRR-01 | 로그인·라이브러리 준비 후 빈/공백 검색 진입 | 개인화 추천 섹션과 최대 12개의 실제 응답 카드 표시. 기본값 false로 차단되지 않음 | 자동+UI+통합 | 부분 통과 / 서비스 미복구: 빈 검색 섹션과 요청은 복원. 실제 로그인 화면에서 503 및 재시도 확인. 개인화 카드 성공 응답은 미검증. |
| SRR-02 | 일반 검색어 1자 입력 | 2자 안내, 일반 검색 요청 없음. 추천과 검색 결과가 혼동되지 않음 | 자동+UI | 통과(자동+웹): 한 글자에서 안내만 표시. 순수 정책 테스트로 개인화 차단, 일반 검색 enabled 길이 조건 확인. 네트워크 캡처는 미수행. |
| SRR-03 | `한자와나오키` 검색 | 일반 결과 유지. 자세히/갤러리 모두 비슷한 작품 버튼 접근 가능 | UI+통합 | 통과(웹): 한자와나오키 일반 검색 결과와 시즌별 등록 배지 확인. 자세히의 유사 버튼 실행, 갤러리 버튼 렌더 확인. |
| SRR-04 | 시즌 2 카드의 비슷한 작품 버튼 탭 | 선택한 작품 출처·ID·시즌 문맥의 올바른 기준으로 유사 추천 표시. 카드 상세로 중복 이동하지 않음 | 자동+UI | 부분 통과: tmdb:55925 시즌 2 버튼 → anchorSeason=2 URL 및 기준 제목, 유사 12개 확인. 클라이언트 요청/캐시 키에 시즌 보존. 서버 랭킹 자체는 기존 작품 단위 로직이며 시즌별 차등 랭킹은 미검증. |
| SRR-05 | `도깨비 같은 드라마` 제출 | 기존 유사 검색 parser 실행, 기준 후보 필요 시 선택 후 결과 표시 | 기존 자동+UI | 통과(자동+웹): 도깨비 같은 드라마 → TMDB 67915 자동 기준 선택 → 유사 12개 표시. |
| SRR-06 | 유사 검색 예시·최근 검색어·mode=similar 링크 진입 | 버튼 제출과 같은 유사 검색으로 동작. 일반 텍스트 검색으로 잘못 실행되지 않음 | 자동+UI | 부분 통과: 모든 예시 parser 자동 통과. mode=similar URL 복원 실제 확인. 최근 검색어/예시는 같은 resolve 경로 연결 확인; 예시별 실제 응답은 미검증. |
| SRR-07 | 검색어 지우기·상세에서 추천으로 복귀 | 올바른 추천 캐시와 화면 문맥 복원, 불필요한 키보드/중복 요청 없음 | UI | 부분 통과(웹): 지우기 → 빈 추천 복귀, 검색창 초점 유지, URL mode=keyword 전환. 개인화 상세 왕복 캐시 성공 상태는 503 때문에 미검증. |
| SRR-08 | 새 추천 12개·스크롤로 다음 배치 | 기존 cursor/중복 제거와 요청 상한 유지, 연속 탭으로 중복 호출 없음 | 기존 자동+UI | 부분 통과(자동): 기존 feed/collector의 cursor·중복·탐색 상한 회귀 통과. 훅 동기 잠금 보존. 실제 새 배치 성공 UI는 서버 503으로 미검증. |
| SRR-09 | 라이브러리 빈 신규 사용자 | cold_start 응답과 근거 부족 안내. 빈 라이브러리를 오류로 취급하지 않음 | 자동+UI | 부분 통과(자동): 기존 recommendationEngine/Personalization cold_start 회귀 통과, 빈 라이브러리 성공 상태를 허용. 실제 신규 계정 UI는 테스트 계정 미설정으로 미검증. |
| SRR-10 | 추천 작품 추가 성공/실패 | 성공은 등록 상태 반영·빈자리 보충, 실패는 카드 복구. 시즌별 등록과 중복 기준 유지 | 기존 자동+통합 | 부분 통과(자동): 기존 feed remove/restore/refill 및 시즌 매칭 회귀 통과. 실사용 라이브러리를 변경하지 않아 실제 저장 성공/실패 통합 미검증. |
| SRR-11 | 관심 없음/비슷한 작품 더 보기/요소 줄이기 | 기존 피드백과 후속 행동 실행. 실패 시 거짓 성공 없이 복구/재시도 | 자동+통합 | 부분 통과(자동/코드): 기존 feedback body/원자 저장 계약과 테마 테스트 유지. 오류 시 카드 복구, 중복 제출 잠금과 연결/활성 검사. 실제 사용자 feedback 쓰기는 미실행. |
| SRR-12 | 추천 카드 quick view 및 연결 관리 화면 열기 | 정보·추가·유사 추천·닫기 정상. 표시한 버튼이 비활성 확장 route로 막히지 않음 | UI | 부분 통과(웹): 유사 quick view 열기·정보·닫기·버튼 접근 확인. 개인화 quick view/테마 시트는 모바일 수정 및 정적 검사. 제외 관리는 홈 인기 추천의 로컬 저장소 전용으로 검색 서버 feedback과 연결이 없어 비활성 유지. |
| SRR-13 | 첫 추천 요청 404/500·테이블 누락 | 섹션 오류/재시도. 일반 검색 정상 유지. 실제 0건으로 잘못 표시하지 않음 | 자동+통합 | 부분 통과: 실제 503 및 body.error=ALL_PROVIDERS_FAILED를 확인, 일반 검색 정상. 404/500 상태 코드 전달 처리 확인. 테이블 누락 장애 주입은 미수행. |
| SRR-14 | 캐시 존재 상태에서 새 추천 요청 실패 | 기존 추천 카드와 검색어/필터 보존, 섹션 내 재시도 | 자동+UI | 부분 통과(자동/코드): 기존 캐시를 갱신 성공 뒤에만 교체; 오류 시 캐시 카드와 inline 재시도 유지. 성공 개인화 캐시를 이용한 장애 UI 주입 미검증. |
| SRR-15 | 실제 0건·일부 공급자 실패·12개 미만 응답 | 세 상태를 구분. 실제 카드 수와 안내가 일치, 가짜 카드 없음 | 자동+UI | 부분 통과(자동/웹): 실제 0개+부분 실패+503 상태 확인. provider-blocked 0건을 오류로 분리하는 테스트 통과. 실제 개인화 1~11개 성공 응답은 미검증. |
| SRR-16 | 오프라인/타임아웃·캐시 유무 | 가능한 캐시 읽기, 새 요청/피드백 쓰기 제어, 무한 skeleton/자동 반복 없음 | 자동+UI | 부분 통과(자동/웹): 초기 연결 변화 중 오프라인 안내 확인. offline 정책, scope abort, deadline 회귀 통과. 네이티브 비행기 모드/캐시 조합 전체는 미검증. |
| SRR-17 | 로그아웃·다른 계정 전환·검색 모드 전환·탭 이탈 | 이전 사용자 추천 노출 없음. 보이지 않는 개인화 피드의 자동 보충/노출 기록 중단, 오래된 응답이 새 모드를 덮지 않음 | 자동+통합 | 부분 통과(자동): 활성/인증/모드 정책 및 이전 scope abort·늦은 쓰기 차단 테스트. 화면 이탈/계정 변경 cleanup 연결. 실제 계정 교체와 전체 네트워크 호출 추적은 미검증. |
| SRR-18 | 320/360/390/430 폭·큰 글자에서 카드/헤더/시트 조작 | 가로 넘침 없음, 행동 터치 영역 44 이상, 마지막 버튼 접근 가능 | UI+네이티브 | 부분 통과(웹): 320/360/390/430에서 유사 갤러리 가로 넘침 없음·44 미만 노출 버튼 없음. 320 모달 폭 288, 스크롤 마지막 추가 버튼 접근. 큰 글자 열 축소 자동 통과; 네이티브 큰 글자·개인화 카드 실응답 QA 미검증. |
| SRR-19 | VoiceOver/TalkBack·웹 키보드로 추천/피드백/시트 탐색 | 작품과 행동 라벨·busy 상태·오류 안내·포커스 복귀 정상 | 접근성 | 부분 통과(웹): 빠른 보기 닫기 최초 초점, Tab으로 유사/상세/추가 접근, 닫기 후 원래 카드 초점 복귀. VoiceOver/TalkBack 및 개인화 시트 실기기 미검증. |
| SRR-20 | 모바일 개선 회귀 검사 | 5개 탭/inset/뒤로/필터 적용·취소/시간 입력·핀 이탈 개선 유지 | 기존 자동+UI | 부분 통과: 기존 mobileInput 등 379개 회귀 유지. 모바일 UI 개선 파일을 되돌리지 않음. 이번 작업에서 핀 저장·이탈 실기기 재검증은 미수행, 21번 QA 제한 유지. |
| SRR-21 | 한국어 시즌 질의·전체 등록·시즌별 등록·일반 검색 다음 페이지 | 15·17번 결정과 기존 결과·등록 키·페이지네이션 유지 | 기존 자동+통합 | 부분 통과(자동+웹): 시즌 키/등록 매칭/검색 pagination 기존 테스트 및 새 whole/1/2 독립 키 테스트 통과. 실제 시즌 2 URL·배지 확인. 사용자 시즌 등록 쓰기와 일반 검색 긴 페이지 통합 미검증. |
| SRR-22 | 추천 활성화 후 무관한 화면·요청 확인 | 인물/공유/가져오기 등 전역 확장 기능이 일괄 활성화되지 않음 | 자동+UI | 통과(자동/코드): SEARCH_RECOMMENDATIONS_ENABLED=true, EXTENDED_FEATURES_ENABLED=false. 인물·리뷰·공유·가져오기 및 홈 인기 추천 가드 유지. |

## 후속 확인이 필요한 항목

1. 배포된 personalized-recommendations의 503 응답 본문/공급자 로그를 확인해 공급자 연결·rate limit·월별 카탈로그 실패 원인을 좁힌다. 이미 적용된 0017~0019를 다시 적용하거나 모든 Function을 일괄 배포할 근거는 없다.
2. 쓰기 전용 테스트 계정/fixture에서 추천 성공 배치·새 12개·보충·피드백 성공/실패·노출 기록 중복 및 계정 전환을 검증한다.
3. iOS/Android 큰 글자, VoiceOver/TalkBack, 개인화/테마 시트를 실기기에서 검증한다.

## 후속 503 원인 진단 및 최소 수정 — 2026-09-10 19:00 KST 이후

기존 설명에서 503을 단일 분기로 기술한 오류를 정정했고, SRR 22개 행 모두 5열로 표 구분자를 복구했다.

### 실제 실패 응답과 배포 코드

- 로그인 UI에서 `action: recommend`, HTTP 503, 응답 JSON의 `error: ALL_PROVIDERS_FAILED`를 확인했다. `RECOMMENDATION_FAILED`라고 추정하지 않았다.
- 진단 시 커서는 month=2026-09, asOfDate=2026-09-10, anilist page=1/done=false/failures=1이었다. 다른 세 공급자는 done=true였다. 이 값만으로 다른 공급자의 성공이나 필터 제외 이유까지 단정하지 않는다.
- 확인된 배포 v11 소스를 임시 경로로 다운로드해 대조했다. index.ts, recommendationProviders.ts, recommendationCatalog.ts가 수정 전 로컬 소스와 바이트 단위로 동일했다. 저장소 파일을 다운로드로 덮어쓰지 않았다.
- 클라이언트 개발 진단은 action/status/허용 목록의 오류 code만 남긴다. 원문 message, token, API key, 요청 body/cursor, 전체 공급자 URL을 로그로 남기지 않는다. 사용자는 기존 정제된 오류를 본다.

### 결함 A: TMDB v3 키가 요청 URL에서 누락됨 — 수정 준비 완료

`fetchJson(url.toString(), {headers: applyTmdbAuth(url, apiKey)})`는 JavaScript 인수 평가 순서 때문에 먼저 URL 문자열을 만든다. v3 키를 URL에 넣는 applyTmdbAuth가 그 뒤 실행되어 실제 전송 URL에는 키가 없다. bearer 인증은 headers를 사용하므로 영향 조건이 다르다.

수정 파일은 `supabase/functions/_shared/recommendationProviders.ts`이며, 드라마/영화/애니 한국어 메타데이터 요청 세 곳에서 인증을 적용한 뒤 URL을 직렬화하도록 순서만 바꿨다. 소스·랭킹·필터·RLS·응답 계약은 바꾸지 않았다.

검증:

- 다운로드한 배포 원본 + 새 테스트: v3 URL 인증 테스트 실패(api_key=null), bearer 통과.
- 수정본 + 같은 테스트: v3와 bearer 모두 통과. KR/JP/영화와 애니 한국어 메타데이터 3페이지를 포함한 TMDB 요청 6개를 검증한다. fixture 인증값만 사용한다.
- 로컬 환경의 같은 실제 v3 키와 2026-09/page 1 조회: 수정 전 KR/JP/영화/애니 경로 모두 HTTP 401. 수정 후 KR 3개, JP 정상 0개, 영화 20개와 hasMore=true. 사용자 라이브러리/피드백 조회·변경 없이 공급자 GET을 검증했다.
- 배포 secret 값/형식을 읽거나 출력하지 않았다. 따라서 실제 배포 credential이 v3인지까지 확인한 것은 아니며, 이 결함이 모든 원격 실패를 단독 설명한다고 주장하지 않는다.

### 차단 B: AniList API 일시 중단 — 외부 서비스 차단

수정 후 애니 경로는 AniList에서 HTTP 403, application/json을 반환했다. 응답 errors[].message는 다음과 같다.

> The AniList API has been temporarily disabled due to severe stability issues.

호출 대상은 공개 [AniList GraphQL API](https://graphql.anilist.co)이며, 기존 추천 공급자 함수의 실제 쿼리를 사용했다. cloudflare server 헤더는 있었지만 challenge 표시는 없었다. 따라서 단순 인증 키 문제나 Cloudflare challenge라고 바꿔 설명하지 않는다. 이는 로컬 진단의 직접 응답이며, 원격 Supabase에서 받은 공급자 본문까지 추출한 것은 아니다.

현재 관측된 실패 커서에는 AniList가 남아 있고, 해당 공급자는 안정성 문제로 일시 중단을 명시했다. v3 키 순서 수정만으로 이 중단을 해결할 수 없다. TMDB를 새 애니 대체 카탈로그로 쓰는 등 추천 설계 변경은 하지 않았다.

### 정확한 배포 대상 및 완료 조건

- 필요한 최소 배포 대상: **personalized-recommendations 한 함수**. 수정된 shared/recommendationProviders.ts를 import하는 배포 진입점은 이 함수뿐이다.
- 미실행 명령: `supabase functions deploy personalized-recommendations --project-ref pstkeooflscvtaxxrwdf`.
- migration, secrets 갱신, 다른 Function 배포는 필요하다고 확인되지 않았다. 이번 후속 지시는 배포 필요 시 구체적으로 보고하도록 했으므로 배포하지 않았다.
- 배포 후 TMDB 경로의 실제 recommend 응답과 개인화 카드 표시를 확인해야 한다. AniList가 복구된 뒤 애니 배치도 확인해야 한다. **개인화 서비스 복구 완료 조건은 아직 충족하지 못했다.**
- 마지막 검증: npm test **389/389**, typecheck 통과, lint 경고 0, git diff --check 통과. 앞 절의 387개는 최초 복원 시점 결과이고, 이번 인증 회귀 2개가 추가됐다.

## 최소 배포 반영 및 실제 UI 검증 — 2026-09-10 19:07 KST 이후

후속 요청에서 단일 함수 배포가 명시적으로 승인되어 실행했다. 이전 절의 “미배포”는 당시 상태이며 현재는 아래 결과가 최신이다.

- linked 프로젝트 `pstkeooflscvtaxxrwdf` 확인. 배포 직전 v11, JWT 검증 true, import_map false 확인.
- v11 다운로드 의존 소스 10개와 저장소를 비교해 런타임 변경은 `recommendationProviders.ts` 하나임을 확인. 서버 수정은 검토한 인증 순서 세 곳뿐이다. 회귀 테스트는 배포 진입점에 import되지 않는다.
- `npx --yes deno check supabase/functions/personalized-recommendations/index.ts`: 통과(Deno 2.9.6).
- 실행: `supabase functions deploy personalized-recommendations --project-ref pstkeooflscvtaxxrwdf --use-api`.
- 결과: **v12 ACTIVE**, verify_jwt=true, import_map=false. 배포 해시 `0bc3017fbc338628f6f2b56735bfa2b8a87d32320ea89ceaf1ebd39c776ea444`.
- v12를 다시 다운로드해 승인된 로컬 소스와 동일함을 확인. 다른 Function, migration, secret은 변경하지 않았다.
- v11 복구용 원본과 manifest: `/Users/youngilkim/.codex/artifacts/scenenote/personalized-recommendations-v11-20260910/`. 원본 복구 배포는 실행하지 않았다.

### 유형별 실제 관측

| 조건 | 실제 응답/화면 | 판정 |
|---|---|---|
| 기존 실패 커서 유지 후 새 추천 1회 | HTTP503 ALL_PROVIDERS_FAILED, 기존 커서에서 남은 AniList 호출 실패 | 배포만으로 실패 공급자 커서가 바뀌지 않음. 반복 재시도 중단 |
| 새 탭/새로고침의 초기 커서, 기본 전체 | action=recommend, mediaType=all, cursor=initial, items=0, hasMore=true, failedSources=[anilist]. 이후 후속 cursor 503 | 실제 초기 후보 0개와 후속 공급자 실패를 구분. 전체 카탈로그 소진으로 표시하지 않음 |
| 드라마 초기 커서 | 실제 개인화 카드 5개 표시: 썸머 피버, X들의 동맹, 타임 트래블 아빠 등. 자동으로 이전 월 후보 탐색 | TMDB 드라마 추천의 실제 응답/카드 복구 확인. 관측 시점 후보 수를 기록하며 항상 12개라고 주장하지 않음 |
| 영화 초기 커서 | 첫 검증에서 실제 영화 개인화 카드 12개 표시 및 새 추천 버튼 활성 | TMDB 영화 추천 복구 확인 |
| 영화 두 번째 초기/후속 조회 | 성공 응답 수 2→7→1→3, failedSources=[]; 합계 13개 표시 발견 | 정상 노출 기록으로 제외 대상이 달라지므로 이전 배치와 개수가 다를 수 있음. 아래 자동 보충 개수 결함 수정 |

기본 전체 모드의 기존 `getProvidersForMediaType("all")`는 tmdb_kr/tmdb_jp/anilist이며 영화는 포함하지 않는다. 공급자/랭킹을 임의로 바꾸지 말라는 요청에 따라 이를 변경하지 않았다. 이 계정의 2026-09 초기 추천 후보는 0개였고, AniList 중단으로 이전 월 탐색이 막히는 제한이 남는다. 드라마/영화 개별 모드 성공을 전체/애니 모드 완전 복구로 확대 해석하지 않는다.

이 계정의 전체 모드가 첫 응답부터 0개여서, “같은 전체 피드에 이미 받은 카드가 있는 상태에서 AniList 실패 후 카드 유지” 조합은 실제 UI에서 관측할 수 없었다. 기존 성공 캐시를 실패 시 교체하지 않는 구현/회귀 테스트는 유지했지만 이 특정 실데이터 조합을 통과로 표시하지 않는다.

### 검증 중 발견한 클라이언트 자동 보충 수정

`usePersonalizedRecommendations`가 자동 보충에도 매번 12개를 요청해, 이미 10개가 있을 때 추가 응답 3개를 받으면 13개가 되는 경우를 실제로 관측했다. 자동 보충만 `12 - 현재 표시 개수`를 요청하도록 수정했다. 사용자가 다음 배치를 요청하는 동작은 기존 12개를 유지한다. 이 변경은 로컬 클라이언트에만 적용하며 v12 서버 묶음에는 포함되지 않는다.

실사용 라이브러리 추가/삭제나 feedback 쓰기 버튼은 실행하지 않았다. 정상 추천 조회로 자동 노출 기록이 발생할 수 있으며, 이는 별도 테스트 데이터 쓰기와 구분한다. 노출 기록 때문에 이후 배치 후보는 달라질 수 있다.

최종 추가 확인:

- 자동 보충 수량 수정 후 새 영화 배치가 **12개**로 채워지고 실제 quick view 버튼 12개가 존재함을 확인했다. 최근 후속 응답들은 2/3/0/1개 등 실제 개수였으며 가짜 카드로 채우지 않았다.
- 복구된 개인화 영화 카드의 quick view를 390×844에서 열어 확인했다. 패널 폭 358px, 가로 넘침 없음, 닫기/관심 없음/유사/상세/추가 버튼 높이는 각각 44px였다. 피드백/추가 버튼을 실행하지 않고 닫기만 검증했다. 뷰포트 override는 원복했다.
- 복구 백업에는 다운로드 원본 10개 외에 git 미변경인 타입 의존성 `types.ts`와 `supabase/config.toml`도 보관했다. secrets/.env는 백업하지 않았다.
- 최종 판정: **v12 배포 완료, 드라마·영화 추천 실제 카드 복구 확인. 전체·애니는 AniList 중단 및 기존 전체 공급자 계약 때문에 제한이 남음.** 전체 성공/혼합 피드 오류 후 카드 유지의 실데이터 조합은 미검증이며, 전체 복구 완료라고 보고하지 않는다.
