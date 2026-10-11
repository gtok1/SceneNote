# 55. 한국어 붙여 쓴 검색어 띄어쓰기 보정

작성일: 2026-10-11
대상 브랜치 기준: `main` (`c6a0e7e`) + 미커밋 작업(`docs/44`~`54`). 이 시점 `npm test`는 1074개 중 1073개 통과다. 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 이번 작업과 무관한 기존 결함이다. `npm run search:golden`은 12/12 통과다.
선행 문서: `docs/35_search_completeness_and_deploy_drift_spec.md`(검색 골든 검사·배포 어긋남), `docs/15_season_search_spec.md`(검색어 변형·시즌 검색)

> **정정(2026-10-11).** D-5의 "4글자 이상"과 `filterResultsByCompactQuery`의 4글자 미만 통과는 `docs/56_korean_search_spacing_length_fixes_spec.md`에서 글자 수 조건 없이 "공백 뺀 검색어 ⊂ 공백 뺀 제목" 기준으로 바뀐다.

> **근거.** 사용자 캡처(웹)
> - "너말고다른" → "검색 결과가 없습니다"
> - "너 말고 다른" → "너 말고 다른 연애"(TMDB, 2026.09, kdrama)
>
> 사용자 요청: "이렇게 띄어쓰기 해도 검색 가능하게 codex 명세서 작성해줘"

---

## 1. 문제 정의
| ID | 증상 |
|----|------|
| F-1 | 한국어 제목을 띄어쓰기 없이 입력하면 작품을 못 찾는다. 첫 단어 뒤에 조사(`의`, `는` 등)가 없는 제목에서 생긴다. 2026-10-11 실측 결과 아래 7개가 모두 "검색 결과가 없습니다"다. |

| 붙여 쓴 검색어 | 찾아야 할 작품 (TMDB id) |
|----------------|--------------------------|
| 너말고다른 | 너 말고 다른 연애 (314939) |
| 선재업고튀어 | 선재 업고 튀어 (230923) |
| 폭싹속았수다 | 폭싹 속았수다 (219246) |
| 그해우리는 | 그 해 우리는 (135897) |
| 닥터차정숙 | 닥터 차정숙 (214997) |
| 내남편과결혼해줘 | 내 남편과 결혼해줘 (221851) |
| 지금우리학교는 | 지금 우리 학교는 (99966) |

## 2. 근본 원인

### 2.1 TMDB 검색은 "단어 단위"로 맞춘다 (2026-10-11 실측, 문서화되지 않음)
`search/multi`에 여러 질의를 보내 본 결과는 아래와 같다.

| 질의 | "너 말고 다른 연애" 반환 |
|------|------------------------|
| `너말고다른`, `너말고`, `너말고다른연애`, `너 말고다른`, `너말고 다른` | 없음 |
| `너 말고 다른`, `너 말고`, `말고 다른`, `다른 연애`, `연애 다른`, `너 다른` | 있음 |
| `너 말고 다` | 있음 |
| `너 말 다`, `말 다른`, `고 다른` | 없음 |

정리하면 TMDB 검색 동작은 다음과 같다.
- 질의의 **각 단어가 제목 단어와 같아야** 한다.
- **마지막 단어만 앞부분 일치**를 허용한다(`다` → `다른`).
- 단어 순서는 보지 않는다.

따라서 붙여 쓴 검색어는 제목의 단어 경계에 맞게 띄어 줘야 찾을 수 있다.

### 2.2 기존 띄어쓰기 보정이 이 유형을 못 만든다
`search-content`는 `createSearchQueryVariants`(`adapters/normalize.ts` 97~129행)가 만든 변형(최대 5개, `MAX_QUERY_VARIANTS` 3행)을 소스마다 검색한다. 변형은 세 종류다.
1. 원문과 붙여 쓴 형태(`direct`)
2. `createKoreanSpacingHints`(252~280행): 조사 `에서·으로·…`나 글자 `의·와·과·는·은·이·가·를·을` 뒤에서 한 번 띄운다(`direct`).
3. `createKoreanAnchorQueries`(282~307행): 첫 2~3글자 같은 앞부분 한 단어로 검색하고, 붙여 쓴 전체 검색어가 제목에 들어 있는 결과만 남긴다(`compact-title`, `filterResultsByCompactQuery` 139~151행).

