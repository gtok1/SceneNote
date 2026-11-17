# 72. 라이브러리·핀 1000행 잘림 + 중복 조회·인증 왕복 정정

작성일: 2026-11-16
대상 브랜치 기준: main (c7aeca8 + docs/71 작업 트리, `npm test` 1668/1668)
선행 문서: [00 UI](00_ui_style_rules.md), [08](08_frontend_architecture.md), [12](12_episode_progress_spec.md), [69](69_persistent_public_metadata_cache_fixes_spec.md), [71](71_meaningless_api_calls_and_usability_fixes_spec.md)

> 정정 작업이다. **앱(클라이언트)만 바꾼다.** Edge Function·DB·RLS는 바꾸지 않으므로 배포·마이그레이션이 없다.
> docs/71이 Edge(외부 API) 호출을 다뤘다면, 이 문서는 본인 기록을 읽고 쓰는 Supabase DB·Auth 호출을 다룬다.

## 1. 문제 정의

| ID | 구분 | 사용자가 겪는 것 / 낭비되는 것 |
|----|------|------------------------------|
| F-1 | 구멍 | 라이브러리 작품이나 핀이 1000개를 넘으면 **오류 없이** 1000개까지만 보인다. 라이브러리는 최근 수정순이라 오래된 작품이, 핀은 최신순이라 오래된 핀이 사라진 것처럼 보인다. 통계·검색·공유·추천 제외 판정도 잘린 목록으로 계산된다 |
| F-2 | 낭비 | 핀 저장, 회차 체크, 리뷰 저장, 태그 생성, 좋아하는 인물 추가·분류 보정, 공유 링크 생성 때마다 저장 전에 인증 서버를 한 번 더 왕복한다. 회차를 연달아 체크하면 체크마다 왕복이 붙는다 |
| F-3 | 낭비 | 라이브러리 탭에서 상태("보는 중" 등)를 바꿀 때마다 전체 목록과 보조 조회 4종을 처음부터 다시 읽는다. 홈·상세·검색이 이미 읽어 둔 "전체" 목록과 같은 데이터다 |
| F-4 | 낭비 | 라이브러리를 읽을 때마다 **모든 작품의 모든 회차 방영일 행**을 가져온다. 쓰임은 방영일·종료일이 비어 있는 작품의 빈칸 채우기뿐이다 |

## 2. 근본 원인

**F-1.** `supabase/config.toml:18` `max_rows = 1000`(호스팅 기본값도 1000). 아래 조회는 `.range()` 없이 한 번에 읽는다.

| 함수 | 좌표 | 정렬 |
|------|------|------|
| `getLibraryItems` | `src/services/library.ts:79-106` (본 조회 80-89, 구 스키마 폴백 91-104) | `updated_at desc` (동률 기준 없음) |
| `getAllPins` | `src/services/pins.ts:10-18` | `created_at desc` (동률 기준 없음) |
| `getPinsByTag` | `src/services/pins.ts:69-82` | 없음 |

같은 파일의 보조 조회(`library.ts:438-464`)는 이미 `readBatchedRows`(`src/utils/batchedQuery.ts`)로 1000행을 넘겨 읽는다. 본 조회만 빠져 있다.

**F-2.** `supabase.auth.getUser()`는 매번 `/auth/v1/user`를 호출해 토큰을 검증한다. 쓰는 곳 7곳 모두 `user.id`를 행에 넣기 위해서다. 본인 확인은 RLS(`auth.uid()`)가 서버에서 다시 하므로 이 왕복은 결과를 바꾸지 않는다.

| 함수 | 좌표 | 로그인 없음 처리 |
|------|------|------------------|
| `addFavoritePerson` | `src/services/people.ts:119-124` | `throw "로그인이 필요합니다"` |
| 좋아하는 인물 분류 보정 | `src/services/people.ts:268-276` | 조용히 `return` (인물마다 1회씩 호출됨) |
| `saveContentReview` | `src/services/reviews.ts:18-23` | `throw "로그인이 필요합니다"` |
| 공유 링크 생성 | `src/services/libraryShare.ts:140-146` | `userError`면 그 메시지, 없으면 `throw "공유 링크를 만들려면 로그인이 필요합니다."` |
| `createTag` | `src/services/tags.ts:10-15` | `throw "로그인이 필요합니다"` |
| `createPin` | `src/services/pins.ts:84-89` | `throw "로그인이 필요합니다"` |
| `toggleEpisodeProgress` | `src/services/library.ts:656-664` | `throw "로그인이 필요합니다"` |

