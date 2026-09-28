# 34. 검색 시즌 카드 합쳐짐 정정 + 배우·성우(좋아하는 인물) 기능 복원 명세

작성일: 2026-09-28
대상 브랜치 기준: `main` (`b476849`, 워킹 트리에 `docs/33` 구현 진행 중)
선행 문서: `docs/11_screen_implementation_spec.md`, `docs/15_season_search_spec.md`, `docs/17_season_library_tracking_spec.md`, `docs/19_mobile_usability_spec.md`, `docs/21_mobile_usability_qa_2026-09-09.md`, `docs/32_home_modern_redesign_spec.md`, `docs/33_kr_ott_availability_spec.md`

> **사용자 결정 (2026-09-28).** "배우도 찜하기 등 좋아하는 배우를 입력할 수 있었는데 싹 사라졌다. 다시 되살려 달라. 배우·성우 등 좋아하는 배우를 등록하는 화면 자체가 사라졌다."
> 이 문서는 **인물 기능에 한해** `docs/11`의 "배우·성우·좋아하는 인물: MVP 제외"와 "검색에서 인물 결과 비노출", `docs/19` M-01·`docs/21`의 "하단 탭 5개·인물 탭 제거"를 **대체한다.** 공유·가져오기·취향 카드·리뷰 라벨·추천 제외 설정 등 다른 확장 기능은 계속 숨긴다.

---

## 1. 문제 정의

| ID | 증상 | 원인 (코드 확인) |
|----|------|------------------|
| Q-1 | "재벌X형사" 검색 시 **시즌 2만** 나온다. TMDB에는 시즌 1(2024-01-26, 16화)·시즌 2(2026-08-07, 14화)가 있다(TMDB 220074) | 어댑터는 시즌 카드 2장을 만든다(`search-content/adapters/tmdb.ts` `expandAiredSeasons`, docs/17 D-4). 그런데 **서버 `compactResults`가 `external_source:external_id`로 합쳐** 같은 TMDB id인 두 시즌 카드가 한 장이 된다(`adapters/normalize.ts:16~45`). **클라이언트 `mergeSearchPages`도 같은 키로 첫 장만 남긴다**(`src/utils/searchPagination.ts:3~15`). 둘 다 고쳐야 한다 |
| Q-2 | 같은 해에 두 시즌이 방영된 작품(분기 애니 등)은 시즌 카드가 제목 비교로도 합쳐질 수 있다 | `areSameWork`가 `title_original`이 같고 연도가 같으면 같은 작품으로 본다. 시즌 번호를 보지 않는다(`normalize.ts:125~135`) |
| P-1 | "박신혜" 검색 결과가 0건. 배우 이름으로 작품을 찾을 수 없다 | 인물 검색 훅이 `EXTENDED_FEATURES_ENABLED && …`로 꺼져 있다(`src/hooks/usePeople.ts:12`). 제목 검색(TMDB `search/multi`)은 인물 결과를 버린다(`tmdb.ts` `media_type !== "person"`) |
| P-2 | 좋아하는 배우·성우를 등록·조회하는 **인물 화면이 없다** | 2026-09-09 `docs/19`·`docs/21` 작업에서 하단 탭에서 "인물"을 빼고(`fb07e3c`까지는 6개 탭 중 하나), 라우트를 `EXTENDED_FEATURES_ENABLED ? … : <Redirect href="/library" />`로 막았다(`app/(tabs)/people.tsx:260`, `app/people/[id].tsx:1201`) |
| P-3 | 작품 상세의 "출연 배우/성우" 섹션(누르면 좋아하는 인물 등록)이 사라졌다 | `app/content/[id].tsx:497` `EXTENDED_FEATURES_ENABLED && view.cast.length` |
| P-4 | 검색의 "찾은 인물" 칩이 사라졌다 | `app/search.tsx:656` 같은 플래그 |
| P-5 | 인물 검색을 다시 켜면 결과 품질이 낮다 | 출연작을 **정렬 전에 40개로 자른다**(`search-person-content/index.ts:186`). 토크쇼·예능·뉴스 출연과 본인 출연(`Self`)을 거르지 않는다. 박신혜 실측(2026-09-28): 출연 57건 중 토크/리얼리티/뉴스 16건, 본인 역 12건, 점수 상위작 "언더커버 미쓰홍"(2026)·"시지프스"가 원본 앞 40개에 없음 |