"너말고다른"에는 조사 글자가 없어 2번이 비어 있다. 3번은 "너말고"인데, 제목 단어(`너`, `말고`)의 앞부분이 아니라 TMDB가 0건을 준다. 그래서 변형 2개(`너말고다른`, `너말고`)가 모두 0건이다.

### 2.3 실측 비교 (2026-10-11, TMDB `search/multi` 1페이지)
작품 35개의 붙여 쓴 전체 제목과 앞 5글자(총 54개 입력)로 비교했다.

| 방식 | 찾음 |
|------|------|
| 현재 변형 | 40/54 |
| 앞 k글자(k=1~4) + 공백 + 다음 **1**글자 | 48/54 |
| 앞 k글자(k=1~4) + 공백 + 다음 2글자 | 45/54 |
| 2글자씩 끊은 한 단어 질의(n−1회) | 48/54 |

**현재 변형 또는 "앞 k글자 + 다음 1글자"**를 쓰면 54개를 모두 찾는다. 단, "중증외상센터: 골든 아워" 2건은 비교 스크립트의 기대 제목이 TMDB 한국어 제목과 달라 판정에서 제외했다.

이 방식이 맞는 이유는 다음과 같다.
- 첫 단어 `q[0:k]`가 제목 단어와 정확히 같아야 하는데, 첫 단어 길이를 모르므로 k=1~4를 모두 시도한다.
- 다음 1글자는 마지막 단어라 앞부분 일치로 통과한다.

## 3. 재현 시나리오
1. 웹 8081에 로그인한 뒤 검색 탭에서 "너말고다른"을 입력한다.
2. "검색 결과가 없습니다"가 나온다.
3. "너 말고 다른"으로 입력하면 "너 말고 다른 연애"가 나온다.

## 4. 설계 결정

### D-1 (최우선). 기존 1단계 검색은 그대로 두고, 띄어쓰기 보정은 "1단계에 맞는 결과가 없을 때만" 2단계로 돈다
- `createSearchQueryVariants`의 변형 생성·순서·`MAX_QUERY_VARIANTS`·캐시 키·소스 구성은 바꾸지 않는다.
- 잘 되던 검색어(`오징어게임`, `신사의품격`, `눈물의 여왕` 등)는 호출 수와 결과가 지금과 같아야 한다.
- 검색은 입력할 때마다 실행된다. `app/search.tsx`의 `useContentSearch`가 검색어 길이 2 이상이면 바로 조회한다. 그래서 항상 변형을 늘리면 호출이 크게 는다.

### D-2. 2단계 질의는 "붙여 쓴 검색어의 앞 k글자 + 공백 + 다음 1글자", k=1~4다
- 2.3 실측 결과에 따른다. 공백·문장부호를 뺀 검색어(`compactSearchText`)를 문자 단위(`Array.from`)로 자른다.
- k는 `1`부터 `min(4, 글자 수 − 1)`까지다. 변형은 최대 4개다.
- 1단계 변형과 `query` 문자열이 같은 것은 만들지 않는다.

### D-3. 2단계 결과는 붙여 쓴 전체 검색어로 거른다
- 2단계 변형은 `matchMode: "compact-title"`, `compactQuery: 붙여 쓴 전체 검색어`다.
- 기존 `filterResponseForVariant`가 제목(`title_primary`·`title_original`·`match_titles`)에 검색어가 들어 있는 결과만 남긴다.
- `너 말`은 "너 말고 니 언니"도 반환하지만 이 필터에서 빠진다.

### D-4. 2단계는 TMDB 소스에만 보낸다
- AniList는 분당 요청 한도가 있다. 게다가 AniList 어댑터는 한국어 질의마다 TMDB 번역 조회(`resolveAniListSearchInput`)를 한 번 더 한다.
- 검색이 입력마다 실행되므로(D-1) 2단계 호출은 TMDB만으로 제한한다.
- TMDB 결과에는 한국어 제목 애니도 들어 있다(예: `괴수 8호` 207468).

### D-5. 2단계 실행 조건 (모두 만족할 때만)
1. 1페이지 요청이다.
2. 1단계 소스에 TMDB가 있다.
3. 붙여 쓴 검색어가 4글자 이상이고 한글을 포함한다. 4글자 미만이면 `filterResultsByCompactQuery`가 거르지 않아(140행) 넓은 질의의 잡음이 그대로 나온다.
4. 1단계 결과에 붙여 쓴 검색어와 맞는 결과가 없다. 판정은 `filterResultsByCompactQuery(1단계 결과, 붙여 쓴 검색어)`가 0개인지다. 관련 없는 결과만 있으면 실행한다.
5. 요청 마감(`requestDeadline`, 수신 후 8.5초)까지 3,000ms 이상 남았다.

