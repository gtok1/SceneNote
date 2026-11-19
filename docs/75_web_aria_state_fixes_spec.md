# 75. 웹 접근성 상태(aria-*) 출력 정정 명세

작성일: 2026-11-18
대상 브랜치 기준: main (519ddc7 + docs/74 미커밋 변경)
선행 문서: docs/00_ui_style_rules.md(UI-4.4·UI-4.7·UI-13·UI-15), docs/19_mobile_usability_spec.md, docs/74_subscribed_ott_spec.md(발견 경위), docs/development_next_steps.md "내 구독 OTT" 11절

---

## 1. 문제 정의

웹에서 화면 낭독기(VoiceOver·NVDA·TalkBack 브라우저)가 칩·탭·체크박스·펼침 버튼의 **현재 상태를 읽지 못한다.** 선택된 칩도 선택 안 된 칩과 똑같이 "넷플릭스, 체크박스"로만 읽힌다.

| # | 증상 (웹 8081, 2026-11-18 실측) |
|---|------|
| F-1 | `/settings/subscribed-otts` 칩: 넷플릭스가 선택돼 있어도 DOM에 `aria-checked`가 없다(`role="checkbox"`만 있음). 선택 여부를 알 수 없다 |
| F-2 | 검색·라이브러리·핀 필터 칩, 하단 탭, 시즌 선택 등 **화면 전체에서** `[aria-selected]`, `[aria-checked]` 요소가 0개다 |
| F-3 | 펼침 버튼(시즌 선택, 필터 펼치기, 줄거리 더보기)의 `expanded`, 로딩 영역의 `busy`도 같은 이유로 웹에 나오지 않는다(일부는 이미 `aria-busy`를 따로 써서 우연히 나온다) |

앱(iOS·Android)은 정상이다. 결함은 **웹 전용**이다.

## 2. 근본 원인

코드는 RN 방식의 묶음 객체 `accessibilityState={{ selected }}`로 상태를 넘긴다(app/·src/에 **100곳, 45개 파일**). 두 런타임의 처리가 다르다.

- **react-native-web 0.21.2**: `node_modules/react-native-web/dist/modules/createDOMProps/index.js`는 `aria-*`와 개별 `accessibility*` 속성(`accessibilityChecked` 등)만 DOM 속성으로 바꾼다. **`accessibilityState` 객체는 읽지 않는다.** 그래서 상태가 버려진다. (단, `Pressable`의 `disabled` 속성은 `exports/Pressable/index.js:125`에서 `aria-disabled`로 따로 나온다 — `disabled`만은 이미 웹에 나온다.)
- **React Native 0.81.5**: `node_modules/react-native/Libraries/Components/Pressable/Pressable.js:220-226`이 `aria-busy/checked/disabled/expanded/selected`를 `accessibilityState`의 같은 키로 합친다(`selected: ariaSelected ?? accessibilityState?.selected`). 즉 **`aria-*`로 바꿔도 앱의 낭독 결과는 같다.** View도 같은 방식으로 합친다.

UI 규칙 문서가 원인을 고정하고 있다: `docs/00_ui_style_rules.md` UI-4.4 "상태는 `accessibilityState`(...)", UI-4.7 "`accessibilityState={{ busy: true }}`", UI-15 체크리스트 "`accessibilityRole`/`Label`/`State`". 새 화면도 같은 방식으로 만들어져 결함이 계속 늘었다(docs/74 설정 화면이 최근 사례).

부수 원인 — 웹 의미 차이: ARIA 규격상 `aria-selected`는 `tab`·`option`·`row`·`gridcell`에만 의미가 있다. 이 앱은 선택 칩 대부분을 `role="button"`으로 만든다. 그래서 `aria-selected`만 출력하면 웹 낭독기는 여전히 무시한다. 버튼의 켜짐/꺼짐은 `aria-pressed`, 라디오는 `aria-checked`가 웹의 정답이다. 이미 3곳(`app/search.tsx:893`, `:914`, `app/(tabs)/library.tsx:436`)은 `aria-pressed`를 함께 쓰고 있다.

## 3. 재현 시나리오

1. `npm run web -- --port 8081 --localhost --clear`, 로그인.
2. `/settings/subscribed-otts`에서 넷플릭스 칩을 선택한다.
3. 개발자 도구 콘솔: `document.querySelectorAll('[role=checkbox][aria-checked]').length` → **0** (기대: 10).
4. `/search`로 이동해 `document.querySelectorAll('[aria-selected],[aria-checked]').length` → **0**.
5. 시즌이 있는 작품 상세에서 시즌 선택을 펼친 뒤 `document.querySelectorAll('[aria-expanded]').length` → **0**.

