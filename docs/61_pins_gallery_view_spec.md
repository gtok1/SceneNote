# 61. 핀 탭 갤러리 보기(기본) + 목록 전환

작성일: 2026-10-15
대상 브랜치 기준: `main` (`bfcc3fd`) + `docs/60` 구현(미커밋, 2026-10-15 검증: `npm test` 1200개 중 1199개 통과, 무관 기존 실패 1개). 핀과 무관한 미커밋 작업(인물 탭·하단 탭 등)이 함께 있다
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙 — 이 명세는 다른 점과 화면 고유 값만 쓴다)**, `docs/60_pins_tab_context_and_grouping_fixes_spec.md`(현재 핀 탭 계약: 행 배열·패널 타임라인·상대 날짜), `docs/44_pins_tab_saas_redesign_spec.md`(목록 보기 구조)

> **근거.** `docs/60` 구현 뒤 사용자 캡처(웹, 약 1000px)와 의견: "UI적으로 변화는 크지 않아 보여", "갤러리 방식처럼 UI는 이렇게 기본 화면으로 가고 싶어".
> 사용자 선택(2026-10-15): 카드 모양 **포스터 격자**, 넓은 화면 **전체 폭 갤러리(패널 없음, 카드 누름 → 핀 상세)**, **갤러리 기본 + 목록 전환(기기에 기억)**.

---

## 1. 문제 정의

| ID | 증상 | 원인 |
|----|------|------|
| G-1 | 핀 탭 첫 화면이 가로로 긴 목록 카드다. 1000px에서 카드 폭 약 645px 중 내용은 왼쪽 400px 정도이고 오른쪽이 빈다. 포스터는 64px로 작아 "모아 보는" 느낌이 없다 | `app/(tabs)/pins.tsx:245~287` `FlashList`가 항상 1열(`numColumns` 없음), 카드는 `PinListCard`(가로 배치)뿐 |
| G-2 | 라이브러리 탭은 "갤러리 보기"(포스터 격자)가 기본인데 핀 탭에는 보기 전환이 없다. 탭마다 첫인상이 다르다 | 라이브러리만 `src/stores/libraryUiStore.ts`(`viewMode: "detail" \| "gallery"`, 기본 `"gallery"`, 기기 저장)와 `ContentGalleryCard`를 쓴다 |
| G-3 | 목록 보기 패널의 "이 작품의 핀 N개" 머리 줄과 첫 행 사이가 지나치게 벌어져 있다(캡처) | `src/components/pins/PinDetailPanel.tsx:92~102` 타임라인을 프래그먼트(`<>`)로 넣어 패널 `content`의 `gap: spacing.lg`(143행)가 구분선·머리 줄·행 사이마다 들어가고, 머리 줄이 `minHeight: 44` |

## 2. 근본 원인
- **G-1·G-2.** 핀 탭은 `docs/44`에서 "목록 + 옆 패널"로만 설계됐다. 핀 데이터에는 포스터(`content_poster_url`)가 있어 라이브러리와 같은 포스터 격자를 만들 수 있다. 라이브러리 갤러리 구현(열 수 `src/utils/libraryResponsive.ts:14`, 카드 틀 `src/components/content/ContentGalleryCard.tsx:57~70·161~199`, 목록 `app/(tabs)/library.tsx:704~720`, 저장 `libraryUiStore.ts`)을 그대로 따르면 탭 간 모양이 맞는다.
- **G-3.** 섹션을 하나의 `View`로 묶지 않았다.

## 3. 재현 시나리오
1. 웹 8081, 폭 1000·1440, 핀이 있는 계정으로 핀 탭을 연다 → 1열 목록 + 옆 패널(G-1).
2. 라이브러리 탭으로 가면 포스터 격자다(G-2).
3. 핀 탭(최신순)에서 같은 작품 핀이 2개 이상인 핀을 고른다 → 패널 "이 작품의 핀" 머리 줄 아래가 크게 비어 있다(G-3).

## 4. 설계 결정

### D-1. 보기 방식은 `"gallery"`(기본) | `"list"` 두 가지이고 기기에 기억한다
- 새 타입 `PinViewMode = "gallery" | "list"`(`src/types/pins.ts`).
- 새 저장소 `src/stores/pinsUiStore.ts`는 `libraryUiStore.ts`를 **그대로 복사한 구조**(zustand `persist` + `createJSONStorage(AsyncStorage | noopStorage)`)다. `name: "scenenote-pins-ui"`, `version: 1`, `migrate: () => ({ viewMode: "gallery" })`, 기본 `"gallery"`.
- `"list"`는 **지금 화면 그대로**다(`docs/44`·`docs/60`: 1열 카드, 960 이상 패널·타임라인·작품 보기·핀 추가). 목록 보기의 동작을 바꾸지 않는다(G-3 간격 정리만).

### D-2. 갤러리에서는 폭과 무관하게 옆 패널이 없고, 카드를 누르면 핀 상세로 간다
`showDetailPanel = viewMode === "list" && getPinsLayout(width).showDetailPanel`, `pressAction = getPinCardPressAction(showDetailPanel)`(갤러리면 항상 `"open"`). 판정은 순수 함수 `getPinViewPresentation`(6장). `getPinsLayout`은 바꾸지 않는다(`docs/60` D-9, P-L 테스트 고정).

### D-3. 열 수는 라이브러리 갤러리와 같은 기준이다
`getPinGalleryColumns(width, fontScale)`: `w = 유효 폭 / max(1, fontScale)`, `w >= 1280 → 6`, `>= 960 → 5`, `>= 700 → 4`, 그 외 `2`. 라이브러리(`libraryResponsive.ts:14`)와 같은 경계라 두 탭의 카드 크기가 같다(약 165~180px). 글자 확대는 `getResponsiveRecommendationColumns`처럼 폭을 나눠 열을 줄인다(UI-4.6). 잘못된 폭(`NaN`·0·음수)은 375.