---

## 2. 재현 시나리오

1. 검색에 `재벌X형사` → 카드 1장("재벌X형사 시즌 2"). 기대: 시즌 2, 시즌 1 두 장.
2. 검색에 `박신혜` → "검색 결과가 없습니다". 기대: 박신혜 출연작 + "찾은 인물" 칩.
3. 하단 탭에 "인물"이 없고, 주소창에 `/people` 입력 시 라이브러리로 튕긴다.
4. 작품 상세(예: 재벌X형사)에 출연 배우 섹션이 없다.

---

## 3. 설계 결정

### D-1 (최우선). 시즌 카드의 정체성은 `source:external_id:season_number`다
`docs/17` D-4("시즌은 사용자 기록 개념, 콘텐츠 id는 같다")는 유지한다. 그래서 **중복 제거 키에 시즌 번호를 포함**해야 한다. 키 형식은 클라이언트에 이미 있는 `searchSeasonIdentity`와 같다: `` `${source}:${id}:${season_number ?? "whole"}` ``.

### D-2. 같은 작품의 시즌 카드가 있으면 "작품 전체" 카드는 뺀다
검색어 변형·페이지마다 같은 TMDB 작품이 상위 3위 안(시즌 펼침)과 밖(펼치지 않음)으로 나뉘어 올 수 있다. 같은 `source:id`에 시즌 카드가 하나라도 있으면 `season_number == null` 카드는 버린다(서버·클라이언트 동일 규칙).

### D-3. 제목 비교 병합은 시즌 번호가 서로 다르면 하지 않는다
`areSameWork`: 양쪽 `season_number`가 모두 있고 다르면 `false`. 한쪽만 있으면 기존 규칙(TMDB 시즌 카드와 TVmaze 전체 카드 병합 등)을 유지한다.

### D-4. 인물 기능은 새 플래그 하나로 켠다
`src/constants/features.ts`에 `PEOPLE_FEATURES_ENABLED = true`를 추가한다(`SEARCH_RECOMMENDATIONS_ENABLED` 선례, `docs/22`). 아래 **인물 관련 게이트만** 이 플래그로 바꾼다. `EXTENDED_FEATURES_ENABLED`는 `false` 그대로다.

| 위치 | 현재 | 변경 |
|------|------|------|
| `src/hooks/usePeople.ts:12, 23, 41` | `EXTENDED_FEATURES_ENABLED &&` | `PEOPLE_FEATURES_ENABLED &&` |
| `app/(tabs)/people.tsx:260` | `EXTENDED_FEATURES_ENABLED ? <PeopleScreen /> : <Redirect …>` | `PEOPLE_FEATURES_ENABLED ? …` |
| `app/people/[id].tsx:1201` | 같은 형태 | `PEOPLE_FEATURES_ENABLED ? …` |
| `app/search.tsx:215, 293, 656` | `EXTENDED_FEATURES_ENABLED` | `PEOPLE_FEATURES_ENABLED` |
| `app/content/[id].tsx:497` | `EXTENDED_FEATURES_ENABLED && view.cast.length` | `PEOPLE_FEATURES_ENABLED && view.cast.length` |

**바꾸지 않는 게이트:** `useLibraryItemCast.ts`(라이브러리 카드마다 외부 상세를 조회하는 "출연: …" 줄 — 목록 요청 수가 카드 수만큼 늘어남), `pins.tsx` 공유, `profile.tsx` 취향 카드·추천 제외, `library.tsx` 공유·가져오기, `ContentCard`/`ContentGalleryCard` 리뷰 라벨, `LibraryFilterBottomSheet` 데이터 관리, `share/*`, `library/*import*`, `settings/excluded-recommendations`.

### D-5. 하단 탭을 6개로 되돌린다
`fb07e3c` 이전 순서 그대로: 홈 · 검색 · 라이브러리 · 핀 · **인물** · 프로필. 아이콘은 기존 `PersonChatIcon`. 좁은 화면(320pt)에서 6개가 들어가도록 **탭 폭에 따라 라벨 크기와 아이콘 알약 폭을 줄인다**(순수 함수 `getBottomNavMetrics`, 6장). 라벨 문구는 바꾸지 않는다.