## 4. 설계 결정

### D-1. `accessibilityState`를 app/·src/에서 모두 없애고 개별 `aria-*` 속성으로 바꾼다 (최우선)
`accessibilityState` 문자열(JSX 속성 `accessibilityState={{...}}`, 스프레드 객체 키 `{ accessibilityState: {...} }` 모두)이 app/·src/의 `.ts`·`.tsx`에 **0개**가 되어야 한다. 근거: 2장. 두 런타임 모두 `aria-*`를 읽으므로 이것 하나로 웹은 고쳐지고 앱은 그대로다.

### D-2. 키는 1:1로 옮긴다 — 기존 키를 지우거나 바꾸지 않는다 (앱 동일성)
| 기존 키 | 새 속성 |
|---|---|
| `selected` | `aria-selected` |
| `checked` | `aria-checked` |
| `disabled` | `aria-disabled` |
| `expanded` | `aria-expanded` |
| `busy` | `aria-busy` |

JSX에서 하이픈 속성은 단축형이 없으므로 `selected` → `aria-selected={selected}`처럼 값을 적는다. 같은 요소에 같은 `aria-*`가 이미 있으면(예: `LoadingSkeleton.tsx`의 `aria-busy`, 로그인 버튼의 `aria-busy`) **중복으로 추가하지 않고** `accessibilityState`만 지운다. 값이 서로 다르면 구현하지 말고 보고한다.
근거: RN Pressable/View가 `aria-*`를 같은 키로 합치므로(2장), 1:1 이동이면 iOS·Android 낭독은 변하지 않는다.

### D-3. 웹 의미를 위해 역할(role)별로 **보충 속성만 추가**한다
D-2로 옮긴 뒤, 같은 요소에 다음을 더한다. D-2의 속성은 그대로 둔다(앱 동일성).

| 요소의 role | `aria-selected`가 있을 때 추가 | 이유 |
|---|---|---|
| `button` | `aria-pressed={같은 값}` — 단, 같은 요소에 `aria-current`나 `aria-pressed`가 이미 있으면 추가하지 않는다 | 웹에서 버튼의 켜짐 상태는 `aria-pressed`. 하단 탭(`app/_layout.tsx:202`)은 이미 `aria-current="page"`로 웹 의미를 준다 |
| `radio` | `aria-checked={같은 값}` | 웹 라디오의 선택은 `aria-checked` |
| `tab` | 추가 없음 | `aria-selected`가 웹 정답 |
| `checkbox`·`switch` | (이미 `checked` → `aria-checked`) 추가 없음 | |

role은 `accessibilityRole="..."` 또는 `role="..."`의 **문자열 리터럴**로 판단한다. 2장 표의 역할 추정은 참고용이며, 실제 요소의 role을 열어 확인한다.

### D-4. role·라벨·구조는 바꾸지 않는다
`SegmentedControl`을 `tablist`로, 선택 칩을 `radio`로 바꾸는 식의 **역할 재설계는 하지 않는다**(앱 낭독 문구가 바뀌고 범위가 커진다, 5장 C). `accessibilityLabel`·`accessibilityRole`·`accessibilityLiveRegion`·`accessibilityHint`는 그대로 둔다(앞 셋은 웹에서 이미 정상 출력된다).

### D-5. 재발 방지는 정적 검사 테스트로 한다
`scripts/a11yAriaStateGuard.ts`(순수 함수)와 `scripts/a11yAriaStateGuard.test.ts`를 만든다. 테스트가 app/·src/ 소스를 읽어 (R-1) `accessibilityState` 사용, (R-2) `button`에 `aria-selected`만 있고 `aria-pressed`·`aria-current`가 없음, (R-3) `radio`에 `aria-selected`만 있고 `aria-checked`가 없음을 찾으면 실패한다. RN 모듈을 import하지 않고 `node:fs`로 텍스트만 읽는다.

### D-6. UI 규칙 문서를 함께 고친다
`docs/00_ui_style_rules.md`의 UI-4.4·UI-4.7·UI-13.2·UI-15를 8장대로 바꾼다. 규칙이 `accessibilityState`를 권하는 한 결함이 다시 생긴다.

