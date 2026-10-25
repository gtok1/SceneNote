# 64. 추천 호출 비용 검증·정정

작성일: 2026-10-24
대상 브랜치 기준: `main` (`bfcc3fd`) + 미커밋 작업. 작성 시점 `npm test` 기준선은 시작할 때 기록한다(마지막 기록 1235/1236, 실패 1개 "uses latest-popular fallback ordering with an empty library"는 무관한 기존 결함). 운영 `personalized-recommendations`는 v22다.
선행 문서: `docs/47_recommendation_batch_topup_spec.md`(묶음 목표·자동 이어 찾기, 14·15장 사용자 후속 결정), `docs/52_recommendation_first_batch_fill_spec.md`(첫 요청 1초 탐색·진단 값), `docs/42`·`docs/43`(추가 흐름)

> **근거.** 사용자 캡처(웹, 검색 탭 추천 갤러리, 필터 2개: 일본·한국·2026년).
> 사용자 요청: "추천하는 로직 제대로 검증해줘 갯수가 이상하게 불러오고 쓸때없이 API 호출을 하는거 같아 이건 금액과 관련된 일이니 제대로 나오게해야해 codex prompt 작성해줘"

---

## 1. 문제 정의
| ID | 증상·위험 |
|----|-----------|
| C-1 | 호출 수를 셀 방법이 없다. 운영 로그는 현재 토큰에 `analytics_logs_read` 권한이 없어 읽을 수 없다(2026-10-24 확인). 앱·서버 어디에도 호출 수 집계가 없다 |
| C-2 | 추천 카드가 보일 때마다 노출 기록(`record_impressions`)을 **별도 Edge 호출**로 보낸다. 12개마다 1회이고, 실패하면 최대 3회다 |
| C-3 | 이어 찾기 요청도 서버가 목록 탐색을 **1초**만 하고 끝낸다. 그래서 부족분을 채우려 같은 묶음에서 호출을 최대 6회 반복한다. 매 호출마다 라이브러리 전체 조회 같은 준비 작업도 반복한다 |
| C-4 | 묶음을 시작하는 경로가 여럿(스크롤, 추가·완료 후 예약, 빈 응답 재개, 새로고침)인데 세션 단위 상한이 없다. 반복 조작이나 버그가 있으면 자동 호출이 계속 늘 수 있다 |
| C-5 | 묶음이 6회·45초·무진전 3회 한도에 걸리면 "17/24"처럼 목표에 못 미친 채 멈춘다. 그래서 개수가 들쑥날쑥해 보인다 |

## 2. 근본 원인 (코드 기준, 2026-10-24)

### 2.1 앱이 Edge Function을 부르는 경로
`src/hooks/usePersonalizedRecommendations.ts`, `src/services/personalizedRecommendations.ts`

| 경로 | 언제 | 요청 수 |
|------|------|--------|
| 첫 조회(`useQuery`, 148~170행) | 검색 탭 추천 진입, 문맥(계정·유형·제외·필터) 변경 | 1(10분 캐시, 재마운트·포커스 때 다시 부르지 않음) |
| 자동 이어 찾기(720~741행, `decideEmptyRecommendationContinuation`) | 보이는 수 < 묶음 목표 | 묶음당 최대 6회, 45초, 무진전 연속 3회에서 중단 |
| 스크롤 다음 묶음(`loadNextBatch`, `app/search.tsx` 1081행) | 목표에 닿은 뒤 끝 근처로 스크롤 | 1 + 이어 찾기 |
| 추가·완료 성공 후 예약 묶음(`scheduleRefill` → `loadNextBatch`, 800ms 묶음) | 추가·완료 성공 | 1 + 이어 찾기(목표 = 화면 수 + 12, docs/47 15장 사용자 결정) |
| 관심 없음 등 보충(`refill`, limit 1) | 피드백으로 카드 제거 | 1 |
| **노출 기록**(`recordImpressionsWithRetry`, 204~232행) | 새로 보인 카드 12개마다 | **1~3** |
| 피드백(`record_feedback`) | 추천·비추천·관심 없음 | 1 |

