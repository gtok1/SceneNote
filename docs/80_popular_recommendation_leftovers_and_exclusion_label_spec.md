# 80. 인기 추천 클라이언트 잔여 코드 삭제 + 제외 해제 버튼 이름 명세

작성일: 2026-11-19
대상 브랜치 기준: main (519ddc7) + docs/74~79 미커밋 변경
선행 문서: [docs/78](78_web_alert_and_dead_code_cleanup_spec.md)(인기 추천 섹션·훅 삭제, D-7로 서비스 보존), [docs/79](79_recommendation_exclusion_clear_fix_spec.md)(제외 목록 정정·개선 후보 기록), [docs/00_ui_style_rules.md](00_ui_style_rules.md)

## 1. 문제 정의

| ID | 증상 |
|----|------|
| F-1 | docs/78에서 인기 추천 섹션과 훅을 지운 뒤, 그 아래 클라이언트 코드가 앱 어디에서도 쓰이지 않는다. `src/services/popularRecommendations.ts`(245줄), 서버 파일과 똑같은 복사본 `src/utils/popularRanking.ts`(206줄)와 그 테스트, 쿼리 키 `queryKeys.recommendations.popular`다. 읽는 사람이 "인기 추천이 앱에서 동작 중"이라고 오해하고, 고칠 때 서버 복사본과 따로 놀 위험이 있다 |
| F-2 | 추천 제외 목록(`/settings/excluded-recommendations`)의 개별 "해제" 버튼은 접근성 이름이 모두 "해제"다. 화면 낭독기로는 어느 작품의 버튼인지 구분할 수 없다(UI-4.4 "글자가 모호하면 `accessibilityLabel`") |

- F-1은 2026-11-19 grep으로 확인했다. 앱 코드(`app`, `src`)에서 이 서비스를 import하는 곳은 0곳이다. 바깥에서는 `scripts/smoke-edge-functions.ts:9`가 **타입** `PopularRecommendationsResponse`만 쓴다.
- F-2는 docs/79 웹 확인 중 기록했다. 화면이 확장 기능(`EXTENDED_FEATURES_ENABLED = false`) 뒤에 있어 지금 사용자에게는 보이지 않는다.

## 2. 근본 원인

### F-1

- docs/78 D-7은 smoke 스크립트가 타입을 쓰므로 서비스 파일을 **남기기로** 했다. 그러나 smoke에 필요한 것은 타입 3개뿐이다. 실행 코드(`getPopularRecommendations`, AsyncStorage 마지막 성공 캐시, 한국어 제목 대체 등)는 쓸 곳이 없다.
- `src/utils/popularRanking.ts`는 `supabase/functions/_shared/popularRanking.ts`와 내용이 같다(2026-11-19 `diff` 결과 0줄). 클라이언트에서는 이 서비스만 썼다. 서버 복사본은 `supabase/functions/_shared/popularRanking.test.ts`로 따로 테스트된다.
- `src/lib/query.ts:32`의 `recommendations.popular`는 지운 훅만 불렀다. 현재 `.popular(` 호출은 0곳이다.

### F-2

`app/settings/excluded-recommendations.tsx:66-73`:

```tsx
<Pressable
  accessibilityRole="button"
  onPress={() => removeExclusion(item.key)}
  style={styles.removeButton}
>
  <Ionicons color={colors.primary} name="refresh-outline" size={16} />
  <Text style={styles.removeButtonText}>해제</Text>
</Pressable>
```

`accessibilityLabel`이 없어 버튼 글자 "해제"가 그대로 이름이 된다.

## 3. 재현 시나리오

F-1:
1. `grep -rn "services/popularRecommendations\|utils/popularRanking" app src scripts`
2. 결과는 서비스 자신과 smoke 스크립트(타입), 78 가드 테스트뿐이다. 앱 화면에서 부르는 곳이 없다.

F-2:
1. 로컬에서만 `EXTENDED_FEATURES_ENABLED`를 `true`로 바꾸고 웹 8081을 재시작한다(확인 후 되돌린다).
2. 브라우저 콘솔에서 검증용 항목 2개를 넣고 새로고침한다(docs/79 3장 2번 방법).
3. `/settings/excluded-recommendations`에서 각 "해제" 버튼의 `aria-label`을 본다. 지금은 없고, 이름은 글자 "해제"뿐이다.

