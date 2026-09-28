# 33. 국내 OTT 시청 가능 작품 우선 — 추천 필터·보러가기·인기 표기 정정 명세

작성일: 2026-09-28
대상 브랜치 기준: `main` (`b476849`)
선행 문서: `docs/22_search_recommendations_restore_spec.md`, `docs/27_excluded_relationship_themes_spec.md`, `docs/28_recommendation_scroll_pagination_fixes_spec.md`, `docs/30_recommendation_fill_and_action_consistency_fixes_spec.md`

> **근거.** 사용자가 보낸 작품 상세 캡처("오늘 밤, 비밀의 키친에서", 보러가기 KR 비어 있음)와 코드, 그리고 2026-09-28에 TMDB API를 **읽기 전용으로 직접 호출해 측정한 값**이다. 측정 수치는 그 날짜의 TMDB/JustWatch 데이터 기준이며 시간이 지나면 바뀐다.

---

## 1. 문제 정의

사용자 질문: "보러가기에 볼 수 있는 OTT가 없는데 왜 이렇게 많아? 외국 거라 어쩔 수 없어? OTT에 없으면 인기가 없을 텐데 왜 인기 순위가 높아?"

| ID | 증상 | 사실 (측정·코드) |
|----|------|------------------|
| K-1 | 검색 탭 추천 피드에 국내 OTT에서 볼 수 없는 작품이 많이 나온다 | 추천 후보를 가져오는 TMDB discover 요청에 `watch_region=KR`만 있고 **플랫폼 조건이 없다.** TMDB 문서상 `watch_region`은 `with_watch_providers`/`with_watch_monetization_types`와 함께 쓸 때만 거른다. 즉 지금은 **아무것도 거르지 않는다** (`supabase/functions/_shared/recommendationProviders.ts:515, 551, 712`) |
| K-2 | 특히 일본 드라마가 심하다 | 최근 6개월(2026-03-31~09-30) 첫 방영 기준 TMDB discover: **일드 264편 중 국내 OTT 29편(11%)**, 한드 242편 중 73편(30%), 일본 애니 119편 중 61편(51%) |
| K-3 | 인기 없어 보이는데 카드에 "이번 달 인기 5위"가 붙는다 | 이 라벨은 **"그 작품이 공개된 달에, 같은 국가·장르 레인 안에서 TMDB 인기순 몇 번째"**다(`src/utils/recommendationPresentation.ts:173~178`, `rank`는 `recommendationProviders.ts`의 `providerRank`). 캡처 작품(TMDB 315509)은 2026년 4월 첫 방영 일드 35편 중 5번째 → "이번 달 인기 5위". 실제 TMDB 인기 5.2, 투표 0건. "이번 달"은 현재 달이 아니라 **공개된 달**이다 |
| K-4 | 추천 이유가 "최근 인기작"이라고 한다 | 취향 탐색 이유 문구가 인기 여부와 무관하게 고정(`recommendationEngine.ts:624, 631`) |
| K-5 | 보러가기가 비었을 때 이유를 알 수 없다 | 315509의 TMDB 제공 지역은 **JP만**(FOD). 앱은 KR만 보고 "시청 가능한 플랫폼 정보가 없습니다"만 표시하며, 빈 탭 4개(정액제·무료·대여·구매)를 그대로 보여준다 |
| K-6 | 애니(AniList 출처)는 보러가기가 항상 비어 있다 | `src/services/watchProviders.ts:18`, `src/hooks/useWatchProviders.ts:39`와 Edge Function 모두 `source !== "tmdb"`면 빈 응답. 예: 황천의 츠가이(AniList)는 TMDB 260463으로 **넷플릭스·왓챠·티빙**에 있지만 앱은 "없음" |
| K-7 | 광고형 무료 제공이 누락된다 | TMDB 응답에는 `ads` 분류가 있다(예: 약사의 혼잣말 KR `ads: Crunchyroll`). 코드는 `flatrate·free·rent·buy`만 읽는다(`get-watch-providers/index.ts:42`) |
| K-8 | 대여·구매만 있을 때도 첫 탭이 "정액제"라 "없습니다"가 보인다 | `WatchProviderList.tsx`의 `selectedCategory` 초기값이 항상 `"flatrate"` |
| K-9 | 시청 정보 출처 표기가 없다 | TMDB의 시청 제공처 데이터는 JustWatch 제공이며 출처 표기가 필요하다(13장 1번) |

**답:** "외국 거라 어쩔 수 없는" 게 아니라, 볼 수 있는 곳을 따지지 않고 후보를 가져왔고, "인기 N위"는 공개된 달 안의 상대 순위였기 때문이다. 국내 OTT 조건을 거는 것만으로 일드 후보가 264편에서 29편으로 줄고 캡처 작품은 빠진다(4월 일드 35편 → 6편, 315509 제외 확인).

---

## 2. 근본 원인 요약

1. **후보 수집 단계에 시청 가능 조건이 없다.** 드라마 레인·영화 레인·애니 한국어 현지화 레인 모두 `watch_region`만 설정.
2. **순위 표기가 절대 인기처럼 읽힌다.** `rank`는 월·국가·장르 레인별 상대 순위인데 "이번 달 인기 N위"로 표시.
3. **보러가기가 TMDB 출처만 조회**하고, `ads`를 버리며, 비었을 때 해외 제공 여부를 알려주지 않는다.

---

## 3. 재현 시나리오

1. 로그인 → 검색 탭 추천 피드를 아래로 스크롤 → 2026년 4월 공개작 구간에서 "오늘 밤, 비밀의 키친에서" 카드에 "이번 달 인기 5위" 배지.
2. 카드 → 빠른 보기 → 상세 → 보러가기: KR 탭 4개가 모두 비어 있고 "시청 가능한 플랫폼 정보가 없습니다".
3. 검색에서 "황천의 츠가이"(AniList 결과) → 상세 → 보러가기 비어 있음(실제로는 넷플릭스·왓챠·티빙 제공).
4. "약사의 혼잣말" 상세(TMDB 출처로 열었을 때) → 무료 탭에 크런치롤(광고형)이 없음.