묶음 하나(카드 12개)에 최대 **추천 6회 + 노출 기록 1~3회 = 9회**까지 나간다.

### 2.2 서버가 추천 요청 1회마다 하는 일
`supabase/functions/personalized-recommendations/index.ts` 176~380행
1. 준비: `user_library_items` 전체 조인 조회(작품·외부 id·장르·테마·시즌), 피드백, 최근 본 작품
2. 목록 탐색 `scanRecommendationCatalog`: 최대 3개월·3바퀴. **시작 1초 뒤 새 바퀴를 시작하지 않는다**(`canContinue: < 1_000ms`). 키워드 조회는 최대 16건
3. 취향 보충: 남은 질의 전부를 미리 받고(prefetch), 부족하면 사용한다
4. 응답 작품마다 국내 OTT 조회(최대 12, 캐시)

첫 요청은 docs/52 의도대로 1초 탐색이 맞다(첫 화면 속도). 그런데 **이어 찾기(커서 있음)도 같은 1초**라, 한 번에 채우는 수가 적어 호출이 늘어난다(C-3).

### 2.3 노출 기록은 서버가 이미 안다
- 노출 기록은 최근 본 작품을 다음 추천에서 빼는 데 쓰인다(`loadRecentSeenIdentityKeys`).
- 서버는 추천 응답에 어떤 작품을 넣었는지 이미 안다. 같은 요청에서 `recordRecommendationImpressions`(585~602행)로 저장하면 별도 호출이 필요 없다.
- 서버는 라이브러리 작품·사용자 제외·필터를 앱과 같은 규칙으로 미리 거른다(`isRecommendationExcludedForUser`, `matchesDiscoveryFilters`). 그래서 "응답한 작품 = 앱에 보이는 작품"에 가깝다.

## 3. 재현 시나리오
1. 웹 8081 로그인 → 검색 탭 추천(필터: 일본·한국·2026년).
2. 개발자 도구 콘솔에서 `recommendation response` 로그 수를 센다. 네트워크 탭에서 `personalized-recommendations` 요청 수를 센다(노출 기록 포함).
3. 추가 1회, 아래로 스크롤 2회를 한 뒤 다시 센다.

## 4. 설계 결정

### D-1 (최우선). 먼저 잴 수 있게 한다
- **앱 집계**: 순수 함수 `recordRecommendationInvocation`(`src/utils/recommendationInvocationStats.ts`)으로 추천 문맥(scope)별 호출 수를 이유별로 센다.
  - 이유: `initial`, `continuation`, `scroll_batch`, `action_batch`, `refill`, `resume`, `refresh`, `impressions`, `feedback`
  - 훅이 Edge 호출 직전마다 기록한다. 개발 모드(`__DEV__`)에서 호출마다 콘솔에 `recommendation invocations` 누적 요약을 남긴다(개수만, 제목·id 금지).
- **서버 집계**: 응답 `diagnostics`에 아래를 더한다(개수만).
  - `cache_reads`, `cache_hits`: 공급자 캐시 읽기
  - `keyword_lookups_used`: 16 또는 32에서 남은 수를 뺀 값
  - `ott_lookups`: 국내 OTT를 조회한 작품 수
  - `library_rows`
  - `impressions_saved`(D-2)
  - `scan_budget`: `"first"` | `"continuation"`
- 이 값으로 구현 전·후를 비교해 보고한다(14장 보고 항목).

### D-2. 노출 기록을 추천 응답에 합친다
- 서버는 `recommend` 응답을 만든 뒤 응답 작품(최대 12)을 같은 요청에서 `user_recommendation_impressions`에 upsert한다(기존 `recordRecommendationImpressions` 재사용).
  - 실패해도 추천 응답은 성공으로 돌려준다. 로그만 남기고 `impressions_saved: 0`이다.
  - 저장은 응답 직전에 기다린다(최대 12행).
- 앱은 `record_impressions` 호출을 하지 않는다. `usePersonalizedRecommendations`의 노출 기록 effect와 재시도를 삭제한다.
- 서버의 `record_impressions` 동작은 **구버전 앱 호환을 위해 남긴다**.
- 효과: 묶음마다 별도 호출 1~3회가 없어진다.

