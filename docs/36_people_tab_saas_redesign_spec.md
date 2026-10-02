# 36. 인물 탭 SaaS 스타일 개편 명세

작성일: 2026-10-01
대상 브랜치 기준: `main` (`26e220e`, 워킹 트리 clean. 이 시점 `npm test` 717개 중 716개 통과 — 실패 1개는 이 작업과 무관한 기존 결함, 12장)
선행 문서: `docs/32_home_modern_redesign_spec.md`(디자인 토큰·단일 콘텐츠 컨테이너·2단계 범위), `docs/34_search_seasons_and_people_restore_spec.md`(인물 기능 복원), `docs/19_mobile_usability_spec.md`(M-05 터치 44pt), `docs/31_usability_review_fixes_spec.md`(U-10 오류·빈 상태 동시 표시 금지, 피드백은 토스트)

> **근거.** 사용자가 보낸 인물 탭 캡처(넓은 웹 폭 약 2000px)와 코드(`app/(tabs)/people.tsx` 260행, `app/(tabs)/_layout.tsx`, `src/hooks/usePeople.ts`, `src/services/people.ts`)를 대조했다. 로그인 이후 화면을 직접 실측하지는 않았다.
> 사용자 요청: "인물화면은 예전 그대로인데 UI적으로 SaaS 스타일로 개선해줘". `docs/32`가 2단계로 미룬 "다른 화면을 같은 토큰으로 옮기기"의 첫 화면이다.

---

## 1. 문제 정의

| ID | 증상 (캡처 기준) | 코드상 원인 |
|----|-----------------|-------------|
| P-1 | 맨 위 작은 "인물" 헤더 아래에 큰 "좋아하는 배우/성우" 제목이 또 있다. 홈·핀 탭과 상단 모양이 다르다 | 기본 탭 헤더(`app/(tabs)/_layout.tsx:47~53`, `headerShown` 미지정) + 화면 내 제목(`people.tsx:48`) |
| P-2 | 넓은 화면에서 행이 좌우 끝까지 늘어나 이름과 "삭제" 버튼이 약 1,800px 떨어져 있다 | 콘텐츠 최대 폭 없음, 행이 전체 폭 `flexDirection: "row"` + 버튼 오른쪽 끝(`people.tsx:154~159, 205~214`) |
| P-3 | 모든 행에 **파란 채움 "삭제" 버튼**이 있어 화면에서 가장 강조된 요소가 삭제다. 누르면 확인·되돌리기 없이 바로 사라진다 | `actionLabel="삭제"` + `styles.actionButton` primary 채움(`people.tsx:105~109, 240~245`) |
| P-4 | 행 전체가 눌리는데 파란 "상세 보기" 글자가 또 있다. 링크처럼 보이는 글자가 행마다 반복된다 | `detailHint`(`people.tsx:144`) |
| P-5 | 프로필 사진이 48×64 세로 사각형이다. 사진이 없으면 빈 회색 상자만 보인다 | `styles.profile`(`people.tsx:216~221`), 이니셜 대체 없음 |
| P-6 | 배우·성우 칩(전체/배우/성우)이 검색어가 없을 때도 보이지만 눌러도 아무 변화가 없다 | `category`는 `usePersonContentSearch`에만 전달(`people.tsx:24`). 좋아하는 인물 목록에는 적용 안 됨 |
| P-7 | 글자가 전반적으로 무겁다 | 제목·이름·버튼·칩 대부분 `fontWeight: "900"`(`people.tsx:163, 204, 229, 253`). `docs/32`의 `typography` 토큰 미사용 |
| P-8 | 검색 결과에서 한 명을 "등록"하는 동안 **모든 행의 등록 버튼**이 비활성화된다 | `disabled={saved \|\| addFavorite.isPending}`(`people.tsx:86`) |
| P-9 | 등록·삭제가 실패해도 아무 안내가 없다 | `mutate`에 오류 처리 없음(`people.tsx:33, 108`) |
| P-10 | 글자를 칠 때마다 Edge Function을 호출하고, 결과가 스켈레톤으로 바뀌었다 돌아온다 | `usePersonContentSearch(query, …)`에 입력값을 그대로 전달. 키가 매 글자 바뀜(`people.tsx:24`, `usePeople.ts:8~15`) |
| P-11 | 1글자 입력 시 아무 반응이 없다(2글자부터 검색) | `query.trim().length >= 2`일 때만 섹션 표시(`people.tsx:72`), 안내 없음 |
| P-12 | 목록 불러오기 오류일 때 오류 박스와 "등록된 인물이 없습니다"가 같이 보인다 | 빈 상태 조건에 `!isError` 없음(`people.tsx:100`). `docs/31` U-10과 같은 유형 |

---

## 2. 목표 모습

