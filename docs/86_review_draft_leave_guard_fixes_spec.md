# 86. 감상 작성 중 이탈 시 소실 정정 명세

작성일: 2026-11-20
대상 브랜치 기준: main (`0ca4651`, 작업 트리에 docs/84·85 미커밋 변경 있음)
선행 문서: `docs/00_ui_style_rules.md`(UI-5.6 작성 중 이탈 → `confirmDiscard`), `docs/31_usability_review_fixes_spec.md`

정정 명세다. 앱 파일만 바꾼다. 서버·DB·배포 없음. 화면 모양과 문구는 바꾸지 않고, 떠날 때 확인 창만 더한다.

## 1. 문제 정의

| ID | 지금 사용자가 겪는 것 | 고친 뒤 |
|----|----------------------|---------|
| F-1 | 작품 상세 "내 감상"에서 별점·한줄 후기·소감(최대 2,000자)·본 시기·스포일러를 바꾸고 "감상 저장"을 누르지 않은 채 뒤로 가거나(헤더·안드로이드 뒤로·iOS 스와이프·"내 목록" 버튼), 웹에서 새로고침·탭을 닫으면 **경고 없이 전부 사라진다** | 저장하지 않은 변경이 있으면 `confirmDiscard`로 묻는다. 웹은 새로고침·닫기 때 브라우저 경고를 띄운다. 저장한 뒤에는 묻지 않는다 |
| F-2 | 작품 정보(공개일·완결일)가 늦게 도착하면 사용자가 이미 고친 "본 시기" 칸이 기본값으로 덮인다 | 사용자가 바꾼 칸은 유지하고, 바꾸지 않은 칸만 새 기본값을 받는다 |

같은 앱의 핀 작성 화면은 이미 이탈을 막는다(`src/components/pins/PinComposer.tsx:70-107`). 감상 입력만 규칙 UI-5.6을 어긴다.

## 2. 근본 원인

1. `src/components/content/ContentReviewEditor.tsx:50-55` — 입력 6개가 각각 로컬 `useState`이고, 저장은 "감상 저장" 버튼(`:224-233`, `submit` `:84-140`)뿐이다. 이 파일에 `usePreventRemove`·`confirmDiscard`·`beforeunload`가 없다. 편집기는 작품 상세의 한 구역이라(`app/content/[id].tsx:423`), 화면이 스택에서 빠지면 상태가 함께 사라진다.
2. `:64-77`은 리뷰 조회 값이 바뀌면, `:79-82`는 본 시기 값이나 기본값(`releaseWatchDate`·`completionWatchDate`, 공개일·완결일에서 만든 값)이 바뀌면 **입력 칸을 무조건 다시 채운다**. 사용자가 바꾼 값인지 보지 않는다(F-2).
3. 빈 본 시기 칸은 공개일·완결일로 미리 채워진다(`parseWatchDateParts` `:315-319`). 그래서 "DB 값과 다르면 변경됨"으로 판정하면 화면을 열기만 해도 변경으로 잡힌다. **비교 기준은 처음 화면에 보인 값**이어야 한다.

## 3. 재현 시나리오

1. 로그인 → 라이브러리에 있는 작품 상세를 연다.
2. "소감"에 글을 쓰고 "감상 저장"을 누르지 않는다.
3. 헤더 뒤로가기(웹은 브라우저 뒤로 또는 새로고침)를 누른다.
4. 확인 없이 나가지고, 다시 들어오면 소감이 비어 있다.

## 4. 설계 결정

### D-1. 변경 판정은 "처음 보인 값(기준값)"과 비교한다 (최우선)
기준값 = 리뷰 조회 값 + 본 시기(없으면 기존 기본값)로 만든 스냅샷. 화면을 열기만 했을 때는 변경 없음이다. 어기면 상세에서 나갈 때마다 확인 창이 뜬다.

### D-2. 원천 값이 바뀌면 필드별로 다시 맞춘다
리뷰 조회 값·본 시기·기본값이 바뀌면, **기준값과 같은(사용자가 안 바꾼) 필드만** 새 값으로 바꾸고 바뀐 필드는 유지한다. 그다음 기준값을 새 값으로 바꾼다(F-2). 날짜는 연·월·일 문자열을 값으로 비교한다(객체 참조 비교 금지).

