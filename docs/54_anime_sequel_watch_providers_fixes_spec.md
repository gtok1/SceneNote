# 54. 애니 후속 시즌 보러가기 매칭·라프텔 찾아보기 정정

작성일: 2026-10-11
대상 브랜치 기준: `main` (`c6a0e7e`) + 미커밋 작업(`docs/44`~`53`). 이 시점 `npm test` 1074개 중 1073개 통과. 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 이번 작업과 무관한 기존 결함이다.
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙)**, `docs/33_kr_ott_availability_spec.md`(국내 OTT 정의 D-1, AniList → TMDB 매칭 D-9, 보러가기 8.2)

> **2026-10-20 후속 요청:** 사용자가 “시즌3 기준으로 표시해야해 이건 시즌3 작품이야”라고 명시했다. 아래 **15장**이 D-2·D-5·D-6·D-7·D-9의 시즌 조회/응답 및 12장의 관련 범위를 대체한다. 과거의 시리즈 전체 대체 제공처를 다시 구현하지 않는다. 라프텔은 검색 연결만 제공하는 D-1·D-8은 유지한다.

> **근거.** 사용자 캡처: 작품 상세 "전생했더니 슬라임이었던 건에 대하여"(원제 `転生したらスライムだった件 第4期 第1&2クール`, 애니, 2026.04, 24화)의 보러가기 카드에 "국내 OTT에서 볼 수 있는 곳 정보가 아직 없어요." 문구가 나온다. 같은 작품이 라프텔(laftel.net) 92~96화에 있다.
> 사용자 요청: "OTT에서 라프텔을 보면 시청 가능한데 TMDB에서 이런 내용 제공 안해줘? 제공해준다면 다시 OTT시청 가능한 여부를 다시 체크해줘"

---

## 1. 문제 정의

| ID | 증상 |
|----|------|
| F-1 | AniList에서 온 애니 **후속 시즌**(원제에 `第4期`, `第2期` 같은 표시가 있는 작품)의 보러가기가 항상 비어 있다. TMDB에는 국내 제공처가 있는데도 그렇다. 전슬 4기의 TMDB 시즌 4 국내 정액제는 왓챠·티빙이다. |
| F-2 | 라프텔에서 볼 수 있는 애니도 보러가기에 라프텔이 나오지 않고, 라프텔로 가는 길도 없다. |

## 2. 근본 원인

### 2.1 F-1 — 후속 시즌이 TMDB 시리즈와 매칭되지 않는다
`get-watch-providers/index.ts` 57~74행은 AniList 작품을 받으면 `[원제, 표시 제목]`으로 TMDB `search/tv`를 검색한다. 그 결과를 `matchTmdbAnimeForAniList`(`_shared/watchProviders.ts` 149~165행)에 넘기고, 결과가 `null`이면 빈 응답(71~72행)을 준다.

TMDB는 후속 시즌을 별도 작품으로 두지 않는다. 첫 시즌 연도의 시리즈 하나에 시즌으로 넣는다. 2026-10-11 읽기 전용 조회 결과는 다음과 같다.

| 조회 | 결과 |
|------|------|
| `search/tv` "転生したらスライムだった件 第4期 第1&2クール" | 0건 (시즌 표시가 붙은 원제는 검색되지 않는다) |
| `search/tv` "전생했더니 슬라임이었던 건에 대하여" | `82684` 전생했더니 슬라임이었던 건에 대하여 (첫 방영 2018-10-02), `118541` 전생슬라임 일기 (2021) |
| `matchTmdbAnimeForAniList` (연도 2026) | `null`. 158행이 `Math.abs(2018-2026) > 1`이라 82684를 버린다 |
| 같은 함수로 약사의 혼잣말 2기(`薬屋のひとりごと 第2期`, 2025)와 장송의 프리렌 2기(`葬送のフリーレン 第2期`, 2026)를 시험 | 둘 다 `null` (일반 결함) |

docs/33 D-9의 "방영 연도 ±1"은 첫 시즌용 규칙이다. 후속 시즌에서는 시리즈 첫 방영 연도와 맞을 수 없다.

### 2.2 시리즈 전체 제공처를 그대로 쓰면 틀린다
TMDB `82684`의 국내 제공처(2026-10-11)는 아래와 같다. 시리즈 전체와 시즌별 값이 다르다.

| 범위 | 국내 정액제 (`flatrate`) | 광고형 (`ads`) |
|------|--------------------------|----------------|
| 시리즈 전체 `/tv/82684/watch/providers` | 넷플릭스, 왓챠, 넷플릭스(광고형), 크런치롤, 티빙 | 크런치롤 |
| 시즌 1 (2018-10-02) | 넷플릭스, 왓챠, 넷플릭스(광고형), 티빙 | - |
| 시즌 2 (2021-01-12) | 왓챠, 크런치롤, 티빙 | 크런치롤 |
| 시즌 3 (2024-04-05) | 왓챠, 티빙 | - |
| 시즌 4 (2026-04-03, 24화) | 왓챠, 티빙 | - |

연도 조건만 풀면 4기 화면에 1기만 있는 넷플릭스가 나온다. 반면 TMDB가 후속작을 시즌 1에 합쳐 둔 시리즈도 있다.

- 약사의 혼잣말 `220542`: 시즌 1 하나(2023, 60화). 시리즈 제공처는 넷플릭스·크런치롤이다.
- 장송의 프리렌 `209867`: 시즌 1 하나(2023, 38화).

이런 경우는 시즌을 고를 수 없다.

### 2.3 F-2 — TMDB는 라프텔을 제공하지 않는다
- TMDB 국내 제공처 목록 `watch/providers/tv?watch_region=KR`은 26개, `movie`는 39개다. 둘 다 라프텔이 0개다. 전 지역 목록에도 없다(2026-10-11).
- TMDB 제공처 데이터는 JustWatch 출처다(화면 표기 "시청 정보 제공: JustWatch"). 그래서 `KR_OTT_PROVIDERS`(`watchProviders.ts` 21~34행)에 라프텔을 넣어도 응답에 라프텔이 올 수 없다.
- `createProviderLink`의 라프텔 분기(120행)는 TMDB가 라프텔을 줄 때만 쓰인다. 지금은 쓰이지 않는다.
- `https://laftel.net/search?keyword=<작품명>`은 2026-10-11 실제 검색 결과 화면으로 열렸다. "전생했더니 슬라임"으로 열면 1기~4기, 극장판이 나온다.

## 3. 재현 시나리오
1. 웹 8081에 로그인해 검색 탭에서 "전생했더니 슬라임"을 검색한다.
2. 2026년 4월 애니(원제 `転生したらスライムだった件 第4期 第1&2クール`, AniList 182205)의 상세를 연다.
3. 보러가기 카드에 "국내 OTT에서 볼 수 있는 곳 정보가 아직 없어요."가 나온다. 왓챠·티빙이 나와야 한다(F-1).
4. 같은 카드에 라프텔로 가는 방법이 없다(F-2).

## 4. 설계 결정

### D-1 (최우선). 라프텔은 "볼 수 있다"고 표시하지 않고 "찾아보기" 검색 링크로만 연결한다
- TMDB·JustWatch에 라프텔 데이터가 없으므로(2.3) 라프텔을 제공처 목록에 넣지 않는다. `KR_OTT_PROVIDERS` 화이트리스트도 바꾸지 않는다.
- 라프텔 비공식 API 호출이나 페이지 수집도 하지 않는다. 공개 API 문서가 없고, 약관·안정성은 "확실하지 않음"이다(CLAUDE.md 설계 원칙 4).
- 화면은 애니에 한해 "라프텔에서 찾아보기" 검색 줄만 둔다(D-8). 제공 여부는 사용자가 라프텔에서 확인한다.

