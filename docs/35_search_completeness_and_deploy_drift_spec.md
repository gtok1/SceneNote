# 35. "TMDB에 있는데 검색에 안 나온다" 근본 정정 — 배포 불일치·숨은 필터·분류 오류

작성일: 2026-09-29
대상 브랜치 기준: `main` (`d44080f`, `docs/development_next_steps.md` 미커밋 수정 있음)
선행 문서: `docs/15_season_search_spec.md`, `docs/17_season_library_tracking_spec.md`, `docs/30_recommendation_fill_and_action_consistency_fixes_spec.md`(2026-09-26 후속: 계정 필터 저장), `docs/34_search_seasons_and_people_restore_spec.md`

> **근거.** 2026-09-29 실측: ① 저장소의 TMDB 검색 어댑터를 실제 TMDB에 읽기 전용으로 돌려 28개 작품명 검색, ② Supabase Management API로 배포된 Edge Function 버전 조회(읽기 전용), ③ 코드 대조. Codex가 같은 날 "결혼 못하는" 누락을 `search-content` v26 배포로 고친 기록(`docs/development_next_steps.md`)도 반영했다.

---

## 1. 결론

필터 없이 저장소 코드로 검색하면 28개 중 **28개 모두 TMDB 결과가 나온다.** 사용자가 누락을 겪는 원인은 TMDB가 아니라 다음 다섯 가지다.

| ID | 원인 | 영향 | 근거 |
|----|------|------|------|
| C-1 | **배포 불일치.** 저장소에서 고친 코드가 운영 Edge Function에 올라가지 않는다. 이를 알려주는 장치가 없다 | "결혼 못하는" 2006년 원작 누락(v25의 시즌 병합 결함, v26 배포로 해결). 아래 표처럼 **13개 중 11개가 코드보다 오래된 배포**, `delete-account`는 **미배포** | 2절 표 |
| C-2 | **저장된 필터가 제목 검색을 조용히 거른다.** 2026-09-27(`b476849`)부터 추천 피드용 필터(유형·장르·국가·라이브러리 상태·연도)가 계정에 저장되고 **제목 검색에도** 적용된다. 서버가 조건 밖 결과를 버리고, 클라이언트가 한 번 더 버린다. 화면 배너는 유형·장르·국가만 보여주고 "해제"도 그 셋만 지운다 — **상태·연도 필터는 보이지도, 해제되지도 않는다** | 예: 연도 2024가 저장돼 있으면 다른 해 작품이 전부 사라짐. 상태 "보는 중"이면 라이브러리에 없는 작품이 전부 사라짐. 유형 "드라마"면 영화·애니가 사라짐 | `app/search.tsx:86~112, 186~213, 599~616`, `src/components/content/ContentSearchBar.tsx:114~122`, `supabase/functions/search-content/index.ts:219~225` |
| C-3 | **실사 일드가 애니로 분류된다.** 어댑터가 **줄거리(overview)**에 "만화·애니·animation"이 있으면 애니로 판정한다. 만화 원작 실사 드라마가 대량 오분류 | 유형 필터 "드라마"에서 사라지고 "애니"에 섞임. 실측: 고독한 미식가(55582), 중쇄를 찍자!(67504) → anime | `search-content/adapters/tmdb.ts` `isLikelyAnime` |
| C-4 | **시즌 카드가 시리즈명 없이 표시된다.** 의미 있는 시즌명이 있으면 그것만 제목으로 쓴다(`docs/17` 83행 규칙) | "시즌 4 (The Final Season)", "4기: 합동 강화 훈련편"처럼 무슨 작품인지 알 수 없어 "없다"고 느낌. 실측: 진격의 거인(1429) S4, 귀멸의 칼날(85937) S1~S5 | `expandAiredSeasons`, `applyTmdbSeasonMetadata` |
| C-5 | 인물 검색 결과의 "드라마" 판정이 서버와 다르다 | 해외 드라마(`content_type: "other"`, 시즌 있음)가 인물 결과에서만 빠짐 | `app/search.tsx:1165~1170` `filterResultsByMediaType` vs `_shared/discoveryFilters.ts` `discoveryMediaType` |

---

## 2. 배포 불일치 실측 (2026-09-29 KST)