### D-3. 저장이 성공하면 기준값을 저장한 값으로 바꾼다
리뷰 저장 성공 → 리뷰 4필드의 입력·기준값을 저장 응답으로. 본 시기 저장 성공 → 두 날짜의 입력·기준값을 `parseWatchDateParts(저장한 ISO 날짜, 기존 기본값)`으로. 한쪽만 성공하면 그쪽만 바꾼다. 저장 직후 나가도 묻지 않는다.

### D-4. 이탈 보호는 핀 작성 화면과 같은 방식이다
`PinComposer.tsx:70-107`의 패턴을 그대로 쓴다: `usePreventRemove(!leaving && (dirty || saving), …)` → 저장 중이면 무시, 아니면 `confirmDiscard(() => leave(() => navigation.dispatch(data.action))))`, `leaving` 상태와 `leaveAction` ref로 확인 뒤 한 번만 이동, 웹은 `dirty || saving`일 때 `beforeunload`에서 `preventDefault`. 새 확인 문구를 만들지 않는다(`src/utils/confirmDiscard.ts` 그대로).

### D-5. 판정은 순수 함수로 둔다
새 파일 `src/utils/reviewDraft.ts`. 편집기의 `WatchDateParts`·`EMPTY_WATCH_DATE`·`parseWatchDateParts`를 이 파일로 옮기고(동작 동일) 편집기는 import한다.

### D-6. 저장 규칙·입력 검증·화면은 그대로다
`submit`의 검증 순서·오류 문구·저장 호출, 기본값 계산(`createReleaseWatchDate`·`createCompletionWatchDate`), 화면 모양·문구는 바꾸지 않는다. 다른 화면으로 **넘어가는**(push) 이동·탭 전환은 화면이 남으므로 묻지 않는다(지금도 입력이 남는다).

> D-N은 임의로 바꾸지 않는다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 자동 저장 | 저장 규칙(빈 입력 오류, 날짜 검증, 두 번의 저장 호출)이 바뀌고 실패 처리 설계가 따로 필요하다 |
| 임시 저장(AsyncStorage)으로 복구 | 계정·작품별 키, 만료, 복구 안내가 필요하다. UI-5.6 기준은 확인 창이다 |
| DB 값과 비교 | 미리 채운 본 시기 때문에 항상 변경으로 잡힌다(2장 3) |

## 6. 계약 (`src/utils/reviewDraft.ts`)

```ts
export interface WatchDateParts { year: string; month: string; day: string }
export const EMPTY_WATCH_DATE: WatchDateParts;
export function parseWatchDateParts(value: string | null, fallback?: WatchDateParts | null): WatchDateParts; // 기존과 동일

export interface ReviewDraft {
  rating: number | null; oneLineReview: string; body: string; isSpoiler: boolean;
  firstWatchedDate: WatchDateParts; lastWatchedDate: WatchDateParts;
}
export function createReviewDraftSnapshot(input: {
  review: { rating: number | null; one_line_review: string | null; body: string | null; is_spoiler: boolean } | null;
  firstWatchedAt: string | null; lastWatchedAt: string | null;
  firstFallback: WatchDateParts | null; lastFallback: WatchDateParts | null;
}): ReviewDraft; // rating ?? null, one_line_review ?? "", body ?? "", is_spoiler ?? false, 날짜는 parseWatchDateParts(값, 기본값)
export function isReviewDraftDirty(current: ReviewDraft, baseline: ReviewDraft): boolean; // 6필드 값 비교, 문자열은 원문 그대로
export function rebaseReviewDraft(current: ReviewDraft, previousBaseline: ReviewDraft, nextBaseline: ReviewDraft): ReviewDraft; // 필드별: current==previous → next, 아니면 current
```

편집기: 6개 `useState`를 `draft`(ReviewDraft) 하나와 `baseline` 하나로 바꾼다. 원천 스냅샷은 `useMemo`(리뷰 4값·본 시기 2값·기본값 2개 의존). `review.isLoading` 동안은 다시 맞추지 않는다(지금처럼 입력 비활성). 렌더의 `value`/`onChange`는 `draft.필드`/`setDraft(d => ({ ...d, 필드 }))`로 바꾸고 화면 구조는 그대로 둔다.

## 7. 데이터 모델 / SQL
없음.