### D-6. 등록 동작은 기존 방식을 복원하고 피드백만 보탠다
- 인물 탭: 기존 화면 그대로(이름 검색 → 등록, 내가 좋아하는 인물 목록 → 삭제·상세).
- 검색 "찾은 인물" 칩: **미등록이면 탭 = 등록**, **등록됨이면 탭 = 인물 상세**. 칩 보조 문구는 미등록 `배우 등록`/`성우 등록`, 등록됨 `등록됨`. 등록 성공 시 토스트 `${name}을(를) 좋아하는 인물에 등록했어요.`(행동 버튼 "보기" → 인물 상세), 실패 시 오류 토스트.
- 작품 상세 출연 섹션: 기존 규칙("처음 누르면 등록, 등록된 인물은 상세") 유지. 성공·실패 알림을 `Alert.alert`에서 **토스트로** 바꾼다(웹에서 `Alert`는 빈 함수).

### D-7. 인물 검색 결과 품질 규칙은 순수 함수로
출연작은 ① 영화·TV만 ② 장르 10763(뉴스)·10764(리얼리티)·10767(토크) 제외 ③ 본인 출연 제외(캐릭터가 `self`/`herself`/`himself`/`themselves` 단어를 포함하거나 `본인` 포함) ④ `media_type:id` 중복 제거 ⑤ **점수(popularity + vote_count/1000) 내림차순 정렬 후** 40개. `known_for`에도 ①②④를 적용한다(캐릭터 정보가 없으므로 ③은 해당 없음).

### D-8. 검색 안내 문구에 인물 검색을 알린다
검색창 placeholder `작품명으로 검색` → `작품명, 배우·성우 이름으로 검색`. 빈 결과 안내 `다른 작품명으로 검색해 보세요.` → `다른 작품명이나 배우·성우 이름으로 검색해 보세요.` (필터 조건 문구의 "다른 작품명으로" 부분도 같은 식으로.)

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

---

## 4. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| 시즌마다 별도 `external_id`(예: `220074:s1`) 부여 | 라이브러리·상세·캐시가 모두 TMDB id를 콘텐츠 정체성으로 쓴다(docs/17 D-4). 파급이 크다 |
| 서버만 고치기 | 클라이언트 `mergeSearchPages`가 같은 키로 다시 합친다. 한쪽만 고치면 증상이 남는다 |
| `EXTENDED_FEATURES_ENABLED`를 `true`로 | 공유 링크 발급·가져오기·취향 카드 등 `docs/11`이 막아둔 기능까지 전부 열린다 |
| 인물 탭 대신 프로필 안에 "좋아하는 인물" 메뉴 | 사용자가 되살려 달라고 한 것은 예전 화면(하단 탭)이다. 발견성도 탭이 높다 |
| 라벨을 줄이려고 "라이브러리"를 "보관함"으로 변경 | 이름 변경은 요청 범위 밖. 폭에 맞춘 글자 크기 조정으로 해결한다 |
| 라이브러리 카드 "출연: …" 줄도 복원 | 카드마다 외부 상세 요청이 생긴다. 좋아하는 인물 등록과 무관 |
| 검색 칩 탭 = 항상 인물 상세 | 예전 동작(탭 = 등록)과 달라진다. 등록 여부로 나눈다(D-6) |

---

## 5. 계약

### 5.1 서버 `supabase/functions/search-content/adapters/normalize.ts`
`compactResults(results)` 판정 순서:
1. 정확 키 `` `${external_source}:${external_id}:${season_number ?? "whole"}` ``로 모으며, 같은 키는 기존 `mergeSearchResult`로 병합(입력 순서상 첫 등장 위치 유지)
2. 1의 결과 중 `season_number != null`인 카드가 있는 `` `${external_source}:${external_id}` `` 집합을 만든다
3. `season_number == null`이고 2의 집합에 속한 카드를 버린다
4. 남은 카드로 기존 `areSameWork` 병합 단계를 그대로 수행
`areSameWork(left, right)`: 맨 앞에 `if (left.season_number != null && right.season_number != null && left.season_number !== right.season_number) return false;` 추가. 나머지 규칙 불변.

