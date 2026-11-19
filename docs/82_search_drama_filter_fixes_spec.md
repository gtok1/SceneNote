# 82. 검색·추천의 한국 드라마 필터 혼입 정정

작성일: 2026-11-19
대상 브랜치 기준: `main` (`519ddc7`) + 기존 미커밋 변경
선행 문서: [00 UI 스타일 규칙](00_ui_style_rules.md), [81 라이브러리 분류 보정](81_library_content_type_filter_fixes_spec.md), [35 검색 숨김 결과](35_search_completeness_and_deploy_drift_spec.md), [69 메타데이터 재사용](69_persistent_public_metadata_cache_fixes_spec.md)

## 1. 문제 정의

라이브러리에서 고친 예능·일본 드라마 혼입이 검색 화면에도 남아 있다. 검색 UI에는 ‘한국 드라마’ 단일 유형이 없으며 **작품 유형 ‘드라마’ + 제작 국가 ‘한국’** 조합이다. 장르 ‘드라마’와 국가 ‘한국’을 고른 경우도 같은 문제를 방어해야 한다.

| ID | 증상 |
|----|------|
| F-1 | TV 예능·토크·뉴스·다큐멘터리가 드라마 선택에 섞인다 |
| F-2 | KR·JP 공동 제작 작품이 일본어 근거가 있어도 한국 드라마 문맥에 남는다 |

81의 가스인간 등 일본어 원제 표본과 명시 예능 장르 사례를 재사용한다. 직전 81 작업의 전체 테스트 기준선은 **1855개 통과**이며 이 문서의 구현·검증 완료를 뜻하지 않는다.

## 2. 근본 원인

- `ContentSearchBar.tsx`의 유형은 `anime`·`drama`·`movie`, 국가는 별도 배열이다. `app/search.tsx`가 두 그룹을 일반 검색·추천에 전달한다.
- `_shared/discoveryFilters.ts`의 `discoveryMediaType`은 `kdrama`·`jdrama`·`category=drama`·`other+has_seasons`를 모두 드라마로 본다. 명시 비드라마 장르를 확인하지 않는다.
- `matchesDiscoveryFilters`는 `countries`·`origin_country`·`matched_countries` 중 선택 국가 증거가 하나라도 맞으면 허용한다. KR·JP 공동 제작에 대한 드라마 지역 보정이 없다.
- 일반 TMDB 검색 정규화는 `original_language`를 버린다. 추천은 이미 `languages`에 원어를 보존하지만 공통 필터가 읽지 않는다. 추천 제공처의 장르 ID→이름 변환에는 News·Reality·Talk가 빠져 비드라마 근거가 유실될 수 있다.
- 제목 검색의 서버 `filterSearchResultsByDiscovery`와 앱 `partitionSearchResults`, 추천 서버·앱의 노출/보충 판정이 공통 `matchesDiscoveryFilters`를 쓴다. 한 화면에만 판정을 복제하면 결과·개수·보충이 어긋난다.

## 3. 재현 시나리오

1. 검색 필터에서 유형 ‘드라마’와 국가 ‘한국’을 선택한다. 장르 ‘드라마’ + 국가 ‘한국’ 조합도 확인한다.
2. 일반 제목 검색과 빈 검색어의 추천에서 일본어 근거가 있는 공동 제작 드라마·명시 비드라마 장르를 확인한다.
3. 수정 후 해당 조합에서 불일치 처리되고, 전체/국가만 선택한 경우의 기존 제작 국가 의미와 제목 검색 ‘모두 보기’는 유지돼야 한다.

## 4. 설계 결정

### D-1. 공통 필터에서 드라마 문맥만 정정한다 (최우선)

`matchesDiscoveryFilters`·`discoveryMediaType`를 고쳐 일반 검색·추천의 앱/서버 소스가 같은 판정을 쓰게 한다. **드라마 문맥**은 정규화한 요청의 `mediaTypes`에 `drama`가 있거나 `genres`에 `drama`가 있는 경우다. 영화·애니 후보는 지역 보정 대상에서 먼저 제외한다. 전체/드라마 조건 없는 국가 선택에는 기존 제작 국가 OR 판정을 유지한다.

