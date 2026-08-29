# SceneNote 구현 작업 — 시청 진행 위치(몇 화부터 볼지) 설정 기능 (FEAT-PROGRESS-01)

SceneNote 저장소에서 아래 작업을 끝까지 수행하라.

## ROLE & GOAL

You are implementing **FEAT-PROGRESS-01** for **SceneNote**, an Expo (React Native) + TypeScript(strict) + Supabase app. Path alias: **`@/*` → `src/*`**.

**한 줄 목표:** 콘텐츠 상세 화면에서 "이 작품을 몇 화까지 봤는지"를 직접 설정할 수 있게 만들고, 그 값이 라이브러리 카드의 이어보기 배지에 일관되게 반영되게 한다.

**해결할 문제:** 라이브러리 "보는 중" 작품이 전부 `1화부터 시작`으로 표시되는데, 앱 어디에도 이 값을 바꿀 UI가 없다. 상세 화면에도 회차를 체크할 곳이 없다.

**근본 원인 3가지 (반드시 이해하고 시작할 것):**

1. `src/utils/continueWatching.ts` 13행 — `watchedCount === 0`이면 무조건 `"1화부터 시작"` 반환
2. `src/services/library.ts` `enrichLibraryMetadata` — `watched_episode_count`는 `user_episode_progress` 행 수에서만 파생됨
3. `supabase/migrations/0001`~`0019` — `user_library_items`에 "몇 화까지 봤는지"를 저장할 컬럼이 **존재하지 않음**

즉 **파생 진행률만 있고 사용자가 직접 선언하는 진행률이 없는 것**이 원인이다. 엑셀 대량 등록(443개 작품) 경로는 `seasons`/`episodes` 캐시를 채우지 않아 회차 체크조차 불가능하다.

---

## READ FIRST (source of truth)

**아래 순서대로 읽고 시작하라. 특히 2번은 이 작업의 완전한 명세이므로 전부 읽어야 한다.**

1. `AGENTS.md` — 프로젝트 공통 규칙, 금지사항
2. **`docs/12_episode_progress_spec.md` — 이 작업의 전체 구현 명세서 (필수 정독)**
3. `docs/11_screen_implementation_spec.md` §SCR-006, §SCR-009 — 화면 명세 포맷과 기존 계약
4. `CLAUDE.md` — 데이터 아키텍처 분리 원칙

**현재 코드 사실 (읽고 회귀시키지 말 것):**

- `src/lib/query.ts`가 `queryClient` + `queryKeys`를 export한다. **새 쿼리 키를 만들지 마라** — 진행 위치는 `user_library_items` 행에 실려 `queryKeys.library.*`로 이미 커버된다.
- 낙관적 업데이트 패턴은 `src/hooks/useLibrary.ts`의 `snapshotLibraryQueries` / `restoreLibraryQueries` / `updateLibraryItem*InCache`를 그대로 따른다.
- 테스트는 `node:test` + `node:assert/strict`이며 `npm test`가 `tsx --test`로 실행한다. **테스트 파일에서 React나 Supabase를 import하면 실행이 깨진다.** 순수 함수만 테스트한다. 참고: `src/utils/pinCache.test.ts`
- 상세 화면 `app/content/[id].tsx`의 `WatchCountInput`(본 횟수)이 입력+저장 UI의 기존 패턴이다. 새 카드도 이 패턴을 따른다.

---

## 바꾸면 안 되는 설계 결정 (D-1 ~ D-7)

이 결정들은 대안을 검토한 결과다. **임의로 바꾸지 마라.** 근거는 `docs/12_episode_progress_spec.md` §4에 있다.

