# 50. 작품 제작진 2단계 — DB 저장·백필·목록 화면 표시

작성일: 2026-10-09
대상 브랜치 기준: `main` (`6734575`) + 미커밋 작업(`docs/49` 1단계 구현 포함). 이 시점 `npm test` 1015개 중 1014개 통과 — 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함
선행 문서: **`docs/49_content_crew_display_spec.md`(1단계: 매핑·상세·빠른 보기 — 이미 구현됨)**, **`docs/00_ui_style_rules.md`**, `docs/44`(핀 탭), `docs/42`(`add-to-library` 응답 뒤 작업)

> 사용자 요청: "모든 화면에서 작품의 감독, 작가도 표시 가능하면 가능하게끔" → "전체 구현해 줘."
> Codex가 1단계 프롬프트의 "13개 파일 외 수정 금지·마이그레이션 생성 금지"에 막혀 멈췄다. 이 명세가 2단계 범위와 **마이그레이션 파일·백필 스크립트 작성 허용**을 정한다. 적용·실행은 사람이 한다.

---

## 1. 문제 정의

| ID | 증상 | 원인 |
|----|------|------|
| S-1 | 라이브러리(목록·갤러리)·핀·공유 화면에 감독·작가가 없다 | 제작진은 외부 상세 응답(`get-content-detail`)에만 있다. DB `contents`에 저장하지 않아, DB를 읽는 목록 화면은 받을 수 없다 |
| S-2 | 외부 API가 실패한 상세 화면(DB 대체 응답)에서도 제작진이 사라진다 | 같은 원인. `get-content-detail` DB 대체 경로가 `crew: []` |
| S-3 | 라이브러리 검색에서 감독·작가 이름으로 찾을 수 없다 | `src/utils/libraryFilters.ts:78` 검색 대상에 제작진이 없다(출연진만 있고, 그마저 비어 있다) |

## 2. 범위

| 화면 | 2단계 처리 |
|------|-----------|
| 라이브러리 목록형 카드(`ContentCard`) | 한 줄 요약(역할당 1명) |
| 라이브러리 갤러리 카드(`ContentGalleryCard`) | 짧은 한 줄(첫 역할 1명) |
| 핀 탭 미리보기 패널(`PinDetailPanel`) | 한 줄 요약(역할당 2명) |
| 공유 화면 항목(`LibraryShareScreenContent`) | 짧은 한 줄 |
| 작품 상세 | 외부 상세에 제작진이 없거나 실패하면 DB 값으로 대체 |
| 라이브러리 검색 | 제작진 이름도 검색 |
| **제외** — 홈(포스터·이어보기 타일), 검색 결과·추천 카드 | 홈 타일은 글자 자리가 없다. 검색·추천 목록은 외부 API 목록이라 DB에 없는 작품이 대부분이다(빠른 보기에 이미 표시됨, `docs/49`) |

## 3. 설계 결정

### D-1. 저장: `contents.crew`(JSONB 배열) + `contents.crew_updated_at`
- 마이그레이션 `0024_content_crew.sql`(5.1). 값은 `docs/49`의 `CrewMemberMeta[]` 모양이고, 역할당 최대 3명, 전체 최대 12명이다.
- `crew_updated_at IS NULL` = 아직 외부에서 가져온 적 없음(백필 대상).
- 빈 배열 + 시각 있음 = 가져왔지만 제작진이 없음(다시 시도하지 않는다).
- RLS는 그대로다: 읽기는 인증 사용자(`contents_select_authenticated`), 쓰기는 service role(Edge·스크립트)만.

### D-2. 쓰기는 "최선 노력"이고, 기존 쓰기와 분리한다
- 기존 `contents` upsert/update 페이로드는 **바꾸지 않는다**. 그 뒤에 별도 update로 `crew`·`crew_updated_at`만 쓴다(`saveContentCrew`).
- 실패해도 요청은 성공한다. 마이그레이션 전 배포에서 컬럼이 없으면 `missing_column`, 그 외 오류는 `failed`로 로그만 남긴다.
- 쓰는 곳은 두 함수다.
  - **`add-to-library`**: 외부 상세를 받은 경로(`fetch_and_insert`)에서만, `runAfterResponse` 작업 안에서 쓴다(`docs/42`, 응답을 늦추지 않음). 빠른 경로(`fast_insert`·`already_exists`)는 외부 조회가 없으니 쓰지 않는다(백필·상세 열람이 채움).
  - **`get-content-detail`**: DB에 있는 작품의 외부 상세를 받은 경로에서 `updateContentSnapshot` 다음에 쓴다. 상세를 열 때마다 최신화된다.
