# 45. 추천 연도 필터 — 서버 미배포로 추천이 비는 문제 정정

작성일: 2026-10-04
대상 브랜치 기준: `main` (`6734575`) + 미커밋 작업(`docs/41` D-9 연도 정정, `docs/42`~`44` 구현 등). 이 시점 `npm test` 957개 중 956개 통과 — 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함
선행 문서: `docs/41_taste_fill_recommendations_spec.md`(2026-10-04 후속 D-9 연도 필터), `docs/00_ui_style_rules.md`(빈 상태 문구·버튼, UI-6)

> **근거.** 사용자 캡처(웹). 검색 탭 필터 "모든 유형 · 모든 장르 · 일본, 한국 · 2025년". "내 취향 최신 추천"에 카드가 없고 "이번 범위에서 조건에 맞는 새 작품을 찾지 못했어요 / 다음 추천 이어서 찾기"만 보인다.
> 사용자 요청: "codex에서 연도별 필터를 제대로 검색이 안 되어 수정한 뒤로 검색이 안 되고 있어."

---

## 1. 문제 정의

| ID | 증상 |
|----|------|
| F-1 | 연도를 고르면 추천이 0개다. "다음 추천 이어서 찾기"를 눌러도 같다. 연도를 고르지 않으면 정상이다 |
| F-2 | 앱은 "서버가 연도를 적용하지 않았다"는 사실을 모른다. 그래서 "조건에 맞는 작품 없음"으로 보이게 하고, 자동 이어 찾기(최대 6회·45초)를 헛되이 쓴다 |

## 2. 근본 원인 (실측)

**앱과 서버의 버전이 어긋났다.** 앱(웹 8081, 로컬 코드)은 연도를 지원하는데, 운영 서버는 지원하기 전 버전이다.

- **앱(2026-10-04 17:25 Codex 수정)**
  - 추천 요청 본문에 `year: 2025`를 넣는다(`src/services/personalizedRecommendations.ts:201` `...normalizeDiscoveryFilters(input)`).
  - 받은 후보는 `matchesDiscoveryFilters`의 `candidate.air_year === filters.year`로 다시 거른다(`supabase/functions/_shared/discoveryFilters.ts:100`). 화면(`src/utils/recommendationVisibility.ts:51`)과 훅(`usePersonalizedRecommendations.ts` 194행)이 이 함수를 쓴다.
- **운영 서버**
  - `personalized-recommendations`는 **v20(2026-10-03 17:32 배포)**이다(`npm run edge:drift`). 연도 코드보다 하루 앞선 버전이다.
  - v20은 `year`를 모르는 필드로 무시한다. 이번 달(2026-10)부터 한 번에 3개월씩 거꾸로 탐색하고, 취향 보충은 기간 제한이 없다.
- **로컬 재현**: 실제 TMDB·AniList로 서버와 같은 `scanRecommendationCatalog` 설정(12개, 3개월·3라운드, 1초 예산)을 썼다. 조건은 일본·한국, 모든 유형, 빈 라이브러리다.

  | 경우 | 요청 6회 결과 | 앱이 2025로 거른 뒤 |
  |------|---------------|--------------------|
  | 운영 v20처럼 연도 미적용 | 67개 **전부 2026년**, 탐색 월 2026-10 → 2026-05 | **0개** |
  | 현재 코드에 연도 전달 | 72개 전부 2025년, 2025-12 → 2025-10 | 72개 |
  | 취향 보충 3레인(한국 드라마·일본 애니·한국 영화), 연도 미적용 | 60개, 1971~2026년 혼합(2025년 2개) | 2개 |
  | 같은 3레인, 2025 | 48개 전부 2025년 | 48개 |

