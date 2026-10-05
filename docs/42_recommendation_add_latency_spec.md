# 42. 검색 추천 "추가" 지연 개선 명세

작성일: 2026-10-03
대상 브랜치 기준: `main` (`6734575`) + 미커밋 `docs/41` 구현·보러가기 링크 작업. 이 시점 `npm test` 866개 중 865개 통과 — 실패 1개는 무관한 기존 결함
선행 문서: **`docs/00_ui_style_rules.md`**, `docs/22`(추천 탭), `docs/28`·`docs/30`(커서·12개 목표·자동 보충), `docs/41`(취향 보충), `docs/35`(배포 불일치)

> 사용자 요청: "검색 추천 목록에서 추가 시 너무 딜레이가 걸린다. 개선하는 구현 명세서."

---

## 1. 문제 정의

추천 카드 "추가"를 누르면 카드는 바로 사라지지만(`removeOptimistically`), 그 뒤가 느리다.

| ID | 증상 | 원인 |
|----|------|------|
| L-1 | 한 작품을 추가하면 **다른 모든 추천의 "추가" 버튼이 몇 초간 막힌다**. 여러 개를 연달아 담을 수 없다 | `getRecommendationAddState`의 비활성 조건에 `pendingAddIds.size > 0 \|\| pendingSearchKey !== null \|\| isRefreshing \|\| isRefilling \|\| isLoadingMore`(`app/search.tsx:480~486`). 잠금이 서버 추가 + 새 추천 보충이 **둘 다** 끝나야 풀린다 |
| L-2 | "추가했어요" 토스트가 늦게 뜬다 | 토스트를 `refill()` 결과 뒤에 띄운다(`search.tsx:422~437`). `refill`은 빈자리 1개를 채우려고 `personalized-recommendations` 전체 탐색을 다시 한다(`limit: 1`, 서버 예산 최대 8.5초, 앱 마감 12초) |
| L-3 | 연달아 추가하면 일부 빈자리가 채워지지 않고 "새 추천은 다시 시도해 주세요"가 뜬다 | `refill`이 진행 중이면 다음 호출은 즉시 `"failed"`(`usePersonalizedRecommendations.ts:329~339`). 대기열이 없다 |
| L-4 | 추가할 때마다 라이브러리 전체를 다시 받는다 | `useAddToLibrary.onSuccess`가 `library.all`을 무효화해 활성 쿼리를 즉시 재조회(`src/hooks/useLibrary.ts:95~99`). 라이브러리 560개 + 콘텐츠·장르·시즌 조인 |
| L-5 | 서버 추가 자체가 1~3초 | `add-to-library`가 모든 단계를 **순서대로** 기다린다: 외부 상세(`fetchContentDetail`) → 콘텐츠 upsert → 장르 2회 → 테마 → 외부 ID → 시즌 → **첫 시즌 회차 외부 조회 + upsert**(`prefetchFirstSeasonEpisodes`) → 라이브러리 insert → 로그. 새 작품 기준 DB 왕복 약 10회 + 외부 호출 2회가 직렬 |
| L-6 | 이미 DB에 있는 작품도 매번 외부 API부터 다시 받는다 | 외부 ID가 있고 내 라이브러리에 없으면 그대로 `fetchContentDetail`·전체 upsert 경로로 간다(`add-to-library/index.ts:101~131`) |
| L-7 | 운영 서버가 오래됐다 | `add-to-library` 운영 v19(2026-09-06), 코드 변경 2026-09-27(`npm run edge:drift`) |

## 2. 실측 (2026-10-03, 로컬에서 서버와 같은 함수로 TMDB·AniList 읽기 전용)

| 호출 | 시간 |
|------|------|
| `fetchContentDetail` TMDB 드라마(재벌X형사·스위트홈) | 557ms · 223ms |
| `fetchContentDetail` TMDB 영화(기생충) | 246ms |
| `fetchContentDetail` AniList(진격의 거인, 한국어 현지화 조회 포함) | 991ms |
| `fetchEpisodesForSeason` 첫 시즌 | 221~229ms |

