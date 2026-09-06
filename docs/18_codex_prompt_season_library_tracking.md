> 이 파일 **전체를 복사해서 Codex 첫 메시지로 붙여넣으세요.**

# ROLE & GOAL

너는 SceneNote(React Native + Expo / TypeScript strict / Supabase Edge Functions(Deno)) 리포지토리의 구현 담당이다.

**목표:** TMDB 드라마의 **시즌을 검색에서 구분해 고를 수 있고, 시즌별로 독립된 등록 상태를 가질 수 있게** 만든다.

현재는 `user_library_items`의 `UNIQUE (user_id, content_id)` 때문에 한 작품당 행이 하나뿐이라, 시즌1만 등록해도 시즌2가 등록된 것처럼 보인다. 검색도 쇼 하나로만 나와서 시즌2를 고를 수 없다.

# READ FIRST

- `docs/17_season_library_tracking_spec.md` — **본 작업의 명세서. 반드시 먼저 읽어라.** 근본 원인, 설계 결정 D-1~D-6, 기각한 대안, 엣지 케이스, 테스트 표가 전부 여기 있다.
- `AGENTS.md`, `CLAUDE.md` — 리포 공통 규칙

# 시작 상태 (반드시 유지)

```
npx tsc --noEmit                  # 통과
npm test                          # 342개 전부 통과
npx eslint .                      # 통과
npx expo export --platform web    # 통과
```

**기존 342개 중 하나도 깨뜨리지 마라.**

# 바꾸면 안 되는 설계 결정

1. **`contents` / `seasons` / `episodes` 스키마를 건드리지 마라.** 시즌 단위 개념은 **사용자 기록 레이어(`user_library_items`)에만** 도입한다. TMDB 시즌마다 별도 `contents` 행을 만드는 방식은 명세서 5장에서 기각했다.
2. **기존 `user_library_items` 행을 시즌 번호로 마이그레이션하지 마라.** 전부 `NULL`(작품 전체)로 남긴다. 그 행이 시즌1을 의미했다는 근거가 없다.
3. **UNIQUE 제약은 반드시 부분 인덱스 2개로 분리한다.** Postgres는 UNIQUE에서 NULL을 서로 다른 값으로 취급하므로 단일 `UNIQUE(user_id, content_id, season_number)`로는 작품 전체 행이 중복 생성된다.
4. **RLS 정책을 새로 만들지 마라.** 기존 `auth.uid() = user_id` 정책이 새 컬럼에도 적용된다.
5. 시즌 펼치기는 **이미 시즌을 조회하는 상위 3건에만** 적용한다. 결과 1건당 추가 TMDB 상세 호출을 만들지 마라.

# STEP별 작업 순서

각 STEP마다 **재현 테스트를 먼저 작성해 실패를 확인한 뒤** 구현해라. 러너는 `tsx --test` (node:test + node:assert).

## STEP 1 — 마이그레이션 `supabase/migrations/0021_user_library_season_number.sql`

전문을 그대로 사용한다:

```sql
ALTER TABLE user_library_items
  ADD COLUMN IF NOT EXISTS season_number INTEGER;

ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_season_number_check;
ALTER TABLE user_library_items
  ADD CONSTRAINT user_library_items_season_number_check
  CHECK (season_number IS NULL OR (season_number >= 1 AND season_number <= 999));

-- NULL은 UNIQUE에서 서로 다른 값으로 취급되므로 부분 인덱스로 분리한다.
ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_user_content_unique;

CREATE UNIQUE INDEX IF NOT EXISTS user_library_items_user_content_whole_unique
  ON user_library_items (user_id, content_id)
  WHERE season_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_library_items_user_content_season_unique
  ON user_library_items (user_id, content_id, season_number)
  WHERE season_number IS NOT NULL;

COMMENT ON COLUMN user_library_items.season_number IS
  'NULL이면 작품 전체 등록(영화·단일 시즌·애니·기존 데이터). 1 이상이면 해당 시즌만 등록.';
```

`src/types/database.ts`의 `user_library_items` 타입에도 `season_number`를 추가해라.

## STEP 2 — 시즌 펼치기 (검색 어댑터)

