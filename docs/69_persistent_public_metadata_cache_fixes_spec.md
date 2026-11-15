# 69. 공개 메타데이터 영속 재사용과 수동 갱신

작성일: 2026-11-15
선행 문서: [00 UI](00_ui_style_rules.md), [11](11_screen_implementation_spec.md), [33](33_kr_ott_availability_spec.md), [38](38_japanese_person_korean_name_spec.md), [49](49_content_crew_display_spec.md), [50](50_content_crew_storage_list_display_spec.md), [54](54_anime_sequel_watch_providers_fixes_spec.md), [59](59_favorite_person_category_sync_spec.md), [64](64_recommendation_invocation_cost_fixes_spec.md).

## 1. 문제 정의

사용자는 상세 진입 때 보러가기가 다시 로딩되는 것을 신고하고, **DB에 저장한 뒤 다시 불러오기를 누를 때만 재검색**하도록 요청했다. 후속 요청은 모든 API 흐름에서 “한 번 저장해두면 계속 사용 가능한 부분”을 찾아 보완하는 것이다.

- F-1: 보러가기는 Jotai 메모리 1시간 캐시뿐이며 서버 DB 캐시가 없다.
- F-2: 작품 상세는 DB 작품이 있어도 외부 조회·메타데이터 쓰기·첫 시즌 회차 선조회를 반복한다. 출연진·현지화 결과도 재사용하지 못한다.
- F-3: 인물 상세·검색의 이름 보정·분류·한글 이름 해석이 같은 공개 프로필을 별도로 조회한다.
- F-4: 상세 캐시의 수명보다 짧은 GC, 직접 서비스 호출, 갱신 오류 뒤 무효화로 동일한 결과를 다시 요청한다.
- F-5: 갱신 중/실패 시 기존 제공처나 상세가 사라지며 정상 제공처에는 갱신 행동이 없다.

## 2. 근본 원인

`get-watch-providers`는 인증 뒤 매번 TMDB를 호출했다. `useWatchProviders`의 atom은 새로고침/재시작 때 사라지고, 한 시간 뒤 자동 조회했다. `WatchProviderList`는 loading/error 조건으로 저장된 행까지 숨겼다.

`get-content-detail`은 DB를 실패 폴백으로 사용했다. `pinLocalization`의 서비스 직접 호출은 화면의 Query 캐시를 우회했다. `get-person-detail`·`classify-people`·`resolve-person-names`·`search-person-content`에는 공유 인물 프로필 저장소가 없었다.

전체 Edge 호출 경로의 점검 결과:

| 경로 | 저장 재사용/유지할 갱신 |
|---|---|
| get-watch-providers | 이번 영속 저장·명시 갱신 |
| get-content-detail | 이번 전체 공개 메타데이터 저장; 추천 출연진·빠른 보기·핀 번역도 공유 |
| get-person-detail | 이번 인물 상세 영속 저장·명시 갱신; 나이는 로컬 계산 |
| classify-people / resolve-person-names | 이번 공개 프로필 공유, 30일 재확인; 본인 좋아하는 인물 쓰기는 기존 RLS 경로 |
| search-person-content | 검색 목록 자체는 새 작품/인물이 추가되는 데이터; 개별 프로필·한글 보정은 이번 저장 재사용 |
| add-to-library / bulk-register-netflix | 기존 등록 빠른 경로 + 이번 직전 상세 메타데이터 공유; 사용자 등록 쓰기는 캐시하지 않음 |
| fetch-episodes | 일반 회차는 기존 DB 우선; 방영 중 공개 회차는 30분/방영 시점 갱신 유지 |
| search-content | 기존 서버 DB 1시간·앱 페이지 캐시·300ms 디바운스 유지; 새 검색 결과를 영구 고정하지 않음 |
| personalized-recommendations | 기존 공급자 페이지/키워드/보정 DB 캐시·호출 상한·노출 기록 합치기 유지; 취향/등록/신작 변화 반영 |
| popular-recommendations | 기존 응답 30분·애니 한국어 보강 7일 캐시 유지 |
| similar-content | 기존 공개 후보 DB 스냅샷과 후속 페이지 재사용; 등록 제외는 현재 계정 기준 |
| create-library-share / get-library-share | 기존 DB 공유 데이터·유효기간/권한 검사 유지; 생성/만료 응답을 영구 고정하지 않음 |
| delete-account / Auth / 사용자 CRUD·RPC | 의도한 인증·쓰기·현재 사용자 기록 조회이며 영속 메타데이터 캐시 대상으로 삼지 않음 |

## 3. 재현 시나리오

