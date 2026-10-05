# 46. 추천 카드 "완료" 버튼 — 이미 본 작품을 바로 완료로 기록

작성일: 2026-10-05
대상 브랜치 기준: `main` (`6734575`) + 미커밋 작업(`docs/41`~`45` 구현 등). 이 시점 `npm test` 974개 중 973개 통과 — 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙 — 이 명세는 다른 점만 쓴다)**, `docs/42`(카드 단위 잠금·즉시 토스트·보충 예약), `docs/43`(누른 카드 위치 유지·누르기 identity 검증·동기 잠금), `docs/30` D-4·`docs/28` D-5(카드 하단 행동 위치)

> **근거.** 사용자 캡처(웹 넓은 화면, 갤러리 6열, 2025년 추천). 카드 하단에 "추가" 버튼 하나만 있다.
> 사용자 요청: "추가와 완료 버튼을 두고, 추가 버튼은 기존 기능 그대로 두고, 완료 버튼은 과거에 봤던 작품이라 바로 완료 처리하고 싶어."

---

## 1. 문제 정의

| ID | 증상 | 원인 |
|----|------|------|
| C-1 | 추천에 이미 본 작품이 나와도 "추가"(보고 싶음)밖에 없다. 완료로 바꾸려면 작품 상세로 들어가 상태를 다시 바꿔야 한다(2단계 + 화면 이동) | `app/search.tsx` `addRecommendationResult`가 `status: "wishlist"`로 고정(450행 `mutateAsync({ result, status: "wishlist" })`). 카드·빠른 보기에 완료 행동이 없다 |

제목 검색 결과 카드(`SearchResultGalleryCard`·`SearchResultItem`)에는 이미 "보고 싶음/완료" 두 버튼이 있다(`addResult(item, "completed")`). 서버 `add-to-library`도 `watch_status: "completed"`를 받아 `watch_count = 1`로 저장한다(`supabase/functions/add-to-library/index.ts:61~62`, 운영 v19에도 있음). **앱만 바꾸면 되고 서버 변경·배포는 없다.**

## 2. 목표 모습

```
갤러리 카드 하단                         목록(자세히) 카드 행동 줄
┌──────────────────────────┐           … (빠른 보기) [ 추가 ] [ 완료 ]
│ ⊗  ⇄  ☰        👁 빠른 보기 │
│ [   추가   ][   완료   ]    │  ← 같은 자리·같은 높이 44, 두 칸 같은 폭
└──────────────────────────┘
추가 = 파란 채움(기존과 같음)   완료 = 흰 바탕 + 파란 테두리·글자

빠른 보기 하단: [상세 보기] [추가] [완료]
```

## 3. 설계 결정

### D-1. "추가"는 지금과 똑같고, "완료"는 같은 흐름에 상태만 `completed`다
- `addRecommendationResult(result, status)`로 상태를 받는다(기본 `"wishlist"`).
- 두 버튼 모두 같은 흐름을 탄다: 중복 확인 → 동기 잠금(`docs/43`) → 카드 즉시 제거·자리 유지 → 서버 추가 → 성공 토스트 + 보충 예약(`docs/42`) / 실패 시 복원 + 실패 토스트.
- 다른 것은 `mutateAsync`의 `status`와 토스트 문구뿐이다.

### D-2. 한 카드에서는 한 번에 하나만
- 어느 버튼이든 진행 중이면 그 카드의 두 버튼이 모두 비활성이다. 다른 카드는 계속 누를 수 있다(`docs/42` D-2).
- 잠금 키는 상태와 무관하게 `${userId}:${canonical_id}` 하나다. 그래서 "추가" 직후 "완료"를 눌러도 두 번째 요청이 나가지 않는다.
- 누르기 identity 검증(`createRecommendationPressGuard`)은 두 버튼이 카드의 같은 guard를 쓴다.

### D-3. 문구
| 경우 | 문구 |
|------|------|
| 버튼(평소) | "추가" / "완료" |
| 진행 중 | 누른 버튼만 "추가 중" 또는 "기록 중", 다른 버튼은 원래 글자 그대로 비활성 |
| 이미 등록 | "추가됨" / "완료"(둘 다 비활성) |
| 성공 토스트 | 추가: `{제목} · 라이브러리에 추가했어요.`(지금과 같음), 완료: `{제목} · 완료로 기록했어요.` |
| 실패 토스트 | 추가: 지금 문구 그대로, 완료: "완료로 기록하지 못했어요. 잠시 후 다시 시도해 주세요." |
| 접근성 힌트 | 추가: "보고 싶음으로 라이브러리에 추가해요", 완료: "이미 본 작품으로 완료 처리해요" |