- `bulk-register-netflix`는 바꾸지 않는다(백필이 채움).

### D-3. 읽기는 방어적으로 한다
- 저장된 JSON은 `parseStoredCrew(value)`로 검증한다. 모양이 틀린 항목은 버리고, 역할당 3명·전체 12명으로 자른다.
- 컬럼이 없던 시절 행(`undefined`)이나 잘못된 값은 `[]`다.
- `LibraryListItem.crew?`·`TimelinePin.content_crew?`는 **옵셔널**이다. 테스트 픽스처와 구 응답 호환을 위해서다.

### D-4. 읽는 곳
| 위치 | 변경 |
|------|------|
| `src/services/library.ts` | 이미 `contents(*,…)`라 마이그레이션 후 자동으로 온다. 두 매핑(144·411행 근처 `cast: []`가 있는 곳)에 `crew: parseStoredCrew(row.contents?.crew)` |
| `src/services/pins.ts` | `PIN_SELECT`의 `contents(title_primary,poster_url,source_api,source_id,content_genres(...))`를 `contents(*,content_genres(genres(name)))`로 바꾼다. 컬럼을 이름으로 적으면 마이그레이션 전 400이 나므로 `*`를 쓴다. `mapPin`에 `content_crew: parseStoredCrew(row.contents?.crew)` |
| `get-library-share` | 이미 `contents(*,…)`. 항목에 `crew: parseStoredCrew(row.contents?.crew)` |
| `get-content-detail` DB 대체 경로 | `crew: parseStoredCrew(content.crew)`(지금 `[]`) |
| 작품 상세 화면 | 외부 상세 `crew`가 비었으면 `libraryItem?.crew` |

### D-5. 표시
- 순수 함수는 두 가지다.
  - `createCrewSummary(crew, namesPerRole)`: `docs/49` 그대로. 여러 역할을 이어 쓴다.
  - `createCrewShortLine(crew)`(신규): 첫 역할 1명만. 예: "감독 봉준호", "작가 김은숙 외 1명".
- 위치별로 쓰는 함수와 모양

  | 위치 | 함수 | 모양 |
  |------|------|------|
  | 라이브러리 목록 카드 | `createCrewSummary(crew, 1).text` | 출연진 줄 바로 위, 기존 `styles.cast` 모양, `numberOfLines={1}` |
  | 라이브러리 갤러리 카드 | `createCrewShortLine(crew)` | 같은 자리, `numberOfLines={1}` |
  | 핀 패널 | `createCrewSummary(pin.content_crew, 2).text` | 회차 라벨 아래, `typography.caption` `textMuted`, `numberOfLines={2}` |
  | 공유 항목 | `createCrewShortLine(item.crew)` | 제목 아래 메타 줄 다음, `typography.caption` `textMuted`, `numberOfLines={1}` |
- 비면 렌더하지 않는다(자리를 비워 두지 않음).
- 접근성 라벨은 각 함수의 `accessibilityLabel`이다.

2026-10-25 사용자 후속 요청: 라이브러리 목록·갤러리의 출연진은 검색 추천과 같은 `ContentCast`로 표시한다. API 출연 순서로 중복·빈 이름을 뺀 최대 2명, 한글 표기 우선, 애니 및 애니메이션 영화는 ‘성우’·나머지는 ‘출연배우’다. 제작진 줄은 기존 위치를 유지한다. 저장된 출연진이 없으면 기존 외부 상세 캐시로 조회하고 로딩·실패·정보 없음 안내를 같은 영역에 표시한다. 확장 기능 플래그와 무관하게 노출하며, 수동 등록 작품은 외부 조회 없이 보유 정보만 표시한다.

