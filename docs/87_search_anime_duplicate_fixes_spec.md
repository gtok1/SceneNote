# 87. 애니 검색의 제공처 간 중복 표시 정정 명세

작성일: 2026-11-20

대상 브랜치 기준: main (`0ca465180fdf2cd77d3f9c7605199f274de3a78f`, 다른 작업의 미커밋 변경 보존)

선행 문서: [UI 규칙](00_ui_style_rules.md), [15 시즌 검색](15_season_search_spec.md), [17 시즌 추적](17_season_library_tracking_spec.md), [34 시즌·인물 복원](34_search_seasons_and_people_restore_spec.md), [62 애니 전체 시즌](62_anime_search_all_seasons_fixes_spec.md), [67 시즌 카드 누수](67_anilist_season_card_leak_fixes_spec.md)

## 1. 문제 정의

무직전생 3기의 같은 방영 단위가 AniList·TMDB 카드 두 장으로 보인다. 번역된 기본 제목만 같은 후속기·분할 방영은 반대로 합치면 안 된다. 같은 원인의 중복 판정을 서버·앱에서 함께 정정하며, 라이브러리의 기존 제공처·시즌 등록 상태도 유지한다.

## 2. 근본 원인

기준 커밋의 `search-content/adapters/normalize.ts:49-83`은 정확한 제공처 식별자를 먼저 모은 뒤 `areSameWork`(`:180`)로 제목을 비교한다. 이 비교는 공백·문장부호를 뺀 표시 제목/원제가 정확히 같아야 한다. AniList 원제의 `Ⅲ`와 TMDB의 `시즌 3`은 같은 단위를 나타내지만 문자열은 다르다. AniList의 TMDB 한국어 번역 보완은 후속기에도 시리즈 기본 제목을 주어 화면 구분도 흐린다.

앱의 페이지 병합과 제목·인물 결과 병합은 별도 판정을 사용했다. TMDB 영화·TV는 숫자 ID 공간도 달라야 하며, 카드 대표가 AniList로 바뀌어도 기존 TMDB 시즌 등록을 잃어서는 안 된다.

## 3. 재현 시나리오와 실측

1. 검색에서 `무직전생`을 조회하고 같은 2026년 3기의 AniList·TMDB 카드 두 장을 확인한다.
2. 2027년 3기 파트 2, 2023·2024년 2기의 분할 방영도 함께 확인한다.
3. TMDB 3기를 등록한 상태에서도 병합 카드가 등록 상태·해당 시즌 행동을 유지하는지 확인한다.

읽기 전용 SQL 조사 범위는 **461개 질의의 공개 검색 캐시 888행·4,142결과 스냅샷**이다. 이 전체 스냅샷을 오프라인 대조하되, 전체 외부 카탈로그의 완전성 보장으로 해석하지 않는다.

| 제공처·ID | 관측한 방영 단위 | 판정 |
|---|---|---|
| AniList 178789 | 원제 `無職転生Ⅲ ～異世界行ったら本気だす～`, 2026-07-04, 14화, raw 시즌 없음, 공식 별칭에 第3期/3rd Season | 아래 TMDB 3기와 같은 단위 |
| TMDB 94664, 시즌 3 | 2026-07-03, 14화, 한국어 제목에 시즌 3 | 위와 날짜 1일 차이, 한 카드로 표시 |
| AniList 217434 | 2027년 3기 파트 2 | 별도 유지 |
| AniList 146065 / 166873 | 2023년 실제 2기 13화 / 2024년 2기 파트 2 12화 | 각각 별도 유지 |
| TMDB 94664, 시즌 2 | 24화의 시즌 범위 | 위 분할 방영과 범위가 달라 별도 유지 |

오프라인 비교에서 무직전생 3기는 두 장에서 한 장이 되지만, 1기 전체 23화와 11+12화 파트처럼 범위가 다른 카드의 잘못된 병합도 복원되어 전체 카드 수는 9장으로 같았다. 성공 여부는 총 개수만으로 판단하지 않고 방영 단위별로 확인한다.

## 4. 설계 결정

