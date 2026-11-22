# 92. 본 시기 기본값이 몰래 저장되는 문제 정정 명세

작성일: 2026-11-22
대상 브랜치 기준: main (0ca4651) + 미커밋 docs/84~91 작업
선행 문서: [86 감상 작성 중 이탈 보호](86_review_draft_leave_guard_fixes_spec.md), [89 오프라인 저장 갇힘 정정](89_offline_save_trap_fixes_spec.md)

## 1. 문제 정의

docs/91 구현을 검증한 뒤 다른 구멍을 찾다가 발견했다.

| ID | 증상 | 심각도 |
|----|------|--------|
| F-1 | 작품 상세 "내 감상"에서 **별점만 누르고 저장해도** "처음 본 시기"에는 작품 공개일, "마지막 본 시기"에는 마지막 방영일이 저장된다. 예를 들어 2013년 애니를 오늘 보고 별점만 남기면 "마지막 본 시기 = 2013-09-28"로 기록된다. | 높음(기록 데이터가 틀림) |
| F-2 | 그 결과 프로필의 "올해 본 작품"(`TasteReportCard.tsx:62-63`)과 "연도별 본 작품" 그래프가 실제 본 해가 아니라 **방영 연도**로 센다. 오늘 본 옛 작품은 올해에 잡히지 않는다. | 높음(F-1의 결과) |
| F-3 | 본 시기 칸을 비우면 연도 칸에 검색 필터 문구 "전체 연도"가 보인다. 감상 기록에 맞지 않는 문구다. | 낮음 |

사용자가 기록하지 않은 값을 화면에 미리 채워 두고, 다른 칸을 저장할 때 함께 저장하는 것이 문제다. 마지막 방영일을 보여 주는 힌트(`createDateHint`)는 이미 따로 있다.

## 2. 근본 원인

1. **빈 본 시기 칸을 공개일·마지막 방영일로 미리 채운다.**
   - `ContentReviewEditor.tsx:55-66`의 원천 스냅샷이 `firstFallback: releaseWatchDate`, `lastFallback: completionWatchDate`를 넘긴다.
   - `parseWatchDateParts(value, fallback)`(`src/utils/reviewDraft.ts:9-13`)는 저장값이 없으면 기본값을 돌려준다.
   - 저장 성공 뒤 반영(`:187-188`)도 같은 기본값을 쓴다.
2. **저장할 때 "DB 값과 다르면 바뀐 것"으로 판정한다.**
   - `:154-155`는 `hasWatchDateChange = nextFirstWatchedAt !== (firstWatchedAt ?? null) || …`이다.
   - 미리 채운 날짜는 DB의 `null`과 다르므로, 사용자가 건드리지 않아도 바뀐 것으로 판정된다.
   - 그래서 별점·후기 저장과 함께 `useUpdateLibraryWatchDates`가 호출된다(`:180-189`).
3. **통계는 `last_watched_at`만 본다.**
   - `src/utils/profileStats.ts:93-106`의 `countCurrentYearWatchedItems`가 이 값을 본다.
   - `src/utils/profileDashboard.ts:193`의 연도별 모델도 같다.
   - 본 시기를 쓰는 곳은 이 편집기뿐이다. 상태 "완료"는 날짜를 쓰지 않는다.
4. **F-3**: `src/components/common/YearSelect.tsx:44-46, :54-56`의 빈 값 문구가 "전체 연도"로 고정이다. 이 컴포넌트는 라이브러리·검색 필터에도 쓰인다(`library.tsx:620`, `ContentSearchBar.tsx:395`, `LibraryFilterBottomSheet.tsx:154`).

## 3. 재현 시나리오

