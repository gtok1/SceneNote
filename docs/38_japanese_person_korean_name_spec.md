# 38. 일본 인물 한글 이름 채우기 명세

작성일: 2026-10-01
대상 브랜치 기준: `main` (`26e220e`) + **미커밋 구현**: `docs/36`(인물 탭), `docs/37`(프로필), 그리고 문서 없이 추가된 일본 이름 표기 작업(`src/utils/japaneseName.ts`(+test), `search-person-content`의 `fetchTmdbKoreanAlias`, `app/people/[id].tsx`의 `formatPersonName` 사용). 이 시점 `npm test` 786개 중 785개 통과 — 실패 1개는 무관한 기존 결함(12장)
선행 문서: `docs/34_search_seasons_and_people_restore_spec.md`(인물 기능), `docs/36_people_tab_saas_redesign_spec.md`(인물 카드·`toPersonSearchResult`), `docs/35_search_completeness_and_deploy_drift_spec.md`(배포 불일치), `docs/05_erd_rls.md`(RLS)

> **근거.** 사용자 캡처(좋아하는 인물 14명)에서 일본 인물 대부분은 "堺雅人(사카이 마사토)"처럼 한글 읽기가 붙고 "長瀬智也"만 일본어로만 보인다. 2026-10-01 TMDB·AniList를 읽기 전용으로 조회했다(13장 표).
> 사용자 요청: "한글명이 있고 없고 차이야. 없는 건 어떻게 한글명을 입력해야 할지를 고민해야 해."

---

## 1. 문제 정의

| ID | 증상 | 원인 |
|----|------|------|
| K-1 | 같은 일본 배우인데 한글 이름이 있는 사람과 없는 사람이 섞여 있다(長瀬智也만 일본어) | 한글 이름이 **TMDB 사용자 번역(ko-KR)에 의존**한다. 堺雅人·阿部寛·吉岡里帆·松本潤·戸田恵梨香는 TMDB에 ko-KR 이름 번역이 있어 검색 응답 `name`이 한글로 온다. 長瀬智也(TMDB 83660)는 ko-KR 번역도, `also_known_as` 한글 별칭도 없고 en-US 번역 "Tomoya Nagase"만 있다 |
| K-2 | 로마자가 있어도 TMDB 인물은 변환하지 않는다 | 클라이언트 `formatPersonName`이 AniList 로마자만 변환한다(`src/utils/japaneseName.ts` J-6: TMDB 미변환). 서버 `fetchTmdbKoreanAlias`는 `also_known_as`의 한글만 찾고 en-US 번역 이름은 보지 않는다(`search-person-content/index.ts`) |
| K-3 | 자동 변환 표기가 TMDB·AniList의 한글 표기와 다르다(예: 자동 "하나에 나쓰키" vs AniList 별칭 "하나에 나츠키", 자동 "마쓰모토" vs TMDB "마츠모토 준") | 변환기가 외래어 표기법(어두 예사소리·"쓰")을 따른다. TMDB 한국어 번역과 AniList 한글 별칭은 관용 표기(어두 거센소리·"츠")를 쓴다(13장) |
| K-4 | 등록해 둔 인물은 나중에 이름을 더 잘 찾게 되어도 바뀌지 않는다 | `favorite_people`는 등록 시점의 `name`·`original_name` 스냅샷이다(`supabase/migrations/0005_favorite_people.sql`). 갱신 경로가 없다 |
| K-5 | 끝내 한글 이름을 못 찾으면 사용자가 넣을 방법이 없다 | 한글 이름 입력 UI·저장 칸 없음 |
| K-6 | 자동 변환 이름인지 공식(번역) 이름인지 구분되지 않는다 | 출처 정보를 저장·표시하지 않음 |
| K-7 | 로마자 변환 오류: "Inoue"→"이노에", "Shin'ichi"→변환 실패 | `romajiToHangul`이 `ou`를 무조건 장음으로 줄이고, `n'`(발음 ん 표시)을 처리하지 않는다 |

---

## 2. 목표 동작

일본 인물(이름에 한자·가나가 있는 인물)의 한글 이름을 아래 **우선순위**로 정하고, 출처를 함께 저장·표시한다.

| 순위 | 출처 `name_ko_source` | 어디서 | 표시 |
|------|----------------------|--------|------|
| 1 | `user` | 사용자가 직접 입력(좋아하는 인물만) | 직접 입력 표시. 자동 갱신이 덮어쓰지 않음 |
| 2 | `tmdb` | TMDB ko-KR 이름 번역(검색·상세 `name`에 한글) | 공식(번역) 이름 |
| 3 | `alias` | TMDB `also_known_as` / AniList `name.alternative` 중 한글만 쓴 별칭 | 공식(번역) 이름 |
| 4 | `kana` | 별칭 중 **띄어 쓴 가나 읽기**(예: "まつもと じゅん") → 한글 변환 | 자동 표기 |
| 5 | `romaji` | TMDB en-US 이름 번역 / AniList `first`·`last` → 한글 변환 | 자동 표기 |
| 6 | `kana` | 띄어 쓰지 않은 가나 읽기 → 한글 변환 | 자동 표기 |
| — | 없음 | 위가 모두 없음 | 일본어만. 좋아하는 인물이면 "한글 이름 넣기" |

- 표시 형식은 지금과 같다: `日本語(한글)` 한 줄(예: "長瀬智也(나가세 토모야)").
- 한국·서양 인물은 대상이 아니다(지금 동작 유지).
- 이미 등록한 좋아하는 인물은 목록을 열 때 서버에 한 번 물어 채운다(최대 20명, 자동 표기는 30일 뒤 재확인).

---

## 3. 재현 시나리오

1. 웹 8081, 로그인 → 인물 탭 → "長瀬智也" 검색(또는 이미 등록된 長瀬智也 카드) → 한글 없이 "長瀬智也"만 → K-1.
2. 같은 화면의 "堺雅人(사카이 마사토)"와 비교.
3. AniList 성우 "花江夏樹" 카드 → "花江夏樹(하나에 나쓰키)"(AniList 별칭은 "하나에 나츠키") → K-3.
4. 長瀬智也 상세 → 한글 이름을 넣을 곳이 없다 → K-5.

---

## 4. 설계 결정

### D-1. 한글 이름 판정은 서버 공용 순수 모듈 하나가 한다
`supabase/functions/_shared/japaneseReading.ts`(신규)에 변환기(`romajiToHangul`, `kanaToHangul`)와 판정(`resolveKoreanName`)을 둔다. Deno와 Node 양쪽에서 쓰도록 Deno API·외부 import 없이 쓴다. 클라이언트 `src/utils/japaneseName.ts`는 이 모듈을 가져다 쓰고(이미 `src/utils/searchResultVisibility.ts`가 `_shared`를 import하는 선례) 자체 변환표를 지운다. 같은 규칙이 두 군데 생기지 않는다.