### D-3. 이어 찾기 요청은 한 번에 더 채운다
서버는 `cursor`가 있는 요청(이어 찾기·다음 묶음·보충)에 더 큰 탐색 예산을 쓴다.

| | 첫 요청(cursor 없음) | 이어 찾기(cursor 있음) |
|--|---------------------|------------------------|
| 목록 탐색 새 바퀴 시작 한도 | 1,000ms(그대로) | **4,000ms** |
| 최대 개월·바퀴 | 3·3(그대로) | **6·6** |
| 키워드 조회 | 16(그대로) | **32** |

- 요청 마감 8.5초, 취향 보충 최소 남은 시간 2.5초, OTT 조회 규칙은 그대로다.
- 판정은 순수 함수 `recommendationScanBudget({ hasCursor })`다.
- 목적: 호출 1회가 채우는 수를 늘려 이어 찾기 횟수(C-3)와 목표 미달(C-5)을 줄인다.

### D-4. 자동 호출에 세션 안전 상한을 둔다
- 같은 추천 문맥에서 **자동** 호출(`continuation`, `action_batch`)은 최근 60초 동안 최대 12회다.
- 넘으면 자동 이어 찾기를 시작하지 않고 기존 "멈춤" 상태(스크롤로 재개, `emptyContinuationStopped`)로 둔다.
- 사용자가 직접 한 동작(스크롤 묶음·재개·새로고침·피드백)은 막지 않는다. 다만 집계(D-1)에는 포함한다.
- 판정은 순수 함수 `canStartAutomaticRecommendationInvocation(history, nowMs)`이고, 기록은 D-1 집계를 재사용한다.

### D-5. 묶음 규칙은 유지한다
- 12개 목표, 추가·완료 후 다음 12개(docs/47 15장, 2026-10-05 사용자 결정), 묶음당 6회·45초·무진전 3회, 10분 캐시는 그대로다.
- 이번 작업은 같은 결과를 더 적은 호출로 내는 것이다.

### D-6. 응답 계약은 선택 필드만 추가한다
- `diagnostics`에 D-1 필드만 추가한다. 기존 필드·오류 코드는 그대로다.
- 앱은 새 필드가 없어도 동작한다(배포 순서 무관).

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| 추가·완료 후 12개 묶음 제거 | 2026-10-05 사용자 결정(docs/47 15장). 바꾸려면 사용자 확인이 필요하다 |
| 첫 요청 탐색도 4초로 | 첫 화면이 늦어진다(docs/52에서 해결한 문제) |
| 이어 찾기 한도 6회를 줄이기만 | 호출은 줄지만 목표 미달(C-5)이 늘어난다. D-3로 1회당 채우는 양을 먼저 늘린다 |
| 노출 기록을 앱에서 모아 한참 뒤 한 번에 | 여전히 별도 호출이다. 서버가 이미 아는 정보다 |
| 서버에 라이브러리 프로필 캐시 테이블 | DB 변경·무효화 규칙이 필요하다. 먼저 D-1로 비중을 잰다 |

## 6. 계약

### 6.1 `src/utils/recommendationInvocationStats.ts` (신규, 순수)
```ts
export type RecommendationInvocationReason =
  | "initial" | "continuation" | "scroll_batch" | "action_batch" | "refill" | "resume" | "refresh" | "impressions" | "feedback";
export interface RecommendationInvocationLog { scope: string; entries: { reason: RecommendationInvocationReason; atMs: number }[] }
export const AUTOMATIC_INVOCATION_WINDOW_MS = 60_000;
export const MAX_AUTOMATIC_INVOCATIONS_PER_WINDOW = 12;
export function recordRecommendationInvocation(log: RecommendationInvocationLog, scope: string, reason: RecommendationInvocationReason, atMs: number): RecommendationInvocationLog;
export function summarizeRecommendationInvocations(log: RecommendationInvocationLog): { total: number; byReason: Partial<Record<RecommendationInvocationReason, number>> };
export function canStartAutomaticRecommendationInvocation(log: RecommendationInvocationLog, scope: string, nowMs: number): boolean;
```
- `record…`:
  - `scope`가 다르면 새 로그(`entries`는 이번 1건)로 바꾼다.
  - 같으면 뒤에 붙인다. 저장은 최근 200건까지만 한다(오래된 것부터 버림).
