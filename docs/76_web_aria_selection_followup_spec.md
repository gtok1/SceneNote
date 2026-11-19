# 76. 웹 접근성 선택 상태 후속 정정 명세 (docs/75 보완)

작성일: 2026-11-18
대상 브랜치 기준: main (519ddc7 + docs/74·75 미커밋 변경)
선행 문서: docs/75_web_aria_state_fixes_spec.md, docs/00_ui_style_rules.md(UI-4.4·UI-13.2), docs/development_next_steps.md "웹 접근성 상태 aria-* 정정" 절의 "웹 실제 화면 확인"

---

## 1. 문제 정의

docs/75 구현 후 웹 실제 화면 검증(2026-11-18)에서 남은 문제다. 사용자 낭독 결과는 이미 맞지만, 웹 표준 위반과 검사기 빈틈이 남았다.

| # | 문제 |
|---|------|
| F-1 | **허용되지 않는 ARIA 속성.** `role="button"` 31곳, `role="radio"` 1곳, role 없는 `View` 1곳, 역할이 바뀌는 `TagChip` 1곳이 웹에 `aria-selected`를 출력한다. ARIA 규격상 `aria-selected`는 `tab`·`option`·`row`·`gridcell`·`treeitem` 등에만 허용된다. `/library` 한 화면에서만 22개이고, 자동 접근성 검사(axe `aria-allowed-attr`, 심각도 serious)가 위반으로 잡는다. 낭독기는 이 속성을 무시하고 함께 출력되는 `aria-pressed`/`aria-checked`로 상태를 읽는다 |
| F-2 | **검사기 빈틈.** `scripts/a11yAriaStateGuard.ts`의 `findJsxOpeningTags`는 `{}` 안의 JSX를 별도 태그로 꺼내지 않는다. `app/search.tsx:786` `<FlashList …>` 여는 태그는 `ListHeaderComponent={<View>…}` 등을 품어 **655줄짜리 한 태그**로 읽힌다. 그 안의 role 28개는 첫 role 하나로 묶여 판정되므로 R-2/R-3이 사실상 꺼진다. 같은 현상이 `app/(tabs)/library.tsx:710`(69줄), `app/(tabs)/pins.tsx:256`(58줄), `app/content/[id]/episodes.tsx:73`(50줄)에도 있다 |
| F-3 | **`TagChip` 선택 상태.** `src/components/pins/TagChip.tsx:19-21`은 role이 `onPress ? "button" : undefined`로 바뀐다. `selected`를 주고 누를 수 있게 쓰면 웹에 `aria-pressed`가 없어 선택 상태가 전달되지 않는다. 현재 사용처 3곳(`app/pins/[id].tsx:75`, `src/components/pins/PinTimelineItem.tsx:70`, `src/components/pins/PinComposer.tsx:280`)은 `onPress`·`selected`를 넘기지 않아 지금은 영향이 없다 |
| F-4 | **서식.** `src/components/content/ContentSearchBar.tsx:68`에 JSX 속성 사이 빈 줄이 남았다(docs/75 정정 흔적) |

## 2. 근본 원인

- **F-1**: docs/75 D-2/D-3이 앱(iOS·Android) 낭독을 그대로 두려고 `aria-selected`를 모든 요소에 남기고, 웹 의미용 `aria-pressed`/`aria-checked`를 **덧붙이는** 방식을 택했다. RN 0.81은 `aria-pressed`를 읽지 않으므로(`node_modules/react-native/Libraries/Components/Pressable/Pressable.js:220-226`은 busy/checked/disabled/expanded/selected만 합침) 앱에는 `aria-selected`가 필요하다. 반면 react-native-web 0.21은 받은 `aria-selected`를 그대로 DOM에 낸다(`node_modules/react-native-web/dist/modules/createDOMProps/index.js`). 한 속성 세트로 두 플랫폼을 모두 만족시킬 수 없어 **플랫폼별로 다른 속성**이 필요하다.
- **F-2**: `findJsxOpeningTags`(scripts/a11yAriaStateGuard.ts:9-48)는 `{` 깊이만 세고 그 안의 `<Tag`를 무시한다. `findAriaStateViolations`(:50-71)는 태그 **전체 텍스트**에서 role 첫 일치와 `aria-*` 포함 여부를 보므로, 중첩된 자식의 속성이 부모 판정에 섞인다. docs/75 T-1~T-14에 중첩 JSX 사례가 없었다.
- **F-3**: docs/75 E-9가 동적 role을 "추측하지 않는다"로 정해 보충하지 않았다.

