# 41. 검색 추천 "취향 보충" 레인 명세 (빈 추천 정정)

작성일: 2026-10-03
대상 브랜치 기준: `main` (`6734575`) + 미커밋 보러가기 링크 작업(`watchProviders.ts`, `watchProviderLinks.ts` 등). 이 시점 `npm test` 847개 중 846개 통과 — 실패 1개는 무관한 기존 결함
선행 문서: `docs/22`(추천 탭), `docs/27`(테마 제외), `docs/28`·`docs/30`(커서·12개 보충·자동 이어찾기), `docs/33`(국내 OTT 한정), `docs/35`(배포 불일치), `docs/00_ui_style_rules.md`(화면 문구가 바뀔 때)

> **근거.** 사용자 캡처(검색 탭 추천, 넓은 웹): "이번 범위에서 조건에 맞는 새 작품을 찾지 못했어요" + "이 계정에서 제외 중: 3개". 사용자 라이브러리 560개.
> 사용자 요청: "검색에서 추천하기 기능이 제대로 동작 안 하는 것 같다. 필터에 맞게 로그인한 사용자의 취향에 맞는 작품들을 추천하게끔."

---

## 1. 문제 정의

| ID | 증상 | 원인 (2장 실측) |
|----|------|------|
| R-1 | 추천이 하나도 안 나오고 빈 상태 | **운영 `personalized-recommendations`가 v19(2026-09-27 18:38)로 코드보다 오래됐다**(`npm run edge:drift`: stale). 그 배포본은 국내 OTT 조건 없이 매달 전 세계 신작을 훑어 요청 한도(제공처 3라운드·1초·키워드 16회) 안에 이번 달을 끝내지 못한다. 최근 인기작을 이미 등록한 사용자는 이번 달 후보가 전부 빠지고 커서가 이번 달(2026-10)에 묶여 이전 달로 못 간다 → 3회 연속 0개 → 앱이 자동 이어찾기를 멈춤(`MAX_CONSECUTIVE_RECOMMENDATION_NO_PROGRESS_ATTEMPTS = 3`) |
| R-2 | BL·GL·퀴어 제외를 켜면 더 쉽게 비어 버린다 | 키워드 근거 없는 TMDB 후보는 서버(`recommendationUserFilters.ts:58~61`)·앱(`excludedThemes.ts:35~41`) 모두 숨긴다. 요청당 키워드 조회 16회 한도라 후보가 더 줄어든다 |
| R-3 | "취향 추천"인데 취향보다 "최근 공개작"이 기준이다 | 후보는 **공개 월 단위로만** 모은다(`recommendationCatalog.ts`, 제공처 `tmdb_kr`·`tmdb_jp`·`anilist`·`tmdb_movie`, 이번 달부터 한 달씩 과거로). 취향 프로필(`buildPreferenceProfile`의 장르·유형 점수)은 그 달 후보의 **순서**에만 쓰인다. 오래 쓴 사용자는 최근작을 대부분 등록해 후보가 바닥나고, 취향 장르의 좋은 구작은 후보에 들어오지도 않는다 |

## 2. 실측 (2026-10-03, TMDB·AniList 읽기 전용, 서버 로직을 로컬에서 그대로 실행)

| 코드 | 상황 | 6회 요청 결과 |
|------|------|---------------|
| 현재(`HEAD`) | 라이브러리 비어 있음, 제외 없음 | 요청마다 12개(합 72) |
| 현재 | 라이브러리 비어 있음, BL·GL·퀴어 제외 | 10~12개(합 70) |
| 현재 | **최근 추천 141개를 이미 등록한 사용자** + 제외 | 6·10·10·5·12·12(합 55), 커서 2026-08→04로 진행 |
| 배포본 시점(`b476849`) | 최근 추천 63개 등록 + 제외 | **0·0·0 → 앱 중단(빈 상태 재현)**, 커서 2026-10 고정 |
| 배포본 시점 | 최근 추천 63개 등록, 제외 없음 | 6·0·0·3·0·1(합 10), 커서 2026-10 고정 |

결론: **재배포만으로 빈 화면은 대부분 해소된다(R-1).** 그러나 현재 코드도 "최근 공개작 중 취향 순"이라 등록이 많을수록 후보가 줄고, 취향 장르의 구작을 추천하지 못한다(R-3). 이 명세는 R-3를 고친다.

