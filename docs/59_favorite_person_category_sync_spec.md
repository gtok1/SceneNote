# 59. 좋아하는 인물 배우·성우 서버 판정 동기화

작성일: 2026-10-13
대상 브랜치 기준: `main` (`bfcc3fd`) + 미커밋 작업(`docs/57`·`58` 구현). 이 시점 `npm test`는 1163개 중 1162개 통과다. 실패 1개("uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함이다. `get-person-detail` v11(2026-10-13 20:15, docs/58 판정 포함)이 운영 중이다.
선행 문서: `docs/58_person_category_classification_fixes_spec.md`(판정 규칙 `classifyTmdbPersonCategory`), `docs/38_japanese_person_korean_name_spec.md`(목록 열 때 서버에 물어 채우는 `useFavoriteKoreanNameBackfill` 패턴)

> **근거.** v11 배포 뒤에도 인물 탭에서 堺雅人·阿部寛이 "성우"로 표시된다(사용자 캡처).
> 사용자 요청: "DB에서 고치면 무슨 의미가 있어 API에서 제대로 데이터를 못불러오는게 문제인거 같은데 근본적인 문제를 해결해"

---

## 1. 문제 정의
| ID | 증상 |
|----|------|
| S-1 | 서버 판정 규칙을 고쳐 배포해도 인물 탭 목록의 배우·성우가 바뀌지 않는다 |

## 2. 근본 원인
**목록은 서버 판정을 부르지 않고, 등록할 때 저장한 값을 그대로 보여 준다.**

| 경로 | 카테고리 출처 |
|------|--------------|
| 인물 탭 목록(`useFavoritePeople` → `getFavoritePeople`, `src/services/people.ts`) | `favorite_people.category` 저장값. 서버 판정 호출 없음 |
| 인물 상세(`usePersonDetail` → `get-person-detail`) | 서버 판정. 다르면 저장값을 고친다(docs/58 D-4) |
| 등록 직후(docs/58 D-5) | 그 인물의 상세를 한 번 불러 판정 |

- 저장값은 등록 당시 규칙으로 정해졌다. 이후 규칙이 바뀌어도 그 사람의 상세를 직접 열기 전까지 그대로다.
- docs/58은 이를 D-7("상세를 열면 고쳐진다")로 남겨 두었다. 사용자는 목록만 보므로 고쳐지지 않는다.

2026-10-13 실측(읽기 전용):
- DB의 `favorite_people`에서 tmdb 76933(堺雅人)·66155(阿部寛)·1576235(吉岡里帆)는 `voice_actor`다. `updated_at`은 7월·9월 값이며 배포 뒤 바뀌지 않았다.
- 같은 세 사람을 배포된 규칙(`classifyTmdbPersonCategory`)과 같은 TMDB 요청으로 판정하면 모두 `actor`다.
- 전체 TMDB 좋아하는 인물 14명 중 저장값과 판정이 다른 것은 이 3명뿐이다.

## 3. 재현 시나리오
1. 웹 8081에 로그인한 뒤 인물 탭을 연다.
2. 堺雅人 상세를 열지 않은 상태에서 배지가 "성우"다. 새로고침해도 같다.

## 4. 설계 결정

### D-1 (최우선). 목록은 서버 판정에 맞춘다
- 인물 탭을 열면 TMDB 출처 좋아하는 인물 전부의 카테고리를 서버에 일괄로 묻는다.
- 저장값과 다르면 DB를 고치고 목록을 다시 읽는다.
- 앞으로 판정 규칙이 바뀌어 다시 배포해도, 사용자가 상세를 열 필요 없이 목록이 따라간다.

### D-2. 새 Edge Function `classify-people`
- 요청: `{ people: [{ external_id: string }] }`, 1~20명, TMDB 전용.
- 응답: `{ results: [{ external_id, category: "actor" | "voice_actor" | null }] }`. 요청 순서와 같다.
- 사람마다 TMDB `/person/{id}?append_to_response=combined_credits`를 조회한다. 동시 4건이다.
- 판정은 `classifyTmdbPersonCategoryOrNull`(6.1)이 한다.
- 판정할 출연작이 없거나 조회에 실패하면 그 사람은 `null`이다. 한 사람 실패가 묶음 전체를 실패시키지 않는다.
- 인증(`requireUser`)·CORS·오류 형식은 `resolve-person-names`와 같다.
- 출연작 목록·이름은 돌려주지 않는다. 판정만 돌려줘 응답을 가볍게 한다.

### D-3. 판정 불가를 구분한다
- `classifyTmdbPersonCategoryOrNull(cast)`를 추가한다. 판정 대상이 0개면 `null`이다.
- 기존 `classifyTmdbPersonCategory(cast, fallback)`는 `OrNull(cast) ?? fallback`으로 바꾼다. 동작은 같다(PC-1~PC-9 그대로 통과).
- 클라이언트는 `null`이면 저장값을 유지한다.

### D-4. 동기화는 목록을 열 때, 세션당 한 번이다
- 훅 `useFavoriteCategorySync(favorites)`는 TanStack Query로 실행한다(`staleTime: Infinity`, `retry: false`).
- 키는 사용자 id와 TMDB 좋아하는 인물 키(`tmdb:<id>`) 정렬 목록이다. 인물이 추가·삭제되면 키가 바뀌어 다시 확인한다.
- 20명씩 나눠 차례로 요청한다.
- 바뀐 행이 하나라도 있으면 `["favorite-people", user.id]`를 무효화한다.
- 실패는 조용히 넘기고 저장값을 표시한다. 목록 표시를 막지 않는다. `useFavoriteKoreanNameBackfill`(docs/38)과 같은 패턴이다.

### D-5. AniList 출처는 대상이 아니다
AniList 인물은 기존 `planFavoriteCategoryCorrection`(배우 → 성우 승격)만 적용한다(docs/58 D-2).

### D-6. 등록 직후 상세 호출(docs/58 D-5)을 없앤다
`useAddFavoritePerson`의 `getPersonDetail` 백그라운드 호출을 삭제한다. 카테고리는 목록에서만 보이고, 목록을 열면 D-1이 맞춘다. 상세 호출은 이름·출연작 전체를 만들어 더 무겁다.

### D-7. 상세 경로는 유지한다
`getPersonDetail`의 DB 교정과 `usePersonDetail`의 목록 무효화(docs/58 D-4)는 그대로다.

### D-8. DB 스키마 변경 없음
"확인함" 표시 칸을 두지 않는다. 세션당 한 번 확인하고, 서버 조회는 TMDB 인물 수만큼이다. docs/58 D-7("상세를 열면 고쳐진다, 일괄 재판정 안 함")은 이 명세로 대체된다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| DB 행을 직접 수정 | 지금 3명만 고치고, 다음 규칙 변경 때 같은 문제가 반복된다(사용자 지적) |
| 사용자에게 상세를 열게 함 | 목록이 서버와 따로 노는 구조가 남는다 |
| 목록이 사람마다 `get-person-detail` 호출 | 이름·출연작 전체를 만드는 무거운 호출이 인물 수만큼 생긴다 |
| `resolve-person-names`에 판정 추가 | 그 함수는 한글 이름이 필요한 인물만 부른다(`name_ko_checked_at` 기준). 대상·주기가 다르다 |
| `category_checked_at`·규칙 버전 칸 추가(마이그레이션) | 세션당 한 번 확인으로 충분하다. 사람이 적용할 DB 변경이 늘어난다 |
| 카테고리를 저장하지 않고 매번 서버 판정만 사용 | 필터 탭·검색 표시가 저장값을 쓴다. 범위가 커진다 |

## 6. 계약

### 6.1 `supabase/functions/_shared/personCredits.ts`
```ts
export function classifyTmdbPersonCategoryOrNull(cast: readonly TmdbPersonCredit[]): PersonCategory | null;
// 기존(시그니처 불변): 내부를 OrNull(cast) ?? fallback으로 바꾼다
export function classifyTmdbPersonCategory(cast: readonly TmdbPersonCredit[], fallback: PersonCategory): PersonCategory;
```
판정 순서는 docs/58 6.1과 같다. 대상이 0개면 `null`이다.

### 6.2 `supabase/functions/classify-people/index.ts` (신규)
- `POST`만 받는다. `OPTIONS`는 CORS로 답한다. `requireUser` 실패는 401이다.
- 본문 검증: `people`가 1~20개 배열이고, 각 `external_id`가 숫자로만 된 문자열이어야 한다. 아니면 400 `INVALID_REQUEST`다.
- `TMDB_API_KEY`가 없으면 500 `SERVER_MISCONFIGURED`다.
- 사람마다 `https://api.themoviedb.org/3/person/{id}?append_to_response=combined_credits`를 조회한다. 인증 방식은 `resolve-person-names`의 `applyTmdbAuth`와 같다. 동시 4건이다.
- 조회한 사람마다 `classifyTmdbPersonCategoryOrNull(detail.combined_credits?.cast ?? [])`를 쓴다. 조회 실패면 `null`이다.
- 응답: `json({ results })`. `results`는 요청 순서이고, 각 항목은 `{ external_id, category }`다.
- 키·토큰을 로그로 남기지 않는다.

### 6.3 앱
- `src/types/people.ts`: `export interface PersonCategoryResult { external_id: string; category: PersonCategory | null }`
- `src/utils/peopleScreen.ts`에 추가한다.
  ```ts
  export const CATEGORY_SYNC_BATCH_SIZE = 20;
  export function selectFavoritesForCategorySync<T extends Pick<FavoritePerson, "source">>(favorites: readonly T[]): T[];   // source === "tmdb"만, 순서 유지
  export function createCategorySyncBatches(favorites: readonly Pick<FavoritePerson, "source" | "external_id">[], size?: number): string[][];  // TMDB external_id를 size개씩
  export function planFavoriteCategorySync(
    favorites: readonly Pick<FavoritePerson, "id" | "source" | "external_id" | "category">[],
    results: readonly PersonCategoryResult[]
  ): { id: string; category: PersonCategory }[];
  ```
  `planFavoriteCategorySync`는 TMDB 행 중 같은 `external_id`의 결과가 있고, `category`가 `null`이 아니며, 저장값과 다른 것만 돌려준다. 순서는 `favorites` 순서다.
- `src/services/people.ts`
  - `classifyPeople(externalIds: string[]): Promise<PersonCategoryResult[]>`를 추가한다. `supabase.functions.invoke("classify-people", { body: { people: externalIds.map(external_id => ({ external_id })) } })`를 부르고, 오류면 throw한다.
  - `setFavoritePersonCategory(id: string, category: PersonCategory): Promise<void>`를 export한다. 기존 `updateFavoritePersonCategory`와 같은 갱신이다. 오류는 throw하지 않고 무시한다.
- `src/hooks/usePeople.ts`
  - `useFavoriteCategorySync(favorites: FavoritePerson[] | undefined): void`를 추가한다. D-4의 키·옵션을 쓴다.
    - `queryFn`: 배치마다 `classifyPeople` → `planFavoriteCategorySync` → 각 `setFavoritePersonCategory`를 부른다.
    - 바뀐 행이 하나라도 있으면 목록을 무효화한다. 반환값은 바뀐 행 수다.
    - `enabled`: `PEOPLE_FEATURES_ENABLED && user && TMDB 인물 1명 이상`.
  - `useAddFavoritePerson`의 `onSuccess`에서 `getPersonDetail` 호출 블록을 삭제한다(D-6). 기존 목록 무효화는 남긴다.
- `app/(tabs)/people.tsx`: 51행 `useFavoriteKoreanNameBackfill(favorites.data);` 다음 줄에 `useFavoriteCategorySync(favorites.data);`를 추가한다.

## 7. 데이터 모델 / SQL
변경 없음.

## 8. 화면 명세
화면 구성 변경은 없다. 동기화 중에도 목록은 저장값으로 바로 보인다. 고쳐지면 다시 그려진다.

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 저장 `voice_actor`, 판정 `actor`(堺雅人) | DB `actor`로 갱신, 목록 "배우" | CS-3, M-1 |
| E-2 | 저장·판정 모두 `voice_actor`(水樹奈々) | 갱신 없음 | CS-3 |
| E-3 | 판정 `null`(출연작 없음·조회 실패) | 저장값 유지 | CS-3, PC-10 |
| E-4 | AniList 인물 | 동기화 대상 아님 | CS-1, CS-3 |
| E-5 | TMDB 인물 45명 | 20·20·5 세 번 요청 | CS-2 |
| E-6 | TMDB 인물 0명 | 요청 없음 | CS-2, D-4 |
| E-7 | 같은 세션에서 인물 탭 다시 열기 | 다시 요청하지 않음(키 같음) | D-4 |
| E-8 | 인물 추가·삭제 후 탭 | 키가 바뀌어 다시 확인 | D-4 |
| E-9 | `classify-people` 401·500·네트워크 오류 | 목록은 저장값 표시, 오류 표시 없음 | D-4 |
| E-10 | 결과에 요청하지 않은 `external_id` | 무시 | CS-3 |
| E-11 | 판정 함수 동작 | docs/58과 같음 | PC-1~PC-9(기존), PC-10 |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 기존 테스트(특히 PC-1~PC-9)는 고치지 않는다. 보존 테스트는 없다. 새 행은 새 export가 없어 구현 전에 모두 실패해야 한다.

### `supabase/functions/_shared/personCredits.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| PC-10 | `classifyTmdbPersonCategoryOrNull([])` / 본인 출연만 / PC-1의 실사 위주 배열 / PC-2의 목소리 위주 배열 | `null` / `null` / `"actor"` / `"voice_actor"` |

### `src/utils/peopleScreen.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| CS-1 | `selectFavoritesForCategorySync([tmdb A, anilist B, tmdb C])` | `[A, C]` |
| CS-2 | `createCategorySyncBatches`(TMDB 45명 + AniList 3명) / `([])` | 길이 `[20, 20, 5]`, TMDB `external_id`만 순서대로 / `[]` |
| CS-3 | 즐겨찾기: `{id:"1", tmdb, "76933", voice_actor}`, `{id:"2", tmdb, "24651", voice_actor}`, `{id:"3", tmdb, "84620", actor}`, `{id:"4", anilist, "102170", voice_actor}`. 결과: `76933→actor`, `24651→voice_actor`, `84620→null`, `102170→actor`, `999→actor` | `[{ id: "1", category: "actor" }]` |

### 수동 확인 (배포 후)
| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 | 상세를 열지 않고 인물 탭만 연다. 잠시 뒤 堺雅人·阿部寛·吉岡里帆이 "배우", 花江夏樹·水樹奈々·林原めぐみ는 "성우" |
| M-2 | 웹 8081 | 네트워크 탭에 `classify-people` 요청 1건(TMDB 인물 14명). 탭을 다시 열어도 같은 세션에서는 다시 요청하지 않음 |
| M-3 | 앱(iOS 세로) | M-1과 같음 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/personCredits.ts` | `classifyTmdbPersonCategoryOrNull`, 기존 함수 내부 정리 |
| `supabase/functions/_shared/personCredits.test.ts` | PC-10 |
| `supabase/functions/classify-people/index.ts` (신규) | 6.2 |
| `src/types/people.ts` | `PersonCategoryResult` |
| `src/utils/peopleScreen.ts` | 6.3 함수 3개, 상수 |
| `src/utils/peopleScreen.test.ts` | CS-1~CS-3 |
| `src/services/people.ts` | `classifyPeople`, `setFavoritePersonCategory` |
| `src/hooks/usePeople.ts` | `useFavoriteCategorySync`, 등록 직후 상세 호출 삭제 |
| `app/(tabs)/people.tsx` | 훅 호출 1줄 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| AniList 인물의 배우·성우 구분 | docs/58 D-2 |
| 검색 결과·작품 상세 출연진의 처음 카테고리 | 목록을 열면 D-1이 맞춘다 |
| 다른 기기·다른 사용자 | 각자 인물 탭을 열면 맞춰진다 |
| 판정 규칙 자체 | docs/58 |

## 13. 확실하지 않음
- TMDB 인물이 아주 많은 사용자(수백 명)는 첫 동기화에 시간이 걸린다. 화면은 저장값으로 바로 보이고 뒤에서 맞춰진다.
- `combined_credits` 응답 크기(인물당 수백 건)는 실측하지 않았다. 응답은 판정만 돌려줘 클라이언트 전송량은 작다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 결함 수정 작업이다.
인물 탭 목록은 서버 판정을 부르지 않고 등록 당시 저장한 배우·성우 값을 보여 준다. 그래서 판정 규칙을 고쳐 배포해도(docs/58, `get-person-detail` v11) 堺雅人·阿部寛·吉岡里帆이 계속 "성우"다. 목록을 열 때 TMDB 인물의 카테고리를 새 Edge Function `classify-people`로 일괄 판정하고, 저장값과 다르면 고쳐 목록이 서버 판정을 따르게 한다.

| ID | 증상 |
|----|------|
| S-1 | 서버 판정을 고쳐도 목록의 배우·성우가 바뀌지 않는다(상세를 열어야만 바뀜) |

# READ FIRST
1. 이 명세서 1~13장. 원인은 2장, 결정은 D-1~D-8, 계약은 6장, 테스트는 10장이다.
2. `docs/58_person_category_classification_fixes_spec.md` 6.1(판정 규칙), D-4·D-5.
3. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
4. 패턴 참고:
   - `supabase/functions/resolve-person-names/index.ts`: 묶음 요청, 검증, 동시 실행, `applyTmdbAuth`
   - `src/hooks/usePeople.ts` `useFavoriteKoreanNameBackfill`: 목록을 열 때 서버에 묻고 DB를 고친 뒤 무효화
5. 고칠 파일:
   - `supabase/functions/_shared/personCredits.ts`(+test)
   - `src/services/people.ts`
   - `src/hooks/usePeople.ts`
   - `src/utils/peopleScreen.ts`(+test)
   - `src/types/people.ts`
   - `app/(tabs)/people.tsx` 50~51행

# 시작 상태 (반드시 유지)
- `git status`와 `npm test` 결과를 기록한다. 작성 시점 기준선은 1163개 중 1162개 통과이고, 기존 실패 1개는 무관하다. 숫자가 다르면 시작 시점 값을 기준선으로 보고한다. 그 밖의 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 인물 탭을 열면 TMDB 좋아하는 인물 전부를 `classify-people`로 판정하고, 저장값과 다른 행만 고친 뒤 목록을 무효화한다.
- **D-2.** `classify-people`은 TMDB 전용이고 1~20명, 동시 4건이다. 판정 불가·조회 실패는 `null`이고, 판정만 돌려준다.
- **D-3.** `classifyTmdbPersonCategoryOrNull`을 추가하고, 기존 함수는 `?? fallback`으로 같은 동작을 유지한다(PC-1~PC-9 무수정 통과).
- **D-4.** 세션당 한 번이다(`staleTime: Infinity`, 키는 사용자 + TMDB 키 정렬 목록). 20명씩 나누고, 실패는 조용히 넘긴다.
- **D-5.** AniList 인물은 대상이 아니다.
- **D-6.** `useAddFavoritePerson`의 등록 직후 `getPersonDetail` 호출을 삭제한다.
- **D-7.** 상세 경로의 교정·무효화는 그대로다.
- **D-8.** DB 마이그레이션을 만들지 않는다.

# STEP 1 — 실패하는 테스트부터
- PC-10을 `personCredits.test.ts`에, CS-1~CS-3을 `peopleScreen.test.ts`에 추가한다.
- `npm test`로 새 테스트가 전부 실패(새 export 없음)하는지 확인한다. 하나라도 통과하면 멈추고 보고한다.

# STEP 2 — 판정 함수
6.1대로 고친다. PC-1~PC-10이 통과해야 한다.

# STEP 3 — Edge Function
6.2대로 `supabase/functions/classify-people/index.ts`를 만든다. 다른 Edge Function과 같은 import 경로(`../_shared/...ts`)를 쓴다.

# STEP 4 — 앱
6.3대로 타입·순수 함수·서비스·훅·화면 1줄을 고친다. CS 행이 통과해야 한다.

# 엣지 케이스
9장 E-1~E-11 전부.

# 검증 명령
```
npm test
npm run typecheck
npm run lint
npx --no-install esbuild supabase/functions/classify-people/index.ts --bundle=false --format=esm --log-level=warning > /dev/null
```
- `npm test`: 기준선 통과 개수 + 새 테스트 4개(PC-10, CS-1~CS-3). 기존 실패 1개 외 실패는 0이어야 한다.
- esbuild는 오류 0이어야 한다.

# DEFINITION OF DONE
- [ ] PC-10, CS-1~CS-3이 수정 전에 실패했고 수정 후 통과한다
- [ ] 기존 테스트 diff가 없고(PC-1~PC-9 포함), 테스트 개수가 줄지 않았다
- [ ] `classify-people`이 1~20명 검증, 동시 4건, 사람별 실패 시 `null`을 지킨다
- [ ] `app/(tabs)/people.tsx`가 `useFavoriteCategorySync(favorites.data)`를 부른다
- [ ] `useAddFavoritePerson`에 `getPersonDetail` 호출이 없다
- [ ] `typecheck`·`lint`·esbuild 통과

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
supabase/functions/_shared/personCredits.ts
supabase/functions/_shared/personCredits.test.ts
supabase/functions/classify-people/index.ts
src/types/people.ts
src/utils/peopleScreen.ts
src/utils/peopleScreen.test.ts
src/services/people.ts
src/hooks/usePeople.ts
app/(tabs)/people.tsx
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력(요약)
2. `npm test` before / after 통과 개수, `typecheck`·`lint`·esbuild 결과
3. 추가한 테스트 ID와 이름
4. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
5. 사람이 할 후속 작업: 새 함수 `classify-people` 배포. `get-person-detail`은 공용 판정 함수 정리가 동작을 바꾸지 않으므로 재배포가 필수는 아니다

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- DB 행을 직접 고치는 스크립트를 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- TMDB 키 등 비밀 값을 출력하지 않는다. 로그인 대행 금지.