| ID | 결정 | 왜 다른 방법이 안 되는가 |
|---|---|---|
| D-1 | 저장 위치는 `user_library_items` 컬럼 | `user_episode_progress`에 넣으면 `episode_id` FK 때문에 에피소드 캐시 없는 작품에 못 쓴다 |
| D-2 | **"여기까지 봤음"(watched-through)** 을 저장. `NULL`=미설정, `0`=아직 안 봄 | "다음 볼 화"로 저장하면 0/1 경계가 모호해진다 |
| D-3 | DB에는 **시즌 상대 회차**를 저장하고, 읽을 때 절대 회차로 변환 | 절대 회차를 저장하면 `seasons`가 나중에 도착했을 때 저장값이 소급해서 틀려진다 |
| D-4 | 수동값이 있으면 **수동값이 권위**. 파생값은 무시하고 참고 표시만 | `max(수동, 파생)`으로 하면 재시청·정정을 위해 값을 **낮출 수 없다** |
| D-5 | 에피소드 체크 시 수동값을 자동 재동기화 (아래 표) | 두 값이 모순되는 상태를 원천 차단하기 위함 |
| D-6 | 미설정 라벨을 `1화부터 시작` → **`시청 위치 설정`** 으로 변경 | 라벨 자체를 설정 진입점으로 만든다. `1화부터 시작`은 사용자가 명시적으로 0화를 저장했을 때만 표시 |
| D-7 | 신규 컬럼명을 `isMissingOptionalLibraryColumnError` 목록에 추가 | 원격 Supabase에 마이그레이션이 늦게 적용되는 전례가 있다. 크래시 금지 |

### D-5 동기화 매트릭스 (그대로 구현할 것)

| 사용자 행동 | 조건 | 수동값 처리 |
|---|---|---|
| 회차 N을 **봄**으로 체크 | `manual === null` | 변경 없음 |
| 회차 N을 **봄**으로 체크 | `abs(N) > manual` | `manual := abs(N)` |
| 회차 N을 **봄**으로 체크 | `abs(N) <= manual` | 변경 없음 |
| 회차 N **체크 해제** | `manual === null` | 변경 없음 |
| 회차 N **체크 해제** | `manual >= abs(N)` | `manual := abs(N) - 1` |
| 회차 N **체크 해제** | `manual < abs(N)` | 변경 없음 |

---

## IMPLEMENTATION ORDER

**각 단계 끝에서 `npm run typecheck`가 통과해야 다음 단계로 넘어간다. 2~3단계를 5단계보다 먼저 하는 것이 필수다** — 진행률 판정이 이 기능의 유일한 복잡성이고, 나머지는 그 위의 배선 작업이다.

### STEP 1 — 마이그레이션

**먼저 확인:** `supabase/migrations/0001_initial_schema.sql`에서 `user_library_items`의 UPDATE RLS 정책이 **컬럼을 열거하는 형태인지** 확인하라. 열거형이면 이 마이그레이션에서 정책도 함께 갱신해야 한다. 행 단위(`USING (auth.uid() = user_id)`)면 정책 변경 불필요.

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
  '수동 진행 위치를 마지막으로 저장한 시각. 진단 보조용이며 우선순위 판정에는 사용하지 않는다.';

CREATE INDEX IF NOT EXISTS idx_user_library_items_manual_progress
  ON user_library_items (user_id, manual_progress_updated_at DESC)
  WHERE manual_watched_episode_number IS NOT NULL;
```

로컬 적용: `npx supabase db push`. **백필하지 않는다** — 기존 행은 전부 `NULL`(미설정)이 정상이다.

---

### STEP 2 — 순수 유틸 (TDD: 테스트 먼저)

**신규:** `src/utils/episodeProgress.ts` + `src/utils/episodeProgress.test.ts`

정확한 시그니처는 `docs/12_episode_progress_spec.md` §7에 전부 있다. 핵심 export:

```ts
export const MAX_MANUAL_EPISODE_NUMBER = 9999;