제목이 비어 있으면 토스트는 문구만 쓴다(앞에 " · "를 붙이지 않는다).

### D-4. 모양 (UI 규칙 준수, 다른 점만)
- 두 버튼은 기존 "추가" 버튼 자리에 **한 줄로** 둔다. 높이 44, `gap: spacing.xs`, 갤러리에서는 두 칸이 같은 폭(`flex: 1`)이다.
- **추가**: 배경 `primary`, 글자 `surface`(기존과 같다).
- **완료**: 배경 `surface`, hairline `primary` 테두리, 글자 `primary`. 더 약한 강조로 두어, 주 행동(추가)과 구분하고 잘못 누르는 일을 줄인다.
- 두 버튼 글자는 `typography.label`, `numberOfLines={1}`. 기존 추가 버튼의 `fontSize: 11·12`/`fontWeight: "900"`은 이 토큰으로 바꾼다(같은 줄 두 버튼의 글자 모양을 맞추기 위함).
- 모서리는 기존 버튼 값을 그대로 둔다(갤러리 `radius.sm`, 목록 `radius.md`).
- **`docs/30` D-4·`docs/28` D-5 대체 범위**: "추가 버튼의 폭"만 바뀐다(추가 칸 → 추가·완료 두 칸). 아이콘 슬롯 순서·크기, 빠른 보기 위치, 버튼 줄의 수직 위치·높이는 그대로다.

### D-5. 빠른 보기에도 같은 두 버튼
`RecommendationQuickViewModal`에서는 순서를 "상세 보기 · 추가 · 완료"로 둔다. 누르면 모달을 닫고 D-1 흐름을 탄다(지금 추가와 같은 방식).

### D-6. 판정·문구는 순수 함수
`src/utils/recommendationAddFlow.ts`에 둔다. 기존 함수·상수(`isRecommendationAddDisabled`, `RECOMMENDATION_ADDED_TOAST`, `RECOMMENDATION_ADD_FAILED_TOAST`, guard·lock·slot)는 바꾸지 않고 재사용한다.

### D-7. 서버·데이터는 바꾸지 않는다
- 완료 처리는 기존 `add-to-library`의 `completed` 경로다(`watch_count = 1`, 감상 날짜는 비워 둔다).
- 시즌 추천이면 그 시즌만 완료로 등록한다. 지금 서비스가 `season_number`를 넘기는 그대로다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 4. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| "추가"를 누르면 상태 고르기 메뉴(보고 싶음/보는 중/완료) | 한 번 누름이 두 번이 된다. 요청은 "바로 완료" |
| 완료 시 확인 창 | 되돌릴 수 있는 기록이다(작품 상세에서 상태 변경·삭제). 확인 창은 연속 기록을 느리게 한다 |
| 완료 토스트에 "되돌리기"(삭제) | 추가 응답의 항목 id로 삭제 흐름을 새로 엮어야 한다. 이번 범위를 넘는다(후속 후보) |
| 완료 시 감상 날짜를 오늘로 | "과거에 봤던 작품"이라 오늘 날짜는 틀린 기록이 된다 |
| 두 버튼을 같은 파란 채움으로 | 주 행동 구분이 사라지고 인접 버튼 오탭이 늘어난다 |
| 추천 카드를 검색 결과 카드처럼 "보고 싶음/완료"로 이름 변경 | 사용자가 "추가는 그대로"라고 했다 |

## 5. 계약

### 5.1 `src/utils/recommendationAddFlow.ts` (추가)
```ts
export type RecommendationAddStatus = "wishlist" | "completed";

export const RECOMMENDATION_COMPLETED_TOAST = "완료로 기록했어요.";
export const RECOMMENDATION_COMPLETE_FAILED_TOAST = "완료로 기록하지 못했어요. 잠시 후 다시 시도해 주세요.";
export const RECOMMENDATION_ADD_HINT = "보고 싶음으로 라이브러리에 추가해요";
export const RECOMMENDATION_COMPLETE_HINT = "이미 본 작품으로 완료 처리해요";

export interface RecommendationActionState {
  addLabel: "추가" | "추가 중" | "추가됨";
  completeLabel: "완료" | "기록 중";
  disabled: boolean;   // 두 버튼 공통
  busy: boolean;       // pendingStatus !== null
}
export function getRecommendationActionState(input: {
  pendingStatus: RecommendationAddStatus | null;
  isAdded: boolean;
  isRefreshing: boolean;
}): RecommendationActionState;

export function recommendationAddSuccessToast(status: RecommendationAddStatus, title: string): string;
export function recommendationAddFailureToast(status: RecommendationAddStatus): string;
```
- **`getRecommendationActionState`**
  - `disabled = isRecommendationAddDisabled({ isPending: pendingStatus !== null, isAdded, isRefreshing })`
  - `busy = pendingStatus !== null`
  - `addLabel = pendingStatus === "wishlist" ? "추가 중" : isAdded ? "추가됨" : "추가"`
  - `completeLabel = pendingStatus === "completed" ? "기록 중" : "완료"`
