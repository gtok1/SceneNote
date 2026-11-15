# 67. 무관한 AniList 시즌 카드("…2기")가 검색 결과에 섞이는 문제 정정

작성일: 2026-11-08
대상 브랜치 기준: `main` (`dc28860`) + 미커밋 작업(시즌별 진행 범위, **`docs/66` 구현**). 이 문서의 행 번호는 docs/66 구현이 반영된 작업 트리(검색 파일 2026-11-08 11:31 수정) 기준이다. 이 시점 `npm test`는 1421/1421 통과, `npm run search:golden`은 29/29다. 운영 `search-content`는 v28(2026-10-16 22:34)이고 docs/66은 아직 배포되지 않았다.
선행 문서: `docs/15_season_search_spec.md`(RC-4·D-3, `season_relation` 무조건 통과), `docs/62_anime_search_all_seasons_fixes_spec.md`(시즌 펼치기 2~8기·3단계), `docs/55_korean_search_spacing_fallback_spec.md`·`docs/56_korean_search_spacing_length_fixes_spec.md`(2단계 판정), `docs/66_korean_search_relaxed_words_fixes_spec.md`(발견 경위 2.4)

> **근거.** `docs/66` 조사 중 발견(2026-11-08). "파티에서 추방된 치유사" 검색 결과가 검색어와 무관한 AniList "…2기" 카드 2장뿐이었다.
> 사용자 요청: "함께 발견한 AniList '…2기' 카드 누수 결함도 명세로 쓸까요?"에 "명세 작성".

---

## 1. 문제 정의
| ID | 증상 |
|----|------|
| F-1 | 한국어로 검색하면 검색어와 상관없는 애니의 후속 시즌 카드("…2기", "Season 2 Part 2")가 결과에 섞인다. 그 작품의 1기 카드는 걸러져 보이지 않고 2기·3기만 나온다. |
| F-2 | 이 카드가 "맞는 결과"로 세어져 2단계 띄어쓰기 보정(docs/55·56)이 실행되지 않는다. |

2026-11-08 실측. 실제 어댑터(`searchTmdb`·`searchAniList`)로 1~3단계를 재현했다(캐시 없음, 운영 v28과 같은 단계). docs/66의 4단계가 있어도 누수 카드는 그대로 섞인다. 4단계는 TMDB 결과를 더할 뿐이고, 맞는 제목이 있으면 아예 돌지 않는다.

| 검색어 | 섞인 무관 카드 (AniList id) | 누수를 만든 1단계 앞부분 질의 | 걸러진 1기 (id) | 2단계 |
|--------|-----------------------------|-------------------------------|-----------------|-------|
| 파티에서 추방된 치유사 | 용사 파티에 귀여운 애가 있어서, 고백해봤다. 2기 (219679), 용사 파티에서 쫓겨난 다재무능 2기 (209670) | `파티에`, `파티에서` | 195515, 187264 | 막힘(`has_match`) |
| 전생했더니 고블린 | 전생했더니 슬라임이었던 건에 대하여 2기 (108511) | `전생했` | 101280 | 막힘(`has_match`) |
| 이세계에서 치트 스킬 | Re: 제로부터 시작하는 이세계 생활 2기 (108632), … 2기 파트 2 (119661) | `이세계` | Re: 제로부터 시작하는 이세계 생활(1기) | 해당 없음(맞는 결과가 따로 있음) |
| 마왕님 리트라이 | 알바 뛰는 마왕님! 2기 (130592), The Devil is a Part-Timer! Season 2 Part 2 (155168) | `마왕님` | 15809 | 해당 없음(맞는 결과가 따로 있음) |

"이세계에서 치트 스킬"과 "마왕님 리트라이"는 맞는 카드("이세계에서 치트 스킬을 얻은 나는…", "마왕님 리트라이!"·"… 2기")도 함께 나오고, 무관한 카드가 그 사이에 섞인다.

## 2. 근본 원인

### 2.1 AniList 시즌 카드는 두 가지 방식으로 만들어진다
| 방식 | 언제 | 목록에 들어가는 것 | 코드 |
|------|------|-------------------|------|
| 시즌 검색(docs/15) | 검색어 끝에 "N기"·"시즌 N"(`parseSeasonQuery`) | 상위 3개 기본 작품을 N기로 **대체**한다. 기본 작품은 목록에 없다 | `adapters/anilist.ts` 174~181행 |
| 시즌 펼치기(docs/62) | 그 밖의 1페이지 검색 | 기본 작품(1기) **과 함께** 이어지는 2~8기를 넣는다 | 182~183행 → `expandDirectSeasonRelations` 217~241행 |

