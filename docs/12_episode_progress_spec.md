# SceneNote — 시청 진행 위치(몇 화부터 볼지) 설정 기능 구현 명세서

**문서 버전:** 1.0.0
**작성일:** 2026-08-23
**상태:** 구현 지시서 (Codex 구현 대상)
**선행 문서:** [11_screen_implementation_spec.md](./11_screen_implementation_spec.md), [05_erd_rls.md](./05_erd_rls.md), [08_frontend_architecture.md](./08_frontend_architecture.md)
**기능 ID:** FEAT-PROGRESS-01

---

## 1. 문제 정의

### 1.1 현재 증상

라이브러리 갤러리/리스트 카드에서 "보는 중" 작품 대부분이 **`1화부터 시작`** 배지를 표시한다. 사용자가 이미 12화까지 봤어도 카드에는 계속 `1화부터 시작`이 뜨며, **이 값을 바꿀 수 있는 UI가 앱 어디에도 없다.**

### 1.2 근본 원인

| # | 원인 | 근거 |
|---|------|------|
| C-1 | 라벨이 `watched_episode_count === 0`이면 무조건 `"1화부터 시작"`을 반환 | [`createContinueWatchingLabel`](../src/utils/continueWatching.ts) 13행 |
| C-2 | `watched_episode_count`는 `user_episode_progress` 행 수에서만 파생됨 | [`enrichLibraryMetadata`](../src/services/library.ts) — `createProgressSummaries` |
| C-3 | 진행률을 기록하려면 `/content/[id]/episodes`에서 회차를 **한 개씩 체크**해야 함 | [`EpisodeSelector`](../src/components/content/EpisodeSelector.tsx) — 행 단위 체크박스만 존재 |
| C-4 | 에피소드 체크는 `seasons` / `episodes` 테이블에 캐시가 있어야 가능. 엑셀 대량 등록(`bulk-register-netflix`) 경로는 에피소드를 채우지 않음 | [`getEpisodes`](../src/services/library.ts) — DB 비면 `fetch-episodes` 호출 필요 |
| C-5 | `user_library_items`에 "몇 화까지 봤는지"를 직접 저장할 컬럼이 없음 | [`0001`](../supabase/migrations/0001_initial_schema.sql) ~ [`0019`](../supabase/migrations/0019_backfill_content_themes.sql) 전체 |

즉 **파생 진행률(episode_progress)만 존재하고, 사용자가 직접 선언하는 진행률(manual)이 존재하지 않는 것**이 근본 원인이다. 24화짜리 애니를 12화까지 본 것을 기록하려면 지금은 회차를 12번 눌러야 하고, 에피소드 캐시가 없으면 그조차 불가능하다.

### 1.3 이 문서의 범위

콘텐츠 상세 화면에서 **"여기까지 봤어요"를 한 번에 설정**하고, 그 값이 라이브러리 카드의 이어보기 배지와 에피소드 목록에 일관되게 반영되도록 하는 전 계층(마이그레이션 → 서비스 → 유틸 → 훅 → UI) 구현을 정의한다.

---

## 2. 목표 / 비목표

### 2.1 목표 (P0)

1. 콘텐츠 상세 화면에서 시리즈 작품의 **시청 진행 위치를 직접 설정·수정·초기화**할 수 있다.
2. 설정한 값이 라이브러리 카드에 **`다음: N화`** 형태로 즉시 반영된다.
3. 에피소드 체크(`user_episode_progress`)와 수동 설정값이 **서로 모순되지 않는다.**
4. 진행 위치를 한 번도 설정하지 않은 작품은 `1화부터 시작`이 아니라 **`시청 위치 설정` CTA**를 노출한다. (사용자가 명시적으로 "0화 = 아직 안 봄"을 선택한 경우에만 `1화부터 시작`을 표시한다.)
5. 마이그레이션이 원격에 적용되기 전에도 앱이 **크래시 없이 기존 동작으로 폴백**한다.

### 2.2 목표 (P1 — 같은 PR에 포함하되 P0 이후 구현)

6. 에피소드 목록 행에서 **"여기까지 봤음"** 액션으로 해당 회차까지 한 번에 진행 위치를 설정한다.
7. 라이브러리 카드의 이어보기 배지를 누르면 진행 위치 설정 카드로 **딥링크 포커스**된다.

### 2.3 비목표

- 시청 시각(타임코드) 단위 이어보기 — 타임라인 핀의 영역이며 이 기능과 무관하다.
- 외부 스트리밍 서비스와의 진행률 동기화.
- 에피소드별 시청 일시 기록 — 기존 `user_episode_progress.watched_at`을 그대로 둔다.
- `watch_count`(작품 전체 감상 횟수) 로직 변경 — **건드리지 않는다.**

---

## 3. 용어 정의

| 용어 | 정의 |
|------|------|
| **절대 회차 (absolute episode number)** | 모든 시즌을 이어붙인 통합 번호. 시즌1이 12화면 시즌2 3화의 절대 회차는 15. 기존 [`createSeasonOffsets`](../src/services/library.ts)와 동일한 규칙. |
| **시즌 상대 회차 (season-relative)** | 사용자가 실제로 인지·입력하는 값. `(시즌 번호, 시즌 내 회차)` 쌍. |
| **파생 진행률 (derived progress)** | `user_episode_progress` 체크에서 계산된 값. 현재 `watched_episode_count` / `maxWatchedEpisodeNumber`. |
| **수동 진행률 (manual progress)** | 사용자가 상세 화면에서 직접 선언한 "여기까지 봤어요" 값. 이번에 신규 도입. |
| **유효 진행률 (effective progress)** | 파생/수동을 우선순위 규칙으로 합성한 최종 값. UI와 라벨은 **항상 이 값만** 사용한다. |
| **watched-through** | "여기까지 봤다"는 의미의 절대 회차. `0` = 아직 아무것도 안 봄. |
| **next episode** | 다음에 볼 회차 = `watched-through + 1`. 완주 시 `null`. |

---

## 4. 설계 결정 (Design Decisions)

각 결정은 **결정 / 이유 / 기각한 대안**을 함께 기록한다. Codex는 이 결정을 임의로 바꾸지 말 것.

### D-1. 저장 위치는 `user_library_items` 컬럼

- **결정:** 별도 테이블이 아니라 `user_library_items`에 컬럼 3개를 추가한다.
- **이유:** 작품당 정확히 1개 값이고, 라이브러리 목록 조회([`LIBRARY_ITEM_SELECT`](../src/services/library.ts))가 이미 이 테이블을 읽으므로 **추가 쿼리·조인 없이** 목록 카드에 반영된다. RLS 정책도 이미 존재한다.
- **기각한 대안:** `user_episode_progress`에 가상 행을 넣는 방식 — `episode_id` FK가 필수라 에피소드 캐시가 없는 작품(C-4)에 쓸 수 없다.

### D-2. "다음 볼 화"가 아니라 "여기까지 봤음"을 저장

- **결정:** `watched-through` 시맨틱으로 저장한다. `0`은 "아직 안 봄", `NULL`은 "설정한 적 없음"으로 **명확히 구분**한다.
- **이유:** 에피소드 체크와 의미가 동일("봤다")해서 두 소스를 `max` / 비교 연산으로 합성할 수 있다. "다음 볼 화"로 저장하면 아직 안 본 상태를 `1`로 표현해야 해서 "1화를 봤고 2화가 다음"과 구분이 안 된다.
- **기각한 대안:** `next_episode_number`를 직접 저장 — 위 사유로 0/1 경계가 모호해진다.

### D-3. 시즌 상대 회차로 저장하고, 읽을 때 절대 회차로 변환