### D-4. 카드 틀은 라이브러리 `ContentGalleryCard`와 같다
- 셀 `flex: 1`·`alignSelf: "stretch"`·`minWidth: 0`·`padding: spacing.sm`, 카드 `surface`·hairline `border`·`radius.lg`·`flexGrow: 1`, **그림자 없음**, 포스터 2:3·위쪽 모서리 `radius.lg`·대체 배경 `surfaceMuted`(`ContentGalleryCard.tsx:161~199`와 같은 값).
- 목록의 셀 여백 때문에 `FlashList`에 `marginHorizontal: -spacing.sm`(라이브러리 715행과 같은 방식). 대신 **목록 안에 있는** 머리글(`ListHeaderComponent`)·빈/오류 상태·작품 머리글에는 `paddingHorizontal: spacing.sm`을 줘서 화면 시작선을 하나로 유지한다(UI-2.1). 좌표는 8.1에 있다.
- 카드는 `Pressable` 하나다(UI-4.3). 카드 안에 다른 누름 요소가 없다.

### D-5. 포스터 카드 내용과 높이 맞춤
- 포스터 왼쪽 아래에 **시간 칩 + 감정 배지**(목록 카드 `time`·`emotion` 스타일과 같은 값). 장식이므로 접근성에서 숨기고 카드 라벨이 대신한다.
- 본문(`padding: spacing.sm`, `gap: spacing.xs`) 네 줄, 줄 수 고정:
  1. 작품명 `typography.label` `text` 1줄
  2. 장면 라벨(시즌 포함·회차 제목 제외, 예 "시즌 3 · 86화") `typography.micro` `textMuted` 1줄 — 영화면 빈 줄을 **자리만 유지**
  3. 메모 `typography.caption` 2줄(가림·없음 규칙은 목록과 같음)
  4. 상대 날짜 `typography.micro` `textSubtle` `tabular-nums` 1줄
- 각 줄은 `minHeight = lineHeight × 줄 수 × fontScale`(라이브러리 제목 85행 방식)로 자리를 잡아 **같은 행 카드 높이가 맞는다**(높이 측정 없음).
- 태그는 갤러리 카드에 넣지 않는다(목록 보기·핀 상세에서 본다. 검색은 그대로 태그를 찾는다).

### D-6. "작품별" + 갤러리: 작품 머리글은 한 줄 전체, 그 아래는 포스터 없는 "장면 카드"
- 행 배열은 `docs/60`의 `buildPinListRows`를 그대로 쓴다. 머리글 행은 `overrideItemLayout`로 `span = maxColumns`(한 줄 전체), 핀 행은 1.
- 머리글은 `PinGroupHeader`를 그대로 쓰고 `paddingHorizontal: spacing.sm` 감싸기만 더한다.
- 머리글 아래 카드는 `variant="scene"`: 포스터가 없고(머리글에 있다) 본문 `padding: spacing.md`: 장면 라벨 `typography.label` `text` 1줄 → 시간 칩·감정 배지 줄 → 메모 `typography.caption` **4줄** → 상대 날짜. 줄 높이 맞춤은 D-5와 같다.
- 같은 포스터가 묶음 안에서 반복되지 않는다.

### D-7. 보기 전환은 도구 줄의 아이콘 두 개다
- 새 컴포넌트 `PinViewToggle`: `[갤러리 grid-outline][목록 list-outline]`, 각 44×44 `radius.pill`, 바깥 알약(`surface`, hairline `border`). 선택은 배경 `primary`·아이콘 `surface`, 그 외 아이콘 `textMuted`(라이브러리 `filterSelected`와 같은 선택 모양). 아이콘 18.
- 위치: 넓은 도구 줄은 `정렬 → 보기 전환 → 필터`. 좁은 화면(`stackTools`) 둘째 줄은 `정렬(flex) → 보기 전환 → 필터`.
- 접근성: 바깥 `View` `accessibilityLabel="보기 방식"`, 각 버튼 `accessibilityRole="button"`·`accessibilityLabel`("갤러리 보기"/"목록 보기")·`accessibilityState={{ selected }}`.
- 라벨 글자가 없는 이유: 375에서 둘째 줄에 정렬·필터와 함께 들어가야 한다.

### D-8. FlashList 구성
- `key={viewMode}`(라이브러리 718행처럼 보기를 바꾸면 목록을 새로 만든다. 스크롤은 맨 위로).
- `numColumns={view.numColumns}`(목록 1). 폭이 바뀌어 열 수가 바뀌는 것은 라이브러리와 같이 다시 만들지 않는다.
- 갤러리는 `ItemSeparatorComponent` 없음(셀 여백이 간격), `overrideItemLayout` 사용. 목록은 지금 그대로.

### D-9. 갤러리 로딩은 포스터 격자 스켈레톤
`LoadingSkeleton variant="recommendation-card" count={numColumns * 2} columns={numColumns} accessibilityLabel="핀을 불러오는 중이에요"`. 감싸기는 기존 `styles.sharedInset`(`marginHorizontal: -spacing.lg`)를 그대로 쓴다(8.1 좌표 계산). 오류·빈 상태는 두 보기가 같다(UI-6.4 순서 유지).

### D-10. 기존 계약을 바꾸지 않는다
`getPinsLayout`·`PinsLayout`·`PINS_SCREEN_COPY`·`PIN_CONTEXT_COPY`·`PinCardModel`·`createPinCardModel`·`buildPinListRows`·`createPinPanelTimeline`은 **수정하지 않는다**(P-L·P-K1·K-2·P-C·G·TL 테스트 고정). 새 문구는 `PIN_VIEW_COPY`, 새 판정은 `src/utils/pinListUi.ts`에 **추가**만 한다. **기존 테스트는 한 줄도 바꾸지 않는다.**

