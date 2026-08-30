# 15. 시즌(N기) 검색 명세서

작성일: 2026-08-30 · 대상: `search-content` Edge Function + 검색 어댑터

## 1. 문제 정의

한국어 시즌 표기로 후속 시즌을 검색하면 결과가 나오지 않는다.

**재현 케이스:** `촌구석 아저씨, 검성이 되다 2기` (2026년 3분기 방영 중) → 검색 결과 없음 또는 1기만 노출.

## 2. 근거 — 실측 데이터 (2026-08-30 측정)

### 2.1 AniList

| 항목 | id | 제목 | 시작 | 한국어 synonym |
|---|---|---|---|---|
| 1기 | `179955` | Katainaka no Ossan, Kensei ni Naru | 2025-04 | `촌구석 아저씨, 검성이 되다` |
| 2기 | `194829` | Katainaka no Ossan, Kensei ni Naru II | 2026-07 | **없음 (빈 배열)** |

AniList는 시즌을 **별개 작품**으로 모델링한다. 2기 엔트리는 존재하지만 한국어 synonym이 하나도 없다.

### 2.2 앱이 생성하는 질의 변형별 결과

`createSearchQueryVariants("촌구석 아저씨, 검성이 되다 2기")`가 만드는 5개 변형을 AniList에 그대로 던진 결과:

| 변형 | matchMode | 결과 |
|---|---|---|
| `촌구석 아저씨, 검성이 되다 2기` | direct | **0건** |
| `촌구석아저씨검성이되다2기` | direct | **0건** |
| `촌구석아저씨검성이 되다2기` | direct | **0건** |
| `촌구석아저씨검성이` | compact-title | **0건** |
| `촌구석` | compact-title | 1건 — **`179955`(1기)만** |

### 2.3 TMDB

TMDB는 정반대로 **하나의 show 안 season**으로 모델링한다.

| show id | 한국어 name | 시즌 |
|---|---|---|
| `260823` | `촌구석 아저씨, 검성이 되다` | season 1 (2025-04-05, 12화) / season 2 (**2026-07-08, 12화**) |

`in_production: true`, `last_air_date: 2026-08-19` — 방영 중이 맞다.

### 2.4 해결 경로 존재 확인

`Media(179955).relations` 의 `SEQUEL` 엣지가 정확히 `194829`를 가리킨다. **검색 쿼리 안에 `relations`를 함께 담아 1회 호출로 획득 가능함을 실측 확인했다** (N+1 없음).

## 3. 근본 원인

| ID | 원인 | 영향 |
|---|---|---|
| RC-1 | AniList GraphQL 쿼리가 `synonyms`를 **요청하지 않음** | 한국어 제목 매칭이 구조적으로 불가 |
| RC-2 | 2기 엔트리에 한국어 synonym이 없음 (업스트림 데이터) | 어떤 한국어 질의로도 직접 도달 불가 |
| RC-3 | `기`/`시즌` 등 한국어 시즌 토큰 정규화 없음 | `2기` ↔ `II` / `Season 2` 연결 불가 |
| RC-4 | `filterResultsByCompactQuery`가 `title_primary`/`title_original`만 검사 | 2기를 찾아내도 **결과에서 탈락** |
| RC-5 | TMDB 어댑터가 show만 검색, season 미인지 | TMDB 경로로도 2기 도달 불가 |

RC-4가 특히 중요하다. RC-1~3을 고쳐 2기를 찾아내도, 2기의 제목은 romaji/english뿐이라 `촌구석아저씨검성이되다2기`와 양방향 부분일치가 모두 실패해 필터에서 버려진다.

## 4. 설계 결정

### D-1. 한국어 시즌 토큰 파싱

```ts
interface SeasonQuery { baseQuery: string; seasonNumber: number; }
function parseSeasonQuery(query: string): SeasonQuery | null;
```

- **문자열 끝에서만** 매칭한다. 패턴: `N기`, `시즌N`, `시즌 N`, `N期`
- `seasonNumber`는 `2`~`9`만 인정. `1기`는 base 취급(`null` 반환)
- 토큰을 떼고 남은 `baseQuery`가 2자 미만이면 `null` (질의가 `2기`뿐인 경우)
- **범위 밖:** `파트`/`part`, `쿨`, 영문 `Season N` — 4장 기각안 참조

### D-2. AniList — synonyms 요청 + SEQUEL 체인 해석