### D-2. 명시 비드라마 장르는 드라마 가지에 일치하지 않는다

영화·애니 유형은 그대로 보존한다. 그 외 TV 후보에 81과 같은 Reality/리얼리티·Talk/토크·News/뉴스·Documentary/다큐멘터리·예능 장르가 하나라도 있으면 `discoveryMediaType`은 `null`이다. `category=drama`나 `other+has_seasons`로 우회하지 않는다.

장르 ‘드라마’ 선택에서도 이 후보는 **드라마 가지에 불일치**다. `matched_genres`의 드라마 증거로 우회하지 않는다. 다만 장르 선택은 기존 OR이므로 ‘드라마 또는 코미디’에서 실제 코미디에 일치하는 후보는 다른 조건을 만족하면 남는다. 영화·애니의 Documentary/Drama 장르 판정도 기존 의미를 유지한다.

### D-3. 지역 근거는 원어 우선, 없을 때만 좁은 원제 신호를 쓴다

TMDB 드라마 후보의 지역 근거를 다음 순서로 정한다.

1. 명시 `original_language`가 `ja`면 JP, `ko`면 KR.
2. 위 필드가 없으면 `languages`의 유일한 언어가 `ja`/`ko`인지 확인한다.
3. 언어 메타데이터 자체가 없으면 81처럼 원제에 실제 가나 글자가 있고 한글이 없는 경우만 JP 신호로 쓴다.

명시 언어가 다른 언어이거나 다국어라 모호하면 지역 신호는 없다. 이때 가나로 덮어쓰지 않고 원래 국가 OR 판정을 유지한다. 번역 표시 제목·한자만 있는 원제·문장 부호는 지역 근거가 아니다. TMDB가 아닌 출처에는 이 지역 추정을 적용하지 않는다.

### D-4. 지역 신호와 원래 국가 증거를 교집합한다

드라마 문맥에서 KR/JP 국가를 확인할 때만 D-3 신호를 적용한다. 예를 들어 `origin_country=[KR,JP]`인 일본어 드라마는 KR 단독 선택에는 불일치, JP에는 일치한다. 하지만 `origin_country=[KR]`인 작품을 일본어라는 이유만으로 JP 제작 작품으로 새로 만들지 않는다. 요청 국가와 원래 제작 국가/질의 증거가 맞고 지역 신호도 그 국가와 맞아야 한다.

`matched_countries`가 KR이라고 해도 JP 신호를 무시하지 않는다. 언어가 모호하거나 지역 신호가 없으면 기존 판정을 유지한다. **KR과 JP를 둘 다 선택했으면 지역 분리 제약 자체를 생략하고 기존 제작 국가 OR 합집합을 유지한다.** KR/JP 중 정확히 한쪽만 골랐을 때만 그 지역 가지를 제한하며, US 등 다른 국가를 함께 골랐으면 그 가지는 기존 OR대로 판단한다. 이 보호는 기존 다중 국가 선택 회귀를 보존하기 위한 계약이다.

### D-5. 메타데이터 전달과 helper를 재사용하고 저장 유형은 유지한다

새 순수 `_shared/dramaClassification.ts`에 `hasNonDramaGenre`, `hasJapaneseOriginalTitle`, `dramaRegionalCountry`를 둔다. `libraryFilters.ts`도 앞의 두 helper를 재사용하되 **81의 분류 계약은 바꾸지 않는다**. 일반 검색 `SearchResult`의 앱·어댑터 타입과 정규화에 선택적 `original_language`를 전달한다. 추천은 기존 `languages`를 사용하고 제공처 장르 매핑에 News·Reality·Talk를 추가한다.

검색/추천 후보의 저장 `content_type`을 재분류하거나 DB를 수정하지 않는다. 정상 영화·애니·다른 장르·기존 검색 숨김/모두 보기 계약을 보존한다. 새 외부 메타데이터 조회는 없다.

### D-6. 앱 방어와 운영 서버 반영을 구분한다

공용 모듈은 앱 번들에도 포함되어 구 서버 응답·캐시에도 새 필터를 적용한다. 서버 공통 소스 수정은 운영 배포 완료가 아니다. 이번 작업에서 Edge 배포·DB 변경·캐시 강제 삭제를 하지 않는다. 운영 서버의 후보 수집·전달까지 새 판정을 쓰려면 별도 배포가 필요함을 보고한다.

