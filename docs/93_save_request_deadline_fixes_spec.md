# 93. 감상·핀 저장 응답 지연 시간 제한 명세

작성일: 2026-11-22
대상 브랜치 기준: main (0ca4651) + 미커밋 docs/84~92 작업
선행 문서: [86 감상 작성 중 이탈 보호](86_review_draft_leave_guard_fixes_spec.md), [89 오프라인 저장 갇힘 정정](89_offline_save_trap_fixes_spec.md)

## 1. 문제 정의

docs/89는 "오프라인에서 저장이 시작조차 안 되는" 경우를 고쳤다. **연결은 됐지만 응답이 오지 않는 경우**는 범위 밖(89 E-5, 12장)으로 남겼다. 지하철·엘리베이터·약한 Wi-Fi처럼 요청이 나가고 응답이 끊긴 상황이다.

| ID | 증상 | 심각도 |
|----|------|--------|
| F-1 | 작품 상세 "내 감상"에서 저장한 뒤 응답이 오지 않으면 버튼이 "저장 중"에 멈추고 입력이 잠긴다. 뒤로가기(헤더·스와이프·Android 뒤로)도 막힌다(docs/86 E-4). 언제 풀릴지 알 수 없다. | 중간 |
| F-2 | 핀 작성·편집·삭제도 같다. 저장 전 확인 조회(작품·회차)와 저장 요청 모두 시간 제한이 없다. 그동안 `isSaving` 때문에 이탈이 막힌다(`PinComposer.tsx:93-97`). | 중간 |

저장 요청에는 시간 제한이 없다.
- Supabase JS는 기본 시간 제한이 없다.
- 브라우저 `fetch`도 기본 시간 제한이 없다.
- 앱의 실제 네트워크 제한은 플랫폼마다 다르다(13장).

라이브러리 공유 생성만 15초 제한을 따로 두고 있다(`app/(tabs)/library.tsx:355-366`, `:856-863`).

## 2. 근본 원인

1. **저장 서비스에 `abortSignal`이 없다.**
   - `src/services/reviews.ts:19-53`의 `saveContentReview`(upsert)
   - `src/services/library.ts:333-347`의 `updateLibraryWatchDates`
   - `src/services/pins.ts:91-118`의 `createPin`·`updatePin`(`save_timeline_pin` RPC)
   - `src/services/pins.ts:120-123`의 `deletePin`
   - `src/services/pinContext.ts:4-10`의 `getPinContext`(핀 저장 전 확인 조회)
   - 위 함수 모두 요청을 끊을 방법이 없다.
   - 저장소에는 조회에서 `abortSignal`을 쓰는 예가 이미 있다(`searchFilterPreferences.ts:7`, `subscribedOtts.ts:8`, `libraryShare.ts:83`).
2. **이탈 보호가 저장이 끝날 때까지 기다린다.**
   - `ContentReviewEditor`의 `saving`(`submitting || saveReview.isPending || saveWatchDates.isPending`)이 그 조건이다.
   - `PinComposer`의 `isSaving`(`checking || …isPending`)도 같다.
   - docs/86 D-4대로 저장 중 이탈을 조용히 막는다. 요청이 끝나지 않으면 이 상태가 끝나지 않는다.
3. **화면에서만 시간을 재면 풀리지 않는다.**
   - `Promise.race`로 화면의 `await`만 끊어도 TanStack mutation은 계속 `isPending`이다. `saving`이 풀리지 않는다.
   - 그래서 요청 자체를 끊어(abort) mutation이 실패로 끝나게 해야 한다.

## 3. 재현 시나리오

1. 웹 8081에서 개발자 도구 Network를 사용자 지정 조건(지연 30,000ms)으로 둔다. 또는 Supabase 주소로 가는 요청을 일시 정지(request blocking 대신 throttling)한다.
2. 검증용 작품에서 별점을 바꾸고 "감상 저장"을 누른다.
3. 30초 동안 "저장 중"에서 멈추고 뒤로가기가 반응하지 않는다.

## 4. 설계 결정

