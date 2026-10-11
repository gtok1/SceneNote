# 52. 검색 추천 첫 화면 — 한 번에 채우기와 채우는 동안의 표시

작성일: 2026-10-10
대상 브랜치 기준: `main` (`c6a0e7e`) + 미커밋 작업(`docs/48`~`51` 구현). 이 시점 `npm test` 1058개 중 1057개 통과 — 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함
선행 문서: `docs/41`(취향 보충 레인), `docs/45`(연도·적용 조건), `docs/47`(묶음 목표·자동 이어 찾기), `docs/00_ui_style_rules.md`(UI-6.4 상태 표시)

> **근거.** 사용자 캡처(웹, "애니, 드라마 · 모든 장르 · 일본, 한국 · 2026년", 제외 설정 3개).
> 사용자 요청: "검색 화면에서 12개씩 나와야 하는데 2개가 처음 나오고 딜레이가 생겨서 다른 작품들이 나오고 있어."

---

## 1. 문제 정의

| ID | 증상 |
|----|------|
| F-1 | 첫 응답에서 카드가 2개만 보이고, 나머지는 몇 초 간격으로 붙는다 |
| F-2 | 채우는 동안 화면에는 "다음 추천 12개를 불러오는 중이에요."만 보여, 빈자리가 얼마나 남았는지 알 수 없다 |

## 2. 원인 (실측·코드)

**로컬 실측.** 운영과 같은 서버 흐름(목록 탐색 1초·키워드 16회·3개월 + 취향 보충)을 실제 TMDB·AniList로 돌렸다. 조건은 캡처와 같고, 제외 테마는 3개로 가정했다.

| 조건 | 첫 요청 결과 |
|------|--------------|
| 빈 라이브러리 | 12개(목록 6 + 취향 보충 6), 1.5초. 키워드 확인을 미룬 후보 29개 |
| 앞선 48개를 라이브러리로 제외 | 12개(목록 1 + 취향 보충 11), 0.5초 |

- 로컬에서는 **취향 보충이 첫 응답을 채운다.** 운영에서 2개가 오는 상황은 로컬에서 재현되지 않는다.
- **코드상 운영과 다른 점**(`supabase/functions/personalized-recommendations/index.ts`)
  - 시간 제한(8.5초)은 요청을 받은 순간부터 잰다(133행).
  - 그 안에서 순서대로 진행한다: 인증 → 라이브러리·피드백 조회(176행) → **최근 노출 조회를 따로 기다림**(200행) → 목록 탐색(1초 + 키워드 확인, 캐시 읽기·쓰기는 DB 왕복) → **남은 시간이 2.5초 이상일 때만 취향 보충**(293행 `shouldRunTasteFill`) → 국내 OTT 정보 붙이기.
  - 라이브러리 560개 조회와 DB 캐시 왕복에 시간이 쓰여 남은 시간이 2.5초 미만이면, **취향 보충을 건너뛰고 목록 탐색 결과(예: 2개)만 보낸다.**
  - 그러면 앱이 자동 이어 찾기(`docs/47`)로 요청을 더 보내 채운다. 요청마다 같은 준비 과정을 반복해 몇 초씩 걸린다(F-1).
- **화면**(`app/search.tsx`)
  - 첫 카드가 1개라도 있으면 상단 로딩 배너·스켈레톤이 사라진다(`recommendationIsContinuing`은 0개일 때만).
  - 목록 끝에는 묶음 로딩 문구만 뜬다(1117~1123행). 그래서 빈자리를 채우는 중인지 알 수 없다(F-2).
- **확실하지 않음**: 운영에서 단계별로 실제 몇 초가 걸리는지는 로그인한 세션 없이 측정하지 못했다. D-3 진단 값으로 재배포 후 확인한다.

## 3. 설계 결정

### D-1. 준비 단계 조회를 한 번에 기다린다
최근 노출 조회(`loadRecentSeenIdentityKeys`)를 라이브러리·피드백 조회와 같은 `Promise.all`에 넣는다. 결과와 오류 처리는 지금과 같다(최근 노출 실패는 경고 후 빈 목록).

