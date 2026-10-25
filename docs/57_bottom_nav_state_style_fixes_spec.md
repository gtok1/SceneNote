# 57. 하단 탭 호버·선택·포커스 표시 정리

작성일: 2026-10-12
대상 브랜치 기준: `main` (`c6a0e7e`) + 미커밋 작업(`docs/44`~`56`). 작성 시점 `npm test`는 1126개 중 1125개 통과다. 실패 1개("uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함이다.
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙)**, `docs/32_home_modern_redesign_spec.md` 6.7(하단 탭 알약 디자인)

> **근거.** 사용자 캡처(웹, 인물 탭). 하단 탭에서 "핀"에는 연파랑 사각형이 셀 전체(라벨까지, 화면 아래 끝까지)에 깔려 있다. "인물"에는 파란 테두리 사각형이 셀을 둘러싸고 아래가 잘려 있으며, 그 안에 선택 알약이 겹쳐 있다.
> 사용자 요청: "오버된 아이콘과 클릭된 아이콘의 스타일이 뭔가 겹쳐 명세서 작성해줘"

---

## 1. 문제 정의
| ID | 증상 |
|----|------|
| N-1 | 마우스를 올린 탭(호버)은 셀 전체가 연파랑 사각형으로 칠해진다. 선택된 탭은 아이콘 둘레 알약만 칠해진다. 같은 막대 안에 모양이 다른 두 표시가 생긴다. |
| N-2 | 탭을 마우스로 클릭하면 셀 전체를 두르는 파란 테두리가 계속 남는다. 테두리는 화면 아래 끝에서 잘리고, 선택 알약과 겹쳐 보인다. |
| N-3 | 웹에서는 하단 여백이 0이라 라벨·호버 사각형이 화면 아래 끝에 붙는다. |

## 2. 근본 원인
`app/_layout.tsx`의 `GlobalBottomNav`(174~221행)와 스타일(259~313행)에서 세 표시가 서로 다른 요소·모양에 걸려 있다.

| 표시 | 걸린 곳 | 모양 |
|------|---------|------|
| 선택 | `navIcon` + `navIconActive`(211행, 302~304행) | 아이콘 둘레 알약(높이 32, `radius.pill`), `colors.primarySoft` |
| 호버 | `Pressable` 셀 `navItemHovered`(207행, 286~288행) | 셀 전체 사각형(`radius.md`, 높이 56 이상), 하드코딩 `"#EFF6FF"` |
| 포커스 | 셀 `navItemFocused`(208행, 289~294행) | 셀 전체 바깥 2px 테두리(`outlineOffset: 2`) |

포커스 상태는 `onFocus`/`onBlur`(202~203행)로만 정한다. 그런데 웹에서는 마우스 클릭으로도 포커스가 생긴다. 하단 탭은 화면을 바꿔도 사라지지 않는 전역 막대라, 클릭한 탭에 포커스가 남아 테두리가 계속 보인다(N-2).

`bottomNav`의 `paddingBottom`은 `insets.bottom`(189행)이다. 웹에서는 0이라 셀이 화면 아래 끝에 닿고(N-3), 셀 바깥 테두리의 아래쪽이 잘린다.

## 3. 재현 시나리오
1. 웹 8081 1440 폭에서 로그인한 뒤 하단 "인물"을 클릭한다.
2. "인물" 셀 둘레에 파란 테두리가 남고, 아래가 잘려 있다.
3. "핀" 위에 마우스를 올리면 셀 전체가 연파랑 사각형이 된다. 선택된 "인물"의 알약과 모양이 다르다.

## 4. 설계 결정

### D-1 (최우선). 모든 상태 표시는 아이콘 알약 하나에만 그린다
| 상태 | 알약 표시 |
|------|----------|
| 선택 | 배경 `colors.primarySoft` (기존) |
| 비선택 + 호버(웹) 또는 눌림(웹·앱) | 배경 `colors.surfaceMuted` |
| 키보드 포커스 | 알약 바깥 2px `colors.primary` 테두리(`outlineOffset: 2`) |