```
┌ 콘텐츠 컨테이너 (최대 1200, 가운데, 좌우 16/24 — 홈과 같은 시작선) ─────────────┐
│ 인물                                                       (display)          │
│ 좋아하는 배우·성우를 모아 두고 출연작을 바로 찾아보세요.        (body, muted)     │
│                                                                              │
│ [🔍 배우 또는 성우 이름              ⊗]   [ 전체 | 배우 | 성우 ]               │ ← 600 이상: 한 줄
│  두 글자 이상 입력하면 검색해요.  (1글자일 때만)                                 │ ← 600 미만: 두 줄
│                                                                              │
│ 검색 결과 (12)                                   ← 검색어 2자 이상일 때만        │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐   │
│ │ (◯) 박신혜     [+추가] │ │ (◯) 박신양   [✓추가됨] │ │ ...                  │   │
│ │     朴信惠             │ │                       │ │                      │   │
│ │     [배우] 피노키오 · … │ │     [배우] 파리의 연인 │ │                      │   │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘   │
│                                                                              │
│ 내가 좋아하는 인물 (5)                                                         │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐   │
│ │ (◯) 사카이 마사토  ♥  │ │ (◯) 토다 에리카   ♥  │ │ (◯) 花江夏樹      ♥  │   │
│ │     堺雅人             │ │     戸田恵梨香         │ │     Natsuki Hanae    │   │
│ │     [성우] VIVANT      │ │     [배우] 지옥에 …    │ │     [성우] 고깔모자…  │   │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- 카드 열 수: 600 미만 1열, 600~959 2열, 960 이상 3열(홈 "최근 핀"과 같은 구간).
- 같은 행의 카드는 높이가 같다.
- ♥는 "좋아하는 인물에서 빼기" 아이콘 버튼. 누르면 카드가 사라지고 토스트 "○○ 님을 좋아하는 인물에서 뺐어요. [되돌리기]".

---

## 3. 재현 시나리오

1. 웹 8081, 폭 1440 이상에서 로그인 후 하단 "인물" 탭.
2. 상단에 "인물"(기본 헤더)과 "좋아하는 배우/성우"(화면 제목)가 두 번 보인다 → P-1.
3. 등록된 인물 행에서 이름과 오른쪽 끝 파란 "삭제" 버튼 사이가 화면 대부분을 차지한다 → P-2, P-3.
4. 검색어 없이 "성우" 칩을 누른다 → 목록 변화 없음 → P-6.
5. "박신혜" 입력 → 글자마다 스켈레톤 깜빡임 → P-10. 결과 하나 "등록" → 다른 모든 행의 "등록"이 잠깐 흐려짐 → P-8.
6. 네트워크를 끊고 새로고침 → 오류 박스와 "등록된 인물이 없습니다"가 같이 보임 → P-12.

---

## 4. 설계 결정

### D-1. `docs/32`의 토큰과 격자 구간을 그대로 쓴다
- 색·모서리·글자·그림자는 `src/constants/theme.ts`의 `colors`, `radius`, `typography`, `elevation`만 쓴다. **16진 색을 화면 파일에 직접 쓰지 않는다**(핀 탭의 `#0F172A` 같은 값 금지). `fontWeight: "900"`을 쓰지 않는다.
- 폭·열·간격은 새 순수 함수 `getPeopleLayout(width)`가 정한다. 이 함수는 `getHomeLayout(width)`의 `gutter`·`contentWidth`·`pinColumns`·`posterGap`·`pinWidth`를 그대로 옮긴다. 구간을 새로 정의하지 않아 홈과 인물 탭의 시작선·열 구간이 항상 같다.
- `theme.ts`, `homeLayout.ts`는 **수정하지 않는다.**

### D-2. 인물 탭은 기본 탭 헤더를 숨기고 화면 안에 제목을 둔다
`app/(tabs)/_layout.tsx`의 `people` 항목에 `headerShown: false`. 화면 맨 위는 `insets.top + 12` 여백 뒤 "인물"(`typography.display`) + 설명 한 줄(`typography.body`, `textMuted`). 홈(`docs/32` H-6)과 같은 방식이다. 다른 탭의 헤더는 바꾸지 않는다.

### D-3. 검색 결과와 좋아하는 인물은 같은 카드 하나로 그린다
새 `PersonCard`가 두 목록을 모두 그린다. 차이는 오른쪽 행동뿐이다(검색 결과: 추가 버튼, 좋아하는 인물: ♥ 빼기 버튼). 카드는 격자 셀 폭(`cardWidth`) 안에 있으므로 이름과 행동 사이 거리가 카드 폭을 넘지 않는다(P-2).

### D-4. 빼기는 강조하지 않고, 확인 대신 되돌리기를 준다
- ♥ 아이콘 버튼(채운 하트, `colors.danger`, 배경 없음, 눌림 시 `dangerSoft`). 파란 채움 버튼을 쓰지 않는다.
- 확인 대화상자를 띄우지 않는다. 성공하면 `useAppUIStore.addToast(message, "info", { actionLabel: "되돌리기", onAction })`. 되돌리기는 같은 인물 정보로 다시 추가한다(`addFavoritePerson`은 `user_id,source,external_id` upsert).
- 근거: 좋아하는 인물 행에는 사용자가 쓴 기록(메모·평점·진행)이 없고 외부 메타데이터뿐이라 되돌리기로 완전히 복구된다. `docs/31` U-2의 "삭제 확인"은 감상 기록이 함께 사라지는 라이브러리 삭제에만 해당한다. 웹에서 `Alert.alert`는 동작하지 않는다(`docs/31` 5장).

### D-5. 분류(전체/배우/성우)는 검색과 좋아하는 인물 목록에 함께 적용한다
- 검색: 지금처럼 `usePersonContentSearch(query, category)`로 서버에 전달.
- 좋아하는 인물: 클라이언트에서 `filterFavoritePeople(favorites, category)`. 섹션 개수 배지도 거른 뒤 개수.
- 컨트롤은 칩 대신 **세그먼트 컨트롤**(회색 트랙 안에 선택 항목만 흰 배경 + 그림자). 새 공용 컴포넌트 `SegmentedControl`.