2단계 어댑터 제한 시간은 `min(5000, 남은 시간 − 1000)`ms다.

### D-6. 2단계는 다음 페이지 여부(`hasNextPage`)에 영향을 주지 않는다
- 2단계 질의는 넓다(예: `그 해`). 다음 페이지를 받아도 거르고 나면 대부분 비어, 빈 페이지 요청이 이어진다.
- 그래서 `hasNextPage`는 1단계 결과로만 정한다.
- 결과·`total`·`sources`·`failedSources`·`cached`는 두 단계를 합친다.

### D-7. 캐시
- 2단계 변형도 같은 `external_search_cache`에 같은 키 규칙(`createQueryHash`, 1시간)으로 읽고 쓴다.
- `SEARCH_CACHE_VERSION`은 올리지 않는다. 1단계 결과는 바뀌지 않고, 2단계 키는 `compact-title:<붙여 쓴 검색어>`가 들어간 새 키라 기존 행과 겹치지 않는다.

### D-8. 응답에는 선택 필드 하나만 추가한다
- `word_split_fallback: boolean`을 추가한다. 2단계에서 변형을 1개 이상 검색했으면 `true`다.
- 클라이언트 변경은 없다. 수동 확인에서 네트워크 응답으로 동작을 확인하는 용도다.

### D-9. 골든 검사
- 기존 `SEARCH_GOLDEN_CASES`(12개)와 테스트 G-6은 그대로 둔다.
- 띄어쓰기 사례 7개(1장 표)는 별도 목록 `SEARCH_GOLDEN_SPACING_CASES`로 추가한다.
- `npm run search:golden`은 두 목록을 모두 검사하고, 각 사례에서 1단계 → (조건이 맞으면) 2단계를 index.ts와 같은 판정 함수로 재현한다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| 2단계 질의를 1단계 변형에 항상 포함 | 잘 되던 한국어 검색어마다 호출이 는다. 상한 5개와 겹쳐 잘린다. 기존 테스트("신사의품격" 변형 목록)가 바뀐다 |
| 한국어 형태소 분석기·사전으로 띄어쓰기 복원 | Edge Function 번들 크기와 사전 관리 부담. MVP 범위를 넘는다 |
| 2글자씩 끊은 한 단어 질의 | 호출이 n−1회다. "내남편과결혼해줘"·"그해우리는"을 놓친다(2.3) |
| 다음 단어를 2글자로 | 45/54. 다음 단어가 1글자면 실패한다 |
| 가능한 띄어쓰기를 모두 시도 | 2^(n−1)개로 호출이 폭증한다 |
| DB `contents` 제목으로 붙여 쓴 형태 비교 | 라이브러리에 추가된 작품만 있다. 일반 검색 대체가 안 된다 |
| 2단계에 AniList 포함 | D-4 |

## 6. 계약

### 6.1 `supabase/functions/search-content/adapters/normalize.ts` (추가만)
```ts
export const MAX_WORD_SPLIT_VARIANTS = 4;
export const WORD_SPLIT_MIN_REMAINING_MS = 3_000;

export function createKoreanWordSplitVariants(
  query: string,
  existing?: readonly SearchQueryVariant[]
): SearchQueryVariant[];

export type WordSplitFallbackReason = "run" | "page" | "no_tmdb" | "not_eligible" | "has_match" | "time";
export function planKoreanWordSplitFallback(input: {
  query: string;
  page: number;
  sources: readonly string[];
  remainingMs: number;
  primaryVariants: readonly SearchQueryVariant[];
  primaryResults: readonly SearchResult[];
}): { variants: SearchQueryVariant[]; reason: WordSplitFallbackReason };
```

**`createKoreanWordSplitVariants` 판정**
1. `q = compactSearchText(collapseWhitespace(query))`, `chars = Array.from(q)`.
2. `chars.length < 4`이거나 `q`에 한글(`/[가-힣]/`)이 없으면 `[]`다.
3. k = 1부터 `min(MAX_WORD_SPLIT_VARIANTS, chars.length − 1)`까지 `text = chars.slice(0,k).join("") + " " + chars[k]`를 만든다.
   - `existing` 중 `query === text`인 것이 있으면 건너뛴다.
   - 이미 만든 것과 같아도 건너뛴다.
   - 나머지는 `{ query: text, matchMode: "compact-title", compactQuery: q }`로 추가한다.