**F-3.** `src/hooks/useLibrary.ts:34-43` — `queryKey: library.byStatus(userId, status)`, `queryFn: getLibraryItems(status)`. 상태마다 캐시가 따로다. 서버 필터(`status_flags contains [status]`, `library.ts:85-87`)는 앱이 이미 가진 `item.statuses`(`library.ts:111`)로 똑같이 계산할 수 있다. 화면의 다른 필터(종류·장르·평점·검색)는 이미 앱에서 건다(`src/utils/libraryFilters.ts:61`).

**F-4.** `src/services/library.ts:457-463` — `episodes`에서 `content_id,air_date`를 라이브러리의 **전 작품**에 대해 읽는다. 결과는 `:504`(`item.air_date ?? 첫 방영일`)와 `:506-510`(AniList가 아니고 `item.end_date`가 없을 때 마지막 방영일)에서만 쓰인다. 값이 이미 있는 작품의 행은 읽고 버린다.

## 3. 재현 시나리오

웹 8081, 로그인 상태, 개발자 도구 Network.

1. (F-1) 작품이 1000개를 넘는 계정에서 라이브러리 "전체"의 개수가 1000에서 멈춘다. 1000개 미만 계정은 화면 재현이 안 되므로 T-1~T-8로 확인한다.
2. (F-2) 에피소드 화면에서 회차를 체크 → `auth/v1/user` 요청이 체크마다 1건.
3. (F-3) 홈을 연 뒤 라이브러리 탭에서 "보는 중"을 누른다 → `rest/v1/user_library_items`와 `reviews`·`seasons`·`user_episode_progress`·`episodes` 요청이 다시 나간다.
4. (F-4) 3번의 `rest/v1/episodes?select=content_id,air_date` 요청이 작품 100개 묶음마다 나가고 응답 행이 수천 개다.

## 4. 설계 결정

### D-1. 끝까지 읽되, 상한을 넘으면 잘라서 보여 주지 않고 오류로 알린다 (F-1)
`readAllRows`가 페이지(1000행)를 이어 읽는다. 안전 상한(50쪽 = 5만 행)을 넘으면 `error`를 돌려준다. 조용히 잘린 목록은 F-1 자체이므로 상한에서도 반복하지 않는다.

### D-2. 페이지 경계가 흔들리지 않게 동률 기준 `id`를 더하고, 행을 `id`로 한 번만 센다
`updated_at`·`created_at`이 같은 행이 페이지 사이에서 순서가 바뀌면 빠지거나 중복된다. 기존 정렬 뒤에 `.order("id")`를 붙이고, 읽는 도중 기록이 바뀌어 같은 행이 두 번 와도 먼저 온 것만 남긴다.

### D-3. 저장 직전 본인 확인은 앱에 있는 세션으로 한다 (F-2)
`supabase.auth.getSession()`은 저장소의 세션을 읽고, 토큰이 만료됐을 때만 갱신 요청을 한다. 위조된 세션으로는 RLS를 통과할 수 없으므로 보안 수준은 그대로다. **RLS 정책과 `user_id`를 행에 넣는 동작은 바꾸지 않는다.** 로그인 없음 문구·조용한 반환도 2장 표 그대로 유지한다.

### D-4. 라이브러리 캐시는 "전체" 하나만 둔다 (F-3)
`useLibrary(status)`는 항상 `byStatus(userId, "all")` 캐시를 읽고 `select`로 상태를 거른다. `getLibraryItems(status)`의 서버 필터 경로는 남겨 둔다(시그니처 유지).
> **동작 변화(의도함).** 지금은 "보는 중" 탭에서 작품을 "완료"로 바꿔도 다음 재조회 전까지 그 탭에 남아 있다(성공 시 `refetchType: "inactive"`). 수정 후에는 **바꾸는 즉시 그 탭에서 빠진다.** 실패하면 기존 스냅샷 복구로 돌아온다. 이 동작이 기존 결정과 충돌한다고 판단되면 구현하지 말고 보고한다.