### D-1. 검색 표시만 병합하고 기록 식별자는 보존한다 (최우선)
docs/34 D-3대로 **두 raw `season_number`가 모두 있고 다르면 병합하지 않는다**. 이미 병합된 `equivalent_results` 전체에도 이 관문을 적용한다. 중간 제공처 하나를 통해 같은 출처의 서로 다른 ID나 서로 다른 raw 시즌이 한 그룹으로 합쳐지면 안 된다. docs/15·62의 SEQUEL 체인 기수와 docs/17 저장 시즌은 바꾸지 않는다. 동일 출처의 서로 다른 ID는 제목이 같아도 모두 남긴다. 같은 출처·ID의 전체 카드보다 시즌 카드를 남기는 기존 계약은 보존한다. TMDB 식별자는 movie/tv 공간으로 나눈다. docs/11의 제공처 간 자동 canonical 병합 금지는 DB·사용자 기록에 계속 적용하며, 이번 사용자 요청은 검색 카드 표시에 한해서만 대체한다.

### D-2. 애니 교차 제공처 병합은 같은 방영 단위의 근거를 요구한다
연도가 양쪽 모두 알려져 있고 같아야 한다. 일반 애니는 양쪽 `content_type=anime`과 같은 `has_seasons`를 요구한다. 예외는 AniList `anime_format=MOVIE`와 TMDB `movie`이면서 Animation/애니메이션 장르인 쌍뿐이다. 의미상 시즌·part/cour·특별편 여부가 다르면 거절한다. 날짜가 둘 다 있으면 7일 초과 차이를, TV 화수가 둘 다 있으면 서로 다른 화수를 거절한다.

이 관문을 통과한 기존 정확 제목 일치는 유지한다. 제목이 달라 시즌 표기를 뺀 기본 제목으로 대조할 때는 **양쪽 유효 날짜·7일 이내·알려진 같은 화수**를 모두 요구한다. 근거가 없으면 두 장을 유지한다.

검증된 AniList MOVIE ↔ TMDB 애니 영화의 병합 카드는 애니·영화 필터 양쪽에서 보인다. 등록에 따른 대표 제공처 변경에도 이 등가 단위의 유형 의미를 유지한다. 국가·장르·연도 조건은 그대로 적용하고 TV·OVA·검증되지 않은 영화에는 이 예외를 넓히지 않는다.

### D-3. 제목 해석은 대조·표시용이며 검색어 해석을 바꾸지 않는다
NFKC 정규화 후 로마 숫자, `N기`·`시즌 N`·`Nth Season`·`第N期`, part/cour/쿨 표기를 해석한다. 원제에 붙은 로마 숫자는 원문에 명시적 Unicode 숫자(Ⅰ~Ⅻ)가 있음을 확인하고, 영문 끝 로마 숫자는 두 글자 이상인 경우만 해석한다. 고유 제목 `ガンダムX`의 ASCII X나 V를 10기·5기로 만들지 않는다.

원제·표시 제목만 기본 제목 비교 키로 쓴다. 공식 AniList 제목·별칭(`match_titles`)은 시즌·파트·특별편 근거로만 보완한다. 직접 시즌 근거 없이 별칭에 여러 시즌이 섞였으면 모호한 것으로 보고 병합을 거절한다. 공통 기본 별칭만으로 모든 후속기를 합치지 않는다. 합성된 체인 기수보다 공식 원제의 기수를 우선한다.

### D-4. 공유 판정과 제공처별 원래 identity를 함께 보존한다
순수 공유 모듈 `_shared/searchResultMerge.ts`를 서버 정규화, 앱 페이지 병합, 제목·인물 병합에서 재사용한다. 애니의 AniList 우선·그 밖의 TMDB 우선 정책과 비어 있는 메타데이터 보완을 유지한다. `matched_people`는 중복 없이 합치고, `equivalent_results`에는 양쪽 제공처·ID·미디어 유형·raw 시즌 identity를 남긴다. 기존 필터 표시 정보도 잃지 않는다. 페이지의 동일 identity 재등장은 첫 카드 우선이다.