### D-2. 출처 우선순위는 2장 표 그대로
- `tmdb`·`alias`가 있으면 변환하지 않는다(사람이 쓴 표기가 우선).
- 가나 읽기는 한자 읽기를 직접 적은 것이라 로마자보다 정확하다. 단 띄어쓰기 없는 가나는 성·이름 경계를 몰라 로마자보다 뒤에 둔다.
- 로마자 이름 순서: TMDB en-US 이름은 "이름 성" 순서로 보고 뒤집는다. AniList는 `first`·`last` 필드로 순서를 확정한다(`${last} ${first}`, 뒤집지 않음).
- 한글 별칭은 한자·가나·라틴 문자가 섞이지 않은 것만 쓴다("마츠준 (MatsuJun)" 제외).

### D-3. 자동 변환은 관용 표기를 따른다
TMDB 한국어 번역·AniList 한글 별칭과 같은 방식으로 맞춘다(13장 근거).
- か·た행과 きゃ·ちゃ행은 위치와 관계없이 거센소리: 카·키·쿠·케·코, 타·치·츠·테·토, 캬·큐·쿄, 차·추·체·초.
- つ → 츠(어디서나), ち → 치.
- 장음 생략: `ō·ū` 등 장음 기호, `uu`, `oo`, `aa`, 그리고 **뒤에 모음이 오지 않는** `ou`(예: Satou→사토, Kondou→콘도, Inoue→이노우에 유지).
- っ → 앞 글자 ㅅ받침(캇파), ん → ㄴ받침. `n'`·`n’`는 ん(신이치).
- 변환할 수 없는 글자가 하나라도 있으면 `null`(엉터리 표기를 내지 않는다).
> 기존 미커밋 `japaneseName.test.ts` J-1·J-2의 기대값("하나에 나쓰키", "나가세 도모야", "마쓰모토 준", "사토 겐지", "곤도 류이치", "이치로 갓파", "시미즈 교코")은 **이 결정으로 바뀐다**(10장 R-1·R-2). assertion 완화가 아니라 표기 규칙 변경이다.

### D-4. 한글 이름과 출처를 좋아하는 인물 행에 저장한다
`favorite_people`에 `name_ko`, `name_ko_source`, `name_ko_checked_at` 세 칸을 추가한다(7장 SQL). 기존 `name`·`original_name`은 원본 스냅샷으로 두고 덮어쓰지 않는다. RLS는 기존 정책(본인 행 select/insert/update/delete)이 그대로 적용된다.

### D-5. 이미 등록한 인물은 목록을 열 때 서버에 물어 채운다
- 새 Edge Function `resolve-person-names`: 입력 `{ people: [{ source, external_id }] }`(1~20명), 출력 `{ results: [{ source, external_id, name_ko, name_ko_source }] }`. 로그인 필수. **DB에 쓰지 않는다**(쓰기는 클라이언트가 RLS 아래에서 본인 행에만).
- 대상(`selectFavoritesNeedingKoreanName`): 일본 인물이고, 표시 상태가 `missing`(없음) 또는 `estimated`(자동)이며, `name_ko_source`가 `user`가 아니고, `name_ko_checked_at`이 비었거나 30일 이상 지났을 때. 앞에서부터 20명.
- 결과 반영: 찾았으면 `name_ko`·`name_ko_source`·`name_ko_checked_at = now`, 못 찾았으면 `name_ko_checked_at = now`만. 업데이트 조건 `name_ko_source is null or in (kana, romaji)` — 직접 입력 행은 절대 덮지 않는다.
- 같은 세션에서 같은 대상 묶음은 한 번만 요청한다(TanStack Query `staleTime: Infinity`, `retry: false`).

### D-6. 검색·상세 응답에도 같은 필드를 싣는다
`search-person-content`와 `get-person-detail`이 인물마다 `name_ko`, `name_ko_source`를 돌려준다. 새로 등록할 때 이 값이 그대로 저장된다. TMDB 일본 인물(이름에 한글 없음)만 추가 조회 1회(`/person/{id}?language=ko-KR&append_to_response=translations`)를 한다. 미커밋 `fetchTmdbKoreanAlias`(같은 횟수의 추가 조회)를 이것으로 바꾼다. `name`은 TMDB ko-KR 이름 그대로 둔다(별칭을 `name`에 넣던 미커밋 변경을 되돌린다).

### D-7. 사용자는 인물 상세에서 한글 이름을 넣고 고칠 수 있다(좋아하는 인물만)
- 상세 이름 아래 한 줄: 상태별 안내 + 버튼(`koreanNameCaption`). 누르면 그 자리에서 입력칸·저장·취소. 직접 입력 상태에는 "자동 표기로 되돌리기"도 있다.
- 입력 검증(`normalizeKoreanNameInput`): 앞뒤 공백 제거·연속 공백 하나로, 한글 필수, 한자·가나 금지(일본어 표기는 이미 함께 보인다), 40자 이하.
- 저장: `name_ko = 입력값`, `name_ko_source = "user"`, `name_ko_checked_at = now`. 되돌리기: 세 칸 모두 `null` → 다음 목록 조회 때 D-5가 다시 채운다.
- 좋아하는 인물이 아니면 저장할 행이 없으므로 안내만("좋아하는 인물로 등록하면 한글 이름을 직접 넣을 수 있어요.").

### D-8. 화면에서는 출처를 조용히 알린다
- 카드·검색 행: 이름만 `日本語(한글)`로 표시(배지 추가 없음).
- 인물 탭 "내가 좋아하는 인물" 섹션: 한글 이름이 없는 인물이 있으면 머리 아래 한 줄 `한글 이름이 없는 인물 ${n}명은 인물 상세에서 이름을 넣을 수 있어요.`
- 상세: 자동 표기면 "일본어 읽기를 자동으로 옮긴 한글 표기예요.", 직접 입력이면 "직접 입력한 한글 이름이에요."

### D-9. 마이그레이션 전에 앱이 먼저 실행돼도 등록이 깨지지 않는다
웹 클라이언트는 로컬에서 바로 바뀌지만 마이그레이션은 사람이 적용한다. `addFavoritePerson`은 `name_ko`가 있을 때만 새 칸을 보내고, 응답 오류 코드가 `PGRST204`(컬럼 없음)이면 새 칸을 빼고 한 번 다시 보낸다. 백필·직접 입력 저장은 같은 오류면 조용히 건너뛴다(직접 입력은 오류 토스트).

### D-10. 판정·문구는 순수 함수, 테스트 파일은 RN·Supabase import 금지
`_shared/japaneseReading.ts`, `_shared/personNames.ts`, `src/utils/japaneseName.ts`, `src/utils/personKoreanName.ts`.

