# 37. 프로필 탭 대시보드 개편 명세

작성일: 2026-10-01
대상 브랜치 기준: `main` (`26e220e`) + **미커밋 `docs/36` 구현**(인물 탭: `SegmentedControl`, `PersonAvatar`, `peopleScreen.ts` 등). 이 시점 `npm test` 750개 중 749개 통과 — 실패 1개는 무관한 기존 결함(12장)
선행 문서: `docs/32_home_modern_redesign_spec.md`(토큰·단일 콘텐츠 컨테이너), `docs/36_people_tab_saas_redesign_spec.md`(인물 탭, `SegmentedControl`), `docs/19_mobile_usability_spec.md`(M-05 터치 44pt), `docs/31_usability_review_fixes_spec.md`(웹 `Alert.alert` 무동작, 토스트 피드백), `docs/35_search_completeness_and_deploy_drift_spec.md`(`delete-account` 미배포)

> **근거.** 사용자가 보낸 프로필 탭 캡처(넓은 웹 폭 약 2000px)와 코드(`app/(tabs)/profile.tsx` 638행, `src/components/stats/TypeStatsSection.tsx`·`YearStatsSection.tsx`·`GenreStatsSection.tsx`, `src/utils/profileStats.ts`, `src/utils/libraryFilters.ts`)를 대조했다. 로그인 이후 화면을 직접 실측하지는 않았다.
> 사용자 요청: "프로필 화면도 한눈에 들어올 수 있게 UI 개선해줘".

---

## 1. 문제 정의

| ID | 증상 (캡처 기준) | 코드상 원인 |
|----|-----------------|-------------|
| R-1 | 모든 블록이 화면 폭 전체로 세로로만 쌓여 첫 화면에 숫자 4개와 타입 분포만 보인다. 연도·장르는 한참 스크롤해야 나온다 | 콘텐츠 최대 폭·격자 없음. `container`가 `padding`만 있는 단일 열(`profile.tsx:367~372`). 세 섹션이 각각 전체 폭 카드 |
| R-2 | 타입별 분포에서 항목 이름과 퍼센트·개수 사이가 1,700px 떨어져 줄을 따라 읽기 어렵다 | 행이 `label flex: 1` + 오른쪽 고정 폭 숫자(`TypeStatsSection.tsx:55~60, 117~139`) |
| R-3 | "해외 드라마 0% 0개"가 색 점 없이 항상 보인다. 해외 드라마는 "기타"에 섞여 집계된다 | `CONTENT_TYPE_STAT_ORDER`가 `foreign_drama`를 포함하지만 `createContentTypeStats`는 `item.content_type`로만 센다. `content_type`에는 `foreign_drama` 값이 없어 항상 0(`profileStats.ts:28~49`). 라이브러리 필터는 `other` + 장르 "드라마"를 해외 드라마로 본다(`libraryFilters.ts:104~106`). 색 표(`contentTypeColors.ts`)에도 `foreign_drama`가 없다 |
| R-4 | 연도별 막대에서 2026년(35개)이 아주 짧다. 대부분을 차지하는 "감상일 미상" 묶음이 최댓값이 되어 다른 해 막대가 납작해진다 | `createYearStats`가 기록 모드에서 날짜 없는 작품을 `year: null` 묶음으로 넣고(`YearStatsSection.tsx:143~150`), 막대 비율을 그 묶음까지 포함한 최댓값으로 계산(`:59`). 연도 수 제한도 없다 |
| R-5 | 상단 "올해 본 작품 36"과 연도 통계 "2026년 35개"가 다르다 | 상단 값은 `last_watched_at`만 보고 세고(`profileStats.ts:75~78`), 연도 통계는 `isWatchedLibraryItem`(본 상태·시청 횟수)으로 거른 뒤 센다(`YearStatsSection.tsx:143`). 날짜는 있지만 "보고 싶음" 상태인 작품이 상단에만 들어간다(추정. 캡처 수치 차이 1과 일치) |
| R-6 | 장르 통계는 같은 데이터를 세 쪽(도넛·막대·랭킹)으로 나눠 좌우로 넘겨야 본다. 넓은 화면에서도 한 쪽만 보인다 | 가로 페이저 `pagingEnabled`, 쪽 폭 = 창 폭 − 32(`GenreStatsSection.tsx:27, 101~166`) |
| R-7 | 상단에 작은 "프로필" 헤더와 이름 카드가 따로 있다. 다른 개편 탭(홈·인물)과 상단 모양이 다르다 | 기본 탭 헤더(`app/(tabs)/_layout.tsx` `profile` 항목 `headerShown` 미지정) |
| R-8 | 화면 맨 아래 "로그아웃"이 화면에서 가장 강한 파란 채움 버튼이다 | `styles.logout` primary 채움(`profile.tsx:528~536`) |
| R-9 | 웹에서 "회원 탈퇴"를 눌러도 아무 일이 없다. 닉네임 저장 실패도 웹에서 안내가 없다 | `Alert.alert` 확인·오류 처리(`profile.tsx:57~59, 89~122`). 웹에서 `Alert.alert`는 동작하지 않는다(`docs/31` 5장) |
| R-10 | 글자가 전반적으로 무겁고, 숫자 카드·섹션 카드 모양이 홈·인물 탭과 다르다 | `fontWeight: "900"` 다수, `typography`·`elevation` 토큰 미사용, `radius.md` 카드 |
| R-11 | 불러오는 중에는 섹션마다 빙글이 상자 3개, 라이브러리 오류는 표시되지 않고 빈 상태 문구가 나온다 | 각 섹션의 `ActivityIndicator` 상자, `library.isError` 처리 없음 |
| R-12 | 작품이 없으면 같은 뜻의 빈 상자가 세 번 나온다 | 각 섹션이 따로 빈 상태를 그림 |

---

## 2. 목표 모습

넓은 화면(960 이상, 콘텐츠 1152):

