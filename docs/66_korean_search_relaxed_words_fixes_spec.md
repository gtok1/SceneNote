# 66. 국내 공식 제목과 TMDB 번역 제목이 다를 때 검색 보정 — 단어 완화 4단계

작성일: 2026-11-08
대상 브랜치 기준: `main` (`dc28860`) + 미커밋 작업(시즌별 진행 범위, `docs/17`·`48` 관련). 검색 관련 파일(`supabase/functions/search-content/`, `scripts/search*`)에는 미커밋 변경이 없다. 이 시점 `npm test`는 1379/1379 통과, `npm run search:golden`은 23/23 통과다. 운영 `search-content`는 v28(2026-10-16 22:34, docs/55·56·62 반영)이다.
선행 문서: `docs/55_korean_search_spacing_fallback_spec.md`(TMDB 단어 단위 일치·2단계), `docs/56_korean_search_spacing_length_fixes_spec.md`(공백 뺀 검색어 ⊂ 공백 뺀 제목 기준), `docs/62_anime_search_all_seasons_fixes_spec.md`(AniList 3단계), `docs/35_search_completeness_and_deploy_drift_spec.md`(골든 검사)

> **근거.** 사용자 캡처(2026-11-08)
> - 라프텔 작품 페이지: "추방당한 치트 부여 마술사는 자유로운 세컨드 라이프를 구가한다. ~나는 무…"(TVA, 매주 수요일, 선독점)
> - SceneNote 웹 검색 탭 "추방당한 치트" → "검색 결과가 없습니다"
>
> 사용자 요청: "해당 작품 입력하고 싶은데 검색이 안돼 원인 찾아서 명세서 작성해줘"

---

## 1. 문제 정의
| ID | 증상 |
|----|------|
| F-1 | 국내 서비스(라프텔 등)의 공식 한국어 제목 일부로 검색하면 작품을 못 찾는다. "추방당한 치트" → "검색 결과가 없습니다". 작품은 TMDB(`313346`)와 AniList(`207329`)에 모두 있다. |

2026-11-08 실측. 현재 코드의 1~3단계를 실제 어댑터(`searchTmdb`·`searchAniList`)로 재현했다(캐시 없음).

| 검색어 | 지금 결과 | 찾아야 할 작품 (TMDB id) |
|--------|----------|--------------------------|
| 추방당한 치트 | 0건 | 313346 |
| 추방당한 치트 부여 마술사 | 0건 | 313346 |
| 추방당한 치트 부여 마술사는 자유로운 세컨드 라이프를 구가한다 | 0건 | 313346 |
| 추방당한 마술사는 | 0건 | 313346 |
| 자유로운 세컨드 라이프 | 무관한 영화 "자유로"(2017) 1건 | 313346 |
| 파티에서 추방된 치유사 | 무관한 AniList "…2기" 카드 2장 | 244625 ("파티에서 추방당한 그 치유사, 실은 최강인 것에 대하여") |

마지막 두 줄은 같은 원인(제목 단어 형태 차이)에 기존 판정의 허점(2.4)이 겹친 사례다. 마지막 줄은 공식 제목이 아니라 사용자가 동사 형태를 바꿔 쓴 경우(`추방당한` ↔ `추방된`)다.

## 2. 근본 원인

### 2.1 공식 한국어 제목과 TMDB 한국어 제목의 단어가 다르다
| 출처 | 한국어 제목 |
|------|-------------|
| 라프텔(국내 공식) | **추방당한** 치트 부여 마술사는 **자유로운** 세컨드 라이프를 구가한다. ~나는 무기만이 아니라 …~ |
| TMDB 313346 `ko-KR` 번역 | **추방된** 치트 부여 마술사는 **제멋대로** 세컨드 라이프를 구가한다. |
| AniList 207329 | 한국어 제목·별칭 없음(romaji·영어·일본어만) |

TMDB 한국어 제목은 커뮤니티 번역이라 국내 방영 제목과 다를 수 있다. 방영 중인 신작(313346은 2026-10-07 첫 방영)에서 특히 그렇다. 이 작품은 동사 형태(`추방당한` ↔ `추방된`)와 낱말(`자유로운` ↔ `제멋대로`)이 다르고, TMDB 제목에는 부제가 없다.

### 2.2 TMDB 검색은 모든 단어가 맞아야 한다 (재실측)
docs/55 2.1의 규칙(각 단어가 제목 단어와 같아야 함, 마지막 단어만 앞부분 일치, 순서 무관)을 이 작품으로 다시 확인했다(`search/multi`, `language=ko-KR`, 2026-11-08).

| 질의 | 313346 반환 | 이유 |
|------|------------|------|
| `추방당한 치트`, `추방당한치트`, `추방당한 치트 부여 마술사`, `자유로운 세컨드 라이프` | 없음(0건) | `추방당한`·`자유로운`이 제목 단어에 없다 |
| `추방된 치트`, `치트 부여`, `치트 부여 마술사`, `부여 마술사` | 있음(1건) | 모든 단어가 제목 단어다. `마술사`는 마지막 단어라 `마술사는`의 앞부분으로 맞는다 |
| `치트 추방` | 있음(1건) | 마지막 단어 `추방`이 `추방된`의 앞부분이다 |
| `추방 치트` | 없음 | 마지막이 아닌 `추방`은 `추방된`과 같아야 한다 |
| `치트` | 있음(12건 중 1번째) | |
| `세컨드 라이프` | 있음(4건 중 4번째) | |
| `추방` | 있음(22건 중 3번째) | |

### 2.3 기존 보정 단계가 이 유형을 못 만든다
`search-content/index.ts` 155~178행의 세 단계와 "추방당한 치트"의 결과다.

| 단계 | 코드 | "추방당한 치트" |
|------|------|-----------------|
| 1단계 | `createSearchQueryVariants`(`adapters/normalize.ts` 97~129행): 원문·붙여 쓴 형태·조사 띄우기(`direct`), 앞 3글자(`compact-title`, 282~307행) | TMDB `추방당한 치트`·`추방당한치트` 0건. 앞부분 질의 `추방당`은 다른 추방물 5건을 받지만 공백 뺀 검색어 `추방당한치트`가 제목에 없어 모두 걸러진다. AniList는 한국어 제목이 없어 0건 |
| 2단계 | `planKoreanWordSplitFallback`(331~349행, docs/55·56): 붙여 쓴 검색어의 앞 k글자 + 다음 1글자 | `추 방`·`추방 당`·`추방당 한`·`추방당한 치` → 맞는 결과 0건. 띄어쓰기 누락을 고치는 단계라 단어 형태 차이는 못 고친다 |
| 3단계 | `planAniListAnimeFollowUp`(351~383행, docs/62) | 2단계가 TMDB 애니를 못 찾아 실행되지 않는다(`no_anime`) |

AniList 어댑터의 한국어 → 원제 변환(`adapters/anilist.ts` 145행 → 458~483행 `resolveAniListSearchInput`)도 한국어 검색어로 TMDB `search/tv`를 불러 원제를 얻는 방식이라 같은 이유로 실패한다.

정리하면, 검색어 단어 중 하나라도 TMDB 제목 단어와 형태가 다르면 어떤 단계도 그 단어를 빼거나 줄여서 다시 묻지 않는다.

### 2.4 "맞는 결과가 있다" 판정이 무관한 결과에도 참이 된다
2단계 실행 판정은 `filterResultsByCompactQuery(1단계 결과, 공백 뺀 검색어)`가 비었는지다(`normalize.ts` 345행). 이 필터(139~151행)는 아래 두 경우도 "맞음"으로 센다.
1. **역방향 포함**(148행 `compactQuery.includes(compactTitle)`). 제목이 검색어 안에 들어 있어도 맞음이다. "자유로운 세컨드 라이프"에서 1단계 앞부분 질의 `자유로`가 받은 영화 "자유로"가 맞음이 되어 2단계를 막는다.
2. **`matched_via === "season_relation"` 무조건 통과**(143행). "파티에서 추방된 치유사"에서 AniList 앞부분 질의 `파티에`·`파티에서`가 받은 기본 작품("용사 파티에 귀여운 애가 있어서, 고백해봤다.", "용사 파티에서 쫓겨난 다재무능")은 걸러진다. 그런데 그 작품의 펼친 2기 카드는 통과한다. 이 카드가 맞음이 되어 2단계를 막고, 무관한 "…2기" 카드 2장만 화면에 남는다.

