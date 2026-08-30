> 이 파일 **전체를 복사해서 Codex 첫 메시지로 붙여넣으세요.**

# ROLE & GOAL

너는 SceneNote(React Native + Expo / TypeScript strict / Supabase Edge Functions(Deno)) 리포지토리에서 작업하는 구현 담당이다.

**목표:** 한국어 시즌 표기(`N기`, `시즌 N`, `N期`)로 후속 시즌을 검색할 수 있게 만든다. 대표 케이스는 `촌구석 아저씨, 검성이 되다 2기`(2026년 3분기 방영 중)이며, 현재 검색 결과가 0건이거나 1기만 나온다.

# READ FIRST

- `docs/15_season_search_spec.md` — 본 작업의 명세서. 실측 데이터·설계 결정·기각안·엣지 케이스·테스트 표가 모두 여기 있다. **반드시 먼저 읽어라.**
- `AGENTS.md` — 리포 공통 규칙
- `CLAUDE.md` — 아키텍처 원칙

# 시작 상태 (반드시 유지)

```
npx tsc --noEmit        # 통과
npm test                # 182개 전부 통과
npx eslint .            # 통과
npx expo export --platform web   # 통과
```

기존 182개 중 **하나도 깨뜨리지 마라.**

# 실측 근거 (2026-08-30 확인, 이 값을 골든 데이터로 써라)

AniList:
- `179955` = 1기 `Katainaka no Ossan, Kensei ni Naru`, 2025-04, 한국어 synonym `촌구석 아저씨, 검성이 되다` **있음**
- `194829` = 2기 `Katainaka no Ossan, Kensei ni Naru II`, 2026-07, 한국어 synonym **없음(빈 배열)**
- `Media(179955).relations` 의 `SEQUEL` 엣지 → `194829`
- 검색 `"촌구석 아저씨, 검성이 되다 2기"` → **0건**
- 앱이 만드는 5개 변형 중 결과가 나오는 것은 `촌구석` 하나뿐이고 그것도 `179955`만 반환

TMDB:
- show `260823`, 한국어 name `촌구석 아저씨, 검성이 되다`, `seasons`: season 1(2025-04-05, 12화) / season 2(**2026-07-08, 12화**)
- 즉 TMDB는 시즌을 **하나의 show 안 season**으로, AniList는 **별개 작품**으로 모델링한다

# 바꾸면 안 되는 설계 결정

1. `filterResultsByCompactQuery`의 기존 임계값·양방향 부분일치 로직을 **전역 완화하지 마라.** 무관한 결과가 대량 유입된다. 통과 경로만 추가한다.
2. AniList 2기를 1기 콘텐츠의 `season` 행으로 흡수하지 마라. 별개 `contents` 행으로 두는 현행 동작을 유지한다.
3. 제목 별칭을 하드코딩한 테이블을 만들지 마라.
4. 새 테이블·마이그레이션을 만들지 마라. 이 작업에 DB 스키마 변경은 없다.
5. 외부 API 키를 클라이언트로 내보내지 마라. 모든 외부 호출은 Edge Function 안에서만 한다.

# STEP별 작업 순서

각 STEP마다 **재현 테스트를 먼저 작성해 실패를 확인한 뒤** 구현해라. 러너는 `tsx --test` (node:test + node:assert), `describe`/`it`/`assert` 사용.

## STEP 1 — 시즌 토큰 파서

`supabase/functions/search-content/adapters/normalize.ts`에 추가:

```ts
export interface SeasonQuery {
  baseQuery: string;
  seasonNumber: number;
}

export function parseSeasonQuery(query: string): SeasonQuery | null;
```

판정 순서:
1. 문자열 **끝에서만** 매칭. 패턴: `N기`, `시즌N`, `시즌 N`, `N期`
2. `seasonNumber`는 **2~9만** 인정. 그 밖(0,1,10 이상)은 `null`
3. 토큰 제거 후 남은 `baseQuery`를 trim. **2자 미만이면 `null`**

테스트 (`adapters/normalize.test.ts`):

