# 48. 작품 상세 — "완료"면 모든 화를 본 것으로, 그 밖의 흐름 정정

작성일: 2026-10-09
대상 브랜치 기준: `main` (`6734575`) + 미커밋 작업(`docs/41`~`47` 구현 등). 작성 시점 `npm test` 1000개 중 999개 통과(2026-10-09 재확인: `c6a0e7e` + `docs/49`·`50` 구현 후 1034개 중 1033개) — 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙)**, `docs/39`(작품 상세 개편), `docs/12`·`docs/14`(시청 진행·직접 설정 우선), `docs/31` U-4·U-8(핀·편집 흐름, 범위 밖)

> **근거.** 사용자 캡처(웹, "로또 1등도 출근합니다"). 상태는 "완료", 본 횟수 1회인데 시청 진행 카드가 "8 / 10화 · 직접 설정함", "다음에 볼 화 · 9화"를 보여 준다.
> 사용자 요청: "상태를 완료 처리했는데 시청 진행 중이었던 게 아직도 남아 있어. 완료 처리하면 전부 봤다고 판단해야 해. 작품 상세에서 흐름이 매끄럽지 않은 부분이 더 있는지 수정할 부분까지 포함해서."

---

## 1. 문제 정의

| ID | 우선 | 증상 | 원인 |
|----|------|------|------|
| F-1 | P0 | "완료"인데 시청 진행이 8/10, "다음에 볼 화 · 9화" | `src/utils/episodeProgress.ts:30` `resolveEpisodeProgress`가 상태를 모른다. 직접 설정한 위치(8)가 늘 우선이다. `app/content/[id].tsx:220~236` `toggleStatus`는 상태·본 횟수만 바꾼다 |
| F-2 | P0 | 검색·추천에서 "완료"로 바로 추가한 작품은 "0 / 10화"로 보이고, 카드가 "설정하라"는 강조색이다 | 같은 원인. 새로 추가한 작품은 진행 기록이 없어 `progress_source: "none"` → `EpisodeProgressCard` 137행 강조 |
| F-3 | P1 | 상태를 바꿔도 화면의 진행 표시가 바로 갱신되지 않는다(목록 화면 포함) | `src/hooks/useLibrary.ts:377` `updateLibraryItemStatusesInCache`가 진행 필드(`progress_source`·`effective_watched_through`·`next_episode_number`)를 다시 계산하지 않는다. 성공 후 무효화도 `refetchType: "inactive"`라 열린 화면은 다시 받지 않는다 |
| F-4 | P0(웹) | 시청 진행 카드 "되돌리기"를 눌러도 웹에서 아무 일이 없다 | `src/components/content/EpisodeProgressCard.tsx:121~130` `Alert.alert` 확인 창(웹에서 동작 안 함, UI-6.1) |
| F-5 | P0(웹) | 에피소드 화면에서 회차를 길게 눌러 "여기까지 봤음"을 설정할 수 없다(웹). 실패도 웹에서는 안 보인다 | `app/content/[id]/episodes.tsx:85~105` 확인·실패 모두 `Alert.alert` |
| F-6 | P2 | 감상 기록 저장 실패 시 앱에서는 같은 문구가 칸 아래와 팝업에 두 번 뜨고, 서버 영문 원문이 나갈 수 있다 | `src/components/content/ContentReviewEditor.tsx:98·137` `Alert.alert` + `error.message` 그대로(UI-6.3) |

## 2. 재현 시나리오

1. 10화 드라마에서 진행을 8화로 저장한 뒤 상태를 "완료"로 바꾼다 → 8/10, "다음에 볼 화 · 9화"가 남는다(F-1).
2. 추천 카드 "완료" → 작품 상세 → "0 / 10화", 강조된 진행 카드(F-2).
3. 웹에서 진행 카드 "되돌리기" → 반응 없음(F-4). 에피소드 화면에서 회차 길게 누름 → 반응 없음(F-5).

## 3. 설계 결정

### D-1. "완료"면 모든 화를 본 것으로 **계산**한다(DB에 쓰지 않는다)
- `resolveEpisodeProgress`에 `completed` 입력을 더한다. 다음 세 조건이 모두 맞으면 나머지 판정보다 먼저 이 결과를 쓴다.
  - 영화가 아니다
  - `completed`다
  - 전체 화수(`episodeCount`)를 안다