"마지막 변경" = 함수 `index.ts`와 그것이 import하는 `_shared` 등 모든 로컬 파일 중 가장 최근 커밋.

| 함수 | 운영 버전·배포 시각 | 코드 마지막 변경 | 상태 |
|------|--------------------|-----------------|------|
| search-content | v26 · 09-29 06:37 | 09-28 22:51 | 최신 |
| search-person-content | v7 · 07-09 | 09-28 (docs/34 인물 검색 품질) | **오래됨** |
| personalized-recommendations | v19 · 09-27 18:38 | 09-28 (docs/33 국내 OTT) | **오래됨** |
| get-watch-providers | v3 · 05-03 | 09-28 (docs/33) | **오래됨** |
| popular-recommendations | v5 · 07-10 | 09-28 | **오래됨**(화면 미사용) |
| add-to-library | v19 · 09-06 | 09-27 | **오래됨** |
| fetch-episodes | v8 · 09-24 | 09-25 | **오래됨** |
| get-content-detail | v16 · 07-09 | 09-25 | **오래됨** |
| get-person-detail | v10 · 07-09 | 08-18 | **오래됨** |
| get-library-share | v2 · 07-09 | 08-18 | **오래됨** |
| bulk-register-netflix | v4 · 05-04 | 09-25 | **오래됨** |
| similar-content | v3 · 07-10 14:09 | 07-10 15:28 | **오래됨** |
| create-library-share | v2 · 07-09 | 07-07 | 최신 |
| delete-account | **없음** | 07-09 | **미배포** |

공용 파일 변경이 모든 함수의 동작을 바꾸는 것은 아니지만, 어느 것이 바뀌었는지 사람이 매번 판단할 수 없다. 그래서 **기계적으로 알려주는 도구**가 필요하다(D-5).

---

## 3. 설계 결정

### D-1 (최우선). 제목 검색은 결과를 조용히 버리지 않는다
- 서버(`search-content`): **검색어가 있으면** 외부 호출·캐시는 항상 `media_type: "all"` 기준으로 한다(유형 필터로 소스·엔드포인트를 좁히지 않는다). 필터는 **버리지 않고 표시**한다: 필터가 있으면 각 결과에 `filter_match: boolean`, 응답에 `filtered_out_count`. 필터 증거 보강(영화 제작국가, TV 키워드 장르)은 기존 `filterSearchResultsByDiscovery`를 그대로 쓴다.
- 클라이언트: 순수 함수 `partitionSearchResults`로 보이는 결과/숨긴 결과를 나누고, 숨긴 게 있으면 **"필터 조건에 맞지 않아 N개를 숨겼어요 · 모두 보기"**를 항상 보여준다. 전부 숨겨졌으면 빈 상태 문구도 그 사실을 말한다.
- 국가만 있는 **둘러보기(browse) 모드와 추천 피드는 바꾸지 않는다.**

### D-2. 저장된 필터는 모두 보이고 모두 해제된다
배너 "적용 중"에 라이브러리 상태·연도도 표시한다. "해제"는 유형·장르·국가·상태·연도를 모두 지운다(정렬은 유지).

### D-3. 애니 판정은 장르 16 또는 제목만 본다
줄거리는 판정에 쓰지 않는다. 제목(`title`, `name`, `original_title`, `original_name`)에 `\banime\b`·`\banimation\b`·`アニメ`가 있거나, 일본 작품이고 기존 명시 힌트 목록과 제목이 맞을 때만 애니. 한국어 부분 문자열 "애니"·"만화"는 쓰지 않는다(애니멀, 만화가 주인공 드라마 등 오판).

### D-4. 시즌 카드 제목 규칙(`docs/17`)은 유지하고, 시리즈명은 표시에서 붙인다
`title_primary`는 지금처럼 시즌명. 시즌명이 시리즈명을 포함하지 않으면 `series_title`(시리즈명)을 채운다. 검색 카드는 `formatSearchResultTitle` = `series_title ? "${series_title} ${title_primary}" : title_primary`로 표시한다. 저장·라이브러리 데이터는 바뀌지 않는다.

