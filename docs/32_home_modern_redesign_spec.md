# 32. 홈 화면 모던 스타일 개편 명세 (1단계: 토큰·공통 크롬·홈)

작성일: 2026-09-26
대상 브랜치 기준: `main` (`198a064`, 미커밋 문서 수정 포함. 이 시점 `npm test` 474개 통과)
선행 문서: `docs/11_screen_implementation_spec.md`, `docs/12_episode_progress_spec.md`, `docs/19_mobile_usability_spec.md`(M-05 터치 44pt, M-10 홈 요약), `docs/31_usability_review_fixes_spec.md`(U-3 회차 라벨)

> **근거.** 사용자가 보낸 홈 화면 캡처(넓은 웹 폭, 6열)와 코드(`app/(tabs)/index.tsx`, `ContentCard.tsx`, `RecentPinCard.tsx`, `app/_layout.tsx`)를 대조했다. 로그인 이후 화면을 직접 실측하지는 않았다.

---

## 1. 문제 정의

사용자 표현: "라인도 아이콘도 정렬이 제대로 안 된 느낌, 최신 스타일로."

| ID | 증상 (캡처 기준) | 코드상 원인 |
|----|-----------------|-------------|
| H-1 | 섹션 제목, 최근 핀 카드, 보는 중 카드, 하단 "SceneNote" 블록의 **왼쪽 시작선이 4개로 다르다** | 섹션 헤더 `paddingHorizontal: spacing.lg(16)`, 핀 그리드 `spacing.sm(8)` + 셀 `spacing.xs(4)`, 보는 중 그리드 `spacing.xs(4)` + 카드 `marginHorizontal: spacing.lg(16)`, 히어로 `spacing.xl(24)` (`app/(tabs)/index.tsx` styles `sectionHeader` 290행·`galleryGrid` 315행·`recentPinGrid` 320행·`hero` 217행, `ContentCard.tsx:115`) |
| H-2 | 최근 핀은 화면 왼쪽 2/3만 쓰고 오른쪽이 비는데, 보는 중은 전체 폭을 쓴다 | `recentPinGrid`에만 `maxWidth: 1024` (`index.tsx:323`) |
| H-3 | "전체 보기"가 섹션 제목과 세로 정렬이 어긋난다 | 헤더 `alignItems: "flex-end"`인데 액션은 44pt 박스 안에서 세로 중앙 (`index.tsx:182~204` `SectionHeader`, 291행) |
| H-4 | 보는 중 카드 높이가 제각각이라 아래 선이 들쭉날쭉하다. 포스터가 카드 세로 중앙에 떠 있다 | 제목 1~2줄, 배지 유무, 장르 줄 수에 따라 높이가 달라짐. 카드 `alignItems: "center"` (`ContentCard.tsx:108`) |
| H-5 | 한 카드에 칩 스타일이 5~6종(초록 "새 회차", 파란 날짜, 파란 장르, "외 N개", 파란 박스 "다음", 초록 "보는 중") | `ContentCard`가 라이브러리 상세 목록용 정보를 홈에서도 전부 보여줌. "보는 중" 섹션 안에서 "보는 중" 배지는 중복 |
| H-6 | 화면 맨 위는 "홈" 글자만 있는 빈 헤더, 앱의 주 행동인 **검색이 맨 아래**에 흰 띠로 붙어 있다 | 기본 탭 헤더 + 하단 `hero` 블록 (`index.tsx:113~122`) |
| H-7 | 글자가 전반적으로 무겁다 | 제목·배지·라벨 대부분 `fontWeight: "900"` |
| H-8 | 모서리가 작고(6~8) 평평해서 카드 경계가 약하다 | `radius = { sm: 6, md: 8, lg: 12 }`, 그림자 없음 |
| H-9 | 하단 탭이 넓은 화면에서 좌우 끝까지 퍼지고, 선택 표시가 라벨 아래 3pt 선뿐이다 | `GlobalBottomNav` 폭 제한 없음, `navActiveIndicator` (`app/_layout.tsx:188, 262~`) |
| H-10 | 핀이 0개인 새 사용자는 홈에서 "핀"이라는 핵심 기능을 알 방법이 없다 | 핀 0개면 섹션 자체를 숨김 (`index.tsx:44`) |

---

## 2. 목표 모습

목업(대화에 첨부)과 같은 구조. 위에서 아래로:

