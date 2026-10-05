# 44. 핀 탭 SaaS 개편 (가독성·다른 화면과 통일)

작성일: 2026-10-03
대상 브랜치 기준: `main` (`6734575`) + 미커밋 작업(`docs/41`~`43` 구현, 보러가기 링크, 목록 스크롤 복원 등. 핀 관련 파일은 모두 깨끗함). 이 시점 `npm test` 889개 중 888개 통과 — 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙 — 이 명세는 다른 점과 화면 고유 값만 쓴다)**, `docs/31_usability_review_fixes_spec.md`(U-1·U-3·U-7 — 이 명세가 핀 탭 범위를 흡수), `docs/19_mobile_usability_spec.md`(768 핀 패널 — D-5에서 대체), `docs/36`·`docs/37`·`docs/39`(SaaS 카드 패턴)

> **근거.** 사용자 캡처(웹, 약 1000px 폭, 핀 4개). 제목·검색 → 정렬 → 장르·감정·태그 칩 3줄 → 감정 요약 카드 → 첫 핀 카드가 화면 높이의 약 62% 지점에서 시작한다. 포스터 자리는 회색 상자에 글자 "로", 옆 패널은 220pt 높이의 같은 회색 상자.
> 사용자 요청: "핀 화면도 가독성 좋게 다른 화면과 통일성 있게 UI 개선."

---

## 1. 문제 정의

| ID | 증상 | 원인 (`app/(tabs)/pins.tsx`) |
|----|------|------------------------------|
| P-1 | 첫 핀이 화면 아래쪽에서 시작한다. 좁은 화면에서는 첫 화면에 핀이 없다 (`docs/31` U-7) | 152~228행 목록 머리글에 검색·정렬·`FilterRow` 3줄(195~215)·`SummaryCards`(217~226)가 폭과 무관하게 항상 쌓인다 |
| P-2 | 감정을 바꾸는 컨트롤이 두 벌이다. "전체 핀" 카드는 감정뿐 아니라 태그·장르까지 지운다 | 감정 `FilterRow`(202~208)와 `SummaryCards`가 같은 `selectedEmotion`을 바꾼다. `onSelectAll`(221~225)만 세 필터를 모두 초기화 |
| P-3 | 장르 줄이 오른쪽에서 잘린다("액션"이 반쯤). 내 핀에 없는 장르도 고를 수 있어 빈 결과가 나온다 | 356행 가로 `ScrollView`(웹 마우스로 넘기기 어려움, UI-2.8). 59행 `createGenreFilterOptions(...)`가 기본 장르 목록(`DEFAULT_GENRE_FILTERS`)을 항상 더한다 |
| P-4 | "필터" 아이콘을 눌러도 아무 일이 없다 (`docs/31` U-7) | 177행 `ToolbarIconButton`에 `onPress` 없음 |
| P-5 | 포스터 자리에 글자 하나와 제목이 반복된다. 제목이 카드 안 2번, 패널 2번 | `PinPoster`(667~680)가 이니셜만 그린다. 데이터에는 `content_poster_url`이 있다(`src/services/pins.ts:169`) |
| P-6 | 768 미만에서 카드를 눌러도 열리지 않는다. `⋮`만 상세로 가고, 타임라인 보기에서는 열 방법이 없다 (`docs/31` U-1) | 카드·`PinTimelineItem`(493) 누름이 `setSelectedPinId`만 한다 |
| P-7 | 보기 전환 아이콘(목록 ↔ 가지 모양)의 뜻을 알 수 없다. "시간순" 정렬과 "타임라인 보기" 이름이 겹친다. "시간순"은 회차를 무시한다 (`docs/31` U-3) | 178~183행 아이콘 하나로 토글. 86~93행 정렬이 제목 → 초만 비교 |
| P-8 | 다른 화면(홈·인물·프로필·작품 상세)과 모양이 다르다 | 16진 색 49곳, `fontWeight` 26곳, `fontSize` 숫자 30곳, `shadow*` 12곳, 모서리 11·14·18·20·24. 정렬은 파란 채움 버튼(다른 화면은 `SegmentedControl`), 검색창 모서리 14(다른 화면은 알약형) — UI-1·UI-8 위반 |
| P-9 | 웹에서 카드 안에 버튼이 들어 있다 | 카드 `Pressable` 안에 스포일러 "보기"(566)와 `⋮`(588) `Pressable` — UI-4.3 |
| P-10 | 768~959 폭에서 목록 열이 336px로 좁아진다 | 40행 `shouldShowPinDetailPanel`(768 기준)이 패널 360 + 간격을 뺀 좁은 열을 남긴다. UI-2.2의 2열 기준은 960 |
| P-11 | 일부 실패 시 큰 오류 상자가 목록 위에 뜬다 | 154행 `ErrorState`. UI-6.4는 데이터가 있으면 caption 한 줄 |

## 2. 목표 모습

넓은 화면(≥ 960):
```
핀                                                        ┌ 핀 미리보기 패널 (360) ─────┐
감동적인 장면과 기억하고 싶은 대사를 모아보세요.              │ [포스터]  로또 1등도 출근합니다│
[🔍 작품명, 메모, 태그 검색           ] (최신순|작품별) [⚙ 필터] │  72×108   3화 · 내가 믿는 것  │
(전체 4) (감동 3) (슬픔 1)                                  │ 36:30  [감동]                 │
핀 4개                                                     │ ──────────                   │
┌──────────────────────────────────────────────┐          │ 메모                          │
│[포스터] 로또 1등도 출근합니다                   │          │ 팀장님은 뭘 믿으세요? …        │
│ 64×96  3화 · 내가 믿는 것 · 2026. 10. 02       │          │ 태그  #愛と正義               │
│        [36:30] [감동]                         │          │ 저장일 2026. 10. 02           │
│        팀장님은 뭘 믿으세요? 제 과거요 …(3줄)   │          │ (↗ 핀 상세 열기)              │
│        #愛と正義                               │          └──────────────────────────────┘
└──────────────────────────────────────────────┘
```
좁은 화면(< 600):
```
핀
감동적인 장면과 기억하고 싶은 대사를 모아보세요.
[🔍 작품명, 메모, 태그 검색                  ]
(   최신순   |   작품별   )        [⚙ 필터]
(전체 4) (감동 3) (슬픔 1)
핀 4개
┌[포스터 56×84] 제목 / 회차·저장일 / 시간·감정 / 메모 3줄 / 태그   › ┐   ← 누르면 핀 상세
```
"필터"를 누르면 도구 줄 아래에 "필터" 카드(장르·태그 칩, 줄바꿈)가 펼쳐진다.

## 3. 설계 결정

### D-1. 범위는 핀 탭 화면뿐이다
데이터(쿼리·서비스·DB), 핀 상세·작성·작품 핀 목록·홈은 바꾸지 않는다. 타입은 `TimelinePin`에 선택 필드 `season_number?: number | null | undefined` 한 줄만 더한다(`docs/31` 6.1. 정렬·라벨 함수 타입에 필요).

### D-2. 머리글 순서를 고정하고 상시 줄을 없앤다
제목·부제 → 도구 줄(검색·정렬·필터 버튼) → (펼쳤을 때) 필터 카드 → 감정 칩 줄 → 결과 줄 → 카드 목록. 감정 요약 카드, 장르·태그 상시 줄, 보기 전환 버튼은 없앤다.