두 방식 모두 시즌 카드에 `matched_via: "season_relation"`, `resolved_from_id`(기본 작품 id), `season_number`를 붙인다(`normalizeAniListItem` 379~405행).

### 2.2 필터가 시즌 카드를 무조건 통과시킨다
`filterResultsByCompactQuery`(`adapters/normalize.ts` 145~157행)의 149행이다.
```ts
if (result.matched_via === "season_relation") return true;
```
- 이 규칙은 docs/15 D-3이 **시즌 검색**을 위해 넣었다(RC-4). 대체된 N기의 제목은 로마자뿐이라("Katainaka no Ossan, Kensei ni Naru II") 한국어 검색어와 맞지 않는다. 기본 작품이 목록에 없으니 시즌 카드 자신을 살려야 했다.
- **시즌 펼치기**에서는 기본 작품이 같은 목록에 있다. 필터는 기본 작품을 제목으로 판정해 걸러 내면서, 그 시즌 카드는 무조건 통과시킨다. 그래서 1기 없이 2기·3기만 남는다.
- 시즌 펼치기는 docs/15 커밋(`0659938`)부터 있었고(2기만), docs/62가 2~8기로 늘리면서 누수 카드도 늘었다.

### 2.3 언제 드러나는가 — 1단계 앞부분 질의
- 1단계 `compact-title` 변형(앞부분 질의, `createKoreanAnchorQueries` 288~313행)은 검색어의 앞 2~3글자나 첫 단어로 넓게 검색한다. 그 뒤 공백 뺀 전체 검색어가 제목에 들어 있는 결과만 남긴다(`filterResponseForVariant` 45행).
- AniList는 이 짧은 질의에 한국어 별칭이 걸리는 다른 작품과 그 시즌을 돌려준다. 기본 작품은 걸러지고 시즌 카드만 남는다.

`searchAniList` 응답에 지금 필터를 적용한 결과(2026-11-08):

| 앞부분 질의 | 응답 순서: id(시즌, 표시, 기본 작품) → 남음 여부 |
|-------------|-----------------------------------------------|
| `파티에`(검색어 "파티에서 추방된 치유사") | 195515(1기) → 걸러짐, 219679(2기, `season_relation`, 기본 195515) → **남음** |
| `파티에서` | 187264(1기) → 걸러짐, 209670(2기, 기본 187264) → **남음** |
| `마왕님`(검색어 "마왕님 리트라이") | 130592(2기, 기본 15809) → **남음**, 155168(3기, 기본 15809) → **남음**, 15809(1기) → 걸러짐 |

"마왕님" 응답에서는 시즌 카드가 기본 작품보다 **앞에** 온다. 판정은 순서와 무관해야 한다.

### 2.4 2단계 판정까지 막는다 (F-2)
2단계 실행 판정(`normalize.ts` 351행)도 같은 필터로 "맞는 결과"를 센다. 남은 시즌 카드가 맞음이 되어 `has_match`로 끝난다. 그래서 "파티에서 추방된 치유사", "전생했더니 고블린"은 2단계를 아예 시도하지 않는다.

### 2.5 캐시에도 남는다
`external_search_cache`에는 변형별로 **거른 뒤** 결과를 저장하고(`index.ts` 295행 → 300~313행), 캐시를 읽을 때는 다시 거르지 않는다(262~271행). 저장된 누수 카드 옆에는 기본 작품이 없다.

## 3. 재현 시나리오
1. 웹 8081에 로그인한 뒤 검색 탭에서 "마왕님 리트라이"를 입력한다.
2. "마왕님 리트라이!"·"마왕님 리트라이! 2기" 외에 "알바 뛰는 마왕님!"(2기)과 "The Devil is a Part-Timer! Season 2 Part 2" 카드가 보인다. "알바 뛰는 마왕님!" 1기 카드는 없다.
3. "파티에서 추방된 치유사"를 입력하면 "…2기" 카드 2장만 보인다.

## 4. 설계 결정

### D-1 (최우선). 펼친 시즌 카드는 같은 목록에 있는 기본 작품의 판정을 따른다
시즌 카드(`matched_via === "season_relation"`)는 아래 순서로 판정한다.
1. 자기 제목(`title_primary`·`title_original`·`match_titles`)이 맞으면 통과한다. 시즌에 고유한 한국어 제목이 있는 경우다.
2. 같은 목록에 기본 작품이 있으면 기본 작품의 판정을 따른다.
3. 같은 목록에 기본 작품이 없으면 통과한다. docs/15 RC-4(시즌 검색으로 대체된 N기)를 그대로 지킨다.