- `canStart…`:
  - 다른 scope면 `true`다.
  - 같은 scope면 `nowMs - atMs < 60_000`인 `continuation`·`action_batch` 수가 12 미만일 때 `true`다.

```ts
export function simulateRecommendationBatch(input: {
  trigger: "initial" | "scroll_batch" | "action_batch";
  startVisible: number; target: number; yields: readonly number[];
  log: RecommendationInvocationLog; scope: string; startMs: number;
}): { calls: number; finalVisible: number; stoppedBy: "target" | "no_progress" | "attempts" | "cap" | "exhausted"; log: RecommendationInvocationLog; endMs: number };
```
- 첫 호출의 이유는 `trigger`이고, 이어지는 호출은 `continuation`이다. 호출마다 `yields`의 다음 값만큼 보이는 수가 늘고, 시각은 1,000ms 늘어난다.
- 자동 호출(`action_batch` 첫 호출, `continuation`)은 시작 전에 `canStartAutomaticRecommendationInvocation`을 본다. `false`면 `"cap"`으로 멈춘다.
- 계속 여부는 `decideEmptyRecommendationContinuation`으로 정한다.
  - 시도 횟수: 묶음 첫 호출이 1이고, 호출할 때마다 1 늘린다.
  - 최대 시도: `MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS`
  - 경과 시간: 묶음 시작부터 잰다.
  - 멈춘 이유:
    - 목표 도달 → `"target"`
    - 무진전 3회 → `"no_progress"`
    - 시도·시간 한도 → `"attempts"`
    - `yields` 소진 → `"exhausted"`

### 6.2 앱 훅 `src/hooks/usePersonalizedRecommendations.ts`
- 훅 안에 `useRef<RecommendationInvocationLog>`를 둔다.
- Edge 호출 직전에 이유를 기록한다.

  | 호출 지점 | 이유 |
  |----------|------|
  | 첫 조회 `queryFn` | `initial` |
  | 자동 이어 찾기 effect의 `loadMore` | `continuation` |
  | `loadNextBatch` | 스크롤 경로 `scroll_batch`, `runScheduledRefill` 경로 `action_batch` |
  | `refill` | `refill` |
  | `retryEmptyContinuation`·`retryInitial` 경로 | `resume` |
  | `refresh` | `refresh` |
  | `submitFeedback` | `feedback` |

  - `loadNextBatch(reason: "scroll_batch" | "action_batch" = "scroll_batch")`로 인자를 추가한다. 외부 호출부(`app/search.tsx` 1083행)는 바꾸지 않는다(기본값).
- 자동 이어 찾기 effect(720~741행)와 `runScheduledRefill`은 시작 전에 `canStartAutomaticRecommendationInvocation`이 `false`면 시작하지 않는다. 대신 `setEmptyContinuationStopped(true)`로 멈춘다.
- `__DEV__`에서 기록할 때마다 `console.info("recommendation invocations", JSON.stringify(summarize…))`를 남긴다(개수만).
- **노출 기록 effect(204~232행)와 `recordImpressionsWithRetry`를 삭제한다**(D-2). `rememberRecommendationSessionSeenIds` 호출은 남긴다(같은 effect 안에 있으면 그 부분만 남긴다).
- 기존 상태·반환 필드·잠금 규칙은 바꾸지 않는다.

### 6.3 서비스 `src/services/personalizedRecommendations.ts`
- `recordPersonalizedRecommendationImpressions`는 남긴다(다른 사용처가 없으면 export만 유지).
- 추천 응답의 `diagnostics`를 기존 개발 로그(`recommendation response`)에 그대로 싣는다. 새 필드도 포함된다.