### D-11. 목록 보기 패널 타임라인 간격 정리(G-3)
`PinDetailPanel`의 타임라인 프래그먼트 안 "머리 줄 + 행 목록"을 `View style={styles.timelineSection}`(`gap: spacing.xs`)으로 묶는다. 구분선은 밖(패널 `gap`)에 그대로 둔다. 그 외 패널 코드는 바꾸지 않는다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 메모(대사) 카드 / 포스터 위 글자(오버레이) | 사용자가 포스터 격자를 골랐다. 오버레이는 긴 메모 가독성이 낮다 |
| 갤러리 + 오른쪽 패널 | 사용자가 전체 폭을 골랐다. 패널·타임라인은 목록 보기에 남는다 |
| 목록 보기 삭제 | 사용자가 전환을 골랐다. 핀이 많을 때 촘촘히 훑는 보기가 필요하다 |
| 홈 `getHomeLayout().posterColumns`(375에서 3열) | 카드 폭 약 100px라 메모 2줄이 거의 읽히지 않는다 |
| 핀 전용 새 열 경계(예 2/3/4/5) | 라이브러리 갤러리와 카드 크기가 달라진다(G-2 재발) |
| `ContentGalleryCard` 재사용 | 라이브러리 항목 타입·행동(이어 보기·상태 배지) 전용이다. 틀만 같은 값으로 맞춘다 |
| 메이슨리(높이 제각각) | 줄이 들쭉날쭉해 훑기 어렵다. 고정 줄 수로 높이를 맞춘다 |
| 카드 높이를 측정해 맞춤(라이브러리 `onBodyHeight`) | 핀 카드는 줄 수가 고정이라 측정 없이 맞출 수 있다. 측정은 재렌더가 늘어난다 |
| 작품별 갤러리에서도 카드마다 포스터 | 같은 포스터가 묶음 안에서 반복된다 |
| 보기 상태를 화면 `useState`로 | 사용자가 "기기에 기억"을 골랐다 |
| 갤러리 카드에 태그 | 165px 카드에서 밀도가 지나치다 |
| 보기 전환을 `SegmentedControl` 글자("갤러리/목록")로 | 375 둘째 줄에 정렬 세그먼트·필터와 함께 넣으면 넘친다 |

## 6. 계약

### 6.1 `src/types/pins.ts` (한 줄 추가)
```ts
export type PinViewMode = "gallery" | "list";
```

### 6.2 `src/stores/pinsUiStore.ts` (신규)
`src/stores/libraryUiStore.ts` 1~33행과 같은 구조.
```ts
interface PinsUiState {
  viewMode: PinViewMode;
  setViewMode: (viewMode: PinViewMode) => void;
}
export const usePinsUiStore = create<PinsUiState>()(persist(..., {
  name: "scenenote-pins-ui",
  version: 1,
  migrate: () => ({ viewMode: "gallery" as const }),
  storage: createJSONStorage(() => (canUsePersistentStorage ? AsyncStorage : noopStorage))
}));
```

### 6.3 `src/utils/pinListUi.ts` (추가만)
런타임 import는 상대 경로, 타입은 `import type`(`PinViewMode`는 `../types/pins`).
```ts
export const PIN_GALLERY_MEMO_LINES = 2;
export const PIN_SCENE_MEMO_LINES = 4;

export const PIN_VIEW_COPY = {
  toggleLabel: "보기 방식",
  loading: "핀을 불러오는 중이에요"
} as const;

export const PIN_VIEW_OPTIONS: readonly {
  value: PinViewMode;
  label: string;
  icon: "grid-outline" | "list-outline";
}[] = [
  { value: "gallery", label: "갤러리 보기", icon: "grid-outline" },
  { value: "list", label: "목록 보기", icon: "list-outline" }
];

export function getPinGalleryColumns(width: number, fontScale?: number): number;

export interface PinViewPresentation {
  gallery: boolean;
  showDetailPanel: boolean;
  pressAction: "select" | "open";
  numColumns: number;
}
export function getPinViewPresentation(input: {
  viewMode: PinViewMode;
  width: number;
  fontScale?: number;
}): PinViewPresentation;

export interface PinGalleryCardModel {
  title: string;
  sceneLabel: string;          // formatPinEpisodeLabel(pin, { includeTitle: false }) ?? ""
  timeLabel: string;
  emotionLabel: string | null;
  memo: string;
  memoHidden: boolean;
  memoEmpty: boolean;
  relativeDateLabel: string;
  posterUrl: string | null;
  accessibilityLabel: string;
}
export function createPinGalleryCardModel(
  pin: TimelinePin,
  options: { spoilerRevealed: boolean; now?: Date }
): PinGalleryCardModel;

/** 머리글 행은 maxColumns(한 줄 전체), 핀 행은 1 */
export function getPinGalleryRowSpan(row: PinListRow, maxColumns: number): number;
```
판정 순서:
- **`getPinGalleryColumns(width, fontScale = 1)`**
  1. `base = Number.isFinite(width) && width > 0 ? width : 375`
  2. `w = base / Math.max(1, Number.isFinite(fontScale) ? fontScale : 1)`
  3. `w >= 1280 → 6`, `w >= 960 → 5`, `w >= 700 → 4`, 그 외 `2`
- **`getPinViewPresentation`**
  1. `gallery = viewMode === "gallery"`
  2. `showDetailPanel = !gallery && getPinsLayout(width).showDetailPanel`
  3. `pressAction = getPinCardPressAction(showDetailPanel)`
  4. `numColumns = gallery ? getPinGalleryColumns(width, fontScale) : 1`