export function resolveEpisodeProgress(input: EpisodeProgressInput): ResolvedEpisodeProgress;
export function createSeasonOffsetsByNumber(seasons: SeasonEpisodeCount[]): Map<number, number>;
export function toAbsoluteEpisodeNumber(seasonNumber, episodeNumber, offsetsBySeasonNumber): number | null;
export function toSeasonRelativeEpisodeNumber(absolute, seasons): { seasonNumber: number | null; episodeNumber: number };
export function syncManualProgressAfterToggle(params): number | null;
export function normalizeManualEpisodeInput(params): { ok: true; episodeNumber: number } | { ok: false; reason: ManualProgressError };
```

**`resolveEpisodeProgress` 판정 순서 — 반드시 이 순서:**

1. `contentType === "movie"` → `source: "none"`, `watchedThrough: 0`, `nextEpisodeNumber: null`
2. `manualWatchedThrough !== null` → `source: "manual"`, `watchedThrough = clamp(manual, 0, episodeCount ?? MAX)`
3. `derivedWatchedThrough !== null && > 0` → `source: "episode_progress"`, `watchedThrough = derived`
4. `watchedEpisodeCount > 0` → `source: "episode_progress"`, `watchedThrough = watchedEpisodeCount` *(episode_number 없는 행 폴백)*
5. 그 외 → `source: "none"`, `watchedThrough: 0`

공통 파생값:
```
isComplete        = episodeCount !== null && watchedThrough >= episodeCount
nextEpisodeNumber = isComplete ? null : watchedThrough + 1
progressRatio     = episodeCount ? min(1, watchedThrough / episodeCount) : null
```

**테스트는 `docs/12_episode_progress_spec.md` §7.2 / §7.3 / §7.4의 표 29행을 전부 작성하라.** 표에 입력→기대출력이 다 채워져 있다. 임의로 줄이지 마라. §7.4의 왕복 성질(`toSeasonRelative(toAbsolute(s,e)) === (s,e)`) 테스트도 포함한다.

---

### STEP 3 — 라벨 유틸 변경 + 테스트

**수정:** `src/utils/continueWatching.ts` / **신규:** `src/utils/continueWatching.test.ts`

**파괴적 변경이다.** 반환 타입을 `string | null` → 객체로 바꾼다:

```ts
export interface ContinueWatchingLabel {
  text: string;
  action: "open_episodes" | "open_progress_setting";
  accessibilityLabel: string;
}
export function createContinueWatchingLabel(item: ContinueWatchingItem): ContinueWatchingLabel | null;
```

호환 래퍼를 만들지 말고 호출부 2곳(`ContentCard.tsx`, `ContentGalleryCard.tsx`)을 STEP 9에서 함께 고친다.

**반환 규칙** (전제: `statuses`에 `"watching"` 없거나 `content_type === "movie"`면 `null`):

| 조건 | text | action |
|---|---|---|
| `source === "none"` | `시청 위치 설정` | `open_progress_setting` |
| `watchedThrough === 0`, 총 화수 없음 | `1화부터 시작` | `open_episodes` |
| `watchedThrough === 0`, 총 화수 N | `1화부터 시작 · 총 N화` | `open_episodes` |
| `0 < watchedThrough < N` | `다음: {next}화 · {watchedThrough}/{N}화` | `open_episodes` |
| `watchedThrough > 0`, 총 화수 없음 | `다음: {next}화` | `open_episodes` |
| `watchedThrough >= N` | `모든 화 시청` | `open_episodes` |

`accessibilityLabel`은 문장형. 예: `"24화 중 12화까지 시청했습니다. 다음은 13화입니다."`

---

### STEP 4 — 타입 확장

**수정:** `src/types/library.ts`

`LibraryListItem`에 6개 필드를 추가하고, `EpisodeProgressSource` / `SeasonEpisodeCount`를 새로 export한다. 전체 정의는 `docs/12_episode_progress_spec.md` §6 참조.

```ts
export type EpisodeProgressSource = "manual" | "episode_progress" | "none";
export interface SeasonEpisodeCount { season_number: number; episode_count: number | null; }