## 3. 재현 시나리오

1. 웹 8081 로그인 → `/library`.
2. 콘솔: `[...document.querySelectorAll('[aria-selected]')].filter(e => e.getAttribute('role') !== 'tab').length` → **22** (기대: 0).
3. `app/search.tsx:897`의 `aria-pressed={selected}` 한 줄을 지우고 `npm test` → **T-16 통과**(기대: 실패). 검사기가 빈틈을 못 잡는다. (확인 후 되돌린다)

## 4. 설계 결정

### D-1. 선택 상태는 공용 순수 함수 `selectionAriaProps`로 플랫폼별 속성을 만든다 (최우선)
`src/utils/selectionAria.ts`에 6장 계약대로 구현하고, 호출부는 `{...selectionAriaProps(role, selected, Platform.OS)}`로 펼친다. 웹은 규격에 맞는 속성만, 앱은 docs/75와 같은 `aria-selected`(라디오는 `aria-checked`도)를 받는다. 함수는 `react-native`를 import하지 않고 `os` 문자열을 인자로 받는다(테스트 가능).
docs/75 5장 D(헬퍼 기각)를 이 작업에서 뒤집는다. 근거: 플랫폼마다 다른 속성 세트를 34곳에 인라인 삼항으로 쓰면 실수가 생기고 정적 검사도 어렵다.

### D-2. `aria-selected`를 JSX에 직접 쓰는 것은 role이 `tab`인 요소에만 허용한다
그 밖의 모든 요소(button·radio·role 없음·동적 role)는 `selectionAriaProps`를 쓴다. 현재 직접 사용 35곳 중 `app/people/[id].tsx:533`(role `tab`) 1곳만 남고 34곳을 바꾼다.

### D-3. 앱 낭독은 docs/75와 같다
`os !== "web"`일 때 결과는 docs/75가 낸 앱 속성과 같다: button·plain → `aria-selected`, radio → `aria-selected`+`aria-checked`. 기존의 `aria-pressed`는 RN이 읽지 않으므로 앱에서 빠져도 낭독이 같다.

### D-4. 하단 탭은 `aria-current`가 상태를 맡는다
`app/_layout.tsx:202`는 `selectionAriaProps("button", active, Platform.OS, { current: true })` + 기존 `aria-current={active ? "page" : undefined}` 유지. 웹에서는 `aria-selected`·`aria-pressed` 모두 내지 않는다(현재 페이지 링크에 눌림 상태를 붙이지 않는다).

### D-5. 검사기는 중첩 JSX를 개별 태그로 읽고, 각 태그는 자기 속성만으로 판정한다
`findJsxOpeningTags`가 `{}` 안의 `<Tag`도 재귀로 찾아 별도 항목으로 돌려주고, 각 항목에 자식 태그 텍스트를 뺀 `ownText`를 둔다. 규칙은 `ownText`로 판정한다. 규칙 세트는 6장 R-1·R-2로 바꾼다(docs/75의 R-2/R-3은 D-2로 대체).

### D-6. role·라벨·구조·스타일은 바꾸지 않는다
docs/75 D-4와 같다. `TagChip`의 동적 role도 그대로 두고 `selectionAriaProps`에 같은 식을 넘긴다.

> D-1~D-6은 Codex가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