### D-5. 회차 방영일은 빈칸이 있는 작품만 읽는다 (F-4)
`contentIdsNeedingEpisodeAirDates(items)`가 돌려준 id로만 `episodes`를 조회한다. 조건은 `:504`·`:506-510`이 폴백을 실제로 쓰는 경우와 정확히 같아야 한다(6장). 결과 화면은 한 글자도 달라지지 않는다.

> D-1~D-5는 임의로 바꾸지 않는다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

- **무한 스크롤(서버 페이지네이션)로 전환.** 라이브러리의 필터·정렬·통계·추천 제외가 전체 목록을 전제로 한다. 화면 구조를 바꾸는 별도 작업이다.
- **`max_rows` 상향.** 호스팅 설정 변경이 필요하고 다음 상한에서 같은 구멍이 다시 난다.
- **`useAuthStore`의 `user`를 서비스에서 직접 읽기.** 서비스가 스토어에 의존하게 되고, 토큰 만료 시 갱신 기회를 잃는다. `getSession()`이 둘 다 해결한다.
- **상태별 캐시를 유지하고 "전체" 캐시에서 `initialData`로 채우기.** 캐시가 여러 벌이라 낙관적 갱신·무효화 때 계속 각각 다시 읽는다.
- **회차 방영일을 DB 뷰·RPC로 집계.** 마이그레이션이 필요하다. 대상 작품을 줄이는 것만으로 대부분 해결된다.

## 6. 계약 (타입 · 판정 순서)

`src/utils/batchedQuery.ts` (기존 `readBatchedRows`·`QueryPage`는 그대로)

```ts
/** id 묶음 없이 한 조회를 끝까지 읽는다. 상한을 넘으면 잘린 목록 대신 error를 돌려준다(docs/72 D-1). */
export async function readAllRows<T>(
  readPage: (from: number, to: number) => PromiseLike<QueryPage<T>>,
  options?: { pageSize?: number; maxPages?: number; rowKey?: (row: T) => string | null | undefined }
): Promise<QueryPage<T>>;
```
1. `pageSize`(기본 1000)·`maxPages`(기본 50)가 1 이상의 정수가 아니면 `throw new Error("Invalid query page size")`.
2. `from = 0`부터 `readPage(from, from + pageSize - 1)`. `error`면 즉시 `{ data: null, error }`.
3. `rowKey`가 있으면 키가 이미 나온 행은 버린다(키가 null·undefined·빈 문자열이면 버리지 않고 남긴다).
4. 받은 행 수(중복 제거 **전**)가 `pageSize`보다 작으면 종료.
5. `maxPages`쪽을 읽고도 끝나지 않으면 `{ data: null, error: { message: "ROW_LIMIT_EXCEEDED" } }`.

`src/utils/sessionUser.ts` (신규)

```ts
export function sessionUserId(session: { user?: { id?: string | null } | null } | null | undefined): string | null;
```
`session?.user?.id`가 비어 있지 않은 문자열이면 그 값, 아니면 `null`.

`src/services/sessionUser.ts` (신규)

```ts
/** 저장소의 세션에서 본인 id를 읽는다. 네트워크 왕복이 없다(만료 시 갱신 제외). 본인 확인은 RLS가 한다(docs/72 D-3). */
export async function getSessionUserId(): Promise<{ userId: string | null; error: { message: string } | null }>;
```

`src/utils/libraryFilters.ts`

```ts
export function filterLibraryItemsByStatus(items: LibraryListItem[], status: LibraryStatusFilter): LibraryListItem[];
```
`status === "all"`이면 **같은 배열 참조**를 돌려준다. 아니면 `item.statuses.includes(status)`인 항목만(순서 유지).

`src/utils/libraryAirDates.ts` (신규)

```ts
export function contentIdsNeedingEpisodeAirDates(
  items: readonly Pick<LibraryListItem, "content_id" | "source_api" | "air_date" | "end_date">[]
): string[];
```
`item.air_date == null` **또는** (`item.source_api !== "anilist"` 이고 `item.end_date == null`)인 항목의 `content_id`를 중복 없이, 처음 나온 순서로.

