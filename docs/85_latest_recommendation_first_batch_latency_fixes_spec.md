# 85. 최신 추천 첫 묶음 지연·찔끔 표시 정정 명세

작성일: 2026-11-20
대상 브랜치 기준: main (`0ca4651`, 작업 트리에 docs/84 미커밋 변경 있음)
선행 문서: `docs/52_recommendation_first_batch_fill_spec.md`(첫 요청 1초 탐색의 전제), `docs/64_recommendation_invocation_cost_fixes_spec.md`(D-3 첫 요청 예산 유지 결정), `docs/70_latest_recommendation_catalog_and_cpu_fixes_spec.md`(최신 모드에서 취향 보충 끔, 헤드 하나씩 검증), `docs/47_recommendation_batch_topup_spec.md`(12개 목표 자동 이어 찾기)

이 문서는 정정 명세다. 서버 공용 파일 2개와 서버 핸들러 1줄, 앱 판정 파일 1개를 바꾼다. 화면·문구·DB는 바꾸지 않는다. 서버 변경은 사람이 `personalized-recommendations`를 다시 배포해야 운영에 반영된다.

---

## 1. 문제 정의

사용자 신고(2026-11-20 10:13 KST, 캡처): 검색 탭 빈 검색어의 "내 취향 최신 추천"(필터: 모든 유형·모든 장르·일본+한국, 갤러리, 추천 제외 3개)이 오래 걸린다. 카드가 2개 → 4개 → 5개처럼 몇 개씩 늦게 붙고, 그동안 빈 카드 자리(스켈레톤) 여러 줄이 계속 보여 고장 난 것처럼 보인다.

| ID | 지금 사용자가 겪는 것 | 고친 뒤 |
|----|----------------------|---------|
| F-1 | 첫 응답이 카드 몇 개(캡처는 2개)만 가져온다. 앱이 나머지를 채우려고 서버를 최대 6번 차례로 다시 부르고, 응답마다 카드가 몇 개씩 붙는다 | 첫 요청이 이어 찾기 요청과 같은 탐색 예산을 써서, 대부분 한 번에 12개 가까이 가져온다. 다시 부르는 횟수가 줄어든다 |
| F-2 | 로딩 중 화면이 다시 그려질 때마다 추천 카드 하나하나를 라이브러리 671개 전체와 제목 정규화까지 해 가며 비교한다(로컬 측정 1회 21~64ms, 휴대폰은 더 느림) | 라이브러리를 한 번 색인해 제목이 같은 작품만 비교한다. 판정 결과는 그대로다 |

---

## 2. 근본 원인

### 2.1 F-1 — 최신 모드 첫 요청이 "1초 탐색"으로 끝난다

1. 앱은 추천 요청에 항상 `discovery_mode: 'latest'`를 보낸다(docs/70). 서버의 최신 모드 분기는 `supabase/functions/personalized-recommendations/index.ts:294`다.
2. 탐색 예산은 모드와 상관없이 커서 유무로만 정한다. `index.ts:257`
   ```ts
   const budget = recommendationScanBudget({ hasCursor: Boolean(validated.value.cursor) });
   ```
   `supabase/functions/_shared/recommendationTasteFill.ts:126-130`의 첫 요청 예산은 `scanMs: 1_000, keywordLookups: 16, maxMonths: 3, maxRounds: 3`이다.
3. 최신 목록 탐색 `scanLatestRecommendationCatalog`(`recommendationLatestCatalog.ts:193-355`)는 두 번째 공급자 조회 바퀴부터 `canContinue`를 확인한다(`:265`). 최신 모드의 `canContinue`는 `Date.now() - scanStartedAt < budget.scanMs`다(`index.ts:318`). 첫 바퀴(공급자 페이지 조회와 헤드별 키워드 확인)가 1초를 넘기면, 이번 달 첫 페이지에서 찾은 만큼만 담고 끝낸다. 이번 달 적격 작품이 적은 계정(라이브러리 671개·최근 노출 24개·제외 3개)은 지난달로 넘어가야 하는데, 그 조회 바퀴를 시작하지 못한다.
4. **1초 예산의 전제가 사라졌다.** docs/52는 "첫 요청은 1초만 탐색하고 나머지는 취향 보충이 채운다"는 전제로 1초를 정했다(docs/52 92행: 탐색을 늘리면 보충 시간이 줄어 역효과). docs/64 D-3도 같은 이유로 첫 요청 4초를 기각했다(docs/64 113행). 그런데 docs/70은 최신 모드에서 취향 보충과 미리 받기를 모두 껐다(docs/70 28행, 응답 `taste_fill: "disabled_latest"`, `index.ts:347`). 짧은 응답은 허용하고 `has_more`로 이어 가게 했다(docs/70 40행). 첫 예산만 1초로 남아, 최신 모드 첫 응답은 1초 동안 찾은 것뿐이다.
5. 앱은 보이는 카드가 12개보다 적으면 서버를 다시 부른다(`src/hooks/usePersonalizedRecommendations.ts:748-781`, `decideEmptyRecommendationContinuation` `src/utils/recommendationFeed.ts:234-257`). 한도는 요청 6회·45초·무진전 3회다(`recommendationFeed.ts:39-44`). 요청은 커서를 이어받으므로 차례로만 나간다.
6. **이어 부를 때마다 준비 작업을 처음부터 다시 한다.** 인증 확인(`auth.getUser`, 네트워크 왕복, `_shared/supabase.ts:47`) → 라이브러리 전체(작품·외부 ID·장르·테마·시즌 조인) + 피드백 + 최근 노출 조회(`index.ts:182-200`) → 취향 프로필 계산 → 탐색 → 국내 OTT 정보 붙이기(`:323`) → 노출 기록 쓰기(`:328`). 그래서 첫 응답이 짧을수록 전체 시간이 길어지고, 카드가 응답마다 몇 개씩 붙는다(캡처의 2 → 4 → 5).