### D-2. 취향 보충 페이지를 목록 탐색과 동시에 미리 받는다
- 준비가 끝나면(프로필·필터·커서를 안 뒤) 대기 중인 취향 레인 쿼리를 만든다.
- 남은 시간이 2.5초(`TASTE_FILL_MIN_REMAINING_MS`) 이상이고 대기 레인이 있으면, `fetchTasteFillPage` 요청을 **목록 탐색 시작 전에 띄운다.** 기다리지 않고 함께 진행한다.
- 목록 탐색이 끝난 뒤 `planTasteFill` 결과에 따라 다음 중 하나를 한다.
  - `use_prefetch`: 미리 받은 결과를 기다려 지금의 보충 처리(조건 필터 → 키워드 확인 → 순위 → 선택)를 그대로 한다. 남은 시간 2.5초 재검사는 하지 않는다. 네트워크 단계는 이미 진행됐고, 키워드 확인은 기존처럼 마감 시각 안에서만 한다.
  - `fetch_now`: 미리 받지 않았고 시간이 남았다. 지금처럼 받아서 처리한다.
  - `skip`: 보충하지 않는다.
- **목록 탐색이 이미 12개를 채웠으면, 미리 받은 결과는 쓰지 않고 취향 커서도 바꾸지 않는다.** 다음 요청이 같은 페이지를 캐시에서 다시 읽는다.
- 미리 받은 요청이 실패하면 그 레인은 이번 요청에서 건너뛴다(지금 `allSettled`와 같다).

### D-3. 응답에 진단 값을 넣는다(개수·시간만)
```ts
diagnostics: {
  setup_ms: number;          // 요청 수신 ~ 준비 완료
  catalog_ms: number;        // 목록 탐색
  taste_fill_ms: number;     // 보충 처리(미리 받기 대기 포함)
  total_ms: number;          // 응답 직전까지
  catalog_items: number;
  taste_fill_items: number;
  taste_fill: "full" | "no_queries" | "prefetched" | "fetched" | "time";
  keyword_lookups_left: number;
}
```
- 사용자 정보·제목·id는 넣지 않는다. 앱은 `__DEV__`에서 기존 `recommendation response` 로그에 함께 남긴다.
- 운영에서 첫 응답이 짧을 때 어느 단계가 원인인지 이것으로 확정한다.

### D-4. 채우는 동안 빈자리를 보여 준다
- 보이는 카드가 1개 이상이고 묶음 목표(`docs/47`의 `visibleTarget`)보다 적으며, 자동 이어 찾기가 진행 중(`continue`·`loading`)인 동안 다음을 한다.
  - 목록 끝에 **남은 자리만큼(최대 12) 추천 카드 스켈레톤**을 둔다. 갤러리는 열 수에 맞춘다.
  - 안내 한 줄 "추천을 더 찾고 있어요 · {보이는 수}/{목표}"를 둔다(`accessibilityLiveRegion="polite"`).
- 이 동안에는 기존 "다음 추천 12개를 불러오는 중이에요." 문구를 대신한다. 이어 찾기가 멈추거나(`stopped`) 목표에 닿으면(`idle`) 사라진다.
- 0개일 때는 지금처럼 상단 로딩 배너·스켈레톤을 쓴다(바꾸지 않음).