> D-1~D-6은 Codex가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

- **A. react-native-web 패치(patch-package)로 `accessibilityState`를 읽게 하기**: 의존성 업데이트마다 깨지고, 라이브러리가 이미 `aria-*`로 옮겨가는 중이다(0.19부터 `accessibility*` 개별 속성도 폐기 예정 주석).
- **B. 공용 래퍼 컴포넌트(`A11yPressable`)**: 45개 파일의 Pressable·View를 갈아끼우는 큰 변경이고 스타일·ref 전달 위험이 있다.
- **C. 역할을 ARIA에 맞게 재설계(칩 → radio/tab)**: 웹 의미는 더 정확하지만 앱 낭독 문구와 키보드 동작이 바뀐다. 이번 목적(상태가 읽히게)을 넘는다.
- **D. `a11yState({ selected })` 같은 헬퍼로 스프레드**: 정적 검사가 어려워지고, `aria-*`를 직접 쓰는 것보다 읽기 쉽지 않다.
- **E. `disabled`만 있는 곳은 건드리지 않기**: Pressable `disabled`가 이미 웹에 나오지만, D-1의 "0개" 규칙과 정적 검사를 단순하게 유지하려고 1:1로 옮긴다(동작 차이 없음).

## 6. 계약

`scripts/a11yAriaStateGuard.ts`

```ts
export interface AriaStateViolation {
  file: string;      // 저장소 루트 기준 경로, 예: "app/search.tsx"
  line: number;      // 1부터. 위반한 여는 태그 또는 문자열이 시작하는 줄
  rule: "R-1" | "R-2" | "R-3";
  snippet: string;   // 해당 줄 앞뒤 공백 제거, 최대 120자
}

/** JSX 여는 태그(<Name ... > 또는 <Name ... />) 텍스트와 시작 줄을 순서대로 돌려준다. */
export function findJsxOpeningTags(source: string): { text: string; line: number }[];

/** 한 파일 텍스트의 위반을 돌려준다. */
export function findAriaStateViolations(file: string, source: string): AriaStateViolation[];
```

판정 순서

1. **R-1**: 파일 텍스트(주석 포함)에서 `accessibilityState` 문자열이 나오는 **모든 위치**를 위반으로 낸다(줄마다 1건). 태그 밖의 객체 키·스프레드도 잡는다.
2. `findJsxOpeningTags`: `<` 다음이 영문 대문자 또는 소문자로 시작하는 이름이면 태그 시작이다. 그 뒤를 한 글자씩 읽으며 `{}` 깊이와 문자열(`"…"`, `'…'`, `` `…` ``) 안인지 추적한다. 깊이 0이고 문자열 밖에서 만난 첫 `>`에서 끝난다(`/>` 포함). `{}` 안의 `=>`, `>`, 비교 연산자는 끝으로 보지 않는다. 닫는 태그(`</`)와 `<` 뒤가 공백·숫자인 경우(비교식)는 태그가 아니다. TS 제네릭(`useState<string>(`)도 태그로 잡힐 수 있으나 role이 없어 R-2/R-3에 영향이 없으므로 따로 거르지 않는다(놓침만 생길 수 있고 오탐은 없다).
3. 각 태그의 role = `accessibilityRole="X"` 또는 `role="X"`(작은따옴표 포함)의 X. 문자열 리터럴이 아니면 role 없음으로 본다.
4. **R-2**: role이 `button`이고 태그 텍스트에 `aria-selected`가 있고 `aria-pressed`도 `aria-current`도 없으면 위반.
5. **R-3**: role이 `radio`이고 `aria-selected`가 있고 `aria-checked`가 없으면 위반.
6. 태그 텍스트 안의 `aria-*` 존재 판정은 `aria-selected`처럼 이름 문자열 포함 여부로 한다(`{...(cond ? { "aria-selected": x, "aria-pressed": x } : {})}` 스프레드도 포함으로 본다).

## 7. 데이터 모델 / SQL

해당 없음. DB·Edge Function 변경 없음.

## 8. 화면 명세

화면 모양은 바뀌지 않는다. 바뀌는 것은 웹 DOM 속성과 문서 규칙이다.

### 8.1 `docs/00_ui_style_rules.md` 변경