1. **헤더** — 안전 영역 아래 "SceneNote" 워드마크, 그 아래 알약형 검색창("작품·배우 검색"). 누르면 `/search`.
2. **최근 핀** — 제목 + "전체 보기 ›". 모바일 1열, 넓은 화면 2~3열이 **콘텐츠 폭 전체**를 채운다. 같은 행의 카드 높이는 같다.
3. **이어보기**(기존 "보는 중") — 포스터 중심 타일 격자. 포스터 위에 새 회차/공개 예정 배지, 포스터 하단에 진행 막대, 아래에 제목 2줄 고정, 진행 캡션, 알약형 "▶ 13화" 버튼. 모든 타일 높이가 같다.
4. **곧 방영 시작** — 같은 포스터 타일을 가로 스크롤로.
5. 하단 "SceneNote / 작품 검색" 블록 **삭제**(헤더로 이동).
6. **하단 탭** — 선택된 탭 아이콘 뒤에 알약 배경(Material 3 방식), 라벨 아래 선 제거, 넓은 화면에서는 가운데 640pt 안에 모은다.

모든 섹션은 **하나의 콘텐츠 컨테이너**(최대 1200pt, 가운데 정렬, 좌우 여백 16/24) 안에 있어 왼쪽 시작선이 하나다.

---

## 3. 설계 결정

### D-1. 좌우 여백과 격자는 순수 함수 하나가 정한다
`getHomeLayout(width)`이 여백·열 수·타일 폭을 모두 계산한다. 화면 코드는 숫자를 직접 쓰지 않는다. 섹션마다 따로 padding을 주지 않고 **콘텐츠 컨테이너 한 곳**에만 좌우 여백을 준다(가로 스크롤 레일만 예외: 레일 자체는 컨테이너 밖으로 나가고 `contentContainerStyle`의 좌우 padding을 여백과 같게 한다).

### D-2. 디자인 토큰은 추가 위주, 기존 값 변경은 둘뿐
- `radius`는 전역 상향: `sm 6→8`, `md 8→12`, `lg 12→16`, 추가 `xl 20`, `pill 999`. 모서리는 레이아웃에 영향이 없어 57개 사용처에 안전하게 전파된다.
- `colors.background` `#FAFAFB → #F6F7F9`, `colors.border` `#DFE3E8 → #E5E7EB`(흰 카드가 배경에서 더 잘 보이게). 추가 `textSubtle: "#9CA3AF"`.
- 새 토큰 `typography`, `elevation`. 기존 화면의 글자 굵기는 **이번에 바꾸지 않는다**(2단계).
- `src/constants/theme.ts`는 계속 **import 없는 순수 상수 파일**로 둔다(유틸 테스트가 가져와도 깨지지 않게).

### D-3. 홈 전용 새 컴포넌트를 만들고 `ContentCard`는 건드리지 않는다
`ContentCard`는 라이브러리 "자세히 보기"에서 쓰며 그 화면에는 장르·출연·리뷰 정보가 필요하다. 홈은 새 `ContinueWatchingTile`을 쓴다.

### D-4. 이어보기 타일의 표시 내용은 순수 함수가 정한다
`createContinueTileModel(item, airing)`이 제목·배지·진행률·캡션·버튼을 결정한다. 버튼의 동작과 접근성 문구는 기존 `createContinueWatchingLabel`(`src/utils/continueWatching.ts`)에서 그대로 가져온다 — 이어보기 규칙(`docs/12`)을 새로 정의하지 않는다. 화면에 보이는 버튼 글자만 짧게 만든다.

### D-5. 타일·카드 높이는 같은 행에서 같다
- 이어보기 타일: 제목 2줄 높이 고정, 캡션 1줄 고정, 버튼 자리 고정(버튼이 없으면 같은 높이의 빈 View).
- 최근 핀 카드: 행 안에서 늘어난다(셀 `alignSelf: "stretch"`, 카드 `flexGrow: 1`). 메모는 최대 2줄.

### D-6. 터치 영역 44pt(`docs/19` M-05)를 지킨다
작은 알약 버튼은 시각 높이 32 + `hitSlop` 상하 6. "전체 보기", 검색창, 하단 탭은 44 이상.

### D-7. 홈 섹션 순서는 유지한다
최근 핀 → 이어보기 → 곧 방영 시작(`docs/19` M-10 이후의 현재 순서). "보는 중"이라는 제목만 "이어보기"로 바꾼다. "전체 보기"의 이동 대상(`/pins`, `/library?status=watching`)과 카드별 이동 파라미터는 **지금과 동일**하다.

### D-8. 핀이 0개일 때 안내 카드를 보여준다
행동 버튼 없이 한 줄 제목과 한 줄 설명만. 로딩 중이거나 오류일 때는 보여주지 않는다.