- **`createPinGalleryCardModel`**: `base = createPinCardModel(pin, options)`. `title`·`timeLabel`·`emotionLabel`·`memo`·`memoHidden`·`memoEmpty`·`relativeDateLabel`·`posterUrl`·`accessibilityLabel`은 `base`의 값 그대로. `sceneLabel`만 새로 계산한다. **접근성 라벨은 목록 카드와 같은 문자열**이다(회차 제목·절대 저장일 포함).
- **`getPinGalleryRowSpan`**: `row.type === "group" ? Math.max(1, maxColumns) : 1`.

## 7. 데이터 모델 / SQL
없음. 조회·서비스·DB를 바꾸지 않는다.

## 8. 화면 명세
UI 규칙 준수(UI-1~UI-13). 아래는 화면 고유 값이다.

### 8.1 `app/(tabs)/pins.tsx`
- `const { width, fontScale } = useWindowDimensions()`.
- `viewMode = usePinsUiStore((s) => s.viewMode)`, `setViewMode = usePinsUiStore((s) => s.setViewMode)`.
- `view = useMemo(() => getPinViewPresentation({ viewMode, width, fontScale }), [...])`.
- 지금 `layout.showDetailPanel`을 쓰는 세 곳(71행 `pressAction`, 77행 `panelTimeline`, 289행 패널 렌더)을 `view.showDetailPanel`로, `pressAction`은 `view.pressAction`으로 바꾼다. `layout`의 나머지 값(`gutter`·`gap`·`stackTools`·`posterWidth`·`cardPadding`·`detailPanelWidth`)은 그대로 쓴다.
- 도구 줄(175~202행): `PinViewToggle value={viewMode} onChange={setViewMode}`를 정렬과 필터 사이에(D-7).
- **좌표(갤러리)**: 페이지 시작선 x=0. `FlashList` `marginHorizontal: -spacing.sm`(아래 `style`) → 목록 가장자리 x=−8. 셀 `padding: spacing.sm` → 카드 x=0. 머리글 `View`에 `view.gallery && styles.galleryInset`(`paddingHorizontal: spacing.sm`) → x=0. `ListEmptyComponent` 바깥 `View`에도 `galleryInset` → 내용 x=0. 로딩 스켈레톤은 `sharedInset`(−16) + 스켈레톤 격자 `padding` 8 + 셀 8 → 카드 x=0. 작품 머리글은 `<View style={styles.galleryInset}>`로 감싼다 → x=0.
- `FlashList` 속성(D-8):
  - `key={viewMode}`, `numColumns={view.numColumns}`
  - `overrideItemLayout={(layout, row, _index, maxColumns) => { layout.span = getPinGalleryRowSpan(row, maxColumns); }}` — 항상 전달한다(`exactOptionalPropertyTypes` 때문에 `undefined`를 넘길 수 없다. 목록은 1열이라 span이 늘 1. 2026-10-15 구현 중 정정)
  - `style`은 배열을 받지 않으므로 `view.gallery ? styles.galleryFlashList : styles.pinFlashList`(`galleryFlashList: { flex: 1, marginHorizontal: -spacing.sm }`)
  - `ItemSeparatorComponent={view.gallery ? undefined : () => <View style={styles.pinSeparator} />}`
  - `extraData`에 `viewMode`·`numColumns` 추가
  - 로딩: 갤러리면 `LoadingSkeleton variant="recommendation-card" count={view.numColumns * 2} columns={view.numColumns} accessibilityLabel={PIN_VIEW_COPY.loading}`, 목록이면 지금 그대로(`pin-item`, 5개). 둘 다 `styles.sharedInset` 안.
  - `renderItem`:
    - 갤러리·머리글 → `<View style={styles.galleryInset}><PinGroupHeader row={row} onPress={openContent} /></View>`
    - 갤러리·핀 → `<PinGalleryCard pin={row.pin} spoilerRevealed={revealedSpoilers.has(row.pin.id)} variant={row.grouped ? "scene" : "poster"} onPressPin={onPressPin} />`
    - 목록 → 지금 그대로
- 패널·`selectFromPanel`·라우팅 콜백·공유·캡처 레이어는 그대로(패널은 `view.showDetailPanel`일 때만).

### 8.2 `src/components/pins/PinGalleryCard.tsx` (신규, `memo`)
```ts
export const PinGalleryCard: React.MemoExoticComponent<(props: {
  pin: TimelinePin;
  spoilerRevealed: boolean;
  variant: "poster" | "scene";
  onPressPin: (id: string) => void;
}) => JSX.Element>;
```
- 모델 `createPinGalleryCardModel(pin, { spoilerRevealed })`(`useMemo`), `fontScale`은 `useWindowDimensions()`.
- 셀 `View`(D-4 값) → 카드 `Pressable`(D-4 값, 눌림 `opacity: 0.72`, `accessibilityRole="button"`, `accessibilityLabel={model.accessibilityLabel}`, `accessibilityHint={PINS_SCREEN_COPY.openHint}`) → 위에서 아래로:
- **`"poster"`**
  - 포스터 `View`(상대 위치) 안에 `AppImage`(`contentFit="cover"`, `aspectRatio: 2 / 3`, `width: "100%"`, 위쪽 `radius.lg`, `surfaceMuted`) + 칩 줄(절대 위치 `left`·`right`·`bottom` = `spacing.sm`, 가로·줄바꿈·`gap: spacing.xs`, 접근성 숨김): 시간 칩, 감정 배지(있으면). 칩 스타일은 `PinListCard`의 `time`·`emotion`과 같은 값.
  - 본문(`padding: spacing.sm`, `gap: spacing.xs`): D-5의 네 줄. `minHeight`: 작품명 `typography.label.lineHeight * fontScale`, 장면 `typography.micro.lineHeight * fontScale`, 메모 `typography.caption.lineHeight * PIN_GALLERY_MEMO_LINES * fontScale`, 날짜 `typography.micro.lineHeight * fontScale`.
  - 메모: `memoHidden`이면 `eye-off-outline` 16 `textMuted` + `typography.caption` `textMuted`(2줄), `memoEmpty`면 `typography.caption` `textSubtle`, 그 외 `typography.caption` `text` `numberOfLines={PIN_GALLERY_MEMO_LINES}`.