- 자동 이어 찾기는 진전이 3번 연속 없으면 멈춘다. 그래서 2026년 초 근처에서 멈추고 2025년 월에 닿지 못한다.
- **결론**
  - 앱의 연도 재검사는 맞는 동작이다(`docs/41` D-9: 다른 연도는 표시하지 않는다). 빠진 것은 서버 배포다.
  - 응답에 "서버가 실제로 적용한 조건"이 없어서, 앱이 "결과 없음"과 "서버가 조건을 모름"을 구분하지 못한다.
  - 같은 종류의 문제(서버 배포 누락으로 추천이 비는 것)가 `docs/41` 2장(v19 stale)에 이어 두 번째다.

## 3. 재현 시나리오

1. 운영 `personalized-recommendations`가 v20인 상태에서 웹 8081에 로그인한다.
2. 검색 탭 → 필터에서 연도 2025, 국가 일본·한국을 고르고 적용한다.
3. 추천이 비고 "이번 범위에서 조건에 맞는 새 작품을 찾지 못했어요"가 보인다. 네트워크 탭에는 `personalized-recommendations` 요청이 여러 번 찍히고, 응답 `items`의 `air_year`는 모두 2026이다.

## 4. 설계 결정

### D-1. 해결은 `personalized-recommendations` 재배포다 (사람 승인)
- 현재 워킹 트리의 서버 코드가 연도를 적용한다(2장 표 2·4행).
- 배포 전 확인: `npm test`(956/957, 기존 실패 1개). 2장의 로컬 재현으로 2025년만 나오는 것을 이미 확인했다.
- **사용자 결정(2026-10-04): 지금 배포하지 않는다. 이 명세 구현 뒤 한 번만 배포한다.** 그때까지 연도를 고르면 추천은 비어 있다. 이 명세가 구현되면 "결과 없음" 대신 D-5 빈 상태가 보인다.
- 배포 후 `npm run edge:drift`를 돌리고 수동 M-1을 확인한다.

### D-2. 앱의 연도 재검사는 유지한다
서버가 연도를 적용하지 못해도 다른 연도 작품은 보여 주지 않는다. 원래 결함(2025를 골랐는데 1992·1981·2026년 추천)이 재발하면 안 된다.

### D-3. 서버는 실제로 적용한 발견 조건을 응답에 돌려준다
- recommend 응답에 `applied_filters: { year: number | null, genres: string[], countries: string[], media_types: ("anime"|"drama"|"movie")[] }`를 더한다(정규화된 값).
- 기존 필드는 그대로라 예전 앱에는 영향이 없다.

### D-4. 앱은 요청한 조건과 `applied_filters`를 비교한다
- 공유 순수 함수 `detectUnsupportedDiscoveryFilter`로 비교한다.
- 응답에 `applied_filters`가 없거나 모양이 틀리면(구 서버) **연도를 요청했을 때만** `"year"`로 본다. 구 서버도 장르·국가·유형은 적용해 왔다(`docs/32`·`docs/33`).

### D-5. 감지되면 자동 이어 찾기를 멈추고 전용 빈 상태를 보여 준다
- `decideEmptyRecommendationContinuation`이 즉시 `"stopped"`를 돌려준다. 추가 요청은 0번이다.
- 빈 상태는 기존 "이번 범위에서…" 대신 아래 문구를 쓴다.

  | 종류 | 제목 | 설명 | 버튼 → 동작 |
  |------|------|------|------------|
  | `"year"` | 지금은 연도별 추천을 불러올 수 없어요 | 연도를 해제하면 최신 추천을 볼 수 있어요. | 연도 해제 → 연도만 지움 |
  | `"filters"` | 선택한 조건으로 추천을 불러올 수 없어요 | 조건을 바꾸거나 잠시 후 다시 시도해 주세요. | 필터 변경 → 필터 시트 열기 |

- 목록 아래 "아래로 스크롤하면 다음 추천을 자동으로 찾습니다." 안내도 숨긴다.
- 개발 모드(`__DEV__`)에서만 `console.warn("recommendation filter not applied by server", { unsupported, requested })`를 남긴다. 재배포가 필요하다는 신호다. `requested`는 정규화된 조건뿐이고, 제목·ID·계정 정보는 기록하지 않는다.