### D-3. 감정 요약 카드와 감정 필터를 "감정 칩 + 개수" 한 줄로 합친다
- 첫 칩은 "전체 N". 그 뒤로 개수가 1 이상인 감정을 개수 내림차순(같으면 `EMOTION_OPTIONS` 순서)으로 놓는다. "없음"(`none`)은 칩으로 만들지 않는다(현재 요약 카드와 같음).
- 개수는 **감정을 뺀 나머지 조건(검색어·장르·태그)을 적용한 핀** 기준이다. 그래야 칩을 눌렀을 때 나오는 개수와 같다.
- 선택한 감정의 개수가 0이 되어도 그 칩은 맨 뒤에 남는다(해제할 수 있게).
- 선택한 칩을 다시 누르면 "전체"로 돌아간다.
- 칩은 줄바꿈한다(가로 스크롤 아님, UI-2.8).

### D-4. 장르·태그는 "필터" 버튼으로 펼치는 카드에 둔다 — `docs/31` U-7 필터 설계 대체
- "필터" 버튼은 **모든 폭에서 처음엔 접힘**. 누르면 `DashboardPanel`("필터")이 펼쳐진다. 장르·태그 칩은 줄바꿈하고 각 그룹 첫 칩은 "전체"다.
- 장르 칩은 **내 핀(현재 태그 조건의 핀)에 있는 장르만** 쓴다(기본 장르 목록을 넣지 않는다). 선택한 장르가 목록에 없으면 함께 넣는다.
- 버튼 글자는 장르·태그 적용 개수를 보여 준다("필터" / "필터 2"). 감정은 칩 줄에 늘 보이므로 세지 않는다.
- 카드 오른쪽 위 "초기화"는 장르·태그만 지운다.
- **대체 범위:** `docs/31` 6.6의 `countActivePinFilters`·`resolvePinFiltersVisible`(넓은 화면 기본 펼침)과 8.1의 필터 항목(T-41~T-44)은 구현하지 않는다. 근거: 캡처가 넓은 화면의 과밀 그 자체다. 감정은 D-3로 늘 보인다.

### D-5. 옆 미리보기 패널은 폭 960 이상에서만 — `docs/19` 768 기준 대체(핀 탭 한정)
UI-2.2의 2열 기준(960)을 따른다. 768~959에서는 한 열이고 카드를 누르면 핀 상세로 간다. 기존 `src/utils/pinResponsive.ts`(768)와 그 테스트 두 곳(`pinResponsive.test.ts`, `mobileInput.test.ts`)은 **그대로 둔다**. 핀 탭이 더 이상 쓰지 않을 뿐이다.

### D-6. 카드 누름: 패널이 있으면 선택, 없으면 열기. 카드 안에 다른 누름 요소를 두지 않는다
- `docs/31` 6.6 `getPinCardPressAction(showDetailPanel)` 그대로(`true` → `"select"`, `false` → `"open"`). `"open"`이면 `router.push({ pathname: "/pins/[id]", params: { id } })`.
- 카드는 `Pressable` 하나다(UI-4.3). 가려진 스포일러 메모는 카드에서 **가림 문구만** 보인다. "보기"는 옆 패널이나 핀 상세에서 한다. 패널에서 보기를 누르면 같은 `revealedSpoilerPinIdsAtom`이라 카드도 메모를 보여 준다.
- `⋮`는 없앤다. 열기 모드에서는 오른쪽에 `chevron-forward` 장식 아이콘을 둔다.

### D-7. 정렬은 `SegmentedControl` "최신순 / 작품별". 정렬·회차 라벨은 `docs/31` 계약을 그대로 쓴다
- 라벨 "시간순" → "작품별"(`docs/31` 8.1).
- 정렬은 `docs/31` 6.2 `src/utils/pinSort.ts`(`compareScenePins`·`sortPinsByScene`·`sortPins`)를 계약 그대로 만든다(작품 → 시즌 → 회차 → 초 → 작성 시각 → id).
- 회차 라벨은 `docs/31` 6.3 `src/utils/pinLabels.ts` `formatPinEpisodeLabel`을 계약 그대로 만든다.
- 시즌 번호를 가져오는 서비스 변경(`docs/31` 7장 `PIN_SELECT`)은 **이번 범위 밖**이다. 지금은 `season_number`가 비어 시즌 표기 없이 회차만 나온다. 서비스가 바뀌면 화면 수정 없이 반영된다.

### D-8. 보기 전환(타임라인 보기)을 없앤다
새 카드가 이미 간결하고(포스터 56~64, 메모 3줄), 두 항목 모양을 유지할 이유가 없다. "시간순 정렬"과 "타임라인 보기" 이름 혼동도 사라진다.

### D-9. 포스터는 `AppImage` + `content_poster_url`
- 2:3. 카드는 폭 < 600이면 56, 그 외 64. 패널은 72.
- URL이 없거나 깨지면 `AppImage`의 대체 배경을 쓴다. 글자 자리표시는 없앤다.
- 카드 전체에 접근성 라벨이 있으므로 포스터는 장식이다.

### D-10. 카드 내용 순서와 모양은 홈 `RecentPinCard`와 같은 시각 언어다
작품명(1줄) → 회차·저장일(1줄) → 시간 칩·감정 배지 → 메모(3줄) → 태그(최대 3개 + "+N"). 시간 칩은 `primarySoft` 배경, 감정 배지는 `micro` 알약이다.

### D-11. 결과 줄과 초기화 범위
- 결과 줄: 조건이 없으면 "핀 N개", 있으면 "T개 중 N개"(T = 전체 핀 수).
- 조건이 있으면 옆에 "전체 보기"를 둔다. 검색어·감정·장르·태그를 **모두** 지운다.
- 필터 카드의 "초기화"는 장르·태그만 지운다(D-4).

### D-12. 공유 경로는 그대로 둔다
`EXTENDED_FEATURES_ENABLED = false`라 공유 버튼·캡처 레이어가 렌더되지 않는다. `sharePin`과 그 안의 `Alert.alert` 2줄(133·142행, 네이티브 전용)은 바꾸지 않는다. UI-13.2 `Alert` 검사의 **알려진 예외**로 보고만 한다.

### D-13. 판정·문구·레이아웃은 순수 함수에 둔다
`src/utils/pinListUi.ts`(`docs/31` 6.6의 파일 이름)에 둔다. 화면·컴포넌트 파일에는 판정·정렬·집계를 두지 않는다(UI-11.3·UI-12.1).

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 4. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 감정 요약 카드를 남기고 감정 칩 줄을 없앤다 | 카드 줄 높이가 86이고 가로 스크롤이다(UI-2.8). 칩에 개수를 붙이면 같은 정보를 절반 높이로 보여 준다 |
| 필터를 하단 시트로(라이브러리처럼) | 조건이 장르·태그 둘뿐이고 단일 선택이라 바로 적용이 낫다. 시트는 적용·닫기 단계가 늘고, 웹에서는 모달이 된다 |
| 넓은 화면은 필터를 처음부터 펼친다(`docs/31` 6.6) | 캡처의 과밀이 바로 넓은 화면이다 |
| 타임라인 보기를 유지하고 세그먼트로 "카드 / 간단히" | 카드가 이미 간결하다. 두 모양의 유지 비용이 들고 이름도 겹친다 |
| "작품별" 정렬에서 작품 머리글로 묶기 | 좋은 개선이지만 목록 행 종류가 섞이는 구조 변경이다. 후속 |
| 768 기준 패널 유지 | 768에서 목록 열이 336px이고 도구 줄이 넘친다 |
| 카드 안에서 스포일러 바로 보기(현재) | Pressable 중첩(UI-4.3). 패널·상세에서 보기로 충분하다 |
| `shouldShowPinDetailPanel` 기준을 960으로 바꾼다 | 기존 테스트 두 곳의 기대값을 바꿔야 한다. 새 레이아웃 함수로 분리하고 기존 함수는 둔다 |
| 감정 칩에 색·아이콘(현재 요약 카드의 장미·호박색) | 토큰 밖 색이 필요하다(UI-1.1). 개수와 글자로 충분하다 |