- **`recommendationAddSuccessToast`**
  - `message = status === "completed" ? RECOMMENDATION_COMPLETED_TOAST : RECOMMENDATION_ADDED_TOAST`
  - `title.trim()`이 있으면 `` `${title.trim()} · ${message}` ``, 없으면 `message`
- **`recommendationAddFailureToast`**: `"completed"` → `RECOMMENDATION_COMPLETE_FAILED_TOAST`, 그 외 → `RECOMMENDATION_ADD_FAILED_TOAST`

### 5.2 카드·모달 props
```ts
// PersonalizedRecommendationGalleryCard, PersonalizedRecommendationListItem (기존 props 유지 + 추가)
completeLabel: string;
onMarkCompleted: () => void;
// isAddDisabled는 두 버튼 공통 비활성으로 쓴다

// RecommendationQuickViewModal (기존 props 유지 + 추가)
completeLabel: string;
onMarkCompleted: (item: PersonalizedRecommendation) => void;
```

### 5.3 `app/search.tsx`
- `const [pendingCompletedIds, setPendingCompletedIds] = useState<Set<string>>(() => new Set())`를 더한다. `pendingAddIds`는 지금처럼 "그 카드에 진행 중인 추가가 있음"을 뜻하고, 완료이면 두 Set에 모두 넣는다.
- `addRecommendationResult(result, status: RecommendationAddStatus = "wishlist")`
  - 기존 흐름에서 다음 네 곳만 바뀐다.
    - `mutateAsync({ result, status })`
    - 성공 토스트 `recommendationAddSuccessToast(status, result.title_primary)`
    - 실패 토스트 `recommendationAddFailureToast(status)`
    - `status === "completed"`면 시작할 때 `pendingCompletedIds`에 넣고 `finally`에서 뺀다(`pendingAddIds`와 같은 사용자 검사 아래)
  - 잠금 키·자리 유지·보충 예약·범위(scope) 검사는 그대로다.
- `getRecommendationAddState(result)`는 `getRecommendationActionState({ pendingStatus, isAdded, isRefreshing: personalizedRecommendations.isRefreshing })`를 돌려준다.
  - `pendingStatus = pendingAddIds.has(id) ? (pendingCompletedIds.has(id) ? "completed" : "wishlist") : null`
- 카드에는 `addLabel`, `completeLabel`, `isAddDisabled={state.disabled}`, `onAddToLibrary={() => addRecommendationResult(rec, "wishlist")}`, `onMarkCompleted={() => addRecommendationResult(rec, "completed")}`를 넘긴다.
- 빠른 보기에는 `completeLabel`과 `onMarkCompleted={(item) => { setSelectedRecommendation(null); addRecommendationResult(item, "completed"); }}`를 넘긴다.
- FlashList `extraData`에 `Array.from(pendingCompletedIds).join(",")`를 더한다(카드 글자 갱신).

## 6. 엣지 케이스

| # | 상황 | 기대 동작 | 연결 |
|---|------|----------|------|
| E-1 | "완료" 누름 | 카드 자리 유지 후 제거, 토스트 "{제목} · 완료로 기록했어요.", 라이브러리에 완료(본 횟수 1), 보충 예약 | R-3·R-7, M-1 |
| E-2 | 완료 실패 | 카드 복원, "완료로 기록하지 못했어요. 잠시 후 다시 시도해 주세요." | R-10, M-1 |
| E-3 | 한 카드 진행 중 | 그 카드 두 버튼 비활성, 누른 버튼만 "…중", 다른 카드 활성 | R-2·R-3 |
| E-4 | "추가" 직후 "완료"(같은 카드) | 두 번째 요청 없음(동기 잠금) | 기존 MC-9, M-1 |
| E-5 | 누른 사이 셀 재사용 | 누름 무시(guard) | 기존 MC-5 |
| E-6 | 새로고침 중 | 두 버튼 비활성 | R-5 |
| E-7 | 이미 등록된 작품 | "추가됨"·"완료" 둘 다 비활성 | R-4 |
| E-8 | 빠른 보기에서 완료 | 모달 닫힘 → E-1과 같음 | M-1 |
| E-9 | 시즌 추천 카드 | 그 시즌만 완료로 등록 | M-1 |
| E-10 | 제목이 빈 추천 | 토스트는 문구만 | R-8 |
| E-11 | 갤러리 6열(웹 1440)·2열(375)·앱 글자 1.3배 | 두 버튼 한 줄, 글자 잘림 없음, 높이 44 | M-1~M-3 |
| E-12 | 키보드·스크린리더로 완료 | 접근성 라벨 `{제목} 완료`, 힌트 "이미 본 작품으로 완료 처리해요", 진행 중 `busy` | R-11, M-3 |

