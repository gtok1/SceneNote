# 26. 추천 제공처 복구 보고 · 시즌 라이브러리 조회 폴백 명세

작성일: 2026-09-23
대상 브랜치 기준: `main` (`5436e2f`, `ca4e285` 이후)
선행 문서: `docs/17_season_library_tracking_spec.md`, `docs/22_search_recommendations_restore_spec.md`

---

## 1. 문제 정의

코드 리뷰(`fb07e3c..HEAD`)에서 확인된 결함 3건을 수정한다. 세 건 모두 **사용자에게 사실과 다른 상태가 보이는** 문제이며, 두 건은 migration 0021(시즌 단위 라이브러리) 도입의 미완성 마감이다.

| ID | 위치 | 증상 |
|----|------|------|
| **F-1** | `supabase/functions/_shared/recommendationCatalog.ts:200` | 한 번 실패한 제공처가 다음 요청에서 정상 응답해도 계속 "실패"로 보고된다 |
| **F-2** | `app/(tabs)/index.tsx:106` | 곧 방영 섹션에서 시즌 등록 작품을 열면 미등록 화면이 뜬다 |
| **F-3** | `app/content/[id].tsx:119` | external id로만 진입하면 시즌 등록 작품이 미등록으로 보이고, 다시 추가하면 라이브러리에 중복 행이 생긴다 |

---

## 2. F-1 — 제공처 복구가 보고 상태에 반영되지 않음

### 2.1 현재 동작

`scanRecommendationCatalog`는 요청 시작 시 커서에 남아 있는 실패 이력으로 보고용 집합을 미리 채운다.

```ts
// recommendationCatalog.ts:129-135
const failedProviders = new Set<RecommendationProvider>();
for (const provider of activeProviders) {
  if (state.providers[provider].failures > 0) {
    failedProviders.add(provider);
    warnings.add(`${provider}:unavailable`);
  }
}
```

그런데 제공처가 이번 요청에서 성공했을 때는 커서 상태만 되돌리고 보고용 집합은 손대지 않는다.

```ts
// recommendationCatalog.ts:198-201
if (result.status === "fulfilled") {
  successfulPages.set(provider, result.value);
  state.providers[provider].failures = 0;   // 커서는 복구됨
  return;                                    // failedProviders / warnings 는 그대로
}
```

### 2.2 재현 시나리오

1. 요청 1: AniList 타임아웃 → `failures = 1`이 커서에 인코딩되어 클라이언트로 내려간다.
2. 요청 2: 그 커서를 그대로 보낸다. 129행이 `failedProviders`에 `anilist`를, `warnings`에 `anilist:unavailable`을 미리 넣는다.
3. `healthyPendingProviders`가 비므로 `attemptedProviders`는 `["anilist"]`가 되어 **재시도된다**. 이번엔 성공한다.
4. 200행이 `failures = 0`으로 되돌린다. 하지만 응답은 여전히 `failed_sources: ["anilist"]`.

### 2.3 사용자에게 보이는 결과

```
Edge Function  failed_sources: ["anilist"]
  ↓ src/services/personalizedRecommendations.ts:152
  partial: partial || failedSources.size > 0   →  true
  ↓ app/search.tsx:671
  "일부 추천 제공처의 결과를 불러오지 못했습니다. 현재 가능한 작품을 표시합니다."
```

`usePersonalizedRecommendations.ts`의 365·389·489행이 `failed_sources`를 **합집합으로 누적**하므로, 한 번 끼어든 값은 이후 깨끗한 페이지를 아무리 받아도 세션 내내 사라지지 않는다. 즉 일시적 장애 1회가 영구 배너가 된다.

`personalized-recommendations/index.ts`는 `maxProviderRoundsPerRequest: 1`이므로 한 요청 안에서 "실패 후 성공"은 일어나지 않는다. **유일한 오염 경로가 커서 pre-seed**라는 뜻이고, 그래서 수정은 좁고 안전하다.

### 2.4 설계 결정

- **D-1. 성공 시 보고 집합에서 제거한다.** `failures = 0` 바로 옆에서 `failedProviders.delete(provider)`와 `warnings.delete(`${provider}:unavailable`)`를 수행한다.
- **D-2. `failures`가 이미 0으로 리셋되고 있다는 점이 근거다.** 커서 상태와 보고 상태가 같은 사실을 서로 다르게 말하는 것이 결함이다. 두 곳을 한 지점에서 함께 갱신해 어긋날 수 없게 만든다.
- **D-3. 실패 시 로직은 건드리지 않는다.** `failures += 1`, `failedProviders.add`, `warnings.add`는 그대로 둔다.
- **기각한 대안**: 129~135행의 pre-seed 자체를 제거하는 방안. `successfulPages.size === 0`인 조기 반환 경로(208행)에서 "이 제공처가 왜 막혔는지"를 설명할 근거가 사라지고, 재시도조차 못 한 제공처가 보고에서 통째로 빠진다. 기각.