### D-6. 인물 검색은 입력이 300ms 멈춘 뒤 요청한다
- 새 훅 `useDebouncedValue(value, 300)`. `usePersonContentSearch`에는 디바운스된 값을 넘긴다.
- 스켈레톤은 **보여줄 결과가 없을 때만**(`shouldShowPersonSearchSkeleton`). 입력 중에는 직전 결과를 유지한다.
- 1글자일 때 "두 글자 이상 입력하면 검색해요." 안내(`getPeopleSearchState`). 최소 글자 수 2는 기존 훅·서비스와 같다.
- 검색어 지우기(⊗) 버튼.

### D-7. 추가 중 상태는 인물별로, 결과가 반영될 때까지 유지한다
- 화면이 `pendingAddKeys`, `pendingRemoveIds`(Set)를 들고 해당 카드만 비활성화한다(P-8).
- 각 요청은 `mutateAsync` + `try/catch/finally`로 처리한다. TanStack Query v5에서 `mutate(vars, { onSettled })`의 호출별 콜백은 연속 호출 시 **마지막 호출에만** 실행되므로 Set 정리에 쓰지 않는다.
- `useAddFavoritePerson`, `useDeleteFavoritePerson`의 `onSuccess`가 `invalidateQueries`의 **Promise를 반환**하게 한다(현재는 반환하지 않음, `usePeople.ts:50~52, 61~63`). 그러면 `mutateAsync`가 목록 재조회 후에 끝나서 "추가 중 → 추가 → 추가됨" 깜빡임이나 빼기 후 카드가 잠깐 다시 보이는 일이 없다. 이 두 줄 외에 훅을 바꾸지 않는다.

### D-8. 실패는 토스트로 알린다
- 추가 실패: `인물을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.` (`"error"`)
- 빼기 실패: `인물을 빼지 못했어요. 잠시 후 다시 시도해 주세요.` (`"error"`)
- 오류 원문(Supabase 영문 메시지)은 토스트에 넣지 않는다.

### D-9. 터치 영역 44pt (`docs/19` M-05)
검색창 높이 48, 세그먼트 컨트롤 높이 44, ♥ 버튼 시각 36 + `hitSlop` 4, 추가 버튼 시각 높이 32 + `hitSlop` 상하 6, ⊗ 버튼 아이콘 18 + `hitSlop` 13.

### D-10. 판정·문구·레이아웃은 `src/utils/peopleScreen.ts` 순수 함수가 정한다
화면 파일은 그 결과를 그리기만 한다. 테스트 파일은 `react-native`·`expo-*`·Supabase를 import하지 않는다.

### D-11. 데이터·라우팅은 바꾸지 않는다
`src/services/people.ts`, `usePersonContentSearch`·`useFavoritePeople`·`usePersonDetail`, 인물 상세 이동 파라미터(`/people/[id]`, `id`·`source`·`externalId`·`category`), `PEOPLE_FEATURES_ENABLED` 분기, 하단 탭 아이콘·라벨은 그대로다. DB·Edge Function 변경 없음.

---

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 지금처럼 전체 폭 행 목록 + 최대 폭만 제한 | 1200 폭에서도 이름과 버튼이 1,000px 이상 떨어진다. 넓은 화면에서 한 화면에 보이는 인물 수도 적다 |
| 빼기 전에 확인 대화상자 | 되돌릴 수 있는 가벼운 행동에 마찰만 늘린다. 웹 `Alert.alert` 미동작 문제도 있다(D-4) |
| 스와이프로 빼기 | 웹·마우스에서 발견할 수 없다 |
| "검색"과 "좋아하는 인물"을 별도 탭/세그먼트로 분리 | 검색은 곧바로 추가하는 도구라 같은 화면에 있어야 흐름이 끊기지 않는다 |
| 홈의 `SectionHeader`를 공용 컴포넌트로 추출 | 홈 파일을 건드리게 된다. 2단계 공통화는 별도 작업 |
| 새 레이아웃 구간(예: 4열) 정의 | 홈과 시작선·구간이 달라진다(D-1) |
| `placeholderData: keepPreviousData`로 입력 중 결과 유지 | 공용 훅 동작이 바뀌어 검색 탭(`app/search.tsx`)에도 영향이 간다. 화면 쪽 디바운스로 충분 |
| 인물 상세 화면까지 함께 개편 | 1,201행 화면이라 검증 범위가 너무 커진다. 별도 명세 |

---

## 6. 계약

### 6.1 `src/utils/peopleScreen.ts` (신규, 순수)