- **결정:** DB에는 `(manual_watched_season_number, manual_watched_episode_number)`를 **사용자가 입력한 그대로** 저장한다. 절대 회차는 조회 시 현재 `seasons` 데이터로 계산한다.
- **이유:** 등록 시점에는 `seasons` 캐시가 비어 있다가(C-4) 나중에 `fetch-episodes`로 채워지는 경우가 흔하다. 절대 회차를 저장해 두면 시즌 정보가 나중에 도착했을 때 **저장값이 소급해서 틀려진다.** 상대 회차는 시즌 정보가 도착해도 의미가 변하지 않는다.
- **보완:** `seasons`가 없으면 `manual_watched_season_number = NULL`, 오프셋 0으로 취급한다. 나중에 시즌 정보가 들어와도 시즌1 오프셋은 0이므로 결과가 일치한다.
- **기각한 대안:** 절대 회차만 저장 — 위 소급 오류 발생.

### D-4. 수동값이 설정되어 있으면 수동값이 권위(authoritative)

- **결정:** `manual_watched_episode_number IS NOT NULL`이면 유효 진행률 = 수동값. 파생 진행률은 무시하되 UI에 참고값으로 보여준다.
- **이유:** 사용자가 명시적으로 지정한 값을 시스템이 조용히 덮어쓰면 신뢰가 깨진다. 되돌리려면 **명시적인 "에피소드 체크 기준으로 되돌리기"** 버튼으로 `NULL`로 복원한다.
- **기각한 대안:** `max(수동, 파생)` — 재시청·정정을 위해 값을 **낮출 수 없다.**
- **기각한 대안:** 타임스탬프 비교로 최신 승리 — 동작을 사용자가 예측할 수 없다.

### D-5. 에피소드 체크 시 수동값을 자동 재동기화

수동값과 체크 상태가 모순되는 것을 원천 차단한다. `manual`이 `NULL`이면 아무것도 하지 않는다.

| 사용자 행동 | 조건 | 수동값 처리 |
|---|---|---|
| 회차 N을 **봄**으로 체크 | `manual === null` | 변경 없음 (파생 모드 유지) |
| 회차 N을 **봄**으로 체크 | `abs(N) > manual` | `manual := abs(N)` |
| 회차 N을 **봄**으로 체크 | `abs(N) <= manual` | 변경 없음 |
| 회차 N을 **안 봄**으로 해제 | `manual === null` | 변경 없음 |
| 회차 N을 **안 봄**으로 해제 | `manual >= abs(N)` | `manual := abs(N) - 1` |
| 회차 N을 **안 봄**으로 해제 | `manual < abs(N)` | 변경 없음 |

### D-6. 미설정 상태의 라벨을 `1화부터 시작` → `시청 위치 설정`으로 변경

- **결정:** 유효 진행률의 `source === "none"`(수동 미설정 + 체크 0건)이면 라벨을 `시청 위치 설정`으로 바꾸고, 탭하면 상세 화면의 진행 카드로 이동한다.
- **이유:** 이 기능 요구의 출발점이 "1화부터 시작이라고 나오는데 설정할 곳이 없다"이다. 라벨 자체를 진입점으로 만든다.
- **`1화부터 시작` 유지 조건:** 사용자가 **명시적으로 0화로 저장**한 경우(`manual === 0`)에만 표시한다.

### D-7. 마이그레이션 미적용 환경에서의 폴백

- **결정:** 신규 컬럼명을 [`isMissingOptionalLibraryColumnError`](../src/services/library.ts)의 감시 목록에 추가한다. 컬럼이 없으면 `LIBRARY_ITEM_FALLBACK_SELECT`로 재조회하고, 진행 카드는 "이 기능은 아직 사용할 수 없습니다" 비활성 상태로 렌더한다.
- **이유:** 원격 Supabase에 `0017`~`0019`가 아직 적용되지 않은 전례가 있다([11번 문서 §2 P0 항목](./11_screen_implementation_spec.md)). 같은 사고를 반복하지 않는다.

---

## 5. 데이터 모델

### 5.1 마이그레이션

**신규 파일:** `supabase/migrations/0020_user_library_manual_episode_progress.sql`

```sql
ALTER TABLE user_library_items
  ADD COLUMN IF NOT EXISTS manual_watched_season_number INTEGER,
  ADD COLUMN IF NOT EXISTS manual_watched_episode_number INTEGER,
  ADD COLUMN IF NOT EXISTS manual_progress_updated_at TIMESTAMPTZ;

ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_manual_watched_episode_number_check;

ALTER TABLE user_library_items
  ADD CONSTRAINT user_library_items_manual_watched_episode_number_check
  CHECK (
    manual_watched_episode_number IS NULL
    OR (manual_watched_episode_number >= 0 AND manual_watched_episode_number <= 9999)
  );

ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_manual_watched_season_number_check;

ALTER TABLE user_library_items
  ADD CONSTRAINT user_library_items_manual_watched_season_number_check
  CHECK (
    manual_watched_season_number IS NULL
    OR (manual_watched_season_number >= 0 AND manual_watched_season_number <= 999)
  );

-- 시즌만 있고 회차가 없는 반쪽 상태를 금지한다.
ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_manual_progress_pair_check;

ALTER TABLE user_library_items
  ADD CONSTRAINT user_library_items_manual_progress_pair_check
  CHECK (
    manual_watched_season_number IS NULL
    OR manual_watched_episode_number IS NOT NULL
  );

COMMENT ON COLUMN user_library_items.manual_watched_season_number IS
  '사용자가 직접 설정한 진행 위치의 시즌 번호. 시즌 정보가 없거나 단일 시즌이면 NULL. 표시·재편집용이며 정렬 기준이 아니다.';

COMMENT ON COLUMN user_library_items.manual_watched_episode_number IS
  '사용자가 직접 설정한 "여기까지 봤음" 회차(해당 시즌 내 상대 회차). NULL = 설정한 적 없음(파생 진행률 사용), 0 = 명시적으로 아직 안 봄.';

COMMENT ON COLUMN user_library_items.manual_progress_updated_at IS
  '수동 진행 위치를 마지막으로 저장한 시각. 진단·정렬 보조용이며 우선순위 판정에는 사용하지 않는다.';

CREATE INDEX IF NOT EXISTS idx_user_library_items_manual_progress
  ON user_library_items (user_id, manual_progress_updated_at DESC)
  WHERE manual_watched_episode_number IS NOT NULL;
```

**RLS:** 기존 `user_library_items` 정책이 행 단위이므로 **추가 정책 불필요.** 단 `UPDATE` 정책이 컬럼 목록을 열거하고 있다면 신규 컬럼을 반드시 포함시킬 것 — 적용 전 `supabase/migrations/0001_initial_schema.sql`의 정책 정의를 확인하고, 열거형이면 이 마이그레이션에서 `CREATE OR REPLACE POLICY`로 갱신한다. **[확인 필요]**

**롤백 스크립트** (문서에만 기록, 파일 생성하지 않음):

```sql
ALTER TABLE user_library_items
  DROP COLUMN IF EXISTS manual_watched_season_number,
  DROP COLUMN IF EXISTS manual_watched_episode_number,
  DROP COLUMN IF EXISTS manual_progress_updated_at;
```

### 5.2 백필

**백필하지 않는다.** 기존 사용자의 `manual_*`은 전부 `NULL`(= 미설정)이며, 파생 진행률 동작이 그대로 유지된다. D-6에 따라 라벨만 `시청 위치 설정`으로 바뀐다.

---

## 6. 타입 변경

**파일:** `src/types/library.ts`

