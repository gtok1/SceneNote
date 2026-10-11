# 51. 추천 — 라이브러리에 다른 종류(영화↔드라마)로 저장된 같은 작품 제외

작성일: 2026-10-09
대상 브랜치 기준: `main` (`c6a0e7e`) + 미커밋 작업(`docs/48`~`50`). 직전 확인 시 `npm test` 1034개 중 1033개 통과 — 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함
선행 문서: `docs/30`(표시 가능 판정을 앱·서버가 같게), `docs/43`(추천 추가 identity)

> **근거.** 사용자 캡처 두 장. 라이브러리에 "개인적인 택시"(2026.09 · movie · 보고 싶음)가 있는데, 검색 탭 추천에 같은 작품(2026.10 공개, 드라마, 티빙·넷플릭스)이 "추가/완료" 버튼과 함께 뜬다.
> 사용자 요청: "라이브러리에 저장된 작품인데 검색 쪽에서 노출되고 추가도 가능하게 나오고 있어. 필터 제대로 걸게끔."

---

## 1. 문제 정의와 원인

**실측(TMDB 읽기 전용, 2026-10-09 "개인적인 택시" 검색)**

| 종류 | TMDB id | 공개일 | 비고 |
|------|---------|--------|------|
| movie | 1744241 | 2026-09-04 | 장르 드라마·음악. 라이브러리에 저장된 쪽(캡처 "movie", 장르 드라마·음악) |
| tv | 333484 | 2026-10-01 | KR 드라마 |
| tv | 300726 | 2026-10-01 | 같은 드라마의 중복 등록 |

TMDB에 같은 작품이 영화와 TV로 따로 있다(상영본·중복 등록). 사용자는 영화 쪽을 담았고, 추천은 TV 쪽을 낸다. 외부 id가 달라서 "같은 작품" 판정만 남는데, 그 판정이 **작품 종류가 같을 것**을 요구해서 둘을 다른 작품으로 본다.

| ID | 위치 | 코드 |
|----|------|------|
| C-1 | 앱 `src/utils/recommendationVisibility.ts:20` `isRegisteredRecommendation` | `if (item.content_type !== result.content_type) return false;` → movie ≠ kdrama라 등록 안 된 작품으로 보고 화면에 표시 |
| C-2 | 서버 `supabase/functions/_shared/recommendationEngine.ts:954` `areSameWork` | `if (normalizeContentType(left) !== normalizeContentType(right)) return false;` → `getRecommendationBatch`(508행) 라이브러리 제외(535행)를 통과 |
| C-3 | 같은 파일 `createWorkKeys` | `work:{type}:{title}:{year}` 식별자에 종류가 들어가 별칭도 겹치지 않음(바꾸지 않음, D-4) |

같은 종류 안의 중복(TV 333484 ↔ 300726)은 지금도 제목·연도로 걸러진다.

## 2. 설계 결정

### D-1. 같은 작품 판정을 공유 순수 함수 하나로 한다
- `isSameRecommendationWork(left, right)`를 `recommendationEngine.ts`에서 export한다.
- 서버 `areSameWork`는 이 함수를 쓰고, 앱 `isRegisteredRecommendation`도 외부 id 비교 다음에 이 함수를 쓴다.
- 앱과 서버의 판정이 갈라지지 않게 하기 위함이다(`docs/30` 원칙).

### D-2. 판정 규칙
1. 제목: 양쪽 `title_primary`·`title_original`을 정규화(기존 `normalizeTitle`: NFKC·소문자·공백/구두점/기호 제거, 2자 이상)한 집합이 겹치지 않으면 `false`.
2. 종류: `normalizeContentType`(기존, `drama` → `kdrama`)로 맞춘다. 연도는 기존 `getReleaseYear`(air_year → release_date/air_date 앞 4자리)다.
3. **같은 종류**: 두 연도를 모두 알고 서로 다르면 `false`, 아니면 `true`. 지금 동작 그대로다.
4. **다른 종류(새 규칙)**: 한쪽이 `movie`이고 다른 쪽이 `kdrama`·`jdrama`·`other` 중 하나이면 같은 작품일 수 있다. 이때 두 연도를 **모두 알고** 차이가 **1년 이하**면 `true`.
5. 그 외(`anime`이 끼는 다른 종류 조합 등)는 `false`.

근거
- 영화↔시리즈 중복은 상영본·특별판·외부 DB 중복 등록에서 생긴다(이번 사례).
- 연도를 모두 알 때만 허용해 오판을 줄인다. 1년 차이는 영화제 상영 뒤 다음 해 방영 같은 경우다.
- 애니는 극장판과 TV판이 같은 해에 같은 제목으로 나오는 일이 흔하고 실제로 다른 작품이라 제외한다.