### D-6. 라이브러리 검색
- `libraryFilters.ts` 검색 대상에 `item.crew`의 `name`·`original_name`을 더한다.
- 검색창 안내 문구는 "작품명, 감독·작가, 출연자 검색"으로 바꾼다(`app/(tabs)/library.tsx` placeholder 한 곳).
- 2026-10-16 사용자 후속 요청: 제목·원제·제작진·출연진의 각 필드와 검색어에서 공백을 제거한 부분 일치도 허용한다(최소 글자 수 제한 없음). 기존 대소문자 무시 검색과 다른 필터를 유지하며, 서로 다른 필드를 붙여 공백 제거 일치를 만들지 않는다.

### D-7. 백필 스크립트(사람이 실행)
- `scripts/backfill-content-crew.ts`. `package.json`에 `"backfill:crew": "tsx scripts/backfill-content-crew.ts"`.
- **기본은 dry-run**(쓰기 없음, 건수만 출력). `--apply`일 때만 쓴다. 기존 `backfill-content-air-date.ts`처럼 `.env`에서 `SUPABASE_SERVICE_ROLE_KEY`·`TMDB_API_KEY`를 읽고, 값은 출력하지 않는다.
- 대상: `crew_updated_at IS NULL AND source_api IN ('tmdb','anilist')`, `--limit N`(기본 200).
- 조회
  - TMDB: `GET /3/{movie|tv}/{id}?language=ko-KR&append_to_response=credits` → `mapTmdbCrew(credits.crew, tv면 created_by)`
  - AniList: staff 질의 → `mapAniListStaff`
  - 매핑 함수는 `supabase/functions/_shared/contentCrew.ts`를 import해 재사용한다(순수 모듈).
- 속도
  - TMDB는 요청 사이 250ms.
  - AniList는 요청 사이 800ms. HTTP 429면 `Retry-After`(없으면 60초)만큼 쉬고 1회 재시도한다.
- 실패한 작품은 `crew_updated_at`을 쓰지 않는다(다음 실행에서 재시도). 제작진이 없으면 빈 배열과 시각을 쓴다.
- 출력은 대상·저장·빈 결과·실패·건너뜀 건수만이다(제목·키 출력 금지).
- Kitsu·TVmaze·manual은 건너뛴다(건수만 보고).

### D-8. 배포·적용 순서(사람)
1. 마이그레이션 `0024` 적용
2. `get-content-detail`·`add-to-library`·`get-library-share` 재배포. 셋 다 운영이 stale이라 쌓인 다른 변경도 함께 나간다. `npm run edge:drift`로 확인한다.
3. `npm run backfill:crew`(dry-run) → `npm run backfill:crew -- --apply`
4. 수동 확인

1·2는 순서가 바뀌어도 깨지지 않는다(D-2·D-3).

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 4. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 별도 테이블 `content_credits`(사람·역할 행) | 인물 단위 조회·검색 기능이 아직 없다. 표시만 하는 지금은 JSONB 한 칸이 단순하고 목록 질의를 바꾸지 않아도 된다 |
| 기존 upsert 페이로드에 `crew`를 섞기 | 마이그레이션 전 배포 시 콘텐츠 저장 자체가 실패할 수 있다. 분리하면 최선 노력으로 끝난다 |
| 핀 select에 `crew`를 이름으로 추가 | 마이그레이션 전 400으로 핀 목록 전체가 깨진다. `*`가 안전하다 |
| 백필을 Edge Function으로 | 사용자 JWT가 필요한 함수들이다. 일회성 일괄 작업은 기존 스크립트 패턴이 맞다 |
| 검색·추천 카드에 DB 조회로 붙이기 | 대부분 DB에 없는 작품이라 일부만 보여 오히려 들쭉날쭉하다 |

## 5. 계약

