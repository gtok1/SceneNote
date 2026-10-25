# 65. 검색 입력 디바운스와 요청 제한 시간 여유

작성일: 2026-10-25
대상 브랜치 기준: `main` (`bfcc3fd`) + 미커밋 작업(docs/64 구현 포함). 시작할 때 `npm test` 기준선을 기록한다(2026-10-24 검증 시 1349/1349 통과). 운영 `personalized-recommendations` v23, `search-content` v28이다.
선행 문서: `docs/64_recommendation_invocation_cost_fixes_spec.md`(호출 비용, 이어 찾기 예산 확대 D-3), `docs/55`·`docs/56`(검색 2단계 보정), `docs/62`(AniList 3단계), `docs/36_people_tab_saas_redesign_spec.md`(인물 탭 디바운스)

> **근거.** docs/64 배포 후 개선점 점검(2026-10-25).
> 사용자 요청: "개선할점 codex용 prompt 작성해줘"(개선점 1번 검색 디바운스·2번 응답 시간 여유)

---

## 1. 문제 정의
| ID | 증상·위험 |
|----|-----------|
| S-1 | 검색 탭에서 글자가 바뀔 때마다 `search-content`와 `search-person-content`를 **둘 다** 부른다. 한글은 조합 중 상태("ㄴ"→"너"→"너ㅁ"→"너마"→"너말")도 값이 바뀌어, 한 단어를 치는 동안 수십 번 호출될 수 있다. 호출 1번이 다시 TMDB·AniList를 여러 번 부르기도 한다(docs/55·62의 2·3단계) |
| S-2 | 추천 요청의 앱 제한 시간(10초)이 서버 마감(8.5초)에 비해 여유가 1.5초뿐이다. docs/64 D-3로 이어 찾기가 마감까지 쓰는 경우가 늘었다. 콜드 스타트가 겹치면 앱이 먼저 끊고 서버 작업이 버려진다(호출 비용만 발생) |
| S-3 | 검색 요청도 같은 구조다(서버 마감 8.5초, 앱 제한 10초) |

## 2. 근본 원인

### 2.1 S-1
- `app/search.tsx` 135행: `useContentSearch(query, …, { enabled: … && query.trim().length >= 2 })`
- 136행: `usePersonContentSearch(searchFilterPreferences.isReady ? query : "", "all")`
- `query`는 입력할 때마다 바뀌는 상태(`useSearchUiStore`)다. TanStack Query 키에 그대로 들어가 키가 바뀔 때마다 새 요청이 나간다.
- 인물 탭(`app/(tabs)/people.tsx` 48~50행)은 이미 `useDebouncedValue(query, PERSON_SEARCH_DEBOUNCE_MS)`(300ms)를 쓴다. 검색 탭에는 없다.

### 2.2 S-2·S-3
| 위치 | 값 |
|------|----|
| 추천 서버 마감 `personalized-recommendations/index.ts` 134행 | 8,500ms |
| 추천 앱 호출 `src/services/personalizedRecommendations.ts` 216행 `timeout` | 10,000ms |
| 추천 훅 `INITIAL_LOADING_DEADLINE_MS`·`MUTATION_LOADING_DEADLINE_MS`(`usePersonalizedRecommendations.ts` 70~71행) | 12,000ms |
| 자동 이어 찾기 최소 남은 예산 `MINIMUM_AUTOMATIC_RECOMMENDATION_REQUEST_BUDGET_MS`(`recommendationFeed.ts` 44행) | 12,000ms |
| 검색 서버 마감 `search-content/index.ts` 69행 | 8,500ms |
| 검색 앱 호출 `src/services/contentSearch.ts` 69행 `timeout` | 10,000ms |

응답 시간 = 서버 마감 + 노출 기록 저장(docs/64) + 네트워크 + 콜드 스타트다. 10초에 닿을 수 있다.

## 3. 재현 시나리오
1. 웹 8081, 검색 탭에서 네트워크 탭을 연다.
2. "전생했더니 슬라임"을 친다. `search-content`·`search-person-content` 요청이 글자마다 나간다.

## 4. 설계 결정

### D-1 (최우선). 검색 탭 요청은 디바운스한 "요청 검색어"로만 보낸다
- 입력창 표시는 지금처럼 바로 바뀐다(`query`).
- 서버 요청(작품·인물 검색)은 `requestQuery`로만 보낸다. 입력이 300ms 멈춘 뒤에 갱신된다.
- 상수 `SEARCH_QUERY_DEBOUNCE_MS = 300`(인물 탭과 같은 값)을 쓴다.

