# 89. 오프라인 저장 무한 대기·화면 갇힘 정정 명세

작성일: 2026-11-20
대상 브랜치 기준: main (0ca4651) + 미커밋 docs/84~88 작업
선행 문서: [86 감상 작성 중 이탈 보호](86_review_draft_leave_guard_fixes_spec.md), `src/components/pins/PinComposer.tsx`의 오프라인 확인

## 1. 문제 정의

docs/86 구현을 검증하다 찾은 결함이다. 테스트 1,928개, typecheck, lint는 모두 통과한다. 결함은 테스트가 다루지 않는 네트워크 상태에서만 드러난다.

| ID | 증상 | 심각도 |
|----|------|--------|
| F-1 | 인터넷이 끊긴 상태에서 작품 상세 "내 감상"의 **감상 저장**을 누르면 버튼이 "저장 중"에서 멈추고 입력칸이 잠긴다. 헤더 뒤로·iOS 스와이프·Android 뒤로를 눌러도 반응이 없다. 웹에서는 새로고침·닫기 때 경고가 뜬다. 연결이 돌아오기 전까지 이 화면을 떠날 수 없고 안내 문구도 없다. | 높음(docs/86 이후 생김) |
| F-2 | 같은 원인으로 앱의 모든 저장 동작(상태 바꾸기, 진행 저장, 본 횟수, 공유 링크 만들기 등)이 오프라인에서 시작되면 끝나지 않는다. 오류 토스트도 뜨지 않고 버튼은 대기 상태로 남는다. 핀 작성은 저장 전에 오프라인을 확인하지만, 확인 직후 연결이 끊기면 F-1과 같이 화면에 갇힌다. | 중간 |

## 2. 근본 원인

1. **TanStack Query v5 저장(mutation)의 기본 `networkMode`는 `"online"`이다.**
   - `node_modules/@tanstack/query-core/build/modern/retryer.js:10-12`의 `canFetch`는 `onlineManager.isOnline()`이 false이면 요청을 시작하지 않고 **일시정지(paused)** 한다.
   - 일시정지된 저장은 연결이 돌아올 때까지 `mutateAsync`가 끝나지 않는다. 성공도 실패도 하지 않고 `isPending`은 true로 남는다.
   - `src/lib/query.ts:15-17`은 `mutations: { retry: 0 }`만 두어 이 기본값을 그대로 쓴다.
   - 앱에는 오프라인 저장을 보관했다가 다시 보내는 장치(persister)나 `isPaused` 처리가 없다. `grep -rn "isPaused\|networkMode\|resumePausedMutations" app src` 결과는 0건이다. 그래서 일시정지에서 얻는 이점이 없다.
2. **`onlineManager`가 오프라인이 되는 경로**
   - 웹: TanStack 기본 리스너가 `window`의 `online`·`offline` 이벤트를 듣는다(`onlineManager.js:9-25`). `src/hooks/useNetworkOnline.ts:21-24`도 `navigator.onLine` 값을 넣는다.
   - 앱: 검색 탭(`app/search.tsx:85`의 `useNetworkOnline`)이 한 번 열리면 `expo-network` 상태가 들어간다(`useNetworkOnline.ts:12-16`).
3. **감상 편집기는 저장 전에 오프라인을 확인하지 않는다.**
   - `ContentReviewEditor.tsx:125-127`의 `submit`은 바로 검증·저장으로 들어간다.
   - 핀 작성은 `PinComposer.tsx:146`에서 먼저 확인하고 "인터넷 연결 후 다시 저장해 주세요."를 띄운다.
4. **docs/86의 이탈 보호가 저장 중에는 나가기를 조용히 막는다.**
   - `ContentReviewEditor.tsx:101-102`가 `usePreventRemove(!leaving && (dirty || saving), …)`에서 `if (saveLock.current || saving) return;`로 막는다. docs/86 E-4의 의도다.
   - 저장 중 상태는 `:79`의 `saving`에서 온다.
   - 웹의 `beforeunload`(`:111-116`)도 `saving`이면 경고를 낸다.
   - E-4는 저장이 곧 끝난다는 전제였다. 저장이 일시정지되면 이 전제가 깨져 화면에 갇힌다.

로컬 재현: `@tanstack/query-core`에서 `onlineManager.setOnline(false)` 뒤에 `MutationObserver.mutate()`를 실행했다. 2초 뒤에도 `isPending=true, isPaused=true`였고 promise는 끝나지 않았다. 현재 `queryClient.getDefaultOptions().mutations`는 `{"retry":0}`이다. `src/lib/query.ts`는 tsx 테스트에서 import할 수 있음을 확인했다.