### 2.2 F-2 — 등록 작품 판정이 렌더마다 라이브러리 전체를 훑는다

1. `isRegisteredRecommendation`(`src/utils/recommendationVisibility.ts:8-22`)은 추천 1개마다 `libraryItems.some(...)`으로 라이브러리 전체를 돈다. 외부 ID가 다르면 `isSameRecommendationWork`(`supabase/functions/_shared/recommendationEngine.ts:1088-1113`)를 부르고, 이 함수는 부를 때마다 양쪽 제목 4개를 `normalizeTitle`(`:1259-1265`, NFKC·소문자·문장부호 제거 정규식)로 새로 정규화한다.
2. 추천 훅은 렌더마다 이 판정을 돈다. `const visibleRecommendationCount = countDisplayedRecommendations(recommendationQuery.data?.items ?? []);`(`usePersonalizedRecommendations.ts:678`, 메모 없음). `loadMore` 한 번에도 3번 더 돈다(`:598`, `:619-620`). 화면도 응답이 바뀔 때마다 `filterVisibleRecommendationCandidates`와 `summarizeRecommendationVisibility`로 한 번씩 더 돈다(`app/search.tsx:283-303`).
3. **로컬 측정(2026-11-20, Node 24, Apple Silicon, 저장소 함수 그대로).** 라이브러리 671개 기준 `filterVisibleRecommendationCandidates` 1회가 추천 12개 21.3ms, 24개 42.5ms, 36개 63.7ms다. 같은 36개를 빈 라이브러리로 돌리면 0.05ms다. 비용은 거의 전부 라이브러리 비교다. 이어 찾기가 이어지는 동안 렌더가 여러 번 일어나므로, 휴대폰 브라우저에서는 이 계산이 화면 반응을 끊는 원인이 된다(휴대폰 배율은 측정하지 않음, 13장 U-2).

---

## 3. 재현 시나리오

수정 전 상태를 확인하는 순서다. 수정 후에는 14장 "수동 확인" 표로 검증한다.

1. 로그인한 웹 8081(개발 빌드)에서 검색 탭을 연다. 검색어는 비운다. 필터는 사용자와 같게 "모든 유형 · 모든 장르 · 일본, 한국", 보기는 갤러리.
2. 개발자 도구 콘솔에서 `recommendation response` 로그를 본다. 첫 로그의 `diagnostics.scan_budget`이 `"first"`이고 `count`가 12보다 작으며 `hasMore`가 `true`다.
3. 화면에 카드 몇 개 + 빈 카드 자리 + "추천을 더 찾고 있어요 · N/12"가 보인다.
4. 이어서 `scan_budget: "continuation"` 로그가 하나씩 더 찍히며 카드가 몇 개씩 붙는다. 12개를 채우거나 6회·45초 한도에서 멈춘다.
5. 같은 기능을 쓴 요청 수(`recommendation response` 로그 수), 각 `count`·`elapsedMs`·`diagnostics.total_ms`, 첫 카드와 12번째 카드가 보인 시각을 적는다.

> Claude는 이 시나리오를 직접 돌리지 못했다(로그인이 필요하고, 사용자 대신 로그인하지 않는다). 증상은 사용자 캡처로, 서버 원인은 코드로, F-2 비용은 로컬 측정으로 확인했다. 실측은 STEP 0과 수동 확인 M-1·M-2에서 한다.
>
> 대신 9장 E-4 모의 상황(이번 달 2개·지난달 10개, 조회 한 바퀴 1.1초)을 **현재 저장소의 `scanLatestRecommendationCatalog` 그대로** 돌렸다(2026-11-20 로컬). 지금 첫 예산(1초·3·3)은 `items 2, scanBudgetReached true, hasMore true`, 이어 찾기 크기 예산(4초·6·6)은 `items 12`였다. T-5는 이 결과를 테스트로 고정한다.

---

## 4. 설계 결정

### D-1. 최신 모드 첫 요청은 이어 찾기와 같은 탐색 예산을 쓴다 (최우선)

- `recommendationScanBudget`이 모드를 받는다. 커서 없는 **최신 모드** 요청은 `{ scanMs: 4_000, keywordLookups: 32, maxMonths: 6, maxRounds: 6, label: "latest_first" }`.
- 커서 있는 요청(모드 무관)은 지금 그대로 `continuation`, 커서 없는 **mixed 모드**(구 앱 호환 경로)와 모드를 주지 않은 호출은 지금 그대로 `first`(1초·16·3·3).
- 근거: 1초 예산은 "나머지는 취향 보충이 채운다"는 전제였고, 최신 모드에서 그 전제가 없어졌다(2.1-4). 예산은 상한일 뿐이다. 12개를 일찍 찾으면 지금처럼 바로 돌려준다. 늘어나는 것은 "적게 찾고 끝나 앱이 다시 부르는" 경우의 서버 체류 시간이고, 대신 준비 작업을 반복하는 추가 요청이 줄어든다.
- 같은 예산을 이미 이어 찾기 요청이 운영에서 쓰고 있다(docs/64, v23 이후). 새 수치를 만들지 않는다.
- docs/64 D-3("첫 요청은 1초·16·3·3 그대로") 중 **최신 모드 첫 요청 부분만** 대체한다. mixed 모드 첫 요청은 D-3을 그대로 따른다.

### D-2. 다른 시간·횟수 한도는 바꾸지 않는다

요청 마감 8.5초(`index.ts:139`), 앱 호출 제한 14초(`src/services/personalizedRecommendations.ts:218`의 `timeout: 14_000`)와 첫 로딩 15초(`INITIAL_LOADING_DEADLINE_MS`), 자동 이어 찾기 6회·45초·무진전 3회, 분당 자동 호출 12회, 최근 노출 제외 24개는 그대로다. D-1만으로 추가 요청 수가 줄어드는지 M-2로 확인한 뒤 다음 조정을 정한다.