### D-2. 기존 직접 매칭이 먼저다
- `matchTmdbAnimeForAniList`(docs/33 D-9)는 고치지 않고 그대로 먼저 시도한다.
- 성공하면 지금과 똑같이 시리즈 제공처 하나만 조회한다. 추가 TMDB 호출은 없다. 응답 `provider_scope`는 `"content"`다.

### D-3. 후속 시즌 보완 매칭은 "시즌 표시"가 있는 제목에서만 한다
- 직접 매칭이 실패했고, 받은 제목 중 하나 이상에서 시즌 표시를 떼어 냈을 때만 보완 매칭을 한다. 시즌 표시 목록은 6.1 `stripAnimeSeasonMarkers`에 있다.
- 시즌 표시가 없으면 지금처럼 빈 결과를 준다(docs/33 D-9: 빈 결과가 틀린 제공처보다 낫다).
- 같은 제목의 리메이크(예: `うる星やつら` 1981/2022)가 엉뚱한 시리즈에 붙는 것을 막는 조건이다.

### D-4. 보완 매칭 후보 조건과 순서
후보 조건:
1. 장르 16(애니)이 포함되어 있다.
2. TMDB 제목이 받은 제목이나 시즌 표시를 뗀 제목과 같다. 비교는 `normalizeTitleForMatch` 기준이다.
3. 시리즈 첫 방영 연도가 작품 연도 + 1 이하다. 작품 연도를 모르면 연도 조건을 보지 않는다.

순서: 원제(`original_name`) 일치 > 표시 제목(`name`) 일치 → 작품 연도와 첫 방영 연도의 차이가 작은 순(같은 제목의 옛 시리즈보다 최근 시리즈가 먼저다) → `popularity` 큰 순 → `id` 작은 순.

### D-5. 시즌은 방영 연도로 "하나로 정해질 때만" 고른다
- 시즌 0(스페셜)과 `air_date`가 없는 시즌은 제외한다.
- 작품 연도와 같은 해의 시즌이 정확히 1개면 그 시즌을 고른다.
- 같은 해 시즌이 없으면 ±1년 시즌이 정확히 1개일 때만 그 시즌을 고른다.
- 후보가 2개 이상이거나 0개면 시즌을 정하지 않는다(`null`).
- 클라이언트는 작품 연도만 보낸다. 같은 해 시즌이 둘이면 어느 쪽인지 확신할 수 없다.

### D-6. 시즌 제공처를 우선하고, 없으면 시리즈 전체 + 안내를 쓴다
- 시즌이 정해졌고 그 시즌의 국내 제공처(`flatrate`·`free`·`ads`·`rent`·`buy` 중 하나 이상)가 있으면 시즌 제공처를 쓴다. `provider_scope`는 `"season"`이다.
- 그 밖에는 시리즈 전체 제공처를 쓴다. `provider_scope`는 `"series"`다.
- `"series"`이고 제공처가 1개 이상이면 화면에 시리즈 전체 기준이라는 안내 한 줄을 붙인다(8장).

### D-7. 응답 계약은 선택 필드만 추가한다
- `provider_scope: "content" | "season" | "series" | null`, `tmdb_season_number: number | null`을 추가한다.
- 빈 응답은 둘 다 `null`이다.
- 클라이언트는 두 필드가 없거나 `null`이면 안내를 표시하지 않는다. 배포 순서와 관계없이 기존 화면이 유지된다.
- `"season"`에는 안내를 붙이지 않는다. TMDB 시즌 번호가 AniList "N기"와 다를 수 있어 "시즌 N 기준"이라고 쓰면 오해를 부른다.

### D-8. 애니 보러가기 카드에 "라프텔에서 찾아보기" 줄을 둔다
- 대상: `view.contentType === "anime"`이고 보러가기 제목(`watchProviderTitle`)이 비어 있지 않을 때.
- 드라마·영화에는 두지 않는다.
- URL: `https://laftel.net/search?keyword=${encodeURIComponent(title.trim())}`(2.3에서 확인).
- 제공처 행(`styles.item`, 로고 + 이름 + 서비스 유형)과 **다른 모양**으로 그린다. 제공처 목록으로 읽히지 않게 하기 위해서다. 아이콘 `search`, 문구 "라프텔에서 찾아보기", 보조 문구 "제공 여부는 라프텔에서 확인해 주세요."다.
- 로딩·오류·빈 결과와 관계없이 표시한다. TMDB 결과에 의존하지 않기 때문이다.

### D-9. TMDB 호출 수 상한
- 직접 매칭 성공 경로는 지금과 같다: 검색 최대 2회 + 제공처 1회.
- 보완 경로에서는 다음이 더해진다.
  - 시즌 표시를 뗀 제목 검색: 이미 검색한 제목과 정규화 결과가 같으면 다시 검색하지 않는다.
  - `/tv/{id}` 1회.
  - 제공처 최대 2회(시즌 1회, 시즌이 없거나 비면 시리즈 1회).
- 캐시는 추가하지 않는다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| `KR_OTT_PROVIDERS`에 라프텔 추가 | TMDB 국내·전 지역 제공처 목록에 라프텔이 없다(2.3). 효과가 없다 |
| 라프텔 비공식 API·페이지 수집으로 실제 제공 여부 확인 | 공개 계약이 없고 약관·안정성이 확실하지 않다. 외부 호출 원칙(Edge 경유, 공식 API)에도 맞지 않는다 |
| `matchTmdbAnimeForAniList`의 연도 허용치를 없앰 | 같은 제목의 리메이크·동명 작품이 잘못 붙는다. docs/33 D-9 테스트 W-20이 깨진다 |
| 후속 시즌도 시리즈 전체 제공처만 사용 | 4기 화면에 1기만 있는 넷플릭스가 나온다(2.2 실측) |
| 클라이언트가 AniList 방영 월·시즌 번호를 추가로 보냄 | AniList에는 TMDB 시즌 번호가 없다. 요청 계약이 넓어진다. 연도만으로 실측 사례(전슬 4기)가 정해진다 |
| AniList 관계(PREQUEL)를 따라 첫 시즌을 찾음 | AniList 추가 호출과 그래프 탐색이 필요하다. MVP 범위를 넘는다. 부제형 후속작은 12장 범위 밖으로 둔다 |
| 매칭된 TMDB id를 `content_external_ids`에 저장 | DB 쓰기 경로가 늘어난다. 이번 결함과 무관하다 |

## 6. 계약

### 6.1 `supabase/functions/_shared/watchProviders.ts` (추가만, 기존 export 시그니처 불변)

```ts
export type WatchProviderScope = "content" | "season" | "series";

export interface AnimeSeasonMarkerStrip { base: string; hadMarker: boolean }
export function stripAnimeSeasonMarkers(title: string | null | undefined): AnimeSeasonMarkerStrip;

export function matchTmdbAnimeSeriesForSequel(
  input: { titles: readonly (string | null | undefined)[]; year: number | null },
  results: readonly TmdbTvSearchItem[]
): number | null;

export interface TmdbSeasonSummary { season_number?: number | null; air_date?: string | null; episode_count?: number | null }
export function pickTmdbSeasonForAirYear(seasons: readonly TmdbSeasonSummary[] | null | undefined, year: number | null): number | null;

export interface TmdbWatchProvidersPayload { results?: Record<string, TmdbWatchProviderRegion | undefined> }
export interface AniListWatchLookupDeps {
  searchTv(query: string): Promise<TmdbTvSearchItem[]>;
  getTvSeasons(tmdbId: number): Promise<TmdbSeasonSummary[]>;
  getProviders(target: { tmdbId: number; seasonNumber: number | null }): Promise<TmdbWatchProvidersPayload>;
}
export interface AniListWatchLookupResult {
  tmdbId: number;
  seasonNumber: number | null;   // scope가 "season"일 때만 숫자
  scope: WatchProviderScope;
  payload: TmdbWatchProvidersPayload;
}
export async function lookupAniListWatchProviders(
  input: { titles: readonly (string | null | undefined)[]; year: number | null },
  deps: AniListWatchLookupDeps
): Promise<AniListWatchLookupResult | null>;
```