## 3. 재현 시나리오

1. 웹 8081에 로그인하고, 라이브러리에 있는 작품 상세의 "내 감상"에서 별점을 바꾼다.
2. 개발자 도구 Network를 Offline으로 바꾼다. 브라우저 `offline` 이벤트가 발생한다.
3. **감상 저장**을 누른다. 버튼이 "저장 중"으로 바뀌고 계속 그대로다. 입력칸은 잠긴다.
4. 헤더 뒤로를 누른다. 반응이 없다. 새로고침하면 브라우저 경고가 뜬다.
5. Online으로 되돌리면 저장이 그때서야 진행된다.

앱에서는 비행기 모드에서 검색 탭을 한 번 연 뒤 같은 순서로 재현된다.

## 4. 설계 결정

### D-1. 저장(mutation)은 오프라인에서도 일시정지하지 않는다 (최우선)
`src/lib/query.ts`의 `defaultOptions.mutations`에 `networkMode: "always"`를 더한다.
- 효과: 오프라인에서 시작한 저장은 실제 요청을 보낸다. 요청은 바로 네트워크 오류로 실패하고, 각 화면의 기존 `onError`·`catch`가 실패 문구를 낸다.
- 저장이 반드시 끝나므로 docs/86 E-4("저장 중에는 나가기를 막음")의 전제가 다시 성립한다.
- 조회(query)의 `networkMode`는 바꾸지 않는다. 조회는 오프라인에서 캐시를 보여 주는 지금 동작이 맞다.
- 개별 훅에 `networkMode`를 따로 두지 않는다. 기본값 한 곳만 바꾼다.

### D-2. 감상 편집기는 저장 전에 오프라인을 확인한다
`submit`에서 `saveLock` 확인과 `setSubmitError(null)` 바로 다음에 오프라인을 확인한다. 날짜 검증보다 먼저다(PinComposer와 같은 순서).
- 오프라인이면 `setSubmitError(ERROR_COPY.offlineSave)` 후 return한다. 저장 요청을 보내지 않고 `saveLock`과 `submitting`도 건드리지 않는다.
- 입력은 그대로 남고 변경 상태(dirty)도 유지된다. 그래서 나가려 하면 docs/86의 확인 창이 뜬다.
- 오프라인 판정은 `expo-network`의 `useNetworkState()` 값으로 한다. PinComposer와 같은 출처다.

### D-3. 오프라인 판정과 문구는 한 곳에 둔다
- 새 순수 함수 `isNetworkOffline`(`src/utils/networkStatus.ts`)은 `isConnected === false || isInternetReachable === false`일 때만 true다. `null`·`undefined`는 알 수 없음으로 보고 false다. 지금 4곳의 식(`PinComposer.tsx:146`, `app/content/[id].tsx:413`, `app/(tabs)/library.tsx:820`)과 같다.
- `ERROR_COPY.offlineSave = "인터넷 연결 후 다시 저장해 주세요."`를 더한다. PinComposer에 지금 있는 문구와 한 글자도 다르지 않다.
- 감상 편집기와 PinComposer가 함수와 문구를 함께 쓴다. `app/content/[id].tsx:413`과 `library.tsx:820`의 `isOffline` 식은 이번에 바꾸지 않는다(12장).

### D-4. docs/86의 이탈 보호 계약은 그대로다
- `usePreventRemove`의 조건, 저장 중 조용히 막기(E-4), `confirmDiscard`, `beforeunload`, `reviewDraft` 판정은 바꾸지 않는다.
- 이번 작업은 저장이 반드시 끝나게 하는 것뿐이다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| 저장 중에도 나가기를 허용(E-4 변경) | 저장 응답 전에 화면이 사라지면 성공·실패 안내를 받을 곳이 없다. docs/86 D-4를 깨고 핀 작성과도 달라진다. |
| `isPaused`면 "연결되면 저장돼요" 안내하고 나가기 허용 | persister가 없어 앱을 닫으면 보관된 저장이 사라진다. 저장됐다고 믿게 만드는 안내가 된다. |
| 감상·날짜 훅 두 개에만 `networkMode: "always"` | F-2(다른 저장도 끝나지 않음)가 남는다. 27개 `useMutation`에 하나씩 넣으면 빠뜨리기 쉽다. |
| 저장 요청 시간 제한(timeout) 추가 | 느린 연결의 판단 기준을 따로 정해야 하는 큰 변경이다. 이번 결함은 "요청이 시작조차 안 됨"이다(12장). |
| 오프라인 사전 확인만 추가(D-1 없이) | `expo-network`와 `onlineManager`가 어긋나거나, 확인 직후 연결이 끊기면 그대로 갇힌다. |