### D-5. 배포 불일치를 기계적으로 알린다 (읽기 전용 도구)
`npm run edge:drift`: Supabase Management API에서 배포 목록(버전·시각)을 **GET으로만** 읽고, 함수별 로컬 의존 파일의 마지막 커밋 시각·미커밋 여부와 비교해 `ok / stale / not_deployed / uncommitted / remote_only`를 출력한다. 문제가 있으면 종료 코드 1. **배포는 하지 않는다.** `docs/development_next_steps.md`에 "Edge Function을 바꾼 작업은 끝에 `edge:drift`를 돌리고, stale 목록을 사람에게 보고한다"를 절차로 추가한다.

### D-6. 검색 회귀 골든셋
`npm run search:golden`: 저장소의 TMDB 어댑터·검색어 변형·병합 로직을 실제 TMDB에 돌려(읽기 전용) 아래 기대를 검사한다. 네트워크가 필요하므로 `npm test`에는 넣지 않는다. 판정 로직은 순수 함수로 두고 `npm test`로 검증한다.

| 검색어 | 반드시 포함 |
|--------|------------|
| 재벌X형사 | 220074 시즌 1, 220074 시즌 2 |
| 결혼 못하는 | 13372 시즌 1, 13372 시즌 2, 31618 |
| 고독한 미식가 | 55582 (content_type `jdrama`) |
| 중쇄를 찍자 | 67504 (`jdrama`) |
| 진격의 거인 | 1429 시즌 4, 표시 제목에 "진격의 거인" |
| 귀멸의 칼날 | 85937 시즌 5, 표시 제목에 "귀멸의 칼날" |
| 브레이킹 배드 | 1396 |
| 기생충 | 496243 (`movie`) |
| 파묘 | 838209 (`movie`) |
| 랑야방 | 64197 |
| 눈물의 여왕 | 215720 (`kdrama`) |
| 셜록 | 19885 |

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

---

## 4. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| 제목 검색에서 저장 필터를 아예 무시 | 사용자가 의도적으로 "애니만" 등으로 좁히는 경우를 없앤다. 숨긴 개수를 보여주고 한 번에 풀 수 있게 하는 편이 낫다 |
| 추천 필터와 검색 필터 상태를 분리 | 필터 시트·저장 구조(`profiles.search_filters`) 전체를 다시 설계해야 한다. D-1·D-2로 누락 체감을 없앤 뒤 필요하면 별도 검토 |
| 서버가 필터 밖 결과를 계속 버리고 개수만 반환 | "모두 보기"를 누르면 다시 요청해야 하고, 같은 캐시 원본을 두 번 가공한다 |
| 시즌 카드 `title_primary`에 시리즈명을 합쳐 저장 | `docs/17` 결정과 기존 테스트(시즌명 단독)를 바꾸고 라이브러리 제목까지 영향. 표시만 바꾼다 |
| 배포 스크립트가 stale 함수를 자동 배포 | 운영 변경은 사람이 승인한다(AGENTS). 도구는 알려주기만 한다 |
| 드리프트를 함수 코드 해시로 비교(원격 소스 다운로드) | 번들 형태가 달라 비교가 불안정. 배포 시각 vs 커밋 시각이 단순하고 충분히 보수적 |

---

## 5. 계약

### 5.1 서버 — `search-content`
- `adapters/types.ts` `SearchResult`에 `filter_match?: boolean; series_title?: string | null;`
- `adapters/normalize.ts`에 추가·이동:
  ```ts
  export function searchResultIdentity(result: Pick<SearchResult, "external_source" | "external_id" | "season_number">): string;
  // `${external_source}:${external_id}:${season_number ?? "whole"}`
  export function annotateFilterMatches(all: readonly SearchResult[], matched: readonly SearchResult[], hasFilters: boolean): { results: SearchResult[]; filteredOutCount: number };
  // hasFilters false → { results: all(그대로), filteredOutCount: 0 }
  // true → all 순서 유지. matched에 같은 identity가 있으면 matched 쪽 객체(보강된 genres·origin_country)에 filter_match: true,
  //        없으면 원본에 filter_match: false. filteredOutCount = false 개수
  export function filterResponseForVariant(response: AdapterSearchResponse, variant: SearchQueryVariant): AdapterSearchResponse;
  // index.ts의 기존 함수를 그대로 이동(동작 불변). index.ts는 import해서 사용
  ```