`src/hooks/useLibrary.ts` `useLibrary(status)` — 시그니처·반환 형태 유지.
- `queryKey: queryKeys.library.byStatus(userId, "all")`, `queryFn: () => getLibraryItems("all")`.
- `select`는 `useCallback((items) => filterLibraryItemsByStatus(items, status), [status])`.
- `enabled`·`staleTime`은 그대로. mutation의 `setQueriesData`·`invalidateQueries`·스냅샷 코드는 바꾸지 않는다(접두어 `library.all(userId)`가 그대로 맞는다).

`src/services/library.ts` `getLibraryItems(status)` — 시그니처 유지.
1. 본 조회를 `readAllRows((from, to) => 본 select … .order("updated_at", { ascending: false }).order("id").range(from, to), { rowKey: row => row.id })`로.
2. `error`가 `isMissingOptionalLibraryColumnError`면 폴백 select로 **처음부터** 같은 방식으로 다시 읽는다(본 조회에서 읽은 행은 버린다).
3. `error.message === "ROW_LIMIT_EXCEEDED"`면 `throw new Error("라이브러리 작품이 너무 많아 불러오지 못했어요.")`. 그 외 오류는 기존대로.
4. `status !== "all"`의 서버 필터는 각 페이지 조회에 그대로 건다.

`enrichLibraryMetadata` — 네 번째 조회(`:457-463`)의 id 목록만 `contentIdsNeedingEpisodeAirDates(items)`로 바꾼다. 나머지 세 조회는 `contentIds` 그대로.

`src/services/pins.ts`
- `getAllPins`: `readAllRows(… .order("created_at", { ascending: false }).order("id").range(from, to), { rowKey: row => row.id })`.
- `getPinsByTag`: 조인 테이블의 핀 id 칼럼(`supabase/migrations`에서 이름을 확인한다. 추측하지 않는다)으로 `.order(...)` 뒤 `.range(from, to)`, `rowKey`는 `row => row.timeline_pins?.id`.
- `ROW_LIMIT_EXCEEDED`면 `throw new Error("핀이 너무 많아 불러오지 못했어요.")`.

F-2의 7곳은 `getSessionUserId()`로 바꾸고 2장 표의 로그인 없음 처리를 그대로 유지한다. `user` 객체에서 `id` 외의 값을 쓰는 곳이 있으면 바꾸지 말고 보고한다.

## 7. 데이터 모델 / SQL

없음.

## 8. 화면 명세

화면 파일 변경 없음. 눈에 보이는 차이는 D-4의 "상태를 바꾸면 그 탭에서 즉시 빠짐" 하나다. 상한 초과 문구는 기존 `ErrorState`로 표시된다(`userFacingErrorMessage`가 한국어 문구를 통과시킨다).

## 9. 엣지 케이스

| # | 상황 | 기대 동작 |
|---|------|-----------|
| E-1 | 0행 | 조회 1회, 빈 배열 |
| E-2 | 정확히 1000행 | 2회 조회(두 번째 0행) 뒤 1000행 |
| E-3 | 2500행 | 3회 조회, 2500행, 순서 유지 |
| E-4 | 2쪽에서 오류 | `{ data: null, error }` — 1쪽만 돌려주지 않는다 |
| E-5 | 페이지 사이 같은 id가 다시 옴 | 먼저 온 행만 남김 |
| E-6 | `rowKey`가 null(조인 행의 핀이 없음) | 버리지 않고 남김(기존 `flatMap`이 뒤에서 걸러 낸다) |
| E-7 | 상한(`maxPages`) 초과 | `ROW_LIMIT_EXCEEDED` 오류, 잘린 목록 없음 |
| E-8 | `pageSize`·`maxPages`가 0·소수·음수 | throw |
| E-9 | 구 스키마(선택 칼럼 없음) | 폴백 select로 처음부터 끝까지 읽음 |
| E-10 | 세션 없음 / `user` 없음 / id 빈 문자열 | `null` |
| E-11 | 세션 조회 자체가 오류 | 공유 생성은 그 메시지, 나머지는 로그인 없음 처리 |
| E-12 | 상태 "all" | 같은 배열 참조(불필요한 재렌더 없음) |
| E-13 | 상태 "watching", 항목의 `statuses`가 `["watching","recommended"]` | 포함 |
| E-14 | 상태 6종 각각 | `statuses`에 그 값이 있는 항목만, 원래 순서 |
| E-15 | 빈 목록 / 해당 없음 | 빈 배열 |
| E-16 | `air_date` 없음 | 회차 방영일 조회 대상 |
| E-17 | TMDB, `air_date` 있음, `end_date` 없음 | 대상 |
| E-18 | TMDB, 둘 다 있음 | 대상 아님 |
| E-19 | AniList, `air_date` 있음, `end_date` 없음 | 대상 아님(docs/71 보정: AniList는 종료일을 추정하지 않는다) |
| E-20 | AniList, `air_date` 없음 | 대상 |
| E-21 | 같은 작품이 시즌별로 두 번 등록 | id 한 번만 |
| E-22 | 대상 0건 | `episodes` 조회 0회 |