### 5.2 클라이언트 `src/utils/searchPagination.ts`
```ts
import { searchSeasonIdentity } from "./searchRecommendationPolicy";
export function mergeSearchPages(pages: readonly SearchContentResponse[]): SearchResult[];
```
1. 모든 페이지 결과를 순서대로 보며 `searchSeasonIdentity(item)` 키로, **처음 온 것만** 남긴다(첫 페이지 우선, 기존 의미 유지)
2. 시즌 카드(`season_number != null`)가 있는 `` `${source}:${id}` ``의 `season_number == null` 카드를 버린다
3. 남은 순서 유지
`searchRecommendationPolicy.ts`가 React Native를 import하지 않는지 확인한다(테스트에서 import하므로). import한다면 `searchSeasonIdentity`와 같은 식을 이 파일에 직접 쓰지 말고 **보고**한다.

### 5.3 `supabase/functions/_shared/personCredits.ts` (신규)
```ts
export interface TmdbPersonCredit {
  id: number;
  media_type?: string | null;
  genre_ids?: number[] | null;
  character?: string | null;
  popularity?: number | null;
  vote_count?: number | null;
}
export const EXCLUDED_PERSON_CREDIT_GENRE_IDS: readonly number[]; // [10763, 10764, 10767]
export function isSelfAppearance(character: string | null | undefined): boolean;
export function isEligiblePersonCredit(credit: TmdbPersonCredit): boolean;
export function selectPersonCastCredits<T extends TmdbPersonCredit>(cast: readonly T[], limit?: number): T[]; // 기본 40
```
- `isSelfAppearance`: 문자열이 없으면 `false`. `/(?:^|[^a-z])(?:self|herself|himself|themselves)(?:[^a-z]|$)/i` 일치 또는 `본인` 포함이면 `true`.
- `isEligiblePersonCredit`: `media_type`이 `"movie"`·`"tv"` **그리고** 장르에 10763·10764·10767 없음 **그리고** `!isSelfAppearance(character)`.
- `selectPersonCastCredits`: ① `isEligiblePersonCredit` ② `` `${media_type}:${id}` `` 첫 등장만 ③ 점수 `(popularity ?? 0) + (vote_count ?? 0) / 1000` 내림차순, 동점이면 `id` 오름차순 ④ 앞에서 `limit`개. 입력을 변형하지 않는다.

`search-person-content/index.ts` 적용:
- `TmdbCreditItem`에 `character?: string | null` 추가.
- `fetchTmdbPersonCredits`의 `(payload.cast ?? []).slice(0, 40)` → `selectPersonCastCredits(payload.cast ?? [])`.
- `searchTmdbPeople`에서 `known_for`와 출연작을 합친 뒤 `.filter((item) => item.media_type === "movie" || item.media_type === "tv")`를 `.filter(isEligiblePersonCredit)`로 교체. 이후 정렬·매핑은 그대로.

### 5.4 `src/utils/bottomNavLayout.ts` (신규)
```ts
export const BOTTOM_NAV_MAX_WIDTH = 640;
export function getBottomNavMetrics(windowWidth: number, itemCount: number): { labelFontSize: 10 | 11; iconPillWidth: number };
```
1. `w = Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : 375`, `n = Math.max(1, Math.floor(itemCount))`
2. `itemWidth = (Math.min(w, BOTTOM_NAV_MAX_WIDTH) - 8) / n` (8 = 좌우 최소 여백 4+4)
3. `labelFontSize = itemWidth < 60 ? 10 : 11`
4. `iconPillWidth = Math.max(32, Math.min(56, Math.floor(itemWidth) - 8))`

### 5.5 `src/constants/features.ts`
```ts
/** docs/34: 배우·성우 검색, 좋아하는 인물 등록·목록·상세, 작품 상세 출연 섹션. 다른 확장 기능과 분리. */
export const PEOPLE_FEATURES_ENABLED = true;
```

---

## 6. 화면 명세

### 6.1 하단 탭 `app/_layout.tsx` `GlobalBottomNav`
- `navItems`에 `{ href: "/people", label: "인물", icon: PersonChatIcon, ariaLabel: "인물로 이동" }`를 핀과 프로필 사이에 추가. `PEOPLE_FEATURES_ENABLED`가 `false`면 빼는 방식으로 구성한다(예: 배열 필터).
- `getActiveNavHref`: `if (route === "/people" || route.startsWith("/people/")) return "/people";`
- `const metrics = getBottomNavMetrics(width, visibleNavItems.length)` (`useWindowDimensions`). 아이콘 래퍼 `width: metrics.iconPillWidth`, 라벨 `fontSize: metrics.labelFontSize`, 라벨 `numberOfLines={1}`.
- 나머지(선택 알약 배경, 접근성 속성, `router.replace`, hover/focus)는 그대로.