```ts
export type EpisodeProgressSource = "manual" | "episode_progress" | "none";

export interface LibraryItem {
  // ...기존 필드 유지
  manual_watched_season_number: number | null;
  manual_watched_episode_number: number | null;
  manual_progress_updated_at: string | null;
}

export interface LibraryListItem {
  // ...기존 필드 유지
  episode_count: number | null;
  watched_episode_count: number;
  next_episode_number: number | null;

  /** 사용자가 입력한 그대로의 시즌 번호. 미설정이면 null. */
  manual_watched_season_number: number | null;
  /** 사용자가 입력한 그대로의 시즌 내 회차. null=미설정, 0=아직 안 봄. */
  manual_watched_episode_number: number | null;
  /** 위 상대 회차를 현재 seasons 오프셋으로 변환한 절대 회차. 미설정이면 null. */
  manual_watched_absolute_number: number | null;
  /** 유효 진행률의 출처. 카드/라벨은 이 값으로 분기한다. */
  progress_source: EpisodeProgressSource;
  /** 유효 진행률. 항상 0 이상. */
  effective_watched_through: number;
  /** 시즌 번호 → 절대 회차 오프셋. 상세 화면 편집기에 필요. */
  season_episode_counts: SeasonEpisodeCount[];
}

export interface SeasonEpisodeCount {
  season_number: number;
  episode_count: number | null;
}
```

> `next_episode_number`는 **유효 진행률 기준으로 재계산된 값**으로 의미를 확장한다. 기존 소비처([`ContentCard`](../src/components/content/ContentCard.tsx), [`ContentGalleryCard`](../src/components/content/ContentGalleryCard.tsx))는 변경 없이 개선된 값을 받는다.

---

## 7. 순수 유틸 — `src/utils/episodeProgress.ts` (신규)

모든 진행률 계산 로직을 **네트워크·React와 무관한 순수 함수**로 이 파일에 모은다. UI·서비스·훅은 여기 정의된 함수만 호출한다.

```ts
import type {
  EpisodeProgressSource,
  LibraryListItem,
  SeasonEpisodeCount
} from "@/types/library";
import type { ContentType } from "@/types/content";

export const MAX_MANUAL_EPISODE_NUMBER = 9999;

export interface EpisodeProgressInput {
  contentType: ContentType;
  /** 모든 시즌 합산 총 화수. 모르면 null. */
  episodeCount: number | null;
  /** user_episode_progress 체크 건수. */
  watchedEpisodeCount: number;
  /** 체크된 회차 중 최대 절대 회차. episode_number가 없으면 null. */
  derivedWatchedThrough: number | null;
  /** 수동값의 절대 회차. 미설정이면 null. */
  manualWatchedThrough: number | null;
}

export interface ResolvedEpisodeProgress {
  source: EpisodeProgressSource;
  /** 여기까지 봤음. 0 이상. */
  watchedThrough: number;
  /** 다음에 볼 회차. 완주했거나 영화면 null. */
  nextEpisodeNumber: number | null;
  totalEpisodes: number | null;
  isComplete: boolean;
  /** 0..1. 총 화수를 모르면 null. */
  progressRatio: number | null;
}

export function resolveEpisodeProgress(
  input: EpisodeProgressInput
): ResolvedEpisodeProgress;

/** 시즌 번호별 누적 오프셋. 시즌1 → 0, 시즌2 → 시즌1 화수, ... */
export function createSeasonOffsetsByNumber(
  seasons: SeasonEpisodeCount[]
): Map<number, number>;

/** 시즌 상대 회차 → 절대 회차. episodeNumber가 0이면 오프셋을 더하지 않고 0을 반환. */
export function toAbsoluteEpisodeNumber(
  seasonNumber: number | null,
  episodeNumber: number | null,
  offsetsBySeasonNumber: Map<number, number>
): number | null;

/** 절대 회차 → 시즌 상대 회차. 시즌 정보가 없으면 { seasonNumber: null, episodeNumber: absolute }. */
export function toSeasonRelativeEpisodeNumber(
  absolute: number,
  seasons: SeasonEpisodeCount[]
): { seasonNumber: number | null; episodeNumber: number };

/** D-5 동기화 규칙. 반환값이 입력과 같으면 호출자는 쓰기를 생략해야 한다. */
export function syncManualProgressAfterToggle(params: {
  manualWatchedThrough: number | null;
  toggledAbsoluteNumber: number;
  watched: boolean;
}): number | null;

/** 입력 검증. 저장 버튼 활성화 판정과 서비스 호출 직전 방어에 모두 사용한다. */
export function normalizeManualEpisodeInput(params: {
  rawEpisodeNumber: string;
  seasonNumber: number | null;
  seasons: SeasonEpisodeCount[];
}): { ok: true; episodeNumber: number } | { ok: false; reason: ManualProgressError };

export type ManualProgressError =
  | "empty"
  | "not_a_number"
  | "negative"
  | "exceeds_season_total"
  | "exceeds_max";
```

### 7.1 `resolveEpisodeProgress` 판정 순서 (반드시 이 순서)

1. `contentType === "movie"` → `{ source: "none", watchedThrough: 0, nextEpisodeNumber: null, isComplete: false, progressRatio: null }`
2. `manualWatchedThrough !== null` → `source = "manual"`, `watchedThrough = clamp(manualWatchedThrough, 0, episodeCount ?? MAX)`
3. `derivedWatchedThrough !== null && derivedWatchedThrough > 0` → `source = "episode_progress"`, `watchedThrough = derivedWatchedThrough`
4. `watchedEpisodeCount > 0` → `source = "episode_progress"`, `watchedThrough = watchedEpisodeCount` *(에피소드 행에 `episode_number`가 없을 때의 폴백)*
5. 그 외 → `source = "none"`, `watchedThrough = 0`

**공통 파생값:**

```
isComplete        = episodeCount !== null && watchedThrough >= episodeCount
nextEpisodeNumber = isComplete ? null : watchedThrough + 1
progressRatio     = episodeCount ? min(1, watchedThrough / episodeCount) : null
```

### 7.2 `resolveEpisodeProgress` 테스트 표

`src/utils/episodeProgress.test.ts`에 아래 케이스를 **전부** 작성한다.

| # | contentType | episodeCount | watchedCount | derived | manual | → source | → watchedThrough | → next |
|---|---|---|---|---|---|---|---|---|
| 1 | tv | 24 | 0 | null | null | none | 0 | 1 |
| 2 | tv | 24 | 0 | null | 0 | manual | 0 | 1 |
| 3 | tv | 24 | 0 | null | 12 | manual | 12 | 13 |
| 4 | tv | 24 | 5 | 5 | null | episode_progress | 5 | 6 |
| 5 | tv | 24 | 5 | 5 | 12 | manual | 12 | 13 |
| 6 | tv | 24 | 20 | 20 | 3 | manual | 3 | 4 |
| 7 | tv | 24 | 0 | null | 24 | manual | 24 | null |
| 8 | tv | 24 | 0 | null | 99 | manual | 24 | null |
| 9 | tv | null | 0 | null | 12 | manual | 12 | 13 |
| 10 | tv | null | 3 | null | null | episode_progress | 3 | 4 |
| 11 | anime | 12 | 12 | 12 | null | episode_progress | 12 | null |
| 12 | movie | null | 0 | null | 5 | none | 0 | null |
| 13 | tv | 24 | 0 | null | -1 | manual | 0 | 1 |

### 7.3 `syncManualProgressAfterToggle` 테스트 표

| manual | toggled abs | watched | → 결과 |
|---|---|---|---|
| null | 5 | true | null |
| null | 5 | false | null |
| 3 | 5 | true | 5 |
| 8 | 5 | true | 8 |
| 5 | 5 | true | 5 |
| 8 | 5 | false | 4 |
| 5 | 5 | false | 4 |
| 3 | 5 | false | 3 |
| 1 | 1 | false | 0 |

### 7.4 `toAbsoluteEpisodeNumber` / `toSeasonRelativeEpisodeNumber` 테스트 표

시즌 구성: `[{1, 12}, {2, 13}, {3, null}]` → 오프셋 `{1:0, 2:12, 3:25}`

| 입력 | → 절대 |
|---|---|
| (1, 5) | 5 |
| (2, 3) | 15 |
| (3, 1) | 26 |
| (null, 7) | 7 |
| (2, 0) | 0 |
| (1, null) | null |
| (99, 4) | 4 *(모르는 시즌 → 오프셋 0)* |