### D-9. 기능·데이터 흐름은 바꾸지 않는다
쿼리 훅(`useLibrary`, `useAllPins`, `useUpcomingAiring`, `useAiringAvailability`), 스포일러 가림·재진입 시 재가림, 라우팅 파라미터는 그대로다. 이번 작업은 **보이는 모습**만 바꾼다.

### D-10. `docs/31` U-3과 충돌하지 않게 한다
`RecentPinCard`의 회차 라벨은 `docs/31` U-3이 이미 적용되어 `src/utils/pinLabels.ts`의 `formatPinEpisodeLabel`이 있으면 `formatPinEpisodeLabel(pin, { includeTitle: false })`를, 없으면 현재 식(`pin.episode_number ? \`${pin.episode_number}화\` : null`)을 그대로 쓴다. 이 작업이 `pinLabels.ts`를 새로 만들지 않는다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

---

## 4. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| 앱 전체 화면을 한 번에 개편 | 검증할 수 없는 변경이 너무 크다. 1단계는 토큰·공통 크롬·홈, 2단계에서 라이브러리·핀·상세를 같은 토큰으로 옮긴다 |
| `ContentCard`를 고쳐 홈과 라이브러리 공용으로 | 라이브러리에 필요한 정보(장르·출연·리뷰)를 잃거나, 홈이 다시 복잡해진다(D-3) |
| 이어보기를 모든 폭에서 가로 스크롤 레일로 | 웹에서 마우스로 가로 스크롤이 불편하고, 한 번에 보이는 수가 폭마다 들쭉날쭉하다. 격자 + "전체 보기"가 예측 가능하다. 곧 방영은 항목 수가 적어 레일 유지 |
| `Platform.select`로 iOS `shadow*` / Android `elevation` 분기 | `theme.ts`가 `react-native`를 import하게 되어 순수 상수 파일이 아니게 된다. RN 0.81(New Architecture) + react-native-web 0.21이 `boxShadow` 문자열을 지원하므로 그것 하나로 쓴다 |
| 목업의 상단 알림(종) 아이콘 구현 | 알림 기능이 없다. 목업 장식일 뿐 |
| 글꼴 교체(Pretendard 등) | 폰트 로딩·번들 크기·네이티브 설정이 필요하다. 시스템 폰트 + 굵기·자간 조정으로 충분히 현대적으로 보인다. 별도 검토 |
| 다크 모드 | `app.config.ts`가 `userInterfaceStyle: "light"` 고정. 토큰 정비 이후 별도 작업 |

---

## 5. 계약

### 5.1 `src/constants/theme.ts` (import 없음)
```ts
export const colors = {
  background: "#F6F7F9",   // 변경
  surface: "#FFFFFF",
  surfaceMuted: "#F1F3F5",
  text: "#171717",
  textMuted: "#6B7280",
  textSubtle: "#9CA3AF",   // 추가
  border: "#E5E7EB",       // 변경
  primary: "#2563EB",
  primarySoft: "#DBEAFE",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  success: "#047857",
  successSoft: "#D1FAE5",
  warning: "#B45309",
  warningSoft: "#FEF3C7",
  overlay: "rgba(23, 23, 23, 0.48)"
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const; // 변경 없음

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const typography = {
  display: { fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.5 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.3 },
  headline: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "600" }
} as const;

export const elevation = {
  card: { boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.06), 0px 1px 3px rgba(16, 24, 40, 0.08)" },
  bar: { boxShadow: "0px -1px 0px rgba(16, 24, 40, 0.06)" }
} as const;
```

### 5.2 `src/utils/homeLayout.ts`
```ts
export const HOME_CONTENT_MAX_WIDTH = 1200;

export interface HomeLayout {
  gutter: number;
  contentWidth: number;
  posterColumns: number;
  posterGap: number;
  posterWidth: number;
  pinColumns: number;
  pinWidth: number;
  continueLimit: number;
  railTileWidth: number;
}

export function getHomeLayout(width: number): HomeLayout;
```
판정 순서:
1. `w = Number.isFinite(width) && width > 0 ? width : 375`
2. 구간
   | 구간 | gutter | posterGap | posterColumns | pinColumns | 행 수 | railTileWidth |
   |------|--------|-----------|---------------|------------|-------|---------------|
   | `w < 600` | 16 | 12 | 3 | 1 | 2 | 120 |
   | `600 ≤ w < 960` | 24 | 16 | 4 | 2 | 1 | 148 |
   | `960 ≤ w < 1280` | 24 | 16 | 5 | 3 | 1 | 148 |
   | `w ≥ 1280` | 24 | 16 | 6 | 3 | 1 | 148 |