- **`"scene"`**: 포스터 없음. 본문 `padding: spacing.md`, `gap: spacing.xs`: 장면 라벨 `typography.label` `text` 1줄(`minHeight` label) → 칩 줄(접근성 숨김) → 메모(`PIN_SCENE_MEMO_LINES`줄, 규칙은 위와 같음) → 날짜.
- 선택 테두리·`›` 없음(갤러리는 항상 열기).

### 8.3 `src/components/pins/PinViewToggle.tsx` (신규)
```ts
export function PinViewToggle(props: {
  value: PinViewMode;
  onChange: (value: PinViewMode) => void;
}): JSX.Element;
```
D-7 그대로. `PIN_VIEW_OPTIONS`를 순서대로 그린다. 각 버튼 `width: 44`, `height: 44`, `alignItems`·`justifyContent: "center"`, `radius.pill`, 눌림 `opacity: 0.72`. 바깥 `flexDirection: "row"`, `radius.pill`, hairline `border`, `surface`.

### 8.4 `src/components/pins/PinDetailPanel.tsx` (G-3만)
92~110행 타임라인 프래그먼트에서 구분선 다음의 `timelineHeader` `View`와 `timelineRows` `View`를 `<View style={styles.timelineSection}>`으로 감싼다. `timelineSection: { gap: spacing.xs }`. 그 외 변경 없음.

### 8.5 목표 모습
웹 1440, 갤러리(기본), 최신순:
```
핀
감동적인 장면과 기억하고 싶은 대사를 모아보세요.
[🔍 작품명, 메모, 태그 검색                 ] (최신순|작품별) (▦|☰) [⚙ 필터]
(전체 6) (감동 5) (슬픔 1)
핀 6개
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│포스│ │포스│ │포스│ │포스│ │포스│ │포스│
│ 터 │ │ 터 │ │ 터 │ │ 터 │ │ 터 │ │ 터 │
│40:28 감동│ …
└────┘ └────┘ …
로또 1등도…  수사반장 1958  로또 1등도…  원피스 …
10화         6화            3화           시즌 3 · 86화
로또 1등에…  집요한 놈을…   팀장님은 뭘…  …
6일 전       10월 5일       10월 2일      5월 3일
```
웹 375, 갤러리: 2열, 도구 둘째 줄 `(최신순|작품별) (▦|☰) [⚙ 필터]`.
작품별 + 갤러리:
```
[40×60] 로또 1등도 출근합니다                    ›
        핀 2개
┌ 3화 ─────────┐ ┌ 10화 ────────┐
│ [36:30] 감동 │ │ [40:28] 감동 │
│ 팀장님은 뭘… │ │ 로또 1등에…  │
│ (4줄)        │ │              │
│ 10월 2일     │ │ 6일 전       │
└──────────────┘ └──────────────┘
[40×60] 수사반장 1958                             ›
```

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 연결 |
|---|------|----------|------|
| E-1 | 처음 방문(저장값 없음) | 갤러리 | K-3, M-1 |
| E-2 | 목록으로 바꾼 뒤 새로고침·앱 재시작 | 목록 유지 | M-1·M-5 |
| E-3 | 저장값이 옛 버전·깨짐 | `migrate`로 갤러리 | M-1 |
| E-4 | 갤러리, 폭 1440 | 6열, 패널 없음, 카드 누름 → 핀 상세 | GL-7, VP-1, M-1 |
| E-5 | 목록, 폭 1440 | 지금과 같음(패널·타임라인·선택) | VP-2, M-1 |
| E-6 | 목록, 폭 768 | 패널 없음, 카드 → 상세 | VP-3, M-2 |
| E-7 | 갤러리, 폭 375 | 2열, 도구 둘째 줄 넘침 없음 | GL-1, VP-4, M-3 |
| E-8 | 갤러리, 글자 1.3배 | 열 감소(1280 → 5열), 줄 겹침 없음 | GL-10, VP-5, M-5 |
| E-9 | 갤러리 + 작품별 | 머리글 한 줄 전체, 장면 카드(포스터 없음), 다음 머리글은 새 줄 | SP-1, M-1 |
| E-10 | 가려진 스포일러 | 카드 메모 가림 문구, 접근성 "스포일러 메모 숨김" | GC-2, M-1 |
| E-11 | 영화 핀(회차 없음) | 장면 줄은 비어도 높이 유지 → 같은 행 카드 높이 같음 | GC-3, M-1 |
| E-12 | 포스터 없음·깨짐 | 대체 배경 + 칩 보임 | GC-4, M-1 |
| E-13 | 제목 없음·감정 없음·메모 없음 | "제목 없음", 감정 배지 없음, "메모 없음" | GC-4 |
| E-14 | 갤러리 로딩 | 포스터 격자 스켈레톤, 카드 가장자리가 머리글 시작선과 같음 | M-1·M-3 |
| E-15 | 오류·빈 상태 | 두 보기 같음, 시작선 같음 | M-1 |
| E-16 | 검색·감정·필터 | 두 보기 같은 결과 | M-1 |
| E-17 | 보기 전환 | 목록을 새로 만들어 맨 위에서 시작 | M-1 |
| E-18 | 웹 키보드 Tab | 검색 → 정렬 → 보기 전환 2개 → 필터 → 칩 → 카드 순 | M-1 |
| E-19 | 목록 보기 패널 타임라인 | 머리 줄과 첫 행 사이 간격이 행 사이와 비슷 | M-1 |
| E-20 | 저장소 복원 전 첫 렌더(웹) | 잠깐 갤러리 후 저장값으로 바뀔 수 있음(라이브러리와 같음) | 13장 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다. 한 행 = `it` 하나.** `node:test` + `node:assert/strict`, `src/utils/pinListUi.test.ts`에 추가한다(픽스처 `pin()`·`NOW`는 그 파일의 것). **기존 테스트는 수정하지 않는다.**

