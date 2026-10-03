# 39. 작품 상세 SaaS 스타일 개편 명세

작성일: 2026-10-03
대상 브랜치 기준: `main` (`b9a67cd`) + 미커밋 1건(`app/content/[id].tsx` 355행: 진행 저장 후 "보는 중" 제안을 확인 없이 바로 적용). 이 시점 `npm test` 813개 중 812개 통과 — 실패 1개는 무관한 기존 결함(12장)
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙 — 이 명세는 그 규칙을 전제로 다른 점만 쓴다)**, `docs/32_home_modern_redesign_spec.md`(토큰·컨테이너), `docs/36`·`docs/37`(SaaS 카드·`DashboardPanel`·`confirmDestructive`), `docs/31_usability_review_fixes_spec.md`(U-2 삭제 확인, U-5 상태 패널 위치 — **미구현, 이 작업이 흡수**), `docs/12_episode_progress_spec.md`(시청 진행), `docs/19_mobile_usability_spec.md`(M-05 44pt)

> **근거.** 사용자가 보낸 작품 상세 캡처(넓은 웹, 등록된 애니 "추방당한 전생 중기사는…")와 `app/content/[id].tsx`(958행)를 대조했다. 로그인 화면을 직접 실측하지는 않았다.
> 사용자 요청: "작품 등록한 UI인데 빈 공간이 많고 효율적으로 한눈에 들어오게끔 SaaS 스타일로".

---

## 1. 문제 정의

| ID | 증상 (캡처 기준) | 코드상 원인 |
|----|-----------------|-------------|
| C-1 | 포스터 하나가 화면 가운데에 있고 양옆이 비어 있다. 제목은 그 아래 왼쪽 끝에서 시작한다 | 포스터 `alignSelf: "center"` 200×300(`[id].tsx:376, 705~712`), 본문은 전체 폭 단일 열(`body` 713행). 콘텐츠 최대 폭 없음 |
| C-2 | "에피소드 보기"·"핀 목록"·"목록" 버튼이 각각 화면 폭 전체를 차지한다 | `actions` 세로 배치 + `primaryButton`/`secondaryButton` `padding: spacing.lg`(396~444, 884~957행) |
| C-3 | 가장 자주 쓰는 "내 목록 상태" 버튼이 줄거리·보러가기·출연진 뒤 **맨 아래**에 있다. 미등록 작품은 "내 목록에 추가"도 맨 아래 | `addPanel`이 본문 끝(546~589행). `docs/31` U-5 미구현 |
| C-4 | "삭제"가 상태 버튼 바로 아래에 있고 **확인 없이** 바로 지워진다 | `removeFromLibrary`(241~251행). `docs/31` U-2 미구현 |
| C-5 | 메타 줄에 "anime"처럼 영문 코드가 그대로 나온다 | `view.contentType`를 그대로 join(380~382행) |
| C-6 | "시청 0회"가 메타 줄과 "본 횟수" 카드에 두 번 나온다. 상태 배지("보는 중")와 상태 버튼도 같은 정보를 두 번 보여준다 | 메타에 `watchCountLabel`(381행), 배지 행(387~393행) + 상태 그리드(551~575행) |
| C-7 | "본 횟수" 카드가 전체 폭이라 입력칸과 "저장" 버튼이 화면 양끝에 떨어져 있다 | `progressSaveButton` `marginLeft: "auto"`(786~793행) |
| C-8 | 웹에서 상태 변경·추가·삭제·진행 저장 실패가 조용히 사라지고, "모든 화를 시청했습니다 → 완료로 표시할까요?" 제안이 뜨지 않는다 | `Alert.alert`(225, 236, 248, 350, 358행). 웹에서 `Alert.alert`는 동작하지 않는다(`docs/31` 5장) |
| C-9 | 글자가 무겁고 홈·인물·프로필과 카드 모양이 다르다 | `fontWeight: "900"` 다수, `typography`·`elevation` 미사용 |
| C-10 | 넓은 화면에서도 모든 카드가 한 줄로 세로로만 쌓여 스크롤이 길다 | 단일 열 |

---

## 2. 목표 모습

넓은 화면(960 이상, 콘텐츠 최대 1200 가운데 정렬):