### 6.2 인물 탭 `app/(tabs)/people.tsx`, 인물 상세 `app/people/[id].tsx`
라우트 게이트만 D-4대로 바꾼다. 화면 내부는 **수정하지 않는다.** `app/(tabs)/_layout.tsx`의 `people` 화면 정의는 이미 있다(헤더 제목 "인물").

### 6.3 검색 `app/search.tsx`
- D-4의 세 곳 플래그 교체.
- "찾은 인물" 칩(656행~): `useFavoritePeople()`로 등록 키 집합 `` `${source}:${external_id}` ``를 만든다. 등록됨이면 `onPress` = 인물 상세(`/people/[id]`, params `id: \`${source}:${external_id}\``, `source`, `externalId`, `category`), 보조 문구 `등록됨`. 미등록이면 `onPress` = 등록, 보조 문구 기존대로.
- `addPerson`(361행~): 성공 시 `addToast(\`${person.name}을(를) 좋아하는 인물에 등록했어요.\`, "success", { actionLabel: "보기", onAction: () => 인물 상세 이동 })`, 실패 시 `addToast(error.message || "등록하지 못했어요.", "error")`. `Alert.alert` 제거.
- 빈 결과 안내 문구 D-8(919행).

### 6.4 검색창 `src/components/content/ContentSearchBar.tsx:177`
placeholder D-8.

### 6.5 작품 상세 `app/content/[id].tsx`
- 497행 플래그 교체(D-4).
- `addCastMember`(253행~)의 `Alert.alert` 두 개를 토스트로: 성공 `` `${member.name}을(를) 좋아하는 인물에 등록했어요.` ``(행동 "보기" → `openCastMember(member)`), 실패 `error.message || "등록하지 못했어요."`.
- **`docs/33` 구현이 같은 파일(보러가기 부분)을 수정 중이면 그 변경을 보존**하고 위 두 부분만 고친다.

### 6.6 README
`README.md` 17행 기능 플래그 설명에 한 문장 추가: `` 배우·성우 검색과 좋아하는 인물(인물 탭·상세·작품 출연 섹션)은 `PEOPLE_FEATURES_ENABLED = true`로 별도 노출한다(docs/34). ``

---

## 7. 엣지 케이스

| # | 상황 | 기대 동작 |
|---|------|-----------|
| E-1 | 2개 시즌이 모두 방영된 TMDB 드라마, 검색어에 시즌 표기 없음 | 시즌 카드 2장(최근 시즌 먼저, 어댑터 순서 유지) |
| E-2 | 같은 TMDB 작품이 다른 검색어 변형에서 "작품 전체" 카드로도 옴 | 작품 전체 카드 제거, 시즌 카드만 |
| E-3 | 같은 시즌 카드가 두 변형에서 옴 | 1장으로 병합 |
| E-4 | 같은 해 두 시즌(제목 원제 동일) | 2장 유지 |
| E-5 | "재벌X형사 2"처럼 시즌 지정 검색 | 기존대로 해당 시즌 1장(docs/15) |
| E-6 | TMDB 시즌 카드 + TVmaze 전체 카드(같은 작품) | 기존대로 1장(TMDB 우선), 시즌 번호 유지 |
| E-7 | 페이지 1에 시즌 카드, 페이지 2에 같은 작품 전체 카드 | 전체 카드 제거 |
| E-8 | 페이지 1에 전체 카드, 페이지 2에 시즌 카드 | 전체 카드 제거, 시즌 카드 표시 |
| E-9 | "박신혜" 검색 | 출연작(토크·예능·본인 출연 제외, 인기순) + "찾은 인물" 칩 |
| E-10 | 이미 등록한 배우 칩 탭 | 인물 상세 이동, 중복 등록 없음 |
| E-11 | 폭 320에서 탭 6개 | 라벨 10pt 한 줄, 알약 44, 겹침·줄바꿈 없음 |
| E-12 | 폭 375 이상 | 라벨 11pt |
| E-13 | 작품 상세 출연 배우 등록 실패(네트워크) | 오류 토스트, 화면 유지 |
| E-14 | `PEOPLE_FEATURES_ENABLED = false`로 바꿀 때 | 탭·라우트·검색 칩·출연 섹션·인물 조회가 모두 숨겨짐(현재 동작과 동일) |