### 5.1 `supabase/migrations/0024_content_crew.sql` (신규 — 작성만, 적용은 사람)
```sql
ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS crew JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS crew_updated_at TIMESTAMPTZ;

ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_crew_is_array;
ALTER TABLE contents
  ADD CONSTRAINT contents_crew_is_array CHECK (jsonb_typeof(crew) = 'array');

COMMENT ON COLUMN contents.crew IS
  '외부 API 제작진 요약(감독·작가·원작·크리에이터). 역할당 최대 3명, 전체 최대 12명. get-content-detail·add-to-library·backfill-content-crew가 채운다.';
COMMENT ON COLUMN contents.crew_updated_at IS
  '제작진을 외부 API에서 마지막으로 가져온 시각. NULL이면 아직 가져온 적 없음(백필 대상).';

CREATE INDEX IF NOT EXISTS idx_contents_crew_pending
  ON contents (id)
  WHERE crew_updated_at IS NULL;
```
`src/types/database.ts`의 `contents` Row/Insert/Update에 `crew: Json`(Insert·Update는 옵셔널), `crew_updated_at: string | null`을 더한다.

### 5.2 `supabase/functions/_shared/contentCrew.ts` (추가 — 순수)
```ts
export const CREW_TOTAL_LIMIT = 12;
/** 저장·응답 전에 모양·개수를 정리한다(역할당 CREW_ROLE_LIMIT, 전체 CREW_TOTAL_LIMIT, 역할 순서 유지). */
export function serializeCrewForStorage(crew: readonly CrewMemberMeta[] | null | undefined): CrewMemberMeta[];
/** DB JSON을 검증해 CrewMemberMeta[]로. 잘못된 항목은 버린다. */
export function parseStoredCrew(value: unknown): CrewMemberMeta[];
```
- 항목이 유효하려면 다음을 모두 만족해야 한다.
  - `id`가 유한한 숫자
  - `name`이 trim 후 비지 않은 문자열
  - `role`이 4개 역할 중 하나
  - `job`이 문자열(없으면 `""`로 보정)
  - `original_name`·`profile_url`이 문자열 또는 `null`(그 밖의 값은 `null`로)
- 둘 다 같은 정리 규칙(역할 순서 director → writer → original → creator, 역할당 3명, 같은 역할 안 id 중복 제거, 전체 12명)을 적용한다.

### 5.3 `supabase/functions/_shared/contentCrewStore.ts` (신규)
```ts
export interface CrewStoreClient {
  from(table: "contents"): {
    update(patch: { crew: unknown; crew_updated_at: string }): {
      eq(column: "id", value: string): PromiseLike<{ error: { code?: string; message?: string } | null }>;
    };
  };
}
export type CrewSaveResult = "saved" | "missing_column" | "failed";
export async function saveContentCrew(
  client: CrewStoreClient,
  contentId: string,
  crew: readonly CrewMemberMeta[] | null | undefined,
  now?: Date
): Promise<CrewSaveResult>;
```
- 패치: `{ crew: serializeCrewForStorage(crew), crew_updated_at: (now ?? new Date()).toISOString() }`
- 결과
  - 오류 없음 → `"saved"`
  - `error.code === "42703"` 또는 메시지에 `crew`가 들어 있음 → `"missing_column"`
  - 그 밖의 오류, 또는 예외를 던짐 → `"failed"`
- **절대 throw하지 않는다.** Supabase 클라이언트 import 금지(구조 타입만).

### 5.4 Edge Function
| 파일 | 변경 |
|------|------|
| `add-to-library/index.ts` | `fetch_and_insert` 경로에서 `runAfterResponse`에 넘기는 작업 안에 `saveContentCrew(adminClient, contentId, contentMeta.crew)`를 더한다(결과가 `"failed"`면 `console.warn`, 제목·키 없이). 응답 형태·순서는 그대로다 |
| `get-content-detail/index.ts` | DB 행 경로: `updateContentSnapshot` 다음에 `await saveContentCrew(...)`(결과는 무시, `"failed"`면 `console.warn`). DB 대체 경로(138행 `crew: []`) → `crew: parseStoredCrew(content.crew)` |
| `get-library-share/index.ts` | 항목 매핑(`cast: []` 옆)에 `crew: parseStoredCrew(row.contents?.crew)`. `ContentRow` 타입에 `crew?: unknown` |