**`stripAnimeSeasonMarkers` 판정**
1. 입력이 `null`이거나 공백뿐이면 `{ base: "", hadMarker: false }`를 돌려준다.
2. `normalize("NFKC")`를 적용한다(전각 숫자 `第４期`를 `第4期`로 바꾼다).
3. 아래 표시를 모두 지운다. 영문은 대소문자를 구분하지 않고, 숫자는 아라비아 숫자다. `期`만 한자 숫자 `一`~`十`도 허용한다.
   - `第N期` (예: `第4期`, `第二期`)
   - `第N(&|・|,|、 N)*クール` (예: `第1&2クール`, `第2クール`)
   - `Nst|nd|rd|th Season` (예: `4th Season`, `3rd season`)
   - `Season N`, `シーズンN`, `시즌 N`
   - `Part N( & N | and N)*` (예: `Part 1 & 2`, `Part 2`)
   - 한국어 `N기`, `N부`. 뒤가 문자열 끝·공백·`:`·`-`일 때만 지운다.
4. 남은 문자열에서 연속 공백을 하나로 줄인다. 끝에 남은 구분자(공백, `:`, `：`, `-`, `–`, `—`, `~`, `・`, `/`)를 지우고 앞뒤 공백을 지운다.
5. 남은 문자열이 비면 `{ base: <2의 문자열 trim>, hadMarker: false }`를 돌려준다. 그 밖에는 `{ base: <4의 결과>, hadMarker: <3에서 하나라도 지웠는가> }`를 돌려준다.
6. 로마 숫자(`III`), 부제(`遊郭編`)는 지우지 않는다(12장).

**`matchTmdbAnimeSeriesForSequel` 판정**
1. `strips = titles.map(stripAnimeSeasonMarkers)`를 만든다. `hadMarker`가 하나도 없으면 `null`이다(D-3).
2. 비교 제목 집합은 원래 제목과 `strips[].base`를 `normalizeTitleForMatch`한 값이다. 빈 값은 뺀다.
3. 후보는 D-4 조건 1~3을 모두 만족하는 결과다. 점수는 `original_name` 일치가 2, 아니면 `name` 일치가 1이다. 0점은 제외한다.
4. 정렬: 점수 내림차순 → `|작품 연도 - 첫 방영 연도|` 오름차순(연도를 모르면 99) → `popularity` 내림차순 → `id` 오름차순. 첫 후보의 `id`를 돌려주고, 후보가 없으면 `null`이다.

**`pickTmdbSeasonForAirYear` 판정** — D-5와 같다. `year`나 `seasons`가 없으면 `null`이다. 연도는 `air_date`의 앞 4자리를 정수로 읽는다.

**`lookupAniListWatchProviders` 판정 순서**
1. `queries`는 `titles`를 trim하고 빈 값을 뺀 뒤 중복을 없앤 목록이다(지금 index.ts와 같다). 순서대로 `deps.searchTv`를 부르고 결과를 이어 붙인다.
2. `matchTmdbAnimeForAniList(input, results)`가 성공하면 `deps.getProviders({ tmdbId, seasonNumber: null })`를 부르고 `{ scope: "content", seasonNumber: null }`을 돌려준다. 이 경로에서 다른 호출은 없다.
3. `hadMarker`가 하나도 없으면 `null`이다. 추가 호출은 없다.
4. `hadMarker`가 있는 `base` 중 이미 검색한 제목과 `normalizeTitleForMatch` 결과가 다른 것만 추가 검색하고 결과에 이어 붙인다.
5. `matchTmdbAnimeSeriesForSequel(input, results)`가 `null`이면 `null`을 돌려준다.
6. `deps.getTvSeasons(seriesId)`의 결과로 `seasonNumber = pickTmdbSeasonForAirYear(seasons, input.year)`를 구한다.
7. `seasonNumber !== null`이면 `deps.getProviders({ tmdbId: seriesId, seasonNumber })`를 부른다. 국내 제공처가 1개 이상(D-6)이면 `{ scope: "season", seasonNumber }`를 돌려준다.
8. 아니면 `deps.getProviders({ tmdbId: seriesId, seasonNumber: null })`를 부르고 `{ scope: "series", seasonNumber: null }`을 돌려준다.
9. `deps`의 예외는 잡지 않고 그대로 던진다. index.ts가 기존처럼 503으로 바꾼다.

### 6.2 `supabase/functions/get-watch-providers/index.ts`
- 57~74행 AniList 분기를 `lookupAniListWatchProviders({ titles, year: body.value.air_year ?? null }, deps)`로 바꾼다. `titles`는 지금과 같이 `[original_title, title]`이다.
- `deps`는 이 파일 안에서 기존 `applyTmdbAuth`, `TMDB_LANGUAGE`로 만든다.

| deps | 요청 | 실패 시 |
|------|------|---------|
| `searchTv` | `search/tv?query=&language=ko-KR&include_adult=false` (지금과 같음) | `Error("TMDB anime search error: <status>")` |
| `getTvSeasons` | `tv/{id}?language=ko-KR`의 `seasons ?? []` | `Error("TMDB season lookup error: <status>")` |
| `getProviders` | 시즌 없음: `tv/{id}/watch/providers`. 시즌 있음: `tv/{id}/season/{n}/watch/providers` | `Error("TMDB watch providers error: <status>")` |

- 결과가 `null`이면 `createEmptyResponse`(필드 추가)를 돌려준다.
- 결과가 있으면 그 `payload`로 기존 응답을 만든다(`link`, `providers: mapKrWatchProvidersByCategory(regionData, title)`, `other_regions`). 다음 필드를 더한다.
  - `tmdb_id: String(result.tmdbId)`
  - `provider_scope: result.scope`
  - `tmdb_season_number: result.seasonNumber`
- TMDB 출처 경로(75~95행)의 조회는 그대로 두고, 응답에 `provider_scope: "content"`, `tmdb_season_number: null`만 더한다.
- 예외 처리 블록(96~102행)과 503 코드·형식은 그대로다.

### 6.3 클라이언트
- `src/types/watchProviders.ts`: `export type WatchProviderScope = "content" | "season" | "series";`를 추가한다. `WatchProvidersResponse`에 `provider_scope?: WatchProviderScope | null; tmdb_season_number?: number | null;`를 추가한다.
- `src/utils/watchProviderDisplay.ts`에 아래 두 함수를 추가한다.
  - `describeWatchProviderScope(scope: WatchProviderScope | null | undefined): string | null`
    - `"series"`이면 `"시리즈 전체 기준이에요. 이 시즌 제공 여부는 플랫폼에서 확인해 주세요."`를 돌려준다.
    - 그 밖에는 `null`이다.
  - `createLaftelSearchLink(title: string | null | undefined): string | null`
    - trim한 제목이 비면 `null`이다.
    - 아니면 `` `https://laftel.net/search?keyword=${encodeURIComponent(trimmed)}` ``를 돌려준다.