역변환 왕복 성질: 위 표의 모든 `(s, e)`에 대해 `toSeasonRelative(toAbsolute(s, e)) === (s, e)` (단 `e === 0` 및 시즌 미상 케이스 제외). 이 성질을 테스트에 명시할 것.

---

## 8. 라벨 유틸 변경 — `src/utils/continueWatching.ts`

### 8.1 시그니처

```ts
export interface ContinueWatchingLabel {
  /** 카드에 표시할 텍스트. */
  text: string;
  /** 탭 시 이동 대상. */
  action: "open_episodes" | "open_progress_setting";
  /** 스크린리더용 전체 문장. */
  accessibilityLabel: string;
}

export function createContinueWatchingLabel(
  item: ContinueWatchingItem
): ContinueWatchingLabel | null;
```

> **파괴적 변경.** 기존 `string | null` 반환을 객체로 바꾼다. 호출부 2곳([`ContentCard`](../src/components/content/ContentCard.tsx) 32행, [`ContentGalleryCard`](../src/components/content/ContentGalleryCard.tsx) 34행)을 함께 수정한다. 문자열만 필요한 곳은 없으므로 별도 호환 래퍼를 만들지 않는다.

`ContinueWatchingItem`은 `LibraryListItem`에서 다음을 `Pick`한다:
`content_type`, `episode_count`, `statuses`, `watched_episode_count`, `progress_source`, `effective_watched_through`, `next_episode_number`.

### 8.2 반환 규칙

**전제:** `statuses`에 `"watching"`이 없거나 `content_type === "movie"`면 `null`.

| 조건 | text | action |
|---|---|---|
| `source === "none"` | `시청 위치 설정` | `open_progress_setting` |
| `source !== "none"` && `watchedThrough === 0` && 총 화수 없음 | `1화부터 시작` | `open_episodes` |
| `source !== "none"` && `watchedThrough === 0` && 총 화수 N | `1화부터 시작 · 총 N화` | `open_episodes` |
| `0 < watchedThrough < N` | `다음: {next}화 · {watchedThrough}/{N}화` | `open_episodes` |
| `watchedThrough > 0` && 총 화수 없음 | `다음: {next}화` | `open_episodes` |
| `watchedThrough >= N` (완주) | `모든 화 시청` | `open_episodes` |

`accessibilityLabel`은 `"{작품명 제외} 이어보기, {text}"`가 아니라 문장형으로 만든다. 예: `다음: 13화 · 12/24화` → `"24화 중 12화까지 시청했습니다. 다음은 13화입니다."`

### 8.3 라벨 테스트

`src/utils/continueWatching.test.ts` **신규 작성.** 8.2의 6개 행 × (`watching` 아님 / `movie` / 정상) 조합을 모두 커버한다. 기존에 테스트 파일이 없으므로 회귀 안전망을 여기서 처음 만든다.

---

## 9. 서비스 계층 — `src/services/library.ts`

### 9.1 SELECT 문 변경

```ts
const LIBRARY_ITEM_SELECT =
  "id,user_id,content_id,status,status_flags,watch_count,first_watched_at,last_watched_at," +
  "manual_watched_season_number,manual_watched_episode_number,manual_progress_updated_at," +
  "added_at,updated_at,contents(*,content_genres(genres(name)))";
```

`LIBRARY_ITEM_FALLBACK_SELECT`는 **변경하지 않는다.** (컬럼 미존재 시 폴백 경로)

### 9.2 폴백 감지 목록 확장

```ts
function isMissingOptionalLibraryColumnError(message: string): boolean {
  return [
    "status_flags",
    "first_watched_at",
    "last_watched_at",
    "manual_watched_season_number",
    "manual_watched_episode_number",
    "manual_progress_updated_at"
  ].some((column) => message.includes(column));
}
```

폴백 경로로 들어간 경우 매핑 시 세 필드를 모두 `null`로 채우고, `progress_source`는 파생 규칙만으로 계산한다.

### 9.3 `enrichLibraryMetadata` 확장

기존 `seasonsResult`(`id, content_id, season_number, episode_count`)를 재사용해 **contentId별 `SeasonEpisodeCount[]`** 를 만든다.

```ts
const seasonCountsByContentId = new Map<string, SeasonEpisodeCount[]>();
// seasonsResult.data를 content_id로 그룹핑 → season_number 오름차순 정렬
```

각 아이템 매핑에서:

```ts
const seasonCounts = seasonCountsByContentId.get(item.content_id) ?? [];
const offsets = createSeasonOffsetsByNumber(seasonCounts);
const manualAbsolute = toAbsoluteEpisodeNumber(
  row.manual_watched_season_number ?? null,
  row.manual_watched_episode_number ?? null,
  offsets
);

const resolved = resolveEpisodeProgress({
  contentType: item.content_type,
  episodeCount,
  watchedEpisodeCount,
  derivedWatchedThrough: progress?.maxWatchedEpisodeNumber ?? null,
  manualWatchedThrough: manualAbsolute
});

return {
  ...item,
  episode_count: episodeCount,
  watched_episode_count: watchedEpisodeCount,
  next_episode_number: resolved.nextEpisodeNumber,      // ← 유효 진행률 기준으로 교체
  manual_watched_season_number: row.manual_watched_season_number ?? null,
  manual_watched_episode_number: row.manual_watched_episode_number ?? null,
  manual_watched_absolute_number: manualAbsolute,
  progress_source: resolved.source,
  effective_watched_through: resolved.watchedThrough,
  season_episode_counts: seasonCounts
};
```

기존 로컬 함수 `getNextEpisodeNumber`는 **삭제**하고 `resolveEpisodeProgress`로 대체한다. `createSeasonOffsets`(season **id** 기반)는 파생 진행률 계산에 여전히 필요하므로 유지한다.

`getLibraryStatusByExternalId`의 수동 매핑 블록에도 동일한 신규 필드 초기값(`null` / `"none"` / `0` / `[]`)을 추가한다 — 그 뒤 `enrichLibraryMetadata`가 덮어쓴다.

### 9.4 신규 함수

```ts
export async function updateLibraryManualProgress(
  libraryItemId: string,
  progress: {
    seasonNumber: number | null;
    episodeNumber: number;   // 시즌 내 상대 회차. 0 이상.
  } | null                    // null = 수동 설정 해제(파생으로 되돌리기)
): Promise<void>;
```

구현 요구사항:

- `progress === null` → `manual_watched_season_number`, `manual_watched_episode_number`, `manual_progress_updated_at`을 모두 `NULL`로 UPDATE.
- 그 외 → 세 컬럼을 세팅하고 `manual_progress_updated_at = new Date().toISOString()`.
- `episodeNumber`는 `Math.max(0, Math.floor(n))`로 방어. `MAX_MANUAL_EPISODE_NUMBER` 초과면 `Error("회차는 9999 이하로 입력해 주세요")`를 던진다.
- 컬럼 미존재 오류(`isMissingOptionalLibraryColumnError`)면 사용자에게 보여줄 수 있는 메시지로 변환:
  `Error("시청 진행 위치 기능은 서버 업데이트 후 사용할 수 있습니다.")`
- **`status`, `status_flags`, `watch_count`를 함께 변경하지 않는다.** 완주 시 상태 전환은 사용자 확인 후 별도 뮤테이션(§11.4).

### 9.5 `toggleEpisodeProgress` 동기화

기존 `toggleEpisodeProgress(episode, watched)`는 시그니처를 유지하고, **훅 레이어에서** D-5 동기화를 수행한다(§10.2). 서비스는 단일 책임을 지킨다.

---

## 10. 훅 계층 — `src/hooks/useLibrary.ts`

### 10.1 `useUpdateLibraryManualProgress` (신규)