> D-N은 임의로 바꾸지 않는다. 변경이 필요하면 구현하지 말고 이유를 보고한다.

## 5. 기각한 대안

| 대안 | 이유 |
|------|------|
| 모든 한국 국가 필터에 일본어 제외 적용 | 제작 국가 OR라는 기존 의미와 영화/국가만 탐색을 바꾼다 |
| 언어만으로 제작 국가를 새로 부여 | 원어와 제작 국적은 같지 않다 |
| 후보 전체를 Drama 장르 필수로 제한 | 범죄·SF 등 정상 극작품과 다른 장르 OR 선택을 누락시킨다 |
| 앱 화면에만 조건 추가·서버 유형 재작성 | 필터 공통 경로와 81 계약이 갈라진다 |
| 국가 확인용 추가 API/캐시 강제 갱신 | 기존 입력으로 방어할 수 있고 별도 요청 비용이 생긴다 |

## 6. 계약 (타입·순서)

`DiscoveryCandidate`는 기존 최소 입력을 계속 허용하며 출처·원제·원어·언어 목록을 선택적 근거로 받는다. `dramaRegionalCountry`는 KR·JP 또는 신호 없음만 반환하며 국가 배열을 생성하지 않는다.

판정: 영화/애니 보존 → TV의 명시 비드라마 여부 → 유형 및 장르 가지별 일치 → 원래 국가 증거와 드라마 문맥 지역 신호의 교집합 → 기존 연도 판정. 입력 객체·국가 배열·유형 값은 수정하지 않는다. 구응답의 언어 누락은 오류가 아니며 D-3 원제 폴백만 적용한다.

## 7. 데이터 모델 / SQL

SQL·마이그레이션 없음. `original_language`는 검색 응답의 선택적 공개 메타데이터다. `_shared/types.ts`의 `ContentMeta`나 DB 저장 모델을 불필요하게 넓히지 않는다.

## 8. 화면 명세

UI 규칙 준수(UI-1~UI-15). 필터 UI·레이아웃·새 경고 문구를 만들지 않는다. 현재 ‘드라마’·‘한국’ 조합의 결과와 추천을 보정한다. 제목 검색에서 필터로 숨긴 결과 안내·‘모두 보기’는 계속 동작한다.

## 9. 엣지 케이스

| ID | 상황 | 기대 / 자동 그룹 |
|----|------|------------------|
| E-1 | Drama+Reality, category=drama, matched_genres=drama | 드라마 불일치; 다른 장르 OR는 보존 / T-1 |
| E-2 | KR·JP 공동 제작 + ja, KR/JP 단독·복수 선택 | 한쪽 선택은 지역/국가 교집합, KR·JP 동시 선택은 기존 OR / T-2 |
| E-3 | ko·원어 없음·다국어·다른 언어·비TMDB | D-3 우선순위·기존 OR 폴백 / T-2·T-3 |
| E-4 | movie/anime, 전체, 국가만 선택 | 원래 의미 유지 / T-3 |
| E-5 | 구 서버가 혼입 후보·언어 없는 캐시를 반환 | 앱에서 방어, 제목 검색 숨김 계약 유지 / T-4 |
| E-6 | 검색 원어·제공처 장르 근거, 81 helper 이동 | 근거 전달·81 결과 불변 / T-5·T-6 |

## 10. 테스트 표

모든 행을 자동 테스트로 대응한다. 그룹의 보존 사례를 포함해 줄이지 않는다. 기존 TMDB 다중 국가 OR 테스트도 수정하거나 완화하지 않는다. 결함 사례는 수정 전 실패를, 보존 사례는 수정 전후 통과를 확인한다.