| ID | 입력 | 기대 |
|----|------|------|
| GL-1 | `getPinGalleryColumns(375)` | `2` |
| GL-2 | `(699)` | `2` |
| GL-3 | `(700)` | `4` |
| GL-4 | `(959)` | `4` |
| GL-5 | `(960)` | `5` |
| GL-6 | `(1279)` | `5` |
| GL-7 | `(1280)` | `6` |
| GL-8 | `(2000)` | `6` |
| GL-9 | `(NaN)`, `(0)`, `(-10)` | 각각 `2` |
| GL-10 | `(1280, 1.3)` / `(960, 1.3)` / `(700, 1.3)` | `5` / `4` / `2` |
| GL-11 | `(1440, 0.85)` / `(1440, NaN)` | `6` / `6` |
| VP-1 | `getPinViewPresentation({ viewMode: "gallery", width: 1440 })` | `{ gallery: true, showDetailPanel: false, pressAction: "open", numColumns: 6 }` |
| VP-2 | `{ viewMode: "list", width: 1440 }` | `{ gallery: false, showDetailPanel: true, pressAction: "select", numColumns: 1 }` |
| VP-3 | `{ viewMode: "list", width: 768 }` | `{ gallery: false, showDetailPanel: false, pressAction: "open", numColumns: 1 }` |
| VP-4 | `{ viewMode: "gallery", width: 375, fontScale: 1 }` | `{ gallery: true, showDetailPanel: false, pressAction: "open", numColumns: 2 }` |
| VP-5 | `{ viewMode: "gallery", width: 1280, fontScale: 1.3 }` | `numColumns 5` |
| GC-1 | `pin({ content_title: "원피스", season_number: 3, episode_number: 86, episode_title: "히루루크의 벚꽃과 이어지는 의지!", timestamp_seconds: 959, emotion: "sad", memo: "  벚꽃  ", content_poster_url: "https://p/op.jpg", created_at: new Date(2026, 4, 3, 12).toISOString() })`, `{ spoilerRevealed: false, now: NOW }` | `deepEqual` `{ title: "원피스", sceneLabel: "시즌 3 · 86화", timeLabel: "15:59", emotionLabel: "슬픔", memo: "벚꽃", memoHidden: false, memoEmpty: false, relativeDateLabel: "5월 3일", posterUrl: "https://p/op.jpg", accessibilityLabel: "원피스, 시즌 3 · 86화 · 히루루크의 벚꽃과 이어지는 의지!, 15:59, 슬픔, 벚꽃, 저장일 2026. 05. 03" }` |
| GC-2 | GC-1 핀 + `is_spoiler: true`, `memo: "  루피의 결심  "`, 미공개 | `memo "스포일러가 포함된 메모예요"`, `memoHidden true`, `accessibilityLabel`에 `"스포일러 메모 숨김"` 포함·`"루피의 결심"` 미포함(회차 제목에 "벚꽃"이 있어 메모와 구분되는 문구를 쓴다 — 2026-10-15 정정) |
| GC-3 | `pin({ timestamp_seconds: 600 })`(회차 없음) | `sceneLabel ""`, `timeLabel "10:00"` |
| GC-4 | `pin({ content_title: "  ", emotion: "none", memo: null })` | `title "제목 없음"`, `emotionLabel null`, `memo "메모 없음"`, `memoEmpty true`, `posterUrl null` |
| SP-1 | `rows = buildPinListRows([pin({ id: "a" })], "timeline")`. `getPinGalleryRowSpan(rows[0], 5)` / `(rows[1], 5)` / `(rows[0], 0)` | `5` / `1` / `1` |
| K-3 | 상수 | `PIN_GALLERY_MEMO_LINES === 2`, `PIN_SCENE_MEMO_LINES === 4`, `PIN_VIEW_COPY`·`PIN_VIEW_OPTIONS`가 6.3 값과 `deepEqual` |

추가 테스트 22개. 기대: 1200 + 22 = **1222개 중 1221개 통과**(무관 기존 실패 1개 유지).
`pinsUiStore.ts`는 zustand·AsyncStorage를 불러오므로 테스트하지 않는다(라이브러리 저장소와 같음). 기본값·`migrate`는 K-3과 M-1로 확인한다.