```ts
export function useUpdateLibraryManualProgress() {
  // mutationFn: ({ libraryItemId, progress }) => updateLibraryManualProgress(libraryItemId, progress)
  // onMutate:  snapshotLibraryQueries → updateLibraryItemManualProgressInCache
  // onError:   restoreLibraryQueries
  // onSuccess: invalidateQueries(library.all, { refetchType: "inactive" })
}
```

낙관적 캐시 헬퍼 `updateLibraryItemManualProgressInCache`는 기존 `updateLibraryItemWatchCountInCache` 패턴을 그대로 따르되, **캐시 안에서도 `resolveEpisodeProgress`를 다시 돌려** `progress_source`, `effective_watched_through`, `next_episode_number`, `manual_watched_absolute_number`를 일관되게 갱신한다. 캐시에 이미 있는 `season_episode_counts`로 오프셋을 계산한다.

### 10.2 `useToggleEpisodeProgress` 확장

시그니처를 확장한다:

```ts
export function useToggleEpisodeProgress(contentId: string | undefined)
// mutate 인자: { episode: Episode; watched: boolean; libraryItem?: LibraryListItem }
```

`mutationFn` 안에서:

1. `toggleEpisodeProgress(episode, watched)` 실행.
2. `libraryItem`이 있고 `libraryItem.manual_watched_episode_number !== null`이면:
   - `abs = toAbsoluteEpisodeNumber(선택 시즌 번호, episode.episode_number, offsets)`
   - `nextManual = syncManualProgressAfterToggle({ manualWatchedThrough: libraryItem.manual_watched_absolute_number, toggledAbsoluteNumber: abs, watched })`
   - `nextManual`이 기존 값과 다르면 `toSeasonRelativeEpisodeNumber(nextManual, seasons)` 후 `updateLibraryManualProgress` 호출.
3. 동기화 실패는 **에피소드 체크 자체를 롤백하지 않는다.** 콘솔 경고 후 `library.all` 무효화로 서버 진실을 다시 읽어온다.

`onSuccess` 무효화 대상은 기존과 동일(`progress.byContent`, `library.all`).

### 10.3 쿼리 키

**변경 없음.** 진행 위치는 `user_library_items` 행에 실려 `queryKeys.library.*`로 이미 커버된다. 새 키를 만들지 말 것.

---

## 11. UI 명세

### 11.1 신규 컴포넌트 `src/components/content/EpisodeProgressCard.tsx`

#### Props

```ts
interface EpisodeProgressCardProps {
  item: LibraryListItem;
  /** 총 화수. 상세 화면이 외부 API 값을 포함해 해석한 결과를 넘긴다. */
  totalEpisodes: number | null;
  isSaving: boolean;
  /** 컬럼 미적용 등으로 저장이 불가능한 경우 true. */
  isUnavailable?: boolean;
  onSave: (progress: { seasonNumber: number | null; episodeNumber: number } | null) => void;
  onOpenEpisodes: () => void;
  /** 딥링크 포커스 시 하이라이트. */
  highlighted?: boolean;
}
```

#### 와이어프레임 — 시즌 2개 이상

```
┌────────────────────────────────────────────────┐
│ 시청 진행                          12 / 24화    │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  50%                      │
│                                                │
│ 시즌                                           │
│ ┌────────┐┌────────┐┌────────┐                 │
│ │ 시즌 1 ││ 시즌 2 ││ 시즌 3 │  ← 가로 스크롤   │
│ └────────┘└────────┘└────────┘                 │
│                                                │
│ 여기까지 봤어요                                 │
│  ┌────┐  ┌──────────┐      ┌────┐              │
│  │ −  │  │    12    │ 화   │ +  │              │
│  └────┘  └──────────┘      └────┘              │
│                                                │
│  다음에 볼 화 · 13화                            │
│                                                │
│ ┌────────────┐┌────────────┐┌────────────┐     │
│ │ 아직 안 봄 ││  전부 봤음  ││  되돌리기   │     │
│ └────────────┘└────────────┘└────────────┘     │
│                                                │
│ ┌────────────────────────────────────────────┐ │
│ │                  저장                       │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ 에피소드를 하나씩 체크하려면 → 에피소드 보기     │
└────────────────────────────────────────────────┘
```

#### 와이어프레임 — 시즌 정보 없음 / 단일 시즌

시즌 선택 행 전체를 숨긴다. 총 화수를 모르면 헤더 우측 수치를 `12화까지 시청`으로 바꾸고 진행 바를 숨긴다.

```
┌────────────────────────────────────────────────┐
│ 시청 진행                        12화까지 시청  │
│                                                │
│ 여기까지 봤어요                                 │
│  [ − ]  [   12   ] 화  [ + ]                   │
│                                                │
│  다음에 볼 화 · 13화                            │
│                                                │
│ [ 아직 안 봄 ]        [ 되돌리기 ]              │
│ [                 저장                       ] │
└────────────────────────────────────────────────┘
```
(총 화수를 모르므로 `전부 봤음` 버튼을 숨긴다.)

#### 표시 상태

| 상태 | 조건 | 표현 |
|---|---|---|
| 파생 모드 | `progress_source === "episode_progress"` | 헤더 우측에 `에피소드 체크 기준` 보조 텍스트. `되돌리기` 버튼 비활성. |
| 수동 모드 | `progress_source === "manual"` | 헤더 우측에 `직접 설정함` 보조 텍스트. `되돌리기` 활성. 파생값이 다르면 하단에 `에피소드 체크로는 5화까지 기록되어 있습니다` 안내 1줄. |
| 미설정 | `progress_source === "none"` | 입력값 0, `다음에 볼 화 · 1화`. 카드 테두리를 `colors.primary`로 강조해 최초 설정을 유도. |
| 저장 중 | `isSaving` | 스테퍼·입력·버튼 전부 `disabled`, 저장 버튼 텍스트 `저장 중`. |
| 사용 불가 | `isUnavailable` | 전체 `disabled` + `서버 업데이트 후 사용할 수 있습니다` 안내. |
| 완주 | `isComplete` | `다음에 볼 화` 대신 `모든 화 시청 완료` 표시. |

#### 인터랙션 규칙

1. `−` / `+`는 1씩 증감. `−`는 0에서, `+`는 상한에서 각각 비활성.
2. 상한 = 선택 시즌의 `episode_count` (알면) → 없으면 `totalEpisodes` → 그것도 없으면 `MAX_MANUAL_EPISODE_NUMBER`.
3. 직접 입력은 `keyboardType="number-pad"` + `onChangeText`에서 `replace(/\D/g, "")`. 기존 [`WatchCountInput`](../app/content/[id].tsx) 패턴을 그대로 따른다.
4. 값이 서버 상태와 같으면 `저장` 비활성 (`WatchCountInput`의 `unchanged` 패턴).
5. `아직 안 봄` → 입력값을 0으로 세팅(즉시 저장하지 않음, `저장` 눌러야 확정).
6. `전부 봤음` → 입력값을 선택 시즌의 총 화수로 세팅.
7. `되돌리기` → `Alert.alert` 확인 후 `onSave(null)` 호출. 확인 문구: `"직접 설정한 진행 위치를 지우고 에피소드 체크 기준으로 되돌릴까요?"`
8. 시즌을 바꾸면 입력값은 **해당 시즌의 저장값**으로 재설정한다. 저장값이 다른 시즌이면 새로 선택한 시즌은 0으로 시작한다.
9. `onSubmitEditing`에서 바로 저장하지 않는다. 오입력 즉시 반영을 막기 위해 `저장` 버튼만 커밋 지점으로 둔다.

#### 접근성