```ts
import type { PersonCategory, PersonSearchResult } from "@/types/people";   // import type만
import { getHomeLayout } from "@/utils/homeLayout";

export const PERSON_SEARCH_MIN_LENGTH = 2;
export const PERSON_SEARCH_DEBOUNCE_MS = 300;
export const PEOPLE_CATEGORY_OPTIONS: readonly { label: string; value: PersonCategory | "all" }[] = [
  { label: "전체", value: "all" },
  { label: "배우", value: "actor" },
  { label: "성우", value: "voice_actor" }
];

export interface PeopleLayout {
  gutter: number; contentWidth: number; columns: number; gap: number; cardWidth: number; stackSearchTools: boolean;
}
export function getPeopleLayout(width: number): PeopleLayout;
// home = getHomeLayout(width) → { gutter: home.gutter, contentWidth: home.contentWidth, columns: home.pinColumns,
//   gap: home.posterGap, cardWidth: home.pinWidth, stackSearchTools: w < 600 }
// w = Number.isFinite(width) && width > 0 ? width : 375 (getHomeLayout과 같은 정규화)

export function personKey(person: Pick<PersonSearchResult, "source" | "external_id">): string;  // `${source}:${external_id}`
export function personCategoryLabel(category: PersonCategory): "배우" | "성우";
export function personInitial(name: string): string;
// trim 후 Array.from(...)[0]를 toLocaleUpperCase(). 빈 문자열이면 "?"

export interface PersonCardModel {
  key: string; name: string; secondaryName: string | null; categoryLabel: "배우" | "성우";
  knownForText: string | null; accessibilityLabel: string;
}
export function createPersonCardModel(person: PersonSearchResult): PersonCardModel;
// name: person.name.trim(), 비면 "이름 없음"
// secondaryName: original_name?.trim()이 비어 있지 않고 name과 다르면 그 값, 아니면 null
// knownForText: known_for 각 항목 trim → 빈 값 제거 → 앞에서부터 중복 제거 → 앞 3개를 " · "로. 없으면 null
// accessibilityLabel: `${name}, ${categoryLabel}${knownForText ? `, 대표작 ${knownForText}` : ""}, 상세 보기`

export function filterFavoritePeople<T extends Pick<PersonSearchResult, "category">>(
  people: readonly T[], category: PersonCategory | "all"
): T[];   // "all"이면 전부(새 배열), 아니면 category 일치만. 순서 유지

export type FavoriteActionState = "add" | "adding" | "added";
export function getFavoriteActionState(key: string, favoriteKeys: ReadonlySet<string>, pendingKeys: ReadonlySet<string>): FavoriteActionState;
// favoriteKeys에 있으면 "added"(pending이어도) → pendingKeys에 있으면 "adding" → "add"

export function favoriteAddCopy(state: FavoriteActionState, name: string): { label: string; accessibilityLabel: string; disabled: boolean };
// add    → { "추가",   `${name} 좋아하는 인물에 추가`, false }
// adding → { "추가 중", `${name} 추가 중`,             true }
// added  → { "추가됨", `${name} 이미 추가됨`,          true }

export function favoriteRemoveCopy(name: string): { accessibilityLabel: string; toastMessage: string };
// { `${name} 좋아하는 인물에서 빼기`, `${name} 님을 좋아하는 인물에서 뺐어요.` }

export function toPersonSearchResult(person: PersonSearchResult): PersonSearchResult;
// source·external_id·category·name·original_name·profile_url·known_for(새 배열)만 복사. FavoritePerson의 id·user_id·created_at·updated_at 제거

export type PeopleSearchState = "idle" | "too_short" | "search";
export function getPeopleSearchState(query: string): PeopleSearchState;
// trim 길이 0 → idle, 1 → too_short, ≥ PERSON_SEARCH_MIN_LENGTH → search

export function shouldShowPersonSearchSkeleton(input: { isLoading: boolean; hasData: boolean; query: string; debouncedQuery: string }): boolean;
// getPeopleSearchState(query) !== "search" → false
// isLoading → true
// !hasData && query.trim() !== debouncedQuery.trim() → true
// 그 외 false

export function personSearchEmptyCopy(query: string): { title: string; description: string };
// { `"${query.trim()}" 검색 결과가 없어요`, "이름 철자를 바꾸거나 원어 이름으로 검색해 보세요." }

export function favoriteEmptyCopy(category: PersonCategory | "all", totalCount: number): { title: string; description: string };
// totalCount 0 또는 category "all" → { "아직 좋아하는 인물이 없어요", "배우나 성우를 검색해서 추가해 보세요." }
// actor       → { "좋아하는 배우가 없어요", "다른 분류를 보거나 배우를 검색해서 추가해 보세요." }
// voice_actor → { "좋아하는 성우가 없어요", "다른 분류를 보거나 성우를 검색해서 추가해 보세요." }
```

> `@/` 별칭 값 import는 테스트에서도 풀린다(`src/utils/airingAvailability.ts`가 `@/utils/episodeProgress`를 값으로 import). 기존 utils와 같이 `@/`를 쓴다.

### 6.2 `src/hooks/useDebouncedValue.ts` (신규)

```ts
export function useDebouncedValue<T>(value: T, delayMs: number): T;
// useState + useEffect(setTimeout/clearTimeout). 첫 렌더는 value 그대로
```

### 6.3 `src/components/common/SegmentedControl.tsx` (신규)

```ts
interface SegmentedControlProps<T extends string> {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;     // 그룹 설명, 예: "인물 분류"
  stretch?: boolean;              // true면 각 항목 flex: 1 (좁은 화면)
}
```
- 트랙: `colors.surfaceMuted`, `radius.pill`, padding 4, 높이 44.
- 항목: `accessibilityRole="button"`, `accessibilityState={{ selected }}`, `minWidth` 64, 가로 padding 16. 선택: `colors.surface` + `elevation.card` + `colors.text`, 비선택: `colors.textMuted`. 글자 `typography.label`.

### 6.4 `src/components/people/PersonAvatar.tsx` (신규)