## 4. 설계 결정

### D-1. 클라이언트 쪽만 지운다. 서버 함수는 그대로 둔다 (최우선)

- 지우는 것: `src/services/popularRecommendations.ts`, `src/utils/popularRanking.ts`, `src/utils/popularRanking.test.ts`, `src/lib/query.ts`의 `popular:` 한 줄.
- **지우지 않는 것:** `supabase/functions/popular-recommendations/`, `supabase/functions/_shared/popularRanking.ts`와 그 테스트, `scripts/smoke-edge-functions.ts`의 `popular-recommendations` 점검.
- 이유: 서버 함수를 지우거나 바꾸면 배포가 따라온다. 배포는 사람이 정한다(12장).

### D-2. smoke에 필요한 타입 3개는 타입 전용 파일로 옮긴다

- 새 파일은 `src/types/popularRecommendations.ts`다.
- `RecommendationCategory`, `PopularRecommendation`, `PopularRecommendationsResponse`를 현재 서비스 12~31행에서 **글자 그대로** 옮긴다.
- import는 `import type { SearchResult } from "./content";` 하나뿐이다. 실행 코드·AsyncStorage·supabase를 import하지 않는다.
- `scripts/smoke-edge-functions.ts:9`는 `import type { PopularRecommendationsResponse } from "../src/types/popularRecommendations";`로 바꾼다. 그 밖의 smoke 코드는 바꾸지 않는다.

### D-3. docs/78 D-7을 이 명세가 대체한다

- docs/78 T-4(`scripts/alertUsageGuard.test.ts:61`)는 smoke가 `services/popularRecommendations`를 포함하는지 본다. 이 한 줄만 `types/popularRecommendations`로 바꾼다.
- 78 T-4의 테스트 이름, 다른 assertion, 78 T-1~T-3은 바꾸지 않는다.

### D-4. 해제 버튼 이름은 "<작품 제목> 제외 해제"

- `accessibilityLabel={`${item.title} 제외 해제`}`를 개별 해제 `Pressable`에 더한다.
- 보이는 글자 "해제"와 아이콘, 역할, `onPress`, 스타일은 그대로다.
- 이름에 "해제"가 들어 있어 음성 제어("해제 누르기")와도 어긋나지 않는다.
- "전체 해제" 버튼은 글자가 이미 구체적이라 바꾸지 않는다.

### D-5. 화면 판정은 소스 검사 테스트로 한다

- `.tsx`는 테스트에서 import할 수 없다(AGENTS.md). 그래서 docs/77처럼 `scripts/a11yAriaStateGuard.ts`의 `findJsxOpeningTags`로 여는 태그를 찾아 문자열을 확인한다.

> D-N은 Codex가 임의로 바꾸면 안 되는 항목이다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 서비스 파일을 그대로 두기(docs/78 D-7 유지) | 쓰지 않는 실행 코드 245줄과 서버 복사본 206줄이 남는다. 서버 쪽을 고칠 때 클라이언트 복사본은 갱신되지 않아 따로 놀게 된다 |
| smoke 스크립트에 응답 타입을 직접 적기 | 쓰는 필드가 `categories.drama/anime`, `failedSources`뿐이라 가능하지만, 응답 계약을 한 곳(`src/types`)에 두는 편이 다른 타입 파일들과 맞다 |
| `popular-recommendations` Edge Function까지 지우기 | 배포가 필요하고, smoke 점검도 함께 정리해야 한다. 사람이 정할 일이다(12장) |
| 해제 버튼 이름을 "<제목> 해제"로 | "해제"만으로는 무엇을 해제하는지 모호하다. 화면 제목("제외 목록")과 맞춰 "제외 해제" |
| `accessibilityHint` 추가 | 이름만으로 충분하다. 힌트는 낭독 시간을 늘린다 |

## 6. 계약

### 6.1 `src/types/popularRecommendations.ts`

```ts
import type { SearchResult } from "./content";

export type RecommendationCategory = "drama" | "anime";

export interface PopularRecommendation extends SearchResult {
  // 현재 src/services/popularRecommendations.ts 14~23행 그대로
}

export interface PopularRecommendationsResponse {
  // 현재 25~31행 그대로
}
```

- 필드를 더하거나 빼지 않는다.
- 이 파일에 함수·상수를 두지 않는다.

