# 47. 추천 추가 로딩 — 묶음마다 12개 채우기

작성일: 2026-10-05
대상 브랜치 기준: `main` (`6734575`) + 미커밋 작업(`docs/41`~`46` 구현 등). 이 시점 `npm test` 985개 중 984개 통과 — 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함
선행 문서: `docs/28_recommendation_scroll_pagination_fixes_spec.md`(스크롤 추가 로딩, D-1·D-3), `docs/30`(12개 목표·자동 보충 한도), `docs/42`·`docs/43`(추가·보충 경쟁 방지), `docs/45`(연도 감지)

> **근거.** 사용자 캡처(웹, 갤러리 6열, "모든 유형 · 모든 장르 · 일본, 한국 · 2024년"). 스크롤로 불러온 다음 줄이 6칸 중 5칸만 찼다.
> 사용자 요청: "12개씩 추가로 검색이 되어야 하는데 6개 정도만 나오는 것 같아."

---

## 1. 문제 정의

| ID | 증상 |
|----|------|
| B-1 | 첫 화면은 12개까지 채워지지만, 스크롤로 불러오는 다음 묶음부터는 화면에 붙는 카드가 12개보다 적다(캡처상 5~6개) |

## 2. 근본 원인

**앱에 "다음 묶음을 12개까지 채우는" 장치가 없다.** 서버에 12개를 요청하고, 받은 것 중 보일 수 있는 것만 붙인 뒤 끝난다.

| 위치 | 코드 | 결과 |
|------|------|------|
| `src/hooks/usePersonalizedRecommendations.ts:681` | `decideEmptyRecommendationContinuation({ targetItemCount: PERSONALIZED_RECOMMENDATION_BATCH_SIZE, … })` | 자동 이어 찾기 목표가 **전체 12개로 고정**이다. 처음 12개가 차면 그 뒤로는 `idle`이라, 다음 묶음이 짧아도 다시 채우지 않는다 |
| 같은 파일 726행 | `loadMoreRef.current(PERSONALIZED_RECOMMENDATION_BATCH_SIZE - visibleRecommendationCount)` | 이어 찾기 요청 수도 "12 − 현재 개수"라, 12개를 넘은 뒤에는 의미가 없다 |
| 같은 파일 552행 `loadMore` | 서버 응답을 `appendRecommendationFeed`로 붙이고 끝 | 응답 중 중복·등록됨·제외·조건 불일치는 화면에서 빠진다(`filterVisibleRecommendationCandidates`). 빠진 만큼 짧아진다 |
| `src/utils/recommendationFeed.ts` `shouldAutoLoadNextRecommendationBatch`·`shouldResumeRecommendationSearchOnScroll` | `visibleCount >= 12` / `< 12` 고정 | 스크롤 판정도 "전체 12개"만 안다 |

**서버 측 실측**(로컬, 실제 TMDB·AniList, 운영과 같은 설정: 12개, 3개월·3라운드, 1초 탐색 예산, 키워드 조회 16회, 취향 보충 포함, 2024년·일본·한국·모든 유형, 빈 라이브러리)

| 조건 | 요청 8회 응답 개수 |
|------|-------------------|
| 제외 테마 없음 | 8회 모두 12개 |
| 제외 테마 3개(BL·GL·퀴어 로맨스로 가정) | 8회 모두 12개(요청당 원시 후보 70~149개, 키워드 미확인 3~20개는 서버가 뺌) |

- 서버는 빈 라이브러리에서 12개를 채운다. 그러니 실제 계정에서 빠지는 몫(라이브러리 560개와 겹침, 앱의 제목 기준 등록 판정, 이미 보인 작품의 중복)은 **확인하지 못했다.** 로그인한 세션이 없어 실제 응답을 재지 못했기 때문이다.
- 어느 쪽에서 빠지든 "다음 묶음을 12개까지 이어서 찾기"가 해결책이다. 묶음별 개수를 재는 개발용 기록(D-5)으로 구현 후 확인한다.

## 3. 재현 시나리오

1. 웹 8081에 로그인 → 검색 탭 → 필터를 2024년 + 일본·한국, 갤러리로 둔다.
2. 첫 12개가 보인 뒤 아래로 스크롤한다.
3. 다음 묶음이 12개보다 적게 붙고, 더 스크롤해야 다음 요청이 나간다.