```ts
interface PersonAvatarProps { name: string; profileUrl: string | null; size: number }
```
- 원형(`borderRadius: size / 2`), `colors.surfaceMuted` 배경, `StyleSheet.hairlineWidth` `colors.border` 테두리.
- `profileUrl`이 있으면 `AppImage`(cover), 없으면 가운데 `personInitial(name)`(`typography.headline`, `colors.textMuted`).
- `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`(카드가 라벨을 가진다).

### 6.5 `src/components/people/PersonCard.tsx` (신규)

```ts
export type PersonCardAction =
  | { kind: "add"; state: FavoriteActionState; onPress: () => void }
  | { kind: "remove"; pending: boolean; onPress: () => void };

interface PersonCardProps { person: PersonSearchResult; width: number; action: PersonCardAction; onOpen: () => void }
export function PersonCard(props: PersonCardProps): JSX.Element;   // memo
export function PersonCardSkeleton({ width }: { width: number }): JSX.Element;
```
- 셀: `{ width }`, `alignSelf: "stretch"`. 카드: `flexGrow: 1`, `flexDirection: "row"`, `alignItems: "center"`, `gap: spacing.md`, `padding: spacing.lg`, `minHeight: 88`, `colors.surface`, `radius.lg`, hairline `colors.border`, `elevation.card`.
- 왼쪽 `Pressable`(flex 1, `minWidth: 0`, 아바타 + 본문, `accessibilityRole="button"`, `accessibilityLabel={model.accessibilityLabel}`, 눌림 `opacity: 0.72`) → `onOpen`.
  - 아바타 56.
  - 본문(flex 1, `minWidth: 0`, gap 2): 이름(`typography.headline`, 1줄) / `secondaryName`(`typography.caption`, `textMuted`, 1줄, 있을 때만) / 메타 줄(가로, gap 6): 분류 배지 + `knownForText`(`typography.caption`, `textMuted`, 1줄, `flexShrink: 1`).
  - 분류 배지: `radius.pill`, 가로 padding 8, 세로 2, `typography.micro`. 배우 `primarySoft`/`primary`, 성우 `warningSoft`/`warning`.
- 오른쪽 행동(왼쪽 Pressable의 **형제**, 중첩 금지):
  - `add`: 알약 버튼 높이 32, 가로 padding 12, `hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}`, 아이콘 16 + `typography.label`. `add` = 흰 배경 + `primary` 테두리·글자, 아이콘 `add`. `adding` = 같은 모양 `opacity: 0.6`. `added` = `successSoft` 배경 + `success` 글자, 아이콘 `checkmark`, 테두리 없음. 문구·라벨·비활성은 `favoriteAddCopy`.
  - `remove`: 36×36 원형 아이콘 버튼, 아이콘 `heart` 20 `colors.danger`, `hitSlop` 4, 눌림 배경 `dangerSoft`, `pending`이면 `disabled` + `opacity: 0.5`. 라벨 `favoriteRemoveCopy(name).accessibilityLabel`.
- 스켈레톤: 같은 카드 틀에 56 원 + 막대 2개(`surfaceMuted`). `accessibilityElementsHidden`.

### 6.6 화면 판정 순서 (`app/(tabs)/people.tsx`)

검색 섹션(`searchState === "search"`일 때만 렌더):
1. `shouldShowPersonSearchSkeleton(...)` → 스켈레톤 카드 3개(격자).
2. `search.isError` → `ErrorState`(재시도 `search.refetch()`). 빈 상태는 함께 보이지 않는다.
3. `search.data.people.length === 0` → `EmptyState`(`personSearchEmptyCopy(search.data.query || debouncedQuery)`).
4. 그 외 → 카드 격자. `search.data.failedSources.length > 0`이면 격자 위에 `일부 외부 API 결과가 표시되지 않을 수 있습니다.`(검색 탭과 같은 문구, `typography.caption`, `textMuted`).

좋아하는 인물 섹션(항상 렌더):
1. `favorites.isLoading` → 스켈레톤 카드 3개.
2. `favorites.isError` → `ErrorState`(재시도). 빈 상태는 함께 보이지 않는다(P-12).
3. 걸러진 목록이 비었으면 → `EmptyState`(`favoriteEmptyCopy(category, favorites.data?.length ?? 0)`).
4. 그 외 → 카드 격자.

섹션 머리: 제목(`typography.title`) + 개수 배지(`surfaceMuted` 알약, `typography.label`, `textMuted`). 검색 결과 배지 = `search.data.people.length`(목록을 그릴 때만), 좋아하는 인물 배지 = 걸러진 개수(목록을 그릴 때만). 머리 `marginTop: 28`, `marginBottom: spacing.md`(홈과 같음).

---

## 7. 데이터 모델 / SQL

없음. `favorite_people` 테이블·RLS·Edge Function 변경 없음.

---

## 8. 화면 명세

### 8.1 `app/(tabs)/_layout.tsx`
`people` 항목 `options`에 `headerShown: false` 한 줄 추가. 그 외 변경 없음.

### 8.2 `app/(tabs)/people.tsx` 전체 구조