### 6.2 `src/lib/query.ts`

- `recommendations` 객체에서 `popular: (userId: string) => [...] as const,` 한 줄만 지운다.
- `personalized`와 다른 키는 그대로다.

### 6.3 해제 버튼

```tsx
<Pressable
  accessibilityLabel={`${item.title} 제외 해제`}
  accessibilityRole="button"
  onPress={() => removeExclusion(item.key)}
  style={styles.removeButton}
>
```

## 7. 데이터 모델 / SQL

해당 없음. DB 마이그레이션을 만들지 않는다.

## 8. 화면 명세

- 보이는 화면은 바뀌지 않는다.
- 웹에서는 개별 해제 버튼에 `aria-label="<제목> 제외 해제"`가 생긴다. 앱 VoiceOver는 "<제목> 제외 해제, 버튼"으로 읽는다.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 지운 3개 파일 | 존재하지 않는다 | T-1 |
| E-2 | `app`·`src`·`scripts`의 다른 파일 | 지운 서비스·복사본·캐시 키·실행 함수를 참조하지 않는다 | T-2 |
| E-3 | smoke 타입 | 새 타입 파일에서 가져오고, 타입 파일은 타입 import만 가진다 | T-3, T-4 |
| E-4 | 쿼리 키 | `recommendations.popular`가 없고 `personalized`는 남는다 | T-5 |
| E-5 | 서버 쪽 | Edge Function과 `_shared/popularRanking.ts`·테스트가 남는다 | T-6 |
| E-6 | 제목이 같은 작품 2개 | 이름이 같아도 된다. 제외 목록은 key로 구분되고, 제목 중복은 드물다. 추가 구분을 넣지 않는다 | — (범위 밖, 12장) |
| E-7 | 제목 없는 예전 항목 | 정규화에서 "제목 없는 작품"이 들어가므로 "제목 없는 작품 제외 해제"로 읽힌다 | T-7(라벨 형식) |
| E-8 | 해제 버튼 동작 | 역할·`onPress`가 그대로다 | T-8, M-2 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.**

- 새 파일 두 개를 만든다. 둘 다 `node:test`의 `it`, `node:assert/strict`, `node:fs`, `node:path`, `node:url`만 import한다(두 번째 파일은 `./a11yAriaStateGuard`도 import).
  - `scripts/popularRecommendationsCleanup.test.ts` (T-1~T-6)
  - `scripts/excludedRecommendationsA11y.test.ts` (T-7·T-8)
- T-2의 검사 대상은 `app`·`src`·`scripts`의 `.ts`·`.tsx` 전부다. 이 테스트 파일 자신만 뺀다.
- T-7·T-8의 대상 태그는 `findJsxOpeningTags(source)` 중 `ownText`가 `<Pressable`로 시작하고 `removeExclusion(item.key)`를 포함하는 것이다. 정확히 1개여야 한다.

| ID | 테스트 이름 | 기대 | STEP 1 직후 |
|----|------------|------|------------|
| T-1 | `80 T-1: unused client popular recommendation files are removed` | `src/services/popularRecommendations.ts`, `src/utils/popularRanking.ts`, `src/utils/popularRanking.test.ts`가 모두 없다 | **실패** |
| T-2 | `80 T-2: no source references the removed client popular code` | `services/popularRecommendations`, `utils/popularRanking`, `getPopularRecommendations`, `scenenote-popular-recommendations-last-good` 문자열을 포함한 파일 0개 | **실패** |
| T-3 | `80 T-3: popular recommendation types live in a type-only module` | `src/types/popularRecommendations.ts`가 있고, `export type RecommendationCategory`, `export interface PopularRecommendation `, `export interface PopularRecommendationsResponse`를 포함한다. `import` 줄은 모두 `import type`으로 시작하고, `function`·`const ` 선언이 없다 | **실패** |
| T-4 | `80 T-4: the smoke script imports the response type from the types module` | `scripts/smoke-edge-functions.ts`가 `import type { PopularRecommendationsResponse } from "../src/types/popularRecommendations";`를 포함하고 `popular-recommendations` 호출도 남아 있다 | **실패** |
| T-5 | `80 T-5: the unused popular query key is removed` | `src/lib/query.ts`에 `"popular"`가 없고 `personalized:`는 있다 | **실패** |
| T-6 | `80 T-6: server popular recommendation code is kept` | `supabase/functions/popular-recommendations/index.ts`, `supabase/functions/_shared/popularRanking.ts`, `supabase/functions/_shared/popularRanking.test.ts`가 모두 있다 | 통과(보호 테스트) |
| T-7 | `80 T-7: each exclusion remove button names the title` | 대상 태그 1개, `` accessibilityLabel={`${item.title} 제외 해제`} ``를 포함한다 | **실패** |
| T-8 | `80 T-8: exclusion remove button keeps role and handler` | 대상 태그 1개, `accessibilityRole="button"`과 `onPress={() => removeExclusion(item.key)}`를 포함한다 | 통과(보호 테스트) |