### D-3. 헤드 하나씩 검증하는 docs/70 계약은 그대로다

`scanLatestRecommendationCatalog`의 "가장 최신 헤드만 검증, 보류된 헤드는 오프셋을 잃지 않음"(테스트 LC-5)을 바꾸지 않는다. 검증을 병렬로 미리 하면 빨라질 수 있지만, 계약 변경이고 효과를 측정하지 못했다(13장 U-3). `recommendationLatestCatalog.ts`는 이번에 바꾸지 않는다.

### D-4. 등록 작품 판정은 라이브러리 배열별 색인을 쓰고, 결과는 지금과 같다

- `src/utils/recommendationVisibility.ts`에 라이브러리 색인을 만든다. 같은 배열(참조가 같은 배열)에는 같은 색인을 다시 쓴다(`WeakMap`).
- 색인은 ① 수동 등록이 아닌 항목의 `source_api:source_id` 집합, ② 제목 키 → 그 제목을 가진 라이브러리 항목 목록이다.
- `isRegisteredRecommendation`의 시그니처와 결과는 그대로다. 외부 키가 같으면 참, 아니면 제목 키를 하나라도 공유하는 항목에만 기존 `isSameRecommendationWork`를 그대로 부른다. `isSameRecommendationWork`는 제목이 하나도 겹치지 않으면 언제나 거짓이므로(`recommendationEngine.ts:1099`), 비교 대상을 줄여도 결과가 같다.
- 호출하는 쪽(`filterVisibleRecommendationCandidates`·`summarizeRecommendationVisibility`·`findVisibleRecommendationReplacement`·훅·화면)은 바꾸지 않는다. 자동으로 빨라진다.
- 라이브러리 배열은 TanStack Query 데이터라 제자리에서 바뀌지 않는다. 새 데이터는 새 배열이므로 색인도 새로 만든다.

### D-5. 제목 키 규칙은 서버 공용 함수 한 곳에서 만든다

`recommendationEngine.ts`에 `recommendationSameWorkTitleKeys`를 내보내고, `isSameRecommendationWork`도 이 함수를 쓰게 바꾼다(동작 동일). 앱 색인도 이 함수만 쓴다. 정규화를 앱에 따로 복사하면 규칙이 어긋날 때 이미 등록한 작품이 추천에 다시 보인다.

### D-6. 화면·문구·응답 계약은 바꾸지 않는다

카드, 빈 카드 자리, "추천을 더 찾고 있어요 · N/12", 로딩 안내 문구는 그대로다. 응답 필드도 그대로이고, 진단 값 `diagnostics.scan_budget`에 `"latest_first"`가 새로 나올 뿐이다(앱은 `diagnostics`를 `unknown`으로 받아 개발 로그에만 쓴다, `src/services/personalizedRecommendations.ts:86`).

> D-N은 Codex가 임의로 바꾸면 안 되는 항목이다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

---

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 최신 모드에 취향 보충을 다시 켠다 | docs/70이 막은 "최근 월이 남았는데 기간 제한 없는 인기 작품으로 채우는" 문제가 돌아온다 |
| 앱이 짧은 응답을 숨겼다가 12개가 모이면 한꺼번에 보여 준다 | 전체 시간은 그대로이고 첫 카드만 늦어진다. 찔끔 표시의 원인은 짧은 첫 응답이다 |
| 첫 예산을 8초 등 더 크게 | 요청 마감 8.5초 안에 국내 OTT 정보 붙이기(남은 1초 필요)와 노출 기록 쓰기가 들어가야 한다. 운영에서 검증된 4초 예산을 재사용한다 |
| 헤드 검증을 병렬화·미리 검증 | docs/70 LC-5 계약 변경이고 효과를 측정하지 못했다(D-3, U-3) |
| 앱이 라이브러리 로딩을 기다리지 않고 추천을 먼저 요청 | 보이는 개수 계산과 이어 찾기 판정이 라이브러리 기준이다(docs/47). 판정 순서가 바뀌어 별도 설계가 필요하다 |
| 서버가 라이브러리·프로필을 계정별로 저장해 두고 재사용 | 테이블·무효화 규칙이 필요하다. D-1로 요청 수가 줄면 효과가 작아진다. M-2 결과를 보고 판단한다 |
| 빈 카드 자리를 마지막 줄 빈칸부터 채우게 목록 데이터에 끼워 넣기 | 2천 줄짜리 검색 화면의 목록 데이터 타입을 바꿔야 한다. D-1 뒤에는 이어 찾기 자체가 드물어진다(12장) |
| `isRegisteredRecommendation` 대신 렌더마다 `useMemo`로 개수만 기억 | 훅·화면·`loadMore` 여러 곳을 고쳐야 하고, 응답이 바뀔 때의 비용은 그대로다. 판정 함수 자체를 빠르게 하는 쪽이 한 곳이다 |

---

## 6. 계약

### 6.1 탐색 예산 (`supabase/functions/_shared/recommendationTasteFill.ts`)

```ts
export interface RecommendationScanBudget {
  scanMs: number;
  keywordLookups: number;
  maxMonths: number;
  maxRounds: number;
  label: "first" | "continuation" | "latest_first";
}

export function recommendationScanBudget(input: {
  hasCursor: boolean;
  discoveryMode?: "latest" | "mixed";
}): RecommendationScanBudget;
```

판정 순서:

1. `hasCursor`가 참 → `{ scanMs: 4_000, keywordLookups: 32, maxMonths: 6, maxRounds: 6, label: "continuation" }` (모드 무관, 지금과 같음)
2. `discoveryMode === "latest"` → `{ scanMs: 4_000, keywordLookups: 32, maxMonths: 6, maxRounds: 6, label: "latest_first" }`
3. 그 밖(`"mixed"`·생략) → `{ scanMs: 1_000, keywordLookups: 16, maxMonths: 3, maxRounds: 3, label: "first" }` (지금과 같음)