1. 테스트 계정에서 공개일·마지막 방영일이 있는 옛 작품(예: 2013년 방영)을 라이브러리에 넣는다. 본 시기는 기록하지 않는다.
2. 작품 상세 "내 감상"을 열면 처음 본 시기 2013.04.07, 마지막 본 시기 2013.09.28이 채워져 있다.
3. 별점 8만 누르고 "감상 저장"을 누른다.
4. 라이브러리 항목의 `first_watched_at`·`last_watched_at`가 2013-04-07·2013-09-28로 저장된다. 프로필 "올해 본 작품"에 이 작품이 들어가지 않고, 연도별 그래프의 2013년 막대가 늘어난다.

## 4. 설계 결정

### D-1. 기록하지 않은 본 시기는 빈 칸으로 보인다 (최우선)
- 편집기는 원천 스냅샷과 저장 후 반영에 기본값을 넘기지 않는다(`firstFallback: null`, `lastFallback: null`, `parseWatchDateParts(…, null)`).
- 저장값이 없으면 칸이 비어 있다.
- 그 결과 `hasWatchDateChange`는 손대지 않은 빈 칸을 `null === null`로 보아 바뀌지 않은 것으로 판정한다. 별점·후기만 저장하면 본 시기 저장 호출이 일어나지 않는다. 저장 판정 코드(`:154-159`)는 바꾸지 않는다.
- 공개일·마지막 방영일 계산(`createReleaseWatchDate`·`createCompletionWatchDate`)은 그대로 둔다. 연도 선택 범위(`startYear`), 최소 날짜 검증, 힌트 문구에 계속 쓴다.
- `reviewDraft.ts`는 바꾸지 않는다. 기본값 인자를 받는 계약과 docs/86 T-1~T-6는 그대로다.

### D-2. 상태 변경으로 날짜를 자동 기록하지 않는다
"완료"를 누를 때 오늘 날짜를 넣는 방식은 쓰지 않는다. 지난 작품을 한꺼번에 등록할 때(넷플릭스 가져오기·온보딩 등) 모두 올해 본 작품이 되어 F-2를 반대로 만든다. 본 시기는 사용자가 직접 넣은 값만 저장한다.

### D-3. "오늘" 버튼으로 가장 흔한 입력을 한 번에 한다
- 미리 채우기가 없어지면서 생기는 입력 부담을 줄이려고, "마지막 본 시기" 칸 옆에 "오늘" 버튼을 둔다.
- 누르면 기기 현지 날짜로 연·월·일을 채운다. 값은 새 순수 함수 `todayWatchDateParts(now)`로 만든다.
- 저장은 기존 "감상 저장"으로만 한다. 버튼은 칸만 채운다.
- "처음 본 시기"에는 두지 않는다.

### D-4. 감상 기록의 빈 연도는 "기록 안 함"으로 보인다
- `YearSelect`에 선택 prop `emptyLabel?: string`(기본값 `"전체 연도"`)을 추가한다.
- 버튼 문구와 목록 첫 항목에 이 값을 쓴다.
- 편집기만 `emptyLabel="기록 안 함"`을 넘긴다. 필터 화면 세 곳은 지금과 같다.

### D-5. 이미 저장된 잘못된 날짜는 이번에 고치지 않는다
- 기존 행 중 "공개일·마지막 방영일과 정확히 같은 본 시기"는 미리 채운 값이 저장됐을 가능성이 높다.
- 그러나 실제로 방영일에 본 사용자도 있어 자동으로 구분할 수 없다. 마이그레이션이나 일괄 수정은 하지 않는다(12·13장).

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| 미리 채우기는 두고 "사용자가 바꾼 칸만" 저장 | 화면에 보이는 날짜가 저장되지 않은 값이 된다. 새로 열면 같은 날짜가 보여 기록된 것으로 오해한다 |
| "완료" 상태에서 오늘 날짜 자동 기록 | D-2. 일괄 등록이 모두 올해 본 작품이 된다 |
| 통계에서 방영일과 같은 본 시기를 빼기 | 실제로 방영일에 본 기록까지 빠진다. 원인(잘못된 저장)이 남는다 |
| 기존 행 일괄 null 처리 | 사용자가 직접 넣은 같은 날짜를 지울 수 있다(D-5) |
| "처음 본 시기"에도 "오늘" | 처음 본 날은 대개 과거라 효과가 작다. 칸 폭만 좁아진다 |