### 6.4 서버 `supabase/functions/_shared/recommendationTasteFill.ts` (추가, 순수)
```ts
export interface RecommendationScanBudget { scanMs: number; keywordLookups: number; maxMonths: number; maxRounds: number; label: "first" | "continuation" }
export function recommendationScanBudget(input: { hasCursor: boolean }): RecommendationScanBudget;
// hasCursor=false → { 1000, 16, 3, 3, "first" } / true → { 4000, 32, 6, 6, "continuation" }
```

### 6.5 서버 `supabase/functions/personalized-recommendations/index.ts`
- `const budget = recommendationScanBudget({ hasCursor: Boolean(validated.value.cursor) })`를 만들고 아래에 쓴다.
  - `keywordLookupBudget = { remaining: budget.keywordLookups }`
  - `maxMonthsPerRequest: budget.maxMonths`, `maxProviderRoundsPerRequest: budget.maxRounds`
  - `canContinue: () => Date.now() - scanStartedAt < budget.scanMs && keywordLookupBudget.remaining > 0`
- `providerCache` 읽기를 감싸 `cache_reads`·`cache_hits`를 센다(요청 범위 변수).
- `ott_lookups`는 `attachKrOttProviders`에 넘기는 fetcher를 감싸 센다.
- 응답 직전에 `recordRecommendationImpressions(userClient, user.id, itemsWithProviders)`를 `try/catch`로 부른다. 실패는 `console.error`만 하고 `impressions_saved = 0`이다.
- `diagnostics`에 D-1 필드를 추가한다. `keyword_lookups_used = budget.keywordLookups - keywordLookupBudget.remaining`, `library_rows = libraryItems.length`.
- 그 밖의 흐름·필터·순위·응답 필드는 바꾸지 않는다.

## 7. 데이터 모델 / SQL
변경 없음(`user_recommendation_impressions` 기존 테이블·RLS 사용).

## 8. 화면 명세
화면 변경 없음. D-4 상한에 걸리면 기존 멈춤 상태(스크롤로 재개)가 보인다.

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 첫 요청이 12개를 채움 | 추천 1회, 노출 기록 별도 호출 0회 | SIM-1 |
| E-2 | 이어 찾기가 회당 4개씩 채움 | 추천 3회로 12개 | SIM-2 |
| E-3 | 빈 응답 연속 | 무진전 3회에서 중단(기존) | SIM-3 |
| E-4 | 자동 호출 60초 12회 초과 | 13번째 자동 호출 시작 안 함, 멈춤 상태 | IS-4, SIM-4 |
| E-5 | 60초가 지난 뒤 | 다시 허용 | IS-5 |
| E-6 | 사용자 스크롤·새로고침 | 상한과 무관하게 허용, 집계에는 포함 | IS-6 |
| E-7 | 계정·필터가 바뀜(scope 변경) | 집계 새로 시작 | IS-2 |
| E-8 | 서버 노출 기록 저장 실패 | 추천 응답 정상, `impressions_saved: 0` | 수동 S-1 |
| E-9 | 구버전 앱이 `record_impressions` 호출 | 기존처럼 저장 | 기존 동작 |
| E-10 | 첫 요청 예산 | 1초·16·3·3 | SB-1 |
| E-11 | 이어 찾기 예산 | 4초·32·6·6 | SB-2 |
| E-12 | 집계 200건 초과 | 오래된 것부터 버림 | IS-3 |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 기존 테스트(특히 `recommendationFeed.test.ts`, `recommendationAddFlow.test.ts`, `recommendationTasteFill.test.ts`의 AB·U 행)는 고치지 않는다. 보존 테스트는 없다. 새 행은 구현 전에 모두 실패해야 한다.

### `src/utils/recommendationInvocationStats.test.ts` (신규)
| ID | 입력 | 기대 |
|----|------|------|
| IS-1 | 빈 로그에 scope A로 `initial`, `continuation`, `impressions` 기록 | `summarize` → `{ total: 3, byReason: { initial: 1, continuation: 1, impressions: 1 } }` |
| IS-2 | scope A 3건 뒤 scope B로 `initial` | scope B, 1건 |
| IS-3 | 같은 scope 205건 기록 | `entries.length === 200`, 가장 오래된 5건 없음 |
| IS-4 | scope A, `continuation` 6건 + `action_batch` 6건(모두 now−10s) | `canStart…(log, "A", now) === false` |
| IS-5 | IS-4와 같지만 모두 now−61s | `true` |
| IS-6 | scope A, `scroll_batch`·`refresh`·`resume` 20건(now−5s) | `true`(사용자 동작은 세지 않음) |
| IS-7 | 다른 scope 질의 | `true` |