### 5.5 앱
| 파일 | 변경 |
|------|------|
| `src/types/library.ts` | `LibraryListItem`에 `crew?: CrewMember[]` |
| `src/types/pins.ts` | `TimelinePin`에 `content_crew?: CrewMember[]` |
| `src/services/library.ts` | 두 매핑에 `crew: parseStoredCrew(row.contents?.crew)`(raw row 타입에 `crew?: unknown`). `parseStoredCrew`는 `../../supabase/functions/_shared/contentCrew`에서 런타임 import(기존 `discoveryFilters` 패턴) |
| `src/services/pins.ts` | D-4 `PIN_SELECT` 변경, `mapPin`에 `content_crew`, raw 타입 `crew?: unknown` |
| `src/utils/contentCrew.ts` | `createCrewShortLine(crew): { text: string; accessibilityLabel: string }` 추가(5.6) |
| `src/utils/libraryFilters.ts` | 검색 필드에 `...(item.crew ?? []).flatMap((m) => [m.name, m.original_name])` |
| `app/(tabs)/library.tsx` | 검색 placeholder "작품명, 감독·작가, 출연자 검색" |
| `src/components/content/ContentCard.tsx` | 출연진 줄 위에 요약 줄(D-5) |
| `src/components/content/ContentGalleryCard.tsx` | 같은 자리에 짧은 줄(D-5) |
| `src/components/pins/PinDetailPanel.tsx` | 회차 라벨 아래 요약 줄(D-5) |
| `src/components/library/LibraryShareScreenContent.tsx` | 항목 메타 줄 다음에 짧은 줄(D-5) |
| `app/content/[id].tsx` | `createCrewSummary(externalDetail.data?.content.crew?.length ? externalDetail.data.content.crew : libraryItem?.crew)` |

### 5.6 `createCrewShortLine`
1. 역할 순서 director → writer → original → creator 중, 이름(trim 후 비지 않은 것, 이름 기준 중복 제거)이 1명 이상인 첫 역할을 고른다.
2. `text = `${label} ${첫 이름}${나머지 > 0 ? ` 외 ${나머지}명` : ""}``, `accessibilityLabel = text`.
3. 없으면 `{ text: "", accessibilityLabel: "" }`.

### 5.7 `scripts/backfill-content-crew.ts`
D-7 그대로다. 조회·저장 사이 판정은 순수 함수로 빼서 테스트한다(`scripts/backfillContentCrew.ts`).
```ts
export interface BackfillArgs { apply: boolean; limit: number }
export function parseBackfillArgs(argv: readonly string[]): BackfillArgs;   // 기본 { apply: false, limit: 200 }; "--apply", "--limit", "N" | "--limit=N"; 잘못된 limit → 200; 상한 2000
export function backfillTarget(row: { source_api: string; source_id: string | null; content_type: string }):
  { kind: "tmdb"; mediaType: "movie" | "tv"; id: string } | { kind: "anilist"; id: string } | { kind: "skip" };
// tmdb + 숫자 id → content_type === "movie" ? "movie" : "tv"; anilist + 숫자 id → anilist; 그 외 skip
export function retryDelayMs(retryAfterHeader: string | null): number;      // 정수 초면 ×1000(1~300초로 자름), 아니면 60000
```

## 6. 엣지 케이스

| # | 상황 | 기대 동작 | 연결 |
|---|------|----------|------|
| E-1 | 마이그레이션 전 Edge 배포 | 저장 `missing_column`, 응답 정상, 목록 `crew` 빈 값 | W-2, M-4 |
| E-2 | 마이그레이션 후·백필 전 | 상세를 연 작품·새로 추가한 작품만 목록에 제작진 | M-1 |
| E-3 | 백필 dry-run | 쓰기 0, 건수만 | B-1, M-5 |
| E-4 | 백필 중 TMDB 404·네트워크 오류 | 그 작품 실패 건수, `crew_updated_at` 미기록 | M-5 |
| E-5 | AniList 429 | `Retry-After` 대기 후 1회 재시도 | B-3 |
| E-6 | 제작진 없는 작품 | `crew: []` + 시각, 다시 대상 아님, 화면 줄 없음 | P-3, L-3 |
| E-7 | 손상된 JSON(문자열·객체·잘못된 항목) | 유효한 항목만, 없으면 `[]` | P-1~P-4 |
| E-8 | 한 역할 5명 저장 시도 | 3명만 저장 | P-5 |
| E-9 | 라이브러리 "봉준호" 검색 | 기생충 등 찾음 | F-1 |
| E-10 | 외부 상세 실패한 작품 상세 | DB 제작진으로 히어로 줄 | M-1 |
| E-11 | 핀 탭(핀 select `*`) | 기존 핀 표시·필드 그대로, 패널에 제작진 | M-2 |
| E-12 | 공유 화면(로그인 안 한 사람) | 항목에 짧은 줄 | M-3 |