---

## 4. 설계 결정

### D-1 (최우선). "국내 OTT 시청 가능"의 정의
TMDB(JustWatch) 데이터에서 **지역 KR**, 제공 방식 **정액제·무료·광고형 무료(`flatrate|free|ads`)**, 제공처가 **아래 화이트리스트** 중 하나. 대여·구매만 있는 작품은 추천 피드에서 **제외**한다(사용자가 말한 "OTT에서 본다"는 구독·무료 시청이다). 상세 화면 보러가기는 대여·구매도 계속 보여준다.

| 순서 | TMDB id | 그룹 | 앱 표기 |
|------|---------|------|--------|
| 1 | 8 | netflix | 넷플릭스 |
| 2 | 1796 | netflix | 넷플릭스(광고형) |
| 3 | 1883 | tving | 티빙 |
| 4 | 1881 | coupang | 쿠팡플레이 |
| 5 | 356 | wavve | 웨이브 |
| 6 | 337 | disney | 디즈니+ |
| 7 | 97 | watcha | 왓챠 |
| 8 | 350 | apple | Apple TV+ |
| 9 | 119 | prime | 프라임 비디오 |
| 10 | 283 | crunchyroll | 크런치롤 |

id는 2026-09-28 `GET /3/watch/providers/tv?watch_region=KR` 응답에서 확인했다. 목록 밖 제공처(Hoichoi, Sun Nxt, Plex 등 국내 사용자에게 의미가 적은 곳)는 추천 판정에 쓰지 않는다. **라프텔·시리즈온·U+모바일tv·지니TV는 TMDB KR 목록에 없어 판정할 수 없다**(13장).

### D-2. 필터는 후보 수집(TMDB discover) 단계에 건다
discover 요청에 `watch_region=KR`, `with_watch_providers=8|1796|1883|1881|356|337|97|350|119|283`, `with_watch_monetization_types=flatrate|free|ads`를 넣는다. 결과 페이지가 처음부터 시청 가능 작품으로 채워지므로 **페이지당 후보 수(20)는 그대로**이고 월당 페이지 수만 준다. 사후 필터(받은 뒤 작품마다 조회해 버리기)는 요청 수가 폭증하고 `docs/30`의 보충 한도(6회·45초)를 깨므로 쓰지 않는다.

### D-3. 애니는 "한국어 현지화 매칭" 대상 목록을 시청 가능 작품으로 한정해 거른다
현재 AniList 애니 후보는 같은 달 TMDB 일본 애니(discover `with_genres=16`)와 제목이 맞아 **한국어 제목을 얻은 것만** 살아남는다(`normalizeAniListAnime`가 한글 제목 없으면 `null`, `recommendationProviders.ts:873~`). 이 현지화 discover(`fetchTmdbKoreanAnimeMonth`)에 D-2 조건을 걸면 국내 OTT에 없는 애니는 현지화 매칭이 안 되어 자연히 빠진다. **이 결합은 의도된 것**이며 코드 주석으로 남긴다.

### D-4. 캐시 버전을 올린다
필터 없는 예전 페이지가 섞이지 않도록 `PROVIDER_CACHE_VERSION` `v3→v4`, `ANILIST_PROVIDER_CACHE_VERSION` `v4→v5`, `LOCALIZATION_CACHE_VERSION` `v2→v3`.

### D-5. 추천 카드에 "볼 수 있는 곳"을 표시한다 (최종 배치만)
personalized-recommendations가 응답 직전 **최종 반환 항목에 한해** 작품별 KR 제공처를 조회해 `watch_providers_kr`를 붙인다. 캐시 24시간, 요청당 최대 반환 개수만큼(현재 12), 동시 6개, 남은 시간 1초 미만이면 조회하지 않고 `null`. 조회 결과로 항목을 **빼지 않는다**(커서·보충 계약 `docs/28`·`docs/30` 보존). 카드에는 "넷플릭스 · 티빙 외 1"처럼 최대 2개 + 나머지 개수.

### D-6. 상대 순위 라벨 "이번 달 인기 N위"를 없앤다
`rank`는 레인별 상대 순위라 사용자에게 절대 인기처럼 읽힌다. `popularityLabel`은 AniList `popularity_count`가 있을 때의 "관심 N"만 남긴다. 평점 라벨 규칙은 그대로.

### D-7. 취향 탐색 이유 문구에서 "인기"를 뺀다
- `기존 선택과 다른 방향으로 ${detail}최신 인기작을 섞어봤어요.` → `기존 선택과 다른 방향으로 ${detail}최근 공개작을 섞어봤어요.`
- `새로운 취향 탐색을 위한 최근 인기작이에요.` → `새로운 취향 탐색을 위한 최근 공개작이에요.`

### D-8. 보러가기 개선
1. `ads`를 `free`에 합친다. 라벨은 `free`가 "무료", `ads`가 "무료(광고)". 같은 제공처가 둘 다 있으면 "무료" 하나.
2. 같은 분류에 넷플릭스(8)와 넷플릭스 광고형(1796)이 함께 있으면 1796을 뺀다.
3. 화이트리스트 제공처는 한국어 표기와 D-1 순서로 먼저, 그 외는 TMDB 이름·`display_priority` 순으로 뒤에.
4. KR이 비었으면 탭을 숨기고 안내문: 해외 제공 지역이 있으면 `국내 OTT 정보가 아직 없어요. 일본에서 제공 중이에요.`, 없으면 `국내 OTT에서 볼 수 있는 곳 정보가 아직 없어요.`
5. 첫 선택 탭은 제공처가 있는 첫 분류(정액제→무료→대여→구매).
6. 섹션 하단에 `시청 정보 제공: JustWatch`.
7. AniList 출처 작품도 조회한다. 서버가 TMDB에서 애니를 찾아(D-9) 그 TMDB id로 제공처를 가져온다.