이 필터는 1·2·3단계 결과 거르기와 docs/55·56·62 계약에 쓰인다. 이번에는 바꾸지 않는다. 새 단계의 실행 판정만 정방향 포함으로 따로 둔다(D-4). 2번(시즌 카드 누수)은 `docs/67_anilist_season_card_leak_fixes_spec.md`에서 고친다.

## 3. 재현 시나리오
1. 웹 8081에 로그인한 뒤 검색 탭에서 "추방당한 치트"를 입력한다.
2. "검색 결과가 없습니다"가 나온다.
3. "치트 부여" 또는 "추방된 치트"로 입력하면 "추방된 치트 부여 마술사는 제멋대로 세컨드 라이프를 구가한다."(2026, 애니)가 나온다. TMDB 한국어 제목의 단어라서다.

## 4. 설계 결정

### D-1 (최우선). 기존 1~3단계는 그대로 두고, 새 4단계 "단어 완화"는 앞 단계 결과에 검색어를 담은 제목이 없을 때만 TMDB에 보낸다
- 바꾸지 않는 것: `createSearchQueryVariants`·`createKoreanSpacingHints`·`createKoreanAnchorQueries`·`MAX_QUERY_VARIANTS`, `createKoreanWordSplitVariants`·`planKoreanWordSplitFallback`, `planAniListAnimeFollowUp`, `filterResultsByCompactQuery`, `compactResults`, `SEARCH_CACHE_VERSION`, 기존 두 모드의 캐시 범위 문자열(D-8).
- 잘 되던 검색어는 결과와 호출 수가 지금과 같아야 한다. 2026-11-08 시제품 실측에서 골든 23개는 모두 4단계가 실행되지 않았다(`has_match` 7개, `single_word` 16개).
- 4단계는 3단계 다음에 둔다. 앞 단계 결과를 모두 본 뒤에 판정해야 하기 때문이다.

### D-2. 검색어 단어와 어간
- **단어**(`extractRelaxedSearchWords`): NFKC → 소문자 → 공백·문장부호·기호(`/[\s\p{P}\p{S}]+/u`)로 나눈다. 2글자 이상만 남기고, 중복을 빼고, 앞에서 6개(`MAX_RELAXED_WORDS`)까지 쓴다.
  - 1글자 단어(`그`, `해`, 입력 중인 `치`)는 거의 모든 제목에 맞아 기준이 될 수 없어 뺀다.
  - 6개 상한: 공식 제목을 통째로 넣으면 부제(`~나는 무기만이 …~`)까지 들어온다. TMDB 한국어 제목은 부제가 없을 때가 많아 앞부분만 본다(2.1).
- **어간**(`koreanWordStem`): 단어 끝이 아래 어미·조사 중 하나면 뗀다. 긴 것부터 보고, 떼고 남는 글자가 2자 이상인 첫 항목을 뗀다. 맞는 항목이 없거나 단어가 한글로 끝나지 않으면 단어 그대로다.
  ```
  3자: 당했던 당하는 당하던 당한다 되었던 시키는 스러운
  2자: 당한 당할 되는 되던 된다 됐던 시킨 받는 받은 하는 하던 했던 한다 로운 다운 적인 에서 에게 으로 까지 부터 처럼
  1자: 된 될 한 할 은 는 이 가 을 를 의 에 와 과 도 로 만
  ```
  - 예: `추방당한`·`추방된` → `추방`, `자유로운` → `자유`, `마술사는` → `마술사`, `파티에서` → `파티`, `구가한다` → `구가`. `못하는` → `못하`(`하는`을 떼면 1자라 다음 항목 `는`을 뗀다). `대한` → `대한`(남는 글자가 1자).
  - 형태소 분석이 아니다. `미식가` → `미식`처럼 명사 끝을 잘못 떼기도 한다. 어간은 앞부분 일치·포함 판정에만 쓰여 판정이 조금 느슨해질 뿐이고, 4단계는 앞 단계가 실패했을 때만 돈다(D-1).
- **핵심 단어**: 어간이 단어와 같은 단어(활용·조사가 없는 단어, 예: `치트`·`부여`·`세컨드`). 앞에서 3개(`MAX_RELAXED_CORE_WORDS`)까지.
- **활용 단어**: 어간이 단어와 다른 단어(예: `추방당한`·`마술사는`·`자유로운`).

### D-3. 4단계 질의는 TMDB 단어 규칙(2.2)에 맞춰 만든다
마지막이 아닌 자리에는 제목 단어와 그대로 같아야 하므로 핵심 단어만 둔다. 마지막 자리에는 앞부분 일치가 되는 어간을 둔다. 아래 순서로 만들고, 중복과 앞 단계 변형의 `query`와 같은 문자열을 빼고, 4개(`MAX_RELAXED_WORD_VARIANTS`)에서 자른다.
1. 핵심 단어가 있으면: 활용 단어의 어간 중 핵심 단어와 같지 않은 것 앞 2개(`MAX_RELAXED_STEM_QUERIES`)마다 `핵심 단어들 + " " + 어간`(예: `치트 추방`)
2. 핵심 단어가 있으면: `핵심 단어들`(예: `치트`, `치트 부여 마술사`)
3. 핵심 단어가 2개 이상이면: 하나씩 뺀 조합을 순서대로(첫째를 뺌, 둘째를 뺌, …)(예: `부여 마술사`, `치트 마술사`)
4. 핵심 단어가 없으면: 활용 단어의 어간 각각(예: `추방`, `마술사`)

모든 변형은 `matchMode: "relaxed-words"`이고, `compactQuery`는 공백 뺀 전체 검색어, `words`는 D-2의 단어 목록이다.

시제품 실측(2026-11-08, TMDB 1페이지):

| 검색어 | 4단계 질의 | 결과(D-5 거른 뒤) |
|--------|-----------|-------------------|
| 추방당한 치트 | `치트 추방`, `치트` | 313346 |
| 추방당한 치트 부여 마술사 | `치트 부여 마술사 추방`, `치트 부여 마술사`, `부여 마술사`, `치트 마술사` | 313346(첫 질의는 `마술사`가 마지막이 아니라 0건, 나머지 셋에서 찾음) |
| 공식 제목 전체 | `치트 부여 세컨드 추방`, `치트 부여 세컨드 마술사`, `치트 부여 세컨드`, `부여 세컨드` | 313346 |
| 자유로운 세컨드 라이프 | `세컨드 라이프 자유`, `세컨드 라이프`, `라이프`, `세컨드` | "세컨드 라이프"가 든 4개 작품(313346 포함) |
| 파티에서 추방된 치유사 | `치유사 파티`, `치유사 추방`, `치유사` | 244625, 276253("…추방당한 천재 치유사…") |
| 추방당한 마술사는 | `추방`, `마술사` | 313346 |
| 추방당한 고양이(참고) | `추방`, `고양` | 203780("용사 파티에서 추방된 비스트테이머, 최강종의 고양이귀 소녀와 만나다") |

### D-4. 4단계 실행 판정의 "맞는 결과"는 정방향 포함만 센다
- 앞 단계(1~3단계) 결과 중 공백 뺀 제목(`title_primary`·`title_original`·`series_title`·`match_titles`)에 공백 뺀 검색어가 **들어 있는** 결과가 하나라도 있으면 `has_match`다. docs/56 D-1의 사용자 기준("공백을 뺀 검색어가 공백을 뺀 제목에 들어 있으면 찾는다")과 같다.
- 역방향 포함(제목 ⊂ 검색어)과 `season_relation` 무조건 통과는 세지 않는다(2.4).
- `series_title`도 본다. TMDB 시즌 카드는 시즌 이름이 `title_primary`이고 작품 이름은 `series_title`에만 있을 수 있다(`adapters/tmdb.ts` 425~426행, 517~518행).
- 이 판정은 4단계 판정 함수 안에서만 쓴다. `filterResultsByCompactQuery`와 2단계 판정은 바꾸지 않는다(D-1).