## 6. 계약

```ts
// src/utils/networkStatus.ts (신규, 순수 함수 — RN·expo import 금지)
export interface NetworkStatusLike {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}
export function isNetworkOffline(state: NetworkStatusLike | null | undefined): boolean;
// state?.isConnected === false || state?.isInternetReachable === false

// src/utils/errorCopy.ts (키 추가, 기존 키·문구 변경 금지)
offlineSave: "인터넷 연결 후 다시 저장해 주세요."

// src/lib/query.ts
mutations: { retry: 0, networkMode: "always" }   // queries 기본값은 그대로
```

`ContentReviewEditor.submit`의 판정 순서:
1. `saveLock.current`이면 return(기존).
2. `setSubmitError(null)`(기존).
3. **`isNetworkOffline(network)`이면 `setSubmitError(ERROR_COPY.offlineSave)` 후 return.**
4. 기존 날짜 검증 → 기존 저장 흐름(바꾸지 않음).

`PinComposer.save`의 `:146`은 `if (isNetworkOffline(network)) { setError(ERROR_COPY.offlineSave); return; }`로 바꾼다. 위치와 순서는 그대로다.

## 7. 데이터 모델 / SQL

해당 없음. 서버, DB, Edge Function을 바꾸지 않는다.

## 8. 화면 명세

- 새 화면이나 새 요소는 없다.
- 감상 편집기에서 오프라인 안내는 기존 `submitError` 자리(`:275`, `accessibilityLiveRegion="polite"`)에 나온다.
- UI 규칙 준수(UI-1~UI-13).

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 오프라인에서 감상 저장 | 즉시 "인터넷 연결 후 다시 저장해 주세요.". 저장 요청 없음, 입력 유지, 버튼 "감상 저장" 유지. 나가려 하면 확인 창 | T-3, M-1 |
| E-2 | `expo-network`는 온라인인데 `onlineManager`는 오프라인 | 요청을 보낸다. 실패하면 기존 실패 문구, 저장 중 해제, 나가기 가능(확인 창) | T-2, M-1 |
| E-3 | 오프라인 확인 직후 연결이 끊김 | E-2와 같다(일시정지 없음) | T-2 |
| E-4 | 저장 요청 중 연결이 끊김 | 기존과 같다. fetch 오류 → 실패 문구 | T-2 |
| E-5 | 느린 연결로 응답 대기 | docs/86 E-4 그대로: "저장 중", 나가기 막음 | 범위 밖(12장) |
| E-6 | 감상 성공 후 날짜 저장이 네트워크 오류 | docs/86 그대로: 감상만 확정, 날짜는 입력 유지·dirty | 기존 docs/86 T-3·T-5 |
| E-7 | 핀 작성을 오프라인에서 저장 | 지금과 같은 문구(같은 상수), 요청 없음 | T-3, M-2 |
| E-8 | 오프라인에서 상태 바꾸기·진행 저장·본 횟수 | 대기에 멈추지 않고 각 화면의 기존 `onError` 토스트가 뜬다 | T-2, M-3 |
| E-9 | 오프라인에서 화면 조회 | 바꾸지 않음. 캐시 표시·조회 일시정지 그대로 | T-2(queries 기본값 보존) |
| E-10 | `isConnected`·`isInternetReachable`가 `null`(아직 모름) | 온라인으로 본다(지금 식과 같음) | T-1 |

## 10. 테스트 표

모두 새 파일 `src/utils/offlineSave.test.ts`에 둔다. `node:test`와 `node:assert/strict`를 쓴다. import 범위는 다음과 같다.
- 순수 `networkStatus`·`errorCopy`
- `src/lib/query.ts`의 `queryClient`
- `@tanstack/react-query`의 `QueryClient`·`MutationObserver`·`onlineManager`
- 소스 문자열 검사용 `node:fs`

RN·expo·Supabase는 import하지 않는다.

