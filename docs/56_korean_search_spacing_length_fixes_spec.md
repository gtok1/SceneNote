# 56. 붙여 쓴 검색어 보정 — 글자 수 조건 제거

작성일: 2026-10-11
대상 브랜치 기준: `main` (`c6a0e7e`) + 미커밋 작업(`docs/44`~`55`). `search-content` v27 배포 상태(2026-10-11 22:53, docs/55 포함)다. 이 시점 `npm test`는 1126개 중 1125개 통과다. 실패 1개("uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함이다. `npm run search:golden`은 19/19다.
선행 문서: `docs/55_korean_search_spacing_fallback_spec.md`(띄어쓰기 2단계 보정)

> **근거.** 사용자 캡처(웹, v27 배포 후). "너말고" 검색 결과가 "검색 결과가 없습니다"다.
> 사용자 요청: "공백제거로 제목 검색되는 개념이야 글자수를 체크하지말고"

---

## 1. 문제 정의
| ID | 증상 |
|----|------|
| F-1 | 붙여 쓴 검색어가 3글자 이하("너말고", "너말", "그해우")면 docs/55 보정이 실행되지 않아 0건이다. 띄어 쓴 "너 말고"는 나온다. |

## 2. 근본 원인
docs/55는 보정 대상을 "붙여 쓴 검색어 4글자 이상"으로 제한했다. `supabase/functions/search-content/adapters/normalize.ts`의 세 곳이다.

| 행 | 코드 | 결과 |
|----|------|------|
| 318 | `createKoreanWordSplitVariants`: `if (chars.length < 4 …) return []` | 3글자 이하는 2단계 질의를 만들지 않는다 |
| 342 | `planKoreanWordSplitFallback`: `if (Array.from(q).length < 4 …) return { reason: "not_eligible" }` | 3글자 이하는 2단계를 실행하지 않는다 |
| 140 | `filterResultsByCompactQuery`: `if (compactQuery.length < 4) return results;` | 3글자 이하는 "공백 뺀 제목에 검색어가 들어 있는가"를 보지 않고 전부 통과시킨다. 그래서 4글자 조건만 풀면 2단계 넓은 질의의 잡음이 그대로 나오고, 1단계 "맞는 결과" 판정도 아무 결과에나 참이 된다 |

사용자 기준은 글자 수가 아니라 **"공백을 뺀 검색어가 공백을 뺀 제목에 들어 있으면 찾는다"**이다.

2026-10-11 실측(TMDB, 글자 수 조건을 뺀 시험 코드):

| 검색어 | 2단계 질의 | 결과 |
|--------|-----------|------|
| 너말고 | `너 말`, `너말 고` | 너 말고 니 언니, **너 말고 다른 연애** |
| 너말 | `너 말` | 너 말고 니 언니, **너 말고 다른 연애** |
| 그해우 | `그 해`, `그해 우` | **그 해 우리는**, 그 해 우리가 여행지에서 가져온 것들, 그해 우리가 발견한 것 |
| 선재업 | `선 재`, `선재 업` | **선재 업고 튀어** |
| 괴물, 파묘, 무빙, 오징어, 그해 | 실행 안 함(1단계에서 공백 뺀 제목 일치) | 기존과 같음 |

## 3. 재현 시나리오
1. 웹 8081에 로그인한 뒤 검색 탭에서 "너말고"를 입력한다.
2. "검색 결과가 없습니다"가 나온다. "너 말고 다른 연애"가 나와야 한다.

## 4. 설계 결정

### D-1 (최우선). 보정 기준은 "공백 뺀 검색어 ⊂ 공백 뺀 제목" 하나다. 글자 수 조건을 두지 않는다
- `createKoreanWordSplitVariants`, `planKoreanWordSplitFallback`, `filterResultsByCompactQuery`에서 글자 수 하한을 없앤다.
- 2단계 질의는 docs/55 D-2와 같이 "앞 k글자 + 공백 + 다음 1글자"이고, k는 1~min(4, 글자 수−1)이다.
  - 1글자 검색어는 나눌 곳이 없어 변형이 0개다. 이것은 글자 수 검사가 아니라 나눌 위치가 없어서 생기는 결과다.
  - 앱은 원래 2글자부터 검색한다(`app/search.tsx` 135행 `query.trim().length >= 2`).
- `MAX_WORD_SPLIT_VARIANTS = 4`는 변형 개수 상한이라 그대로 둔다.

### D-2. `filterResultsByCompactQuery`는 검색어가 비어 있을 때만 거르지 않는다
- 140행을 `if (!compactQuery) return results;`로 바꾼다.
- 판정은 그대로다: 공백 뺀 제목(`title_primary`·`title_original`·`match_titles`)에 검색어가 들어 있거나 그 반대이면 통과, `season_relation`이면 통과.
- 1단계 영향은 없다. 1단계 `compact-title` 변형은 `createKoreanAnchorQueries`(282~285행)가 4글자 이상일 때만 만든다. 그래서 1단계 `filterResponseForVariant` 결과는 바뀌지 않는다. 바뀌는 것은 짧은 검색어의 2단계 결과와 "맞는 결과" 판정뿐이다.

### D-3. 입력 중인 자모가 섞인 검색어는 2단계를 하지 않는다
- 공백 뺀 검색어에 한글 자모(`/[ᄀ-ᇿ㄰-㆏]/`)가 있으면 `not_eligible`이다.
- 검색은 입력할 때마다 실행되어 "너말ㄱ" 같은 조합 중 상태도 서버에 간다.
- `compactSearchText`의 NFKC가 `ㄱ`(U+3131)을 U+1100으로 바꾼다(실측). 그래서 두 범위를 모두 본다.
- 자모가 든 검색어는 공백을 뺀 어떤 제목에도 들어 있을 수 없으므로, 2단계 TMDB 호출이 결과 없이 낭비된다. 결과 판정을 바꾸지 않고 호출만 아끼는 조건이다.

### D-4. 나머지 docs/55 결정은 그대로다
- 1단계 변형(`createSearchQueryVariants`)은 바꾸지 않는다.
- 2단계는 TMDB 소스만, 1페이지만 실행한다. 남은 시간이 3,000ms 이상이어야 한다.
- `hasNextPage`는 1단계 결과로만 정한다.
- 캐시 키 규칙·버전, 응답 `word_split_fallback`은 그대로다.
- `search-content/index.ts`는 바꾸지 않는다(판정은 `planKoreanWordSplitFallback`이 한다).

### D-5. 골든 검사
- 짧은 검색어 사례 4개는 별도 목록 `SEARCH_GOLDEN_SHORT_SPACING_CASES`로 추가한다: 너말고, 너말, 그해우, 선재업.
- 기존 두 목록과 G-6·G-7은 그대로 둔다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| 하한을 4에서 3이나 2로 낮춤 | 사용자 기준(글자 수를 보지 않음)과 다르다. 다른 길이에서 같은 문제가 남는다 |
| 1단계 앞부분 변형(`createKoreanAnchorQueries`)의 4글자 조건까지 제거 | 2단계가 짧은 검색어를 이미 처리한다. 1단계 변형·캐시·기존 테스트를 바꿀 이유가 없다 |
| 자모 조건 없이 그대로 실행 | 결과는 같고 호출만 낭비된다(D-3) |

## 6. 계약 (`supabase/functions/search-content/adapters/normalize.ts`)
- **140행** `filterResultsByCompactQuery`: `if (compactQuery.length < 4) return results;` → `if (!compactQuery) return results;`. 나머지 판정은 그대로다.
- **`createKoreanWordSplitVariants`** 판정:
  1. `q = compactSearchText(collapseWhitespace(query))`, `chars = Array.from(q)`.
  2. `q`에 한글(`/[가-힣]/`)이 없거나 자모(`/[ᄀ-ᇿ㄰-㆏]/`)가 있으면 `[]`다. 글자 수 검사는 없다.
  3. k = 1부터 `min(MAX_WORD_SPLIT_VARIANTS, chars.length − 1)`까지 docs/55 6.1과 같이 만든다(중복·기존 변형 제외, `compact-title`, `compactQuery: q`).
- **`planKoreanWordSplitFallback`** 판정 순서: page → no_tmdb → not_eligible → has_match → time → 변형 생성.
  - not_eligible: 한글이 없거나 자모가 있으면 해당한다. 글자 수 검사는 없다.
  - 변형이 0개여도 `"not_eligible"`이다(1글자 검색어).
  - has_match 판정은 D-2로 바뀐 `filterResultsByCompactQuery`가 한다.
- 새 상수를 만들지 않는다. 다른 export의 시그니처는 그대로다.

## 7. 데이터 모델 / SQL
변경 없음.

## 8. 화면 명세
변경 없음.

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | "너말고"(3글자), 1단계 0건 | 2단계 `너 말`·`너말 고` → 너 말고 다른 연애 | WS-9, WP-9, G-8 |
| E-2 | "너말"(2글자) | 2단계 `너 말` | WS-10, WP-12, G-8 |
| E-3 | "그해우", "선재업" | 2단계로 찾음 | WS-10, G-8 |
| E-4 | 짧은 검색어인데 1단계에 공백 뺀 제목 일치("괴물", "그해") | 2단계 없음 | WP-10 |
| E-5 | 짧은 검색어, 1단계 결과가 관련 없는 작품뿐 | 2단계 실행(이전에는 무조건 "맞음"으로 판정) | WP-11 |
| E-6 | 2단계 넓은 질의가 관련 없는 제목을 받음(`너 말` → "너의 이름은" 등) | 공백 뺀 제목에 "너말고"가 없어 제외 | CF-1, CF-2 |
| E-7 | 1글자("너") | 나눌 곳이 없어 변형 0개, `not_eligible` | WS-7, WP-4 |
| E-8 | 입력 중 자모("너말ㄱ", "너ㅁ") | 2단계 없음 | WS-11, WP-4 |
| E-9 | 빈 검색어로 필터 호출 | 거르지 않음 | CF-3 |
| E-10 | 4글자 이상(docs/55 사례) | 기존과 같음 | 기존 WS-1~WS-8·WP-1~WP-8, 골든 19개 |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 기존 테스트는 아래 "의도된 수정" 두 행 외에는 고치지 않는다.

### 테스트 성격 (STEP 1 판정용)
- **구현 전에 실패해야 하는 행:** WS-9, WS-10, WP-9, WP-10, WP-11, WP-12, CF-1, CF-2, G-8.
- **구현 전에도 통과하는 행(보존):** WS-11, CF-3. 구현 후 깨지지 않는지를 지키는 테스트다.
- **의도된 수정(보존 성격):** WS-7, WP-4. 기존 기대에서 "너말"·"그해우"를 빼고 아래로 바꾼다. 바꾼 행은 구현 전에도 통과한다.

### `supabase/functions/search-content/adapters/normalize.test.ts`
| ID | 입력 | 기대 |
|----|------|------|
| WS-7 (의도된 수정) | `splitQueries`에 `""`, `"너"`, `"abcd"`, `"squidgame"` | 모두 `[]` |
| WS-9 | `createKoreanWordSplitVariants("너말고")` | 질의 `["너 말","너말 고"]`, 모두 `compact-title`, `compactQuery: "너말고"` |
| WS-10 | `("너말")` / `("그해우")` | `["너 말"]` / `["그 해","그해 우"]` |
| WS-11 (보존) | `("너말ㄱ")`, `("너ㅁ")` | 모두 `[]` |
| WP-4 (의도된 수정) | `splitPlanInput`에서 `query`가 `"너"`, `"squid game"`, `"너말ㄱ"` | 모두 `{ variants: [], reason: "not_eligible" }` |
| WP-9 | `{ ...splitPlanInput, query: "너말고", primaryVariants: createSearchQueryVariants("너말고"), primaryResults: [] }` | `reason: "run"`, 질의 `["너 말","너말 고"]` |
| WP-10 | WP-9에서 `primaryResults: [result("너 말고 다른 연애")]` | `{ variants: [], reason: "has_match" }` |
| WP-11 | WP-9에서 `primaryResults: [result("Unrelated Anime")]` | `reason: "run"` |
| WP-12 | `{ ...splitPlanInput, query: "너말", primaryVariants: createSearchQueryVariants("너말"), primaryResults: [] }` | `reason: "run"`, 질의 `["너 말"]` |
| CF-1 | `filterResultsByCompactQuery([result("너 말고 다른 연애"), result("너의 이름은")], "너말고")` | 제목 `["너 말고 다른 연애"]` |
| CF-2 | `([result("너 말고 다른 연애"), result("오징어 게임")], "너말")` | 제목 `["너 말고 다른 연애"]` |
| CF-3 (보존) | `([result("A"), result("B")], "")` | 두 개 모두 |

`splitQueries`, `splitPlanInput`, `result`는 테스트 파일의 기존 도우미(241행, 259행, 15~33행)를 쓴다.

### `scripts/searchGolden.ts` / `scripts/searchGolden.test.ts`
| ID | 입력 | 기대 |
|----|------|------|
| G-8 | `SEARCH_GOLDEN_SHORT_SPACING_CASES`의 `[query, externalId[]]` | `[["너말고",["314939"]],["너말",["314939"]],["그해우",["135897"]],["선재업",["230923"]]]` |

### 네트워크 검사
| ID | 명령 | 기대 |
|----|------|------|
| GN-1 | `npm run search:golden` | `통과 23/23`(12 + 7 + 4) |

### 수동 확인 (배포 후)
| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 | "너말고" → "너 말고 다른 연애", 응답 `word_split_fallback: true` |
| M-2 | 웹 8081 | "괴물"·"오징어" → 기존과 같음, `word_split_fallback: false` |
| M-3 | 앱(iOS 세로) | "선재업" → "선재 업고 튀어" |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/search-content/adapters/normalize.ts` | 140행, `createKoreanWordSplitVariants`, `planKoreanWordSplitFallback`의 글자 수 조건 제거와 자모 조건 |
| `supabase/functions/search-content/adapters/normalize.test.ts` | WS-7·WP-4 의도된 수정, 새 행 |
| `scripts/searchGolden.ts` | `SEARCH_GOLDEN_SHORT_SPACING_CASES` |
| `scripts/searchGolden.test.ts` | G-8 |
| `scripts/search-golden.ts` | 세 목록 모두 검사 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| 1단계 변형·앞부분 변형의 4글자 조건 | D-4, 5장 |
| `search-content/index.ts` | 판정 함수만 바뀐다 |
| 입력마다 검색하는 클라이언트 동작 | 기존 동작 |

## 13. 확실하지 않음
- 짧은 검색어의 2단계 질의(`너 말`)는 결과가 넓다. 1페이지(20개) 안에 원하는 작품이 들어온다는 가정은 4개 사례에서만 확인했다.
- 짧은 검색어도 1단계에 맞는 결과가 없으면 TMDB 호출이 검색당 최대 4회(2글자는 1회, 3글자는 2회) 는다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 정정 작업이다.
docs/55의 붙여 쓴 검색어 보정이 "4글자 이상"에만 실행되어 "너말고" 같은 짧은 검색어가 0건이다. 사용자 기준은 "공백을 뺀 검색어가 공백을 뺀 제목에 들어 있으면 찾는다"이다. 보정 판정에서 글자 수 조건을 없앤다.

| ID | 증상 |
|----|------|
| F-1 | "너말고", "너말", "그해우", "선재업" 검색이 0건이다(띄어 쓰면 나온다) |

# READ FIRST
1. 이 명세서 1~13장. 원인은 2장(세 곳의 `< 4`), 결정은 D-1~D-5, 계약은 6장, 테스트는 10장(테스트 성격 구분 포함)이다.
2. `docs/55_korean_search_spacing_fallback_spec.md` 6장 — 2단계 보정 계약 원본.
3. `AGENTS.md` — 테스트 규칙.
4. `supabase/functions/search-content/adapters/normalize.ts`: 139~151행, 282~285행(읽기만), 309~347행
5. `supabase/functions/search-content/adapters/normalize.test.ts`: 15~33행, 241~275행
6. `scripts/searchGolden.ts`, `scripts/searchGolden.test.ts`, `scripts/search-golden.ts`

# 시작 상태 (반드시 유지)
- `git status`, `npm test`, `npm run search:golden` 결과를 기록한다.
  - `npm test` 기준선은 1126개 중 1125개 통과다. 기존 실패 1개는 무관하다.
  - `search:golden` 기준선은 19/19다.
  - 그 밖의 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 보정 판정에 글자 수 하한을 두지 않는다. 판정 기준은 "공백 뺀 검색어 ⊂ 공백 뺀 제목"이다. 변형 개수 상한 `MAX_WORD_SPLIT_VARIANTS = 4`는 그대로다.
- **D-2.** `filterResultsByCompactQuery`는 검색어가 비었을 때만 그대로 통과시킨다. 판정 내용은 바꾸지 않는다.
- **D-3.** 자모(`/[ᄀ-ᇿ㄰-㆏]/`)가 있으면 2단계를 하지 않는다.
- **D-4.** `createSearchQueryVariants`·`createKoreanSpacingHints`·`createKoreanAnchorQueries`·`search-content/index.ts`·캐시 규칙은 바꾸지 않는다.
- **D-5.** 짧은 검색어 골든 사례는 별도 목록이다. G-6·G-7과 기존 두 목록은 그대로 둔다.

# STEP 1 — 테스트부터
- 10장 행을 추가하고, WS-7·WP-4를 표대로 고친다.
- `npm test`를 돌려 "구현 전에 실패해야 하는 행" 9개(WS-9, WS-10, WP-9~WP-12, CF-1, CF-2, G-8)가 실패하는지 확인한다.
- 보존 행(WS-11, CF-3)과 의도된 수정 행(WS-7, WP-4)은 통과해도 정상이다. 실패해야 하는 행 중 하나라도 통과하면 멈추고 보고한다.

# STEP 2 — 판정 수정
6장대로 `normalize.ts` 세 곳을 고친다. 자모 조건 옆에 짧은 주석으로 근거를 남긴다: 입력 중 상태라 어떤 제목에도 들어 있을 수 없음, NFKC가 U+3131을 U+1100으로 바꿈.

# STEP 3 — 골든
- `SEARCH_GOLDEN_SHORT_SPACING_CASES`와 G-8을 추가한다.
- `search-golden.ts`가 세 목록을 모두 검사하게 한다. 2단계 재현 방식은 그대로다.

# 엣지 케이스
9장 E-1~E-10 전부.

# 검증 명령
```
npm test
npm run typecheck
npm run lint
npx --no-install esbuild supabase/functions/search-content/index.ts --bundle=false --format=esm --log-level=warning > /dev/null
npm run search:golden
```
- `npm test`: 기준선 1125개 통과 + 새 테스트 12개(WS-9~WS-11, WP-9~WP-12, CF-1~CF-3, G-8). 기존 실패 1개 외 실패는 0이어야 한다.
- `search:golden`: `통과 23/23`.

# DEFINITION OF DONE
- [ ] 실패해야 하는 9개 행이 수정 전에 실패했고 수정 후 통과한다
- [ ] `normalize.ts`에 보정 판정용 글자 수 하한(`< 4` 등)이 남아 있지 않다(`createKoreanAnchorQueries`·`createKoreanSpacingHints`의 기존 조건은 그대로)
- [ ] WS-7·WP-4 외 기존 테스트 diff가 없고, 테스트 개수가 줄지 않았다
- [ ] `index.ts` diff가 없다
- [ ] `typecheck`·`lint`·esbuild 통과, `search:golden` 23/23(또는 실행 못 한 사유)

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
supabase/functions/search-content/adapters/normalize.ts
supabase/functions/search-content/adapters/normalize.test.ts
scripts/searchGolden.ts
scripts/searchGolden.test.ts
scripts/search-golden.ts
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력(요약)
2. `npm test` before / after 통과 개수, `typecheck`·`lint`·esbuild 결과
3. `npm run search:golden` before(19/19) / after(23/23)
4. 추가·수정한 테스트 ID와 이름
5. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
6. 사람이 할 후속 작업: `search-content` 재배포

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다.
- 테스트 파일에서 React Native 모듈이나 Supabase 클라이언트를 import하지 않는다.
- TMDB 키 등 비밀 값을 출력하지 않는다.