- 모든 터치 요소 실측 44×44pt 이상 (`hitSlop` 포함). 스테퍼 버튼은 시각 크기 40pt + `hitSlop 4`.
- `−` → `accessibilityLabel="시청 회차 1 줄이기"`, `+` → `"시청 회차 1 늘리기"`.
- 입력 → `accessibilityLabel="여기까지 본 회차 입력"`, `accessibilityHint="숫자만 입력합니다. 0은 아직 보지 않음을 뜻합니다."`
- `다음에 볼 화` 텍스트에 `accessibilityLiveRegion="polite"`를 걸어 스테퍼 조작 시 변경을 읽어준다.
- 진행 바에 `accessibilityRole="progressbar"`, `accessibilityValue={{ min: 0, max: total, now: watchedThrough }}`.

#### 스타일

`colors`, `radius`, `spacing`을 [`@/constants/theme`](../src/constants/theme.ts)에서만 가져온다. 하드코딩 색상 금지. 카드 컨테이너는 상세 화면의 기존 `styles.progressPanel`과 동일한 시각 언어(배경 `colors.surface`, 테두리 `colors.border`, `radius.md`)를 따른다.

---

### 11.2 화면 명세 — SCR-006P (콘텐츠 상세 · 시청 진행)

11번 문서의 화면 명세 포맷을 따른다.

- **화면명:** 콘텐츠 상세 — 시청 진행 섹션
- **화면 ID / Route:** SCR-006P / `/content/[id]` 내 섹션. 구현 위치: [`app/content/[id].tsx`](../app/content/[id].tsx)
- **진입 경로:** 라이브러리 카드 탭, 라이브러리 카드의 `시청 위치 설정` 배지 탭(`?focus=progress`), 검색 결과 → 상세
- **진입 조건:** 유효 세션 && `libraryItem`이 존재 && `view.contentType !== "movie"`
- **상황:** 사용자가 이 작품을 몇 화까지 봤는지 앱에 알려주려 한다.
- **목표:** 회차를 하나씩 체크하지 않고 **3초 안에** 진행 위치를 확정한다.
- **행동:** 시즌 선택 → 회차 조정 → 저장 / 되돌리기
- **기대 결과:** 라이브러리 카드 배지가 즉시 `다음: N화`로 바뀐다.
- **배치:** `WatchCountInput`(본 횟수) **바로 아래**, `styles.overview`(줄거리) **위**. 줄거리보다 위에 두는 이유는 기록 행위가 이 앱의 핵심이기 때문이다.

#### 현재 상세 화면 구성 (변경 전) — 삽입 지점 확인용

[`app/content/[id].tsx`](../app/content/[id].tsx)의 `<ScrollView>` 자식 순서는 아래와 같으며, **회차 진행을 확인하거나 설정할 수 있는 요소가 하나도 없다.** 이것이 이 기능이 필요한 직접적인 이유다.

| 순서 | 섹션 | 코드 |
|---|---|---|
| 1 | 포스터 | `styles.poster` |
| 2 | 제목 / 원제 / 메타(`2026.07 · anime · 12화 · 시청 0회`) | `styles.title`, `styles.original`, `styles.meta` |
| 3 | 상태 배지(`보는 중`) | `WatchStatusBadge` |
| 4 | 장르 배지 | `GenreBadgeList` |
| 5 | **본 횟수** | `WatchCountInput` |
| **5.5** | **← 여기에 `EpisodeProgressCard`를 삽입한다 (신규)** | — |
| 6 | 줄거리 | `styles.overview` |
| 7 | 보러가기 | `WatchProviderList` |
| 8 | 성우 / 출연 배우 | `styles.castSection` |
| 9 | 내 목록 상태 + 삭제 | `styles.addPanel` |
| 10 | 리뷰 편집기 | `ContentReviewEditor` |
| 11 | 하단 액션(`에피소드 보기` / `핀 목록` / `목록`) | `styles.actions` |

> 메타 행의 `12화`는 **작품의 총 화수**이지 사용자의 진행률이 아니다. 사용자가 이것을 진행률로 오인할 수 있으므로, 진행 카드가 생긴 뒤에는 메타 행의 `12화`를 그대로 두고 진행 정보는 카드에서만 표시해 역할을 분리한다.
>
> 11번 항목의 `에피소드 보기` 버튼은 스크롤 최하단에 있어 발견성이 낮다. 진행 카드 하단의 `에피소드 보기` 링크(§11.1 와이어프레임 마지막 줄)가 회차별 체크로 가는 **주 진입점**이 된다.
- **데이터 의존성:** `useLibrary("all")`의 해당 `libraryItem`, `useSeasons(contentId)`(시즌 선택용), `view.episodeCount`
- **상태:** Loading — `library.isLoading`이면 카드 자리에 `LoadingSkeleton`; Empty — 라이브러리 미등록이면 섹션 자체를 렌더하지 않음; Error — 저장 실패 시 `Alert` + 입력값 유지; Offline — 저장 버튼 비활성 + 안내
- **Validation:** §7 `normalizeManualEpisodeInput` 결과가 `ok: false`면 저장 차단하고 인라인 오류 표시
- **캐시 무효화:** `queryKeys.library.all(userId)` (낙관적 갱신 + `refetchType: "inactive"` 무효화)
- **분석 이벤트:** §13
- **엣지 케이스:** §12
- **MVP 포함 여부:** Yes

**Acceptance Criteria**

1. 24화 작품에서 `12` 입력 후 저장하면, 뒤로 가서 본 라이브러리 카드가 **네트워크 재조회 없이 즉시** `다음: 13화 · 12/24화`를 표시한다.
2. 저장이 실패하면 카드 값과 라이브러리 카드가 **저장 전 상태로 정확히 롤백**되고, 사용자에게 실패 사유가 보인다.
3. 영화(`content_type === "movie"`)에서는 이 섹션이 렌더되지 않는다.
4. 라이브러리에 없는 외부 검색 결과 상세에서는 이 섹션이 렌더되지 않는다.
5. `되돌리기` 후 `progress_source`가 `episode_progress` 또는 `none`으로 바뀌고, 카드 배지가 그 기준으로 다시 계산된다.
6. 시즌 3개 작품에서 시즌2를 선택해 `3`을 저장하면, 시즌1이 12화일 때 절대 회차 15가 되어 카드에 `다음: 16화`가 표시된다.
7. 마이그레이션 미적용 서버에 붙어도 상세 화면이 렌더되며, 섹션은 비활성 안내 상태가 된다.

---

### 11.3 화면 변경 — SCR-003L (라이브러리 카드)

**파일:** [`ContentGalleryCard.tsx`](../src/components/content/ContentGalleryCard.tsx), [`ContentCard.tsx`](../src/components/content/ContentCard.tsx)

1. `createContinueWatchingLabel`의 반환 타입 변경에 맞춰 `continueLabel.text`를 렌더한다.
2. `continueLabel.action === "open_progress_setting"`이면 `onOpenProgressSetting?.()`을, `"open_episodes"`이면 기존 `onOpenEpisodes()`를 호출한다.
3. 두 카드에 `onOpenProgressSetting?: () => void` prop을 추가한다. 미제공이면 기존처럼 `onOpenEpisodes`로 폴백한다.
4. `accessibilityLabel`을 `` `${item.title_primary} ${continueLabel.accessibilityLabel}` ``로 구성한다.
5. `시청 위치 설정` 배지는 시각적으로 구분한다 — 기존 `styles.continueButton`(연한 배경) 대신 `colors.primary` 테두리 + `colors.primary` 텍스트의 outline 변형 `styles.continueButtonCta`를 추가한다.

**호출부:** [`app/(tabs)/library.tsx`](../app/(tabs)/library.tsx)에서

```ts
onOpenProgressSetting={() =>
  router.push({
    pathname: "/content/[id]",
    params: { id: item.content_id, focus: "progress", ...libraryRouteParams }
  })
}
```

**딥링크 포커스 구현** ([`app/content/[id].tsx`](../app/content/[id].tsx)):

