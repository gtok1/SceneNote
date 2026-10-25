# SceneNote Development Next Steps

## 라이브러리 성우·출연배우 2명 표시 (2026-10-25)

- 검색 추천과 같은 표시를 요청받아 라이브러리 `ContentCard`·`ContentGalleryCard`의 확장 기능 플래그에 묶인 출연진 표시를 공용 `ContentCast`로 교체했다. 검색의 `RecommendationCast`도 이를 재사용한다. 기존 이름 정렬·중복 제거·한글 변환·애니메이션 영화 성우 판정을 공유한다. 출연진이 있으면 저장값을 사용하고 없으면 빠른 보기와 같은 상세 Query 캐시(10분)를 사용한다. 영화/TV 조회 구분, 로딩·실패·정보 없음 안내를 유지하며 수동 작품은 외부 조회하지 않는다. 사용처가 사라진 `useLibraryItemCast`는 제거했다.
- 전체 `npm test` **1349/1349**, typecheck·lint·diff 검사 통과. 공용 순수 함수의 기존 테스트로 출연 순서·2명 제한·빈 이름/중복 제거·한글 변환·영화 조회·성우 분류를 검증했다. 서버·DB·사용자 감상 기록 변경 및 배포 없음.
- 실제 로그인한 8081 웹에서 갤러리·자세히 보기 모두 단다단 3기 성우 ‘하나에 나츠키 · 와카야마 시온’, 100일의 거짓말 배우 ‘김유정 · 진영’, 영화 개인적인 택시 배우 2명 표시를 확인했다. 갤러리 375/768/1440 및 자세히 375에서 이름 표시와 가로 넘침 없음을 확인했다. 보기·viewport 복원, 증빙 `/tmp/scenenote-library-cast-{desktop,mobile}.png`. iOS/Android 실기기·큰 글자, 수동 작품·강제 조회 실패 상태는 실제 환경에서 미검증이다. 외부 API 조회를 기존 상세 경로로 실행해 확인했으며 인증 정보를 추출하지 않았다.

## 검색 추천 카드 성우·출연배우 표시 (2026-10-24)

- 영화 누락 정정: 표시 대상을 모든 콘텐츠 유형으로 넓히고, 영화 조회를 TV 고정에서 `movie`로 수정했다. 갤러리·목록 모두 영화 출연진 최대 2명을 표시하며 애니메이션 영화는 정규화한 추천/상세 장르로 성우를 구분한다. cast가 없을 때도 영역을 유지하고 정보 없음 안내를 표시한다. 배우 이름·추정 데이터를 추가하지 않는다.
- 검증: 기준선 1334/1334 → 전체 1336/1336, typecheck·lint 통과. 기존 movie 제외 기대값을 새 요구인 출연배우 표시로 정정했고 영화/TV 조회 경로·애니메이션 영화 장르별 회귀 2개를 추가했다. 실제 로그인 8081 웹 갤러리와 목록에서 ‘두잉 라이프’, ‘인생, 사랑하다’, ‘텐징’ 출연진 2명을 확인했다. 375/768/1440px 문서 가로 넘침 없음. 증빙 `/tmp/scenenote-movie-cast-desktop.png`. 애니메이션 영화 라벨은 자동 테스트로 검증했고 실작품 수동 사례는 이번 추천 묶음에 없어 미검증이다. 네이티브 실기기 검증 환경 부재는 동일하며 서버·DB·사용자 감상 기록 변경과 배포 없음.


- 후속 요청: 검색 기본 보기를 갤러리로 바꾸고 기존 저장 버전 0도 한 번 갤러리로 이관한다(이후 선택은 저장). 성우 이름은 공용 `formatPersonName`을 재사용해 API 로마자 읽기의 한글 표기를 우선 표시하며 원문만 있거나 변환 불가면 원문을 보존한다. 구 서버 cast에 source가 없는 경우 작품 source를 적용한다. 이름 하드코딩·추가 API 요청·서버 변경 없음.
- 후속 검증: 이름 회귀 4개(한글 변환/기존 한글 우선/변환 불가/구 source 누락), 전체 1334/1334·typecheck·lint 통과. 실제 로그인 웹에서 첫 진입 갤러리 선택과 ‘카쿠마 아이 · 미키 시니치로’, ‘코시미즈 아미 · 스자키 아야’ 표시를 확인했다(자동 음역은 공식 한글 표기와 다를 수 있음). 375px 문서 넘침 없음. 증빙 `/tmp/scenenote-cast-korean-gallery.png`. 네이티브 검증 환경 부재는 동일하다.


- 사용자 요청으로 추천 갤러리·목록 제목 아래에 애니 성우, 드라마 출연배우를 API 출연 순서로 최대 2명 표시한다. 공통 `RecommendationCast`가 빠른 보기의 상세 조회·캐시를 재사용하고, 순수 함수가 빈 이름·인물 중복을 제거한다. 조회가 늦거나 실패해도 추천·추가·완료 동작은 대기시키지 않는다. API가 1명만 주면 1명만 표시하며 임의 이름을 채우지 않는다.
- 기준선 테스트 1326/1326 → 변경 후 1330/1330, typecheck·lint 통과. 새 테스트는 유형별 라벨, API 출연 순서/원본 보존, 빈 이름·중복 성우, 공급자 identity·정보 부족을 검증한다. 실제 로그인 웹 8081에서 갤러리·목록의 성우 2명과 드라마 ‘당신이 잠든 사이에’의 ‘수지 · 이종석’을 확인했다. 375/768/1440px 문서 가로 넘침 없음. 첫 추천 조회의 운영 546 오류는 재시도 후 정상 응답했으며 이 작업에서 서버 수정·배포는 하지 않았다. 증빙 `/tmp/scenenote-recommendation-cast-desktop.png`, `/tmp/scenenote-recommendation-cast-mobile.png`.
- iOS/Android 실기기·큰 글자·스크린리더는 실행 환경 부재로 미검증이다(`simctl` 없음). 사용자 감상 기록은 변경하지 않았다. 인물 이름은 기존 상세 API의 이름을 사용하므로 공급자에 따라 일본어 원문일 수 있다.

## 템빨 넷플릭스 누락 정정 (2026-10-20)