- `index.ts` 검색어 모드:
  1. `fetchMediaType = "all"`. `targetSources = getTargetSources("all")`(유형 필터로 소스를 줄이는 기존 `.filter(...)` 제거). `createQueryHash`·`callAdapter`에 `fetchMediaType` 사용.
  2. 레거시 `media_type`만 오고 `mediaTypes`가 없으면 필터에 합친다: `filters.mediaTypes`가 비었고 `mediaType !== "all"`이면 `[mediaType]`.
  3. `filtered = await filterSearchResultsByDiscovery(unfilteredResults, filters, …)`(기존) → `annotateFilterMatches(unfilteredResults, filtered.results, hasFilters)`.
  4. 응답 `results` = 주석 단 전체, `filtered_out_count` 추가. 나머지 필드·`partial`·limited 플래그 의미 유지.
  5. 둘러보기 모드(`respondWithCountryBrowse`)는 **변경 없음**.
- `SEARCH_CACHE_VERSION` → `"ko-v14-unfiltered-query"` (캐시 키의 media_type 부분이 바뀌므로 명시적으로 올린다).

### 5.2 서버 — 분류·시즌 표시 (`adapters/tmdb.ts`)
- `isLikelyAnime(item)`: ① `hasTmdbAnimationGenreIds(genre_ids)` → true ② 제목 4종을 합친 소문자 문자열에 `/\banime\b|\banimation\b|アニメ/` → true ③ `origin_country`에 JP이고 기존 `animeTitleHints` 중 하나를 제목 문자열이 포함 → true ④ 그 외 false. **overview는 읽지 않는다.**
- `normalizeTmdbItem`을 `export`한다(테스트용, 동작 외 변경 없음).
- `expandAiredSeasons`, `applyTmdbSeasonMetadata`: 의미 있는 시즌명을 제목으로 쓸 때, `compactSearchText(시즌명)`이 `compactSearchText(result.title_primary)`를 포함하지 않으면 `series_title: result.title_primary`를 추가. 합성 제목(`… 시즌 N`, `… N기`)이면 `series_title`을 넣지 않는다.

### 5.3 클라이언트
- `src/types/content.ts` `SearchResult`에 `filter_match?: boolean; series_title?: string | null;`, `SearchContentResponse`에 `filtered_out_count?: number`.
- `src/utils/searchResultTitle.ts`: `formatSearchResultTitle(result: Pick<SearchResult, "title_primary" | "series_title">): string`.
- `src/utils/searchResultVisibility.ts`:
  ```ts
  export type SearchHiddenReason = "filters" | "status" | "year";
  export function partitionSearchResults<T extends SearchResult>(
    results: readonly T[],
    input: {
      discoveryFilters: DiscoveryFilterInput;
      statusFilter: LibraryStatusFilter;
      year: number | null;
      libraryItems: readonly Pick<LibraryListItem, "statuses" | "source_api" | "source_id">[];
    }
  ): { visible: T[]; hidden: T[]; hiddenByReason: Record<SearchHiddenReason, number> };
  ```
  항목별 판정(첫 해당 사유 하나만 센다): ① `filter_match === false` 또는 `!matchesDiscoveryFilters(item, discoveryFilters)` → "filters" ② `statusFilter !== "all"`이고 라이브러리에서 `${source_api}:${source_id}` 일치 + 그 상태 포함 항목이 없으면 → "status" ③ `year`가 있고 `item.air_year !== year` → "year" ④ visible. 두 배열 모두 입력 순서 유지.