### D-5. 4단계 결과는 "단어 덮기"로 거른다
- 4단계 질의는 넓다(`치트` 12건, `추방` 22건). 그래서 결과마다 D-2 단어 중 몇 개가 제목에 있는지 센다.
  - 단어가 맞음: 공백 뺀 제목(D-4와 같은 네 필드) 중 하나에 그 단어 또는 그 어간이 들어 있다.
  - 남김: 맞은 단어 수 ≥ `max(2, ceil(단어 수 × 2 / 3))`. 단어 2개 → 2개 모두, 3개 → 2개, 4개 → 3개, 6개 → 4개.
- 실측: `치트` 12건 중 313346만 남는다("더블 치트 -거짓 경관-"은 `추방`이 없다). `추방당한` 질의의 다른 추방물 3건은 `치트`가 없어 빠진다.
- `season_relation`도 같은 기준으로 본다(무조건 통과하지 않음). 4단계는 TMDB만이라 실제로는 해당이 없지만 함수 계약으로 정한다.
- 단어가 2개 미만이면 기준을 정할 수 없으므로 아무것도 남기지 않는다(방어).

### D-6. 4단계 실행 조건 (판정 순서대로, 처음 걸린 이유로 끝)
1. 1페이지 요청이다. 아니면 `page`.
2. 1단계 소스에 TMDB가 있다. 아니면 `no_tmdb`.
3. 공백 뺀 검색어에 한글이 있고 입력 중 자모(`/[ᄀ-ᇿ㄰-㆏]/`)가 없다. 아니면 `not_eligible`(docs/56 D-3과 같은 이유).
4. 시즌 표기(`parseSeasonQuery`, "N기"·"시즌 N")가 없다. 있으면 `season`. 시즌 검색은 docs/15·62 경로가 맡고, 4단계 질의에 시즌을 다시 붙이는 규칙은 이번 범위가 아니다.
5. 단어(D-2)가 2개 이상이다. 아니면 `single_word`. 한 단어는 뺄 단어가 없고, 붙여 쓴 검색어는 2단계가 맡는다.
6. 앞 단계 결과에 정방향으로 맞는 제목이 없다(D-4). 있으면 `has_match`.
7. 요청 마감까지 2,500ms(`RELAXED_WORD_MIN_REMAINING_MS`) 이상 남았다. 아니면 `time`. docs/62 3단계와 같은 값이다.
8. D-3 질의가 1개 이상이면 `run`, 없으면 `not_eligible`.

4단계 어댑터 제한 시간은 `min(5000, 남은 시간 − 1000)`ms다(2·3단계와 같다). 시제품 실측에서 4단계가 돌면 +0.3~0.5초였다(검색 전체 0.8~1.6초).

### D-7. 4단계는 TMDB에만 보내고, 다음 페이지 여부에 영향을 주지 않는다
- 소스는 `["tmdb"]`뿐이다. AniList에는 이 작품의 한국어 제목이 없고(2.1), 분당 요청 한도가 있다(docs/55 D-4).
- `hasNextPage`는 1단계로만 정한다(docs/55 D-6). 결과·`total`·`sources`·`failedSources`·`cached`는 네 단계를 합친다.
- 결과는 `compactResults([...1단계, ...2단계, ...3단계, ...4단계])`라 4단계 결과는 뒤에 붙는다.
- 응답에 선택 필드 `relaxed_word_fallback: boolean`(4단계를 검색했는가)을 추가한다. 클라이언트는 바꾸지 않는다(수동 확인에서 네트워크 응답으로 보는 용도).

### D-8. 캐시
- 4단계도 같은 `external_search_cache`, 같은 해시 규칙(`createQueryHash`, 1시간)을 쓴다.
- 캐시 범위 문자열 계산을 순수 함수 `searchCacheScope`(`normalize.ts`)로 옮긴다.
  - `direct` → `"direct"`, `compact-title` → `"compact-title:<compactQuery>"`. 지금 `index.ts` 499~502행과 바이트 단위로 같다.
  - `relaxed-words` → `"relaxed-words:<단어를 공백 하나로 이은 값>"`.
  - 4단계 캐시 값은 단어 덮기(D-5)로 거른 결과라 단어 목록에 따라 다르다. "추방당한 치트"와 "추방 당한 치트"는 `compactQuery`가 같아도 단어가 달라 범위를 단어로 나눈다.
- `SEARCH_CACHE_VERSION`은 올리지 않는다. 기존 모드 키는 그대로고 4단계 키는 새 범위라 겹치지 않는다.

### D-9. 골든 검사
- 기존 목록(`SEARCH_GOLDEN_CASES` 12개, `SEARCH_GOLDEN_SPACING_CASES` 7개, `SEARCH_GOLDEN_SHORT_SPACING_CASES` 4개)과 테스트 G-6~G-8은 그대로 둔다.
- 1장 표 6개를 새 목록 `SEARCH_GOLDEN_RELAXED_WORD_CASES`로 추가한다.
- `npm run search:golden`은 네 목록을 모두 검사한다. 각 사례에서 1단계 → 2단계 → 4단계를 index.ts와 같은 판정 함수로 재현한다(TMDB만. 3단계는 지금처럼 재현하지 않는다). 요약은 `통과 29/29`다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| 라프텔(또는 애니플러스) 검색을 소스로 추가 | 공개·문서화된 API가 아니라 약관·안정성이 불확실하다. 외부 소스는 TMDB·AniList·Kitsu·TVmaze로 정해져 있다(CLAUDE.md). 콘텐츠 ID·메타데이터 매핑이 새로 필요해 MVP 범위를 넘는다 |
| 한국어 형태소 분석기·사전 | docs/55와 같은 이유(Edge Function 번들 크기, 사전 관리) |
| 글자 n-gram 유사도만으로 순위 매기기 | TMDB가 단어 AND라 무엇을 질의할지(재현율)를 해결하지 못한다. 짧은 검색어와 긴 제목의 기준도 정하기 어렵다(`추방당한치트`와 313346 제목의 2글자 묶음 겹침은 5개 중 2개) |
| 단어마다 한 단어 질의만 보냄(어간 포함) | 흔한 단어는 1페이지 20건 안에 원하는 작품이 없을 수 있다. 핵심 단어를 함께 넣은 질의가 더 좁고 정확하다(`치트 부여 마술사` 1건) |
| 공식 제목을 우리 DB 별칭으로 저장해 검색 | 라이브러리에 추가된 작품만 있다. 추가하려는 시점에는 아직 없다(docs/55와 같은 이유) |
| TMDB 한국어 번역을 공식 제목으로 고침 | 외부 커뮤니티 데이터 수정은 코드 해결이 아니고 다른 작품에서 반복된다 |
| `filterResultsByCompactQuery`의 역방향 포함·`season_relation` 통과를 고쳐 2단계 판정까지 바꿈 | 1·2·3단계 결과 거르기와 docs/55·56·62 계약이 함께 바뀐다. 4단계 판정만 정방향 포함으로 따로 둔다(D-4) |
| 4단계를 2단계와 동시에 실행 | 2단계가 찾으면 버려질 호출이 생긴다. 실측 지연 +0.3~0.5초라 순차로 충분하다 |
| 4단계를 AniList에도 보냄 | AniList에는 한국어 제목이 없고 분당 한도가 있다(D-7) |
| 4단계 결과에 "비슷한 제목" 안내 표시 | 클라이언트 계약이 바뀐다. 포스터·제목으로 작품을 알아볼 수 있다. 필요하면 후속 |

## 6. 계약