### `src/utils/recommendationInvocationSimulation.test.ts` (신규 순수 시뮬레이션)
`simulateRecommendationBatch`(6.1)를 쓴다. 기존 `decideEmptyRecommendationContinuation`·`advanceRecommendationNoProgressStreak`와 `canStartAutomaticRecommendationInvocation`만으로 호출 수를 센다(타이머 없음, 호출 1회 = 1초 경과).
| ID | 입력 | 기대 |
|----|------|------|
| SIM-1 | `trigger: "initial"`, start 0, target 12, yields [12] | `calls: 1`, `finalVisible: 12`, `stoppedBy: "target"` |
| SIM-2 | `initial`, start 0, target 12, yields [4,4,4] | `calls: 3`, `finalVisible: 12`, `"target"` |
| SIM-3 | `scroll_batch`, start 5, target 12, yields [0,0,0,0] | `calls: 3`, `finalVisible: 5`, `"no_progress"` |
| SIM-4 | 같은 로그·scope로 `action_batch` 묶음 3번 연속(각 target = 그때 보이는 수 + 12, 호출마다 yield 1, 시작 시각 0초) | 1번째 6회(`"attempts"`), 2번째 6회(`"attempts"`), 3번째 0회(`"cap"`). 자동 호출 총 12회 |

### `supabase/functions/_shared/recommendationTasteFill.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| SB-1 | `recommendationScanBudget({ hasCursor: false })` | `{ scanMs: 1000, keywordLookups: 16, maxMonths: 3, maxRounds: 3, label: "first" }` |
| SB-2 | `({ hasCursor: true })` | `{ scanMs: 4000, keywordLookups: 32, maxMonths: 6, maxRounds: 6, label: "continuation" }` |

### 수동 확인 (배포 후, 사람)
| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081, 개발자 도구 | 추천 탭 진입 후 첫 12개까지 `recommendation invocations` 총계·이유별 수와 네트워크 요청 수를 기록. `impressions` 0 |
| M-2 | 웹 8081 | 스크롤 2묶음, 추가 1회 후 같은 기록. 묶음당 추천 호출 수와 목표 도달(예: 24/24) |
| M-3 | 웹 8081 | `recommendation response` 로그의 `diagnostics.scan_budget`이 첫 요청 `first`, 이후 `continuation`. `impressions_saved` > 0 |
| S-1 | 서버 로그(가능하면) | 노출 기록 저장 실패가 응답 실패로 이어지지 않음 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `src/utils/recommendationInvocationStats.ts` (신규) | 6.1 + `simulateRecommendationBatch` |
| `src/utils/recommendationInvocationStats.test.ts` (신규) | IS-1~IS-7 |
| `src/utils/recommendationInvocationSimulation.test.ts` (신규) | SIM-1~SIM-4 |
| `src/hooks/usePersonalizedRecommendations.ts` | 6.2 |
| `src/services/personalizedRecommendations.ts` | 6.3(필요한 경우만) |
| `supabase/functions/_shared/recommendationTasteFill.ts` | 6.4 |
| `supabase/functions/_shared/recommendationTasteFill.test.ts` | SB-1·SB-2 |
| `supabase/functions/personalized-recommendations/index.ts` | 6.5 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| 추가·완료 후 12개 묶음 규칙 | D-5(사용자 결정) |
| 첫 요청 속도·1초 탐색 | docs/52 |
| 서버 라이브러리 조회 캐시 | D-1 측정 후 판단 |
| 다른 Edge Function(검색·상세 등) 호출 비용 | 이번 대상은 추천 |
| 운영 로그 권한 | 사람 작업: Supabase 액세스 토큰에 `analytics_logs_read`를 주면 함수별 호출 수를 직접 볼 수 있다 |