```
┌ 히어로 카드 (전체 폭) ──────────────────────────────────────────────────────────────┐
│ ┌────────┐  추방당한 전생 중기사는 게임 지식으로 무쌍한다            (display)       │
│ │ 포스터  │  追放された転生重騎士はゲーム知識で無双する              (body, muted)     │
│ │160×240 │  [애니] 2026.07 · 26화                                                   │
│ │        │  [액션] [판타지]                                                          │
│ │        │  내 상태  [보고 싶음 | 보는 중 | 보류 | 완료]   [추천] [비추천]             │
│ │        │  [▶ 에피소드 보기]  [📍 핀 목록 3]  [← 목록으로]                          │
│ └────────┘                                                                         │
└────────────────────────────────────────────────────────────────────────────────────┘
┌ 주 열 (나머지 폭) ─────────────────────────────┐ ┌ 옆 열 360 ───────────────────────┐
│ 시청 진행 (EpisodeProgressCard, 기존 그대로)    │ │ 보러가기 (WatchProviderList)      │
│ 내 감상 (ContentReviewEditor, 기존 그대로)      │ │ 본 횟수  [ 0 ]회  [저장]          │
│ 줄거리 (4줄 + 더보기)                           │ │ 내 목록에서 삭제 (빨간 글자 버튼) │
│ 출연 배우 / 성우 (2열 카드)                     │ │                                  │
└────────────────────────────────────────────────┘ └──────────────────────────────────┘
```

좁은 화면(960 미만): 히어로(포스터 96×144 왼쪽 + 글 오른쪽, 상태·행동은 그 아래 전체 폭) → 시청 진행 → 본 횟수 → 보러가기 → 내 감상 → 줄거리 → 출연 → 삭제.

미등록 작품(검색에서 진입): 히어로의 상태 영역 제목이 "내 목록에 추가", 설명 "상태를 고르면 내 목록에 추가돼요.", 추천/비추천 토글은 숨김. 행동 버튼 줄은 지금처럼 숨김(DB에 없는 작품이라 에피소드·핀 경로가 없다). 아래는 보러가기·줄거리·출연만.

---

## 3. 재현 시나리오

1. 웹 8081, 폭 1440, 로그인 → 라이브러리 → 등록된 시리즈 작품 상세.
2. 포스터가 가운데, 버튼 3개가 전체 폭, 상태 버튼이 맨 아래 → C-1~C-3.
3. 메타 줄 "anime" → C-5.
4. 맨 아래 "삭제" 클릭 → 확인 없이 라이브러리로 이동, 작품 사라짐 → C-4.
5. 시청 진행에서 마지막 화까지 저장 → 웹에서 "완료로 표시할까요?"가 뜨지 않음 → C-8.

---

## 4. 설계 결정

### D-1. 같은 토큰·컨테이너·카드
- `colors`·`radius`·`typography`·`elevation`만. 새·수정 파일에 16진 색·`fontWeight` 숫자 문자열 금지.
- 콘텐츠는 `HOME_CONTENT_MAX_WIDTH`(1200) 가운데 컨테이너, 좌우 여백은 `getHomeLayout`과 같다.
- 섹션 카드는 기존 `src/components/profile/DashboardPanel.tsx`를 그대로 재사용한다(제목·부제·오른쪽 accessory·폭). 이동·수정하지 않는다.

### D-2. 넓은 화면은 "히어로 + 2열"
- 960 이상: 히어로(전체 폭) 아래 주 열(나머지)과 옆 열(360)을 나란히. 960 미만: 한 열.
- 폭·열·포스터 크기는 순수 함수 `getContentDetailLayout(width)`가 정한다. 섹션 배치는 `contentDetailSections(...)`가 정한다(화면에 순서를 하드코딩하지 않는다).

### D-3. 상태 변경은 히어로 안으로 (U-5)
- 히어로에 `WatchStatusControl`: 주 상태 4개(보고 싶음·보는 중·보류·완료)는 하나만 고르는 세그먼트 모양, 추천·비추천은 켜고 끄는 토글 칩.
- 판정 로직은 지금 화면 안의 `createNextWatchStatuses`·`areSameWatchStatuses`를 **동작 그대로** `src/utils/watchStatusSelection.ts`로 옮겨 테스트한다.
- 미등록이면 주 상태 4개만 보이고 누르면 그 상태로 추가(지금 `toggleStatus`의 추가 분기 그대로).
- 상태 배지 행(387~393행)은 지운다(같은 정보가 세그먼트에 보인다).

### D-4. 삭제는 옆 열 맨 아래 + 확인 (U-2)
- "내 목록에서 삭제" 빨간 글자 버튼(채움 없음). 누르면 `confirmDestructive`(docs/37 형태: `{ title, message, confirmLabel, onConfirm }`)에 `docs/31` 6.7의 문구를 그대로 쓴다(`createLibraryDeleteConfirmCopy`, 이번에 구현).
- 성공 토스트 "내 목록에서 삭제했어요." 후 기존 `openLibraryList()`. 실패 토스트 `error.message || "삭제하지 못했어요."`.

### D-5. 행동 버튼은 내용 폭, 한 줄
"에피소드 보기"(영화는 "영화 핀 추가") primary 알약, "핀 목록"(핀 수가 있으면 `핀 목록 3`) secondary, "목록으로" ghost. 높이 44, 내용 폭, 줄바꿈 허용. 이동 경로·파라미터는 지금과 **완전히 같다**.