### D-3. 적용 위치
| 위치 | 변경 |
|------|------|
| 서버 `areSameWork` | 본문을 `isSameRecommendationWork(left, right)` 호출로 바꾼다. 쓰는 곳 두 군데(라이브러리 제외 535행, 후보끼리 중복 제거 542행)가 함께 바뀐다. 피드에 영화·TV 중복이 같이 뜨는 일도 줄어든다 |
| 앱 `isRegisteredRecommendation` | 외부 id 일치 검사(지금 그대로) 다음의 종류·연도·제목 비교 블록을 `isSameRecommendationWork(item, result)`로 바꾼다 |

`summarizeRecommendationVisibility`·`filterVisibleRecommendationCandidates`·`findVisibleRecommendationReplacement`는 이 함수를 거치므로 함께 반영된다.

### D-4. 바꾸지 않는 것
- `createWorkKeys`(식별 별칭), 외부 id 비교
- 검색 결과(제목 검색) 중복 제거(`search-content/adapters/normalize.ts`의 별도 `areSameWork`)
- 검색 결과 카드의 "보고 싶음/완료" 버튼 판정

제목 검색은 사용자가 원하는 판(영화/TV)을 직접 고르는 곳이라 모두 보여 준다.

### D-5. 배포
- 앱 판정(D-3 앱)은 배포 없이 바로 적용된다. 운영 서버가 이 작품을 보내도 화면에서 숨긴다.
- 서버 판정은 `personalized-recommendations` 재배포 후 적용된다(사람). 재배포하면 서버가 처음부터 빼서 12개 채우기가 덜 깎인다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 3. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 종류를 무시하고 제목·연도만 비교 | 애니 극장판·TV판, 같은 제목의 리메이크가 함께 숨는다 |
| 포스터 URL 비교 | 같은 작품도 항목마다 이미지 경로가 다르다 |
| 라이브러리 작품을 TV 쪽으로 자동 교체 | 사용자 데이터 변경. 회차·진행 기록 이동이 얽힌다(사용자가 직접 바꿀 수 있음) |
| `createWorkKeys`에서 종류 제거 | 별칭 충돌이 전 경로(세션 seen·추가 잠금 등)로 번진다. 판정 함수 한 곳만 고친다 |

## 4. 계약

```ts
// supabase/functions/_shared/recommendationEngine.ts (export 추가)
export interface SameWorkInput {
  content_type?: string | null;
  title_primary?: string | null;
  title_original?: string | null;
  air_year?: number | null;
  air_date?: string | null;
  release_date?: string | null;
}
export function isSameRecommendationWork(left: SameWorkInput, right: SameWorkInput): boolean;
```
- 판정 순서는 D-2 1~5다. 기존 `normalizeTitle`·`normalizeContentType`·`getReleaseYear`를 재사용한다. 필요하면 `getReleaseYear`의 매개변수 타입만 `SameWorkInput`으로 넓힌다(동작은 그대로).
- 다른 종류 허용 집합: `movie` ↔ {`kdrama`, `jdrama`, `other`}.
- 기존 `areSameWork(left, right)`는 `return isSameRecommendationWork(left, right);`로 바꾼다.
- 앱(`recommendationVisibility.ts`)은 이미 쓰는 `../../supabase/functions/_shared/recommendationEngine`에서 `isSameRecommendationWork`를 import한다. 블록을 교체한 뒤 남는 로컬 `normalizeTitleForRecommendation`을 다른 곳에서 쓰지 않으면 지운다.

## 5. 엣지 케이스

| # | 상황 | 기대 | 연결 |
|---|------|------|------|
| E-1 | 라이브러리 movie 2026 "개인적인 택시" ↔ 추천 kdrama 2026 같은 제목 | 같은 작품 → 추천에서 제외 | I-1, I-10, V-1 |
| E-2 | movie 2026 ↔ kdrama 2027 | 같은 작품 | I-2 |
| E-3 | movie 2026 ↔ kdrama 2028 | 다른 작품 | I-2 |
| E-4 | movie 연도 모름 ↔ kdrama 2026 | 다른 작품(다른 종류는 연도 필수) | I-3 |
| E-5 | anime 2026 ↔ movie 2026 같은 제목 | 다른 작품 | I-4, V-2 |
| E-6 | 같은 종류, 한쪽 연도 모름 | 같은 작품(지금과 같음) | I-5, 기존 테스트 |
| E-7 | 같은 종류, 연도 다름 | 다른 작품(지금과 같음) | I-6, 기존 테스트 |
| E-8 | 제목이 다름 | 다른 작품 | I-7 |
| E-9 | jdrama ↔ movie, 원제만 같음 | 같은 작품 | I-8 |
| E-10 | 추천 후보끼리 movie·kdrama 중복 | 하나만 남음(먼저 순위인 쪽) | I-11 |
| E-11 | 운영 서버 미배포 | 앱이 숨김(D-5) | V-1, M-1 |