## 7. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다. 한 행 = `it` 하나.** `src/utils/recommendationAddFlow.test.ts`에 추가(기존 T-*, MC-* 그대로).

| ID | 입력 | 기대 |
|----|------|------|
| R-1 | `getRecommendationActionState({ pendingStatus: null, isAdded: false, isRefreshing: false })` | `{ addLabel: "추가", completeLabel: "완료", disabled: false, busy: false }` |
| R-2 | `{ pendingStatus: "wishlist", isAdded: false, isRefreshing: false }` | `{ "추가 중", "완료", true, true }` |
| R-3 | `{ pendingStatus: "completed", isAdded: false, isRefreshing: false }` | `{ "추가", "기록 중", true, true }` |
| R-4 | `{ pendingStatus: null, isAdded: true, isRefreshing: false }` | `{ "추가됨", "완료", true, false }` |
| R-5 | `{ pendingStatus: null, isAdded: false, isRefreshing: true }` | `{ "추가", "완료", true, false }` |
| R-6 | `recommendationAddSuccessToast("wishlist", "무빙")` | `"무빙 · 라이브러리에 추가했어요."` |
| R-7 | `recommendationAddSuccessToast("completed", "무빙")` | `"무빙 · 완료로 기록했어요."` |
| R-8 | `recommendationAddSuccessToast("completed", "  ")` / `("wishlist", "")` | `"완료로 기록했어요."` / `"라이브러리에 추가했어요."` |
| R-9 | `recommendationAddFailureToast("wishlist")` | `RECOMMENDATION_ADD_FAILED_TOAST`와 같음 |
| R-10 | `recommendationAddFailureToast("completed")` | `"완료로 기록하지 못했어요. 잠시 후 다시 시도해 주세요."` |
| R-11 | 상수 | `RECOMMENDATION_COMPLETED_TOAST === "완료로 기록했어요."`, `RECOMMENDATION_ADD_HINT === "보고 싶음으로 라이브러리에 추가해요"`, `RECOMMENDATION_COMPLETE_HINT === "이미 본 작품으로 완료 처리해요"` |

### 수동 확인 (UI-14.3)

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440(갤러리 6열·자세히) | 두 버튼 한 줄·같은 높이, 아이콘·빠른 보기 위치 그대로. "완료" → 토스트·카드 제거·라이브러리 "완료" 탭에 등장(본 횟수 1). "추가" 동작은 이전과 같음. 같은 카드 연타 시 요청 1회. 빠른 보기 완료 |
| M-2 | 웹 375 | 갤러리 2열에서 두 버튼 글자 잘림 없음, 가로 넘침 없음 |
| M-3 | 앱(iOS 세로) | 두 버튼 44, 글자 1.3배에서 잘림 없음, VoiceOver 라벨·힌트 |

## 8. 변경 파일

| 파일 | 변경 |
|------|------|
| `src/utils/recommendationAddFlow.ts` | 5.1 추가 |
| `src/utils/recommendationAddFlow.test.ts` | R-1~R-11 추가 |
| `src/components/content/PersonalizedRecommendationGalleryCard.tsx` | 완료 버튼, 두 버튼 한 줄, 버튼 글자 토큰화 |
| `src/components/content/PersonalizedRecommendationListItem.tsx` | 같음 |
| `src/components/content/RecommendationQuickViewModal.tsx` | 완료 버튼(상세 보기 · 추가 · 완료) |
| `app/search.tsx` | 5.3 |

## 9. 범위 밖

| 항목 | 이유 |
|------|------|
| 완료 토스트 "되돌리기" | 후속 후보(기각한 대안) |
| 완료 시 평점·감상 날짜 입력 | 요청은 "바로 완료" |
| 제목 검색 카드의 "보고 싶음/완료" | 이미 있음 |
| 홈 인기 추천(`PopularRecommendationSection`) | 다른 화면 |
| 카드의 다른 기존 토큰 위반(제목·이유 상자 글자 등) | 이번에 바꾸는 버튼 줄만 토큰화. 나머지는 별도 |
| 서버·DB | 기존 `completed` 경로로 충분(D-7) |