따라서 기본 작품이 걸러지면 그 시즌 카드도 걸러진다(1번 제외). 기본 작품이 남으면 시즌 카드도 남는다(제목이 로마자뿐이어도).

### D-2. 기본 작품 찾기
- 기본 작품은 같은 목록에서 `matched_via !== "season_relation"`이고, `external_source`가 같고, `external_id === resolved_from_id`인 결과다.
- 그런 결과가 여럿이면 하나라도 맞으면 맞음이다.
- `resolved_from_id`가 없으면 기본 작품을 알 수 없으므로 D-1의 3번(통과)으로 본다. 지금과 같다.
- 출처가 다르면(예: TMDB 결과의 id가 우연히 같음) 기본 작품이 아니다.
- 판정은 목록 순서와 무관하다(2.3 "마왕님"). 기본 작품 판정표를 먼저 만든 뒤 거른다.

### D-3. 고치는 곳은 `filterResultsByCompactQuery` 하나다
- 시그니처, 빈 검색어 통과(146행, docs/56 D-2), 제목 판정(정·역방향 포함, 세 필드), 결과 순서는 그대로다.
- `filterResponseForVariant`(45행)와 2단계 판정(351행)은 이 함수를 쓰므로 코드 변경 없이 따른다. F-2도 함께 풀린다.
- docs/66의 4단계 판정·`filterResultsByRelaxedWords`는 이 함수를 쓰지 않으므로 영향이 없다.

### D-4. 어댑터·병합·`direct` 변형은 바꾸지 않는다
- AniList 어댑터의 시즌 검색·시즌 펼치기·`matched_via` 부여, TMDB 어댑터, `compactResults`는 그대로다.
- `direct` 변형 결과는 지금처럼 거르지 않는다(API가 고른 결과를 그대로 쓰는 기존 설계).

### D-5. `SEARCH_CACHE_VERSION`을 `"ko-v16-season-base"`로 올린다
- 2.5대로 캐시에는 누수 카드가 기본 작품 없이 저장돼 있다. 새 규칙은 이것을 기본 작품 없는 시즌(D-1의 3번)으로 보고 통과시킨다.
- 올리지 않으면 배포 뒤 최대 1시간 누수가 남는다. docs/15 D-6·docs/62와 같은 이유다.

### D-6. 기존 테스트는 고치지 않는다
특히 `normalize.test.ts` 84~91행 "keeps a result resolved through a season relation"(기본 작품 없는 시즌 → 통과), CF-1~CF-3, WS·WP·AF 행, `anilist.test.ts` 전체가 그대로 통과해야 한다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| `season_relation` 무조건 통과를 없애고 시즌 카드도 자기 제목으로만 판정 | docs/15 RC-4 회귀(로마자뿐인 대체 N기 탈락), 기존 테스트 84~91행 실패. 기본 작품이 맞는데 시즌 제목이 로마자인 카드(SR-3)도 탈락한다 |
| 펼친 시즌에 다른 표시(예: `season_expansion`)를 붙이고 필터에서 따로 처리 | 타입·어댑터·필터를 모두 바꾸고, 결국 "기본 작품 판정을 따른다"는 같은 규칙이 필요하다. 필터 한 곳이 작다 |
| 앞부분 질의일 때 AniList 시즌 펼치기를 끔 | 어댑터는 질의가 앞부분 변형인지 모른다(변형 정보가 전달되지 않음). 맞는 앞부분 질의(예: "진격의")의 시즌 카드까지 사라진다 |
| 2단계 판정에서만 시즌 카드를 제외 | F-2만 풀리고 화면의 무관한 카드(F-1)는 남는다 |
| `direct` 변형에도 필터 적용 | API 결과를 그대로 쓰는 기존 설계가 바뀐다. 이번 결함과 무관하다 |
| 캐시 버전 유지 | 배포 뒤 최대 1시간 누수가 남는다(D-5) |
| 캐시 테이블의 해당 행 삭제 | 운영 DB 쓰기가 필요하다. 버전 상향이면 충분하다 |

## 6. 계약

### 6.1 `supabase/functions/search-content/adapters/normalize.ts`
시그니처는 바꾸지 않는다.
```ts
export function filterResultsByCompactQuery(results: SearchResult[], compactQuery: string): SearchResult[];
```