### D-6. 메타는 한국어, 중복 제거
- 메타 = `[유형 한국어 라벨, 방영일 라벨, 화수 라벨]`(`createContentDetailMetaItems`). 유형 라벨은 `CONTENT_TYPE_LABELS`(애니·한국 드라마·일본 드라마·영화·기타). 첫 항목은 배지 모양.
- "시청 N회"는 메타에서 빼고 "본 횟수" 카드에만.

### D-7. 웹에서도 보이는 피드백
화면 안 `Alert.alert` 5곳을 토스트로:
- 상태 변경 실패 `상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.`, 추가 실패 `내 목록에 추가하지 못했어요. 잠시 후 다시 시도해 주세요.`, 진행 저장 실패 `시청 진행을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.`(모두 `"error"`). 오류 원문은 넣지 않는다.
- "모든 화를 시청했습니다" 제안 → `addToast("모든 화를 봤어요. 완료로 표시할까요?", "info", { actionLabel: "완료로 표시", onAction: () => toggleStatus("completed"), durationMs: 8000 })`.
- 미커밋 변경(진행 저장 후 `mark_watching`이면 확인 없이 `toggleStatus("watching")`)은 **그대로 유지**한다.

### D-8. 하위 카드 내부는 바꾸지 않는다
`EpisodeProgressCard`, `ContentReviewEditor`, `WatchProviderList`, `GenreBadgeList`의 내부·props는 그대로 쓰고 배치만 바꾼다(각자 카드 모양을 가진다. 내부 통일은 후속 단계). "본 횟수"는 화면 안 `WatchCountInput`을 `src/components/content/WatchCountCard.tsx`로 옮겨 `DashboardPanel` 안의 한 줄 폼으로 바꾸되 저장 판정(`resolveWatchCountSaveState`·`describeWatchCountSaveState`)은 그대로.

### D-9. 홈의 "진행 설정" 진입(`focus=progress`)은 2열에서도 정확히 스크롤
시청 진행 카드의 스크롤 위치 = (2열/1열 컨테이너의 `onLayout` y) + (카드가 속한 열 안에서의 `onLayout` y). 하이라이트 1.5초는 그대로.

### D-10. 데이터·이동은 바꾸지 않는다
쿼리 훅·mutation·라우팅 파라미터·`resolveContentLibraryItem`·외부 상세 병합(`rawView`)·`normalizeContentTypeFromCast`·출연진 등록/이동 동작은 그대로. DB·Edge Function 변경 없음.

---

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 포스터를 크게 배경으로 깔고 위에 글씨(넷플릭스형 히어로) | 포스터 화질·명도가 제각각이라 글자 대비를 보장할 수 없다. 다크 모드도 없다 |
| 상태 6개를 한 줄 버튼 6개로 | 주 상태는 하나만, 추천·비추천은 겹칠 수 있다는 규칙이 화면에 드러나지 않는다 |
| 삭제를 "⋯" 메뉴로 | 메뉴 컴포넌트가 없어 새로 만들어야 한다. 옆 열 맨 아래 + 확인이면 오탭 위험이 충분히 낮다 |
| 하위 카드(시청 진행·내 감상)도 이번에 `DashboardPanel`로 통일 | 575·548행 컴포넌트를 함께 고치면 검증 범위가 너무 커진다(D-8) |
| 3열(정보·진행·보러가기) | 1200 폭에서 각 열이 좁아 진행 카드 입력이 답답하다 |
| 줄거리를 히어로에 | 히어로 높이가 작품마다 크게 달라진다 |

---

## 6. 계약

### 6.1 `src/utils/contentDetailView.ts` (신규, 순수)