기존 테스트 변경:
- `scripts/alertUsageGuard.test.ts:61`의 문자열 `"services/popularRecommendations"`를 `"types/popularRecommendations"`로 바꾼다(D-3). 그 밖은 그대로다.

개수:
- 기준선은 1,845개 통과다.
- STEP 1 직후에는 1,853개 중 1,847개 통과·6개 실패(T-1~T-5, T-7)다.
- STEP 2 직후에는 `popularRanking.test.ts`의 4개가 빠져 1,849개 중 1,848개 통과·1개 실패(T-7)다.
- STEP 3 뒤 목표는 **1,849개 통과**다. 4개가 줄어드는 것은 지운 클라이언트 복사본 테스트이고, 같은 내용은 서버 복사본 테스트가 계속 검사한다.

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/types/popularRecommendations.ts` | 새 파일. 타입 3개(6.1) |
| `src/services/popularRecommendations.ts` | 삭제 |
| `src/utils/popularRanking.ts` | 삭제 |
| `src/utils/popularRanking.test.ts` | 삭제 |
| `src/lib/query.ts` | `recommendations.popular` 한 줄 삭제 |
| `scripts/smoke-edge-functions.ts` | 9행 타입 import 경로만 변경 |
| `scripts/alertUsageGuard.test.ts` | 61행 문자열만 변경 |
| `scripts/popularRecommendationsCleanup.test.ts` | 새 파일. T-1~T-6 |
| `scripts/excludedRecommendationsA11y.test.ts` | 새 파일. T-7·T-8 |
| `app/settings/excluded-recommendations.tsx` | 개별 해제 `Pressable`에 `accessibilityLabel` 한 줄 |
| `docs/development_next_steps.md` | 맨 위에 docs/80 절 추가 |
| `docs/README.md` | 80번 줄 상태 갱신 |

## 12. 범위 밖

- `supabase/functions/popular-recommendations/` 삭제·변경과 smoke의 `popular-recommendations` 점검 삭제. 앱은 이 함수를 더 이상 부르지 않지만, 지우려면 배포가 필요하다. **사람이 정할 일**로 남긴다.
- 기기에 남아 있을 수 있는 AsyncStorage 키 `scenenote-popular-recommendations-last-good:*`. 읽는 코드가 없어 동작에 영향이 없고, 지우는 코드를 따로 두지 않는다.
- `src/utils/excludedThemes.ts`. 개인화 추천 쪽이 계속 쓴다.
- 제외 목록 화면을 둘지 말지(docs/79 13장 제품 판단), `EXTENDED_FEATURES_ENABLED` 값.
- 같은 제목 항목의 이름 구분(E-6).
- 과거 명세(docs/78 등)의 본문. docs/78 D-7은 이 명세가 대체한다는 사실만 `development_next_steps.md`에 적는다.

## 13. 확실하지 않음 — 별도 검증 필요

- react-native-web 0.21이 `accessibilityLabel`을 `aria-label`로 내보내는 것은 앱 전체에서 이미 쓰는 방식이다(`accessibilityLabel` 194곳). 그래도 이 버튼에서 웹 M-1로 실제 속성을 확인한다.
- iOS VoiceOver 낭독은 M-3으로 본다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 이번 작업은 **정리·정정 작업**이다. docs/78 뒤에 남은, 앱에서 쓰지 않는 인기 추천 클라이언트 코드를 지우고 smoke 스크립트용 타입만 타입 파일로 옮긴다. 추천 제외 목록의 개별 해제 버튼에 작품 제목이 든 접근성 이름을 준다.

| ID | 결함 |
|----|------|
| F-1 | 쓰지 않는 `src/services/popularRecommendations.ts`, 서버 복사본 `src/utils/popularRanking.ts`(+테스트), 쿼리 키 `recommendations.popular`가 남아 있다 |
| F-2 | 제외 목록 개별 "해제" 버튼 이름이 모두 "해제"라 구분되지 않는다 |

# READ FIRST
1. `docs/80_popular_recommendation_leftovers_and_exclusion_label_spec.md` — 이 명세. D-1~D-5, 계약 6장, E-1~E-8, T-1~T-8.
2. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙(UI-4.4 접근성 이름).
3. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
4. `docs/78_web_alert_and_dead_code_cleanup_spec.md` — D-7(이번에 대체), T-4.
5. `src/services/popularRecommendations.ts` 12~31행, `scripts/smoke-edge-functions.ts`, `scripts/alertUsageGuard.test.ts`, `scripts/castSectionA11y.test.ts`(소스 검사 테스트 예), `app/settings/excluded-recommendations.tsx`.

# 시작 상태 (반드시 유지)
- `npm test` 1,845개 통과, `typecheck`·`lint` 통과.
- 작업 트리에는 docs/74~79의 미커밋 변경이 있다. 되돌리거나 정리하지 않는다.
- `EXTENDED_FEATURES_ENABLED = false`는 그대로 둔다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** `supabase/functions/` 아래는 **아무것도 바꾸거나 지우지 않는다.** smoke의 `popular-recommendations` 호출도 남긴다. 지우면 배포가 필요해진다.
- **D-2.** 타입 3개는 글자 그대로 옮기고, 새 타입 파일에는 `import type`만 둔다.
- **D-3.** `scripts/alertUsageGuard.test.ts`는 61행 문자열 한 곳만 바꾼다.
- **D-4.** 라벨은 정확히 `` `${item.title} 제외 해제` ``다. "전체 해제" 버튼과 보이는 글자·스타일은 바꾸지 않는다.
- **D-5.** 화면 판정은 `findJsxOpeningTags` 소스 검사로 한다. 테스트에서 `.tsx`를 import하지 않는다.
- DB 마이그레이션을 만들지 않는다.

# STEP 1 — 실패하는 테스트부터
1. `scripts/popularRecommendationsCleanup.test.ts`에 10장 T-1~T-6을, `scripts/excludedRecommendationsA11y.test.ts`에 T-7·T-8을 그대로 옮긴다.
2. `npm test`를 돌려 **T-1~T-5와 T-7만 실패**하는지(1,853개 중 1,847개 통과·6개 실패) 눈으로 확인한다. 다르면 멈추고 보고한다.

# STEP 2 — 인기 추천 클라이언트 잔여 코드 정리 (F-1)
1. `src/types/popularRecommendations.ts`를 6.1대로 만든다(현재 서비스 12~31행 그대로, `SearchResult`는 `import type`).
2. `scripts/smoke-edge-functions.ts` 9행을 다음으로 바꾼다.
   ```ts
   import type { PopularRecommendationsResponse } from "../src/types/popularRecommendations";
   ```
3. `scripts/alertUsageGuard.test.ts` 61행의 `"services/popularRecommendations"`를 `"types/popularRecommendations"`로 바꾼다.
4. `src/services/popularRecommendations.ts`, `src/utils/popularRanking.ts`, `src/utils/popularRanking.test.ts`를 지운다.
5. `src/lib/query.ts`에서 `popular: (userId: string) => ["recommendations", userId, "popular", "ko-title-v2"] as const,` 한 줄을 지운다.
6. `npm test` 결과가 1,849개 중 1,848개 통과·1개 실패(T-7)인지 확인한다. `npm run typecheck`도 통과해야 한다.

# STEP 3 — 해제 버튼 이름 (F-2)
`app/settings/excluded-recommendations.tsx`의 개별 해제 `Pressable`(현재 66~70행)에 한 줄을 더한다.

```diff
               <Pressable