## 3. 목표 동작

1. 기존 "최신 레인"(월 단위 카탈로그 스캔)을 그대로 먼저 돈다.
2. 한 요청에서 최신 레인이 12개를 못 채우면 **"취향 보충 레인"**이 남은 자리를 채운다: 사용자의 취향 유형·장르(또는 사용자가 고른 장르·국가 필터)로 **기간 제한 없이** 국내 OTT 제공작을 TMDB discover로 찾아, 같은 제외·필터·라이브러리 검사를 거쳐 같은 취향 순위로 넣는다.
3. 최신 레인이 끝나도(`nextCursor` 없음) 취향 레인이 남아 있으면 `has_more: true`로 계속 내려준다. 둘 다 끝나야 `is_exhausted: true`.
4. 결과적으로 "조건에 맞는 국내 OTT 작품이 하나라도 남아 있는 한" 빈 상태가 나오지 않는다.

## 4. 설계 결정

### D-1 (최우선). 최신 레인을 바꾸지 않는다
`scanRecommendationCatalog`와 4개 제공처·월 커서·정렬(`latest-popular-v2`)·제외 규칙은 그대로다. 취향 레인은 **뒤에 덧붙는 보충**이다. `docs/28`·`docs/30`의 커서·12개 계약을 깨지 않는다.

### D-2. 취향 레인 질의는 순수 함수가 정한다 (`deriveTasteFillQueries`)
- 레인 그룹: `drama-KR`(kdrama), `drama-JP`(jdrama), `anime`, `movie`.
- 사용자가 유형 필터(`discoveryFilters.mediaTypes`)를 골랐으면 그 유형의 그룹만(`drama` → drama-KR·drama-JP). 아니면 프로필 `content_type_scores` 상위 2개 그룹(양수만). 점수가 하나도 없으면(초기 사용자) `["drama-KR", "anime"]`.
- 국가 필터(`discoveryFilters.countries`)가 있으면: drama 그룹은 국가별로 나누지 않고 **하나의 drama 레인**에 그 국가들을 넣는다. anime는 국가 필터가 비었거나 `JP`를 포함할 때만. movie는 그 국가들을 `with_origin_country`로.
- 장르: 장르 필터가 있으면 그 장르(정규화 키). 없으면 `genre_scores` 상위 2개를 `normalizeDiscoveryGenre`로 정규화한 뒤 `drama`·`animation`·`all`과 사용자 제외 장르를 뺀 것. 없으면 장르 조건 없음.
- 질의는 최대 3개. 각 질의는 안정적인 `key`(예: `drama:KR:comedy|romance`)를 가진다(커서에 쓰인다).

### D-3. 취향 레인 조회는 국내 OTT·제외 조건을 그대로 건다
TMDB discover(`tv`/`movie`) + `applyKrOttDiscoverFilter` + `setCommonTmdbParams` + 사용자 제외 장르(`without_genres`)·제외 키워드(`without_keywords`) + `vote_count.gte=50` + `sort_by=popularity.desc`. 공개일 범위 없음. 장르는 OR(`|`). anime 레인은 `with_genres=16`과 첫 취향 장르를 AND(`,`), `with_origin_country=JP`. drama 레인은 `without_genres`에 16 포함. URL은 순수 함수 `buildTasteFillDiscoverUrl`이 만든다(테스트 가능).

### D-4. 같은 검사·같은 순위
취향 후보도 `candidateFilter`(한국어 제목·발견 필터·사용자 제외)를 통과해야 하고, 테마 제외가 있으면 남은 키워드 예산으로 `enrichTmdbRecommendationCandidates`를 거친다(근거 없는 TMDB는 제외 — R-2 규칙 유지). 라이브러리·`excludeIds`·최근 본 추천·이번 응답의 최신 레인 항목과 겹치면 뺀다(`createRecommendationIdentityAliases`). 순위는 `rankCandidates(profile, …)`로 같은 프로필을 쓴다.