### 2.5 수정 후 동작표

| 이전 요청 `failures` | 이번 요청 결과 | `failedProviders` 포함 | `warnings` 포함 |
|---|---|---|---|
| 0 | 성공 | 아니오 | 아니오 |
| 0 | 실패 | 예 | 예 |
| 1 | 성공 | **아니오** (현재: 예) | **아니오** (현재: 예) |
| 1 | 실패 | 예 | 예 |
| 1 | 재시도 안 함(다른 healthy 제공처 존재) | 예 | 예 |

마지막 행이 중요하다. `healthyPendingProviders`가 비어 있지 않으면 실패 이력이 있는 제공처는 이번 라운드에서 호출되지 않는다(251행). 호출되지 않았으면 복구를 확인한 바 없으므로 보고를 유지하는 것이 맞다.

---

## 3. F-2 · F-3 — 시즌 라이브러리 조회

### 3.1 현재 동작

migration 0021로 `user_library_items`는 `(user_id, content_id, season_number)` 단위 행을 갖는다. 상세 화면은 그에 맞춰 조회를 바꿨다.

```ts
// app/content/[id].tsx:119
const libraryItem = library.data?.find((item) =>
  item.content_id === resolvedContentId &&
  (params.libraryItemId
    ? item.library_item_id === params.libraryItemId
    : item.season_number === (params.season ? Number(params.season) : null)));
```

`libraryItemId`도 `season`도 없이 들어오면 **`season_number === null`인 행만** 찾는다. 시즌 단위로만 등록한 작품은 조회에 걸리지 않는다.

### 3.2 F-2 재현 시나리오

`app/(tabs)/index.tsx`의 곧 방영 섹션은 `useUpcomingAiring(library.data)`가 돌려주는 `LibraryListItem[]`을 쓴다. 이 항목들은 `library_item_id`와 `season_number`를 갖고 있는데, 네비게이션에서 둘 다 버린다.

```ts
// 88-90행 — 보는 중 카드: 두 파라미터를 모두 넘긴다
onPress={() => router.push({ pathname: "/content/[id]", params: {
  id: item.content_id, libraryItemId: item.library_item_id,
  ...(item.season_number != null ? { season: String(item.season_number) } : {}) } })}

// 106행 — 곧 방영 섹션: id만 넘긴다  ← 결함
onPressItem={(item) => router.push({ pathname: "/content/[id]", params: { id: item.content_id } })}
```

VIVANT 시즌 2를 등록(`season_number = 2`)한 사용자가 곧 방영 섹션에서 그 작품을 누르면 `libraryItem`이 `undefined`가 되어, 상태 칩·시청 횟수·진행 위치가 전부 사라지고 "라이브러리에 추가" 화면이 뜬다.

### 3.3 F-3 재현 시나리오

추천 섹션(`src/components/content/PopularRecommendationSection.tsx:83`)과 인물 상세(`app/people/[id].tsx:284`)는 외부 결과라서 `source`/`externalId`만 넘긴다. 이 경로에는 넘길 `season`이 애초에 없다.

1. 사용자가 검색에서 "촌구석 아저씨, 검성이 되다 2기"를 시즌 2로 등록한다 → `season_number = 2` 행 1개.
2. 나중에 같은 작품이 추천 섹션에 뜬다. 눌러서 들어간다.
3. `externalDetail`이 `content_id`를 해석한 뒤에도 119행은 `season_number === null`을 요구하므로 매칭 실패.
4. 화면은 미등록 상태. 사용자가 "보는 중"을 누르면 218행이 `seasonNumber` 없이 추가 → `season_number = null` 행이 **새로 생긴다**.
5. migration 0021의 partial unique index는 `(user_id, content_id) WHERE season_number IS NULL`과 `(user_id, content_id, season_number) WHERE season_number IS NOT NULL`을 각각 따로 걸기 때문에 이 중복을 막지 못한다. 라이브러리 목록에 같은 작품이 두 줄로 나온다.

### 3.4 설계 결정