### 수동 확인 (UI-14.3)

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440(및 1000) | 처음 갤러리 6열(1000은 5열), 카드 가장자리·머리글·검색창 시작선 같음, 같은 행 카드 높이 같음, 칩이 포스터 위에서 읽힘, 카드 누름 → 핀 상세. 목록으로 바꾸면 지금 화면(패널·타임라인) 그대로, 새로고침해도 목록 유지. 작품별 + 갤러리: 머리글 한 줄 전체·장면 카드·다음 머리글 새 줄. 로딩 스켈레톤 정렬. 목록 패널 타임라인 간격(G-3). 키보드 Tab 순서(E-18) |
| M-2 | 웹 768 | 갤러리 4열, 목록은 패널 없음 |
| M-3 | 웹 375 | 갤러리 2열, 도구 둘째 줄(정렬·보기 전환·필터) 넘침 없음, 가로 스크롤 없음 |
| M-4 | 웹 844×390(가로 휴대폰) | 갤러리 4열, 머리글과 함께 스크롤 |
| M-5 | 앱(iOS 세로) | 갤러리 2열, 앱 재시작 후 보기 유지, 글자 1.3배에서 줄 겹침·잘림 없음, 하단 탭과 겹침 없음 |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/types/pins.ts` | `PinViewMode` 한 줄(6.1) |
| `src/stores/pinsUiStore.ts` | 신규(6.2) |
| `src/utils/pinListUi.ts` | 6.3 추가만 |
| `src/utils/pinListUi.test.ts` | GL-1~GL-11·VP-1~VP-5·GC-1~GC-4·SP-1·K-3 추가 |
| `src/components/pins/PinGalleryCard.tsx` | 신규(8.2) |
| `src/components/pins/PinViewToggle.tsx` | 신규(8.3) |
| `src/components/pins/PinDetailPanel.tsx` | 8.4(타임라인 감싸기만) |
| `app/(tabs)/pins.tsx` | 8.1 |

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| 핀 상세 화면(`app/pins/[id].tsx`) | 갤러리 카드가 모든 폭에서 이 화면으로 온다. 토큰 위반·작품 보기·핀 추가·작품 타임라인은 별도 명세(제안된 후속 작업) |
| 라이브러리 갤러리(`ContentGalleryCard`·`libraryResponsive.ts`) | 값만 맞추고 건드리지 않는다 |
| `PinListCard`·`PinGroupHeader`·`PinFilterPanel` | 목록 보기는 그대로 |
| 갤러리 무한 스크롤·페이지 나누기 | 핀 목록은 한 번에 받는다(`getAllPins`). 지금과 같음 |
| 회차 스틸 이미지 | 데이터에 없다(포스터만 있다) |
| `docs/60` 수동 확인 항목 | 그 명세의 M-1~M-5로 확인 |
| 미커밋 다른 작업 | 무관. 건드리지 않는다 |

## 13. 확실하지 않음 — 별도 검증 필요
1. **FlashList 2.0.2 `overrideItemLayout` `span`**이 앞 줄이 덜 찬 상태에서 한 줄 전체 머리글을 다음 줄로 내리는지(웹·iOS). 안 되면 구현을 바꾸지 말고 관찰 결과를 보고한다(M-1·M-5).
2. 폭이 바뀌어 `numColumns`만 바뀔 때 다시 만들지 않아도 배치가 맞는지. 라이브러리가 같은 방식(`key={viewMode}`, `numColumns` 가변)이라 맞을 것으로 보지만 핀 탭에서 확인한다(M-1 창 크기 조절).
3. 웹에서 저장소 복원 전 첫 렌더가 기본값(갤러리)이라 목록을 고른 사용자에게 잠깐 갤러리가 보일 수 있다(라이브러리와 같은 동작, E-20). 눈에 띄면 보고만 한다.
4. 실제 계정 포스터 위 칩 대비(밝은 포스터)는 로그인이 필요해 사람이 M-1로 확인한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다.
핀 탭에 **갤러리 보기(기본)**를 더하고 지금 화면은 **목록 보기**로 남긴다. 갤러리는 라이브러리 갤러리와 같은 카드 틀·열 기준의 포스터 격자이고, 모든 폭에서 옆 패널 없이 카드를 누르면 핀 상세로 간다. 보기 선택은 기기에 기억한다. 목록 보기 패널의 타임라인 간격도 정리한다. 기능 추가 작업이다.

| ID | 증상 | 원인 |
|----|------|------|
| G-1 | 첫 화면이 1열 가로 카드, 넓은 화면에서 오른쪽이 빔 | `pins.tsx:245~287` 1열 고정 |
| G-2 | 라이브러리는 갤러리 기본, 핀 탭은 전환 없음 | 핀 탭에 보기 상태·갤러리 카드 없음 |
| G-3 | 패널 타임라인 머리 줄 아래 간격이 큼 | `PinDetailPanel.tsx:92~102` 프래그먼트 + 패널 `gap: spacing.lg` |

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙(UI-1~UI-13). 이 지시에 다시 쓰지 않는다.
2. `docs/61_pins_gallery_view_spec.md` — 이 작업의 명세서. 설계 결정 D-1~D-11, 계약 6장, 화면 8장(8.1 좌표 포함), 엣지 케이스 9장, 테스트 표 10장.
3. `docs/60_pins_tab_context_and_grouping_fixes_spec.md` — 현재 핀 탭 계약(행 배열·패널·상대 날짜). 바꾸지 않는다.
4. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
5. 따라 할 라이브러리 구현: `src/stores/libraryUiStore.ts`, `src/utils/libraryResponsive.ts`, `src/components/content/ContentGalleryCard.tsx`, `app/(tabs)/library.tsx:700~760`
6. 고칠 파일: `app/(tabs)/pins.tsx`, `src/utils/pinListUi.ts`, `src/utils/pinListUi.test.ts`, `src/components/pins/PinDetailPanel.tsx`, `src/components/pins/PinListCard.tsx`(스타일 값 참고만)

# 시작 상태 (반드시 유지)
- `npm test` 1200개 중 1199개 통과. 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함이다. 고치지 않는다.
- 목록 보기의 모든 동작(`docs/44`·`docs/60`): 1열 카드, 960 이상 패널 선택·타임라인·작품 보기·핀 추가·모두 보기, 좁은 화면 카드 → 상세, 작품별 머리글, 상대 날짜, 스포일러 atom, 빈·오류·로딩 상태.
- 작업 트리에 `docs/60` 구현과 무관한 미커밋 변경이 함께 있다. 건드리지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-10 (최우선).** 기존 테스트를 한 줄도 바꾸지 않는다. `getPinsLayout`·`PinsLayout`·`PINS_SCREEN_COPY`·`PIN_CONTEXT_COPY`·`PinCardModel`·`createPinCardModel`·`buildPinListRows`·`createPinPanelTimeline`을 수정하지 않는다. 새 코드는 추가만 한다.
- **D-1.** 목록 보기는 지금 화면 그대로다. 갤러리를 만들다 목록 동작을 바꾸지 않는다. 기본값은 `"gallery"`, 저장은 `libraryUiStore.ts`와 같은 구조.
- **D-2.** 갤러리에서는 모든 폭에서 패널이 없고 `pressAction`은 `"open"`이다.
- **D-3.** 열 기준은 라이브러리와 같다(1280 → 6, 960 → 5, 700 → 4, 그 외 2), 폭 ÷ `max(1, fontScale)`.
- **D-4.** 카드 틀 값은 `ContentGalleryCard`와 같다(그림자 없음). 시작선 좌표는 8.1 그대로.
- **D-5·D-6.** 줄 수 고정 + `minHeight`(측정 없음). 작품별 갤러리 카드는 포스터 없는 장면 카드, 머리글은 `span = maxColumns`.
- `src/stores/libraryUiStore.ts`, `src/components/content/ContentGalleryCard.tsx`, `src/utils/libraryResponsive.ts`, `src/components/pins/PinListCard.tsx`, `src/components/pins/PinGroupHeader.tsx`는 **바꾸지 않는다.**

# STEP 1 — 순수 함수 (테스트 먼저)
1. `src/types/pins.ts`에 `PinViewMode`(6.1).
2. `pinListUi.test.ts`에 10장 GL-1~GL-11·VP-1~VP-5·GC-1~GC-4·SP-1·K-3을 추가하고 `npm test`로 실패를 눈으로 확인한다. 실패하지 않으면 멈추고 보고한다.
3. `pinListUi.ts`에 6.3을 추가해 통과시킨다.

# STEP 2 — 저장소·전환 컨트롤
1. `src/stores/pinsUiStore.ts`(6.2, `libraryUiStore.ts` 구조 복사).
2. `src/components/pins/PinViewToggle.tsx`(8.3).

# STEP 3 — 갤러리 카드
`src/components/pins/PinGalleryCard.tsx`(8.2, `"poster"`·`"scene"`).

# STEP 4 — 화면 연결
`app/(tabs)/pins.tsx` 8.1: 보기 상태, `getPinViewPresentation`, `layout.showDetailPanel` 세 곳 교체, 도구 줄에 `PinViewToggle`, `FlashList` `key`·`numColumns`·`overrideItemLayout`·구분선·`extraData`·로딩·`renderItem`, 시작선 스타일(`galleryList`·`galleryInset`).

# STEP 5 — 패널 간격(G-3)
`PinDetailPanel.tsx` 8.4만.

# STEP 6 — 검증
아래 검증 명령, UI-13.2 검사, 웹 수동 확인(로그인이 필요하면 하지 말고 미확인으로 보고).

# 엣지 케이스 (전부 처리, 명세서 9장 E-1~E-20)
명세서 9장 표 전부. 특히 E-9(머리글 한 줄 전체), E-11(빈 장면 줄 높이 유지), E-14(스켈레톤 시작선), E-17(보기 전환 시 목록 다시 만들기).

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test` 기준선: 1200개 중 1199개 통과(무관 실패 1개). 완료 후 기대: **1222개 중 1221개 통과**, 새 실패 0개.
UI-13.2 검사:
```
grep -nE "#[0-9A-Fa-f]{3,6}\b|rgba?\(|fontWeight: \"|fontSize: [0-9]" src/components/pins/PinGalleryCard.tsx src/components/pins/PinViewToggle.tsx src/components/pins/PinDetailPanel.tsx "app/(tabs)/pins.tsx"
grep -n "Alert.alert" src/components/pins/PinGalleryCard.tsx src/components/pins/PinViewToggle.tsx src/components/pins/PinDetailPanel.tsx "app/(tabs)/pins.tsx"
```
첫 줄 0줄. 둘째 줄은 `app/(tabs)/pins.tsx`의 기존 `sharePin` 2곳(알려진 예외, `docs/44` D-12)만.