## 5. 계약

### 5.1 `src/types/pins.ts` (한 줄 추가)
```ts
export interface TimelinePin {
  // ...기존 필드 유지
  season_number?: number | null | undefined; // docs/31 6.1. 서비스가 채우기 전까지 undefined
}
```

### 5.2 `src/utils/pinSort.ts` — `docs/31` 6.2 그대로
```ts
import type { PinSortMode, TimelinePin } from "@/types/pins";

type ScenePin = Pick<TimelinePin, "id" | "season_number" | "episode_number" | "timestamp_seconds" | "created_at">;
type ListPin = ScenePin & Pick<TimelinePin, "content_id" | "content_title">;

export function compareScenePins(a: ScenePin, b: ScenePin): number;
export function sortPinsByScene<T extends ScenePin>(pins: readonly T[]): T[];
export function sortPins<T extends ListPin>(pins: readonly T[], mode: PinSortMode): T[];
```
`compareScenePins` 판정 순서(앞에서 0이 아니면 즉시 반환):
1. `season_number` — `null`·`undefined`가 앞, 그다음 오름차순
2. `episode_number` — `null`·`undefined`가 앞, 그다음 오름차순
3. `timestamp_seconds` — **`null`이 뒤**, 그다음 오름차순
4. `created_at` 문자열 오름차순(`localeCompare`)
5. `id` 문자열 오름차순

`sortPins(pins, mode)`:
- `"latest"`: `created_at` 내림차순, 같으면 `id` 오름차순
- `"timeline"`: ① `(content_title ?? "")`을 `localeCompare(b, "ko")` ② `content_id` 오름차순 ③ `compareScenePins`
- 두 함수 모두 입력 배열을 바꾸지 않고 새 배열을 돌려준다.

### 5.3 `src/utils/pinLabels.ts` — `docs/31` 6.3 그대로
```ts
import type { TimelinePin } from "@/types/pins";

export function formatPinEpisodeLabel(
  pin: Pick<TimelinePin, "season_number" | "episode_number" | "episode_title">,
  options?: { includeTitle?: boolean } // 기본 true
): string | null;
```
1. `parts = []`
2. `season_number === 0` → `"특별편"`, `season_number >= 2` → `` `시즌 ${n}` ``, 그 외 추가 안 함
3. `episode_number`가 1 이상 정수 → `` `${n}화` ``
4. `includeTitle !== false`이고 `episode_title?.trim()`이 비어 있지 않으면 그 값(trim)
5. 3·4에서 아무것도 추가되지 않았으면 `null`(시즌 조각만 있어도 `null`)
6. `parts.join(" · ")`

### 5.4 `src/utils/pinListUi.ts` (신규)
런타임 import는 상대 경로(`./genre`, `./homeLayout`, `./pinLabels`, `./timecode`, `../constants/emotions`), 타입은 `import type`만. `react-native`·`expo-*`·Supabase import 금지.
```ts
import type { EmotionType, PinSortMode, TimelinePin } from "@/types/pins";

export const PIN_DETAIL_PANEL_WIDTH = 360;
export const PIN_CARD_TAG_LIMIT = 3;

export const PIN_SORT_OPTIONS: readonly { label: string; value: PinSortMode }[] = [
  { label: "최신순", value: "latest" },
  { label: "작품별", value: "timeline" }
];

export const PINS_SCREEN_COPY = {
  title: "핀",
  subtitle: "감동적인 장면과 기억하고 싶은 대사를 모아보세요.",
  searchLabel: "핀 검색",
  searchPlaceholder: "작품명, 메모, 태그 검색",
  clearSearch: "검색어 지우기",
  sortLabel: "핀 정렬",
  filterButton: "필터",
  filterPanelTitle: "필터",
  filterPanelReset: "초기화",
  genreGroup: "장르",
  tagGroup: "태그",
  noTags: "아직 태그가 없어요. 핀을 남길 때 태그를 붙여 보세요.",
  emotionGroupLabel: "감정 필터",
  allOption: "전체",
  showAll: "전체 보기",
  partialError: "최신 핀을 불러오지 못해 저장된 기록을 보여 드려요.",
  retry: "다시 시도",
  emptyTitle: "아직 저장된 핀이 없어요",
  emptyDescription: "작품 상세에서 기억하고 싶은 장면을 핀으로 남겨 보세요.",
  emptyAction: "라이브러리 보기",
  noResultTitle: "조건에 맞는 핀이 없어요",
  noResultDescription: "검색어나 필터를 바꿔 보세요.",
  spoilerMasked: "스포일러가 포함된 메모예요",
  spoilerReveal: "스포일러 포함 · 보기",
  emptyMemo: "메모 없음",
  untitled: "제목 없음",
  noTime: "시간 미지정",
  memoSection: "메모",
  tagSection: "태그",
  savedAtPrefix: "저장일",
  openDetail: "핀 상세 열기",
  share: "공유",
  previewTitle: "핀 미리보기",
  previewDescription: "목록에서 핀을 고르면 여기에서 바로 볼 수 있어요.",
  selectHint: "오른쪽에 핀 내용을 보여 줘요",
  openHint: "핀 상세를 열어요"
} as const;

/** docs/31 6.6 */
export function getPinCardPressAction(showDetailPanel: boolean): "select" | "open";

export interface PinsLayout {
  gutter: number;           // getHomeLayout(w).gutter
  contentWidth: number;     // getHomeLayout(w).contentWidth
  gap: number;              // getHomeLayout(w).posterGap — 목록과 패널 사이
  showDetailPanel: boolean; // w >= 960
  detailPanelWidth: number; // PIN_DETAIL_PANEL_WIDTH
  stackTools: boolean;      // w < 600 — 검색 한 줄, 정렬·필터 다음 줄
  posterWidth: number;      // w < 600 ? 56 : 64 (높이 = posterWidth * 1.5)
  cardPadding: number;      // w < 600 ? 12 : 16
}
/** 잘못된 폭(NaN·0·음수)은 375로 본다. */
export function getPinsLayout(width: number): PinsLayout;

/** display_time_label → formatSecondsToTimecode(timestamp_seconds) → "시간 미지정" */
export function getPinTimeLabel(pin: Pick<TimelinePin, "display_time_label" | "timestamp_seconds">): string;

/** "2026. 10. 02" (로컬 날짜, 월·일 두 자리). 잘못된 값은 "" */
export function formatPinDate(value: string): string;

export interface PinListFilters { query: string; emotion: EmotionType | "all"; genre: string }
/** 순서 유지, 새 배열. */
export function filterPins<T extends TimelinePin>(pins: readonly T[], filters: PinListFilters): T[];

export interface PinEmotionOption {
  value: EmotionType | "all";
  label: string;              // "전체" | EMOTION_LABELS[value]
  count: number;
  text: string;               // `${label} ${count.toLocaleString("ko-KR")}`
  accessibilityLabel: string; // `${label} ${count.toLocaleString("ko-KR")}개`
}
export function createEmotionFilterOptions(
  pins: readonly Pick<TimelinePin, "emotion">[],
  selected: EmotionType | "all"
): PinEmotionOption[];

export function createPinGenreOptions(pins: readonly Pick<TimelinePin, "genres">[], selected: string): string[];

export interface PinFilterSummary {
  panelCount: number;               // 장르 1 + 태그 1
  hasActive: boolean;               // 검색어(trim)·감정·장르·태그 중 하나라도
  buttonLabel: string;              // "필터" | `필터 ${panelCount}`
  buttonAccessibilityLabel: string; // "필터" | `필터, ${panelCount}개 적용됨`
}
export function getPinFilterSummary(input: {
  query: string;
  emotion: EmotionType | "all";
  genre: string;
  tagId: string | null;
}): PinFilterSummary;

/** 조건 없음: `핀 ${total}개`. 조건 있음: `${max(total, shown)}개 중 ${shown}개`. 숫자는 toLocaleString("ko-KR") */
export function pinResultSummary(input: { shown: number; total: number; filtered: boolean }): string;

export interface PinCardModel {
  title: string;              // content_title?.trim() || "제목 없음"
  episodeLabel: string | null;// formatPinEpisodeLabel(pin)
  subtitle: string;           // [episodeLabel, dateLabel] 중 빈 값 빼고 " · "로
  dateLabel: string;          // formatPinDate(created_at)
  timeLabel: string;          // getPinTimeLabel(pin)
  emotionLabel: string | null;// emotion이 있고 "none"이 아니면 EMOTION_LABELS
  memo: string;               // 아래 규칙
  memoHidden: boolean;
  memoEmpty: boolean;
  tags: string[];             // 앞 PIN_CARD_TAG_LIMIT개, "#이름"
  allTags: string[];          // 전부, "#이름" (패널용)
  extraTagCount: number;      // max(0, 전체 - PIN_CARD_TAG_LIMIT)
  posterUrl: string | null;   // content_poster_url?.trim() || null
  accessibilityLabel: string; // 아래 규칙
}
export function createPinCardModel(pin: TimelinePin, options: { spoilerRevealed: boolean }): PinCardModel;
```