### D-5. 시간 예산
취향 레인은 `최신 레인 결과 < limit`이고 남은 시간(`requestDeadline - now`)이 2,500ms 이상일 때만. 요청당 질의별 1페이지(최대 3회 TMDB 호출). 캐시는 기존 공용 캐시(`createPersistentRecommendationCache`, 24시간)를 쓰고 키 버전 `taste-fill-v1`.

### D-6. 커서는 하나로 감싼다 (하위 호환)
응답 `next_cursor` = `tf1.` + base64url(JSON `{ catalog, catalogDone, taste }`). `taste`는 `{ [queryKey]: { page, done } }`. 요청 커서가 `tf1.`로 시작하지 않으면 예전 카탈로그 커서로 보고 `{ catalog: raw, catalogDone: false, taste: {} }`. 디코드 실패면 처음부터(`{ null, false, {} }`). `catalogDone`이면 최신 레인을 건너뛴다(처음부터 다시 돌지 않게). 앱은 커서를 그대로 주고받으므로 앱 변경이 없다.

### D-7. 응답 필드
기존 필드 그대로 + `taste_fill_count: number`(이번 응답에서 취향 레인이 채운 수, QA용). `has_more = !catalogDone || 남은 취향 질의 존재`, `is_exhausted = catalogDone && 모든 취향 질의 done`. 취향 레인 항목은 `trend_source: "취향 장르 인기작"`.

### D-8. 앱 화면은 바꾸지 않는다
앱 필터(`filterVisibleRecommendationCandidates`)·자동 이어찾기 한도·빈 상태 문구는 그대로. 서버가 채워 주면 빈 상태가 사라진다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 자동 이어찾기 횟수(6·연속 3) 늘리기 | 배포본처럼 커서가 같은 달에 묶이면 횟수를 늘려도 0개. 요청·시간만 늘어난다 |
| 테마 제외 시 키워드 근거 없는 TMDB도 허용 | 사용자가 명시한 하드 제외를 근거 없이 통과시킨다(`docs/27`) |
| 라이브러리 작품 기반 TMDB `/recommendations` 엔드포인트 | 국내 OTT 조건(`docs/33` D-1·D-2)을 걸 수 없어 작품마다 사후 조회가 필요하다(요청 폭증) |
| 취향 레인을 카탈로그 제공처로 편입 | 월 커서·월 완료 판정 구조를 고쳐야 해 회귀 위험이 크다(D-1) |
| 취향 레인을 항상 섞기(최신 레인이 12개를 채워도) | "최신 추천" 성격이 바뀐다. 이번에는 빈자리 보충만. 혼합 비율은 사용 후 재결정 |

## 6. 계약

### 6.1 `supabase/functions/_shared/recommendationTasteFill.ts` (신규, 순수 — 네트워크·Deno API 없음)