- **D-4. 조회 우선순위를 명시적 함수로 분리한다.** `src/utils/seasonLibraryMatch.ts`에 `resolveContentLibraryItem`을 추가한다. 화면 파일에 인라인 `find` 조건을 두지 않는다 — 테스트가 React Native를 import할 수 없으므로 순수 함수로 빼야 검증할 수 있다(AGENTS.md 테스트 규칙).
- **D-5. `season`이 명시된 경우에는 절대 폴백하지 않는다.** 이것이 이 수정에서 제일 중요한 제약이다. `docs/17_season_library_tracking_spec.md` D-5와 동일한 이유로, 시즌 2를 보고 있는데 시즌 1(또는 whole-work) 행을 매칭하면 "등록하지도 않은 시즌 2가 등록된 것처럼 보이는" 이미 신고된 버그가 그대로 재발한다.
- **D-6. `season`이 없을 때만 폴백한다.** 호출자가 어느 시즌인지 모르는 상황이므로, whole-work 행 → (없으면) 시즌 번호가 가장 작은 행 순으로 매칭한다. 잘못된 시즌을 보여줄 위험보다 중복 등록을 막는 이익이 크다.
- **D-7. `libraryItemId`가 있으면 최우선, 단 못 찾으면 폴스루한다.** 다른 화면에서 그 행을 삭제한 뒤 돌아온 경우 `none`으로 끊지 말고 2~4단계로 내려간다.
- **D-8. `LibraryListItem`에서 출발한 모든 네비게이션은 `libraryItemId`와 `season`을 넘긴다.** F-2는 이 규칙의 유일한 위반 지점이다.
- **기각한 대안 A**: 119행에서 `season` 유무와 무관하게 whole-work로 폴백. D-5 위반이라 기각.
- **기각한 대안 B**: 추천·인물 경로에서 `season`을 추론해 넘기기. 추천 결과는 whole-work 단위라 추론할 근거가 없다. 기각.

### 3.5 계약

```ts
// src/utils/seasonLibraryMatch.ts

export type ContentLibraryMatch =
  | { kind: "library-item"; item: LibraryListItem }   // libraryItemId 직접 일치
  | { kind: "season"; item: LibraryListItem }         // 요청한 시즌과 일치
  | { kind: "whole-work"; item: LibraryListItem }     // 시즌 미지정 + 전체 작품 행
  | { kind: "other-season"; item: LibraryListItem }   // 시즌 미지정 + 시즌 행만 존재
  | { kind: "none" };

export function resolveContentLibraryItem(
  items: readonly LibraryListItem[],
  params: {
    contentId: string;
    libraryItemId?: string | null | undefined;
    seasonNumber?: number | null | undefined;
  }
): ContentLibraryMatch;
```

판정 순서 — 위에서부터 처음 걸리는 것을 반환한다.

1. `params.libraryItemId`가 truthy이고, `content_id === params.contentId && library_item_id === params.libraryItemId`인 행이 있으면 → `{ kind: "library-item", item }`
2. `rows = items.filter(item => item.content_id === params.contentId)`. `rows`가 비면 → `{ kind: "none" }`
3. `typeof params.seasonNumber === "number" && Number.isFinite(params.seasonNumber)`이면:
   - `rows`에서 `season_number === params.seasonNumber`인 행 → `{ kind: "season", item }`
   - 없으면 → **`{ kind: "none" }`** (D-5: 폴백 금지)
4. 시즌 미지정:
   - `rows`에서 `season_number == null`인 행 → `{ kind: "whole-work", item }`
   - 없으면 `season_number`가 가장 작은 행 → `{ kind: "other-season", item }`

기존 `matchLibraryItemForSeason`은 검색 결과 카드가 쓰고 있다. **삭제하거나 시그니처를 바꾸지 않는다.**

### 3.6 화면 적용

```ts
// app/content/[id].tsx — 119행 교체
const requestedSeason = parseSeasonParam(params.season);   // 아래 주석 참조
const libraryMatch = resolveContentLibraryItem(library.data ?? [], {
  contentId: resolvedContentId,
  libraryItemId: params.libraryItemId ?? null,
  seasonNumber: requestedSeason
});
const libraryItem = libraryMatch.kind === "none" ? undefined : libraryMatch.item;
```

`parseSeasonParam`은 `params.season`이 없거나 숫자로 파싱되지 않으면 `null`을 돌려준다. 현재 코드의 `params.season ? Number(params.season) : null`은 `"abc"`에서 `NaN`을 만들고 `NaN === null`이 false라 조용히 미등록 처리된다. 같은 파일 218행의 `Number(params.season)`도 이 헬퍼를 쓴다.

```ts
// app/(tabs)/index.tsx — 106행 교체 (88-90행과 동일한 형태로)
onPressItem={(item) => router.push({ pathname: "/content/[id]", params: {
  id: item.content_id,
  libraryItemId: item.library_item_id,
  ...(item.season_number != null ? { season: String(item.season_number) } : {})
} })}
```

---

## 4. 엣지 케이스