### D-1. 저장 요청은 15초 안에 끝난다 (최우선)
- 새 순수 함수 `runWithSaveDeadline(run, ms = SAVE_TIMEOUT_MS)`(`src/utils/saveDeadline.ts`)는 `AbortController`를 만들어 `run(signal)`에 넘긴다.
- `ms`가 지나면 `abort()`한다. 동시에 `SAVE_TIMEOUT_MESSAGE` 오류로 **반드시** 거부한다.
- `run` 안에서 signal을 쓰지 않는 단계(예: 세션 확인 `getSessionUserId`)가 멈춰 있어도 결과는 제한 시간에 끝난다.
- 15초는 라이브러리 공유 생성의 기존 값과 같다.

### D-2. 시간 제한은 서비스 함수 안에서 건다
- 대상은 2장 1번의 다섯 함수다. 각 함수 본문을 `runWithSaveDeadline`로 감싸고, Supabase 요청마다 `.abortSignal(signal)`을 붙인다.
- 그러면 mutation의 `mutationFn`이 실패로 끝나 `isPending`이 풀린다.
- 기존 오류 처리(`assertLibraryWriteApplied`, `atomicPinSaveError` 등)와 반환 값은 그대로다.
- `getPinContext`는 조회 화면(`usePinContext`)도 쓴다. 그래서 내부에서 제한을 걸지 않는다. 선택 인자 `signal?: AbortSignal`만 받는다.
- `PinComposer`의 저장 전 확인에서만 `runWithSaveDeadline((signal) => getPinContext(contentId, episodeId, signal))`로 감싼다.

### D-3. 시간 초과는 "저장됐을 수도 있음"으로 안내하고, 다시 저장해도 안전하다
- 요청이 서버에 도착한 뒤 끊기면 저장이 됐을 수 있다. 그래서 문구는 다음과 같다. `"응답이 늦어 저장 결과를 확인하지 못했어요. 연결을 확인한 뒤 다시 저장해 주세요."`
- 다시 저장해도 중복이 생기지 않는다.
  - 감상: `upsert`(`user_id,content_id`)다.
  - 본 시기: 같은 행 update다.
  - 핀 만들기: 같은 폼은 같은 `client_request_id`를 쓰고, 서버는 같은 내용의 재시도에 기존 핀을 돌려준다(`20261116124742_atomic_pin_save.sql:84-104`).
  - 핀 수정: 같은 행 update다.
  - 핀 삭제: 다시 삭제해도 0행이고 오류가 없다.
- 화면은 이 문구를 기존 `catch`(`userFacingErrorMessage`)로 그대로 보여 준다. 한글 문구라 통과한다.

### D-4. 이탈 보호·초안 계약은 그대로다
- docs/86의 `usePreventRemove`, 저장 중 조용히 막기, `confirmDiscard`, `reviewDraft`, docs/89의 오프라인 사전 확인과 `networkMode: "always"`는 바꾸지 않는다.
- 시간 초과 뒤에는 저장 실패와 같다. 입력이 남고(dirty), 나가면 확인 창이 뜬다.

### D-5. 조회·Edge Function 호출에는 제한을 걸지 않는다
- 시간 제한 대상은 위 저장 경로뿐이다.
- Supabase 클라이언트 전역 `fetch` 교체나 조회 쿼리, 검색·추천 Edge Function 호출은 바꾸지 않는다. 오래 걸리는 정상 요청(가져오기·추천)이 끊기지 않게 하려는 것이다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| 화면에서 `Promise.race`만 | mutation이 계속 pending이라 `saving`과 이탈 차단이 풀리지 않는다(2장 3번) |
| Supabase 전역 `fetch`에 시간 제한 | 검색·추천·가져오기 같은 긴 정상 요청까지 끊는다 |
| 저장 중에도 이탈 허용 | docs/86 D-4, docs/89 기각 이유와 같다 |
| 시간 초과 시 자동 재시도 | 느린 연결에 부하를 더한다. 사용자가 결과를 모른 채 기다린다 |
| 30초 이상 | 사용자가 앱이 멈췄다고 느끼는 시간보다 길다. 기존 공유 15초와도 다르다 |

## 6. 계약

```ts
// src/utils/saveDeadline.ts (신규, 순수 — RN·Supabase import 금지)
export const SAVE_TIMEOUT_MS = 15_000;
export const SAVE_TIMEOUT_MESSAGE = "응답이 늦어 저장 결과를 확인하지 못했어요. 연결을 확인한 뒤 다시 저장해 주세요.";

export async function runWithSaveDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number = SAVE_TIMEOUT_MS
): Promise<T>;
```