4. 결과는 k 오름차순이다.

**`planKoreanWordSplitFallback` 판정 순서** — 처음 걸린 이유로 끝낸다. 실행하지 않는 경우 `variants`는 `[]`다.
1. `page !== 1` → `"page"`
2. `sources`에 `"tmdb"`가 없음 → `"no_tmdb"`
3. `q`(1번과 같은 방식)가 4글자 미만이거나 한글 없음 → `"not_eligible"`
4. `filterResultsByCompactQuery([...primaryResults], q).length > 0` → `"has_match"`
5. `remainingMs < WORD_SPLIT_MIN_REMAINING_MS` → `"time"`
6. `variants = createKoreanWordSplitVariants(query, primaryVariants)`. 비면 `"not_eligible"`, 아니면 `"run"`이다.

### 6.2 `supabase/functions/search-content/index.ts`
- **헬퍼 분리.** 148~220행의 "소스 × 변형별 캐시 읽기 → 누락분 어댑터 호출 → 변형 필터 → 캐시 쓰기"를 파일 안 헬퍼로 옮긴다. 동작은 그대로다(1단계 결과 순서: 캐시 결과 → 새 결과).
  ```ts
  interface VariantSearchOutcome {
    results: SearchResult[];            // 캐시 결과, 그다음 새 결과(변형 필터 적용 후)
    totals: number[];                   // 캐시 total + 새 응답 total
    hasNextPage: boolean;
    successfulSources: ExternalSource[];
    failedSources: ExternalSource[];    // 거부된 어댑터의 소스 후보
    misses: number;                     // 캐시에 없던 작업 수
  }
  async function searchQueryVariants(
    adminClient: SupabaseClient, sources: readonly ExternalSource[], variants: readonly QueryVariant[],
    mediaType: MediaTypeFilter, page: number, timeoutMs: number
  ): Promise<VariantSearchOutcome>;
  ```
- **1단계**: `primary = await searchQueryVariants(adminClient, targetSources, queryVariants, fetchMediaType, page, ADAPTER_TIMEOUT_MS)`. 상수 `ADAPTER_TIMEOUT_MS = 5000`이다.
- **2단계 판정**: `planKoreanWordSplitFallback`에 아래 값을 넘긴다.
  - `query: normalizedQuery`, `page`, `sources: targetSources`
  - `remainingMs: requestDeadline - Date.now()`
  - `primaryVariants: queryVariants`, `primaryResults: compactResults(primary.results)`
- **2단계 실행**: `reason === "run"`일 때만 아래를 부른다. 아니면 빈 결과(`results: []`, `hasNextPage: false`, `misses: 0` 등)로 둔다.
  ```ts
  searchQueryVariants(adminClient, ["tmdb"], plan.variants, fetchMediaType, page,
                      Math.min(ADAPTER_TIMEOUT_MS, requestDeadline - Date.now() - 1000))
  ```
- **합치기**
  - `unfilteredResults = compactResults([...primary.results, ...fallback.results])`
  - `successfulSources`는 두 단계를 합친다. `failedSources`는 합친 후보 중 `successfulSources`에 없는 것이다.
  - `cached: primary.misses + fallback.misses === 0`
  - `total: Math.max(results.length, ...primary.totals, ...fallback.totals)`
  - **`hasNextPage: primary.hasNextPage`** (D-6)
  - `word_split_fallback: plan.reason === "run"`
- 그 아래 처리(국가·장르 필터, `annotateFilterMatches`, 503 `ALL_APIS_FAILED` 조건, 응답 필드)는 그대로다.
- `SearchResponse` 인터페이스(34~48행)에 `word_split_fallback?: boolean`을 추가한다.
- `callAdapter`(279행)에 `timeoutMs = ADAPTER_TIMEOUT_MS` 매개변수를 추가하고, 286행의 고정 `5000`을 바꾼다.
- 탐색 모드(`respondWithCountryBrowse`)는 바꾸지 않는다.