외부 호출만 0.4~1.2초다. 여기에 직렬 DB 왕복·콜드 스타트, 그리고 **앱이 기다리는 보충 요청(전체 추천 탐색)**이 더해져 체감 지연이 수 초가 된다. 로그인 계정의 운영 서버 시간은 측정하지 못했다(12장).

## 3. 목표 동작

1. 추가를 누르면 카드가 즉시 사라지고, 서버 추가가 끝나는 대로 "라이브러리에 추가했어요." 토스트(보충을 기다리지 않음).
2. **다른 추천 카드는 계속 누를 수 있다.** 눌린 카드만 "추가 중".
3. 연달아 여러 개를 추가하면, 마지막 추가 후 0.8초가 지나면 **한 번의 요청으로** 빈자리 수만큼 새 추천을 받아 **목록 끝에** 붙인다.
4. 라이브러리 재조회는 연속 추가가 끝난 뒤 1.5초에 한 번.
5. 서버는 이미 DB에 있는 작품이면 외부 조회 없이 바로 라이브러리에 넣고, 새 작품이어도 꼭 필요한 저장만 기다린 뒤 응답한다(회차 미리 받기·로그는 응답 뒤).

## 4. 설계 결정

### D-1 (최우선). 데이터 결과는 지금과 같다
추가 후 DB에 남는 행(콘텐츠·장르·테마·외부 ID·시즌·라이브러리 항목)과 상태·본 횟수 초기값(`completed`면 1)은 지금과 같다. 첫 시즌 회차 미리 받기와 동기화 로그도 **계속 수행**하되 응답 뒤로 미룬다(D-6). 추천 피드의 표시 가능 판정·제외·12개 목표(`docs/30` D-1·D-2)는 그대로다.

### D-2. 잠금은 카드 단위
추천 카드의 "추가" 비활성 조건은 `그 카드가 추가 중 \|\| 이미 추가됨 \|\| 피드 새로고침 중(isRefreshing)`만. 새로고침은 피드를 통째로 바꾸므로 그동안만 막는다. 판정은 순수 함수 `isRecommendationAddDisabled`.

### D-3. 토스트는 서버 추가 결과만 기다린다
성공 즉시 `라이브러리에 추가했어요.`(success). 실패 시 카드 복원(`restore`) + `라이브러리에 추가하지 못했어요. 잠시 후 다시 시도해 주세요.`(error, 서버 원문 미노출 — UI-6.3). 보충 결과로 토스트를 띄우지 않는다.

### D-4. 보충은 모아서 한 번에, 목록 끝에
- 훅에 `scheduleRefill()`을 추가한다. 호출될 때마다 0.8초 trailing 디바운스. 발화 시 새로고침·더 불러오기·다른 보충이 진행 중이면 끝난 뒤 다시 예약한다(버리지 않는다).
- 요청 `limit = computeRefillLimit(현재 표시 가능 개수, 12)`(0이면 요청 안 함). 받은 항목은 기존 `appendRecommendationFeed`로 **목록 끝에** 붙인다(사용자가 방금 누른 자리에 새 카드가 나타나 잘못 누르는 일을 막는다).
- 커서·제외 ID 전달, 세션 본 ID 기록, 마감 처리는 기존 `refill`과 같은 방식. 실패하면 조용히 넘어가고(기존 `refillError` 표시는 그대로) 다음 스크롤 보충이 이어받는다.
- 기존 `refill(removed)`은 남겨 두되 검색 화면은 더 이상 쓰지 않는다(삭제는 범위 밖).

### D-5. 라이브러리 재조회는 디바운스(검색 화면에서만)
`useAddToLibrary(options?: { libraryRefresh?: "immediate" | "debounced" })`. 기본 `"immediate"`(지금 동작 — 작품 상세·인물 상세·사진 가져오기·인기 추천은 그대로). 검색 화면만 `"debounced"`: 성공 시 사용자별 1.5초 trailing 디바운스 후 `invalidateQueries({ queryKey: queryKeys.library.all(userId) })` 한 번. 그사이 중복 추가 방지는 기존 `addedRecommendationKeys`·`addedSearchKeys`가 맡는다.