호출부 `supabase/functions/personalized-recommendations/index.ts:257`은 정확히 아래 한 줄이 된다. 파일 안에서 `recommendationScanBudget(` 호출은 이 한 곳뿐이다.

```ts
const budget = recommendationScanBudget({ hasCursor: Boolean(validated.value.cursor), discoveryMode: validated.value.discoveryMode });
```

`index.ts`의 다른 줄은 바꾸지 않는다. 최신 분기는 이미 `budget.keywordLookups`(`:259`)·`budget.maxMonths`·`budget.maxRounds`(`:317`)·`budget.scanMs`(`:318`)·`budget.label`(`:349`)을 쓴다.

### 6.2 제목 키 (`supabase/functions/_shared/recommendationEngine.ts`)

```ts
/** isSameRecommendationWork가 비교하는 제목 키. 정규화한 주 제목·원제 중 2자 이상, 중복 없이, 주 제목 → 원제 순. */
export function recommendationSameWorkTitleKeys(
  input: Pick<SameWorkInput, "title_primary" | "title_original">
): string[];
```

- 정규화는 기존 `normalizeTitle` 그대로(`:1259-1265`). 새 정규화를 만들지 않는다.
- `isSameRecommendationWork`의 두 `new Set(...)`(`:1089-1098`)을 `new Set(recommendationSameWorkTitleKeys(left))`·`(right)`로 바꾼다. 그 아래 판정(`:1099-1112`)은 한 글자도 바꾸지 않는다.

### 6.3 라이브러리 색인 (`src/utils/recommendationVisibility.ts`)

```ts
export interface RecommendationLibraryIndex {
  /** 수동 등록이 아닌 항목의 `${source_api}:${source_id}` */
  externalKeys: ReadonlySet<string>;
  /** recommendationSameWorkTitleKeys 키 → 그 키를 가진 라이브러리 항목(라이브러리 순서) */
  byTitleKey: ReadonlyMap<string, readonly LibraryListItem[]>;
}

/** 같은 배열 참조에는 같은 색인 객체를 돌려준다(WeakMap). */
export function getRecommendationLibraryIndex(libraryItems: readonly LibraryListItem[]): RecommendationLibraryIndex;

/** result와 제목 키를 하나 이상 공유하는 라이브러리 항목. 중복 없이. */
export function findSameWorkLibraryCandidates(
  index: RecommendationLibraryIndex, result: SearchResult
): LibraryListItem[];

// 시그니처 그대로
export function isRegisteredRecommendation(result: SearchResult, libraryItems: readonly LibraryListItem[]): boolean;
```

`isRegisteredRecommendation` 판정 순서:

1. `index = getRecommendationLibraryIndex(libraryItems)`
2. `index.externalKeys`에 `${result.external_source}:${result.external_id}`가 있으면 `true`
3. `findSameWorkLibraryCandidates(index, result).some(item => isSameRecommendationWork(item, result))`

지금 코드의 판정(`:12-21`)과 결과가 같아야 한다. 수동 항목(`source_api === "manual"`)은 외부 키 집합에 넣지 않고, 제목 비교 대상에는 넣는다(지금과 같음).

---

## 7. 데이터 모델 / SQL

없음. 마이그레이션을 만들지 않는다.

---

## 8. 화면 명세

바뀌는 화면 없음(D-6). 사용자에게 보이는 변화는 첫 응답 카드 수가 늘고, 카드가 몇 개씩 붙는 횟수가 주는 것이다(서버 배포 뒤).

---

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 최신 모드 첫 요청 | 4초·32·6개월·6바퀴, 진단 `latest_first` | T-1, T-4 |
| E-2 | 최신 모드 이어 찾기 | 지금과 같은 `continuation` | T-2 |
| E-3 | mixed 모드(구 앱) 첫 요청, 모드 생략 호출 | 지금과 같은 `first`(1초) | T-3 |
| E-4 | 이번 달 적격 2개, 지난달 10개, 공급자 조회 한 바퀴가 1.1초 | 최신 첫 예산이면 한 요청에 12개, mixed 첫 예산이면 2개 + `scanBudgetReached` | T-5 |
| E-5 | 12개를 첫 바퀴에서 다 찾음 | 예산과 상관없이 그 자리에서 끝난다(기존 루프 조건, 바꾸지 않음) | 기존 LC 테스트 |
| E-6 | 외부 키가 같은 등록 작품 | 등록으로 판정 | T-7 |
| E-7 | 수동 등록 항목의 `source_id`가 추천 외부 ID와 같음 | 외부 키로는 판정하지 않음(제목·유형·연도로만) | T-7 |
| E-8 | 공백·문장부호·전각 차이만 있는 같은 제목 | 지금처럼 같은 제목 | T-6, T-7 |
| E-9 | 원제만 같은 작품 | 지금처럼 비교 대상 | T-7 |
| E-10 | 1자 제목 | 지금처럼 비교 키에서 제외 | T-6, T-7 |
| E-11 | 영화↔드라마 같은 제목 ±1년 / ±2년 / 연도 모름 | 지금처럼 참 / 거짓 / 거짓 | T-7 |
| E-12 | 같은 제목 애니↔영화 | 지금처럼 거짓(V-2) | T-7, 기존 V-2 |
| E-13 | 같은 배열을 여러 번 / 내용이 같은 다른 배열 | 같은 색인 재사용 / 새 색인 | T-8 |
| E-14 | 라이브러리 2,000개 중 같은 제목 2개 | 비교 대상이 그 2개뿐 | T-9 |
| E-15 | 빈 라이브러리(`[]`가 렌더마다 새로 만들어짐) | 빈 색인, 판정 거짓, 오류 없음 | T-7 |