## 13. 확실하지 않음
- 4초·32건·6·6이 실제로 이어 찾기 횟수를 얼마나 줄이는지는 실측 전이다. M-2와 `diagnostics`로 확인한다.
- Supabase Edge Function 과금은 호출 수 기준이다. 호출 시간·DB 조회량이 비용에 얼마나 반영되는지는 요금제에 따라 다르며 여기서 확인하지 않았다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 비용 관련 정정 작업이다.
- 추천 기능은 묶음(12개)마다 Edge Function을 최대 9회(추천 6 + 노출 기록 1~3) 부를 수 있다.
- 호출 수를 셀 방법도 없다.

먼저 호출을 셀 수 있게 하고(D-1), 확실한 낭비를 없앤다.
- 노출 기록을 추천 응답에 합친다(D-2).
- 이어 찾기 요청이 한 번에 더 채우게 한다(D-3).
- 자동 호출에 안전 상한을 둔다(D-4).

묶음 규칙(12개 목표, 추가·완료 후 다음 12개)은 사용자 결정이므로 유지한다(D-5).

| ID | 증상·위험 |
|----|-----------|
| C-1 | 호출 수 집계 없음 |
| C-2 | 노출 기록 별도 호출(12개마다 1~3회) |
| C-3 | 이어 찾기도 1초 탐색이라 호출 반복 |
| C-4 | 자동 호출 세션 상한 없음 |
| C-5 | 목표 미달로 개수가 들쑥날쑥 |

# READ FIRST
1. 이 명세서 1~13장. 호출 경로 표는 2.1, 서버 작업은 2.2, 결정은 D-1~D-6, 계약은 6장, 테스트는 10장이다.
2. `docs/47_recommendation_batch_topup_spec.md` 14·15장(유지할 사용자 결정), `docs/52_recommendation_first_batch_fill_spec.md`(첫 요청 예산·진단 값).
3. `AGENTS.md` — 테스트 규칙.
4. 고칠 파일과 위치:
   - `src/hooks/usePersonalizedRecommendations.ts`: 148~232행, 360~600행, 680~830행
   - `src/services/personalizedRecommendations.ts`: 113~240행
   - `supabase/functions/personalized-recommendations/index.ts`: 133~134행, 176~380행, 585~602행
   - `supabase/functions/_shared/recommendationTasteFill.ts`
   - `src/utils/recommendationFeed.ts`: 읽기만 한다. 판정 함수는 재사용한다

# 시작 상태 (반드시 유지)
- `git status`와 `npm test` 결과를 기록한다. 기존 실패 1개("uses latest-popular fallback ordering with an empty library")는 무관하다. 그 밖의 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 앱은 추천 문맥별·이유별 호출 수를 센다. 서버는 `diagnostics`에 개수 필드를 더한다. 제목·id·사용자 정보는 로그에 남기지 않는다.
- **D-2.** 서버는 `recommend` 응답 작품을 같은 요청에서 노출 기록으로 저장한다(실패해도 응답 성공). 앱은 `record_impressions`를 부르지 않는다. 서버의 `record_impressions` 동작은 남긴다.
- **D-3.** 이어 찾기(cursor 있음)만 4초·키워드 32·6개월·6바퀴다. 첫 요청은 1초·16·3·3 그대로다. 요청 마감 8.5초 등 다른 시간 규칙은 그대로다.
- **D-4.** 같은 문맥에서 자동 호출(`continuation`·`action_batch`)은 60초 12회까지다. 넘으면 기존 멈춤 상태로 둔다. 사용자 동작은 막지 않는다.
- **D-5.** 12개 목표, 추가·완료 후 다음 12개, 묶음당 6회·45초·무진전 3회, 10분 캐시는 바꾸지 않는다. 기존 `recommendationFeed.ts`·`recommendationAddFlow.ts` 판정 함수 본문을 바꾸지 않는다.
- **D-6.** 응답 계약은 `diagnostics` 선택 필드 추가뿐이다. DB 마이그레이션 없음.