| # | 상황 | 기대 동작 |
|---|------|-----------|
| E-1 | `externalDetail` 해석 전, `resolvedContentId`가 `"tmdb:12345"` | 매칭 실패 → `none`. 해석 후 리렌더에서 매칭된다. 기존과 동일 |
| E-2 | `libraryItemId`가 가리키는 행이 삭제됨 | 2~4단계로 폴스루 |
| E-3 | `season=2`, 라이브러리에 whole-work 행만 존재 | `none`. "시즌 2 추가" 상태 유지 (D-5) |
| E-4 | `season=2`, 라이브러리에 시즌 1 행만 존재 | `none` (D-5) |
| E-5 | `season` 없음, 시즌 2·3 행만 존재 | `other-season` → 시즌 2 행 |
| E-6 | `season=abc` 같은 잘못된 파라미터 | `null`로 취급 → 4단계 폴백 |
| E-7 | 제공처가 이번 라운드에서 호출되지 않음 (다른 healthy 제공처 존재) | `failedProviders` 유지 |
| E-8 | 제공처가 이전 월에서 실패하고 이전 달 스캔에서 성공 | `failedProviders`에서 제거 (`moveCursorToMonth`가 `failures`를 리셋하므로 일관) |

---

## 5. 테스트 표

모든 행을 테스트로 옮긴다. 줄이지 않는다.

### 5.1 `supabase/functions/_shared/recommendationCatalog.test.ts`

| ID | 테스트 | 검증 |
|----|--------|------|
| T-1 | 실패 커서로 재시도해 성공하면 복구를 보고한다 | 기존 `"keeps an anime-only outage retryable and recovers on the next attempt"`에 `assert.deepEqual(recovered.failedProviders, [])`와 `assert.deepEqual(recovered.warnings, [])` 추가 |
| T-2 | 재시도해도 실패하면 계속 보고한다 | 같은 커서로 다시 실패 → `failedProviders`에 `"anilist"` 포함, `warnings`에 `"anilist:unavailable"` 포함 |
| T-3 | 호출되지 않은 실패 제공처는 보고를 유지한다 | `mediaType: "all"`, `anilist.failures = 1`, `tmdb_kr`이 healthy → `failedProviders`에 `"anilist"` 포함 |

T-1은 **수정 전에 반드시 실패해야 한다.** 실패하지 않으면 시나리오를 잘못 구성한 것이다.

### 5.2 `src/utils/seasonLibraryMatch.test.ts` (`resolveContentLibraryItem`)

| ID | `items` | `params` | 기대 |
|----|---------|----------|------|
| T-4 | id=`a`(season 2), id=`b`(season 3) | `{contentId:"c1", libraryItemId:"b"}` | `library-item`, `b` |
| T-5 | id=`a`(season 2) | `{contentId:"c1", libraryItemId:"zzz"}` | `other-season`, `a` (E-2 폴스루) |
| T-6 | season 2, season 3 | `{contentId:"c1", seasonNumber:3}` | `season`, season 3 행 |
| T-7 | whole-work(null) | `{contentId:"c1", seasonNumber:2}` | `none` (E-3 · D-5) |
| T-8 | season 1 | `{contentId:"c1", seasonNumber:2}` | `none` (E-4 · D-5) |
| T-9 | whole-work(null), season 2 | `{contentId:"c1"}` | `whole-work` |
| T-10 | season 3, season 2 | `{contentId:"c1"}` | `other-season`, season 2 행 (가장 작은 번호) |
| T-11 | 다른 content의 행만 | `{contentId:"c1"}` | `none` |
| T-12 | `[]` | `{contentId:"c1"}` | `none` |
| T-13 | whole-work(null) | `{contentId:"c1", seasonNumber:null}` | `whole-work` |
| T-14 | season 2 | `{contentId:"c1", seasonNumber:Number.NaN}` | `other-season` (E-6) |

기존 `matchLibraryItemForSeason` 테스트 4건은 그대로 통과해야 한다.

---

## 6. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/recommendationCatalog.ts` | 성공 시 `failedProviders`/`warnings`에서 제거 (2줄) |
| `supabase/functions/_shared/recommendationCatalog.test.ts` | T-1 보강, T-2·T-3 추가 |
| `src/utils/seasonLibraryMatch.ts` | `ContentLibraryMatch`, `resolveContentLibraryItem` 추가 |
| `src/utils/seasonLibraryMatch.test.ts` | T-4~T-14 추가 |
| `app/content/[id].tsx` | 119행 교체, `parseSeasonParam` 도입 |
| `app/(tabs)/index.tsx` | 106행에 `libraryItemId`·`season` 추가 |

DB 마이그레이션 없음. Edge Function 재배포는 F-1에만 필요하다.

---

## 7. 범위 밖

- `app/people/[id].tsx`와 `PopularRecommendationSection.tsx`의 네비게이션은 **바꾸지 않는다.** 외부 결과라 넘길 `season`이 없고, D-6 폴백으로 F-3이 해소된다.
- `usePersonalizedRecommendations.ts`의 `failed_sources` 합집합 누적(365·389·489행)은 그대로 둔다. F-1이 오염원이고, 그것을 막으면 누적 자체는 의도된 동작이다.
- `src/services/personalizedRecommendations.ts:152`의 `partial` 판정식도 그대로 둔다.