### D-2. 조합 중인 한글 자모가 섞이면 요청 검색어를 바꾸지 않는다
- 공백을 다듬은 입력에 한글 자모(`/[ᄀ-ᇿ㄰-㆏]/`)가 있으면, 직전 요청 검색어를 그대로 유지한다. 화면에는 직전 결과가 남고 "결과 없음"이 깜빡이지 않는다.
- 입력이 2글자 미만이면 요청 검색어는 `""`이다(요청 없음, 지금과 같음).
- 자모만으로는 검색이 되지 않는다(TMDB·AniList 모두 자모 검색 미지원). 초성 검색은 범위 밖이다.

### D-3. 검색 버튼·Enter·최근 검색어는 기다리지 않는다
- `runSearch`와 `searchFromHistory`는 디바운스를 건너뛰고 요청 검색어를 바로 그 값으로 바꾼다(`flush`).
- 요청 검색어가 이미 같으면 기존처럼 `refetch`한다. 다르면 키가 바뀌므로 자동으로 요청된다(이중 요청 금지).

### D-4. 판정은 순수 함수로 둔다
- `nextSearchRequestQuery(previous, raw)`(`src/utils/searchRequestQuery.ts`)가 판정한다.
- 타이머·`flush`는 훅 `useSearchRequestQuery`(`src/hooks/useSearchRequestQuery.ts`)가 맡는다.

### D-5. 요청 제한 시간에 여유를 둔다

| 항목 | 지금 | 바꿀 값 |
|------|------|--------|
| 추천 `recommend` 호출 `timeout` | 10,000 | **14,000** |
| 추천 훅 첫 조회·변경 요청 제한(`INITIAL_LOADING_DEADLINE_MS`·`MUTATION_LOADING_DEADLINE_MS`) | 12,000 | **15,000** |
| 자동 이어 찾기 최소 남은 예산(`MINIMUM_AUTOMATIC_RECOMMENDATION_REQUEST_BUDGET_MS`) | 12,000 | **15,000**(요청 제한과 같게) |
| 검색 `search-content` 호출 `timeout` | 10,000 | **14,000** |

- 순서는 "호출 제한(14초) < 훅 제한(15초)"으로, 지금(10 < 12)과 같은 구조다.
- 노출 기록·피드백 호출(10초), 서버 마감(8.5초), 이어 찾기 최대 45초·최대 6회는 그대로다.
- 첫 조회 시간 초과 문구는 상수에서 만들어지므로 "15초"로 바뀐다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| 검색 버튼을 눌러야만 검색 | 입력 중 결과가 보이는 지금 동작을 바꾼다 |
| 디바운스 500ms 이상 | 결과가 늦게 보인다. 인물 탭과 같은 300ms로 맞춘다 |
| 서버 마감을 7초로 줄임 | 서버가 하는 일(채우는 개수)이 줄어든다. 앱 쪽 여유를 늘리는 편이 결과를 버리지 않는다 |
| 자모가 섞여도 디바운스만 | 조합 중 잠깐 멈추면 자모 검색어가 나간다. 결과가 0건이라 깜빡인다 |

## 6. 계약

### 6.1 `src/utils/searchRequestQuery.ts` (신규, 순수)
```ts
export const SEARCH_QUERY_DEBOUNCE_MS = 300;
export function hasComposingHangulJamo(value: string): boolean;   // /[ᄀ-ᇿ㄰-㆏]/
export function nextSearchRequestQuery(previous: string, raw: string): string;
```
`nextSearchRequestQuery` 판정 순서:
1. `trimmed = raw.trim()`
2. `trimmed.length < 2`이면 `""`
3. `hasComposingHangulJamo(trimmed)`이면 `previous`(그대로)
4. 그 밖에는 `trimmed`

