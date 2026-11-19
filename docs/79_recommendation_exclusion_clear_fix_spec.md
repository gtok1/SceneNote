# 79. 추천 제외 목록 "전체 해제" 무동작 정정 명세

작성일: 2026-11-19
대상 브랜치 기준: main (519ddc7) + docs/74~78 미커밋 변경
선행 문서: [docs/78](78_web_alert_and_dead_code_cleanup_spec.md)(웹 실제 화면 확인에서 발견), [docs/00_ui_style_rules.md](00_ui_style_rules.md)

## 1. 문제 정의

| ID | 증상 |
|----|------|
| F-1 | 프로필 → "추천에서 제외한 작품"(`/settings/excluded-recommendations`)에서 "전체 해제"를 누르고 확인해도 목록이 그대로다. 웹·앱 모두 같다. 프로필의 제외 개수(`exclusionCount`)도 줄지 않는다 |

- 2026-11-19 웹 8081에서 확인했다(docs/78 M-1).
- 확인 창 `window.confirm("전체 해제\n\n추천 제외 목록을 모두 비울까요?")`은 호출됐고, 취소하면 목록이 유지됐다.
- 그러나 확인을 눌러도 화면과 저장값(`localStorage["scenenote-recommendation-ui"]`)이 바뀌지 않았다.
- 화면이 확장 기능(`EXTENDED_FEATURES_ENABLED = false`) 뒤에 있어 지금 사용자에게는 보이지 않는다.

## 2. 근본 원인

`src/stores/recommendationUiStore.ts:58-61`:

```ts
clearExclusions: () => ({
  excludedRecommendations: [],
  excludedRecommendationKeys: []
})
```

- zustand 액션은 `set(...)`을 불러야 상태가 바뀐다. 이 액션은 객체를 **반환만** 하고 `set`을 부르지 않는다.
- 같은 파일의 `excludeRecommendation`(32행)과 `removeExclusion`(50행)은 `set((state) => …)`을 부른다. 그래서 개별 "해제"는 동작한다.
- docs/78 이전 앱 경로(`Alert`의 `onPress: clearExclusions`)도 같은 함수였으므로, 이 결함은 그 전부터 있었다.
- 테스트가 없었던 이유: 스토어 파일이 `react-native`(`Platform`)와 `@react-native-async-storage/async-storage`를 import한다. 그런데 테스트 파일은 RN 모듈을 import할 수 없다(AGENTS.md). 그래서 액션 동작이 한 번도 테스트되지 않았다.

## 3. 재현 시나리오

1. 로컬에서만 `EXTENDED_FEATURES_ENABLED`를 `true`로 바꾸고 웹 8081을 재시작한다(확인 후 되돌린다).
2. 제외 목록이 비어 있으면 브라우저 콘솔에서 검증용 항목을 넣고 새로고침한다.
   `localStorage.setItem("scenenote-recommendation-ui", JSON.stringify({ state: { excludedRecommendations: [{ key: "test:verify79", title: "검증용 작품", excludedAt: new Date().toISOString() }], excludedRecommendationKeys: ["test:verify79"] }, version: 2 }))`
3. `/settings/excluded-recommendations`에서 "전체 해제"를 누르고 확인한다.
4. 목록이 "1개"로 남는다. 이것이 결함이다.

## 4. 설계 결정

### D-1. 액션 3개를 RN 없는 순수 모듈로 옮기고 거기서 테스트한다 (최우선)

- 새 파일은 `src/utils/recommendationExclusionActions.ts`다.
  - `react-native`, AsyncStorage, `zustand` 런타임을 import하지 않는다.
  - `set` 함수를 인자로 받아 `excludeRecommendation`·`removeExclusion`·`clearExclusions`를 돌려준다.
- 스토어는 이 함수를 펼쳐 쓴다.
- 이렇게 해야 테스트가 가짜 `set`으로 "실제로 상태가 바뀌는지"를 확인할 수 있다. 같은 실수(반환만 하고 `set`을 안 부름)도 테스트가 잡는다.

### D-2. 옮기기와 고치기를 나눈다