- `app/search.tsx` (제목 검색 결과에만):
  - `baseResults`의 `filterResultsByLibraryStatus`·`filterByYear`와 `activeResults`의 `matchesDiscoveryFilters` 단계를 `partitionSearchResults` 하나로 교체. 인물 결과의 `filterResultsByMediaType` 사전 필터 제거(분할이 처리, C-5). 보이는 결과는 기존처럼 `sortByYear`.
  - `showHiddenResults` 상태(기본 false). 검색어·필터(유형·장르·국가·상태·연도)가 바뀌면 false로.
  - 숨긴 게 있고 `!showHiddenResults`: 결과 목록 위 안내 `필터 조건에 맞지 않아 ${n}개를 숨겼어요.` + 버튼 `모두 보기`(최소 44pt).
  - `showHiddenResults`: 목록 = 보이는 결과 뒤에 숨긴 결과(각각 `sortByYear`). 안내 `필터 밖 결과 ${n}개를 함께 보여주고 있어요.` + 버튼 `필터 적용`.
  - 보이는 결과 0 + 숨긴 결과 > 0 + `!showHiddenResults`: 빈 상태 제목 `필터 조건에 맞는 작품이 없어요`, 설명 `검색 결과 ${n}개가 현재 필터 때문에 숨겨졌어요.`, 행동 `필터 없이 보기` → `showHiddenResults = true`.
  - 배너: 표시 조건 = 유형·장르·국가 중 하나 **또는** `statusFilter !== "all"` **또는** 연도. 요약에 `상태: ${WATCH_STATUS_LABEL[statusFilter]}`, `${year}년` 추가(해당할 때). "해제"는 `mediaTypes`·`genreFilters`·`countryFilters` 비움 + `statusFilter: "all"` + `year: ""`(정렬 유지). 접근성 라벨 `검색 필터 모두 해제 후 저장`.
  - 추천 피드·유사작 모드·둘러보기는 변경 없음.
- `SearchResultItem.tsx`, `SearchResultGalleryCard.tsx`: 제목 표시와 제목이 들어가는 접근성 라벨을 `formatSearchResultTitle(result)`로.

### 5.4 배포 불일치 도구
- `scripts/edgeDrift.ts` (순수, Node API는 주입받는다)
  ```ts
  export interface DeployedFunction { slug: string; version: number; status: string; updatedAt: number }
  export interface LocalFunction { slug: string; lastChangedAt: number | null; uncommitted: boolean }
  export type DriftStatus = "ok" | "stale" | "not_deployed" | "uncommitted" | "remote_only";
  export interface DriftRow { slug: string; status: DriftStatus; deployedVersion: number | null; deployedAt: number | null; lastChangedAt: number | null }
  export function compareEdgeDeployments(local: readonly LocalFunction[], deployed: readonly DeployedFunction[]): DriftRow[];
  export function collectLocalImports(entryPath: string, readFile: (path: string) => string | null): string[];
  export function hasDrift(rows: readonly DriftRow[]): boolean;
  ```
  - `compareEdgeDeployments`: 로컬 각 함수 — 배포 없음 → `not_deployed` / `uncommitted` true → `uncommitted` / `lastChangedAt !== null && lastChangedAt > updatedAt` → `stale` / 그 외 `ok`. 로컬에 없는 배포 함수 → `remote_only`. 결과는 `slug` 오름차순.
  - `collectLocalImports`: entry 포함, `from "./…"`/`from "../…"` 형태의 상대 `.ts` import를 재귀로 모은다. 순환 안전, `.test.ts` 제외, 읽을 수 없는 파일 무시, 절대 URL(`https://`) 무시. 경로는 정규화, 정렬해 반환.
  - `hasDrift`: `stale`·`not_deployed`·`uncommitted`가 하나라도 있으면 true.
- `scripts/check-edge-drift.ts` (CLI): `.env`/`.env.local` 로드(기존 `scripts/smoke-edge-functions.ts`의 방식과 같게), 프로젝트 ref = `SUPABASE_PROJECT_REF` 또는 `SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_URL`의 `https://<ref>.supabase.co`, 토큰 = `SUPABASE_ACCESS_TOKEN`(없으면 안내 후 종료 코드 2). `GET https://api.supabase.com/v1/projects/{ref}/functions` (Bearer). 응답 `updated_at`은 epoch ms. 로컬 함수 = `supabase/functions/*/index.ts`(`_`로 시작하는 폴더 제외). 파일별 `git log -1 --format=%ct -- <files>`(초→ms), `git status --porcelain -- <files>`. 표 출력(slug·상태·운영 버전·배포 시각·코드 변경 시각, KST). `hasDrift`면 종료 코드 1. **토큰·키를 출력하지 않는다. GET 외 요청 금지.**
- `package.json`: `"edge:drift": "tsx scripts/check-edge-drift.ts"`.