판정 규칙:
- **`getPinsLayout`**: `w = Number.isFinite(width) && width > 0 ? width : 375`. `getHomeLayout(w)`의 값을 옮겨 쓴다(UI-2.3). 구간을 새로 정의하지 않는다.
- **`formatPinDate`**: `new Date(value)`가 `NaN`이면 `""`. 아니면 `` `${getFullYear()}. ${월 2자리}. ${일 2자리}` ``(홈 `RecentPinCard`와 같은 형식). `toLocaleDateString`은 쓰지 않는다(실행 환경마다 결과가 다르다).
- **`filterPins`**: 다음을 모두 만족하는 핀만 남긴다.
  1. `filters.emotion === "all" || pin.emotion === filters.emotion`
  2. `matchesGenreFilter(pin.genres, filters.genre)`(`./genre`)
  3. `q = filters.query.trim().toLocaleLowerCase()`가 비었거나, 다음 중 하나가 `q`를 포함한다(각각 `toLocaleLowerCase()`): `content_title`, `formatPinEpisodeLabel(pin)`, `getPinTimeLabel(pin)`, `memo`, 감정 라벨(`emotion`이 있으면 `EMOTION_LABELS[emotion]`), `createDisplayGenreNames(pin.genres)`의 각 값, `tags`의 각 `name`. 화면에 보이는 값으로 찾을 수 있게 한다.
- **`createEmotionFilterOptions`**:
  1. 감정별 개수를 센다(`null`은 세지 않는다).
  2. 첫 항목은 `{ value: "all", label: "전체", count: pins.length }`.
  3. 그 뒤로 `none`을 뺀 감정 중 개수 ≥ 1인 것을 개수 내림차순, 같으면 `EMOTION_OPTIONS` 순서로 놓는다.
  4. `selected !== "all"`이고 3에 없으면 `{ value: selected, count: 실제 개수 }`를 맨 뒤에 붙인다.
  5. 모든 항목에 `text`·`accessibilityLabel`을 채운다.
- **`createPinGenreOptions`**: `createGenreFilterOptions(장르 전부 + (selected !== ALL_GENRE_FILTER ? [selected] : []), false)`. 기본 장르를 넣지 않는다.
- **`getPinFilterSummary`**: `panelCount = (genre !== ALL_GENRE_FILTER ? 1 : 0) + (tagId !== null ? 1 : 0)`. `hasActive = query.trim() !== "" || emotion !== "all" || panelCount > 0`.
- **`createPinCardModel`**:
  - `rawMemo = pin.memo?.trim() ?? ""`.
  - `memoHidden = pin.is_spoiler && !spoilerRevealed && rawMemo !== ""`(가릴 내용이 없으면 가리지 않는다).
  - `memoEmpty = rawMemo === ""`.
  - `memo = memoHidden ? "스포일러가 포함된 메모예요" : memoEmpty ? "메모 없음" : rawMemo`.
  - `accessibilityLabel` = `[title, episodeLabel, timeLabel, emotionLabel, memoHidden ? "스포일러 메모 숨김" : memoEmpty ? null : rawMemo, dateLabel ? `저장일 ${dateLabel}` : null]`에서 빈 값을 빼고 `", "`로 잇는다.

## 6. 화면 명세

UI 규칙 준수(UI-1~UI-13). 아래는 화면 고유 값이다.

### 6.1 `app/(tabs)/pins.tsx`
- **레이아웃**
  - `layout = getPinsLayout(width)`. 바깥 구조(`shell` `paddingTop: insets.top` + `page` `paddingTop: spacing.md`, 최대 폭 1200, `paddingHorizontal: layout.gutter`)는 유지한다.
  - `contentGrid` 간격은 `layout.gap`. 패널은 `layout.showDetailPanel`일 때만 렌더한다.
- **상태**
  - `viewMode`를 없애고 `const [filtersOpen, setFiltersOpen] = useState(false)`를 더한다.
  - 나머지 상태와 `selectedPin`, 첫 핀 자동 선택 `useEffect`, 스포일러 atom, `useFocusEffect` 초기화는 그대로 둔다.
- **파생값(`useMemo`)**
  - `facetPins = filterPins(activePins ?? [], { query, emotion: "all", genre })`
  - `filteredPins = filterPins(activePins ?? [], { query, emotion, genre })`
  - `sortedPins = sortPins(filteredPins, sortMode)`
  - `emotionOptions = createEmotionFilterOptions(facetPins, selectedEmotion)`
  - `genreOptions = createPinGenreOptions(activePins ?? [], genreFilter)`
  - `filterSummary = getPinFilterSummary(...)`
  - `pressAction = getPinCardPressAction(layout.showDetailPanel)`