---

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 테스트 이름은 `85 T-N: …`으로 시작한다. "수정 전" 열이 **실패**인 행은 STEP 1에서 실제 실패를 확인한다.

| ID | 위치 · 이름 | 입력 | 기대 | 수정 전 |
|----|------------|------|------|---------|
| T-1 | `supabase/functions/_shared/recommendationTasteFill.test.ts` · `85 T-1: latest first requests use the continuation-size scan budget` | `recommendationScanBudget({ hasCursor: false, discoveryMode: "latest" })` | `deepEqual { scanMs: 4000, keywordLookups: 32, maxMonths: 6, maxRounds: 6, label: "latest_first" }` | **실패**(`first` 반환) |
| T-2 | 같은 파일 · `85 T-2: latest continuations keep the continuation budget` | `({ hasCursor: true, discoveryMode: "latest" })` | `continuation` 객체(SB-2와 같음) | 통과(보존) |
| T-3 | 같은 파일 · `85 T-3: mixed and unspecified first requests keep the one-second budget` | `({ hasCursor: false, discoveryMode: "mixed" })`, `({ hasCursor: false })` | 둘 다 `first` 객체(SB-1과 같음) | 통과(보존) |
| T-4 | 새 파일 `supabase/functions/personalized-recommendations/latestFirstBudget.test.ts` · `85 T-4: the handler passes the discovery mode to the scan budget` | `index.ts` 원문을 읽는다(`node:fs`) | `recommendationScanBudget(` 등장 1회, 그 줄이 6.1의 한 줄과 같다(공백 무시 비교 가능) | **실패** |
| T-5 | 같은 새 파일 · `85 T-5: a latest first request crosses into the previous month within one request` | 9.E-4. 애니 한 스트림(`mediaType: "anime"`, `now: "2026-11-15T03:00:00.000Z"`, `minimumMonth: "2026-01"`), 11월 1페이지 2개(`hasMore: false`), 10월 1페이지 10개. 가짜 시계: fetcher 호출마다 1,100ms 증가. `canContinue: () => clock < budget.scanMs`, `maxMonthsPerRequest: budget.maxMonths`, `maxProviderRoundsPerRequest: budget.maxRounds`, `limit: 12` | 최신 첫 예산(`recommendationScanBudget({ hasCursor: false, discoveryMode: "latest" })`): `items.length === 12`. 비교로 mixed 첫 예산: `items.length === 2`, `scanBudgetReached === true`, `hasMore === true` | **실패**(최신 첫 예산도 2개) |
| T-6 | `supabase/functions/_shared/recommendationEngine.test.ts` · `85 T-6: same-work title keys normalize, drop short titles and deduplicate` | `{ title_primary: " 첫 번째, 작품! ", title_original: "첫번째작품" }` / `{ title_primary: "A", title_original: null }` / `{ title_primary: "ＡＢＣ", title_original: "abc" }` | `["첫번째작품"]` / `[]` / `["abc"]` | **실패**(내보내기 없음) |
| T-7 | `src/utils/recommendationVisibility.test.ts` · `85 T-7: indexed registration matches the full library scan` | 표 아래 T-7 고정 데이터 전부 | 후보마다 `isRegisteredRecommendation(c, lib)`이 표 아래 기준 함수 `fullScan(c, lib)`와 같다. 빈 라이브러리 `[]`는 모두 `false` | 통과(보존) |
| T-8 | 같은 파일 · `85 T-8: the library index is reused per array reference` | 같은 배열 `lib`로 `getRecommendationLibraryIndex` 2회, 내용이 같은 `[...lib]`로 1회 | 앞 둘은 `===`, 마지막은 `!==` | **실패**(함수 없음) |
| T-9 | 같은 파일 · `85 T-9: same-work candidates come only from matching titles` | 제목이 모두 다른 라이브러리 2,000개 + 제목 "목표 작품" 2개(애니 2025, 영화 2025). 후보 "목표 작품" 애니 2025, 후보 "없는 제목" | 앞 후보의 `findSameWorkLibraryCandidates` 결과가 정확히 그 2개(순서 무관), 뒤 후보는 `[]` | **실패**(함수 없음) |

T-7 기준 함수(지금 `isRegisteredRecommendation` 본문과 같은 전체 훑기, 테스트 파일 안에 둔다):

```ts
const fullScan = (c: SearchResult, lib: readonly LibraryListItem[]) => lib.some((i) =>
  (i.source_api !== "manual" && `${i.source_api}:${i.source_id}` === `${c.external_source}:${c.external_id}`) ||
  isSameRecommendationWork(i, c));
```

T-7 고정 데이터(테스트 파일에 그대로 둔다):

- 라이브러리(`source_api` `source_id` 유형 제목 [원제] 연도): ① tmdb `333` kdrama "개인적인 택시" 2026 ② manual `999` anime "수동 작품" 연도 없음 ③ anilist `10` anime "같은 제목" 2026 ④ tmdb `20` movie "영화 제목" 2024 ⑤ tmdb `30` jdrama "원제만" [オリジナル] 2025 ⑥ tmdb `40` anime "A" 2026
- 후보(`external_source` `external_id` 유형 제목 [원제] 연도): ⓐ tmdb `333` kdrama "다른 제목" 2026(외부 키) ⓑ tmdb `999` anime "다른 작품" 2026(수동 항목 번호와만 같음) ⓒ1·ⓒ2·ⓒ3 anilist `11`·`12`·`13` anime "같은 제목" 2026 / 2025 / 연도 없음 ⓓ tmdb `14` movie "같은 제목" 2026(V-2) ⓔ1·ⓔ2·ⓔ3 tmdb `21`·`22`·`23` kdrama "영화 제목" 2025 / 2026 / 연도 없음 ⓕ tmdb `31` jdrama "다른 번역" [オリジナル] 2025 ⓖ anilist `41` anime "A" 2026(1자 제목) ⓗ anilist `15` anime "같은   제목!" 2026(공백·문장부호) ⓘ anilist `77` anime "수동 작품" 연도 없음(라이브러리 ②와 제목·유형 같음)
- 기대는 후보마다 기준 함수와 비교한다. 기준 함수가 무의미하게 같은 값을 내는 경우를 막으려고 ⓐ ⓒ1 ⓒ3 ⓔ1 ⓕ ⓗ ⓘ가 `true`, ⓑ ⓒ2 ⓓ ⓔ2 ⓔ3 ⓖ가 `false`인지도 따로 단언한다.