- **A. 그대로 둔다(낭독은 정상)**: 자동 접근성 검사가 serious로 잡고, 새 화면도 같은 패턴을 복사한다. 검사기 빈틈(F-2)은 별개로 꼭 고쳐야 한다.
- **B. 호출부마다 `aria-selected={Platform.OS === "web" ? undefined : selected}`**: 34곳의 삼항·누락 위험. 라디오·하단 탭 예외를 매번 기억해야 한다.
- **C. 웹 전용 래퍼 컴포넌트**: docs/75 5장 B와 같은 이유(큰 교체, 스타일·ref 위험).
- **D. 칩을 `role="tab"`/`option`으로 바꿔 `aria-selected`를 합법화**: 앱 낭독 문구·키보드 동작이 바뀐다(docs/75 D-4).
- **E. 검사기를 TypeScript 컴파일러 API로 다시 짜기**: 더 정확하지만 의존성·속도 부담. 현재 스캐너에 재귀와 `ownText`만 더해도 실측 빈틈(4개 태그)을 메운다.

## 6. 계약

### 6.1 `src/utils/selectionAria.ts`

```ts
export type SelectionAriaRole = "button" | "radio" | "plain";

export interface SelectionAriaProps {
  "aria-selected"?: boolean;
  "aria-pressed"?: boolean;
  "aria-checked"?: boolean;
}

export function selectionAriaProps(
  role: SelectionAriaRole,
  selected: boolean,
  os: string,
  options?: { current?: boolean }
): SelectionAriaProps;
```

판정 순서

1. `os === "web"`이면:
   1. `role === "button"`이고 `options?.current === true` → `{}`
   2. `role === "button"` → `{ "aria-pressed": selected }`
   3. `role === "radio"` → `{ "aria-checked": selected }`
   4. `role === "plain"` → `{}`
2. 그 밖의 `os`(ios·android·windows·macos 등):
   1. `role === "radio"` → `{ "aria-selected": selected, "aria-checked": selected }`
   2. 그 밖 → `{ "aria-selected": selected }` (`current`와 무관)
3. 반환 객체에는 위에 적은 키만 있다(값이 `undefined`인 키를 넣지 않는다).

### 6.2 `scripts/a11yAriaStateGuard.ts` 변경

```ts
export interface JsxOpeningTag {
  text: string;     // 기존과 같음: 여는 태그 전체(중첩 포함)
  ownText: string;  // text에서 중첩된 JSX 태그 텍스트를 뺀 것
  line: number;
}
export function findJsxOpeningTags(source: string): JsxOpeningTag[];
export function findAriaStateViolations(file: string, source: string): AriaStateViolation[];
// AriaStateViolation.rule: "R-1" | "R-2"
```

판정 순서

1. `findJsxOpeningTags`: docs/75 6장 2번 규칙에 더해, 태그 안에서 `{` 깊이 1 이상이고 문자열 밖일 때 `<` 다음이 영문자면 **중첩 태그**로 보고 같은 규칙으로 재귀 파싱한다. 중첩 태그는 결과 배열에 별도 항목(자기 시작 줄)으로 넣고, 부모의 `ownText`에서는 그 텍스트를 빈 문자열로 대체한다. 중첩 태그의 자식 내용(`>` 뒤 children)은 부모 `{}`가 닫힐 때까지 계속 스캔하며, 그 안의 여는 태그도 같은 방식으로 찾는다. 결과는 시작 위치 순서.
2. **R-1**: docs/75와 같다(`accessibilityState` 문자열이 있는 줄마다 1건).
3. **R-2**: 각 태그의 role = `ownText`의 `accessibilityRole="X"`/`role="X"` 리터럴(없거나 리터럴이 아니면 role 없음). `ownText`에 `aria-selected`가 있고 role이 `tab`이 아니면 위반.
4. docs/75의 R-2(button에 pressed 필요)·R-3(radio에 checked 필요)은 없앤다(R-2로 대체).

## 7. 데이터 모델 / SQL

해당 없음.

## 8. 화면 명세

화면 모양·문구 변화 없음. 웹 DOM 속성만 바뀐다.

### 8.1 바뀐 뒤 웹 DOM 기대