### 6.3 골든 검사
- `scripts/searchGolden.ts`: `export const SEARCH_GOLDEN_SPACING_CASES: readonly GoldenExpectation[]`에 1장 표 7개를 넣는다. 각 사례는 `{ query, mustInclude: [{ externalId }] }`다. 기존 목록·`evaluateGoldenCase`는 바꾸지 않는다.
- `scripts/search-golden.ts`: `[...SEARCH_GOLDEN_CASES, ...SEARCH_GOLDEN_SPACING_CASES]`를 검사한다.
  1. 각 사례는 지금처럼 1단계를 돈다.
  2. `planKoreanWordSplitFallback({ query, page: 1, sources: ["tmdb"], remainingMs: Number.POSITIVE_INFINITY, primaryVariants, primaryResults: compactResults(1단계) })`가 `"run"`이면 그 변형들도 `searchTmdb` → `filterResponseForVariant`로 검색해 합친다.
  3. 합친 결과로 판정한다. 요약은 `통과 N/19`다.

## 7. 데이터 모델 / SQL
변경 없음. DB 마이그레이션을 만들지 않는다.

## 8. 화면 명세
화면 변경은 없다. 검색 탭 문구·빈 상태("검색 결과가 없습니다")는 그대로다.

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | "너말고다른" | 1단계 0건 → 2단계 `너 말`·`너말 고`·`너말고 다`·`너말고다 른` → 314939 | WS-1, WP-1, G-7, 골든 |
| E-2 | 띄어쓰기를 일부만 함("너말고 다른") | E-1과 같은 2단계 변형 | WS-2 |
| E-3 | 문장부호 섞임("너말고, 다른!") | E-1과 같음 | WS-5 |
| E-4 | 잘 되던 붙여 쓴 검색어("오징어게임", "신사의품격") | 1단계에 맞는 결과가 있어 2단계 없음, 호출 수 불변 | WP-5, 기존 변형 테스트 |
| E-5 | 올바로 띄어 쓴 검색어("너 말고 다른") | 1단계에서 찾음, 2단계 없음 | WP-5 |
| E-6 | 4글자 미만("너말", "그해우") | 2단계 없음 | WS-7, WP-4 |
| E-7 | 한글 없음("squidgame") | 2단계 없음 | WS-7, WP-4 |
| E-8 | 2페이지 이상 요청 | 2단계 없음, `hasNextPage`는 1단계 기준 | WP-2 |
| E-9 | 1단계 결과가 관련 없는 작품뿐 | 2단계 실행 | WP-6 |
| E-10 | `match_titles`로 맞는 결과가 1단계에 있음 | 2단계 없음 | WP-8 |
| E-11 | 남은 시간 3초 미만 | 2단계 없음(경계 3000은 실행) | WP-7 |
| E-12 | 2단계 변형이 1단계 변형과 같은 문자열 | 다시 검색하지 않음 | WS-6 |
| E-13 | 2단계가 넓은 질의로 관련 없는 작품을 받음("너 말고 니 언니") | `compact-title` 필터로 제외 | 기존 N-2, 골든 |
| E-14 | 숫자 섞임("괴수8호") | 숫자도 한 글자로 자름 | WS-8 |
| E-15 | 2단계 TMDB 실패, 1단계 TMDB 성공 | 1단계 결과로 응답, `failedSources`에 TMDB 없음 | 6.2 (수동 확인 불필요) |
| E-16 | 같은 검색을 다시 함 | 2단계 변형도 캐시에서 읽음 | 6.2 (수동 M-3) |
| E-17 | 장르·국가 필터가 켜진 상태 | 2단계 결과도 같은 필터 판정·표시(`filter_match`)를 거침 | 6.2 |
| E-18 | 6글자 이상("선재업고튀어") | 변형 4개까지(k=1~4) | WS-3 |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.**
- 기존 테스트는 고치지 않는다. 특히 `normalize.test.ts` "adds Korean spacing and compact-title fallback variants"(신사의품격 변형 목록)와 `searchGolden.test.ts` G-6(12개 목록)은 그대로 통과해야 한다(D-1, D-9).
- 보존 테스트는 없다. 아래 행은 구현 전에 새 export가 없어 모두 실패해야 한다.