## 7. 데이터 모델 / SQL
변경 없음. DB 마이그레이션을 만들지 않는다.

## 8. 화면 명세 — 작품 상세 보러가기 (`WatchProviderList`)
UI 규칙 준수(UI-1~UI-13). 화면 고유 값은 아래와 같다.

- 새 prop `scope?: WatchProviderScope | null`, `laftelSearchUrl?: string | null`(기본 `null`)을 추가한다.
- **시리즈 기준 안내**
  - 조건: `!isLoading && !error && hasAnyProvider`이고 `describeWatchProviderScope(scope)`가 문자열일 때.
  - 위치: 제공처 목록(`styles.list`) 바로 아래, 디즈니+ 안내(110~112행) 위.
  - 스타일: `typography.caption`, `colors.textSubtle`.
- **라프텔 찾아보기 줄**
  - 조건: `laftelSearchUrl`이 있을 때(D-8).
  - 위치: 출처 표기(`시청 정보 제공: JustWatch`, 113행) 바로 위.
  - 구성: 한 줄짜리 `Pressable`이다. `accessibilityRole="link"`, `accessibilityLabel="라프텔에서 찾아보기"`를 준다. 왼쪽에 `Ionicons name="search"`(크기 16, 색 `colors.primarySoft`)를 둔다. 문구 "라프텔에서 찾아보기"는 `typography.label`, `colors.primarySoft`다. 그 아래 보조 문구 "제공 여부는 라프텔에서 확인해 주세요."는 `typography.caption`, `colors.textSubtle`다. 오른쪽에 `Ionicons name="open-outline"`(크기 16, 색 `colors.textSubtle`)를 둔다.
  - 크기: 최소 높이 44(UI-4.1). 배경·테두리는 없다(제공처 행 `styles.item`과 구분).
  - 누르면 `Linking.openURL(laftelSearchUrl)`을 부른다. 실패하면 기존 `openProvider`와 같은 토스트 "시청 플랫폼을 열지 못했어요. 잠시 후 다시 시도해 주세요."를 띄운다.
- 새 스타일은 토큰만 쓴다. 기존 스타일(16진 색값 포함)은 바꾸지 않는다.
- `app/content/[id].tsx` 395행 `WatchProviderList`에 두 prop을 추가한다.
  - `scope={watchProviders.data.provider_scope ?? null}`
  - `laftelSearchUrl={view.contentType === "anime" ? createLaftelSearchLink(watchProviderTitle) : null}`
  - `createLaftelSearchLink`는 `@/utils/watchProviderDisplay`에서 가져온다.

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 전슬 4기: `[転生したらスライムだった件 第4期 第1&2クール, 전생했더니 슬라임이었던 건에 대하여]`, 2026 | 82684 시즌 4. 왓챠·티빙, `scope: "season"`, 안내 없음 | W-42, W-49, W-55 |
| E-2 | 약사 2기: `[薬屋のひとりごと 第2期]`, 2025. TMDB 시즌 1(2023)만 있음 | 220542 시리즈 제공처, `scope: "series"`, 안내 표시 | W-50, W-56, V-1 |
| E-3 | 시즌 표시 없는 동명·리메이크(`うる星やつら` 2022, TMDB 1981만) | 빈 결과(기존 문구), 추가 호출 없음 | W-43, W-58 |
| E-4 | 직접 매칭 성공(`黄泉のツガイ` 2026) | 지금과 같음, `scope: "content"`, 추가 호출 없음 | W-54 |
| E-5 | TMDB 출처(드라마·영화) | 조회 그대로, 응답에 `provider_scope: "content"` | 6.2 (수동 M-5) |
| E-6 | 시즌이 정해졌지만 그 시즌 국내 제공처가 비어 있음 | 시리즈 제공처 + 안내 | W-57 |
| E-7 | 시즌 표시는 있으나 장르·제목·연도 조건에 맞는 후보가 없음 | 빈 결과, `getTvSeasons`·`getProviders` 호출 없음 | W-44, W-45, W-59 |
| E-8 | 같은 해 시즌 2개 / ±1년 시즌 2개 | 시즌 미결정 → 시리즈 + 안내 | W-51, W-52 |
| E-9 | TMDB 오류(검색·시즌·제공처) | 기존 503 `TMDB_API_ERROR`, 화면은 기존 오류 문구 | W-61 |
| E-10 | 애니인데 제목이 없거나 공백 | 라프텔 줄 없음 | V-4 |
| E-11 | 애니가 아닌 작품 | 라프텔 줄 없음 | 수동 M-5 |
| E-12 | 서버가 아직 구버전(필드 없음) | 안내 없음, 기존 화면. 라프텔 줄은 표시 | V-2 |
| E-13 | 라프텔 링크 열기 실패 | 기존 실패 토스트 | 수동 M-4 |
| E-14 | `scope: "season"` 또는 `"content"` | 안내 없음 | V-2 |
| E-15 | 한 제목의 시즌 표시를 뗀 결과가 다른 제목과 같음(`[X 第2期, X]`) | 같은 검색을 다시 하지 않음 | W-60 |
| E-16 | 같은 제목의 옛 시리즈·최근 시리즈가 모두 후보 | 작품 연도에 가까운 첫 방영 시리즈 | W-46 |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 기존 테스트(W-1~W-31, D-1~D-10)는 고치지 않으며 모두 통과해야 한다. 특히 W-18~W-24(직접 매칭)는 그대로 두어야 한다(D-2).
보존 테스트는 없다. 아래 행은 구현 전에 새 export가 없어 모두 실패해야 한다.

### `supabase/functions/_shared/watchProviders.test.ts` (추가)
`lookupAniListWatchProviders` 테스트는 가짜 `deps`를 쓰고, 호출 인자를 배열에 기록해 비교한다. TMDB 결과 객체는 2장 실측 값을 쓴다. 장르는 `genre_ids: [16]`이다.