3. `contentWidth = Math.min(w, HOME_CONTENT_MAX_WIDTH) - gutter * 2`
4. `posterWidth = Math.floor((contentWidth - posterGap * (posterColumns - 1)) / posterColumns)`
5. `pinWidth = Math.floor((contentWidth - posterGap * (pinColumns - 1)) / pinColumns)` (핀 격자 간격 = posterGap)
6. `continueLimit = posterColumns * 행 수`

### 5.3 `src/utils/continueTile.ts`
```ts
import type { LibraryListItem } from "@/types/library";
import { createContinueWatchingLabel } from "./continueWatching";

export type ContinueTileSource = Pick<
  LibraryListItem,
  | "title_primary" | "content_type" | "episode_count" | "statuses" | "watched_episode_count"
  | "progress_source" | "effective_watched_through" | "next_episode_number"
>;

export interface ContinueTileModel {
  title: string;
  badge: { tone: "new" | "upcoming"; text: string } | null;
  progress: number | null;          // 0~1
  caption: string | null;
  cta: {
    text: string;
    icon: "play" | "flag" | "check";
    action: "open_episodes" | "open_progress_setting";
    accessibilityLabel: string;
  } | null;
}

export function createContinueTileModel(
  item: ContinueTileSource,
  airing: { availableCount: number; upcomingLabel: string | null }
): ContinueTileModel;
```
판정 순서:
1. `title = item.title_primary` — 시즌을 덧붙이지 않는다(`title_primary`는 이미 `createSeasonDisplayTitle` 결과, `src/services/library.ts:551`).
2. `badge`
   - `airing.availableCount > 0` → `{ tone: "new", text: \`새 회차 ${n}\` }`
   - 아니면 `airing.upcomingLabel?.trim()`이 있으면 `{ tone: "upcoming", text }`. 단 `/^\d{2}\.(\d{2})\.(\d{2}) 공개 예정$/`에 맞으면 `\`${mm}.${dd} 공개\``로 줄인다(`formatUpcomingEpisodeDate` 출력 "26.10.01 공개 예정" → "10.01 공개").
   - 둘 다 없으면 `null`
3. `label = createContinueWatchingLabel(item)`. `null`이면 `progress`, `caption`, `cta` 모두 `null`로 반환.
4. `watched = Math.max(0, item.effective_watched_through)`, `total = item.episode_count`
5. 분기 (위에서부터 첫 해당):
   | 조건 | cta.text | cta.icon | progress | caption |
   |------|----------|----------|----------|---------|
   | `item.progress_source === "none"` | `"위치 설정"` | `"flag"` | `null` | `null` |
   | `watched === 0` | `"1화"` | `"play"` | `total !== null ? 0 : null` | `total !== null ? \`총 ${total}화\` : null` |
   | `total !== null && watched >= total` | `"다 봤어요"` | `"check"` | `1` | `\`${total}/${total}화\`` |
   | 그 외 | `\`${item.next_episode_number ?? watched + 1}화\`` | `"play"` | `total !== null && total > 0 ? Math.min(1, watched / total) : null` | `total !== null ? \`${watched}/${total}화\` : \`${watched}화까지 봄\`` |
6. `cta.action = label.action`, `cta.accessibilityLabel = label.accessibilityLabel`

---

## 6. 화면 명세

### 6.1 `app/(tabs)/_layout.tsx`
`index` 화면 옵션에 `headerShown: false`. 다른 탭은 변경 없음.