## 10. 테스트 표

모든 행을 테스트로 옮긴다. 줄이지 않는다.

| ID | 파일 | 입력 | 기대 | 엣지 |
|----|------|------|------|------|
| T-1 | `batchedQuery.test.ts` | `readAllRows`, 0행 | 호출 1회 `(0, 999)`, `data: []` | E-1 |
| T-2 | 〃 | 1000행 | 호출 2회 `(0,999)`,`(1000,1999)`, 1000행 | E-2 |
| T-3 | 〃 | 2500행(`pageSize` 1000) | 호출 3회, 2500행, 입력 순서 | E-3 |
| T-4 | 〃 | 2쪽 `error` | `data: null`, 그 `error`, 호출 2회 | E-4 |
| T-5 | 〃 | `pageSize` 2, 쪽 `[a,b]`,`[b,c]`,`[d]`, `rowKey: id` | `[a,b,c,d]`, 호출 3회 | E-5 |
| T-6 | 〃 | `rowKey`가 null·undefined·""인 행 여러 개 | 전부 남음 | E-6 |
| T-7 | 〃 | `pageSize` 2, `maxPages` 2, 매번 2행 | `data: null`, `error.message === "ROW_LIMIT_EXCEEDED"`, 호출 2회 | E-7 |
| T-8 | 〃 | `pageSize` 0 / 1.5 / -1, `maxPages` 0 | reject("Invalid query page size") | E-8 |
| T-9 | `sessionUser.test.ts`(신규) | `null`, `undefined`, `{}`, `{ user: null }`, `{ user: {} }`, `{ user: { id: "" } }` | 전부 `null` | E-10 |
| T-10 | 〃 | `{ user: { id: "u1" } }` | `"u1"` | D-3 |
| T-11 | `libraryFilters.test.ts` | `filterLibraryItemsByStatus(items, "all")` | `===` 같은 참조 | E-12 |
| T-12 | 〃 | "watching", `statuses` `["watching","recommended"]` / `["completed"]` | 첫 항목만 | E-13 |
| T-13 | 〃 | 상태 6종(`STATUS_FILTERS`에서 "all" 제외) 각각 | 해당 항목만, 순서 유지 | E-14 |
| T-14 | 〃 | 빈 목록 / 맞는 항목 없음 | `[]` | E-15 |
| T-15 | `libraryAirDates.test.ts`(신규) | tmdb, air null, end 있음 | 포함 | E-16 |
| T-16 | 〃 | tmdb, air 있음, end null | 포함 | E-17 |
| T-17 | 〃 | tmdb, 둘 다 있음 | 제외 | E-18 |
| T-18 | 〃 | anilist, air 있음, end null | 제외 | E-19 |
| T-19 | 〃 | anilist, air null | 포함 | E-20 |
| T-20 | 〃 | 같은 `content_id` 두 항목(둘 다 대상) + 다른 대상 하나 | 2개, 처음 나온 순서 | E-21 |
| T-21 | 〃 | 전부 값 있음 / 빈 목록 | `[]` | E-22 |
| T-22 | `batchedQuery.test.ts` | `readBatchedRows([], readPage)` | 호출 0회, `data: []`(기존 동작 고정) | E-22 |

보존: `batchedQuery.test.ts`·`libraryFilters.test.ts`의 기존 단언 전부.