`supabase/functions/search-content/adapters/tmdb.ts`에 순수 함수를 추가한다:

```ts
export const MAX_EXPANDED_SEASONS = 5;

export function expandAiredSeasons(
  result: SearchResult,
  seasons: readonly TmdbSeason[],
  now: Date
): SearchResult[];
```

판정 순서:
1. `result.content_type === "movie"`이면 `[result]` 그대로 반환
2. 방영 시작한 시즌만 남긴다 — `season_number >= 1` **그리고** `air_date`가 유효하고 `<= now` (기존 `pickCurrentSeason`과 동일 기준)
3. 남은 시즌이 **1개 이하**면 `[result]` 그대로 반환 (펼치지 않음)
4. `air_date` 내림차순으로 정렬 후 **최근 `MAX_EXPANDED_SEASONS`개**만 사용
5. 각 시즌마다 카드를 만든다:
   - `external_source` / `external_id`는 **원본 그대로** (쇼 id 유지)
   - `season_number`: 해당 시즌 번호
   - `title_primary`: 시즌명이 의미 있으면(`hasHangul` 통과 && `/^(?:시즌|season)\s*\d+$/i`에 걸리지 않음) 그것을, 아니면 `${result.title_primary} 시즌 ${N}`
   - `air_date` / `air_year` / `episode_count`: 해당 시즌 값
   - 나머지 필드는 원본 유지

`searchTmdb`의 상위 3건 처리에서, **명시적 시즌 질의가 없을 때** `applyCurrentSeasonMetadata` 대신 `expandAiredSeasons`를 쓰고 결과를 flat하게 펼친다. 명시적 `시즌N`/`N기` 질의일 때는 기존 `applyTmdbSeasonMetadata` 경로를 **그대로 유지**한다.

테스트 (명세서 9장 표 그대로):

| 입력 | 기대 |
|---|---|
| 방영 2개(2023-07-16, 2026-07-19) + 미방영 1개(2099) | 카드 2개, 미방영 제외 |
| 방영 1개 | 원본 1건 (펼치지 않음) |
| 방영 7개 | 최근 5개 |
| `content_type: "movie"` | 원본 1건 |
| 시즌명이 `"시즌 2"`(무의미) | 제목은 `{원제목} 시즌 2`로 합성 |
| 시즌명이 `"별의 계승자"`(의미 있음) | 그 이름을 제목으로 |

## STEP 3 — 등록 상태 판정 (클라이언트)

`src/utils/` 에 순수 함수를 만든다:

```ts
export type SeasonLibraryMatch =
  | { kind: "season"; item: LibraryListItem }
  | { kind: "whole-work"; item: LibraryListItem }
  | { kind: "none" };

export function matchLibraryItemForSeason(
  items: readonly LibraryListItem[],
  seasonNumber: number | null | undefined
): SeasonLibraryMatch;
```

판정 순서 (명세서 D-5):
1. `seasonNumber`와 같은 `season_number` 행이 있으면 → `{ kind: "season" }`
2. `season_number == null` 행이 있으면 → `{ kind: "whole-work" }`
3. 없으면 → `{ kind: "none" }`

`src/utils/contentMetaDisplay.ts`의 `createLibraryWatchStateLabel`을 이 판정 기반으로 교체한다:
- `season` → 기존대로 `시청 N회`
- `whole-work` → `"작품 전체로 등록됨"`
- `none` → `null`

**지금 있는 연도 비교 방식(`air_year` 불일치로 "다른 시즌 등록됨")은 제거해라.** 그건 2026-09-06 임시 조치였고 이 STEP이 정식 해법이다.

`app/search.tsx`의 `libraryItemsByExternalKey`는 `Map<string, LibraryListItem>`에서 **같은 외부 키의 행 배열**을 담도록 바꾼다(`Map<string, LibraryListItem[]>`). 시즌 행과 작품 전체 행이 공존할 수 있기 때문이다.

## STEP 4 — `add-to-library`가 `season_number`를 받는다