```
┌ 콘텐츠 컨테이너 (최대 1200, 가운데, 좌우 16/24 — 홈·인물과 같은 시작선) ─────────────────────┐
│ 프로필                                                                       (display)       │
│ ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│ │ (달)  달달깡패                                                     [✎ 닉네임 변경]     │   │
│ │       gtokk@naver.com                                                               │   │
│ └──────────────────────────────────────────────────────────────────────────────────────┘   │
│ ┌ ▣ 560 ───────────┐ ┌ ✓ 514 ───────────┐ ┌ 📍 3 ─────────────┐ ┌ 📅 35 ────────────┐   │
│ │ 등록 작품          │ │ 완료  완료율 92%  │ │ 핀                │ │ 올해 본 작품 2026년 │   │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘   │
│ ┌ 타입별 분포  총 560개 ───────────────────┐ ┌ 장르 TOP 5  장르 태그 기준 ────────────────┐ │
│ │ [■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■] │ │   ◯도넛     ● 드라마      210  31%      │ │
│ │ ● 한국 드라마 273 49%  ● 애니 155 28%   │ │   560작품   ● 로맨스      120  18%      │ │
│ │ ● 일본 드라마  70 13%  ● 영화  53  9%   │ │             ● 코미디 …                  │ │
│ │ ● 해외 드라마   7  1%  ● 기타   2  1%미만│ │             ● 그 외       80  12%      │ │
│ └────────────────────────────────────────┘ └──────────────────────────────────────────┘ │
│ ┌ 연도별 감상  마지막으로 본 날 기준                                   [ 기록 | 방영 ] ┐ │
│ │ 본 작품 536개 · 시청 536회 · 가장 많은 해 2026년                                     │ │
│ │        35                                                                          │ │
│ │   3    ██                                                                          │ │
│ │  ▂▂    ██           ← 최근 8개 연도 세로 막대, 높이 = 그해 본 작품 수 / 화면 안 최댓값   │ │
│ │ 2025  2026                                                                         │ │
│ │ 감상일 기록이 없는 498개는 그래프에서 뺐어요.                                          │ │
│ └──────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ 계정 ─────────────────────────────┐                                                   │
│ │ ⎋ 로그아웃                         │  ← 목록 행. 넓은 화면에서 패널 폭(왼쪽 열)         │
│ │ ⊖ 회원 탈퇴 (빨간 글자)             │                                                   │
│ └───────────────────────────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

좁은 화면(600 미만): 숫자 카드 2×2, 패널은 한 열(타입 → 장르 → 연도 → 계정), 장르 도넛은 목록 위.

---

## 3. 재현 시나리오

1. 웹 8081, 폭 1440 이상, 작품 수십 개 이상인 계정으로 로그인 → 하단 "프로필".
2. 첫 화면에 숫자 4개와 타입 분포만 보이고 연도·장르는 스크롤 아래 → R-1.
3. 타입별 분포의 "해외 드라마 0% 0개"(색 점 없음) → R-3. 라이브러리 탭에서 "해외 드라마" 필터를 걸면 작품이 있는데도 0.
4. 연도별 감상 통계(기록 모드) 맨 아래 "감상일 미상" 막대가 가장 길고 최근 연도 막대가 짧다 → R-4.
5. 상단 "올해 본 작품"과 연도 통계 올해 개수 비교 → R-5.
6. 웹에서 "회원 탈퇴" 클릭 → 반응 없음 → R-9.

---

## 4. 설계 결정

### D-1. `docs/32`·`docs/36`의 토큰·컨테이너·격자 구간을 그대로 쓴다
- 색·모서리·글자·그림자는 `colors`·`radius`·`typography`·`elevation`만. 화면·새 컴포넌트에 16진 색과 `fontWeight` 숫자 문자열을 쓰지 않는다(예외: 차트 계열색 `CONTENT_TYPE_COLORS`·`GENRE_COLORS` 상수 사용).
- 폭·열은 새 순수 함수 `getProfileLayout(width)`. `getHomeLayout`의 `gutter`·`contentWidth`·`posterGap`을 옮기고, 숫자 카드 열(600 미만 2, 이상 4)·패널 열(960 미만 1, 이상 2)만 더한다.
- `theme.ts`, `homeLayout.ts`, `SegmentedControl.tsx`, `PersonAvatar.tsx`(docs/36)는 **수정하지 않고 재사용**한다.

### D-2. 프로필 탭도 기본 헤더를 숨기고 화면 안 제목을 쓴다
`app/(tabs)/_layout.tsx`의 `profile`에 `headerShown: false`. 화면 맨 위 `insets.top + 12` 뒤 "프로필"(`typography.display`).

### D-3. 첫 화면에 핵심 숫자 + 두 분포가 함께 보이는 대시보드 격자
순서: 프로필 카드 → 숫자 카드 4개(한 줄/2×2) → [타입별 분포 | 장르 TOP 5](960 이상 2열) → 연도별 감상(전체 폭) → 계정. 장르 페이저(좌우 넘김)는 없앤다. 같은 데이터를 세 번 그리지 않고 **도넛 + 상위 5개 목록** 한 장으로 합친다.

### D-4. 숫자를 세는 규칙을 한 곳으로 맞춘다
- **타입 분류**: 새 `libraryContentCategory(item)`(`src/utils/libraryFilters.ts`)가 `content_type === "other"`이면 표시 장르에 "드라마"가 있을 때 `foreign_drama`, 아니면 `other`, 그 외는 `content_type`. 라이브러리 필터 `matchesContentTypeFilter`와 프로필 통계가 모두 이 함수를 쓴다(동작은 기존 필터와 같음).
- **올해 본 작품**: `createCurrentYearSummary`·`countCurrentYearWatchedItems`의 "올해" 개수는 연도 통계와 같이 `isWatchedLibraryItem`인 작품만 센다. 라벨 선택 규칙("올해 본 작품" vs "올해 등록")은 그대로.
- `CONTENT_TYPE_COLORS`에 `foreign_drama` 색(`#7C3AED`) 추가. 키 타입을 `ContentType | "foreign_drama"`로 넓힌다(기존 사용처 호환).

### D-5. 타입 분포는 0인 항목을 숨기고 많은 순으로 보여준다
`createTypeDistribution(stats)` = 개수 > 0만, 개수 내림차순(동률은 기존 순서). 막대와 범례가 같은 순서. 범례는 점·이름·개수·퍼센트를 **붙여서** 한 덩어리로(R-2). 패널 폭 440 이상이면 범례 2열.

### D-6. 연도 그래프는 날짜가 있는 해만, 최근 8개 연도, 세로 막대
- `createYearStats`를 컴포넌트 파일에서 `profileStats.ts`로 옮긴다(로직 그대로).
- `createYearChartModel(stats, 8)`: 연도 있는 묶음만 막대로, 최근 8개 연도를 왼쪽(과거)→오른쪽(최근). 막대 높이 = 그해 **본 작품 수** / 보이는 막대 중 최댓값. "가장 많은 해"도 본 작품 수 기준(동률이면 최근 해).
- 날짜 없는 묶음과 생략한 이전 연도는 막대 대신 각주(`yearChartFootnotes`)로 알린다.
- 요약 숫자(본 작품·시청 횟수)는 미상 묶음을 포함한 전체 합(기존과 같음).
- 기록/방영 전환은 `SegmentedControl`. 기본 모드 규칙(날짜 있는 작품 10개 이상이면 기록)은 그대로(`defaultYearStatsMode`로 이동).