**판정 순서**
1. `!compactQuery`면 `results`를 그대로 돌려준다(같은 배열).
2. 제목 판정 `titleMatches(result)`는 지금 151~155행과 같다: `title_primary`·`title_original`·`match_titles` 중 하나의 `compactSearchText`가 검색어를 포함하거나 검색어에 포함된다.
3. 기본 작품 판정표: `matched_via !== "season_relation"`인 결과마다 키 `` `${external_source}:${external_id}` `` → `titleMatches` 결과. 같은 키가 여럿이면 하나라도 `true`면 `true`.
4. 순서를 유지해 거른다.
   - 시즌 카드가 아니면 `titleMatches(result)`다.
   - 시즌 카드면 `titleMatches(result)`가 참이면 통과한다. 아니면 `resolved_from_id`가 있고 판정표의 `` `${external_source}:${resolved_from_id}` ``가 `false`일 때만 탈락하고, 그 밖(판정표에 없음·`resolved_from_id` 없음·`true`)은 통과한다.

**교체 전 (145~157행)**
```ts
export function filterResultsByCompactQuery(results: SearchResult[], compactQuery: string): SearchResult[] {
  if (!compactQuery) return results;

  return results.filter((result) => {
    if (result.matched_via === "season_relation") return true;

    return [result.title_primary, result.title_original, ...(result.match_titles ?? [])].some((title) => {
      if (!title) return false;
      const compactTitle = compactSearchText(title);
      return compactTitle.includes(compactQuery) || compactQuery.includes(compactTitle);
    });
  });
}
```

**교체 후 (예시. 같은 판정이면 내부 구현은 자유)**
```ts
export function filterResultsByCompactQuery(results: SearchResult[], compactQuery: string): SearchResult[] {
  if (!compactQuery) return results;

  const titleMatches = (result: SearchResult) =>
    [result.title_primary, result.title_original, ...(result.match_titles ?? [])].some((title) => {
      if (!title) return false;
      const compactTitle = compactSearchText(title);
      return compactTitle.includes(compactQuery) || compactQuery.includes(compactTitle);
    });

  // docs/67: an expanded season follows its base when the base is in the same list.
  // Only a season whose base is absent (season search replaced it, docs/15 RC-4) passes unconditionally.
  const baseVerdicts = new Map<string, boolean>();
  for (const result of results) {
    if (result.matched_via === "season_relation") continue;
    const key = `${result.external_source}:${result.external_id}`;
    baseVerdicts.set(key, baseVerdicts.get(key) === true || titleMatches(result));
  }

  return results.filter((result) => {
    if (result.matched_via !== "season_relation") return titleMatches(result);
    if (titleMatches(result)) return true;
    const baseVerdict = result.resolved_from_id
      ? baseVerdicts.get(`${result.external_source}:${result.resolved_from_id}`)
      : undefined;
    return baseVerdict !== false;
  });
}
```

### 6.2 `supabase/functions/search-content/index.ts`
- 69행을 `const SEARCH_CACHE_VERSION = "ko-v16-season-base";`로 바꾼다(D-5). 지금 값은 `"ko-v15-all-seasons"`다(docs/66은 바꾸지 않았다).
- 그 밖의 변경은 없다.

## 7. 데이터 모델 / SQL
변경 없음. DB 마이그레이션을 만들지 않는다.