1. 상세를 열어 보러가기·작품 정보·인물 정보를 받는다.
2. 다른 화면으로 갔다가 돌아오거나 앱을 다시 시작한다.
3. 기존에는 서버 외부 호출이 반복될 수 있었다. 변경 후 같은 앱 캐시는 요청 0회, 콜드 앱은 DB 저장값을 읽고 외부 요청 0회다.
4. 다시 불러오기를 누르면 외부 조회 후 성공한 결과만 교체한다. 실패하면 이전 값을 표시한다.

## 4. 설계 결정

### D-1. 저장 가능한 공개 정보는 DB 우선

기존 service-role 전용 `external_search_cache`에 버전별 namespace로 **보러가기 전체 응답, 정규화 작품 메타데이터(cast/crew/줄거리/시즌), 인물 상세와 공개 프로필**을 저장한다. 새 테이블·마이그레이션·권한 확대는 없다. `expires_at = 'infinity'`인 영속 행을 전용 helper가 읽는다. 사용자별 기록·인증 정보는 저장하지 않는다.

### D-2. 정상 결과의 외부 재조회는 명시적 갱신

보러가기·작품 상세·인물 상세의 정상 결과는 시간 경과만으로 자동 재조회하지 않는다. 미저장 첫 조회와 `force_refresh: true`만 외부를 부른다. 정상 empty/미확인도 저장한다. 공개 회차는 별도 동적 경로를 유지한다. 인물 검색·자동 이름/분류의 공개 프로필은 최대 30일을 재사용하고 이후 필요할 때 한 번 갱신해 기존 이름 재확인 계약을 보존한다.

이 사용자 지시는 docs/54 D-9의 캐시 금지, §15-6/§16-2의 1시간 자동 갱신·Jotai 이관 제외와 docs/11의 외부 상세 10분 정책을 이 범위에서 대체한다. 시즌 정확성·시리즈 대체 금지·라프텔 검색 전용·JustWatch 표시는 유지한다. docs/38 이름 우선순위/30일 재확인·docs/59 세션별 분류 동기화는 유지하며 공유 서버 저장소를 사용한다.

### D-3. DB 장애를 외부 요청으로 숨기지 않는다

DB read 실패는 cache miss가 아니다. 오류를 반환하고 외부를 호출하지 않는다. 외부/저장 실패는 정상 empty로 저장하지 않고 기존 행을 보존한다. 잘못된 저장 응답은 명시 오류이며 사용자가 갱신할 수 있다. 인증은 캐시보다 먼저 확인한다.

### D-4. identity와 동시 요청

출처·영화/TV·외부 ID·계약 버전은 분리한다. OTT는 KR·시즌·매칭에 쓰는 제목/원제/공개일도 분리한다. 작품 캐시에 내부 content_id/개인의 등록 여부를 넣지 않는다. 같은 앱 Query와 같은 Edge isolate의 진행 중 요청을 공유한다. 서로 다른 isolate까지 최초 호출 1회를 보장하지 않는다.

미등록 상태에서 받은 앱 상세 캐시에 content_id가 없더라도, 현재 라이브러리의 동일 출처/외부 ID·영화/TV에서 실제 등록 항목을 찾아 시즌 규칙을 적용한다. 공개 캐시를 갱신하지 않고도 이후 등록/삭제를 반영한다. TMDB 직접 OTT 요청은 응답의 tmdb_id·tmdb_season_number도 요청 대상과 같아야 한다. AniList의 정확 날짜 근거에 따른 다른 번호 매핑은 보존한다.

### D-5. 화면은 저장값 유지 + 명시적 갱신

TanStack Query로 저장된 결과를 재사용한다. 성공/실패 뒤 mount·focus·reconnect·일반 invalidate로 자동 조회하지 않는다. 명시적 갱신은 같은 key에 fetchQuery로 실행해 중복을 합치고, 실패해도 기존 data를 보존한다. 직접 상세 서비스도 같은 캐시를 거친다. 갱신 버튼은 최소 44pt이며 진행 중 비활성, 오류는 한국어다. 구서버의 정확한 시즌 응답은 표시하되 영속 저장을 확인했다고 안내하지 않는다.

### D-6. 바뀌는 값은 분리

공개 회차의 30분/방영 시점 재조회, 검색·추천의 시간 제한 캐시·페이지·취향/등록 제외, 사용자 기록의 mutation/무효화, Auth/RLS 검증은 유지한다. 인물 나이는 저장된 생일/사망일에서 읽을 때 계산한다. 작품의 신규 시즌/화수·인물의 새 출연작은 상세의 다시 불러오기로 갱신할 수 있다.

> D-N은 임의로 변경하지 않는다. 기존 명세와 달라지는 부분은 위의 사용자 요청에 한해 명시했다.

## 5. 기각한 대안