| ID | 입력 | 기대 |
|----|------|------|
| W-32 | `stripAnimeSeasonMarkers("転生したらスライムだった件 第4期 第1&2クール")` | `{ base: "転生したらスライムだった件", hadMarker: true }` |
| W-33 | `"Tensei Shitara Slime Datta Ken 4th Season Part 1 & 2"` | `{ base: "Tensei Shitara Slime Datta Ken", hadMarker: true }` |
| W-34 | `"That Time I Got Reincarnated as a Slime Season 4"` | `{ base: "That Time I Got Reincarnated as a Slime", hadMarker: true }` |
| W-35 | `"薬屋のひとりごと 第2期"` / `"葬送のフリーレン 第２期"`(전각 숫자) | `"薬屋のひとりごと"` / `"葬送のフリーレン"`, 둘 다 `hadMarker: true` |
| W-36 | `"진격의 거인 시즌 3"` / `"전생했더니 슬라임이었던 건에 대하여 2기 1부"` | `"진격의 거인"` / `"전생했더니 슬라임이었던 건에 대하여"`, 둘 다 `true` |
| W-37 | `"Re:ゼロから始める異世界生活 3rd season"` / `"Title: Season 2"` | `"Re:ゼロから始める異世界生活"` / `"Title"`(끝 구분자 제거), 둘 다 `true` |
| W-38 | `"うる星やつら"` / `"モブサイコ100 III"` / `"86―エイティシックス―"` | 입력 그대로, `hadMarker: false` |
| W-39 | `"86―エイティシックス― Part 2"` / `"第4期"` | `{ base: "86―エイティシックス―", hadMarker: true }` / `{ base: "第4期", hadMarker: false }` |
| W-40 | `null` / `""` / `"   "` | 모두 `{ base: "", hadMarker: false }` |
| W-41 | `"第二期"`가 붙은 `"X 第二期"` | `{ base: "X", hadMarker: true }` |
| W-42 | `matchTmdbAnimeSeriesForSequel({ titles: [전슬 원제, "전생했더니 슬라임이었던 건에 대하여"], year: 2026 }, [82684(name "전생했더니 슬라임이었던 건에 대하여", original_name "転生したらスライムだった件", 2018-10-02), 118541(name "전생했더니 슬라임이었던 건에 대하여: 전생슬라임 일기", original_name "転生したらスライムだった件 転スラ日記", 2021-04-06)])` | `82684` |
| W-43 | `titles: ["うる星やつら"], year: 2022`, 후보 `{id:1, original_name:"うる星やつら", first_air_date:"1981-10-14"}` | `null` (시즌 표시 없음) |
| W-44 | `titles: ["薬屋のひとりごと 第2期"], year: 2025`, 후보 `{id:2, original_name:"薬屋のひとりごと", 2023, genre_ids:[18]}` | `null` (장르) |
| W-45 | `titles: ["X 第2期"], year: 2020`, 후보 첫 방영 2023 / 같은 후보 2021 | `null` / 그 id |
| W-46 | `titles: ["フルーツバスケット 2nd season"], year: 2020`, 후보 `{id:10, 2001, popularity:50}`, `{id:11, 2019, popularity:5}`(둘 다 original_name `"フルーツバスケット"`) | `11` |
| W-47 | `titles: ["Y 第2期"], year: 2024`, 후보 `{id:20, name:"Y", original_name:"Z", 2022}`, `{id:21, original_name:"Y", 2018}` | `21` (원제 일치 우선) |
| W-48 | `titles: ["X 第3期"], year: null`, 후보 `{id:30, original_name:"X", 2010}` | `30` |
| W-49 | `pickTmdbSeasonForAirYear(전슬 시즌 [S0 2019-03-26, S1 2018-10-02, S2 2021-01-12, S3 2024-04-05, S4 2026-04-03], 2026)` / 같은 목록 2024 | `4` / `3` |
| W-50 | `[S0 2023-10-23, S1 2023-10-22]`, 2025 | `null` |
| W-51 | `[S1 2022-01-01, S2 2023-01-01]`, 2024 / `[S1 2023-01-01, S2 2025-01-01]`, 2024 | `2` / `null` |
| W-52 | `[S1 2024-04-01, S2 2024-10-01]`, 2024 | `null` |
| W-53 | `year: null` / `seasons: null` / `[S0 2026-01-01]`, 2026 / `[{season_number:1, air_date:null}]`, 2026 | 모두 `null` |
| W-54 | 직접 매칭: `titles: ["黄泉のツガイ", "황천의 츠가이"], year: 2026`. `searchTv`는 두 질의 모두 `[{id:260463, original_name:"黄泉のツガイ", name:"황천의 츠가이", 2026-04-04}]`. `getProviders`는 KR `flatrate:[97]` | `{ tmdbId: 260463, seasonNumber: null, scope: "content" }`. `searchTv` 2회, `getTvSeasons` 0회, `getProviders` 1회 `{260463, null}` |
| W-55 | 전슬 4기: 원제 검색 `[]`, 한국어 제목 검색 `[82684, 118541]`, `"転生したらスライムだった件"` 검색 `[82684]`. `getTvSeasons(82684)` = W-49 목록. `getProviders({82684, 4})` = KR `flatrate:[97, 1883]` | `{ tmdbId: 82684, seasonNumber: 4, scope: "season" }`. `searchTv` 3회(마지막 질의 `"転生したらスライムだった件"`), `getProviders`는 `{82684, 4}` 1회뿐 |
| W-56 | 약사 2기: 원제 검색과 `"薬屋のひとりごと"` 검색 모두 `[{id:220542, original_name:"薬屋のひとりごと", name:"약사의 혼잣말", 2023-10-22}]`. 시즌 = W-50 목록. `getProviders({220542, null})` = KR `flatrate:[8, 283]` | `{ tmdbId: 220542, seasonNumber: null, scope: "series" }`. `getProviders`는 `{220542, null}` 1회 |
| W-57 | W-55와 같지만 `getProviders({82684, 4})`는 `{ results: {} }`, `getProviders({82684, null})`는 KR `flatrate:[8]` | `scope: "series"`, `seasonNumber: null`. `getProviders` 호출 순서 `[{82684,4}, {82684,null}]` |
| W-58 | `titles: ["うる星やつら"], year: 2022`, 검색 결과 1981 시리즈만 | `null`. `searchTv` 1회, `getTvSeasons`·`getProviders` 0회 |
| W-59 | `titles: ["X 第2期"], year: 2025`, 모든 검색 결과 `[]` | `null`. `getTvSeasons`·`getProviders` 0회 |
| W-60 | `titles: ["X 第2期", "X"], year: 2025`(직접 매칭 실패하도록 결과는 `[]`) | `searchTv` 2회(`"X 第2期"`, `"X"`). `"X"`를 다시 검색하지 않음 |
| W-61 | `searchTv`가 `Error("TMDB anime search error: 500")`로 거부 | `assert.rejects`, 같은 메시지 |

### `src/utils/watchProviderDisplay.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| V-1 | `describeWatchProviderScope("series")` | `"시리즈 전체 기준이에요. 이 시즌 제공 여부는 플랫폼에서 확인해 주세요."` |
| V-2 | `("season")`, `("content")`, `(null)`, `(undefined)` | 모두 `null` |
| V-3 | `createLaftelSearchLink("전생했더니 슬라임이었던 건에 대하여")` / `("  진격의 거인  ")` | `"https://laftel.net/search?keyword=" + encodeURIComponent("전생했더니 슬라임이었던 건에 대하여")` / `... + encodeURIComponent("진격의 거인")` |
| V-4 | `(null)`, `(undefined)`, `("")`, `("   ")` | 모두 `null` |
| V-5 | `("Re:Zero & 2")` | `"https://laftel.net/search?keyword=Re%3AZero%20%26%202"` |