### D-11. 바꾸지 않는 것
인물 분류(배우/성우) 판정, 출연작 목록, 표시 형식 `日本語(한글)`, `docs/36` 카드 레이아웃, 다른 작품 메타데이터.

---

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 외부 번역 API(Papago 등)로 한자 이름 번역 | 새 외부 키·비용·개인정보 경로가 생긴다. 이름은 번역이 아니라 읽기라서 번역기가 오역하기 쉽다(한자 음독 "장뢰지야" 등) |
| 한자 → 한국 한자음(長瀬智也 → 장뢰지야) | 한국에서 일본인 이름을 그렇게 부르지 않는다 |
| 사전(일본 성씨·이름 읽기 사전) 내장 | 같은 한자에 읽기가 여럿이라 정확도가 낮고 데이터가 크다. TMDB·AniList가 주는 로마자·가나가 더 정확하다 |
| 외래어 표기법(나쓰키·마쓰모토·도모야) 유지 | 앱 안의 다른 이름 대부분(TMDB 번역)이 관용 표기라 한 화면에서 표기가 섞인다(K-3) |
| 변환 결과를 `name`에 덮어쓰기 | 원본을 잃고, 직접 입력·자동·공식을 구분할 수 없어 재확인·덮어쓰기 방지가 불가능하다(D-4) |
| 클라이언트에서 TMDB 직접 호출 | API 키 노출 금지(CLAUDE.md) |
| 백필을 Edge Function이 DB에 직접 쓰기 | service role로 사용자 행을 써야 한다. 클라이언트가 RLS 아래 본인 행만 쓰는 편이 안전하다 |
| 백필을 `get-person-detail` 재사용으로 | 출연작까지 조회해 무겁고 한 명씩만 된다 |
| 모든 인물(한국·서양 포함)에 한글 이름 칸 사용 | 요청 범위 밖. 한국 인물은 이미 한글, 서양 인물은 TMDB 번역이 대부분 있다 |

---

## 6. 계약

### 6.1 `supabase/functions/_shared/japaneseReading.ts` (신규, 순수)

```ts
export type KoreanNameSource = "user" | "tmdb" | "alias" | "kana" | "romaji";
export type RomajiOrder = "given-family" | "family-given";

export function hasHangul(value: string | null | undefined): boolean;          // /[가-힣]/
export function hasJapaneseScript(value: string | null | undefined): boolean;  // 히라가나·가타카나·CJK 한자
export function isKanaOnly(value: string): boolean;   // 히라가나·가타카나·ー·・·공백만, 가나 1자 이상
export function hasLatin(value: string): boolean;     // /[A-Za-z]/

export function romajiToHangul(romaji: string, order: RomajiOrder): string | null;
// 1) 소문자, 장음 기호 ā ī ū ē ō → 모음, 아포스트로피 ’ → '
// 2) 장음 생략: uu→u, oo→o, aa→a, ou(뒤가 모음이 아닐 때)→o. ii·ei는 유지
// 3) [a-z' -] 외 문자 제거 후 공백·하이픈으로 토큰 분리. 토큰 0개 → null
// 4) 토큰마다 변환(D-3 관용 표기). 하나라도 실패 → null
// 5) order === "given-family"이고 토큰이 정확히 2개면 순서를 뒤집는다. 공백으로 join
export function kanaToHangul(kana: string): string | null;
// isKanaOnly가 아니면 null. 가타카나→히라가나, ・와 공백은 토큰 구분, ー는 삭제
// 헵번식 로마자로 바꾼 뒤(ん 다음 모음·y면 "n'", っ는 다음 자음 겹침) romajiToHangul(…, "family-given")

export interface KoreanNameInput {
  nativeName: string | null;                       // 일본어 표기(한자/가나)
  localizedName?: string | null;                   // TMDB ko-KR 이름(번역 없으면 원어 그대로)
  aliases?: readonly string[];                     // TMDB also_known_as / AniList name.alternative
  romaji?: { text: string; order: RomajiOrder } | null;
}
export function resolveKoreanName(input: KoreanNameInput): { nameKo: string; source: Exclude<KoreanNameSource, "user"> } | null;
// 0) nativeName·localizedName 어느 것에도 일본어 문자가 없으면 null(일본 인물 아님)
// 1) localizedName이 한글을 포함하고 일본어 문자가 없으면 { trim, "tmdb" }
// 2) aliases 중 한글 포함 && 일본어 문자 없음 && 라틴 없음인 첫 항목 → { trim, "alias" }
// 3) aliases 중 isKanaOnly && 공백/・ 포함인 첫 항목의 kanaToHangul가 값이면 → "kana"
// 4) romaji의 romajiToHangul가 값이면 → "romaji"
// 5) aliases 중 isKanaOnly(공백 없음)인 첫 항목의 kanaToHangul가 값이면 → "kana"
// 6) null
```

### 6.2 `supabase/functions/_shared/personNames.ts` (신규, 순수 어댑터)

```ts
import type { KoreanNameInput } from "./japaneseReading.ts";

export interface TmdbPersonNameDetail {
  name?: string | null;                 // ko-KR 요청 결과
  also_known_as?: string[] | null;
  translations?: { translations?: { iso_639_1?: string; iso_3166_1?: string; data?: { name?: string | null } | null }[] } | null;
}
export function tmdbKoreanNameInput(detail: TmdbPersonNameDetail): KoreanNameInput;
// localizedName = name?.trim() || null
// nativeName = ja 번역 name(비어 있지 않으면) → aliases 중 CJK 한자를 포함하고 한글 없는 첫 항목 → aliases 중 일본어 문자 있는 첫 항목 → localizedName(일본어 문자 있으면) → null
// aliases = also_known_as(trim, 빈 값 제거), 없으면 []
// romaji = en 번역 name이 라틴이면 { text, "given-family" }, 아니면 null

export interface AniListStaffName { first?: string | null; last?: string | null; full?: string | null; native?: string | null; alternative?: (string | null)[] | null }
export function anilistKoreanNameInput(name: AniListStaffName | null | undefined): KoreanNameInput;
// nativeName = native?.trim() || null; localizedName = null; aliases = alternative(trim, 빈 값 제거)
// romaji = first·last 둘 다 있으면 { `${last} ${first}`, "family-given" }, 아니면 full 있으면 { full, "given-family" }, 아니면 null
```

### 6.3 Edge Function 응답 필드 (`search-person-content`, `get-person-detail`)