### D-9. AniList → TMDB 매칭은 보수적으로
TMDB `/search/tv`를 원제(일본어)로, 없으면 한국어/영문 제목으로 검색하고, **장르 16(애니) 포함 + 방영 연도 ±1**인 결과 중 원제(`original_name`) 일치 > 표시 제목(`name`) 일치 순으로 고른다. 확신이 없으면 매칭하지 않는다(빈 결과가 틀린 제공처보다 낫다).

### D-10. 검색 결과·유사작·라이브러리는 거르지 않는다
검색은 "있는 걸 다 찾는" 기능이다. 이번 필터는 **추천 피드**에만 적용한다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

---

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| `with_watch_monetization_types`만 쓰고 제공처는 제한 안 함 | 측정상 현재 편수는 같지만(일드 29, 한드 73, 애니 61), 국내에서 쓰기 어려운 해외 서비스만 있는 작품이 섞일 수 있다. 화이트리스트가 의도를 명확히 한다 |
| 대여·구매도 "시청 가능"으로 인정 | 사용자가 말한 OTT 시청과 다르다. 측정 구간에서는 대여·구매를 넣어도 편수가 같아 얻는 게 없다 |
| 후보를 받은 뒤 작품마다 `/watch/providers`로 거르기 | 페이지당 20번 추가 요청. `docs/30` 보충 한도와 8.5초 요청 한도를 깬다 |
| 인기 순위 라벨을 "4월 공개작 중 5위"로 고치기 | 국가·장르 레인까지 설명해야 정확하다. 라벨 자체가 오해의 원인이라 제거 |
| 국내 OTT 작품 비중을 점수로만 올리기(soft boost) | 사용자는 "볼 수 있는 걸 넣어달라"고 했다. 섞여 나오면 같은 불만이 반복된다 |
| AniList `externalLinks`(STREAMING)로 애니 제공처 판단 | 지역 정보가 없어 국내 제공인지 알 수 없다 |
| popular-recommendations(인기 추천 Edge Function)도 같이 수정 | 현재 어느 화면도 렌더하지 않는다(`PopularRecommendationSection` 사용처 0). 12장 참고 |

---

## 6. 계약

모든 새 공용 코드는 `supabase/functions/_shared/`에 두고 테스트는 옆 `*.test.ts`. Deno 전용 API(`Deno.serve`, `Deno.env`)를 **새 순수 모듈에서 쓰지 않는다**(테스트가 Node `tsx`로 돈다).

### 6.1 `supabase/functions/_shared/titleMatch.ts` (신규, 이동)
```ts
export function normalizeTitleForMatch(value: string | null | undefined): string;
```
`recommendationProviders.ts:1167`의 함수를 **그대로 옮기고** `recommendationProviders.ts`는 이것을 import한다(동작 불변).

### 6.2 `supabase/functions/_shared/watchProviders.ts` (신규)
```ts
import { normalizeTitleForMatch } from "./titleMatch.ts";

export type WatchProviderCategory = "flatrate" | "free" | "rent" | "buy";

export interface TmdbProvider {
  display_priority?: number;
  logo_path?: string | null;
  provider_id?: number;
  provider_name?: string | null;
}
export interface TmdbWatchProviderRegion {
  link?: string;
  flatrate?: TmdbProvider[];
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
}

export interface KrOttProvider { id: number; group: string; name: string }
export const KR_OTT_PROVIDERS: readonly KrOttProvider[];      // D-1 표 순서 그대로
export const KR_OTT_PROVIDER_IDS: readonly number[];          // [8, 1796, 1883, 1881, 356, 337, 97, 350, 119, 283]
export const KR_OTT_MONETIZATION_TYPES: readonly ["flatrate", "free", "ads"];

export function applyKrOttDiscoverFilter(url: URL): void;

export interface KrOttProviderSummary { provider_id: number; name: string }
export function summarizeKrOttProviders(region: TmdbWatchProviderRegion | null | undefined): KrOttProviderSummary[];

export interface MappedWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_url: string | null;
  service_type: WatchProviderCategory;
  service_type_label: string;
  display_priority: number;
  link: string | null;
}
export function mapKrWatchProvidersByCategory(
  region: TmdbWatchProviderRegion | null | undefined,
  title: string | null
): Record<WatchProviderCategory, MappedWatchProvider[]>;

export function createProviderLink(provider: TmdbProvider, title: string | null): string | null;

export function listOtherAvailableRegions(
  results: Record<string, TmdbWatchProviderRegion | undefined> | null | undefined,
  limit?: number // 기본 5
): string[];

export interface TmdbTvSearchItem {
  id: number;
  name?: string | null;
  original_name?: string | null;
  first_air_date?: string | null;
  genre_ids?: number[] | null;
  popularity?: number | null;
}
export function matchTmdbAnimeForAniList(
  input: { titles: readonly (string | null | undefined)[]; year: number | null },
  results: readonly TmdbTvSearchItem[]
): number | null;

export interface KrOttLookupTarget {
  external_source: string;
  external_id: string;
  content_type: string;
  external_ids?: { tmdb?: string | null } | null;
}
export type KrWatchRegionFetcher = (kind: "tv" | "movie", tmdbId: string) => Promise<TmdbWatchProviderRegion | null>;
export function resolveTmdbLookupKey(item: KrOttLookupTarget): { kind: "tv" | "movie"; tmdbId: string } | null;
export async function attachKrOttProviders<T extends KrOttLookupTarget>(
  items: readonly T[],
  fetchRegion: KrWatchRegionFetcher,
  options?: { deadlineMs?: number; concurrency?: number; minRemainingMs?: number }
): Promise<(T & { watch_providers_kr: KrOttProviderSummary[] | null })[]>;
```