`runWithSaveDeadline`의 판정 순서:
1. `const controller = new AbortController()`. 타이머가 `ms` 뒤에 `controller.abort()`한다.
2. `Promise.race([run(controller.signal), abortRejection])`를 기다린다. `abortRejection`은 signal의 `abort` 이벤트에서 `new Error(SAVE_TIMEOUT_MESSAGE)`로 거부한다.
3. `run`이 거부됐을 때 `controller.signal.aborted`이면 원래 오류 대신 `new Error(SAVE_TIMEOUT_MESSAGE)`를 던진다. abort 때문에 Supabase가 낸 영문 오류를 감추려는 것이다. 아니면 원래 오류를 그대로 던진다.
4. `finally`에서 타이머를 지운다. 제한 시간 전에 끝나면 나중에 abort되지 않는다.
5. 끝난 뒤 `abortRejection`이 처리되지 않은 거부로 남지 않게 한다(`.catch(() => {})` 등).

서비스 적용 형태(예: 감상):
```ts
export function saveContentReview(input: SaveContentReviewInput): Promise<ContentReview> {
  return runWithSaveDeadline(async (signal) => {
    // 기존 본문 그대로. Supabase 요청 체인 끝에 .abortSignal(signal)을 붙인다.
  });
}
```

| 함수 | 파일 | signal 위치 |
|------|------|-------------|
| `saveContentReview` | `src/services/reviews.ts` | upsert 체인(`.select(...).single()` 앞 또는 뒤, 빌더가 허용하는 위치) |
| `updateLibraryWatchDates` | `src/services/library.ts` | update 체인 |
| `createPin`·`updatePin` | `src/services/pins.ts` | `savePinAtomically`에 `signal` 인자를 추가하고 `supabase.rpc(...)` 체인에 붙임 |
| `deletePin` | `src/services/pins.ts` | delete 체인 |
| `getPinContext(contentId, episodeId, signal?)` | `src/services/pinContext.ts` | 두 조회 모두 `signal`이 있을 때만 |
| `PinComposer.save` | `src/components/pins/PinComposer.tsx:180` | `await runWithSaveDeadline((signal) => getPinContext(contentId, episodeId, signal))` |

`createPin`의 `createIdentities` 캐시와 `client_request_id` 처리는 바꾸지 않는다. 시간 초과 뒤 같은 폼에서 다시 저장하면 같은 ID를 쓴다.

## 7. 데이터 모델 / SQL

해당 없음. 서버·DB·Edge Function을 바꾸지 않는다.

## 8. 화면 명세

새 요소는 없다. 시간 초과 문구는 기존 오류 자리에 나온다.
- 감상: `submitError`, `accessibilityLiveRegion="polite"`
- 핀: `setError`

UI 규칙 준수(UI-1~UI-13).

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 정상 응답(15초 안) | 지금과 같음. 끝난 뒤 abort 없음 | T-1, T-4 |
| E-2 | 감상 저장 응답 없음 | 15초 뒤 시간 초과 문구, "감상 저장" 버튼 복귀, 입력 유지, 나가면 확인 창 | T-2, M-1 |
| E-3 | 감상 성공 후 본 시기 저장 응답 없음 | 감상만 확정(docs/86 D-3), 본 시기는 입력 유지, 시간 초과 문구 | T-2, M-1 |
| E-4 | 핀 저장 전 확인 조회 응답 없음 | 15초 뒤 시간 초과 문구, 저장 요청 없음, 이탈 가능(확인 창) | T-2, T-5, M-2 |
| E-5 | 핀 저장 RPC 응답 없음, 실제로는 서버 저장됨 | 시간 초과 문구. 다시 저장하면 같은 ID로 기존 핀을 받아 성공 | T-5, M-2 |
| E-6 | 핀 삭제 응답 없음 | 시간 초과 문구, 편집 화면 유지. 다시 삭제하면 성공 | T-5 |
| E-7 | abort로 Supabase가 영문 AbortError 반환 | 사용자에게는 한글 시간 초과 문구 | T-3 |
| E-8 | 제한 전에 자체 오류(검증·권한 등) | 원래 한글 오류 그대로 | T-4 |
| E-9 | 세션 확인(`getSessionUserId`)이 멈춤 | 15초 뒤 시간 초과 문구로 끝남 | T-2 |
| E-10 | 오프라인 | docs/89 그대로(사전 확인 문구, 요청 없음) | 보존 |
| E-11 | 핀 상세 조회 화면(`usePinContext`) | 바꾸지 않음(시간 제한 없음) | T-5 |