### D-6. 병합 시 `unsupported_filter`는 가장 최근 응답 값을 쓴다
- 최근 서버 상태가 기준이다.
- `filter_limited`를 합치는 네 곳(`usePersonalizedRecommendations.ts` 427·455·528·630행)에 `unsupported_filter: next.unsupported_filter ?? null`을 더한다.

### D-7. 연도를 고르지 않으면 동작은 지금과 같다
구 서버에서도 감지 결과가 `null`이다.

### D-8. 배포 순서
- 이 정정(앱 + 서버 `applied_filters`)을 구현한 뒤 `personalized-recommendations`를 **한 번** 배포한다. 연도 지원과 `applied_filters`가 함께 나간다.
- 구현 직후부터 배포 전까지 연도를 고르면 D-5 빈 상태("지금은 연도별 추천을 불러올 수 없어요")가 보인다. 이는 감지가 의도대로 동작하는 것이며(M-2 확인 기회), 배포하면 사라진다.
- 연도 지원만 있고 `applied_filters`가 없는 서버를 배포하면, 새 앱은 그 서버도 구 서버로 본다. 그러니 연도 지원만 따로 배포하지 않는다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 앱의 연도 재검사를 빼서 구 서버에서도 무언가 보이게 | 원래 결함(다른 연도 추천)이 재발한다 |
| 구 서버로 감지되면 연도 없는 결과를 "연도 무시됨" 안내와 함께 표시 | 사용자가 고른 조건과 다른 결과다. 해제는 사용자가 버튼으로 고르게 한다 |
| 자동 이어 찾기 횟수를 늘려 2025년 월까지 간다 | 10개월 이상, 요청 수십 회가 필요하다. 취향 보충이 끼어들어 도달도 보장되지 않는다 |
| 서버 버전 번호(`server_version`) 비교 | 버전 체계가 없고, 어떤 조건이 빠졌는지 알 수 없다. 적용 조건을 돌려받는 편이 정확하다 |
| 배포만 하고 코드는 그대로 | 이번 문제는 풀리지만, 다음에 앱이 먼저 바뀌면 또 "결과 없음"으로 보인다. 이미 두 번째다 |
| `applied_filters`가 없을 때 받은 항목 연도로 추측(전부 2025면 적용된 것으로) | 항목이 0개이거나 우연히 섞이면 판정할 수 없다. 규칙이 단순해야 테스트로 고정할 수 있다 |

## 6. 계약

### 6.1 `supabase/functions/_shared/discoveryFilters.ts` (추가)
```ts
export interface AppliedDiscoveryFilters {
  year: number | null;
  genres: string[];
  countries: string[];
  media_types: DiscoveryMediaType[];
}
export function toAppliedDiscoveryFilters(input?: DiscoveryFilterInput): AppliedDiscoveryFilters;

export type UnsupportedDiscoveryFilter = "year" | "filters";
export function detectUnsupportedDiscoveryFilter(
  requested: DiscoveryFilterInput | undefined,
  applied: unknown
): UnsupportedDiscoveryFilter | null;
```
- `toAppliedDiscoveryFilters`: `n = normalizeDiscoveryFilters(input)` → `{ year: n.year ?? null, genres: n.genres, countries: n.countries, media_types: n.mediaTypes }`.
- `detectUnsupportedDiscoveryFilter` 판정 순서:
  1. `r = toAppliedDiscoveryFilters(requested)`.
  2. `applied`가 올바른 모양이 아니면 `r.year !== null ? "year" : null`을 돌려준다. 올바른 모양은 다음을 모두 만족하는 것이다.
     - `null`이 아닌 객체
     - `year`가 `null`이거나 정수
     - `genres`·`countries`·`media_types`가 모두 문자열 배열
  3. `a = toAppliedDiscoveryFilters({ year: applied.year ?? undefined, genres: applied.genres, countries: applied.countries, mediaTypes: applied.media_types })`. 양쪽을 같은 정규화로 맞춘다.
  4. `a.year !== r.year`이면 `"year"`.
  5. `JSON.stringify([a.genres, a.countries, a.media_types]) !== JSON.stringify([r.genres, r.countries, r.media_types])`이면 `"filters"`.
  6. `null`.

