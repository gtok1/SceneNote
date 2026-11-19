# 77. 출연진 카드 선택 상태 정정 명세

작성일: 2026-11-18
대상 브랜치 기준: main (519ddc7) + docs/74·75·76 미커밋 변경
선행 문서: [docs/76](76_web_aria_selection_followup_spec.md), [docs/75](75_web_aria_state_fixes_spec.md), [docs/00_ui_style_rules.md](00_ui_style_rules.md) UI-4.4

## 1. 문제 정의

| ID | 증상 |
|----|------|
| F-1 | 작품 상세의 출연진 카드는 누르면 인물 상세로 이동하는 버튼이다. 그런데 좋아하는 인물로 등록된 사람의 카드는 웹에서 `aria-pressed="true"`를 받는다. 그래서 웹 화면 낭독기가 이 카드를 "전환 버튼, 눌림"으로 읽는다. 눌러도 등록 상태가 바뀌지 않으므로 전환 버튼이 아니다. |
| F-2 | iOS·Android에서는 같은 카드가 `aria-selected=true`로 "선택됨"을 읽는다. 라벨에 이미 ", 등록됨"이 들어 있어서 상태가 두 번 읽히고, 이동 버튼이 "선택됨"이라는 잘못된 뜻도 전한다. |

웹 실제 화면(2026-11-18, `/content/e24a00dc-…`)에서 확인했다. DOM은 `button "오세영 인물 상세 보기, 등록됨"`이며 `aria-pressed="true"`였다.

## 2. 근본 원인

`src/components/content/CastSection.tsx:13`:

```tsx
return <Pressable key={…} accessibilityRole="button" {...selectionAriaProps("button", registered, Platform.OS)} accessibilityLabel={`${member.name} 인물 상세 보기${registered ? ", 등록됨" : ""}`} onPress={() => onOpen(member)} …>
```

- docs/75 이전 코드는 `accessibilityState={{ selected: registered }}`였다. 등록 여부를 "선택" 상태로 표현하고 있었다.
- docs/76 11장은 이 위치를 일반 선택 버튼으로 분류해 `"button"`으로 바꾸게 했고, 구현은 그 명세를 그대로 따랐다.
- 원인은 명세의 분류다. 이 카드는 선택이나 전환을 하지 않는 이동 버튼이므로, 선택 상태 속성이 붙을 이유가 없다.
- 같은 검토에서 `selectionAriaProps("button", …)`를 쓰는 나머지 호출부도 확인했다. 모두 누르면 필터·보기·값이 바뀌는 칩이나 세그먼트였다. `PinListCard`는 `pressAction === "select"`일 때만 선택 상태를 준다. 이동 버튼에 선택 상태가 붙은 곳은 `CastSection` 하나다.

## 3. 재현 시나리오

1. 웹 8081에 로그인한 뒤, 좋아하는 인물로 등록한 배우가 출연한 작품의 상세를 연다.
2. 콘솔에서 `[...document.querySelectorAll('[aria-pressed=true]')].map(e => e.getAttribute('aria-label'))`를 실행한다.
3. 결과에 `"<이름> 인물 상세 보기, 등록됨"`이 나온다. 이것이 결함이다.

## 4. 설계 결정

### D-1. 출연진 카드에는 웹·앱 모두 선택 상태 속성을 주지 않는다 (최우선)

- `selectionAriaProps(...)` 스프레드를 지운다. `"plain"`으로 바꾸지 않는다.
  - `"plain"`은 웹에서 아무 속성도 내지 않지만, 앱에서는 `aria-selected`를 낸다(docs/76 6.1). 그러면 F-2가 남는다.
- 등록 여부는 지금처럼 라벨 끝의 ", 등록됨"과 배경색·"등록됨" 배지가 전한다.
- 앱 낭독이 "선택됨, …, 등록됨"에서 "…, 등록됨"으로 바뀐다. 이것은 의도한 변경이다.

### D-2. role·라벨·스타일·onPress는 바꾸지 않는다

- `accessibilityRole="button"`과 라벨 문자열은 그대로 둔다.
- `registered`에 따른 배경색, 배지, `onPress={() => onOpen(member)}`도 그대로 둔다.
- 이번 작업은 속성 하나를 빼는 것뿐이다.

### D-3. `selectionAriaProps`와 `a11yAriaStateGuard`는 바꾸지 않는다

- 함수 계약(docs/76 6.1)은 맞다. 이번 결함은 호출부의 분류 문제다.
- 검사기 R-2는 선택 상태 속성의 "형식"을 본다. 이동 버튼인지 같은 "뜻"은 정적으로 판정하지 않는다(5장).