| ID | 입력 | 기대 / 대상 |
|----|------|-------------|
| T-1 분류 | 비드라마 영문/한국어 별칭·혼합 Drama·category·matched_genres, 장르 Drama/Comedy OR | 드라마 가지 배제·다른 가지 보존. `dramaClassification.test.ts`·`discoveryFilters.test.ts` |
| T-2 지역 필터 | 공동 제작 KR/JP + 원어 ja/ko·단일 languages, KR/JP/복수 국가, matched_countries | 언어 우선·한쪽 선택의 지역/국가 교집합·질의 증거 우회 금지, KR·JP 동시 선택은 기존 OR 합집합 유지. 같은 파일 |
| T-3 보호 | movie/anime·전체·국가만·원어 다국어/다른 언어·가나/한글/한자/부호·비TMDB | 과잉 추정 없이 기존 의미 보존. 같은 파일 |
| T-4 구응답 앱 | 구 서버의 예능·일본 드라마 후보와 언어 누락 응답 | 앱 `partitionSearchResults`에서 숨김 이유 filters 및 전체/표시 계약 보존. `src/utils/searchResultVisibility.test.ts` |
| T-5 근거 전달 | TMDB 검색 `original_language`, 추천 원본 genre_ids의 News/Reality/Talk | 원어 선택 필드 전달·장르 근거 유실 없음. `adapters/tmdb.test.ts`·`recommendationProviderFilters.test.ts` |
| T-6 81 호환 | 라이브러리 81의 기존 모든 분류·필터·통계 사례 | helper 이동 뒤 같은 결과·입력 불변. `libraryFilters.test.ts`·`profileStats.test.ts` |

수동 표의 실행 결과·미실행 사유는 개발 기록에 남기며 아래 표 자체는 완료 결과가 아니다.

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 | 제목 검색에서 유형 드라마+KR 및 장르 Drama+KR의 혼입 제외, 숨김 안내·모두 보기 유지 |
| M-2 | 웹 8081 | 빈 검색어 추천에서 같은 조건 적용, 제거된 후보를 보충 개수로 잘못 세지 않음 |
| M-3 | 웹 375/768/1440 | 영화·애니·국가만·복수 장르/국가 조건 보존, 필터 조작·결과 표시 |
| M-4 | iOS/Android 세로 | 같은 일반 검색/추천 전환. 환경이 없으면 미실행 이유 명시 |

## 11. 변경 파일 목록

- 공통: `_shared/dramaClassification.ts`(신규), `_shared/discoveryFilters.ts`와 테스트(신규 helper도 함께 검증). 여기의 `_shared/`는 모두 `supabase/functions/_shared/`다.
- 앱/검색 전달: `src/types/content.ts`, `supabase/functions/search-content/adapters/types.ts`, `adapters/tmdb.ts`·`adapters/tmdb.test.ts`(adapters는 `supabase/functions/search-content/adapters/`).
- 추천 근거: `supabase/functions/_shared/recommendationProviderFilters.ts`, `recommendationProviderFilters.test.ts`(같은 폴더).
- 81 재사용/호환: `src/utils/libraryFilters.ts`, `libraryFilters.test.ts`, `profileStats.test.ts`(같은 폴더).
- 앱 필터 검증: `src/utils/searchResultVisibility.test.ts`.
- 문서: 이 명세·`AGENTS.md`·`docs/README.md`·`docs/08_frontend_architecture.md`·`docs/development_next_steps.md`.

## 12. 범위 밖

운영 배포·DB·백필·기존 저장 유형 교정, 라이브러리 81 계약 변경, 화면 재설계·새 요청·다른 필터/캐시/서버 응답 계약 리팩터링은 하지 않는다.

## 13. 확실하지 않음 — 별도 검증 필요

원어는 제작 국적을 증명하지 않는다. 이번 지역 제한은 사용자가 요청한 **드라마 문맥의 분류 보정**이며 드라마 없이 국가만 선택한 기존 의미는 유지한다. 언어가 없는 가나 원제 폴백은 81과 같은 휴리스틱이다. 메타데이터가 모호하거나 틀린 작품까지 전부 해결됐다고 단정하지 않는다. 운영 구버전이 수집 단계에서 버린 후보를 앱이 되살릴 수는 없으므로 앱 방어와 서버 배포 여부를 구분한다.

## 14. Codex 실행 지시

### ROLE & GOAL

SceneNote 구현 담당으로 F-1·F-2를 일반 검색·추천 공통 필터에서 고친다. 새 API 없이 현재 메타데이터를 쓰고 81 및 전체/영화/애니/국가만 탐색 계약을 보존한다.