### D-5. 이미 등록된 정확한 identity를 카드의 대표로 사용할 수 있다
앱은 등가 identity 중 **같은 제공처·미디어 공간·같은 raw 시즌**의 라이브러리 행이 있으면 그 identity로 카드 행동·상태를 연결한다. 다른 시즌, 전체 등록과 시즌 등록, 같은 숫자 ID의 영화·TV를 혼동하지 않는다. 여러 등가 identity가 서로 다른 상태로 등록되었으면 요청한 상태가 있는 identity를 정확한 미디어 공간·시즌으로 확인해 상태 필터를 통과시킨다. 대표 카드의 상태 하나로 다른 정확한 등가 등록을 숨기지 않는다. 상태 필터의 기존 대표 작품 단위 판정과 `content_type`·시즌 없는 최소 입력 호환은 유지하며, 등가 제공처로 추가 통과할 때는 알려진 미디어 공간과 정확한 시즌(전체는 명시적 null)을 요구한다. 대표 정보만 바꾸며 DB 쓰기·기록 이동은 없다.

### D-6. 제목과 메타데이터 앞에 공식 방영 단위를 표시한다
`formatSearchResultTitle`에서 AniList 한국어 기본 제목에 원제/공식 별칭의 `3기`, `파트 2`, `특별편`을 복원한다. 체인이 합성한 `3기`라도 원제가 `Ⅱ`이면 **표시만 2기**로 고친다. 시즌 없는 파트 2는 `1기 파트 2`로 구분한다. 반복해서 포맷해도 기수·파트·특별편을 중복해 붙이지 않는다. 등록값은 그대로다. 기존 TMDB `series_title` 접두 표시는 보존한다.

375 폭의 두 줄 제목에서는 끝의 기수까지 보이지 않을 수 있다. `searchResultReleaseLabel`로 같은 방영 단위 라벨을 만들고 `SearchResultGalleryCard`·`SearchResultItem`의 **메타데이터 배열 맨 앞**에 넣어 구분을 유지한다. AniList는 공식 의미의 기수/파트/특별편, 그 밖의 시즌 카드는 `시즌 N`, 영화는 라벨 없음이다. 스타일·제목 줄 수는 바꾸지 않는다.

### D-7. 호출을 늘리지 않고 앱에서 구응답도 방어한다
이미 수집한 메타데이터와 공식 제목을 전달한다. 검색 캐시 버전은 `ko-v17-anime-release`로 바꾸어 새 서버 소스의 이전 캐시와 분리한다. 추가 외부 조회·DB 수정·운영 배포는 실행하지 않는다. 앱 병합은 기존 서버 응답에도 적용한다.

> D-N은 임의로 바꾸지 않는다. 충돌을 발견하면 해당 변경을 멈추고 근거를 보고한다.

## 5. 기각한 대안

- 제목에서 시즌을 지우고 전부 병합: 파트·특별편·시즌 범위가 다른 카드를 잃는다.
- 모든 별칭을 기본 제목 키로 사용: 같은 시리즈의 여러 후속기가 함께 합쳐진다.
- 체인 기수·라이브러리 제공처를 자동 정정: 검색 표시 요청을 넘어 기존 기록 단위를 바꾼다.

## 6. 계약 (타입·판정 순서)

`SearchMergeIdentity`는 `external_source`, `external_id`, `content_type`, 선택적 `season_number`다. `SearchMergeResult`는 제목·연도·날짜·화수·시즌 유무와 선택적 `anime_format`, `match_titles`, `equivalent_results` 등을 받는 순수 메타데이터 타입이다.

```ts
getSearchExternalKey(result): string; // TMDB는 tmdb:movie|tv:ID, 그 외 source:ID
getSearchResultKey(result): string; // 외부 키 + raw 시즌 또는 whole
areSameSearchWork(left, right): boolean;
compactSearchResults<T extends SearchMergeResult>(results: readonly T[], options?: { exactFirstWins?: boolean }): T[];
formatAnimeSearchTitle(result: Partial<SearchMergeResult> & { title_primary: string }): string;
// src/utils/searchResultTitle.ts
searchResultReleaseLabel(result: Pick<SearchResult, "title_primary"> & Partial<SearchResult>): string | null;
```

정확 identity 정리 → 같은 미디어 공간의 전체/시즌 카드 정리 → D-1~D-3의 교차 제공처 판정 → D-4 메타데이터·등가 identity 병합 순서다. 입력은 변경하지 않는다. 서버/앱 `SearchResult`에 `anime_format`, `equivalent_results`를 선택적으로 추가하고, 공식 title 3종·synonyms를 `match_titles`로 전달한다. 필터 annotation과 UI 키도 새 미디어 공간 식별자를 사용한다.