### D-7. 장르는 상위 5개 + "그 외"
`createGenreBreakdown(stats, 5)`: 표시 장르 기준 상위 5개에 색, 나머지 합은 회색 "그 외". 퍼센트 분모는 장르 태그 개수 합(작품 하나에 장르 여러 개). 부제 "장르 태그 기준"으로 밝힌다. 도넛 가운데는 라이브러리 작품 수(기존과 같음). 패널 폭 440 이상이면 도넛 왼쪽 + 목록 오른쪽, 아니면 위아래.

### D-8. 계정 행동은 목록 행으로 낮추고, 웹에서도 동작하게 한다
- "계정" 카드 안 행: (확장 기능 켜짐 시) 추천에서 제외한 작품 ›, 로그아웃, 회원 탈퇴(`colors.danger` 글자). 파란 채움 버튼 금지. 넓은 화면에서 카드 폭은 `panelWidth`.
- 회원 탈퇴 확인은 새 `confirmDestructive`(웹 `window.confirm`, 네이티브 `Alert.alert`)로 **두 단계 그대로**(첫 안내 → "정말 탈퇴하시겠어요?"). 문구는 기존과 같다.
- 회원 탈퇴·닉네임 저장 실패는 토스트. 한국어 검증 문구(예: "닉네임을 입력해 주세요.")는 그대로, 그 외 원문(영문 DB 오류)은 고정 문구(`userFacingErrorMessage`).
- 로그아웃은 확인 없이 지금처럼 바로 실행.

### D-9. 상태 표시는 화면 단위로 한 번
- 라이브러리 로딩 중(데이터 없음): 숫자 카드·패널 자리에 회색 스켈레톤.
- 라이브러리 오류(데이터 없음): 대시보드 자리에 `ErrorState` 하나(재시도).
- 작품 0개: 패널 대신 `EmptyState` 하나("아직 통계가 없어요" + "작품 검색하기" → `/search`). 숫자 카드는 0으로 보인다.
- 장르 RPC만 로딩·오류면 장르 패널 안에서만 처리.

### D-10. 판정·문구·레이아웃은 순수 함수
`src/utils/profileDashboard.ts`(신규)와 `src/utils/profileStats.ts`(수정). 테스트 파일은 `react-native`·`expo-*`·Supabase를 import하지 않는다. `profileStats.ts`에는 지금 테스트가 없으므로 이번에 `profileStats.test.ts`를 새로 만든다.

### D-11. 기능·데이터는 바꾸지 않는다
`useLibrary`·`useLibraryStats`·`useGenreStats`·`useAuth`, `getProfile`·`updateProfileDisplayName`, 닉네임 최대 24자, 취향 카드 공유 모달·캡처 로직, `EXTENDED_FEATURES_ENABLED` 분기, 하단 탭은 그대로. DB·Edge Function 변경 없음. 예외: 화면 밖 캡처용 `TasteReportCard`는 `EXTENDED_FEATURES_ENABLED`일 때만 렌더한다(꺼져 있으면 쓰이지 않는 숨은 렌더).

---

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 기존 세 섹션 컴포넌트를 스타일만 바꿔 유지 | 각 섹션이 훅을 직접 불러 화면 단위 로딩·오류·빈 상태를 한 번에 처리할 수 없다(R-11·R-12). 장르 페이저와 미상 막대 문제도 남는다 |
| 연도 그래프에서 미상 묶음을 막대로 유지하되 회색 처리 | 최댓값 문제(R-4)가 그대로다. 각주로 개수를 알리는 편이 정확하다 |
| 연도 막대 높이를 시청 횟수 기준 유지 | `watch_count`가 0인 작품이 많아(캡처 2026년 35개·25회) "본 작품 수"보다 덜 직관적이다. 시청 횟수는 요약 숫자로 남긴다 |
| 타입 분포를 도넛으로 | 6개 이하 범주는 가로 누적 막대가 비교하기 쉽고, 장르 도넛과 시각적으로 구분된다 |
| 회원 탈퇴를 별도 설정 화면으로 이동 | 새 라우트가 생겨 범위가 커진다. 목록 행 + 두 단계 확인으로 충분 |
| 로그아웃 확인 대화상자 추가 | 다시 로그인하면 되는 가벼운 행동. 기존 동작 유지 |
| 숫자 카드에 지난해 대비 증감 표시 | 기준 데이터(작년 같은 시점)가 없다. 기능 추가 |

---

## 6. 계약

### 6.1 `src/utils/libraryFilters.ts` (수정)

```ts
export type LibraryContentCategory = Exclude<ContentTypeFilter, "all">;
export function libraryContentCategory(item: Pick<LibraryListItem, "content_type" | "genres">): LibraryContentCategory;
// content_type !== "other" → content_type
// createDisplayGenreNames(item.genres).includes("드라마") → "foreign_drama", 아니면 "other"

// matchesContentTypeFilter (비공개, 기존): filter === "all" → true, 그 외 → libraryContentCategory(item) === filter
```
기존 `libraryFilters.test.ts`는 수정 없이 통과해야 한다.

### 6.2 `src/utils/profileStats.ts` (수정)

```ts
export interface ContentTypeStat { type: LibraryContentCategory; label: string; count: number; percent: number }  // type 넓힘
export function createContentTypeStats(items: LibraryListItem[]): ContentTypeStat[];
// 순서 CONTENT_TYPE_FILTERS에서 "all" 제외(anime, kdrama, jdrama, foreign_drama, movie, other), 개수는 libraryContentCategory 기준

export function createCurrentYearSummary(items: LibraryListItem[], now?: Date): CurrentYearSummary;
// 라벨 선택: last_watched_at 있는 작품이 하나라도 있으면 "올해 본 작품"(watched_at), 없으면 "올해 등록"(added_at) — 기존과 같음
// "올해 본 작품" value = isWatchedLibraryItem(item) && yearFromDate(last_watched_at) === 올해 인 개수 (변경점)
export function countCurrentYearWatchedItems(items: LibraryListItem[], now?: Date): number | null;
// 날짜 있는 작품이 없으면 null(기존). 값은 위와 같은 규칙(변경점)

export type YearStatsMode = "recorded" | "aired";
export interface YearStat { year: number | null; itemCount: number; watchCount: number }
export function createYearStats(items: LibraryListItem[], mode: YearStatsMode): YearStat[];   // YearStatsSection.tsx에서 그대로 이동
export function defaultYearStatsMode(items: LibraryListItem[]): YearStatsMode;               // countItemsWithWatchedDate(items) >= 10 ? "recorded" : "aired"
```

### 6.3 `src/utils/profileDashboard.ts` (신규, 순수)