## 8. 화면 명세
화면 코드 변경은 없다. 검색 결과에서 무관한 시즌 카드가 빠진다.
- "파티에서 추방된 치유사"는 `docs/66`과 함께 배포하면 무관한 카드 2장 대신 244625("파티에서 추방당한 그 치유사, 실은 최강인 것에 대하여") 등이 나온다. 이 변경만 배포하면 "검색 결과가 없습니다"가 된다.
- `docs/66`과는 서로 독립이다. 같은 파일의 다른 부분을 바꾼다. 현재 작업 트리에는 docs/66 구현이 미커밋으로 있으니 한 번에 배포한다.

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 앞부분 질의가 받은 무관한 1기 + 그 2기 | 둘 다 탈락 | SR-1 |
| E-2 | 시즌 카드가 기본 작품보다 앞에 옴, 시즌 여러 개 | 순서와 무관하게 모두 탈락 | SR-2 |
| E-3 | 기본 작품이 맞고 시즌 제목은 로마자뿐 | 둘 다 통과 | SR-3 |
| E-4 | 맞는 1기·2기와 무관한 1기·2기가 섞임 | 무관한 쪽만 탈락, 순서 유지 | SR-4 |
| E-5 | 기본 작품은 안 맞지만 시즌 자기 한국어 제목이 맞음 | 시즌 통과 | SR-5 |
| E-6 | 시즌 검색("N기")으로 기본 작품이 목록에 없음(docs/15 RC-4) | 통과(지금과 같음) | SR-6, 기존 84~91행 |
| E-7 | 다른 출처 결과의 id가 `resolved_from_id`와 같음 | 기본 작품으로 보지 않음 → 기본 작품 없음 → 통과 | SR-7 |
| E-8 | `resolved_from_id` 없는 시즌 카드 | 통과(지금과 같음) | SR-8, 기존 84~91행 |
| E-9 | 같은 기본 작품 항목이 여럿, 하나만 맞음 | 맞음으로 보고 시즌 통과 | SR-9 |
| E-10 | `compact-title` 변형 응답 | 새 규칙으로 거른 결과·`total`(캐시에 저장되는 값도 이 결과) | SR-10 |
| E-11 | 2단계 판정 목록에 무관한 1기·2기만 있음 | 2단계 실행 | SR-11 |
| E-12 | 빈 검색어 | 거르지 않고 같은 배열 | 기존 CF-3 |
| E-13 | TMDB 결과(시즌 카드 포함) | `season_relation`이 아니라 영향 없음 | 기존 테스트 |
| E-14 | 3단계(docs/62)의 기본 작품이 맞음("감정스킬로") | 1·2·3기 유지 | 실측 2026-11-08, M-3 |
| E-15 | 배포 직후 캐시에 남은 누수 결과 | 캐시 버전 상향으로 쓰지 않음 | D-5, DoD |
| E-16 | `direct` 변형의 AniList 결과 | 지금처럼 거르지 않음 | D-4(코드 변경 없음) |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.**
- 기존 테스트는 고치지 않는다(D-6).
- **보존 행**(지금도 통과하고 수정 뒤에도 통과해야 함): SR-3, SR-5, SR-6, SR-7, SR-8, SR-9. 나머지 SR-1, SR-2, SR-4, SR-10, SR-11은 수정 전에 실패해야 한다.
- 결과 객체는 `normalize.test.ts`의 기존 픽스처 `result(titlePrimary, titleOriginal, overrides)`(16~34행)로 만든다. 테스트 파일에 아래 두 도우미를 둔다(docs/66 구현의 도우미와 이름이 겹치면 겹치지 않는 이름으로 바꾸고 보고한다).
  ```ts
  const ani = (title: string, id: string, overrides: Partial<SearchResult> = {}) =>
    result(title, null, { external_source: "anilist", external_id: id, content_type: "anime", ...overrides });
  const aniSeason = (title: string, id: string, baseId: string, seasonNumber: number) =>
    ani(title, id, { matched_via: "season_relation", resolved_from_id: baseId, season_number: seasonNumber });
  ```
- 기대값은 남은 결과의 `external_id` 배열(순서 포함)이다. 아래 id·제목은 2026-11-08 AniList 실측 값이다(SR-5의 귀멸의 칼날 id는 예시).

### `supabase/functions/search-content/adapters/normalize.test.ts` (추가)
| ID | 입력 | 기대 | 수정 전 |
|----|------|------|---------|
| SR-1 | `filterResultsByCompactQuery([ani("용사 파티에 귀여운 애가 있어서, 고백해봤다.", "195515"), aniSeason("용사 파티에 귀여운 애가 있어서, 고백해봤다. 2기", "219679", "195515", 2)], "파티에서추방된치유사")` | `[]` | 실패(`["219679"]`) |
| SR-2 | `([aniSeason("알바 뛰는 마왕님!", "130592", "15809", 2), aniSeason("The Devil is a Part-Timer! Season 2 Part 2", "155168", "15809", 3), ani("알바 뛰는 마왕님!", "15809")], "마왕님리트라이")` | `[]` | 실패(`["130592","155168"]`) |
| SR-3 | `([ani("마왕님 리트라이!", "104252"), aniSeason("Maou-sama, Retry! R", "168500", "104252", 2)], "마왕님리트라이")` | `["104252","168500"]` | 보존 |
| SR-4 | `([ani("마왕님 리트라이!", "104252"), aniSeason("마왕님 리트라이! 2기", "168500", "104252", 2), aniSeason("알바 뛰는 마왕님!", "130592", "15809", 2), ani("알바 뛰는 마왕님!", "15809")], "마왕님리트라이")` | `["104252","168500"]` | 실패(`["104252","168500","130592"]`) |
| SR-5 | `([ani("Kimetsu no Yaiba", "101922"), aniSeason("귀멸의 칼날 환락의 거리편", "142329", "101922", 2)], "환락의거리편")` | `["142329"]` | 보존 |
| SR-6 | `([aniSeason("Katainaka no Ossan, Kensei ni Naru II", "194829", "179955", 2)], "촌구석아저씨검성이되다2기")` | `["194829"]` | 보존 |
| SR-7 | `([result("무관한 드라마", null, { external_id: "179955" }), aniSeason("Katainaka no Ossan, Kensei ni Naru II", "194829", "179955", 2)], "촌구석아저씨검성이되다2기")` | `["194829"]` | 보존 |
| SR-8 | `([ani("Unrelated", "1"), ani("Some Sequel II", "2", { matched_via: "season_relation", season_number: 2 })], "촌구석아저씨")` | `["2"]` | 보존 |
| SR-9 | `([ani("Yuusha Party wo Oidasareta Kiyou Binbou", "187264"), ani("용사 파티에서 쫓겨난 다재무능", "187264"), aniSeason("Jack-of-All-Trades, Party of None Season 2", "209670", "187264", 2)], "용사파티에서쫓겨난")` | `external_id` `["187264","209670"]`, 제목 `["용사 파티에서 쫓겨난 다재무능","Jack-of-All-Trades, Party of None Season 2"]` | 보존 |
| SR-10 | `filterResponseForVariant({ source: "anilist", results: SR-1 결과 2개, total: 2, hasNextPage: false }, { query: "파티에", matchMode: "compact-title", compactQuery: "파티에서추방된치유사" })` | `results: []`, `total: 0` | 실패(1개, `total: 1`) |
| SR-11 | `planKoreanWordSplitFallback({ query: "파티에서 추방된 치유사", page: 1, sources: ["tmdb","anilist"], remainingMs: 7000, primaryVariants: createSearchQueryVariants("파티에서 추방된 치유사"), primaryResults: SR-1 결과 2개 })` | `reason: "run"`, 질의 `["파 티","파티 에","파티에 서","파티에서 추"]` | 실패(`reason: "has_match"`) |