```
ScrollView (flex 1, colors.background, keyboardShouldPersistTaps="handled", keyboardDismissMode="on-drag",
            contentContainerStyle paddingBottom 96)
└ View content (width 100%, maxWidth HOME_CONTENT_MAX_WIDTH, alignSelf center, paddingHorizontal layout.gutter)
  ├ 머리 (paddingTop insets.top + 12): "인물" / 설명
  ├ 검색 도구 (marginTop spacing.lg; stackSearchTools ? column gap 12 : row gap 12 alignItems center)
  │  ├ 검색창 (flex 1 / 세로 쌓임이면 alignSelf stretch): 높이 48, radius.pill, surface, hairline border,
  │  │   paddingHorizontal 16, gap 8, 아이콘 search 18 textMuted, TextInput(flex 1, typography.body,
  │  │   placeholder "배우 또는 성우 이름", placeholderTextColor textSubtle, accessibilityLabel "인물 검색",
  │  │   autoCorrect false, autoCapitalize "none", returnKeyType "search"), 값이 있으면 ⊗(close-circle 18,
  │  │   accessibilityLabel "검색어 지우기")
  │  └ SegmentedControl (options PEOPLE_CATEGORY_OPTIONS, accessibilityLabel "인물 분류", stretch = stackSearchTools)
  ├ too_short 안내 (typography.caption, textMuted, marginTop spacing.sm): "두 글자 이상 입력하면 검색해요."
  ├ 검색 결과 섹션 (6.6)
  └ 좋아하는 인물 섹션 (6.6) — 제목 "내가 좋아하는 인물"
```
- 격자: `flexDirection: "row"`, `flexWrap: "wrap"`, `alignItems: "stretch"`, `gap: layout.gap`. 카드 폭 `layout.cardWidth`.
- 설명 문구: `좋아하는 배우·성우를 모아 두고 출연작을 바로 찾아보세요.`
- 화면 파일에 `fontWeight` 숫자 문자열, 16진 색을 직접 쓰지 않는다(토큰 사용).

### 8.3 행동

```ts
const addToast = useAppUIStore((state) => state.addToast);

async function add(person: PersonSearchResult) {
  const key = personKey(person);
  setPendingAddKeys((previous) => new Set(previous).add(key));
  try {
    await addFavorite.mutateAsync(toPersonSearchResult(person));
  } catch {
    addToast("인물을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.", "error");
  } finally {
    setPendingAddKeys((previous) => { const next = new Set(previous); next.delete(key); return next; });
  }
}

async function remove(person: FavoritePerson) {
  setPendingRemoveIds((previous) => new Set(previous).add(person.id));
  try {
    await deleteFavorite.mutateAsync(person.id);
    addToast(favoriteRemoveCopy(person.name).toastMessage, "info", {
      actionLabel: "되돌리기",
      onAction: () => void add(person)
    });
  } catch {
    addToast("인물을 빼지 못했어요. 잠시 후 다시 시도해 주세요.", "error");
  } finally {
    setPendingRemoveIds((previous) => { const next = new Set(previous); next.delete(person.id); return next; });
  }
}
```
- 상세 이동(`openPerson`)은 기존 코드 그대로.
- `favoriteKeys`는 `favorites.data` 전체(분류로 거르기 전) 기준.

---

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 검색어 1글자 | 요청 없음, "두 글자 이상 입력하면 검색해요." | P-14 |
| E-2 | 공백만 입력 | idle. 안내·검색 섹션 없음 | P-14 |
| E-3 | 빠르게 "박신혜" 입력 | 멈춘 뒤 300ms에 1회 요청. 직전 결과가 있으면 스켈레톤 없이 유지 | P-15, P-18 |
| E-4 | 첫 입력(직전 결과 없음) 디바운스 중 | 스켈레톤 | P-15 |
| E-5 | ⊗ 누름 | 검색어 비움 → 검색 섹션 사라짐 | 수동 M-3 |
| E-6 | 검색 결과에 이미 좋아하는 인물 | "추가됨", 비활성 | P-10, P-11 |
| E-7 | 두 사람을 연달아 추가 | 각 카드만 "추가 중", 둘 다 끝나면 "추가됨" | P-10, 수동 M-4 |
| E-8 | 추가 실패 | 오류 토스트, 버튼은 "추가"로 돌아옴 | 수동 M-6 |
| E-9 | ♥ 누름 | 재조회 후 카드 사라짐, 되돌리기 토스트 | P-12, 수동 M-5 |
| E-10 | 되돌리기 | 같은 인물 다시 추가. 목록 맨 앞(생성 시각 새로 기록)에 나타나도 정상 | P-13 |
| E-11 | ♥ 연타 | 처리 중인 카드의 ♥ 비활성 | 수동 M-5 |
| E-12 | 빼기 실패 | 오류 토스트, 카드 유지 | 수동 M-6 |
| E-13 | 분류 "성우"인데 좋아하는 성우 없음(배우는 있음) | "좋아하는 성우가 없어요" | P-9, P-17 |
| E-14 | 좋아하는 인물 0명 | "아직 좋아하는 인물이 없어요" | P-17 |
| E-15 | 프로필 사진 없음 | 이니셜 원형 | P-3 |
| E-16 | 원어 이름이 이름과 같음/없음 | 둘째 줄 생략 | P-5 |
| E-17 | 대표작 중복·공백·4개 이상 | 정리 후 앞 3개 | P-6 |
| E-18 | 이름이 빈 문자열 | "이름 없음", 이니셜 "?" | P-3, P-8 |
| E-19 | 폭 375 | 1열, 검색창·세그먼트 세로 쌓임, 세그먼트 항목 균등 폭 | L-1 |
| E-20 | 폭 2000 | 3열, 콘텐츠 1152 가운데 | L-6 |
| E-21 | 목록 오류 | 오류만, 빈 상태 없음 | 수동 M-6 |
| E-22 | 일부 제공처 실패 | 결과 위 안내 한 줄 | 수동 M-3 |
| E-23 | 키보드 열린 채 "추가" 탭 | 한 번에 추가(키보드 닫기용 탭으로 소모되지 않음) | 수동 M-4 |
| E-24 | 되돌리기 전에 다른 탭으로 이동 | 되돌리기가 그대로 동작하거나, 실패하면 아무 일 없음(앱 오류 없음) | 수동 M-5 |