```ts
import type { GenreStat } from "@/types/genre";
import { getHomeLayout } from "@/utils/homeLayout";
import type { ContentTypeStat, CurrentYearSummary, YearStat, YearStatsMode } from "@/utils/profileStats";

export const YEAR_CHART_MAX_BARS = 8;
export const GENRE_TOP_COUNT = 5;
export const YEAR_MODE_OPTIONS: readonly { label: string; value: YearStatsMode }[] = [
  { label: "기록", value: "recorded" },
  { label: "방영", value: "aired" }
];

export interface ProfileLayout {
  gutter: number; contentWidth: number; gap: number;
  metricColumns: 2 | 4; metricWidth: number;
  dashboardColumns: 1 | 2; panelWidth: number; panelWide: boolean;
}
export function getProfileLayout(width: number): ProfileLayout;
// w = Number.isFinite(width) && width > 0 ? width : 375; home = getHomeLayout(w)
// gutter = home.gutter, contentWidth = home.contentWidth, gap = home.posterGap
// metricColumns = w < 600 ? 2 : 4; metricWidth = floor((contentWidth - gap * (metricColumns - 1)) / metricColumns)
// dashboardColumns = w >= 960 ? 2 : 1; panelWidth = dashboardColumns === 2 ? floor((contentWidth - gap) / 2) : contentWidth
// panelWide = panelWidth >= 440

export type ProfileMetricIcon = "albums-outline" | "checkmark-done-outline" | "pin-outline" | "calendar-outline";
export interface ProfileMetric { key: "total" | "completed" | "pins" | "year"; label: string; value: string; caption: string | null; icon: ProfileMetricIcon }
export function formatCount(value: number | null | undefined): string;   // null/undefined → "--", 그 외 toLocaleString("ko-KR")
export function createProfileMetrics(input: {
  total: number | null | undefined; completed: number | null | undefined; pins: number | null | undefined;
  currentYear: CurrentYearSummary; now?: Date;
}): ProfileMetric[];
// [ { total, "등록 작품", formatCount(total), null, "albums-outline" },
//   { completed, "완료", formatCount(completed), total > 0 && completed != null ? `완료율 ${Math.round(completed / total * 100)}%` : null, "checkmark-done-outline" },
//   { pins, "핀", formatCount(pins), null, "pin-outline" },
//   { year, currentYear.label, formatCount(currentYear.value), `${(now ?? new Date()).getFullYear()}년`, "calendar-outline" } ]

export function createTypeDistribution(stats: readonly ContentTypeStat[]): ContentTypeStat[];  // count > 0, count 내림차순, 동률 입력 순서
export function formatPercent(percent: number): string;   // 0 < p < 1 → "1% 미만", 그 외 `${Math.round(p)}%`

export interface GenreSlice { name: string; count: number; percent: number; colorIndex: number | null }
export function createGenreBreakdown(stats: readonly GenreStat[], top?: number): { slices: GenreSlice[]; total: number };
// top 기본 GENRE_TOP_COUNT. count 내림차순 → 이름 localeCompare(ko-KR) 오름차순으로 정렬
// total = 전체 count 합. 앞 top개 colorIndex 0..top-1. 나머지 합 > 0이면 { name: "그 외", count: 합, colorIndex: null } 추가
// percent = total > 0 ? count / total * 100 : 0

export interface YearChartBar { year: number; itemCount: number; watchCount: number; ratio: number }
export interface YearChartModel { bars: YearChartBar[]; totalItems: number; totalWatches: number; peakYear: number | null; unknownCount: number; omittedYearCount: number }
export function createYearChartModel(stats: readonly YearStat[], maxBars?: number): YearChartModel;
// maxBars 기본 YEAR_CHART_MAX_BARS
// known = year !== null, 연도 내림차순 → 앞 maxBars개 → 연도 오름차순
// ratio = itemCount / max(1, 보이는 막대 itemCount 최댓값)
// totalItems·totalWatches = stats 전체 합(미상 포함)
// peakYear = known 전체 중 itemCount 최대, 동률이면 더 최근 해. known 없으면 null
// unknownCount = year === null 묶음 itemCount(없으면 0); omittedYearCount = known.length - bars.length
export function yearChartFootnotes(model: YearChartModel): string[];
// unknownCount > 0 → `감상일 기록이 없는 ${formatCount(n)}개는 그래프에서 뺐어요.`
// omittedYearCount > 0 → `이전 연도 ${n}개는 그래프에서 생략했어요.`   (이 순서)
export function yearChartAccessibilityLabel(model: YearChartModel): string;
// bars 없음 → "연도별 본 작품 기록이 없어요"
// 있으면 `연도별 본 작품: ${bars.map(b => `${b.year}년 ${b.itemCount}개`).join(", ")}`

export function userFacingErrorMessage(error: unknown, fallback: string): string;
// error instanceof Error && /[가-힣]/.test(error.message) → error.message, 그 외 fallback
```

### 6.4 `src/utils/confirmDestructive.ts` (신규, `react-native` 사용 — 테스트 대상 아님)

```ts
export function confirmDestructive(options: { title: string; message: string; confirmLabel: string; onConfirm: () => void }): void;
// web: if (window.confirm(`${title}\n\n${message}`)) onConfirm()
// native: Alert.alert(title, message, [{ text: "취소", style: "cancel" }, { text: confirmLabel, style: "destructive", onPress: onConfirm }])
```
`confirmDiscard.ts`는 그대로 둔다.

### 6.5 `src/constants/contentTypeColors.ts` (수정)

```ts
export const CONTENT_TYPE_COLORS: Record<ContentType | "foreign_drama", string> = { …기존 5개, foreign_drama: "#7C3AED" };
```

### 6.6 새 컴포넌트 (`src/components/profile/`)