1. 검색 쿼리에 `synonyms`와 `relations{edges{relationType node{...}}}`를 추가한다.
2. `parseSeasonQuery`가 `seasonNumber = N`을 반환하면 **`baseQuery`로 검색**한다 (이것이 1기에 매칭되는 유일한 경로).
3. 상위 3건에 대해 `SEQUEL` 엣지를 `N-1`회 따라간다.
   - `node.type === "ANIME"` 이고 `format`이 `TV`/`TV_SHORT`/`ONA`인 엣지만 따른다 (극장판·OVA 건너뜀)
   - `SEQUEL` 엣지가 복수면 `startDate` 오름차순 중 현재 노드보다 뒤인 첫 번째를 택한다
   - 방문한 id를 `Set`으로 관리해 **순환을 차단**한다
   - 체인이 도중에 끊기면 해석 실패로 두고 base 결과를 그대로 반환한다
4. 해석에 성공한 노드를 결과로 승격하고 `matched_via: "season_relation"`, `resolved_from_id`, `season_number`를 남긴다.

### D-3. 매칭 후보 확장 (RC-4 해소)

`SearchResult`에 매칭 전용 필드를 추가한다.

```ts
match_titles?: string[];   // synonyms + 해석 출발점(base)의 한국어 제목
matched_via?: "direct" | "season_relation";
```

`filterResultsByCompactQuery`는
- `matched_via === "season_relation"`인 결과를 **무조건 통과**시키고,
- 그 외에는 기존 `title_primary`/`title_original`에 더해 `match_titles`까지 검사한다.

`match_titles`에는 base의 한국어 synonym에 시즌 토큰을 붙인 문자열(`촌구석 아저씨, 검성이 되다 2기`)도 넣어 사용자의 원 질의와 직접 일치하게 한다.

### D-4. TMDB — 시즌 인지

`seasonNumber = N`이면 `baseQuery`로 show를 검색하고, 응답 show의 `seasons`에 `season_number === N`이 있으면 그 시즌의 `air_date`/`episode_count`를 결과에 반영한다. **show를 별도 콘텐츠로 쪼개지 않는다** — TMDB의 시즌 모델과 앱의 `seasons` 테이블이 이미 대응하기 때문이다.

### D-5. 표시 제목

우선순위대로 최초 성공값을 쓴다.

1. 제공자가 준 해당 시즌의 한국어 제목
2. `{base 한국어 제목} {N}기` 합성 — 이때 `title_is_synthesized: true`
3. romaji/english 원제

2번을 쓴 결과는 UI에서 별도 강조 없이 그대로 노출하되, 상세 진입 시 원제를 함께 보여준다.

### D-6. 캐시 버전 갱신 — **누락 주의**

`search-content/index.ts`의 `SEARCH_CACHE_VERSION`(현재 `ko-v6-anilist-korean-title`)을 반드시 올린다. 올리지 않으면 `external_search_cache`에 남은 **빈 결과가 그대로 서빙되어 수정이 보이지 않는다.**

## 5. 기각한 대안

| 대안 | 기각 사유 |
|---|---|
| AniList에 한국어 synonym을 직접 등록 | 외부 커뮤니티 DB. 통제 불가하고 다른 작품에 일반화되지 않는다 |
| 제목 별칭 테이블을 앱에 하드코딩 | 작품마다 수작업. 신작마다 배포가 필요해 확장 불가 |
| `filterResultsByCompactQuery` 임계값을 전역 완화 | 무관한 결과가 대량 유입된다. 필터는 이 기능의 방어선이라 유지한다 |
| 2기를 1기 콘텐츠의 `season` 행으로만 취급 | AniList는 시즌을 별개 작품으로 두고 화수도 1부터 재시작한다. 핀 타임라인이 시즌별로 어긋난다 |
| AniList 전체를 로컬 미러링해 fuzzy 검색 | CLAUDE.md 설계 원칙 3(MVP 복잡도 상한) 위반 |

## 6. 데이터 모델

**신규 테이블 없음.** 변경 범위:

- `SearchResult`에 선택 필드 3개 추가: `match_titles`, `matched_via`, `season_number`, `title_is_synthesized`
- `external_search_cache`: 스키마 불변, **버전 문자열만 갱신**
- 라이브러리에 담을 때는 기존 `add-to-library` 경로를 그대로 탄다. AniList 2기는 별개 `contents` 행이 된다 (현행 동작 유지)

## 7. 화면 명세

**검색 결과 화면 (`app/search.tsx`)**