```ts
import type { ContentType } from "@/types/content";
import type { WatchStatus } from "@/types/library";
import { WATCH_STATUS_LABEL } from "@/constants/status";
import { getHomeLayout } from "@/utils/homeLayout";
import { CONTENT_TYPE_LABELS } from "@/utils/libraryFilters";

export const CONTENT_DETAIL_SIDE_WIDTH = 360;
export const PRIMARY_WATCH_STATUSES: readonly WatchStatus[] = ["wishlist", "watching", "dropped", "completed"];
export const SECONDARY_WATCH_STATUSES: readonly WatchStatus[] = ["recommended", "not_recommended"];

export interface ContentDetailLayout {
  gutter: number; contentWidth: number; gap: number; columns: 1 | 2;
  mainWidth: number; sideWidth: number; poster: { width: number; height: number };
}
export function getContentDetailLayout(width: number): ContentDetailLayout;
// w = Number.isFinite(width) && width > 0 ? width : 375; home = getHomeLayout(w)
// gutter = home.gutter, contentWidth = home.contentWidth, gap = home.posterGap
// columns = w >= 960 ? 2 : 1
// 2열: sideWidth = 360, mainWidth = contentWidth - 360 - gap / 1열: 둘 다 contentWidth
// poster = w < 600 ? { 96, 144 } : { 160, 240 }

export function createContentDetailMetaItems(input: {
  contentType: ContentType; airDateLabel: string | null; episodeLabel: string | null;
}): string[];
// [CONTENT_TYPE_LABELS[contentType] ?? "기타", airDateLabel, episodeLabel] 중 null·빈 문자열 제외

export function pinListLabel(pinCount: number | null | undefined): string;
// 0·null·undefined → "핀 목록", 그 외 `핀 목록 ${pinCount.toLocaleString("ko-KR")}`

export interface WatchStatusOption { status: WatchStatus; label: string; selected: boolean }
export function createWatchStatusControlModel(
  selected: readonly WatchStatus[], inLibrary: boolean
): { title: string; hint: string | null; primary: WatchStatusOption[]; secondary: WatchStatusOption[] };
// title: inLibrary ? "내 상태" : "내 목록에 추가"; hint: inLibrary ? null : "상태를 고르면 내 목록에 추가돼요."
// primary: PRIMARY_WATCH_STATUSES 순서, label WATCH_STATUS_LABEL, selected = selected.includes
// secondary: inLibrary ? SECONDARY_WATCH_STATUSES 같은 형식 : []

export type ContentDetailSection = "progress" | "watchCount" | "providers" | "review" | "overview" | "cast" | "danger";
export function contentDetailSections(input: {
  columns: 1 | 2; inLibrary: boolean; isSeries: boolean; hasCast: boolean; peopleEnabled: boolean;
}): { main: ContentDetailSection[]; side: ContentDetailSection[] };
// progress = inLibrary && isSeries / watchCount·review·danger = inLibrary / cast = hasCast && peopleEnabled / providers·overview 항상
// 2열: main = [progress?, review?, overview, cast?], side = [providers, watchCount?, danger?]
// 1열: main = [progress?, watchCount?, providers, review?, overview, cast?, danger?], side = []
```

### 6.2 `src/utils/watchStatusSelection.ts` (신규, 순수 — 화면에서 **동작 그대로** 이동)

```ts
import { normalizeWatchStatuses } from "@/constants/status";
import type { WatchStatus } from "@/types/library";
import { PRIMARY_WATCH_STATUSES } from "@/utils/contentDetailView";

export function createNextWatchStatuses(currentStatuses: readonly WatchStatus[], targetStatus: WatchStatus): WatchStatus[];
export function areSameWatchStatuses(left: readonly WatchStatus[], right: readonly WatchStatus[]): boolean;
```
본문은 `app/content/[id].tsx:609~633`과 같다(주 상태는 서로 배타·이미 켜진 주 상태는 그대로, 추천·비추천은 켜고 끄되 마지막 하나를 끄면 유지).

### 6.3 `src/utils/libraryFeedbackCopy.ts` (신규, 순수 — `docs/31` 6.7 중 삭제 문구만)

```ts
export interface ConfirmCopy { title: string; message: string; confirmLabel: string; cancelLabel: string }
export function createLibraryDeleteConfirmCopy(contentTitle: string): ConfirmCopy;
// title "내 목록에서 삭제할까요?"
// message `‘${제목 또는 "이 작품"}’의 감상 상태, 본 횟수, 시청 위치, 감상 날짜가 삭제됩니다. 남긴 핀과 회차 체크, 평점은 그대로 남아요.`
// confirmLabel "삭제", cancelLabel "취소". 제목은 trim, 비면 "이 작품"
```
`docs/31`의 `createLibraryAddFeedback`은 이 작업 범위가 아니다(검색 화면 U-11).

### 6.4 새 컴포넌트 (`src/components/content/`)