| 파일 | props | 내용 |
|------|-------|------|
| `DashboardPanel.tsx` | `{ title: string; subtitle?: string; accessory?: ReactNode; width?: number; children: ReactNode }` | 카드 셸: `colors.surface`, `radius.lg`, hairline `colors.border`, `elevation.card`, `padding: spacing.lg`, `gap: spacing.md`. 머리(제목 `typography.headline`, 부제 `typography.caption` `textMuted`, 오른쪽 accessory). `width` 있으면 그 폭, 없으면 100%. `overflow: "hidden"` 금지 |
| `ProfileHeaderCard.tsx` | `{ displayName; email: string \| null; isEditing; draft; saving; onChangeDraft; onStartEdit; onSave; onCancel; accessory?: ReactNode }` | `PersonAvatar`(docs/36, `profileUrl={null}`, size 56) + 이름(`typography.title`) + 이메일(`typography.caption`, 없으면 "개인 감상 기록"). 오른쪽 "닉네임 변경" 버튼(아이콘 `create-outline` 16, `typography.label` `primary`, `colors.primarySoft` 알약, `minHeight: 44`, `paddingHorizontal: spacing.md`). 편집 중: 이름 아래 한 줄(줄바꿈 허용) TextInput(`accessibilityLabel "닉네임"`, `maxLength 24`, 높이 44, `radius.md`, `surfaceMuted`, `typography.body`, `onSubmitEditing={onSave}`) + "저장"(primary 채움 알약 44, 저장 중 "저장 중") + "취소"(`surfaceMuted` 알약 44). `accessory`는 버튼 옆(확장 기능의 취향 카드 공유) |
| `MetricTile.tsx` | `{ metric: ProfileMetric; width: number }` | 카드(셸과 같은 표면). 아이콘 원 32(`primarySoft`, `primary` 아이콘 18) / 값 `typography.display` / 라벨 `typography.label` `textMuted` / caption `typography.caption` `textMuted`(있을 때). `accessibilityLabel` `${label} ${value}${caption ? `, ${caption}` : ""}` |
| `TypeDistributionPanel.tsx` | `{ stats: ContentTypeStat[]; totalCount: number; width?: number; wide: boolean }` | `DashboardPanel` 제목 "타입별 분포", 부제 `총 ${formatCount(totalCount)}개 작품`. `createTypeDistribution(stats)` 결과로 누적 막대(높이 12, 트랙 `surfaceMuted` `radius.pill` `overflow: "hidden"`, 조각 색 `CONTENT_TYPE_COLORS[type]`) + 범례(`wide`면 2열, 아니면 1열). 범례 항목: 점 10 + 이름(`typography.label` `text`) + 개수(`typography.label` `text`) + 퍼센트(`typography.caption` `textMuted`, `formatPercent`). 이름과 숫자 사이 간격 `spacing.sm`(오른쪽 끝 정렬 금지) |
| `GenreBreakdownPanel.tsx` | `{ breakdown: { slices; total }; libraryCount: number; width?: number; wide: boolean; isLoading: boolean; isError: boolean; onRetry: () => void }` | 제목 "장르 TOP 5", 부제 "장르 태그 기준". 로딩 → 회색 원 + 막대 스켈레톤. 오류 → `ErrorState`(`message="장르 통계를 불러오지 못했어요."`, 재시도). slices 없음 → `typography.body` `textMuted` "장르 정보가 있는 작품이 아직 없어요.". 그 외 `PieChart`(react-native-gifted-charts, `donut`, `radius={72}`, `innerRadius={46}`, 가운데 `formatCount(libraryCount)` + "작품") + 목록(점·이름 1줄·개수·퍼센트). 색: `colorIndex` 있으면 `GENRE_COLORS[colorIndex % length]`, null이면 `colors.textSubtle`. `wide`면 가로(도넛 왼쪽), 아니면 세로 |
| `YearActivityPanel.tsx` | `{ items: LibraryListItem[]; width?: number }` | 내부 상태 `selectedMode: YearStatsMode \| null`(기본 `defaultYearStatsMode(items)`). 제목 "연도별 감상", 부제 기록 "마지막으로 본 날 기준" / 방영 "작품 방영연도 기준", accessory `SegmentedControl`(`YEAR_MODE_OPTIONS`, `accessibilityLabel "연도 기준"`). 요약 한 줄(`typography.label`): `본 작품 ${formatCount(totalItems)}개 · 시청 ${formatCount(totalWatches)}회 · 가장 많은 해 ${peakYear ? `${peakYear}년` : "--"}`. 세로 막대 영역(높이 160, `accessibilityLabel={yearChartAccessibilityLabel(model)}`, 자식 `accessibilityElementsHidden`): 막대마다 `flex: 1` 열, 위 값(`typography.micro` `textMuted`), 막대(폭 `min(28, 60%)`, 높이 `itemCount > 0 ? max(4, round(120 * ratio)) : 0`, `colors.primary`, 위쪽 모서리 `radius.sm`), 아래 연도(`typography.caption`, 가장 많은 해는 `colors.text`, 나머지 `textMuted`). 각주 `yearChartFootnotes` 각 줄 `typography.caption` `textMuted`. 막대 없음 → "본 작품을 등록하면 연도별 감상을 볼 수 있어요." |
| `AccountSection.tsx` | `{ width?: number; exclusionCount: number \| null; onOpenExclusions?: () => void; onSignOut: () => void; signingOut: boolean; onDeleteAccount: () => void; deleting: boolean }` | `DashboardPanel` 제목 "계정". 행(`minHeight: 52`, 아이콘 20 + `typography.body` + 오른쪽 메타/›, 행 사이 hairline 구분선, `accessibilityRole="button"`): `onOpenExclusions`가 있을 때만 "추천에서 제외한 작품"(`${exclusionCount}개` ›), "로그아웃"(`log-out-outline`, 진행 중 "로그아웃 중"), "회원 탈퇴"(`person-remove-outline`, `colors.danger` 아이콘·글자, 진행 중 "탈퇴 처리 중"). 둘 중 하나라도 진행 중이면 두 행 모두 `disabled` + `opacity: 0.5` |
| `ProfileSkeleton.tsx` | `{ layout: ProfileLayout }` | 숫자 카드 4개 자리 + 패널 2개 자리(높이 220) 회색 블록(`surfaceMuted`, `radius.lg`). `accessibilityLabel "프로필 통계를 불러오는 중입니다"` |

### 6.7 화면 판정 순서 (`app/(tabs)/profile.tsx`)

```
ScrollView (flex 1, colors.background, contentContainerStyle paddingBottom 96, showsVerticalScrollIndicator false)
└ content (width 100%, maxWidth HOME_CONTENT_MAX_WIDTH, alignSelf center, paddingHorizontal layout.gutter, gap layout.gap)
  ├ View paddingTop insets.top + 12 : "프로필" (typography.display)
  ├ ProfileHeaderCard (확장 기능 켜짐이면 accessory = 기존 "취향 카드 공유" 버튼, 비활성 조건 그대로)
  ├ 1) library.isLoading && !library.data → ProfileSkeleton
  │  2) library.isError && !library.data → ErrorState(message "통계를 불러오지 못했어요.", onRetry library.refetch)
  │  3) 그 외:
  │     ├ 숫자 카드 격자 (row wrap, gap layout.gap, 각 width layout.metricWidth) — createProfileMetrics
  │     ├ totalCount === 0 → EmptyState(title "아직 통계가 없어요",
  │     │     description "작품을 라이브러리에 추가하면 취향 통계가 여기에 모여요.", actionLabel "작품 검색하기", onAction → router.push("/search"))
  │     └ 그 외: 패널 격자 (row wrap, gap layout.gap, alignItems "stretch")
  │          TypeDistributionPanel(width panelWidth) · GenreBreakdownPanel(width panelWidth)
  │          YearActivityPanel(width contentWidth)
  └ AccountSection (width layout.panelWidth)
```
- `totalCount = stats.data?.total ?? libraryItems.length`(기존).
- 닉네임: 기존 상태·mutation 유지, `onError`는 `addToast(userFacingErrorMessage(error, "닉네임을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."), "error")`.
- 회원 탈퇴: `confirmDestructive({ title: "회원 탈퇴", message: "라이브러리, 에피소드 진행률, 핀, 태그, 리뷰, 좋아하는 인물, 공유 링크 등 모든 개인 기록이 영구 삭제됩니다.", confirmLabel: "계속", onConfirm: () => confirmDestructive({ title: "정말 탈퇴하시겠어요?", message: "이 작업은 되돌릴 수 없습니다.", confirmLabel: "탈퇴", onConfirm: runDelete }) })`. `runDelete`는 기존 `deleteAccount.mutate(undefined, { onSuccess: () => router.replace("/sign-in"), onError: (error) => addToast(userFacingErrorMessage(error, "회원 탈퇴를 처리하지 못했어요. 잠시 후 다시 시도해 주세요."), "error") })`.
- 취향 카드 모달(`Modal` 이하)과 공유 로직은 그대로. 화면 밖 캡처 `View`는 `EXTENDED_FEATURES_ENABLED && hasLibraryItems`일 때만.
- 기존 `Stat` 함수와 이번에 쓰지 않게 된 styles는 삭제. 모달이 쓰는 styles는 남긴다.