## 8. 화면 명세
보이는 화면 변화 없음. 떠날 때만 기존 `confirmDiscard` 창(웹 `window.confirm`, 앱 "작성한 내용을 버릴까요?")이 뜬다. UI 규칙 준수(UI-1~UI-13).

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 열기만 하고 나감(본 시기 기본값 표시 중) | 묻지 않음 | T-1, T-4 |
| E-2 | 필드 하나라도 바꾸고 나감 | 확인 창. 취소하면 입력 유지, 확인하면 이동 | T-2, M-1 |
| E-3 | 저장 성공 직후 나감 | 묻지 않음 | T-5, M-3 |
| E-4 | 저장 중 나가기 | 막고 창도 띄우지 않음(PinComposer와 같음) | T-6 |
| E-5 | 공개일·완결일이 늦게 도착, 사용자가 이미 본 시기를 고침 | 고친 칸 유지, 안 고친 칸만 새 기본값 | T-3 |
| E-6 | 같은 값으로 다시 조회됨 | 변화 없음 | T-3 |
| E-7 | 웹 새로고침·닫기(변경 있음 / 없음) | 브라우저 경고 / 경고 없음 | T-6, M-2 |
| E-8 | 라이브러리에서 삭제 확정 후 이동, 저장 안 한 감상 있음 | 확인 창이 한 번 더 뜬다(감상은 저장되지 않았으므로 의도된 동작) | M-1 |
| E-9 | 에피소드·핀·인물로 넘어감, 탭 전환 | 묻지 않고 입력 유지 | M-1 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 위치는 새 파일 `src/utils/reviewDraft.test.ts`. 이름은 `86 T-N: …`. 수정 전에는 모듈이 없어 모두 **실패**한다.

| ID | 이름 | 입력 | 기대 |
|----|------|------|------|
| T-1 | `86 T-1: an untouched draft is not dirty` | 같은 값의 스냅샷 두 개(날짜 객체는 서로 다른 참조) | `false` |
| T-2 | `86 T-2: every field change makes the draft dirty` | 6필드를 하나씩 바꾼 6경우(한줄 후기 끝 공백 추가 포함) | 모두 `true` |
| T-3 | `86 T-3: rebasing keeps user edits and refreshes untouched fields` | previous: 기본값 날짜 2016-03-05/2016-05-01, current: 소감·첫 날짜만 수정, next: 날짜 기본값 2016-03-04/2016-06-01. 같은 값의 next도 확인 | 소감·첫 날짜는 current, 마지막 날짜는 next. 같은 값 next면 current 그대로 |
| T-4 | `86 T-4: snapshot uses saved values, then fallbacks` | review null + 날짜 null + 기본값 / review 값 + `"2026-01-01"` | 기본값 칸 / `{2026,01,01}`과 리뷰 값, `""`·`null`·`false` 기본 처리 |
| T-5 | `86 T-5: a saved snapshot stays clean after the server catches up` | draft=baseline=저장 스냅샷, 같은 값의 원천 스냅샷으로 rebase | `isReviewDraftDirty` `false` |
| T-6 | `86 T-6: the review editor wires the leave guard` | `ContentReviewEditor.tsx` 원문(`node:fs`) | `usePreventRemove(`·`confirmDiscard(`·`"beforeunload"`·`isReviewDraftDirty(`·`rebaseReviewDraft(` 모두 포함, `useState<WatchDateParts>` 없음 |