| ID | 이름 | 내용 | 수정 전 |
|----|------|------|---------|
| T-1 | 89 T-1: offline means a definite false from the device | `isNetworkOffline`이 다음을 반환한다. `{isConnected:false}`→true, `{isInternetReachable:false}`→true, `{true,false}`→true, `{true,true}`→false, `{true,null}`→false, `{null,null}`→false, `{}`→false, `null`→false, `undefined`→false | 실패(모듈 없음) |
| T-2 | 89 T-2: saves never pause while offline | `queryClient.getDefaultOptions().mutations?.networkMode === "always"`, `retry === 0` 유지, `queries?.networkMode`는 `undefined`(조회 기본값 보존). 그다음 `new QueryClient({ defaultOptions: queryClient.getDefaultOptions() })`를 만든다. `onlineManager.setOnline(false)` 상태에서 `MutationObserver`로 두 경우를 실행한다. 거부하는 `mutationFn`(`TypeError("Failed to fetch")`)은 300ms 안에 rejected여야 한다. 성공하는 `mutationFn`은 300ms 안에 resolved여야 한다. 두 경우 모두 `getCurrentResult().isPaused === false`. `finally`에서 `onlineManager.setOnline(true)`. 시간 경쟁은 `Promise.race`와 300ms 타이머로 판정한다 | 실패("still pending") |
| T-3 | 89 T-3: review editor and pin composer check offline before saving | 소스 문자열 검사. `ContentReviewEditor.tsx`의 `submit` 본문에서 `isNetworkOffline(`이 `setSubmitError(null)` 뒤, `toIsoWatchDate(`·`saveLock.current = true`보다 앞에 있고, 같은 분기에 `ERROR_COPY.offlineSave`가 있다. `PinComposer.tsx`에 `isNetworkOffline(network)`와 `ERROR_COPY.offlineSave`가 있다. 리터럴 "인터넷 연결 후 다시 저장해 주세요."는 `src/` 아래에서 `src/utils/errorCopy.ts`에만 있다(테스트 파일 제외) | 실패 |
| T-4 | 89 T-4: offline save copy is unchanged | `ERROR_COPY.offlineSave === "인터넷 연결 후 다시 저장해 주세요."`, 기존 `ERROR_COPY` 키는 모두 그대로다(키 목록 스냅샷 비교, `offlineSave`만 추가) | 실패(키 없음) |
| 보존 | docs/86 T-1~T-6, 기존 전체 | 그대로 통과. docs/86 T-6(`usePreventRemove(` 연결 검사)을 포함한다 | 통과 |

**68번 T-15와의 정합성 (2026-11-20).** 기존 `src/utils/errorCopy.test.ts`의 T-15는 문구 20개 전체를 정확히 비교한다. D-3으로 키가 하나 늘어나므로 이 테스트의 기대 개수를 21로 바꾸고 전체 객체에 `offlineSave` 한 줄을 추가한다. 기존 20개의 키와 문구, 개수·객체 전체 일치 검사는 유지한다.