### D-5. 바꾸지 않는 것
- 목록 탐색 예산(1초·키워드 16회·3개월·3라운드)
- 자동 이어 찾기 한도(6회·45초·진전 없음 3회)
- 묶음 목표 규칙(`docs/47`)
- 제외·표시 가능 판정
- 응답의 기존 필드

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 4. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 목록 탐색 예산을 1초 → 4초 | 로컬 실측에서 첫 응답을 채운 것은 취향 보충이었다. 탐색을 늘리면 보충 시간이 더 줄어 역효과일 수 있다 |
| `TASTE_FILL_MIN_REMAINING_MS`만 낮추기 | 보충의 네트워크 요청이 마감 직전에 시작돼 잘린다. 미리 받는 편이 시간 전체를 쓴다 |
| 12개가 모일 때까지 첫 화면을 안 보여 줌 | 최악의 경우 수십 초 빈 화면이다. 먼저 보여 주고 빈자리를 표시하는 편이 낫다 |
| 앱이 이어 찾기 요청을 동시에 여러 개 | 커서가 순서대로라 병렬로 할 수 없다 |

## 5. 계약

### 5.1 `supabase/functions/_shared/recommendationTasteFill.ts` (추가, 순수)
```ts
export function shouldPrefetchTasteFill(input: { remainingMs: number; pendingQueryCount: number }): boolean;
// pendingQueryCount > 0 && remainingMs >= TASTE_FILL_MIN_REMAINING_MS

export type TasteFillAction = "skip" | "use_prefetch" | "fetch_now";
export type TasteFillReason = "full" | "no_queries" | "prefetched" | "fetched" | "time";
export function planTasteFill(input: {
  itemCount: number; limit: number; remainingMs: number; pendingQueryCount: number; prefetched: boolean;
}): { action: TasteFillAction; reason: TasteFillReason };
```
`planTasteFill` 판정 순서:
1. `itemCount >= limit` → `{ "skip", "full" }`
2. `pendingQueryCount === 0` → `{ "skip", "no_queries" }`
3. `prefetched` → `{ "use_prefetch", "prefetched" }`
4. `remainingMs >= TASTE_FILL_MIN_REMAINING_MS` → `{ "fetch_now", "fetched" }`
5. 그 외 → `{ "skip", "time" }`

기존 `shouldRunTasteFill`은 남겨 둔다(다른 곳에서 쓰지 않게 되면 그대로 두고 보고만 한다).

### 5.2 `supabase/functions/personalized-recommendations/index.ts`
1. **준비 조회(D-1)**: 176행 `Promise.all`에 `loadRecentSeenIdentityKeys(userClient, user.id)`를 세 번째로 넣고, 200행의 따로 기다리기를 지운다. `setupDoneAt = Date.now()`.
2. **미리 받기(D-2)**: `profile`·`cursorState` 계산 뒤(목록 탐색 직전)
   - `queries = deriveTasteFillQueries(...)`, `pending = queries.filter(q => !taste[q.key]?.done)`
   - `prefetched = shouldPrefetchTasteFill({ remainingMs: requestDeadline - Date.now(), pendingQueryCount: pending.length })`
   - 참이면 `prefetchPromise = Promise.allSettled(pending.map(q => fetchTasteFillPage(q, taste[q.key]?.page ?? 1, { ... })))`를 **await 없이** 시작한다. `asOfDate`는 지금 계산식 그대로다.
   - 목록 탐색 뒤 미리 받기를 쓰지 않는 경우를 위해 `prefetchPromise.catch(() => {})`로 처리되지 않은 거절을 막는다.
3. **목록 탐색 뒤**: `plan = planTasteFill({ itemCount: result.items.length, limit, remainingMs: requestDeadline - Date.now(), pendingQueryCount: pending.length, prefetched })`.
   - `use_prefetch`: `pages = await prefetchPromise`
   - `fetch_now`: 지금처럼 `pages = await Promise.allSettled(...)`
   - 두 경우 모두 그 뒤(커서 갱신 `taste[key] = ...`, 조건 필터, 키워드 확인, 순위, 선택)는 **지금 코드 그대로**다.
   - `skip`이면 보충하지 않고 `taste`를 바꾸지 않는다.
4. **진단(D-3)**: 응답 `json({...})`에 `diagnostics`를 더한다. `taste_fill`은 `plan.reason`이다. 기존 필드·순서는 그대로다. `RECOMMENDATION_DEBUG` 로그에도 같은 값을 넣는다.