- 사용자가 실제 넷플릭스 제공 작품의 누락을 신고했다. AniList 212888의 선공개일(2026-09-27)과 TMDB 324502 시즌 1의 TV 방영일(2026-10-02)이 달을 넘기면서 직전 같은 월 판정이 실패했다. 정확한 시즌 1 API에는 Netflix·Watcha·TVING이 있으며 [넷플릭스 공식 페이지](https://www.netflix.com/kr/title/82948047)도 에피소드 3개를 표시했다. 운영 v4는 `lookup_version` 없는 `scope:content`를 반환해 앱에서 차단되는 별도 배포 불일치도 실제 로그인 웹 응답으로 확인했다. 증빙 `/tmp/scenenote-temppal-production-before.json`.
- [54 §16](54_anime_sequel_watch_providers_fixes_spec.md#16-2026-10-20-후속-정정--템빨-누락과-구서버-캐시)에 따라 같은 시즌 번호·연도를 유지하면서 날짜 차이 7일 이내로 보정한다. 다른 기수·인접 연도·합쳐진 1기 추정은 금지한다. 구계약 캐시는 1시간을 기다리지 않고 다음 포커스당 1회 재조회하고, 정상 v2 미확인 캐시는 TTL을 유지한다. 구응답 때문에 조회하지 못하는 안내를 실제 데이터 미확인과 구별했다.
- 회귀 검증: 서버 새 회귀 수정 전 83/88 → 수정 후 88/88. 최종 전체 **1326/1326**, typecheck·lint·웹 export(종료 0, Expo 종료 강제 정리 안내 포함)·Deno get-watch-providers 검사·diff 검사 통과. 로그 `/tmp/scenenote-temppal-final-{tests,typecheck,lint,build}.log`. 실제 TMDB와 수정 helper 재검증에서 `/tv/324502/season/1/watch/providers`만 조회해 시즌 1 제공처를 얻었다(`/tmp/scenenote-overgeared-season-fixed.jsonl`).
- 실제 핸들러 fixture 23/23 통과(템빨 5일 차이 성공·8일 차이 거절·앞선 3기 오매칭 차단 포함). 인증과 외부 fetch는 모사이며 운영 앱과 분리한 검사다. 결과 `/tmp/scenenote-watch-providers-handler-validation.json`. 단일 함수 격리 배포 후보 `/tmp/scenenote-ott-deploy-candidate`와 SHA manifest·롤백 안내를 준비했다(`/tmp/scenenote-ott-deployment-readiness.md`).
- 사용자 단독 함수 배포 승인 후 `get-watch-providers`만 격리 후보에서 배포했다. 직전 CLI 연결 프로젝트·앱 대상 일치와 운영 v4, 후보 11개 파일의 SHA 일치를 재확인했다. 배포 후 **v5 ACTIVE·verify_jwt=true**, 다른 13개 함수의 버전·상태·설정 불변, 무인증 POST 401을 확인했다. 내려받은 v5의 정규화 실행 코드 SHA는 승인 후보와 같다. DB·secret·사용자 기록 변경 없음. 운영 백업 `/tmp/scenenote-ott-production-backup`, 배포 로그 `/tmp/scenenote-ott-deploy.log`, 검증 `/tmp/scenenote-ott-deployment-verification.json`.
- 배포 후 실제 로그인 웹: 템빨은 `lookup_version:2`, 요청 시즌 1·`scope:season`·TMDB 시즌 1로 **넷플릭스·티빙·왓챠**가 표시됐다. 데스크톱 1440px·모바일 375px에서 확인했고 모바일 문서 폭 375로 가로 넘침이 없다. 사용자가 기존에 열어둔 탭에도 세 제공처가 표시되는 것을 확인했다. 전생 귀족 3기는 요청 시즌 3·`scope:null`·빈 제공처로 확인돼 이전 시즌 넷플릭스가 섞이지 않는다. 임시 진단 코드를 제거하고 QA 탭·viewport를 정리했다. 증빙 `/tmp/scenenote-temppal-deployed-{desktop,mobile}.png`, `/tmp/scenenote-temppal-deployed-response.json`, `/tmp/scenenote-season3-deployed-response.json`.
- iOS/Android 실기기·큰 글자·스크린리더는 실행 환경이 없어 미검증이다. 서버 응답의 운영 확인과 네이티브 화면 검증은 구분한다. 추천 배지 변경의 `personalized-recommendations` 배포는 이번 승인 범위에 포함되지 않아 남아 있다.

## 작품의 선택 시즌 기준 OTT 정정 (2026-10-20)

- 사용자 신고 작품은 AniList 185756의 3기다. 기존 시리즈 전체 제공처를 3기 화면에 보여주던 동작을 [54의 후속 계약 §15](54_anime_sequel_watch_providers_fixes_spec.md#15-2026-10-20-후속-정정--선택한-시즌의-제공처만-표시)으로 대체했다. AniList는 원제 기수·방영일로 TMDB 시즌을 검증하고, TMDB 명시 시즌은 시즌 제공처 API만 조회한다. 시즌이 없거나 모호하면 미확인이며 시리즈 제공처로 채우지 않는다. 정확한 시즌의 200 응답은 국내 정보가 비어도 해당 시즌의 해외 정보만 보존하고, 404와 구별한다.
- 앱은 버전 2·선택 시즌 일치가 확인된 응답만 표시하고 구서버의 시리즈 응답도 차단한다. “시즌 3 기준”·미확인 안내·재시도를 추가했으며, 캐시는 시즌·제목·방영일별로 분리한다. 라프텔 검색에도 기수를 넣는다. 추천의 시리즈 ID만으로 붙던 AniList/명시 시즌 OTT 배지는 보류하며 후보 개수·순서·필터는 유지한다.
- 실데이터: TMDB 237150은 시즌 1(2024-04-07, 29화)만 반환해 새 helper는 3기 제공처를 조회하지 않고 미확인으로 처리했다. 대조 작품 전슬 4기는 `/tv/82684/season/4/watch/providers`에서 KR 왓챠·티빙을 반환했다. [넷플릭스 공식 페이지](https://www.netflix.com/kr/title/81769856)의 시즌 2개 표시는 3기 제공 근거가 아니다. 라프텔 공식 검색의 3기(47318)에 1화 재생하기 링크가 있음을 확인했지만, 이 수동 확인을 앱의 자동 제공처 데이터로 하드코딩하지 않았다. 로그 `/tmp/scenenote-ott-probe.jsonl`, `/tmp/scenenote-ott-live-check.jsonl`.
- 실제 로그인 웹 8081: 신고된 상세의 375·1440px에서 시리즈의 넷플릭스 등 목록이 사라지고 시즌 3 미확인 안내가 표시됨을 확인했다. 문서 폭은 화면 폭과 같고 재시도 버튼은 높이 44px다. 다시 확인하기 뒤에도 잘못된 제공처가 없으며 라프텔에서 3기 찾아보기는 해당 검색 결과를 연다. 증빙 `/tmp/scenenote-season-ott-{desktop,mobile}.png`. 기존 서버를 재사용하고 검증용 탭·viewport 설정을 정리했으며 감상 기록을 변경하지 않았다.
- 실제 핸들러를 인증 모사·외부 fetch fixture로 실행한 21/21 사례가 통과했다(선택 시즌 URL, 합쳐진 시즌 차단, 같은 연도 후속기, 200 해외/빈 응답과 404 구별, 입력 400·공급자 오류 503). 이 검사는 운영 인증·배포 검증이 아니다. 결과 `/tmp/scenenote-watch-providers-handler-validation.json`.
- 최종 자동 검사: `npm test` **1316/1316**, typecheck·lint·웹 build(export)·Edge 16개 Deno check·diff 공백 검사 통과. 로그 `/tmp/scenenote-season-ott-{tests,typecheck,lint,build}.log`, `/tmp/scenenote-watch-season-deno.log`. 웹 export는 종료 코드 0이며 export 뒤 Expo의 종료 강제 정리 안내가 남았다. 리뷰 후 AniList 극장판의 TV 오입력·구서버 캐시 차단, 네이티브 스택의 포커스 복귀 시 TTL 재검사도 보완했다. 네이티브 포커스 동작은 코드/정적 검사까지이며 실기기 실행 증거와 구분한다.
- 운영 배포·DB·secret 변경은 하지 않았다. 클라이언트는 구응답의 오표시를 막지만 새 시즌 조회에는 `get-watch-providers`, 추천 배지에는 `personalized-recommendations` 재배포가 필요하다. iOS/Android 실기기·큰 글자·스크린리더와 새 서버 배포 후 실제 앱의 성공 제공처 표시는 실행 환경/배포 범위 밖이어서 미검증이다. 제목에 기수 표식이 없는 AniList 후속작, TMDB가 여러 기수를 한 시즌으로 합친 작품, AniList 극장판은 자동 제공처가 미확인으로 남을 수 있다.

## 모바일·웹 사용성 중심 코드 점검 (2026-10-20)

- 검색 입력에 44pt 이상 지우기 버튼·포커스 유지를 추가하고 자동 대문자/자동 교정을 끈다. 검색 목록은 키보드가 열린 상태에서 행동을 누를 수 있게 하고 스크롤 시 키보드를 닫는다. 검색 추가 실패·라이브러리 진행 저장/상태 제안·핀 저장/삭제 오류를 기존 한국어 토스트 흐름으로 맞췄다. 핀 삭제는 공통 확인, 저장 중 태그 변경 차단을 적용했다. 토스트 행동/닫기 버튼은 최소 44×44pt로 보완했다. 라이브러리 목록·갤러리의 `anime` 등 내부 코드는 기존 분류 규칙의 한국어 표시명을 사용한다.
- 기록 변경 뒤 오래된 값이 남던 경로를 보완했다. 라이브러리 추가/상태 변경/삭제와 핀 생성/수정은 프로필 통계도 무효화한다. 인물 한글 이름을 자동으로 되돌릴 때 기존 자동 보정 캐시도 stale 처리한다. 초기 인증 조회가 늦거나 최신 인증 이벤트와 순서가 뒤바뀌어 세션을 잃는 문제를 고치고 계정 변경/자동 로그아웃 때 Query 캐시를 비운다. 현재 데이터 흐름은 [08](08_frontend_architecture.md)에 반영했다.
- 영화 핀의 제목 보강이 TV 상세를 조회하던 문제를 고치고 작품 핀을 시즌→회차→시간순으로 정렬한다. 추천 취향 보충은 아직 조회하지 못한 질의도 커서에 남겨 시간 제한/일부 실패를 목록 끝으로 오인하지 않게 했다. Edge JSON 본문·검색 인자 검증, 에피소드 조회의 관계 응답 정규화와 기존 Deno 타입 오류도 수정했다.
- 자동 검증: 시작 전체 테스트 1253/1254, 최종 `npm test` **1284/1284**, `npm run typecheck`, `npm run lint`(오류·경고 0), `npm run build`(웹 export), Edge Function **16개 Deno check**, `git diff --check` 통과. 기존 실패 1건은 docs/33의 “최근 공개작” 계약을 여전히 “최신”으로 검사하던 기대 문구를 정정했으며 추천 순서/모드 검증은 유지한다. 새 회귀는 인증 순서 7개·JSON 검증 12개·취향 보충 커서 3개·핀 제목 보강 5개·에피소드 관계 응답 3개다. 로그는 `/tmp/scenenote-audit-final2-{test,typecheck,lint,build}.log`, `/tmp/scenenote-audit-deno-fixed.log`. 인물 자동 이름 복원은 실제 mutation 콜백과 격리 QueryClient/QueryObserver로 재조회 1→2회도 확인했다.
- 실제 로그인 Chrome 웹(8081): 검색 320/375/768/1440px에서 가로 넘침 없음, 지우기 버튼 44×48px·입력 포커스 유지, 320px 필터 시트의 적용/취소 노출·취소 후 포커스 복귀를 확인했다. 375px 라이브러리의 2열 갤러리·6개 탭·한국어 유형, 에피소드→핀 작성 맥락을 확인했다. 잘못된 시간 `12:3x`는 원문과 오류를 유지하고 저장을 막았으며, 입력을 비우고 취소해 기록은 저장하지 않았다. 격리된 실제 ToastViewport의 320/375px 행동·닫기·44pt 영역도 실행 확인했다(증빙 `/tmp/scenenote-audit-ui/toast-375.png`). 임시 QA 파일/탭은 제거했다. 오래된 번들을 내주던 기존 Expo 프로세스만 확인해 같은 8081 포트로 재기동했다.
- 미검증: iOS/Android 실기기·가상 키보드·VoiceOver/TalkBack·큰 글자, 실제 계정의 저장/삭제 성공 및 강제 네트워크 실패, 운영 Edge 응답. `simctl` 실행 도구/연결 기기가 없어 네이티브 검증은 남긴다. DB·secret·운영 배포와 감상/핀 기록 변경은 하지 않았다. 서버 수정의 운영 반영에는 해당 Edge Function 재배포가 필요하다.
- 남은 설계 충돌: `enrichLibraryMetadata`의 진행 분자는 전체 시즌 누계지만 분모는 선택 시즌 화수로 덮어써 `13/10`처럼 보일 수 있다(예: 1기 10화 + 2기 3화 시청, 2기 총 10화). docs/17의 작품 전체 진행 유지와 docs/48의 시즌 범위 유보를 먼저 정리해야 한다. 시즌 기준/작품 전체 기준을 임의 변경하거나 상한으로 숨기지 않았으며, 다음 작업에서 진행 표시 계약을 확정해야 한다.

## 라이브러리 공백 무시 검색 (2026-10-16)

- 사용자 캡처의 `감정스킬로`가 `감정 스킬로`에 일치하지 않던 원인은 `filterLibraryItems`의 공백 포함 문자열 비교였다. 기존 검색에 각 필드·검색어의 공백 제거 비교를 추가했다. 제목·원제·제작진·출연진에 적용하고 다른 필터·정렬은 유지한다. 목록·갤러리와 웹·네이티브는 같은 순수 필터를 사용한다.
- 관련 테스트 16/16 통과. 새 사례 8개 중 6개가 수정 전 실패했고 수정 후 모두 통과했다(붙여 쓰기·임의 띄어쓰기·짧은 검색어·탭/전각 공백·원제/인물·필터 유지·필드 경계). typecheck 통과, lint 오류 0/기존 `batchedQuery.test.ts` 경고 1, diff 검사 통과.
- 실제 로그인 웹·iOS·Android 화면 수동 검증은 이번 작업에서 실행하지 않았다(순수 필터 실행으로 검증). 서버·DB 변경 및 배포 없음. 기존 다른 작업의 변경은 보존했다.

## 회차 선택을 실제 공개 에피소드 목록으로 전환 (2026-10-16)

- 사용자 후속 요청으로 앞선 nextAiringEpisode 기반 공개 회차 추정을 교체했다. 회차 선택은 fetch-episodes availability_only의 `released_episodes` 행만 사용한다. AniList는 streamingEpisodes의 제목에 명시된 번호와 HTTP(S) 링크, TMDB/TVmaze는 실제 에피소드 목록의 공개일이 지난 행을 쓴다. 다음 방영 정보는 예정일 안내에만 남기며 공개 회차 계산에는 사용하지 않는다. 빈 목록에 총 화수나 추정 수치를 넣지 않는다.
- 선택 번호는 API 목록 그대로이며 [1,3]이면 2를 생성하지 않는다. 이전 전체 화수/공개 최댓값 기반 선택 수 테스트는 새 요구에 맞춰 명시 번호 테스트로 변경했다. 기존 테스트 기준선 1233/1234에서 최종 1235/1236, 기존 추천 엔진 실패 1건 유지. 스트리밍 목록 정규화·날짜 필터 새 회귀 2개는 구현 전 실패, 후 통과. typecheck 통과, lint 오류 0/기존 batchedQuery.test.ts 경고 1, Edge 전체 번들 문법·diff 검사 통과.
- 실제 API 검증: AniList 185756은 streamingEpisodes=[] 반환. 운영 상세도 source=anilist_streaming, episodes=[]를 받아 목록 부재 안내와 직접 입력을 표시한다. 이 작품의 라프텔 공개 3화를 API로 확보한 것은 아니며 임의 대체하지 않았다. AniList 16498의 실제 streamingEpisodes 25행은 25개 번호 모두 변환됨 확인(HTTP 링크 포함). 로그 `/tmp/scenenote-released-list-{before,red,after,typecheck,lint}.log`, 표본 `/tmp/scenenote-published-list-sample.json`, 화면 `/tmp/scenenote-published-list-empty.png`.
- 사용자 배포 요청이 이어지는 범위에서 fetch-episodes만 배포했다. 최종 v10 ACTIVE, verify_jwt=true 확인. DB·사용자 기록 변경 없음. 임시 로컬 응답 진단 코드 제거. iOS/Android 실기기·API 목록 제공 작품의 네이티브 선택 동작은 환경 부재로 미검증. 실제 OTT별 제공 회차와 AniList 스트리밍 링크 목록의 지역 차이는 남는다.

## 총 화수 미정 작품의 회차 선택 복구 (2026-10-16)

- 사용자 신고는 0이라는 시청 값이 아니라 1·2·3화 빠른 선택 영역 누락이었다. `EpisodeProgressCard`가 총 화수 null이면 선택 영역을 숨기고 공개 회차를 조회하지 않았다. AniList 3기는 별도 콘텐츠인데 등록 표시 기수 3과 실제 시즌 행 1이 달라 조회가 연결되지 않는 문제도 확인했다.
- 기존 공개 회차 훅을 `useEpisodeAvailability`로 재사용하도록 분리하고, 실제 시즌을 골라 조회한 공개 회차로 빠른 선택을 표시한다. 총 화수 미정 표시·기존 입력 상한·진행 분모·완료 판정·개인 시청 기록은 유지한다. 조회 중/없음/실패 안내와 재시도 추가.
- 자동: 시작 1231/1232, 최종 1233/1234 통과, 기존 추천 엔진 실패 1건만 유지. 공개 회차 선택 수 회귀는 구현 전 실패·후 통과, 독립 AniList 후속기의 실제 시즌 선택 회귀 추가. typecheck·lint·diff 검사 통과. 로그 `/tmp/scenenote-airing-choices-{before,red,after,typecheck,lint}.log`.
- 실제 8081 작품 상세: 운영 API가 공개 3화를 반환하고 현재 3화까지 공개 안내 및 1·2·3화 radio 표시. 3화 선택 시 입력 3 반영을 확인한 뒤 입력을 0으로 복원했으며 저장하지 않았다. 375·768 폭에서 문서 폭이 화면 폭과 같음 확인, 1440 화면 증빙 `/tmp/scenenote-airing-choices-fixed.png`. viewport 복원. 임시 진단 로그 제거. 서버·DB 배포 불필요(기존 API 정상). iOS/Android 실기기·큰 글자는 실행 환경 부재로 미검증.

## 검색 종료 문구 정렬 (2026-10-16)

- 검색 결과 끝의 `모든 결과를 확인했습니다.`만 Text로 직접 렌더링돼 FlashList의 확장 여백 끝에 붙던 문제를 수정했다. `app/search.tsx`에서 기존 `loadMoreFooter`로 감싸 중앙 정렬·64pt 최소 높이·상하 여백을 재사용하고, 문구는 typography.caption·textMuted·줄바꿈 가능한 스타일로 표시한다. 추천 스켈레톤·공용 꼬리말 스타일·검색 동작은 변경하지 않았다.
- 웹 8081 실제 검색에서 1440·768·375 폭의 중앙 정렬 확인. 375·768 문서 폭은 각각 화면 폭과 같고 가로 넘침 없음, 중앙 오차 0px. 768 갤러리에서도 중앙 정렬과 꼬리말 높이 64 확인. 보기 모드와 viewport 복원. 증빙 `/tmp/scenenote-search-footer-fixed.png`.
- npm test 1231/1232(기존 추천 엔진 실패 1개), typecheck·lint 통과. 새 단위 테스트는 스타일 감싸기 변경이라 추가하지 않았다. iOS/Android 실기기와 큰 글자 검증은 실행 환경 부재로 미검증이다. 서버 배포·DB 변경 없음.

## 애니 검색 전체 시즌 운영 배포 (2026-10-16)

- 사용자 배포 요청에 따라 앱 설정과 CLI 연결 프로젝트 일치를 확인하고 `search-content`만 `--use-api`로 배포했다. 운영 **v28 ACTIVE, verify_jwt=true** 확인. docs/62의 2~8기 펼치기 및 AniList 후속 조회와 커밋된 docs/56의 짧은 검색어 보정이 함께 반영됐다. 다른 함수·DB·secret 변경 없음.
- 구현 검사: `npm test` 1231/1232(기존 추천 엔진 실패 1개), typecheck·lint·esbuild·diff 검사 통과, TMDB 골든 전후 23/23. AS-1~AS-3·AF-1~AF-7은 구현 전 전부 실패, 구현 후 전부 통과. 기존 1·2단계와 공용 조회 헬퍼 및 기존 테스트 보존 확인.
- 실제 8081 웹, 기존 로그인 세션 사용: `감정스킬로`에서 AniList 1기·2기·3기 세 카드와 3기 제목 확인. 응답 word_split_fallback=true, anime_follow_up=true, 재조회 cached=true. 전체 제목은 같은 세 카드와 두 플래그 false. `너말고`는 `너 말고 다른 연애` 포함 2개, word split만 true. `오징어게임`은 기존 시즌 결과와 두 플래그 false. 네 응답 모두 failedSources=[] 확인. 카드 추가·완료와 로그인 대행 없음.
- 증빙: `/tmp/scenenote62-deployed-seasons.png`, `/tmp/scenenote62-deploy-responses.json`, `/tmp/scenenote62-deployed-functions.json`, `/tmp/scenenote62-deploy-drift.log`. 플래그 확인용 임시 로컬 진단 코드는 원래 파일과 바이트 단위로 동일하게 복원. 기존 서버 재시작 없음.
- iOS M-4는 simctl 도구가 없어 미검증. edge:drift는 미커밋 코드 때문에 배포 후에도 search-content uncommitted로 표시하며 v28 배포 성공과 구분한다. 다른 함수들의 배포 불일치는 이번 범위 밖이다.

## 검색 추천의 라이브러리 조회 오류 정정 (2026-10-10)

- 검색 화면의 추천 영역에서 `라이브러리 정보를 불러오지 못해 취향을 분석할 수 없습니다`를 재현했다. 임시 오류 진단으로 시즌 조회의 `Bad Request`, 작품 ID 628개를 확인했다. `getLibraryItems`의 메타데이터 보강에서 전체 UUID를 한 `.in()` URL로 요청하던 것을 100개 ID씩 분할하여 요청 길이를 줄였다. 진단 코드는 제거했다.
- 감상·시즌·시청 진행·방영일 4개 조회에 `readBatchedRows`를 적용했다. 각 묶음은 ID 정렬과 1000행 페이지 조회로 결과 누락을 방지하고, 후속 묶음 실패 시 부분 성공으로 처리하지 않는다. 추천 필터·개인 기록·D-N·서버 및 DB 계약 변경 없음.
- 자동: 시작 경로·git 상태와 `npm test` 기준선 확인(1068/1069). 수정 후 1073/1074, 기존 추천 엔진 `uses latest-popular fallback ordering with an empty library` 1건만 실패. 새 5개 테스트는 628개 ID 분할·추가 페이지·후속 실패·빈 입력/중복·잘못된 크기를 확인한다. typecheck·lint·diff 공백 검사 통과. 로그 `/tmp/scenenote-library-error-{before,after,typecheck,lint}.log`.
- 실제 웹: 기존 8081 검색 화면의 동일한 2025년·애니/드라마·일본/한국 필터에서 오류 문구 제거, 추천 12개 표시와 새 추천 버튼 활성 확인. 증빙 `/tmp/scenenote-search-library-recovered.png`. 서버 재시작·배포·계정 기록 저장 없음. iOS/Android 실기기는 실행 환경이 없어 미검증이며, 실제 계정의 작품 완료 저장은 이번 조회 검증에 포함하지 않았다.

## 추천 캐시 카드 완료 무반응 정정 (2026-10-10)

- 실제 8081 검색 화면에서 라이브러리 조회 오류와 기존 추천 카드가 함께 표시되고, `모텔 캘리포니아 완료` 클릭이 반응 없이 끝나는 상황을 재현했다. 추천 요청이 비활성화되면 `removeOptimistically`가 null을 반환하여 저장 이전에 종료하는 것이 원인이다.
- `usePersonalizedRecommendations`의 캐시 제거·복원 조건을 요청 활성 조건과 분리했다. 현재 계정·추천 캐시 identity·마운트 범위를 확인하며 요청·자동 보충의 활성 조건은 유지한다. 캐시에서 카드를 찾지 못할 때 안내 토스트를 추가했다. [46 명세](46_recommendation_complete_action_spec.md#10-캐시-카드-완료-무반응-정정-2026-10-10)의 D-N 변경 없음.
- 자동: 시작 `git status --short`로 기존 변경 확인. 기준선 `npm test` 1066/1067, 수정 후 1068/1069. 새 회귀 2개는 구현 전 실패·구현 후 통과하며 기존 추천 엔진 `uses latest-popular fallback ordering with an empty library` 1건만 실패한다. typecheck·lint 통과. 로그 `/tmp/scenenote-complete-{before,red,after,typecheck,lint}.log`.
- 격리 웹: 실제 추천 훅과 모의 계정·캐시를 사용하여 활성→라이브러리 실패(요청 비활성) 전환 뒤 완료 경로 진입·캐시 제거, 저장 실패 복원을 확인했다. 서버 저장은 모사이며 실제 계정의 완료 저장 성공은 확인하지 않았다. 증빙 `/tmp/scenenote-completion-qa/result.png`. 임시 public QA 파일은 제거했고 기존 8081 서버 재시작·배포·DB 변경 없음.
- 미검증: 실제 계정 저장 성공, iOS/Android 실기기, 계정·필터 전환의 UI 연속 동작. 조회 장애와 네이티브 실행 환경 제약으로 남긴다. 계정·필터·언마운트 차단은 순수 함수 테스트로 확인했다.

## 검색·라이브러리 상세 복귀 스크롤 유지 (2026-10-03)

- `useListScrollRestoration` + 세션 전용 `listScrollStore`를 검색·라이브러리 FlashList에 연결했다. 계정·검색 조건·정렬·보기별 offset/표시 개수 분리, 레이아웃·페이지 준비 후 복원, 비활성 화면/복원 이벤트 제외를 적용한다. 라이브러리 복귀 시 첫 묶음으로 표시 개수를 줄이던 효과를 저장된 개수 복원으로 바꿨다. 새 조건은 처음부터 시작한다. 서버·API·DB·저장 필터 계약은 변경하지 않았다.
- 자동: 복원 대기·페이지 준비·짧아진 목록 clamp·새 검색 0 offset 순수 테스트 4개 추가. 전체 `npm test` 888/889, 기존 추천 엔진 `uses latest-popular fallback ordering with an empty library` 1건 실패. typecheck·최종 전체 lint·웹 build·diff 공백 검사 통과. 동시 작업의 임시 `public/__codex_misclick_qa.js` 때문에 중간 전체 lint는 실패했으며 해당 작업의 정리 후 재실행은 통과했다. 로그 `/tmp/scenenote-scroll-{tests,typecheck,lint,focused-lint,build}.log`.
- 웹: 기존 8081 서버의 별도 로그인 세션 탭에서 라이브러리 아래쪽 카드 → 상세 → 뒤로 후 같은 카드/확장된 표시 개수 유지 확인. 검색 `사랑`의 필터 밖 결과 모두 보기에서 아래쪽 작품 → 상세 → 뒤로 복귀 offset 1234→1235px 확인, `건담` 새 검색은 0px 확인. 그림 증빙 `/Users/youngilkim/.codex/visualizations/2026/10/03/01a0ff70-82c7-7311-ad18-bb54cca11cfb/scroll-restore/library-return.jpg`.
- 미검증: iOS/Android 실기기 제스처·큰 글자, 브라우저 새로고침(세션 메모리 보존 대상 아님), 오래된 Query 페이지가 GC된 뒤 복귀, 모든 추천·유사 검색/계정 전환 조합. 네이티브 실행 환경이 없어 플랫폼 동작 확인은 남긴다. 서버 재시작·배포·개인 감상 기록 변경 없음.

## 추천 추가 오입력 방지 (2026-10-03, 미커밋)

사용자가 의도하지 않은 모노노케 등록을 보고했다. [43 명세](43_recommendation_add_misclick_fixes_spec.md)에 따라 추가한 카드의 표시 인덱스를 유지하고 `추가 중`/`추가됨`으로 비활성화한다. 보충은 뒤에 붙이고, 추가 진행·800ms 예약 대기에는 기존 자동 보충을 보류한다. 갤러리/목록의 press 시작 identity 검증·동기 중복 잠금·작품 제목 포함 토스트·FlashList 완료 키 갱신을 추가했다. 당시 클릭/요청 로그는 없어 모노노케의 실제 등록 경위는 미확정이며 사용자 기록·DB·서버 배포를 변경하지 않았다.

- 자동 검사: MC-1~MC-9는 구현 전 신규 export 없음으로 실패, 구현 후 모두 통과. 시작 전체 테스트 875/876, 최종 888/889(이번 추가 9개, 동시에 다른 작업의 목록 스크롤 테스트 4개가 추가됨). 실패는 기존 추천 엔진 `uses latest-popular fallback ordering with an empty library` 1건이다. typecheck·lint·diff 공백 검사 통과. 로그 `/tmp/scenenote-misclick-{baseline,red,after,lint}.log`.
- 격리 웹: 실제 추천 갤러리/목록 카드와 순수 유틸을 사용하고 외부 저장 없이 지연을 모사했다. 768px 갤러리 A 더블클릭 → 시험 요청 A 1회, 모노노케 B 버튼 좌표 (285,576.875) 불변. 375px 목록 C 더블클릭 → C 1회만 추가. 1440px 컨테이너 선택 후 A/C는 `추가됨`·비활성, B는 활성, 보충은 끝에 유지. 임시 public QA 파일·시험 탭 정리, 기존 8081 서버 재시작 없음.
- 미검증: 로그인된 실제 Expo 화면의 전체 훅/서버 지연·실패 복원·키보드·계정 전환, 실제 viewport 375/768/1440, iOS/Android 세로·글자 1.3배·셀 재사용. 실제 계정 기록을 추가하지 않고 컴포넌트 격리 검사만 했다. 기존 Chrome 탭은 다른 작업이 사용 중이어서 조작하지 않았다. 42의 서버 지연 개선과 41의 취향 레인 재배포는 별도 후속 작업이다.


작성일: 2026-05-02

## 작품 상세 Disney+ 연결 오류 정정 (2026-10-03)

- 원인: `createProviderLink`가 만든 `https://www.disneyplus.com/search?q=...`이 없는 페이지로 연결됨. 한국어 검색 경로 역시 오류 페이지였고, 해당 페이지의 공식 홈 링크는 `/ko-kr`으로 정상 연결됨을 Chrome에서 확인했다.
- 서버 링크 생성과 클라이언트 클릭이 공유하는 `_shared/watchProviderLinks.ts`를 추가했다. 기존 서버 응답·캐시의 Disney 검색 URL만 홈으로 교정하며 실제 작품 주소와 다른 OTT 주소는 유지한다. `WatchProviderList`에 홈에서 작품명을 검색하라는 안내와 링크 열기 실패 한국어 토스트를 추가했다. 분류·정렬·카드 스타일·사용자 감상 기록은 변경하지 않았다.
- 검사: `npm test` 수정 전 842/843, 수정 후 846/847. 추가 회귀 4개 통과, 기존 추천 엔진 `uses latest-popular fallback ordering with an empty library` 1건만 실패. typecheck, lint, 웹 build(export), `npx --no-install deno check supabase/functions/get-watch-providers/index.ts`, diff 공백 검사 통과. 로그: `/tmp/scenenote-ott-{before,after,typecheck,lint,build,deno}.log`.
- 웹: 기존 8081 서버에서 메이드 인 코리아의 Disney Plus 버튼 → 정상 한국어 홈을 확인했다. 375 폭에서 안내 줄바꿈과 가로 넘침 없음(문서 폭 375)을 확인하고 viewport를 복원했다. iOS/Android 실기기·큰 글자, Disney 로그인 이후 작품 검색·재생, 다른 OTT의 실제 사이트 연결 및 강제 링크 열기 실패는 미검증이다. 기기/시뮬레이터와 OTT 로그인 없이 가능한 범위만 확인했다.
- 배포·DB 변경 없음. 클라이언트 교정은 이전 Edge 응답에도 적용된다. 운영 웹·앱에는 클라이언트 릴리스가 필요하며 서버에서 새 주소를 내려주려면 `get-watch-providers` 재배포가 필요하다.

## 라이브러리 기본 갤러리·카드 높이 정렬 (2026-10-03)

사용자 첨부 화면은 Underbar가 아닌 SceneNote 라이브러리와 일치해 이 저장소에서 수정했다. 기존 미커밋 변경은 보존했다.

- `src/stores/libraryUiStore.ts`: 기본 갤러리, 저장 설정 version 1로 이전 설정을 갤러리로 한 번 이관. 이후 사용자가 고른 상세/갤러리 보기는 기존 방식으로 저장한다. URL의 명시적 보기 선택은 유지한다.
- `src/components/content/ContentGalleryCard.tsx`, `app/(tabs)/library.tsx`: 정보 영역의 자연 높이(여백 포함)를 측정해 현재 폭·글자 배율에서 관측한 최대값을 모든 갤러리 카드의 최소 높이에 적용한다. 창 폭·글자 배율 변경 시 재측정하며 새로 렌더되는 더 큰 카드도 반영한다. 제목 두 줄 공간, 포스터 2:3, 기존 장르/상태 배지와 회차 이동 계약을 유지하고 이어보기 버튼의 중첩 Pressable을 제거했다. 기존 토큰·AppImage를 재사용하며 API/DB 변경은 없다.
- 실제 검사: `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` 통과. `npm test`는 843개 중 842개 통과, 미변경 추천 엔진의 `uses latest-popular fallback ordering with an empty library` 1건 실패(추천 이유에 `최신`을 기대). 해당 테스트 파일 단독 실행에서도 재현됐으며 추천 엔진/테스트는 HEAD와 동일하다. 관련 라이브러리 반응형·URL·이어보기 테스트 24개 통과. 로그는 `/tmp/scenenote-gallery-{test,focused,existing-failure,typecheck,lint,build}.log`.
- 기존 8081 서버의 로그인된 Chrome에서 375·768·1440 및 기본 데스크톱 폭을 확인했다. 375의 카드 높이 438.25, 768의 445, 기본 데스크톱의 약 461로 각 폭에서 같은 행의 하단선이 일치했고 카드 좌우가 콘텐츠 범위 안에 있다. 회차 버튼 → 에피소드 목록 이동, URL 보기 파라미터 없는 `/library` 진입의 갤러리 선택을 확인했다. viewport 임시 설정을 해제했다. 서버 재시작·배포·개인 기록 변경은 하지 않았다.
- 미검증: iOS/Android 실기기·시뮬레이터, 시스템 글자 1.3배·스크린리더, 저장 설정 이관의 모든 기기 조합. Web build는 Native 동작 검증이 아니다. 각 기기에서 갤러리 기본 진입·큰 글자·긴 장르/상태 배지·회차 버튼·스크롤을 확인하고 기존 추천 테스트 실패는 별도 후속 작업으로 조사한다.

## 현재 작업 재개 기준 (2026-09-26)

코드 대조 기준: `main`, `198a064`의 작업 트리. 이번 작업은 Markdown 문서만 점검·보완했다. 아래의 **코드 확인**은 정적 조사 결과이며 실행·배포·실기기 검증 완료를 의미하지 않는다. 초기 5월 기록은 뒤에 별도로 보존한다.

| 영역 | 확인한 상태 | 근거·다음 확인 |
|------|-------------|----------------|
| 앱 구조·핵심 기능 | Expo Router, 인증, 검색/추천, 라이브러리, 진행률, 핀 CRUD 코드 존재 | [README](../README.md), [04](04_architecture.md), [08](08_frontend_architecture.md)에서 기능별 진입점 확인 |
| 5월 이후 기능 | 비밀번호 재설정, 리뷰, 라이브러리 제거, 회원 탈퇴, 공유 코드 존재 | `src/hooks/useAuth.ts`, `src/services/reviews.ts`, `src/services/library.ts`의 `deleteLibraryItem`, `src/services/account.ts`, `src/services/libraryShare.ts` |
| 기능 노출 | `EXTENDED_FEATURES_ENABLED=false`, `SEARCH_RECOMMENDATIONS_ENABLED=true`, `PEOPLE_FEATURES_ENABLED=true`, `SHARE_FEATURES_ENABLED=true`(2026-10-02, 라이브러리 공유·`/share`만) | `src/constants/features.ts`. 코드 존재와 노출은 다르다. 공개 공유 링크는 만료 미설정·발급 목록/회수 UI 없음(docs/11 선행 조건 미구현). 리뷰는 별도 검토 필요 |
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

### 일본 인물 한글 이름 (docs/38)

- 배포 순서: ① `supabase/migrations/0023_favorite_people_korean_name.sql` 적용 → ② `search-person-content`, `get-person-detail`, `resolve-person-names` 배포 → ③ `npm run edge:drift` 확인.
- ① 전에도 좋아하는 인물 등록은 동작한다(PGRST204 재시도). ② 전에는 새 필드가 오지 않아 표시가 지금과 같다.
- 배포 후 수동 확인: docs/38 10장 M-1~M-7.

### 헤더·본문 정렬 (2026-10-03, 미커밋 작업)

- 루트·인증 Stack에 공통 `ScreenHeader`를 적용하고 화면별 한국어 제목과 본문 최대 폭을 맞췄다. 탭의 기본 헤더는 숨기고 검색·라이브러리에 본문 제목을 추가했다. 검색·라이브러리·핀 및 상세/보조 화면은 1200 가운데 프레임과 `getHomeLayout` gutter를 사용하며, 핀 상세·폼·인증은 720, 온보딩은 560으로 제한한다. `KeyboardScreen`, 핀 저장 footer, `ScreenStateFrame`도 해당 본문 폭을 공유한다. 구조 설명은 [04](04_architecture.md)·[08](08_frontend_architecture.md#공통-헤더본문-프레임-2026-10-03)에 있다.
- 실행 검사: `npm test` **840개 중 839개 통과**. `supabase/functions/_shared/recommendationEngine.test.ts`의 `uses latest-popular fallback ordering with an empty library` 1건은 작업 전부터 존재한 실패다. 마지막 UI 변경 뒤 `npm run typecheck`, `npm run lint`, `npm run build`(웹 정적 export·`dist` 생성) 최종 실행은 모두 종료 코드 0이며 `git diff --check`도 통과했다. UI 프레임 변경은 순수 함수 테스트만으로 화면 동작을 보장하지 않는다.

| 플랫폼·범위 | 확인한 결과 | 남은 확인·이유 |
|---|---|---|
| Chrome 웹 8081, 폭 375·1440 | 여섯 탭(홈·검색·라이브러리·핀·인물·프로필), 인물 상세, 핀 상세/편집의 헤더·본문 표시 확인 | 해당 화면의 다른 폭은 이번에 확인하지 않았다. |
| Chrome 웹 8081, 목록 보기 | 검색·라이브러리의 리스트/갤러리 보기 1440, 라이브러리 갤러리 375 확인 | 검색 갤러리 375 등 나머지 조합은 별도 확인 필요. |
| Chrome 웹 8081, 작품 상세 | 폭 375·768·1440의 헤더·본문 정렬 확인 | 실제 저장·삭제 흐름의 재검증을 뜻하지 않는다. |
| Chrome 웹 8081, 에피소드 목록 | 폭 375·768 표시 확인 | 다른 폭은 이번에 확인하지 않았다. |
| Chrome 웹 8081, 핀 추가 375 | 작품·회차 맥락과 저장 footer의 정렬, 미변경 취소 후 복귀 확인 | 실제 핀 저장은 실행하지 않았다. |
| Chrome 웹 8081, 작품 핀 목록 375·1440 | 네비게이션 제목 "작품 핀"·본문 작품명·빈 상태 정렬 확인 | 핀이 있는 목록과 에피소드별 핀 진입 전체를 재검증한 것은 아니다. |
| 가져오기·사진 가져오기·이전 추천 제외 목록 | 코드 프레임·웹 빌드만 확인 | `EXTENDED_FEATURES_ENABLED=false`이므로 실제 화면 진입·조작은 확인하지 않았다. |
| 유효 공유 링크·로그아웃 상태의 인증 화면 | 실제 UI 미확인 | 사용자 기록·로그인 세션을 변경하지 않는 범위에서 QA했다. 별도 환경에서 확인 필요. |
| iOS·Android | 실행하지 않음 | `xcrun simctl`을 사용할 수 없어 네이티브 안전 영역·키보드·글자 크기 1.3배를 확인하지 못했다. 시뮬레이터 또는 실기기에서 별도 검증 필요. |

이번 웹 QA에서는 사용자 기록의 저장·삭제와 로그인 세션 변경을 실행하지 않았다. 코드·빌드 확인을 실제 화면 조작이나 네이티브 검증 완료로 간주하지 않는다.

### 먼저 처리할 미완료·충돌

| 중요도 | 상태 | 항목과 근거 | 다음 작업 |
|--------|------|-------------|-----------|
| P0 | 명세 미충족·코드 확인 | [31 U-1](31_usability_review_fixes_spec.md): `app/(tabs)/pins.tsx`의 모바일 카드/타임라인 선택이 `setSelectedPinId`만 수행 | 명세 D-2의 데스크톱 선택 동작을 유지하며 모바일 열기 수정·검증 |
| P0 | 코드 구현 확인·실제 삭제 검증 남음 | [31 U-2](31_usability_review_fixes_spec.md)·[39](39_content_detail_saas_redesign_spec.md): `app/content/[id].tsx`가 `confirmDestructive`로 확인 후 `removeFromLibrary` 호출 | 실제 삭제 성공·관련 기록 제거 범위·실패 피드백·이동을 별도 테스트 기록으로 재검증 |
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


### 2026-10-04 추천 연도 필터 정정 (41 D-9)

- 원인: 검색 요약에 연도는 표시됐지만 추천 요청/발견 필터에는 전달되지 않아 월별 최신 레인과 기간 무제한 취향 레인이 다른 연도 작품을 반환했다.
- 수정: 공유 필터의 연도 판정·캐시 identity, 검색 화면/추천 훅의 연도 전달·표시/보충 검사·카드 유지 문맥, 서버 요청 검증, 선택 연도 월별 범위, 취향 제공처 공개일 범위·캐시 분리, 필터 시트 안내. 제목 검색의 연도 숨김 사유는 보존했다.
- Y-1~Y-5가 수정 전 실제 실패했고 수정 후 통과했다. Y-6은 모의 제공처 요청·영속 캐시 분리를 추가 검증한다. 관련 115개 테스트 전부 통과. 전체 기준선 951개 중 950개 통과; 수정 후 957개 중 956개 통과. 기존 `recommendationEngine.test.ts`의 `uses latest-popular fallback ordering with an empty library` 1개 실패는 기준선과 같다.
- `npm run typecheck`, `npm run lint`, `git diff --check` 통과. Edge handler는 esbuild로 구문/번들 검사했다(Deno 실행·원격 인증/RLS 확인을 대신하지 않음).
- 41의 YM-1 웹과 YM-2 iOS/Android 실제 로그인 동작은 미실행(이번 실행에서 인증된 앱/실기기 접근 없음). 운영 배포/DB 변경 없음. 사람이 `personalized-recommendations` 재배포 후 해당 수동 행을 검증해야 한다. 앱은 구 배포본 응답도 연도로 숨기지만 선택 연도의 후보를 충분히 수집하려면 서버 배포가 필요하다.


### 2026-10-05 추천 묶음 화면 개수 재정정 (47 §14)

- 로그인한 실제 검색 화면: 화면 51개/훅 48개. 추가됨 보존 슬롯 3개를 보충 개수에서 빼고 있어 격자의 마지막 줄이 어긋났다. 화면 슬롯의 고유 개수를 보충·스크롤에 공통 적용했다. 보존 슬롯 위치·등록/제외 정책은 유지한다.
- 커서가 진전한 빈 응답을 즉시 오류로 처리하던 분기를 제거해 기존 무진전 3회·6회·45초 한도로 이어 찾는다. 요청 시작 목표를 캡처해 첫 요청 로그의 이전 목표 문제도 수정했다.
- 기존 테스트 989/990 → 993/994(기존 recommendationEngine 실패 1개 동일). 신규 표시 슬롯 테스트 3개는 구현 전 실패/후 통과, 기존 한도 보존 테스트 1개 추가. 관련 30개 통과. typecheck·lint·diff 검사 통과.
- 기존 8081 프로세스가 없어 캐시를 비운 같은 포트 서버를 시작한 뒤 실제 브라우저 재로드. 웹 1440에서 새 코드의 로그: 12→24(target24), 빈 응답24→24(target36) 이후 자동24→36(target36). 빈 응답 직후 수동 재시도 없이 보충됨을 확인했다.
- 사용자 라이브러리 기록을 임의로 추가/삭제하지 않았다. 실제 등록 후 슬롯 유지 흐름과 네이티브 QA는 남아 있으며 순수 회귀 테스트로만 검사했다. 서버·DB·배포·커밋 없음.

### 2026-10-05 추가·완료 후 다음 추천 12개 (47 §15)

- 성공 후 예약 보충의 `computeRefillLimit(표시 수, 12)` 경로를 공통 `loadNextBatch`로 연결했다. 최신 캐시 표시 수 + 12를 목표로 하고, 짧은 응답은 같은 목표까지 이어 찾는다. 연속 성공은 기존 800ms trailing 예약 한 번으로 모으며 진행 중 조회가 끝날 때까지 예약을 유지한다.
- 예약 당시 scope 검사, 새 묶음 시작 전 요청 잠금 검사, 첫 요청부터 6회·45초 탐색 예산 적용, 이전 조회 오류/무진전 카운터 초기화를 추가했다. 스크롤도 추가 진행·예약 대기를 로딩 상태로 보아 중복 묶음 시작을 막는다. 변경: `usePersonalizedRecommendations.ts`, 검색 화면의 스크롤 판정, AddFlow 회귀 테스트, 47 §15와 08의 추천 흐름.
- 관련 순수 조합 테스트 **62/62** 통과(신규 AB-1~AB-6 포함). 전체 기준선 **993/994** → 수정 후 **999/1000**; 기존 `recommendationEngine.test.ts`의 `uses latest-popular fallback ordering with an empty library` 1개 실패만 동일. typecheck·lint·diff 공백 검사 통과. 로그: `/tmp/scenenote-action-batch-{before,after,typecheck,lint}.log`.
- 웹 Chrome에서 실제 추천 훅·React/TanStack Query에 모의 인증/추천 응답을 연결한 격리 화면을 실행했다. 단일 완료 표시12→24, 첫 응답5개 후 부족분7개 요청으로24 도달, 연속 완료3건 표시36→48(추가 요청1회), 조회 중 완료 표시48→60 후 예약된 묶음으로72 도달을 확인했다. 실패는 표시72·목표72로 복원되고 추가 요청이 없었다. 예약 대기 중 필터 변경은 이전 예약을 취소하고 새 초기12개 요청만 실행했다. 진전한 빈 응답3회는 목표24에서 중단, 다음 완료 성공으로24까지 복구했다.
- 격리 검증 소스/HTML/증빙은 `/tmp/scenenote-action-batch-qa/`에 보관하고 임시 `public` 페이지는 정리했다. 최종 증빙 `result.png`는 표시24·목표24 및 요청12→7(응답5+7)을 보여준다. 실제 라이브러리 서버 저장을 모의 성공으로 대체한 검증이며 사용자 기록을 변경하지 않았다. 실제 계정의 완료 저장과 함께 재현하는 QA, iOS/Android 실기기 터치·네트워크 검증은 미실행(실기기 없음; 사용자 감상 기록에 테스트 작품을 임의 등록하지 않음). 관심 없음/테마 줄이기 legacy 보충은 이 추가·완료 후속 수정의 범위 밖이다. 서버·DB·배포·커밋 없음.