```ts
interface PersonResult {            // 기존 + 두 칸
  …
  name_ko: string | null;
  name_ko_source: "tmdb" | "alias" | "kana" | "romaji" | null;
}
```
- `search-person-content` TMDB: `name`에 한글이 있으면 추가 조회 없이 `resolveKoreanName({ nativeName: original_name, localizedName: name })`. 한글이 없고 `name`·`original_name`에 일본어 문자가 있으면 `/person/{id}?language=ko-KR&append_to_response=translations` 1회 → `resolveKoreanName(tmdbKoreanNameInput(detail))`. 조회 실패는 `name_ko: null`(검색은 계속). `name`은 TMDB `person.name` 그대로, `original_name`은 `person.original_name?.trim() || null`(미커밋 변경 되돌림). 미커밋 `isUntranslatedJapaneseName`·`fetchTmdbKoreanAlias` 삭제.
- `search-person-content` AniList: `STAFF_QUERY`의 `name { full native }` → `name { first last full native alternative }`. `resolveKoreanName(anilistKoreanNameInput(person.name))`. `name`·`original_name` 규칙 그대로.
- `get-person-detail` TMDB: `append_to_response`를 `"combined_credits,translations"`로. `resolveKoreanName(tmdbKoreanNameInput(detail))`.
- `get-person-detail` AniList: Staff 쿼리 이름에 `first last` 추가. 기존 `koreanFallback?.name`이 한글이면 `{ name_ko: 그 값, name_ko_source: "tmdb" }`, 아니면 `resolveKoreanName(anilistKoreanNameInput(staff.name))`.
- 응답 `PersonDetail`에도 `name_ko`, `name_ko_source`.

### 6.4 새 Edge Function `supabase/functions/resolve-person-names/index.ts`

```
POST (로그인 필수: requireUser, 실패 401)
body: { people: { source: "tmdb" | "anilist"; external_id: string }[] }
  - 배열 아님·0개·21개 이상 → 400 INVALID_REQUEST
  - source가 둘 중 하나가 아니거나 external_id가 /^\d{1,10}$/가 아니면 400
  - 같은 source:external_id 중복은 하나로
200: { results: { source; external_id; name_ko: string | null; name_ko_source: "tmdb" | "alias" | "kana" | "romaji" | null }[] }  (입력 순서, 중복 제거 후)
  - TMDB: GET /person/{id}?language=ko-KR&append_to_response=translations → resolveKoreanName(tmdbKoreanNameInput(detail))
  - AniList: query { Staff(id) { name { first last full native alternative } } } → resolveKoreanName(anilistKoreanNameInput(name))
  - 동시 4개. 한 명 실패는 그 사람만 { name_ko: null, name_ko_source: null }
  - DB 읽기·쓰기 없음. TMDB_API_KEY는 서버 env, 응답·로그에 쓰지 않음
```
CORS·`OPTIONS`·405 처리는 `search-person-content`와 같은 방식(`_shared/http.ts`). `fetchJson`·`applyTmdbAuth`는 기존 함수들처럼 파일 안에 둔다. `package.json`의 `backend:deploy` 목록에 `resolve-person-names`를 추가한다(실행은 하지 않는다).

### 6.5 클라이언트 타입 (`src/types/people.ts`)

```ts
export type KoreanNameSource = "user" | "tmdb" | "alias" | "kana" | "romaji";
export interface PersonSearchResult { …기존; name_ko?: string | null; name_ko_source?: KoreanNameSource | null }
export interface PersonDetail       { …기존; name_ko?: string | null; name_ko_source?: KoreanNameSource | null }
export interface FavoritePerson extends PersonSearchResult { …기존; name_ko_checked_at?: string | null }
```

### 6.6 `src/utils/japaneseName.ts` (수정)

```ts
export { hasHangul, hasJapaneseScript, romajiToHangul } from "../../supabase/functions/_shared/japaneseReading";
export type PersonReadingStatus = "not_applicable" | "provided" | "estimated" | "user" | "missing";
export interface FormattedPersonName {
  name: string; secondaryName: string | null;
  readingStatus: PersonReadingStatus; koreanName: string | null; nativeName: string | null;
}
export function formatPersonName(person: {
  source: "tmdb" | "anilist"; name: string; original_name: string | null;
  name_ko?: string | null; name_ko_source?: KoreanNameSource | null;
}): FormattedPersonName;
// candidates = [name.trim(), original_name?.trim()] 중 빈 값 제외
// japanese = 일본어 문자 있고 한글 없는 첫 후보. 없으면 →
//   { name, secondaryName: original이 있고 name과 다르면 original, readingStatus: "not_applicable", koreanName: null, nativeName: null }
// nameKo = name_ko?.trim()이 한글을 포함하면 그 값, 아니면 없음
// 1) nameKo 있음 → { `${japanese}(${nameKo})`, null, status, nameKo, japanese }
//      status: source "user" → "user", "kana"|"romaji" → "estimated", 그 외(tmdb·alias·null) → "provided"
// 2) 후보 중 한글 포함 값 → { `${japanese}(${그 값})`, null, "provided", 그 값, japanese }
// 3) source === "anilist"이고 라틴 후보의 romajiToHangul(…, "given-family")가 값 → { …, "estimated", 변환값, japanese }
// 4) { japanese, 라틴 후보 ?? null, "missing", null, japanese }
```
기존 자체 변환표·`convertToken` 등은 삭제한다(`_shared` 사용).

### 6.7 `src/utils/personKoreanName.ts` (신규, 순수)

```ts
export const KOREAN_NAME_MAX_LENGTH = 40;
export const KOREAN_NAME_RECHECK_DAYS = 30;
export const KOREAN_NAME_RESOLVE_BATCH = 20;

export function normalizeKoreanNameInput(value: string): { ok: true; value: string } | { ok: false; message: string };
// trim + 연속 공백 → 공백 하나
// 빈 값 → "한글 이름을 입력해 주세요."
// 일본어 문자 포함 → "일본어 표기는 빼고 한글로만 입력해 주세요."
// 한글 없음 → "한글이 들어간 이름을 입력해 주세요."
// 길이 > 40 → "40자 이하로 입력해 주세요."   (판정 순서 그대로)

export function koreanNameCaption(status: PersonReadingStatus, favorited: boolean): { caption: string | null; actionLabel: string | null };
// not_applicable → { null, null }
// provided  → { null, favorited ? "한글 이름 고치기" : null }
// estimated → { "일본어 읽기를 자동으로 옮긴 한글 표기예요.", favorited ? "고치기" : null }
// user      → { "직접 입력한 한글 이름이에요.", favorited ? "고치기" : null }
// missing   → favorited ? { "한글 이름이 아직 없어요.", "한글 이름 넣기" } : { "좋아하는 인물로 등록하면 한글 이름을 직접 넣을 수 있어요.", null }

export function selectFavoritesNeedingKoreanName<T extends FavoritePerson>(favorites: readonly T[], now: Date): T[];
// formatPersonName(f).readingStatus가 "missing" 또는 "estimated"
// && f.name_ko_source !== "user"
// && (f.name_ko_checked_at 없음 || now - checked_at >= 30일)
// 입력 순서, 앞에서 KOREAN_NAME_RESOLVE_BATCH명

export function missingKoreanNameNotice(favorites: readonly FavoritePerson[]): string | null;
// missing 개수 0 → null, 아니면 `한글 이름이 없는 인물 ${n}명은 인물 상세에서 이름을 넣을 수 있어요.`

export function pickKoreanName(
  detail: Pick<PersonDetail, "name_ko" | "name_ko_source"> | null | undefined,
  favorite: Pick<FavoritePerson, "name_ko" | "name_ko_source"> | null | undefined
): { name_ko: string | null; name_ko_source: KoreanNameSource | null };
// favorite.name_ko_source === "user" && favorite.name_ko → favorite 값
// detail.name_ko → detail 값
// favorite.name_ko → favorite 값
// 그 외 { null, null }
```