## 7. 데이터 모델 / SQL

없음. 검색 응답의 선택적 메타데이터만 늘어난다. `contents`, `user_library_items`, 시즌 테이블·RLS·canonical ID는 그대로다.

## 8. 화면 명세

검색의 목록·갤러리에서 동일한 방영 단위는 한 카드가 된다. 3기·파트 2·특별편은 제목과 메타데이터 첫 항목에서 구분하며, 좁은 격자에서 제목 끝이 잘려도 메타데이터로 식별한다. 기존 등록 행이 있으면 그 행의 상태·버튼으로 연결하고, 다른 정확한 등가 등록의 요청 상태도 필터에 반영한다. 검증된 애니 영화 병합 카드는 애니·영화 유형 양쪽에 남는다. 필터 숨김 개수·모두 보기 계약, 기존 스타일·제목 줄 수·레이아웃은 유지한다. UI 규칙 준수(UI-1~UI-13).

## 9. 엣지 케이스

| ID | 상황 | 기대 | 테스트 |
|---|---|---|---|
| E-1 | 분할 방영·특별편·동일 제공처의 다른 ID·raw 시즌 충돌, 중간 제공처를 통한 등가 그룹 합류 | 그룹 전체에서 별도 유지 | T-2 |
| E-2 | 날짜·화수·연도 부족 또는 충돌, 공통 기본 별칭만 존재·복수 시즌 별칭, 고유명사 X | 느슨한 기본 제목 병합 거절·시즌 오해석 방지 | T-3 |
| E-3 | TMDB 영화/TV 숫자 ID 충돌, 애니 영화/실사 영화 | 공간 분리, D-2 영화 예외만 허용 | T-4 |
| E-4 | 여러 페이지/인물 경로 재등장·서로 다른 상태의 등가 등록·좁은 격자의 긴 제목 | 중복만 정리, 정확 등록 상태·메타 기수 유지, 표시/저장 기수 분리 | T-6~T-8 |

## 10. 테스트 표

**모든 행을 자동 테스트로 옮기며 줄이지 않는다.** 아래는 계약 그룹이며, 각 그룹의 모든 경우를 검증한다. 실행 결과·개수·실패 증거는 [development_next_steps](development_next_steps.md)에 실제 실행 후 기록한다.

| ID | 입력·검증 범위 | 기대·자동 테스트 위치 |
|---|---|---|
| T-1 | 실측 178789 ↔ 94664 시즌 3, 정확 제목의 기존 호환, 입력 스냅샷 | 한 카드·등가 identity 유지·입력 불변; `_shared/searchResultMerge.test.ts` T1/T8 |
| T-2 | 217434 파트 2, 146065/166873와 TMDB 2기, 특별편, 같은 출처의 다른 ID, raw 시즌 불일치·등가 그룹을 통한 충돌 | 각각 보존; 같은 파일 T2/T3/T5/T12/T15 |
| T-3 | 같은 연도 리메이크의 날짜 충돌, 7일 성공/8일 실패, 화수 불일치·누락, 연도/날짜 누락, 별칭만 공통·복수 시즌 모호함, ガンダムX | D-2·D-3의 증거 관문 유지; 같은 파일 T4/T7/T13/T14/T16 |
| T-4 | 같은 TMDB 숫자 ID movie/tv, AniList MOVIE ↔ TMDB Animation 영화와 양쪽 유형 필터, 실사 영화/TV | namespace 분리·허용한 영화 쌍만 병합·AniList 우선·국가/장르/연도 조건 보존; 같은 파일 T6/T9, `_shared/discoveryFilters.test.ts` |
| T-5 | AniList format·공식 제목 전달, 서버 compactResults, 영화/TV filter annotation | 필드 보존·서버 공유 판정·유형별 필터 표시 분리; 같은 파일 T10/T11와 기존 `adapters/anilist.test.ts`, `adapters/normalize.test.ts` |
| T-6 | 페이지 간 같은 방영 단위, 같은 identity 재등장, 전체/시즌 순서, 서로 다른 시즌·파트·미디어 공간 | 첫 카드 유지와 교차 제공처 병합을 함께 만족; `src/utils/searchPagination.test.ts` |
| T-7 | 제목/인물 경로 중복과 출연자 합집합, 정확 시즌·전체 등록, 여러 등가 등록의 요청 상태, 다른 시즌·같은 ID 영화 등록·상태 필터, 기존 최소 입력 | 등가 정보와 정확 상태·행동 연결, 잘못 등록됨 표시 없음·최소 입력 호환; `src/utils/mergeSearchResults.test.ts`, `src/utils/searchResultVisibility.test.ts` |
| T-8 | 공식 III/第3期/3rd Season, 파트 2·특별편, 원제 II와 합성 체인 3기, 반복 포맷, 메타 앞 라벨·영화 라벨 없음, 기존 시리즈 접두 제목, UI identity | 표시만 복원·기수/파트 중복 없음·등록 기수 보존·미디어별 키 분리; `src/utils/searchResultTitle.test.ts`, `src/utils/searchRecommendationPolicy.test.ts` |