### 6.1 `supabase/functions/search-content/adapters/normalize.ts`
```ts
export interface SearchQueryVariant {
  query: string;
  matchMode: "direct" | "compact-title" | "relaxed-words";
  compactQuery: string;
  /** relaxed-words 전용. 단어 덮기(docs/66 D-5)와 캐시 범위(D-8)에 쓴다. 다른 모드는 이 키를 만들지 않는다. */
  words?: readonly string[];
}

export const MAX_RELAXED_WORDS = 6;
export const MAX_RELAXED_CORE_WORDS = 3;
export const MAX_RELAXED_STEM_QUERIES = 2;
export const MAX_RELAXED_WORD_VARIANTS = 4;
export const RELAXED_WORD_MIN_REMAINING_MS = 2_500;

export function extractRelaxedSearchWords(query: string): string[];
export function koreanWordStem(word: string): string;
export function createKoreanRelaxedWordVariants(
  query: string,
  existing?: readonly SearchQueryVariant[]
): SearchQueryVariant[];
export function filterResultsByRelaxedWords(results: SearchResult[], words: readonly string[]): SearchResult[];
export function searchCacheScope(variant: SearchQueryVariant): string;

export type RelaxedWordFallbackReason =
  "run" | "page" | "no_tmdb" | "not_eligible" | "season" | "single_word" | "has_match" | "time";
export function planKoreanRelaxedWordFallback(input: {
  query: string;
  page: number;
  sources: readonly string[];
  remainingMs: number;
  existingVariants: readonly SearchQueryVariant[];
  priorResults: readonly SearchResult[];
}): { variants: SearchQueryVariant[]; reason: RelaxedWordFallbackReason };
```
- 기존 변형 생성 함수(`createSearchQueryVariants`·`createKoreanWordSplitVariants`·`planAniListAnimeFollowUp`)는 `words` 키를 만들지 않는다. 기존 `deepEqual` 테스트가 그대로 통과해야 한다.
- 어미·조사 목록(D-2)은 파일 안 상수로 둔다(export하지 않아도 된다). 길이 내림차순으로 본다.

**`extractRelaxedSearchWords` 판정**
1. `query.normalize("NFKC").toLocaleLowerCase()`를 `/[\s\p{P}\p{S}]+/u`로 나눈다.
2. 앞에서부터 `Array.from(token).length >= 2`이고 처음 나온 토큰만 모은다.
3. 6개(`MAX_RELAXED_WORDS`)가 되면 멈춘다.

**`koreanWordStem` 판정**
1. 단어가 한글(`/[가-힣]$/`)로 끝나지 않으면 그대로 돌려준다.
2. 어미·조사를 긴 것부터 보며, 단어가 그 항목으로 끝나고 떼고 남는 글자(`Array.from`)가 2자 이상이면 남은 부분을 돌려준다.
3. 맞는 항목이 없으면 그대로 돌려준다.

**`createKoreanRelaxedWordVariants` 판정**
1. `words = extractRelaxedSearchWords(query)`. 2개 미만이면 `[]`다.
2. `compactQuery = compactSearchText(collapseWhitespace(query))`.
3. `stems = words.map(koreanWordStem)`. 핵심 단어 `core = words.filter((w, i) => stems[i] === w).slice(0, 3)`. 활용 단어 어간 `inflected = words.flatMap((w, i) => stems[i] !== w ? [stems[i]] : [])`.
4. D-3의 1~4번 순서로 질의 문자열을 만든다. 1번은 `inflected.filter(s => !core.includes(s)).slice(0, 2)`로 만든다.
5. `existing`의 `query`와 같거나 이미 만든 것과 같으면 건너뛴다. 나머지는 `{ query, matchMode: "relaxed-words", compactQuery, words }`로 추가하고, 4개가 되면 멈춘다.

**`filterResultsByRelaxedWords` 판정**
1. `words.length < 2`면 `[]`다.
2. 단어마다 비교 형태 = `compactSearchText(단어)`, `compactSearchText(koreanWordStem(단어))`(같으면 하나).
3. 기준 = `Math.max(2, Math.ceil(words.length * 2 / 3))`.
4. 결과마다 비어 있지 않은 `title_primary`·`title_original`·`series_title`·`match_titles`를 `compactSearchText`한 목록에서, 비교 형태 중 하나라도 들어 있는 단어 수를 센다. 기준 이상이면 남긴다. `matched_via`는 보지 않는다. 결과 순서는 유지한다.

**`searchCacheScope` 판정**
1. `compact-title` → `` `compact-title:${variant.compactQuery}` ``
2. `relaxed-words` → `` `relaxed-words:${(variant.words ?? []).join(" ")}` ``
3. 그 밖(`direct`) → `variant.matchMode`

**`filterResponseForVariant`(35~41행) 변경** — 새 분기만 앞에 추가한다. 기존 두 분기는 그대로다.
```ts
export function filterResponseForVariant(
  response: AdapterSearchResponse, variant: SearchQueryVariant
): AdapterSearchResponse {
  if (variant.matchMode === "relaxed-words") {
    const results = filterResultsByRelaxedWords(response.results, variant.words ?? []);
    return { ...response, results, total: results.length };
  }
  if (variant.matchMode !== "compact-title") return response;
  const results = filterResultsByCompactQuery(response.results, variant.compactQuery);
  return { ...response, results, total: results.length };
}
```

**`planKoreanRelaxedWordFallback` 판정 순서** — 처음 걸린 이유로 끝낸다. 실행하지 않는 경우 `variants`는 `[]`다.
1. `page !== 1` → `"page"`
2. `sources`에 `"tmdb"`가 없음 → `"no_tmdb"`
3. `q = compactSearchText(collapseWhitespace(query))`에 한글(`/[가-힣]/`)이 없거나 자모(`/[ᄀ-ᇿ㄰-㆏]/`)가 있음 → `"not_eligible"`
4. `parseSeasonQuery(collapseWhitespace(query)) !== null` → `"season"`
5. `extractRelaxedSearchWords(query).length < 2` → `"single_word"`
6. `priorResults` 중 하나라도 공백 뺀 제목(`title_primary`·`title_original`·`series_title`·`match_titles`)에 `q`가 들어 있음 → `"has_match"`. 역방향 포함·`season_relation` 통과는 세지 않는다(D-4).
7. `remainingMs < RELAXED_WORD_MIN_REMAINING_MS` → `"time"`
8. `variants = createKoreanRelaxedWordVariants(query, existingVariants)`. 비면 `"not_eligible"`, 아니면 `"run"`.

### 6.2 `supabase/functions/search-content/index.ts`
- import(5~12행)에 `planKoreanRelaxedWordFallback`, `searchCacheScope`를 추가한다.
- `SearchResponse`(37~53행)에 `relaxed_word_fallback?: boolean;`을 `anime_follow_up` 다음에 추가한다.
- **4단계**: 3단계(171~178행) 바로 뒤에 넣는다.
  ```ts
  const relaxedPlan = planKoreanRelaxedWordFallback({
    query: normalizedQuery, page, sources: targetSources,
    remainingMs: requestDeadline - Date.now(),
    existingVariants: [...queryVariants, ...plan.variants, ...followUp.variants],
    priorResults: compactResults([...primary.results, ...fallback.results, ...animeFollowUp.results])
  });
  const relaxed: VariantSearchOutcome = relaxedPlan.reason === "run"
    ? await searchQueryVariants(adminClient, ["tmdb"], relaxedPlan.variants, fetchMediaType, page,
      Math.min(ADAPTER_TIMEOUT_MS, requestDeadline - Date.now() - 1000))
    : { results: [], totals: [], hasNextPage: false, successfulSources: [], failedSources: [], misses: 0 };
  ```
- **합치기**
  - 179행 `unfilteredResults = compactResults([...primary.results, ...fallback.results, ...animeFollowUp.results, ...relaxed.results])`
  - 189~191행 `successfulSources`·`failedSources` 후보에 `relaxed`를 더한다. `failedSources`는 지금처럼 `successfulSources`에 없는 것만이다.
  - 201행 `cached`: `primary.misses + fallback.misses + animeFollowUp.misses + relaxed.misses === 0`
  - 204행 `total`: `Math.max(results.length, ...primary.totals, ...fallback.totals, ...animeFollowUp.totals, ...relaxed.totals)`
  - 206행 **`hasNextPage: primary.hasNextPage`는 그대로다**(D-7).
  - 212행 다음에 `relaxed_word_fallback: relaxedPlan.reason === "run"`을 추가한다.
- `createQueryHash`(493~510행)의 499~502행 `cacheScope` 계산을 `const cacheScope = searchCacheScope(variant);`로 바꾼다. 나머지(해시 입력 문자열 형식)는 그대로다.
- `searchQueryVariants`(227~311행)는 바꾸지 않는다. 281행 `filterResponseForVariant`가 새 모드를 처리한다.
- 국가·장르 필터, `annotateFilterMatches`, 503 `ALL_APIS_FAILED` 조건, 탐색 모드(`respondWithCountryBrowse`)는 바꾸지 않는다.

