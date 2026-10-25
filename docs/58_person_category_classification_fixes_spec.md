# 58. 배우·성우 판정 정정

작성일: 2026-10-13
대상 브랜치 기준: `main` (`c6a0e7e`) + 미커밋 작업(`docs/44`~`57`). 작성 시점 `npm test`는 1126개 중 1125개 통과다. 실패 1개("uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함이다.
선행 문서: `docs/34_search_seasons_and_people_restore_spec.md`(인물 검색 복원), `docs/36_people_tab_saas_redesign_spec.md`(인물 탭), `docs/38_japanese_person_korean_name_spec.md`(인물 이름), `docs/50_content_crew_storage_list_display_spec.md`(`get-content-detail` 배포 순서)

> **정정(2026-10-13).** D-7(기존 행은 상세를 열어야 고쳐짐)은 `docs/59_favorite_person_category_sync_spec.md`로 대체된다. 이제 인물 탭을 열 때 서버 판정과 맞춘다. D-5(등록 직후 상세 호출)도 docs/59 D-6으로 삭제된다.

> **근거.** 사용자 캡처(웹, 인물 탭 "내가 좋아하는 인물"). 堺雅人(사카이 마사토, 대표작 VIVANT), 阿部寛(아베 히로시, 캐스터), 吉岡里帆(요시오카 리호, 미안하다, 사랑한다)가 실사 배우인데 "성우"로 표시된다.
> 사용자 요청: "사카이 마사토는 배우인데 성우라 표시 되어있어 이 부분에 구멍이 있는지 체크해서 codex 용 prompt 작성해줘"

---

## 1. 문제 정의
| ID | 증상 |
|----|------|
| P-1 | 실사 배우가 애니·더빙에 몇 편 목소리 출연했다는 이유로 "성우"로 저장·표시된다 |
| P-2 | 한 번 "성우"가 되면 다시 "배우"로 돌아오지 않는다 |
| P-3 | 애니 작품 상세의 출연진이 TMDB에서 온 경우에도 AniList 인물로 등록·이동한다. TMDB 인물 id를 AniList id로 써서 다른 사람이 열릴 수 있다 |

## 2. 근본 원인 (구멍 5개)

### H-1. 서버 판정이 "목소리 출연 3편 이상"이면 성우다 (P-1의 직접 원인)
`supabase/functions/get-person-detail/index.ts` 663~674행 `inferPersonCategory`:
```ts
if (voiceRoleCount >= 3 || (roleCount > 0 && voiceRoleCount / roleCount >= 0.5)) return "voice_actor";
```
`voiceRoleCount >= 3` 절대값 조건 때문에 출연작이 많은 배우도 목소리 출연 3편이면 성우가 된다. 판정에는 TMDB `combined_credits.cast`의 앞 120개(`slice(0, 120)`, 138~140행)만 쓰고, "Narrator (voice)"도 목소리 출연으로 센다.

### H-2. 판정이 한쪽으로만 움직인다 (P-2)
- 서버 `inferPersonCategory` 첫 줄(664행) `if (category === "voice_actor") return category;` — 요청이 성우면 판정하지 않는다.
- 앱 `correctFavoritePersonCategory`(`src/services/people.ts` 210~220행)는 목록을 읽을 때마다 성우 쪽으로만 고치고 배우로는 돌리지 않는다.
- `getPersonDetail`(46~65행)은 서버 판정이 다르면 DB를 고치지만(`void updateFavoritePersonCategoryByExternalId`), H-1·서버 첫 줄 때문에 성우 → 배우 교정이 일어나지 않는다. 고친 뒤 좋아하는 인물 목록을 다시 읽지도 않는다.

### H-3. 앱이 대표작 문자열로 성우를 추측한다
`looksLikeVoiceActorFavorite`(`src/services/people.ts` 222~238행)는 이름·대표작 문자열에 `"anime"`, `"나루토"`, `"명탐정 코난"`, `"건방진 천사"` 등이 들어 있으면 TMDB 인물을 성우로 바꾼다. 예: 코난 극장판에 목소리 출연한 배우가 그 작품을 대표작으로 등록되면 성우가 된다. 이 결과는 H-2 때문에 영구적이다.

### H-4. 작품 상세 출연진의 출처를 작품 종류로 정한다 (P-3)
`app/content/[id].tsx` 261~298행 `addCastMember`·`openCastMember`와 `src/components/content/CastSection.tsx` 10행은 작품이 애니면 출연진 전원을 `source: "anilist"`, `category: "voice_actor"`로 다룬다. 그런데 애니 출연진은 TMDB에서도 온다(`supabase/functions/_shared/externalContent.ts`).
- TMDB 출처 애니: `mapTmdbCast`(228행)가 TMDB 인물 id를 쓴다.
- AniList 작품인데 AniList 성우가 비어 있을 때: TMDB 출연진으로 대신한다(582행).
- Kitsu 작품: 항상 TMDB 출연진이다(666행).

이 경우 TMDB 인물 id가 AniList id로 저장·조회되어 엉뚱한 인물이 열리거나 등록 표시가 틀린다. 출연진 항목(`CastMemberMeta`, `supabase/functions/_shared/types.ts` 21~28행)에 출처 정보가 없다.

### H-5. 판정이 인물이 아니라 "이번 작품"에 묶여 있다
작품 상세 등록은 그 작품이 애니인지로 배우·성우를 정한다. 사카이 마사토를 애니 영화 "프로메어" 출연진에서 등록하면 성우가 된다. 등록 직후 서버 판정으로 확인하는 절차가 없다.

### 실측 (2026-10-13, TMDB 읽기 전용)
**새 규칙**: 전체 출연작에서 본인 출연·내레이션·뉴스/리얼리티/토크를 빼고, "(voice)" 배역이거나 애니 장르(16)인 작품의 비율이 0.5 이상이면 성우.

| 인물 | 실제 | 현재 판정 | 새 규칙(목소리·애니 / 대상) |
|------|------|----------|-----------------------------|
| 堺雅人 | 배우 | **성우** | 배우 (11/126 = 0.09) |
| 阿部寛 | 배우 | **성우** | 배우 (5/182 = 0.03) |
| 吉岡里帆 | 배우 | **성우** | 배우 (4/85 = 0.05) |
| 小栗旬 | 배우 | **성우** | 배우 (15/153 = 0.10) |
| 木村拓哉 | 배우 | **성우** | 배우 (6/81 = 0.07) |
| 神木隆之介 | 배우 | **성우** | 배우 (16/145 = 0.11) |
| 上白石萌音 | 배우 | **성우** | 배우 (6/56 = 0.11) |
| 菅田将暉 | 배우 | **성우** | 배우 (5/121 = 0.04) |
| 戸田恵梨香·松本潤·長瀬智也·이제훈·한지민·정소민 | 배우 | 배우 | 배우 (0.00~0.02) |
| 花江夏樹·水樹奈々·林原めぐみ·梶裕貴·宮野真守·山寺宏一·神谷浩史·釘宮理恵·大塚明夫 | 성우 | 성우 | 성우 (0.83~0.98) |

- 새 규칙은 23명 모두 맞는다. 배우 최대 0.11, 성우 최소 0.83으로 기준 0.5에서 멀다.
- 검색 결과의 대표작(`known_for`, 3개)으로 추측하면 木村拓哉·神木隆之介·上白石萌音·菅田将暉가 성우로 틀린다(대표작이 애니 영화). 그래서 추측에 쓰지 않는다(5장).
- AniList `primaryOccupations`는 위 실사 배우 5명(堺·花江·阿部·吉岡·小栗)을 모두 `["Voice Actor"]`로 준다. AniList는 목소리 출연만 기록하므로 AniList 정보로는 배우와 성우를 구분할 수 없다.

## 3. 재현 시나리오
1. 웹 8081에 로그인한 뒤 인물 탭을 연다. 堺雅人이 "성우"로 보인다.
2. 堺雅人 상세를 연다. 상세 배지도 "성우"이고, 목록도 그대로다.

## 4. 설계 결정

### D-1 (최우선). TMDB 인물의 배우·성우는 서버의 비율 규칙 하나로 정하고, 양쪽으로 고친다
- `classifyTmdbPersonCategory`(6.1)만 판정한다.
- 입력은 TMDB `combined_credits.cast` **전체**다(120개로 자르지 않는다).
- 대상은 기존 `isEligiblePersonCredit`(movie/tv, 뉴스·리얼리티·토크 장르와 본인 출연 제외)를 통과하고 내레이션이 아닌 작품이다. `media_type:id`로 중복을 없앤다.
- 대상 중 "(voice)" 배역이거나 장르에 16(애니)이 있는 작품의 비율이 **0.5 이상이면 성우, 아니면 배우**다.
- 대상이 0개면 요청받은 카테고리를 그대로 둔다(판정 불가).
- 요청이 성우여도 판정한다. 성우 → 배우 교정이 가능하다.
- 절대값 조건(3편 이상)은 없앤다.

### D-2. AniList 출처 인물은 성우 그대로다
AniList는 목소리 출연만 기록한다(2장 실측). AniList 상세(`getAniListPersonDetail`)와 목록의 AniList → 성우 승격은 바꾸지 않는다.

### D-3. 앱은 문자열로 추측하지 않는다
- `looksLikeVoiceActorFavorite`와 그 호출을 삭제한다.
- 목록을 읽을 때(`getFavoritePeople`) TMDB 인물의 카테고리는 바꾸지 않는다.
- AniList 인물의 배우 → 성우 승격만 남긴다. 판정은 순수 함수 `planFavoriteCategoryCorrection`(6.3)으로 옮긴다.

### D-4. 서버 판정이 다르면 DB를 고치고 목록을 다시 읽는다
- `getPersonDetail`은 서버 카테고리가 요청과 다르면 `updateFavoritePersonCategoryByExternalId`를 **기다린 뒤**(실패는 무시) 상세를 돌려준다.
- `usePersonDetail`은 받은 카테고리가 요청과 다르면 `["favorite-people", user.id]`를 무효화한다.

### D-5. TMDB 인물을 등록하면 바로 서버 판정으로 한 번 확인한다
- `useAddFavoritePerson`의 `onSuccess`에서 등록한 인물이 `source === "tmdb"`면 백그라운드로 `getPersonDetail({ source, externalId, category })`를 부른다. 다르면 D-4로 DB가 고쳐진다.
- 끝나면(성공·실패 모두) 좋아하는 인물 목록을 무효화한다. 실패는 조용히 넘긴다(등록은 이미 성공).
- 검색·작품 상세에서 넣는 처음 카테고리는 추측일 뿐이고, 최종 판정은 서버다.

### D-6. 작품 상세 출연진에 출처를 싣는다
- 서버 `CastMemberMeta`에 `source: "tmdb" | "anilist"`를 추가한다. `mapTmdbCast`는 `"tmdb"`, `mapAniListVoiceActors`는 `"anilist"`다.
- 앱 `CastMember`에는 선택 필드로 추가한다(`source?:`). 구버전 응답·저장값 호환 때문이다.
- 앱은 `resolveCastMemberPerson(member, isAnime)`(6.3)으로 출처·처음 카테고리·등록 키를 정한다.
  - 출처: `member.source`가 있으면 그것이다. 없으면(구버전 응답) 지금처럼 `isAnime ? "anilist" : "tmdb"`다.
  - 처음 카테고리: 출처가 `"anilist"`이거나 작품이 애니면 성우, 아니면 배우다. TMDB 인물은 D-5로 바로 확인된다.
- `addCastMember`·`openCastMember`·`CastSection` 등록 표시가 모두 이 함수를 쓴다.

### D-7. 기존에 잘못 저장된 행은 상세를 열면 고쳐진다
- 배포 후 인물 상세를 열면 D-1·D-4로 DB가 고쳐진다.
- 목록을 열 때 일괄 재판정은 하지 않는다. 인물마다 무거운 상세 호출이 필요하고, 세션마다 반복된다.
- 사용자에게는 영향받은 인물(堺雅人, 阿部寛, 吉岡里帆)의 상세를 한 번 열라고 안내한다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| 절대값 기준을 3에서 10 등으로 올림 | 출연작 수에 따라 또 틀린다. 실측상 비율 기준이 0.11 대 0.83으로 명확히 갈린다 |
| 검색 결과 대표작(`known_for`) 애니 비율로 추측 | 실측 4명 오판(2장) |
| AniList `primaryOccupations` 사용 | 실사 배우도 "Voice Actor"다(2장) |
| 목록을 열 때마다 TMDB 인물을 재판정 | 인물마다 상세 호출이 필요하고 세션마다 반복된다(D-7) |
| 배우·성우 둘 다 표시(복수 카테고리) | DB 스키마(`category` 단일 값)와 필터 탭이 바뀐다. MVP 범위 밖 |
| 대표작 힌트 목록 확장 | H-3 자체가 구멍이다 |

## 6. 계약

### 6.1 `supabase/functions/_shared/personCredits.ts` (추가)
```ts
export type PersonCategory = "actor" | "voice_actor";
export const VOICE_ACTOR_MIN_RATIO = 0.5;
export function isNarration(character: string | null | undefined): boolean;   // /\bnarrat(or|ion)\b/i 또는 "내레이션"
export function classifyTmdbPersonCategory(
  cast: readonly TmdbPersonCredit[],
  fallback: PersonCategory
): PersonCategory;
```
**판정 순서**
1. `cast`에서 `isEligiblePersonCredit(credit) && !isNarration(credit.character)`인 것만 남긴다. `media_type:id`가 같은 것은 처음 하나만 둔다.
2. 남은 것이 0개면 `fallback`이다.
3. `voiceLike`는 `/\bvoice\b/i.test(character ?? "")`이거나 `genre_ids`에 16이 있는 것이다.
4. `voiceLike / 남은 개수 >= VOICE_ACTOR_MIN_RATIO`이면 `"voice_actor"`, 아니면 `"actor"`다. `fallback`은 보지 않는다(양방향).

기존 export(`isSelfAppearance`, `isEligiblePersonCredit`, `selectPersonCastCredits`, `EXCLUDED_PERSON_CREDIT_GENRE_IDS`)는 바꾸지 않는다.

### 6.2 서버
- `get-person-detail/index.ts`
  - TMDB 상세의 `category`를 `classifyTmdbPersonCategory(detail.combined_credits?.cast ?? [], category)`로 정한다.
  - 판정 입력은 `slice(0, 120)` 전 원본이다. 화면용 `credits` 목록의 120개 제한은 그대로 둔다.
  - `inferPersonCategory`는 삭제한다. 상세 응답 `combined_credits.cast` 타입에 `genre_ids`가 이미 있는지 확인하고, 없으면 추가한다.
  - AniList 경로는 바꾸지 않는다.
- `_shared/types.ts` `CastMemberMeta`: `source: "tmdb" | "anilist"`를 추가한다.
- `_shared/externalContent.ts`: `mapTmdbCast` 결과에 `source: "tmdb"`, `mapAniListVoiceActors` 결과에 `source: "anilist"`를 넣는다. 다른 로직은 바꾸지 않는다.

### 6.3 앱
- `src/types/content.ts` `CastMember`: `source?: "tmdb" | "anilist";`
- `src/utils/peopleScreen.ts` (추가)
  ```ts
  export function resolveCastMemberPerson(
    member: Pick<CastMember, "id" | "source">, isAnime: boolean
  ): { source: PersonSource; category: PersonCategory; key: string };
  export function planFavoriteCategoryCorrection(
    person: Pick<FavoritePerson, "source" | "category">
  ): PersonCategory | null;
  ```
  - `resolveCastMemberPerson` 판정:
    - `source = member.source ?? (isAnime ? "anilist" : "tmdb")`
    - `category = source === "anilist" || isAnime ? "voice_actor" : "actor"`
    - `key = personKey({ source, external_id: String(member.id) })`
  - `planFavoriteCategoryCorrection`: `source === "anilist" && category === "actor"`이면 `"voice_actor"`, 그 밖에는 `null`(바꾸지 않음).
- `src/services/people.ts`
  - `correctFavoritePersonCategory`는 `planFavoriteCategoryCorrection` 결과가 있을 때만 `updateFavoritePersonCategory`를 부른다.
  - `looksLikeVoiceActorFavorite`를 삭제한다.
  - `getPersonDetail`은 D-4대로 갱신을 `await`한다(`try/catch`로 실패 무시).
- `src/hooks/usePeople.ts`
  - `usePersonDetail`의 `queryFn`: 상세를 받은 뒤 `data.category !== category`이고 로그인 상태면 `["favorite-people", user.id]`를 무효화한다.
  - `useAddFavoritePerson` `onSuccess(_, person)`: 기존 무효화를 유지한다. `person.source === "tmdb"`이면 `void getPersonDetail({ source: "tmdb", externalId: person.external_id, category: person.category }).catch(() => undefined).finally(() => 목록 무효화)`를 부른다.
- `app/content/[id].tsx` `addCastMember`·`openCastMember`: `resolveCastMemberPerson(member, view.contentType === "anime")`의 `source`·`category`를 쓴다. 등록 행의 나머지 값(이름·사진·대표작)은 그대로다.
- `src/components/content/CastSection.tsx` 10행: 등록 여부 키를 `resolveCastMemberPerson(member, isAnime).key`로 바꾼다. 제목("성우"/"출연 배우")은 그대로다.

## 7. 데이터 모델 / SQL
변경 없음. `favorite_people.category`의 값 범위는 그대로다. 기존 행은 D-7로 고쳐진다.

## 8. 화면 명세
화면 구성 변경은 없다. 배지 문구("배우"/"성우")는 `personCategoryLabel` 그대로다.

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 출연 96편 중 목소리 3편(사카이형) | 배우 | PC-1 |
| E-2 | 출연 대부분 애니 목소리(하나에형) | 성우 | PC-2 |
| E-3 | 비율 정확히 0.5 / 0.4 | 성우 / 배우 | PC-3 |
| E-4 | "Narrator (voice)", "Self - Narrator (voice)", "Herself" | 판정 대상 아님 | PC-4 |
| E-5 | "(voice)" 표시 없는 애니 장르 출연 | 목소리 출연으로 셈 | PC-5 |
| E-6 | 판정 대상 0개 | 요청 카테고리 유지 | PC-6 |
| E-7 | 요청이 성우인데 출연이 배우 위주 | 배우(양방향) | PC-7 |
| E-8 | 같은 작품이 중복 | 한 번만 셈 | PC-8 |
| E-9 | 애니 작품의 TMDB 출처 출연진 | TMDB 인물로 등록·이동, 처음 성우 → 등록 직후 서버 판정 | CM-1, D-5 |
| E-10 | AniList 성우 출연진 | AniList·성우 | CM-2 |
| E-11 | 실사 작품 출연진 | TMDB·배우 | CM-3 |
| E-12 | 구버전 응답(출처 없음) | 지금 규칙(애니면 AniList) | CM-4 |
| E-13 | TMDB 인물, 대표작 문자열에 "나루토" | 목록 읽을 때 바꾸지 않음 | FC-1 |
| E-14 | AniList 인물이 배우로 저장됨 | 성우로 승격(기존 유지) | FC-2 |
| E-15 | TMDB 성우로 저장된 실사 배우 | 목록에서는 그대로, 상세를 열면 배우로 교정 후 목록 갱신 | FC-3, D-4, M-1 |
| E-16 | 등록 직후 확인 호출 실패 | 등록은 성공, 카테고리는 처음 값 | D-5 |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 기존 테스트는 고치지 않는다. 보존 테스트는 없다. 새 행은 새 export가 없어 구현 전에 모두 실패해야 한다.

### `supabase/functions/_shared/personCredits.test.ts` (추가)
픽스처는 `{ id, media_type: "movie", character, genre_ids }` 배열을 반복문으로 만든다.
| ID | 입력 | 기대 |
|----|------|------|
| PC-1 | 실사 93편(`character: "Role"`, 장르 [18]) + 목소리 3편(`"Kray (voice)"`, [16]), fallback `"voice_actor"` | `"actor"` |
| PC-2 | 목소리·애니 10편 + 실사 1편, fallback `"actor"` | `"voice_actor"` |
| PC-3 | 목소리 5 + 실사 5 / 목소리 4 + 실사 6 | `"voice_actor"` / `"actor"` |
| PC-4 | `"Narrator (voice)"`, `"Self - Narrator (voice)"`, `"Herself"`, `"Role"` 각 1편, fallback `"voice_actor"` | `"actor"`(대상은 `"Role"` 1편뿐) |
| PC-5 | 장르 [16]이고 배역이 `"Tanjiro"`(voice 표시 없음)인 3편 + 실사 1편 | `"voice_actor"` |
| PC-6 | `[]` / 본인 출연만 | fallback 그대로(`"actor"`→`"actor"`, `"voice_actor"`→`"voice_actor"`) |
| PC-7 | 실사 10편, fallback `"voice_actor"` | `"actor"` |
| PC-8 | 같은 `movie:1`(목소리) 5번 + 실사 2편 | `"actor"`(1/3) |
| PC-9 | `isNarration("Narrator (voice)")`, `("내레이션")`, `("Narration")`, `("Tanjiro (voice)")` | `true`, `true`, `true`, `false` |

### `src/utils/peopleScreen.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| CM-1 | `resolveCastMemberPerson({ id: 76933, source: "tmdb" }, true)` | `{ source: "tmdb", category: "voice_actor", key: "tmdb:76933" }` |
| CM-2 | `({ id: 102170, source: "anilist" }, true)` | `{ source: "anilist", category: "voice_actor", key: "anilist:102170" }` |
| CM-3 | `({ id: 531736, source: "tmdb" }, false)` | `{ source: "tmdb", category: "actor", key: "tmdb:531736" }` |
| CM-4 | `({ id: 1 }, true)` / `({ id: 1 }, false)` | `anilist`·`voice_actor` / `tmdb`·`actor` |
| FC-1 | `planFavoriteCategoryCorrection({ source: "tmdb", category: "actor" })` | `null` |
| FC-2 | `({ source: "anilist", category: "actor" })` | `"voice_actor"` |
| FC-3 | `({ source: "tmdb", category: "voice_actor" })` / `({ source: "anilist", category: "voice_actor" })` | `null` / `null` |

### 수동 확인 (배포 후, UI-14.3)
| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 | 堺雅人 상세 → 배지 "배우". 인물 탭으로 돌아오면 목록 배지도 "배우". 阿部寛·吉岡里帆도 같다 |
| M-2 | 웹 8081 | 花江夏樹·水樹奈々·林原めぐみ는 "성우" 유지 |
| M-3 | 웹 8081 | 인물 검색에서 TMDB 성우(예: 梶裕貴)를 "배우 등록" → 잠시 뒤 목록에서 "성우" |
| M-4 | 웹 8081 (`get-content-detail` 배포 후) | TMDB 출처 애니 상세 출연진 등록 → 그 인물 상세가 같은 사람이고, 실사 배우면 목록에서 "배우" |
| M-5 | 앱(iOS 세로) | M-1·M-3과 같음 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/personCredits.ts` | 6.1 |
| `supabase/functions/_shared/personCredits.test.ts` | PC-1~PC-9 |
| `supabase/functions/get-person-detail/index.ts` | 6.2(판정 교체, `inferPersonCategory` 삭제) |
| `supabase/functions/_shared/types.ts` | `CastMemberMeta.source` |
| `supabase/functions/_shared/externalContent.ts` | 출연진 `source` |
| `src/types/content.ts` | `CastMember.source?` |
| `src/utils/peopleScreen.ts` | `resolveCastMemberPerson`, `planFavoriteCategoryCorrection` |
| `src/utils/peopleScreen.test.ts` | CM-1~CM-4, FC-1~FC-3 |
| `src/services/people.ts` | 6.3 |
| `src/hooks/usePeople.ts` | 6.3 |
| `app/content/[id].tsx` | `addCastMember`·`openCastMember` |
| `src/components/content/CastSection.tsx` | 등록 키 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| AniList 인물의 배우·성우 구분 | AniList 데이터로 구분 불가(D-2) |
| 목록을 열 때 일괄 재판정·관리자 일괄 스크립트 | D-7 |
| 인물 검색 결과의 처음 카테고리(TMDB는 배우) | D-5로 등록 직후 교정. 대표작 추측은 기각 |
| 배우·성우 필터 탭 동작 | 카테고리 값만 바로잡는다 |
| 같은 사람의 TMDB·AniList 중복 등록 합치기 | 별도 기능 |

## 13. 확실하지 않음
- 비율 0.5 기준은 23명 실측으로 정했다. 실사와 더빙을 비슷하게 하는 인물(예: 한국 성우 출신 배우)은 경계에 걸릴 수 있다.
- TMDB 출연 기록이 적은 신인 성우는 애니 장르·"(voice)" 표시가 없으면 배우로 나올 수 있다.
- `get-content-detail` 배포는 `docs/50`의 순서(마이그레이션 0024 적용 → 배포)를 따라야 한다. 그 전에는 출연진 `source`가 없어 앱이 지금 규칙(E-12)으로 동작한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 결함 수정 작업이다.
실사 배우(堺雅人·阿部寛·吉岡里帆)가 "성우"로 저장·표시된다. 원인은 다섯 가지다.
- 서버가 "목소리 출연 3편 이상이면 성우"로 판정한다.
- 판정이 성우 쪽으로만 움직인다.
- 앱이 대표작 문자열로 성우를 추측한다.
- 애니 상세 출연진의 출처를 작품 종류로 정한다.
- 등록 시 서버 확인이 없다.

TMDB 인물의 배우·성우를 서버의 비율 규칙 하나로 양방향 판정하고, 앱의 추측을 없애고, 출연진에 출처를 싣는다.

| ID | 증상 |
|----|------|
| P-1 | 실사 배우가 목소리 출연 몇 편으로 성우가 된다 |
| P-2 | 성우가 되면 배우로 돌아오지 않는다 |
| P-3 | 애니 상세의 TMDB 출연진이 AniList 인물로 등록·이동된다 |

# READ FIRST
1. 이 명세서 1~13장. 구멍 H-1~H-5와 실측은 2장, 결정은 D-1~D-7, 계약은 6장, 테스트는 10장이다.
2. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
3. 고칠 파일과 위치:
   - `supabase/functions/_shared/personCredits.ts`(+test)
   - `supabase/functions/get-person-detail/index.ts`: 99~165행, 663~674행
   - `supabase/functions/_shared/types.ts`: 21~28행
   - `supabase/functions/_shared/externalContent.ts`: 228~241행, 498~521행
   - `src/services/people.ts`: 46~65행, 67~79행, 210~238행
   - `src/hooks/usePeople.ts`
   - `src/utils/peopleScreen.ts`(+test)
   - `app/content/[id].tsx`: 261~298행
   - `src/components/content/CastSection.tsx`: 10행

# 시작 상태 (반드시 유지)
- `git status`와 `npm test` 결과를 기록한다. 작성 시점 기준선은 1126개 중 1125개 통과이고, 기존 실패 1개는 무관하다. 다른 작업이 먼저 반영되어 숫자가 다르면 시작 시점 값을 기준선으로 보고한다. 그 밖의 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** TMDB 인물 판정은 `classifyTmdbPersonCategory` 하나다.
  - 입력은 전체 출연작이다. `isEligiblePersonCredit`을 통과하고 내레이션이 아닌 것을 대상으로, 중복을 없앤다.
  - 대상 중 "(voice)"이거나 애니 장르인 비율이 0.5 이상이면 성우다.
  - 대상이 0개면 요청값을 유지한다.
  - 요청값과 관계없이 양방향으로 판정한다. 절대값 조건은 없다.
- **D-2.** AniList 경로·AniList 성우 승격은 바꾸지 않는다.
- **D-3.** `looksLikeVoiceActorFavorite`를 삭제한다. 목록을 읽을 때 TMDB 인물 카테고리를 바꾸지 않는다.
- **D-4.** 서버 판정이 다르면 DB 갱신을 기다린 뒤 상세를 돌려준다. 상세 훅이 좋아하는 인물 목록을 무효화한다.
- **D-5.** TMDB 인물을 등록하면 백그라운드로 상세를 한 번 불러 판정을 반영하고, 목록을 무효화한다. 실패는 조용히 넘긴다.
- **D-6.** 출연진에 `source`를 싣는다. 앱은 `resolveCastMemberPerson`으로 출처·카테고리·키를 정하고, `source`가 없으면 기존 규칙을 쓴다.
- **D-7.** 목록 일괄 재판정·일괄 스크립트를 만들지 않는다.

# STEP 1 — 실패하는 테스트부터
- 10장 PC-1~PC-9를 `personCredits.test.ts`에, CM-1~CM-4·FC-1~FC-3을 `peopleScreen.test.ts`에 추가한다.
- `npm test`로 새 테스트가 전부 실패(새 export 없음)하는지 확인한다. 하나라도 통과하면 멈추고 보고한다.

# STEP 2 — 서버 판정
- `personCredits.ts`에 6.1을 추가한다.
- `get-person-detail/index.ts`의 TMDB 카테고리를 교체하고 `inferPersonCategory`를 삭제한다.
- PC 행이 통과해야 한다.

# STEP 3 — 출연진 출처
`types.ts`, `externalContent.ts`, `src/types/content.ts`를 6.2·6.3대로 고친다.

# STEP 4 — 앱
- `peopleScreen.ts` 함수 2개를 추가한다.
- `services/people.ts`, `hooks/usePeople.ts`, `app/content/[id].tsx`, `CastSection.tsx`를 6.3대로 고친다.
- CM·FC 행이 통과해야 한다.

# 엣지 케이스
9장 E-1~E-16 전부.

# 검증 명령
```
npm test
npm run typecheck
npm run lint
npx --no-install esbuild supabase/functions/get-person-detail/index.ts --bundle=false --format=esm --log-level=warning > /dev/null
npx --no-install esbuild supabase/functions/_shared/externalContent.ts --bundle=false --format=esm --log-level=warning > /dev/null
```
- `npm test`: 기준선 통과 개수 + 새 테스트 16개(PC-1~PC-9, CM-1~CM-4, FC-1~FC-3). 기존 실패 1개 외 실패는 0이어야 한다.
- esbuild 두 개 모두 오류 0이어야 한다(typecheck는 Edge Function을 제외한다).

# DEFINITION OF DONE
- [ ] PC-1~PC-9, CM-1~CM-4, FC-1~FC-3이 수정 전에 실패했고 수정 후 통과한다
- [ ] 기존 테스트 diff가 없고, 테스트 개수가 줄지 않았다
- [ ] `inferPersonCategory`, `looksLikeVoiceActorFavorite`, 절대값 조건(`>= 3`)이 코드에 없다
- [ ] `app/content/[id].tsx`·`CastSection.tsx`에 `isAnime ? "anilist" : "tmdb"` 직접 판정이 없고, `resolveCastMemberPerson`을 쓴다
- [ ] `typecheck`·`lint`·esbuild 통과
- [ ] 수동 확인 M-1~M-5는 배포 후 사람이 한다는 점과, 로컬에서 확인한 범위(또는 못 한 사유)를 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
supabase/functions/_shared/personCredits.ts
supabase/functions/_shared/personCredits.test.ts
supabase/functions/get-person-detail/index.ts
supabase/functions/_shared/types.ts
supabase/functions/_shared/externalContent.ts
src/types/content.ts
src/utils/peopleScreen.ts
src/utils/peopleScreen.test.ts
src/services/people.ts
src/hooks/usePeople.ts
app/content/[id].tsx
src/components/content/CastSection.tsx
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력(요약)
2. `npm test` before / after 통과 개수, `typecheck`·`lint`·esbuild 결과
3. 추가한 테스트 ID와 이름
4. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
5. 사람이 할 후속 작업:
   - `get-person-detail` 재배포
   - `get-content-detail` 재배포는 `docs/50` 순서(마이그레이션 0024 적용 후)를 따른다
   - 배포 후 堺雅人·阿部寛·吉岡里帆 상세를 한 번 열어 교정한다

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- TMDB 키 등 비밀 값을 출력하지 않는다. 로그인 대행 금지.