- **머리글(`ListHeaderComponent`, 아래 순서, 블록 사이 `spacing.md`, 제목 블록과 도구 줄 사이 `spacing.lg`)**
  1. 제목 `typography.display`(`accessibilityRole="header"`)와 부제 `typography.body` `textMuted`. 인물 화면과 같은 모양이다.
  2. 도구 줄
     - `stackTools`가 아니면 한 줄: 검색(`flex: 1`, `minWidth: 0`) · `SegmentedControl`(`PIN_SORT_OPTIONS`, 라벨 "핀 정렬") · 필터 버튼.
     - `stackTools`면 두 줄: 검색 한 줄, 그 아래 `SegmentedControl`(`stretch`, `flex: 1` 래퍼)과 필터 버튼.
     - 검색창은 인물 화면 검색창과 같은 모양이다: 알약, 높이 48, `search` 18, 지우기 `close-circle` 18 `hitSlop={13}`, `autoCapitalize="none"`, `autoCorrect={false}`, `returnKeyType="search"`.
  3. 필터 버튼
     - 모양: 알약, `minHeight: 44`, `options-outline` 18 + `filterSummary.buttonLabel`(`typography.label`).
     - `filtersOpen || panelCount > 0`이면 배경 `primarySoft`, 테두리·글자·아이콘 `primary`.
     - `accessibilityLabel={filterSummary.buttonAccessibilityLabel}`, `accessibilityState={{ expanded: filtersOpen }}`.
     - 누르면 `filtersOpen`을 토글한다.
  4. `filtersOpen`이면 `PinFilterPanel`(6.3)을 펼친다.
  5. 감정 칩 줄: `emotionOptions`를 `PinFilterChip`으로 그린다. 줄바꿈, `gap: spacing.sm`, 바깥 `View` `accessibilityLabel="감정 필터"`. 선택한 칩을 누르면 `"all"`로 돌아간다.
  6. 결과 줄
     - `pinResultSummary({ shown: sortedPins.length, total: allPins.data?.length ?? 0, filtered: filterSummary.hasActive })`, `typography.caption` `textMuted` `tabular-nums`.
     - `hasActive`면 텍스트 버튼 "전체 보기"(`typography.label` `primary`, 44 확보). 검색어·감정·장르·태그를 모두 지운다.
     - `isError && sortedPins.length > 0`이면 다음 줄에 `partialError`(caption) + "다시 시도" 텍스트 버튼. 154행 `ErrorState`를 대체한다.
- **목록(`FlashList`)**
  - `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`. 구분 간격 `spacing.md`.
  - `extraData={{ selectedId: selectedPin?.id ?? null, revealedSpoilers, pressAction, posterWidth: layout.posterWidth }}`.
  - 항목은 `PinListCard`(6.2). `onPressPin`은 `useCallback`이다. `"select"`면 `setSelectedPinId(id)`, `"open"`이면 `router.push({ pathname: "/pins/[id]", params: { id } })`.
- **빈·오류·로딩 상태(`ListEmptyComponent`, UI-6.4 순서)**
  - 로딩: 기존 `LoadingSkeleton variant="pin-item" count={5}`를 그대로 쓴다.
  - 오류(데이터 없음): `ErrorState` + 재시도.
  - 조건 없이 0개: `EmptyState`(`emptyTitle`, `emptyDescription`, `emptyAction` → `router.push("/library")`).
  - 조건 있고 0개: `EmptyState`(`noResultTitle`, `noResultDescription`, 행동 "전체 보기" → 전체 해제).
- **옆 패널**: `PinDetailPanel`(6.4). `canShare = EXTENDED_FEATURES_ENABLED && Platform.OS !== "web"`. `sharePin`·캡처 레이어는 그대로 둔다(D-12).
- **없앨 것**
  - 로컬 `SegmentButton`, `ToolbarIconButton`, `FilterRow`, `FilterChip`, `SummaryCards`, `getEmotionSummaryIcon`/`Tone`, 로컬 `PinTimelineItem`, `PinCard`, `PinDetailPanel`, `PinPoster`, `getPinTimeLabel`, `getEpisodeLabel`, `getPinContextLabel`, `formatDate`
  - 쓰지 않게 된 스타일
  - `shouldShowPinDetailPanel` import

### 6.2 `src/components/pins/PinListCard.tsx` (신규, `memo`)
```ts
export const PinListCard: React.MemoExoticComponent<(props: {
  pin: TimelinePin;
  spoilerRevealed: boolean;
  selected: boolean;               // pressAction === "select"일 때만 표시
  pressAction: "select" | "open";
  posterWidth: number;
  padding: number;                 // layout.cardPadding
  onPressPin: (id: string) => void;
}) => JSX.Element>;
```
- **모델**: `createPinCardModel(pin, { spoilerRevealed })`(`useMemo`).
- **카드**: `Pressable` 하나. 가로 배치, `gap: spacing.md`, `padding`, `surface`, hairline `border`, `radius.lg`, `...elevation.card`.
  - 선택(`"select"` && `selected`): `borderColor: colors.primary`, `borderWidth: 1`.
  - 눌림: `opacity: 0.72`.
  - 접근성: `accessibilityRole="button"`, `accessibilityLabel={model.accessibilityLabel}`, `accessibilityHint`는 모드별(`selectHint`/`openHint`), `"select"`일 때만 `accessibilityState={{ selected }}`.
- **포스터**: `AppImage` `posterWidth × posterWidth * 1.5`, `radius.sm`, `contentFit="cover"`, `source={posterUrl ? { uri } : null}`.
- **본문**: `flex: 1`, `minWidth: 0`, `gap: spacing.xs`.
  1. 제목 `typography.headline`, `numberOfLines={1}`
  2. `subtitle`(비면 생략) `typography.caption` `textMuted`, `numberOfLines={1}`
  3. 메타 줄(줄바꿈, `gap: spacing.sm`)
     - 시간 칩: `typography.label`, `primary`, 배경 `primarySoft`, `radius.sm`, 좌우 `spacing.sm`·상하 2, `tabular-nums`
     - 감정 배지: `typography.micro`, `primary`, 배경 `primarySoft`, `radius.pill`, 좌우 `spacing.sm`·상하 3
  4. 메모
     - `memoHidden`: `eye-off-outline` 16 `textMuted` + `typography.caption` `textMuted`(누를 수 없음)
     - `memoEmpty`: `typography.caption` `textSubtle`
     - 그 외: `typography.body` `text`, `numberOfLines={3}`
  5. 태그(있으면): 줄바꿈, `gap: spacing.xs`. 각 `typography.caption` `textMuted`, 배경 `surfaceMuted`, `radius.pill`, 좌우 `spacing.sm`·상하 2. `extraTagCount > 0`이면 같은 모양 `+N`.
- **`"open"`일 때만**: 오른쪽 `chevron-forward` 18 `textSubtle`, `alignSelf: "center"`, 접근성에서 숨김.

### 6.3 `src/components/pins/PinFilterPanel.tsx` (신규)
```ts
export function PinFilterChip(props: {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
}): JSX.Element;

export function PinFilterPanel(props: {
  genreOptions: string[];
  selectedGenre: string;            // ALL_GENRE_FILTER = 전체
  onSelectGenre: (genre: string) => void;
  tags: { id: string; name: string }[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  showReset: boolean;               // panelCount > 0
  onReset: () => void;              // 장르·태그만 지움
}): JSX.Element;
```
- **`PinFilterChip`**
  - 모양: 알약, `minHeight: 36` + `hitSlop={{ top: 4, bottom: 4 }}`, 좌우 `spacing.md`, `surface`, hairline `border`, 글자 `typography.label` `textMuted`, `numberOfLines={1}`.
  - 선택: 배경·테두리 `primary`, 글자 `surface`. 눌림: `opacity: 0.72`.
  - `accessibilityRole="button"`, `accessibilityState={{ selected }}`.
- **`PinFilterPanel`**: `DashboardPanel title="필터"`. `accessory`는 `showReset`일 때 텍스트 버튼 "초기화"(`typography.label` `primary`, 44 확보).
  - "장르" 그룹(장르 옵션이 1개 이상일 때): 그룹 이름 `typography.caption` `textMuted`, 칩 줄바꿈 `gap: spacing.sm`. 첫 칩 "전체"(→ `ALL_GENRE_FILTER`), 그다음 옵션들. 선택한 칩을 다시 누르면 전체로 돌아간다.
  - "태그" 그룹: 첫 칩 "전체"(→ `null`), 그다음 `#이름`. 선택한 칩을 다시 누르면 `null`. 태그가 0개면 칩 대신 `noTags`(caption `textMuted`).