### 6.2 `supabase/functions/personalized-recommendations/index.ts`
- 342행 `json({ ... })`의 `filter_limited`(357행) 옆에 `applied_filters: toAppliedDiscoveryFilters(discoveryFilters)`를 더한다. `discoveryFilters`는 237행의 검증된 값이다.
- 다른 동작은 바꾸지 않는다.

### 6.3 `src/services/personalizedRecommendations.ts`
- `PersonalizedRecommendationsApiResponse`에 `applied_filters?: unknown`을 더한다.
- `PersonalizedRecommendationsResponse`에 `unsupported_filter?: UnsupportedDiscoveryFilter | null`을 더한다.
- `fetchPersonalizedRecommendationPage`는 요청한 조건(`normalizeDiscoveryFilters(input)`)과 `data.applied_filters`로 `unsupportedFilter`를 계산해 page에 담는다. 값이 있으면 `__DEV__`에서 D-5의 `console.warn`을 남긴다.
- `getPersonalizedRecommendations`는 마지막 page의 값을 `unsupported_filter`로 돌려준다(`maxRequests: 1`이라 page는 하나다).

### 6.4 `src/utils/recommendationFeed.ts`
- `EmptyRecommendationContinuationInput`에 `unsupportedFilter?: boolean`(기본 `false`)을 더한다.
- `decideEmptyRecommendationContinuation`의 판정 위치는 `hasError` 검사 바로 뒤다: `if (input.unsupportedFilter) return "stopped";`.
- `idle`·`loading` 판정이 먼저다. 그래서 표시할 12개가 이미 있으면 `idle`이다.

### 6.5 `src/hooks/usePersonalizedRecommendations.ts`
- `decideEmptyRecommendationContinuation` 호출(673행)에 `unsupportedFilter: Boolean(recommendationQuery.data?.unsupported_filter)`를 넘긴다.
- D-6 병합 네 곳을 고친다.
- 반환값에 `unsupportedFilter: recommendationQuery.data?.unsupported_filter ?? null`을 더한다.

### 6.6 `src/utils/searchRecommendationPolicy.ts` (추가)
```ts
import type { UnsupportedDiscoveryFilter } from "../../supabase/functions/_shared/discoveryFilters";
export function unsupportedRecommendationFilterCopy(kind: UnsupportedDiscoveryFilter): {
  title: string;
  description: string;
  actionLabel: string;
};
```
값은 D-5 표 그대로다.

### 6.7 `app/search.tsx`
- **빈 상태(921~937행)**: `personalizedRecommendations.unsupportedFilter`가 있으면 `EmptyState`(6.6 문구)를 쓴다. 없으면 기존 "이번 범위에서…"를 그대로 쓴다.
  - `"year"` 버튼: `clearRecommendationYear()`. 기존 `clearDiscoveryFilters`(116~123행)와 같은 준비·저장 중 검사, 같은 실패 토스트를 쓰고 `applyFilters({ ...appliedSearchFilters, year: "" })`만 한다.
  - `"filters"` 버튼: `searchBarRef.current?.openFilters()`.
- **목록 아래 안내(1106행 조건)**: `!personalizedRecommendations.unsupportedFilter`를 더한다.

## 7. 데이터 모델 / SQL

없음.

## 8. 화면 명세