## 6. 계약

```ts
// src/utils/watchDateInput.ts (신규, 순수 — RN import 금지)
import type { WatchDateParts } from "@/utils/reviewDraft";

export const WATCH_DATE_INPUT_COPY = {
  emptyYear: "기록 안 함",
  today: "오늘",
  todayAccessibilityLabel: "마지막 본 시기를 오늘로 채우기"
} as const;

/** 기기 현지 날짜. 월·일은 앞자리 0 없이 문자열(입력 칸 표기와 같음). */
export function todayWatchDateParts(now: Date): WatchDateParts;
// { year: String(now.getFullYear()), month: String(now.getMonth() + 1), day: String(now.getDate()) }

// src/components/common/YearSelect.tsx
interface YearSelectProps { /* 기존 */ emptyLabel?: string } // 기본값 "전체 연도"
```

`toIsoWatchDate`(`:375-400`)는 월·일을 `Number`로 읽는다. 따라서 `"3"`과 `"03"`을 모두 받고, 저장 형식(`YYYY-MM-DD`)은 바뀌지 않는다.

`ContentReviewEditor.tsx` 변경:

| 위치 | 지금 | 바꾼 뒤 |
|------|------|---------|
| 원천 스냅샷 `:64-65` | `firstFallback: releaseWatchDate, lastFallback: completionWatchDate` | `firstFallback: null, lastFallback: null` |
| 스냅샷 의존 배열 | `completionWatchDate`, `releaseWatchDate` 포함 | 두 값 제거(스냅샷이 더 이상 쓰지 않음) |
| 저장 후 반영 `:187-188` | `parseWatchDateParts(next…, releaseWatchDate / completionWatchDate)` | `parseWatchDateParts(next…, null)` |
| `WatchDateInput` | `YearSelect`에 `emptyLabel` 없음 | `emptyLabel={WATCH_DATE_INPUT_COPY.emptyYear}` |
| "마지막 본 시기" | — | `onPickToday={() => setDraft(d => ({ ...d, lastWatchedDate: todayWatchDateParts(new Date()) }))}` |

`WatchDateInput`에 선택 prop `onPickToday?: () => void`를 추가한다. 값이 있을 때만 날짜 행 끝에 "오늘" 버튼을 그린다.

## 7. 데이터 모델 / SQL

해당 없음. 스키마, RLS, Edge Function을 바꾸지 않는다.

## 8. 화면 명세

UI 규칙 준수(UI-1~UI-13). 바뀌는 곳은 "내 감상"의 본 시기 영역뿐이다.

| 요소 | 표시 |
|------|------|
| 기록 없는 본 시기 | 연도 "기록 안 함"(기존 placeholder 색), 월·일 빈 칸 |
| 기록 있는 본 시기 | 지금과 같음 |
| "오늘" 버튼 | "마지막 본 시기" 날짜 행 끝. `accessibilityRole="button"`, `accessibilityLabel`은 `WATCH_DATE_INPUT_COPY.todayAccessibilityLabel`, 높이 최소 44, `disabled`·`aria-disabled`는 편집기의 `pending`과 같다. 모양은 같은 파일의 보조 버튼 토큰을 따른다(UI 규칙의 보조 버튼). 좁은 화면(375)에서 행이 넘치면 줄바꿈한다 |
| 힌트 | 지금과 같음(공개일·마지막 방영일 안내) |

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 본 시기 미기록, 별점만 저장 | 리뷰만 저장, 본 시기 저장 호출 없음, DB 날짜 null 유지 | T-2, M-1 |
| E-2 | 본 시기 미기록, 편집기를 열기만 함 | 칸 비어 있음, 나갈 때 묻지 않음(docs/86 E-1) | T-2, M-1 |
| E-3 | "오늘" 누르고 저장 | 마지막 본 시기 = 오늘, 프로필 "올해 본 작품" +1 | T-1, M-2 |
| E-4 | "오늘"만 누르고 나감 | 변경으로 보고 확인 창(docs/86 계약) | M-2 |
| E-5 | 이미 기록된 본 시기 | 그대로 표시·유지 | T-2(보존) |
| E-6 | 연도만 고름 | 기존과 같이 1월 1일로 저장 | 보존 |
| E-7 | 처음 본 시기만 입력 | 그 값만 저장, 마지막은 null | 보존 |
| E-8 | 공개일이 오늘보다 늦은 작품에서 "오늘" | 저장 시 기존 검증 "작품 공개일(…) 이후로 입력해 주세요." | 보존, M-2 |
| E-9 | 라이브러리·검색 필터의 연도 선택 | "전체 연도" 그대로 | T-3 |
| E-10 | 12월 31일 23시 등 날짜 경계 | 기기 현지 날짜 기준 | T-1 |
| E-11 | 기존에 방영일과 같은 날짜로 저장된 행 | 그대로 표시(D-5). 사용자가 지우거나 고칠 수 있음 | — |

