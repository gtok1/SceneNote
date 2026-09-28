# SceneNote Development Next Steps

작성일: 2026-05-02

## 현재 작업 재개 기준 (2026-09-26)

코드 대조 기준: `main`, `198a064`의 작업 트리. 이번 작업은 Markdown 문서만 점검·보완했다. 아래의 **코드 확인**은 정적 조사 결과이며 실행·배포·실기기 검증 완료를 의미하지 않는다. 초기 5월 기록은 뒤에 별도로 보존한다.

| 영역 | 확인한 상태 | 근거·다음 확인 |
|------|-------------|----------------|
| 앱 구조·핵심 기능 | Expo Router, 인증, 검색/추천, 라이브러리, 진행률, 핀 CRUD 코드 존재 | [README](../README.md), [04](04_architecture.md), [08](08_frontend_architecture.md)에서 기능별 진입점 확인 |
| 5월 이후 기능 | 비밀번호 재설정, 리뷰, 라이브러리 제거, 회원 탈퇴, 공유 코드 존재 | `src/hooks/useAuth.ts`, `src/services/reviews.ts`, `src/services/library.ts`의 `deleteLibraryItem`, `src/services/account.ts`, `src/services/libraryShare.ts` |
| 기능 노출 | `EXTENDED_FEATURES_ENABLED=false`, `SEARCH_RECOMMENDATIONS_ENABLED=true` | `src/constants/features.ts`. 코드 존재와 노출은 다르며 공개 공유·리뷰에는 별도 검토 필요 |
| DB·서버 | `supabase/migrations/0001`~`0021` SQL, npm 배포 목록 14개 함수 존재 | 파일 존재만 확인. 원격 migration 적용·함수 버전·secret 설정은 이번에 조회하지 않음 |
| 문서 정비 | 실행 안내·목차·현행 코드 지도·과거 기록 구분, 공통 AI 규칙 보완 | 이번 검증은 경로/링크/스크립트와 diff 정적 점검. 앱 테스트·빌드·서버·DB 작업 없음 |

이번 문서 검증 결과: 변경 Markdown 18개에서 상대 링크·앵커 193건과 추가된 npm 스크립트명 14종을 로컬 검사해 오류가 없었다. 코드 경로는 실재 경로와 명시적인 부재 예제를 구분해 대조했다. `git diff --check`, 변경 범위·원문 보존 확인, 추가 문구의 비밀값 패턴 검사도 통과했다. 기존 Python 스킬 검증기는 `PyYAML` 미설치로 실행되지 않아 저장소에 이미 설치된 Node `yaml`로 두 스킬 및 네 에이전트의 frontmatter를 파싱하고 스킬 메타데이터·미완성 표식을 대신 검사했다. 의존성은 설치·변경하지 않았다. 실제 스킬 선택·새 세션 지침 로딩 및 앱 동작은 별도 확인 대상이다.

### 일본 드라마 원작 검색 복구 (2026-09-29)

`결혼 못하는` 검색에서 TMDB의 2006년 일본 원작(`13372`, 시즌 1)이 누락되고 2019년 후속작(같은 TMDB id, 시즌 2)만 표시됐다. TMDB 응답과 원격 검색 캐시에는 두 시즌이 모두 있었으나 배포된 `search-content` v25의 `compactResults`가 `source:id`만으로 합쳤다. 저장소의 시즌별 키(`source:id:season_number`)와 기존 T-1~T-5 회귀 테스트는 이미 이 결함을 수정한 상태였다.