### D-4. 규칙 문서에 이동 버튼 문장을 더한다

UI-4.4 끝에 문장 하나를 추가한다(8.1). 같은 분류 실수가 다시 나오지 않게 하려는 것이다.

> D-N은 Codex가 임의로 바꾸면 안 되는 항목이다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| `selectionAriaProps("plain", registered, …)` | 앱에서 `aria-selected`가 남아 F-2가 그대로다 |
| 카드 role을 `link`로 바꾸기 | 웹에서 `<a>`로 바뀔 수 있고 앱 낭독도 달라진다. 이번 범위는 상태 속성 정정뿐이고 role은 범위 밖이다 |
| 검사기에 "라벨에 '상세 보기'가 있으면 선택 상태 금지" 규칙 추가 | 문구에 기대는 휴리스틱이라 깨지기 쉽다. 이동 버튼이 하나뿐이라 그 위치 고정 테스트로 충분하다 |
| `selectionAriaProps`에 `"navigation"` role 추가 | 항상 `{}`를 돌려줄 값을 위해 계약을 넓히게 된다. 그냥 스프레드를 지우는 편이 단순하다 |

## 6. 계약

`CastSection`의 카드 `Pressable` 여는 태그(`findJsxOpeningTags`의 `ownText`)는 다음을 만족한다.

1. `ownText`가 `<Pressable`로 시작하고 `인물 상세 보기`를 포함하는 태그가 **정확히 1개** 있다.
2. 그 `ownText`는 `selectionAriaProps`, `aria-selected`, `aria-pressed`, `aria-checked`, `accessibilityState` 중 어느 것도 포함하지 않는다.
3. 그 `ownText`는 `accessibilityRole="button"`, `, 등록됨`, `onPress={() => onOpen(member)}`를 그대로 포함한다.

`CastSection.tsx` 파일 전체에 `selectionAriaProps`가 남아 있지 않다. import도 지운다.

## 7. 데이터 모델 / SQL

해당 없음. DB 마이그레이션을 만들지 않는다.

## 8. 화면 명세

화면 모양은 바뀌지 않는다. 바뀌는 것은 접근성 속성뿐이다.

| 플랫폼 | 등록된 인물 카드, 이전 | 이후 |
|--------|------------------------|------|
| 웹 | `role=button aria-pressed="true"`, 라벨 "…, 등록됨" | `role=button`, `aria-pressed` 없음, 라벨 같음 |
| iOS·Android | 선택됨 + 라벨 "…, 등록됨" | 라벨 "…, 등록됨"만 |
| 등록되지 않은 카드, 웹 | `aria-pressed="false"` | 속성 없음 |

### 8.1 `docs/00_ui_style_rules.md` UI-4.4 문장 추가

UI-4.4의 "현재 페이지 표시는 `aria-current`와 `{ current: true }`." 바로 뒤에 아래 문장을 넣는다.

> 누르면 다른 화면으로 이동만 하는 버튼(예: 출연진 카드)에는 선택 상태를 주지 않는다. 등록·즐겨찾기 같은 표시는 라벨에 넣는다(docs/77).

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 등록된 인물 카드(웹) | `aria-pressed`·`aria-selected` 없음, 라벨 "…, 등록됨" | T-2, T-3, M-1 |
| E-2 | 등록되지 않은 카드(웹) | 상태 속성 없음, 라벨에 ", 등록됨" 없음 | T-2, M-1 |
| E-3 | 앱(iOS) 등록된 카드 | "선택됨" 없이 라벨만 읽힘 | T-2, M-3 |
| E-4 | 출연진이 8명 넘음 | 기존처럼 8명까지만 표시. 변경 없음 | T-3 (구조 보존) |
| E-5 | 다른 선택 칩(필터·세그먼트) | docs/76 그대로 `aria-pressed` 유지 | 75 T-16, M-2 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.**

새 파일은 `scripts/castSectionA11y.test.ts`다. 순수 Node만 쓰고 RN은 import하지 않는다. `readFileSync`로 `src/components/content/CastSection.tsx`를 읽고 `./a11yAriaStateGuard`의 `findJsxOpeningTags`를 쓴다. 경로는 `fileURLToPath(new URL("../", import.meta.url).href)` 기준이며, 이것은 `scripts/a11yAriaStateGuard.test.ts`와 같은 방식이다.