## 4. 설계 결정

### D-1. "묶음 목표"를 둔다: 스크롤로 다음 묶음을 시작하면 목표는 그때 보이는 개수 + 12다
- 처음 목표는 12다(지금과 같다).
- 사용자가 끝까지 스크롤해 다음 묶음을 시작하면 목표는 `max(현재 목표, 보이는 개수 + 12)`가 된다.
- 기존 자동 이어 찾기(`decideEmptyRecommendationContinuation`)가 이 목표까지 채운다. 한 번 요청 수는 `min(12, 목표 − 보이는 개수)`다.

### D-2. 자동 이어 찾기의 한도는 묶음마다 그대로다
- 요청 6회, 45초, 진전 없는 연속 3회다(`docs/30`). 목표에 닿으면 `idle`로 카운터가 초기화되므로, 한도는 묶음 단위로 적용된다.
- 한도에 걸려 멈추면 지금처럼 목록 아래에 "아래로 스크롤하면 다음 추천을 자동으로 찾습니다."가 뜬다. 다시 스크롤하면 이어서 찾는다.

### D-3. 스크롤 판정은 "목표"를 기준으로 한다
- `shouldAutoLoadNextRecommendationBatch`(다음 묶음 시작): `visibleCount >= targetCount`
- `shouldResumeRecommendationSearchOnScroll`(멈춘 묶음 이어 찾기): `0 < visibleCount < targetCount`
- `targetCount`를 주지 않으면 12다. 그래서 기존 호출과 테스트는 그대로 통과한다.
- 판정에 쓰는 보이는 개수는 훅의 개수(`countVisibleRecommendationCandidates`)다. 목표와 같은 기준이어야 한다.

### D-4. 목표 초기화
- "새 추천 12개"(refresh)를 시작할 때 12로 되돌린다.
- 계정·유형·발견 조건·제외 설정이 바뀌어 캐시 키가 바뀌어도 12다. 목표는 캐시 키와 묶어 저장한다.

### D-5. 개발용 기록(원인 분해)
- `__DEV__`에서만 `loadMore`가 응답을 붙인 뒤 `console.info("recommendation batch", JSON.stringify({...}))`를 남긴다. 담는 값은 다음과 같다.
  - `requested`, `serverItems`, `appended`, `duplicates = serverItems − appended`
  - `hidden`: 이번 응답 항목에 `summarizeRecommendationVisibility`를 적용한 `{ registered, excluded, unverifiableTmdb }`
  - `visibleBefore`, `visibleAfter`, `target`
- 개수만 남긴다. 제목·ID·계정 정보는 남기지 않는다.
- 이 기록으로 실제 계정에서 빠지는 몫이 서버(응답 부족)인지 앱(중복·등록·제외)인지 사람이 확인한다(M-1).

### D-6. 서버·보충 로직은 바꾸지 않는다
- `scheduleRefill`(`docs/42`)·누른 카드 자리 유지(`docs/43`)·연도 감지(`docs/45`)는 그대로다.
- 12개를 넘는 목록에서 카드를 추가하면, 빈 칸은 추가가 끝난 뒤(`shouldDeferRecommendationRefill`이 풀린 뒤) 자동 이어 찾기가 목표까지 채운다. 새 카드는 목록 끝에 붙는다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 서버 `limit`을 24로 올려 넉넉히 받기 | 서버 상한(12)·응답 시간·키워드 조회 예산을 모두 바꿔야 한다. 빠지는 몫이 얼마인지 모르니 몇으로 올려도 보장이 안 된다 |
| 스크롤 한 번에 요청을 연속 2회 고정 | 이미 12개면 낭비이고, 많이 빠지면 여전히 부족하다. 목표까지 채우는 기존 장치를 재사용하는 편이 정확하다 |
| 보이는 개수가 12의 배수가 될 때까지 채우기 | 카드를 추가·관심 없음으로 빼면 배수 기준이 흔들린다. "시작 시점 + 12"가 사용자가 기대한 묶음과 같다 |
| 원인을 먼저 실측하고 그 쪽만 고치기 | 로그인 세션이 없어 지금 실측할 수 없다. 서버·앱 어느 쪽에서 빠지든 이 해결은 같고, D-5 기록으로 사후 확인한다 |

## 6. 계약