+                accessibilityLabel={`${item.title} 제외 해제`}
                 accessibilityRole="button"
                 onPress={() => removeExclusion(item.key)}
                 style={styles.removeButton}
               >
```

`npm test` 1,849개가 모두 통과하는지 확인한다.

# STEP 4 — 기록
- `docs/development_next_steps.md` 맨 위에 `## 인기 추천 잔여 코드 삭제·제외 해제 버튼 이름 (docs/80, <날짜>)` 절을 추가한다.
  - 상태, 테스트 before/STEP 1/after, 수동 확인 결과 또는 미실행 사유를 적는다.
  - "docs/78 D-7(서비스 보존)은 docs/80이 대체" 한 줄을 적는다.
  - 사람이 정할 일로 `popular-recommendations` Edge Function과 smoke 점검의 존폐를 적는다.
- `docs/README.md`의 80번 줄 상태를 "구현, 화면 미확인"으로 바꾼다. 화면을 실제로 봤다면 그 결과대로 적는다.

# 엣지 케이스 (전부 처리, 명세서 9장)
E-1~E-8 전부. E-6은 처리하지 않는 것이 기대 동작이다.

# 수동 확인
- 제외 목록 화면은 로컬에서 `EXTENDED_FEATURES_ENABLED`를 잠시 `true`로 바꾸고 8081 서버를 **재시작**해야 볼 수 있다. 재시작하지 않으면 예전 번들이 나올 수 있다.
- 확인한 뒤 반드시 `false`로 되돌리고, 되돌렸다고 보고한다.
- 검증용 항목은 docs/79 3장 2번 방법으로 넣고, 확인 뒤 지운다. 사용자의 실제 항목이 있으면 건드리지 말고 미실행으로 보고한다.

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 | 검증용 항목 2개에서 각 해제 버튼의 `aria-label`이 "<제목> 제외 해제"이고 서로 다르다. "전체 해제" 버튼은 이름이 그대로다 |
| M-2 | 웹 8081 | 해제 버튼을 누르면 그 항목만 지워진다(동작 변화 없음). 홈·검색·프로필 화면이 콘솔 오류 없이 열린다(F-1 삭제 영향 없음) |
| M-3 | 앱(iOS 세로) | VoiceOver가 해제 버튼을 "<제목> 제외 해제, 버튼"으로 읽는다 |

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
기준선은 1,845개 통과이고, 목표는 1,849개 통과다(새 테스트 8개 추가, 지운 클라이언트 복사본 테스트 4개 제외). 그 밖의 기존 테스트는 하나도 깨지지 않아야 한다.