| ID | 테스트 이름 | 입력 | 기대 | 수정 전 |
|----|------------|------|------|---------|
| T-1 | `77 T-1: cast section has exactly one person-detail card opening tag` | CastSection 원문 | 6장 계약 1을 만족하는 태그 1개 | 통과 |
| T-2 | `77 T-2: cast card exposes no selection or toggle state on any platform` | T-1 태그의 `ownText`와 파일 전체 | 6장 계약 2. 파일 전체에 `selectionAriaProps` 0회 | **실패** |
| T-3 | `77 T-3: cast card keeps its button role, registered label and open handler` | T-1 태그 `ownText` | 6장 계약 3 | 통과 |

기준선은 1,832개 통과이고, 수정 후에는 1,835개가 통과해야 한다.

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `scripts/castSectionA11y.test.ts` | 새 파일. T-1~T-3 |
| `src/components/content/CastSection.tsx` | 13행 `{...selectionAriaProps("button", registered, Platform.OS)}` 삭제. 7행 `selectionAriaProps` import 삭제. 1행 `Platform`을 더 쓰지 않으면 import에서 뺀다 |
| `docs/00_ui_style_rules.md` | UI-4.4 문장 추가(8.1) |
| `docs/development_next_steps.md` | 맨 위에 docs/77 절(상태·테스트 결과·수동 확인 표) 추가 |
| `docs/README.md` | 77번 줄 상태 갱신 |

## 12. 범위 밖

- `selectionAriaProps`, `a11yAriaStateGuard`는 바꾸지 않는다(D-3).
- 다른 `selectionAriaProps("button", …)` 호출부 30곳(하단 탭 current 1곳 포함): 필터·세그먼트·보기 전환은 실제로 눌림 상태가 바뀌므로 그대로 둔다.
- 단일 선택 세그먼트를 `radiogroup`/`radio`로 바꾸는 일은 화면 여러 곳의 role이 바뀌는 별도 작업이다.
- 카드 role을 `link`로 바꾸지 않는다(5장).
- 출연진 카드의 스타일·배지·정렬·개수는 바꾸지 않는다.

## 13. 확실하지 않음 — 별도 검증 필요

- iOS VoiceOver에서 상태 없이 라벨 "…, 등록됨"만 자연스럽게 읽히는지(M-3). RN 0.81 소스상 `aria-selected`가 없으면 "선택됨"이 나오지 않아야 한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 이번 작업은 **정정 작업**이다. 작품 상세의 출연진 카드는 누르면 인물 상세로 이동만 하는 버튼인데, 등록된 인물이면 웹은 `aria-pressed="true"`, 앱은 `aria-selected=true`를 받는다. 이 선택 상태 속성을 웹·앱 모두에서 제거한다. 라벨·role·모양·동작은 그대로 둔다.

| ID | 결함 |
|----|------|
| F-1 | 웹 낭독기가 이동 버튼을 "전환 버튼, 눌림"으로 읽음 |
| F-2 | 앱 낭독기가 "선택됨"을 읽고, 라벨의 ", 등록됨"과 상태가 겹침 |

# READ FIRST
1. `docs/77_cast_card_selection_state_fix_spec.md` — 이 명세. D-1~D-4, 계약 6장, E-1~E-5, T-1~T-3.
2. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙. UI-4.4를 고친다.
3. `docs/76_web_aria_selection_followup_spec.md` 6.1 — `selectionAriaProps` 계약(`"plain"`도 앱에서는 `aria-selected`를 내는 이유).
4. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
5. `src/components/content/CastSection.tsx`, `scripts/a11yAriaStateGuard.ts`(`findJsxOpeningTags`), `scripts/a11yAriaStateGuard.test.ts`(파일 읽기 방식).

# 시작 상태 (반드시 유지)
- `npm test` 1,832개 통과, `typecheck`·`lint` 통과.
- `75 T-16`(app·src 전체 ARIA 검사)이 계속 통과해야 한다.
- 작업 트리에는 docs/74·75·76의 미커밋 변경이 있다. 되돌리거나 정리하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 스프레드를 **삭제**한다. `"plain"`으로 바꾸면 앱에 `aria-selected`가 남아 F-2가 재발한다.
- **D-2.** `accessibilityRole="button"`, 라벨 문자열, `registered` 배경색·배지, `onPress`, `key`, `style`은 바꾸지 않는다.
- **D-3.** `src/utils/selectionAria.ts`, `scripts/a11yAriaStateGuard.ts`는 **바꾸지 않는다.**
- **D-4.** UI-4.4에는 8.1의 문장만 추가한다. 기존 문장을 고치지 않는다.
- DB 마이그레이션을 만들지 않는다.