- 셀(`Pressable`)에는 배경·테두리를 그리지 않는다. 같은 막대 안에서 표시 모양이 하나(알약)가 된다.
- 호버·눌림 색은 UI-4.2(눌림 배경 `surfaceMuted`)와 `StackBackButton`의 호버(`colors.surfaceMuted`)에 맞춘다.

### D-2. 포커스 테두리는 키보드로 이동했을 때만 보인다
- 마우스·터치로 누른 뒤에는 테두리가 없다. Tab 같은 키보드 이동으로 포커스가 왔을 때만 보인다(브라우저 `:focus-visible`과 같은 의미).
- 판단은 "마지막 입력 방식"으로 한다. 문서 전체에서 `keydown`(⌘·Ctrl·Alt 조합 제외)이면 키보드, `pointerdown`·`mousedown`·`touchstart`면 포인터다. 초기값은 포인터다.
- 포인터로 누르기 시작하면(`onPressIn` 시점 입력 방식이 포인터) 그 탭의 테두리를 지운다. 키보드로 테두리가 생긴 뒤 같은 탭을 마우스로 눌러도 테두리가 남지 않는다.
- RN-web `Pressable`은 키보드 Enter·Space로도 `onPressIn`을 보낸다(`PressResponder` keydown 처리). 그래서 `onPressIn`만으로는 클릭과 키보드를 구분할 수 없다.

### D-3. 선택된 탭은 호버·눌림에도 모양이 그대로다
선택 알약(`primarySoft`)이 호버 회색으로 바뀌지 않는다. 키보드 포커스 테두리는 선택 탭에도 그린다.

### D-4. 터치 영역·동작·접근성은 그대로다
- 셀 크기(`flex: 1`, `minHeight: 56`), `getBottomNavMetrics` 알약 폭, 아이콘·라벨 색과 굵기는 그대로다(docs/32 6.7).
- `accessibilityLabel`, `accessibilityRole`, `accessibilityState`, `aria-current`, `router.replace`도 그대로다.
- 셀의 브라우저 기본 포커스 외곽선은 알약 테두리가 대신하므로 셀에 `outlineStyle: "none" as never`를 준다. UI-5.4의 "컨테이너가 포커스 표시를 대신할 때" 예외에 해당한다.

### D-5. 하단 여백은 `max(insets.bottom, 6)`이다
- 웹과 홈 버튼 기기에서도 위 여백 6(`paddingTop: 6`)과 같은 여백을 둔다. iOS 안전 영역(예: 34)이 있으면 그 값을 쓴다.

### D-6. 판정은 순수 함수로 둔다
- 알약 표시: `getNavItemVisual`(`src/utils/bottomNavLayout.ts`)
- 입력 방식 갱신: `nextInputModality`(`src/utils/inputModality.ts`)
- 웹 문서 이벤트 구독은 훅 `useInputModality`(`src/hooks/useInputModality.ts`)가 맡는다. 앱(iOS·Android)에서는 항상 포인터를 돌려준다(테두리 없음, 접근성 포커스는 OS가 표시).

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| 호버 사각형 색만 바꿈 | 셀 사각형과 알약이라는 모양 차이가 남는다(N-1) |
| 포커스 테두리 삭제 | 키보드 사용자가 위치를 잃는다. UI-5.4 위반 |
| 전역 CSS `:focus-visible` 주입 | RN-web `StyleSheet`는 의사 클래스를 지원하지 않는다. 전역 CSS는 토큰·앱 공통 규칙 밖이다 |
| `onPressIn` 플래그만으로 클릭 구분 | 키보드 Enter·Space도 `onPressIn`을 보내 키보드 사용자의 테두리까지 지워진다(D-2) |
| 셀 전체에 선택 배경 | docs/32 6.7 알약 디자인과 다르다. 선택이 지나치게 크게 보인다 |

## 6. 계약

### 6.1 `src/utils/bottomNavLayout.ts` (추가)
```ts
export type NavPillTone = "active" | "hover" | "none";
export function getNavItemVisual(input: {
  active: boolean;
  hovered?: boolean;      // 웹만. 앱에서는 undefined
  pressed?: boolean;
  keyboardFocused: boolean;
}): { pill: NavPillTone; focusRing: boolean };
```
1. `active`이면 `pill: "active"`다. 호버·눌림은 무시한다.
2. 아니면 `hovered || pressed`일 때 `"hover"`, 그 밖에는 `"none"`이다.
3. `focusRing = keyboardFocused`다. 선택 여부와 관계없다.