### 네트워크 검사 (읽기 전용 TMDB, `npm test` 밖)
| ID | 명령 | 기대 |
|----|------|------|
| GN-1 | `npm run search:golden` | 시작 기준선과 같다(2026-11-08 docs/66 반영 작업 트리 기준 29/29). 골든은 TMDB 전용이라 AniList 사례는 넣지 않는다(docs/62 12장) |

### 수동 확인
배포 전에는 웹이 운영 `search-content`(v28)를 부른다. 그래서 M-1~M-5는 배포 후 사람이 확인한다.

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 (배포 후) | "마왕님 리트라이" → "마왕님 리트라이!"·"마왕님 리트라이! 2기" 있음. "알바 뛰는 마왕님!" 시즌 카드와 "The Devil is a Part-Timer! Season 2 Part 2" 없음 |
| M-2 | 웹 8081 (배포 후) | "이세계에서 치트 스킬" → "이세계에서 치트 스킬을 얻은 나는…" 카드들 있음. "Re: 제로부터 시작하는 이세계 생활 2기" 없음 |
| M-3 | 웹 8081 (배포 후) | "감정스킬로" → 1·2·3기 세 카드(docs/62 M-1 유지). "촌구석 아저씨, 검성이 되다 2기" → 2기 카드(docs/15 I-1 유지) |
| M-4 | 웹 8081 (배포 후) | "파티에서 추방된 치유사" → "…2기" 카드 없음(`docs/66`도 배포됐으면 244625 카드) |
| M-5 | 앱(iOS 세로, 배포 후) | M-1과 같음 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/search-content/adapters/normalize.ts` | 6.1: `filterResultsByCompactQuery` 본문만 |
| `supabase/functions/search-content/adapters/normalize.test.ts` | 도우미 `ani`·`aniSeason`, SR-1~SR-11 |
| `supabase/functions/search-content/index.ts` | 6.2: `SEARCH_CACHE_VERSION` 한 줄 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| `direct` 변형의 AniList 결과에 무관한 작품이 섞이는 경우 | API가 고른 결과를 그대로 쓰는 기존 설계(D-4). 이번 사례는 모두 `compact-title`에서 생겼다 |
| 역방향 포함으로 남는 짧은 제목("자유로운 세컨드 라이프" → 영화 "자유로") | `docs/66` 12장과 같다. docs/55·56 계약이 바뀐다 |
| 기본 작품이 목록에 없는 시즌 카드가 무관한 경우(시즌 질의 + 앞부분 변형, 또는 3단계 TMDB 제목이 "N기"로 끝남) | D-1의 3번으로 지금 동작을 지킨다. 실측 사례가 없다 |
| AniList 분할 방영의 시즌 번호("2기 파트 2"가 3기로 표시) | docs/62 13장의 기존 규칙 |
| 앱 화면·빈 상태 문구 | 서버 결과만 바뀐다 |
| `docs/66`의 4단계 단어 완화 | 별도 명세(서로 독립) |

## 13. 확실하지 않음 — 별도 검증 필요
- 표본은 2026-11-08 실측이다. 누수 4건(앞부분 질의), 회귀 확인 6건("전생 귀족, 감정 스킬로 성공하다", "감정스킬로", "촌구석 아저씨, 검성이 되다 2기", "진격의 거인", "약사의 혼잣말", "전생했더니 슬라임이었던 건에 대하여")이다. 회귀 6건은 지금 규칙과 새 규칙의 결과가 같았다(같은 원본 응답에 두 규칙을 적용해 비교). AniList 검색 결과와 한국어 별칭은 커뮤니티 데이터라 바뀔 수 있다.
- D-1의 3번(기본 작품 없는 시즌 통과)이 무관한 카드를 남기는 경우는 드물다고 보고 지금 동작을 지켰다. 빈도는 측정하지 않았다.
- 캐시 버전을 올리면 배포 직후 1시간 동안 외부 API 호출이 는다(docs/62와 같음).
- F-2가 풀리면 누수 카드만 있던 검색어에서 2단계(TMDB 최대 4회)가 새로 돈다. 호출량은 측정하지 않았다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 결함 수정 작업이다.
- `filterResultsByCompactQuery`가 AniList 시즌 카드(`season_relation`)를 무조건 통과시켜, 1기가 걸러진 무관한 작품의 2기·3기 카드가 검색 결과에 섞이고 2단계 판정까지 막는다.
- 펼친 시즌 카드는 같은 목록에 있는 기본 작품의 판정을 따르게 하고(자기 제목이 맞으면 통과, 기본 작품이 목록에 없으면 지금처럼 통과), 캐시 버전을 올린다.

| ID | 증상 |
|----|------|
| F-1 | "파티에서 추방된 치유사"·"전생했더니 고블린"·"이세계에서 치트 스킬"·"마왕님 리트라이" 검색에 무관한 AniList "…2기"·"Season 2 Part 2" 카드가 섞인다(1기는 없음) |
| F-2 | 그 카드가 맞는 결과로 세어져 "파티에서 추방된 치유사"·"전생했더니 고블린"의 2단계 보정이 실행되지 않는다 |

# READ FIRST
1. 이 명세서 1~13장. 원인은 2장, 결정은 D-1~D-6, 계약은 6장, 테스트는 10장이다.
2. `docs/15_season_search_spec.md` RC-4·D-3 — 무조건 통과를 둔 이유(시즌 검색). 이 동작은 D-1의 3번으로 지킨다.
3. `docs/62_anime_search_all_seasons_fixes_spec.md` D-1·D-2 — 시즌 펼치기와 3단계.
4. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
5. 고칠 파일:
   - `supabase/functions/search-content/adapters/normalize.ts` 145~157행 `filterResultsByCompactQuery`(45행 `filterResponseForVariant`, 351행 2단계 판정이 사용)
   - `supabase/functions/search-content/index.ts` 69행 `SEARCH_CACHE_VERSION`
   - 행 번호는 docs/66 구현이 반영된 작업 트리 기준이다. 다르면 함수 이름으로 찾는다.
   - 참고만: `supabase/functions/search-content/adapters/anilist.ts` 174~184행(시즌 검색·펼치기 분기), 217~241행 `expandDirectSeasonRelations`, 379~405행 `normalizeAniListItem`

# 시작 상태 (반드시 유지)
- `git status`, `npm test`, `npm run search:golden` 결과를 기록한다.
  - 2026-11-08 기준선(docs/66 구현 반영, 미커밋): `npm test` 1421/1421 통과, `npm run search:golden` 29/29.
  - 기준선에 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다. 특히 같은 파일에 있는 docs/66 구현(4단계, `searchCacheScope`, RW·ST·RV·RF·RR·CS·RP 테스트)을 고치지 않는다.
- 참고(2026-11-08 이 기기): Homebrew `node` 26.7.0이 `libsimdjson` 누락으로 실행되지 않았다. `/usr/local/bin/node`(v24.14.1)를 `PATH` 앞에 두고 명령을 실행했다. 실행 환경이 다르면 무시한다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 시즌 카드는 ① 자기 제목이 맞으면 통과 ② 같은 목록에 기본 작품이 있으면 그 판정을 따름 ③ 기본 작품이 없으면 통과. ③을 없애면 docs/15 시즌 검색(로마자뿐인 대체 N기)이 깨진다.
- **D-2.** 기본 작품은 같은 출처·`external_id === resolved_from_id`·`season_relation` 아님. 여럿이면 하나라도 맞으면 맞음. `resolved_from_id`가 없으면 통과. 판정은 목록 순서와 무관하다.
- **D-3.** `filterResultsByCompactQuery` 본문만 바꾼다. 시그니처, 빈 검색어 통과, 제목 판정(정·역방향, 세 필드), 결과 순서는 그대로다. `filterResponseForVariant`·`planKoreanWordSplitFallback`은 고치지 않는다.
- **D-4.** AniList·TMDB 어댑터, `compactResults`, `direct` 변형 처리는 바꾸지 않는다.
- **D-5.** `SEARCH_CACHE_VERSION`은 `"ko-v16-season-base"`다.
- **D-6.** 기존 테스트를 고치지 않는다. 특히 `normalize.test.ts` 84~91행 "keeps a result resolved through a season relation".

# STEP 1 — 테스트부터
- 10장의 도우미 `ani`·`aniSeason`과 SR-1~SR-11을 `normalize.test.ts`에 추가한다(11개).
- `npm test`로 확인한다.
  - SR-1, SR-2, SR-4, SR-10, SR-11은 **실패**해야 한다(10장 "수정 전" 열의 값과 같은 이유로).
  - 보존 행 SR-3, SR-5, SR-6, SR-7, SR-8, SR-9는 **통과**해야 한다.
  - 다르면 시나리오를 잘못 짚은 것이니 멈추고 보고한다.

# STEP 2 — 필터 수정
- 6.1대로 `filterResultsByCompactQuery`를 바꾼다. 판정 위에 근거를 짧은 주석으로 남긴다: 펼친 시즌은 같은 목록의 기본 작품 판정을 따르고, 기본 작품이 없는 시즌 검색 결과(docs/15 RC-4)만 무조건 통과한다(docs/67).
- SR-1~SR-11과 기존 테스트가 모두 통과해야 한다.

# STEP 3 — 캐시 버전
- `index.ts` 69행을 `const SEARCH_CACHE_VERSION = "ko-v16-season-base";`로 바꾼다. 다른 줄은 바꾸지 않는다.

# 엣지 케이스 (전부 처리, 명세서 9장)
9장 E-1~E-16 전부. 각 행의 테스트 ID를 지킨다.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
npx --no-install esbuild supabase/functions/search-content/index.ts --bundle=false --format=esm --log-level=warning > /dev/null
npm run search:golden
git diff --check
```
- `npm test`: 기준선 + 새 테스트 11개. 실패 0이어야 한다.
- esbuild는 Edge Function 문법 검사다(typecheck·lint는 `supabase/functions`를 제외한다). 오류 0이어야 한다.
- `search:golden`: 기준선과 같아야 한다(TMDB 결과는 이 변경의 영향을 받지 않는다). 읽기 전용 TMDB 호출이며 키를 출력하지 않는다.