- 사용자 승인 후 앱과 CLI의 프로젝트 ref `pstkeooflscvtaxxrwdf`를 대조하고 `search-content` 함수 하나만 배포했다. 원격 **v26 ACTIVE, verify_jwt=true** 확인. DB·secret·다른 함수는 변경하지 않았다.
- `normalize.test.ts` 20/20 통과, `deno check supabase/functions/search-content/index.ts` 통과. 변경 전 원격 코드와 현재 저장소의 차이는 `adapters/normalize.ts`의 시즌 병합 로직이었다.
- 8081 웹 서버를 복구하고 로그인된 Chrome에서 새로고침 후 같은 검색어를 실행했다. 2019년 일본 후속작, 2009년 한국 리메이크, **2006년 일본 원작(12화)** 카드가 각각 표시됐다. 증빙 화면: `/tmp/scenenote-search-2006-verified.png`. iOS·Android 실기기와 다른 검색어 전체는 이번에 재검증하지 않았다.

### Edge Function 배포 동기화 (docs/35)

- `supabase/functions/`를 바꾼 작업은 끝에 `npm run edge:drift`를 실행해 결과 표를 보고한다. `stale`·`not_deployed`·`uncommitted`가 있으면 재배포 대상 목록을 사람에게 넘긴다. 도구는 읽기 전용이며 배포하지 않는다.
- 검색 관련 변경은 `npm run search:golden`으로 12개 기준 작품을 다시 확인한다. 새 누락 사례는 `scripts/searchGolden.ts`의 `SEARCH_GOLDEN_CASES`에 추가한다.
- 2026-09-29 실측: 13개 중 11개 함수가 코드보다 오래된 배포, `delete-account` 미배포([35 2절](35_search_completeness_and_deploy_drift_spec.md#2-배포-불일치-실측-2026-09-29-kst)). 이번 구현에서 `search-content`는 미커밋 변경으로 표시되며 배포하지 않았다.
- 구현 검증: K-1은 수정 전 `anime ≠ jdrama`로 실패, 수정 후 검색 관련 93/93 통과. 전체 `npm test`는 시작 675/676에서 41개 테스트 추가 후 716/717이며, 기존 `uses latest-popular fallback ordering with an empty library` 1건은 이번 허용 파일 밖의 추천 테스트 실패로 남았다. `npm run typecheck`, `npm run lint`, `npm run build`(웹 export), `deno check supabase/functions/search-content/index.ts`, `git diff --check`는 통과했다. `npm run search:golden`은 실제 TMDB 조회 12/12, `npm run edge:drift`는 `search-content`의 미커밋 변경 등 재배포 대상 13개를 보고하고 종료 코드 1을 반환했다. 토큰 누락은 네트워크 호출 전 종료 코드 2를 확인했다.
- 8081 Chrome 웹에서 `결혼 못하는`에 2024년 필터를 적용하면 숨김 3개·"모두 보기"가 표시되고 세 카드를 열람할 수 있었다. 검증 뒤 계정 필터를 전체로 복원했다. 새 서버 계약과 국가 필터를 포함한 운영 동작은 `search-content` 재배포 전에는 웹에서 확인할 수 없고, iOS·Android 실기기는 이번에 실행하지 않았다.

### 추천 필터·API 재사용 후속 수정 (2026-09-26, 미커밋 작업)

이번 사용자 요청은 제외 안내만 반복하는 빈 추천과 API 낭비 수정이다. 기존 문서 정비·홈 개편 변경은 보존했다. [30 후속 범위](30_recommendation_fill_and_action_consistency_fixes_spec.md#6-2026-09-26-후속-요청-조회-전-필터와-재사용)에 따라 조회 전 계정 필터, 공개 메타데이터 영속 캐시, 미확인 후보 커서 재개, 필터별 Query key·커서 재시도를 구현했다. DB migration·secret 변경은 없다.

- 원격 `personalized-recommendations` v14를 별도 임시 디렉터리에 내려받아 비교: 로컬의 키워드 보강 및 최종 계정 제외 판정 연결이 빠져 있었다. 현재 앱과 CLI 연결 대상이 같은 프로젝트임을 확인한 뒤 이 함수만 배포했다. 최종 원격 v16 `ACTIVE`, `verify_jwt=true` 확인. 다른 13개 함수는 배포하지 않았다.
- 수정 범위: `app/search.tsx`, `usePersonalizedRecommendations.ts`, query key·추천 Feed/Preferences/Visibility 유틸, 서버 Catalog/Providers/Themes 및 새 Cache/ProviderFilters 모듈, 해당 회귀 테스트.
- 최종 자동 검증: `npm test` **537/537**, `npm run typecheck`, `npm run lint`, `npx --yes deno check supabase/functions/personalized-recommendations/index.ts`, `git diff --check` 통과. 자동 보충 잠금 해제 경합을 수정했고, 제공처 장애·복구 및 캐시를 사용하는 다음 페이지의 후보 누락 회귀 테스트를 포함했다. 테스트 로그: `/tmp/scenenote-recommendation-tests.log`.
- 웹 실행 확인: 기존 8081 서버·로그인 계정과 제외 설정 3개를 유지했다. 자동 보충으로 **4→9→12개**, 실제 하단 스크롤 후 **24개**(서로 다른 카드 접근성 이름 24개)를 확인했다. 홈→검색 복귀 때 12개 캐시가 유지됐고 추천 응답 로그 추가가 없었다. 최종 v16 배포·브라우저 새로고침 후에도 **7→12개 자동 보충**, 로딩 종료·새 추천 버튼 활성·추천 오류 로그 없음 확인. 마지막 응답은 5,368ms + 2,694ms였으며 첫 콜드 응답은 8,793ms였다. 환경별 성능 보장이나 실제 청구 비용 감소 실측으로 일반화하지 않는다.
- API 비용 검증은 fetch mock으로 진행했다. 인스턴스 교체 후 캐시 재사용, 캐시 적중 시 외부 호출 0회, 실패/빈 키워드 TTL, 한 요청의 새 키워드 조회 최대16회, 첫8개 제외 뒤 뒤쪽12개 검증을 포함한다. 현재 추천 경로에 LLM 호출은 없다.

수용 검증 대응: RFC-01~05·07과 RSP-01~08·10의 순수 계약은 전체 테스트에 포함된다. 필터·자동 보충·스크롤·화면 복귀는 위의 인증된 Chrome 웹 실행으로 확인했다. RFC-06/RSP-09의 데스크톱 아이콘 동일 노출은 화면으로 확인했지만 이번 변경에 카드 JSX 수정은 없다. 320/360/390/430 및 큰 글자·iOS/Android 접근성, 다른 실제 계정 전환, 실제 공급자 강제 장애/네트워크 차단은 이번에 재실행하지 않았다. 계정 필터 분리·장애·기한·취소는 자동 테스트로 검사하며 수동 플랫폼 검증을 대신하지 않는다.

### 원하는 장르·제작 국가 필터 (2026-09-27, 미커밋 작업)

사용자 요청에 따라 [22 후속 계약](22_search_recommendations_restore_spec.md#7-2026-09-27-후속-요청--원하는-장르제작-국가)의 선택 필터를 구현했다. `ContentSearchBar`의 적용/취소 시트와 `app/search.tsx`의 적용 요약·추천 진입 버튼을 연결하고, 검색/추천 hook·service·query key 및 서버의 공유 `discoveryFilters` 판정에 같은 장르 AND 제작 국가 조건을 전달한다. 계정별 추천 제외가 우선하며 원하는 조건을 맞추기 위해 제외를 완화하지 않는다. 기존 홈·문서 변경은 보존했고 DB migration·secret 변경은 없다.

- 공급자 조회 전에 지원하는 장르·제작국 조건을 적용하고 조건별 추천 캐시·커서를 분리했다. 일반 제목 검색은 원본 페이지 캐시를 재사용한 뒤 필터를 적용한다. 영화 제작국은 상세 메타데이터, TMDB TV의 로맨스·공포·스릴러는 정확히 일치하는 공급자 키워드로 확인하며 언어나 줄거리로 추정하지 않는다. 새 메타데이터 조회는 한 제목 검색에서 합산 8건·3초 이내이고 정상/실패 캐시를 재사용한다.
- 자동 검증: `npm test` **567/567**, `npm run typecheck`, `npm run lint`, `npx --yes deno check supabase/functions/personalized-recommendations/index.ts supabase/functions/search-content/index.ts`, `git diff --check` 통과. 로그: `/tmp/scenenote-positive-tests.log`. 장르 별칭·교집합·국가 미확인·계정 제외 우선, 조건별 캐시/커서 격리, 제공처 요청 조건·조회 예산 회귀를 포함한다.
- 앱과 CLI의 프로젝트 일치를 확인하고 두 함수만 배포했다. 원격 `search-content` **v24**, `personalized-recommendations` **v17**, 모두 `ACTIVE`, `verify_jwt=true` 확인. 다른 함수·DB는 배포하지 않았다.
- 인증된 Chrome 웹(8081): `코미디 · 일본`을 선택하고 취소하면 적용값이 바뀌지 않으며 추천 응답 추가 **0건**. 적용하면 요약이 표시되고 기존 제외 3개를 유지한 채 자동 보충으로 **12개**가 표시됐다. 최초 응답과 6회 보충 합산 약21.5초, 첫 3개는 약9초에 도착했다. 요청당 약2.3~3.8초였고 추천 오류/시간 초과는 없었다. 모든 조건에서 같은 속도나 12개 충족을 보장한다는 뜻은 아니다.
- 같은 조건의 `은혼` 제목 검색에서 영화·일본 TV 결과를 확인했다. 일부 공급자 결과가 없다는 기존 partial 안내도 표시됐으므로 전체 공급자 정상 응답으로 기록하지 않는다. 검색어를 지우면 해당 조건의 추천 12개 캐시로 복귀했다. 검증 후 선택 조건을 전체로 되돌렸다.
- 반응형 웹 390×844·320×568에서 시트·적용/초기화 버튼(48px)이 화면 안에 표시되고, 320px에서 가로 넘침이 없음을 확인했다. 증빙: `/tmp/scenenote-positive-filters/desktop.png`, `/tmp/scenenote-positive-filters/mobile-sheet.png`. 웹 실물 확인은 일본+코미디에 한정하며 다른 국가·장르/미확인 메타데이터·장애 조합은 자동 테스트로 확인했다. iOS/Android 실기기·VoiceOver·큰 글자·오프라인·실제 계정 전환은 실행하지 않았다. 기존 홈 카드의 중첩 button 콘솔 오류는 이번 필터 수정 범위 밖에 남아 있다.

### 다중 선택·계정 저장과 텍스트 토글 (2026-09-27, 미커밋 작업)

[22 §8](22_search_recommendations_restore_spec.md#8-2026-09-27-후속-요청--다중-선택과-계정별-저장)에 따라 유형·장르·제작 국가를 복수 선택한다. 같은 그룹은 OR, 그룹 간은 AND이며 계정 제외가 우선한다. 후속 사용자 요청으로 네모/체크 아이콘을 제거하고 텍스트 칩의 배경·테두리·글자색으로 켜짐/꺼짐을 표시한다. 접근성 `checked`는 네이티브와 웹 모두 유지한다.

- `ContentSearchBar`의 임시 선택을 `useSearchFilterPreferences` → 서비스 → `profiles.search_filters`에 저장하고, 성공한 값만 화면에 적용한다. 저장 전에 조회 완료를 기다리고, 취소/실패/계정 전환/늦은 응답을 분리했다. 최근 검색어는 기기 내 계정별로 분리하며 과거 미귀속 검색어는 삭제 없이 숨긴다.
- 검색·추천 hook/service와 공유 `discoveryFilters`, 두 Edge 핸들러, TMDB/AniList 조회가 배열 조건을 전달한다. 선택 순서와 중복에 무관한 캐시·커서, 조회 조건 근거와 실제 메타데이터의 구분, 제한된 요청 예산을 검증했다. 조합 수에 비례해 모든 국가×장르를 개별 호출하지 않는다.
- `npm test` **591/591**, 전체 typecheck/lint, 두 핸들러 Deno check, diff 검사 통과. 로그는 `/tmp/scenenote-multi-full-test.log`, `/tmp/scenenote-multi-typecheck.log`, `/tmp/scenenote-multi-lint.log`, `/tmp/scenenote-multi-deno.log`. 마지막 체크 아이콘 제거 후 대상 lint·전체 typecheck도 통과했다. 저장 정규화·실패 시 기존값 유지·중복 저장·늦은 응답·A→B→A·검색어 계정 분리는 순수 테스트로 검증했다.
- 원격 migration 목록 일치와 dry-run의 0022 단독 변경을 확인한 뒤 **0022_profile_search_filters.sql 적용 완료**. 기존 본인 프로필 RLS를 재사용한다. 앱과 동일한 프로젝트에 `search-content` **v25**, `personalized-recommendations` **v18**을 배포했고 두 함수 `ACTIVE`, `verify_jwt=true`와 migration 0001~0022 일치를 확인했다. 다른 함수·secret 변경은 없다.
- 인증된 Chrome 웹 8081에서 애니+드라마 / 미스터리+코미디 / 한국+일본을 저장하고 **전체 페이지 새로고침 후 여섯 선택 복원**을 확인했다. 추가로 공포·미국을 고른 뒤 취소하면 기존 여섯 선택만 유지됐다. 초기화 적용은 전체로 저장됐다. 마지막 아이콘 제거 후 여섯 항목의 독립 토글과 접근성 checked 상태, 아이콘 없는 텍스트를 확인했다. 검증용 임시 선택은 취소하고 저장 조건은 검증 전 전체로 복원했다.
- 390×844와 320×568 웹에서 줄바꿈·시트 스크롤과 고정 적용 버튼(48px)을 확인했다. 320px에서 시트 clientWidth/scrollWidth 모두320, 적용 버튼 하단544로 화면 내부다. 최종 증빙: `/tmp/scenenote-multi-filters/desktop-toggle.png`, `/tmp/scenenote-multi-filters/mobile-toggle.png`. 아이콘 제거 전 저장 복원 증빙은 `desktop-restored.png`다.
- 한 실제 계정의 저장/복원을 확인했으며 다른 계정·다른 기기·오프라인 실패·iOS/Android 실기기·VoiceOver/TalkBack·큰 글자는 미실행이다. 원격 정책 카탈로그 조회는 Management API의 `database_read` 권한 부족(403)으로 실행하지 못했으므로 두 실제 계정의 RLS 격리 확인을 완료로 간주하지 않는다. 이번 웹 검증은 필터/저장/반응형에 한정하며 SRR-03~06·09~16·19~22의 전체 수동 흐름을 재실행하지 않았다.

### 애니·일본 필터 503 복구 (2026-09-27, 미커밋 작업)

직전 다중 선택 구현에서 AniList에 사용하지 않는 `countryOfOrigin_in: null`까지 전달해 추천이 실패했다. 사용자와 동일한 `애니 / 모든 장르 / 일본`, 계정 제외3개 상태의 Chrome 로그에서 HTTP503 `ALL_PROVIDERS_FAILED`(1,721ms)를 확인했다. 익명 AniList 진단 총4회에서 기존 쿼리 HTTP500, 해당 인자만 생략한 쿼리 HTTP200(18개), 실제 복수 국가 배열 쿼리 HTTP200을 확인했다. nullable 스키마만으로 실제 resolver의 null 처리를 보장할 수 없었고 기존 응답 모킹은 이 차이를 잡지 못했다.

- `recommendationProviders.ts`: 미선택 장르·국가·제외 조건은 GraphQL 인자와 변수 모두 생략한다. 장르 OR 별칭·국가 다중 선택·50개 후보 예산을 보존했다. AniList 페이지 캐시만 `recommendation-provider-anilist-v4`로 분리해 기존 실패 캐시를 재사용하지 않으며 TMDB·한국어 제목 캐시는 유지했다. UI·저장된 필터·DB는 변경하지 않았다.
- `recommendationProviders.test.ts`: 단일 국가/전체/여러 국가, 단일/복수 장르, 애니메이션 전체 장르 의미, 오래된 실패 캐시를 포함한 회귀7개 추가. 실제 null-list HTTP500을 모킹해 수정 전7개 실패, 수정 후 관련47개 통과를 확인했다. 전체 `npm test` **598/598**, `npm run typecheck`, `npm run lint`, 두 관련 핸들러 Deno check, `git diff --check` 통과. 전체 로그: `/tmp/scenenote-anime-503-tests.log`.
- 해당 코드 경로를 실행하는 `personalized-recommendations`만 배포해 **v19 ACTIVE, verify_jwt=true**를 확인했다. 기존 `search-content`의 공유 모듈 사용은 변경되지 않은 키워드 helper에 한정되어 재배포하지 않았다.
- 인증된 Chrome 웹8081에서 사용자 필터·제외3개를 유지한 채 재시도1회. 초기 응답0개(6.646초) 후 자동 보충1개(2.967초),11개(4.472초)로 **약14.1초에 12개 표시**를 확인했다. 세 응답 모두 partial=false, failedSources=[]였고 이후 새 추천 오류 로그는0개였다. 증빙: `/tmp/scenenote-anime-503/recovered.png`. 다른 계정·조건의 동일 응답시간이나12개 보장을 의미하지 않는다.
- 전체/복수 국가 등의 요청 조합과 실패/복구 계약은 자동 테스트로 확인했고 실제 UI는 신고한 단일 조건을 검증했다. iOS/Android 실기기·강제 오프라인·공급자 장애 주입은 재실행하지 않았다. 라이브러리·시즌·카드 편집 등 이번 수정과 무관한 수동 QA는 이전 기록을 새 실행으로 간주하지 않는다.

### 먼저 처리할 미완료·충돌

| 중요도 | 상태 | 항목과 근거 | 다음 작업 |
|--------|------|-------------|-----------|
| P0 | 명세 미충족·코드 확인 | [31 U-1](31_usability_review_fixes_spec.md): `app/(tabs)/pins.tsx`의 모바일 카드/타임라인 선택이 `setSelectedPinId`만 수행 | 명세 D-2의 데스크톱 선택 동작을 유지하며 모바일 열기 수정·검증 |
| P0 | 명세 미충족·코드 확인 | [31 U-2](31_usability_review_fixes_spec.md): `app/content/[id].tsx`의 `removeFromLibrary`가 확인 없이 mutation 호출 | D-5의 실제 삭제 범위와 확인 문구를 보존해 수정 |
| P0 | 명세 미충족·코드 확인 | [31 U-3](31_usability_review_fixes_spec.md): `src/services/pins.ts`의 `getPinsByContent`는 초→작성 시각 정렬이며 `PIN_SELECT`에 시즌 정보 없음 | D-3·D-4의 시즌→회차→초 정렬과 표기 적용. U-4~U-11도 구현·테스트 표 전체를 별도 대조 |
| 높음 | 보안 원칙과 구현 관계 판단 필요 | `supabase/functions/add-to-library/index.ts`가 `requireUser` 후 관리자 클라이언트로 사용자 기록 저장. [04](04_architecture.md)의 RLS 경유 원칙과 차이 | 인증 검증·소유권 지정·RLS 우회 범위를 검토하고 계약을 결정. 취약점이 입증됐다는 뜻은 아님 |
| 높음 | 환경 구성 개선 필요 | `.env.example`, `backend:serve`, `scripts/backfill-content-air-date.ts`, `scripts/smoke-edge-functions.ts`가 앱/서버 변수 및 관리자 키 사용을 섞음 | AGENTS의 서버 secret 경계 유지. 별도 작업에서 서버/관리용 환경 분리; 앱용 env에 관리자 키를 추가하는 우회 금지 |
| 중간 | 요구사항 관계 판단 필요 | [7월 제품 컨셉](../migrations/7월/00_7월_개선_로드맵_개요.md)은 공유/소통 중심, 초기 문서는 핀 중심. [11](11_screen_implementation_spec.md)의 확장 범위 제외와 현재 리뷰·공개 공유 경로도 대조 필요 | 기존 기능을 삭제·축소하지 말고 다음 기능의 범위를 결정할 때 사용자 요구와 연결 |
| 중간 | 설계 대조 필요 | `app/search.tsx`의 `mergeSearchResults`/`isSameWorkResult`가 서로 다른 출처의 결과 병합; `watchProvidersAtom`은 서버 응답 캐시 | 출처 선택 계약 및 TanStack Query 원칙과 차이를 [04](04_architecture.md)·[08](08_frontend_architecture.md)에서 검토. 이번에 이관하지 않음 |
| 중간 | 실행 구성 불일치 | `.run/Backend Functions Deploy.run.xml`은 4개, `package.json`의 `backend:deploy`는 14개 함수 배포 | 별도 설정 변경 시 IDE 실행 구성 동기화. 문서 점검을 이유로 배포하지 않음 |
| 출시 전 | 환경 미검증 | 인증 메일·딥링크, 두 사용자 RLS, 원격 DB/Edge·외부 API, 웹/iOS/Android E2E | 대상·테스트 계정·플랫폼을 정한 통합 QA 필요. 과거 성공 로그로 대체하지 않음 |

### 변경 종류별 검증

아래 명령의 실행 위치는 저장소 루트다. 의존성 설치와 환경 선행조건은 [README](../README.md)를 따른다. 필요한 명세의 테스트 표는 모든 행을 자동 테스트 또는 수동 검증에 대응시키고 미실행 행과 이유를 기록한다.

| 변경 | 실행·점검 방법 | 확인 범위와 한계 |
|------|---------------|------------------|
| Markdown만 변경 | 저장 후 재독, 상대 링크/앵커·실재 경로·`package.json` 명령 대조, `git diff --check`, 최종 diff/상태 | 문서 정합성. 전체 앱 테스트·빌드를 근거 없이 반복하지 않음 |
| 순수 로직·캐시·서비스 계약 | 회귀 입력을 기존 `.test.ts`에 연결하고 `npm test`, `npm run typecheck`, `npm run lint` | 테스트는 `node:test`+`node:assert/strict`. React Native/Expo/Supabase 런타임 import 없이 순수 함수 검사 |
| 화면·라우팅·입력 | 위 검사 + 해당 명세의 실제 화면 수동 QA; 웹 export 영향이 있으면 `npm run build` | 웹·iOS·Android 결과를 따로 기록. 테스트 글롭은 `app/`와 `.tsx`를 실행하지 않음 |
| Edge Function·외부 응답 | `_shared`·adapter 순수 함수 테스트, 요청/응답 계약과 오류/partial/auth 분기 검토 | `tsconfig.json`과 `eslint.config.js`는 `supabase/functions` 제외. `npm test`의 일부 서버 테스트도 Deno 핸들러·원격 API 동작을 보증하지 않음 |
| DB·RLS | migration·타입·서비스 사용처 대조 후 별도로 준비한 테스트 DB에서 인증 전/소유자/다른 사용자 권한 QA | 새 schema는 새 migration으로. 실제 DB 검증 환경·명령·결과를 남겨야 완료 |

정상 흐름 외에 세션 없음·만료, 빈 데이터/네트워크 실패, 같은 작품의 여러 시즌, 영화의 `episode_id = NULL`, 시간만/메모만/둘 다 빈 핀, 동일 시간 복수 핀, 스포일러, 저장·삭제 뒤 캐시와 이동을 해당 변경 범위에 맞게 확인한다. 수동 세부 항목은 [11](11_screen_implementation_spec.md), 기능별 후속 명세, 아래 기존 QA 체크리스트를 참고한다.

### 일반 검사와 구분할 명령

명령이 존재한다는 사실은 실행 허가나 성공 증거가 아니다. 아래 작업은 대상 환경과 목적이 요청 범위에 있을 때만 수행한다. 문서 점검 중에는 실행하지 않는다.

| 명령/경로 | 선행조건·부작용 |
|-----------|----------------|
| `npm run smoke:edge -- "Inception" movie` | 전용 테스트 계정 로그인 및 실제 검색·인기 추천 호출. 캐시를 갱신할 수 있음. 관리자 키와 로컬 URL 또는 `SCENENOTE_DELETE_ACCOUNT_SMOKE=1` 조건이 맞으면 임시 사용자/데이터 **생성·삭제**까지 수행 (`shouldRunDeleteAccountSmoke`) |
| `npm run backend:serve` | Supabase CLI/로컬 서비스 준비 필요. `.env`를 읽고 서버 프로세스 시작 |
| `npm run backend:deploy` | 대상 프로젝트 확인 및 인증 필요. 원격 함수 14개 변경; 로컬 실행 검사가 아님 |
| `npm run import:netflix` | 입력 파일·테스트 계정·대상 확인 필요. 옵션과 관계없이 외부 호출 여부부터 코드에서 확인; 실제 등록은 사용자 데이터 변경 |
| `scripts/backfill-content-air-date.ts` | 관리자 권한으로 메타데이터/회차를 갱신하는 관리 스크립트. 일반 실행 예제로 사용하지 않음 |
| `supabase db push`, `supabase secrets set`, `supabase db pull` | 원격 schema/secret 또는 로컬 migration 변경. 과거 연결 기록을 믿고 실행하지 말고 대상·이력·출력 파일부터 확인 |
| `npm run restart`, `npm run web:restart`, `npm run dev:restart` | 광범위한 `pkill -f` 포함. 다른 세션의 서버를 끊을 수 있음. 먼저 8081 프로세스와 공유 여부 확인 |

### 인수인계 기록 방법

작업이 끝나면 이 문서의 관련 현재 상태만 갱신한다. 원문 QA 기록을 현재 결과로 덮어쓰거나 여러 파일에 동일 로그를 복사하지 않는다.

- **기준:** 날짜, 리비전/미커밋 변경 여부, 변경 파일과 기능 범위.
- **완료:** 코드 확인인지, 검사 실행인지, 사용자 동작 확인인지 구분해 근거를 남김.
- **검증:** 실행 명령, 결과, 적용 플랫폼/계정 역할; 미실행 이유와 남은 테스트 ID. 비밀값·메일·사용자 데이터는 제외.
- **다음 작업:** 미해결 증상·재현 조건·관련 명세/심볼, 원격 적용 필요 여부. 담당자·승인·날짜를 추측해 쓰지 않음.

새 Codex 세션에서는 저장소 루트에서 시작해 “현재 작업 경로와 실제 적용한 지침 파일을 나열하고, AGENTS의 해당 작업 명세와 이 문서의 미완료 항목을 확인해라”라고 요청한다. 같은 위치의 override가 있는지 확인하고, 일반 문서가 모두 자동으로 읽혔다고 가정하지 않는다.

## 2026-05-02 후속 작업 기록 (참고 전용)

> 이 아래는 당시 연결·배포·검증 및 후속 계획을 보존한 기록이다. “완료”, “현재”, “미구현”, 취약점 개수, 서버 기동 상태는 **2026-05-02 당시 표현**이며 지금의 상태가 아니다. 명령을 일괄 재실행하지 않는다. 실행 선행조건은 현재 README와 위 검증 기준을 따른다. 아래 앱/서버 env 혼용 예시는 현재 설정 안내로 사용하지 않는다.

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