## 10. 테스트 표

새 파일 `src/utils/saveDeadline.test.ts`에 둔다. `node:test`와 `node:assert/strict`를 쓴다. import 범위는 다음과 같다.
- 순수 `saveDeadline`
- 소스 문자열 검사용 `node:fs`

RN·expo·Supabase는 import하지 않는다. 시간 의존 테스트는 짧은 `ms`(예: 30ms)를 넘겨 실제 타이머로 검사한다.

| ID | 이름 | 내용 | 수정 전 |
|----|------|------|---------|
| T-1 | 93 T-1: fast saves resolve and are never aborted | `ms=50`, `run`이 5ms 뒤 `"ok"`를 반환하면 결과가 `"ok"`다. 받은 signal을 보관했다가 100ms 기다린 뒤에도 `signal.aborted === false`다 | 실패(모듈 없음) |
| T-2 | 93 T-2: a hanging save settles with the timeout message | `ms=30`, `run`이 signal을 무시하고 끝나지 않는 promise를 반환하면 300ms 안에 `SAVE_TIMEOUT_MESSAGE`로 거부한다. 받은 signal은 `aborted === true`다 | 실패 |
| T-3 | 93 T-3: abort errors become the Korean timeout message | `ms=30`, `run`이 signal의 abort 이벤트에서 `new Error("AbortError: The user aborted a request.")`로 거부하면 결과 오류 메시지가 `SAVE_TIMEOUT_MESSAGE`다 | 실패 |
| T-4 | 93 T-4: own errors pass through before the deadline | `ms=100`, `run`이 즉시 `new Error("핀을 찾을 수 없어요.")`로 거부하면 같은 메시지로 거부한다. 200ms 뒤 signal은 abort되지 않았다. 처리되지 않은 거부가 없다(`process.on("unhandledRejection")` 감시) | 실패 |
| T-5 | 93 T-5: save services and pin pre-check use the deadline | 소스 문자열 검사. `reviews.ts`의 `saveContentReview`, `library.ts`의 `updateLibraryWatchDates`, `pins.ts`의 `createPin`·`updatePin`·`deletePin` 본문에 `runWithSaveDeadline(`가 있고, 각 파일의 해당 요청에 `.abortSignal(signal)`이 있다. `pinContext.ts`의 `getPinContext` 시그니처에 `signal?: AbortSignal`이 있다. `PinComposer.tsx`에 `runWithSaveDeadline((signal) => getPinContext(contentId, episodeId, signal))`가 있다. `usePinContext` 훅 파일에는 `runWithSaveDeadline`가 없다 | 실패 |
| T-6 | 93 T-6: deadline constants are fixed | `SAVE_TIMEOUT_MS === 15000`, `SAVE_TIMEOUT_MESSAGE`가 6장 문구와 정확히 같다 | 실패(모듈 없음) |
| 보존 | 86 T-1~T-6, 89 T-1~T-4, 92 T-1~T-3, 핀 저장 관련 기존 테스트(`pinSave` 등), 기존 전체 | 그대로 통과 | 통과 |