| 화면 | 기대 |
|---|---|
| 모든 화면 | `[aria-selected]`는 `role="tab"` 요소에만 있다 |
| `/search`·`/library`·핀 필터 칩, 보기 전환, 시즌·연도 선택 | 선택 칩 `aria-pressed="true"`, 나머지 `"false"`, `aria-selected` 없음 |
| 하단 탭 | 현재 탭만 `aria-current="page"`, 모든 탭에 `aria-selected`·`aria-pressed` 없음 |
| 회차 진행 라디오 | `role="radio"` + `aria-checked`, `aria-selected` 없음 |
| 핀 상세 타임라인 현재 행(`PinDetailPanel`) | `aria-selected` 없음 |
| 인물 상세 필터 탭 | `role="tab"` + `aria-selected` (변화 없음) |

### 8.2 `docs/00_ui_style_rules.md` UI-4.4 문장 교체

docs/75가 넣은 문장 중 "선택형 `button`은 `aria-selected`와 `aria-pressed`를 함께(이미 `aria-current`가 있으면 생략), `radio`는 `aria-selected`와 `aria-checked`를 함께 준다." 를 다음으로 바꾼다:

> 선택 상태는 `role="tab"`만 `aria-selected`를 직접 쓰고, 그 밖의 요소는 `{...selectionAriaProps(role, selected, Platform.OS)}`(`src/utils/selectionAria.ts`)로 준다 — 웹은 button `aria-pressed`·radio `aria-checked`, 앱은 `aria-selected`를 받는다(docs/76). 현재 페이지 표시는 `aria-current`와 `{ current: true }`.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 하단 탭(`aria-current` 함께) | `current: true` → 웹 `{}`, 앱 `aria-selected` | T-3, T-8 |
| E-2 | 라디오(`EpisodeProgressCard.tsx:252`) | 기존 `aria-selected`·`aria-checked` 직접 속성을 지우고 `selectionAriaProps("radio", …)` | T-4, T-7 |
| E-3 | role 없는 현재 행 `View`(`PinDetailPanel.tsx:115`, `aria-selected={true}`) | `selectionAriaProps("plain", true, Platform.OS)` | T-5 |
| E-4 | 동적 role(`TagChip.tsx:19-21`) | `selectionAriaProps(onPress ? "button" : "plain", Boolean(selected), Platform.OS)` | T-2, T-5 |
| E-5 | 조건부 스프레드(`PinListCard.tsx:30`) | `{...(pressAction === "select" ? selectionAriaProps("button", selected, Platform.OS) : {})}` | T-2 |
| E-6 | 기존 `aria-pressed`가 함께 있는 31곳 | `aria-selected`와 `aria-pressed` 둘 다 지우고 스프레드 하나로 | T-14 |
| E-7 | `aria-disabled`·`aria-current`·`aria-expanded` 등 다른 속성 | 그대로 둔다 | T-14 |
| E-8 | 중첩 JSX(`ListHeaderComponent={<View>…<Pressable …/>}`) | 자식 태그를 별도 항목으로, 부모 `ownText`에서 제외 | T-9, T-10, T-11 |
| E-9 | 중첩 태그 안에 또 `{}`와 화살표 함수 | 깊이 추적이 깨지지 않는다 | T-10 |
| E-10 | `role="tab"` + `aria-selected` | 위반 아님 | T-12 |
| E-11 | 이미 이 파일에 `Platform` import가 있음 | 중복 import하지 않고 기존 import에 추가 | — (typecheck/lint) |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** T-1~T-8은 `src/utils/selectionAria.test.ts`(`76 T-N: …`), T-9~T-14는 `scripts/a11yAriaStateGuard.test.ts`(`76 T-N: …`).