---

## 7. 데이터 모델 / SQL

없음.

---

## 8. 화면 명세

2장 그림과 6.6·6.7이 화면 명세다. 추가 규칙:
- 패널 격자의 같은 행(타입·장르)은 높이가 같다(셀 `alignSelf: "stretch"`, 패널 `flexGrow: 1`).
- 터치 영역(`docs/19` M-05): 닉네임 변경·저장·취소 44, 계정 행 52, 세그먼트 44.
- 숫자·퍼센트에는 `fontVariant: ["tabular-nums"]`를 준다(자릿수 정렬).

---

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 폭 375 | 숫자 카드 2×2, 패널 1열, 장르 도넛 위·목록 아래, 범례 1열 | L-1, L-8 |
| E-2 | 폭 960 이상 | 숫자 카드 4열, 타입·장르 나란히, 연도 전체 폭 | L-6, L-7 |
| E-3 | `other` + 장르 "드라마" 작품 | 해외 드라마로 집계, 보라 색 | S-1, S-3 |
| E-4 | 개수 0인 타입 | 범례·막대에서 숨김 | T-1 |
| E-5 | 1% 미만 타입 | "1% 미만" | T-3 |
| E-6 | 날짜는 있지만 "보고 싶음"인 작품 | 올해 본 작품에 안 셈(연도 그래프와 같음) | S-4, S-6 |
| E-7 | 기록 모드, 대부분 날짜 없음 | 날짜 있는 해만 막대, 미상 개수 각주 | Y-1, Y-5 |
| E-8 | 기록 연도 10년 이상 | 최근 8년 막대, 이전 연도 수 각주 | Y-2, Y-5 |
| E-9 | 생략된 이전 해가 더 큼 | 막대 비율은 보이는 막대 기준 | Y-6 |
| E-10 | 가장 많은 해 동률 | 최근 해 | Y-3 |
| E-11 | 방영 모드 | `air_year` 없는 작품 제외(기존), 미상 각주 없음 | S-8, Y-5 |
| E-12 | 장르 6개 이상 | 상위 5개 + "그 외" | G-1 |
| E-13 | 장르 5개 이하 | "그 외" 없음 | G-2 |
| E-14 | 장르 없음 | 패널 안 문구 | G-4 |
| E-15 | 장르 RPC 오류 | 장르 패널 안 오류 + 재시도, 다른 패널 정상 | 수동 M-6 |
| E-16 | 작품 0개 | 숫자 카드 0, 빈 상태 하나 + "작품 검색하기" | 수동 M-5 |
| E-17 | 라이브러리 로딩 | 스켈레톤 | 수동 M-6 |
| E-18 | 라이브러리 오류(캐시 없음) | 오류 하나 + 재시도 | 수동 M-6 |
| E-19 | 통계 값 미도착 | 숫자 "--", 완료율 없음 | M-2 |
| E-20 | 숫자 1,000 이상 | "1,234" | M-3 |
| E-21 | 닉네임 빈 값 저장 | 토스트 "닉네임을 입력해 주세요." | E-1(테스트) |
| E-22 | 닉네임 저장 DB 오류 | 고정 문구 토스트 | E-1(테스트) |
| E-23 | 웹 회원 탈퇴 | 브라우저 확인 2회 → 실행. 취소하면 아무 일 없음 | 수동 M-7 |
| E-24 | 회원 탈퇴 실패(예: `delete-account` 미배포) | 고정 문구 토스트, 화면 유지 | 수동 M-7 |
| E-25 | 로그아웃 진행 중 | 로그아웃·탈퇴 행 모두 비활성 | 수동 M-7 |
| E-26 | 확장 기능 꺼짐(현재) | 공유 버튼·제외 작품 행 없음, 숨은 캡처 카드 렌더 없음 | 수동 M-8 |

---

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 한 행 = `it` 하나(행 안 입력이 여럿이면 한 `it`에서 모두 assert). 날짜는 시간대 영향이 없도록 `"YYYY-MM-15T12:00:00Z"` 형태를 쓴다. `LibraryListItem` 픽스처는 필요한 필드만 채운 생성 함수로 만든다(`as LibraryListItem`).

### `src/utils/profileStats.test.ts` (신규)

| ID | 입력 | 기대 |
|----|------|------|
| S-1 | `createContentTypeStats([anime, kdrama, other(genres ["드라마"]), movie, other(genres ["다큐멘터리"])])` | type 순서 `["anime","kdrama","jdrama","foreign_drama","movie","other"]`, count `[1,1,0,1,1,1]`, percent `[20,20,0,20,20,20]`, foreign_drama label `"해외 드라마"` |
| S-2 | `createContentTypeStats([])` | 6개, count·percent 모두 0 |
| S-3 | `libraryContentCategory({ content_type: "other", genres: ["드라마"] })`, `({ "other", [] })`, `({ "other", ["Drama"] })`, `({ "jdrama", ["드라마"] })` | `"foreign_drama"`, `"other"`, `"foreign_drama"`, `"jdrama"` |
| S-4 | `createCurrentYearSummary([A: completed, last 2026-03-15; B: wishlist, watch_count 0, last 2026-05-15; C: completed, last 2025-12-15], new Date("2026-10-01T12:00:00Z"))` | `{ label: "올해 본 작품", source: "watched_at", value: 1 }` |
| S-5 | 모든 작품 `last_watched_at: null`, `added_at` 2026·2026·2025, now 2026-10-01 | `{ label: "올해 등록", source: "added_at", value: 2 }` |
| S-6 | `countCurrentYearWatchedItems`(S-4 입력) / (S-5 입력) | `1` / `null` |
| S-7 | `createYearStats([completed 2026 watch 2, completed 2026 watch 0, completed 날짜 없음 watch 1, wishlist 2026 watch 0], "recorded")` | `[{ year: 2026, itemCount: 2, watchCount: 2 }, { year: null, itemCount: 1, watchCount: 1 }]` |
| S-8 | `createYearStats([completed air_year 2020, completed air_year 2022, completed air_year null], "aired")` | `[{ 2022, 1, 0 }, { 2020, 1, 0 }]`(watch_count 0 픽스처) |
| S-9 | `defaultYearStatsMode`(날짜 있는 작품 10개) / (9개) | `"recorded"` / `"aired"` |