- 결과는 `source: "completed"`, `watchedThrough = episodeCount`, `next: null`, `isComplete: true`, `ratio: 1`이다.
- **저장된 직접 설정 위치(8)는 지우지 않는다.**
  - 실수로 "완료"를 눌렀다가 "보는 중"으로 돌아가면 8화가 그대로 돌아온다.
  - 검색·추천·일괄 등록 등 어느 경로로 완료가 되었든, 기존 데이터든 같은 규칙이 적용된다.
- 전체 화수를 모르면 지금과 같다(계산할 수 없음).

### D-2. 진행을 계산하는 세 곳이 같은 규칙을 쓴다
- 다음 세 곳이 같은 순수 함수 `resolveLibraryItemProgress(item, statuses)`를 쓴다.
  - 서비스 매핑(`src/services/library.ts:535`)
  - 직접 설정 캐시 갱신(`useLibrary.ts:464`)
  - 상태 변경 캐시 갱신(`useLibrary.ts:377`)
- 그래서 상태를 바꾸는 즉시 상세·목록·홈의 진행 표시가 함께 바뀐다(F-3).

### D-3. 시청 진행 카드의 "완료 모드"
- 조건: `item.statuses`에 `completed`가 있고, 카드의 `totalEpisodes`가 1 이상.
- 표시
  - 머리: `"{total} / {total}화"`, 오른쪽 작은 글자 "완료로 표시됨"
  - 진행 막대: 100%
  - 상태 줄: "모든 화 시청 완료"
  - 안내: "완료 상태라 모든 화를 본 것으로 계산해요. 다시 보고 있다면 상태를 '보는 중'으로 바꾸면 진행 위치를 고칠 수 있어요."
- 숨김: 시즌 선택, 회차 빠른 선택, 입력, 빠른 행동(아직 안 봄·전부 봤음·되돌리기), 저장 버튼. 완료 상태에서 저장한 위치는 화면에 반영되지 않아 혼란만 주기 때문이다.
- 그대로 둠: "에피소드 보기" 버튼, "에피소드 체크로는 N화까지" 안내.
- 카드 강조색(진행 미설정 강조)을 쓰지 않는다.
- "보는 중으로 바꾸기" 버튼은 두지 않는다. 상태 바꾸기는 위의 상태 선택에서 한다. 이유는 D-7.

### D-4. "되돌리기" 확인은 `confirmDestructive`로 한다
`confirmDestructive({ title: "시청 진행 되돌리기", message: "직접 설정한 진행 위치를 지우고 에피소드 체크 기준으로 되돌릴까요?", confirmLabel: "되돌리기", onConfirm: () => onSave(null) })`. 웹은 `window.confirm`, 앱은 네이티브 확인 창이다.

### D-5. 에피소드 화면 "여기까지 봤음"은 확인 창 없이 바로 저장하고, 되돌리기 토스트를 준다
- 길게 누르면 바로 저장한다. 성공하면 토스트 "{n}화까지 봤음으로 표시했어요."와 행동 "되돌리기"를 띄운다. 되돌리기는 저장 전 직접 설정 값으로 복원하며, 그 값이 없었으면 `null`이다.
- 실패하면 토스트 "시청 진행을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."를 띄운다.
- 완료 상태면 저장하지 않고 정보 토스트를 띄운다: "완료 상태라 모든 화를 본 것으로 표시돼요. 상태를 '보는 중'으로 바꾸면 진행 위치를 정할 수 있어요."
- 근거: 되돌릴 수 있는 가벼운 변경은 확인 창 대신 되돌리기 토스트로 한다(UI-6.2).

### D-6. 감상 기록 저장 오류는 칸 아래 문구 하나로 한다
- `ContentReviewEditor`의 `Alert.alert` 두 곳을 지운다. 칸 아래 `submitError`는 지금도 표시된다.
- 저장 실패 문구는 `userFacingErrorMessage(error, "감상 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.")`다. 날짜 검증 문구(한국어)는 그대로다.

### D-7. 완료를 해제할 때의 본 횟수 동작은 바꾸지 않는다
- `toggleStatus`의 `completedRemoved → watchCount: 0`은 그대로 둔다.
- "다시 보는 중"(재시청)에서 본 횟수가 0이 되는 문제는 사용자 결정이 필요한 별도 항목이다(12장).
- 그래서 완료 모드 카드에 상태를 바꾸는 버튼을 새로 두지 않는다.