---

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 파일: `src/utils/peopleScreen.test.ts`. `node:test` + `node:assert/strict`. 한 행 = `it` 하나(행 안의 입력이 여럿이면 한 `it`에서 모두 assert).

| ID | 입력 | 기대 |
|----|------|------|
| L-1 | `getPeopleLayout(375)` | `{ gutter: 16, contentWidth: 343, columns: 1, gap: 12, cardWidth: 343, stackSearchTools: true }` |
| L-2 | `getPeopleLayout(599)` | `{ 16, 567, 1, 12, 567, true }` |
| L-3 | `getPeopleLayout(600)` | `{ 24, 552, 2, 16, 268, false }` |
| L-4 | `getPeopleLayout(768)` | `{ 24, 720, 2, 16, 352, false }` |
| L-5 | `getPeopleLayout(960)` | `{ 24, 912, 3, 16, 293, false }` |
| L-6 | `getPeopleLayout(2000)` | `{ 24, 1152, 3, 16, 373, false }` |
| L-7 | `getPeopleLayout(NaN)`, `(0)`, `(-1)` | 모두 L-1과 같음 |
| P-1 | `personKey({ source: "tmdb", external_id: "123" })`, `({ source: "anilist", external_id: "95" })` | `"tmdb:123"`, `"anilist:95"` |
| P-2 | `personCategoryLabel("actor")`, `("voice_actor")` | `"배우"`, `"성우"` |
| P-3 | `personInitial("  박신혜")`, `("花江夏樹")`, `("natsuki")`, `("")`, `("   ")`, `("😀abc")` | `"박"`, `"花"`, `"N"`, `"?"`, `"?"`, `"😀"` |
| P-4 | `createPersonCardModel({ source: "anilist", external_id: "95", category: "voice_actor", name: "花江夏樹", original_name: "Natsuki Hanae", profile_url: null, known_for: ["고깔모자의 아틀리에"] })` | `{ key: "anilist:95", name: "花江夏樹", secondaryName: "Natsuki Hanae", categoryLabel: "성우", knownForText: "고깔모자의 아틀리에", accessibilityLabel: "花江夏樹, 성우, 대표작 고깔모자의 아틀리에, 상세 보기" }` |
| P-5 | name `" 오구리 슌 "` + original_name 각각 `null`, `""`, `"  "`, `"오구리 슌"` | 모두 `name: "오구리 슌"`, `secondaryName: null` |
| P-6 | known_for `["꽃보다 남자", " 꽃보다 남자 ", "", "꽃보다 남자 극장판", "나는 여동생을 사랑한다", "고쿠센"]` | `knownForText: "꽃보다 남자 · 꽃보다 남자 극장판 · 나는 여동생을 사랑한다"` |
| P-7 | name `"오구리 슌"`, category actor, known_for `[]` | `knownForText: null`, `accessibilityLabel: "오구리 슌, 배우, 상세 보기"` |
| P-8 | name `"  "` | `name: "이름 없음"` |
| P-9 | `filterFavoritePeople([a(actor), b(voice_actor), c(actor)], "all" / "actor" / "voice_actor")` | `[a,b,c]`(입력과 다른 배열 객체), `[a,c]`, `[b]` |
| P-10 | `getFavoriteActionState("k", {k}, {k})`, `("k", {}, {k})`, `("k", {}, {})` | `"added"`, `"adding"`, `"add"` |
| P-11 | `favoriteAddCopy("add"/"adding"/"added", "박신혜")` | `{ "추가", "박신혜 좋아하는 인물에 추가", false }`, `{ "추가 중", "박신혜 추가 중", true }`, `{ "추가됨", "박신혜 이미 추가됨", true }` |
| P-12 | `favoriteRemoveCopy("사카이 마사토")` | `{ accessibilityLabel: "사카이 마사토 좋아하는 인물에서 빼기", toastMessage: "사카이 마사토 님을 좋아하는 인물에서 뺐어요." }` |
| P-13 | `toPersonSearchResult(FavoritePerson{ id, user_id, created_at, updated_at, + 7개 필드 })` | 7개 필드만 가진 객체와 `deepEqual`, `"id" in result === false`, `result.known_for !== input.known_for` |
| P-14 | `getPeopleSearchState("")`, `("   ")`, `("박")`, `(" 박 ")`, `("박신")` | `"idle"`, `"idle"`, `"too_short"`, `"too_short"`, `"search"` |
| P-15 | `shouldShowPersonSearchSkeleton` 5종: ① `{ isLoading: true, hasData: false, query: "박신혜", debouncedQuery: "박신혜" }` ② `{ false, false, "박신혜", "박신" }` ③ `{ false, true, "박신혜", "박신" }` ④ `{ false, false, "박신혜", "박신혜" }` ⑤ `{ true, false, "박", "" }` | `true`, `true`, `false`, `false`, `false` |
| P-16 | `personSearchEmptyCopy("  박신혜 ")` | `{ title: "\"박신혜\" 검색 결과가 없어요", description: "이름 철자를 바꾸거나 원어 이름으로 검색해 보세요." }` |
| P-17 | `favoriteEmptyCopy("all", 0)`, `("actor", 0)`, `("voice_actor", 0)`, `("all", 3)`, `("actor", 3)`, `("voice_actor", 3)` | 앞 넷 `{ "아직 좋아하는 인물이 없어요", "배우나 성우를 검색해서 추가해 보세요." }`, `{ "좋아하는 배우가 없어요", "다른 분류를 보거나 배우를 검색해서 추가해 보세요." }`, `{ "좋아하는 성우가 없어요", "다른 분류를 보거나 성우를 검색해서 추가해 보세요." }` |
| P-18 | 상수 | `PERSON_SEARCH_MIN_LENGTH === 2`, `PERSON_SEARCH_DEBOUNCE_MS === 300`, `PEOPLE_CATEGORY_OPTIONS`가 `[{전체, all}, {배우, actor}, {성우, voice_actor}]` |