| 파일 | props | 내용 |
|------|-------|------|
| `ContentDetailHero.tsx` | `{ title; originalTitle: string \| null; posterUrl: string \| null; metaItems: string[]; genres: string[]; warning: string \| null; poster: { width; height }; children?: ReactNode }` | 카드(`surface`, `radius.lg`, hairline, `elevation.card`, `padding: spacing.lg`, `gap: spacing.md`). 윗줄 가로: 포스터(`AppImage` cover, `radius.md`, `surfaceMuted`, 크기 `poster`) + 글 묶음(`flex: 1`, `minWidth: 0`, `gap: spacing.xs`): 제목 `typography.display`(좁은 화면은 `typography.title`) / 원제(있고 제목과 다르면, `typography.body` `textMuted`, 2줄) / 메타 줄(첫 항목은 `primarySoft`·`primary` 알약 배지 `typography.micro`, 나머지는 ` · `로 이은 `typography.caption` `textMuted`) / `GenreBadgeList genres maxVisible={genres.length}` / 경고(`typography.caption` `colors.warning`). 넓은 화면(포스터 폭 160)이면 `children`(상태·행동)을 글 묶음 아래에, 좁은 화면이면 윗줄 아래 전체 폭에 둔다 |
| `WatchStatusControl.tsx` | `{ model; pending: boolean; onSelect: (status: WatchStatus) => void }` | 제목(`typography.label` `textMuted`) + hint(있으면 `typography.caption`). 주 상태: 회색 트랙(`surfaceMuted`, `radius.pill`, `padding: 4`, 높이 44) 안 항목 `flex: 1`, 선택 = `surface` + `elevation.card` + `text`, 비선택 = `textMuted`, `typography.label`, `accessibilityRole="button"`, `accessibilityState={{ selected, disabled: pending }}`. 추천·비추천: 알약 토글(높이 32 + `hitSlop` 상하 6, 켜짐 `successSoft`/`success`(추천)·`dangerSoft`/`danger`(비추천), 꺼짐 hairline 테두리 `textMuted`), 아이콘 `thumbs-up-outline`/`thumbs-down-outline` 14. `pending`이면 전체 `opacity: 0.6`, 눌러도 무시. 좁은 화면에서 주 상태 트랙과 토글은 줄바꿈 |
| `ContentActionBar.tsx` | `{ isMovie: boolean; pinCount: number \| null \| undefined; onOpenEpisodes; onAddMoviePin; onOpenPins; onOpenList }` | `flexDirection: "row"`, `flexWrap: "wrap"`, `gap: spacing.sm`. 1) primary 알약(높이 44, `primary` 채움, 글 `surface` `typography.label`, 아이콘 `list-outline`/`pin-outline` 16): 시리즈 "에피소드 보기", 영화 "영화 핀 추가" 2) secondary(높이 44, hairline 테두리, `surface`, 아이콘 `pin-outline`): `pinListLabel(pinCount)` 3) ghost(높이 44, 배경 없음, `textMuted`, 아이콘 `arrow-back` 16): "목록으로" |
| `WatchCountCard.tsx` | `{ watchCount; isCompleted; isSaving; onSave }` | 기존 `WatchCountInput` 상태·판정 로직 그대로. `DashboardPanel title="본 횟수" accessory={<Text>{watchCount}회</Text>}` 안에 한 줄: 입력(높이 44, 폭 72, 가운데 정렬, `surfaceMuted`, `radius.md`, `typography.headline`, 접근성 라벨 그대로) + "회" + "저장"(높이 44, `primary` 알약, 비활성 `opacity: 0.5`) — 셋이 **붙어서** 왼쪽 정렬. 막힘 사유는 아래 `typography.caption` `textMuted` |
| `ContentOverviewCard.tsx` | `{ overview: string \| null }` | `DashboardPanel title="줄거리"`. 4줄(`numberOfLines`) + "더보기/접기" 텍스트 버튼(`minHeight: 44`, `accessibilityState.expanded`). 없으면 "줄거리 정보가 없습니다." |
| `CastSection.tsx` | `{ cast: CastMember[]; contentType; favoriteKeys: ReadonlySet<string>; pending: boolean; columns: 1 \| 2; onAdd; onOpen }` | `DashboardPanel` 제목 애니면 "성우", 아니면 "출연 배우", 부제 "누르면 좋아하는 인물에 등록돼요. 등록된 인물은 상세로 이동해요.". 최대 8명, `columns` 열 격자. 카드: `PersonAvatar`(docs/36, size 40) + 이름(1줄 `typography.label`) + 원어 이름(다를 때, 1줄 caption) + 배역(1줄 caption) + 등록됨 배지(`primarySoft`/`primary` `typography.micro`). 누름 동작·`favoriteKeys` 판정(`${source}:${id}`)은 기존과 같다 |
| `LibraryDangerZone.tsx` | `{ pending: boolean; onDelete: () => void }` | 배경 없는 행(높이 44, 아이콘 `trash-outline` 18 + "내 목록에서 삭제", `colors.danger`, 진행 중 "삭제 중"·비활성). 위에 hairline 구분선 |

### 6.5 화면 구조 (`app/content/[id].tsx`)