### 6.3 골든 검사
- `scripts/searchGolden.ts`: 39행(`SEARCH_GOLDEN_SHORT_SPACING_CASES` 끝) 뒤에 추가한다. 기존 목록·`evaluateGoldenCase`는 바꾸지 않는다.
  ```ts
  export const SEARCH_GOLDEN_RELAXED_WORD_CASES: readonly GoldenExpectation[] = [
    { query: "추방당한 치트", mustInclude: [{ externalId: "313346" }] },
    { query: "추방당한 치트 부여 마술사", mustInclude: [{ externalId: "313346" }] },
    { query: "추방당한 치트 부여 마술사는 자유로운 세컨드 라이프를 구가한다", mustInclude: [{ externalId: "313346" }] },
    { query: "자유로운 세컨드 라이프", mustInclude: [{ externalId: "313346" }] },
    { query: "추방당한 마술사는", mustInclude: [{ externalId: "313346" }] },
    { query: "파티에서 추방된 치유사", mustInclude: [{ externalId: "244625" }] },
  ];
  ```
- `scripts/search-golden.ts`
  1. 6행 import와 25행 `expectations`에 새 목록을 더한다.
  2. 22행 구조 분해에 `planKoreanRelaxedWordFallback`을 더한다.
  3. 28·44행의 인라인 변형 타입을 `{ query: string; matchMode: "direct" | "compact-title" | "relaxed-words"; compactQuery: string; words?: readonly string[] }`로 넓힌다.
  4. 52행(2단계 재현) 뒤에 4단계를 재현한다.
     ```ts
     const priorResults = compactResults([...primaryResults, ...fallbackResults.flat()]);
     const relaxedPlan = planKoreanRelaxedWordFallback({
       query: expectation.query, page: 1, sources: ["tmdb"], remainingMs: Number.POSITIVE_INFINITY,
       existingVariants: [...variants, ...plan.variants], priorResults
     });
     // relaxedPlan.reason === "run"이면 2단계와 같은 방식(searchTmdb → filterResponseForVariant, 실패는 경고 후 [])으로 검색한다.
     ```
  5. 53행 판정은 `compactResults([...priorResults, ...relaxedResults.flat()])`로 한다. 요약은 `통과 29/29`다.

## 7. 데이터 모델 / SQL
변경 없음. DB 마이그레이션을 만들지 않는다.

## 8. 화면 명세
화면 변경은 없다. 검색 탭 빈 상태 문구(`app/search.tsx` 1017~1018행)는 그대로다. 4단계로 찾은 카드의 제목은 TMDB 한국어 제목(예: "추방된 치트 부여 마술사는 제멋대로 세컨드 라이프를 구가한다.")이다. 공식 제목으로 바꾸지 않는다(12장).

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | "추방당한 치트"(동사 형태 차이) | 1·2단계 0건 → 4단계 `치트 추방`·`치트` → 313346만 | RV-1, RP-1, RF-1, 골든 |
| E-2 | 공식 제목 전체를 넣음(부제 없이 8단어) | 앞 6단어로 4단계 → 313346 | RW-3, RV-3, RF-3, 골든 |
| E-3 | 낱말 차이("자유로운" ↔ "제멋대로") | 3단어 중 2단어 기준으로 313346 포함 | RV-4, RF-2, 골든 |
| E-4 | 모든 단어가 활용 단어("추방당한 마술사는") | 어간 한 단어 질의 `추방`·`마술사` → 313346 | RV-6, 골든 |
| E-5 | 사용자가 동사 형태를 반대로 씀("파티에서 추방된 치유사") | `치유사 파티` 등 → 244625 | RV-5, 골든 |
| E-6 | 앞 단계 결과가 검색어 안에 든 짧은 제목뿐("자유로") | 4단계 실행(역방향 포함은 맞음으로 세지 않음) | RP-8 |
| E-7 | 앞 단계 결과가 검색어와 무관한 AniList `season_relation` 카드뿐 | 4단계 실행(맞음으로 세지 않음). 카드 누수 자체는 `docs/67`에서 고친다 | RP-9 |
| E-8 | 앞 단계 결과에 검색어를 담은 제목이 있음(`title_primary`·`title_original`·`series_title`·`match_titles`) | 4단계 없음 | RP-7, RP-11 |
| E-9 | 잘 되던 검색어(골든 23개, "오징어게임" 등) | 4단계 없음, 결과·호출 수 불변 | GN-1, M-2 |
| E-10 | 한 단어("추방당한치트", "기생충") 또는 2글자 이상 단어가 하나("그 해 우리는") | 4단계 없음 | RP-6, RW-4 |
| E-11 | 시즌 표기("추방당한 치트 2기") | 4단계 없음(`season`) | RP-5 |
| E-12 | 한글 없음("squid game"), 입력 중 자모("추방당한 치ㅌ") | 4단계 없음 | RP-4 |
| E-13 | 2페이지 이상 | 4단계 없음, `hasNextPage`는 1단계 기준 | RP-2, 6.2 |
| E-14 | 1단계 소스에 TMDB 없음 | 4단계 없음 | RP-3 |
| E-15 | 남은 시간 2,500ms 미만 | 4단계 없음(경계 2,500은 실행) | RP-10 |
| E-16 | 만들 질의가 모두 앞 단계에서 검색한 문자열 | 다시 검색하지 않음(`not_eligible`) | RV-7, RP-12 |
| E-17 | 넓은 4단계 질의가 무관한 작품을 받음("더블 치트 -거짓 경관-") | 단어 덮기로 제외 | RF-1, RR-1 |
| E-18 | 공백·문장부호·중복 단어 | 같은 단어 목록 | RW-2, RW-4 |
| E-19 | 숫자·라틴 문자 섞임("SPY×FAMILY 극장판") | 기호로 나누고 소문자로 | RW-5 |
| E-20 | 단어 6개 초과 | 앞 6개만, 기준 4개 | RW-3, RF-3 |
| E-21 | 어간이 명사 끝을 잘못 뗌("미식가" → "미식") | 판정만 느슨해지고 오류 없음 | ST-4 |
| E-22 | 활용 단어의 어간이 핵심 단어와 같음("치트는 치트 부여") | 그 어간으로는 1번 질의를 만들지 않음 | RV-9 |
| E-23 | 4단계 변형에 `words`가 없음(방어) | 결과 0개 | RR-2, RF-6 |
| E-24 | 4단계 TMDB 실패, 1단계 TMDB 성공 | 다른 단계 결과로 응답, `failedSources`에 TMDB 없음 | 6.2(기존 로직) |
| E-25 | 같은 검색을 다시 함 | 4단계도 캐시에서 읽음, 기존 모드 캐시 키 불변 | CS-1, CS-2, M-3 |
| E-26 | 장르·국가 필터가 켜진 상태 | 4단계 결과도 같은 필터 판정·표시(`filter_match`)를 거침 | 6.2 |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.**
- 기존 테스트는 고치지 않는다. 특히 `normalize.test.ts`의 변형 목록 테스트, WS·WP·CF·AF 행과 `searchGolden.test.ts` G-6~G-8은 그대로 통과해야 한다(D-1, D-9).
- 보존 테스트는 없다. 아래 행은 구현 전에 새 export가 없어 모두 실패해야 한다. 새 export는 기존 방식대로 네임스페이스(`spacingContract.<이름>`, `spacingGoldenContract.<이름>`)로 불러 누락이 테스트 실패로 보이게 한다.
- 결과 객체는 `normalize.test.ts`의 기존 픽스처 `result(titlePrimary, titleOriginal, overrides)`(16~34행)로 만든다. 아래 `A`는 `"추방된 치트 부여 마술사는 제멋대로 세컨드 라이프를 구가한다."`다.