## 10. 테스트 표

새 파일 `src/utils/watchDateInput.test.ts`에 둔다. `node:test`와 `node:assert/strict`를 쓴다. import 범위는 다음과 같다.
- 순수 `watchDateInput`·`reviewDraft`
- 소스 문자열 검사용 `node:fs`

RN·expo·Supabase는 import하지 않는다.

| ID | 이름 | 내용 | 수정 전 |
|----|------|------|---------|
| T-1 | 92 T-1: today fills the local date | `todayWatchDateParts(new Date(2026, 10, 22, 23, 59))`→`{ year: "2026", month: "11", day: "22" }`, `new Date(2026, 0, 5, 0, 0)`→`{ "2026", "1", "5" }`, `new Date(2025, 11, 31, 23, 59)`→`{ "2025", "12", "31" }`(로컬 생성자 사용으로 시간대 독립). `WATCH_DATE_INPUT_COPY`가 6장 세 문구와 정확히 같다 | 실패(모듈 없음) |
| T-2 | 92 T-2: the editor no longer pre-fills watch dates | `ContentReviewEditor.tsx` 소스 검사. `firstFallback: null`과 `lastFallback: null`이 있다. `firstFallback: releaseWatchDate`, `lastFallback: completionWatchDate`, `parseWatchDateParts(nextFirstWatchedAt, releaseWatchDate)`, `parseWatchDateParts(nextLastWatchedAt, completionWatchDate)`는 없다. `hasWatchDateChange` 판정식 `nextFirstWatchedAt !== (firstWatchedAt ?? null)`는 그대로 있다. 함께 순수 검사로 `createReviewDraftSnapshot({ review: { rating: 8, one_line_review: null, body: null, is_spoiler: false }, firstWatchedAt: null, lastWatchedAt: null, firstFallback: null, lastFallback: null })`의 두 날짜가 `EMPTY_WATCH_DATE`와 같다 | 실패(소스 검사) |
| T-3 | 92 T-3: empty year label is configurable and filters keep theirs | `YearSelect.tsx`에 `emptyLabel`와 기본값 `"전체 연도"`가 있고, 고정 문자열 `>전체 연도<`가 남아 있지 않다. 편집기에 `emptyLabel={WATCH_DATE_INPUT_COPY.emptyYear}`와 `onPickToday`가 있다. `library.tsx`·`ContentSearchBar.tsx`·`LibraryFilterBottomSheet.tsx`의 `<YearSelect` 줄에는 `emptyLabel`가 없다 | 실패 |
| 보존 | docs/86 T-1~T-6, 89 T-1~T-4, 기존 전체 | 그대로 통과. 86 T-4(기본값 인자 계약)도 `reviewDraft.ts` 미변경으로 통과 | 통과 |