- STEP 1에서는 현재 코드를 **결함까지 그대로** 옮기고 테스트를 쓴다. 이때 T-1·T-2가 실패하는 것을 확인한다.
- STEP 2에서 `clearExclusions`만 고친다.
- 이유: 테스트가 모듈 부재가 아니라 실제 결함 때문에 실패하는지 확인하기 위해서다.

### D-3. 상태 모양·저장 키·버전·마이그레이션은 바꾸지 않는다

- 그대로 두는 것: `RecommendationExclusion` 필드, `excludedRecommendationKeys` 동기화, `name: "scenenote-recommendation-ui"`, `version: 2`, `migrateRecommendationUiState`·`normalizeExcludedRecommendations`, `noopStorage`, `canUsePersistentStorage`.
- `RecommendationExclusion` 타입은 순수 모듈로 옮긴다. 스토어는 `export type { RecommendationExclusion }`으로 계속 내보낸다(기존 import 경로 보존).

### D-4. 시간은 주입한다

- 액션 생성 함수의 두 번째 인자는 `now: () => Date = () => new Date()`다.
- 스토어는 이 인자를 넘기지 않는다. 그래서 기존 동작과 같다.
- 테스트는 고정 시각을 넘겨 `excludedAt`을 확정한다.

### D-5. 화면 코드는 바꾸지 않는다

`app/settings/excluded-recommendations.tsx`와 `app/(tabs)/profile.tsx`는 수정하지 않는다. 확인 창은 docs/78에서 이미 `confirmDestructive`로 바뀌었다.

> D-N은 Codex가 임의로 바꾸면 안 되는 항목이다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 한 줄만 고치고 테스트 없이 끝내기 | 같은 실수를 잡을 장치가 없다. 이 결함 자체가 테스트 부재로 오래 남았다 |
| 스토어 소스 문자열에서 `clearExclusions: () => set(`을 찾는 테스트 | 형식만 보고 동작은 보지 않는다. 다른 방식으로 쓰면 오탐하거나 놓친다 |
| 테스트에서 스토어를 RN 모의와 함께 import | AGENTS.md 테스트 규칙 위반, 러너가 깨진다 |
| `zustand/vanilla`로 실제 스토어를 만들어 테스트 | 가능하지만 persist·AsyncStorage가 함께 따라온다. 액션만 검증하면 충분하고, 가짜 `set`이 더 단순하다 |
| 이번에 로컬 제외 목록 화면 자체를 없애기 | 13장. 제품 판단이 필요해서 별도로 다룬다 |

## 6. 계약

### 6.1 `src/utils/recommendationExclusionActions.ts`

```ts
export interface RecommendationExclusion {
  key: string;
  title: string;
  excludedAt: string;
}

export interface RecommendationExclusionSlice {
  excludedRecommendations: RecommendationExclusion[];
  excludedRecommendationKeys: string[];
}

export interface RecommendationExclusionActions {
  excludeRecommendation: (key: string, title?: string) => void;
  removeExclusion: (key: string) => void;
  clearExclusions: () => void;
}

export type RecommendationExclusionSet = (
  partial:
    | Partial<RecommendationExclusionSlice>
    | ((state: RecommendationExclusionSlice) => Partial<RecommendationExclusionSlice>)
) => void;

export function createRecommendationExclusionActions(
  set: RecommendationExclusionSet,
  now?: () => Date
): RecommendationExclusionActions;
```

동작(고친 뒤):

1. `excludeRecommendation(key, title = "제목 없는 작품")`
   - `set(fn)`을 1회 호출한다.
   - 같은 key가 이미 있으면 `fn`은 `{}`를 돌려준다.
   - 없으면 `{ key, title, excludedAt: now().toISOString() }`를 **끝에** 붙인다. `excludedRecommendationKeys`는 목록의 key 순서와 같다.
2. `removeExclusion(key)`: `set(fn)` 1회. 그 key만 빼고 keys를 다시 만든다.
3. `clearExclusions()`: `set({ excludedRecommendations: [], excludedRecommendationKeys: [] })` 1회.

현재 32~57행의 로직은 그대로 옮긴다. 바꾸는 것은 `new Date()`를 `now()`로 바꾸는 것과 3번뿐이다.

### 6.2 스토어 (`src/stores/recommendationUiStore.ts`)

```ts
(set) => ({
  excludedRecommendations: [],
  excludedRecommendationKeys: [],
  ...createRecommendationExclusionActions(set)
})
```