### 6.2 `src/utils/inputModality.ts` (신규, React Native import 없음)
```ts
export type InputModality = "keyboard" | "pointer";
export const INITIAL_INPUT_MODALITY: InputModality = "pointer";
export function nextInputModality(
  current: InputModality,
  event: { type: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }
): InputModality;
```
1. `type === "keydown"`이고 `metaKey`·`ctrlKey`·`altKey`가 모두 거짓이면 `"keyboard"`다.
2. `type === "keydown"`이고 조합키가 하나라도 있으면 `current`를 그대로 돌려준다.
3. `type`이 `"pointerdown" | "mousedown" | "touchstart"`이면 `"pointer"`다.
4. 그 밖의 이벤트는 `current`를 그대로 돌려준다.

### 6.3 `src/hooks/useInputModality.ts` (신규)
```ts
export function useInputModality(): () => InputModality;  // 안정된 getter
```
- **웹**(`Platform.OS === "web"`이고 `document`가 있음)
  - `useRef(INITIAL_INPUT_MODALITY)`로 현재 값을 보관한다.
  - `useEffect`에서 `document`에 `keydown`, `pointerdown`, `mousedown`, `touchstart`를 캡처 단계(`true`)로 등록한다.
  - 처리기는 `ref.current = nextInputModality(ref.current, event)`다.
  - 정리 함수에서 등록을 모두 해제한다.
- **앱**: 항상 `"pointer"`를 돌려준다.
- 상태(`useState`)가 아니라 ref다. 입력 방식이 바뀔 때마다 다시 그리지 않는다.

### 6.4 `app/_layout.tsx` `GlobalBottomNav`
```tsx
const getInputModality = useInputModality();
...
<Pressable
  /* 기존 accessibility·aria-current·key·onPress 그대로 */
  onBlur={() => setFocusedHref(current => (current === item.href ? null : current))}
  onFocus={() => setFocusedHref(getInputModality() === "keyboard" ? item.href : null)}
  onPressIn={() => { if (getInputModality() === "pointer") setFocusedHref(current => (current === item.href ? null : current)); }}
  style={styles.navItem}
>
  {({ hovered, pressed }) => {
    const visual = getNavItemVisual({ active, hovered: Boolean(hovered), pressed, keyboardFocused: focusedHref === item.href });
    return (
      <>
        <View style={[
          styles.navIcon, { width: metrics.iconPillWidth },
          visual.pill === "active" ? styles.navIconActive : visual.pill === "hover" ? styles.navIconHovered : null,
          visual.focusRing ? styles.navIconFocusRing : null
        ]}>
          <Icon active={active} color={active ? colors.primary : colors.textMuted} size={24} />
        </View>
        <Text /* 기존 그대로 */>{item.label}</Text>
      </>
    );
  }}
</Pressable>
```
- 바깥 `View`(189행)의 `paddingBottom`을 `Math.max(insets.bottom, 6)`으로 바꾼다. 좌우 여백은 그대로다.

**스타일**
| 스타일 | 변경 |
|--------|------|
| `navItem` | `borderRadius`를 지우고 `outlineStyle: "none" as never`를 추가한다. 나머지는 그대로다 |
| `navItemHovered`, `navItemFocused` | **삭제**(하드코딩 `"#EFF6FF"` 포함) |
| `navIconHovered` (신규) | `{ backgroundColor: colors.surfaceMuted }` |
| `navIconFocusRing` (신규) | `{ outlineColor: colors.primary, outlineOffset: 2, outlineStyle: "solid", outlineWidth: 2 }` |
| `navIcon`, `navIconActive`, `navLabel`, `navLabelActive`, `bottomNav`, `navRow` | 그대로 |

## 7. 데이터 모델 / SQL
변경 없음.