### 6.1 `src/utils/recommendationFeed.ts`
```ts
/** 다음 묶음을 시작할 때의 목표. visible이 유한한 양수가 아니면 0으로 본다(소수는 내림). */
export function nextRecommendationBatchTarget(visibleCount: number, currentTarget: number): number;
// v = Number.isFinite(visibleCount) && visibleCount > 0 ? Math.floor(visibleCount) : 0
// return Math.max(currentTarget, v + PERSONALIZED_RECOMMENDATION_BATCH_SIZE) — 단 v === 0이면 currentTarget

/** 자동 이어 찾기 한 번에 요청할 개수 */
export function recommendationContinuationLimit(visibleCount: number, targetCount: number): number;
// v는 위와 같이 정규화. return Math.min(PERSONALIZED_RECOMMENDATION_BATCH_SIZE, Math.max(0, targetCount - v))

export interface RecommendationScrollResumeInput {
  // ...기존 필드
  targetCount?: number; // 기본 PERSONALIZED_RECOMMENDATION_BATCH_SIZE
}
```
- `shouldAutoLoadNextRecommendationBatch`: `input.visibleCount >= PERSONALIZED_RECOMMENDATION_BATCH_SIZE`를 `input.visibleCount >= (input.targetCount ?? PERSONALIZED_RECOMMENDATION_BATCH_SIZE)`로 바꾼다. 나머지 조건은 그대로다.
- `shouldResumeRecommendationSearchOnScroll`: `input.visibleCount < PERSONALIZED_RECOMMENDATION_BATCH_SIZE`를 `input.visibleCount < (input.targetCount ?? PERSONALIZED_RECOMMENDATION_BATCH_SIZE)`로 바꾼다.
- `decideEmptyRecommendationContinuation`은 바꾸지 않는다(이미 `targetItemCount`를 받는다).

### 6.2 `src/hooks/usePersonalizedRecommendations.ts`
- **목표 상태**
  - `const [batchTarget, setBatchTarget] = useState({ key: cacheIdentity, target: PERSONALIZED_RECOMMENDATION_BATCH_SIZE })`
  - `const visibleTarget = batchTarget.key === cacheIdentity ? batchTarget.target : PERSONALIZED_RECOMMENDATION_BATCH_SIZE`
- **681행**: `targetItemCount: visibleTarget`.
- **726행**: `loadMoreRef.current(recommendationContinuationLimit(visibleRecommendationCount, visibleTarget))`.
- **`loadNextBatch`(신규)**
  - 실행 순서:
    1. `const target = nextRecommendationBatchTarget(visibleRecommendationCount, visibleTarget)`
    2. `setBatchTarget({ key: cacheIdentity, target })`
    3. `return loadMore(PERSONALIZED_RECOMMENDATION_BATCH_SIZE)`
  - 입력 검사(`isCurrent`·사용자·진행 중 요청)는 `loadMore`가 하던 그대로 두고, `loadMore`가 `false`를 돌려줘도 목표는 유지한다. 다음 스크롤에서 이어 찾을 수 있게 하기 위함이다.
- **`refresh`**: 시작할 때(입력 검사 통과 직후) `setBatchTarget({ key: cacheIdentity, target: PERSONALIZED_RECOMMENDATION_BATCH_SIZE })`.
- **D-5 기록**: `loadMore`의 `setQueryData` 직후에 남긴다(값은 D-5 그대로, `next.items` 기준).
- **반환값**: `loadNextBatch`, `visibleTarget`, `visibleCount: visibleRecommendationCount`를 더한다. 기존 `loadMore`는 그대로 둔다.

### 6.3 `app/search.tsx`
- 추천 `onScroll`(1052~1080행, 판정 1072행)의 `scrollLoadState`를 바꾼다.
  - `visibleCount: personalizedRecommendations.visibleCount`, `targetCount: personalizedRecommendations.visibleTarget`
  - `shouldAutoLoadNextRecommendationBatch`가 참이면 `personalizedRecommendations.loadNextBatch()`(기존 `loadMore()` 대신)
- 다른 화면 코드는 바꾸지 않는다.

## 7. 데이터 모델 / SQL

없음.

## 8. 화면 명세