### D-6. 서버: 빠른 경로 + 병렬 저장 + 응답 뒤 작업
1. **이미 있는 작품**(`content_external_ids` 있음, 내 라이브러리에 없음): 외부 조회·메타 upsert 없이 바로 `user_library_items` insert → 응답. 성공 로그는 응답 뒤.
2. **새 작품**: 외부 상세 → 콘텐츠 upsert → **장르·테마·외부 ID·시즌 upsert를 병렬**(`Promise.all`) → 외부 ID 오류면 지금처럼 500 → 라이브러리 insert → 응답. 첫 시즌 회차 미리 받기와 성공 로그는 응답 뒤.
3. 응답 뒤 작업은 `runAfterResponse(task)`: `EdgeRuntime.waitUntil`이 있으면 거기에 넘기고, 없으면 지금처럼 기다린다(로컬·테스트 호환). 응답 뒤 작업의 실패는 기존 `logSync(..., "partial")`로 남기고 응답에 영향 없음.
4. 판정은 순수 함수 `planAddToLibraryPath`.

### D-7. 배포
`add-to-library`와 `personalized-recommendations`(`docs/41` 포함)는 사람이 재배포한다. 앱 변경(D-2~D-5)은 배포 없이 적용된다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 서버 추가를 기다리지 않고 바로 "추가했어요" | 실패하면 거짓 안내가 된다. 카드 즉시 제거로 이미 체감 반응은 있다 |
| 보충을 아예 하지 않기 | `docs/30` D-1의 12개 목표가 깨진다. 모아서 한 번에가 요청 수도 적다 |
| 빈자리에 바로 새 카드 끼워 넣기(현재 방식) | 연타 시 방금 누른 위치에 다른 작품이 나타나 잘못 추가할 수 있다 |
| 라이브러리 재조회를 모든 화면에서 디바운스 | 작품 상세는 추가 직후 라이브러리 항목을 바로 찾아야 한다(`resolveContentLibraryItem`). 검색 화면에만 적용 |
| 라이브러리 캐시에 새 항목을 직접 끼워 넣기 | `LibraryListItem` 필드가 많아(진행·시즌 등) 서버와 어긋난 가짜 행이 생길 위험. 디바운스 재조회로 충분 |
| 회차 미리 받기 제거 | 회차 화면 첫 진입이 느려진다. 응답 뒤로 미루면 둘 다 얻는다 |

## 6. 계약

### 6.1 `src/utils/recommendationAddFlow.ts` (신규, 순수)

```ts
export const RECOMMENDATION_REFILL_DEBOUNCE_MS = 800;
export const LIBRARY_REFRESH_DEBOUNCE_MS = 1_500;
export const RECOMMENDATION_TARGET_COUNT = 12;
export const RECOMMENDATION_ADDED_TOAST = "라이브러리에 추가했어요.";
export const RECOMMENDATION_ADD_FAILED_TOAST = "라이브러리에 추가하지 못했어요. 잠시 후 다시 시도해 주세요.";

export interface TimerApi { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void }
export function createTrailingScheduler(delayMs: number, timers: TimerApi): { schedule: (run: () => void) => void; cancel: () => void; isPending: () => boolean };
// schedule: 이전 예약을 지우고 새로 예약(마지막 run만 delayMs 뒤 1회 실행). cancel: 예약 취소. isPending: 예약 중 여부(실행되면 false)

export function computeRefillLimit(visibleCount: number, target?: number): number;
// target 기본 12. visible = Number.isFinite(visibleCount) && visibleCount > 0 ? Math.floor(visibleCount) : 0
// 결과 = Math.max(0, Math.min(target, target - visible))

export function isRecommendationAddDisabled(input: { isPending: boolean; isAdded: boolean; isRefreshing: boolean }): boolean;
// isPending || isAdded || isRefreshing
```

### 6.2 `src/hooks/useLibrary.ts`

```ts
export function useAddToLibrary(options?: { libraryRefresh?: "immediate" | "debounced" }): UseMutationResult<…>;
// "immediate"(기본): 지금과 같음
// "debounced": onSuccess에서 사용자 id별 모듈 수준 createTrailingScheduler(LIBRARY_REFRESH_DEBOUNCE_MS, setTimeout/clearTimeout)로 invalidateQueries 1회
```