### `supabase/functions/search-content/adapters/normalize.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| RW-1 | `extractRelaxedSearchWords("추방당한 치트")` | `["추방당한","치트"]` |
| RW-2 | `("  추방당한   치트 ")`, `("추방당한, 치트!")` | RW-1과 같음 |
| RW-3 | `("추방당한 치트 부여 마술사는 자유로운 세컨드 라이프를 구가한다")` | `["추방당한","치트","부여","마술사는","자유로운","세컨드"]`(6개 상한) |
| RW-4 | `("그 해 우리는")` / `("치트 치트 부여")` | `["우리는"]` / `["치트","부여"]` |
| RW-5 | `("SPY×FAMILY 극장판")` | `["spy","family","극장판"]` |
| RW-6 | `("추방당한치트")` / `("")` | `["추방당한치트"]` / `[]` |
| ST-1 | `koreanWordStem`: `추방당한`, `추방된`, `자유로운`, `마술사는`, `파티에서`, `구가한다` | `추방`, `추방`, `자유`, `마술사`, `파티`, `구가` |
| ST-2 | `치트`, `세컨드`, `대한`, `그는`, `spy`, `2기`, `당한` | 모두 입력 그대로 |
| ST-3 | `못하는`, `되는` | `못하`(긴 항목을 떼면 1자라 다음 항목), `되는` |
| ST-4 | `미식가`, `고양이`, `진격의` | `미식`, `고양`, `진격` |
| RV-1 | `createKoreanRelaxedWordVariants("추방당한 치트")` | `[{ query: "치트 추방", matchMode: "relaxed-words", compactQuery: "추방당한치트", words: ["추방당한","치트"] }, { query: "치트", matchMode: "relaxed-words", compactQuery: "추방당한치트", words: ["추방당한","치트"] }]` |
| RV-2 | `("추방당한 치트 부여 마술사")` | 질의 `["치트 부여 마술사 추방","치트 부여 마술사","부여 마술사","치트 마술사"]`(4개 상한) |
| RV-3 | `("추방당한 치트 부여 마술사는 자유로운 세컨드 라이프를 구가한다")` | 질의 `["치트 부여 세컨드 추방","치트 부여 세컨드 마술사","치트 부여 세컨드","부여 세컨드"]` |
| RV-4 | `("자유로운 세컨드 라이프")` | 질의 `["세컨드 라이프 자유","세컨드 라이프","라이프","세컨드"]` |
| RV-5 | `("파티에서 추방된 치유사")` | 질의 `["치유사 파티","치유사 추방","치유사"]` |
| RV-6 | `("추방당한 마술사는")` | 질의 `["추방","마술사"]` |
| RV-7 | `("추방당한 치트", [{ query: "치트", matchMode: "direct", compactQuery: "추방당한치트" }])` | 질의 `["치트 추방"]` |
| RV-8 | `("추방당한치트")`, `("")`, `("치")` | 모두 `[]` |
| RV-9 | `("치트는 치트 부여")` | 질의 `["치트 부여","부여","치트"]` |
| RF-1 | `filterResultsByRelaxedWords([result(A), result("더블 치트 -거짓 경관-"), result("파티에서 추방당한 그 치유사, 실은 최강인 것에 대하여")], ["추방당한","치트"])` | 제목 `[A]` |
| RF-2 | `([result("어 세컨드 라이프"), result("자유로"), result(A)], ["자유로운","세컨드","라이프"])` | 제목 `["어 세컨드 라이프", A]` |
| RF-3 | `([result(A), result("치트 부여 세컨드"), result("추방된 치트 부여 마술사")], RW-3 결과)` | 제목 `[A, "추방된 치트 부여 마술사"]`(3단어만 맞은 결과 제외) |
| RF-4 | `([result("Other", "추방된 치트 부여 마술사"), result("Other2", null, { match_titles: [A] }), result("시즌 2", null, { series_title: A }), result("무관")], ["추방당한","치트"])` | 제목 `["Other","Other2","시즌 2"]` |
| RF-5 | `([result("용사 파티에 귀여운 애가 있어서, 고백해봤다. 2기", null, { matched_via: "season_relation" })], ["파티에서","추방된","치유사"])` | `[]` |
| RF-6 | `([result(A)], ["치트"])` | `[]` |
| RR-1 | `filterResponseForVariant({ source: "tmdb", results: [result(A), result("더블 치트 -거짓 경관-")], total: 12, hasNextPage: true }, { query: "치트", matchMode: "relaxed-words", compactQuery: "추방당한치트", words: ["추방당한","치트"] })` | 결과 제목 `[A]`, `total: 1`, `hasNextPage: true` |
| RR-2 | RR-1에서 변형의 `words` 없음 | `results: []`, `total: 0` |
| CS-1 | `searchCacheScope({ query: "신사의 품격", matchMode: "direct", compactQuery: "신사의품격" })` / `({ query: "신사의", matchMode: "compact-title", compactQuery: "신사의품격" })` | `"direct"` / `"compact-title:신사의품격"` |
| CS-2 | `searchCacheScope({ query: "치트", matchMode: "relaxed-words", compactQuery: "추방당한치트", words: ["추방당한","치트"] })` | `"relaxed-words:추방당한 치트"` |
| RP-1 | `planKoreanRelaxedWordFallback(기본)`. 기본 = `{ query: "추방당한 치트", page: 1, sources: ["tmdb","anilist"], remainingMs: 7000, existingVariants: createSearchQueryVariants("추방당한 치트"), priorResults: [] }` | `reason: "run"`, 질의 `["치트 추방","치트"]` |
| RP-2 | 기본에서 `page: 2` | `{ variants: [], reason: "page" }` |
| RP-3 | 기본에서 `sources: ["anilist"]` | `{ variants: [], reason: "no_tmdb" }` |
| RP-4 | 기본에서 `query: "squid game"` / `query: "추방당한 치ㅌ"` | 둘 다 `{ variants: [], reason: "not_eligible" }` |
| RP-5 | 기본에서 `query: "추방당한 치트 2기"` | `{ variants: [], reason: "season" }` |
| RP-6 | 기본에서 `query: "추방당한치트"` / `query: "그 해 우리는"` | 둘 다 `{ variants: [], reason: "single_word" }` |
| RP-7 | 기본에서 `priorResults: [result("추방당한 치트 부여 마술사는 자유로운 세컨드 라이프를 구가한다")]` | `{ variants: [], reason: "has_match" }` |
| RP-8 | 기본에서 `query: "자유로운 세컨드 라이프"`, `existingVariants: createSearchQueryVariants("자유로운 세컨드 라이프")`, `priorResults: [result("자유로")]` | `reason: "run"`, 질의 `["세컨드 라이프 자유","세컨드 라이프","라이프","세컨드"]`. 같은 테스트에서 `filterResultsByCompactQuery([result("자유로")], "자유로운세컨드라이프").length === 1`도 단언한다(기존 필터는 맞음으로 셈) |
| RP-9 | 기본에서 `query: "파티에서 추방된 치유사"`, `existingVariants: createSearchQueryVariants("파티에서 추방된 치유사")`, `priorResults: [result("용사 파티에 귀여운 애가 있어서, 고백해봤다. 2기", null, { external_source: "anilist", content_type: "anime", matched_via: "season_relation" })]` | `reason: "run"`, 질의 `["치유사 파티","치유사 추방","치유사"]`. 같은 테스트에서 같은 결과에 대한 `filterResultsByCompactQuery(…, "파티에서추방된치유사").length === 1`도 단언한다 |
| RP-10 | 기본에서 `remainingMs: 2499` / `2500` | `{ variants: [], reason: "time" }` / `reason: "run"` |
| RP-11 | 기본에서 `priorResults`를 각각 `[result("Other", null, { match_titles: ["추방당한 치트 부여 마술사"] })]`, `[result("시즌 1", null, { series_title: "추방당한 치트 부여 마술사" })]`, `[result("Other", "추방당한 치트 부여 마술사")]` | 셋 다 `{ variants: [], reason: "has_match" }` |
| RP-12 | 기본에서 `existingVariants`에 `{ query: "치트 추방", matchMode: "compact-title", compactQuery: "추방당한치트" }`, `{ query: "치트", matchMode: "direct", compactQuery: "추방당한치트" }`를 더함 | `{ variants: [], reason: "not_eligible" }` |