```ts
import type { RecommendationPreferenceProfile, RecommendationMediaType } from "./recommendationEngine.ts";
import type { DiscoveryFilterInput } from "./discoveryFilters.ts";
import type { UserRecommendationFilters } from "./recommendationUserFilters.ts";

export type TasteFillGroup = "drama-KR" | "drama-JP" | "drama" | "anime" | "movie";
export interface TasteFillQuery { key: string; group: TasteFillGroup; kind: "tv" | "movie"; countries: string[]; genres: string[] }
export const TASTE_FILL_MAX_QUERIES = 3;
export const TASTE_FILL_MIN_REMAINING_MS = 2_500;
export const TASTE_FILL_CURSOR_PREFIX = "tf1.";
export const TASTE_FILL_TREND_SOURCE = "취향 장르 인기작";

export function deriveTasteFillQueries(input: {
  profile: Pick<RecommendationPreferenceProfile, "content_type_scores" | "genre_scores">;
  discoveryFilters?: DiscoveryFilterInput;
  mediaType: RecommendationMediaType;
  userFilters: UserRecommendationFilters;
}): TasteFillQuery[];
// 1) groups: discovery.mediaTypes 있음 → drama는 (countries 있으면 ["drama"], 없으면 ["drama-KR","drama-JP"]), anime는 ["anime"](countries 비었거나 JP 포함), movie는 ["movie"]
//    없음 → content_type_scores 양수 상위 2개(kdrama→drama-KR, jdrama→drama-JP, anime→anime, movie→movie, 그 외 무시, 동점은 이 순서) / 없으면 ["drama-KR","anime"]
//    mediaType 인자가 "all"이 아니면 그 유형 그룹으로 한정(anime/movie/drama)
// 2) genres: discovery.genres 있음 → 그 값(정규화) / 없음 → genre_scores 양수 내림차순 키를 normalizeDiscoveryGenre → "drama"·"animation"·"all"·userFilters.excludedGenres(정규화) 제외 → 앞 2개(중복 제거)
// 3) countries: drama-KR ["KR"], drama-JP ["JP"], drama = discovery.countries, anime ["JP"], movie = discovery.countries(없으면 [])
// 4) kind: movie → "movie", 그 외 "tv"
// 5) key = `${group}:${countries.join(",")}:${genres.join("|")}`
// 6) 최대 TASTE_FILL_MAX_QUERIES개, 그룹 결정 순서 유지

export interface TasteFillCursorState { catalog: string | null; catalogDone: boolean; taste: Record<string, { page: number; done: boolean }> }
export function decodeTasteFillCursor(raw: string | null | undefined): TasteFillCursorState;
// null/빈값 → { catalog: null, catalogDone: false, taste: {} }
// TASTE_FILL_CURSOR_PREFIX 없음 → { catalog: raw, catalogDone: false, taste: {} } (예전 카탈로그 커서)
// prefix 있음 → base64url JSON 파싱·검증(catalog string|null, catalogDone boolean, taste 값 page 1~500 정수·done boolean), 실패 → 처음 상태
export function encodeTasteFillCursor(state: TasteFillCursorState): string | null;
// catalogDone && taste가 모두 done(또는 빈 객체이면서 catalogDone) → null
// 그 외 prefix + base64url(JSON) — 키 순서 고정(catalog, catalogDone, taste는 키 정렬)

export function shouldRunTasteFill(input: { itemCount: number; limit: number; remainingMs: number }): boolean;
// itemCount < limit && remainingMs >= TASTE_FILL_MIN_REMAINING_MS

export function selectTasteFillItems<T>(input: { ranked: readonly T[]; existing: readonly T[]; blockedIdentities: ReadonlySet<string>; need: number; identities: (item: T) => readonly string[] }): T[];
// ranked 순서대로, identities가 blocked 또는 existing(및 이미 고른 항목)의 identity와 하나라도 겹치면 건너뜀, need개까지
```

### 6.2 `supabase/functions/_shared/recommendationProviders.ts` (추가)

```ts
export function buildTasteFillDiscoverUrl(query: TasteFillQuery, page: number, filters?: UserRecommendationFilters): URL;
// https://api.themoviedb.org/3/discover/{kind}; setCommonTmdbParams(url, page); applyKrOttDiscoverFilter(url);
// sort_by=popularity.desc; vote_count.gte=50; setTmdbKeywordExclusions(url, filters)
// tv drama 그룹: with_genres = (genres의 tmdbIncludedGenreId(g,"tv") 숫자들, 없으면 [18]).join("|"), with_origin_country = countries.join("|")(비면 생략), without_genres = [16, 10764, 10767, ...tmdbExcludedGenreIds(filters)] 중복 제거 "," (10764 Reality·10767 Talk: 예능 제외, 2026-10-03 추가)
// tv anime: with_genres = ["16", 첫 genre의 tv id(있으면)].join(","), with_origin_country=JP, without_genres = tmdbExcludedGenreIds(filters)(있을 때)
// movie: with_genres = genres의 movie id들 "|"(없으면 생략), with_origin_country(있으면), without_genres = tmdbExcludedGenreIds(filters)(있을 때)
export async function fetchTasteFillPage(
  query: TasteFillQuery, page: number,
  options: RecommendationProviderOptions & { asOfDate: string }
): Promise<{ items: CatalogRecommendationCandidate[]; hasMore: boolean }>;
// 캐시 키 `taste-fill-v1:${query.key}:${page}:${recommendationProviderFilterKey(options.filters)}` (source "tmdb", 24시간)
// tv: drama 그룹은 기존 normalizeTmdbDrama(allowInternational = group === "drama", selectedGenre = genres.length > 0), anime는 inferTmdbTvContentType이 "anime"인 것만 같은 필드 구성으로 정규화
// movie: 기존 normalizeTmdbMovie
// 정규화에 쓰는 request = { provider: kind==="movie" ? "tmdb_movie" : "tmdb_kr", month: asOfDate의 KST 월, page, asOfDate }
// 모든 항목 trend_source = TASTE_FILL_TREND_SOURCE. hasMore = page < min(500, total_pages)
```