## 8. 화면 명세
UI 규칙 준수(UI-1~UI-13). 하단 탭의 화면 고유 값은 6.4가 전부다. 알약 크기(높이 32, 폭 `getBottomNavMetrics`), 아이콘 24, 라벨 `typography.micro`는 그대로다.

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 웹, 비선택 탭에 마우스를 올림 | 그 탭 알약만 회색(`surfaceMuted`), 셀·라벨 배경 없음 | B-9, M-1 |
| E-2 | 웹, 선택 탭에 마우스를 올림 | 선택 알약 그대로 | B-8, M-1 |
| E-3 | 웹, 탭을 마우스로 클릭 | 화면 이동, 테두리 없음 | IM-4, M-2 |
| E-4 | 웹, Tab 키로 탭에 포커스 | 알약 둘레 파란 테두리, 잘림 없음 | IM-2, B-12, M-3 |
| E-5 | 웹, 키보드 포커스 후 Enter | 화면 이동, 테두리 유지(키보드 사용 중) | D-2, M-3 |
| E-6 | 웹, 키보드 테두리가 있는 탭을 마우스로 누름 | 테두리 사라짐 | D-2(`onPressIn`), M-3 |
| E-7 | 웹, ⌘/Ctrl 조합키(예: 새로고침 단축키) | 입력 방식 그대로 | IM-3 |
| E-8 | 앱, 비선택 탭을 누르는 동안 | 알약 회색, 떼면 이동 후 선택 알약 | B-10, M-5 |
| E-9 | 앱, 포커스 이벤트 | 테두리 없음(입력 방식 항상 포인터) | 6.3, M-5 |
| E-10 | 웹(안전 영역 0) | 하단 여백 6, 라벨이 화면 끝에 붙지 않음 | D-5, M-4 |
| E-11 | iOS 안전 영역 34 | 하단 여백 34(기존과 같음) | D-5, M-5 |
| E-12 | 폭 320~375, 탭 6개 | 알약 폭은 기존 `getBottomNavMetrics` 값, 가로 넘침 없음 | 기존 B-1~B-7, M-4 |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 기존 B-1~B-7은 고치지 않는다. 보존 테스트는 없다. 새 행은 새 export·새 파일이 없어 구현 전에 모두 실패해야 한다.

### `src/utils/bottomNavLayout.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| B-8 | `getNavItemVisual({ active: true, hovered: true, pressed: true, keyboardFocused: false })` | `{ pill: "active", focusRing: false }` |
| B-9 | `({ active: false, hovered: true, pressed: false, keyboardFocused: false })` | `{ pill: "hover", focusRing: false }` |
| B-10 | `({ active: false, hovered: undefined, pressed: true, keyboardFocused: false })` (앱 눌림) | `{ pill: "hover", focusRing: false }` |
| B-11 | `({ active: false, hovered: false, pressed: false, keyboardFocused: false })` | `{ pill: "none", focusRing: false }` |
| B-12 | `({ active: true, keyboardFocused: true })` / `({ active: false, keyboardFocused: true })` | `{ pill: "active", focusRing: true }` / `{ pill: "none", focusRing: true }` |

### `src/utils/inputModality.test.ts` (신규)
| ID | 입력 | 기대 |
|----|------|------|
| IM-1 | `INITIAL_INPUT_MODALITY` | `"pointer"` |
| IM-2 | `nextInputModality("pointer", { type: "keydown" })` | `"keyboard"` |
| IM-3 | `("pointer", { type: "keydown", metaKey: true })` / `("keyboard", { type: "keydown", ctrlKey: true })` / `("pointer", { type: "keydown", altKey: true })` | `"pointer"` / `"keyboard"` / `"pointer"` |
| IM-4 | `("keyboard", { type: "pointerdown" })`, `("keyboard", { type: "mousedown" })`, `("keyboard", { type: "touchstart" })` | 모두 `"pointer"` |
| IM-5 | `("keyboard", { type: "focus" })` / `("pointer", { type: "scroll" })` | `"keyboard"` / `"pointer"` |