```
KeyboardAvoidingView (기존)
└ ScrollView ref (기존 props, contentContainerStyle paddingBottom 24 + insets.bottom, backgroundColor colors.background)
  └ View content { width: "100%", maxWidth: HOME_CONTENT_MAX_WIDTH, alignSelf: "center", paddingHorizontal: layout.gutter, paddingTop: spacing.lg, gap: layout.gap }
    ├ ContentDetailHero (metaItems, warning = externalDetail.isError ? 기존 문구 : null)
    │   ├ WatchStatusControl — externalResult || libraryItem 일 때 (기존 addPanel 조건)
    │   └ ContentActionBar — !externalResult || libraryItem 일 때 (기존 actions 조건)
    └ View columns { flexDirection: layout.columns === 2 ? "row" : "column", gap: layout.gap, alignItems: "flex-start", onLayout → columnsY }
       ├ View main { width: layout.mainWidth, gap: layout.gap }  — sections.main 순서대로 렌더
       └ View side { width: layout.sideWidth, gap: layout.gap }  — sections.side 순서대로 (비면 렌더 안 함)
```
섹션 렌더:
- `progress`: 기존 `EpisodeProgressCard` 그대로, 래퍼 `onLayout` → `focusProgressCard(columnsY + y)`(D-9).
- `watchCount`: `WatchCountCard`(기존 `saveWatchCount`).
- `providers`: 기존 `WatchProviderList` 그대로.
- `review`: 기존 `ContentReviewEditor` 그대로.
- `overview`: `ContentOverviewCard`. 기존 `overviewExpanded` 상태는 카드 안으로 옮긴다.
- `cast`: `CastSection`(columns = `layout.mainWidth >= 520 ? 2 : 1` — 375는 1열, 600~959와 960 이상은 2열).
- `danger`: `LibraryDangerZone`(onDelete = 확인 후 삭제, D-4).
`focusProgressCard`는 `columnsY`(state/ref)와 카드 y의 합을 받는다. `columnsY`가 아직 0이면(레이아웃 전) 카드 onLayout에서 바로 쓰지 말고 둘 다 측정된 뒤 한 번 실행한다(`didFocusProgress` 그대로).

---

## 7. 데이터 모델 / SQL

없음.

---

## 8. 화면 명세

2장 그림과 6.4·6.5. 추가 규칙:
- 좁은 화면 히어로: 포스터 96×144 + 글(제목 `typography.title`, 원제 1줄). 상태·행동은 포스터 줄 아래 전체 폭.
- 1열에서 상태 세그먼트는 전체 폭, 행동 버튼은 줄바꿈.
- 터치 44pt(`docs/19` M-05).
- 모든 새 컴포넌트는 토큰만(16진 색·`fontWeight` 숫자 금지).

---

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 폭 375 | 한 열, 포스터 96×144, 섹션 순서 1열 규칙 | L-1, C-2 |
| E-2 | 폭 1440 | 히어로 + 주 776 / 옆 360 | L-5, C-1 |
| E-3 | 미등록 작품(검색 진입) | "내 목록에 추가" + 주 상태 4개, 행동 줄 숨김, 섹션은 보러가기·줄거리·출연 | S-2, C-4 |
| E-4 | 영화 | 행동 "영화 핀 추가", 시청 진행 없음 | C-3 |
| E-5 | 출연진 없음 / 인물 기능 꺼짐 | 출연 섹션 없음 | C-3, C-5 |
| E-6 | 완료+추천 상태에서 "보는 중" | 보는 중+추천 | N-2 |
| E-7 | 추천만 켜진 상태에서 추천 끄기 | 유지(마지막 하나) | N-5 |
| E-8 | 이미 켜진 주 상태 다시 누름 | 변화 없음(요청 안 보냄) | N-3, A-1 |
| E-9 | 삭제 | 확인 → 취소면 아무 일 없음, 확인이면 삭제·토스트·목록 이동 | D-1, 수동 M-4 |
| E-10 | 제목 공백 | 확인 문구 ‘이 작품’ | D-2 |
| E-11 | 메타 유형 | "anime" → "애니" | M-1 |
| E-12 | 화수·방영일 없음 | 해당 항목 생략 | M-2 |
| E-13 | 핀 0개 / 3개 / 1,234개 | "핀 목록" / "핀 목록 3" / "핀 목록 1,234" | P-1 |
| E-14 | 웹에서 마지막 화 진행 저장 | 토스트 "모든 화를 봤어요. 완료로 표시할까요?" + "완료로 표시" | 수동 M-5 |
| E-15 | 웹에서 상태 변경 실패 | 오류 토스트 | 수동 M-6 |
| E-16 | 홈 "진행 설정"(`focus=progress`)로 진입, 넓은 화면 | 시청 진행 카드로 정확히 스크롤 + 하이라이트 | 수동 M-3 |
| E-17 | 외부 상세 일부 실패 | 히어로 경고 문구 | 수동 M-2 |
| E-18 | 상태 저장 중 | 세그먼트·토글 비활성 | 수동 M-6 |

---

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 한 행 = `it` 하나(행 안 입력이 여럿이면 한 `it`에서 모두 assert).

### `src/utils/contentDetailView.test.ts` (신규)