### 6.3 `supabase/functions/personalized-recommendations/index.ts` (통합)

1. 요청 커서를 `decodeTasteFillCursor(validated.value.cursor)`로 해석. `catalogDone`이 아니면 기존 `scanRecommendationCatalog`를 `cursor: state.catalog`로 호출(나머지 옵션 그대로). `catalogDone`이면 스캔하지 않고 최신 레인 결과 = 빈 결과(`hasMore: false`, `nextCursor: null`, `exhausted: true`)로 본다.
2. `result.allProvidersFailed`이고 취향 레인도 실행 불가면 기존처럼 503.
3. `shouldRunTasteFill({ itemCount: result.items.length, limit, remainingMs: requestDeadline - Date.now() })`이면:
   - `profile = buildPreferenceProfile(libraryItems, feedback)`, `queries = deriveTasteFillQueries({ profile, discoveryFilters, mediaType, userFilters: filters })`.
   - 각 질의 중 `state.taste[key]?.done`이 아닌 것만, `page = state.taste[key]?.page ?? 1`로 `fetchTasteFillPage`를 병렬 호출(개별 실패는 그 질의만 건너뜀, `failedSources`에 반영하지 않음).
   - 후보 = 모든 페이지 항목 → `matchesDiscoveryFilters` → 테마 제외가 있으면 기존 `providerFetcher`와 같은 방식으로 장르 제외·한국어 제목 거른 뒤 `enrichTmdbRecommendationCandidates`(같은 `keywordLookupBudget`, `needsKeywordLookup`) → `candidateFilter`(기존 식) → `rankCandidates(profile, candidates, { mediaType, libraryItems })`.
   - `blockedIdentities` = `keywordLookupExclusions`(라이브러리·excludeIds·최근 본 추천·제외 피드백 정규화 키). `existing` = `result.items`. `selectTasteFillItems`로 `limit - result.items.length`개.
   - 각 질의 상태: 이번에 호출했으면 `page + 1`, `done = !hasMore`.
4. 최종 `items = [...result.items, ...fill]`(최신 레인 먼저). 이후 `attachKrOttProviders` 등 기존 후처리 그대로.
5. 응답: `next_cursor = encodeTasteFillCursor({ catalog: catalogDone ? null : result.nextCursor, catalogDone: catalogDone || !result.nextCursor || !result.hasMore, taste })`, `has_more = next_cursor !== null`, `is_exhausted = next_cursor === null`, `taste_fill_count = fill.length`. 나머지 필드는 기존 값.

## 7. 엣지 케이스

| # | 상황 | 기대 | 테스트 |
|---|------|------|--------|
| E-1 | 최근작 대부분 등록한 사용자 | 첫 요청부터 취향 레인이 빈자리를 채움 | 수동 M-1 |
| E-2 | 초기 사용자(라이브러리 0) | 그룹 `drama-KR`·`anime`, 장르 없음 | Q-3 |
| E-3 | 유형 필터 "영화" | movie 레인만 | Q-4 |
| E-4 | 국가 필터 JP + 장르 필터 로맨스 | drama 레인(JP, romance) + anime(JP, romance) | Q-5 |
| E-5 | 국가 필터 KR만 | anime 레인 없음 | Q-6 |
| E-6 | 사용자 제외 장르(예: 공포) | 취향 장르에서 빠지고 URL `without_genres`에 포함 | Q-7, U-2 |
| E-7 | BL·GL·퀴어 제외 | URL `without_keywords`, 키워드 근거 없는 TMDB 제외 | U-1, 수동 M-2 |
| E-8 | 예전 카탈로그 커서 | 그대로 이어서 동작 | C-2 |
| E-9 | 깨진 `tf1.` 커서 | 처음부터 | C-3 |
| E-10 | 최신 레인 끝 + 취향 남음 | `has_more: true`, 최신 레인 다시 안 돎 | C-1, C-4 |
| E-11 | 둘 다 끝 | `next_cursor: null`, `is_exhausted: true` | C-4 |
| E-12 | 남은 시간 2.5초 미만 | 취향 레인 생략 | S-1 |
| E-13 | 취향 후보가 라이브러리·최신 레인 항목과 겹침 | 제외 | P-1 |
| E-14 | 최신 레인이 12개를 채움 | 취향 레인 실행 안 함 | S-1 |