// LibraryListItem 추가 필드
manual_watched_season_number: number | null;
manual_watched_episode_number: number | null;
manual_watched_absolute_number: number | null;
progress_source: EpisodeProgressSource;
effective_watched_through: number;
season_episode_counts: SeasonEpisodeCount[];
```

`next_episode_number`는 필드를 유지하되 **유효 진행률 기준으로 재계산된 값**으로 의미를 확장한다.

---

### STEP 5 — 서비스 계층

**수정:** `src/services/library.ts`

1. `LIBRARY_ITEM_SELECT`에 `manual_watched_season_number,manual_watched_episode_number,manual_progress_updated_at`를 추가한다. `LIBRARY_ITEM_FALLBACK_SELECT`는 **건드리지 않는다**(폴백 경로).
2. `isMissingOptionalLibraryColumnError`의 배열에 신규 컬럼명 3개를 추가한다. (D-7)
3. `enrichLibraryMetadata`를 확장한다:
   - 기존 `seasonsResult`를 재사용해 contentId별 `SeasonEpisodeCount[]`(season_number 오름차순) 맵을 만든다.
   - 각 아이템에서 `createSeasonOffsetsByNumber` → `toAbsoluteEpisodeNumber`로 `manualAbsolute`를 구한다.
   - `resolveEpisodeProgress`를 호출해 `next_episode_number`, `progress_source`, `effective_watched_through`를 채운다.
   - **로컬 함수 `getNextEpisodeNumber`는 삭제하고 `resolveEpisodeProgress`로 대체한다.**
   - `createSeasonOffsets`(season **id** 기반)는 파생 진행률 계산에 계속 필요하므로 **유지한다.**
4. `getLibraryStatusByExternalId`의 수동 매핑 블록에도 신규 필드 초기값(`null` / `"none"` / `0` / `[]`)을 추가한다.
5. **신규 함수:**

```ts
export async function updateLibraryManualProgress(
  libraryItemId: string,
  progress: { seasonNumber: number | null; episodeNumber: number } | null  // null = 설정 해제
): Promise<void>;
```

- `null` → 세 컬럼 모두 `NULL`로 UPDATE
- 그 외 → 세 컬럼 세팅 + `manual_progress_updated_at = new Date().toISOString()`
- `episodeNumber`는 `Math.max(0, Math.floor(n))`로 방어. `MAX_MANUAL_EPISODE_NUMBER` 초과 시 `Error("회차는 9999 이하로 입력해 주세요")`
- 컬럼 미존재 오류면 `Error("시청 진행 위치 기능은 서버 업데이트 후 사용할 수 있습니다.")`로 변환
- **`status` / `status_flags` / `watch_count`를 함께 변경하지 마라.**

---

### STEP 6 — 훅 계층

**수정:** `src/hooks/useLibrary.ts`

1. **신규 `useUpdateLibraryManualProgress()`** — `useUpdateLibraryWatchCount`와 동일한 구조(`onMutate` 스냅샷 → 낙관적 갱신 → `onError` 복구 → `onSuccess` `refetchType: "inactive"` 무효화).
2. **신규 캐시 헬퍼 `updateLibraryItemManualProgressInCache`** — 캐시 안에서도 `resolveEpisodeProgress`를 다시 돌려 `progress_source`, `effective_watched_through`, `next_episode_number`, `manual_watched_absolute_number`를 **함께** 갱신한다. 캐시의 `season_episode_counts`로 오프셋을 계산한다.
3. **`useToggleEpisodeProgress` 확장** — mutate 인자에 `libraryItem?: LibraryListItem`를 추가. `mutationFn` 안에서 토글 후 D-5 매트릭스대로 `syncManualProgressAfterToggle` → 값이 바뀌면 `toSeasonRelativeEpisodeNumber` 후 `updateLibraryManualProgress` 호출. **동기화 실패는 에피소드 체크를 롤백하지 않고** 콘솔 경고 + `library.all` 무효화로 끝낸다.
4. **`queryKeys.profile.stats`를 무효화하지 마라** — 진행 위치는 통계 집계에 안 들어간다.

---

### STEP 7 — 진행 카드 컴포넌트

**신규:** `src/components/content/EpisodeProgressCard.tsx`

```ts
interface EpisodeProgressCardProps {
  item: LibraryListItem;
  totalEpisodes: number | null;
  isSaving: boolean;
  isUnavailable?: boolean;
  onSave: (progress: { seasonNumber: number | null; episodeNumber: number } | null) => void;
  onOpenEpisodes: () => void;
  highlighted?: boolean;
}
```

**와이어프레임 (시즌 2개 이상):**

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
│ ┌────────────────────────────────────────────┐ │
│ │                  저장                       │ │
│ └────────────────────────────────────────────┘ │
│ 에피소드를 하나씩 체크하려면 → 에피소드 보기     │
└────────────────────────────────────────────────┘
```