### `supabase/functions/search-content/adapters/normalize.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| WS-1 | `createKoreanWordSplitVariants("너말고다른")` | `[query, matchMode]`가 `[["너 말","compact-title"],["너말 고","compact-title"],["너말고 다","compact-title"],["너말고다 른","compact-title"]]`, 모두 `compactQuery: "너말고다른"` |
| WS-2 | `("너말고 다른")`, `("  너말고   다른 ")` | WS-1과 같음 |
| WS-3 | `("선재업고튀어")` | `["선 재","선재 업","선재업 고","선재업고 튀"]`(4개 상한) |
| WS-4 | `("그해우리")` | `["그 해","그해 우","그해우 리"]` |
| WS-5 | `("너말고, 다른!")` | WS-1과 같음 |
| WS-6 | `("너말고다른", [{ query: "너 말", matchMode: "direct", compactQuery: "너말고다른" }])` | `["너말 고","너말고 다","너말고다 른"]` |
| WS-7 | `("너말")`, `("그해우")`, `("")`, `("abcd")`, `("squidgame")` | 모두 `[]` |
| WS-8 | `("괴수8호")` | `["괴 수","괴수 8","괴수8 호"]` |
| WP-1 | `planKoreanWordSplitFallback({ query:"너말고다른", page:1, sources:["tmdb","anilist"], remainingMs:7000, primaryVariants:createSearchQueryVariants("너말고다른"), primaryResults:[] })` | `reason: "run"`, `variants` 질의가 WS-1과 같음 |
| WP-2 | WP-1에서 `page: 2` | `{ variants: [], reason: "page" }` |
| WP-3 | WP-1에서 `sources: ["anilist"]` | `reason: "no_tmdb"` |
| WP-4 | WP-1에서 `query: "너말"` / `query: "squid game"` | 둘 다 `reason: "not_eligible"` |
| WP-5 | WP-1에서 `primaryResults: [title_primary "너 말고 다른 연애"인 결과]` | `reason: "has_match"`, `variants: []` |
| WP-6 | WP-1에서 `primaryResults: [title_primary "너 말고 니 언니"인 결과]` | `reason: "run"` |
| WP-7 | WP-1에서 `remainingMs: 2999` / `3000` | `"time"` / `"run"` |
| WP-8 | WP-1에서 `primaryResults: [title_primary "Other", match_titles ["너 말고 다른 연애"]]` | `reason: "has_match"` |

결과 객체는 테스트 파일의 기존 픽스처 함수 `result(titlePrimary, titleOriginal, overrides)`(15~33행)로 만든다. 예: `result("Other", null, { match_titles: ["너 말고 다른 연애"] })`.

### `scripts/searchGolden.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| G-7 | `SEARCH_GOLDEN_SPACING_CASES`의 `[query, externalId[]]` | `[["너말고다른",["314939"]],["선재업고튀어",["230923"]],["폭싹속았수다",["219246"]],["그해우리는",["135897"]],["닥터차정숙",["214997"]],["내남편과결혼해줘",["221851"]],["지금우리학교는",["99966"]]]` |

### 네트워크 검사 (읽기 전용 TMDB, `npm test` 밖)
| ID | 명령 | 기대 |
|----|------|------|
| GN-1 | `npm run search:golden` | `통과 19/19`(기존 12 + 띄어쓰기 7). 수정 전에는 띄어쓰기 7개가 실패한다 |