### 6.2 `app/(tabs)/index.tsx` 구조
```
ScrollView (bg colors.background, contentContainerStyle paddingBottom 32)
└ View 콘텐츠 컨테이너  width "100%", maxWidth 1200, alignSelf "center", paddingHorizontal layout.gutter
   ├ HomeHeader            paddingTop insets.top + 12
   │   ├ "SceneNote"        typography.display, color text
   │   └ 검색 버튼          marginTop 12, height 48, radius.pill, bg surface, border hairline colors.border,
   │                        row: Ionicons "search" 18 textMuted + "작품·배우 검색" (typography.body, textMuted)
   │                        accessibilityRole "button", accessibilityLabel "작품 검색 열기", onPress → router.push("/search")
   ├ [pins.isError] ErrorState (기존 문구 유지)
   ├ 최근 핀 섹션 (핀 ≥ 1)    SectionHeader "최근 핀" + "전체 보기" → router.push("/pins")
   │   └ 행 wrap 격자: gap layout.posterGap, 셀 width layout.pinWidth, alignSelf "stretch"
   │       └ RecentPinCard (최대 3개, 기존 props 그대로)
   ├ 핀 안내 카드 (핀 0개 && !pins.isLoading && !pins.isError)  D-8
   ├ 이어보기 섹션           SectionHeader "이어보기" + "전체 보기" → router.push({ pathname: "/library", params: { status: "watching" } })
   │   ├ library.isLoading → LoadingSkeleton count 2 (기존)
   │   ├ library.isError → ErrorState (기존)
   │   ├ 항목 있음 → 행 wrap 격자: gap layout.posterGap, 타일 width layout.posterWidth
   │   │   └ ContinueWatchingTile × min(보는 중 수, layout.continueLimit)
   │   └ 항목 없음 → EmptyState (기존 문구·행동 유지)
   └ 곧 방영 시작 (항목 ≥ 1)  SectionHeader "곧 방영 시작" (액션 없음)
       └ 가로 ScrollView: marginHorizontal -layout.gutter, contentContainerStyle { paddingHorizontal: layout.gutter, gap: 12 }
           └ PosterTile width layout.railTileWidth
```
- `const layout = getHomeLayout(width)`. `galleryColumns`, `galleryCardWidth`, `recentPinColumns`, `recentPinCardWidth` 변수 삭제.
- 보는 중 목록: `(library.data ?? []).filter((item) => item.statuses.includes("watching")).slice(0, layout.continueLimit)`
- 기존 `hero` 블록과 관련 스타일(`hero`, `title`, `subtitle`, `searchButton`, `searchText`) 삭제.
- 스포일러 atom, `useFocusEffect` 재가림, 각 카드의 `router.push` 파라미터는 **글자 하나 바꾸지 않고** 옮긴다.

**SectionHeader** (파일 내부 함수, 기존 것 교체): row, `alignItems: "center"`, `justifyContent: "space-between"`, `marginTop: 28`, `marginBottom: 12`, 좌우 padding 없음. 제목 `typography.title`. 액션은 `Pressable` minHeight 44, row, `alignItems: "center"`, gap 2: `Text`(typography.label, color primary) + `Ionicons "chevron-forward"` 16 primary. `eyebrow` prop 삭제.

**핀 안내 카드**: bg `colors.surface`, border hairline `colors.border`, `radius.lg`, padding 16, row gap 12: `Ionicons "pin-outline"` 22 primary / 텍스트 열: "첫 장면을 핀으로 남겨보세요"(typography.headline) + "이어보기에서 회차를 고르고 시간과 메모를 남기면 여기에 모여요."(typography.body, textMuted).

### 6.3 `src/components/home/PosterTile.tsx` (신규)
```ts
interface PosterTileProps {
  title: string;
  posterUrl: string | null;
  width: number;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: { tone: "new" | "upcoming" | "today"; text: string } | null;
  progress?: number | null;     // 0~1
  caption?: string | null;
  footer?: React.ReactNode;     // 이어보기 버튼 자리
}
```
- 루트 `View` width `width`.
- 위쪽 `Pressable`(onPress, accessibilityRole "button", accessibilityLabel):
  - 포스터 컨테이너: `width: "100%"`, `aspectRatio: 2 / 3`, `borderRadius: radius.md`, `overflow: "hidden"`, bg surfaceMuted, `...elevation.card`. 안에 `AppImage` `StyleSheet.absoluteFill`, `contentFit="cover"`.
  - 배지(있으면): absolute top 6 left 6, `radius.pill`, paddingH 6, paddingV 2, `typography.micro`. tone별 색: `new` = bg successSoft / 글자 success, `upcoming` = bg `rgba(255,255,255,0.92)` / 글자 text, `today` = bg primary / 글자 surface. `numberOfLines={1}`.
  - 진행 막대(`progress != null`): absolute left 0 right 0 bottom 0, height 4, bg `rgba(255,255,255,0.35)`; 안쪽 채움 width `${Math.round(progress * 100)}%`, bg `#FFFFFF`. 접근성 숨김.
  - 제목: marginTop 8, `typography.label`, color text, `numberOfLines={2}`, **height 36**(18×2, 줄 수와 무관하게 고정).
  - 캡션: `typography.caption`, color textSubtle, `numberOfLines={1}`, **height 16**(없으면 빈 줄 유지).
- `footer`가 있으면 marginTop 8에 렌더.