- 모든 Query의 staleTime을 전역 Infinity로 변경: 사용자 기록·공개 회차가 갱신되지 않는다.
- external_search_cache를 앱에 공개: service-role 전용 보안 계약을 깬다.
- 오류/타임아웃을 빈 결과로 영구 저장: 일시 장애가 실제 데이터 없음으로 고정된다.
- 검색·추천 결과를 영구 고정: 신규 작품과 취향 변경을 반영하지 못한다.
- 모든 사용자 Query를 기기에 영속 저장: 이번 공개 메타데이터 재사용 범위와 개인정보 수명 주기를 섞는다.

## 6. 계약

`readThroughPersistentMetadata({key,source,store,forceRefresh,fetchFresh,isValid})`는 `{data,fromCache}`를 반환한다. 정확 key DB read → 응답 검증 → 반환, 또는 최초 miss/명시적 갱신 → 외부 조회 → 검증 → DB 저장 → 반환 순서다.

정상 응답에는 `cache_policy: 'manual-v1'`, `from_cache`를 추가한다. OTT의 `updated_at`은 마지막 외부 확인 시각이며 DB hit 때 바꾸지 않는다. 인물 상세도 최초 저장/수동 갱신 시각을 보존한다. `force_refresh`의 비부울 입력은 400이다. 오류는 고정 코드와 정제된 문구를 반환한다.

인물 상세의 무데이터 오류 화면 재시도도 명시적 force 갱신이다. AniList 출연작의 필수 페이지에 GraphQL 오류·connection 누락이 있으면 부분 목록을 정상 스냅샷으로 저장하지 않는다. 저장된 프로필이 분류/이름 동기화에서 갱신됐으면, 인물 상세의 캐시 적중도 외부 요청 없는 DB peek로 최신 분류/이름을 계산한다.

## 7. 데이터 모델

기존 `external_search_cache(query_hash,source,response_json,expires_at)`와 unique key를 재사용한다. `query_hash`는 TEXT로 namespace를 포함한 결정적 키다. 일반 검색/추천 TTL 행과 서로 다른 namespace를 쓴다. RLS·GRANT·사용자 테이블·secret은 변경하지 않는다.

## 8. 화면 명세

공통 UI 규칙 UI-1~UI-13을 따른다. 보러가기는 항상 “다시 불러오기”, 마지막 확인 시각을 보여준다. 갱신 중에도 탭/링크를 유지한다. 작품 상세는 “작품 정보 다시 불러오기”, 인물 상세는 “인물 정보 다시 불러오기”를 제공한다. 갱신 실패는 기존 본문 옆 작은 안내/토스트로 표시한다.

보러가기의 기존 어두운 패널 색을 `theme.ts`의 추가 토큰 `surfaceDark`, `surfaceDarkRaised`, `borderDark`, `textOnDark`, `textOnDarkMuted`, `focusOnDark`로 옮긴다. 기존 공용 토큰 값은 바꾸지 않으며 새 다크 모드를 도입하는 변경은 아니다.

## 9. 엣지 케이스

첫 저장·콜드 읽기·empty·명시 갱신·실패 보존·DB 장애·잘못된 저장값·출처/종류/시즌 격리·동시 요청·미등록 후 등록·윤년/생일·오래된 프로필은 아래 테스트로 대응한다.

## 10. 테스트 표

모든 행을 자동 테스트 또는 명시적 UI QA에 대응한다. 기존 시즌·추천·공개 회차 회귀는 보존한다.

| ID/위치 | 기대 |
|---|---|
| persistentMetadataCache PM-1~PM-15 | 콜드 DB 재사용/정상 empty/force/DB·외부·저장 오류/잘못된 응답/identity/in-flight/adapter 권한 경계 |
| contentMetadataStore CM-1~CM-9 | 출처·종류 분리, 상세·cast·crew 저장 재사용, force/실패 보존, 개인 등록값 미저장, DB 장애·중첩 응답 검증 |
| personMetadataCache PN-1~PN-5 | identity/분류 fallback 분리, 유효·잘못된 상세, 생일/사망/날짜 검증 |
| watchProviderLookup 기존 회귀 + WC-1~WC-5 | 수동 캐시 정책/구서버 구별/확인 시각, 기존 시즌 분리·메타 대기·오류 재시도 보존 |
| personProviderStore 신규 회귀 | 공유 프로필 재사용·30일 경계·수동 갱신·출처 격리·실패 보존 |
| seasonLibraryMatch MCACHE-1~MCACHE-2 | 미등록 상세 캐시 뒤 등록/삭제 반영, 출처·영화/TV·시즌 분리 |
| 실제 핸들러 격리 | 인증/입력, 정확 시즌, DB hit 외부 0회, force 성공/실패, 미등록 후 content_id 최신 조회, cache hit 쓰기/회차 선조회 0회 |
| 실제 Query/서비스 격리 | 동시 요청 공유, mount/focus/reconnect/invalidate 시 재요청 방지, force 실패 후 data 유지, 직접 서비스 공유 |
| M-1 웹 1440/768 | 갱신 버튼·기존 데이터 유지·가로 넘침·44px |
| M-2 웹 375 | 갱신 버튼 줄바꿈/탭/링크 유지·가로 넘침·44px |
| M-3 iOS/Android 세로 | 안전 영역·글자 1.3배·스크린리더·갱신 중 상태; 미실행이면 이유 보고 |