### 6.2 `src/hooks/useSearchRequestQuery.ts` (신규)
```ts
export function useSearchRequestQuery(query: string, delayMs?: number): {
  requestQuery: string;
  flush: (value?: string) => boolean;   // 바뀌었으면 true
};
```
- `requestQuery`는 상태다. 초기값은 `nextSearchRequestQuery("", query)`다(복원된 검색어는 바로 요청).
- `query`가 바뀌면 `delayMs`(기본 300) 뒤에 `nextSearchRequestQuery(현재, query)`로 갱신한다. 새 입력이 오면 이전 타이머를 지운다.
- `flush(value = query)`: 타이머를 지우고, 계산한 값이 현재와 다르면 바꾸고 `true`, 같으면 `false`를 돌려준다. 현재 값 비교는 ref로 동기적으로 한다.

### 6.3 `app/search.tsx`
- `const { requestQuery, flush: flushRequestQuery } = useSearchRequestQuery(query);`
- 135행 `useContentSearch(query, …)` → `useContentSearch(requestQuery, …)`. `enabled`의 `query.trim().length >= 2`는 `requestQuery.length >= 2`로 바꾼다. `parseSearchIntent(query).mode !== "similarity"`는 입력값(`query`) 기준 그대로다.
- 136행 `usePersonContentSearch(searchFilterPreferences.isReady ? query : "", "all")` → `requestQuery`로 바꾼다.
- `runSearch(value)`: 기존 검사·유사 모드 처리·기록 저장은 그대로다. 마지막 `search.refetch()`·`personSearch.refetch()`는 `if (!flushRequestQuery(value)) { …refetch… }`로 바꾼다.
- `searchFromHistory(historyQuery)`: `setQuery(historyQuery)` 다음에 `flushRequestQuery(historyQuery)`를 부른다.
- 화면 판정(`hasSearchQuery` 등 입력값 기준)과 결과 렌더링은 바꾸지 않는다.

### 6.4 제한 시간 (D-5)
- `src/services/personalizedRecommendations.ts`: `fetchPersonalizedRecommendationPage`의 `timeout: 10_000` → `14_000`. 노출 기록(182행)·피드백(53행)은 그대로다.
- `src/hooks/usePersonalizedRecommendations.ts` 70~71행: `12_000` → `15_000`(두 상수)
- `src/utils/recommendationFeed.ts` 44행: `MINIMUM_AUTOMATIC_RECOMMENDATION_REQUEST_BUDGET_MS = 15_000`. 바로 위 주석의 "12-second"를 "15-second"로 고친다. 다른 상수·함수 본문은 바꾸지 않는다.
- `src/services/contentSearch.ts` 69행: `timeout: 10_000` → `14_000`

## 7. 데이터 모델 / SQL
변경 없음. 서버 변경 없음(배포 불필요).

## 8. 화면 명세
화면 구성 변경 없음.
- 입력 중 결과는 마지막 요청 검색어 기준으로 남는다.
- 새 결과는 입력이 300ms 멈춘 뒤 바뀐다.
- 검색 버튼·Enter·최근 검색어는 바로 검색한다.

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | "너말고" 입력 후 멈춤 | 300ms 뒤 요청 1회 | RQ-4, M-1 |
| E-2 | 조합 중 "너말ㄱ"에서 멈춤 | 요청 검색어 유지("너말"), 결과 그대로 | RQ-3 |
| E-3 | 1글자("너") | `""`, 요청 없음 | RQ-1 |
| E-4 | 공백만 / 앞뒤 공백 | `""` / 다듬은 값 | RQ-1, RQ-5 |
| E-5 | 자모만("ㄴㅁ") | 직전 값 유지 | RQ-3 |
| E-6 | 영문·숫자("one piece") | 그대로 | RQ-4 |
| E-7 | Enter를 300ms 안에 누름 | 기다리지 않고 1회 요청(중복 없음) | 수동 M-2 |
| E-8 | 같은 검색어로 검색 버튼 재클릭 | `refetch` 1회(기존 동작) | 수동 M-2 |
| E-9 | 최근 검색어 누름 | 바로 검색 | 수동 M-3 |
| E-10 | 앱 재진입 시 저장된 검색어 | 바로 요청(초기값) | 6.2 |
| E-11 | 추천 이어 찾기 응답 9~13초 | 끊기지 않고 받음 | 수동 M-4 |
| E-12 | 추천 응답 15초 초과 | 기존 시간 초과 처리(문구 15초) | 기존 |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 기존 테스트는 고치지 않는다. `recommendationFeed.test.ts`는 상수 이름으로 참조하므로 값 변경 후에도 그대로 통과해야 한다. 보존 테스트는 없다. 새 행은 새 모듈이 없어 구현 전에 모두 실패해야 한다.