| ID | 입력 | 기대 |
|----|------|------|
| T-1 | `("button", true, "web")` / `("button", false, "web")` | `{ "aria-pressed": true }` / `{ "aria-pressed": false }` |
| T-2 | `("button", true, "ios")`, `("button", false, "android")` | `{ "aria-selected": true }`, `{ "aria-selected": false }` |
| T-3 | `("button", true, "web", { current: true })` / `("button", false, "web", { current: true })` | `{}` / `{}` |
| T-4 | `("radio", true, "web")` | `{ "aria-checked": true }` |
| T-5 | `("plain", true, "web")` / `("plain", true, "ios")` | `{}` / `{ "aria-selected": true }` |
| T-6 | `("button", true, "macos")`, `("button", true, "windows")` | `{ "aria-selected": true }` (web만 특별 취급) |
| T-7 | `("radio", false, "ios")` | `{ "aria-selected": false, "aria-checked": false }` |
| T-8 | `("button", true, "ios", { current: true })` | `{ "aria-selected": true }` |
| T-9 | `'<FlashList ListHeaderComponent={<View>\n<Pressable accessibilityRole="button" aria-selected={s}>\n</View>} data={d}>'` | 태그 3개(FlashList line 1, View line 1, Pressable line 2). FlashList `ownText`에 `Pressable`·`aria-selected` 없음 |
| T-10 | 위에서 Pressable에 `style={({ pressed }) => [a, pressed && b]}` 추가 | 같은 3개, 각 끝 위치 정확 |
| T-11 | T-9 입력의 `findAriaStateViolations` | R-2 1건, **line 2**(부모 FlashList 줄 아님) |
| T-12 | `'<Pressable accessibilityRole="tab" aria-selected={s}>'` | 위반 0 |
| T-13 | `'<Pressable accessibilityRole="button" aria-selected={s} aria-pressed={s}>'` / `'<View aria-selected={true}>'` / `'<C accessibilityRole={r} aria-selected={s}>'` | 각각 R-2 1건 |
| T-14 | `'<Pressable accessibilityRole="button" {...selectionAriaProps("button", s, Platform.OS)} aria-disabled={d}>'` | 위반 0 |

docs/75 테스트 변경(규칙 대체에 따른 것, 완화 아님 — 더 엄격해진다):
- `75 T-8`(button+selected+pressed → 위반 0), `75 T-9`(스프레드 문자열 → 위반 0), `75 T-10`(aria-current → 위반 0)의 기대를 **R-2 1건**으로 바꾸고, 이름 끝에 ` (docs/76: R-2 replaced)`를 붙인다.
- `75 T-7`(button, pressed 없음 → R-2), `75 T-11`의 첫 입력(radio, checked 없음 → R-3)은 **R-2 1건**으로, `75 T-11`의 둘째 입력(checked 추가 → 위반 0)은 **R-2 1건**으로, `75 T-13`(작은따옴표 role) → R-2 1건 유지, `75 T-14`(동적 role → 위반 0)는 **R-2 1건**으로 바꾼다. `75 T-12`(tab → 0)는 그대로.
- `75 T-1`~`75 T-4`의 `findJsxOpeningTags` 결과 비교는 새 `ownText` 필드를 포함하도록 기대값만 맞춘다(중첩이 없으므로 `ownText === text`).
- `75 T-16`(저장소 검사)은 그대로 두고, 새 규칙으로 위반 0이어야 한다.

STEP 1 시점 기대: `76 T-1`~`T-8`은 모듈이 없어 실패, `76 T-11`은 현재 검사기가 line 1 또는 위반 0을 내 실패, `75 T-16`은 새 R-2로 **34건** 실패.

## 11. 변경 파일 목록

새 파일
```
src/utils/selectionAria.ts
src/utils/selectionAria.test.ts
```