빈 상태 하나만 바뀐다(D-5 표). 위치·모양은 기존 `EmptyState`와 같다. UI 규칙(UI-6.3 한국어 문구, UI-6.4 한 영역 한 상태)을 따른다.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 연결 |
|---|------|----------|------|
| E-1 | 새 앱 + 구 서버(`applied_filters` 없음) + 연도 2025 | 요청 1회 후 "지금은 연도별 추천을 불러올 수 없어요", 자동 이어 찾기 없음 | U-1, C-1, M-2 |
| E-2 | 새 앱 + 구 서버 + 연도 없음 | 지금과 같음(감지 `null`) | U-2, C-2 |
| E-3 | 새 앱 + 새 서버 + 연도 2025 | 2025년 추천 표시, 감지 `null` | U-3, M-1 |
| E-4 | 서버가 연도를 버리고 `year: null`을 돌려줌 | `"year"` | U-4 |
| E-5 | 서버가 장르를 적용하지 못함 | `"filters"`, "필터 변경" | U-5 |
| E-6 | `applied_filters` 모양 오류(문자열 연도 등) | 구 서버로 취급 | U-6 |
| E-7 | 표기만 다른 같은 조건("kr"·"KR", "드라마"·"drama", 세 유형 전부·빈 배열) | `null` | U-7, U-8 |
| E-8 | 감지 상태에서 "연도 해제" | 연도만 지워지고 최신 추천을 다시 불러옴. 장르·국가·유형은 유지 | M-2 |
| E-9 | 감지됐지만 이미 표시 가능한 12개가 있음 | `idle`(빈 상태 없음) | C-3 |
| E-10 | 감지 상태에서 요청 진행 중 | `loading` | C-4 |
| E-11 | 연도 해제 저장 실패 | 기존과 같은 실패 토스트, 연도 유지 | M-2 |
| E-12 | 제목 검색 + 연도 2025 | 지금과 같음(제목 검색 경로는 바뀌지 않음) | M-4 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다. 한 행 = `it` 하나.**

### `supabase/functions/_shared/discoveryFilters.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| A-1 | `toAppliedDiscoveryFilters({ countries: ["kr", "JP", "jp"], year: 2025 })` | `{ year: 2025, genres: [], countries: ["JP", "KR"], media_types: [] }` |
| A-2 | `toAppliedDiscoveryFilters({})`, `toAppliedDiscoveryFilters()` | 둘 다 `{ year: null, genres: [], countries: [], media_types: [] }` |
| A-3 | `toAppliedDiscoveryFilters({ mediaTypes: ["anime", "drama", "movie"], year: 1800, genres: ["드라마"] })` | `{ year: null, genres: ["drama"], countries: [], media_types: [] }` |
| U-1 | `detectUnsupportedDiscoveryFilter({ countries: ["JP", "KR"], year: 2025 }, undefined)` | `"year"` |
| U-2 | `detectUnsupportedDiscoveryFilter({ countries: ["JP", "KR"] }, undefined)` | `null` |
| U-3 | `({ countries: ["JP", "KR"], year: 2025 }, { year: 2025, genres: [], countries: ["JP", "KR"], media_types: [] })` | `null` |
| U-4 | `({ year: 2025 }, { year: null, genres: [], countries: [], media_types: [] })` | `"year"` |
| U-5 | `({ genres: ["드라마"] }, { year: null, genres: [], countries: [], media_types: [] })` | `"filters"` |
| U-6 | `({ year: 2025 }, "garbage")` / `({ year: 2025 }, { year: "2025", genres: [], countries: [], media_types: [] })` / `({ year: 2025 }, null)` / `({ year: 2025 }, { year: 2025, genres: "drama", countries: [], media_types: [] })` | 넷 다 `"year"` |
| U-7 | `({ countries: ["kr"], genres: ["드라마"] }, { year: null, genres: ["drama"], countries: ["KR"], media_types: [] })` | `null` |
| U-8 | `({ mediaTypes: ["anime", "drama", "movie"] }, { year: null, genres: [], countries: [], media_types: [] })` / 같은 요청, 응답 `media_types: ["anime"]` | `null` / `"filters"` |

### `src/utils/recommendationFeed.test.ts` (추가, 기존 `base` 픽스처와 같은 값)
> C-1만 구현 전에 실패한다. C-2~C-4는 기존 동작(필드 없음·`idle`·`loading` 우선)을 지키는 **보존 테스트**라 구현 전에도 통과하는 것이 정상이다(2026-10-04 Codex 보고로 정정. 구현 전 실패 14개 = A-1~A-3, U-1~U-8, C-1, P-1·P-2).