| ID | 입력 | 기대 |
|----|------|------|
| L-1 | `getContentDetailLayout(375)` | `{ gutter: 16, contentWidth: 343, gap: 12, columns: 1, mainWidth: 343, sideWidth: 343, poster: { width: 96, height: 144 } }` |
| L-2 | `(599)` | `{ 16, 567, 12, 1, 567, 567, { 96, 144 } }` |
| L-3 | `(600)` | `{ 24, 552, 16, 1, 552, 552, { 160, 240 } }` |
| L-4 | `(960)` | `{ 24, 912, 16, 2, 536, 360, { 160, 240 } }` |
| L-5 | `(1440)`, `(2000)` | 둘 다 `{ 24, 1152, 16, 2, 776, 360, { 160, 240 } }` |
| L-6 | `(NaN)`, `(0)`, `(-1)` | 모두 L-1과 같음 |
| M-1 | `createContentDetailMetaItems({ contentType: "anime", airDateLabel: "2026.07", episodeLabel: "26화" })` | `["애니", "2026.07", "26화"]` |
| M-2 | `({ "movie", null, null })`, `({ "kdrama", "", "16화" })`, `({ "other", "2020", null })` | `["영화"]`, `["한국 드라마", "16화"]`, `["기타", "2020"]` |
| P-1 | `pinListLabel(undefined)`, `(null)`, `(0)`, `(3)`, `(1234)` | `"핀 목록"`, `"핀 목록"`, `"핀 목록"`, `"핀 목록 3"`, `"핀 목록 1,234"` |
| S-1 | `createWatchStatusControlModel(["completed", "recommended"], true)` | `{ title: "내 상태", hint: null, primary: [{ wishlist, "보고 싶음", false }, { watching, "보는 중", false }, { dropped, "보류", false }, { completed, "완료", true }], secondary: [{ recommended, "추천", true }, { not_recommended, "비추천", false }] }` |
| S-2 | `([], false)` | `{ title: "내 목록에 추가", hint: "상태를 고르면 내 목록에 추가돼요.", primary: 4개 모두 selected false, secondary: [] }` |
| C-1 | `contentDetailSections({ columns: 2, inLibrary: true, isSeries: true, hasCast: true, peopleEnabled: true })` | `{ main: ["progress", "review", "overview", "cast"], side: ["providers", "watchCount", "danger"] }` |
| C-2 | 같은 입력 `columns: 1` | `{ main: ["progress", "watchCount", "providers", "review", "overview", "cast", "danger"], side: [] }` |
| C-3 | `{ 2, inLibrary: true, isSeries: false, hasCast: false, peopleEnabled: true }` | `{ main: ["review", "overview"], side: ["providers", "watchCount", "danger"] }` |
| C-4 | `{ 2, inLibrary: false, isSeries: true, hasCast: true, peopleEnabled: true }`, 같은 입력 `columns: 1` | `{ main: ["overview", "cast"], side: ["providers"] }`, `{ main: ["providers", "overview", "cast"], side: [] }` |
| C-5 | C-1 입력 + `peopleEnabled: false` | `cast` 없음: `{ main: ["progress", "review", "overview"], side: ["providers", "watchCount", "danger"] }` |
| K-1 | 상수 | `CONTENT_DETAIL_SIDE_WIDTH === 360`, `PRIMARY_WATCH_STATUSES` = `["wishlist", "watching", "dropped", "completed"]`, `SECONDARY_WATCH_STATUSES` = `["recommended", "not_recommended"]` |

### `src/utils/watchStatusSelection.test.ts` (신규 — 현재 동작 고정)

| ID | 입력 `createNextWatchStatuses(current, target)` | 기대 |
|----|------|------|
| N-1 | `(["wishlist"], "watching")` | `["watching"]` |
| N-2 | `(["completed", "recommended"], "watching")` | `["watching", "recommended"]` |
| N-3 | `(["completed"], "completed")` | `["completed"]` |
| N-4 | `(["completed", "recommended"], "recommended")` | `["completed"]` |
| N-5 | `(["recommended"], "recommended")` | `["recommended"]` |
| N-6 | `(["completed"], "not_recommended")`, `(["completed", "recommended"], "not_recommended")` | `["completed", "not_recommended"]`, `["completed", "recommended", "not_recommended"]` |
| N-7 | `([], "wishlist")` | `["wishlist"]` |
| A-1 | `areSameWatchStatuses(["completed", "recommended"], ["recommended", "completed"])`, `(["completed"], ["completed", "recommended"])`, `([], [])` | `true`, `false`, `true` |

### `src/utils/libraryFeedbackCopy.test.ts` (신규)

| ID | 입력 | 기대 |
|----|------|------|
| D-1 | `createLibraryDeleteConfirmCopy("무빙")` | `{ title: "내 목록에서 삭제할까요?", message: "‘무빙’의 감상 상태, 본 횟수, 시청 위치, 감상 날짜가 삭제됩니다. 남긴 핀과 회차 체크, 평점은 그대로 남아요.", confirmLabel: "삭제", cancelLabel: "취소" }` |
| D-2 | `("   ")`, `("  무빙 ")` | message가 각각 `‘이 작품’의 …`, `‘무빙’의 …`로 시작 |