# DEFINITION OF DONE
- [ ] SR-1·SR-2·SR-4·SR-10·SR-11이 수정 전에 실패했고 수정 후 통과한다
- [ ] 보존 행 SR-3·SR-5~SR-9가 수정 전·후 모두 통과한다
- [ ] 기존 테스트 개수가 줄지 않았고, 기존 테스트 행 diff가 없다(특히 84~91행)
- [ ] `normalize.ts` diff는 `filterResultsByCompactQuery` 본문뿐이고 시그니처가 같다
- [ ] `index.ts` diff는 `SEARCH_CACHE_VERSION` 한 줄이다
- [ ] `typecheck`·`lint`·esbuild·`git diff --check` 통과, `search:golden` 기준선과 같음(또는 실행 못 한 사유)

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
supabase/functions/search-content/adapters/normalize.ts
supabase/functions/search-content/adapters/normalize.test.ts
supabase/functions/search-content/index.ts
```

# 보고 항목
1. STEP 1의 실패 5개 실제 출력(요약)과 보존 6개 통과 확인
2. `npm test` before / after 통과 개수, `typecheck`·`lint`·esbuild·`git diff --check` 결과
3. `npm run search:golden` before / after 결과
4. 추가한 테스트 ID와 이름
5. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
6. 사람이 할 후속 작업: `search-content` 재배포(운영 v28). `docs/66`도 구현됐으면 함께 배포한다. 배포 전 `npm run edge:drift`로 함께 나가는 다른 변경을 확인하고, 배포 후 10장 M-1~M-5를 확인한다

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다. 캐시 테이블 행을 지우지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다. 특히 역방향 포함 판정과 `direct` 변형 처리는 고치지 않는다(12장).
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- TMDB 키 등 비밀 값을 출력하지 않는다.