새 문구·모양은 없다. 묶음이 채워지는 동안에는 기존 목록 아래 로딩 표시가 보이고, 한도로 멈추면 기존 안내가 뜬다.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 연결 |
|---|------|----------|------|
| E-1 | 12개 보임 → 스크롤 → 응답 중 6개만 보임 | 목표 24, 자동으로 6개 더 요청해 24개 | B-1, B-5, M-1 |
| E-2 | 다음 묶음에서 진전 없는 응답 3회 | 멈춤, 기존 안내, 다시 스크롤하면 이어 찾기 | B-3, M-1 |
| E-3 | 추천이 끝남(`is_exhausted`) | 목표 미달이어도 `idle`, 종료 문구 | 기존 테스트 |
| E-4 | 24개 목표 중 17개에서 멈춤 → 다시 스크롤 | `shouldResume…`(17 < 24) → 이어 찾기 | B-3 |
| E-5 | 목표에 닿음(24/24) → 다시 스크롤 | 다음 묶음 시작, 목표 36 | B-1, B-2 |
| E-6 | "새 추천 12개" | 목표 12로 초기화 | M-1 |
| E-7 | 필터·연도 변경 | 캐시 키가 바뀌어 목표 12 | M-1 |
| E-8 | 36개 목록에서 카드 3개 추가 | 추가가 끝난 뒤 목표 36까지 이어 찾기, 새 카드는 끝에 | D-6, M-1 |
| E-9 | 이미 목표보다 많이 보임(보충으로 13개) → 스크롤 | 목표 = 13 + 12 = 25 | B-1 |
| E-10 | 연도 미지원 감지(`docs/45`) | `stopped`가 우선, 목표와 무관 | 기존 C-1 |
| E-11 | 보이는 0개 | 첫 묶음 흐름(기존 빈 화면 이어 찾기) 그대로 | B-1 |
| E-12 | 요청 수 상한 | 한 번 요청은 최대 12개(서버 상한과 같음) | B-5 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다. 한 행 = `it` 하나.** `src/utils/recommendationFeed.test.ts`에 추가(기존 테스트 그대로).
B-4는 기존 동작을 지키는 **보존 테스트**라 구현 전에도 통과하는 것이 정상이다. 그 외 행은 구현 전에 실패해야 한다.

| ID | 입력 | 기대 |
|----|------|------|
| B-1 | `nextRecommendationBatchTarget(12, 12)`, `(17, 24)`, `(24, 36)`, `(0, 12)`, `(NaN, 12)`, `(13, 12)`, `(12.7, 12)` | `24`, `29`, `36`, `12`, `12`, `25`, `24` |
| B-2 | 기존 `ready`(visibleCount 12) + `{ visibleCount: 17, targetCount: 24 }` / `{ visibleCount: 24, targetCount: 24 }` / `targetCount` 없음(visibleCount 12) | `shouldAutoLoadNextRecommendationBatch` = `false` / `true` / `true` |
| B-3 | 기존 멈춤 상태 `ready`(visibleCount 7, `automaticSearchStopped: true`) + `{ visibleCount: 17, targetCount: 24 }` / `{ visibleCount: 24, targetCount: 24 }` / `targetCount` 없음(visibleCount 7) | `shouldResumeRecommendationSearchOnScroll` = `true` / `false` / `true` |
| B-4 (보존) | `decideEmptyRecommendationContinuation({ ...base, itemCount: 17, targetItemCount: 24 })` / `({ ...base, itemCount: 24, targetItemCount: 24 })` | `"continue"` / `"idle"` |
| B-5 | `recommendationContinuationLimit(17, 24)`, `(0, 12)`, `(24, 24)`, `(5, 36)`, `(30, 24)`, `(NaN, 12)` | `7`, `12`, `0`, `12`, `0`, `12` |

### 수동 확인 (사람, 로그인 필요)

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440(갤러리 6열) | 2024년 + 일본·한국. 첫 12개 → 스크롤마다 12개(두 줄)씩 늘어난다(끝에 닿으면 종료 문구). 개발자 도구 콘솔의 `recommendation batch` 기록에서 묶음별 `serverItems`·`appended`·`duplicates`·`hidden`을 3묶음 이상 보고한다(원인 분해). "새 추천 12개" 후 다시 12개부터 시작한다. 카드 추가 후 목록 끝이 채워진다 |
| M-2 | 웹 375 | 갤러리 2열에서 같은 흐름. 스크롤 중 중복 요청이 없다(네트워크 탭) |
| M-3 | 앱(iOS 세로) | 같은 흐름 |