**시즌 정보 없음 / 단일 시즌:** 시즌 선택 행과 진행 바를 숨기고, 헤더 우측을 `12화까지 시청`으로. 총 화수를 모르므로 `전부 봤음`도 숨긴다.

**인터랙션 규칙 (9개 전부 구현):**

1. `−`/`+`는 1씩 증감. `−`는 0에서, `+`는 상한에서 비활성
2. 상한 = 선택 시즌 `episode_count` → 없으면 `totalEpisodes` → 없으면 `MAX_MANUAL_EPISODE_NUMBER`
3. 직접 입력은 `keyboardType="number-pad"` + `onChangeText`에서 `replace(/\D/g, "")` (기존 `WatchCountInput` 패턴)
4. 값이 서버 상태와 같으면 `저장` 비활성
5. `아직 안 봄` → 입력값 0으로 세팅(즉시 저장 안 함)
6. `전부 봤음` → 입력값을 선택 시즌 총 화수로 세팅
7. `되돌리기` → `Alert.alert`로 `"직접 설정한 진행 위치를 지우고 에피소드 체크 기준으로 되돌릴까요?"` 확인 후 `onSave(null)`
8. 시즌을 바꾸면 입력값은 해당 시즌 저장값으로 재설정(다른 시즌이면 0)
9. **`onSubmitEditing`에서 바로 저장하지 마라.** `저장` 버튼만 커밋 지점이다

**표시 상태 6가지:** 파생 모드(`에피소드 체크 기준`) / 수동 모드(`직접 설정함` + 파생값이 다르면 `에피소드 체크로는 N화까지 기록되어 있습니다` 안내) / 미설정(테두리 `colors.primary` 강조) / 저장 중 / 사용 불가 / 완주(`모든 화 시청 완료`).

**접근성 (필수):** 모든 터치 요소 실측 44×44pt 이상(`hitSlop` 포함) · `−`→`"시청 회차 1 줄이기"`, `+`→`"시청 회차 1 늘리기"` · 입력→`"여기까지 본 회차 입력"` + hint `"숫자만 입력합니다. 0은 아직 보지 않음을 뜻합니다."` · `다음에 볼 화`에 `accessibilityLiveRegion="polite"` · 진행 바에 `accessibilityRole="progressbar"` + `accessibilityValue`.

**스타일:** `colors`/`radius`/`spacing`을 `@/constants/theme`에서만 가져온다. **색상 하드코딩 금지.** 컨테이너는 상세 화면의 기존 `styles.progressPanel`과 같은 시각 언어.

---

### STEP 8 — 상세 화면 통합

**수정:** `app/content/[id].tsx`

**삽입 위치가 중요하다.** 현재 `<ScrollView>` 자식 순서는 다음과 같고, **회차 진행을 확인·설정할 요소가 하나도 없다:**

| 순서 | 섹션 |
|---|---|
| 1 | 포스터 |
| 2 | 제목 / 원제 / 메타(`2026.07 · anime · 12화 · 시청 0회`) |
| 3 | 상태 배지 `WatchStatusBadge` |
| 4 | `GenreBadgeList` |
| 5 | **본 횟수 `WatchCountInput`** |
| **5.5** | **← 여기에 `EpisodeProgressCard` 삽입** |
| 6 | 줄거리 `styles.overview` |
| 7 | `WatchProviderList` |
| 8 | 성우/배우 `styles.castSection` |
| 9 | 내 목록 상태 + 삭제 `styles.addPanel` |
| 10 | `ContentReviewEditor` |
| 11 | 하단 액션(`에피소드 보기`/`핀 목록`/`목록`) |