- `params.focus === "progress"`일 때 `ScrollView`에 `ref`를 걸고, 진행 카드의 `onLayout`에서 얻은 `y`로 `scrollTo({ y: y - 24, animated: true })`를 **1회만** 실행한다(`useRef<boolean>` 가드).
- 동시에 `highlighted` prop을 `true`로 1500ms 유지 후 해제한다.
- `params` 타입 선언에 `focus?: string`을 추가한다.

---

### 11.4 화면 변경 — SCR-009 (에피소드 목록) · P1

**파일:** [`EpisodeSelector.tsx`](../src/components/content/EpisodeSelector.tsx), [`app/content/[id]/episodes.tsx`](../app/content/[id]/episodes.tsx)

1. 목록 상단에 진행 요약 배너 1줄 추가: `12/24화 시청 · 다음 13화` + 우측에 `진행 위치 설정` 텍스트 버튼(상세 화면으로 이동).
2. 각 `EpisodeRow`에 **long press** 액션을 추가한다 → `Alert`로 `"{N}화까지 봤음으로 표시할까요?"` 확인 후 `updateLibraryManualProgress({ seasonNumber, episodeNumber: N })` 호출.
   - 체크박스 단일 탭 동작은 **변경하지 않는다.**
   - long press 힌트는 배너 하단에 `길게 누르면 그 회차까지 봤음으로 설정됩니다` 1줄로 표시한다.
3. `onToggleProgress` 호출 시 `libraryItem`을 함께 전달해 §10.2 동기화가 작동하게 한다. `episodes.tsx`에서 `useLibrary("all")`로 해당 아이템을 찾아 넘긴다.
4. **마지막 화 체크 시 상태 전환 제안**은 11번 문서 SCR-009 AC 4번을 그대로 따른다 — 사용자 확인 전 `status`를 바꾸지 않는다. 이 기능에서 새로 구현하지 않는다.

---

## 12. 엣지 케이스

| # | 상황 | 요구 동작 |
|---|---|---|
| E-1 | 총 화수를 모름 (`episode_count === null`) | 진행 바·`전부 봤음` 숨김. 상한은 `MAX_MANUAL_EPISODE_NUMBER`. 라벨은 `다음: N화`만. |
| E-2 | 시즌 정보 없음 | 시즌 선택 UI 숨김. `seasonNumber = null`로 저장. |
| E-3 | 저장 후 `fetch-episodes`로 시즌 정보가 뒤늦게 도착 | 저장값은 상대 회차이므로 재해석만 되고 값은 유효하게 유지된다. 시즌1 오프셋 0이므로 결과 동일. |
| E-4 | 수동값(3화) < 파생값(20화) | 수동값이 이긴다(D-4). 카드에 `에피소드 체크로는 20화까지 기록되어 있습니다` 안내를 표시한다. |
| E-5 | 수동값이 총 화수를 초과 (총 24화인데 99 저장 시도) | 입력 단계에서 상한 clamp. 이미 저장된 값이 초과면 읽기 시 `clamp`(§7.1 케이스 8). |
| E-6 | 진행 위치 저장 중 화면 이탈 | 뮤테이션은 계속 진행되고 성공/실패에 따라 캐시가 정리된다. 실패 `Alert`는 화면이 언마운트되었으면 표시하지 않는다. |
| E-7 | 같은 작품을 두 기기에서 동시 수정 | Last-write-wins. 충돌 해결 없음. `manual_progress_updated_at`으로 사후 진단만 가능. |
| E-8 | `watch_count`(본 횟수)와의 관계 | **완전히 독립.** 진행 위치 저장이 `watch_count`를 바꾸지 않고, 그 반대도 아니다. |
| E-9 | 상태가 `completed`인 작품 | 진행 카드는 여전히 표시(재시청 기록 가능). 다만 이어보기 배지는 `watching`일 때만 나오므로 카드에는 영향 없음. |
| E-10 | 상태가 `wishlist`인 작품에 진행 위치를 설정 | 허용한다. 상태를 자동 변경하지 않는다. 저장 후 `보는 중으로 바꿀까요?` 제안 `Alert`을 1회 표시하고, 확인 시에만 `useUpdateLibraryStatuses`를 호출한다. |
| E-11 | 회차 0 저장 | `manual = 0`. `1화부터 시작`으로 표시(D-6). `progress_source === "manual"`. |
| E-12 | 마지막 화까지 수동 설정 | `모든 화 시청` 표시. 상태 자동 전환 없음. `완료로 표시할까요?` 제안 `Alert` 1회. |
| E-13 | 200화 이상 장편 | 스테퍼로는 비현실적 → 직접 입력이 주 경로. 입력 필드 폭을 4자리 기준으로 잡는다. |
| E-14 | 오프라인 | 저장 버튼 비활성 + `오프라인에서는 저장할 수 없습니다`. 읽기는 캐시로 정상 동작. |
| E-15 | 마이그레이션 미적용 (D-7) | `getLibraryItems` 폴백 경로, 카드 `isUnavailable`. 크래시 금지. |

---

## 13. 분석 이벤트

| 이벤트 | 시점 | 파라미터 |
|---|---|---|
| `episode_progress_card_viewed` | 진행 카드가 화면에 처음 보일 때 | `content_id`, `source`, `has_seasons`, `entry`(`detail` \| `deeplink`) |
| `episode_progress_changed` | 스테퍼·입력·빠른 버튼으로 값이 바뀔 때 (디바운스 500ms) | `content_id`, `method`(`stepper` \| `input` \| `quick_none` \| `quick_all`) |
| `episode_progress_saved` | 저장 성공 | `content_id`, `season_number`, `episode_number`, `absolute_number`, `previous_source` |
| `episode_progress_reset` | 되돌리기 성공 | `content_id` |
| `episode_progress_save_failed` | 저장 실패 | `content_id`, `reason` |
| `continue_badge_tapped` | 라이브러리 카드 이어보기 배지 탭 | `content_id`, `action`(`open_episodes` \| `open_progress_setting`) |

11번 문서 §10.5의 공통 원칙(개인 식별 정보·메모 원문 미전송)을 따른다.

---

## 14. 캐시 무효화 계약

| 트리거 | 낙관적 갱신 | 무효화 |
|---|---|---|
| `updateLibraryManualProgress` 성공 | `queryKeys.library.all(userId)` 하위 전체를 `setQueriesData`로 갱신 (`manual_*`, `progress_source`, `effective_watched_through`, `next_episode_number` 동시 갱신) | `queryKeys.library.all(userId)`, `refetchType: "inactive"` |
| `updateLibraryManualProgress` 실패 | `restoreLibraryQueries(snapshots)` | 없음 |
| `toggleEpisodeProgress` + 동기화 발생 | 기존 동작 유지 | `queryKeys.progress.byContent(userId, contentId)` **및** `queryKeys.library.all(userId)` |

**금지 사항:** `queryKeys.profile.stats`를 무효화하지 않는다. 진행 위치는 통계 집계에 들어가지 않으며, 불필요한 재조회를 유발한다.

---

## 15. 테스트 계획

### 15.1 단위 테스트 (필수, `npm test`로 실행)

| 파일 | 대상 |
|---|---|
| `src/utils/episodeProgress.test.ts` (신규) | §7.2, §7.3, §7.4의 모든 표 행 + `normalizeManualEpisodeInput`의 5가지 오류 케이스 |
| `src/utils/continueWatching.test.ts` (신규) | §8.2의 6개 규칙 × `watching`/비-`watching`/`movie` |

테스트는 `node:test` + `node:assert/strict`를 사용하고, 기존 [`src/utils/pinCache.test.ts`](../src/utils/pinCache.test.ts) 스타일을 따른다. **React·Supabase를 import하지 않는 순수 테스트여야 한다** (`npm test`는 `tsx --test`로 실행되며 RN 모듈을 로드할 수 없다).

### 15.2 타입·린트