# DEFINITION OF DONE
- [ ] GL-1~GL-11, VP-1~VP-5, GC-1~GC-4, SP-1, K-3을 추가했고 수정 전에 실패하는 것을 확인했다
- [ ] 기존 테스트를 수정하지 않았고 개수가 줄지 않았다
- [ ] `npm test` 1222개 중 1221개 통과(무관 기존 실패 1개만), `npm run typecheck`, `npm run lint` 통과
- [ ] 처음 방문 시 갤러리, 목록으로 바꾸면 지금 화면과 동일, 선택이 기기에 저장된다
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(알려진 예외 2줄 제외)
- [ ] 웹·앱 수동 확인 표(M-1~M-5)를 보고했다(미확인은 사유와 함께)

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/types/pins.ts
src/stores/pinsUiStore.ts
src/utils/pinListUi.ts
src/utils/pinListUi.test.ts
src/components/pins/PinGalleryCard.tsx
src/components/pins/PinViewToggle.tsx
src/components/pins/PinDetailPanel.tsx
app/(tabs)/pins.tsx
```

# 보고 항목
1. STEP 1에서 처음 실패했던 테스트의 실제 출력(요약)
2. `npm test` 결과 (before 1199/1200 / after 통과·전체 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. UI-13.2 검사 결과
6. 웹·앱 수동 확인 표 M-1~M-5(확인/미확인과 사유). 명세서 13장 1~3 관찰 결과
7. D-N 중 문제가 있다고 판단한 항목(바꾸지는 말고 보고만)
8. 사람이 해야 할 후속 작업. 배포·마이그레이션은 필요 없다

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 이 작업은 배포가 필요 없다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.** 기존 테스트는 수정하지 않는다.
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트, zustand 저장소를 import하지 않는다. 타입만 `import type`으로 가져온다.
- 로그인이 필요한 화면을 확인하려고 실제 계정으로 로그인하지 않는다. 미확인으로 보고한다.