### 6.4 `src/components/home/ContinueWatchingTile.tsx` (신규)
```ts
interface ContinueWatchingTileProps {
  item: LibraryListItem;
  width: number;
  onPress: () => void;
  onOpenEpisodes: () => void;
  onOpenProgressSetting: () => void;
}
```
- `const airing = useAiringAvailability(item); const model = createContinueTileModel(item, airing);`
- `PosterTile`에 `title`, `posterUrl: item.poster_url`, `badge: model.badge`, `progress: model.progress`, `caption: model.caption`, `accessibilityLabel: \`${model.title} 상세 보기\``.
- `footer`:
  - `model.cta`가 있으면 알약 버튼: height 32, `radius.pill`, border hairline `colors.border`, bg surface, row center gap 4, `hitSlop={{ top: 6, bottom: 6 }}`. 아이콘 `Ionicons` (`play` → "play", `flag` → "flag-outline", `check` → "checkmark"), 13, primary. 글자 `typography.label`, primary, `numberOfLines={1}`. `accessibilityRole="button"`, `accessibilityLabel={\`${model.title} ${model.cta.accessibilityLabel}\`}`. `onPress` = `action === "open_progress_setting" ? onOpenProgressSetting : onOpenEpisodes`.
  - 없으면 `<View style={{ height: 32 }} />` (D-5).
- 홈에서의 콜백은 현재 `index.tsx` 88~90행의 세 `router.push`를 그대로 넘긴다.

### 6.5 곧 방영 시작 타일 (홈 내부)
`PosterTile` 사용: `badge` = `isAiringToday(item.air_date) ? { tone: "today", text: "오늘" } : { tone: "upcoming", text: formatUpcomingAiringLabel(item.air_date) }`(빈 문자열이면 `null`), `caption` = `WATCH_STATUS_LABEL[upcomingBadgeStatus(item)]`, `onPress` = 기존 `onPressItem`. `WatchStatusBadge` import는 홈에서 제거.

### 6.6 `src/components/pins/RecentPinCard.tsx` (props·동작 불변, 스타일만)
| 요소 | 변경 후 |
|------|---------|
| card | `radius.lg`, padding 12, gap 12, border hairline `colors.border`, bg surface, `...elevation.card`, `minHeight: 108`, `flexGrow: 1` |
| poster | 52 × 78, `radius.sm` |
| title | `typography.headline`, `numberOfLines={1}` |
| emotion | bg primarySoft, color primary, `typography.micro`, `radius.pill`, paddingH 8, paddingV 3 |
| episode label | `typography.caption`, textMuted |
| time | 칩: bg primarySoft, color primary, `fontSize 12`, `fontWeight "700"`, `fontVariant ["tabular-nums"]`, `borderRadius 6`, paddingH 6, paddingV 2 |
| memo | `typography.body`, color text, `numberOfLines={2}` |
| date | `typography.caption`, textSubtle, `marginTop: "auto"` |
| spoiler | `radius.md` (나머지 유지) |
회차 라벨 식은 D-10.

### 6.7 `app/_layout.tsx` `GlobalBottomNav` (동작 불변, 스타일만)
- 바깥 `View`(기존 `styles.bottomNav`): bg surface, borderTop hairline `colors.border`, `...elevation.bar`, paddingTop 6, 기존 safe-area padding 유지. `flexDirection`을 `"column"`으로 바꾸고 안에 행 `View`를 둔다.
- 행 `View`: `flexDirection: "row"`, `width: "100%"`, `maxWidth: 640`, `alignSelf: "center"`.
- `navItem`: 기존 유지하되 `paddingVertical: 4`, `gap: 2`, `borderRadius: radius.md`.
- 아이콘 래퍼 `View` 신규: width 56, height 32, `radius.pill`, center. 선택 시 bg `colors.primarySoft`.
- `navActiveIndicator` 요소와 스타일 **삭제**.
- 라벨: `typography.micro` 기반, 비선택 color `colors.textMuted`(기존 `"#64748B"` 대체), 선택 color primary + `fontWeight "700"`. 아이콘 색도 비선택 `colors.textMuted`.
- `accessibilityLabel`, `accessibilityState`, `aria-current`, hover/focus 스타일, `router.replace` 그대로.

---

## 7. 엣지 케이스