### 6.8 서비스·훅

`src/services/people.ts`
```ts
export async function resolvePersonNames(people: Pick<PersonSearchResult, "source" | "external_id">[]): Promise<{ source; external_id; name_ko: string | null; name_ko_source: Exclude<KoreanNameSource, "user"> | null }[]>;
// supabase.functions.invoke("resolve-person-names", { body: { people } }), 오류 throw
export async function applyResolvedKoreanName(id: string, resolved: { name_ko: string | null; name_ko_source: … | null }): Promise<void>;
// update favorite_people set name_ko_checked_at = now(ISO) + (name_ko 있으면 name_ko·name_ko_source)
//   .eq("id", id).or("name_ko_source.is.null,name_ko_source.in.(kana,romaji)")
// 오류 code PGRST204면 조용히 반환, 그 외 throw
export async function setFavoriteKoreanName(id: string, nameKo: string | null): Promise<void>;
// nameKo 있음 → { name_ko: nameKo, name_ko_source: "user", name_ko_checked_at: now }
// null → { name_ko: null, name_ko_source: null, name_ko_checked_at: null }
// 오류 throw
```
`addFavoritePerson`: upsert 행에 `person.name_ko`가 있을 때만 `name_ko`, `name_ko_source`, `name_ko_checked_at: now`를 넣는다. 오류 `code === "PGRST204"`이면 세 칸을 빼고 한 번 재시도.

`src/hooks/usePeople.ts`
```ts
export function useFavoriteKoreanNameBackfill(favorites: FavoritePerson[] | undefined): void;
// candidates = selectFavoritesNeedingKoreanName(favorites ?? [], new Date())
// useQuery({ queryKey: ["favorite-korean-names", userId, candidates.map(personKey).join(",")],
//   enabled: PEOPLE_FEATURES_ENABLED && Boolean(user) && candidates.length > 0, staleTime: Infinity, retry: false,
//   queryFn: async () => { results = await resolvePersonNames(candidates); 각 후보에 applyResolvedKoreanName(행 id, 결과);
//                          await queryClient.invalidateQueries({ queryKey: ["favorite-people", user.id] }); return results.length } })
export function useSetFavoriteKoreanName(); // mutation(id, nameKo | null) → setFavoriteKoreanName, onSuccess는 favorite-people invalidate Promise 반환
```

### 6.9 화면

- `app/(tabs)/people.tsx`: `useFavoriteKoreanNameBackfill(favorites.data)` 호출. 좋아하는 인물 섹션 머리 아래, 목록을 그릴 때 `missingKoreanNameNotice(favorites.data ?? [])`가 있으면 한 줄(`typography.caption`, `colors.textMuted`).
- `src/utils/peopleScreen.ts`: `toPersonSearchResult`가 입력에 `name_ko`가 정의되어 있으면 `name_ko`, `name_ko_source`(없으면 null)도 복사. 그 외 동작 그대로(기존 P-13 무수정 통과).
- `app/people/[id].tsx`: `favorite = useFavoritePeople().data?.find(personKey 일치)`. 표시 이름 = `formatPersonName({ source, name, original_name: native_name ?? original_name, ...pickKoreanName(detail, favorite) })`. 이름 줄 아래 `KoreanNameEditor`.
- `src/components/people/KoreanNameEditor.tsx`(신규): props `{ status: PersonReadingStatus; favorited: boolean; currentKoreanName: string | null; saving: boolean; onSave: (value: string) => void; onReset: () => void }`. `koreanNameCaption` 결과를 보여주고, `actionLabel`을 누르면 입력칸(높이 44, `placeholder "예: 나가세 토모야"`, `accessibilityLabel "한글 이름"`, `maxLength 40`, 현재 값으로 채움) + "저장"(primary 알약 44) + "취소"(`surfaceMuted` 알약 44) + 상태가 `user`면 "자동 표기로 되돌리기"(텍스트 버튼, `minHeight: 44`). 저장 전 `normalizeKoreanNameInput`, 실패 문구는 입력칸 아래 `colors.danger` `typography.caption`. 토큰만 사용(16진 색·`fontWeight` 숫자 금지).
- 상세 저장 성공: 토스트 `한글 이름을 저장했어요.`(success). 실패: `한글 이름을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.`(error). 되돌리기 성공: `자동 표기로 되돌렸어요.`(info).
- `app/search.tsx`: 인물 행 표시 이름·접근성 라벨·등록 토스트(368·670·676행 부근)의 `person.name`을 `formatPersonName(person).name`으로.

---

## 7. 데이터 모델 / SQL

`supabase/migrations/0023_favorite_people_korean_name.sql` (신규, **사람이 적용**)

```sql
-- docs/38: 일본 인물 한글 이름과 출처. 원본 name/original_name은 그대로 둔다.
ALTER TABLE favorite_people
  ADD COLUMN IF NOT EXISTS name_ko TEXT,
  ADD COLUMN IF NOT EXISTS name_ko_source TEXT,
  ADD COLUMN IF NOT EXISTS name_ko_checked_at TIMESTAMPTZ;

ALTER TABLE favorite_people
  DROP CONSTRAINT IF EXISTS favorite_people_name_ko_source_check,
  ADD CONSTRAINT favorite_people_name_ko_source_check
    CHECK (name_ko_source IS NULL OR name_ko_source IN ('user', 'tmdb', 'alias', 'kana', 'romaji'));

ALTER TABLE favorite_people
  DROP CONSTRAINT IF EXISTS favorite_people_name_ko_length_check,
  ADD CONSTRAINT favorite_people_name_ko_length_check
    CHECK (name_ko IS NULL OR char_length(name_ko) BETWEEN 1 AND 40);

ALTER TABLE favorite_people
  DROP CONSTRAINT IF EXISTS favorite_people_name_ko_pair_check,
  ADD CONSTRAINT favorite_people_name_ko_pair_check
    CHECK ((name_ko IS NULL) = (name_ko_source IS NULL));
```
RLS·트리거·인덱스 변경 없음(기존 본인 행 정책이 새 칸에도 적용).

---