보존: 기존 전체 테스트 assertion을 바꾸지 않는다.

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/reviewDraft.ts` | 새 파일, 6장 |
| `src/utils/reviewDraft.test.ts` | 새 파일, T-1~T-6 |
| `src/components/content/ContentReviewEditor.tsx` | 날짜 타입·파서 import로 교체, draft/baseline, D-2·D-3, 이탈 보호(D-4) |
| `docs/development_next_steps.md` | 맨 위 "감상 작성 중 이탈 보호 (docs/86, 날짜)" |
| `docs/README.md` | 86행 상태 |

## 12. 범위 밖

- 저장 규칙·검증·문구, 기본값 계산, 화면 모양(D-6). 자동 저장·임시 저장(5장).
- 다른 입력: 회차 진행 숫자, 본 횟수, 프로필 이름 편집.
- 이번에 함께 찾았지만 별도 명세가 필요한 것: 라이브러리 공유 링크를 앱에서 멈출 수 없음(만료 없음, 별점·한줄 후기가 실시간으로 보임), 운영에 `delete-account` 미배포(회원 탈퇴 실패), "완료" 표시가 본 날짜를 남기지 않음.

## 13. 확실하지 않음
- `usePreventRemove`가 웹 브라우저 뒤로가기에서도 확인 창을 띄우는지는 PinComposer와 같은 조건으로 M-1에서 확인한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 작품 상세 "내 감상"에서 저장하지 않은 변경이 이탈 시 경고 없이 사라지는 문제(F-1)와 늦게 도착한 기본값이 고친 본 시기를 덮는 문제(F-2)를 고친다. 정정 작업이며 서버·DB·화면 모양은 바꾸지 않는다.

# READ FIRST
1. `docs/00_ui_style_rules.md` — UI-5.6, UI-6.1(확인 창), UI-13.
2. `docs/86_review_draft_leave_guard_fixes_spec.md` — 이 명세(D-1~D-6, 6장 계약, 9·10장).
3. `AGENTS.md` — 테스트 규칙. 테스트에서 React Native·Supabase를 import하지 않는다.
4. `src/components/pins/PinComposer.tsx:70-107` — 따라 할 이탈 보호 패턴.
5. `src/components/content/ContentReviewEditor.tsx` 전체.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 기준값은 처음 보인 값이다. 열기만 하고 나갈 때 확인 창이 뜨면 실패다.
- **D-2·D-3.** 필드별 rebase, 저장 성공 시 기준값 갱신(성공한 쪽만).
- **D-4.** PinComposer와 같은 `leaving` 패턴과 `confirmDiscard`. 새 문구·새 확인 함수 금지.
- **D-6.** `submit` 검증·저장 호출·문구, 기본값 계산, 렌더 구조를 바꾸지 않는다.

# STEP 1 — 실패하는 테스트부터
10장 T-1~T-6을 쓰고 `npm test`로 모두 실패하는 것을 확인한다. 아니면 멈추고 보고한다.

# STEP 2 — 순수 함수
6장대로 `src/utils/reviewDraft.ts`를 만든다. 옮긴 `parseWatchDateParts`의 동작은 그대로다. T-1~T-5 통과.

# STEP 3 — 편집기
`ContentReviewEditor.tsx`를 6장 마지막 문단·D-2~D-4대로 바꾼다. T-6과 전체 테스트 통과.

# STEP 4 — 기록
`docs/development_next_steps.md` 맨 위 항목(상태, 실패 출력, 검사 결과, M-1~M-4 실행/미실행 사유), `docs/README.md` 86행 상태.

# 수동 확인
| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 소감 입력 → 헤더 뒤로·"내 목록" → 확인 창, 취소 시 입력 유지, 확인 시 이동. 에피소드로 넘어갔다 오면 입력 유지. 아무것도 안 바꾸고 나가면 창 없음 |
| M-2 | 웹 375 | 변경 후 새로고침 → 브라우저 경고, 변경 없으면 경고 없음 |
| M-3 | 웹 1440 | 저장 성공 직후 뒤로 → 창 없음 |
| M-4 | 앱(iOS 세로) | 스와이프 뒤로 → 네이티브 확인 창, 키보드가 저장 버튼을 가리지 않음 |

저장 버튼은 테스트용 작품에서만 누르고, 사용자의 실제 감상을 바꾸지 않는다. 로그인할 수 없으면 대신 로그인하지 말고 미실행으로 적는다.

# 검증 명령
```
npm test
npm run typecheck
npm run lint
```
기존 테스트가 하나도 깨지지 않아야 한다(시작 때 기준선을 직접 기록, 끝난 뒤 = 기준선 + 6).

# DEFINITION OF DONE
- [ ] T-1~T-6이 수정 전 실패, 수정 후 통과
- [ ] 기존 테스트 개수가 줄지 않았고 assertion을 바꾸지 않았다
- [ ] UI-13.2 토큰·`Alert` 검사 0줄
- [ ] 웹·앱 수동 확인 표를 보고했다
- [ ] `npm run typecheck`, `npm run lint` 통과

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/reviewDraft.ts
src/utils/reviewDraft.test.ts
src/components/content/ContentReviewEditor.tsx
docs/development_next_steps.md
docs/README.md
```

# 보고 항목
1. STEP 1 실패 출력 2. `npm test` before/after 3. typecheck·lint 4. 추가 테스트 ID·이름 5. 편집기 diff 요약 6. M-1~M-4 결과 또는 미실행 사유 7. D-1~D-6 중 문제라고 본 항목(보고만) 8. 사람이 할 후속 작업

# 금지사항
- 배포 명령을 실행하지 않는다. DB 마이그레이션을 만들지 않는다.
- 테스트 표 행을 줄이지 않고, assertion을 완화하지 않는다.
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다.
- 테스트 파일에서 React Native·Expo·Supabase를 import하지 않는다(타입은 `import type`).