### 6.4 `src/components/pins/PinDetailPanel.tsx` (신규)
```ts
export function PinDetailPanel(props: {
  pin: TimelinePin | null;
  width: number;
  spoilerRevealed: boolean;
  canShare: boolean;
  onRevealSpoiler: () => void;
  onOpenDetail: () => void;
  onShare: () => void;
}): JSX.Element;
```
- **바깥**: `View` `width`, `alignSelf: "flex-start"`, `maxHeight: "100%"`, `marginBottom: spacing.lg`, `surface`, hairline `border`, `radius.lg`, `...elevation.card`(`overflow` 지정 없음).
- **안**: `ScrollView`(`contentContainerStyle` `padding: spacing.lg`, `gap: spacing.lg`). 긴 메모는 패널 안에서 스크롤하고, 목록 스크롤과 따로 움직인다.
- **`pin === null`**: `pin-outline` 24 `primary`, `previewTitle`(`typography.headline`), `previewDescription`(`typography.body` `textMuted`), 가운데 정렬, 상하 `spacing.xl`.
- **내용**: 모델은 `createPinCardModel`.
  1. 머리 줄(`gap: spacing.md`)
     - 포스터 `AppImage` 72×108 `radius.sm`
     - 오른쪽 열(`flex: 1`, `minWidth: 0`, `gap: spacing.xs`): 제목 `typography.title` `numberOfLines={3}`, 회차 라벨 `typography.label` `textMuted`(있으면)
  2. 시간 `typography.title` `primary` `tabular-nums` + 감정 배지(카드와 같은 모양)
  3. hairline 구분선 `border`
  4. "메모" `typography.caption` `textMuted`
     - `memoHidden`: 버튼 `spoilerReveal`(`minHeight: 44`, `radius.md`, 배경 `surfaceMuted`, `eye-outline` 16 + `typography.label` `textMuted`) → `onRevealSpoiler`
     - `memoEmpty`: caption `textSubtle`
     - 그 외: `typography.body` `text`, `selectable`, 전체 표시
  5. 태그(있으면): "태그" caption + `allTags` 전부(카드 태그 모양)
  6. `${savedAtPrefix} ${dateLabel}`(caption `textSubtle`, `dateLabel`이 있을 때)
  7. 주 행동: 알약 `minHeight: 44`, 배경 `primary`, `open-outline` 18 + `openDetail`(`typography.label` `surface`) → `onOpenDetail`. 눌림 `opacity: 0.72`.
  8. `canShare`일 때만 공유: 알약 `minHeight: 44`, `surface`, hairline `primary` 테두리, `share-social-outline` 18 + `share`(`primary`) → `onShare`

## 7. 데이터 모델 / SQL

없음. 서비스·쿼리·DB를 바꾸지 않는다(D-1).

## 8. `docs/31`과의 관계

| `docs/31` 항목 | 이 명세에서 |
|----------------|-------------|
| U-1(모바일 카드 열기) | 흡수. D-6, `getPinCardPressAction`(T-39·T-40) |
| U-3(장면 순서) | **일부.** 6.1 타입·6.2 `pinSort.ts`(T-1~T-10)·6.3 `pinLabels.ts`(T-11~T-16b)를 만들고 핀 탭에 쓴다. 7장 서비스 select·`getPinsByContent` 정렬·8.9 다른 컴포넌트 라벨 공통화는 남는다 |
| U-7(헤더 과밀·죽은 필터) | 흡수하되 설계 대체(D-4). 6.6 `countActivePinFilters`·`resolvePinFiltersVisible`, T-41~T-44는 만들지 않는다 |
| D-2(패널이 있으면 선택) | 유지. 패널 기준 폭만 960으로(D-5) |

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 연결 |
|---|------|----------|------|
| E-1 | 폭 375 | 패널 없음, 카드 누름 → 핀 상세, 오른쪽 `›` | T-39, P-L1, M-3·M-5 |
| E-2 | 폭 1440 | 카드 누름 → 패널 갱신, 선택 테두리 | T-40, P-L7, M-1 |
| E-3 | 폭 768·959 | 패널 없음(한 열), 카드 누름 → 핀 상세 | P-L4·P-L5, M-2 |
| E-4 | "감동" 선택 뒤 검색어 때문에 감동 핀 0개 | "감동 0" 칩이 맨 뒤에 남고, 누르면 해제 | P-E3 |
| E-5 | 기본 장르 목록에 있지만 내 핀에 없는 장르 | 칩 없음 | P-G1 |
| E-6 | 태그 선택(서버 조회) 중 | 스켈레톤, 필터 버튼 "필터 1" | P-A5, M-1 |
| E-7 | 가려진 스포일러 핀 | 카드는 가림 문구, 패널 "보기" → 패널·카드 모두 메모 표시 | P-C2·P-C3, M-1 |
| E-8 | 메모 없는 스포일러 핀 | 가리지 않고 "메모 없음" | P-C4b |
| E-9 | 포스터 URL 없음·깨짐 | `AppImage` 대체 배경, 자리 크기 유지 | M-1·M-3 |
| E-10 | 태그 5개 | 카드 3개 + "+2", 패널 5개 전부 | P-C5 |
| E-11 | 제목이 같은 서로 다른 작품, "작품별" | 섞이지 않음 | T-10 |
| E-12 | 같은 작품 1화 20:00, 5화 03:00, "작품별" | 1화 먼저 | T-1 |
| E-13 | 시간 미지정 핀 | "시간 미지정", 같은 회차 맨 뒤 | T-4, P-C4 |
| E-14 | 검색 "42:10"(`display_time_label` 없음) | 찾음 | P-F2 |
| E-15 | 핀 0개(조건 없음) | `EmptyState` + "라이브러리 보기", 패널은 "핀 미리보기" | M-1·M-3 |
| E-16 | 조건 결과 0개 | `EmptyState` "조건에 맞는 핀이 없어요" + "전체 보기" | P-R4, M-1 |
| E-17 | 조회 실패 + 캐시 있음 | 캐시 목록 + caption 한 줄 + "다시 시도" | M-1 |
| E-18 | 조회 실패 + 캐시 없음 | `ErrorState`만(빈 상태 없음) | M-1 |
| E-19 | 패널 메모가 아주 김 | 패널 안에서 스크롤, 목록과 따로 | M-1 |
| E-20 | 앱 글자 1.3배 | 칩 줄바꿈, 제목 1줄 줄임표, 버튼 글자 잘림 없음 | M-5 |
| E-21 | 핀 1,234개 중 1,200개 | "1,234개 중 1,200개" | P-R3 |
| E-22 | 키보드가 열린 채 칩·카드 누름 | 한 번에 동작 | M-5 |
| E-23 | 선택한 핀이 조건 변경으로 목록에서 빠짐 | 첫 핀 자동 선택(기존 효과 유지) | M-1 |
| E-24 | 검색어를 지우다 결과가 0↔N을 오감 | 패널이 사라지지 않아 도구 줄 폭이 흔들리지 않음 | M-1 |
| E-25 | 시즌 2 핀(서비스가 시즌을 채운 뒤) | "시즌 2 · 3화 · 날짜" | P-C8, T-13 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다. 한 행 = `it` 하나.** `node:test` + `node:assert/strict`.
공통 픽스처: `pin(overrides)` 헬퍼가 `{ id: "p1", user_id: "u1", content_id: "c1", episode_id: null, content_title: "무빙", content_poster_url: null, genres: [], episode_title: null, episode_number: null, season_number: null, timestamp_seconds: null, display_time_label: null, memo: null, emotion: null, is_spoiler: false, created_at: "2026-10-02T12:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z", tags: [] }`를 만든다. 날짜는 UTC 정오라 UTC-11~+11 어디서 돌려도 10월 2일이다.