### 수동 확인 (UI-14.3)
로그인한 상태에서만 하단 탭이 보인다. 로그인 대행은 하지 않는다. 확인할 수 없으면 사유를 보고한다.

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 비선택 탭 호버 → 그 아이콘 알약만 회색, 선택 알약과 같은 크기·위치. 선택 탭 호버 → 변화 없음. 셀 사각형 배경 없음 |
| M-2 | 웹 1440 | 탭 클릭 → 이동 후 파란 테두리 없음, 선택 알약만 보임 |
| M-3 | 웹 1440 | Tab 키로 이동 → 알약 둘레 테두리(아래 잘림 없음). Enter → 이동 후 테두리 유지. 그 탭을 마우스로 누르면 테두리 사라짐 |
| M-4 | 웹 375 | 6개 탭 한 줄, 라벨이 화면 아래 끝에서 6 떨어짐, 가로 스크롤 없음 |
| M-5 | 앱(iOS 세로) | 탭을 누르는 동안 알약 회색, 이동 후 선택 알약, 테두리 없음, 홈 표시줄 위 여백 기존과 같음, 글자 1.3배에서 라벨 잘림 없음 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `app/_layout.tsx` | 6.4 |
| `src/utils/bottomNavLayout.ts` | `getNavItemVisual`, `NavPillTone` |
| `src/utils/bottomNavLayout.test.ts` | B-8~B-12 |
| `src/utils/inputModality.ts` (신규) | 6.2 |
| `src/utils/inputModality.test.ts` (신규) | IM-1~IM-5 |
| `src/hooks/useInputModality.ts` (신규) | 6.3 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| 아이콘 모양·라벨 문구·탭 순서 | 사용자 요청 밖 |
| 다른 화면 버튼의 호버·포커스 | 이번 증상은 하단 탭 |
| `(tabs)/_layout.tsx`의 숨긴 기본 탭 바 | 표시되지 않는다(`display: "none"`) |
| 전역 포커스 표시 정책 | UI-5.4 유지 |

## 13. 확실하지 않음
- 웹 브라우저의 `outlineOffset`이 알약 바깥에 그려질 때 이웃 셀과 겹치지 않는다고 판단했다. 알약 폭은 셀 폭 − 8이고 테두리는 바깥 4px이다. M-3·M-4에서 확인한다.
- iOS·Android의 하드웨어 키보드 포커스는 다루지 않는다(앱은 항상 포인터).

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo Router) 리포의 구현 담당이다. UI 정정 작업이다.
하단 탭(`GlobalBottomNav`)에서 호버(셀 전체 사각형), 클릭 후 남는 포커스(셀 전체 테두리, 아래 잘림), 선택(아이콘 알약)이 서로 다른 모양으로 겹쳐 보인다. 모든 상태 표시를 아이콘 알약 하나로 모으고, 포커스 테두리는 키보드 이동 때만 보이게 한다.

| ID | 증상 |
|----|------|
| N-1 | 호버는 셀 전체 사각형, 선택은 알약이라 모양이 다르다 |
| N-2 | 마우스 클릭 후 셀 전체 파란 테두리가 남고 아래가 잘린다 |
| N-3 | 웹 하단 여백 0 |

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙(특히 UI-4.1, UI-4.2, UI-5.4).
2. 이 명세서 1~13장. 원인은 2장, 결정은 D-1~D-6, 계약은 6장, 테스트는 10장이다.
3. `docs/32_home_modern_redesign_spec.md` 6.7 — 하단 탭 알약 디자인.
4. `app/_layout.tsx` 174~221행(`GlobalBottomNav`), 259~313행(스타일).
5. `src/utils/bottomNavLayout.ts`(+test), `src/components/common/StackBackButton.tsx`(호버·눌림 스타일 예), `src/hooks/useModalFocus.ts`(웹 `document` 이벤트 등록 예).
6. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**

# 시작 상태 (반드시 유지)
- `git status`와 `npm test` 결과를 기록한다. 작성 시점 기준선은 1126개 중 1125개 통과이고, 기존 실패 1개는 무관하다. 다른 작업이 먼저 반영되어 숫자가 다르면 시작 시점 값을 기준선으로 보고한다. 기존 실패 외의 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 상태 표시는 아이콘 알약에만 그린다. 선택은 `primarySoft`, 비선택 호버·눌림은 `surfaceMuted`, 키보드 포커스는 알약 바깥 2px `primary` 테두리다. 셀에는 배경·테두리를 그리지 않는다.
- **D-2.** 포커스 테두리는 입력 방식이 키보드일 때만 보인다. 포인터로 누르기 시작하면 그 탭 테두리를 지운다. `onPressIn`만으로 구분하지 않는다(키보드 Enter도 `onPressIn`을 보낸다).
- **D-3.** 선택 탭은 호버·눌림에도 선택 알약 그대로다.
- **D-4.** 셀 크기, `getBottomNavMetrics`, 아이콘·라벨 색과 굵기, 접근성 속성, `router.replace`는 그대로다. 셀에는 `outlineStyle: "none" as never`를 준다.
- **D-5.** 하단 여백은 `Math.max(insets.bottom, 6)`이다.
- **D-6.** 판정은 `getNavItemVisual`·`nextInputModality` 순수 함수로 둔다. 웹 이벤트 구독은 `useInputModality` 훅이 맡는다.