## 7. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다. 한 행 = `it` 하나.** L-4는 1단계 `createCrewSummary`(이미 구현)의 `namesPerRole` 동작을 지키는 **보존 테스트**라 구현 전에도 통과하는 것이 정상이다(2026-10-09 Codex 보고로 정정). 그 외 행은 구현 전에 실패해야 한다.
헬퍼 `c(id, name, role, extra?)` → `{ id, name, original_name: null, role, job: role, profile_url: null, ...extra }`.

### `supabase/functions/_shared/contentCrew.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| P-1 | `parseStoredCrew("x")`, `(null)`, `(undefined)`, `({})`, `(42)` | 모두 `[]` |
| P-2 | `[c(1,"봉준호","director"), { id: "2", name: "x", role: "director" }, { id: 3, name: "  ", role: "writer" }, { id: 4, name: "한진원", role: "actor" }, c(5,"한진원","writer")]` | `[c(1,…director), c(5,…writer)]` |
| P-3 | `[{ id: 7, name: "이름", role: "writer" }]`(job·original_name·profile_url 없음) | `[{ id: 7, name: "이름", original_name: null, role: "writer", job: "", profile_url: null }]` |
| P-4 | `[{ ...c(8,"A","original"), original_name: 3, profile_url: {} }]` | `original_name: null`, `profile_url: null` |
| P-5 | director 5명 + writer 1명(writer가 앞에 있음) | director 3명이 앞, writer 1명이 뒤(총 4) |
| P-6 | 역할 4개 × 4명(16명) | 역할당 3명, 총 12명, 순서 director → writer → original → creator |
| P-7 | `serializeCrewForStorage([c(1,"A","director"), c(1,"A","director"), c(2,"B","writer")])`, `(undefined)` | `[c(1,"A","director"), c(2,"B","writer")]`, `[]` |

### `supabase/functions/_shared/contentCrewStore.test.ts` (신규, 가짜 클라이언트)
| ID | 입력 | 기대 |
|----|------|------|
| W-1 | 오류 없는 클라이언트, `now = new Date("2026-10-09T00:00:00.000Z")`, crew 5 director | `"saved"`, 넘긴 패치 `crew` 길이 3, `crew_updated_at "2026-10-09T00:00:00.000Z"`, `eq("id", contentId)` 호출 |
| W-2 | `error: { code: "42703", message: "column contents.crew does not exist" }` / `error: { message: "Could not find the 'crew_updated_at' column" }` | 둘 다 `"missing_column"` |
| W-3 | `error: { code: "500", message: "boom" }` / `update`가 throw | 둘 다 `"failed"`(reject 없음) |

### `src/utils/contentCrew.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| L-1 | `createCrewShortLine([c(2,"한진원","writer"), c(1,"봉준호","director")])` | `{ text: "감독 봉준호", accessibilityLabel: "감독 봉준호" }` |
| L-2 | writer 3명(A·B·C), 감독 없음 | `"작가 A 외 2명"` |
| L-3 | `[]`, `undefined`, 이름 공백뿐 | `{ text: "", accessibilityLabel: "" }` |
| L-4 (보존) | `createCrewSummary([c(1,"A","director"), c(2,"B","director"), c(3,"C","writer")], 1).text` | `"감독 A 외 1명 · 작가 C"` |

### `src/utils/libraryFilters.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| F-1 | 항목 2개(하나는 `crew: [c(1,"봉준호","director")]`, 하나는 crew 없음), 검색어 `"봉준호"` | 첫 항목만 |
| F-2 | `crew: [{ ...c(2,"斎藤圭一郎","director"), original_name: "Keiichiro Saito" }]`, 검색어 `"saito"` | 찾음 |