### 5.5 검색 골든셋
- `scripts/searchGolden.ts` (순수)
  ```ts
  export interface GoldenExpectation {
    query: string;
    mustInclude: { externalId: string; seasonNumber?: number | null; contentType?: string; displayTitleIncludes?: string }[];
  }
  export const SEARCH_GOLDEN_CASES: readonly GoldenExpectation[]; // D-6 표 12행 그대로
  export function evaluateGoldenCase(
    results: readonly Pick<SearchResult, "external_id" | "season_number" | "content_type" | "title_primary" | "series_title">[],
    expectation: GoldenExpectation
  ): { ok: boolean; failures: string[] };
  ```
  기대 항목별로 `external_id` 일치 **그리고** (`seasonNumber === undefined` → 무관 / `null` → `season_number == null` / 숫자 → 같음) 인 결과를 찾는다. 없으면 실패 `` `${query}: ${externalId}${season ? ` S${season}` : ""} 없음` ``. 찾았는데 `contentType`이 다르면 실패 `` `… content_type ${실제} ≠ ${기대}` ``. `displayTitleIncludes`가 `formatSearchResultTitle(결과)`에 없으면 실패 `` `… 제목 "${표시}"에 "${기대}" 없음` ``.
- `scripts/search-golden.ts` (CLI, 읽기 전용): `.env` 로드, `globalThis.Deno = { env: { get } }` 심을 **동적 import 전에** 설정, 각 케이스마다 `createSearchQueryVariants(query)` → 변형별 `searchTmdb({ query: v.query, mediaType: "all", page: 1, signal })` → `filterResponseForVariant` → 합쳐서 `compactResults` → `evaluateGoldenCase`. 요약 출력, 실패 있으면 종료 코드 1. TMDB 키 출력 금지.
- `package.json`: `"search:golden": "tsx scripts/search-golden.ts"`.

---

## 6. 엣지 케이스

| # | 상황 | 기대 |
|---|------|------|
| E-1 | 저장된 연도 2024, "결혼 못하는" 검색 | 보이는 결과 0(또는 2024만), "필터 조건에 맞지 않아 N개를 숨겼어요 · 모두 보기" |
| E-2 | 저장된 상태 "보는 중" | 라이브러리에 없는 작품은 숨김으로 집계, 배너에 "상태: 보는 중" |
| E-3 | 유형 "드라마" 저장, "기생충" 검색 | 영화는 숨김으로 집계(`filter_match: false`), 모두 보기로 표시 |
| E-4 | 필터 없음 | `filter_match` 없음, 안내 없음, 현재와 동일 |
| E-5 | 국가 필터 + 제작국가 조회 한도 초과 영화 | `filter_match: false`로 숨김 집계 + 기존 "제작 국가를 확인하지 못했어요" 안내 유지 |
| E-6 | "해제" | 유형·장르·국가·상태·연도 모두 해제, 정렬 유지 |
| E-7 | 고독한 미식가(줄거리에 "만화") | `jdrama` |
| E-8 | 장르 16 없는 일본 작품, 원제에 "アニメ" | `anime` |
| E-9 | 한국 작품 제목 "애니멀…" | `kdrama` |
| E-10 | 진격의 거인 S4 카드 | 표시 "진격의 거인 시즌 4 (The Final Season)", 저장 제목은 기존대로 |
| E-11 | 시즌명이 시리즈명을 포함("재벌X형사 2") | `series_title` 없음 |
| E-12 | 추천 피드·둘러보기 | 변경 없음 |
| E-13 | `SUPABASE_ACCESS_TOKEN` 없음 | `edge:drift`가 안내 후 종료 코드 2, 네트워크 호출 없음 |
| E-14 | 로컬 미커밋 변경이 있는 함수 | `uncommitted`, 종료 코드 1 |

---

## 7. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.**

### `supabase/functions/search-content/adapters/normalize.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| A-1 | `annotateFilterMatches([a,b,c], [b'], true)` (b'는 b와 같은 identity, `origin_country: ["KR"]` 보강) | 결과 순서 [a,b',c], filter_match [false,true,false], b'의 origin_country 유지, filteredOutCount 2 |
| A-2 | 같은 입력, `hasFilters` false | 입력 그대로(같은 순서, `filter_match` 속성 없음), filteredOutCount 0 |
| A-3 | 같은 작품 시즌 1·2가 all에, matched에 시즌 2만 | 시즌 1 false, 시즌 2 true (identity에 시즌 포함) |
| A-4 | `searchResultIdentity({tmdb,"1",season null})` / `(…, 2)` | `"tmdb:1:whole"` / `"tmdb:1:2"` |
| N-1 | `filterResponseForVariant(응답, { matchMode: "direct", … })` | 응답 그대로 |
| N-2 | compact-title 변형, 제목 불일치 결과 포함 | 불일치 제거, `total` = 남은 수 |