### 수동 확인
배포 전에는 웹이 배포된 `search-content`(v26)를 부른다. 그래서 M-1~M-4는 배포 후 사람이 확인한다.

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 (배포 후) | "너말고다른" 검색 → "너 말고 다른 연애" 카드. 네트워크 응답 `word_split_fallback: true` |
| M-2 | 웹 8081 (배포 후) | "오징어게임"·"너 말고 다른" → 기존과 같은 결과, `word_split_fallback: false` |
| M-3 | 웹 8081 (배포 후) | M-1을 다시 검색 → 같은 결과, 응답 `cached: true` |
| M-4 | 앱(iOS 세로, 배포 후) | "선재업고튀어" 검색 → "선재 업고 튀어" 카드 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/search-content/adapters/normalize.ts` | 6.1 export 추가. 기존 함수는 바꾸지 않는다 |
| `supabase/functions/search-content/adapters/normalize.test.ts` | WS-1~WS-8, WP-1~WP-8 |
| `supabase/functions/search-content/index.ts` | 6.2 |
| `scripts/searchGolden.ts` | `SEARCH_GOLDEN_SPACING_CASES` |
| `scripts/searchGolden.test.ts` | G-7 |
| `scripts/search-golden.ts` | 6.3 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| 입력마다 검색하는 클라이언트 동작(디바운스) | 기존 동작. D-1·D-4·D-5로 비용을 묶는다 |
| 인물 검색의 띄어쓰기 | `search-person-content` 별도 경로 |
| 라이브러리·핀 화면의 로컬 검색 | 서버 검색과 별개 |
| 일본어·영어 붙여 쓴 검색어 | TMDB 단어 경계가 다르다. 사례 없음 |
| 첫 단어가 5글자 이상이고 조사가 없는 제목 | 기존 앞부분 3글자 변형(`createKoreanAnchorQueries`)에 맡긴다 |
| 오타·자모 분리 입력 | 별도 기능 |
| 2단계의 다음 페이지 | D-6 |

## 13. 확실하지 않음 — 별도 검증 필요
- TMDB 검색 동작(2.1)은 공식 문서가 아니라 2026-10-11 실측이다. 동작이 바뀌면 GN-1이 먼저 실패한다.
- 2단계 질의의 마지막 단어가 1글자라 결과가 넓다. 1페이지(20개) 안에 원하는 작품이 들어온다는 가정은 실측 7개 사례에서만 확인했다. 인기도가 낮은 작품은 놓칠 수 있다.
- 2단계로 TMDB 호출이 검색당 최대 4회 는다(1단계에 맞는 결과가 없을 때만). TMDB 요청 한도는 넉넉하다고 알려져 있으나, 입력마다 검색하는 상황의 실제 호출량은 측정하지 않았다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 결함 수정 작업이다.
- 한국어 제목을 띄어쓰기 없이 검색하면(예: "너말고다른") 작품을 못 찾는다.
- 기존 검색(1단계)에 맞는 결과가 없을 때만, 붙여 쓴 검색어를 "앞 k글자 + 공백 + 다음 1글자"(k=1~4)로 띄운 질의를 TMDB에 2단계로 보내 찾는다.

| ID | 증상 |
|----|------|
| F-1 | "너말고다른", "선재업고튀어", "폭싹속았수다", "그해우리는", "닥터차정숙", "내남편과결혼해줘", "지금우리학교는" 검색 결과가 0건이다(띄어 쓰면 나온다) |

# READ FIRST
1. 이 명세서 1~13장. 원인은 2장(TMDB 단어 단위 일치), 결정은 D-1~D-9, 계약은 6장, 테스트는 10장이다.
2. `docs/35_search_completeness_and_deploy_drift_spec.md` — 골든 검사 구조.
3. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
4. 고칠 파일:
   - `supabase/functions/search-content/adapters/normalize.ts`: 3행 `MAX_QUERY_VARIANTS`, 97~129행 `createSearchQueryVariants`, 131~151행 `compactSearchText`·`filterResultsByCompactQuery`, 248~307행 공백·힌트·앞부분 함수
   - `supabase/functions/search-content/index.ts`: 34~48행 `SearchResponse`, 63행 `requestDeadline`, 143~258행 검색 흐름, 279~307행 `callAdapter`
   - `scripts/searchGolden.ts`, `scripts/searchGolden.test.ts`, `scripts/search-golden.ts`

# 시작 상태 (반드시 유지)
- `git status`, `npm test`, `npm run search:golden` 결과를 기록한다.
  - `npm test` 기준선은 1074개 중 1073개 통과다. 기존 실패 1개("uses latest-popular fallback ordering with an empty library")는 무관하니 건드리지 않는다.
  - `npm run search:golden` 기준선은 12/12다.
  - 그 밖의 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** `createSearchQueryVariants`·`createKoreanSpacingHints`·`createKoreanAnchorQueries`·`MAX_QUERY_VARIANTS`·`SEARCH_CACHE_VERSION`·`createQueryHash`는 바꾸지 않는다. 2단계는 `planKoreanWordSplitFallback`이 `"run"`일 때만 실행한다. 기존 테스트("신사의품격" 변형 목록, G-6)를 고치지 않는다.
- **D-2.** 2단계 질의는 붙여 쓴 검색어의 앞 k글자 + 공백 + 다음 1글자(k=1~min(4, 글자 수−1))이고, 1단계와 같은 문자열은 제외한다.
- **D-3.** 2단계 변형은 `compact-title` 모드다(붙여 쓴 전체 검색어로 거름).
- **D-4.** 2단계는 TMDB 소스에만 보낸다.
- **D-5.** 실행 조건(1페이지, TMDB 포함, 한글 4글자 이상, 1단계에 맞는 결과 없음, 남은 시간 ≥ 3000ms)과 제한 시간 `min(5000, 남은 시간 − 1000)`을 지킨다.
- **D-6.** `hasNextPage`는 1단계 결과로만 정한다.
- **D-7.** 2단계도 같은 캐시를 쓴다. 캐시 버전을 올리지 않는다.
- **D-8.** 응답 추가 필드는 `word_split_fallback`뿐이다. 클라이언트 파일을 바꾸지 않는다.
- **D-9.** 골든 띄어쓰기 사례는 별도 목록 `SEARCH_GOLDEN_SPACING_CASES`로 둔다.

# STEP 1 — 실패하는 테스트부터
- 10장 WS-1~WS-8, WP-1~WP-8을 `normalize.test.ts`에, G-7을 `scripts/searchGolden.test.ts`에 추가한다.
- `npm test`로 새 테스트가 전부 실패(새 export 없음)하는지 눈으로 확인한다. 하나라도 통과하면 멈추고 보고한다. 이번 명세에는 보존 테스트가 없다.

# STEP 2 — 순수 함수
- `normalize.ts`에 6.1의 상수 2개, `createKoreanWordSplitVariants`, `WordSplitFallbackReason`, `planKoreanWordSplitFallback`을 추가한다. 기존 함수의 동작은 바꾸지 않는다.
- `createKoreanWordSplitVariants` 위에 근거를 짧은 주석으로 남긴다: TMDB는 단어 단위로 맞추고 마지막 단어만 앞부분 일치를 허용한다(docs/55 2.1).
- WS·WP 행이 통과해야 한다.

# STEP 3 — Edge Function 2단계
`search-content/index.ts`를 6.2대로 바꾼다.
- 1단계 동작(결과 순서, 캐시 읽기·쓰기, 실패 소스 판정)이 그대로인지 diff로 확인한다.
- 2단계 소스는 `["tmdb"]`만이다.
- `hasNextPage`는 `primary.hasNextPage`다.

# STEP 4 — 골든 검사
- `scripts/searchGolden.ts`에 7개 사례를 추가한다.
- `scripts/search-golden.ts`가 두 목록을 검사하고 6.3대로 2단계를 재현하도록 고친다.
- `npm run search:golden`이 `통과 19/19`여야 한다(GN-1). 네트워크가 막혀 실행할 수 없으면 사유를 보고한다.

# 엣지 케이스 (전부 처리, 명세서 9장)
9장 E-1~E-18 전부. 각 행의 테스트 ID를 지킨다.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
npx --no-install esbuild supabase/functions/search-content/index.ts --bundle=false --format=esm --log-level=warning > /dev/null
npm run search:golden
```
- `npm test`: 기준선 1073개 통과 + 새 테스트 17개(WS 8, WP 8, G-7). 기존 실패 1개 외 실패는 0이어야 한다.
- esbuild는 Edge Function 문법 검사다(typecheck는 Edge Function을 제외한다). 오류 0이어야 한다.
- `search:golden`: `통과 19/19`(읽기 전용 TMDB 호출, 키 출력 금지).