- **UI-4.4** 를 다음으로 바꾼다:
  > **UI-4.4** 모든 상호작용 요소에 `accessibilityRole`, 글자가 없거나 모호하면 `accessibilityLabel`. **상태는 `aria-selected`·`aria-checked`·`aria-disabled`·`aria-expanded`·`aria-busy` 개별 속성으로 준다. `accessibilityState={{…}}`는 쓰지 않는다**(react-native-web 0.21이 읽지 않아 웹 낭독기에 상태가 전달되지 않는다. 앱은 `aria-*`를 같은 상태로 읽는다, docs/75). 선택형 `button`은 `aria-selected`와 `aria-pressed`를 함께(이미 `aria-current`가 있으면 생략), `radio`는 `aria-selected`와 `aria-checked`를 함께 준다. 아이콘만 있는 버튼은 라벨 필수.
- **UI-4.7** 를 다음으로 바꾼다:
  > **UI-4.7** 로딩 영역 `aria-busy` + 라벨, 동적 안내문 `accessibilityLiveRegion="polite"`.
- **UI-13.2** 끝에 한 문장 추가:
  > `grep -n "accessibilityState" <파일들>` 0줄(`npm test`의 `a11yAriaStateGuard` 검사가 저장소 전체를 확인한다).
- **UI-15** 체크리스트 줄 `- [ ] 터치 44, \`accessibilityRole\`/\`Label\`/\`State\`, Pressable 중첩 없음` 을 다음으로 바꾼다:
  > `- [ ] 터치 44, \`accessibilityRole\`/\`Label\`, 상태는 \`aria-*\`(\`accessibilityState\` 없음), Pressable 중첩 없음`

### 8.2 바뀐 뒤 웹 DOM 기대

| 화면 | 기대 |
|---|---|
| `/settings/subscribed-otts` | 칩 10개 모두 `role="checkbox"` + `aria-checked="true|false"` |
| 하단 탭 | 현재 탭 `aria-current="page"` + `aria-selected="true"`, `aria-pressed` 없음 |
| `/search` 필터·보기 전환 칩 | 선택 칩 `aria-pressed="true"` + `aria-selected="true"` |
| 시즌 선택·필터 펼치기 | `aria-expanded="true|false"` |
| 로딩 스켈레톤 | `aria-busy="true"` (기존과 같음) |
| 인물 상세 필터 탭 | `role="tab"` + `aria-selected` |
| 회차 진행 라디오 | `role="radio"` + `aria-selected` + `aria-checked` |

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 스프레드 객체 키 `{...(cond ? { accessibilityState: { selected } } : {})}` (`src/components/pins/PinListCard.tsx:30`) | `{...(cond ? { "aria-selected": selected, "aria-pressed": selected } : {})}`로. R-1·R-2 모두 통과 | T-6, T-9, T-16 |
| E-2 | 같은 요소에 이미 `aria-busy`가 있음(`LoadingSkeleton.tsx:35`, auth 4개 화면 버튼) | `accessibilityState`만 삭제, `aria-busy` 중복 추가 금지 | T-16 |
| E-3 | 이미 `aria-pressed`가 있음(`app/search.tsx:893`, `:914`, `app/(tabs)/library.tsx:436`) | `aria-selected`만 추가, `aria-pressed` 유지 | T-8 |
| E-4 | `aria-current`가 있는 버튼(`app/_layout.tsx:202`) | `aria-selected`만, `aria-pressed` 추가 안 함 | T-10 |
| E-5 | 여러 줄에 걸친 `accessibilityState={{\n…\n}}` (`app/search.tsx:966`) | 같은 값으로 옮김. R-1은 시작 줄로 보고 | T-5, T-15 |
| E-6 | `disabled` 키 + Pressable `disabled` 속성이 함께 있음 | `aria-disabled={같은 값}`로 옮기고 `disabled` 속성 유지 | T-16 |
| E-7 | role `tab` + selected (`app/people/[id].tsx:530`) | `aria-selected`만 | T-12 |
| E-8 | role `radio` + selected (`src/components/content/EpisodeProgressCard.tsx:252`) | `aria-selected` + `aria-checked` | T-11 |
| E-9 | role이 문자열 리터럴이 아님(변수·삼항) | role 없음으로 판정 → R-2/R-3 대상 아님. 해당 요소는 사람이 확인하도록 보고 항목에 목록화 | T-14 |
| E-10 | `{}` 안의 `=>`·`>`(스타일 함수, 비교식)·문자열 안의 `>` | 태그 끝으로 보지 않음 | T-2, T-3 |
| E-11 | `.test.ts` 파일, `node_modules`, `docs/` | 검사 대상 아님 | T-16 |
| E-12 | 값이 `undefined`인 `aria-*` | 그대로 둔다(RN·RN-web 모두 출력 생략) | — (수동 M-3) |