### 5.3 앱
| 파일 | 변경 |
|------|------|
| `src/services/personalizedRecommendations.ts` | `PersonalizedRecommendationsApiResponse`에 `diagnostics?: unknown`. 232행 `__DEV__` `recommendation response` 로그 객체에 `diagnostics: data.diagnostics ?? null`을 더한다(개수·시간뿐이라 그대로 기록) |
| `src/utils/recommendationFeed.ts` | `recommendationTopUpStatus` 추가(아래) |
| `src/hooks/usePersonalizedRecommendations.ts` | 반환값에 `continuationDecision: emptyContinuationDecision`을 더한다 |
| `app/search.tsx` | 추천 피드 `ListFooterComponent`(1114행~)에서 `topUp.active`면 스켈레톤 + 안내 줄을 렌더하고, 기존 `isLoadingMore` 문구 분기보다 앞에 둔다 |

```ts
// src/utils/recommendationFeed.ts
export function recommendationTopUpStatus(input: {
  visibleCount: number;
  targetCount: number;
  decision: EmptyRecommendationContinuationDecision;
}): { active: boolean; placeholderCount: number; text: string | null };
```
- `active = visibleCount > 0 && visibleCount < targetCount && (decision === "continue" || decision === "loading")`
- `placeholderCount = active ? Math.min(PERSONALIZED_RECOMMENDATION_BATCH_SIZE, targetCount - visibleCount) : 0`
- `text = active ? `추천을 더 찾고 있어요 · ${visibleCount}/${targetCount}` : null`
- 숫자는 0 이상 정수로 내림하고, 잘못된 값은 0으로 본다.

화면에서는 아래처럼 쓴다.
```ts
const topUp = recommendationTopUpStatus({
  visibleCount: personalizedRecommendations.visibleCount,
  targetCount: personalizedRecommendations.visibleTarget,
  decision: personalizedRecommendations.continuationDecision
});
```
- 스켈레톤: `LoadingSkeleton variant="recommendation-card" count={topUp.placeholderCount} columns={displayedAsGallery ? galleryColumns : 1}`
- 안내 줄: 기존 `loadMoreFooter`·`loadMoreText` 스타일 재사용

## 6. 엣지 케이스

| # | 상황 | 기대 동작 | 연결 |
|---|------|----------|------|
| E-1 | 목록 탐색 2개, 시간 부족 | 미리 받은 보충으로 첫 응답이 채워진다 | TF-2, M-1 |
| E-2 | 목록 탐색이 12개를 채움 | 미리 받은 결과 미사용, 취향 커서 그대로 | TF-2, M-1 |
| E-3 | 대기 레인 없음(모두 done) | 미리 받기 없음, `no_queries` | TF-1·TF-2 |
| E-4 | 준비 후 남은 시간 2.5초 미만 | 미리 받기 없음, 목록 뒤 `time` 또는 `full` | TF-1·TF-2 |
| E-5 | 미리 받은 요청 일부 실패 | 그 레인만 건너뜀, 응답 정상 | M-1 |
| E-6 | 첫 화면 2/12, 이어 찾기 진행 | 카드 2개 + 스켈레톤 10개 + "추천을 더 찾고 있어요 · 2/12" | U-1, M-2 |
| E-7 | 이어 찾기 요청 사이 | `loading`도 활성이라 깜빡이지 않음 | U-2 |
| E-8 | 한도로 멈춤 | 스켈레톤 사라지고 기존 멈춤 안내 | U-3 |
| E-9 | 0개 | 기존 상단 배너·스켈레톤 | U-4 |
| E-10 | 스크롤 묶음 17/24 | 스켈레톤 7개 + "17/24" | U-6 |
| E-11 | 목표 30, 보이는 2 | 스켈레톤 12개(상한) | U-7 |
| E-12 | 운영 미배포 | 앱 스켈레톤·안내는 바로 적용, 서버 개선은 재배포 후 | M-2 |

## 7. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다. 한 행 = `it` 하나.** 모든 행은 구현 전에 실패해야 한다(신규 export).