| # | 상황 | 기대 동작 |
|---|------|-----------|
| E-1 | 폭 320 | 이어보기 3열(타일 88), 핀 1열, 가로 스크롤 없음 (T-2) |
| E-2 | 폭 1440 이상 | 콘텐츠 1200 가운데, 6열 (T-6) |
| E-3 | 폭 0·NaN(초기 측정 전) | 375 기준 레이아웃 (T-7) |
| E-4 | 제목 1줄/2줄 타일이 같은 행 | 높이 같음 (제목 높이 36 고정) |
| E-5 | 영화가 "보는 중" | 버튼 없음, 32 빈 자리 (C-10) |
| E-6 | 시청 위치 미설정 | "위치 설정" 버튼 → 진행 위치 설정 화면 (C-6) |
| E-7 | 새 회차와 공개 예정이 동시에 | 새 회차 배지 우선 (C-5) |
| E-8 | 공개 예정 문구가 형식과 다름("내일") | 그대로 표시 (C-4) |
| E-9 | 회차 수 모름 | 진행 막대 없음, "N화까지 봄" (C-9) |
| E-10 | 시즌 등록 항목 | 제목에 시즌 중복 없음 (C-13) |
| E-11 | 핀 0개, 로딩 완료, 오류 없음 | 안내 카드 |
| E-12 | 핀 조회 오류 + 캐시 있음 | ErrorState + 캐시 카드 (기존 동작 유지) |
| E-13 | 스포일러 핀 | 가림 → 탭하면 공개, 홈 이탈 후 재진입 시 다시 가림 (기존) |
| E-14 | 곧 방영 없음 | 섹션 숨김 (기존) |
| E-15 | 포스터 없음 | AppImage 플레이스홀더(surfaceMuted) 위에 배지·진행 막대 정상 |

---

## 8. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** `node:test` + `node:assert/strict`, util 옆 `*.test.ts`.

### `src/utils/homeLayout.test.ts`
| ID | 입력 width | 기대 (전체 필드 `deepEqual`) |
|----|-----------|------|
| T-1 | 375 | gutter 16, contentWidth 343, posterColumns 3, posterGap 12, posterWidth 106, pinColumns 1, pinWidth 343, continueLimit 6, railTileWidth 120 |
| T-2 | 320 | gutter 16, contentWidth 288, posterColumns 3, posterGap 12, posterWidth 88, pinColumns 1, pinWidth 288, continueLimit 6, railTileWidth 120 |
| T-3 | 599 | gutter 16, contentWidth 567, posterColumns 3, posterGap 12, posterWidth 181, pinColumns 1, pinWidth 567, continueLimit 6, railTileWidth 120 |
| T-4 | 600 | gutter 24, contentWidth 552, posterColumns 4, posterGap 16, posterWidth 126, pinColumns 2, pinWidth 268, continueLimit 4, railTileWidth 148 |
| T-5 | 1024 | gutter 24, contentWidth 976, posterColumns 5, posterGap 16, posterWidth 182, pinColumns 3, pinWidth 314, continueLimit 5, railTileWidth 148 |
| T-6 | 1440 | gutter 24, contentWidth 1152, posterColumns 6, posterGap 16, posterWidth 178, pinColumns 3, pinWidth 373, continueLimit 6, railTileWidth 148 |
| T-7 | 0 / `NaN` / -10 | 셋 다 T-1과 같음 |
| T-8 | 959 / 960 | posterColumns 4, pinColumns 2 / posterColumns 5, pinColumns 3 |
| T-9 | 1279 / 1280 | posterColumns 5 / posterColumns 6 |

### `src/utils/continueTile.test.ts`
기본 item: `{ title_primary: "도굴왕", content_type: "anime", episode_count: 12, statuses: ["watching"], watched_episode_count: 11, progress_source: "episode_progress", effective_watched_through: 11, next_episode_number: 12 }`, 기본 airing `{ availableCount: 0, upcomingLabel: null }`.

| ID | 변경 | 기대 |
|----|------|------|
| C-1 | 기본 | title "도굴왕", badge null, progress `11 / 12`, caption "11/12화", cta `{ text: "12화", icon: "play", action: "open_episodes", accessibilityLabel: "12화 중 11화까지 시청했습니다. 다음은 12화입니다." }` |
| C-2 | airing.availableCount 3 | badge `{ tone: "new", text: "새 회차 3" }` |
| C-3 | airing.upcomingLabel "26.10.01 공개 예정" | badge `{ tone: "upcoming", text: "10.01 공개" }` |
| C-4 | airing.upcomingLabel "내일" | badge `{ tone: "upcoming", text: "내일" }` |
| C-5 | availableCount 2 + upcomingLabel "26.10.01 공개 예정" | badge `{ tone: "new", text: "새 회차 2" }` |
| C-6 | progress_source "none" | cta.text "위치 설정", icon "flag", action "open_progress_setting", progress null, caption null |
| C-7 | effective 0, next 1 | cta.text "1화", icon "play", progress 0, caption "총 12화" |
| C-8 | effective 12, next null | cta.text "다 봤어요", icon "check", progress 1, caption "12/12화" |
| C-9 | episode_count null, effective 5, next 6 | cta.text "6화", progress null, caption "5화까지 봄" |
| C-10 | content_type "movie" | cta null, progress null, caption null |
| C-11 | statuses ["wishlist"] | cta null, progress null, caption null |
| C-12 | effective 15 (total 12) | cta.text "다 봤어요", progress 1, caption "12/12화" |
| C-13 | title_primary "진격의 거인 시즌 3" | title "진격의 거인 시즌 3" (덧붙임 없음) |
| C-14 | airing.upcomingLabel "  " | badge null |