### D-8. 판정·문구는 순수 함수다
`src/utils/episodeProgress.ts`, `src/utils/contentDetailView.ts`에 둔다(UI-12.1).

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 4. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| "완료"를 누르면 직접 설정 위치를 마지막 화로 **저장** | 실수로 누르면 원래 위치(8화)를 잃는다. 검색·추천·일괄 등록 등 모든 완료 경로와 기존 데이터에 따로 쓰기를 넣어야 한다. 계산 규칙 하나가 더 단순하고 되돌리기 쉽다 |
| 완료 시 모든 회차를 "체크"로 저장 | 회차 수만큼 쓰기가 생기고, 회차 체크는 핀·회차 기록의 의미가 따로 있다 |
| 완료 모드에서도 입력칸을 열어 둠 | 저장해도 화면이 바뀌지 않아(완료가 우선) 고장처럼 보인다 |
| "되돌리기"를 확인 없이 실행 | 직접 설정 위치를 지우는 동작이라 확인이 맞다(기존 의도 유지) |

## 5. 계약

### 5.1 `src/types/library.ts`
```ts
export type EpisodeProgressSource = "manual" | "episode_progress" | "none" | "completed";
```

### 5.2 `src/utils/episodeProgress.ts`
```ts
export interface EpisodeProgressInput {
  contentType: ContentType;
  episodeCount: number | null;
  watchedEpisodeCount: number;
  derivedWatchedThrough: number | null;
  manualWatchedThrough: number | null;
  completed?: boolean; // 기본 false
}
```
- `resolveEpisodeProgress` 판정 순서
  1. 영화 → 지금과 같다(`source: "none"`)
  2. `completed === true && episodeCount !== null && episodeCount > 0` → `{ source: "completed", watchedThrough: episodeCount, nextEpisodeNumber: null, totalEpisodes: episodeCount, isComplete: true, progressRatio: 1 }`
  3. 그 외 → 지금 판정 그대로(manual → episode_progress → none)
- 신규 함수
  ```ts
  export function resolveLibraryItemProgress(
    item: Pick<LibraryListItem, "content_type" | "episode_count" | "watched_episode_count" | "derived_watched_through" | "manual_watched_absolute_number">,
    statuses: readonly WatchStatus[]
  ): Pick<LibraryListItem, "progress_source" | "effective_watched_through" | "next_episode_number">;
  // resolveEpisodeProgress({ contentType: item.content_type, episodeCount: item.episode_count,
  //   watchedEpisodeCount: item.watched_episode_count, derivedWatchedThrough: item.derived_watched_through,
  //   manualWatchedThrough: item.manual_watched_absolute_number, completed: statuses.includes("completed") })
  // → { progress_source: source, effective_watched_through: watchedThrough, next_episode_number: nextEpisodeNumber }
  ```

### 5.3 `src/utils/contentDetailView.ts` (추가)
```ts
export const EPISODE_PROGRESS_COMPLETED_COPY = {
  modeLabel: "완료로 표시됨",
  summary: "모든 화 시청 완료",
  hint: "완료 상태라 모든 화를 본 것으로 계산해요. 다시 보고 있다면 상태를 '보는 중'으로 바꾸면 진행 위치를 고칠 수 있어요."
} as const;

export const MANUAL_PROGRESS_COPY = {
  undo: "되돌리기",
  saveFailed: "시청 진행을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
  completedNotice: "완료 상태라 모든 화를 본 것으로 표시돼요. 상태를 '보는 중'으로 바꾸면 진행 위치를 정할 수 있어요.",
  resetTitle: "시청 진행 되돌리기",
  resetMessage: "직접 설정한 진행 위치를 지우고 에피소드 체크 기준으로 되돌릴까요?",
  resetConfirm: "되돌리기",
  reviewSaveFailed: "감상 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
} as const;

export function manualProgressSavedToast(episodeNumber: number): string; // `${n}화까지 봤음으로 표시했어요.` (n은 0 이상 정수로 내림)
export function isEpisodeProgressCompletedMode(input: { statuses: readonly WatchStatus[]; totalEpisodes: number | null }): boolean;
// statuses.includes("completed") && totalEpisodes !== null && totalEpisodes > 0
```