| ID | 입력 | 기대 |
|----|------|------|
| C-1 | `base` + `unsupportedFilter: true` | `"stopped"` |
| C-2 | `base` + `unsupportedFilter: false` / `base`(필드 없음) | 둘 다 `"continue"` |
| C-3 | `base` + `unsupportedFilter: true`, `itemCount: 12` | `"idle"` |
| C-4 | `base` + `unsupportedFilter: true`, `isLoading: true` | `"loading"` |

### `src/utils/searchRecommendationPolicy.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| P-1 | `unsupportedRecommendationFilterCopy("year")` | `{ title: "지금은 연도별 추천을 불러올 수 없어요", description: "연도를 해제하면 최신 추천을 볼 수 있어요.", actionLabel: "연도 해제" }` |
| P-2 | `unsupportedRecommendationFilterCopy("filters")` | `{ title: "선택한 조건으로 추천을 불러올 수 없어요", description: "조건을 바꾸거나 잠시 후 다시 시도해 주세요.", actionLabel: "필터 변경" }` |

### 수동 확인

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440(사람, D-8 배포 후) | 연도 2025 + 일본·한국 → 추천 카드가 모두 2025년이다(카드 연도 표시). 스크롤 보충·"새 추천 12개"도 2025년이다. 2026·2010으로 바꾸면 그 연도만 보인다. 연도를 해제하면 최신 추천이 보인다 |
| M-2 | 웹 375(구현 직후, 배포 전 운영 v20) | 연도 2025 → `personalized-recommendations` 요청 1회 뒤 전용 빈 상태가 뜬다. "연도 해제" → 연도만 지워지고 추천이 다시 온다. 로그인 화면을 확인할 수 없으면 U-1·C-1로 갈음하고 미확인으로 보고한다 |
| M-3 | 앱(iOS 세로) | M-1과 같은 흐름, 빈 상태 문구·버튼 잘림 없음(글자 1.3배) |
| M-4 | 웹 | 제목 검색 "사랑" + 연도 2025 → 2025년 결과만, 숨김 결과 "필터 없이 보기"(기존 동작) |

## 11. 변경 파일

| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/discoveryFilters.ts` | 6.1 두 함수·두 타입 추가 |
| `supabase/functions/_shared/discoveryFilters.test.ts` | A-1~A-3, U-1~U-8 |
| `supabase/functions/personalized-recommendations/index.ts` | 6.2 응답 필드 한 줄 + import |
| `src/services/personalizedRecommendations.ts` | 6.3 |
| `src/utils/recommendationFeed.ts` | 6.4 |
| `src/utils/recommendationFeed.test.ts` | C-1~C-4 |
| `src/hooks/usePersonalizedRecommendations.ts` | 6.5 |
| `src/utils/searchRecommendationPolicy.ts` | 6.6 |
| `src/utils/searchRecommendationPolicy.test.ts` | P-1·P-2 |
| `app/search.tsx` | 6.7 |

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| 연도 탐색 규칙(선택 연도 12월→1월, 취향 보충 공개일 범위) | `docs/41` D-9 그대로. 로컬 재현으로 동작 확인 |
| 다른 Edge Function 재배포(`add-to-library` 등 drift) | 이 증상과 무관. 별도 판단 |
| 제목 검색의 연도 처리 | 바뀌지 않았다(`partitionSearchResults` 경로) |
| `npm run edge:drift`의 "코드 변경 시각"이 미커밋 변경을 반영하지 않는 문제 | 도구 개선은 별도 |
| 기존 실패 테스트 1개 | 무관 |

## 13. 확실하지 않음 — 별도 검증 필요

1. 로컬 재현은 빈 라이브러리로 돌렸다. 실제 계정(라이브러리 560개, 제외 설정 3개)에서 2025년 추천 개수는 배포 뒤 M-1로 사람이 확인한다. 로그인 대행은 하지 않는다.
2. 사용자의 표현 "검색이 안 된다"는 캡처상 추천 피드를 가리킨다. 제목 검색은 코드상 바뀌지 않았지만 M-4로 함께 확인한다.