---

## 8. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** `node:test` + `node:assert/strict`.

### `supabase/functions/search-content/adapters/normalize.test.ts` (추가, 기존 `result()` 헬퍼 사용)
| ID | 입력 | 기대 |
|----|------|------|
| T-1 | TMDB `220074` 시즌 2(2026) 카드, 시즌 1(2024) 카드 (title_original 둘 다 "재벌X형사") | 길이 2, 순서 [시즌 2, 시즌 1], `season_number` [2, 1] |
| T-2 | 같은 id 전체 카드(season null) + 시즌 1 + 시즌 2 | 길이 2, 둘 다 `season_number != null` |
| T-3 | 같은 id 시즌 1 카드 두 번(두 번째만 `poster_url` 있음) | 길이 1, `poster_url` 채워짐 |
| T-4 | 같은 id 시즌 1(2024-01), 시즌 2(2024-10), 원제 동일 | 길이 2 |
| T-5 | TMDB 시즌 1 카드(원제 "X", 2024) + TVmaze 전체 카드("X", 2024, 다른 id) | 길이 1, `external_source` "tmdb", `season_number` 1, `duplicate_hint` true |
| T-6 | 기존 테스트 "compacts the same anime returned by TMDB and AniList…", "keeps works with the same title but different years separate" | **수정 없이** 통과 |

### `src/utils/searchPagination.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| G-1 | 1페이지 [S2, S1] (같은 id) | 길이 2, 순서 유지 |
| G-2 | 1페이지 [S2, S1], 2페이지 [전체 카드 같은 id] | 길이 2 (전체 카드 없음) |
| G-3 | 1페이지 [전체 카드], 2페이지 [S1, S2] | [S1, S2] |
| G-4 | 1페이지 [S1(poster A)], 2페이지 [S1(poster B)] | 길이 1, poster A |
| G-5 | 기존 두 테스트 | **수정 없이** 통과 |

### `supabase/functions/_shared/personCredits.test.ts` (신규)
헬퍼 `c(id, o = {})` = `{ id, media_type: "tv", genre_ids: [18], character: "역할", popularity: 1, vote_count: 0, ...o }`
| ID | 입력 | 기대 |
|----|------|------|
| C-1 | 장르 `[10767]`, `[10764]`, `[10763]`, `[18]` 각 1개 | `[18]`인 것만 남음 |
| C-2 | character `"Self"`, `"Herself - Guest"`, `"Himself"`, `"본인"`, `"Selfie Girl"`, `"Hye-jin"`, `null` | 앞 넷 제외, `"Selfie Girl"`·`"Hye-jin"`·`null` 유지 |
| C-3 | `media_type` `"person"`, `undefined`, `"movie"` | `"movie"`만 |
| C-4 | 45개(popularity 1), 44번째 인덱스만 popularity 99 | 결과 길이 40, 첫 항목 = 그 항목 |
| C-5 | 같은 tv id 2번(캐릭터 다름) | 1개 |
| C-6 | popularity 동점(5, 5), id 30·10 | 순서 [10, 30] |
| C-7 | `limit` 3 | 길이 3 |
| C-8 | 입력 배열 | 변형되지 않음(원본 순서·길이 그대로) |
| C-9 | `isSelfAppearance(undefined)`, `("")` | 둘 다 `false` |

### `src/utils/bottomNavLayout.test.ts` (신규)
| ID | 입력 (width, count) | 기대 |
|----|------|------|
| B-1 | 320, 6 | `{ labelFontSize: 10, iconPillWidth: 44 }` |
| B-2 | 375, 6 | `{ 11, 53 }` |
| B-3 | 430, 6 | `{ 11, 56 }` |
| B-4 | 1024, 6 | `{ 11, 56 }` |
| B-5 | 320, 5 | `{ 11, 54 }` |
| B-6 | 0 / NaN, 6 | B-2와 같음 |
| B-7 | 375, 0 | `{ 11, 56 }` (n=1 처리) |