### 수동 확인 (웹 8081, 로그인 상태 — 사람 또는 로그인된 세션에서)

| ID | 확인 |
|----|------|
| M-1 | 폭 375: 상단 "인물" 한 번만, 1열 카드, 검색창 아래 세그먼트(균등 폭) |
| M-2 | 폭 1440·2000: 3열, 콘텐츠가 가운데 1200 안, 홈과 왼쪽 시작선 같음 |
| M-3 | "박" → 안내 / "박신혜" → 결과 격자, ⊗로 비우기, 제공처 실패 안내 문구 |
| M-4 | 키보드 열린 채 "추가" 한 번에 동작, 두 사람 연달아 추가 시 각각 "추가 중" → "추가됨" |
| M-5 | ♥ → 카드 사라짐 + 되돌리기 토스트 → 되돌리기로 복구 |
| M-6 | 오프라인: 목록 오류만(빈 상태 없음), 추가·빼기 실패 토스트 |
| M-7 | 분류 "성우"로 좋아하는 인물 목록이 거르기 + 개수 배지 변경, 검색 결과도 성우만 |
| M-8 | 홈·검색·라이브러리·핀·프로필 탭과 인물 상세 화면이 이전과 같음 |

---

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/peopleScreen.ts` | 신규. 6.1 순수 함수 |
| `src/utils/peopleScreen.test.ts` | 신규. 10장 L-1~L-7, P-1~P-18 |
| `src/hooks/useDebouncedValue.ts` | 신규. 6.2 |
| `src/components/common/SegmentedControl.tsx` | 신규. 6.3 |
| `src/components/people/PersonAvatar.tsx` | 신규. 6.4 |
| `src/components/people/PersonCard.tsx` | 신규. 6.5 |
| `app/(tabs)/people.tsx` | 화면 재구성(8.2, 8.3). `PersonRow`·기존 styles 제거 |
| `app/(tabs)/_layout.tsx` | `people`에 `headerShown: false` |
| `src/hooks/usePeople.ts` | `useAddFavoritePerson`·`useDeleteFavoritePerson`의 `onSuccess`가 `invalidateQueries` Promise 반환(D-7). 그 외 변경 없음 |

---

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| 인물 상세 `app/people/[id].tsx` | 1,201행. 같은 토큰으로 옮기는 작업은 별도 명세 |
| 검색 탭(`app/search.tsx`)·작품 상세(`app/content/[id].tsx`)의 인물 추가 버튼 | 다른 화면. D-7의 훅 변경으로 추가 중 상태가 재조회까지 길어지는 것 외에는 동작 동일 |
| 분류 오표시(캡처의 사카이 마사토가 "성우 · VIVANT") | 저장된 `category`와 `correctFavoritePersonCategory`/`getPersonDetail`의 분류 갱신(`src/services/people.ts:60~63, 132~145`)에서 정해지는 데이터 문제. UI는 저장값을 그대로 보여준다. 별도 조사 |
| AniList 인물의 한국어 이름(캡처의 "花江夏樹") | 제공처 데이터. 별도 작업 |
| 좋아하는 인물 정렬·메모·알림 | 기능 추가 |
| 토스트 컴포넌트 모양 | 공용 컴포넌트. 2단계 |
| 기존 실패 테스트 `recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library" | 이 작업 전부터 실패(`26e220e`). 추천 엔진 문제로 별도 수정. 이 작업에서 건드리지 않는다 |
| 다크 모드, 폰트 교체 | `docs/32` 4장 |

---

## 13. 확실하지 않음 — 별도 검증 필요

1. **RN Web의 `boxShadow` + `overflow`**: 카드에 `elevation.card`와 `radius.lg`를 함께 쓸 때 웹에서 그림자가 잘리지 않는지 홈 타일과 같은 방식으로 확인한다(`overflow: "hidden"`을 카드 바깥 View에 주지 않는다).
2. **TanStack Query v5 `onSuccess` Promise 대기**: 반환한 Promise를 `mutateAsync`가 기다리는 것은 v5 문서 동작이다. 설치 버전(`package.json`)에서 실제로 기다리는지 수동 M-4에서 "추가 중 → 추가됨" 사이 깜빡임이 없는지로 확인한다.
3. **토스트 되돌리기 후 화면 이탈**(E-24): 언마운트된 화면의 `mutateAsync` 호출이 정상 실행되는지는 수동 확인 대상이다.