판정 규칙:

**`applyKrOttDiscoverFilter(url)`** — 세 파라미터만 `set`한다. 다른 파라미터는 건드리지 않는다.
- `watch_region` = `"KR"`
- `with_watch_providers` = `KR_OTT_PROVIDER_IDS.join("|")` → `"8|1796|1883|1881|356|337|97|350|119|283"`
- `with_watch_monetization_types` = `"flatrate|free|ads"`

**`summarizeKrOttProviders(region)`**
1. `region`이 없으면 `[]`
2. `flatrate`, `free`, `ads` 세 배열만 본다(`rent`, `buy` 무시)
3. `provider_id`가 화이트리스트에 있는 것만
4. 그룹 단위 중복 제거. 결과 항목은 **그 그룹의 화이트리스트 첫 항목**(`netflix` → `{ provider_id: 8, name: "넷플릭스" }`)
5. 화이트리스트 순서로 정렬

**`mapKrWatchProvidersByCategory(region, title)`**
1. 네 분류 모두 배열로 반환(없으면 `[]`)
2. `free` = `free` 항목(label "무료") + `ads` 항목(label "무료(광고)"). 같은 `provider_id`는 "무료" 하나만
3. 각 분류에서 `provider_id`가 숫자인 것만, `provider_id`로 중복 제거
4. 같은 분류에 8과 1796이 모두 있으면 1796 제거
5. 정렬 키: 화이트리스트면 그 인덱스(0~9), 아니면 `100 + (display_priority ?? 9999)`
6. `provider_name`: 화이트리스트면 D-1 표기, 아니면 `provider_name?.trim() || "Unknown"`
7. `logo_url`: `logo_path`가 있으면 `https://image.tmdb.org/t/p/original${logo_path}`
8. `service_type`은 출력 분류(ads도 `"free"`), `service_type_label`은 2번 라벨 또는 `정액제`/`대여`/`구매`
9. `display_priority`: `provider.display_priority ?? 9999`
10. `link`: `createProviderLink(provider, title) ?? region.link ?? null`

**`createProviderLink`** — `get-watch-providers/index.ts`의 기존 함수를 **그대로 옮긴다**(동작 불변).

**`listOtherAvailableRegions(results, limit = 5)`**
1. `results`가 없으면 `[]`
2. `KR`을 뺀 지역 중 `flatrate`·`free`·`ads` 중 하나라도 비어 있지 않은 지역 코드
3. 정렬: 우선순위 `["JP", "US", "TW", "HK", "SG", "TH", "GB", "CA", "AU", "FR", "DE"]`에 있는 코드가 그 순서대로 먼저, 나머지는 알파벳순
4. 앞에서 `limit`개

**`matchTmdbAnimeForAniList(input, results)`**
1. `titles`를 `normalizeTitleForMatch`로 정규화, 빈 문자열 제거, 중복 제거. 남은 게 없으면 `null`
2. 후보 자격: `genre_ids`에 16 포함 **그리고** (입력 `year`가 `null`이거나 후보 연도를 모르거나 `|후보연도 − year| ≤ 1`). 후보 연도 = `first_air_date` 앞 4자리
3. 점수: 정규화한 `original_name`이 titles에 있으면 2, 아니면 정규화한 `name`이 있으면 1, 둘 다 아니면 자격 없음
4. 최고 점수 → 동점이면 연도 차이 작은 것(모르면 99로 간주) → 동점이면 `popularity` 큰 것 → 동점이면 `id` 작은 것
5. 해당 `id`, 없으면 `null`

**`resolveTmdbLookupKey(item)`**
1. `external_source === "tmdb"`이고 `external_id`가 `/^\d+$/`이면 그 id
2. 아니면 `external_ids?.tmdb`가 `/^\d+$/`이면 그 id
3. 아니면 `null`
4. `kind` = `content_type === "movie" ? "movie" : "tv"`

**`attachKrOttProviders(items, fetchRegion, options)`**
1. 기본값: `concurrency` 6, `minRemainingMs` 1000
2. 입력 순서·개수 그대로 반환. **항목을 빼지 않는다**
3. 키가 `null`이면 `watch_providers_kr: null`, fetcher를 부르지 않는다
4. 조회를 시작하기 직전 `deadlineMs - Date.now() < minRemainingMs`이면 `null`, fetcher를 부르지 않는다
5. fetcher 성공 → `summarizeKrOttProviders(결과)` (fetcher가 `null`을 주면 `[]`)
6. fetcher 예외 → 그 항목만 `null`

### 6.3 `recommendationProviders.ts`에 추가하는 실제 조회 함수
```ts
export async function fetchKrWatchRegion(
  kind: "tv" | "movie",
  tmdbId: string,
  options?: { cache?: RecommendationCache; deadlineMs?: number }
): Promise<TmdbWatchProviderRegion | null>;
```
- 캐시 키 `kr-ott-watch-v1:${kind}:${tmdbId}`, source `"tmdb"`, 성공 TTL 24시간(값: `{ region: TmdbWatchProviderRegion | null }`). 실패는 저장하지 않고 예외를 던진다.
- 요청 `GET https://api.themoviedb.org/3/${kind}/${tmdbId}/watch/providers`, 인증은 기존 `applyTmdbAuth`, 타임아웃 2000ms, 기존 `fetchJson(url, init, 2_000, deadlineMs)`.
- 반환: `payload.results?.KR ?? null`.
- 기존 private 헬퍼(`readPersisted`, `writePersisted`, `fetchJson`, `applyTmdbAuth`)를 재사용한다.