### 6.3 `src/hooks/usePersonalizedRecommendations.ts`

반환값에 `scheduleRefill: () => void` 추가.
- 내부 `createTrailingScheduler(RECOMMENDATION_REFILL_DEBOUNCE_MS, …)`.
- 발화 시: `!isCurrent() || !user`면 무시. 새로고침·더 불러오기·보충 진행 중이면 `scheduleRefill()`을 다시 호출하고 끝(대기 후 재시도).
- 현재 캐시에서 표시 가능 개수 = `filterVisibleRecommendationCandidates(current.items, libraryItems, exclusions, discoveryFilters).length`, `limit = computeRefillLimit(그 값)`. 0이거나 `getRecommendationRetryAction(current) === "complete"`면 요청 안 함.
- 요청은 기존 `refill`과 같은 구성(`createRequest`, `cursor: current.next_cursor`, `excludeIds: collectRecommendationSessionSeenIds(current.items)`, `limit`, 마감 `runWithDeadline(…, MUTATION_LOADING_DEADLINE_MS)`), 결과는 `appendRecommendationFeed`로 끝에 붙이고 `next_cursor`·`has_more`·`is_exhausted`·`broadened`·`partial`·`filter_limited`·`failed_sources` 병합(기존 `refill`의 "replacement 없음" 분기와 같은 병합 규칙). 세션 본 ID 기록.
- 진행 중 표시는 기존 `isRefilling` 그대로 쓴다(같은 `refillMutation` 재사용 가능).
- 언마운트·필터 변경(`isCurrent`)·새로고침 시 예약 취소.

### 6.4 `app/search.tsx`

- `const addToLibrary = useAddToLibrary({ libraryRefresh: "debounced" });`
- `addRecommendationResult`: 기존 중복 확인·`removeOptimistically`·`pendingAddIds` 그대로. `onSuccess`: `setAddedRecommendationKeys(…)`, `addToast(RECOMMENDATION_ADDED_TOAST, "success")`, `personalizedRecommendations.scheduleRefill()`. `onError`: `restore(removed)` + `addToast(RECOMMENDATION_ADD_FAILED_TOAST, "error")`. `refill(removed)` 호출과 그 토스트 분기는 삭제.
- `getRecommendationAddState.disabled` = `isRecommendationAddDisabled({ isPending, isAdded, isRefreshing: personalizedRecommendations.isRefreshing })`. 라벨 규칙(`추가 중`·`추가됨`·`추가`)은 그대로.
- 검색 결과(`addResult`·`getSearchAddState`)는 바꾸지 않는다(12장).

### 6.5 `supabase/functions/_shared/addToLibraryFlow.ts` (신규, 순수)

```ts
export type AddToLibraryPath = "already_exists" | "fast_insert" | "fetch_and_insert";
export function planAddToLibraryPath(input: { existingContentId: string | null; existingLibraryItemId: string | null }): AddToLibraryPath;
// existingContentId && existingLibraryItemId → already_exists / existingContentId → fast_insert / 그 외 fetch_and_insert

export interface EdgeRuntimeLike { waitUntil?: (promise: Promise<unknown>) => void }
export async function runAfterResponse(task: () => Promise<void>, runtime: EdgeRuntimeLike | undefined): Promise<void>;
// runtime?.waitUntil이 함수면 waitUntil(task().catch(() => undefined))를 호출하고 즉시 반환(기다리지 않음)
// 아니면 await task() (오류는 삼키지 않고 호출자에게) — 호출자는 지금처럼 try/catch로 감싼 작업만 넘긴다
```

### 6.6 `supabase/functions/add-to-library/index.ts`

