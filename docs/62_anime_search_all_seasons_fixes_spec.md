# 62. 애니 검색에서 후속 시즌(2기·3기…)이 빠지는 문제 정정

작성일: 2026-10-16
대상 브랜치 기준: `main` (`bfcc3fd`) + 미커밋 작업(`docs/57`~`59` 구현). 이 시점 `npm test`는 1167개 중 1166개 통과다. 실패 1개("uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함이다. `search-content` 운영은 v27이다(docs/55까지, docs/56은 커밋만 됨).
선행 문서: `docs/15_season_search_spec.md`(AniList 시즌 해석 D-2), `docs/55_korean_search_spacing_fallback_spec.md`·`docs/56_korean_search_spacing_length_fixes_spec.md`(띄어쓰기 2단계 보정, TMDB 전용 D-4)

> **근거.** 사용자 캡처(웹, 검색 "감정스킬로"). 결과가 "전생 귀족, 감정 스킬로 성공하다"(TMDB, 2024.04, anime, 작품 전체로 등록됨) 1개뿐이다.
> 사용자 요청: "전생 귀족, 감정 스킬로 성공하다가 3기까지 존재하는데 1기만 있는거 같아 원인 찾아서 명세서 작성해줘"

---

## 1. 문제 정의
| ID | 증상 |
|----|------|
| F-1 | 붙여 쓴 한국어 검색어("감정스킬로")로 찾으면 TMDB 카드 1개만 나온다. AniList의 1기·2기·3기가 나오지 않는다 |
| F-2 | 띄어 쓴 전체 제목으로 찾으면 AniList 3개가 나오지만, 3기 카드 제목에 "3기"가 없어 1기와 같은 이름으로 보인다(연도만 2026) |

## 2. 근본 원인

### 2.1 데이터 (2026-10-16 실측, 읽기 전용)
| 출처 | 항목 |
|------|------|
| TMDB | `237150` 전생 귀족, 감정 스킬로 성공하다. **시즌 1 하나(2024-04-07, 28화)**에 1·2·3기를 모두 넣어 두었다(Returning Series) |
| AniList | `164702` 1기(2024.04, 12화) → SEQUEL `178434` 第2期(2024.09, 12화) → SEQUEL `185756` 第3期(2026.09, 방영 중) |

TMDB만으로는 시즌을 나눌 수 없고, 시즌별 카드는 AniList에서만 나온다.

### 2.2 F-1 — 붙여 쓴 검색어는 AniList까지 닿지 못한다
실제 어댑터로 재현한 결과다(`searchTmdb`·`searchAniList`·`createSearchQueryVariants`·`planKoreanWordSplitFallback`).

| 단계 | 질의 | TMDB | AniList |
|------|------|------|---------|
| 1단계 direct | `감정스킬로` | 0 | 0 |
| 1단계 compact-title | `감정스` | 0 | 0 |
| 2단계(docs/56, TMDB만) | `감 정` / `감정 스` / `감정스 킬` / `감정스킬 로` | 0 / **1** / 0 / 0 | 조회 안 함 |

- TMDB 검색은 단어 단위로 맞춘다(docs/55 2.1). 그래서 2단계의 `감정 스`가 TMDB `237150`을 찾는다.
- AniList 어댑터는 한국어 질의를 TMDB `search/tv`로 원제로 바꾼 뒤 AniList를 검색한다(`resolveAniListSearchInput`, `adapters/anilist.ts` 452~478행). 붙여 쓴 `감정스킬로`는 이 변환에서 TMDB 0건이라 AniList가 비고, 2단계는 docs/55 D-4에 따라 TMDB에만 보낸다.
- 결국 AniList 시즌 항목을 한 번도 조회하지 않는다.

### 2.3 F-2 — AniList 시즌 펼치기가 2기에서 멈춘다
- 띄어 쓴 `전생 귀족, 감정 스킬로 성공하다`는 AniList 변환이 성공해 원제 `転生貴族、鑑定スキルで成り上がる`로 검색한다. AniList는 3개를 모두 돌려준다.
- 그런데 `expandDirectSeasonRelations`(`adapters/anilist.ts` 216~236행)는 기본 작품마다 **2기 하나만** 관계로 펼친다:
  ```ts
  const sequel = resolveSeasonFromRelations(base, 2);
  ```
- 3기는 AniList 검색 결과에 "직접" 들어와 시즌 번호 없이 정규화된다.
  - `enrichWithTmdbKorean`이 TMDB 한국어 이름을 붙이는데, TMDB는 시즌을 하나로 묶었으므로 기본 제목 "전생 귀족, 감정 스킬로 성공하다"가 된다.
  - 그래서 "3기"가 붙지 않는다.
- `resolveSeasonFromRelations(base, 3)`은 이미 `185756`을 정확히 찾는다(실측). 검색 쿼리는 관계를 8단계까지 받는다(`MAX_SEASON_RELATION_DEPTH = 8`). 펼치는 쪽이 2기에서 멈추는 것이 원인이다.

## 3. 재현 시나리오
1. 웹 8081에 로그인한 뒤 검색 탭에서 "감정스킬로"를 검색한다. TMDB 카드 1개다(F-1).
2. "전생 귀족, 감정 스킬로 성공하다"를 검색한다. 1기, 2기, 그리고 "전생 귀족, 감정 스킬로 성공하다"(2026, 3기 표시 없음)가 나온다(F-2).

## 4. 설계 결정

### D-1 (최우선). AniList 시즌 펼치기는 이어지는 TV 시즌 전부(최대 8기)다
- `expandDirectSeasonRelations`는 기본 작품(앞 3개, 이전 TV 시즌이 없는 것)마다 `seasonNumber = 2, 3, …`로 `resolveSeasonFromRelations(base, n)`을 부른다. `null`이 나오거나 `MAX_EXPANDED_SEASON_NUMBER = 8`에 이르면 멈춘다.
- 펼친 시즌은 지금 2기와 같이 처리한다(`resolved: true`).
  - 제목: 시즌 자체 한국어 제목, 없으면 기본 한국어 제목 + " N기"(`applySeasonDisplayTitle`)
  - `matched_via: "season_relation"`
- 펼친 시즌이 검색 결과에 직접도 들어와 있으면, 순서와 관계없이 펼친 쪽(시즌 번호 있음)을 남긴다(`dedupeAniListSearchMediaItems`가 이미 그렇게 고른다).
  - 그러려면 펼친 시즌은 앞서 같은 id를 직접 결과로 봤더라도 추가해야 한다(6.1).
- 8기 상한은 검색 쿼리가 받는 관계 깊이(8)와 같다.

### D-2. 붙여 쓴 검색어가 2단계에서 TMDB 애니를 찾으면, 그 제목으로 AniList를 한 번 더 찾는다
- 조건: 2단계가 실행됐고(`plan.reason === "run"`), 1단계 소스에 AniList가 있고, 2단계 결과에 TMDB 애니(`content_type === "anime"`, 한글 제목)가 있을 때다.
- 질의는 그 TMDB 애니의 `title_primary`(예: "전생 귀족, 감정 스킬로 성공하다")다.
  - AniList 어댑터의 한국어 → 원제 변환이 정확한 한국어 제목으로 성공하고, D-1로 모든 시즌이 펼쳐진다.
- 변형은 `matchMode: "compact-title"`, `compactQuery: 사용자 검색어의 공백 뺀 형태`다. 사용자 검색어("감정스킬로")와 맞는 결과만 남는다. 펼친 시즌은 기존 규칙상 `season_relation`이라 남는다.
- 최대 2개 작품(2단계 결과 순서, 공백 뺀 제목 기준 중복 제거)까지다. AniList 호출은 검색당 최대 2회다(+ 어댑터 내부 TMDB 변환 2회).
- 남은 시간이 2,500ms 이상일 때만 한다. 제한 시간은 `min(5000, 남은 시간 − 1000)`이다.
- docs/55 D-4(2단계는 TMDB만)는 그대로다. 이것은 2단계가 애니를 찾았을 때만 하는 별도 3단계다.

### D-3. 3단계도 기존 규칙을 따른다
- 캐시 키·저장은 `searchQueryVariants`로 한다.
- 결과는 `compactResults`로 합친다. TMDB 카드와 AniList 1기는 같은 작품으로 합쳐지고, 애니라 AniList가 우선이다.
- `hasNextPage`는 1단계만 본다(docs/55 D-6).
- 성공·실패 소스, `cached`는 세 단계를 합친다.
- 응답에 선택 필드 `anime_follow_up: boolean`(3단계를 검색했는가)을 추가한다.

### D-4. 판정은 순수 함수로 둔다
- 3단계 판정은 `planAniListAnimeFollowUp`(`adapters/normalize.ts`)이 한다.
- 시즌 펼치기는 기존 `expandDirectSeasonRelations`를 고친다.
- `index.ts`는 판정 결과대로 부르기만 한다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| 2단계를 AniList에도 보냄 | 붙여 쓴 질의마다 AniList 최대 4회. docs/55 D-4(입력마다 검색, AniList 분당 한도)와 충돌한다. 3단계는 애니를 찾았을 때만 최대 2회다 |
| TMDB 시즌 1을 에피소드 수로 1·2·3기로 나눔 | TMDB 데이터만으로 경계를 알 수 없다 |
| 직접 들어온 후속작에 이전 시즌 수를 세어 번호만 붙임 | 기본 작품이 결과에 있으면 D-1로 해결된다. 기본 작품 없이 후속작만 들어오는 경우는 드물다(12장) |
| 펼치기 상한 없음 | 관계 깊이(8) 밖은 데이터가 없다. 장기 시리즈에서 카드가 지나치게 늘어난다 |

## 6. 계약

### 6.1 `supabase/functions/search-content/adapters/anilist.ts`
```ts
export const MAX_EXPANDED_SEASON_NUMBER = 8;
export function expandDirectSeasonRelations(mediaItems: AniListMedia[]): AniListSearchMediaItem[];  // 시그니처 불변
```
**판정 순서**(216~236행 교체)
1. 결과 배열 `expanded`와 `directIds`·`resolvedIds` 집합을 둔다.
2. 각 `base`(인덱스 순)에 대해:
   1. `directIds`·`resolvedIds`에 없으면 `{ item: base, base, resolved: false }`를 추가하고 `directIds`에 넣는다.
   2. `index >= 3`이거나 `hasEligiblePrequel(base)`이면 다음 `base`로 넘어간다(기존과 같음).
   3. `n = 2`부터 `MAX_EXPANDED_SEASON_NUMBER`까지 `resolveSeasonFromRelations(base, n)`을 부른다.
      - `null`이면 멈춘다.
      - `resolvedIds`에 없으면 `{ item: season, base, resolved: true, seasonNumber: n }`을 추가하고 `resolvedIds`에 넣는다. `directIds`에 있어도 추가한다.
3. 반환한다. 같은 id의 직접·펼친 항목이 모두 있으면 호출부의 `dedupeAniListSearchMediaItems`가 펼친 쪽을 남긴다(기존).

`resolveSeasonFromRelations`, `dedupeAniListSearchMediaItems`, `applySeasonDisplayTitle`, `normalizeAniListItem`은 바꾸지 않는다.

### 6.2 `supabase/functions/search-content/adapters/normalize.ts` (추가)
```ts
export const ANIME_FOLLOW_UP_MAX = 2;
export const ANIME_FOLLOW_UP_MIN_REMAINING_MS = 2_500;
export type AnimeFollowUpReason = "run" | "no_fallback" | "no_anilist" | "no_anime" | "time";
export function planAniListAnimeFollowUp(input: {
  query: string;
  fallbackRan: boolean;
  sources: readonly string[];
  remainingMs: number;
  fallbackResults: readonly SearchResult[];
  primaryVariants: readonly SearchQueryVariant[];
}): { variants: SearchQueryVariant[]; reason: AnimeFollowUpReason };
```
**판정 순서** — 처음 걸린 이유로 끝낸다. 실행하지 않는 경우 `variants`는 `[]`다.
1. `!fallbackRan` → `"no_fallback"`
2. `sources`에 `"anilist"`가 없음 → `"no_anilist"`
3. 대상 제목을 모은다.
   - `fallbackResults` 중 `external_source === "tmdb"`, `content_type === "anime"`이고 `title_primary`에 한글이 있는 것을 순서대로 본다.
   - `compactSearchText(title_primary)`가 같은 것은 처음 하나만 둔다.
   - `primaryVariants`의 `query`와 같은 문자열은 뺀다.
   - 앞 `ANIME_FOLLOW_UP_MAX`개만 쓴다. 0개면 `"no_anime"`이다.
4. `remainingMs < ANIME_FOLLOW_UP_MIN_REMAINING_MS` → `"time"`
5. 각 제목을 `{ query: collapseWhitespace(title), matchMode: "compact-title", compactQuery: compactSearchText(collapseWhitespace(input.query)) }`로 만들고 `"run"`이다.

### 6.3 `supabase/functions/search-content/index.ts`
2단계(152~162행) 다음에 아래를 넣는다.
```ts
const followUp = planAniListAnimeFollowUp({
  query: normalizedQuery, fallbackRan: plan.reason === "run", sources: targetSources,
  remainingMs: requestDeadline - Date.now(), fallbackResults: fallback.results, primaryVariants: queryVariants
});
const animeFollowUp: VariantSearchOutcome = followUp.reason === "run"
  ? await searchQueryVariants(adminClient, ["anilist"], followUp.variants, fetchMediaType, page,
      Math.min(ADAPTER_TIMEOUT_MS, requestDeadline - Date.now() - 1000))
  : { results: [], totals: [], hasNextPage: false, successfulSources: [], failedSources: [], misses: 0 };
```
- `unfilteredResults = compactResults([...primary.results, ...fallback.results, ...animeFollowUp.results])`
- `successfulSources`·`failedSources`는 세 단계를 합친다.
- `cached`는 세 단계 `misses` 합이 0일 때다.
- `total`의 `Math.max`에 `animeFollowUp.totals`를 더한다.
- `hasNextPage`는 `primary.hasNextPage` 그대로다.
- `SearchResponse`에 `anime_follow_up?: boolean`을 추가하고, 응답에 `anime_follow_up: followUp.reason === "run"`을 넣는다.
- `SEARCH_CACHE_VERSION`은 올린다(`"ko-v15-all-seasons"`). AniList 어댑터 결과(D-1 펼치기)가 바뀌므로 이전 캐시(1시간)의 2기까지만 있는 결과를 쓰지 않게 한다.

## 7. 데이터 모델 / SQL
변경 없음.

## 8. 화면 명세
화면 구성 변경은 없다. 검색 카드에 AniList 시즌 카드(1기·2기·3기…)가 늘어날 뿐이다. 시즌 카드 제목은 기존 `applySeasonDisplayTitle` 규칙을 따른다.

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 1→2→3기 관계 | 1기, 2기(S2), 3기(S3) | AS-1, M-1 |
| E-2 | TV 시즌 10개 이어짐 | 8기까지만 펼침 | AS-2 |
| E-3 | 3기가 기본 작품보다 앞에 직접 들어옴 | 3기는 시즌 3으로 표시(직접 항목 대신 펼친 항목) | AS-3 |
| E-4 | 후속작이 검색 결과에 직접 들어오고 기본 작품은 없음 | 지금처럼 시즌 번호 없이 표시(12장) | 기존 "does not relabel…" |
| E-5 | 2단계에서 TMDB 애니 1개 발견("감정스킬로") | AniList 3단계 1회, 결과 1기·2기·3기, TMDB 카드는 1기와 합쳐짐 | AF-1, M-1 |
| E-6 | 2단계가 실행되지 않음(1단계에 맞는 결과 있음) | 3단계 없음 | AF-2 |
| E-7 | AniList가 소스에 없음 | 3단계 없음 | AF-3 |
| E-8 | 2단계 결과가 드라마·영화뿐이거나 한글 제목 없음 | 3단계 없음 | AF-4 |
| E-9 | 남은 시간 2,500ms 미만 | 3단계 없음(경계 2,500은 실행) | AF-5 |
| E-10 | 2단계 애니가 3개 이상 / 같은 제목 중복 | 앞 2개만, 중복은 한 번 | AF-6 |
| E-11 | 애니 제목이 1단계 질의와 같음 | 다시 찾지 않음 | AF-7 |
| E-12 | 3단계 AniList 실패 | 1·2단계 결과로 응답, `failedSources`는 다른 단계에서 AniList가 성공했으면 제외 | 6.3 |
| E-13 | 띄어 쓴 전체 제목 검색 | 2단계·3단계 없이 1단계에서 1기·2기·3기(D-1) | M-2 |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 기존 테스트는 고치지 않는다. 특히 `anilist.test.ts`의 "includes the immediate sequel for a base-title search"와 "does not relabel a sequel search result as season two", `normalize.test.ts`의 WS·WP 행은 그대로 통과해야 한다. 보존 테스트는 없다. 새 행은 구현 전에 모두 실패해야 한다.

### `supabase/functions/search-content/adapters/anilist.test.ts` (추가)
픽스처는 파일의 기존 `media(id, format, year, relations?)`·`sequel(node)` 도우미로 만든다. 연쇄는 `first.relations = [sequel(second)]`, `second.relations = [sequel(third)]` 식이다.
| ID | 입력 | 기대 |
|----|------|------|
| AS-1 | `expandDirectSeasonRelations([first])`. `media(164702, "TV", 2024)` → `media(178434, "TV", 2025)` → `media(185756, "TV", 2026)` 연쇄(도우미는 연도만 넣으므로 시즌마다 연도를 다르게 한다. 같은 연도면 `findNextEligibleSeason`이 "이후 시즌"으로 보지 않는다) | `[{164702, undefined}, {178434, 2}, {185756, 3}]`(id·seasonNumber) |
| AS-2 | TV 10개 연쇄(연도 증가) | 시즌 번호 `undefined, 2, 3, 4, 5, 6, 7, 8`, 길이 8 |
| AS-3 | `dedupeAniListSearchMediaItems(expandDirectSeasonRelations([third, first]))` (`third`는 이전 시즌 관계를 가진 직접 결과) | `185756` 항목이 하나뿐이고 `resolved: true`, `seasonNumber: 3` |

### `supabase/functions/search-content/adapters/normalize.test.ts` (추가)
`result(title, original, overrides)` 도우미로 결과를 만든다(TMDB 애니는 `{ external_source: "tmdb", content_type: "anime" }`).
| ID | 입력 | 기대 |
|----|------|------|
| AF-1 | `{ query: "감정스킬로", fallbackRan: true, sources: ["tmdb","anilist"], remainingMs: 5000, fallbackResults: [TMDB 애니 "전생 귀족, 감정 스킬로 성공하다"], primaryVariants: createSearchQueryVariants("감정스킬로") }` | `reason: "run"`, `variants: [{ query: "전생 귀족, 감정 스킬로 성공하다", matchMode: "compact-title", compactQuery: "감정스킬로" }]` |
| AF-2 | AF-1에서 `fallbackRan: false` | `{ variants: [], reason: "no_fallback" }` |
| AF-3 | AF-1에서 `sources: ["tmdb"]` | `reason: "no_anilist"` |
| AF-4 | `fallbackResults`가 `[kdrama 결과]` / `[anilist 출처 애니]` / `[TMDB 애니 "Tensei Kizoku"]`(한글 없음) | 모두 `reason: "no_anime"` |
| AF-5 | AF-1에서 `remainingMs: 2499` / `2500` | `"time"` / `"run"` |
| AF-6 | TMDB 애니 A, A(공백만 다른 같은 제목), B, C | 질의 `[A, B]` |
| AF-7 | AF-1에서 `primaryVariants`에 `{ query: "전생 귀족, 감정 스킬로 성공하다", matchMode: "direct", compactQuery: "감정스킬로" }` 포함 | `reason: "no_anime"` |

### 수동 확인 (배포 후)
| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 | "감정스킬로" → 전생 귀족, 감정 스킬로 성공하다 / … 2기 / … 3기 세 카드. 응답 `anime_follow_up: true` |
| M-2 | 웹 8081 | "전생 귀족, 감정 스킬로 성공하다" → 세 카드, 3기 제목에 "3기" |
| M-3 | 웹 8081 | "오징어게임"·"너말고" → 기존과 같음, `anime_follow_up: false` |
| M-4 | 앱(iOS 세로) | M-1과 같음 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/search-content/adapters/anilist.ts` | 6.1 |
| `supabase/functions/search-content/adapters/anilist.test.ts` | AS-1~AS-3 |
| `supabase/functions/search-content/adapters/normalize.ts` | 6.2 |
| `supabase/functions/search-content/adapters/normalize.test.ts` | AF-1~AF-7 |
| `supabase/functions/search-content/index.ts` | 6.3 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| 기본 작품 없이 후속작만 직접 검색될 때의 시즌 번호 | 드물고, 기존 테스트가 직접 후속작을 다시 번호 매기지 않도록 고정한다 |
| TMDB로 등록한 작품과 AniList 시즌 카드의 "등록됨" 연결 | 검색 카드 등록 판정은 출처:id 기준이다(`app/search.tsx` `isResultAlreadyAdded`). 이번 사례처럼 TMDB 전체로 등록한 경우 AniList 카드는 미등록으로 보인다. 띄어 쓴 검색에서도 이미 그렇다. 별도 작업 |
| `npm run search:golden`에 AniList 사례 추가 | 골든 검사는 TMDB 어댑터 전용이다(docs/35) |
| 1단계 AniList 변환 방식 | 띄어 쓴 질의에서는 이미 동작한다 |

## 13. 확실하지 않음
- AniList는 분할 방영(2쿨)을 별도 항목으로 두기도 한다. 이 경우 "N기"가 실제 시즌 수보다 클 수 있다. 기존 2기 펼치기도 같은 규칙(`findNextEligibleSeason`)이다.
- 3단계 AniList 호출은 붙여 쓴 애니 검색에서만 늘어난다. 입력마다 검색하는 환경에서 AniList 분당 한도에 닿는지는 측정하지 않았다(캐시 1시간).

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 결함 수정 작업이다.
"전생 귀족, 감정 스킬로 성공하다"는 AniList에 1·2·3기가 있는데 검색에 1기만 나온다. TMDB는 세 시즌을 시즌 1 하나로 묶어 두었다.
- 붙여 쓴 검색어는 AniList까지 닿지 않는다(F-1).
- AniList 시즌 펼치기가 2기에서 멈춘다(F-2).

AniList 시즌 펼치기를 이어지는 TV 시즌 전부(최대 8기)로 넓힌다. 붙여 쓴 검색어가 2단계에서 TMDB 애니를 찾으면 그 제목으로 AniList를 한 번 더 찾는다.

| ID | 증상 |
|----|------|
| F-1 | "감정스킬로" 검색 → TMDB 카드 1개(AniList 시즌 없음) |
| F-2 | 띄어 쓴 전체 제목 검색 → 3기에 "3기" 표시 없음 |

# READ FIRST
1. 이 명세서 1~13장. 원인과 실측은 2장, 결정은 D-1~D-4, 계약은 6장, 테스트는 10장이다.
2. `docs/15_season_search_spec.md` D-2·D-5 — AniList 시즌 해석과 표시 제목.
3. `docs/55_korean_search_spacing_fallback_spec.md` D-4·D-6 — 2단계는 TMDB만, `hasNextPage`는 1단계만.
4. `AGENTS.md` — 테스트 규칙.
5. 고칠 파일과 위치:
   - `supabase/functions/search-content/adapters/anilist.ts`: 6행, 172~183행, 216~269행, 437~444행
   - `supabase/functions/search-content/adapters/anilist.test.ts`: 121~165행
   - `supabase/functions/search-content/adapters/normalize.ts`: 309~347행
   - `supabase/functions/search-content/index.ts`: 34~49행, 61행, 150~196행

# 시작 상태 (반드시 유지)
- `git status`와 `npm test` 결과를 기록한다. 작성 시점 기준선은 1167개 중 1166개 통과이고, 기존 실패 1개는 무관하다. 숫자가 다르면 시작 시점 값을 기준선으로 보고한다. 그 밖의 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** `expandDirectSeasonRelations`는 기본 작품(앞 3개, 이전 TV 시즌 없음)마다 2~8기를 `resolveSeasonFromRelations`로 펼친다.
  - 펼친 시즌은 같은 id의 직접 결과가 있어도 추가한다. 중복은 `dedupeAniListSearchMediaItems`가 펼친 쪽으로 정리한다.
  - 기존 테스트 두 개("includes the immediate sequel…", "does not relabel…")를 고치지 않는다.
- **D-2.** 2단계가 실행됐고 그 결과에 TMDB 애니(한글 제목)가 있을 때만, 그 제목(최대 2개)으로 AniList를 `compact-title`(사용자 검색어 기준)로 한 번 더 찾는다.
  - 남은 시간은 2,500ms 이상이어야 한다.
  - 2단계 자체는 TMDB 전용 그대로다.
- **D-3.** 3단계는 `searchQueryVariants`·캐시·`compactResults`를 그대로 쓴다.
  - `hasNextPage`는 1단계만 본다.
  - 응답에 `anime_follow_up`을 추가한다.
  - `SEARCH_CACHE_VERSION`은 `"ko-v15-all-seasons"`로 올린다.
- **D-4.** 판정은 `planAniListAnimeFollowUp` 순수 함수다.

# STEP 1 — 실패하는 테스트부터
- 10장 AS-1~AS-3을 `anilist.test.ts`에, AF-1~AF-7을 `normalize.test.ts`에 추가한다.
- `npm test`로 새 테스트가 전부 실패하는지 확인한다(AS는 3기 이상 미펼침, AF는 새 export 없음). 하나라도 통과하면 멈추고 보고한다.

# STEP 2 — AniList 시즌 펼치기
6.1대로 `expandDirectSeasonRelations`를 고치고 `MAX_EXPANDED_SEASON_NUMBER`를 추가한다. AS 행과 기존 AniList 테스트가 통과해야 한다.

# STEP 3 — 3단계 판정
6.2대로 `planAniListAnimeFollowUp`을 추가한다. AF 행과 기존 WS·WP 행이 통과해야 한다.

# STEP 4 — Edge Function
6.3대로 `index.ts`에 3단계를 넣고 응답 필드·캐시 버전을 바꾼다. 1·2단계 동작은 그대로다(diff로 확인).

# 엣지 케이스
9장 E-1~E-13 전부.

# 검증 명령
```
npm test
npm run typecheck
npm run lint
npx --no-install esbuild supabase/functions/search-content/index.ts --bundle=false --format=esm --log-level=warning > /dev/null
npm run search:golden
```
- `npm test`: 기준선 통과 개수 + 새 테스트 10개(AS-1~AS-3, AF-1~AF-7). 기존 실패 1개 외 실패는 0이어야 한다.
- esbuild는 오류 0이어야 한다.
- `search:golden`은 기존 통과 수 그대로다(TMDB 전용이라 이번 변경으로 바뀌지 않아야 한다).

# DEFINITION OF DONE
- [ ] AS-1~AS-3, AF-1~AF-7이 수정 전에 실패했고 수정 후 통과한다
- [ ] 기존 테스트 diff가 없고, 테스트 개수가 줄지 않았다
- [ ] `expandDirectSeasonRelations`가 2~8기를 펼친다. 기존 `resolveSeasonFromRelations`·`dedupeAniListSearchMediaItems`·`applySeasonDisplayTitle` 본문 diff가 없다
- [ ] 3단계는 `planAniListAnimeFollowUp`이 `"run"`일 때만, AniList 소스로만 실행된다
- [ ] `hasNextPage`가 1단계만 본다. 응답에 `anime_follow_up`이 있다. 캐시 버전이 `ko-v15-all-seasons`다
- [ ] `typecheck`·`lint`·esbuild 통과, `search:golden` 기존과 같음(또는 실행 못 한 사유)

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
supabase/functions/search-content/adapters/anilist.ts
supabase/functions/search-content/adapters/anilist.test.ts
supabase/functions/search-content/adapters/normalize.ts
supabase/functions/search-content/adapters/normalize.test.ts
supabase/functions/search-content/index.ts
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력(요약)
2. `npm test` before / after 통과 개수, `typecheck`·`lint`·esbuild·`search:golden` 결과
3. 추가한 테스트 ID와 이름
4. `index.ts`에서 1·2단계 동작이 그대로인지 확인한 방법
5. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
6. 사람이 할 후속 작업: `search-content` 재배포. docs/56(커밋됨, 미배포)도 함께 나간다는 점을 적는다

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
- TMDB 키 등 비밀 값을 출력하지 않는다. 로그인 대행 금지.