## 8. 테스트 표

**모든 행을 테스트로 옮긴다.** 파일: `supabase/functions/_shared/recommendationTasteFill.test.ts`(신규), `supabase/functions/_shared/recommendationProviders.test.ts`(추가). 프로필은 `content_type_scores`·`genre_scores`만 가진 `Map`으로 만든다.

| ID | 입력 | 기대 |
|----|------|------|
| Q-1 | scores kdrama 10·anime 6·movie 1, genre 드라마 10·로맨스 8·코미디 5·액션 2, 필터 없음 | `[{ key: "drama-KR:KR:romance|comedy", group: "drama-KR", kind: "tv", countries: ["KR"], genres: ["romance","comedy"] }, { key: "anime:JP:romance|comedy", group: "anime", kind: "tv", countries: ["JP"], genres: ["romance","comedy"] }]` |
| Q-2 | scores jdrama 3·kdrama 3(동점), 장르 없음 | 그룹 순서 `["drama-KR","drama-JP"]`, genres `[]` |
| Q-3 | 빈 Map 두 개 | 그룹 `["drama-KR","anime"]`, genres `[]` |
| Q-4 | Q-1 프로필 + `mediaTypes: ["movie"]` | `[{ key: "movie::romance|comedy", group: "movie", kind: "movie", countries: [], genres: ["romance","comedy"] }]` |
| Q-5 | Q-1 프로필 + `mediaTypes: ["drama","anime"]`, `countries: ["JP"]`, `genres: ["로맨스"]` | `[{ group: "drama", countries: ["JP"], genres: ["romance"] }, { group: "anime", countries: ["JP"], genres: ["romance"] }]`(key 포함) |
| Q-6 | Q-1 프로필 + `mediaTypes: ["drama","anime"]`, `countries: ["KR"]` | drama 레인 하나(`countries: ["KR"]`), anime 없음 |
| Q-7 | Q-1 프로필 + `userFilters.excludedGenres: ["로맨스"]` | genres `["comedy","action"]` |
| Q-8 | Q-1 프로필 + `mediaTypes: ["drama","anime"]`, 국가 없음 | 그룹 `["drama-KR","drama-JP","anime"]`(길이 3 = 상한). 유형 3종을 모두 고르면 `normalizeDiscoveryFilters`가 "전체"로 바꾸므로 프로필 기준(Q-1과 같음) |
| C-1 | `encodeTasteFillCursor({ catalog: "abc", catalogDone: false, taste: { k: { page: 2, done: false } } })` → decode | 같은 상태로 왕복, 문자열은 `tf1.`로 시작 |
| C-2 | `decodeTasteFillCursor("legacy-cursor")` | `{ catalog: "legacy-cursor", catalogDone: false, taste: {} }` |
| C-3 | `decodeTasteFillCursor("tf1.!!!")`, `("tf1." + base64url('{"catalog":1}'))`, `(null)` | 셋 다 `{ catalog: null, catalogDone: false, taste: {} }` |
| C-4 | `encodeTasteFillCursor({ catalog: null, catalogDone: true, taste: { a: { page: 3, done: true } } })`, `({ null, true, {} })`, `({ null, true, { a: { page: 2, done: false } } })` | `null`, `null`, `tf1.` 문자열 |
| S-1 | `shouldRunTasteFill({ itemCount: 4, limit: 12, remainingMs: 3000 })`, `({ 12, 12, 9000 })`, `({ 0, 12, 2499 })` | `true`, `false`, `false` |
| P-1 | ranked `[a,b,c,d]`, existing `[b]`, blocked `{"tmdb:3"}`(c의 identity), need 2, identities = `x => [x.id]` | `[a, d]` |
| K-1 | 상수 | `TASTE_FILL_MAX_QUERIES === 3`, `TASTE_FILL_MIN_REMAINING_MS === 2500`, `TASTE_FILL_CURSOR_PREFIX === "tf1."`, `TASTE_FILL_TREND_SOURCE === "취향 장르 인기작"` |
| U-1 | `buildTasteFillDiscoverUrl({ group: "drama-KR", kind: "tv", countries: ["KR"], genres: ["romance","comedy"], key }, 2, { excludedThemeKeys: ["boys-love"], excludedGenres: [] })` | 경로 `/3/discover/tv`, `page=2`, `watch_region=KR`, `with_watch_providers` 있음, `sort_by=popularity.desc`, `vote_count.gte=50`, `with_origin_country=KR`, `without_genres`에 16·10764·10767(2026-10-03 추가: 예능 제외), `without_keywords`에 289844, `with_genres`가 comedy·romance의 tv id를 `|`로 |
| U-2 | movie 질의 `{ countries: [], genres: ["comedy"] }` + `excludedGenres: ["horror"]` | 경로 `/3/discover/movie`, `with_genres=35`, `with_origin_country` 없음, `without_genres`에 27 |
| U-3 | anime 질의 `{ countries: ["JP"], genres: ["comedy"] }` | `with_genres === "16," + tmdbIncludedGenreId("comedy","tv")`, `with_origin_country=JP` (2026-10-03 정정: TMDB TV에는 로맨스 장르 id가 없어 처음 예시 `romance`는 AND 결합이 생기지 않는다) |
| U-4 | `fetchTasteFillPage`(fetch 스텁: tv 결과 3개 — kdrama 1, 애니(16·JP) 1, 영어권 드라마 1) drama-KR 질의 | kdrama 1개만, `trend_source === "취향 장르 인기작"`, `hasMore` = `page < total_pages` |