## 10. 테스트 표

**모든 행을 `scripts/a11yAriaStateGuard.test.ts`의 테스트로 옮긴다. 줄이지 않는다.** 테스트 이름은 `75 T-N: …`.

| ID | 입력 | 기대 |
|----|------|------|
| T-1 | `'<Pressable accessibilityRole="button" onPress={go}>'` | `findJsxOpeningTags` 1개, line 1, text 전체 |
| T-2 | `'<Pressable style={({ pressed }) => [a, pressed && b]} onPress={() => x > 1}>'` | 태그 1개, 끝이 마지막 `>` |
| T-3 | `'<Text label="a > b" title={\`c > d\`} />'` | 태그 1개(자기 닫힘), 문자열 안 `>` 무시 |
| T-4 | `'if (a < b) return;\n</View>\n<View\n  accessibilityRole="tab"\n/>'` | 태그 1개, line 3 (`a < b`·닫는 태그 제외) |
| T-5 | `'<View\n  accessibilityState={{\n    busy: true\n  }}\n/>'` | R-1 1건, line 2 |
| T-6 | `'const p = { accessibilityState: { selected } };'` | R-1 1건, line 1 |
| T-7 | `'<Pressable accessibilityRole="button" aria-selected={s}>'` | R-2 1건 |
| T-8 | `'<Pressable accessibilityRole="button" aria-selected={s} aria-pressed={s}>'` | 위반 0 |
| T-9 | `'<Pressable accessibilityRole="button" {...(c ? { "aria-selected": s, "aria-pressed": s } : {})}>'` | 위반 0 |
| T-10 | `'<Pressable accessibilityRole="button" aria-selected={a} aria-current={a ? "page" : undefined}>'` | 위반 0 |
| T-11 | `'<Pressable accessibilityRole="radio" aria-selected={s}>'` / 같은 태그에 `aria-checked={s}` 추가 | R-3 1건 / 위반 0 |
| T-12 | `'<Pressable accessibilityRole="tab" aria-selected={s}>'` | 위반 0 |
| T-13 | `"<Pressable role='button' aria-selected={s}>"` | R-2 1건 (작은따옴표·`role` 속성도 인식) |
| T-14 | `'<Pressable accessibilityRole={role} aria-selected={s}>'` | 위반 0 (리터럴 아님) |
| T-15 | `findAriaStateViolations("app/x.tsx", …)` 결과 | `file`이 입력 경로, `snippet`이 공백 제거·120자 이하 |
| T-16 | **저장소 검사**: 저장소 루트의 `app/`·`src/` 아래 `.ts`·`.tsx` 전부(`*.test.ts` 제외)를 `node:fs`로 읽어 `findAriaStateViolations` 실행 | 위반 0. 실패 메시지에 `file:line rule snippet` 목록 |

T-16은 STEP 1 시점에 **R-1 위반 100건으로 실패해야 한다.**

## 11. 변경 파일 목록

새 파일
```
scripts/a11yAriaStateGuard.ts
scripts/a11yAriaStateGuard.test.ts
```