# STEP 1 — 실패하는 테스트부터
- 10장 IS-1~IS-7, SIM-1~SIM-4, SB-1·SB-2를 추가한다.
- `npm test`로 새 테스트가 전부 실패(모듈·export 없음)하는지 확인한다. 하나라도 통과하면 멈추고 보고한다.

# STEP 2 — 순수 함수
6.1(+ `simulateRecommendationBatch`)과 6.4를 구현한다. 새 테스트가 통과해야 한다.

# STEP 3 — 서버
6.5대로 `personalized-recommendations/index.ts`를 고친다(예산, 집계, 노출 기록 합치기). 기존 응답 필드와 오류 처리는 그대로다.

# STEP 4 — 앱
- 6.2·6.3대로 훅·서비스를 고친다. 노출 기록 effect를 삭제하고, 이유별 기록과 자동 상한을 넣는다.
- 이 단계 전후로 기존 훅 관련 테스트가 모두 통과해야 한다.

# STEP 5 — 측정 보고 준비
- 로그인 없이 할 수 있는 범위에서 시뮬레이션 결과를 보고 항목 3번 표로 정리한다. 시나리오는 SIM-1~SIM-4와 "묶음당 최대 호출 수(변경 전 9 → 변경 후)"다.
- 실제 화면 측정(M-1~M-3)은 사람이 하도록 방법을 적는다. 로그인 대행은 금지다.

# 엣지 케이스
9장 E-1~E-12 전부.

# 검증 명령
```
npm test
npm run typecheck
npm run lint
npx --no-install esbuild supabase/functions/personalized-recommendations/index.ts --bundle=false --format=esm --log-level=warning > /dev/null
```
- `npm test`: 기준선 통과 개수 + 새 테스트 13개(IS 7, SIM 4, SB 2). 기존 실패 1개 외 실패는 0이어야 한다.
- esbuild는 오류 0이어야 한다.

# DEFINITION OF DONE
- [ ] 새 테스트 13개가 수정 전에 실패했고 수정 후 통과한다. 기존 테스트 diff가 없다
- [ ] 훅에 `recordPersonalizedRecommendationImpressions`·`recordImpressionsWithRetry` 호출이 없다
- [ ] 서버 `recommend` 응답이 노출 기록을 저장하고, 실패해도 응답이 성공한다
- [ ] 이어 찾기 요청만 D-3 예산을 쓰고, `diagnostics`에 D-1 필드가 있다
- [ ] 자동 호출 상한이 이어 찾기·추가 후 묶음에만 적용된다
- [ ] `recommendationFeed.ts`·`recommendationAddFlow.ts` 본문 diff가 없다
- [ ] `typecheck`·`lint`·esbuild 통과

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/recommendationInvocationStats.ts
src/utils/recommendationInvocationStats.test.ts
src/utils/recommendationInvocationSimulation.test.ts
src/hooks/usePersonalizedRecommendations.ts
src/services/personalizedRecommendations.ts
supabase/functions/_shared/recommendationTasteFill.ts
supabase/functions/_shared/recommendationTasteFill.test.ts
supabase/functions/personalized-recommendations/index.ts
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력(요약)
2. `npm test` before / after 통과 개수, `typecheck`·`lint`·esbuild 결과
3. 호출 수 표: 시나리오별(첫 12개, 스크롤 1묶음, 추가 1회 후 묶음) 변경 전 최대 → 변경 후 최대(추천·노출 기록 구분). 시뮬레이션 기준임을 표시한다
4. 추가한 테스트 ID와 이름
5. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
6. 사람이 할 후속 작업:
   - `personalized-recommendations` 재배포(서버를 먼저 배포해도, 앱을 먼저 바꿔도 동작한다)
   - 배포 후 M-1~M-3 측정
   - (선택) 액세스 토큰에 `analytics_logs_read`를 줘 운영 호출 수 확인

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 묶음 목표·추가 후 묶음 규칙을 바꾸지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
- 로그에 작품 제목·id·사용자 정보·키를 남기지 않는다. 로그인 대행 금지.