- `RecommendationUiState`는 `RecommendationExclusionSlice & RecommendationExclusionActions`와 같은 모양을 유지한다.
- `RecommendationExclusion`은 순수 모듈에서 import하고 `export type`으로 다시 내보낸다.
- 6~10행의 인터페이스 정의는 삭제한다.

## 7. 데이터 모델 / SQL

해당 없음. DB 마이그레이션을 만들지 않는다. 로컬 저장 키와 버전도 그대로다(D-3).

## 8. 화면 명세

화면 변경은 없다. "전체 해제"를 확인하면 목록이 비고, "제외한 작품이 없어요" 빈 상태가 보인다. 프로필의 제외 개수는 0이 된다.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 항목 2개에서 전체 해제 | 목록·keys 모두 빈 배열, `set` 1회 | T-1, T-2, M-1 |
| E-2 | 이미 빈 목록에서 전체 해제 호출 | 빈 배열 유지, 예외 없음(화면은 `hasItems` 가드로 호출하지 않음) | T-6 |
| E-3 | 새 항목 추가, title 생략 | title "제목 없는 작품", excludedAt은 주입 시각 ISO, keys 동기화 | T-3 |
| E-4 | 이미 있는 key 추가 | 목록·keys 변화 없음 | T-4 |
| E-5 | 개별 해제 | 그 key만 빠지고 순서 유지, keys 동기화 | T-5, M-2 |
| E-6 | 전체 해제 후 새로고침 | 저장값도 비어 다시 나타나지 않는다(persist가 `set` 결과를 저장) | M-1 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.**

- 새 파일은 `src/utils/recommendationExclusionActions.test.ts`다. `node:test`의 `it`, `node:assert/strict`, `./recommendationExclusionActions`만 import한다.
- 테스트 안에서 가짜 스토어를 만든다.
  - `let state: RecommendationExclusionSlice`를 둔다.
  - `set`은 `calls` 배열에 기록한 뒤, 함수면 `state`로 호출한 결과를, 객체면 그대로 `state`에 얕게 병합한다.
- 고정 시각은 `new Date("2026-11-19T00:00:00.000Z")`다.

| ID | 테스트 이름 | 초기 상태 → 동작 | 기대 | STEP 1(옮긴 직후) |
|----|------------|------------------|------|------------------|
| T-1 | `79 T-1: clearExclusions empties exclusions and keys` | 항목 a·b → `clearExclusions()` | 두 배열 모두 `[]` | **실패** |
| T-2 | `79 T-2: clearExclusions updates the store exactly once` | 항목 a → `clearExclusions()` | `set` 호출 1회 | **실패**(0회) |
| T-3 | `79 T-3: excludeRecommendation appends with default title, injected time and synced keys` | 빈 상태 → `excludeRecommendation("k1")` | `[{ key: "k1", title: "제목 없는 작품", excludedAt: "2026-11-19T00:00:00.000Z" }]`, keys `["k1"]` | 통과 |
| T-4 | `79 T-4: excludeRecommendation ignores a duplicate key` | 항목 a → `excludeRecommendation("a", "다른 제목")` | 상태가 이전과 `deepEqual` | 통과 |
| T-5 | `79 T-5: removeExclusion removes only the given key and keeps order` | a·b·c → `removeExclusion("b")` | 목록 key 순서 `["a","c"]`, keys `["a","c"]` | 통과 |
| T-6 | `79 T-6: clearExclusions on an empty state stays empty` | 빈 상태 → `clearExclusions()` | 두 배열 `[]`, 예외 없음 | 통과(반환만 하므로 상태가 원래 비어 있음) |