수동 확인(서비스·훅은 Supabase를 import해 자동 테스트 불가):

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 라이브러리 "전체" 개수·순서가 수정 전과 같다. `user_library_items` 요청에 `order=updated_at.desc,id.asc`와 Range가 붙는다 |
| M-2 | 웹 1440 | 홈 → 라이브러리 → 상태 탭을 차례로 눌러도 `rest/v1` 요청이 추가로 나가지 않는다. 탭별 목록은 수정 전과 같다 |
| M-3 | 웹 1440 | "보는 중" 탭에서 한 작품을 "완료"로 변경 → 즉시 그 탭에서 빠지고 "완료" 탭에 보인다. 홈 "이어 보기"에서도 빠진다 |
| M-4 | 웹 1440 | 회차 체크·핀 저장·리뷰 저장·태그 생성·인물 추가 시 `auth/v1/user` 0건, 저장은 성공한다 |
| M-5 | 웹 1440 | `episodes?select=content_id,air_date` 요청 수·응답 행 수가 줄었고, 카드의 방영일·연도 표시는 수정 전과 같다 |
| M-6 | 웹 375 | 핀 탭 전체·태그별 목록의 개수·순서가 수정 전과 같다 |
| M-7 | 앱(iOS 세로) | 로그인 유지 상태에서 회차 체크·핀 저장 성공, 당겨서 새로고침 뒤 목록 동일 |
| M-8 | 웹 1440 | 로그아웃 직후 다른 탭에 남아 있던 화면에서 저장 시도 → "로그인이 필요합니다" 계열 안내(원문 영문 없음) |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/batchedQuery.ts` | `readAllRows` 추가 |
| `src/utils/batchedQuery.test.ts` | T-1~T-8, T-22 |
| `src/utils/sessionUser.ts`, `src/utils/sessionUser.test.ts` | 신규, T-9·T-10 |
| `src/services/sessionUser.ts` | 신규 `getSessionUserId` |
| `src/utils/libraryFilters.ts`, `src/utils/libraryFilters.test.ts` | `filterLibraryItemsByStatus`, T-11~T-14 |
| `src/utils/libraryAirDates.ts`, `src/utils/libraryAirDates.test.ts` | 신규, T-15~T-21 |
| `src/services/library.ts` | `getLibraryItems` 끝까지 읽기, 회차 방영일 대상 축소, `toggleEpisodeProgress` 세션 사용 |
| `src/services/pins.ts` | `getAllPins`·`getPinsByTag` 끝까지 읽기, `createPin` 세션 사용 |
| `src/services/people.ts`, `src/services/reviews.ts`, `src/services/tags.ts`, `src/services/libraryShare.ts` | 세션 사용(2장 표) |
| `src/hooks/useLibrary.ts` | `useLibrary`만 단일 캐시 + `select` |
| `docs/development_next_steps.md`, `docs/README.md`, `docs/08_frontend_architecture.md` | 구현 상태, 라이브러리 캐시 구조 한 줄 갱신 |

## 12. 범위 밖

- **Edge Function·DB·RLS·`supabase/config.toml`.**
- **`getPinsByContent`·`getPinsByEpisode`**(`pins.ts:44-67`). 작품·회차 하나의 핀이 1000개를 넘는 경우는 다루지 않는다.
- **`useAuth.ts`·`AppProviders.tsx`의 세션 처리.** 이미 `getSession()`이다.
- **라이브러리 mutation의 낙관적 갱신·무효화 코드.** 단일 캐시에서도 그대로 동작한다.
- **`queryKeys.library.byStatus` 정의**(`src/lib/query.ts`). 호출 인자만 `"all"`로 고정한다.
- **카드마다 나가는 `useSeasons` 조회**(docs/71 12장), **핀 제목 현지화 조회**(docs/69).
- **화면 파일**(`app/`, `src/components/`).

## 13. 확실하지 않음 — 별도 검증 필요

- 실제 계정의 작품·핀 수와 `episodes` 응답 행 수는 재 보지 않았다. 감소량은 M-2·M-5의 요청 건수로 확인한다.
- `normalizeWatchStatuses`가 `status_flags`의 값을 하나도 버리지 않아야 D-4가 서버 필터와 같다. STEP 1 전에 `src/constants/status.ts`를 읽어 6종이 모두 보존되는지 확인하고, 버리는 값이 있으면 구현하지 말고 보고한다.
- 구 스키마 폴백 경로(`library.ts:91-104`)는 서버에서 `status` 단일 칼럼으로 거른다. 운영 DB는 `status_flags`가 있어 이 경로를 타지 않는 것으로 보이나 확인하지 않았다.
- `timeline_pin_tags`의 핀 id 칼럼 이름은 확인하지 않았다(6장에서 마이그레이션 확인을 지시).
- 토큰이 만료된 채 `autoRefreshToken`이 꺼진 환경(`src/lib/supabase.ts:24-29`의 `canPersistAuth === false`)에서 `getSession()`의 동작은 확인하지 않았다. 이 경우 저장은 RLS 오류로 실패하고 기존 오류 문구 경로를 탄다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다.
라이브러리·핀 목록이 1000행에서 조용히 잘리는 구멍을 막고(F-1), 저장 전 인증 왕복(F-2)·상태 탭별 전체 재조회(F-3)·전 작품 회차 방영일 조회(F-4)를 없앤다. **정정 작업이며 앱 코드만 바꾼다.** 결함 표는 1장.

# READ FIRST
1. `docs/72_library_row_limit_and_redundant_reads_fixes_spec.md` — 이 명세. D-1~D-5, E-1~E-22
2. `docs/08_frontend_architecture.md` — 라이브러리 캐시·낙관적 갱신의 현재 구조
3. `docs/71_meaningless_api_calls_and_usability_fixes_spec.md` — AniList 종료일 보정(이 명세 E-19의 근거)
4. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
5. `src/utils/batchedQuery.ts`, `src/services/library.ts`(79-135, 434-515), `src/services/pins.ts`(10-90), `src/hooks/useLibrary.ts`(34-43, 353-470), `src/constants/status.ts`

# 시작 상태 (반드시 유지)
- `npm test` 1668/1668 통과(2026-11-16, docs/71 구현 포함 작업 트리).
- 라이브러리의 낙관적 갱신·실패 복구, 시즌별 등록 표시, docs/71의 AniList 종료일 처리(`library.ts:506-510`).

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 일부만 읽은 목록을 성공으로 돌려주지 않는다. 오류·상한 초과는 `data: null`. 어기면 F-1이 그대로 남는다.
- **D-3.** RLS 정책, `user_id`를 넣는 행, 로그인 없음 문구·조용한 반환(2장 표)을 바꾸지 않는다. `getSession()` 외의 방법(스토어 직접 참조, JWT 직접 해석)을 쓰지 않는다.
- **D-5.** `contentIdsNeedingEpisodeAirDates`의 조건은 6장 그대로. 좁히면 방영일·종료일이 비는 카드가 생긴다.
- **D-4.** mutation의 `setQueriesData`·`invalidateQueries`·스냅샷 코드는 건드리지 않는다. `useLibrary` 한 함수만 바꾼다.
- `getLibraryItems(status)`, `readBatchedRows`, `useLibrary(status)`는 **시그니처 변경 금지.** `libraryShare.ts:223`의 `getLibraryItems("all")` 호출은 그대로 둔다.
- `supabase/`, `src/lib/query.ts`, `src/lib/supabase.ts`, `app/`, `src/components/`는 **바꾸지 않는다.** DB 마이그레이션을 만들지 않는다.

# STEP 0 — 전제 확인 (코드 변경 없음)
13장 2·4번을 확인한다: `normalizeWatchStatuses`가 6종을 보존하는지, `timeline_pin_tags`의 핀 id 칼럼 이름. 전제가 다르면 멈추고 보고해라.

# STEP 1 — 실패하는 테스트부터
10장 T-1~T-22를 네 테스트 파일에 쓴다(`sessionUser.test.ts`, `libraryAirDates.test.ts`는 신규).
`npm test`를 돌려 새 테스트가 실패하는 것을 눈으로 확인한다(없는 export). T-22만 처음부터 통과한다. 그 외에 실패하지 않는 테스트가 있으면 멈추고 보고해라.

# STEP 2 — 순수 함수 (6장 계약)
`readAllRows`, `sessionUserId`, `filterLibraryItemsByStatus`, `contentIdsNeedingEpisodeAirDates`. `npm test`로 T-1~T-22 통과 확인.

# STEP 3 — 끝까지 읽기 (F-1)
6장 `getLibraryItems`·`pins.ts` 항목대로. `library.ts`에 주석 "max_rows(1000)를 넘겨 읽는다. 잘린 목록을 성공으로 돌려주지 않는다(docs/72 D-1)"를 남긴다.

# STEP 4 — 세션 사용 (F-2)
`src/services/sessionUser.ts`를 만들고 2장 표의 7곳을 바꾼다. 예:

```ts
// 교체 전
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error("로그인이 필요합니다");
// … user.id