| 입력 | 기대 |
|---|---|
| `촌구석 아저씨, 검성이 되다 2기` | `{ baseQuery: "촌구석 아저씨, 검성이 되다", seasonNumber: 2 }` |
| `제목 시즌 3` | `seasonNumber: 3` |
| `제목 시즌3` | `seasonNumber: 3` |
| `제목 2期` | `seasonNumber: 2` |
| `제목 1기` | `null` |
| `2기` | `null` |
| `제목 10기` | `null` |

## STEP 2 — AniList 쿼리에 synonyms + relations 추가

`supabase/functions/search-content/adapters/anilist.ts`의 `ANILIST_SEARCH_QUERY`에 추가:

```graphql
synonyms
relations {
  edges {
    relationType
    node { id type format startDate { year month day } title { romaji english native } synonyms }
  }
}
```

**1회 호출로 base + synonyms + SEQUEL 체인이 모두 오는 것을 실측 확인했다. 추가 호출(N+1)을 만들지 마라.** `perPage`는 현행 20 유지.

TypeScript 인터페이스(`AniListMedia`)도 함께 확장해라.

## STEP 3 — SEQUEL 체인 해석

`anilist.ts`에 추가:

```ts
export function resolveSeasonFromRelations(
  base: AniListMedia,
  seasonNumber: number
): AniListMedia | null;
```

판정 순서:
1. `seasonNumber - 1` 회 반복해 `SEQUEL` 엣지를 따라간다
2. `node.type === "ANIME"` 이고 `node.format`이 `TV` | `TV_SHORT` | `ONA` 인 엣지만 따른다 (극장판·OVA는 건너뛴다)
3. `SEQUEL` 엣지가 복수면 `startDate` 오름차순 중 **현재 노드보다 뒤인 첫 번째**를 택한다
4. 방문한 `id`를 `Set`에 넣어 **순환을 차단**한다
5. 도중에 체인이 끊기면 `null`을 반환한다 (오류를 던지지 마라)

호출 지점: `searchAniList`에서 `parseSeasonQuery`가 non-null이면 **`baseQuery`로 검색**하고, 상위 **3건**에 대해 `resolveSeasonFromRelations`를 시도한다. 성공한 노드를 결과로 승격한다.

테스트 (고정 픽스처, 네트워크 호출 금지):

| 시나리오 | 기대 |
|---|---|
| base `179955`, `SEQUEL → 194829`, N=2 | `194829` |
| 위와 동일, N=3 | `null` |
| `SEQUEL → MOVIE` 뒤 `SEQUEL → TV`, N=2 | TV 노드 |
| `A → B → A` 순환, N=3 | `null`, 무한 루프 없음 |

## STEP 4 — 매칭 후보 확장 (가장 중요)

`adapters/types.ts`의 `SearchResult`에 선택 필드를 추가한다:

```ts
match_titles?: string[];
matched_via?: "direct" | "season_relation";
season_number?: number;
title_is_synthesized?: boolean;
```

`normalize.ts`의 `filterResultsByCompactQuery`를 수정:
- `matched_via === "season_relation"` 인 결과는 **무조건 통과**
- 그 외에는 기존 `title_primary`/`title_original` **에 더해 `match_titles`도** 검사 (기존 양방향 부분일치 규칙 그대로)

`match_titles`에는 다음을 담는다:
- 해당 엔트리의 `synonyms` 전부
- base 엔트리의 한국어 synonym에 시즌 토큰을 붙인 문자열 (예: `촌구석 아저씨, 검성이 되다 2기`)

**이 STEP이 없으면 2기를 찾아내도 필터에서 탈락한다.** 2기 제목은 romaji/english뿐이라 `촌구석아저씨검성이되다2기`와 양방향 부분일치가 모두 실패한다.

회귀 테스트:

| 결과 | compactQuery | 기대 |
|---|---|---|
| `title_primary: "Katainaka no Ossan, Kensei ni Naru II"`, `matched_via: "season_relation"` | `촌구석아저씨검성이되다2기` | **통과** |
| 동일하되 `matched_via: "direct"`, `match_titles: ["촌구석 아저씨, 검성이 되다 2기"]` | 동일 | **통과** |
| 무관한 작품, `match_titles` 없음 | 동일 | 탈락 |