### 5.4 적용 지점
| 파일 | 변경 |
|------|------|
| `src/services/library.ts` 535~570행 | `resolveEpisodeProgress(...)`에 `completed: <그 행의 statuses>.includes("completed")`를 더한다(매핑에서 쓰는 `statuses` 값 그대로). 나머지는 그대로 |
| `src/hooks/useLibrary.ts` `updateLibraryItemStatusesInCache`(377행) | 갱신하는 항목에 `...resolveLibraryItemProgress(item, normalizedStatuses)`를 더한다 |
| `src/hooks/useLibrary.ts` `updateLibraryItemManualProgressInCache`(464행) | `resolveEpisodeProgress` 입력에 `completed: item.statuses.includes("completed")`를 더한다 |
| `src/components/content/EpisodeProgressCard.tsx` | D-3 완료 모드(`isEpisodeProgressCompletedMode({ statuses: item.statuses, totalEpisodes })`), D-4 `confirmDestructive`. 기존 `Alert` import를 지운다 |
| `app/content/[id]/episodes.tsx` 85~105행 | D-5 |
| `src/components/content/ContentReviewEditor.tsx` 98·137행 | D-6 |

## 6. 엣지 케이스

| # | 상황 | 기대 동작 | 연결 |
|---|------|----------|------|
| E-1 | 진행 8/10에서 "완료" | 10/10 "완료로 표시됨", 다음 화 없음, 입력 숨김 | P-1, M-1 |
| E-2 | 완료 → "보는 중" | 저장돼 있던 8/10이 다시 보임 | P-2·P-7, M-1 |
| E-3 | 추천·검색에서 "완료"로 추가 | 상세에서 10/10, 강조색 없음 | P-5, M-2 |
| E-4 | 전체 화수 모름 + 완료 | 지금과 같음(직접 설정 기준), 완료 모드 아님 | P-3, C-3 |
| E-5 | 영화 + 완료 | 진행 카드 없음(지금과 같음) | P-4 |
| E-6 | 상태 변경 직후(서버 응답 전) | 진행 표시가 즉시 바뀌고, 실패하면 이전 값으로 복원 | P-7, M-1 |
| E-7 | 홈 이어보기 | "보는 중"만 대상이라 완료 작품은 나오지 않음(지금과 같음) | 기존 테스트 |
| E-8 | 웹 "되돌리기" | 확인 창 → 확인 시 에피소드 체크 기준 | M-1 |
| E-9 | 에피소드 화면 길게 누름(보는 중) | 바로 저장, 되돌리기 토스트, 되돌리기 시 이전 값 | C-2, M-3 |
| E-10 | 에피소드 화면 길게 누름(완료) | 저장 안 함, 안내 토스트 | M-3 |
| E-11 | 감상 기록 저장 실패(영문 오류) | 칸 아래 한국어 문구 하나 | M-1 |
| E-12 | 마지막 화까지 저장(보는 중) | 지금처럼 "완료로 표시할까요?" 토스트 → 누르면 완료 모드 | 기존, M-1 |

## 7. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다. 한 행 = `it` 하나.** P-2·P-3·P-4·P-6·P-8은 기존 동작을 지키는 **보존 테스트**라 구현 전에도 통과하는 것이 정상이다. 그 외 행(P-1·P-5·P-7·C-1~C-3)은 구현 전에 실패해야 한다.