- `const runtime = (globalThis as { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime;`
- 기존 존재 확인 직후 `planAddToLibraryPath`로 분기.
  - `already_exists`: 지금 응답 그대로.
  - `fast_insert`: 기존 라이브러리 insert 블록(23505 → 409 처리 포함)을 함수로 빼서 `contentId = existingContentId`로 호출 → 응답 `{ library_item_id, content_id, status, statuses, watch_count }`(지금 성공 응답과 같은 형태) → 성공 `logSync`는 `runAfterResponse`.
  - `fetch_and_insert`: 외부 상세 → 콘텐츠 upsert(실패 처리 그대로) → `Promise.all([upsertGenres(try/catch 그대로), themes upsert, externalIds upsert, seasons upsert])` → `externalIdError`면 500(지금과 같음) → 라이브러리 insert(같은 함수) → 응답. `prefetchFirstSeasonEpisodes`와 성공 `logSync`는 `runAfterResponse`로.
- 실패 경로의 `logSync`(외부 조회 실패·콘텐츠 upsert 실패 등)는 응답 전 그대로 둔다(디버깅 근거 유지).

## 7. 데이터 모델

없음.

## 8. 화면

문구 외 화면 구조 변경 없음. 버튼 라벨·위치 그대로. 보충 카드는 목록 끝에 붙는다.

## 9. 엣지 케이스

| # | 상황 | 기대 | 테스트 |
|---|------|------|--------|
| E-1 | 3개를 1초 안에 연속 추가 | 각 카드 즉시 제거, 다른 카드 "추가" 계속 활성, 토스트 3회, 마지막 추가 0.8초 뒤 보충 요청 1회(limit 3), 라이브러리 재조회 1회 | T-1, T-4, 수동 M-1 |
| E-2 | 보충 진행 중 또 추가 | 끝난 뒤 다시 예약해 남은 빈자리 보충 | 수동 M-1 |
| E-3 | 추가 실패 | 카드 원위치 복원 + 실패 토스트(한국어 고정) | T-5, 수동 M-3 |
| E-4 | 피드 새로고침 중 | 추가 버튼 비활성 | T-3 |
| E-5 | 표시 가능 12개 그대로(추가 실패 복원 등) | 보충 요청 안 함 | T-2 |
| E-6 | 추천 끝(`complete`) | 보충 요청 안 함 | 수동 M-2 |
| E-7 | 이미 DB에 있는 작품 | 외부 조회 없이 추가 | A-1, 수동 M-4 |
| E-8 | 이미 내 라이브러리 | `already_exists` 응답 그대로 | A-1 |
| E-9 | 같은 작품 동시 2회 추가(빠른 경로) | 하나는 409(`ALREADY_IN_LIBRARY`), 앱은 기존처럼 처리 | 수동 M-4 |
| E-10 | `EdgeRuntime` 없음(로컬) | 응답 뒤 작업을 기다림(지금과 같음) | B-1 |
| E-11 | 응답 뒤 회차 미리 받기 실패 | `metadata_sync_logs` partial, 응답 영향 없음 | B-2 |
| E-12 | 작품 상세·인물 상세에서 추가 | 즉시 재조회(지금과 같음) | 수동 M-5 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다.** `src/utils/recommendationAddFlow.test.ts`(신규, 타이머는 가짜 `TimerApi`), `supabase/functions/_shared/addToLibraryFlow.test.ts`(신규).

| ID | 입력 | 기대 |
|----|------|------|
| T-1 | 가짜 타이머로 `createTrailingScheduler(800)`에 run A·B·C를 연속 `schedule` → 시간 진행 | C만 1회 실행, 실행 후 `isPending() === false` |
| T-1b | `schedule(A)` 후 `cancel()` → 시간 진행 | 실행 없음, `isPending() === false` |
| T-2 | `computeRefillLimit(11)`, `(12)`, `(3)`, `(0)`, `(15)`, `(NaN)`, `(2.7)`, `(5, 6)` | `1`, `0`, `9`, `12`, `0`, `12`, `10`, `1` |
| T-3 | `isRecommendationAddDisabled` 8조합(3개 boolean) | 셋 중 하나라도 true면 true, 모두 false면 false |
| T-4 | 상수 | `RECOMMENDATION_REFILL_DEBOUNCE_MS === 800`, `LIBRARY_REFRESH_DEBOUNCE_MS === 1500`, `RECOMMENDATION_TARGET_COUNT === 12` |
| T-5 | 문구 | `RECOMMENDATION_ADDED_TOAST === "라이브러리에 추가했어요."`, `RECOMMENDATION_ADD_FAILED_TOAST === "라이브러리에 추가하지 못했어요. 잠시 후 다시 시도해 주세요."` |
| A-1 | `planAddToLibraryPath({ "c1", "l1" })`, `({ "c1", null })`, `({ null, null })`, `({ null, "l1" })` | `"already_exists"`, `"fast_insert"`, `"fetch_and_insert"`, `"fetch_and_insert"` |
| B-1 | `runAfterResponse(task, undefined)`, `(task, {})` | 둘 다 task 완료까지 기다림(완료 플래그 true 확인) |
| B-2 | `runAfterResponse(실패하는 task, { waitUntil: (p) => captured.push(p) })` | 즉시 반환(task 완료 전), `captured` 1개, 그 promise는 reject하지 않고 resolve |
| B-3 | `runAfterResponse(실패하는 task, undefined)` | reject(오류 전달) |