# DEFINITION OF DONE
- [ ] WS-1~WS-8, WP-1~WP-8, G-7이 수정 전에 실패했고 수정 후 통과한다
- [ ] 기존 테스트 개수가 줄지 않았고, 기존 변형 테스트·G-6 diff가 없다
- [ ] `createSearchQueryVariants`·`MAX_QUERY_VARIANTS`·`SEARCH_CACHE_VERSION`·`createQueryHash` 본문 diff가 없다
- [ ] 2단계는 TMDB만, 1페이지만, `planKoreanWordSplitFallback`이 `"run"`일 때만 실행된다
- [ ] `hasNextPage`가 1단계 결과로만 정해진다
- [ ] 응답에 `word_split_fallback`이 있다
- [ ] `typecheck`·`lint`·esbuild 통과, `search:golden` 19/19(또는 실행 못 한 사유)

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
supabase/functions/search-content/adapters/normalize.ts
supabase/functions/search-content/adapters/normalize.test.ts
supabase/functions/search-content/index.ts
scripts/searchGolden.ts
scripts/searchGolden.test.ts
scripts/search-golden.ts
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력(요약)
2. `npm test` before / after 통과 개수, `typecheck`·`lint`·esbuild 결과
3. `npm run search:golden` before(12/12) / after(19/19) 결과
4. 추가한 테스트 ID와 이름
5. index.ts에서 1단계 동작이 그대로인지 확인한 방법(diff 요약)
6. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
7. 사람이 할 후속 작업: `search-content` 재배포. 운영 v26(2026-09-29) 이후의 다른 미배포 변경도 함께 나간다는 점을 적는다(`npm run edge:drift`로 확인)

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다(6.2의 헬퍼 분리는 명시된 변경이다).
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- TMDB 키 등 비밀 값을 출력하지 않는다.