수정
```
scripts/a11yAriaStateGuard.ts
scripts/a11yAriaStateGuard.test.ts
app/_layout.tsx                                   (202, current)
app/search.tsx                                    (694, 897, 918)
app/(tabs)/library.tsx                            (435, 483, 516, 587, 642, 654)
app/library/photo-import.tsx                      (238, 272)
app/people/[id].tsx                               (795만. 533 tab은 유지)
src/components/common/GenreFilterChips.tsx        (70)
src/components/common/SegmentedControl.tsx        (27)
src/components/common/YearSelect.tsx              (61)
src/components/content/CastSection.tsx            (12)
src/components/content/ContentSearchBar.tsx       (377, 404 + 68 빈 줄 삭제)
src/components/content/EpisodeProgressCard.tsx    (217 button, 252 radio)
src/components/content/PopularRecommendationSection.tsx (167)
src/components/content/SeasonSelector.tsx         (78)
src/components/content/WatchProviderList.tsx      (88)
src/components/content/WatchStatusControl.tsx     (13, 19)
src/components/library/LibraryFilterBottomSheet.tsx (233)
src/components/library/LibraryStatusFilter.tsx    (61)
src/components/pins/PinComposer.tsx               (304)
src/components/pins/PinDetailPanel.tsx            (115, plain)
src/components/pins/PinFilterPanel.tsx            (20)
src/components/pins/PinListCard.tsx               (30, 조건부 스프레드)
src/components/pins/PinViewToggle.tsx             (23)
src/components/pins/TagChip.tsx                   (21, 동적 role)
docs/00_ui_style_rules.md                         (UI-4.4 문장, 8.2)
docs/development_next_steps.md                    (검증 기록 절)
```
줄 번호는 작성 시점(`grep -rn "aria-selected" app src`, 35줄) 기준이다. 실제 위치는 다시 grep해 확인한다.

## 12. 범위 밖

- role 재설계, 라벨·hint·liveRegion, 스타일·문구.
- `aria-disabled`·`aria-busy`·`aria-expanded`·`aria-checked`(checkbox·switch)·`aria-current`의 기존 사용 — 모두 웹 규격에 맞는다.
- docs/75에서 여러 `aria-*`를 한 줄에 둔 서식 정리(이번에 스프레드로 바뀌는 줄 외에는 손대지 않는다). F-4의 빈 줄 하나만 지운다.
- axe 등 자동 접근성 검사 도구 도입.
- iOS·Android 낭독 문구 변경(D-3으로 같다).

## 13. 확실하지 않음 — 별도 검증 필요

- iOS VoiceOver에서 `aria-pressed`가 빠져도 칩이 이전처럼 "선택됨"으로 읽히는지: RN 소스상 `aria-pressed`는 원래 무시되므로 같아야 한다(M-5).
- 웹 낭독기는 `aria-pressed`가 붙은 버튼을 "전환 버튼, 눌림"으로 읽는다. docs/75 이후와 같으며 이번 변경으로 달라지지 않는다.

---

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다.
docs/75 후속 **정정 작업**이다. 웹이 `role="button"`·`radio`·role 없는 요소에 ARIA 규격상 허용되지 않는 `aria-selected`를 내는 문제를 플랫폼별 속성을 만드는 순수 함수로 고치고, 중첩 JSX를 놓치는 재발 방지 검사기의 빈틈을 메운다. 앱(iOS·Android) 낭독은 바뀌지 않아야 한다.

| # | 결함 |
|---|------|
| F-1 | 웹에 허용되지 않는 `aria-selected` 34곳(button 31·radio 1·plain 1·동적 1) |
| F-2 | 검사기가 `{}` 안 JSX를 별도 태그로 읽지 않아 `app/search.tsx:786` FlashList 안 28개 role 등이 검사되지 않음 |
| F-3 | `TagChip` 동적 role에 웹 선택 상태 없음 |
| F-4 | `ContentSearchBar.tsx:68` 빈 줄 |

# READ FIRST
1. `docs/76_web_aria_selection_followup_spec.md` — 이 명세. D-1~D-6, 계약 6장, E-1~E-11, T-1~T-14와 docs/75 테스트 변경 목록.
2. `docs/75_web_aria_state_fixes_spec.md` — 선행 결정(D-2 앱 동일성, D-4 role 유지).
3. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙. 이번에 UI-4.4 문장 하나를 8.2대로 바꾼다.
4. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
5. `scripts/a11yAriaStateGuard.ts`, `scripts/a11yAriaStateGuard.test.ts` — 고칠 검사기와 기존 테스트.