### `src/utils/searchRequestQuery.test.ts` (신규)
| ID | 입력 | 기대 |
|----|------|------|
| RQ-1 | `nextSearchRequestQuery("너말고", "")` / `("너말고", " ")` / `("너말고", "너")` | 모두 `""` |
| RQ-2 | `hasComposingHangulJamo("너말ㄱ")` / `("ㄴㅁ")` / `("너말고")` / `("one piece")` | `true` / `true` / `false` / `false` |
| RQ-3 | `("너말", "너말ㄱ")` / `("너말", "ㄴㅁ")` | `"너말"` / `"너말"` |
| RQ-4 | `("", "너말고")` / `("너말고", "one piece")` | `"너말고"` / `"one piece"` |
| RQ-5 | `("", "  너말고  ")` | `"너말고"` |
| RQ-6 | `SEARCH_QUERY_DEBOUNCE_MS` | `300` |

### 수동 확인 (UI-14.3)
| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081, 네트워크 탭 | "전생했더니 슬라임"을 쳐서 멈춤 → `search-content`·`search-person-content` 각 1회(이전에는 글자마다) |
| M-2 | 웹 8081 | 입력 직후 Enter → 각 1회. 같은 검색어로 검색 버튼 → 각 1회 다시 |
| M-3 | 웹 8081 | 최근 검색어 누름 → 바로 결과 |
| M-4 | 웹 8081 | 추천 이어 찾기에서 "시간 초과" 문구가 나오지 않음(콘솔 `recommendation response`의 `elapsedMs` 기록) |
| M-5 | 앱(iOS 세로) | 한글 입력 중 결과가 깜빡이지 않음, M-1·M-2와 같음 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `src/utils/searchRequestQuery.ts` (신규) | 6.1 |
| `src/utils/searchRequestQuery.test.ts` (신규) | RQ-1~RQ-6 |
| `src/hooks/useSearchRequestQuery.ts` (신규) | 6.2 |
| `app/search.tsx` | 6.3 |
| `src/services/personalizedRecommendations.ts` | 6.4 |
| `src/hooks/usePersonalizedRecommendations.ts` | 6.4(상수 2개만) |
| `src/utils/recommendationFeed.ts` | 6.4(상수 1개·주석만) |
| `src/services/contentSearch.ts` | 6.4 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| 추가·완료 후 12개 즉시 묶음 | 사용자 결정 대기(docs/47 15장) |
| 취향 보충 미리 받기 축소 | 첫 화면 속도(docs/52)와 맞바꾸는 문제 |
| 추천 요청마다 라이브러리 전체 조회 | docs/64 진단값(`library_rows`·`setup_ms`) 실측 후 판단 |
| 인물 탭 디바운스 | 이미 300ms |
| 초성 검색 | 외부 API 미지원 |

## 13. 확실하지 않음
- 호출 감소량은 입력 속도에 따라 다르다. M-1로 실측한다.
- 15초 제한은 콜드 스타트 1~2초를 가정했다. 실제 분포는 운영 로그 권한이 생기면 확인한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo) 리포의 구현 담당이다. 비용 관련 정정 작업이다.
1. 검색 탭이 글자마다(한글 조합 중 포함) `search-content`·`search-person-content`를 부른다. 이를 300ms 디바운스한 "요청 검색어"로 바꾼다.
   - 조합 중 자모가 섞이면 요청을 바꾸지 않는다.
   - 검색 버튼·Enter·최근 검색어는 바로 검색한다.
2. 추천·검색 요청의 앱 제한 시간이 서버 마감(8.5초)에 비해 여유가 1.5초뿐이라, 서버 작업이 버려질 수 있다. 앱 쪽 제한을 늘린다.

서버 변경은 없다.

| ID | 증상·위험 |
|----|-----------|
| S-1 | 검색 탭 입력마다 검색 함수 2개 호출 |
| S-2 | 추천 호출 제한 10초 vs 서버 마감 8.5초 |
| S-3 | 검색 호출도 같음 |