### `supabase/functions/search-content/adapters/tmdb.test.ts` (추가)
| ID | 입력 (`normalizeTmdbItem(item, "all")`) | 기대 content_type |
|----|------|------|
| K-1 | JP, genre_ids [18], name "고독한 미식가", overview "만화를 원작으로 한…" | `jdrama` |
| K-2 | JP, genre_ids [16, 18] | `anime` |
| K-3 | JP, genre_ids [18], original_name "テレビアニメ テスト" | `anime` |
| K-4 | KR, genre_ids [10764], name "애니멀 킹덤" | `kdrama` |
| K-5 | JP, genre_ids [18], name "황천의 츠가이" (힌트 목록) | `anime` |
| S-1 | `expandAiredSeasons(base "진격의 거인", 시즌 3·4 방영, 시즌 4 name "시즌 4 (The Final Season)")` | S4 카드 `title_primary` "시즌 4 (The Final Season)", `series_title` "진격의 거인" |
| S-2 | 시즌 2 name "재벌X형사 2", base "재벌X형사" | `series_title` 없음 |
| S-3 | 합성 제목(시즌명 "시즌 2") | `series_title` 없음 |
| S-4 | `applyTmdbSeasonMetadata(base "촌구석 아저씨, 검성이 되다", 시즌 2 "검성의 귀환", 2)` | `title_primary` "검성의 귀환"(기존 테스트와 동일), `series_title` "촌구석 아저씨, 검성이 되다" |
기존 "prefers a meaningful Korean season title", "prefers a meaningful season name over the synthesized one" 등은 **수정 없이** 통과해야 한다.

### `src/utils/searchResultVisibility.test.ts` (신규)
| ID | 입력 | 기대 |
|----|------|------|
| V-1 | 필터 없음, 결과 3 | visible 3, hidden 0 |
| V-2 | `filter_match: false` 1개 | hidden 1, hiddenByReason.filters 1 |
| V-3 | discoveryFilters mediaTypes ["drama"], 영화 1·kdrama 1 (filter_match 없음) | 영화 hidden(filters) |
| V-4 | statusFilter "watching", 라이브러리에 watching인 tmdb:1만 | tmdb:1 visible, 나머지 hidden(status) |
| V-5 | year 2024, air_year 2024·2019·null | 2024만 visible, 나머지 hidden(year) |
| V-6 | filter_match false이면서 연도도 불일치 | 사유 "filters" 하나만 집계 |
| V-7 | 순서 | visible·hidden 모두 입력 순서 유지 |
| V-8 | 해외 드라마 `content_type: "other"`, `has_seasons: true`, mediaTypes ["drama"] | visible (C-5) |

### `src/utils/searchResultTitle.test.ts` (신규)
| ID | 입력 | 기대 |
|----|------|------|
| F-1 | title "4기: 합동 강화 훈련편", series "귀멸의 칼날" | "귀멸의 칼날 4기: 합동 강화 훈련편" |
| F-2 | series 없음/null | title_primary 그대로 |

### `scripts/edgeDrift.test.ts` (신규)
| ID | 입력 | 기대 |
|----|------|------|
| D-1 | local lastChangedAt 200, deployed updatedAt 100 | stale |
| D-2 | 100 vs 200 | ok |
| D-3 | 배포 없음 | not_deployed |
| D-4 | uncommitted true, 배포는 최신 | uncommitted |
| D-5 | 배포에만 있는 slug | remote_only |
| D-6 | 여러 slug | slug 오름차순 |
| D-7 | lastChangedAt null, 배포 있음 | ok |
| D-8 | `hasDrift([ok, remote_only])` / `([ok, stale])` | false / true |
| D-9 | `collectLocalImports`: index → ../_shared/a.ts → ./b.ts, b → a(순환) | [index, a, b] 정규화·정렬, 무한루프 없음 |
| D-10 | import에 `https://esm.sh/x`, `./c.test.ts`, 없는 파일 `./missing.ts` | 모두 제외 |