## 11. 변경 파일 목록

`_shared/persistentMetadataCache*`, `contentMetadataStore*`, `personMetadataCache*`, `personProviderStore*`; `get-watch-providers`, `get-content-detail`, `get-person-detail`, `add-to-library`, `bulk-register-netflix`, `classify-people`, `resolve-person-names`, `search-person-content`의 해당 metadata 경로. 앱은 watch 훅/서비스/타입/표시, content 상세 훅/서비스/화면, people 상세 훅/서비스/화면/타입, `metadataQuery`, Query key와 필요한 추가 색 토큰. 구조는 04/08, 이 문서 진입점은 AGENTS/목차, 실행 증거는 development_next_steps에 기록한다.

## 12. 범위 밖

Auth·사용자 CRUD·RLS·DB 마이그레이션·secret·추천 후보 알고리즘/정렬·검색 결과 계약·공개 회차의 자동 갱신·무관한 UI 개편. 캐시 저장 실패를 숨기는 우회는 금지한다. 운영 배포는 검사/백업/대상 확인을 마친 후 기존 배포 승인 규칙을 따른다.

## 13. 별도 검증 필요

실제 외부 데이터 변경 시각/요금은 제공처·요금제에 따라 다르므로 코드의 호출 감소와 실제 청구 금액 절감을 구분한다. 재시작 후 첫 DB 읽기용 Edge 호출 1회는 남으며 이를 외부 API 0회와 혼동하지 않는다. 새로운 계약의 운영 적용 전 웹 확인과 fixture의 성공을 구분한다.

## 14. Codex 실행 지시

### ROLE & GOAL / READ FIRST

SceneNote의 F-1~F-5를 이 문서대로 구현한다. 먼저 docs/00_ui_style_rules.md, AGENTS.md, 이 문서, 선행 기능 명세와 실제 진입 코드를 읽는다. 사용자의 이번 DB 저장·수동 갱신 요청이 대체한 계약만 바꾼다.

### STEP 1 — 기준선과 실패 테스트

pwd·git root·git status를 기록하고 npm test 기준선을 남긴다. 신규 저장/갱신·호출 수 회귀를 먼저 써 red를 확인한다. 기존 테스트 표·시즌 정확성·공개 회차 자동 갱신 테스트는 줄이지 않는다.

### STEP 2 — 공용 DB 저장과 서버

주입 가능한 공용 helper, 정확 namespace/validator, 정상 empty·오류 보존·in-flight 공유를 만든다. OTT/콘텐츠/인물/공유 프로필 경로를 연결한다. 신규 등록은 직전 상세 메타데이터를 재사용한다. DB 저장 성공 전 성공 응답을 반환하지 않는다.

### STEP 3 — 앱과 화면

상세 캐시와 직접 서비스를 공유하고 자동 mount/focus/reconnect/오류 재시도를 차단한다. 수동 갱신과 기존 데이터 유지 UI를 연결한다. 인물 나이는 로컬 계산, 공개 회차 자동 갱신은 유지한다.

### STEP 4 — 검증과 기록

10장 전부를 대응하고 `npm test`, `npm run typecheck`, `npm run lint`, 웹 export, 변경 Edge Deno check, `git diff --check`를 실행한다. UI-13.2 추가 줄 토큰·Alert 검사를 확인한다. 웹/앱 수동 결과와 실행 불가 사유를 구분한다.

### DoD / 보고 항목

1. 변경 파일/이유와 저장 재사용 대상·동적 갱신 대상을 보고한다.
2. red/기준선/최종 검사와 실제 호출 수 fixture 근거를 보고한다.
3. 웹·앱 결과와 한계를 구분한다.
4. 서버 배포 여부·남은 적용 단계와 DB/secret 영향 여부를 명시한다.

### 금지사항

기존 변경 덮어쓰기·사용자 기록 변경·새 schema/RLS 완화·외부 secret 노출·실패를 empty로 영구 저장·무분별한 전역 Infinity·공개 회차 동결·검증 없는 운영 배포를 하지 않는다.