## STEP 5 — 표시 제목

우선순위대로 최초 성공값:
1. 제공자가 준 해당 시즌의 한국어 제목
2. `{base 한국어 제목} {N}기` 합성 → 이때 `title_is_synthesized: true`
3. romaji/english 원제

기존 `enrichWithTmdbKorean` 경로를 지우지 말고, 그 결과가 없을 때의 폴백으로 2번을 넣어라.

## STEP 6 — TMDB 시즌 인지

`adapters/tmdb.ts`: `seasonNumber`가 있으면 `baseQuery`로 show를 검색하고, 응답 show의 `seasons`에 `season_number === N`이 있으면 그 시즌의 `air_date`/`episode_count`를 결과에 반영한다. **show를 별도 콘텐츠로 쪼개지 마라.**

## STEP 7 — 캐시 버전 갱신 (누락 주의)

`supabase/functions/search-content/index.ts`의 `SEARCH_CACHE_VERSION`을 현재 `ko-v6-anilist-korean-title`에서 **반드시 올려라** (예: `ko-v7-season-resolution`).

올리지 않으면 `external_search_cache`에 남은 **빈 결과가 그대로 서빙되어 수정이 전혀 보이지 않는다.**

# 엣지 케이스 (전부 처리)

| # | 상황 | 기대 |
|---|---|---|
| E-1 | `... 1기` | base 취급 |
| E-2 | `... 5기` (체인 없음) | 오류 없이 base 결과만 |
| E-3 | 질의가 `2기` 뿐 | 일반 질의로 처리 |
| E-4 | `SEQUEL`이 극장판/OVA | 건너뛰고 TV/TV_SHORT/ONA만 추적 |
| E-5 | 관계 그래프 순환 | 방문 Set으로 차단 |
| E-6 | AniList 오류/타임아웃 | 기존 `failedSources` 경로, TMDB 결과는 살린다 |
| E-7 | base 한국어 제목 부재 | 원제로 폴백 |
| E-8 | 해석 결과가 base와 같은 id | 중복 제거 후 1건 |
| E-9 | 미방영 시즌 | 그대로 노출, 방영 여부로 거르지 않는다 |

# 검증 명령

```
npx tsc --noEmit
npm test
npx eslint .
npx expo export --platform web
```

# DEFINITION OF DONE

- 위 4개 명령 전부 통과, 기존 182개 테스트 유지
- STEP 1·3·4에 회귀 테스트 추가
- `parseSeasonQuery`, `resolveSeasonFromRelations`, `filterResultsByCompactQuery` 각각에 대한 단위 테스트가 위 표를 모두 커버
- `SEARCH_CACHE_VERSION`이 갱신되어 있음

# 변경 예상 파일

```
supabase/functions/search-content/adapters/normalize.ts
supabase/functions/search-content/adapters/normalize.test.ts
supabase/functions/search-content/adapters/anilist.ts
supabase/functions/search-content/adapters/tmdb.ts
supabase/functions/search-content/adapters/types.ts
supabase/functions/search-content/index.ts
```

새 테스트 파일이 필요하면 `supabase/functions/search-content/adapters/` 아래에 `*.test.ts`로 만든다.

# 보고 항목

1. STEP별로 무엇을 어떻게 구현했는지
2. 어떤 테스트가 각 STEP을 커버하는지
3. `resolveSeasonFromRelations`에서 복수 `SEQUEL` 엣지 처리와 순환 차단을 어떻게 구현했는지
4. 표시 제목 3순위 폴백 중 이 케이스에서 실제로 어떤 것이 쓰이는지
5. 명세서 10장의 "확실하지 않음" 항목에 대해 구현 중 새로 알게 된 사실이 있으면 기록

# 금지사항

- `filterResultsByCompactQuery` 임계값 전역 완화 금지
- 제목 별칭 하드코딩 테이블 생성 금지
- 새 DB 테이블·마이그레이션 생성 금지
- AniList 검색 1건당 추가 GraphQL 호출(N+1) 금지
- 커밋 금지. 워킹 트리에만 반영
- 기존 테스트 삭제·비활성화 금지