## 8. 화면 명세

6.9 참고. 인물 상세 이름 영역 예:
```
長瀬智也(나가세 토모야)  [배우]
Tomoya Nagase                                   ← secondaryName(있을 때, 기존)
일본어 읽기를 자동으로 옮긴 한글 표기예요.  고치기   ← KoreanNameEditor
```
편집 중:
```
[ 나가세 토모야            ]  [저장] [취소]
                              자동 표기로 되돌리기   ← 직접 입력 상태일 때만
한글이 들어간 이름을 입력해 주세요.                   ← 검증 실패 시
```

---

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | TMDB ko-KR 번역 있음(堺雅人) | 추가 조회 없이 `tmdb` | R-7a, 수동 M-1 |
| E-2 | 번역·한글 별칭 없음, en-US 로마자만(長瀬智也) | "나가세 토모야", `romaji`, 자동 안내 | R-7b, N-1 |
| E-3 | AniList 한글 별칭(花江夏樹 "하나에 나츠키") | `alias` | R-7c, N-3 |
| E-4 | 띄어 쓴 가나 별칭 + 로마자 | 가나 우선 | R-7d |
| E-5 | 붙여 쓴 가나만 + 로마자 | 로마자 우선, 로마자 없으면 가나 | R-7e |
| E-6 | 한국·서양 인물 | 대상 아님 | R-7f, J-6 |
| E-7 | 일본 인물인데 아무 단서 없음 | 일본어만, 상세에 "한글 이름 넣기"(좋아하는 인물) | R-7g, J-7, C-1 |
| E-8 | 한글 별칭에 라틴·일본어 섞임 | 건너뜀 | R-7h |
| E-9 | 변환 불가 로마자 | null | R-3, R-4, R-7i |
| E-10 | Inoue / Satou / Shin'ichi | 이노우에 / 사토 / 신이치 | R-2 |
| E-11 | 직접 입력 후 자동 백필 | 덮지 않음 | S-1d, 수동 M-4 |
| E-12 | 자동 표기 30일 지남 | 재확인(번역 생겼으면 `tmdb`로 승격) | S-1c |
| E-13 | 못 찾음 | `checked_at`만 기록, 30일 동안 재요청 없음 | S-1b, 수동 M-3 |
| E-14 | 좋아하는 인물 21명 이상 미해결 | 앞 20명만, 다음 조회에서 나머지 | S-2 |
| E-15 | 마이그레이션 전 실행 | 등록 정상(재시도), 백필 조용히 건너뜀 | 수동 M-6 |
| E-16 | 입력 검증 | 빈 값·일본어·한글 없음·40자 초과 문구 | V-1 |
| E-17 | 되돌리기 | 세 칸 null → 다음 조회 때 자동 채움 | 수동 M-4 |
| E-18 | 좋아하는 인물 아님 | 상세에 안내만, 입력 불가 | C-1 |
| E-19 | `resolve-person-names` 잘못된 입력 | 400 | 수동 M-5(배포 후) |
| E-20 | TMDB 조회 일부 실패 | 그 사람만 null, 검색·백필 계속 | 수동 M-5 |
| E-21 | 상세 응답과 좋아하는 행 값이 다름 | 직접 입력 > 상세 > 행 | P-1 |
| E-22 | 기존 행(name에 한글, name_ko 없음) | 그대로 `provided` 표시, 백필 대상 아님 | J-1, S-1e |

---

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 한 행 = `it` 하나(행 안 입력이 여럿이면 한 `it`에서 모두 assert).

### `supabase/functions/_shared/japaneseReading.test.ts` (신규)

| ID | 입력 | 기대 |
|----|------|------|
| R-1 | `romajiToHangul(x, "given-family")`: "Natsuki Hanae", "Tomoya Nagase", "Masato Sakai", "Shun Oguri", "Jun Matsumoto", "Erika Toda", "Hiroshi Abe", "Riho Yoshioka", "Nana Mizuki", "Megumi Hayashibara" | "하나에 나츠키", "나가세 토모야", "사카이 마사토", "오구리 슌", "마츠모토 준", "토다 에리카", "아베 히로시", "요시오카 리호", "미즈키 나나", "하야시바라 메구미" |
| R-2 | given-family: "Kenji Satou", "Ryuuichi Kondō", "Kappa Ichiro", "Kyoko Shimizu", "Shouta Sometani", "Masahiro Inoue", "Shin'ichi Okada" | "사토 켄지", "콘도 류이치", "이치로 캇파", "시미즈 쿄코", "소메타니 쇼타", "이노우에 마사히로", "오카다 신이치" |
| R-3 | `("Matsumoto Jun", "family-given")`, `("Kanna", "given-family")`, `("Gackt", "given-family")` | "마츠모토 준", "칸나", `null` |
| R-4 | `""`, `"  "`, `"Xyz Qw"` (given-family) | 모두 `null` |
| R-5 | `kanaToHangul`: "さかい まさと", "まつもと じゅん", "ながせ ともや", "こんどう けんじ", "いのうえ", "ハナエ・ナツキ", "きっかわ", "しんいち", "ゆうき", "堺 まさと" | "사카이 마사토", "마츠모토 준", "나가세 토모야", "콘도 켄지", "이노우에", "하나에 나츠키", "킷카와", "신이치", "유키", `null` |
| R-6 | `hasHangul("사카이")`, `hasHangul("堺")`, `hasJapaneseScript("堺雅人")`, `hasJapaneseScript("まさと")`, `hasJapaneseScript("Masato")`, `isKanaOnly("まつもと じゅん")`, `isKanaOnly("松本 潤")`, `isKanaOnly("")` | true, false, true, true, false, true, false, false |
| R-7 | `resolveKoreanName` a) `{ nativeName: "堺雅人", localizedName: "사카이 마사토", aliases: ["さかい まさと"], romaji: { text: "Masato Sakai", order: "given-family" } }` b) `{ "長瀬智也", "長瀬智也", [], { "Tomoya Nagase", "given-family" } }` c) `{ "花江夏樹", null, ["Peroperonchino (ペロペロンチーノ)", "Haruki Matsuda (松田春樹)", "Hana-chan", "하나에 나츠키"], { "Hanae Natsuki", "family-given" } }` d) `{ "松本潤", "松本潤", ["松本 潤", "まつもと じゅん", "MatsuJun"], { "Jun Matsumoto", "given-family" } }` e) `{ "松本潤", "松本潤", ["まつもとじゅん"], { "Jun Matsumoto", "given-family" } }` 그리고 같은 입력 romaji null f) `{ "정소민", "정소민" }`, `{ "Tom Cruise", "톰 크루즈" }` g) `{ "長瀬智也", null, [], null }` h) `{ "松本潤", "松本潤", ["마츠준 (MatsuJun)", "松潤", "마츠모토 준"], null }` i) `{ "長瀬智也", "長瀬智也", [], { "Gackt", "given-family" } }` | a) `{ nameKo: "사카이 마사토", source: "tmdb" }` b) `{ "나가세 토모야", "romaji" }` c) `{ "하나에 나츠키", "alias" }` d) `{ "마츠모토 준", "kana" }` e) `{ "마츠모토 준", "romaji" }` / `{ "마츠모토준", "kana" }` f) `null`, `null` g) `null` h) `{ "마츠모토 준", "alias" }` i) `null` |