### 수동 확인 (UI-14.3)
배포 전에는 웹이 배포된 구버전 `get-watch-providers`를 부른다. 그래서 M-1·M-2는 배포 후 사람이 확인한다. M-3~M-5는 클라이언트만으로 확인할 수 있다.

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 (배포 후) | 전슬 4기 상세 보러가기 정액제 탭에 왓챠·티빙이 있고, 넷플릭스가 없고, 안내 줄이 없다 |
| M-2 | 웹 8081 (배포 후) | 약사의 혼잣말 2기 상세에 제공처와 시리즈 전체 기준 안내 한 줄이 있다 |
| M-3 | 웹 375 / 1440 | 애니 상세에 "라프텔에서 찾아보기" 줄이 출처 표기 위에 있다. 가로 넘침이 없고, 누르면 라프텔 검색 결과가 열린다 |
| M-4 | 앱(iOS 세로) | 라프텔 줄 터치 영역이 44 이상이고, 누르면 라프텔이 열린다. 글자 1.3배에서 잘림이 없다 |
| M-5 | 웹·앱 드라마/영화 상세 | 라프텔 줄이 없고, 보러가기가 기존과 같다 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/watchProviders.ts` | 6.1 export 추가. 기존 함수·화이트리스트는 바꾸지 않는다 |
| `supabase/functions/_shared/watchProviders.test.ts` | W-32~W-61 |
| `supabase/functions/get-watch-providers/index.ts` | 6.2 |
| `src/types/watchProviders.ts` | 6.3 타입 |
| `src/utils/watchProviderDisplay.ts` | 6.3 함수 2개 |
| `src/utils/watchProviderDisplay.test.ts` | V-1~V-5 |
| `src/components/content/WatchProviderList.tsx` | 8장 prop·안내·라프텔 줄 |
| `app/content/[id].tsx` | 395행 prop 2개, import 1개 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| 라프텔 실제 제공 여부 표시·라프텔 화이트리스트 | D-1 |
| 부제형 후속작(`呪術廻戦 懐玉・玉折／渋谷事変`, `鬼滅の刃 遊郭編`)·로마 숫자 후속작(`III`) | 시즌 표시가 없어 D-3 대상이 아니다. AniList 관계 추적은 기각(5장) |
| AniList 극장판(TMDB movie) 매칭 | 지금도 AniList는 `tv`로만 찾는다. 별도 결함 |
| 추천 카드의 "볼 수 있는 곳"(`attachKrOttProviders`)·추천 OTT 필터 | TMDB id가 있는 후보에만 쓰는 별도 경로. 이번 변경으로 동작이 바뀌지 않는다 |
| 첫 시즌(직접 매칭) 작품의 시리즈 전체 제공처 | 기존 동작 유지(D-2) |
| 매칭 결과 저장·캐시 | D-9 |
| `WatchProviderList`의 기존 16진 색값 정리 | 별도 UI 작업 |

## 13. 확실하지 않음 — 별도 검증 필요
- TMDB·JustWatch 시즌별 국내 제공처가 실제 OTT 편성과 늦게 맞춰질 수 있다. 2.2 값은 2026-10-11 기준이다.
- 라프텔 검색 URL(`/search?keyword=`)은 2026-10-11 웹에서 확인했다. 라프텔 앱이 설치된 iOS·Android에서 이 링크가 앱으로 열리는지, 브라우저로 열리는지는 확인하지 않았다(M-4).
- 시즌 표시 목록(6.1)은 실측 사례와 흔한 표기를 기준으로 했다. 다른 표기(`2nd Cour`, `後編` 등)는 반영하지 않았다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 결함 수정 작업이다.
- AniList 애니 후속 시즌(원제에 `第4期` 같은 시즌 표시가 있는 작품)이 TMDB 시리즈와 매칭되지 않아 보러가기가 항상 빈다. 이를 시즌 제공처(또는 시리즈 전체 + 안내)로 채운다.
- TMDB에 없는 라프텔은 애니 보러가기 카드에 "라프텔에서 찾아보기" 검색 줄로만 연결한다.

| ID | 증상 |
|----|------|
| F-1 | 전슬 4기 등 후속 시즌 애니의 보러가기가 "국내 OTT에서 볼 수 있는 곳 정보가 아직 없어요."다(TMDB 시즌 4 국내 정액제: 왓챠·티빙) |
| F-2 | 라프텔에서 볼 수 있어도 보러가기에서 라프텔로 갈 수 없다 |

# READ FIRST
1. 이 명세서 1~13장. 원인은 2장, 결정은 D-1~D-9, 계약은 6장, 화면은 8장, 테스트는 10장이다.
2. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙.
3. `docs/33_kr_ott_availability_spec.md` D-1, D-9, 8.2 — 국내 OTT 정의, 기존 매칭 규칙, 보러가기 카드.
4. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
5. 고칠 파일:
   - `supabase/functions/_shared/watchProviders.ts`: 21~34행 화이트리스트(읽기만), 141~165행 `TmdbTvSearchItem`·`matchTmdbAnimeForAniList`
   - `supabase/functions/get-watch-providers/index.ts`: 57~74행 AniList 분기, 75~95행 응답, 105~121행 빈 응답
   - `src/components/content/WatchProviderList.tsx`
   - `app/content/[id].tsx`: 125행 `watchProviderTitle`, 395행

# 시작 상태 (반드시 유지)
- `git status`와 `npm test` 결과를 기록한다. 기준선은 1074개 중 1073개 통과다. 기존 실패 1개("uses latest-popular fallback ordering with an empty library")는 무관하니 건드리지 않는다. 그 밖의 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 라프텔을 제공처로 표시하지 않는다.
  - `KR_OTT_PROVIDERS`·`createProviderLink`는 바꾸지 않는다.
  - 라프텔 API 호출·페이지 수집을 하지 않는다.
  - 라프텔은 애니 카드의 "찾아보기" 검색 줄로만 연결한다.
- **D-2.** `matchTmdbAnimeForAniList`는 그대로 두고 먼저 시도한다. 성공 경로의 TMDB 호출 수는 지금과 같아야 한다(W-54). 기존 테스트 W-18~W-24는 수정하지 않는다.
- **D-3.** 보완 매칭은 시즌 표시를 뗀 제목이 하나 이상 있을 때만 한다. 없으면 빈 결과를 준다(W-43, W-58).
- **D-4~D-6.** 후보 조건·정렬, "하나로 정해질 때만" 시즌 선택, 시즌 우선 후 시리즈 + 안내는 6.1 판정 순서 그대로 따른다.
- **D-7.** 응답에는 선택 필드 `provider_scope`·`tmdb_season_number`만 추가한다. 기존 필드와 503 형식은 바꾸지 않는다. 안내는 `"series"`에만 붙인다.
- **D-8.** 라프텔 줄은 `view.contentType === "anime"`이고 제목이 있을 때만 둔다. 제공처 행과 다른 모양으로 그리고, 로딩·오류와 관계없이 표시한다.
- **D-9.** 캐시를 추가하지 않는다. 이미 검색한 제목(정규화 기준)은 다시 검색하지 않는다(W-60).

# STEP 1 — 실패하는 테스트부터
- 10장 W-32~W-61을 `supabase/functions/_shared/watchProviders.test.ts`에, V-1~V-5를 `src/utils/watchProviderDisplay.test.ts`에 추가한다.
- `lookupAniListWatchProviders` 테스트는 가짜 `deps`의 호출 인자를 배열에 기록해 횟수·순서를 비교한다.
- `npm test`를 돌려 새 테스트가 전부 실패(새 export 없음)하는지 눈으로 확인한다. 하나라도 통과하면 멈추고 보고한다. 이번 명세에는 보존 테스트가 없다.

# STEP 2 — 공용 매칭 함수
`supabase/functions/_shared/watchProviders.ts`에 6.1의 타입과 아래 함수 4개를 추가한다.
- `stripAnimeSeasonMarkers`
- `matchTmdbAnimeSeriesForSequel`
- `pickTmdbSeasonForAirYear`
- `lookupAniListWatchProviders`

기존 export의 시그니처와 동작은 바꾸지 않는다. `lookupAniListWatchProviders` 위에 아래 근거를 짧은 주석으로 남긴다.
- TMDB는 후속 시즌을 첫 시즌 연도 시리즈에 넣는다.
- 시리즈 전체 제공처에는 1기에만 있는 OTT가 섞인다(docs/54 2.2).

W-32~W-61이 통과해야 한다.

# STEP 3 — Edge Function 연결
`supabase/functions/get-watch-providers/index.ts`를 6.2대로 바꾼다.
- `deps` 세 개는 이 파일 안에서 기존 `applyTmdbAuth`·`TMDB_LANGUAGE`로 만든다.
- 시즌 제공처 URL은 `tv/{id}/season/{n}/watch/providers`다.
- TMDB 출처 경로는 응답 필드 두 개만 더한다.

# STEP 4 — 클라이언트 타입·문구
- `src/types/watchProviders.ts`에 6.3 타입을 추가한다.
- `src/utils/watchProviderDisplay.ts`에 `describeWatchProviderScope`, `createLaftelSearchLink`를 추가한다.
- V-1~V-5가 통과해야 한다.

# STEP 5 — 화면
- `WatchProviderList.tsx`에 8장의 prop 2개, 시리즈 기준 안내, 라프텔 찾아보기 줄을 추가한다.
- 새 스타일은 `colors`·`typography`·`spacing` 토큰만 쓴다. 기존 스타일은 바꾸지 않는다.
- `app/content/[id].tsx` 395행에 prop 2개를 넘긴다.
- 웹 8081에서 로그인된 화면을 쓸 수 있으면 M-3·M-5를 확인한다(로그인 대행 금지). 못 하면 사유를 보고한다.

# 엣지 케이스 (전부 처리, 명세서 9장)
9장 E-1~E-16 전부. 각 행의 테스트 ID를 지킨다.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
npx --no-install esbuild supabase/functions/get-watch-providers/index.ts --bundle=false --format=esm --log-level=warning > /dev/null
git diff -U0 -- src/components/content/WatchProviderList.tsx 'app/content/[id].tsx' | grep -E '^\+' | grep -nE "#[0-9A-Fa-f]{3,6}\b|rgba?\(|fontWeight: \"|fontSize: [0-9]|Alert\.alert"
```
- `npm test`: 기준선 1073개 통과 + 새 테스트 30개(W-32~W-61) + 5개(V-1~V-5). 기존 실패 1개 외 실패는 0이어야 한다.
- esbuild는 Edge Function 문법 검사다(typecheck는 Edge Function을 제외한다). 오류 0이어야 한다.
- 마지막 grep(추가한 줄)은 0줄이어야 한다.