### 수동 확인 (웹 8081, 로그인 필요 — 불가하면 "미검증"으로 보고)
| ID | 폭 | 확인 |
|----|----|------|
| M-1 | 375 | 헤더 검색창·섹션 제목·카드·타일의 왼쪽 시작선이 한 줄. 이어보기 3열 × 최대 2행 |
| M-2 | 1440 | 콘텐츠 1200 가운데, 최근 핀 3열이 콘텐츠 폭 전체, 이어보기 6열 1행, 하단 탭 가운데 640 |
| M-3 | 모든 폭 | "전체 보기"가 제목과 세로 중앙 정렬 |
| M-4 | 모든 폭 | 같은 행의 이어보기 타일 하단선 일치 |
| M-5 | 375 | 타일 버튼 탭 → 회차 목록(또는 위치 설정), 포스터 탭 → 작품 상세 |
| M-6 | 375 | 하단 탭 선택 알약, 라벨 밑줄 없음 |
| M-7 | 375 | 스포일러 핀 가림·공개·재진입 재가림 |

---

## 9. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/constants/theme.ts` | 5.1 (색 2개 변경·1개 추가, radius 상향·추가, typography·elevation 추가) |
| `src/utils/homeLayout.ts` (+test) | 신규 5.2 |
| `src/utils/continueTile.ts` (+test) | 신규 5.3 |
| `src/components/home/PosterTile.tsx` | 신규 6.3 |
| `src/components/home/ContinueWatchingTile.tsx` | 신규 6.4 |
| `app/(tabs)/index.tsx` | 6.2, 6.5 |
| `app/(tabs)/_layout.tsx` | 6.1 (한 줄) |
| `src/components/pins/RecentPinCard.tsx` | 6.6 스타일 |
| `app/_layout.tsx` | 6.7 `GlobalBottomNav`와 해당 스타일만 |

## 10. 범위 밖 (2단계 이후)

| 항목 | 이유 |
|------|------|
| 라이브러리·핀·검색·상세·프로필 화면의 글자 굵기·카드 스타일 | 2단계. 이번에는 radius·배경·테두리 토큰 변경만 자동 전파 |
| 다른 탭의 기본 헤더 모양 | 2단계에서 탭 공통 헤더로 통일 |
| `ContentCard`의 시즌 제목 중복(`title_primary`에 이미 "시즌 N"이 있는데 `· 시즌 N`을 또 붙임, `ContentCard.tsx:51`) | 라이브러리 화면 결함. 홈은 새 타일이라 영향 없음. 별도 수정 |
| 폰트 교체, 다크 모드, 알림 | 4장 |
| `docs/31` U-1~U-11 | 별도 작업. D-10만 조율 |

## 11. 확실하지 않음 — 별도 검증 필요

1. **`boxShadow` 지원**: RN 0.81 New Architecture(`newArchEnabled: true`)와 react-native-web 0.21에서 문자열 `boxShadow`가 동작한다고 판단했으나 이 저장소에서 실행 확인하지 않았다. Android 9 미만은 그림자 없이 테두리만 보일 수 있다(기능 영향 없음).
2. **wrap 격자의 행 높이 늘림**: Yoga의 `flexWrap: "wrap"` + `alignItems: "stretch"`로 같은 행의 핀 카드 높이가 맞는다고 판단. 웹·네이티브 실측 필요(M-4와 같은 방식으로 확인).
3. **전역 radius 상향의 시각 영향**: 57개 파일이 radius 토큰을 쓴다. 레이아웃은 바뀌지 않지만, 작은 칩(높이 20 안팎)에서 `radius.sm 8`이 알약처럼 보일 수 있다. 2단계 전 주요 화면을 한 번 훑어본다.