### 6.4 클라이언트 `src/utils/watchProviderDisplay.ts` (신규)
```ts
import type { WatchProviderCategory, WatchProvidersByCategory } from "@/types/watchProviders";

export function pickInitialWatchCategory(providers: WatchProvidersByCategory): WatchProviderCategory;
export function formatWatchProviderLabel(providers: readonly { name: string }[] | null | undefined, max?: number): string | null;
export function formatRegionNames(codes: readonly string[]): string;
export function describeNoKrProviders(otherRegions: readonly string[] | null | undefined): string;
```
- `pickInitialWatchCategory`: `flatrate → free → rent → buy` 순서로 첫 비어 있지 않은 분류, 전부 비면 `"flatrate"`
- `formatWatchProviderLabel(p, max = 2)`: 없거나 빈 배열 → `null`. 길이 ≤ max → 이름을 `" · "`로 연결. 초과 → 앞 max개 연결 + `` ` 외 ${길이 - max}` ``
- `formatRegionNames`: `JP 일본, US 미국, TW 대만, HK 홍콩, SG 싱가포르, TH 태국, GB 영국, CA 캐나다, AU 호주, FR 프랑스, DE 독일`, 그 외는 코드 그대로. `", "`로 연결
- `describeNoKrProviders`: 비었거나 없으면 `"국내 OTT에서 볼 수 있는 곳 정보가 아직 없어요."`, 아니면 `` `국내 OTT 정보가 아직 없어요. ${formatRegionNames(r)}에서 제공 중이에요.` ``

### 6.5 응답 계약 변경
**`get-watch-providers` 요청** (기존 필드 유지 + 추가)
```ts
{ api_source: "tmdb" | "anilist"; external_id: string; media_type: "movie" | "tv";
  title?: string | null; original_title?: string | null; air_year?: number | null; watch_region?: "KR" }
```
**응답** (기존 필드 유지 + 추가)
```ts
{ external_source: "tmdb"; external_id: string /* 요청 id 그대로 */; tmdb_id: string | null;
  region: "KR"; link: string | null;
  providers: { flatrate; free; rent; buy };  // mapKrWatchProvidersByCategory 결과
  other_regions: string[];                   // listOtherAvailableRegions(payload.results)
  updated_at: string }
```
- `api_source`가 `tmdb`면 기존처럼 `external_id`로 조회, `tmdb_id = external_id`.
- `anilist`면: `original_title` → `title` 순서로(둘 다 있으면 각각) `GET /3/search/tv?query=…&language=ko-KR&include_adult=false` → 모든 결과를 모아 `matchTmdbAnimeForAniList({ titles: [original_title, title], year: air_year ?? null }, results)`. 매칭이 없으면 빈 응답(`tmdb_id: null`, `other_regions: []`). 매칭되면 그 id로 `tv` 제공처 조회.
- 그 외 source는 빈 응답.

**`personalized-recommendations` 응답 항목**에 `watch_providers_kr: { provider_id: number; name: string }[] | null` 추가.

---

## 7. 데이터 모델 / SQL

**없음.** 캐시는 기존 `external_search_cache`(service_role, `RecommendationCache`)를 쓴다.

---

## 8. 화면 명세

### 8.1 검색 탭 추천 카드 (`PersonalizedRecommendationGalleryCard`, `PersonalizedRecommendationListItem`, `RecommendationQuickViewModal`)
- 제목 바로 아래 한 줄: `Ionicons "tv-outline"` 12 + `presentation.watchProviderLabel` (`fontSize 11~12`, `fontWeight "700"`, `color colors.primary`, `numberOfLines={1}`). 라벨이 `null`이면 줄 자체를 렌더하지 않는다. 접근성 라벨 `시청 가능: ${label}`.
- 포스터 위 반응 배지(`ratingLabel ?? popularityLabel`)는 D-6으로 "이번 달 인기 N위"가 사라진다. 평점·"관심 N"은 그대로.
- 카드의 행동 버튼 구성·순서·크기는 **바꾸지 않는다**(`docs/28` D-5, `docs/30` D-4).

### 8.2 작품 상세 보러가기 (`WatchProviderList`)
- 새 prop `otherRegions?: readonly string[]`.
- 로딩·오류 문구는 그대로.
- 제공처가 하나도 없으면: 탭 4개 **숨김**, `describeNoKrProviders(otherRegions)` 문구.
- 제공처가 있으면: 탭 표시, 첫 선택 탭 = `pickInitialWatchCategory(providers)`. providers가 바뀌면(로딩 완료) 다시 계산한다. 사용자가 탭을 누른 뒤에는 같은 작품 안에서 사용자 선택을 유지한다.
- 섹션 맨 아래 `시청 정보 제공: JustWatch` (fontSize 11, 회색).
- 어두운 카드 스타일은 이번에 바꾸지 않는다(`docs/32` 2단계).

### 8.3 작품 상세 연결 (`app/content/[id].tsx:112~124, 488~492`)
- `useWatchProviders`에 `originalTitle`, `airYear` 추가 전달:
  - `originalTitle = externalDetail.data?.content.title_original ?? params.originalTitle ?? dbContent?.title_original ?? null`
  - `airYear = externalDetail.data?.content.air_year ?? (params.airYear ? Number(params.airYear) : null) ?? dbContent?.air_year ?? null`
- `WatchProviderList`에 `otherRegions={watchProviders.data.other_regions ?? []}`.

---

## 9. 엣지 케이스