# DEFINITION OF DONE
- [ ] W-32~W-61, V-1~V-5가 수정 전에 실패했고 수정 후 통과한다
- [ ] 기존 테스트 개수가 줄지 않았고, W-18~W-24 diff가 없다
- [ ] `KR_OTT_PROVIDERS`·`createProviderLink`·`matchTmdbAnimeForAniList` 본문 diff가 없다
- [ ] 직접 매칭 성공 경로의 TMDB 호출 수가 지금과 같다(W-54)
- [ ] 응답에 `provider_scope`·`tmdb_season_number`가 있고, 빈 응답에서는 둘 다 `null`이다
- [ ] 애니 상세에만 라프텔 찾아보기 줄이 있고, 제공처 행과 모양이 다르다
- [ ] `typecheck`·`lint`·esbuild 통과, UI-13.2 토큰·`Alert` grep 0줄
- [ ] 웹·앱 수동 확인 결과(또는 못 한 사유)를 M-1~M-5 표로 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
supabase/functions/_shared/watchProviders.ts
supabase/functions/_shared/watchProviders.test.ts
supabase/functions/get-watch-providers/index.ts
src/types/watchProviders.ts
src/utils/watchProviderDisplay.ts
src/utils/watchProviderDisplay.test.ts
src/components/content/WatchProviderList.tsx
app/content/[id].tsx
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력(요약)
2. `npm test` before / after 통과 개수, `typecheck`·`lint`·esbuild·토큰 grep 결과
3. 추가한 테스트 ID와 이름
4. M-1~M-5 결과(웹/앱 구분, 못 한 항목과 사유)
5. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
6. 사람이 할 후속 작업: `get-watch-providers` 재배포. 공용 `watchProviders.ts`의 다른 미배포 변경(예: docs/33 이후 Disney 링크 정정)도 함께 나간다는 점을 적는다

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 라프텔 API·페이지를 호출하거나 수집하지 않는다(D-1).
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- 로그인 대행 금지.

## 15. 2026-10-20 후속 정정 — 선택한 시즌의 제공처만 표시

> 같은 월 조건과 구응답 캐시 처리는 아래 §16의 템빨 누락 정정이 우선한다. 그 외 시즌별 제공처 계약은 유지한다.

### 요구와 실측

사용자 캡처의 작품은 AniList 185756, `転生貴族、鑑定スキルで成り上がる 第3期`(2026-09-27)다. 사용자가 **“시즌3 기준으로 표시해야해 이건 시즌3 작품이야”**라고 명시했다. 따라서 시리즈 전체 제공처를 보여주고 작은 안내를 붙이는 기존 D-6은 더 이상 적용하지 않는다.