## 11. 변경 파일

| 파일 | 변경 |
|------|------|
| `src/utils/recommendationFeed.ts` | 6.1 |
| `src/utils/recommendationFeed.test.ts` | B-1~B-5 |
| `src/hooks/usePersonalizedRecommendations.ts` | 6.2 |
| `app/search.tsx` | 6.3 |

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| 서버 응답 개수·탐색 예산·키워드 조회 한도 | 빈 라이브러리 실측에서 12개를 채운다. D-5 기록에서 서버 부족으로 확인되면 별도 명세 |
| 앱의 등록 판정(제목 기준)·중복 판정 규칙 | D-5 기록에서 빠지는 몫이 크면 별도 명세 |
| `scheduleRefill`의 12개 기준(`computeRefillLimit`) | 12를 넘는 목록의 빈 칸은 D-6대로 이어 찾기가 채운다 |
| 제목 검색 무한 스크롤 | 다른 흐름 |

## 13. 확실하지 않음 — 별도 검증 필요

1. 실제 계정에서 묶음당 몇 개가 어디서 빠지는지는 로그인한 세션으로만 잴 수 있다. 구현 후 M-1의 `recommendation batch` 기록으로 확인한다.
2. 빠지는 몫이 아주 크면(예: 묶음당 2~3개만 보임) 한도(요청 6회·진전 없는 연속 3회) 안에 12개를 못 채울 수 있다. 그때는 D-5 기록을 근거로 서버·판정 쪽 별도 정정을 판단한다.


## 14. 2026-10-05 후속 정정: 화면의 카드 수와 목표 일치

사용자가 구현 뒤에도 마지막 줄이 세 칸만 남는다고 다시 수정 요청했다. 실제 로그인 화면의 표시 수는 51개였고, 훅의 마지막 보충 로그는 48개였다. 차이는 오입력 방지용 보존 슬롯 3개였다. 추가된 카드도 화면에 남기면서 후보 12개까지 다시 보충해 전체 격자가 13·26·39개처럼 어긋날 수 있었다.

이 후속 요구에 따라 D-3의 개수 기준과 D-6의 추가 후 보충 기준을 **실제 화면 슬롯 수**로 정정한다. 등록 작품을 새 후보로 통과시키는 것이 아니다. 기존 등록·제외 판정과 추가됨 카드의 위치·비활성 동작은 유지한다.

- `countRecommendationDisplaySlots(visibleIds, retainedIds)`는 현재 표시 가능한 후보와 현재 문맥의 보존 슬롯을 canonical identity로 합쳐 한 번만 센다. 실패 복원 중 겹치는 카드도 중복 계산하지 않는다.
- 검색 화면은 현재 계정·필터 문맥의 `retainedIds`만 훅에 전달한다. 훅의 스크롤 판정·묶음 목표·이어 찾기·예약 보충은 동일한 화면 슬롯 수를 사용한다. 11개 후보 + 추가됨 슬롯 1개이면 화면 12개이므로 추가 보충하지 않는다. 다음 스크롤은 화면 24개를 목표로 한다.
- 빈 응답이라도 커서가 진전하면 실제 오류로 취급하지 않는다. 기존 무진전 연속 3회·6회·45초 한도로 중단한다. 커서 고정·네트워크 오류·연도 미지원·정상 소진의 처리는 유지한다.
- 목표를 변경할 때 ref와 상태를 함께 갱신하고 요청 시작 때 목표를 캡처한다. 첫 요청 로그에도 새 묶음 목표가 남는다.
- 적용 전 이미 과잉 보충된 목록은 명시적 새 추천으로 초기화한다. 기존 사용자 라이브러리 기록은 변경하지 않는다.

후속 회귀 테스트(`recommendationFeed.test.ts`):

| 입력 | 기대 |
|---|---|
| 남은 b,c + 보존 a / 후보 a,b + 보존 a,a | 표시 3 / 표시 2, 중복 없음 |
| 후보 11 + 보존 1 | 표시 12, 보충 0, 다음 목표 24 |
| 후보 33 + 보존 3, 다음 응답 5개 | 표시 36, 다음 목표 48, 부족분 7 |
| 표시 17/목표 24, 무진전 1·2·3회 | continue / continue / stopped |