> U-1의 tv 장르 id는 `tmdbIncludedGenreId`가 돌려주는 값으로 기대값을 만든다(하드코딩 대신 같은 함수로 계산해 순서·구분자만 검증).

### 수동 확인 (재배포 후, 로그인 — 사람)

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 | 검색 탭 추천: 빈 상태 대신 12개 내외, 일부 카드가 "취향 장르 인기작" 근거. 네트워크 응답 `taste_fill_count` > 0 |
| M-2 | 웹 | BL·GL·퀴어 제외 유지 상태에서 해당 테마 작품이 나오지 않음 |
| M-3 | 웹 | "장르·국가 필터"로 일본·로맨스 선택 → 결과가 모두 일본·로맨스 |
| M-4 | 웹 | 계속 스크롤 → 중복 없이 이어짐, 끝에서 "모두 봤어요" 류 종료 |
| M-5 | 앱(iOS 세로) | M-1·M-4 동일 |

## 9. 변경 파일

| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/recommendationTasteFill.ts` (+`.test.ts`) | 신규. 6.1 |
| `supabase/functions/_shared/recommendationProviders.ts` | `buildTasteFillDiscoverUrl`, `fetchTasteFillPage` 추가(기존 함수 동작 변경 없음) |
| `supabase/functions/_shared/recommendationProviders.test.ts` | U-1~U-4 추가 |
| `supabase/functions/personalized-recommendations/index.ts` | 6.3 통합 |

## 10. 범위 밖

| 항목 | 이유 |
|------|------|
| 앱 화면·훅·자동 이어찾기 한도·빈 상태 문구 | D-8 |
| 최신 레인(카탈로그 스캔) 로직·정렬 | D-1 |
| AniList 취향 레인 | 한국어 현지화 매칭(`docs/33` D-3) 경로를 다시 짜야 한다. 애니는 TMDB(장르 16·JP·국내 OTT)로 충분히 덮는다 |
| `popular-recommendations` | 다른 화면 |
| 보러가기 링크 작업(`watchProviders.ts` 등 미커밋) | 다른 작업. 수정 금지 |
| 기존 실패 테스트 `recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library" | 별도 |

## 11. 사람 후속

1. **지금 바로**: `personalized-recommendations` 재배포(현재 코드). 2장 실측상 빈 화면 대부분이 해소된다.
2. 이 명세 구현 후 다시 `personalized-recommendations` 재배포 → `npm run edge:drift` → 수동 M-1~M-5.