### `supabase/functions/_shared/recommendationTasteFill.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| TF-1 | `shouldPrefetchTasteFill({ remainingMs: 6000, pendingQueryCount: 2 })` / `({ 2400, 2 })` / `({ 6000, 0 })` / `({ 2500, 1 })` | `true` / `false` / `false` / `true` |
| TF-2 | `planTasteFill`: `{ itemCount: 12, limit: 12, remainingMs: 9000, pendingQueryCount: 2, prefetched: true }` / `{ 2, 12, 1000, 0, false }` / `{ 2, 12, 1000, 2, true }` / `{ 2, 12, 3000, 2, false }` / `{ 2, 12, 1000, 2, false }` | `{skip,full}` / `{skip,no_queries}` / `{use_prefetch,prefetched}` / `{fetch_now,fetched}` / `{skip,time}` |

### `src/utils/recommendationFeed.test.ts` (추가)
| ID | 입력 `(visibleCount, targetCount, decision)` | 기대 |
|----|------|------|
| U-1 | `(2, 12, "continue")` | `{ active: true, placeholderCount: 10, text: "추천을 더 찾고 있어요 · 2/12" }` |
| U-2 | `(2, 12, "loading")` | `active true`, `placeholderCount 10` |
| U-3 | `(2, 12, "stopped")` / `(2, 12, "idle")` | 둘 다 `{ active: false, placeholderCount: 0, text: null }` |
| U-4 | `(0, 12, "continue")` | `active false` |
| U-5 | `(12, 12, "continue")` | `active false` |
| U-6 | `(17, 24, "continue")` | `placeholderCount 7`, `text "추천을 더 찾고 있어요 · 17/24"` |
| U-7 | `(2, 30, "continue")` / `(NaN, 12, "continue")` | `placeholderCount 12` / `active false` |

### 수동 확인

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹(재배포 후, 로그인) | 캡처 조건으로 "새 추천 12개" → 첫 응답 개수. 개발자 도구 콘솔 `recommendation response`의 `diagnostics`(setup·catalog·taste 시간, `taste_fill` 이유)를 3회 보고 |
| M-2 | 웹 1440(갤러리)·375 | 이어 찾기 중 스켈레톤·안내 줄, 다 채우면 사라짐, 레이아웃 튐 없음. 재배포 전에도 동작 |
| M-3 | 앱(iOS) | M-2와 같음, 글자 1.3배에서 안내 줄 잘림 없음 |

## 8. 변경 파일

| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/recommendationTasteFill.ts`(+test) | 5.1, TF-1·TF-2 |
| `supabase/functions/personalized-recommendations/index.ts` | 5.2 |
| `src/services/personalizedRecommendations.ts` | 5.3 |
| `src/utils/recommendationFeed.ts`(+test) | 5.3, U-1~U-7 |
| `src/hooks/usePersonalizedRecommendations.ts` | 5.3 |
| `app/search.tsx` | 5.3 |

## 9. 범위 밖
| 항목 | 이유 |
|------|------|
| 목록 탐색 예산·키워드 조회 한도 변경 | D-5. 진단 값으로 근거가 생기면 별도 |
| 라이브러리 조회 쿼리 경량화 | 진단 값(`setup_ms`)으로 판단 후 별도 |
| 국내 OTT 정보 붙이기 시간 | 같음 |
| 자동 이어 찾기 한도 | `docs/47` 그대로 |

## 10. 확실하지 않음
1. 운영에서 첫 응답이 짧은 정확한 단계. 로컬에서는 재현되지 않았다. 재배포 후 M-1의 `diagnostics`로 확인하고, 미리 받기로도 부족하면 그 수치를 근거로 다음 정정을 한다.
2. 미리 받기로 늘어나는 TMDB 요청은 요청당 최대 3건이다. 같은 페이지는 영구 캐시(`taste-fill-v2`)로 재사용되므로 영향이 작다고 판단한다.