`supabase/functions/add-to-library/index.ts`:
- 요청 본문에 `season_number?: number` 추가. 검증: 정수, `1 <= n <= 999`, 아니면 `400`
- 값이 있으면 해당 시즌 행을, 없으면 작품 전체 행(`season_number: null`)을 upsert
- **upsert의 onConflict 대상이 달라진다.** 부분 유니크 인덱스를 쓰므로 PostgREST의 `onConflict`로 지정할 수 없다면, 먼저 `select`로 존재 여부를 확인한 뒤 `insert`/`update`로 분기해라
- `contents` / `seasons` / `content_external_ids` 저장 로직은 **변경 금지**

클라이언트(`src/services/library.ts`, `src/hooks/useLibrary.ts`)도 `seasonNumber`를 전달하도록 확장한다.

## STEP 5 — 상세 화면 시즌 진입

- `app/search.tsx`의 `openResult`가 `season: String(result.season_number)`을 params에 추가 (값이 있을 때만)
- `app/content/[id].tsx`가 `season` 파라미터를 받아 **해당 시즌 탭을 초기 선택**
- 헤더의 전체 화수·최초 방영일은 **작품 전체 기준 그대로 유지** (기존 동작 변경 금지)

# 엣지 케이스 (전부 처리, 명세서 8장)

| # | 상황 | 기대 |
|---|---|---|
| E-1 | 시즌 1개 드라마 | 펼치지 않음 |
| E-2 | 미방영 시즌 | 카드 생성 안 함 |
| E-3 | AniList 애니 | 펼치지 않음 (이미 시즌=작품) |
| E-4 | 영화 | 펼치지 않음 |
| E-5 | 기존 NULL 행만 있음 + 시즌2 카드 | "작품 전체로 등록됨" |
| E-6 | 시즌2 등록 후 시즌1 카드 | 시즌1은 미등록 |
| E-7 | 시즌 10개 | 최근 5개만 |
| E-8 | `season_number` 없이 add-to-library 호출 | 작품 전체 행 (하위 호환) |

# 검증 명령

```
npx tsc --noEmit
npm test
npx eslint .
npx expo export --platform web
```

# DEFINITION OF DONE

- 위 4개 명령 전부 통과, 기존 342개 테스트 유지
- STEP 2·3에 명세서 9장 표를 커버하는 테스트 추가
- 마이그레이션이 **기존 행을 건드리지 않고**(전부 `season_number IS NULL` 유지) 적용됨
- 부분 유니크 인덱스 2개가 실제로 생성됨

# 변경 예상 파일

```
supabase/migrations/0021_user_library_season_number.sql   (신규)
supabase/functions/search-content/adapters/tmdb.ts
supabase/functions/search-content/adapters/tmdb.test.ts
supabase/functions/add-to-library/index.ts
src/types/database.ts
src/types/library.ts
src/utils/contentMetaDisplay.ts
src/utils/contentMetaDisplay.test.ts
src/services/library.ts
src/hooks/useLibrary.ts
src/components/content/SearchResultItem.tsx
src/components/content/SearchResultGalleryCard.tsx
app/search.tsx
app/content/[id].tsx
```

# 보고 항목

1. STEP별로 무엇을 어떻게 구현했는지
2. 어떤 테스트가 각 STEP을 커버하는지
3. STEP 4의 upsert를 어떤 방식으로 처리했는지(부분 인덱스 때문에 select 후 분기했는지)
4. 명세서 10장의 "확실하지 않음" 세 항목 — 라이브러리 목록에서 같은 작품이 두 줄로 보이는지, 추천 엔진의 라이브러리 가중치가 중복 계산되는지 — 구현 중 확인된 사실

# 금지사항

- `contents` / `seasons` / `episodes` 스키마 변경 금지
- 기존 `user_library_items` 행에 시즌 번호 채워넣기 금지
- 단일 `UNIQUE(user_id, content_id, season_number)` 사용 금지 (NULL 중복 발생)
- 검색 결과 1건당 추가 TMDB 상세 호출 금지
- 명시적 `시즌N`/`N기` 질의 경로(`applyTmdbSeasonMetadata`) 변경 금지
- 커밋 금지. 워킹 트리에만 반영
- 기존 테스트 삭제·비활성화 금지