| ID | 플랫폼 | 수동 확인·보고할 결과 |
|---|---|---|
| M-1 | 웹 1440, 기존 8081 | 일반/시즌 제목 검색 및 인물 경로, 2026년 3기 한 장·파트/2기 범위 별도, 기존 TMDB 시즌 등록 상태, 목록/갤러리·필터 모두 보기 |
| M-2 | 웹 375·768 | 긴 제목 끝이 잘려도 메타데이터 맨 앞에서 기수·파트 식별 가능, 기수/파트 중복 없음·행동 정상·페이지 추가 후 중복 재등장 없음 |
| M-3 | 앱 iOS·Android 세로 | 같은 카드 수·제목·등록 행동, 안전 영역·글자 1.3배. 미실행이면 플랫폼별 사유를 남김 |

## 11. 변경 파일 목록

| 파일 | 변경 |
|---|---|
| `supabase/functions/_shared/searchResultMerge.ts`, `.test.ts` | 공유 identity·동일 방영 단위 판정·병합·표시와 T-1~T-4 |
| `supabase/functions/_shared/discoveryFilters.ts`, `.test.ts` | 검증된 애니 영화 병합 카드의 애니·영화 유형 필터 유지 |
| `supabase/functions/search-content/adapters/{anilist,normalize,types}.ts`, `{anilist,normalize}.test.ts` | 공식 메타데이터 전달·공유 병합·필터 annotation |
| `supabase/functions/search-content/index.ts`, `src/types/content.ts` | 캐시 버전·응답 타입 |
| `src/utils/{mergeSearchResults,searchPagination,searchResultTitle,searchRecommendationPolicy,searchResultVisibility}.ts` 및 각 `.test.ts` | 앱 병합·정확 등록 대표·표시·UI 키·상태 필터의 미디어 공간 |
| `app/search.tsx` | 공용 병합 연결·미디어별 라이브러리/행동 키 |
| `src/components/content/{SearchResultGalleryCard,SearchResultItem}.tsx` | 스타일 변경 없이 메타데이터 배열 앞에 방영 단위 라벨 |
| 본 문서, `AGENTS.md`, `docs/README.md`, `docs/08_frontend_architecture.md`, `docs/development_next_steps.md` | 계약·탐색 경로·실제 검증 기록 |

## 12. 범위 밖

DB canonical 병합·중복 기록 삭제, 체인 기수/저장 시즌 변경, 검색어 시즌 파서·docs/67 검색어 판정 완화, OTT 매칭 변경, 추가 메타데이터 요청, 운영 캐시 삭제·Edge 배포는 범위 밖이다. 다른 세션의 변경도 유지한다.

## 13. 확실하지 않음 — 별도 검증 필요

제공처 방영일·화수는 수정될 수 있고, 날짜·범위가 부족한 중복 후보는 의도적으로 남는다. 실측 스냅샷을 전 카탈로그 검증으로 표현하지 않는다. 운영 서버는 재배포 전까지 구소스일 수 있으며, 앱 방어와 서버 소스 변경·운영 반영을 구분해 보고한다. 웹·네이티브 확인 여부도 자동 테스트 결과와 분리한다.

## 14. Codex 실행 지시

**ROLE & GOAL** — SceneNote 구현 담당으로서 같은 애니 방영 단위의 검색 중복과 제목 표시를 정정한다. D-1~D-7을 바꾸지 않는다.