### 수동 확인 (웹 8081, 로그인 — 사람)

| ID | 확인 |
|----|------|
| M-1 | 폭 1440: 히어로(포스터 왼쪽·제목·메타 "애니"·장르·상태·행동) + 2열, 첫 화면에 상태와 시청 진행이 함께 보임. 홈·인물·프로필과 왼쪽 시작선 같음 |
| M-2 | 폭 375: 포스터 96 + 제목, 아래 상태 세그먼트·행동 버튼, 섹션 1열 순서 |
| M-3 | 홈 이어보기 "진행 설정" → 상세의 시청 진행 카드로 스크롤 + 하이라이트(넓은 화면·좁은 화면 둘 다) |
| M-4 | 삭제 → 확인 창 → 취소 무변화 / 확인 시 토스트 + 라이브러리 이동 |
| M-5 | 마지막 화까지 진행 저장 → 토스트의 "완료로 표시"로 완료 전환 |
| M-6 | 상태 세그먼트로 보는 중↔완료, 추천 토글 켜기/끄기, 저장 중 비활성. 오프라인 실패 시 오류 토스트 |
| M-7 | 검색 → 미등록 작품 상세 → 히어로에서 "보고 싶음"으로 추가 → 등록 상세로 바뀜 |
| M-8 | 영화 상세: "영화 핀 추가", 시청 진행 없음 |
| M-9 | 에피소드·핀 목록·목록으로 버튼 이동이 기존과 같음 |
| M-10 | **앱(iOS 세로)**: 히어로가 노치 아래에서 시작, 하단 홈 인디케이터에 삭제 버튼이 가리지 않음, 본 횟수·시청 진행 입력 시 키보드가 저장 버튼을 가리지 않음, 삭제 확인이 네이티브 Alert로 뜸 |
| M-11 | **앱 글자 크기 1.3배**: 상태 세그먼트 4칸·행동 버튼·메타 줄이 잘리거나 겹치지 않음(필요하면 줄바꿈) |

---

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/contentDetailView.ts` (+`.test.ts`) | 신규. 6.1 |
| `src/utils/watchStatusSelection.ts` (+`.test.ts`) | 신규. 6.2 (화면에서 이동) |
| `src/utils/libraryFeedbackCopy.ts` (+`.test.ts`) | 신규. 6.3 |
| `src/components/content/ContentDetailHero.tsx` | 신규 |
| `src/components/content/WatchStatusControl.tsx` | 신규 |
| `src/components/content/ContentActionBar.tsx` | 신규 |
| `src/components/content/WatchCountCard.tsx` | 신규(화면의 `WatchCountInput` 이동·재구성) |
| `src/components/content/ContentOverviewCard.tsx` | 신규 |
| `src/components/content/CastSection.tsx` | 신규(화면의 출연진 블록 이동·재구성) |
| `src/components/content/LibraryDangerZone.tsx` | 신규 |
| `app/content/[id].tsx` | 6.5로 재구성. 화면 안 `createNextWatchStatuses`·`areSameWatchStatuses`·`WatchCountInput`·출연진 JSX·쓰지 않는 styles 삭제. `Alert` import 제거 |

---

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| `EpisodeProgressCard`·`ContentReviewEditor`·`WatchProviderList`·`GenreBadgeList` 내부 모양 | D-8. 후속 단계에서 `DashboardPanel` 모양으로 통일 |
| 에피소드 목록(`app/content/[id]/episodes.tsx`)·작품 핀 목록(`pins.tsx`) | 다른 화면 |
| `docs/31` U-1·U-3·U-4·U-6~U-11 | 다른 화면. 이 작업은 U-2·U-5만 흡수 |
| 출연진 이름의 일본어/한글 표기(`formatPersonName`) | 작품 크레딧 데이터 경로(`docs/38` 범위 밖) |
| 리뷰 기능 노출 정책 | 기존 그대로 노출 |
| 기존 실패 테스트 `recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library" | 이 작업 전부터 실패. 별도 수정 |
| 다크 모드 | `docs/32` 4장 |

---

## 13. 확실하지 않음

1. **2열에서 `onLayout` y 합산**(D-9): RN Web·네이티브 모두 `onLayout`의 y는 부모 기준이다. 히어로와 2열 컨테이너가 같은 부모(content View)에 있고 그 부모가 ScrollView 콘텐츠의 맨 위이므로 `columnsY + cardY`가 스크롤 위치다. `paddingTop`만큼 차이가 나면 M-3에서 보정 여부를 보고한다.
2. **토스트 액션의 지속 시간**: `durationMs: 8000`이 `addToast` 옵션으로 지원됨을 확인했다(`src/stores/appUIStore.ts`). 사용자가 놓치면 상태 세그먼트에서 직접 "완료"를 고를 수 있다.