### `supabase/functions/_shared/personNames.test.ts` (신규)

| ID | 입력 | 기대 |
|----|------|------|
| N-1 | `tmdbKoreanNameInput({ name: "長瀬智也", also_known_as: [], translations: { translations: [{ iso_639_1: "en", iso_3166_1: "US", data: { name: "Tomoya Nagase" } }, { iso_639_1: "ja", iso_3166_1: "JP", data: { name: "長瀬智也" } }] } })` | `{ nativeName: "長瀬智也", localizedName: "長瀬智也", aliases: [], romaji: { text: "Tomoya Nagase", order: "given-family" } }` |
| N-2 | `{ name: "사카이 마사토", also_known_as: ["Сакаи Масато", "さかい まさと", "堺 雅人", " "], translations: { translations: [] } }` | `{ nativeName: "堺 雅人", localizedName: "사카이 마사토", aliases: ["Сакаи Масато", "さかい まさと", "堺 雅人"], romaji: null }` |
| N-3 | `anilistKoreanNameInput({ first: "Natsuki", last: "Hanae", full: "Natsuki Hanae", native: "花江夏樹", alternative: ["Hana-chan", null, "하나에 나츠키"] })` | `{ nativeName: "花江夏樹", localizedName: null, aliases: ["Hana-chan", "하나에 나츠키"], romaji: { text: "Hanae Natsuki", order: "family-given" } }` |
| N-4 | `anilistKoreanNameInput({ full: "Nana Mizuki", native: "水樹奈々" })`, `(null)` | romaji `{ "Nana Mizuki", "given-family" }` / `{ nativeName: null, localizedName: null, aliases: [], romaji: null }` |
| N-5 | `tmdbKoreanNameInput({ name: null })`, `({ name: "長瀬智也", also_known_as: null, translations: null })` | `{ nativeName: null, localizedName: null, aliases: [], romaji: null }` / `{ nativeName: "長瀬智也", localizedName: "長瀬智也", aliases: [], romaji: null }` |

### `src/utils/japaneseName.test.ts` (기존 J-1~J-8을 아래로 교체)

| ID | 입력 (`formatPersonName`) | 기대 `{ name, secondaryName, readingStatus, koreanName, nativeName }` |
|----|------|------|
| J-1 | `{ tmdb, name: "사카이 마사토", original_name: "堺雅人" }`, 그리고 name·original 뒤바꾼 입력 | 둘 다 `{ "堺雅人(사카이 마사토)", null, "provided", "사카이 마사토", "堺雅人" }` |
| J-2 | `{ tmdb, "長瀬智也", "長瀬智也", name_ko: "나가세 토모야", name_ko_source: "romaji" }` | `{ "長瀬智也(나가세 토모야)", null, "estimated", "나가세 토모야", "長瀬智也" }` |
| J-3 | `{ tmdb, "마츠모토 준", "松本潤", name_ko: "마쓰모토 준", name_ko_source: "user" }` | `{ "松本潤(마쓰모토 준)", null, "user", "마쓰모토 준", "松本潤" }` |
| J-4 | `{ anilist, "花江夏樹", "Natsuki Hanae" }` | `{ "花江夏樹(하나에 나츠키)", null, "estimated", "하나에 나츠키", "花江夏樹" }` |
| J-5 | `{ tmdb, "長瀬智也", "Tomoya Nagase" }` | `{ "長瀬智也", "Tomoya Nagase", "missing", null, "長瀬智也" }` |
| J-6 | `{ tmdb, "정소민", "Jung So-min" }`, `{ tmdb, "정소민", null }` | `{ "정소민", "Jung So-min", "not_applicable", null, null }`, `{ "정소민", null, "not_applicable", null, null }` |
| J-7 | `{ tmdb, "長瀬智也", "長瀬智也" }` | `{ "長瀬智也", null, "missing", null, "長瀬智也" }` |
| J-8 | J-7 입력 + `name_ko: "  ", name_ko_source: "romaji"`, 그리고 `name_ko: "Tomoya", name_ko_source: "romaji"` | 둘 다 J-7과 같음 |
| J-9 | `{ tmdb, "長瀬智也", null, name_ko: "나가세 토모야", name_ko_source: "alias" }`, 같은 입력 source `"tmdb"` | 둘 다 readingStatus `"provided"` |

### `src/utils/personKoreanName.test.ts` (신규)

| ID | 입력 | 기대 |
|----|------|------|
| V-1 | `normalizeKoreanNameInput`: "  나가세   토모야 ", "", "   ", "長瀬 토모야", "Tomoya", "가"×40, "가"×41 | ok "나가세 토모야"; "한글 이름을 입력해 주세요."; 같은 문구; "일본어 표기는 빼고 한글로만 입력해 주세요."; "한글이 들어간 이름을 입력해 주세요."; ok "가"×40; "40자 이하로 입력해 주세요." |
| C-1 | `koreanNameCaption`의 5개 상태 × favorited true/false (10조합) | 6.7 표 그대로 |
| S-1 | `selectFavoritesNeedingKoreanName(rows, new Date("2026-10-01T12:00:00Z"))`, rows: a) 長瀬智也 name_ko 없음, checked null b) 같은 인물 다른 id, name_ko 없음, checked 2026-09-25 c) name_ko "나가세 토모야"/romaji, checked 2026-08-01 d) name_ko "마쓰모토 준"/user, checked null e) name "사카이 마사토"·original "堺雅人", name_ko 없음 f) 정소민 g) anilist "花江夏樹"/"Natsuki Hanae", name_ko 없음, checked null h) name_ko "나가세 토모야"/romaji, checked 2026-09-30 | `[a, c, g]`(입력 순서) |
| S-2 | missing 행 25개(checked null) | 앞 20개 |
| S-3 | 상수 | `KOREAN_NAME_MAX_LENGTH === 40`, `KOREAN_NAME_RECHECK_DAYS === 30`, `KOREAN_NAME_RESOLVE_BATCH === 20` |
| M-1 | `missingKoreanNameNotice`: missing 0명(S-1의 c·e·f), missing 3명 | `null`, `"한글 이름이 없는 인물 3명은 인물 상세에서 이름을 넣을 수 있어요."` |
| P-1 | `pickKoreanName`: ① detail `{ "나가세 토모야", "romaji" }`, favorite `{ "나가세 도모야", "user" }` ② detail `{ "나가세 토모야", "romaji" }`, favorite `{ null, null }` ③ detail `{ null, null }`, favorite `{ "나가세 토모야", "romaji" }` ④ 둘 다 undefined | ① favorite 값 ② detail 값 ③ favorite 값 ④ `{ name_ko: null, name_ko_source: null }` |