**수동 확인 (UI-14.3)**

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 검증용 작품에서 개발자 도구로 Supabase REST 요청만 지연시킨다(예: Network 사용자 지정 지연 20,000ms 이상, 또는 로컬 대체 API에서 응답 보류). 감상 저장 후 약 15초에 시간 초과 문구가 나오고 버튼이 돌아오며, 헤더 뒤로를 누르면 확인 창이 뜬다. 지연을 풀고 다시 저장하면 성공한다. 사용자 실제 감상은 바꾸지 않는다. |
| M-2 | 웹 375 | 핀 작성에서 같은 지연으로 저장하면 15초 뒤 문구가 나온다. 지연을 풀고 다시 저장하면 핀이 하나만 생긴다(같은 ID). 검증용 핀은 확인 뒤 삭제한다. |
| M-3 | iOS 세로 | 네트워크 링크 조절기(Network Link Conditioner) 등 지연 환경에서 M-1과 같다. 실행 환경이 없으면 미실행 사유를 보고한다. |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/saveDeadline.ts` | 신규(D-1) |
| `src/utils/saveDeadline.test.ts` | 신규 T-1~T-6 |
| `src/services/reviews.ts` | `saveContentReview` 감싸기·signal(D-2) |
| `src/services/library.ts` | `updateLibraryWatchDates` 감싸기·signal(D-2) |
| `src/services/pins.ts` | `createPin`·`updatePin`·`deletePin`·`savePinAtomically` signal(D-2) |
| `src/services/pinContext.ts` | `getPinContext` 선택 `signal`(D-2) |
| `src/components/pins/PinComposer.tsx` | 저장 전 확인 감싸기(D-2) |
| `docs/development_next_steps.md`, `docs/README.md` | 작업 기록·93행 상태 |

`ContentReviewEditor.tsx`와 훅 파일(`useReviews.ts`·`useLibrary.ts`·`useTimelinePins.ts`)은 바꾸지 않는다.

## 12. 범위 밖

- 다른 저장(상태 바꾸기, 진행 저장, 본 횟수, 라이브러리 추가·삭제, 공유 중지). 이탈을 막지 않아 갇히지 않는다. 필요하면 같은 함수로 후속 적용한다.
- 조회·Edge Function 호출의 시간 제한(D-5).
- 라이브러리 공유 생성의 기존 `withTimeout`(abort 없음) 교체.
- docs/92 "오늘" 버튼의 앞자리 0 차이(같은 날짜를 다시 누르면 변경으로 판정). 별도 작은 정정으로 다룬다.

## 13. 확실하지 않음 — 별도 검증 필요

- 앱(iOS·Android)의 실제 네트워크 기본 제한 시간. iOS URLSession 기본 요청 제한은 60초로 알려져 있다. Android(OkHttp)는 React Native 설정에 따라 다르다. 둘 다 15초보다 길거나 없다고 보고 이 명세를 적용한다. M-3로 확인한다.
- React Native의 `AbortController`가 Supabase `fetch`를 실제로 끊는지. RN 0.6x 이후 지원하는 것으로 알려져 있다. 끊지 못해도 D-1의 `Promise.race`로 결과는 15초에 끝난다. 다만 뒤늦게 응답이 성공하면 서버에는 저장된다(D-3 문구가 이 경우를 포함한다).

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 감상·본 시기·핀 저장(과 핀 저장 전 확인, 핀 삭제)에 15초 시간 제한을 걸어, 응답이 오지 않을 때 "저장 중"에 멈춰 화면에 갇히는 문제를 고친다. 정정 작업이다.

| ID | 결함 |
|----|------|
| F-1 | 감상 저장 응답이 오지 않으면 "저장 중"에 멈추고 뒤로가기가 막힌다 |
| F-2 | 핀 저장 전 확인·저장·삭제도 같다 |

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙(화면 문구가 바뀐다).
2. `docs/93_save_request_deadline_fixes_spec.md` — 이 명세. D-1~D-5, 9장 E-1~E-11, 10장 테스트 표.
3. `docs/86_review_draft_leave_guard_fixes_spec.md`, `docs/89_offline_save_trap_fixes_spec.md` — 바꾸지 않을 이탈 보호·오프라인 계약.
4. `AGENTS.md` — 테스트 규칙. 테스트 파일에서 React Native·expo·Supabase 모듈을 import하면 실행이 깨진다.
5. `src/services/reviews.ts`(:19-53), `src/services/library.ts`(:333-347), `src/services/pins.ts`(:91-123), `src/services/pinContext.ts`(:4-10), `src/components/pins/PinComposer.tsx`(:176-202), `supabase/migrations/20261116124742_atomic_pin_save.sql`(:84-104, 재시도 근거).

# 시작 상태 (반드시 유지)
- 현재 `npm test` 1,951개 통과. 시작할 때 실제 값을 다시 기록한다.
- docs/84~92 미커밋 변경을 보존한다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** `runWithSaveDeadline`는 `run`이 signal을 무시해도 제한 시간에 반드시 끝난다(`Promise.race`). 어기면 세션 확인 등에서 멈춰 F-1이 남는다.
- **D-2.** 시간 제한은 서비스 함수 안에서 건다. 화면의 `await`만 끊지 않는다. `getPinContext`는 선택 `signal`만 받고 내부에서 제한하지 않는다.
- **D-3.** 문구는 6장 그대로다. 자동 재시도는 하지 않는다. 핀 `client_request_id` 처리를 바꾸지 않는다.
- **D-4.** `ContentReviewEditor.tsx`, 이탈 보호, `reviewDraft`, `networkMode`, 오프라인 사전 확인은 바꾸지 않는다.
- **D-5.** 조회 쿼리, Edge Function 호출, Supabase 클라이언트 설정(`src/lib/supabase.ts`), 라이브러리 공유의 `withTimeout`은 바꾸지 않는다.

# STEP 1 — 실패하는 테스트부터
`src/utils/saveDeadline.test.ts`에 10장 T-1~T-6을 쓴다. `npm test`로 T-1~T-6이 실패하는 것을 눈으로 확인한다. 실패하지 않는 행이 있으면 멈추고 보고한다.

# STEP 2 — 순수 함수
6장 계약과 판정 순서대로 `src/utils/saveDeadline.ts`를 만든다. T-1~T-4·T-6이 통과한다.

# STEP 3 — 서비스
6장 표대로 다섯 함수를 감싸고 signal을 붙인다. 기존 오류 문구·반환 값·검증 순서는 그대로 둔다. `getPinContext`에 선택 `signal`을 추가한다(두 조회에 `signal`이 있을 때만 `.abortSignal(signal)`).

# STEP 4 — 핀 저장 전 확인
`PinComposer.tsx:180`의 `getPinContext(contentId, episodeId)`를 `runWithSaveDeadline((signal) => getPinContext(contentId, episodeId, signal))`로 바꾼다. 그 밖의 `PinComposer` 코드는 그대로다. T-5와 전체 테스트가 통과한다.

# 엣지 케이스 (전부 처리, 명세 9장)
9장 표 E-1~E-11 전부. E-10·E-11은 보존 항목이다.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(기준선: 시작 때 기록한 값, 예상 1,951개). Node 24가 필요하면 `scenenote-verify`의 `--node-bin` 방식을 쓴다.

# DEFINITION OF DONE
- [ ] T-1~T-6이 수정 전에 실패하는 것을 확인했고 수정 후 통과한다.
- [ ] 기존 테스트 개수가 줄지 않았고, 기존 assertion을 바꾸지 않았다.
- [ ] 지연 환경에서 감상·핀 저장이 15초 뒤 끝나고 이탈이 가능하다(M-1·M-2).
- [ ] UI-13.2 토큰·`Alert` 검사 0줄.
- [ ] 웹·앱 수동 확인 표(M-1~M-3)를 보고했다. 실행하지 못한 행은 사유를 적는다.
- [ ] typecheck·lint 오류 0.

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/saveDeadline.ts
src/utils/saveDeadline.test.ts
src/services/reviews.ts
src/services/library.ts
src/services/pins.ts
src/services/pinContext.ts
src/components/pins/PinComposer.tsx
docs/development_next_steps.md
docs/README.md
```
`docs/README.md`는 93행 상태 칸만, `docs/development_next_steps.md`는 맨 위 작업 기록만 고친다.

# 보고 항목
1. STEP 1 실패 테스트의 실제 출력
2. `npm test` before / after 통과 개수
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. 변경 diff 요약(파일별 줄 수)
6. M-1~M-3 결과 또는 미실행 사유(지연을 만든 방법 포함)
7. 13장 "확실하지 않음"에서 확인한 것
8. D-1~D-5 중 문제라고 본 항목(바꾸지 말고 보고만)
9. 사람이 할 후속 작업(웹 재빌드 등. 서버 배포는 필요 없음)

# 금지사항
- 배포 명령(`npx supabase functions deploy`, vercel 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다. 운영 DB에 쓰지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 의존성을 추가·변경하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- 수동 확인 때 사용자의 실제 감상·핀을 바꾸지 않는다. 검증용 데이터만 쓰고 정리한다.