# STEP 1 — 실패하는 테스트부터
- 10장 B-8~B-12를 `src/utils/bottomNavLayout.test.ts`에 추가한다.
- IM-1~IM-5로 `src/utils/inputModality.test.ts`를 만든다.
- `npm test`로 새 테스트가 전부 실패(export·모듈 없음)하는지 확인한다. 하나라도 통과하면 멈추고 보고한다.

# STEP 2 — 순수 함수
- 6.1 `getNavItemVisual`을 추가하고, 6.2 `src/utils/inputModality.ts`를 만든다.
- 새 테스트가 통과해야 한다.

# STEP 3 — 훅
- 6.3 `src/hooks/useInputModality.ts`를 만든다.
- 웹에서만 `document`에 캡처 단계로 등록하고, 정리 함수에서 모두 해제한다.

# STEP 4 — 하단 탭
- `app/_layout.tsx`를 6.4대로 바꾼다. `navItemHovered`·`navItemFocused`를 지우고 새 스타일 2개를 추가한다. 새 스타일은 토큰만 쓴다.
- 웹 8081에서 로그인된 화면을 쓸 수 있으면 M-1~M-4를 확인한다(로그인 대행 금지). 못 하면 사유를 보고한다.

# 엣지 케이스
9장 E-1~E-12 전부.

# 검증 명령
```
npm test
npm run typecheck
npm run lint
git diff -U0 -- app/_layout.tsx src/hooks/useInputModality.ts | grep -E '^\+' | grep -nE "#[0-9A-Fa-f]{3,6}\b|rgba?\(|fontWeight: \"|fontSize: [0-9]|Alert\.alert"
```
- `npm test`: 기준선 통과 개수 + 새 테스트 10개(B-8~B-12, IM-1~IM-5). 기존 실패 1개 외 실패는 0이어야 한다.
- 마지막 grep(추가한 줄)은 0줄이어야 한다(UI-13.2).

# DEFINITION OF DONE
- [ ] B-8~B-12, IM-1~IM-5가 수정 전에 실패했고 수정 후 통과한다
- [ ] 기존 B-1~B-7 diff가 없고, 테스트 개수가 줄지 않았다
- [ ] `app/_layout.tsx`에 `navItemHovered`·`navItemFocused`·`"#EFF6FF"`가 없다
- [ ] 셀(`Pressable` 스타일)에 배경·테두리 상태 스타일이 없고, 상태 표시는 `navIcon`에만 있다
- [ ] 포커스 테두리는 `getInputModality() === "keyboard"`일 때만 켜진다
- [ ] `typecheck`·`lint` 통과, UI-13.2 토큰·`Alert` grep 0줄
- [ ] 웹·앱 수동 확인 결과(또는 못 한 사유)를 M-1~M-5 표로 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
app/_layout.tsx
src/utils/bottomNavLayout.ts
src/utils/bottomNavLayout.test.ts
src/utils/inputModality.ts
src/utils/inputModality.test.ts
src/hooks/useInputModality.ts
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력(요약)
2. `npm test` before / after 통과 개수, `typecheck`·`lint`·토큰 grep 결과
3. 추가한 테스트 ID와 이름
4. M-1~M-5 결과(웹/앱 구분, 못 한 항목과 사유)
5. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)

# 금지사항
- 배포 명령을 실행하지 않는다(이번 작업은 클라이언트만이다).
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 다른 화면의 버튼 스타일을 바꾸지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
- 전역 포커스 표시를 지우지 않는다(UI-5.4). 로그인 대행 금지.