## 12. 확실하지 않음

1. 2장 실측은 사용자 실제 라이브러리(560개) 대신 "최근 추천 작품을 등록한 사용자"로 모사했다. 실제 계정에서 재배포만으로 해소되는지는 M-1로 확인한다.
2. TMDB discover `vote_count.gte=50` + 국내 OTT 조건에서 취향 장르 조합이 너무 좁으면 페이지가 금방 끝날 수 있다. M-1에서 `taste_fill_count`가 낮으면 기준값(50)을 보고한다.


## 2026-10-04 후속 정정: 추천 연도 필터

사용자가 2025년을 선택했는데 1992·1981·2026년 추천이 표시되는 캡처를 제공했다. `app/search.tsx`는 연도를 요약 배너와 제목 검색에만 전달했고, 추천용 `DiscoveryFilterInput`에는 연도가 없었다. 월별 레인은 현재 월부터 탐색하며, 취향 보충은 기간 제한이 없어 화면의 조건과 추천이 어긋났다.

### D-9. 선택한 연도는 검색과 추천에 함께 적용한다

이번 사용자 요청으로 D-1의 월별 탐색 범위와 D-3의 기간 무제한 계약을 **연도 선택 시에만** 정정한다. 연도가 없으면 기존 동작을 유지한다. `DiscoveryFilterInput.year?: number | null`은 1900~2100 정수만 정규화하며, 선택 연도와 `air_year`가 같은 작품만 표시한다. 연도 미상도 제외한다. 유형·장르·국가·사용자 제외 조건은 그대로 교집합을 적용한다.

추천 요청·Query key·요청 수명·카드 유지 슬롯·FlashList key·화면 표시/보충 개수에 연도를 포함한다. 제목 검색에서는 기존 연도 숨김 사유와 “모두 보기”를 보존한다. 목록 상태와 정렬은 계속 제목 검색 전용이다. 필터 시트 문구도 이 구분을 표시한다.

선택 연도가 올해면 현재 월, 다른 해면 해당 해 12월에서 시작해 1월까지만 월별 탐색한다. 실제 `asOfDate`는 바꾸지 않는다. 취향 보충 TV는 `first_air_date`, 영화는 `primary_release_date`의 1월 1일~12월 31일 조건을 건다. 취향 제공처 캐시는 `taste-fill-v2`와 발견 필터 signature로 연도를 분리한다. 서버 응답과 앱은 모두 연도를 재검사해 오래된 배포본의 다른 연도 작품도 화면에 표시하지 않는다.

| ID | 검증 입력 | 기대 |
|---|---|---|
| Y-1 | 2025·2026·전체·유효하지 않은 연도 | 정규화, 연도별 캐시 key 분리, 무필터 기존 key 유지 |
| Y-2 | 1992·1981·2026·미상 및 2025 작품 + 국가 조건 | 2025 + 다른 조건 일치 작품만 허용 |
| Y-3 | TV·영화 취향 질의, 2025 선택/해제 | 각 공개일 범위 적용, 해제하면 범위 없음 |
| Y-4 | 현재 2026년에 2025 월별 탐색·커서 재사용 | 2025-12~01만 탐색, 실제 기준일 유지, 다른 연도 커서 거부 |
| Y-5 | 구 배포본처럼 여러 연도 섞인 후보 | 화면 후보와 보충 개수에서 2025만 남음 |
| Y-6 | 취향 제공처 2025→2026→전체 | 실제 제공처 요청 범위와 영속 캐시 key 분리 |
| YM-1 | 로그인한 웹에서 연도 선택·변경·해제·스크롤 보충·추가 | 연도에 맞는 카드만 노출, 구 응답이 새 조건에 섞이지 않음 |
| YM-2 | iOS/Android에서 같은 동작 | 웹과 같은 조건, 필터 안내 문구 일치 |

Y-1~Y-6은 순수 함수/모의 제공처 자동 테스트다. YM-1·YM-2는 인증된 실제 환경에서 별도 확인해야 하며 자동 검사로 대체하지 않는다. 배포·DB·기존 사용자 등록 데이터 정리는 이 수정에 포함하지 않는다.