| # | 상황 | 기대 동작 |
|---|------|-----------|
| E-1 | 일드인데 일본에서만 제공 | 추천 피드에 안 나옴. 검색으로 상세 진입 시 "국내 OTT 정보가 아직 없어요. 일본에서 제공 중이에요." |
| E-2 | 대여·구매만 있음 | 추천 피드 제외. 상세는 대여/구매 탭이 첫 선택 |
| E-3 | 넷플릭스와 넷플릭스 광고형 동시 | 상세·카드 모두 넷플릭스 하나 |
| E-4 | 광고형 무료만(크런치롤 ads) | 추천 가능(D-1). 상세 무료 탭에 "무료(광고)" |
| E-5 | 목록 밖 제공처만(Hoichoi 등) | 추천 제외. 상세에는 이름 그대로 표시 |
| E-6 | AniList 애니, TMDB 매칭 성공 | 상세 보러가기에 KR 제공처 |
| E-7 | AniList 애니, 같은 제목 실사판만 검색됨(장르 16 없음) | 매칭 안 함 → 빈 결과 |
| E-8 | AniList 애니, 연도 2 이상 차이 | 매칭 안 함 |
| E-9 | 추천 최종 항목의 제공처 조회가 시간 초과 | 그 항목 카드에 OTT 줄 없음. 항목은 그대로 |
| E-10 | 제공처 조회 결과 KR 없음(데이터 변동) | `[]` → 줄 없음. 항목은 그대로 |
| E-11 | 사용자가 국가 필터로 CN만 선택 | 중국 작품 중 국내 OTT 제공작만 |
| E-12 | 배포 직후 예전 캐시 페이지 | 캐시 버전 상향으로 재사용 안 됨 |
| E-13 | 신작 첫 방영 당일(JustWatch 미반영) | 추천에서 일시적으로 빠질 수 있음(13장 2번) |
| E-14 | 라프텔 단독 애니 | 판정 불가 → 추천 제외(13장 1번) |
| E-15 | 월별 후보가 줄어 12개 미달 | 기존 `docs/30` 보충 흐름대로 다음 달로 진행. 새 한도 추가 없음 |

---

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** `node:test` + `node:assert/strict`.

### `supabase/functions/_shared/watchProviders.test.ts`
제공처 픽스처: `p(id, name = "x", priority = 1) = { provider_id: id, provider_name: name, display_priority: priority, logo_path: null }`

| ID | 입력 | 기대 |
|----|------|------|
| W-1 | `new URL("https://x/discover/tv?page=2")` → `applyKrOttDiscoverFilter` | `watch_region` "KR", `with_watch_providers` "8\|1796\|1883\|1881\|356\|337\|97\|350\|119\|283", `with_watch_monetization_types` "flatrate\|free\|ads", `page` "2" 유지 |
| W-2 | `KR_OTT_PROVIDER_IDS` | `[8, 1796, 1883, 1881, 356, 337, 97, 350, 119, 283]` |
| W-3 | `summarizeKrOttProviders(undefined)` / `(null)` | `[]` / `[]` |
| W-4 | `{ flatrate: [p(8), p(1796), p(1883)] }` | `[{8,"넷플릭스"},{1883,"티빙"}]` |
| W-5 | `{ flatrate: [p(97)], ads: [p(283)] }` | `[{97,"왓챠"},{283,"크런치롤"}]` |
| W-6 | `{ rent: [p(8)], buy: [p(350)] }` | `[]` |
| W-7 | `{ flatrate: [p(315, "Hoichoi")] }` | `[]` |
| W-8 | `{ flatrate: [p(1796)] }` | `[{8,"넷플릭스"}]` |
| W-9 | `{ flatrate: [p(337), p(8)], free: [p(356)] }` | `[{8,"넷플릭스"},{356,"웨이브"},{337,"디즈니+"}]` |
| W-10 | `mapKrWatchProvidersByCategory({ free: [p(538,"Plex")], ads: [p(283), p(538,"Plex")] }, null)` | `free` = 크런치롤("무료(광고)", service_type "free"), Plex("무료") 순서: 크런치롤 먼저(화이트리스트), Plex 1개만 |
| W-11 | `{ flatrate: [p(8), p(1796)] }` / `{ flatrate: [p(1796)] }` | flatrate 이름 `["넷플릭스"]` / `["넷플릭스(광고형)"]` |
| W-12 | `{ flatrate: [p(700, " Zeta ", 3), p(356), p(701, "Alpha", 1)] }` | 순서·이름 `["웨이브", "Alpha", "Zeta"]` |
| W-13 | `mapKrWatchProvidersByCategory(undefined, null)` | 네 분류 모두 `[]` |
| W-14 | `{ link: "https://tmdb/x", flatrate: [p(8), p(538, "Plex")] }`, title "무빙" | 넷플릭스 link `"https://www.netflix.com/search?q=%EB%AC%B4%EB%B9%99"`, Plex link `"https://tmdb/x"` |
| W-15 | `{ KR: {flatrate:[p(8)]}, JP: {flatrate:[p(1)]}, US: {rent:[p(2)]}, FR: {ads:[p(3)]}, BR: {flatrate:[p(4)]} }` | `["JP", "FR", "BR"]` |
| W-16 | 7개 지역 모두 자격(JP, US, TW, BR, AR, CL, MX) | `["JP", "US", "TW", "AR", "BR"]` |
| W-17 | `listOtherAvailableRegions(undefined)` | `[]` |
| W-18 | titles `["黄泉のツガイ"]`, year 2026, results `[{id:260463, original_name:"黄泉のツガイ", name:"황천의 츠가이", first_air_date:"2026-04-04", genre_ids:[16,10759]}]` | `260463` |
| W-19 | titles `["薬屋のひとりごと"]`, year 2023, results 실사 `{id:333686, original_name 동일, genre_ids:[18]}` + 애니 `{id:220542, original_name 동일, first_air_date:"2023-10-22", genre_ids:[16,18]}` | `220542` |
| W-20 | W-18에서 year 2023 | `null` |
| W-21 | 후보 A `{id:1, name:"X", original_name:"Y", genre 16}`, B `{id:2, original_name:"X", genre 16}`, titles ["X"] | `2` |
| W-22 | 원제 일치 두 개: `{id:5, 2025년, popularity 1}`, `{id:6, 2026년, popularity 9}`, year 2026 / 둘 다 2026년이면 | `6` / popularity 큰 쪽 |
| W-23 | titles `["", null, "  "]` | `null` |
| W-24 | year `null`, 원제 일치·장르 16·2019년 | 그 id |
| W-25 | `attachKrOttProviders([{tmdb, "100", "kdrama"}], fetcher→{flatrate:[p(8)]})` | fetcher 호출 `("tv","100")`, `watch_providers_kr` `[{8,"넷플릭스"}]` |
| W-26 | `{tmdb, "200", "movie"}` | fetcher 호출 `("movie","200")` |
| W-27 | `{anilist, "999", "anime", external_ids:{tmdb:"260463"}}` | fetcher 호출 `("tv","260463")` |
| W-28 | `{anilist, "999", "anime"}` (tmdb 없음) | `null`, fetcher 호출 0회 |
| W-29 | 3개 중 두 번째만 fetcher 예외 | `[요약, null, 요약]`, 길이 3, 순서 유지 |
| W-30 | `deadlineMs: Date.now() + 500`, 기본 minRemainingMs | 전부 `null`, fetcher 호출 0회 |
| W-31 | fetcher가 `null` 반환 | `[]` |