보존 테스트: `recommendationVisibility.test.ts`의 V-1·V-2·parity 묶음·Y-5, `recommendationEngine.test.ts`의 같은 작품 판정, `recommendationTasteFill.test.ts`의 SB-1·SB-2, `recommendationLatestCatalog.test.ts` 전체(LC-5 포함)는 assertion을 바꾸지 않고 통과해야 한다.

---

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/recommendationTasteFill.ts` | 6.1 `RecommendationScanBudget.label`에 `"latest_first"`, `recommendationScanBudget` 입력에 `discoveryMode` |
| `supabase/functions/_shared/recommendationTasteFill.test.ts` | T-1~T-3 추가 |
| `supabase/functions/personalized-recommendations/index.ts` | 257행 한 줄(6.1) |
| `supabase/functions/personalized-recommendations/latestFirstBudget.test.ts` | 새 파일, T-4·T-5 |
| `supabase/functions/_shared/recommendationEngine.ts` | 6.2 `recommendationSameWorkTitleKeys` 내보내기, `isSameRecommendationWork` 두 Set만 교체 |
| `supabase/functions/_shared/recommendationEngine.test.ts` | T-6 추가 |
| `src/utils/recommendationVisibility.ts` | 6.3 색인·후보 함수, `isRegisteredRecommendation` 내부 |
| `src/utils/recommendationVisibility.test.ts` | T-7~T-9 추가 |
| `docs/development_next_steps.md` | 맨 위에 "최신 추천 첫 묶음 지연 정정 (docs/85, 날짜)" 항목 |
| `docs/README.md` | 85행 상태 갱신(행은 이미 있음) |

---

## 12. 범위 밖

- **`recommendationLatestCatalog.ts` 전부**(헤드 검증 방식, 월·바퀴 루프). D-3.
- **앱의 이어 찾기 한도·호출 제한 시간·자동 호출 상한**(`recommendationFeed.ts`, `recommendationInvocationStats.ts`, 훅의 `INITIAL_LOADING_DEADLINE_MS`). D-2.
- **검색 화면 `app/search.tsx`와 추천 카드 컴포넌트**: 빈 카드 자리 배치(마지막 줄 빈칸 뒤 새 줄에서 시작), 로딩 문구, `extraData` 문자열. D-6, 5장.
- **`usePersonalizedRecommendations.ts`**: 렌더마다 개수를 세는 구조는 그대로 두고 판정 함수만 빠르게 한다(5장).
- **서버의 라이브러리·피드백 조회, 노출 기록, 국내 OTT 정보 붙이기, 최근 노출 24개 제외.** D-2, 5장.
- **mixed 모드 경로**(취향 보충·미리 받기). 구 앱 호환으로 그대로 둔다.
- **`similarityLibrary.ts` 등 `isSameRecommendationWork`의 다른 사용처.** 함수 동작이 같으므로 고치지 않는다.

---

## 13. 확실하지 않음 — 별도 검증 필요

| # | 가정 | 확인 방법 |
|---|------|----------|
| U-1 | D-1 뒤 첫 응답이 대부분 12개 가까이 차고 요청 수가 줄어든다. 공급자 응답 속도·캐시 적중·키워드 확인 수에 따라 4초 안에 지난달까지 못 갈 수 있다 | M-1(수정 전)과 M-2(배포 뒤)를 같은 계정·같은 필터로 비교한다. 요청 수, 각 `count`, `diagnostics.total_ms`·`catalog_ms`·`keyword_lookups_used`·`cache_hits/cache_reads`, 첫 카드·12번째 카드 시각 |
| U-2 | F-2 계산이 휴대폰에서 화면 반응을 끊는다. 데스크톱 Node 측정(21~64ms/회)만 있고 휴대폰 배율과 실제 렌더 횟수는 재지 않았다 | M-3 로컬 계산 측정(수정 전·후), 가능하면 M-4에서 체감 확인 |
| U-3 | 남는 지연의 큰 몫이 헤드별 직렬 키워드 확인인지 | M-2에서 `catalog_ms`가 4초 가까이 남고 `keyword_lookups_used`가 크면 docs/70 D-3 계약을 다시 볼 별도 명세를 쓴다 |
| U-4 | 첫 응답이 길어져(최대 약 8.5초 + 콜드 스타트) 앱 제한 14·15초에 걸리지 않는다 | M-2에서 `elapsedMs` 최댓값을 적는다. 14초에 가까우면 보고만 한다(D-2) |

---

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다.
검색 탭 "내 취향 최신 추천"이 첫 응답에서 카드 몇 개만 가져오고 나머지를 여러 번에 나눠 붙이는 문제와, 로딩 중 렌더마다 라이브러리 전체를 비교하는 문제를 고친다. 정정 작업이다. 화면·문구·DB는 바꾸지 않는다.

| ID | 결함 | 고칠 곳 |
|----|------|---------|
| F-1 | 최신 모드 첫 요청이 1초 예산(취향 보충 전제)으로 끝나 짧은 응답 → 앱이 최대 6회 다시 부름 | `recommendationScanBudget`에 모드, 핸들러 한 줄 |
| F-2 | 등록 작품 판정이 추천마다 라이브러리 전체·제목 정규화 반복(1회 21~64ms) | `recommendationVisibility.ts` 색인, 제목 키 공용 함수 |

# READ FIRST
1. `docs/85_latest_recommendation_first_batch_latency_fixes_spec.md` — 이 명세. 2장 원인, D-1~D-6, 6장 계약, 9장 E-N, 10장 테스트 표.
2. `docs/70_latest_recommendation_catalog_and_cpu_fixes_spec.md` 28·40행 — 최신 모드에서 취향 보충을 끈 결정과 짧은 응답 허용. D-1의 근거.
3. `docs/64_recommendation_invocation_cost_fixes_spec.md` 4장 D-3·10장 SB-1/SB-2 — 이번에 최신 모드 첫 요청만 대체하는 결정과 유지할 테스트.
4. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
5. `supabase/functions/_shared/recommendationTasteFill.ts:118-130`, `supabase/functions/personalized-recommendations/index.ts:250-360`, `supabase/functions/_shared/recommendationLatestCatalog.ts:116-371`(읽기만), `src/utils/recommendationVisibility.ts`, `supabase/functions/_shared/recommendationEngine.ts:1079-1113, 1259-1265`

# 시작 상태 (반드시 유지)
- 명세 작성 시 `npm test` 1,876개 통과(docs/84 작업 트리 기준). 다른 작업이 섞일 수 있으니 시작할 때 직접 기준선을 적는다.
- 운영 `personalized-recommendations`는 v26(2026-11-16 배포). 이번 작업은 배포하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 최신 모드 첫 요청만 `{4000, 32, 6, 6, "latest_first"}`. 커서 있는 요청은 `continuation`, mixed·모드 생략 첫 요청은 `first`(1초) 그대로. 숫자를 새로 만들지 않는다.
- **D-3.** `supabase/functions/_shared/recommendationLatestCatalog.ts`와 그 테스트는 **바꾸지 않는다.** 헤드 검증을 병렬화하지 않는다.
- **D-2.** 요청 마감 8.5초, 앱 호출 14초·첫 로딩 15초, 이어 찾기 6회·45초·무진전 3회, 분당 자동 호출 12회, 최근 노출 24개를 바꾸지 않는다.
- **D-4.** `isRegisteredRecommendation`의 시그니처와 결과를 바꾸지 않는다. 호출부(`app/search.tsx`, `src/hooks/usePersonalizedRecommendations.ts`)는 **바꾸지 않는다.**
- **D-5.** 제목 정규화를 앱에 복사하지 않는다. `recommendationSameWorkTitleKeys`만 쓴다. `isSameRecommendationWork`는 두 Set 생성만 바꾸고 판정 줄(1099~1112행)은 그대로 둔다.
- **D-6.** 화면·문구·응답 필드를 바꾸지 않는다.
- 기존 SB-1·SB-2, LC-1~LC-21·LC-X1~X4, V-1·V-2·parity·Y-5, 같은 작품 판정 테스트의 assertion을 바꾸지 않는다.

# STEP 0 — 수정 전 측정 (가능할 때)
로그인된 웹 8081 개발 빌드가 있으면 3장 재현 시나리오대로 M-1을 기록한다. 로그인할 수 없으면 "M-1 미실행(로그인 없음)"으로 적고 다음 STEP으로 간다. 이 단계에서 추천 카드의 추가·완료·관심 없음, "새 추천", 필터 저장을 누르지 않는다.

# STEP 1 — 실패하는 테스트부터
10장 T-1~T-9를 모두 쓴다. `npm test`를 돌려 "수정 전" 열이 **실패**인 T-1·T-4·T-5·T-6·T-8·T-9가 실제로 실패하고, T-2·T-3·T-7이 통과하는 것을 눈으로 확인한다. 예상과 다르면 멈추고 보고한다.
- T-4·T-5는 새 파일 `supabase/functions/personalized-recommendations/latestFirstBudget.test.ts`에 둔다. T-4는 `node:fs`로 `index.ts`를 읽는다. T-5는 `../_shared/recommendationLatestCatalog.ts`의 `scanLatestRecommendationCatalog`와 `../_shared/recommendationTasteFill.ts`의 `recommendationScanBudget`만 import한다(`index.ts`는 import하지 않는다. `Deno.serve`가 실행된다).
- T-5 후보는 `recommendationLatestCatalog.test.ts`의 `candidate(id, date)` 모양(anilist·anime·한국어 제목·`countries: ["JP"]`)을 새 파일에 복사해 쓴다. 기존 테스트 파일은 고치지 않는다.
- T-7은 `isSameRecommendationWork`를 `../../supabase/functions/_shared/recommendationEngine`에서 import해 기준 함수를 만든다.

# STEP 2 — 탐색 예산 (F-1)
`recommendationTasteFill.ts`를 6.1 계약대로 바꾼다. 교체 전/후:
```ts
// 전
export function recommendationScanBudget(input: { hasCursor: boolean }): RecommendationScanBudget {
  return input.hasCursor
    ? { scanMs: 4_000, keywordLookups: 32, maxMonths: 6, maxRounds: 6, label: "continuation" }
    : { scanMs: 1_000, keywordLookups: 16, maxMonths: 3, maxRounds: 3, label: "first" };
}
// 후
// The one-second first scan assumed taste fill would complete the batch (docs/52).
// Latest mode has no taste fill (docs/70), so its first request uses the continuation budget (docs/85 D-1).
export function recommendationScanBudget(input: { hasCursor: boolean; discoveryMode?: "latest" | "mixed" }): RecommendationScanBudget {
  if (input.hasCursor) return { scanMs: 4_000, keywordLookups: 32, maxMonths: 6, maxRounds: 6, label: "continuation" };
  if (input.discoveryMode === "latest") return { scanMs: 4_000, keywordLookups: 32, maxMonths: 6, maxRounds: 6, label: "latest_first" };
  return { scanMs: 1_000, keywordLookups: 16, maxMonths: 3, maxRounds: 3, label: "first" };
}
```
`label` 타입에 `"latest_first"`를 더한다. `index.ts:257` 한 줄을 6.1대로 바꾼다. T-1~T-5 통과.

# STEP 3 — 제목 키 공용 함수 (F-2 준비)
`recommendationEngine.ts`에 6.2 `recommendationSameWorkTitleKeys`를 내보내고, `isSameRecommendationWork`의 두 Set만 이 함수로 만든다. T-6 통과, 기존 `recommendationEngine.test.ts` 전체 통과.

# STEP 4 — 라이브러리 색인 (F-2)
`recommendationVisibility.ts`에 6.3의 `RecommendationLibraryIndex`·`getRecommendationLibraryIndex`(모듈 범위 `WeakMap`)·`findSameWorkLibraryCandidates`를 만들고, `isRegisteredRecommendation`을 6.3 판정 순서로 바꾼다. 다른 내보내기 함수의 본문은 바꾸지 않는다. T-7~T-9와 기존 visibility 테스트 통과.

# STEP 5 — 로컬 계산 측정 (M-3)
저장소 **밖** 임시 파일로 2장 2.2-3과 같은 측정을 수정 후 다시 한다: 라이브러리 671개(제목이 서로 다른 합성 데이터), 추천 12·24·36개, `filterVisibleRecommendationCandidates` 20회 평균 ms. 수정 전 수치(21.3/42.5/63.7ms, 명세 2.2-3)와 나란히 보고한다. 임시 파일은 커밋 대상이 아니며 변경 파일 목록에 넣지 않는다.

# STEP 6 — 기록
`docs/development_next_steps.md` 맨 위에 "최신 추천 첫 묶음 지연 정정 (docs/85, 날짜)" 항목을 만든다: 상태, 실패 출력 요약, 검사 결과, M-1~M-4 실행/미실행과 사유, 사람이 할 후속 작업. `docs/README.md` 85행의 상태 칸을 실제 결과로 바꾼다.

# 엣지 케이스 (전부 처리, 명세서 9장)
9장 E-1~E-15 전부. 각 행의 테스트 열과 연결되어 있다.

# 수동 확인
| # | 환경 | 확인 |
|---|------|------|
| M-1 | 웹 8081 로그인, 수정 전(운영 v26) | 3장 재현 시나리오 5번 항목 기록. 첫 `scan_budget`은 `"first"` |
| M-2 | 웹 8081 로그인, **사람이 배포한 뒤** | M-1과 같은 계정·필터·시간대에 같은 항목 기록. 첫 `scan_budget`이 `"latest_first"`, 요청 수와 12번째 카드 시각이 M-1보다 줄었는지. 배포 전이면 "배포 대기"로 적는다 |
| M-3 | 로컬 Node | STEP 5 측정 전·후 |
| M-4 | 앱(iOS 세로, 개발 빌드) | 검색 탭 추천이 채워지는 동안 스크롤이 끊기지 않는지, 요청 수(Metro 로그). 환경이 없으면 미실행 사유를 적는다 |

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(명세 작성 시 기준선 1,876개, 시작 때 직접 기록한 수가 기준). 끝난 뒤 수 = 기준선 + 9.

# DEFINITION OF DONE
- [ ] T-1·T-4·T-5·T-6·T-8·T-9가 수정 전에 실패하는 것을 확인했고, 수정 후 T-1~T-9가 모두 통과한다
- [ ] 기존 테스트 개수가 줄지 않았고, SB-1·SB-2·LC 전체·V-1·V-2·같은 작품 판정 assertion을 바꾸지 않았다
- [ ] `index.ts`의 변경은 257행 한 줄뿐이다(`git diff`로 확인)
- [ ] `recommendationLatestCatalog.ts`, `app/search.tsx`, `usePersonalizedRecommendations.ts`, `recommendationFeed.ts` diff 0줄
- [ ] `isSameRecommendationWork`의 판정 줄(1099~1112행) diff 0줄
- [ ] M-3 수정 전·후 수치를 보고했다
- [ ] M-1·M-2·M-4는 실행 결과 또는 미실행 사유를 적었다
- [ ] `npm run typecheck`, `npm run lint` 통과

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
supabase/functions/_shared/recommendationTasteFill.ts
supabase/functions/_shared/recommendationTasteFill.test.ts
supabase/functions/personalized-recommendations/index.ts
supabase/functions/personalized-recommendations/latestFirstBudget.test.ts
supabase/functions/_shared/recommendationEngine.ts
supabase/functions/_shared/recommendationEngine.test.ts
src/utils/recommendationVisibility.ts
src/utils/recommendationVisibility.test.ts
docs/development_next_steps.md
docs/README.md
```

# 보고 항목
1. STEP 1 실패 테스트의 실제 출력(T-1·T-4·T-5·T-6·T-8·T-9)
2. `npm test` 결과(before / after 통과 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. `index.ts`·`recommendationTasteFill.ts`·`recommendationEngine.ts`·`recommendationVisibility.ts` diff 요약
6. M-1~M-4 결과 또는 미실행 사유, M-3 전·후 수치
7. D-1~D-6 중 문제가 있다고 판단한 항목(바꾸지는 말고 보고만)
8. 사람이 할 후속 작업: ① `personalized-recommendations` 재배포(로컬 HEAD에는 docs/82의 공용 필터 변경도 들어 있어 함께 배포된다. docs/82 기록을 먼저 확인) ② 배포 뒤 M-2 ③ U-3 결과에 따른 후속 명세 여부

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 운영 DB에 쓰지 않는다. 수동 확인 중 추천 카드의 추가·완료·관심 없음·테마 줄이기, "새 추천", 필터 저장을 누르지 않는다(화면을 여는 것만으로 생기는 기존 노출 기록은 예외).
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