### `src/utils/pinSort.test.ts` — `docs/31` T-1~T-10 그대로
| ID | 입력 | 기대 |
|----|------|------|
| T-1 | A(ep1, 1200s), B(ep5, 180s) → `sortPinsByScene([B, A])` | `[A, B]` |
| T-2 | A(s2 ep1), B(s1 ep12), C(s0 ep1) | `[C, B, A]` |
| T-3 | 같은 ep3: A(900s), B(60s), C(300s) | `[B, C, A]` |
| T-4 | 같은 ep3: A(null), B(60s) | `[B, A]` |
| T-5 | 같은 ep3·같은 60s: A(created 09-02), B(created 09-01) | `[B, A]` |
| T-6 | A(episode null, 30s), B(ep1, 10s) | `[A, B]` |
| T-7 | `sortPins([...], "latest")`: created 09-01 / 09-03 / 09-02 | 09-03, 09-02, 09-01 순 |
| T-8 | `sortPins(..., "timeline")`: "진격의 거인" ep5 10s, "무빙" ep2 5s, "무빙" ep1 999s | 무빙 ep1 → 무빙 ep2 → 진격의 거인 ep5 |
| T-9 | 입력 배열 `input`으로 `sortPinsByScene(input)`, `sortPins(input, "timeline")` | 반환값 `!== input`, `input` 원래 순서 그대로 |
| T-10 | "timeline": c2 "무빙" ep1, c1 "무빙" ep2, c2 "무빙" ep2, c1 "무빙" ep1 | c1 ep1, c1 ep2, c2 ep1, c2 ep2 |

### `src/utils/pinLabels.test.ts` — `docs/31` T-11~T-16b 그대로
| ID | 입력 (season, episode, title) | 기대 |
|----|------|------|
| T-11 | (null, 12, null) | `"12화"` |
| T-12 | (1, 12, "각성") | `"12화 · 각성"` |
| T-13 | (2, 3, null) | `"시즌 2 · 3화"` |
| T-14 | (0, 1, null) | `"특별편 · 1화"` |
| T-15 | (null, null, null) 및 (2, null, "  ") | 둘 다 `null` |
| T-16 | (null, null, "파일럿") | `"파일럿"` |
| T-16b | (2, 3, "각성"), `{ includeTitle: false }` | `"시즌 2 · 3화"` |

### `src/utils/pinListUi.test.ts`
| ID | 입력 | 기대 |
|----|------|------|
| T-39 | `getPinCardPressAction(false)` | `"open"` |
| T-40 | `getPinCardPressAction(true)` | `"select"` |
| P-L1 | `getPinsLayout(375)` | `{ gutter: 16, contentWidth: 343, gap: 12, showDetailPanel: false, detailPanelWidth: 360, stackTools: true, posterWidth: 56, cardPadding: 12 }` |
| P-L2 | `getPinsLayout(599)` | `{ 16, 567, 12, false, 360, true, 56, 12 }` (P-L1과 같은 필드 순서: gutter, contentWidth, gap, showDetailPanel, detailPanelWidth, stackTools, posterWidth, cardPadding) |
| P-L3 | `getPinsLayout(600)` | `{ 24, 552, 16, false, 360, false, 64, 16 }` |
| P-L4 | `getPinsLayout(768)` | `{ 24, 720, 16, false, 360, false, 64, 16 }` |
| P-L5 | `getPinsLayout(959)` | `{ 24, 911, 16, false, 360, false, 64, 16 }` |
| P-L6 | `getPinsLayout(960)` | `{ 24, 912, 16, true, 360, false, 64, 16 }` |
| P-L7 | `getPinsLayout(1440)` | `{ 24, 1152, 16, true, 360, false, 64, 16 }` |
| P-L8 | `getPinsLayout(2000)` | `{ 24, 1152, 16, true, 360, false, 64, 16 }` |
| P-L9 | `getPinsLayout(NaN)`, `(0)`, `(-10)` | 각각 `getPinsLayout(375)`와 `deepEqual` |
| P-D1 | `formatPinDate("2026-10-02T12:00:00.000Z")`, `("")`, `("not-a-date")` | `"2026. 10. 02"`, `""`, `""` |
| P-T1 | `getPinTimeLabel({ display_time_label: "OP 직후", timestamp_seconds: 100 })`, `({ null, 2530 })`, `({ null, 3725 })`, `({ null, null })` | `"OP 직후"`, `"42:10"`, `"1:02:05"`, `"시간 미지정"` |
| P-F1 | 핀 [A "Moving", B "무빙"], query `"  MOVING "` | `[A]` |
| P-F2 | A(timestamp 2530, display null), B(timestamp 60), query `"42:10"` | `[A]` |
| P-F3 | A(ep 7), B(tags [{ name: "눈물" }]), C(emotion "moved"), D(genres ["Drama"]), E(아무것도 없음). query `"7화"` / `"눈물"` / `"감동"` / `"드라마"` | `[A]` / `[B]` / `[C]` / `[D]` |
| P-F4 | A(sad, ["드라마"]), B(sad, ["액션"]), C(moved, ["드라마"]). `{ query: "", emotion: "sad", genre: "드라마" }` / `{ "", "all", "all" }` | `[A]` / `[A, B, C]`(새 배열, `!== input`) |
| P-F5 | 핀 3개, query `"   "` | 3개 그대로 |
| P-E1 | emotion [moved, moved, sad, null, none], selected "all" | `[{ all, "전체", 5, "전체 5", "전체 5개" }, { moved, "감동", 2, "감동 2", "감동 2개" }, { sad, "슬픔", 1, "슬픔 1", "슬픔 1개" }]` |
| P-E2 | emotion [sad, excited], "all" | 순서 all → excited("설렘") → sad(같은 1개, `EMOTION_OPTIONS` 순서) |
| P-E3 | emotion [moved], selected "love" | all(1) → moved(1) → `{ love, "사랑", 0, "사랑 0", "사랑 0개" }` |
| P-E4 | `[]`, "all" | `[{ all, "전체", 0, "전체 0", "전체 0개" }]` |
| P-G1 | genres [["드라마", "로맨스"], ["드라마"], undefined], selected "all" | `["드라마", "로맨스"]`("공포" 등 기본 장르 없음) |
| P-G2 | 같은 핀, selected "스릴러" | `["드라마", "로맨스", "스릴러"]` |
| P-G3 | `[]`, "all" | `[]` |
| P-A1 | `{ query: "  ", emotion: "all", genre: "all", tagId: null }` | `{ panelCount: 0, hasActive: false, buttonLabel: "필터", buttonAccessibilityLabel: "필터" }` |
| P-A2 | query `"무빙"`, 나머지 기본 | `panelCount 0`, `hasActive true`, `buttonLabel "필터"` |
| P-A3 | emotion `"sad"`, 나머지 기본 | `panelCount 0`, `hasActive true` |
| P-A4 | genre `"드라마"`, tagId `"t1"` | `{ 2, true, "필터 2", "필터, 2개 적용됨" }` |
| P-A5 | tagId `"t1"`만 | `{ 1, true, "필터 1", "필터, 1개 적용됨" }` |
| P-R1 | `{ shown: 4, total: 4, filtered: false }` | `"핀 4개"` |
| P-R2 | `{ 1, 4, true }` | `"4개 중 1개"` |
| P-R3 | `{ 1200, 1234, true }` | `"1,234개 중 1,200개"` |
| P-R4 | `{ 0, 4, true }` / `{ 3, 0, true }` | `"4개 중 0개"` / `"3개 중 3개"` |
| P-R5 | `{ 0, 0, false }` | `"핀 0개"` |
| P-C1 | `pin({ content_title: "무빙", episode_number: 7, episode_title: "감정선", timestamp_seconds: 2530, emotion: "moved", memo: "  감정선 최고  ", tags: [{ name: "눈물" }], content_poster_url: "https://image.tmdb.org/t/p/w342/a.jpg" })`, 미공개 | `title "무빙"`, `episodeLabel "7화 · 감정선"`, `subtitle "7화 · 감정선 · 2026. 10. 02"`, `dateLabel "2026. 10. 02"`, `timeLabel "42:10"`, `emotionLabel "감동"`, `memo "감정선 최고"`, `memoHidden false`, `memoEmpty false`, `tags ["#눈물"]`, `allTags ["#눈물"]`, `extraTagCount 0`, `posterUrl` 그 URL, `accessibilityLabel "무빙, 7화 · 감정선, 42:10, 감동, 감정선 최고, 저장일 2026. 10. 02"` |
| P-C2 | P-C1 + `is_spoiler: true`, `spoilerRevealed: false` | `memo "스포일러가 포함된 메모예요"`, `memoHidden true`, `accessibilityLabel`에 `"스포일러 메모 숨김"` 포함·`"감정선 최고"` 미포함 |
| P-C3 | P-C2 핀, `spoilerRevealed: true` | `memo "감정선 최고"`, `memoHidden false` |
| P-C4 | `pin({ content_title: null, emotion: "none", memo: "   " })` | `title "제목 없음"`, `episodeLabel null`, `subtitle "2026. 10. 02"`, `timeLabel "시간 미지정"`, `emotionLabel null`, `memo "메모 없음"`, `memoEmpty true`, `accessibilityLabel "제목 없음, 시간 미지정, 저장일 2026. 10. 02"` |
| P-C4b | `pin({ is_spoiler: true, memo: null })`, 미공개 | `memoHidden false`, `memoEmpty true`, `memo "메모 없음"` |
| P-C5 | tags 이름 a·b·c·d·e | `tags ["#a", "#b", "#c"]`, `allTags` 5개, `extraTagCount 2` |
| P-C6 | `pin({ content_poster_url: "  " })` | `posterUrl null` |
| P-C7 | `pin({ episode_number: 7, episode_title: "감정선", created_at: "not-a-date" })` | `subtitle "7화 · 감정선"`, `dateLabel ""`, `accessibilityLabel`에 `"저장일"` 미포함 |
| P-C8 | `pin({ season_number: 2, episode_number: 3 })` | `subtitle "시즌 2 · 3화 · 2026. 10. 02"` |
| P-K1 | 상수 | `PIN_DETAIL_PANEL_WIDTH === 360`, `PIN_CARD_TAG_LIMIT === 3`, `PIN_SORT_OPTIONS`·`PINS_SCREEN_COPY`가 5.4 값과 `deepEqual` |