### `src/utils/profileDashboard.test.ts` (신규)

| ID | 입력 | 기대 |
|----|------|------|
| L-1 | `getProfileLayout(375)` | `{ gutter: 16, contentWidth: 343, gap: 12, metricColumns: 2, metricWidth: 165, dashboardColumns: 1, panelWidth: 343, panelWide: false }` |
| L-2 | `getProfileLayout(599)` | `{ 16, 567, 12, 2, 277, 1, 567, true }` |
| L-3 | `getProfileLayout(600)` | `{ 24, 552, 16, 4, 126, 1, 552, true }` |
| L-4 | `getProfileLayout(768)` | `{ 24, 720, 16, 4, 168, 1, 720, true }` |
| L-5 | `getProfileLayout(959)` | `{ 24, 911, 16, 4, 215, 1, 911, true }` |
| L-6 | `getProfileLayout(960)` | `{ 24, 912, 16, 4, 216, 2, 448, true }` |
| L-7 | `getProfileLayout(2000)` | `{ 24, 1152, 16, 4, 276, 2, 568, true }` |
| L-8 | `getProfileLayout(NaN)`, `(0)`, `(-1)` | 모두 L-1과 같음 |
| M-1 | `createProfileMetrics({ total: 560, completed: 514, pins: 3, currentYear: { label: "올해 본 작품", value: 35, source: "watched_at" }, now: new Date("2026-10-01T12:00:00Z") })` | `[{ key: "total", label: "등록 작품", value: "560", caption: null, icon: "albums-outline" }, { key: "completed", label: "완료", value: "514", caption: "완료율 92%", icon: "checkmark-done-outline" }, { key: "pins", label: "핀", value: "3", caption: null, icon: "pin-outline" }, { key: "year", label: "올해 본 작품", value: "35", caption: "2026년", icon: "calendar-outline" }]` |
| M-2 | total·completed·pins 모두 `undefined` | 앞 세 개 value `"--"`, completed caption `null` |
| M-3 | `{ total: 0, completed: 0 }` / `{ total: 1234, completed: 1000 }` | caption `null` / total value `"1,234"`, completed value `"1,000"`, caption `"완료율 81%"` |
| T-1 | `createTypeDistribution`(count anime 155, kdrama 273, jdrama 70, foreign_drama 0, movie 53, other 9) | type 순서 `["kdrama","anime","jdrama","movie","other"]` |
| T-2 | anime 2, kdrama 2(입력 순서 anime 먼저) | `["anime","kdrama"]` |
| T-3 | `formatPercent(48.75)`, `(0.4)`, `(0)`, `(100)` | `"49%"`, `"1% 미만"`, `"0%"`, `"100%"` |
| G-1 | `createGenreBreakdown([드라마 50, 로맨스 40, 코미디 30, 액션 20, 스릴러 10, 판타지 5, SF 5])` | total 160, slices 6개: 이름 `["드라마","로맨스","코미디","액션","스릴러","그 외"]`, colorIndex `[0,1,2,3,4,null]`, 그 외 count 10, 드라마 percent `31.25` |
| G-2 | 장르 3개 | "그 외" 없음, slices 3개 |
| G-3 | `[로맨스 3, 드라마 5, 액션 3]` | 이름 순서 `["드라마","로맨스","액션"]` |
| G-4 | `[]` | `{ slices: [], total: 0 }` |
| Y-1 | `createYearChartModel([{2026,35,25},{2025,3,3},{null,498,508}])` | bars `[{ year: 2025, itemCount: 3, watchCount: 3, ratio: 3 / 35 }, { year: 2026, itemCount: 35, watchCount: 25, ratio: 1 }]`, totalItems 536, totalWatches 536, peakYear 2026, unknownCount 498, omittedYearCount 0 |
| Y-2 | 2017~2026 각 itemCount 1 | bars 연도 `[2019..2026]`(8개, 오름차순), omittedYearCount 2 |
| Y-3 | 2024 itemCount 5, 2025 itemCount 5 | peakYear 2025 |
| Y-4 | `[]` | bars `[]`, totalItems 0, totalWatches 0, peakYear null, unknownCount 0, omittedYearCount 0 |
| Y-5 | `yearChartFootnotes`(Y-1 모델) / (Y-2 모델) / (`{ ...Y-1 모델, omittedYearCount: 2 }`) / (Y-4 모델) | `["감상일 기록이 없는 498개는 그래프에서 뺐어요."]` / `["이전 연도 2개는 그래프에서 생략했어요."]` / 두 문장 이 순서 / `[]` |
| Y-6 | 2018 itemCount 100, 2019~2026 각 itemCount 10 | bars 2019~2026, ratio 모두 1, peakYear 2018 |
| Y-7 | `yearChartAccessibilityLabel`(Y-1 모델) / (Y-4 모델) | `"연도별 본 작품: 2025년 3개, 2026년 35개"` / `"연도별 본 작품 기록이 없어요"` |
| E-1 | `userFacingErrorMessage(new Error("닉네임을 입력해 주세요."), "fb")`, `(new Error("duplicate key value"), "fb")`, `("오류", "fb")`, `(null, "fb")` | `"닉네임을 입력해 주세요."`, `"fb"`, `"fb"`, `"fb"` |
| C-1 | 상수 | `YEAR_CHART_MAX_BARS === 8`, `GENRE_TOP_COUNT === 5`, `YEAR_MODE_OPTIONS` = `[{ label: "기록", value: "recorded" }, { label: "방영", value: "aired" }]` |

### 수동 확인 (웹 8081, 로그인 상태 — 사람 또는 로그인된 세션)

| ID | 확인 |
|----|------|
| M-1 | 폭 1440·2000: 첫 화면에 프로필·숫자 4개·타입·장르가 함께 보임, 홈·인물과 왼쪽 시작선 같음 |
| M-2 | 폭 375: 2×2 숫자, 한 열 패널, 장르 도넛 위 |
| M-3 | 해외 드라마가 실제 개수로 보이고 라이브러리 "해외 드라마" 필터 개수와 같음 |
| M-4 | "올해 본 작품" 값 = 연도 그래프의 올해 개수(기록 모드) |
| M-5 | 작품 0개 계정: 빈 상태 하나 + "작품 검색하기" |
| M-6 | 오프라인/느린 네트워크: 스켈레톤 → 오류 하나 + 재시도, 장르만 실패 시 장르 패널만 오류 |
| M-7 | 웹 회원 탈퇴: 확인 2회, 취소 시 무변화, 실패 시 토스트(실제 탈퇴는 테스트 계정에서만). 로그아웃 동작 |
| M-8 | 다른 탭·화면 변화 없음, 확장 기능 꺼짐 상태에서 공유 버튼 없음 |