- `2기` 질의 시 AniList 2기 결과와 TMDB 상위 show가 **함께** 노출될 수 있다. `compactResults`의 `areSameWork`는 `air_year`가 다르면(2026 vs 2025) 병합하지 않으므로 두 건이 남는다. 이는 의도된 동작이다.
- 시즌 해석으로 얻은 결과에는 방영 연도(`2026`)가 반드시 표시되어 1기와 구분되게 한다.
- 결과 0건일 때 문구는 기존 빈 상태를 그대로 쓴다. 신규 문구를 만들지 않는다.

## 8. 엣지 케이스

| # | 입력/상황 | 기대 동작 |
|---|---|---|
| E-1 | `촌구석 아저씨, 검성이 되다 1기` | base 취급. 1기 결과 |
| E-2 | `촌구석 아저씨, 검성이 되다 5기` | 체인이 끊김. 오류 없이 base(1기) 결과만 |
| E-3 | 질의가 `2기` 뿐 | 파싱하지 않고 일반 질의로 처리 |
| E-4 | `SEQUEL`이 극장판/OVA | 건너뛰고 TV/TV_SHORT/ONA만 추적 |
| E-5 | 관계 그래프에 순환 | 방문 Set으로 차단, 무한 루프 없음 |
| E-6 | AniList 타임아웃/오류 | 기존 `failedSources` 경로. TMDB 결과는 살린다 |
| E-7 | base 한국어 제목 부재 | D-5의 3순위(원제)로 폴백 |
| E-8 | 시즌 해석 결과가 base와 동일 id | 중복 제거 후 1건 |
| E-9 | 미방영 시즌(`startDate` 미래) | 그대로 노출. 방영 여부로 거르지 않는다 |

## 9. 테스트 표

**단위 — `adapters/normalize.test.ts`**

| 입력 | 기대 |
|---|---|
| `촌구석 아저씨, 검성이 되다 2기` | `{ baseQuery: "촌구석 아저씨, 검성이 되다", seasonNumber: 2 }` |
| `제목 시즌 3` / `제목 시즌3` | `seasonNumber: 3` |
| `제목 2期` | `seasonNumber: 2` |
| `제목 1기` | `null` |
| `2기` | `null` |
| `제목 10기` | `null` (2~9 범위 밖) |

**단위 — SEQUEL 해석 (고정 픽스처)**

실측값을 골든 데이터로 쓴다. 네트워크 호출 없이 아래 구조를 주입한다.

| 시나리오 | 입력 | 기대 |
|---|---|---|
| 정상 | base `179955`, `SEQUEL → 194829`, N=2 | `194829` |
| 체인 부족 | 위와 동일, N=3 | `null` (base 유지) |
| 극장판 스킵 | `SEQUEL → MOVIE`, 그 뒤 `SEQUEL → TV` | TV 노드 |
| 순환 | `A → B → A`, N=3 | `null`, 무한 루프 없음 |

**단위 — 필터 (RC-4 회귀)**

| 결과 | compactQuery | 기대 |
|---|---|---|
| `title_primary: "Katainaka no Ossan, Kensei ni Naru II"`, `matched_via: "season_relation"` | `촌구석아저씨검성이되다2기` | **통과** |
| 동일하되 `matched_via: "direct"`, `match_titles: ["촌구석 아저씨, 검성이 되다 2기"]` | 동일 | **통과** |
| 무관한 작품, `match_titles` 없음 | 동일 | 탈락 |

**통합**

| # | 시나리오 | 기대 |
|---|---|---|
| I-1 | `촌구석 아저씨, 검성이 되다 2기` 검색 | AniList `194829`가 결과에 포함 |
| I-2 | 같은 질의 재검색 | 캐시 히트, 결과 동일 |
| I-3 | `촌구석 아저씨, 검성이 되다` 검색 | 1기(`179955`)가 상위 |

## 10. 확실하지 않음 — 별도 검증 필요

CLAUDE.md 설계 원칙 4에 따라 명시한다.

- **AniList `relations`의 `SEQUEL` 표기 일관성**: 이 작품에서는 확인했으나, 분할 2쿨을 `SEQUEL`이 아닌 `PARENT`/`SIDE_STORY`로 두는 작품이 있다. 다른 작품 3건 이상으로 표본 검증이 필요하다.
- **TMDB 시즌 한국어 제목**: 이 작품은 `시즌 1`/`시즌 2`라는 무의미한 기본값이었다. 작품 제목이 담긴 시즌명을 주는 케이스가 있는지 미확인 — D-5의 1순위가 실제로 쓰이는 빈도를 모른다.
- **`파트`/`쿨` 표기**: 본 명세 범위 밖. 사용자 질의 로그로 빈도를 확인한 뒤 별도 결정한다.