`accessibilityState` → `aria-*` (괄호는 현재 사용 수, 합계 100)
```
app/(auth)/forgot-password.tsx (1)
app/(auth)/reset-password.tsx (1)
app/(auth)/sign-in.tsx (1)
app/(auth)/sign-up.tsx (1)
app/(tabs)/library.tsx (8)
app/(tabs)/pins.tsx (1)
app/_layout.tsx (1)
app/content/[id].tsx (1)
app/library/photo-import.tsx (2)
app/people/[id].tsx (4)
app/search.tsx (18)
app/settings/subscribed-otts.tsx (1)
src/components/common/FilterSheet.tsx (3)
src/components/common/GenreFilterChips.tsx (1)
src/components/common/LoadingSkeleton.tsx (1)
src/components/common/PasswordInput.tsx (1)
src/components/common/SegmentedControl.tsx (1)
src/components/common/YearSelect.tsx (2)
src/components/content/CastSection.tsx (1)
src/components/content/ContentOverviewCard.tsx (1)
src/components/content/ContentSearchBar.tsx (5)
src/components/content/EpisodeProgressCard.tsx (6)
src/components/content/EpisodeSelector.tsx (1)
src/components/content/LibraryDangerZone.tsx (1)
src/components/content/PersonalizedRecommendationGalleryCard.tsx (3)
src/components/content/PersonalizedRecommendationListItem.tsx (3)
src/components/content/PopularRecommendationSection.tsx (3)
src/components/content/RecommendationExclusionSheet.tsx (1)
src/components/content/RecommendationQuickViewModal.tsx (2)
src/components/content/SearchResultGalleryCard.tsx (2)
src/components/content/SearchResultItem.tsx (2)
src/components/content/SeasonSelector.tsx (2)
src/components/content/SimilarContentQuickViewModal.tsx (1)
src/components/content/WatchProviderList.tsx (2)
src/components/content/WatchStatusControl.tsx (2)
src/components/library/LibraryFilterBottomSheet.tsx (1)
src/components/library/LibraryStatusFilter.tsx (1)
src/components/pins/PinComposer.tsx (3)
src/components/pins/PinDetailPanel.tsx (1)
src/components/pins/PinFilterPanel.tsx (1)
src/components/pins/PinListCard.tsx (1)
src/components/pins/PinViewToggle.tsx (1)
src/components/pins/SpoilerToggle.tsx (1)
src/components/pins/TagChip.tsx (2)
src/components/profile/ProfileSkeleton.tsx (1)
```

문서
```
docs/00_ui_style_rules.md (8.1)
docs/development_next_steps.md (검증 기록 절 추가)
```

참고 — 작성 시점 키 조합 분포(역할은 근처 줄에서 추정한 값, D-3 판단은 실제 요소로): button+selected 24, button+busy+disabled 21, button+disabled 18, button+disabled+selected 8, button+expanded 7, progressbar+busy 4, checkbox+checked 계열 4, 그 외 소수. 선택형 button 약 33곳이 D-3의 `aria-pressed` 추가 대상이다(이미 있는 3곳, `aria-current` 1곳 제외).

## 12. 범위 밖

- role 재설계(D-4), `accessibilityHint`(RN-web 미지원 — 웹 보조 설명은 별도 과제), `accessibilityLabel`·`accessibilityRole`·`accessibilityLiveRegion`(웹에서 이미 정상).
- 스타일·문구·레이아웃·상태 로직. 속성만 바꾼다.
- `node_modules` 패치, 의존성 업그레이드.
- `docs/` 안 과거 명세(docs/19 등)의 `accessibilityState` 예시 문구. UI 규칙 문서(8.1)만 고친다.
- 키보드 포커스 순서·포커스 링 등 다른 웹 접근성 항목.

## 13. 확실하지 않음 — 별도 검증 필요

- iOS VoiceOver가 `aria-selected` 버튼을 이전과 같이 "선택됨"으로 읽는지: 소스(Pressable.js:220-226)상 같은 `accessibilityState`가 되므로 같아야 하지만, 실제 낭독은 시뮬레이터 Accessibility Inspector로 확인한다(M-6).
- `role="button"`에 `aria-pressed`가 붙으면 웹 낭독기가 "전환 버튼"으로 읽는다. 필터 칩에는 맞는 표현이지만, 단일 선택 세그먼트(`SegmentedControl`)에서 어색하게 들릴 수 있다. 어색하면 후속으로 D-4 재설계를 따로 논의한다(이번에는 바꾸지 않는다).
- RN-web `Pressable`은 `disabled` 속성 값으로 `aria-disabled`를 다시 쓴다(`exports/Pressable/index.js:125`). 두 값이 같으므로 문제없지만, 값이 다른 곳이 있으면 보고한다.

---

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다.
웹에서 화면 낭독기에 칩·탭·체크박스·펼침 상태가 전달되지 않는 결함을 고친다. react-native-web 0.21이 `accessibilityState={{…}}` 객체를 읽지 않기 때문이다. 앱 동작을 바꾸지 않고 모든 `accessibilityState`를 개별 `aria-*` 속성으로 옮기고, 웹 의미를 위한 보충 속성을 더하고, 재발 방지 정적 검사와 UI 규칙을 고친다. **정정 작업**이다.

| # | 결함 |
|---|------|
| F-1 | `/settings/subscribed-otts` 칩에 `aria-checked`가 없다 |
| F-2 | 앱 전체 웹 DOM에 `aria-selected`·`aria-checked`가 0개 |
| F-3 | `expanded`·일부 `busy`도 웹에 나오지 않는다 |

