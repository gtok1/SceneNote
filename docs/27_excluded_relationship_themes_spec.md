# 27. 추천 피드에서 BL·GL·퀴어 테마 작품 제외 명세

작성일: 2026-09-24
대상 브랜치 기준: main (ca4e285)
선행 문서: [22_search_recommendations_restore_spec.md](./22_search_recommendations_restore_spec.md), [26_recommendation_and_season_lookup_fixes_spec.md](./26_recommendation_and_season_lookup_fixes_spec.md)

## 1. 문제 정의

사용자가 검색 화면의 **"내 취향 최신 추천"** 피드와 인기 추천에서 다음 부류의 작품을 전혀 보고 싶지 않다고 요청했다.

| 부류 | 정의 |
|------|------|
| BL (Boys' Love) | 남성 × 남성의 연애·로맨스를 다루는 드라마·애니·만화 |
| GL (Girls' Love) | 여성 × 여성의 연애·로맨스를 다루는 작품 |
| 백합 (百合, Yuri) | 여성 간의 감정·연애 장르. 일본 애니·만화에서 GL과 유사하게 사용 |
| 퀴어 / LGBTQ+ | 게이·레즈비언을 포함해 다양한 성소수자 정체성·관계를 폭넓게 다루는 작품 |

**현재 증상:** 이 부류를 걸러낼 수단이 없다. 개별 카드마다 "취향 탐색 → 이 테마 줄이기"로 감점할 수는 있지만, (a) 이미 노출된 뒤에만 가능하고 (b) 감점일 뿐 제외가 아니라 후보가 부족하면 다시 올라온다.

## 2. 근본 원인

테마 분류 자체는 **이미 존재한다.** [`recommendationThemes.ts`](../supabase/functions/_shared/recommendationThemes.ts) 42~44행:

```ts
{ family: "relationship", key: "boys-love",     label: "BL",        aliases: [...] },
{ family: "relationship", key: "girls-love",    label: "GL",        aliases: [...] },
{ family: "relationship", key: "queer-romance", label: "퀴어 로맨스", aliases: [...] },
```

없는 것은 **이 테마를 후보 단계에서 제거하는 경로**다. 현재 테마는 두 곳에서만 쓰인다.

1. 다양성 게이팅 — [`applyBatchDiversityConstraints`](../supabase/functions/_shared/recommendationEngine.ts) 1001행. `NICHE_THEME_CENTRALITY_THRESHOLD`(0.4) 이상인 테마의 **개수를 제한**할 뿐 제거하지 않는다.
2. 명시적 피드백 감점 — 같은 파일 424행. `exclude` 액션도 점수를 `-1` 할 뿐이다.

또한 별칭 목록이 좁다. 현재 `queer-romance`는 `"lgbtq romance"`, `"queer romance"`, `"same sex romance"` 3종뿐이라 TMDB가 실제로 붙이는 `lgbt`, `gay`, `lesbian` 같은 단독 키워드를 잡지 못한다.

## 3. 재현 시나리오

1. 검색 탭을 연다 (`app/(tabs)/search.tsx` → `app/search.tsx`).
2. 검색어 없이 **"내 취향 최신 추천"** 섹션을 본다.
3. **"새 추천 12개"** 버튼을 여러 번 눌러 배치를 갱신한다.
4. BL·GL·퀴어 태그가 붙은 작품이 섞여 나온다. 제외할 방법이 없다.

## 4. 설계 결정

### D-1. 제외 판정을 `recommendationThemes.ts`에 둔다

이 파일은 **import가 하나도 없는 순수 모듈**이고, 이미 클라이언트가 참조하고 있다 — [`personalizedRecommendations.ts:24`](../src/services/personalizedRecommendations.ts):

```ts
themes?: import("../../supabase/functions/_shared/recommendationThemes").ContentTheme[];
```

따라서 서버(Deno)와 클라이언트(Metro) 양쪽에서 같은 판정을 쓸 수 있고, 별칭 목록을 두 벌 유지할 필요가 없다.

### D-2. 하드 제외한다. 점수 감점이 아니다

후보 배열에서 **제거**한다. 감점 방식은 후보가 부족할 때 결국 노출된다. 사용자 요구는 "전혀 보고 싶지 않다"이므로 노출 확률을 낮추는 것으로는 충족되지 않는다.

### D-3. centrality 임계값을 적용하지 않는다

기존 `NICHE_THEME_CENTRALITY_THRESHOLD`(0.4)는 **다양성 게이팅용**이다. 제외 판정에 이 값을 쓰면 안 된다. [`centralityFromTag`](../supabase/functions/_shared/recommendationThemes.ts)가 장르 유래 태그에 `0.3`을 주기 때문에, 임계값을 걸면 **AniList 장르 `Boys' Love`로 분류된 작품이 그대로 통과한다.** 흔적만 있어도 제외한다.

### D-4. 별칭을 확장한다

현재 별칭은 "romance"가 붙은 복합어에 치우쳐 있다. 제공자가 실제로 쓰는 단독 태그를 추가한다.

| 제공자 | 실제 태그 예 | 현재 잡히나 |
|--------|-------------|------------|
| TMDB keyword | `lgbt`, `gay`, `lesbian`, `homosexuality` | ✗ |
| AniList genre | `Boys' Love`, `Girls' Love` | ✓ (`boys love`, `girls love`) |
| AniList tag | `Yuri`, `Yaoi`, `Shounen Ai`, `Shoujo Ai` | 일부 (`yuri`, `yaoi`만) |
| 한국어 | `동성애`, `퀴어`, `백합`, `비엘` | ✗ |

### D-5. 추천 피드에만 적용한다. 명시적 검색 결과는 필터하지 않는다

사용자가 제목을 직접 입력해 검색하면 그 작품을 찾을 수 있어야 한다. 검색은 "발견"이 아니라 "지목"이다. 라이브러리에 이미 등록된 작품도 필터하지 않는다 — 사용자가 직접 넣은 것이다.

### D-6. 서버와 클라이언트 양쪽에 적용한다

- **서버**: 후보 낭비를 줄인다. 제외된 작품이 12칸을 차지하지 않는다.
- **클라이언트**: Edge Function **재배포 전에도 즉시 동작한다.** 배포는 사람이 하므로(금지사항), 클라이언트 필터가 없으면 이 작업은 배포 전까지 아무 효과가 없다.

### D-7. 사용자별 제외 설정으로 저장한다 (2026-09-24 사용자 요청으로 변경)

이 앱은 여러 사용자가 로그인할 수 있다. BL·GL·퀴어 테마를 모든 사용자에게 강제로 제외하면 다른 사용자의 취향까지 제한한다. 기존 RLS 적용 `user_content_feedback`의 `theme`/`genre` + `exclude` 행을 사용해 계정별로 저장하고, 새 계정의 기본값은 빈 목록으로 둔다. 검색 화면의 추천 제외 설정에서 관계 테마와 장르를 각각 선택한다. 서버와 클라이언트 모두 현재 계정의 설정을 읽은 뒤 추천에만 적용한다. 이번 요청자의 계정에는 BL·GL·퀴어 3개를 선택해 저장한다.

TMDB 추천 후보에는 관계 테마 정보가 빠질 수 있으므로 선택된 관계 테마가 있을 때만 서버에서 TMDB 키워드를 제한적으로 보강한다. 키워드가 없거나 조회에 실패한 TMDB 후보는 판정 불가로 추천에서 제외한다. 후보가 줄 수 있음을 UI에 알린다. 다른 계정의 필터가 공유 추천 캐시에 섞이지 않아야 한다.

> D-7은 이후 사용자가 명시적으로 바꾼 항목이다. D-1 ~ D-6의 나머지 결정은 유지한다.

## 5. 기각한 대안

| 대안 | 기각 사유 |
|------|----------|
| 작품별 `exclude` 행을 대량 삽입 | 새로 나오는 작품을 못 막는다. 현재 구현은 작품별 행이 아니라 계정별 테마·장르 행을 사용한다 |
| `RECOMMENDATION_DIVERSITY_CONFIG.excludedThemeCap`을 0으로 | 이미 0이다(228행). 그런데도 노출되는 이유가 D-3의 centrality 임계값이므로 해결되지 않는다 |
| 클라이언트에서만 필터 | 서버가 12칸을 제외 대상으로 채우면 화면이 빈다. 서버 필터가 있어야 12칸이 실제로 채워진다 |
| 서버에서만 필터 | Edge Function 재배포 전까지 효과 없음 (D-6) |
| 별칭 대신 LLM 분류 | 비용·지연·비결정성. 태그 매칭으로 충분하다 |
| 제목·줄거리 텍스트 매칭 | 오탐이 크다. "게이"가 들어간 무관한 제목을 막는다 |

## 6. 계약 (타입 · 판정 순서)

`supabase/functions/_shared/recommendationThemes.ts`에 추가한다.

```ts
export const EXCLUDED_THEME_KEYS = ["boys-love", "girls-love", "queer-romance"] as const;
export type ExcludedThemeKey = (typeof EXCLUDED_THEME_KEYS)[number];

export interface ExcludedThemeInput {
  external_source?: string | null;
  genres?: readonly string[] | null;
  keywords?: readonly string[] | null;
  source_tags?: readonly SourceContentTag[] | null;
  themes?: readonly { family?: string | null; key?: string | null }[] | null;
}

export function hasExcludedTheme(
  input: ExcludedThemeInput,
  excludedKeys: readonly string[]    // 현재 계정의 설정. 기본 전역 제외 없음
): boolean;
```

**판정 순서 (반드시 이 순서):**

1. `excludedKeys`를 `Set`으로 만든다. 비어 있으면 즉시 `false`.
2. `input.themes` 중 `family === "relationship"` 이고 `key`가 Set에 있으면 → `true`.
3. `normalizeContentThemes({ external_source, genres, keywords, source_tags })` 결과 중 `key`가 Set에 있으면 → `true`.
4. 그 외 → `false`.

**centrality를 비교하지 않는다** (D-3). 어떤 임계값도 적용하지 않는다.

## 7. 별칭 확장 (THEME_DEFINITIONS 수정)

기존 3개 항목의 `aliases`에 아래를 **추가**한다. 기존 별칭은 지우지 않는다.

| key | 추가 별칭 |
|-----|----------|
| `boys-love` | `shounen ai`, `shonen ai`, `danmei`, `m/m romance`, `야오이`, `비엘`, `보이즈 러브` |
| `girls-love` | `shoujo ai`, `shojo ai`, `백합`, `걸스 러브`, `f/f romance`, `lesbian romance` |
| `queer-romance` | `lgbt`, `lgbtq`, `lgbtqia`, `lgbtq+`, `queer`, `gay`, `gay theme`, `gay interest`, `gay romance`, `lesbian`, `homosexuality`, `homosexual`, `bisexual`, `transgender`, `동성애`, `퀴어`, `성소수자` |

`normalizeThemeText`가 별칭도 정규화하므로 `lgbtq+` → `lgbtq`, `m/m romance` → `m m romance`로 접힌다. **별칭은 완전 일치로만 매칭된다** (`THEME_BY_ALIAS`는 `Map`이다). 부분 문자열 매칭이 아니므로 `gaya`, `transformation` 같은 무관한 태그는 걸리지 않는다.

**부수 영향:** 별칭이 늘면 이 3개 테마로 분류되는 작품이 늘어난다. 그 작품은 추천에서 제외되므로 [`ThemeReductionSheet`](../src/components/content/ThemeReductionSheet.tsx)의 테마 목록에도 나타나지 않는다. 라이브러리·검색·핀에는 영향이 없다.

## 8. 적용 지점

| # | 계층 | 파일 | 지점 |
|---|------|------|------|
| A-1 | 서버 · 개인화 추천 | [`personalized-recommendations/index.ts`](../supabase/functions/personalized-recommendations/index.ts) 181행 | `candidateFilter: hasKoreanDisplayTitle` → 제외 판정을 합성 |
| A-2 | 서버 · 인기 추천 | [`popular-recommendations/index.ts`](../supabase/functions/popular-recommendations/index.ts) 712~725행 | `rankRecommendations`의 `.filter` 체인에 한 단계 추가 |
| A-3 | 클라이언트 · 개인화 추천 | [`app/search.tsx`](../app/search.tsx) 190~199행 | `activeRecommendations` useMemo 필터에 조건 추가 |
| A-4 | 클라이언트 · 인기 추천 | [`PopularRecommendationSection`](../src/components/content/PopularRecommendationSection.tsx) | 렌더 목록에서 제외 |

A-1은 기존 훅을 그대로 쓴다. [`recommendationCatalog.ts:229`](../supabase/functions/_shared/recommendationCatalog.ts)가 이미 `options.candidateFilter?.(candidate) ?? true`로 후보를 거르고 있으므로 **새 확장 지점을 만들 필요가 없다.**

클라이언트 판정은 `src/utils/excludedThemes.ts`(신규)에 얇게 감싼다. `app/`과 `.tsx`는 테스트 글롭에 잡히지 않으므로 순수 함수로 분리해야 검증할 수 있다.

```ts
// src/utils/excludedThemes.ts
import { hasExcludedTheme } from "../../supabase/functions/_shared/recommendationThemes";

export function isExcludedRecommendation(item: {
  genres?: readonly string[] | null;
  keywords?: readonly string[] | null;
  themes?: readonly { family?: string | null; key?: string | null }[] | null;
  external_source?: string | null;
}, exclusions: { excludedThemeKeys: readonly string[]; excludedGenres: readonly string[] }): boolean;

export function filterExcludedRecommendations<T extends Parameters<typeof isExcludedRecommendation>[0]>(
  items: readonly T[],
  exclusions: { excludedThemeKeys: readonly string[]; excludedGenres: readonly string[] }
): T[];
```

## 9. 엣지 케이스

| # | 상황 | 기대 동작 |
|---|------|----------|
| E-1 | `themes`에 `{family:"relationship", key:"boys-love"}` | 제외 |
| E-2 | AniList 장르 `Boys' Love` (centrality 0.3) | 제외 — 임계값 미적용 (D-3) |
| E-3 | TMDB 키워드 `lgbt` 단독 | 제외 |
| E-4 | AniList 태그 `Yuri` | 제외 |
| E-5 | 한국어 키워드 `동성애` | 제외 |
| E-6 | 키워드 `gaya`, `transformation` | **제외 안 함** — 완전 일치만 |
| E-7 | 키워드 `bromance` | **제외 안 함** — BL이 아니다 |
| E-8 | `themes`·`genres`·`keywords` 전부 없음 | 일반 판정 함수는 제외 안 함. 단, 관계 테마 제외가 켜진 계정의 TMDB 추천 후보는 판정 불가로 숨김 |
| E-9 | `themes`에 `workplace-romance` | 제외 안 함 — 다른 relationship 테마 |
| E-10 | `themes`에 `{family:"narrative", key:"boys-love"}` (잘못된 family) | 제외 안 함 — family까지 일치해야 함 |
| E-11 | 제목을 직접 입력한 검색 결과 | 필터 안 함 (D-5) |
| E-12 | 이미 라이브러리에 등록된 작품 | 라이브러리 화면에서 필터 안 함 (D-5) |
| E-13 | 서버가 필터해 후보가 12개 미만 | 기존 `refill` 경로가 다음 배치를 가져온다. 새 로직 없음 |
| E-14 | `excludedKeys`에 빈 배열을 넘김 | 즉시 `false` — 아무것도 제외하지 않음 |

## 10. 테스트 표

`supabase/functions/_shared/recommendationThemes.test.ts`(신규)와 `src/utils/excludedThemes.test.ts`(신규)에 작성한다. **모든 행을 테스트로 옮긴다. 줄이지 않는다.**

변경된 D-7에 따라 T-1~T-17은 `excludedKeys: ["boys-love", "girls-love", "queer-romance"]`를 명시해서 실행한다. 계정 설정이 빈 배열이면 테마 제외를 적용하지 않는다. 계정 분리, 장르 완전 일치, TMDB 메타데이터 부족 시 숨김도 별도 회귀 테스트로 확인한다.

| ID | 입력 | 기대 | 연결 |
|----|------|------|------|
| T-1 | `{themes:[{family:"relationship",key:"boys-love"}]}` | `true` | E-1 |
| T-2 | `{genres:["Boys' Love"]}` | `true` | E-2 |
| T-3 | `{genres:["Girls' Love"]}` | `true` | E-2 |
| T-4 | `{keywords:["lgbt"]}` | `true` | E-3 |
| T-5 | `{keywords:["gay"]}` | `true` | E-3 |
| T-6 | `{keywords:["lesbian"]}` | `true` | E-3 |
| T-7 | `{source_tags:[{name:"Yuri",source:"anilist",rank:80}]}` | `true` | E-4 |
| T-8 | `{source_tags:[{name:"Shounen Ai",source:"anilist",rank:12}]}` | `true` | E-4 |
| T-9 | `{keywords:["동성애"]}` | `true` | E-5 |
| T-10 | `{keywords:["퀴어"]}` | `true` | E-5 |
| T-11 | `{keywords:["gaya"]}` | `false` | E-6 |
| T-12 | `{keywords:["transformation"]}` | `false` | E-6 |
| T-13 | `{keywords:["bromance"]}` | `false` | E-7 |
| T-14 | `{}` | `false` | E-8 |
| T-15 | `{genres:["Romance","Drama"]}` | `false` | E-8 |
| T-16 | `{themes:[{family:"relationship",key:"workplace-romance"}]}` | `false` | E-9 |
| T-17 | `{themes:[{family:"narrative",key:"boys-love"}]}` | `false` | E-10 |
| T-18 | `{keywords:["lgbt"]}`, `excludedKeys: []` | `false` | E-14 |
| T-19 | `{keywords:["lgbt"]}`, `excludedKeys: ["girls-love"]` | `false` | D-7 |
| T-20 | `filterExcludedRecommendations([정상, BL, 정상])` | 길이 2, 순서 유지 | A-3 |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/recommendationThemes.ts` | 별칭 확장 + `EXCLUDED_THEME_KEYS` · `hasExcludedTheme` 추가 |
| `supabase/functions/_shared/recommendationThemes.test.ts` | 신규 — T-1~T-19 |
| `supabase/functions/personalized-recommendations/index.ts` | 181행 `candidateFilter` 합성 |
| `supabase/functions/popular-recommendations/index.ts` | `rankRecommendations` 필터 체인에 한 단계 추가 |
| `src/utils/excludedThemes.ts` | 신규 — 클라이언트 래퍼 |
| `src/utils/excludedThemes.test.ts` | 신규 — T-20 및 래퍼 검증 |
| `app/search.tsx` | `activeRecommendations` 필터에 조건 추가 |
| `src/components/content/PopularRecommendationSection.tsx` | 렌더 목록 필터 |

## 12. 범위 밖

- **명시적 제목 검색 결과** — D-5. `searchResultActions.ts`, `SearchResultItem.tsx`를 건드리지 않는다.
- **라이브러리 화면** — 사용자가 직접 등록한 작품이다.
- **유사 작품 추천(`similar-content`)** — 사용자가 특정 작품을 지목해 "비슷한 것"을 요청한 결과다. 지목한 작품이 해당 테마면 결과도 그럴 수밖에 없다. 이번 범위에서 제외하되 필요하면 후속 작업으로 둔다.
- **사용자 전체에 적용되는 고정 필터** — 변경된 D-7에 따라 사용하지 않는다.
- **DB 마이그레이션** — 테이블 변경이 필요 없다. `content_themes`는 이미 존재한다.
- **`recommendationEngine.ts`의 점수·다양성 로직** — 하드 제외가 후보 단계에서 끝나므로 손댈 필요가 없다.

## 13. 확실하지 않음 — 별도 검증 필요

1. **Metro 번들러가 `src/utils/` → `supabase/functions/_shared/`의 값(value) import를 해석하는가.**
   타입 전용 import는 [`personalizedRecommendations.ts:24`](../src/services/personalizedRecommendations.ts)에 선례가 있으나 런타임 import는 처음이다. `recommendationThemes.ts`는 import가 0개인 순수 TS라 이론적으로 문제가 없고, `tsx --test`가 통과하면 Node 해석은 증명된다. **Metro 해석은 앱을 실제로 띄워 확인해야 한다.** 실패하면 별칭 목록을 `src/utils/excludedThemes.ts`로 복제하고 두 파일이 어긋나지 않도록 주석으로 상호 참조를 남긴다.
2. **TMDB·AniList가 실제로 붙이는 태그 표기.** D-4 표는 문서와 관측에 근거하지만 전수 확인은 아니다. 누락된 표기가 발견되면 별칭만 추가하면 된다.
3. **인기 추천 응답에 `keywords`·`themes`가 실려 오는가.** `PopularRecommendation`은 `SearchResult`를 확장하므로 `genres`는 확실하지만 나머지는 확인이 필요하다. 없으면 클라이언트 A-4는 `genres`만으로 판정하고 서버 A-2가 주된 방어선이 된다.