계산 확인: B-1 (320−8)/6=52 → 10, 52−8=44. B-2 (375−8)/6=61.17 → 11, 61−8=53. B-3 70.3 → 56(상한). B-4 (640−8)/6=105.3 → 56. B-5 (320−8)/5=62.4 → 11, 54. B-7 (375−8)/1=367 → 11, 56.

### 수동 확인 (웹 8081, 로그인 필요)
| ID | 절차 | 기대 |
|----|------|------|
| M-1 | `재벌X형사` 검색 | 시즌 2·시즌 1 두 장, 각각 보고 싶음/완료 동작 |
| M-2 | `박신혜` 검색 | 출연작 목록, 카드에 "박신혜 출연/참여", "찾은 인물" 칩 |
| M-3 | 칩 탭(미등록) → 토스트 "보기" | 등록 토스트, "보기"로 인물 상세 |
| M-4 | 하단 "인물" 탭 | 좋아하는 배우/성우 화면, 방금 등록한 배우 표시 |
| M-5 | 작품 상세(재벌X형사) | 출연 배우 섹션, 탭하면 등록/상세 |
| M-6 | 폭 320·375에서 하단 탭 | 6개 라벨 한 줄, 겹침 없음 |

---

## 9. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `supabase/functions/search-content/adapters/normalize.ts` (+test) | 5.1 |
| `src/utils/searchPagination.ts` (+test) | 5.2 |
| `supabase/functions/_shared/personCredits.ts` (+test) | 신규 5.3 |
| `supabase/functions/search-person-content/index.ts` | 5.3 적용 |
| `src/utils/bottomNavLayout.ts` (+test) | 신규 5.4 |
| `src/constants/features.ts` | 5.5 |
| `src/hooks/usePeople.ts` | D-4 |
| `app/(tabs)/people.tsx` | D-4 (260행만) |
| `app/people/[id].tsx` | D-4 (1201행만) |
| `app/_layout.tsx` | 6.1 |
| `app/search.tsx` | 6.3 |
| `src/components/content/ContentSearchBar.tsx` | 6.4 (177행만) |
| `app/content/[id].tsx` | 6.5 |
| `README.md` | 6.6 |

## 10. 범위 밖

| 항목 | 이유 |
|------|------|
| 라이브러리 카드 "출연: …" 줄(`useLibraryItemCast`) | D-4 |
| 공유·가져오기·취향 카드·리뷰 라벨·추천 제외 설정 | `docs/11` 제외 유지 |
| 인물 탭·인물 상세 화면의 디자인 개편 | 복원만 한다. `docs/32` 2단계에서 |
| 인물 탭의 좋아하는 인물 삭제 확인 | 기존 동작 유지(다시 등록 가능). 필요하면 후속 |
| 인물 검색 입력 디바운스 | 기존 동작 유지 |
| AniList 성우 검색 품질 | 이번 실측 대상 아님. TMDB 배우 쪽만 D-7 적용 |

## 11. 확실하지 않음 — 별도 검증 필요

1. **Edge Function 배포 상태.** `search-person-content`, `get-person-detail`은 `package.json` `backend:deploy` 목록에 있으나 2026-09-09 이후 운영 배포 상태를 확인하지 않았다. 배포되어 있지 않으면 인물 검색·상세가 오류가 난다. 사람이 확인·재배포한다(`search-person-content`는 이번 변경으로 **재배포 필요**, `search-content`도 재배포 필요).
2. **`favorite_people` 테이블.** 마이그레이션 0005에 RLS 4종이 있다. 운영 DB 적용 여부는 확인하지 않았다.
3. **320pt 6개 탭.** 계산상 라벨 10pt 5글자("라이브러리") ≈ 50pt가 탭 폭 52pt에 들어가지만, 실제 글꼴 폭에 따라 빠듯할 수 있다. M-6으로 확인한다.
4. **검색 캐시.** 서버 캐시(`external_search_cache`)는 어댑터 원본 결과(시즌 카드 포함)를 저장하고 병합은 응답 직전에 하므로 캐시 버전을 올리지 않아도 된다고 판단했다(`search-content/index.ts:200~219`). 배포 직후 M-1이 실패하면 `SEARCH_CACHE_VERSION` 상향을 검토한다.