# 시작 상태 (반드시 유지)
- `npm test` 1818개 통과(작성 시점 기준선. 시작 전에 실제 수를 기록한다). `grep -rn "accessibilityState" app src` 0줄.
- 화면 모양·문구·동작, 앱 낭독 결과는 그대로.

# 바꾸면 안 되는 설계 결정
- **D-3 (최우선).** 웹이 아닌 플랫폼에서 `selectionAriaProps`의 결과는 docs/75와 같은 `aria-selected`(radio는 `aria-checked`도)다. 다르게 만들면 앱 낭독이 바뀐다.
- **D-1.** `src/utils/selectionAria.ts`는 `react-native`를 import하지 않는다. 호출부가 `Platform.OS`를 넘긴다.
- **D-2.** JSX에 `aria-selected`를 직접 쓰는 곳은 `role="tab"`(`app/people/[id].tsx:533`)만 남긴다.
- **D-4.** 하단 탭은 `{ current: true }` + 기존 `aria-current` 유지.
- **D-5.** 검사기는 중첩 태그를 별도 항목으로, 판정은 `ownText`로. 규칙은 R-1·R-2 두 개.
- **D-6.** role·라벨·구조·스타일 변경 금지. `aria-disabled` 등 다른 `aria-*`는 그대로.

# STEP 1 — 실패하는 테스트부터
1. `src/utils/selectionAria.test.ts`에 T-1~T-8을, `scripts/a11yAriaStateGuard.test.ts`에 T-9~T-14를 추가한다(아직 구현 없음).
2. 같은 파일의 docs/75 테스트를 10장 "docs/75 테스트 변경" 목록대로 바꾼다.
3. `npm test`로 실패를 눈으로 확인한다: 76 T-1~T-8(모듈 없음), 76 T-9~T-11(중첩 미지원), `75 T-16`은 아직 옛 규칙이라 통과할 수 있다. 76 T-9~T-11이 실패하지 않으면 멈추고 보고한다.

# STEP 2 — 순수 함수 (D-1, D-3)
`src/utils/selectionAria.ts`를 6.1 계약대로 구현한다. T-1~T-8 통과.

# STEP 3 — 검사기 (D-5)
`scripts/a11yAriaStateGuard.ts`를 6.2 계약대로 고친다. T-9~T-14와 바뀐 docs/75 테스트가 통과하고, `75 T-16`이 **새 R-2로 34건** 실패하는 것을 확인한다. 34건이 아니면 목록과 함께 보고한다(위치가 명세 작성 시점과 다르다는 뜻일 수 있다).

# STEP 4 — 호출부 교체 (D-2, D-4, D-6)
11장 34곳을 바꾼다. 해당 파일에 `Platform`이 없으면 기존 `react-native` import에 추가한다(E-11).

```tsx
// 전 (button)
aria-selected={selected}
aria-pressed={selected}
// 후
{...selectionAriaProps("button", selected, Platform.OS)}

// 전 (하단 탭, app/_layout.tsx)
aria-selected={active}
aria-current={active ? "page" : undefined}
// 후
{...selectionAriaProps("button", active, Platform.OS, { current: true })}
aria-current={active ? "page" : undefined}

// 전 (radio, EpisodeProgressCard)
aria-selected={selected} aria-disabled={disabled} aria-checked={selected}
// 후
{...selectionAriaProps("radio", selected, Platform.OS)}
aria-disabled={disabled}

// 전 (PinListCard)
{...(pressAction === "select" ? { "aria-selected": selected, "aria-pressed": selected } : {})}
// 후
{...(pressAction === "select" ? selectionAriaProps("button", selected, Platform.OS) : {})}

// 전 (TagChip)
aria-selected={Boolean(selected)} aria-disabled={disabled}
// 후
{...selectionAriaProps(onPress ? "button" : "plain", Boolean(selected), Platform.OS)}
aria-disabled={disabled}
```
`ContentSearchBar.tsx:68`의 빈 줄을 지운다(F-4). `75 T-16` 위반 0.