### `supabase/functions/_shared/recommendationProviders.test.ts` (추가·수정)
| ID | 내용 | 기대 |
|----|------|------|
| P-1 | 기존 `withMockProviderFetch`로 `tmdb_kr`, `tmdb_jp`, `tmdb_movie`, `anilist` 페이지를 각각 요청 | `api.themoviedb.org/3/discover/*`로 가는 **모든** 요청(애니 현지화 `with_genres=16` 포함)에 W-1의 세 파라미터 값이 정확히 있음 |
| P-2 | 기존 "uses a persisted page on a cold in-memory cache…" 테스트의 키 정규식 | `/^recommendation-provider-v4:tmdb_jp:2024-03:1/`로 **수정**(D-4 의도된 버전 상향) |
| P-3 | 기존 "reuses persisted Korean localization…" 테스트의 접두사 | `"recommendation-anime-ko-v3:"`로 **수정** |
| P-4 | `fetchKrWatchRegion("tv","260463", { cache })` — mock 응답 `{ results: { KR: {flatrate:[p(8)]}, JP: {...} } }` | 반환 = KR 객체, 요청 경로 `/3/tv/260463/watch/providers`, 캐시 set 키 `kr-ott-watch-v1:tv:260463`, TTL 86_400_000 |
| P-5 | P-4에서 캐시 get이 `{ region: null }` 반환 | 네트워크 호출 0회, `null` 반환 |

"bypasses failures cached by the old nullable-country query without changing TMDB cache versions" 테스트는 **수정하지 않는다**(예전 키 무시를 검사하므로 그대로 통과해야 한다).

### `supabase/functions/_shared/recommendationPersonalization.test.ts` (추가)
| ID | 내용 | 기대 |
|----|------|------|
| R-1 | 기존 "uses an exploration reason without unsupported preference claims" 입력으로 `rankCandidates` | `recommendation_reason`에 `"최근 공개작"` 포함, `"인기"` 미포함 |
| R-2 | 테마가 있는 탐색 후보(기존 `themedCandidate` 사용) | 문구가 `"기존 선택과 다른 방향으로 "`로 시작하고 `"최근 공개작을 섞어봤어요."`로 끝남 |

### `src/utils/watchProviderDisplay.test.ts` (신규)
| ID | 입력 | 기대 |
|----|------|------|
| D-1 | 모두 빈 providers | `"flatrate"` |
| D-2 | rent만 | `"rent"` |
| D-3 | free, buy | `"free"` |
| D-4 | `formatWatchProviderLabel(null)` / `([])` | `null` / `null` |
| D-5 | `[{name:"넷플릭스"}]` | `"넷플릭스"` |
| D-6 | 넷플릭스, 티빙 | `"넷플릭스 · 티빙"` |
| D-7 | 넷플릭스, 티빙, 웨이브, 왓챠 | `"넷플릭스 · 티빙 외 2"` |
| D-8 | `formatRegionNames(["JP","US","XX"])` | `"일본, 미국, XX"` |
| D-9 | `describeNoKrProviders([])` / `(undefined)` | `"국내 OTT에서 볼 수 있는 곳 정보가 아직 없어요."` 둘 다 |
| D-10 | `describeNoKrProviders(["JP"])` | `"국내 OTT 정보가 아직 없어요. 일본에서 제공 중이에요."` |

### `src/utils/recommendationPresentation.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| C-1 | `buildPopularityPresentation(recommendation({ rank: 5, popularity_count: null }))` | `null` |
| C-2 | `popularity_count: 12000` | `"관심 "`으로 시작 |
| C-3 | `mapRecommendationToCardViewModel(recommendation({ watch_providers_kr: [{provider_id:8,name:"넷플릭스"},{provider_id:1883,name:"티빙"}] })).watchProviderLabel` | `"넷플릭스 · 티빙"` |
| C-4 | `watch_providers_kr` 없음 / `null` / `[]` | `watchProviderLabel` `null` |