# READ FIRST
1. 이 명세서 1~13장. 원인은 2장, 결정은 D-1~D-5, 계약은 6장, 테스트는 10장이다.
2. `app/(tabs)/people.tsx` 48~50행과 `src/hooks/useDebouncedValue.ts` — 기존 디바운스 사례.
3. `AGENTS.md` — 테스트 규칙.
4. 고칠 위치:
   - `app/search.tsx`: 89행 `query`, 135~136행, 324~340행 `runSearch`·`refetch`·`searchFromHistory`
   - `src/services/personalizedRecommendations.ts` 216행, `src/services/contentSearch.ts` 69행
   - `src/hooks/usePersonalizedRecommendations.ts` 70~71행, `src/utils/recommendationFeed.ts` 42~44행

# 시작 상태 (반드시 유지)
- `git status`와 `npm test` 결과를 기록한다(2026-10-24 기준 1349/1349 통과). 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 작품·인물 검색 요청은 `requestQuery`로만 보낸다(300ms 디바운스). 입력창 표시와 화면 판정은 입력값 그대로다.
- **D-2.** 자모가 섞이면 직전 요청 검색어를 유지한다. 2글자 미만이면 `""`다.
- **D-3.** 검색 버튼·Enter·최근 검색어는 `flush`로 바로 바꾼다. 같으면 `refetch`, 다르면 키 변경으로 요청된다(이중 요청 금지).
- **D-4.** 판정은 `nextSearchRequestQuery` 순수 함수, 타이머는 `useSearchRequestQuery` 훅이다.
- **D-5.** 추천 `recommend` 호출 14초, 추천 훅 제한 15초, 자동 이어 찾기 최소 예산 15초, 검색 호출 14초다. 그 밖의 시간·횟수 규칙과 서버는 바꾸지 않는다.

# STEP 1 — 실패하는 테스트부터
- 10장 RQ-1~RQ-6으로 `src/utils/searchRequestQuery.test.ts`를 만든다.
- `npm test`로 전부 실패(모듈 없음)하는지 확인한다. 하나라도 통과하면 멈추고 보고한다.

# STEP 2 — 순수 함수·훅
6.1·6.2를 구현한다. RQ 행이 통과해야 한다.

# STEP 3 — 검색 화면
6.3대로 `app/search.tsx`를 고친다. 다른 판정·렌더링은 바꾸지 않는다.

# STEP 4 — 제한 시간
6.4의 숫자 4곳과 주석만 바꾼다. 기존 테스트가 그대로 통과하는지 확인한다.

# STEP 5 — 확인
웹 8081에서 로그인된 화면을 쓸 수 있으면 M-1~M-3을 네트워크 탭으로 확인한다(로그인 대행 금지). 못 하면 사유를 보고한다.

# 엣지 케이스
9장 E-1~E-12 전부.

# 검증 명령
```
npm test
npm run typecheck
npm run lint
```
- `npm test`: 기준선 + 새 테스트 6개, 실패 0이어야 한다.

# DEFINITION OF DONE
- [ ] RQ-1~RQ-6이 수정 전에 실패했고 수정 후 통과한다. 기존 테스트 diff가 없다
- [ ] `useContentSearch`·`usePersonContentSearch`에 `query` 대신 `requestQuery`가 들어간다
- [ ] `runSearch`·`searchFromHistory`가 `flush`를 쓰고, 같은 값일 때만 `refetch`한다
- [ ] 제한 시간 4곳이 D-5 값이다. 노출 기록·피드백 호출 10초는 그대로다
- [ ] `recommendationFeed.ts`는 상수 1개와 주석만 바뀌었다
- [ ] `typecheck`·`lint` 통과
- [ ] 웹·앱 수동 확인 결과(또는 못 한 사유)를 M-1~M-5 표로 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/searchRequestQuery.ts
src/utils/searchRequestQuery.test.ts
src/hooks/useSearchRequestQuery.ts
app/search.tsx
src/services/personalizedRecommendations.ts
src/hooks/usePersonalizedRecommendations.ts
src/utils/recommendationFeed.ts
src/services/contentSearch.ts
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력(요약)
2. `npm test` before / after 통과 개수, `typecheck`·`lint` 결과
3. 추가한 테스트 ID와 이름
4. M-1~M-5 결과(웹/앱 구분, 못 한 항목과 사유). 가능하면 M-1의 이전·이후 요청 수
5. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)

# 금지사항
- 배포 명령을 실행하지 않는다(이번 작업은 앱만이다).
- DB 마이그레이션 파일을 만들지 않는다. 서버 코드를 바꾸지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
- 로그인 대행 금지.