- 렌더 조건: `libraryItem`이 있고 `view.contentType !== "movie"`. 외부 검색 결과(미등록) 상세에는 렌더하지 않는다.
- 메타 행의 `12화`는 총 화수이므로 그대로 두고, 진행 정보는 카드에서만 표시해 역할을 분리한다.
- **딥링크 포커스:** `params` 타입에 `focus?: string` 추가. `params.focus === "progress"`면 `ScrollView`에 `ref`를 걸고 카드의 `onLayout` y로 `scrollTo({ y: y - 24, animated: true })`를 **`useRef` 가드로 1회만** 실행. 동시에 `highlighted`를 1500ms 유지 후 해제.
- `useSeasons(contentId)`로 시즌 목록을 받아 카드에 넘긴다.

---

### STEP 9 — 라이브러리 카드

**수정:** `src/components/content/ContentGalleryCard.tsx`, `src/components/content/ContentCard.tsx`, `app/(tabs)/library.tsx`

1. `continueLabel.text`를 렌더하고, `continueLabel.action`으로 분기한다:
   - `"open_progress_setting"` → `onOpenProgressSetting?.()`
   - `"open_episodes"` → 기존 `onOpenEpisodes()`
2. 두 카드에 `onOpenProgressSetting?: () => void` prop 추가. 미제공이면 `onOpenEpisodes`로 폴백.
3. `accessibilityLabel`을 `` `${item.title_primary} ${continueLabel.accessibilityLabel}` ``로 구성.
4. `시청 위치 설정` 배지는 시각적으로 구분 — 기존 `styles.continueButton`(연한 배경) 대신 `colors.primary` 테두리 + `colors.primary` 텍스트의 outline 변형 `styles.continueButtonCta` 추가.
5. `app/(tabs)/library.tsx`에서 배선:

```ts
onOpenProgressSetting={() =>
  router.push({
    pathname: "/content/[id]",
    params: { id: item.content_id, focus: "progress", ...libraryRouteParams }
  })
}
```

---

### STEP 10 (P1) — 에피소드 화면

**수정:** `src/components/content/EpisodeSelector.tsx`, `app/content/[id]/episodes.tsx`

1. 목록 상단 진행 요약 배너 1줄: `12/24화 시청 · 다음 13화` + 우측 `진행 위치 설정` 텍스트 버튼(상세로 이동)
2. `EpisodeRow`에 **long press** 추가 → `Alert`로 `"{N}화까지 봤음으로 표시할까요?"` 확인 후 `updateLibraryManualProgress` 호출. **체크박스 단일 탭 동작은 변경 금지.** 배너 하단에 `길게 누르면 그 회차까지 봤음으로 설정됩니다` 힌트 1줄.
3. `onToggleProgress` 호출 시 `libraryItem`을 함께 전달해 STEP 6의 동기화가 작동하게 한다. `episodes.tsx`에서 `useLibrary("all")`로 찾아 넘긴다.
4. 마지막 화 체크 시 상태 자동 전환을 **새로 구현하지 마라** — 기존 계약(사용자 확인 전 변경 금지)을 그대로 둔다.

---

## 엣지 케이스 (구현 시 반드시 처리)

`docs/12_episode_progress_spec.md` §12에 15개가 표로 있다. 특히 놓치기 쉬운 것들:

- **E-4** 수동값(3화) < 파생값(20화) → 수동값이 이긴다. 카드에 `에피소드 체크로는 20화까지 기록되어 있습니다` 안내 표시
- **E-8** `watch_count`(본 횟수)와 **완전히 독립**. 서로 건드리지 않는다
- **E-10** `wishlist` 작품에 진행 위치 설정 허용. 상태 자동 변경 없이 `보는 중으로 바꿀까요?` 제안 `Alert`만 1회
- **E-11** 회차 0 저장 → `manual = 0`, 라벨은 `1화부터 시작`, `progress_source === "manual"`
- **E-12** 마지막 화까지 설정 → `모든 화 시청`. 상태 자동 전환 없이 `완료로 표시할까요?` 제안 `Alert`만 1회
- **E-15** 마이그레이션 미적용 → 폴백 경로 + `isUnavailable`. **크래시 절대 금지**

---

## VERIFY (모두 오류 0건이어야 함)

```bash
npm test
```
```bash
npm run typecheck
```
```bash
npm run lint
```

`createContinueWatchingLabel` 반환 타입 변경으로 호출부 타입 오류가 나는 것은 **정상**이다. 전부 수정하라.

---

## DEFINITION OF DONE

1. 위 3개 명령이 각각 오류 0건으로 통과한다.
2. `docs/12_episode_progress_spec.md` §15.3의 수동 QA 체크리스트 15개 항목을 스스로 검증하고, 검증할 수 없는 항목은 이유와 함께 보고한다.
3. 진행 위치를 한 번도 설정하지 않은 "보는 중" 작품에서 **`1화부터 시작` 문자열이 더 이상 나타나지 않는다** (사용자가 명시적으로 0화를 저장한 경우 제외).
4. 진행 위치 설정에 필요한 탭 수가 **상세 화면 진입 후 최대 3회**다.
5. 수동값과 에피소드 체크 상태가 모순되는 조합을 만들 수 없다.
6. 신규/변경 파일이 아래 목록과 일치한다.

| 파일 | 종류 |
|---|---|
| `supabase/migrations/0020_user_library_manual_episode_progress.sql` | 신규 |
| `src/utils/episodeProgress.ts` / `.test.ts` | 신규 |
| `src/utils/continueWatching.ts` | 수정 |
| `src/utils/continueWatching.test.ts` | 신규 |
| `src/types/library.ts` | 수정 |
| `src/services/library.ts` | 수정 |
| `src/hooks/useLibrary.ts` | 수정 |
| `src/components/content/EpisodeProgressCard.tsx` | 신규 |
| `app/content/[id].tsx` | 수정 |
| `src/components/content/ContentGalleryCard.tsx` | 수정 |
| `src/components/content/ContentCard.tsx` | 수정 |
| `app/(tabs)/library.tsx` | 수정 |
| `src/components/content/EpisodeSelector.tsx` | 수정 (P1) |
| `app/content/[id]/episodes.tsx` | 수정 (P1) |

---

## 보고할 것

작업 완료 시 다음을 보고하라:

1. STEP 1의 RLS 정책 확인 결과 (열거형이었는지 여부, 정책을 갱신했는지)
2. 3개 검증 명령의 **실제 출력**
3. 수동 QA 15개 중 코드로 검증할 수 없어 사람 확인이 필요한 항목 목록
4. 명세와 다르게 구현한 부분이 있다면 그 이유 (없으면 "없음")

---

## 금지사항 (AGENTS.md 규칙 + 이 작업 고유)

- `docs/`와 `.claude/` 삭제·덮어쓰기 금지
- 외부 API 키 하드코딩 금지, service_role key를 Expo 앱에 포함 금지
- RLS 없는 사용자 데이터 테이블 추가 금지
- `git reset`, 강제 overwrite, 대규모 삭제 금지
- **새 쿼리 키 생성 금지** (`queryKeys.library.*` 재사용)
- **`watch_count` / `status` / `status_flags` 로직 변경 금지**
- **`queryKeys.profile.stats` 무효화 금지**
- **테스트 파일에서 React·Supabase import 금지** (`tsx --test`가 깨진다)
- **D-1~D-7 설계 결정 임의 변경 금지** — 바꿔야 한다고 판단되면 구현 대신 이유를 보고하라