# STEP 1 — 실패하는 테스트부터
- `scripts/castSectionA11y.test.ts`를 만들고 10장 T-1~T-3을 그대로 옮긴다.
  - `node:test`의 `it`, `node:assert/strict`, `node:fs`, `node:url`만 쓴다.
  - `./a11yAriaStateGuard`에서 `findJsxOpeningTags`를 import한다.
- `npm test`를 돌린다. **T-2만 실패하고 T-1·T-3은 통과**하는지 눈으로 확인한다.
- 다른 결과가 나오면 멈추고 보고한다. 예를 들어 T-1이 태그를 찾지 못하거나 T-2가 통과하면 시나리오를 잘못 짚은 것이다.

# STEP 2 — CastSection 수정
`src/components/content/CastSection.tsx`:

```diff
-import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
+import { Pressable, StyleSheet, Text, View } from "react-native";
 …
-import { selectionAriaProps } from "@/utils/selectionAria";
 …
-      return <Pressable key={…} accessibilityRole="button" {...selectionAriaProps("button", registered, Platform.OS)} accessibilityLabel={…}
+      return <Pressable key={…} accessibilityRole="button" accessibilityLabel={…}
```

- `Platform`이 파일의 다른 곳에서 쓰이면 import에 남긴다. 실제로 확인한다.
- 13행의 나머지 내용은 한 글자도 바꾸지 않는다.
- 주석은 달지 않는다. 근거는 UI-4.4와 이 명세에 있다.

`npm test`에서 T-1~T-3과 75 T-16이 통과하는지 확인한다.

# STEP 3 — 규칙 문서
`docs/00_ui_style_rules.md`의 UI-4.4에서 "현재 페이지 표시는 `aria-current`와 `{ current: true }`." 바로 뒤에 8.1 문장을 그대로 넣는다.

# STEP 4 — 기록
- `docs/development_next_steps.md` 맨 위에 `## 출연진 카드 선택 상태 정정 (docs/77, <날짜>)` 절을 추가한다. 상태, 테스트 before/after, 수동 확인 표 M-1~M-3의 결과 또는 미실행 사유를 적는다.
- `docs/README.md`의 77번 줄 상태를 "구현, 화면 미확인"으로 바꾼다. 화면을 실제로 봤다면 그 결과대로 적는다.

# 엣지 케이스 (전부 처리, 명세서 9장)
E-1~E-5 전부. E-5는 다른 호출부를 건드리지 않는 것으로 지킨다.

# 수동 확인

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 | 등록된 인물이 있는 작품 상세에서 `[...document.querySelectorAll('[aria-label*="인물 상세 보기"]')].map(e => [e.getAttribute('aria-pressed'), e.getAttribute('aria-selected')])`가 모두 `[null, null]`이다. 라벨의 ", 등록됨"과 배지가 이전과 같다 |
| M-2 | 웹 8081 | 같은 화면의 다른 칩(시청 상태·OTT 분류 등)은 `aria-pressed`가 그대로다. 카드를 누르면 인물 상세로 이동한다 |
| M-3 | 앱(iOS 세로) | VoiceOver에서 등록된 카드가 "선택됨" 없이 "<이름> 인물 상세 보기, 등록됨, 버튼"으로 읽힌다 |

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트를 하나도 깨뜨리지 않아야 한다. 기준선은 1,832개 통과이고, 목표는 1,835개 통과다.

# DEFINITION OF DONE
- [ ] T-2가 수정 전에 실패하는 것을 확인했고, 수정 후 T-1~T-3이 모두 통과한다
- [ ] `npm test` 1,835개 통과, 기존 테스트 개수가 줄지 않았다
- [ ] `typecheck`·`lint` 통과
- [ ] `CastSection.tsx`에 `selectionAriaProps`가 0회이고, 13행에서 바뀐 것은 스프레드 삭제뿐이다
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(이번 변경이 새로 만든 줄 기준)
- [ ] UI-4.4에 8.1 문장이 들어갔다
- [ ] 웹·앱 수동 확인 표(M-1~M-3) 결과 또는 미실행 사유를 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
scripts/castSectionA11y.test.ts
src/components/content/CastSection.tsx
docs/00_ui_style_rules.md
docs/development_next_steps.md
docs/README.md
```

# 보고 항목
1. STEP 1에서 실패한 T-2의 실제 출력
2. `npm test` 결과 (before / after 통과 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. `CastSection.tsx`의 diff
6. 수동 확인 M-1~M-3 결과 또는 미실행 사유
7. D-1~D-4 중 문제가 있다고 판단한 항목 (바꾸지는 말고 보고만)
8. 사람이 해야 할 후속 작업 (iOS VoiceOver 확인 등)

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다. 특히 다른 `selectionAriaProps` 호출부를 바꾸지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