**READ FIRST** — `docs/00_ui_style_rules.md` → 본 명세 → 선행 docs/15·17·34·62·67 → `AGENTS.md` → 11장 구현 파일. 검증에는 `.agents/skills/scenenote-verify/SKILL.md`를 적용한다.

**시작 상태·불변 사항** — `pwd`, Git 루트·브랜치·SHA·status, 현재 테스트 기준선을 기록한다. 다른 세션 변경을 되돌리지 않는다. raw 시즌 충돌 보존·같은 출처 다른 ID 보존·기록 DB 불변을 최우선으로 유지한다.

**STEP 1 — 실패부터 확인.** 10장 T-1~T-8의 결함 재현 사례를 먼저 테스트하고 수정 전 실패 출력을 확보한다. 이미 동작하는 보존 사례는 통과 기준으로 남긴다. 실패하지 않는 새 재현 사례는 원인을 다시 확인하고 보고한다.

**STEP 2 — 공유 판정.** 6장 순서로 구현하고 서버 어댑터를 연결한다. 등가 그룹 전체에서 ID·raw 시즌 충돌을 막고 고유명사 X·모호한 시즌 별칭을 보호한다. 단순 제목 일치 대신 D-2·D-3의 단위 근거를 사용하며, raw 시즌과 사용자 기록은 수정하지 않는다.

**STEP 3 — 앱 연결.** 페이지·제목/인물 결과를 같은 함수로 병합하고 등가 identity·정확 등록 대표·요청 상태·표시 제목·미디어별 UI 키를 연결한다. 검증된 애니 영화의 양쪽 유형 필터와 기존 첫 페이지 우선 계약을 검증한다. `searchResultReleaseLabel`을 두 검색 카드의 메타데이터 앞에 연결하고 반복 포맷·좁은 제목 잘림을 확인한다. 스타일은 바꾸지 않는다.

**STEP 4 — 검증·기록.** 관련 순수 테스트 후 전체 `npm test`, `npm run typecheck`, `npm run lint`를 실행한다. 이 Mac은 검증 스킬의 Node 24 옵션을 사용한다. 타입/린트는 Edge 실행을 대신하지 않는다. UI-13.2 검사와 M-1~M-3를 확인하고, 미실행 사유·운영 배포 미실행을 기록한다. 8081 기존 서버를 먼저 재사용한다.

**DEFINITION OF DONE**

- [ ] 결함 사례의 수정 전 실패·수정 후 통과 증거가 있으며 T-1~T-8 전부 대응했다.
- [ ] 기존 테스트를 줄이거나 assertion을 완화하지 않았고 전체 검사 결과를 보고했다.
- [ ] DB·제공처/시즌 기록 불변과 앱의 구응답 방어를 확인했다.
- [ ] UI-13.2 토큰·`Alert` 검사 0줄.
- [ ] 웹·앱 수동 확인 표를 보고했다.

**변경 허용 파일** — 아래 목록만 수정한다. `{A,B}`는 각 파일이며, 이외 파일이 필요하면 먼저 충돌 이유를 보고한다.

```text
supabase/functions/_shared/{searchResultMerge,discoveryFilters}.ts 및 각 .test.ts
supabase/functions/search-content/adapters/{anilist,normalize,types}.ts
supabase/functions/search-content/adapters/{anilist,normalize}.test.ts
supabase/functions/search-content/index.ts
src/types/content.ts
src/utils/{mergeSearchResults,searchPagination,searchResultTitle,searchRecommendationPolicy,searchResultVisibility}.ts 및 각 .test.ts
src/components/content/{SearchResultGalleryCard,SearchResultItem}.tsx
app/search.tsx
docs/87_search_anime_duplicate_fixes_spec.md
AGENTS.md
docs/README.md
docs/08_frontend_architecture.md
docs/development_next_steps.md
```

**보고 항목** — 수정 전 실패 출력, before/after 실제 검사 개수와 타입/린트, T/M 대응, 보호한 분할 방영·식별자 사례, 변경 파일·남은 플랫폼 확인, 서버 소스와 운영 배포 상태를 순서대로 보고한다.

**금지사항** — 배포·마이그레이션·원격 쓰기·캐시 삭제, 테스트 완화, 임의 D-N 변경, 범위 밖 리팩터링을 금지한다. 순수 테스트에서 React Native·Expo·Supabase 클라이언트를 import하지 않는다.