# READ FIRST
1. `docs/75_web_aria_state_fixes_spec.md` — 이 명세. D-1~D-6, 계약(6장), E-1~E-12, T-1~T-16.
2. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙. 이번에 UI-4.4·4.7·13.2·15를 8.1대로 고친다.
3. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
4. `node_modules/react-native/Libraries/Components/Pressable/Pressable.js:220-226`, `node_modules/react-native-web/dist/modules/createDOMProps/index.js` — 근거 확인용(수정 금지).
5. `scripts/edgeDrift.test.ts` — `scripts/` 테스트 작성 형식 참고.

# 시작 상태 (반드시 유지)
- `npm test` 1802개 통과(작성 시점 기준선. 시작 전에 실제 수를 기록한다).
- 화면 모양·문구·동작은 그대로. 앱의 접근성 낭독 결과도 그대로(D-2).

# 바꾸면 안 되는 설계 결정
- **D-2 (최우선).** 기존 키는 같은 의미의 `aria-*`로 1:1로 옮긴다. 키를 지우거나 다른 키로 바꾸면 iOS·Android 낭독이 바뀐다. 이미 같은 `aria-*`가 있으면 중복 추가하지 않는다. 값이 다르면 멈추고 보고.
- **D-1.** app/·src/의 `.ts`·`.tsx`에 `accessibilityState` 문자열 0개.
- **D-3.** 보충은 추가만: `button`+`aria-selected` → `aria-pressed`(단 `aria-current`/`aria-pressed`가 이미 있으면 생략), `radio`+`aria-selected` → `aria-checked`.
- **D-4.** role·라벨·hint·liveRegion·구조·스타일은 바꾸지 않는다.
- **D-5.** 정적 검사는 `scripts/a11yAriaStateGuard.ts` 순수 함수 + `node:fs`. RN·Supabase import 금지.
- **D-6.** UI 규칙 문서는 8.1의 문장 그대로 바꾼다.
- 헬퍼 함수·래퍼 컴포넌트를 만들지 않는다(5장 B·D).

# STEP 1 — 실패하는 검사부터
1. `scripts/a11yAriaStateGuard.ts`에 6장 계약대로 `findJsxOpeningTags`, `findAriaStateViolations`, 타입 `AriaStateViolation`를 구현한다.
2. `scripts/a11yAriaStateGuard.test.ts`에 10장 T-1~T-16을 **전부** 옮긴다(`node:test`의 `it`, `node:assert/strict`). T-16은 기존 scripts 테스트와 같은 방식(`scripts/authHydrationIntegration.test.ts:10`의 `fileURLToPath(new URL("../", import.meta.url))`)으로 저장소 루트를 구해 `fs.readdirSync(dir, { recursive: true })`로 `app/`·`src/`의 `.ts`·`.tsx`(`.test.ts` 제외)를 읽는다.
3. `npm test`를 돌려 **T-1~T-15는 통과하고 T-16만 R-1 100건으로 실패**하는 것을 확인한다. T-1~T-15가 실패하면 검사기를 고친다. T-16이 실패하지 않거나 건수가 100이 아니면 멈추고 보고한다(현재 코드가 명세 작성 시점과 다르다는 뜻).

# STEP 2 — 1:1 이동 (D-1, D-2)
11장 파일을 하나씩 열어 모든 `accessibilityState`를 D-2 표대로 옮긴다.

교체 예:
```tsx
// 전
<Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} … >
// 후
<Pressable accessibilityRole="checkbox" aria-checked={checked} … >

// 전 (이미 aria-busy 있음, E-2)
accessibilityState={{ disabled: pending, busy: pending }}
aria-busy={pending}
// 후
aria-disabled={pending}
aria-busy={pending}

// 전 (스프레드, E-1)
{...(pressAction === "select" ? { accessibilityState: { selected } } : {})}
// 후 (D-3 보충 포함)
{...(pressAction === "select" ? { "aria-selected": selected, "aria-pressed": selected } : {})}
```

# STEP 3 — 웹 의미 보충 (D-3)
각 요소의 실제 role을 확인해 `button`+`aria-selected`에는 `aria-pressed={같은 값}`(E-3·E-4 예외), `radio`+`aria-selected`에는 `aria-checked={같은 값}`을 더한다. role이 문자열 리터럴이 아닌 요소(E-9)는 고치지 말고 목록으로 보고한다.