### READ FIRST

1. [docs/00_ui_style_rules.md](00_ui_style_rules.md) — 웹·앱 공통 규칙.
2. 이 명세 전체, [81](81_library_content_type_filter_fixes_spec.md), [35](35_search_completeness_and_deploy_drift_spec.md), [69](69_persistent_public_metadata_cache_fixes_spec.md).
3. `AGENTS.md`, `.agents/skills/scenenote-verify/SKILL.md`.
4. 11장 구현·테스트 파일과 `src/utils/searchResultVisibility.ts`, `src/utils/recommendationVisibility.ts` 사용처.

### 바꾸면 안 되는 설계 결정

D-1~D-6 준수. 국가 OR를 모든 문맥에서 바꾸거나 원어만으로 제작 국가를 만들지 않는다. 공통 helper를 재사용하며 81 결과를 유지한다. 서버 후보 `content_type`·DB·개인 기록은 수정하지 않는다.

### STEP 1 — 실패 재현

경로·Git 루트·상태·브랜치/SHA와 기존 변경을 확인한다. 10장 테스트 그룹 전체를 추가하고 scenenote-verify로 결함 사례의 구현 전 실패를 확인한다. 보존 테스트를 약화하지 않는다.

### STEP 2 — 공통 판정과 전달 정정

기존 `discoveryMediaType`의 무조건 TV→drama 판정을 6장 순서로 바꾼다. 원래 국가/질의 증거가 맞아도 D-3 지역 신호와 충돌하면 해당 KR/JP 가지가 불일치하도록 한다. helper 추출 뒤 81 테스트를 먼저 확인한다. 원어/장르를 기존 정규화 응답에 전달하고 다른 서버 유형은 유지한다.

### STEP 3 — 앱 구응답·공통 경로 확인

일반 검색 숨김 분할과 추천 노출·보충이 같은 판정을 쓰는지 확인한다. M-1~M-4의 결과 또는 미실행 사유를 기록한다. Edge 소스 반영과 운영 배포 상태를 구분한다.

### 검증 명령

scenenote-verify로 10장에 나열한 관련 테스트를 선택 실행한 뒤 아래 전체 검사를 수행한다. 관련 Edge 파일의 Deno 검사는 별도로 결과를 남긴다.

```sh
python3 .agents/skills/scenenote-verify/scripts/verify.py --node-bin /opt/homebrew/opt/node@24/bin --only test typecheck lint
git diff --check
```

전체 검사는 `npm test`·`npm run typecheck`·`npm run lint`를 유지한다. 앱 타입/린트가 Edge 전체 타입 검사를 대신하지 않는다. 실패·환경 문제는 로그로 구분한다.

### DEFINITION OF DONE

- [ ] T-1~T-6 전부 자동 대응, 결함의 수정 전 실패·후 통과 기록.
- [ ] 기존 assertion·테스트 수를 줄이지 않고 전체 검사·Edge 검사 결과 보고.
- [ ] UI-13.2 토큰·`Alert` 검사 변경분 0줄, 웹·앱 수동 확인 표 보고.
- [ ] 전체/영화/애니/국가만·장르 OR·81·검색 모두 보기 보존.
- [ ] 추가 호출·DB·운영 배포 없음, 소스와 운영의 차이·휴리스틱 한계 보고.

### 변경해야 할 파일

11장만 허용한다. 그 밖의 앱 화면·서비스·Edge handler·저장 모델은 수정하지 않는다.

### 보고 항목

1. 원인·변경 파일·D-N 준수.
2. 실제 수정 전 실패·후 테스트/타입/린트/Edge/diff 결과와 로그.
3. T-1~T-6·M-1~M-4 대응과 미실행 이유.
4. 앱 반영·서버 소스·운영 배포 상태, 지역 추정 한계·별도 후속 작업.

### 금지사항

운영 배포·DB 변경·마이그레이션·백필·불필요한 외부 조회·기존 캐시 강제 삭제 금지. 국가 확정 판정이라고 주장하지 않는다. 테스트 축소/완화·RN/Supabase 런타임 import·다른 세션 변경 되돌리기·무관한 리팩터링을 하지 않는다.