---

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/libraryFilters.ts` | `LibraryContentCategory`, `libraryContentCategory` 추가, `matchesContentTypeFilter`가 사용 |
| `src/utils/profileStats.ts` | 6.2 (타입 넓힘·분류 수정·올해 개수 규칙·연도 통계 이동) |
| `src/utils/profileStats.test.ts` | 신규. S-1~S-9 |
| `src/utils/profileDashboard.ts` | 신규. 6.3 |
| `src/utils/profileDashboard.test.ts` | 신규. L-1~L-8, M-1~M-3, T-1~T-3, G-1~G-4, Y-1~Y-7, E-1, C-1 |
| `src/utils/confirmDestructive.ts` | 신규. 6.4 |
| `src/constants/contentTypeColors.ts` | `foreign_drama` 색, 키 타입 확장 |
| `src/components/profile/DashboardPanel.tsx` | 신규 |
| `src/components/profile/ProfileHeaderCard.tsx` | 신규 |
| `src/components/profile/MetricTile.tsx` | 신규 |
| `src/components/profile/TypeDistributionPanel.tsx` | 신규 |
| `src/components/profile/GenreBreakdownPanel.tsx` | 신규 |
| `src/components/profile/YearActivityPanel.tsx` | 신규 |
| `src/components/profile/AccountSection.tsx` | 신규 |
| `src/components/profile/ProfileSkeleton.tsx` | 신규 |
| `app/(tabs)/profile.tsx` | 6.7로 재구성 |
| `app/(tabs)/_layout.tsx` | `profile`에 `headerShown: false` |
| `src/components/stats/TypeStatsSection.tsx` | 삭제(사용처 `profile.tsx`뿐) |
| `src/components/stats/YearStatsSection.tsx` | 삭제(로직은 `profileStats.ts`로 이동) |
| `src/components/stats/GenreStatsSection.tsx` | 삭제(사용처 `profile.tsx`뿐) |

---

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| `TasteReportCard`와 공유 모달 모양 | 확장 기능(꺼짐). 타입 분류 수정은 `typeStats`를 통해 자동 반영 |
| `get_genre_stats` RPC·장르 이름 정규화 | 데이터 계층. 표시는 기존 `createDisplayGenreStats` 결과를 쓴다 |
| `getLibraryStats`의 "완료" 수(단일 `status` 열 기준)와 연도 통계 "본 작품"(여러 상태 포함) 정의 차이 | 의미가 다른 숫자다. 라벨로 구분된다 |
| `delete-account` Edge Function 배포 | `docs/35` 2절에서 미배포 확인. 이번 수정 후 웹 탈퇴가 실행되면 배포 전에는 실패 토스트가 뜬다. 배포는 사람이 한다 |
| 프로필 사진 업로드(`avatar_url`) | 기능 추가 |
| 홈·인물·검색·라이브러리·핀 탭 | 다른 화면 |
| 기존 실패 테스트 `recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library" | 이 작업 전부터 실패. 별도 수정 |
| 다크 모드 | `docs/32` 4장 |

---

## 13. 확실하지 않음 — 별도 검증 필요

1. **R-5 원인**: "올해 본 작품 36"과 "2026년 35개"의 차이 1을 "날짜는 있지만 본 상태가 아닌 작품"으로 추정했다. 수정 후 M-4에서 두 값이 같은지 확인한다. 다르면 원인을 보고한다.
2. **gifted-charts `PieChart` 반지름 72에서 웹 렌더**: 기존 104에서 줄인다. 가운데 라벨이 잘리지 않는지 M-1·M-2에서 확인.
3. **세로 막대의 `width: "60%"` + `maxWidth: 28`**: RN Web에서 퍼센트 폭이 열 폭 기준으로 계산되는지 확인.
4. **`window.confirm` 연속 2회**: 일부 브라우저가 연속 대화상자를 막는 설정이 있다. M-7에서 확인.

---

## 14. 후속 변경 (2026-10-01, 직접 구현)

사용자 피드백: "등록 작품 수와 감상한 작품 수 등 맞지 않는 통계가 있다", "감상 연도별·작품 연도별 그래프는 중복이니 합쳐라". 이 장이 위 D-3·D-6·D-7과 6.3의 해당 계약을 대체한다.

| 항목 | 이전 | 이후 |
|------|------|------|
| 숫자 카드 | 등록(DB 행 수)·완료(DB `status` 열)·핀·올해 본 작품 — 출처가 섞여 560/514/536이 서로 설명되지 않음 | 등록·본 작품·완료·핀. 앞 셋은 모두 라이브러리 목록 한 곳(`createLibraryStatusSummary`)에서 센다. 캡션으로 포함 관계를 밝힌다: 등록 "보고 싶음 N개 포함", 본 작품 "보는 중·보류 등 N개 포함", 완료 "본 작품의 N%". 핀만 DB 집계 |
| 올해 본 작품 카드 | 별도 카드 | 연도 그래프 요약("2026년에 본 작품")으로 이동(중복 제거) |
| 장르 | RPC(`get_genre_stats`, content_id 기준) 태그 비율 도넛, 가운데 숫자는 라이브러리 행 수 — 기준이 서로 다름 | 라이브러리 행에서 직접 센 TOP 5 막대(`createGenreRanking`). 비율 = 등록 작품 중 그 장르 작품 비율, 막대 길이 = 그 비율. 합이 100%를 넘을 수 있다는 각주 |
| 연도 그래프 | "감상 연도별"·"작품 연도별" 두 패널 | "연도별 감상" 한 패널(`createYearComparisonModel`, `YearComparisonPanel`). 같은 "본 작품" 묶음을 연도마다 본 해(파랑)·공개 연도(회색) 두 막대로. 넓은 화면 12년, 좁은 화면 8년. 각주: 감상일 기록 수와 빠진 수, 공개 연도 미상 수, 생략 연도 수 |
| 시청 횟수 | 요약에 "시청 N회" | 제거(본 작품 수와 거의 같아 혼란만 줌) |

삭제: `createCurrentYearSummary`, `createYearStats`, `defaultYearStatsMode`, `countItemsWithWatchedDate`, `createGenreBreakdown`, `createYearChartModel`, `YearActivityPanel`, `GenreBreakdownPanel`. 테스트: `profileDashboard.test.ts` M·G·Y·C, `profileStats.test.ts` S-4~S-6을 새 계약으로 교체.