# STEP 5 — 문서와 검증
1. `docs/00_ui_style_rules.md` UI-4.4의 해당 문장을 8.2 문장으로 바꾼다.
2. 검증 명령을 모두 통과시킨다. `grep -rn "aria-selected" app src`가 `app/people/[id].tsx` 1줄(tab)만 나오는지 확인한다(`src/utils/selectionAria.ts`와 테스트 파일의 문자열은 제외하고 센다).
3. `docs/development_next_steps.md` 맨 위에 `## 웹 접근성 선택 상태 후속 정정 (docs/76, YYYY-MM-DD)` 절을 추가해 보고 항목을 기록한다. 화면을 직접 보지 않았으면 "코드 검사 통과, 화면 미확인".

# 엣지 케이스 (전부 처리, 명세 9장)
E-1~E-11 전부.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(기준선 1818 + 새 14개, 10장 목록대로 바꾼 docs/75 테스트 포함). 스프레드 반환 타입이 Pressable/View 속성과 맞지 않아 typecheck가 실패하면 `any`·단언으로 우회하지 말고 위치와 오류를 보고한다.

# DEFINITION OF DONE
- [ ] 76 T-1~T-14 전부 존재하고 통과, docs/75 테스트는 10장 목록대로만 바뀌었다
- [ ] 76 T-9~T-11이 수정 전 실패, `75 T-16`이 STEP 3 후 34건으로 실패한 것을 확인했다
- [ ] `grep -rn "aria-selected" app src`(selectionAria 파일·테스트 제외)가 `app/people/[id].tsx`의 tab 1줄
- [ ] `grep -rn "accessibilityState" app src` 0줄 유지
- [ ] 기존 테스트 개수가 줄지 않았다. typecheck·lint 오류·경고 0
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(변경 파일 대상)
- [ ] UI-4.4가 8.2 문장과 같다
- [ ] 웹·앱 수동 확인 표를 보고했다(실행 못 한 행은 사유와 함께 "미실행")

수동 확인 표

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 | `/library`·`/search`·`/pins`·작품 상세에서 `[...document.querySelectorAll('[aria-selected]')].filter(e => e.getAttribute('role') !== 'tab').length === 0` |
| M-2 | 웹 | 필터 칩·보기 전환을 눌러 `aria-pressed`가 `"true"`↔`"false"`로 바뀐다 |
| M-3 | 웹 | 하단 탭: 현재 탭만 `aria-current="page"`, `aria-selected`·`aria-pressed` 없음. 회차 진행 라디오 `aria-checked` |
| M-4 | 웹 | 화면 모양이 이전과 같다(375·1440) |
| M-5 | 앱(iOS 세로) | VoiceOver/Accessibility Inspector: 필터 칩·하단 탭 "선택됨", 회차 라디오 상태가 docs/75와 같게 읽힌다 |

# 변경해야 할 파일 (이 외 파일 수정 금지)
명세 11장 목록 전부.

# 보고 항목
1. STEP 1 실패 출력(76 T-1~T-11), STEP 3 `75 T-16` 실패 건수와 앞 10줄
2. `npm test` 결과(before / after 통과 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름, 기대를 바꾼 docs/75 테스트 목록
5. 교체한 34곳 목록(파일:줄, role 인자), `Platform` import를 추가한 파일
6. D-1~D-6 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
7. 수동 확인 M-1~M-5 결과 또는 미실행 사유, 사람이 해야 할 후속 작업

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 줄이지 않는다.
- **테스트를 통과시키려고 검사 규칙이나 assertion을 완화하지 않는다. 구현을 고친다.** (10장에 적은 docs/75 테스트 기대 변경만 허용된다)
- role·문구·스타일·레이아웃을 바꾸지 않는다. 리팩터링·포맷팅·"김에 고치기"를 하지 않는다.
- `node_modules`를 수정하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