### `scripts/searchGolden.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| G-9 | `SEARCH_GOLDEN_RELAXED_WORD_CASES`의 `[query, externalId[]]` | `[["추방당한 치트",["313346"]],["추방당한 치트 부여 마술사",["313346"]],["추방당한 치트 부여 마술사는 자유로운 세컨드 라이프를 구가한다",["313346"]],["자유로운 세컨드 라이프",["313346"]],["추방당한 마술사는",["313346"]],["파티에서 추방된 치유사",["244625"]]]` |

### 네트워크 검사 (읽기 전용 TMDB, `npm test` 밖)
| ID | 명령 | 기대 |
|----|------|------|
| GN-1 | `npm run search:golden` | `통과 29/29`(기존 23 + 단어 완화 6). 4단계 재현을 넣기 전에는 새 6개가 실패해 `통과 23/29`다 |

### 수동 확인
배포 전에는 웹이 운영 `search-content`(v28)를 부른다. 그래서 M-1~M-4는 배포 후 사람이 확인한다.

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 (배포 후) | "추방당한 치트" 검색 → "추방된 치트 부여 마술사는 제멋대로 세컨드 라이프를 구가한다."(2026, 애니) 카드. 네트워크 응답 `relaxed_word_fallback: true`. 카드에서 추가하면 라이브러리에 보인다 |
| M-2 | 웹 8081 (배포 후) | "오징어게임"·"너말고다른"·"진격의 거인" → 기존과 같은 결과, `relaxed_word_fallback: false` |
| M-3 | 웹 8081 (배포 후) | M-1을 다시 검색 → 같은 결과, 응답 `cached: true` |
| M-4 | 앱(iOS 세로, 배포 후) | "추방당한 치트 부여 마술사" 검색 → M-1과 같은 카드 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/search-content/adapters/normalize.ts` | 6.1: `SearchQueryVariant` 확장, 상수·함수 추가, `filterResponseForVariant` 새 분기. 다른 기존 함수는 바꾸지 않는다 |
| `supabase/functions/search-content/adapters/normalize.test.ts` | RW-1~RW-6, ST-1~ST-4, RV-1~RV-9, RF-1~RF-6, RR-1~RR-2, CS-1~CS-2, RP-1~RP-12 |
| `supabase/functions/search-content/index.ts` | 6.2 |
| `scripts/searchGolden.ts` | `SEARCH_GOLDEN_RELAXED_WORD_CASES` |
| `scripts/searchGolden.test.ts` | G-9 |
| `scripts/search-golden.ts` | 6.3 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| AniList 앞부분 질의가 받은 무관한 작품의 펼친 시즌 카드("…2기")가 화면에 남는 문제(2.4의 2번) | `filterResultsByCompactQuery`의 `season_relation` 통과(143행)를 고쳐야 한다. 시즌 검색("N기")은 기본 작품 없이 시즌만 돌려주므로 "기본 작품이 걸러지면 시즌도 거름"을 docs/15·62와 함께 따져야 하는 별도 결함이다. `docs/67_anilist_season_card_leak_fixes_spec.md`에서 다룬다 |
| 역방향 포함으로 남는 짧은 제목("자유로운 세컨드 라이프" → 영화 "자유로") | 검색어가 제목보다 긴 입력(제목 + 덧붙인 말)을 위한 기존 동작이다. 바꾸면 docs/55·56 계약이 바뀐다 |
| 카드 제목을 국내 공식 제목으로 바꾸기, 공식 제목 별칭 저장 | 공식 제목 출처(라프텔 등)가 API 소스가 아니다(5장) |
| 4단계로 찾은 TMDB 애니를 AniList와 합치기 | TMDB 카드로 등록할 수 있다. 3단계(docs/62)는 2단계 결과만 본다. 합치려면 시간 예산·필터 모드를 다시 정해야 한다 |
| 시즌 표기 검색어의 단어 완화("추방당한 치트 2기") | D-6의 4번. 시즌 접미어를 질의마다 다시 붙이는 규칙이 필요하다 |
| 인물 검색(`search-person-content`) | 별도 경로 |
| 빈 상태 문구·"비슷한 제목" 안내 | 클라이언트 변경(5장) |
| 4단계를 2단계와 동시에 실행 | 5장 |
| 라이브러리·핀 화면의 로컬 검색, 오타 보정 | 서버 검색과 별개 |
| 2페이지 이상의 4단계 | D-6의 1번, D-7 |

## 13. 확실하지 않음 — 별도 검증 필요
- TMDB 검색 동작(2.2)은 공식 문서가 아니라 실측(2026-10-11 docs/55, 2026-11-08 재확인)이다. 동작이 바뀌면 GN-1이 먼저 실패한다.
- 4단계 질의는 넓다. 1페이지(20건) 안에 원하는 작품이 들어온다는 가정은 6개 사례(작품 2개)에서만 확인했다. 인기도가 낮은 작품은 놓칠 수 있다(특히 핵심 단어가 없어 `추방`·`마술사` 같은 한 단어 질의만 남는 경우).
- 어미·조사 목록(D-2)은 형태소 분석이 아니다. 목록 밖의 활용형(예: `~스럽게`, `~해진`)은 어간을 못 뗀다. 이 경우 그 단어는 핵심 단어로 취급되어 1·2번 질의에 그대로 들어가고, 0건이면 3번(하나씩 뺀 조합)에 맡겨진다.
- TMDB 한국어 번역은 커뮤니티가 언제든 고칠 수 있다. 313346 번역이 공식 제목으로 바뀌면 골든 6개 중 일부는 4단계가 아니라 1단계에서 찾는다. 골든은 단계가 아니라 결과를 보므로 통과는 유지된다.
- 4단계가 돌면 TMDB 검색 질의가 최대 4개 는다(앞 단계에 맞는 제목이 없을 때만). `searchTmdb`는 질의마다 TV 결과 앞 3개의 시즌 정보도 조회하므로(`adapters/tmdb.ts` 271~286행) TMDB 요청은 질의당 최대 4회, 4단계 전체로 최대 16회다. 실측 지연은 +0.3~0.5초였고, 운영 호출량은 측정하지 않았다.
- AniList 207329에는 언젠가 한국어 별칭이 생길 수 있다. 이 명세는 그것에 의존하지 않는다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 결함 수정 작업이다.
- 국내 공식 한국어 제목과 TMDB 한국어 제목의 단어 형태가 다르면(예: "추방당한" ↔ "추방된") 검색 결과가 0건이다.
- 기존 1~3단계는 그대로 두고, 앞 단계 결과에 검색어를 담은 제목이 없을 때만 "핵심 단어 + 어간" 질의를 TMDB에 4단계로 보내고, 검색어 단어를 충분히 덮는 결과만 남긴다.

| ID | 증상 |
|----|------|
| F-1 | "추방당한 치트", "추방당한 치트 부여 마술사", 공식 제목 전체, "추방당한 마술사는" 0건, "자유로운 세컨드 라이프"는 무관한 "자유로"만, "파티에서 추방된 치유사"는 무관한 "…2기" 카드만 나온다(찾아야 할 작품: TMDB 313346, 244625) |

# READ FIRST
1. 이 명세서 1~13장. 원인은 2장(TMDB 단어 AND, 판정 허점), 결정은 D-1~D-9, 계약은 6장, 테스트는 10장이다.
2. `docs/55_korean_search_spacing_fallback_spec.md` — 단계 구조·TMDB 단어 규칙·골든 재현 방식. `docs/56_korean_search_spacing_length_fixes_spec.md` D-1·D-3, `docs/62_anime_search_all_seasons_fixes_spec.md` D-2·D-3도 읽는다.
3. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
4. 고칠 파일:
   - `supabase/functions/search-content/adapters/normalize.ts`: 5~9행 `SearchQueryVariant`, 35~41행 `filterResponseForVariant`, 86~95행 `parseSeasonQuery`, 131~151행 `compactSearchText`·`filterResultsByCompactQuery`, 248~250행 `collapseWhitespace`, 309~383행 2·3단계 판정
   - `supabase/functions/search-content/index.ts`: 5~12행 import, 37~53행 `SearchResponse`, 155~213행 검색 흐름·응답, 493~510행 `createQueryHash`
   - `scripts/searchGolden.ts`, `scripts/searchGolden.test.ts`, `scripts/search-golden.ts`

# 시작 상태 (반드시 유지)
- `git status`, `npm test`, `npm run search:golden` 결과를 기록한다.
  - 2026-11-08 기준선: `npm test` 1379/1379 통과, `npm run search:golden` 23/23.
  - 기준선과 다른 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경(시즌별 진행 범위 작업 등)을 되돌리거나 포맷하지 않는다.
- 참고(2026-11-08 이 기기): Homebrew `node` 26.7.0이 `libsimdjson` 누락으로 실행되지 않았다. `/usr/local/bin/node`(v24.14.1)를 `PATH` 앞에 두고 명령을 실행했다. 실행 환경이 다르면 무시한다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** `createSearchQueryVariants`·`createKoreanSpacingHints`·`createKoreanAnchorQueries`·`MAX_QUERY_VARIANTS`·`createKoreanWordSplitVariants`·`planKoreanWordSplitFallback`·`planAniListAnimeFollowUp`·`filterResultsByCompactQuery`·`compactResults`·`SEARCH_CACHE_VERSION`은 바꾸지 않는다. 4단계는 `planKoreanRelaxedWordFallback`이 `"run"`일 때만, 3단계 다음에 실행한다. 기존 테스트를 고치지 않는다.
- **D-2.** 단어는 기호로 나눈 2글자 이상 토큰 앞 6개, 어간은 6장의 어미·조사 목록을 긴 것부터 떼되 2자 이상 남을 때만 뗀다. 핵심 단어는 앞 3개다.
- **D-3.** 질의 순서는 ① 핵심 단어 + 어간(앞 2개, 핵심 단어와 같은 어간 제외) ② 핵심 단어 ③ 하나씩 뺀 조합(핵심 단어 2개 이상) ④ 핵심 단어가 없으면 어간 각각. 앞 단계 질의와 같은 문자열은 빼고 4개에서 자른다.
- **D-4.** 4단계 실행 판정의 "맞는 결과"는 정방향 포함(공백 뺀 검색어 ⊂ 공백 뺀 제목, 제목 필드 네 개)만 센다. 역방향 포함과 `season_relation` 통과는 세지 않는다.
- **D-5.** 4단계 결과는 맞은 단어 수 ≥ `max(2, ceil(단어 수 × 2 / 3))`인 것만 남긴다. 단어는 그 자체 또는 어간이 제목에 들어 있으면 맞음이다.
- **D-6.** 실행 조건 순서(page → no_tmdb → not_eligible → season → single_word → has_match → time → 질의 유무)와 2,500ms, 제한 시간 `min(5000, 남은 시간 − 1000)`을 지킨다.
- **D-7.** 4단계는 TMDB만이다. `hasNextPage`는 1단계로만 정한다. 응답 추가 필드는 `relaxed_word_fallback`뿐이고 클라이언트 파일을 바꾸지 않는다.
- **D-8.** 캐시 범위는 `searchCacheScope`로 계산하고 기존 두 모드 문자열은 바이트 단위로 같다. 캐시 버전을 올리지 않는다.
- **D-9.** 골든 단어 완화 사례는 별도 목록 `SEARCH_GOLDEN_RELAXED_WORD_CASES`로 둔다.

# STEP 1 — 실패하는 테스트부터
- 10장 RW-1~RW-6, ST-1~ST-4, RV-1~RV-9, RF-1~RF-6, RR-1~RR-2, CS-1~CS-2, RP-1~RP-12를 `normalize.test.ts`에, G-9를 `scripts/searchGolden.test.ts`에 추가한다(41개 + 1개).
- 새 export는 네임스페이스(`spacingContract.<이름>`, `spacingGoldenContract.<이름>`)로 부른다.
- `npm test`로 새 테스트가 전부 실패하는지 눈으로 확인한다. 하나라도 통과하면 멈추고 보고한다. 이번 명세에는 보존 테스트가 없다.

# STEP 2 — 순수 함수
- `normalize.ts`에 6.1의 타입 확장·상수·함수를 추가하고 `filterResponseForVariant`에 새 분기를 넣는다. 다른 기존 함수의 동작은 바꾸지 않는다.
- `createKoreanRelaxedWordVariants` 위에 근거를 짧은 주석으로 남긴다: TMDB는 모든 단어가 맞아야 하고 마지막 단어만 앞부분 일치를 허용한다. 그래서 마지막이 아닌 자리에는 핵심 단어, 마지막 자리에는 어간을 둔다(docs/66 D-3).
- `planKoreanRelaxedWordFallback`의 6번 판정 옆에 근거를 남긴다: 역방향 포함·`season_relation` 통과는 무관한 결과로 보정을 막는다(docs/66 2.4).
- RW·ST·RV·RF·RR·CS·RP 행이 통과해야 한다.

# STEP 3 — Edge Function 4단계
`search-content/index.ts`를 6.2대로 바꾼다.
- 1~3단계 동작(결과 순서, 캐시 읽기·쓰기, 실패 소스 판정)이 그대로인지 diff로 확인한다.
- 4단계 소스는 `["tmdb"]`만이다. `hasNextPage`는 `primary.hasNextPage`다.
- `createQueryHash`는 `cacheScope` 계산만 `searchCacheScope(variant)`로 바뀐다.

# STEP 4 — 골든 검사
- `scripts/searchGolden.ts`에 6개 사례를 추가하고, `scripts/search-golden.ts`의 import·`expectations`·인라인 타입만 먼저 바꾼다(6.3의 1·3번).
- 이 상태로 `npm run search:golden`을 실행해 `통과 23/29`(새 6개 실패)를 확인한다.
- 6.3의 2·4·5번(4단계 재현)을 넣고 `통과 29/29`를 확인한다(GN-1). 네트워크가 막혀 실행할 수 없으면 사유를 보고한다.

# 엣지 케이스 (전부 처리, 명세서 9장)
9장 E-1~E-26 전부. 각 행의 테스트 ID를 지킨다.

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
- `npm test`: 기준선 1379개 + 새 테스트 42개(normalize 41, G-9 1). 실패 0이어야 한다.
- esbuild는 Edge Function 문법 검사다(typecheck·lint는 `supabase/functions`를 제외한다). 오류 0이어야 한다.
- `search:golden`: `통과 29/29`(읽기 전용 TMDB 호출, 키 출력 금지).

# DEFINITION OF DONE
- [ ] RW·ST·RV·RF·RR·CS·RP 41개와 G-9가 수정 전에 실패했고 수정 후 통과한다
- [ ] 기존 테스트 개수가 줄지 않았고, 기존 테스트 파일의 기존 행 diff가 없다
- [ ] D-1의 함수·상수 본문 diff가 없다(`filterResponseForVariant`는 새 분기 추가만, `createQueryHash`는 `cacheScope` 줄만)
- [ ] 4단계는 TMDB만, 1페이지만, `planKoreanRelaxedWordFallback`이 `"run"`일 때만 실행된다
- [ ] `hasNextPage`가 1단계 결과로만 정해지고, 응답에 `relaxed_word_fallback`이 있다
- [ ] `typecheck`·`lint`·esbuild·`git diff --check` 통과, `search:golden` 23/29 → 29/29(또는 실행 못 한 사유)

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
supabase/functions/search-content/adapters/normalize.ts
supabase/functions/search-content/adapters/normalize.test.ts
supabase/functions/search-content/index.ts
scripts/searchGolden.ts
scripts/searchGolden.test.ts
scripts/search-golden.ts
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력(요약)
2. `npm test` before / after 통과 개수, `typecheck`·`lint`·esbuild·`git diff --check` 결과
3. `npm run search:golden` before(23/23) / 중간(23/29) / after(29/29) 결과
4. 추가한 테스트 ID와 이름
5. index.ts에서 1~3단계 동작과 기존 캐시 키가 그대로인지 확인한 방법(diff 요약)
6. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
7. 사람이 할 후속 작업: `search-content` 재배포(운영 v28). 배포 전 `npm run edge:drift`로 함께 나가는 다른 변경(`_shared/http.ts` 등)을 확인하고, 배포 후 10장 M-1~M-4를 확인한다

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다. 특히 2.4의 기존 필터(역방향 포함·`season_relation` 통과)는 고치지 않는다(12장).
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- TMDB 키 등 비밀 값을 출력하지 않는다.