기준선은 1,839개 통과다. STEP 1 직후에는 1,843개 통과·2개 실패이고, 목표는 1,845개 통과다.

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/recommendationExclusionActions.ts` | 새 파일. 6.1 계약 |
| `src/utils/recommendationExclusionActions.test.ts` | 새 파일. T-1~T-6 |
| `src/stores/recommendationUiStore.ts` | 액션 3개와 `RecommendationExclusion` 정의를 순수 모듈로 옮기고 펼쳐 쓴다. 타입 재내보내기. 나머지 그대로 |
| `docs/development_next_steps.md` | 맨 위에 docs/79 절 추가 |
| `docs/README.md` | 79번 줄 상태 갱신 |

## 12. 범위 밖

- `migrateRecommendationUiState`·`normalizeExcludedRecommendations`의 이동이나 테스트. 동작이 바뀌지 않으므로 이번에 옮기지 않는다.
- 다른 스토어(`appUIStore` 등) 점검. `src/stores`의 다른 액션은 모두 `set(`을 부른다(2026-11-19 확인).
- 화면·문구·`EXTENDED_FEATURES_ENABLED` 값.
- 서버 쪽 추천 제외(장르·테마, `src/services/recommendationPreferences.ts`).

## 13. 확실하지 않음 — 별도 검증 필요

- **이 로컬 제외 목록에 지금은 아무것도 추가되지 않는다.**
  - 현재 `app`·`src`에서 `excludeRecommendation`을 부르는 곳이 없다(2026-11-19 grep). 이 목록에는 예전 버전이 저장한 항목만 남는다.
  - 지금 추천 제외는 서버(`recommendationPreferences`)가 맡는다.
  - 확장 기능을 켤 때 이 화면을 계속 둘지, 서버 제외 목록 화면으로 바꿀지는 제품 판단이 필요하다. 이번 명세는 남아 있는 예전 항목을 지울 수 있게 하는 것까지만 다룬다.
- 앱에서 AsyncStorage에도 빈 목록이 저장되는지는 iOS 확인(M-3)으로 본다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 이번 작업은 **정정 작업**이다. 추천 제외 목록의 `clearExclusions`가 `set`을 부르지 않아 "전체 해제"가 웹·앱 모두에서 아무것도 지우지 못한다. 액션 3개를 RN 없는 순수 모듈로 옮겨 테스트할 수 있게 하고, `clearExclusions`를 고친다.

| ID | 결함 |
|----|------|
| F-1 | "전체 해제" 확인 후에도 목록·저장값·프로필 개수가 그대로 |

# READ FIRST
1. `docs/79_recommendation_exclusion_clear_fix_spec.md` — 이 명세. D-1~D-5, 계약 6장, E-1~E-6, T-1~T-6.
2. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
3. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙(이번에는 화면 변경이 없다. 검증 절차만 따른다).
4. `src/stores/recommendationUiStore.ts` 전체.
5. `app/settings/excluded-recommendations.tsx`(호출부. 수정하지 않는다).

# 시작 상태 (반드시 유지)
- `npm test` 1,839개 통과, `typecheck`·`lint` 통과.
- 작업 트리에는 docs/74~78의 미커밋 변경이 있다. 되돌리거나 정리하지 않는다.
- `EXTENDED_FEATURES_ENABLED = false`는 그대로 둔다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 순수 모듈 `src/utils/recommendationExclusionActions.ts`는 `react-native`, AsyncStorage, `zustand`를 import하지 않는다. 타입도 마찬가지로 직접 정의한다.
- **D-2.** STEP 1에서는 결함까지 그대로 옮긴다. 고치는 것은 STEP 2에서 `clearExclusions` 한 곳뿐이다.
- **D-3.** 저장 키 `scenenote-recommendation-ui`, `version: 2`, 마이그레이션 함수, 상태 필드는 바꾸지 않는다. `RecommendationExclusion`은 스토어에서 `export type`으로 계속 내보낸다.
- **D-4.** `now` 인자는 선택이고 기본값은 `() => new Date()`다. 스토어는 넘기지 않는다.
- **D-5.** `app/settings/excluded-recommendations.tsx`, `app/(tabs)/profile.tsx`는 **바꾸지 않는다.**
- DB 마이그레이션을 만들지 않는다.

# STEP 1 — 옮기고, 실패하는 테스트부터
1. `src/utils/recommendationExclusionActions.ts`를 만든다. 6.1의 타입과 `createRecommendationExclusionActions(set, now = () => new Date())`를 둔다.
   - 본문은 현재 `recommendationUiStore.ts` 32~61행을 그대로 옮긴다. `new Date()`만 `now()`로 바꾼다.
   - **`clearExclusions`는 지금처럼 객체를 반환만 하게 둔다.**
2. 스토어를 6.2처럼 바꾼다. 인터페이스 정의를 지우고, 순수 모듈에서 import·재내보낸 뒤 펼쳐 쓴다.
3. `src/utils/recommendationExclusionActions.test.ts`에 10장 T-1~T-6을 그대로 옮긴다.
4. `npm test`를 돌려 **T-1·T-2만 실패**하는지(1,843개 통과·2개 실패) 눈으로 확인한다. 다르면 멈추고 보고한다.

# STEP 2 — 수정
`src/utils/recommendationExclusionActions.ts`에서 다음 한 곳만 바꾼다.

```diff
-    clearExclusions: () => ({
-      excludedRecommendations: [],
-      excludedRecommendationKeys: []
-    })
+    clearExclusions: () =>
+      set({
+        excludedRecommendations: [],
+        excludedRecommendationKeys: []
+      })
```

`npm test` 1,845개가 통과하는지 확인한다.

# STEP 3 — 기록
- `docs/development_next_steps.md` 맨 위에 `## 추천 제외 전체 해제 정정 (docs/79, <날짜>)` 절을 추가한다. 상태, 테스트 before/after, 수동 확인 결과 또는 미실행 사유를 적는다.
- `docs/README.md`의 79번 줄 상태를 "구현, 화면 미확인"으로 바꾼다. 화면을 실제로 봤다면 그 결과대로 적는다.

# 엣지 케이스 (전부 처리, 명세서 9장)
E-1~E-6 전부.

# 수동 확인
- 확장 화면은 로컬에서 `EXTENDED_FEATURES_ENABLED`를 잠시 `true`로 바꾸고 8081 서버를 **재시작**해야 볼 수 있다. 서버를 재시작하지 않으면 예전 번들이 나올 수 있다.
- 확인한 뒤 반드시 `false`로 되돌리고, 되돌렸다고 보고한다.
- 검증용 항목은 3장 2번의 방법으로 넣는다. 사용자의 실제 항목이 있으면 지우지 말고 미실행으로 보고한다.

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 | 검증용 항목에서 "전체 해제" → 확인하면 "0개"와 빈 상태가 보이고, 새로고침해도 다시 나타나지 않는다(`localStorage` 값의 배열이 비어 있다) |
| M-2 | 웹 8081 | 검증용 항목 2개에서 개별 "해제"는 그 항목만 지운다. 취소하면 전체 해제가 일어나지 않는다 |
| M-3 | 앱(iOS 세로) | 같은 동작. 앱을 다시 실행해도 목록이 비어 있다 |

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트를 하나도 깨뜨리지 않아야 한다. 기준선은 1,839개 통과이고, 목표는 1,845개 통과다.

# DEFINITION OF DONE
- [ ] STEP 1에서 T-1·T-2가 실제 결함으로 실패하는 것을 확인했고(모듈 부재가 아님), STEP 2 뒤 T-1~T-6이 모두 통과한다
- [ ] `npm test` 1,845개 통과, 기존 테스트 개수가 줄지 않았다
- [ ] `typecheck`·`lint` 통과
- [ ] 순수 모듈에 `react-native`·`async-storage`·`zustand` import가 0개다
- [ ] 저장 키·버전·마이그레이션 코드 diff가 없다
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(이번에 바꾼 줄 기준)
- [ ] `EXTENDED_FEATURES_ENABLED`가 `false`다
- [ ] 웹·앱 수동 확인 표(M-1~M-3) 결과 또는 미실행 사유를 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/recommendationExclusionActions.ts
src/utils/recommendationExclusionActions.test.ts
src/stores/recommendationUiStore.ts
docs/development_next_steps.md
docs/README.md
```

# 보고 항목
1. STEP 1에서 실패한 T-1·T-2의 실제 출력
2. `npm test` 결과 (before / STEP 1 / after 통과·실패 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. `recommendationUiStore.ts`의 diff
6. 수동 확인 M-1~M-3 결과 또는 미실행 사유, `EXTENDED_FEATURES_ENABLED`를 되돌렸는지
7. D-1~D-5 중 문제가 있다고 판단한 항목 (바꾸지는 말고 보고만)
8. 사람이 해야 할 후속 작업 (13장의 제품 판단, iOS 확인)

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다. 마이그레이션 함수는 옮기지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