`pin()` 픽스처의 `tags`는 `Tag[]` 타입이라 `{ id, user_id, name, created_at }`를 채운다. 표에는 `name`만 적었다.

### 수동 확인 (UI-14.3)

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440(및 1000) | 첫 핀 카드가 첫 화면 위쪽 절반 안에 있다. 시작선 하나. 카드·패널·필터 카드 모서리·그림자가 인물·프로필과 같다. 카드 누름 → 패널 갱신·선택 테두리. 필터 펼침·"필터 N"·초기화·"전체 보기". 스포일러 패널 "보기" → 카드도 표시. 긴 메모가 패널 안에서 스크롤. 검색어를 지우는 동안 도구 줄 폭이 흔들리지 않음(E-24). 키보드 Tab으로 칩·카드·패널 버튼 이동 |
| M-2 | 웹 768 | 패널 없음, 한 열, 카드 누름 → 핀 상세, 도구 줄 한 줄로 넘침 없음 |
| M-3 | 웹 375 | 도구 두 줄(검색 / 정렬+필터), 감정 칩 줄바꿈(가로 넘침 없음), 카드 누름 → 핀 상세, 포스터 56×84, 가로 스크롤 없음 |
| M-4 | 웹 844×390(가로 휴대폰) | 머리글이 목록과 함께 스크롤되고 첫 카드에 닿을 수 있음 |
| M-5 | 앱(iOS 세로) | 노치 아래 제목, 카드 누름 → 핀 상세, 검색 키보드가 열린 채 칩을 한 번에 누름, 글자 1.3배에서 칩·카드·버튼 잘림 없음, 하단 탭과 겹침 없음 |

## 11. 변경 파일

| 파일 | 변경 |
|------|------|
| `src/types/pins.ts` | `TimelinePin.season_number?` 한 줄(5.1) |
| `src/utils/pinSort.ts` | 신규(5.2, `docs/31` 6.2) |
| `src/utils/pinSort.test.ts` | 신규, T-1~T-10 |
| `src/utils/pinLabels.ts` | 신규(5.3, `docs/31` 6.3) |
| `src/utils/pinLabels.test.ts` | 신규, T-11~T-16b |
| `src/utils/pinListUi.ts` | 신규(5.4) |
| `src/utils/pinListUi.test.ts` | 신규, T-39·T-40·P-* |
| `src/components/pins/PinListCard.tsx` | 신규(6.2) |
| `src/components/pins/PinFilterPanel.tsx` | 신규(6.3) |
| `src/components/pins/PinDetailPanel.tsx` | 신규(6.4) |
| `app/(tabs)/pins.tsx` | 6.1(로컬 컴포넌트·스타일 정리, 새 함수·컴포넌트 연결) |

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| `src/services/pins.ts` 시즌 임베드·`getPinsByContent` 정렬(`docs/31` 7장·U-3 나머지) | 데이터 변경. 실제 계정으로 select 결과를 확인해야 한다. 별도 |
| 홈 `RecentPinCard`·`src/components/pins/PinTimelineItem.tsx`·`PinShareCard` 라벨 공통화(`docs/31` 8.9) | 다른 화면 |
| 핀 상세·편집·작성(`docs/31` U-4·U-8·U-9), 작품 핀 목록 | 다른 화면 |
| `src/utils/pinResponsive.ts`와 그 테스트 | 기존 테스트가 참조한다(D-5). 정리는 별도 |
| "작품별"에서 작품 머리글로 묶기 | 후속(기각한 대안) |
| 공유(`sharePin`, `PinShareCard`, `Alert.alert` 2줄) | 기능 꺼짐(D-12) |
| `EmptyState`·`ErrorState`·`LoadingSkeleton` 내부 스타일(토큰 위반 있음) | 공용 컴포넌트. 전 화면 영향이라 별도 |
| 검색어가 가려진 스포일러 메모와도 일치하는 동작 | 현재 동작 유지 |
| 미커밋 다른 작업(`docs/41`~`43`, 보러가기, 스크롤 복원 등) | 무관 |

## 13. 확실하지 않음 — 별도 검증 필요

1. 패널의 `maxHeight: "100%"` + 안쪽 `ScrollView`가 웹·iOS 모두에서 "패널 안 스크롤"로 동작하는지. 안 되면 구현하지 말고 대안(예: `layout`에서 높이를 계산해 `maxHeight` 숫자로)과 함께 보고한다(M-1·M-5).
2. 실제 계정 핀의 포스터 URL 비율·누락은 로그인 화면이라 AI가 확인할 수 없다. 사람이 M-1·M-5로 확인한다.