2026-10-20 읽기 전용 TMDB 조회에서 대응 시리즈 237150은 `season_number: 1`, `air_date: 2024-04-07`, `episode_count: 29` 한 행만 반환했다. 시리즈/시즌 1의 KR 제공처 모두 Netflix·Watcha·TVING·Crunchyroll을 포함하지만, 이것은 AniList 3기의 제공 여부를 구별하는 근거가 아니다. [넷플릭스 공식 작품 페이지](https://www.netflix.com/kr/title/81769856)는 조회 당시 “시즌 2개”를 표시했다. API 표본은 `/tmp/scenenote-ott-probe.jsonl`이다. 앱이 이 작품의 넷플릭스를 임의로 차단하는 작품별 예외를 넣지 않고, 모든 작품에 아래 범위 검증을 적용한다.

### 대체 계약

1. **AniList TV는 첫 기수를 포함해 시즌 단위로 검증한다.** 제목 직접 매칭 성공도 시리즈 전체 제공처로 끝내지 않는다. 일본어/한국어/영문 제목의 명시 기수, 선택 시즌, 방영일/연도를 조회에 전달한다. AniList 제목의 명시 기수는 DB의 가상 시즌 1보다 우선하며, 서로 다른 명시 기수가 충돌하면 미확인이다. Part·부·cour 숫자를 기수로 추정하지 않는다.
2. **시즌 선택은 보수적으로 한다.** 정확한 `YYYY-MM-DD` 방영일로 하나만 일치하면 이를 우선하고, 번호 체계가 다른 경우도 이 근거가 있을 때만 대응시킨다. 정확 일자 일치가 없을 때는 요청 기수와 동일한 TMDB 시즌 번호·방영 연도가 일치해야 하며 월까지 알면 방영 월도 같아야 한다. 인접 연도 ±1로 다른 시즌을 고르지 않는다. 일치 시즌이 없거나 모호하면 제공처를 조회하지 않고 미확인 응답을 준다.
3. **시리즈 대체를 금지한다.** 선택 시즌의 KR가 비어도 다른 시즌/시리즈의 제공처로 채우지 않는다. 해외 정보도 같은 시즌 응답에서만 가져온다. TMDB 출처의 선택 시즌은 `/tv/{id}/season/{n}/watch/providers`를 직접 조회하며, 시즌 404는 미확인으로 처리한다. TMDB 영화/시즌 선택 없는 시리즈 조회는 기존 범위를 유지한다. AniList 극장판의 TV 오매칭은 중단하고 별도의 영화 매칭이 구현되기 전에는 미확인으로 처리한다.
4. **요청·응답의 범위를 확인한다.** 요청 `season_number`, `air_date`를 추가한다. 응답은 `lookup_version: 2`, `requested_season_number`, 기존 `provider_scope`·`tmdb_season_number`를 포함한다. 시즌 문맥에서는 버전 2·`scope: season`·요청 기수 일치를 확인한 응답만 확정 제공처로 표시한다. 구서버의 `series`/`content`/필드 누락 응답도 시즌 제공처로 표시하지 않는다. 미확인 응답은 `provider_scope: null`이다.
5. **화면에서 조회 범위를 먼저 알린다.** “시즌 3 기준”을 표시하고, 미확인이면 “시즌 3의 국내 OTT 제공 정보를 아직 확인하지 못했어요.”로 안내한다. 이는 해당 OTT에 없다는 단정이 아니다. 라프텔은 기존처럼 확인용 검색 행동이며 검색어에도 기수를 반영한다. 서버 오류는 한국어 안내와 명시적 재시도를 제공한다.
6. **캐시는 범위를 분리한다.** 버전·출처·종류·ID·시즌·제목·원제·방영일/연도를 키에 포함한다. 상세 메타데이터 보강 뒤 이전 빈값을 고정 재사용하지 않으며 1시간이 지난 응답은 화면 재진입 때 갱신한다. 실패 상태 변경으로 자동 요청이 반복되지 않도록 하고 명시적 재시도는 허용한다. 기존 Jotai 캐시를 다른 상태 관리로 이관하는 작업은 포함하지 않는다.
7. **추천 배지에도 같은 오확정을 막는다.** 비-TMDB 애니의 현지화용 TMDB 시리즈 ID만으로는 기수의 제공처를 확정하지 않는다. 시즌 번호가 지정된 추천도 시리즈 제공처만 조회하는 기존 경로에서 확정 배지를 붙이지 않는다. 이 경우 `watch_providers_kr: null`로 두며 추천 개수·순서·기존 후보 필터를 바꾸지 않는다.

### 회귀 검증과 기존 표 대체

- 기존 W-18~W-24의 제목 후보 매칭은 보존한다. W-27은 시리즈 ID만 있는 AniList의 배지 보류, W-51은 인접 연도 거절, W-54는 직접 매칭 이후 시즌 조회, W-56은 합쳐진 시즌 미확인, W-57은 빈 시즌 응답 보존으로 기대를 대체한다. 나머지 관련 표는 그대로 검증한다.
- 추가 회귀는 3기→합쳐진 시즌 1 오매칭 차단, 같은/인접 연도 후속기, 명시 기수 충돌, 동일 방영일에 한한 번호 체계 보정, 시즌별 요청 URL, 영화 경로, 구응답 차단, 캐시 분리, 실패 뒤 명시적 재시도를 포함한다.
- 과거 E-2·E-4·E-5·E-6·E-8·E-12·E-14와 M-1·M-2·M-5 중 시즌 조회/안내 부분은 이 장의 계약으로 검증한다. 특히 M-2는 시리즈 제공처 대신 미확인 안내다. M-3·M-4의 라프텔 연결/접근성과 D-1은 유지한다.
- 실제 웹은 신고된 3기 상세에서 넷플릭스 등 시리즈 제공처가 제거되고 시즌 기준/미확인 안내가 나오는지 375·1440px에서 확인한다. 서버 재배포 전 결과는 구응답 차단 검증으로 기록하고, 새 서버의 조회 성공 증거와 구분한다. 실기기 미실행은 별도 기록한다.

### 실행 순서

이 장과 `docs/00_ui_style_rules.md`를 먼저 읽고 순수 회귀 테스트 → 서버 요청/매칭 → 앱 캐시/응답 검증/안내 → 타입·린트·전체 테스트·Deno 검사 → 실제 웹 확인 순서로 적용한다. DB·secret을 바꾸지 않는다. `get-watch-providers`와 추천 배지 변경의 운영 반영에 필요한 `personalized-recommendations` 배포는 별도 작업이며, 실행 기록은 `development_next_steps.md`에 남긴다.

## 16. 2026-10-20 후속 정정 — 템빨 누락과 구서버 캐시

### 사용자 신고와 원인

사용자가 넷플릭스에서 볼 수 있는 `템빨 ~아이템의 힘~`의 누락을 신고했다. [넷플릭스 공식 작품 페이지](https://www.netflix.com/kr/title/82948047)는 조회 당시 3개 에피소드를 표시했다. AniList 212888은 선공개일 `2026-09-27`, TMDB 324502의 시즌 1은 TV 방영일 `2026-10-02`를 제공한다. [작품 공식 사이트](https://tempal-anime.net/)도 두 날짜를 구분한다. 정확한 `/tv/324502/season/1/watch/providers`의 KR 응답에는 Netflix·Watcha·TVING이 있으므로 작품별 제공처 하드코딩이나 시리즈 대체가 필요하지 않다.

두 결함을 따로 정정한다. 운영 v4는 `lookup_version`·요청 기수를 반환하지 않아 새 앱이 그 제공처를 숨긴다. 로컬 새 매칭도 §15의 같은 월 조건 때문에 5일 차이의 정상 시즌을 거절했다. 따라서 서버를 배포하는 것만으로는 이 신고가 해결되지 않으며, 매칭 수정과 계약을 지원하는 서버 배포가 함께 필요하다.

### 대체 계약과 구현 범위

1. §15-2의 날짜 보조 판정을 **같은 요청 시즌 번호 + 같은 연도 + 정확한 날짜 차이 절댓값 7일 이하**로 바꾼다. 날짜를 모르면 기존 같은 번호·연도 조건을 유지한다. 유일한 정확 날짜 일치를 먼저 고르는 순서, 다른 번호는 정확 날짜에서만 허용, 인접 연도·모호한 후보·3기→합쳐진 1기 거절은 유지한다. 이는 같은 월이면 한 달 가까이 다른 날짜도 허용하던 빈틈도 닫는다.
2. 구버전/요청 범위가 맞지 않는 응답은 정상 캐시로 취급하지 않는다. 다음 화면 포커스 진입마다 한 번 새로 조회하되, 같은 포커스 안의 자동 반복·진행 중 중복 호출을 막는다. 버전 2·요청 기수 일치·`scope:null`인 실제 미확인 응답은 정상 캐시이며 기존 1시간 TTL을 유지한다.
3. 구응답 때문에 표시하지 못하는 경우는 실제 OTT 데이터 부재와 구별해 “시청 정보를 새로 확인하지 못했어요. 잠시 후 다시 확인해 주세요.”로 안내한다. 구응답의 Netflix 행을 그대로 노출하는 우회는 금지한다.
4. 서버 변경은 `_shared/watchProviderSeason.ts`와 관련 테스트, 앱 변경은 `useWatchProviders`·`watchProviderLookup`·`watchProviderDisplay`·`WatchProviderList`와 관련 테스트로 제한한다. 작품·감상 데이터, 추천 후보 필터, 키·DB·다른 Edge Function은 변경하지 않는다.

### 검증과 적용

- 7일 경계 양방향(월 경계 포함), 8일 초과, 같은 월의 먼 날짜, 인접 연도, 다른 시즌 번호의 근접 날짜, 여러 일치 후보, 정확 날짜 우선순위, 템빨의 시즌 1 제공처 조회를 자동 회귀로 검증한다. 앞선 3기 오매칭 차단을 유지한다.
- 앱은 구응답 캐시의 즉시 stale 판정·포커스별 제한, 정상 미확인 캐시의 TTL, 재시도와 로딩 중 중복 차단을 검증한다.
- 실제 핸들러 fixture와 실제 TMDB 읽기 결과를 분리 기록한다. 서버 적용 후에는 로그인된 앱에서 템빨의 시즌 1 넷플릭스·티빙·왓챠와 앞선 3기의 미확인을 함께 확인한다. 웹 375·1440px 및 네이티브 미실행 여부를 기록한다.
- 기존 배포 제한은 유지한다. 사용자 배포 승인이 있으면 연결 프로젝트 일치·운영 소스 백업·검사 완료를 확인하고 **`get-watch-providers` 하나만** 배포한다. 추천 함수는 이 누락 수정의 배포 범위가 아니다. 적용 여부와 검증 증거는 `development_next_steps.md`에 기록한다.