```bash
npm run typecheck && npm run lint
```

두 명령 모두 **오류 0건**이어야 한다. `createContinueWatchingLabel` 반환 타입 변경으로 호출부 타입 오류가 나면 그것이 정상이며, 전부 수정한다.

### 15.3 수동 QA 체크리스트

로컬 Supabase에 `0020`을 적용한 뒤 수행한다.

- [ ] 24화 애니(보는 중, 체크 0건) 카드에 `시청 위치 설정`이 뜬다
- [ ] 배지 탭 → 상세 화면의 진행 카드로 스크롤·하이라이트된다
- [ ] `12` 저장 → 뒤로 → 카드가 `다음: 13화 · 12/24화`
- [ ] 앱 완전 재시작 후에도 값이 유지된다
- [ ] `되돌리기` → 카드가 `시청 위치 설정`으로 복귀
- [ ] 시즌 3개 작품에서 시즌2 3화 저장 → 절대 회차 15 반영
- [ ] 에피소드 화면에서 20화 체크 → 수동값 12가 20으로 상향
- [ ] 20화 체크 해제 → 수동값 19로 하향
- [ ] 수동값 12 상태에서 5화 체크 → 수동값 12 유지
- [ ] 영화 상세에 진행 카드가 없다
- [ ] 검색 결과(미등록) 상세에 진행 카드가 없다
- [ ] 기내 모드에서 저장 버튼 비활성 + 안내
- [ ] `0020` 미적용 원격 프로젝트에 연결 → 상세·라이브러리 모두 크래시 없음
- [ ] 스테퍼·입력·버튼 전부 44pt 이상 (iOS Accessibility Inspector)
- [ ] VoiceOver로 스테퍼 조작 시 `다음에 볼 화` 변경이 읽힌다

---

## 16. 구현 순서 (Codex 작업 단위)

각 단계 끝에서 `npm run typecheck`가 통과해야 다음으로 넘어간다.

| 단계 | 작업 | 산출물 |
|---|---|---|
| 1 | 마이그레이션 작성·로컬 적용 (`npx supabase db push`) | `supabase/migrations/0020_*.sql` |
| 2 | 순수 유틸 + 테스트 **먼저** 작성 (TDD) | `src/utils/episodeProgress.ts`, `.test.ts` |
| 3 | 라벨 유틸 변경 + 테스트 | `src/utils/continueWatching.ts`, `.test.ts` |
| 4 | 타입 확장 | `src/types/library.ts` |
| 5 | 서비스 계층 (SELECT·enrich·신규 함수·폴백) | `src/services/library.ts` |
| 6 | 훅 (신규 뮤테이션·캐시 헬퍼·토글 동기화) | `src/hooks/useLibrary.ts` |
| 7 | 진행 카드 컴포넌트 | `src/components/content/EpisodeProgressCard.tsx` |
| 8 | 상세 화면 통합 + 딥링크 포커스 | `app/content/[id].tsx` |
| 9 | 라이브러리 카드 2종 + 호출부 | `ContentCard.tsx`, `ContentGalleryCard.tsx`, `app/(tabs)/library.tsx` |
| 10 | (P1) 에피소드 화면 배너 + long press | `EpisodeSelector.tsx`, `app/content/[id]/episodes.tsx` |
| 11 | `npm test && npm run typecheck && npm run lint` + 수동 QA | — |

**2~3단계를 5단계보다 먼저** 하는 이유: 진행률 판정 로직이 이 기능의 유일한 복잡성이고, 서비스·UI가 그 위에 얹히기 때문이다. 순수 함수가 표로 검증되면 나머지는 배선 작업이다.

---

## 17. 변경 파일 요약

| 파일 | 종류 | 요약 |
|---|---|---|
| `supabase/migrations/0020_user_library_manual_episode_progress.sql` | 신규 | 컬럼 3개 + CHECK 3개 + 부분 인덱스 |
| `src/utils/episodeProgress.ts` | 신규 | 진행률 판정·변환·동기화 순수 함수 |
| `src/utils/episodeProgress.test.ts` | 신규 | §7 테스트 표 전체 |
| `src/utils/continueWatching.ts` | 수정 | 반환 타입을 객체로, 유효 진행률 기반 라벨 |
| `src/utils/continueWatching.test.ts` | 신규 | §8.2 라벨 규칙 |
| `src/types/library.ts` | 수정 | `LibraryListItem` 6필드 추가, `EpisodeProgressSource`, `SeasonEpisodeCount` |
| `src/services/library.ts` | 수정 | SELECT 확장, 폴백 목록 확장, `enrichLibraryMetadata` 재작성, `updateLibraryManualProgress` 신규, `getNextEpisodeNumber` 제거 |
| `src/hooks/useLibrary.ts` | 수정 | `useUpdateLibraryManualProgress` 신규, `useToggleEpisodeProgress` 동기화, 캐시 헬퍼 1개 추가 |
| `src/components/content/EpisodeProgressCard.tsx` | 신규 | 진행 위치 설정 카드 |
| `app/content/[id].tsx` | 수정 | 카드 배치, `focus=progress` 딥링크 스크롤 |
| `src/components/content/ContentGalleryCard.tsx` | 수정 | 라벨 객체 대응, CTA 배지 스타일, `onOpenProgressSetting` |
| `src/components/content/ContentCard.tsx` | 수정 | 동일 |
| `app/(tabs)/library.tsx` | 수정 | `onOpenProgressSetting` 배선 |
| `src/components/content/EpisodeSelector.tsx` | 수정 (P1) | 요약 배너, long press |
| `app/content/[id]/episodes.tsx` | 수정 (P1) | `libraryItem` 전달, 배너 데이터 |

---

## 18. 미결정 사항 — 확인 필요

| # | 항목 | 기본 동작 (결정 전까지 이대로 구현) |
|---|---|---|
| Q-1 | `0001_initial_schema.sql`의 `user_library_items` UPDATE RLS 정책이 컬럼을 열거하는가? | 열거형이면 `0020`에서 정책을 갱신한다. 행 단위면 변경 불필요. **마이그레이션 작성 전 반드시 확인.** |
| Q-2 | `wishlist` 작품에 진행 위치를 저장하면 `보는 중`으로 자동 전환할 것인가? | 자동 전환하지 않고 제안 `Alert`만 표시 (E-10). |
| Q-3 | 마지막 화까지 설정하면 `완료`로 자동 전환할 것인가? | 자동 전환하지 않고 제안 `Alert`만 표시 (E-12). |
| Q-4 | 엑셀 대량 등록 경로(`bulk-register-netflix`)에서 진행 위치도 함께 받을 것인가? | 이번 범위 밖. 등록 후 사용자가 상세에서 설정한다. |
| Q-5 | 이어보기 배지를 홈 화면([`app/(tabs)/index.tsx`](<../app/(tabs)/index.tsx>))에도 노출할 것인가? | 이번 범위 밖. 라이브러리 카드 2종만 변경. |

---

## 19. 최종 수용 기준 (기능 전체)

이 기능이 "완료"로 인정되려면 아래가 모두 참이어야 한다.

1. `npm test`, `npm run typecheck`, `npm run lint`가 각각 오류 0건으로 통과한다.
2. §15.3 수동 QA 체크리스트 15개 항목이 모두 통과한다.
3. 진행 위치를 한 번도 설정하지 않은 "보는 중" 작품에서 **`1화부터 시작`이라는 문자열이 더 이상 나타나지 않는다** (사용자가 명시적으로 0화를 저장한 경우 제외).
4. 진행 위치 설정에 필요한 탭 수가 **상세 화면 진입 후 최대 3회**(입력 → 저장, 또는 `+` 반복 없이 직접 입력)다.
5. 수동값과 에피소드 체크 상태가 모순되는 조합을 만들 수 없다 (§12 E-4 안내 케이스는 모순이 아니라 의도된 우선순위 표시다).