**수동 확인 (UI-14.3)**

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 테스트용 작품에서 별점을 바꾼다. Network를 Offline으로 두고 저장하면 오프라인 문구가 나오고 버튼이 "감상 저장"으로 남는다. 헤더 뒤로를 누르면 확인 창이 뜨고, 취소하면 입력이 남는다. Online으로 돌리고 저장하면 성공 토스트가 뜨고 나갈 때 묻지 않는다. 실제 사용자 감상은 바꾸지 않는다. |
| M-2 | 웹 375 | 핀 작성 화면을 Offline에서 저장하면 같은 문구가 나온다. 저장 요청은 없다(Network 탭에서 확인). |
| M-3 | 웹 1440 | Offline에서 작품 상세 상태 칩을 누르면 "상태를 바꾸지 못했어요…" 토스트가 뜨고 칩 대기 상태가 풀린다. 확인 뒤 원래 상태로 되돌린다. |
| M-4 | iOS 세로 | 비행기 모드에서 감상 저장을 누르면 오프라인 문구가 나온다. 스와이프 뒤로를 하면 확인 창이 뜬다(갇히지 않음). |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/lib/query.ts` | `mutations`에 `networkMode: "always"`(D-1) |
| `src/utils/networkStatus.ts` | 신규 `isNetworkOffline`(D-3) |
| `src/utils/errorCopy.ts` | `offlineSave` 키 추가(D-3) |
| `src/components/content/ContentReviewEditor.tsx` | `useNetworkState` import·호출, `submit` 3번째 단계(D-2) |
| `src/components/pins/PinComposer.tsx` | `:146`을 함수·상수로 교체(D-3) |
| `src/utils/offlineSave.test.ts` | 신규 T-1~T-4 |
| `src/utils/errorCopy.test.ts` | D-3에 따른 68 T-15의 기대값 확장 |
| `docs/development_next_steps.md`, `docs/README.md` | 작업 기록·89행 상태 |

## 12. 범위 밖

- 저장 요청 시간 제한, 느린 연결에서의 이탈(E-5).
- 오프라인 저장을 보관했다가 다시 보내는 기능(persister).
- `app/content/[id].tsx:413`, `app/(tabs)/library.tsx:820`의 `isOffline` 식 교체. 동작은 같고 "김에 고치기"에 해당한다.
- 각 저장 훅의 실패 문구 정리, 조회의 `networkMode`.
- 검색 탭을 벗어난 뒤 앱에서 `onlineManager`가 마지막 값에 머무는 문제(`useNetworkOnline.ts:19`의 구독 해제). D-1 뒤에는 저장에 영향이 없고, 조회 일시정지에만 남는다. 13장에서 확인한다.

## 13. 확실하지 않음 — 별도 검증 필요

- 앱(iOS·Android)에서 `expo-network`의 `isInternetReachable`이 실제로 false를 주는 시점. 비행기 모드에서는 `isConnected=false`가 확실하지만, 약한 Wi-Fi에서는 확실하지 않다. M-4로 확인하고, 그 밖은 E-2 경로(요청 후 실패)로 처리된다.
- 27개 저장 훅 가운데 `onError`가 없는 호출부. D-1 뒤에는 대기 대신 조용한 실패가 될 수 있다. 작품 상세의 상태·추가·삭제·본 횟수·진행 저장은 `onError` 토스트가 있다(`app/content/[id].tsx:260,271,283,342,384`). 다른 화면은 이번 범위에서 전수 확인하지 않는다. Codex가 구현 중 발견하면 보고만 한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 오프라인에서 시작한 저장이 끝나지 않아 "내 감상" 화면에 갇히는 결함을 고친다. 정정 작업이다.

| ID | 결함 |
|----|------|
| F-1 | 오프라인에서 감상 저장 → "저장 중"에서 멈추고 입력이 잠기며 뒤로가기가 막힌다(docs/86 이탈 보호와 결합) |
| F-2 | 앱의 모든 저장이 오프라인에서 시작되면 일시정지되어 성공도 실패도 하지 않는다 |

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙(UI 파일을 고친다).
2. `docs/89_offline_save_trap_fixes_spec.md` — 이 명세. D-1~D-4, 9장 E-1~E-10, 10장 테스트 표.
3. `docs/86_review_draft_leave_guard_fixes_spec.md` — 바꾸지 않을 이탈 보호 계약(D-4, E-4).
4. `AGENTS.md` — 테스트 규칙. 테스트 파일에서 React Native·expo·Supabase 모듈을 import하면 실행이 깨진다.
5. `src/lib/query.ts`, `src/components/content/ContentReviewEditor.tsx`(:79, :101-116, :125-160), `src/components/pins/PinComposer.tsx`(:62, :144-147), `src/utils/errorCopy.ts`.

# 시작 상태 (반드시 유지)
- 현재 `npm test` 1,928개 통과(docs/86 반영 기준). 시작할 때 실제 값을 다시 기록한다.
- docs/84~88의 미커밋 변경과 다른 세션의 작업을 보존한다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 저장 기본값 `networkMode: "always"`는 `src/lib/query.ts` 한 곳에만 둔다. 조회(`queries`) 기본값과 `retry` 값은 바꾸지 않는다. 개별 훅에 `networkMode`를 넣지 않는다. 어기면 F-2가 남거나 오프라인 조회가 깨진다.
- **D-2.** 감상 편집기 오프라인 확인은 `setSubmitError(null)` 바로 다음, 날짜 검증과 `saveLock.current = true`보다 앞이다. 오프라인이면 저장 요청을 보내지 않고 `saveLock`과 `submitting`을 건드리지 않는다.
- **D-3.** 판정은 `isNetworkOffline`, 문구는 `ERROR_COPY.offlineSave` 하나만 쓴다. 문구는 "인터넷 연결 후 다시 저장해 주세요."에서 한 글자도 바꾸지 않는다.
- **D-4.** docs/86의 `usePreventRemove` 조건, 저장 중 막기, `confirmDiscard`, `beforeunload`, `reviewDraft.ts`는 바꾸지 않는다.
- 서버, DB, Edge Function, 마이그레이션은 바꾸지 않는다.

# STEP 1 — 실패하는 테스트부터
`src/utils/offlineSave.test.ts`에 10장 T-1~T-4를 쓴다. `npm test`를 실행해 T-1~T-4가 실패하는 것을 눈으로 확인한다. T-2는 "still pending"(일시정지)으로 실패해야 한다. 어느 하나가 실패하지 않으면 시나리오를 잘못 짚은 것이니 멈추고 보고한다. T-2는 `finally`에서 `onlineManager.setOnline(true)`로 전역 상태를 되돌려 다른 테스트에 영향을 주지 않게 한다.

# STEP 2 — 순수 함수·문구
`src/utils/networkStatus.ts`(6장 계약)를 만들고 `ERROR_COPY.offlineSave`를 추가한다. T-1·T-4가 통과한다.

# STEP 3 — 저장 기본값
`src/lib/query.ts`를 다음처럼 바꾼다.
```ts
    mutations: {
      retry: 0,
      // No offline persister: a paused save would never settle and would trap screens that block leaving while saving (docs/89).
      networkMode: "always"
    }