# DEFINITION OF DONE
- [ ] STEP 1에서 T-1~T-5, T-7이 실패하고 T-6, T-8이 통과하는 것을 확인했고, STEP 3 뒤 T-1~T-8이 모두 통과한다
- [ ] `npm test` 1,849개 통과. 줄어든 4개는 `src/utils/popularRanking.test.ts`의 테스트뿐이다
- [ ] `typecheck`·`lint` 통과
- [ ] `supabase/functions/` 아래 diff가 0줄이다
- [ ] `src/types/popularRecommendations.ts`에 `import type` 외 import, 함수, 상수가 없다
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(이번에 바꾼 줄 기준)
- [ ] `EXTENDED_FEATURES_ENABLED`가 `false`다
- [ ] 웹·앱 수동 확인 표(M-1~M-3) 결과 또는 미실행 사유를 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/types/popularRecommendations.ts            (새 파일)
src/services/popularRecommendations.ts         (삭제)
src/utils/popularRanking.ts                    (삭제)
src/utils/popularRanking.test.ts               (삭제)
src/lib/query.ts
scripts/smoke-edge-functions.ts
scripts/alertUsageGuard.test.ts
scripts/popularRecommendationsCleanup.test.ts  (새 파일)
scripts/excludedRecommendationsA11y.test.ts    (새 파일)
app/settings/excluded-recommendations.tsx
docs/development_next_steps.md
docs/README.md
```

# 보고 항목
1. STEP 1에서 실패한 T-1~T-5, T-7의 실제 출력(요약 가능)
2. `npm test` 결과 (before / STEP 1 / STEP 2 / after 통과·실패 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. `src/lib/query.ts`, `scripts/smoke-edge-functions.ts`, `scripts/alertUsageGuard.test.ts`, `app/settings/excluded-recommendations.tsx`의 diff
6. 수동 확인 M-1~M-3 결과 또는 미실행 사유, `EXTENDED_FEATURES_ENABLED`를 되돌렸는지
7. D-1~D-5 중 문제가 있다고 판단한 항목 (바꾸지는 말고 보고만)
8. 사람이 해야 할 후속 작업 (Edge Function 존폐 판단, iOS 확인)

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