### `scripts/backfillContentCrew.test.ts` (신규)
| ID | 입력 | 기대 |
|----|------|------|
| B-1 | `parseBackfillArgs([])`, `(["--apply"])`, `(["--limit","50"])`, `(["--limit=5000"])`, `(["--limit","x"])` | `{false,200}`, `{true,200}`, `{false,50}`, `{false,2000}`, `{false,200}` |
| B-2 | `backfillTarget({source_api:"tmdb",source_id:"496243",content_type:"movie"})`, `({tmdb,"136283","drama"})`, `({anilist,"154587","anime"})`, `({kitsu,"1","anime"})`, `({tmdb,"abc","movie"})`, `({manual,null,"movie"})` | tmdb movie, tmdb tv, anilist, skip, skip, skip |
| B-3 | `retryDelayMs("30")`, `("0")`, `("999")`, `(null)`, `("soon")` | `30000`, `1000`, `300000`, `60000`, `60000` |

### 수동 확인 (사람, 로그인 필요 — D-8 이후)

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 라이브러리 목록·갤러리 카드 제작진 줄, "봉준호" 검색, 외부 상세 실패 작품 상세에 DB 제작진 |
| M-2 | 웹 1440 + 375 | 핀 탭 패널 제작진 줄, 핀 목록·필터 기존대로 |
| M-3 | 웹(로그아웃 창) | 공유 링크 항목 짧은 줄 |
| M-4 | 운영 | 마이그레이션 전 배포에서 추가·상세가 정상(E-1) |
| M-5 | 터미널 | `npm run backfill:crew`(dry-run 건수) → `-- --apply` 결과 건수, 재실행 시 대상 감소 |
| M-6 | 앱(iOS 세로) | 라이브러리·핀 줄 잘림 없음, 글자 1.3배 |

## 8. 변경 파일

| 파일 | 변경 |
|------|------|
| `supabase/migrations/0024_content_crew.sql` | 신규(5.1, 작성만) |
| `src/types/database.ts` | 5.1 |
| `supabase/functions/_shared/contentCrew.ts`(+test) | 5.2, P-1~P-7 |
| `supabase/functions/_shared/contentCrewStore.ts`(+test) | 신규 5.3, W-1~W-3 |
| `supabase/functions/add-to-library/index.ts` | 5.4 |
| `supabase/functions/get-content-detail/index.ts` | 5.4 |
| `supabase/functions/get-library-share/index.ts` | 5.4 |
| `src/types/library.ts`, `src/types/pins.ts` | 5.5 |
| `src/services/library.ts`, `src/services/pins.ts` | 5.5 |
| `src/utils/contentCrew.ts`(+test) | 5.6, L-1~L-4 |
| `src/utils/libraryFilters.ts`(+test) | D-6, F-1·F-2 |
| `app/(tabs)/library.tsx` | placeholder 한 줄 |
| `src/components/content/ContentCard.tsx`, `ContentGalleryCard.tsx` | D-5 |
| `src/components/pins/PinDetailPanel.tsx` | D-5 |
| `src/components/library/LibraryShareScreenContent.tsx` | D-5 |
| `app/content/[id].tsx` | D-4 대체 |
| `scripts/backfill-content-crew.ts`, `scripts/backfillContentCrew.ts`(+test) | 5.7, B-1~B-3 |
| `package.json` | `backfill:crew` 스크립트 한 줄 |

## 9. 범위 밖
| 항목 | 이유 |
|------|------|
| 홈 타일·검색/추천 카드 | 2장 |
| 제작진 이름으로 인물 상세·좋아하는 인물 | 인물 기능은 배우·성우만(`docs/34`) |
| 제작진 기반 추천 가중치 | 별도 |
| `bulk-register-netflix` 저장 | 백필이 채움 |
| 마이그레이션 적용·배포·백필 실행 | 사람(D-8) |

## 10. 확실하지 않음
1. `contents(*)`로 바꾼 핀 질의의 응답 크기. 핀 수백 개 기준으로 overview 등이 늘지만 체감 영향은 작다고 판단한다. M-2에서 로딩을 확인한다.
2. AniList 백필 속도(분당 요청 제한). 애니 작품 수에 따라 수 분이 걸릴 수 있다. `--limit`로 나눠 실행한다.