### 수동 확인 (배포 후 사람이 한다)
| ID | 절차 | 기대 |
|----|------|------|
| M-1 | 추천 피드를 4월 공개작 구간까지 스크롤 | "오늘 밤, 비밀의 키친에서" 없음. "이번 달 인기 N위" 배지 없음 |
| M-2 | 추천 카드 | 대부분 카드에 `넷플릭스 · 티빙` 같은 OTT 줄 |
| M-3 | 검색 → "오늘 밤, 비밀의 키친에서" 상세 | 탭 없이 "국내 OTT 정보가 아직 없어요. 일본에서 제공 중이에요." + JustWatch 표기 |
| M-4 | 검색 → "황천의 츠가이"(AniList) 상세 | 정액제 탭에 넷플릭스·왓챠·티빙 |
| M-5 | "약사의 혼잣말"(TMDB 220542) 상세 → 무료 탭 | 크런치롤 "무료(광고)" |
| M-6 | 추천 피드 첫 12개 로딩 시간 | 배포 전과 비교해 체감 지연 없음(목표: 응답 8.5초 한도 내, 타임아웃 증가 없음) |

---

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/titleMatch.ts` | 신규 6.1 (함수 이동) |
| `supabase/functions/_shared/watchProviders.ts` (+test) | 신규 6.2 |
| `supabase/functions/_shared/recommendationProviders.ts` | 515·551·712행 `watch_region` 줄을 `applyKrOttDiscoverFilter(url)`로 교체, 캐시 버전 3개 상향, `normalizeTitleForMatch` import로 교체, `fetchKrWatchRegion` 추가, D-3 주석 |
| `supabase/functions/_shared/recommendationProviders.test.ts` | P-1~P-5 |
| `supabase/functions/_shared/recommendationEngine.ts` | 624·631행 문구 (D-7) |
| `supabase/functions/_shared/recommendationPersonalization.test.ts` | R-1·R-2 |
| `supabase/functions/personalized-recommendations/index.ts` | 응답 직전 `attachKrOttProviders` (D-5) |
| `supabase/functions/get-watch-providers/index.ts` | 6.5 (공용 모듈 사용, ads, other_regions, tmdb_id, anilist) |
| `src/types/watchProviders.ts` | 응답에 `tmdb_id?`, `other_regions?` |
| `src/services/watchProviders.ts` | anilist 허용, `originalTitle`·`airYear` 전달 |
| `src/hooks/useWatchProviders.ts` | tmdb 단락 제거(anilist도 조회), 새 파라미터 |
| `src/utils/watchProviderDisplay.ts` (+test) | 신규 6.4 |
| `src/components/content/WatchProviderList.tsx` | 8.2 |
| `app/content/[id].tsx` | 8.3 |
| `src/services/personalizedRecommendations.ts` | 타입에 `watch_providers_kr?` |
| `src/utils/recommendationPresentation.ts` (+test) | `watchProviderLabel` 추가, D-6 |
| `src/components/content/PersonalizedRecommendationGalleryCard.tsx` | 8.1 한 줄 |
| `src/components/content/PersonalizedRecommendationListItem.tsx` | 8.1 한 줄 |
| `src/components/content/RecommendationQuickViewModal.tsx` | 8.1 한 줄 |

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| `supabase/functions/popular-recommendations`와 `src/components/content/PopularRecommendationSection.tsx`, `usePopularRecommendations` | 현재 어떤 화면도 렌더하지 않는다. 참고로 이 섹션은 새로고침마다 목록을 회전시키며 순위를 `index + 1`로 **다시 매겨** 하위권도 1위로 보였다(`createVisibleRecommendations`). 되살릴 때 이 문서 D-1·D-6을 먼저 적용하거나 삭제를 검토 |
| 유사작 검색 "인기순" 정렬(`similar-content`) | 기준 작품과의 유사 검색이지 추천 피드가 아니다 |
| 검색 결과·라이브러리·홈 | D-10 |
| KR 외 지역 선택 | 앱이 한국 사용자 대상 |
| AniList→TMDB 매칭 결과의 영구 캐시 | 상세 진입당 TMDB 2회 호출로 충분. 필요하면 후속 |
| 보러가기 카드 디자인 | `docs/32` 2단계 |

## 13. 확실하지 않음 — 별도 검증 필요

1. **국내 전용 서비스 누락.** TMDB KR 제공처 목록(2026-09-28, TV 26개)에 라프텔·시리즈온·U+모바일tv·지니TV가 없다. 이런 곳에만 있는 작품(특히 라프텔 단독 애니)은 "국내 OTT 없음"으로 판정되어 추천에서 빠진다. 데이터 공급원(JustWatch)의 한계이며 이번 작업으로 해결되지 않는다.
2. **신작 반영 지연.** JustWatch가 새 작품의 국내 제공을 반영하기까지 며칠 걸릴 수 있다. 첫 방영 직후 작품이 잠시 추천에서 빠질 수 있다.
3. **TMDB 필터 조합 의미.** `with_watch_providers`(OR) + `with_watch_monetization_types`(OR) 동시 사용 시 "목록 제공처가 해당 방식으로 제공"으로 동작한다고 판단했다. 2026-09-28 실측(일드 264→29, 4월 일드 35→6, 반환 작품 4건의 KR 제공처가 모두 넷플릭스 정액제)과 일치하지만 문서상 보장은 아니다. 배포 후 M-1·M-2로 확인한다.
4. **JustWatch 출처 표기 의무.** TMDB API 문서가 시청 제공처 데이터 사용 시 JustWatch 출처 표기를 요구한다고 알고 있으나, 배포 전 TMDB 약관 원문으로 한 번 더 확인한다.
5. **추천 응답 시간.** 최종 항목 제공처 조회가 캐시 미스일 때 최대 약 2초 추가될 수 있다. `minRemainingMs` 1초 가드로 8.5초 한도는 넘지 않지만, 체감은 M-6으로 확인한다.
6. **보충 흐름.** 월별 후보가 줄어 `docs/30`의 보충이 더 자주 다음 달로 넘어간다. 한도(6회·45초)는 그대로 두며, 12개 미달이 늘면 별도 튜닝한다.