### `src/utils/peopleScreen.test.ts` (수정)

| ID | 변경 |
|----|------|
| P-4 | 기대값의 "하나에 나쓰키" 두 곳을 "하나에 나츠키"로(D-3 표기 규칙 변경). 그 외 그대로 |
| P-19 (신규) | `toPersonSearchResult`(FavoritePerson + `name_ko: "나가세 토모야", name_ko_source: "romaji", name_ko_checked_at: "2026-10-01T00:00:00Z"`) → 기존 7개 필드 + `name_ko: "나가세 토모야", name_ko_source: "romaji"`, `"name_ko_checked_at" in result === false` |

기존 P-13은 수정 없이 통과해야 한다.

### 수동 확인 (배포·마이그레이션 후, 로그인 상태 — 사람)

| ID | 확인 |
|----|------|
| M-1 | 인물 탭 "堺雅人" 검색 → "堺雅人(사카이 마사토)", 상세에 안내 없음 |
| M-2 | "長瀬智也" 검색 → "長瀬智也(나가세 토모야)", 상세에 자동 표기 안내 |
| M-3 | 등록돼 있던 長瀬智也 카드가 목록 재조회 후 한글로 바뀜. 새로고침해도 `resolve-person-names` 재요청 없음(30일) |
| M-4 | 상세 "고치기" → "나가세 토모야" 저장 → 카드 반영, 안내 "직접 입력한 한글 이름이에요." → 되돌리기 → 자동 표기 복귀 |
| M-5 | `resolve-person-names`에 21명·잘못된 id → 400. TMDB 일부 실패 시 나머지 정상 |
| M-6 | 마이그레이션 적용 **전** 웹에서 일본 배우 등록 → 정상 등록 |
| M-7 | 검색 탭 인물 행도 같은 표기 |

---

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/japaneseReading.ts` (+`.test.ts`) | 신규. 6.1 |
| `supabase/functions/_shared/personNames.ts` (+`.test.ts`) | 신규. 6.2 |
| `supabase/functions/search-person-content/index.ts` | 6.3. 미커밋 `fetchTmdbKoreanAlias` 대체 |
| `supabase/functions/get-person-detail/index.ts` | 6.3 |
| `supabase/functions/resolve-person-names/index.ts` | 신규. 6.4 |
| `supabase/migrations/0023_favorite_people_korean_name.sql` | 신규. 7장 |
| `package.json` | `backend:deploy`에 `resolve-person-names` 추가 |
| `src/types/people.ts` | 6.5 |
| `src/utils/japaneseName.ts` (+`.test.ts`) | 6.6, J 표로 교체 |
| `src/utils/personKoreanName.ts` (+`.test.ts`) | 신규. 6.7 |
| `src/utils/peopleScreen.ts` (+`.test.ts`) | `toPersonSearchResult` 확장, P-4 표기·P-19 |
| `src/services/people.ts` | 6.8 |
| `src/hooks/usePeople.ts` | 6.8 |
| `src/components/people/KoreanNameEditor.tsx` | 신규. 6.9 |
| `app/(tabs)/people.tsx` | 백필 훅·안내 한 줄 |
| `app/people/[id].tsx` | 표시 이름 출처 병합·편집기 |
| `app/search.tsx` | 인물 행 표시 이름 |
| `docs/development_next_steps.md` | 배포·마이그레이션 순서 기록(13장 아래 "사람 후속") |

---

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| 인물 분류 오표시(阿部寛·吉岡里帆·사카이 마사토가 "성우") | 저장된 `category`와 `correctFavoritePersonCategory`의 문제. 별도 조사 |
| 작품 상세 출연진(`app/content/[id].tsx` cast) 이름 | 다른 데이터 경로(작품 크레딧). 같은 모듈로 확장 가능하나 별도 작업 |
| 한국어 검색어로 일본 인물 찾기(`romanizeHangulPersonQuery`) | 기존 동작 유지 |
| 한국·서양 인물 이름 | 대상 아님 |
| 기존 실패 테스트 `recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library" | 이 작업 전부터 실패. 별도 수정 |

---

## 13. 확실하지 않음 — 별도 검증 필요 / 근거 자료

2026-10-01 TMDB 읽기 전용 조회:

| 인물 | TMDB id | ko-KR 이름 | en-US 이름 | 한글 별칭 | 가나 별칭 |
|------|---------|-----------|-----------|-----------|-----------|
| 長瀬智也 | 83660 | 長瀬智也(번역 없음) | Tomoya Nagase | 없음 | 없음 |
| 堺雅人 | 76933 | 사카이 마사토 | Masato Sakai | 사카이 마사토 | さかい まさと |
| 阿部寛 | 66155 | 아베 히로시 | Hiroshi Abe | 없음 | 없음 |
| 吉岡里帆 | 1576235 | 요시오카 리호 | Riho Yoshioka | 없음 | 없음 |
| 松本潤 | 107531 | 마츠모토 준 | Jun Matsumoto | 마츠모토 준 외 | まつもと じゅん |
| 戸田恵梨香 | 84620 | 토다 에리카 | Erika Toda | 토다 에리카 | 없음 |

AniList 읽기 전용 조회: 花江夏樹(111635) `first` Natsuki, `last` Hanae, `alternative`에 "하나에 나츠키". 水樹奈々(95081) 한글 별칭 없음.

1. **en-US 이름 순서**: 위 표의 en-US 이름은 모두 "이름 성"이지만 TMDB 전체가 그렇다는 보장은 없다. 순서가 반대인 인물은 "토모야 나가세"처럼 뒤집혀 보일 수 있고, 사용자가 상세에서 고칠 수 있다(D-7). M-2에서 확인.
2. **PostgREST 컬럼 없음 오류 코드 `PGRST204`**: 마이그레이션 전 동작(D-9)은 M-6에서 실제 코드로 확인. 다르면 보고.
3. **TMDB `append_to_response=translations`의 이름 필드**: 위 조회에서 `translations[].data.name`이 있음을 확인했다. 번역이 없는 언어는 항목 자체가 없다.

**사람 후속(배포 순서)**: ① `supabase/migrations/0023_favorite_people_korean_name.sql` 적용 → ② `search-person-content`, `get-person-detail`, `resolve-person-names` 배포 → ③ `npm run edge:drift`로 확인. ② 전에는 새 필드가 오지 않아 동작이 지금과 같고, ① 전에는 D-9로 등록이 깨지지 않는다.