**수동 확인 (UI-14.3)**

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 검증용 작품(본 시기 미기록)에서 본 시기 칸이 "기록 안 함"과 빈 월·일로 보인다. 별점만 저장하면 Network 탭에 본 시기 저장 요청이 없고 새로고침해도 칸이 비어 있다. 확인 뒤 검증용 별점을 원래대로 되돌린다. |
| M-2 | 웹 375 | "오늘"을 누르면 오늘 날짜가 채워지고 나가려 하면 확인 창이 뜬다. 저장하면 프로필 "올해 본 작품"이 1 늘어난다. 행이 넘치지 않는다. 확인 뒤 검증용 날짜를 지우고 저장한다. 사용자의 실제 감상은 바꾸지 않는다. |
| M-3 | 웹 1440 | 라이브러리·검색 필터 연도 선택은 "전체 연도" 그대로다. |
| M-4 | iOS 세로 | M-1·M-2와 같다. 키보드가 "오늘" 버튼을 가리지 않는다. 실행 환경이 없으면 미실행 사유를 보고한다. |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/watchDateInput.ts` | 신규(D-3, D-4 문구) |
| `src/utils/watchDateInput.test.ts` | 신규 T-1~T-3 |
| `src/components/content/ContentReviewEditor.tsx` | 6장 표(D-1, D-3, D-4) |
| `src/components/common/YearSelect.tsx` | `emptyLabel` prop(D-4) |
| `docs/development_next_steps.md`, `docs/README.md` | 작업 기록·92행 상태 |

## 12. 범위 밖

- 이미 저장된 방영일과 같은 본 시기 정리(D-5). 필요하면 사람이 별도 결정한다.
- 상태 변경 시 날짜 자동 기록(D-2), 회차 진행으로 본 시기 추정.
- 통계 계산식(`profileStats`·`profileDashboard`) 변경.
- "처음 본 시기"의 "오늘" 버튼.

## 13. 확실하지 않음 — 별도 검증 필요

- 운영 데이터에서 미리 채운 날짜가 저장된 행의 규모. 개인 데이터라 이번에 조회하지 않았다. 사람이 원하면 읽기 전용 집계로 확인할 수 있다. 예: 본 시기가 작품 `air_date`·`end_date`와 정확히 같은 행 수.
- 기기 현지 날짜와 서버 저장(`DATE`)의 경계는 지금과 같다. 저장은 `YYYY-MM-DD` 문자열이라 시간대 변환이 없다고 보지만, 앱에서 확인한다(M-4).

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. "내 감상"에서 기록하지 않은 본 시기가 공개일·마지막 방영일로 미리 채워져 별점만 저장해도 함께 저장되는 문제를 고친다. 정정 작업이다.

| ID | 결함 |
|----|------|
| F-1 | 별점·후기만 저장해도 공개일·마지막 방영일이 본 시기로 저장된다 |
| F-2 | 그 때문에 프로필 "올해 본 작품"·연도별 그래프가 방영 연도로 센다 |
| F-3 | 본 시기의 빈 연도에 필터 문구 "전체 연도"가 보인다 |

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙.
2. `docs/92_watch_date_default_save_fixes_spec.md` — 이 명세. D-1~D-5, 9장 E-1~E-11, 10장 테스트 표.
3. `docs/86_review_draft_leave_guard_fixes_spec.md` — 바꾸지 않을 편집기 draft·이탈 보호 계약.
4. `AGENTS.md` — 테스트 규칙. 테스트 파일에서 React Native·expo·Supabase 모듈을 import하면 실행이 깨진다.
5. `src/components/content/ContentReviewEditor.tsx`(:55-80, :154-159, :180-189, :247-264, :298-340, :375-400), `src/utils/reviewDraft.ts`, `src/components/common/YearSelect.tsx`.

# 시작 상태 (반드시 유지)
- 현재 `npm test` 1,948개 통과. 시작할 때 실제 값을 다시 기록한다.
- docs/84~91 미커밋 변경을 보존한다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 기록 없는 본 시기는 빈 칸이다. 편집기는 기본값을 넘기지 않는다. `hasWatchDateChange` 판정과 저장 호출 순서는 바꾸지 않는다. 어기면 별점 저장이 다시 방영일을 기록한다.
- **D-2.** 상태 변경·완료 처리에서 날짜를 쓰지 않는다.
- **D-3.** "오늘"은 마지막 본 시기 칸만 채우고 저장하지 않는다.
- **D-4.** `YearSelect`의 기본 빈 문구는 "전체 연도"다. 필터 화면 세 곳은 바꾸지 않는다.
- **D-5.** 기존 데이터를 고치는 코드·SQL을 만들지 않는다.
- `src/utils/reviewDraft.ts`, `createReleaseWatchDate`·`createCompletionWatchDate`·`createDateHint`·`toIsoWatchDate`는 바꾸지 않는다.

# STEP 1 — 실패하는 테스트부터
`src/utils/watchDateInput.test.ts`에 10장 T-1~T-3을 쓴다. `npm test`로 T-1~T-3이 실패하는 것을 눈으로 확인한다. 실패하지 않는 행이 있으면 멈추고 보고한다.

# STEP 2 — 순수 함수·문구
6장 계약대로 `src/utils/watchDateInput.ts`를 만든다. T-1이 통과한다.

# STEP 3 — YearSelect
`emptyLabel` prop을 추가하고 버튼 문구(`:44-46`)와 목록 첫 항목(`:54-56`) 두 곳에 쓴다. 다른 동작·스타일은 그대로 둔다.

# STEP 4 — 편집기
6장 표대로 바꾼다. `WatchDateInput`에 `onPickToday`를 추가하고 8장대로 "오늘" 버튼을 그린다. T-2·T-3과 전체 테스트가 통과한다.

# 엣지 케이스 (전부 처리, 명세 9장)
9장 표 E-1~E-11 전부. E-5~E-8은 기존 동작을 보존하는 항목이다.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(기준선: 시작 때 기록한 값, 예상 1,948개). Node 24가 필요하면 `scenenote-verify`의 `--node-bin` 방식을 쓴다.

# DEFINITION OF DONE
- [ ] T-1~T-3이 수정 전에 실패하는 것을 확인했고 수정 후 통과한다.
- [ ] 기존 테스트 개수가 줄지 않았고, 기존 assertion을 바꾸지 않았다(docs/86 T-1~T-6 포함).
- [ ] 별점만 저장할 때 본 시기 저장 요청이 없다(M-1).
- [ ] UI-13.2 토큰·`Alert` 검사 0줄.
- [ ] 웹·앱 수동 확인 표(M-1~M-4)를 보고했다. 실행하지 못한 행은 사유를 적는다.
- [ ] typecheck·lint 오류 0.

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/watchDateInput.ts
src/utils/watchDateInput.test.ts
src/components/content/ContentReviewEditor.tsx
src/components/common/YearSelect.tsx
docs/development_next_steps.md
docs/README.md
```
`docs/README.md`는 92행 상태 칸만, `docs/development_next_steps.md`는 맨 위 작업 기록만 고친다.

# 보고 항목
1. STEP 1 실패 테스트의 실제 출력
2. `npm test` before / after 통과 개수
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. 변경 diff 요약(파일별 줄 수)
6. M-1~M-4 결과 또는 미실행 사유
7. D-1~D-5 중 문제라고 본 항목(바꾸지 말고 보고만)
8. 사람이 할 후속 작업(웹 재빌드, 기존 데이터 정리 여부 결정)

# 금지사항
- 배포 명령(`npx supabase functions deploy`, vercel 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다. 운영 DB에 쓰거나 개인 데이터를 조회하지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 의존성을 추가·변경하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- 수동 확인 때 사용자의 실제 감상·본 시기를 바꾸지 않는다. 검증용 작품만 쓰고 원래대로 되돌린다.