> T-2의 `(NaN)`은 표시 개수 0으로 보아 12, `(2.7)`은 내림 2로 보아 10.

### 수동 확인 (재배포 후, 로그인 — UI-14.3)

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 | 추천 3개 연속 추가: 다른 카드 버튼 계속 활성, 토스트 즉시, 약 1초 뒤 새 추천 3개가 목록 끝에, 네트워크에서 `personalized-recommendations` 보충 요청 1회(`limit: 3`), 라이브러리 조회 1회 |
| M-2 | 웹 | 추천이 끝난 계정에서 추가해도 불필요한 보충 요청 없음 |
| M-3 | 웹(오프라인) | 추가 실패 시 카드 복원 + 한국어 토스트 |
| M-4 | 웹 | 이미 다른 경로로 DB에 있는 작품 추가가 새 작품보다 빠름(네트워크 시간 비교). 같은 작품 연타에 오류 화면 없음 |
| M-5 | 웹 | 작품 상세에서 추가 → 바로 "내 상태"가 보임(즉시 재조회 유지) |
| M-6 | 앱(iOS 세로) | M-1과 같은 흐름, 토스트가 하단 탭과 겹치지 않음 |

## 11. 변경 파일

| 파일 | 변경 |
|------|------|
| `src/utils/recommendationAddFlow.ts` (+`.test.ts`) | 신규. 6.1 |
| `src/hooks/useLibrary.ts` | `useAddToLibrary` 옵션(6.2). 다른 훅 변경 없음 |
| `src/hooks/usePersonalizedRecommendations.ts` | `scheduleRefill` 추가(6.3). 기존 함수 동작 유지 |
| `app/search.tsx` | 6.4 |
| `supabase/functions/_shared/addToLibraryFlow.ts` (+`.test.ts`) | 신규. 6.5 |
| `supabase/functions/add-to-library/index.ts` | 6.6 |

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| 검색 결과 카드의 추가 잠금(`pendingSearchKey` 전역 잠금) | 같은 패턴이지만 이번 요청은 추천 목록. 별도 정정 |
| 기존 `refill(removed)` 삭제 | 사용처 정리는 후속 |
| 라이브러리 조회 쿼리 자체 경량화(조인 축소·페이지네이션) | 여러 화면 영향. 별도 |
| `personalized-recommendations` 탐색 속도 | `docs/41` 범위 |
| 보러가기 링크 작업·`docs/41` 미커밋 변경 | 다른 작업, 수정 금지 |

## 13. 확실하지 않음

1. **`EdgeRuntime.waitUntil`**: Supabase Edge Functions의 응답 뒤 작업 API로 알려져 있으나 이 프로젝트에서 써 본 적이 없다. 배포 후 회차 화면 첫 진입에 회차가 채워져 있는지(M-4 이후)와 `metadata_sync_logs` 성공 로그로 확인한다. 없으면 `runAfterResponse`가 기다리는 쪽으로 동작해 지금과 같다.
2. 로그인 계정의 실제 서버 응답 시간은 측정하지 못했다. 배포 전후 M-1·M-4에서 네트워크 시간을 비교해 보고한다.