## 6. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다. 한 행 = `it` 하나.** I-5·I-6·I-7·V-2는 기존 동작을 지키는 **보존 테스트**다. I-5~I-7은 새 함수를 쓰므로 모듈 export 전에는 실패하고, V-2는 구현 전에도 통과하는 것이 정상이다. 그 외 행(I-1~I-4, I-8~I-11, V-1)은 구현 전에 실패해야 한다.

### `supabase/functions/_shared/recommendationEngine.test.ts` (추가)
헬퍼 `w(type, title, year, original = null)` → `{ content_type: type, title_primary: title, title_original: original, air_year: year }`.
| ID | 입력 | 기대 |
|----|------|------|
| I-1 | `isSameRecommendationWork(w("movie","개인적인 택시",2026), w("kdrama","개인적인 택시",2026))`, 인수 순서 바꿔서도 | 둘 다 `true` |
| I-2 | `(w("movie","개인적인 택시",2026), w("kdrama","개인적인 택시",2027))` / `(…2026, …2028)` | `true` / `false` |
| I-3 | `(w("movie","개인적인 택시",null), w("kdrama","개인적인 택시",2026))` | `false` |
| I-4 | `(w("anime","같은 제목",2026), w("movie","같은 제목",2026))` | `false` |
| I-5 (보존) | `(w("kdrama","무빙",2023), w("kdrama","무빙",null))` | `true` |
| I-6 (보존) | `(w("kdrama","무빙",2023), w("kdrama","무빙",2024))` | `false` |
| I-7 (보존) | `(w("movie","가",2026), w("kdrama","나",2026))` | `false` |
| I-8 | `(w("jdrama","다른 한국어 제목",2026,"同じ原題"), w("movie","또 다른 제목",2026,"同じ原題"))` | `true` |
| I-9 | `(w("other","Same Title",2025), w("movie","same-title",2025))` | `true`(정규화 후 같은 제목) |
| I-10 | `getRecommendationBatch([libraryItem({ source_api: "tmdb", source_id: "1744241", content_type: "movie", title_primary: "개인적인 택시", air_year: 2026 })], [candidate("333484", { content_type: "kdrama", title_primary: "개인적인 택시", air_year: 2026 }), candidate("new")], { limit: 12, now: NOW })` | 결과 `external_id`가 `["new"]` |
| I-11 | 라이브러리 없음, 후보 `[candidate("tv-1", { content_type: "kdrama", title_primary: "개인적인 택시", air_year: 2026 }), candidate("movie-1", { content_type: "movie", title_primary: "개인적인 택시", air_year: 2026 })]` | 둘 중 하나만 남는다(`batch.items.filter(i => i.title_primary === "개인적인 택시").length === 1`) |

### `src/utils/recommendationVisibility.test.ts` (추가, 기존 `candidate`·`libraryItem` 픽스처)
| ID | 입력 | 기대 |
|----|------|------|
| V-1 | `candidate({ external_source: "tmdb", external_id: "333484", content_type: "kdrama", title_primary: "개인적인 택시", air_year: 2026 })`, `[libraryItem({ source_api: "tmdb", source_id: "1744241", content_type: "movie", title_primary: "개인적인 택시", air_year: 2026 })]` | `isRegisteredRecommendation` `true`, `countVisibleRecommendationCandidates` `0` |
| V-2 (보존) | `candidate({ content_type: "movie", title_primary: "같은 제목", air_year: 2026 })`, `[libraryItem({ content_type: "anime", title_primary: "같은 제목", air_year: 2026 })]` | `false`, `1` |

### 수동 확인

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹(8081, 로그인) | 검색 탭 추천에서 "개인적인 택시"가 사라진다(재배포 전에도 앱 판정으로). "새 추천 12개"를 여러 번 눌러도 다시 안 나온다 |
| M-2 | 웹 | 제목 검색 "개인적인 택시"에서는 영화·TV 결과가 그대로 보인다(D-4) |
| M-3 | 앱(iOS) | M-1과 같다 |

## 7. 변경 파일

| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/recommendationEngine.ts` | `SameWorkInput`·`isSameRecommendationWork` export, `areSameWork` 본문 교체 |
| `supabase/functions/_shared/recommendationEngine.test.ts` | I-1~I-11 |
| `src/utils/recommendationVisibility.ts` | `isRegisteredRecommendation` 비교 블록 교체 |
| `src/utils/recommendationVisibility.test.ts` | V-1·V-2 |

## 8. 범위 밖

| 항목 | 이유 |
|------|------|
| 제목 검색 결과 중복 제거·카드 버튼 | D-4 |
| 라이브러리의 영화 항목을 드라마 항목으로 교체 | 사용자 데이터. 필요하면 사용자가 상세에서 삭제 후 TV판을 다시 추가 |
| TMDB 중복 데이터 자체 | 외부 데이터 |
| 기존 실패 테스트 1개 | 무관 |