## 15. 2026-10-05 후속 정정: 추가·완료 성공 후에도 다음 12개 묶음

사용자가 한 작품을 완료한 뒤 새 추천이 한 개만 붙는다고 보고했고, 액션 후에도 다음 12개를 조회하도록 요청했다. 스크롤은 묶음 목표를 세우지만 성공 후 `scheduleRefill`은 여전히 `computeRefillLimit(표시 수, 12)`를 사용했다. 이 경로는 부족한 한 칸만 요청하거나 표시 수가 이미 12 이상이면 요청을 생략했다.

이 최신 요구에 따라 **42 D-4의 요청 개수, 이 문서 D-6·§12의 예약 보충 범위, §14의 "화면 12개이면 추가 보충하지 않음"을 추가·완료 성공에 한해 대체**한다. 표시 슬롯 계산과 오입력 방지 위치 유지 계약은 보존한다.

- 갤러리·목록·빠른 보기의 추가/완료 성공은 공통 `scheduleRefill`을 사용한다. 800ms trailing 예약으로 연속 성공을 한 그룹으로 모은다. 실패는 슬롯을 복원하며 새 묶음을 예약하지 않는다.
- 예약 발화 시 추가·추천 요청이 진행 중이면 목표를 바꾸지 않고 재예약한다. 준비되면 **그 시점 최신 캐시의 화면 슬롯 수 + 12**를 목표로 하여 공통 `loadNextBatch`에서 첫 12개를 요청한다. 진행 중 응답으로 목록이 늘어났어도 오래된 화면 수로 목표를 만들지 않는다.
- 짧거나 빈 응답은 같은 목표를 유지한 채 기존 자동 이어 찾기로 부족분을 채운다. 빈 응답의 false 반환으로 새 묶음을 재예약하지 않는다. 새 카드는 목록 끝에 붙고, 완료/추가됨 슬롯도 기존 위치에 남는다.
- 새 묶음 시작 때 이전 중단·조회 오류·무진전 카운터를 초기화한다. 첫 요청부터 요청 6회·45초·무진전 연속 3회 예산에 포함한다. 요청 lock 검사 전에 목표나 예산을 변경하지 않아 중복 스크롤이 진행 중 탐색 한도를 초기화하지 않는다.
- 추가 진행·예약 대기는 스크롤 로딩 판정에도 적용한다. 같은 액션 그룹에 대해 스크롤과 예약이 별도 묶음을 동시에 시작하지 않는다.
- 예약 당시 요청 문맥을 콜백에서도 검사한다. 계정·필터·활성 문맥 변경 및 새 추천은 이전 예약을 취소한다. 정상 소진·연도 미지원이면 다음 묶음을 시작하지 않는다.
- 관심 없음·테마 줄이기의 기존 `refill(removed)`와 비슷한 작품 모드는 이번 추가/완료 후속 범위에서 유지한다. 서버·DB 변경은 없다.

순수 조합 회귀 테스트(`recommendationAddFlow.test.ts`, 실제 훅 검증을 대체하지 않음):

| ID | 입력 | 기대 |
|---|---|---|
| AB-1 | 단일 완료, 후보 11 + 보존 슬롯 1, 예약 발화 | 표시 12 유지, 목표 24, 다음 요청 12 |
| AB-2 | 후보 33 + 보존 3, 연속 성공 3회 | 예약 발화 한 번, 목표 48 |
| AB-3 | 조회 중 예약, 이전 표시 24 → 조회 종료 시 36 | 대기 중 목표 유지, 최신 표시 36 기준 목표 48/요청 12 |
| AB-4 | 목표 24, 첫 응답 5개, 다음 응답 7개 | 요청 12→7, 목표 고정, 24 도달 후 idle |
| AB-5 | 실패 또는 성공 예약 취소 | 새 묶음 0회 |
| AB-6 | 커서가 진전한 빈 응답 3회 | 같은 목표 유지, 무진전 한도로 중단 |

실제 훅을 사용한 격리 브라우저 검증은 작업 재개 문서에 기록한다. 모의 추천/인증 응답을 사용하며 실제 사용자 라이브러리 기록·서버 저장 검증은 별도로 구분한다.