```
T-2가 통과한다.

# STEP 4 — 화면 연결
- `ContentReviewEditor.tsx`
  - `import { useNetworkState } from "expo-network";`, `isNetworkOffline`, `ERROR_COPY`(이미 import됨)를 쓴다.
  - 컴포넌트 안에서 `const network = useNetworkState();`를 호출한다.
  - `submit`의 `setSubmitError(null);` 다음 줄에 다음을 넣는다.
    ```ts
    if (isNetworkOffline(network)) { setSubmitError(ERROR_COPY.offlineSave); return; }
    ```
- `PinComposer.tsx:146`을 다음으로 바꾼다.
  ```ts
  if (isNetworkOffline(network)) { setError(ERROR_COPY.offlineSave); return; }
  ```
  `ERROR_COPY`와 `isNetworkOffline` import를 추가한다.
- T-3와 전체 테스트가 통과한다.

# 엣지 케이스 (전부 처리, 명세 9장)
9장 표 E-1~E-10 전부. E-5는 바꾸지 않는다. E-6·E-9는 기존 동작을 보존하는 항목이다.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(기준선: 시작 때 기록한 값, 예상 1,928개). Node 24가 필요하면 저장소 검증 스킬(`scenenote-verify`)의 `--node-bin` 방식을 쓴다.

# DEFINITION OF DONE
- [ ] T-1~T-4가 수정 전에 실패하는 것을 확인했고(T-2는 일시정지로), 수정 후 통과한다.
- [ ] 기존 테스트 수를 유지하고, 68 T-15의 기대값은 10장에 따라 21개로 확장했다. 기존 문구 20개와 전체 일치 검사를 보존했다.
- [ ] `queries` 기본값과 `retry`가 그대로다.
- [ ] docs/86 T-1~T-6이 그대로 통과한다.
- [ ] UI-13.2 토큰·`Alert` 검사 0줄.
- [ ] 웹·앱 수동 확인 표(M-1~M-4)를 보고했다. 실행하지 못한 행은 사유를 적는다.
- [ ] typecheck·lint 오류 0.

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/lib/query.ts
src/utils/networkStatus.ts
src/utils/errorCopy.ts
src/utils/offlineSave.test.ts
src/utils/errorCopy.test.ts
src/components/content/ContentReviewEditor.tsx
src/components/pins/PinComposer.tsx
docs/development_next_steps.md
docs/README.md
```
`docs/README.md`는 89행 상태 칸만, `docs/development_next_steps.md`는 맨 위 작업 기록만 고친다.

# 보고 항목
1. STEP 1 실패 테스트의 실제 출력(T-2의 "still pending" 포함)
2. `npm test` before / after 통과 개수
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. 변경 diff 요약(파일별 줄 수)
6. M-1~M-4 결과 또는 미실행 사유
7. 13장 "확실하지 않음"에서 새로 알게 된 것(`onError` 없는 저장 호출부 등, 고치지 말고 목록만)
8. D-1~D-4 중 문제라고 본 항목(바꾸지 말고 보고만)
9. 사람이 할 후속 작업(웹 재빌드 등. 서버 배포는 필요 없음)

# 금지사항
- 배포 명령(`npx supabase functions deploy`, vercel 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. `app/content/[id].tsx`, `app/(tabs)/library.tsx`의 `isOffline` 식도 바꾸지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- 수동 확인 중 실제 사용자 감상·핀·상태를 바꾸지 않는다. 바꿨다면 원래 값으로 되돌리고 보고한다.