### `scripts/searchGolden.test.ts` (신규)
| ID | 입력 | 기대 |
|----|------|------|
| G-1 | 기대 220074 S1·S2, 결과에 둘 다 | ok |
| G-2 | 결과에 S2만 | 실패 1, 메시지에 "220074 S1 없음" |
| G-3 | 기대 55582 `jdrama`, 결과 `anime` | 실패, "content_type anime ≠ jdrama" |
| G-4 | 기대 1429 S4 displayTitleIncludes "진격의 거인", 결과 title "시즌 4 (…)" + series_title "진격의 거인" | ok |
| G-5 | seasonNumber null 기대, 결과는 시즌 카드뿐 | 실패 |
| G-6 | `SEARCH_GOLDEN_CASES` | 12개, D-6 표와 query·id 일치 |

### 수동 확인
| ID | 절차 | 기대 |
|----|------|------|
| M-1 | `npm run edge:drift` | 2절 표와 같은 stale 목록, 종료 코드 1 |
| M-2 | `npm run search:golden` (배포와 무관, 저장소 코드) | 12/12 통과 |
| M-3 | (배포 후) 연도 필터를 저장한 계정에서 "결혼 못하는" 검색 | 숨김 안내 + 모두 보기로 3장 |
| M-4 | (배포 후) 배너 "해제" | 상태·연도까지 해제 |
| M-5 | (배포 후) "고독한 미식가"를 유형 "드라마"로 검색 | 표시됨 |

---

## 8. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `supabase/functions/search-content/adapters/types.ts` | 필드 2개 |
| `supabase/functions/search-content/adapters/normalize.ts` (+test) | identity·annotate 추가, `filterResponseForVariant` 이동 |
| `supabase/functions/search-content/adapters/tmdb.ts` (+test) | `isLikelyAnime`, `normalizeTmdbItem` export, `series_title` |
| `supabase/functions/search-content/index.ts` | 5.1 (검색어 모드만) |
| `src/types/content.ts` | 필드 3개 |
| `src/utils/searchResultVisibility.ts` (+test) | 신규 |
| `src/utils/searchResultTitle.ts` (+test) | 신규 |
| `app/search.tsx` | 5.3 |
| `src/components/content/SearchResultItem.tsx` | 표시 제목 |
| `src/components/content/SearchResultGalleryCard.tsx` | 표시 제목 |
| `scripts/edgeDrift.ts` (+test), `scripts/check-edge-drift.ts` | 신규 |
| `scripts/searchGolden.ts` (+test), `scripts/search-golden.ts` | 신규 |
| `package.json` | 스크립트 2개 |
| `docs/development_next_steps.md` | 배포 동기화 절차 한 절 추가(기존 미커밋 내용 보존) |

## 9. 범위 밖

| 항목 | 이유 |
|------|------|
| 실제 배포 | 사람이 승인 후 수행. 도구는 알려주기만 한다 |
| 추천 피드·둘러보기의 필터 동작 | D-1 범위는 제목 검색 |
| 추천/검색 필터 상태 분리 | 4절 |
| AniList 검색 품질 | 이번 실측은 TMDB. 골든셋은 TMDB 경로만 |
| 1글자 검색(최소 2자 제한) | 누락 원인으로 확인되지 않음 |

## 10. 확실하지 않음

1. **Management API 응답 형식.** 2026-09-29 실측에서 `GET /v1/projects/{ref}/functions`가 `slug`, `version`, `status`, `updated_at`(epoch ms), `verify_jwt`를 반환했다. 형식이 바뀌면 스크립트가 명확한 오류로 끝나야 한다.
2. **커밋 시각 기준의 보수성.** 공용 파일 변경이 실제로 그 함수 동작을 바꾸지 않아도 `stale`로 나온다. 재배포 비용이 낮아 보수적 판정을 택했다.
3. **검색 호출량.** 유형 필터가 있어도 항상 `all`로 호출하므로 "영화"만 고른 사용자의 TMDB 호출이 `search/movie`에서 `search/multi`로 바뀌고 AniList 호출이 더해진다. 캐시(1시간)로 상쇄된다고 판단했지만 응답 시간을 M-3에서 본다.
4. **"결혼 못하는" 외 누락 사례.** 사용자가 겪은 개별 작품명을 모두 받지 못했다. 골든셋에 사례를 계속 추가한다.