### `src/utils/episodeProgress.test.ts` (추가)
공통 입력 `base = { contentType: "drama", episodeCount: 10, watchedEpisodeCount: 3, derivedWatchedThrough: 3, manualWatchedThrough: 8 }`
| ID | 입력 | 기대 |
|----|------|------|
| P-1 | `{ ...base, completed: true }` | `{ source: "completed", watchedThrough: 10, nextEpisodeNumber: null, totalEpisodes: 10, isComplete: true, progressRatio: 1 }` |
| P-2 (보존) | `{ ...base, completed: false }` | `{ source: "manual", watchedThrough: 8, nextEpisodeNumber: 9, totalEpisodes: 10, isComplete: false, progressRatio: 0.8 }` |
| P-3 (보존) | `{ ...base, episodeCount: null, completed: true }` | `source: "manual"`, `watchedThrough: 8`, `isComplete: false`, `totalEpisodes: null` |
| P-4 (보존) | `{ ...base, contentType: "movie", completed: true }` | `source: "none"`, `watchedThrough: 0`, `progressRatio: null` |
| P-5 | `{ contentType: "anime", episodeCount: 12, watchedEpisodeCount: 0, derivedWatchedThrough: null, manualWatchedThrough: null, completed: true }` | `source: "completed"`, `watchedThrough: 12`, `nextEpisodeNumber: null` |
| P-6 (보존) | `base`(completed 없음) | P-2와 같음 |
| P-7 | `resolveLibraryItemProgress({ content_type: "drama", episode_count: 10, watched_episode_count: 3, derived_watched_through: 3, manual_watched_absolute_number: 8 }, ["completed", "recommended"])` / 같은 항목, `["watching"]` | `{ progress_source: "completed", effective_watched_through: 10, next_episode_number: null }` / `{ progress_source: "manual", effective_watched_through: 8, next_episode_number: 9 }` |
| P-8 (보존) | P-1 입력에 `episodeCount: 0` | `source: "manual"`, `watchedThrough: 0`(0으로 클램프) — 완료 규칙 미적용 |

### `src/utils/contentDetailView.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| C-1 | 상수 | `EPISODE_PROGRESS_COMPLETED_COPY`·`MANUAL_PROGRESS_COPY`가 5.3 값과 `deepEqual` |
| C-2 | `manualProgressSavedToast(3)`, `(0)`, `(2.7)` | `"3화까지 봤음으로 표시했어요."`, `"0화까지 봤음으로 표시했어요."`, `"2화까지 봤음으로 표시했어요."` |
| C-3 | `isEpisodeProgressCompletedMode({ statuses: ["completed"], totalEpisodes: 10 })` / `(["completed"], null)` / `(["completed"], 0)` / `(["watching"], 10)` / `(["completed", "recommended"], 1)` | `true` / `false` / `false` / `false` / `true` |

### 수동 확인 (UI-14.3, 사람·로그인 필요)

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | E-1·E-2·E-6·E-8·E-11·E-12. 완료 모드 카드 모양(입력 숨김, 안내 문구), 상태 전환 즉시 반영 |
| M-2 | 웹 375 | 추천 "완료" 추가 → 상세 10/10(E-3), 한 열 배치 넘침 없음 |
| M-3 | 웹 + 앱(iOS 세로) | 에피소드 화면 길게 누름: 보는 중이면 저장 + 되돌리기 토스트, 완료면 안내 토스트(E-9·E-10). 앱에서 "되돌리기" 확인 창이 네이티브로 뜸 |

## 8. 변경 파일

| 파일 | 변경 |
|------|------|
| `src/types/library.ts` | 5.1 |
| `src/utils/episodeProgress.ts` | 5.2 |
| `src/utils/episodeProgress.test.ts` | P-1~P-8 |
| `src/utils/contentDetailView.ts` | 5.3 |
| `src/utils/contentDetailView.test.ts` | C-1~C-3 |
| `src/services/library.ts` | 5.4 |
| `src/hooks/useLibrary.ts` | 5.4 |
| `src/components/content/EpisodeProgressCard.tsx` | D-3·D-4 |
| `app/content/[id]/episodes.tsx` | D-5 |
| `src/components/content/ContentReviewEditor.tsx` | D-6 |

## 9. 범위 밖

| 항목 | 이유 |
|------|------|
| 완료 해제 시 본 횟수 0(`toggleStatus`의 `completedRemoved`) | 재시청("보는 중")에서 본 횟수를 잃는 문제가 있지만, 실수로 누른 완료를 되돌리는 경우와 구분할 수 없어 사용자 결정이 필요하다(D-7) |
| 에피소드 화면 → "시청 위치 설정"이 상세 화면을 하나 더 쌓는 문제(`router.push`) | 스택 이동 규칙(`docs/31` U-4)과 함께 별도로 다룬다 |
| 시즌 단위 등록 항목의 전체 화수 기준(콘텐츠 전체 vs 시즌) | `docs/17` 범위 |
| 홈·라이브러리 카드 디자인 | 진행 값만 바뀌고 모양은 그대로 |
| DB·서버 | 계산 규칙만 바뀐다(D-1) |