// 교체 후
const { userId } = await getSessionUserId();
if (!userId) throw new Error("로그인이 필요합니다");
// … userId
```
공유 생성(`libraryShare.ts:140-146`)만 `error`가 있으면 `throw new Error(error.message)`를 먼저 한다(현행 유지).

# STEP 5 — 단일 캐시와 방영일 대상 축소 (F-3·F-4)
6장 `useLibrary`·`enrichLibraryMetadata` 항목대로.

# STEP 6 — 문서
`docs/development_next_steps.md` 맨 위 "라이브러리 1000행 잘림·중복 조회 (docs/72)" 항목, `docs/README.md`의 72행 상태, `docs/08_frontend_architecture.md`의 라이브러리 캐시 설명(상태별 캐시 → 단일 캐시 + `select`)을 갱신한다. 실제 화면에서 보지 못한 M 항목은 "코드 검사 통과, 화면 미확인"으로 적는다("검증 완료"라고 쓰지 않는다).

# 엣지 케이스 (전부 처리)
9장 E-1~E-22 전부.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(현재 기준선: 1668개 통과).

추가 검사:
```
grep -rn "auth.getUser" src app --include="*.ts" --include="*.tsx" | grep -v "\.test\."
grep -n "getLibraryItems(" src/hooks/useLibrary.ts
git status --short supabase src/lib app src/components
```
첫 줄은 0줄, 둘째는 `getLibraryItems("all")` 한 줄, 셋째는 빈 출력.

웹 확인은 8081만 쓴다(`npm run web -- --port 8081 --localhost --clear`, 사용 중이면 기존 서버 재사용). 로그인이 필요한 화면은 대신 로그인하지 않고 수동 확인 표로 보고한다. **확인 중 감상 기록을 실제로 바꾸는 동작(M-3·M-4)은 사용자 계정에서 임의로 실행하지 않는다** — 실행하지 못했으면 미확인으로 보고한다.

# DEFINITION OF DONE
- [ ] T-1~T-21이 수정 전에 실패하는 것을 확인했고 수정 후 통과한다
- [ ] 기존 테스트 개수가 줄지 않았다(1668 + 신규)
- [ ] `typecheck`, `lint` 통과
- [ ] 추가 검사 3줄이 기대값과 같다
- [ ] STEP 0의 두 전제를 확인한 결과를 보고했다
- [ ] 웹·앱 수동 확인 표(M-1~M-8)를 확인/미확인으로 구분해 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/batchedQuery.ts
src/utils/batchedQuery.test.ts
src/utils/sessionUser.ts
src/utils/sessionUser.test.ts
src/utils/libraryFilters.ts
src/utils/libraryFilters.test.ts
src/utils/libraryAirDates.ts
src/utils/libraryAirDates.test.ts
src/services/sessionUser.ts
src/services/library.ts
src/services/pins.ts
src/services/people.ts
src/services/reviews.ts
src/services/tags.ts
src/services/libraryShare.ts
src/hooks/useLibrary.ts
docs/development_next_steps.md
docs/README.md
docs/08_frontend_architecture.md
```

# 보고 항목
1. STEP 0 전제 확인 결과(상태 6종 보존 여부, 핀 id 칼럼 이름)
2. STEP 1에서 실패했던 테스트의 실제 출력
3. `npm test` 결과(before / after 통과 개수)
4. `npm run typecheck`, `npm run lint`, 추가 검사 3줄 결과
5. 추가한 테스트 ID와 이름
6. D-1~D-5 중 문제가 있다고 판단한 항목(바꾸지는 말고 보고만). 특히 D-4의 "즉시 빠짐"이 기존 결정과 충돌하는지
7. M-1~M-8 확인 결과(웹/앱 구분, 미확인 사유)
8. 사람이 해야 할 후속 작업(배포는 없음. 실제 화면 확인만)

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