# STEP 4 — UI 규칙 문서 (D-6)
`docs/00_ui_style_rules.md`의 UI-4.4·UI-4.7·UI-13.2·UI-15 해당 줄을 명세 8.1의 문장으로 바꾼다. 다른 규칙은 건드리지 않는다.

# STEP 5 — 검증과 기록
1. 아래 검증 명령을 모두 통과시킨다. T-16 통과(위반 0).
2. `grep -rn "accessibilityState" app src` 0줄.
3. `docs/development_next_steps.md` 맨 위에 `## 웹 접근성 상태 aria-* 정정 (docs/75, YYYY-MM-DD)` 절을 추가해 보고 항목 1~7을 기록한다. 화면을 직접 확인하지 않았다면 상태를 "코드 검사 통과, 화면 미확인"으로 적는다.

# 엣지 케이스 (전부 처리, 명세 9장)
E-1~E-12 전부. 특히 E-1(스프레드), E-2(중복 금지), E-4(`aria-current` 탭바), E-5(여러 줄), E-8(라디오).

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(기준선 1802 + 새 테스트). typecheck가 `aria-pressed` 등 속성 타입으로 실패하면 타입 단언·`any`로 우회하지 말고 해당 위치와 오류를 보고한다(현재 `app/search.tsx:893`의 `aria-pressed`는 통과하고 있다).

# DEFINITION OF DONE
- [ ] T-16이 수정 전 R-1 100건으로 실패하는 것을 확인했고, 수정 후 위반 0으로 통과한다
- [ ] T-1~T-16 전부 테스트로 존재한다(행을 줄이지 않았다)
- [ ] `grep -rn "accessibilityState" app src` 0줄
- [ ] 기존 테스트 개수가 줄지 않았다
- [ ] `npm run typecheck`, `npm run lint` 오류·경고 0
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(변경 파일 대상)
- [ ] `docs/00_ui_style_rules.md` 4곳이 8.1 문장과 같다
- [ ] 웹·앱 수동 확인 표를 보고했다(아래 표, 실행하지 못한 행은 사유와 함께 "미실행")

수동 확인 표

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 | `/settings/subscribed-otts`: `document.querySelectorAll('[role=checkbox][aria-checked]').length === 10`, 선택한 칩만 `"true"` |
| M-2 | 웹 | `/search`: 필터·보기 전환 칩 선택 시 `aria-pressed`·`aria-selected`가 `"true"`로 바뀐다. `document.querySelectorAll('[role=button][aria-selected]:not([aria-pressed]):not([aria-current])').length === 0` |
| M-3 | 웹 | 하단 탭 현재 탭 `aria-current="page"`, `aria-pressed` 없음. 시즌 선택 펼침 전후 `aria-expanded` `"false"`→`"true"` |
| M-4 | 웹 | 로딩 스켈레톤 `aria-busy="true"`, 비활성 버튼 `aria-disabled="true"`이고 눌리지 않는다 |
| M-5 | 웹 | 화면 모양이 이전과 같다(375·1440: 검색, 라이브러리, 핀, 작품 상세, 설정) |
| M-6 | 앱(iOS 세로) | VoiceOver 또는 Accessibility Inspector: 필터 칩 "선택됨", 구독 OTT 칩 체크 상태, 시즌 선택 펼침 상태가 이전과 같게 읽힌다 |
| M-7 | 앱(iOS 세로) | 비활성 버튼이 "흐리게 표시됨"으로 읽히고 눌리지 않는다 |

# 변경해야 할 파일 (이 외 파일 수정 금지)
명세 11장 목록 전부(새 파일 2개 + 45개 화면·컴포넌트 + 문서 2개).

# 보고 항목
1. STEP 1에서 실패한 T-16의 실제 출력(건수와 앞 10줄)
2. `npm test` 결과(before / after 통과 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. `aria-pressed`·`aria-checked`를 보충한 위치 목록, E-9(role 리터럴 아님) 목록, E-2에서 값이 달라 멈춘 곳
6. D-1~D-6 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
7. 수동 확인 M-1~M-7 결과 또는 미실행 사유, 사람이 해야 할 후속 작업

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 줄이지 않는다.
- **테스트를 통과시키려고 검사 규칙이나 assertion을 완화하지 않는다. 구현을 고친다.**
- role·문구·스타일·레이아웃을 바꾸지 않는다. 리팩터링·포맷팅·"김에 고치기"를 하지 않는다.
- `node_modules`를 수정하거나 patch-package를 추가하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
