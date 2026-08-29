# SceneNote 보완 작업 — 시청 진행 위치 기능 결함 수정 (FEAT-PROGRESS-01-FIX)

SceneNote 저장소에서 아래 작업을 끝까지 수행하라.

## 배경

`FEAT-PROGRESS-01`(시청 진행 위치 설정) 구현은 이미 커밋되어 있고 `npm test`(247 pass) · `npm run typecheck` · `npm run lint`가 모두 통과한다. 아래는 그 구현을 명세와 대조 검증해 발견한 **결함 5건**이다. 기능을 새로 만드는 작업이 아니라 **기존 구현을 고치는 작업**이다.

**READ FIRST**

1. `AGENTS.md`
2. `docs/12_episode_progress_spec.md` — 원 명세 (F-1은 이 명세 자체의 오류다. 아래 지시가 우선한다)
3. `docs/13_codex_prompt_episode_progress.md` — 원 구현 지시문

---

## F-1 (P1) — 단일 시즌 작품에 진행 바가 표시되지 않는다

**현상:** 총 화수를 아는 단일 시즌 작품(예: 12화짜리 애니)에서 진행 바가 렌더되지 않는다.

**위치:** `src/components/content/EpisodeProgressCard.tsx` — 진행 바 렌더 조건

```tsx
{hasSeasonSelector && totalEpisodes !== null ? ( ... 진행 바 ... ) : null}
```

**원인:** `docs/12_episode_progress_spec.md` §11.1의 "시즌 정보 없음 / 단일 시즌" 와이어프레임이 "진행 바도 숨긴다"라고 적었는데, 이는 **"총 화수 미상"과 "단일 시즌"을 혼동한 명세 오류**다. 진행 바를 못 그리는 유일한 이유는 총 화수를 모르는 것이지 시즌이 하나인 것이 아니다.

**수정:** 조건에서 `hasSeasonSelector &&`를 제거한다.

```tsx
{totalEpisodes !== null ? ( ... 진행 바 ... ) : null}
```

**확인:** 12화 단일 시즌 작품에서 `6화` 저장 시 진행 바가 50%로 표시되어야 한다.

---

## F-2 (P1) — 라이브러리 카드의 이어보기 배지가 에피소드 화면으로 가지 않는다

**현상:** `다음: 13화 · 12/24화` 배지를 눌러도 에피소드 목록으로 이동하지 않고 진행 위치 설정 모달이 열린다. 라이브러리에서 회차별 체크·핀 추가로 가는 경로가 끊겼다.

**위치:** `app/(tabs)/library.tsx` — `ContentGalleryCard` / `ContentCard` 두 곳 모두

```tsx
onOpenEpisodes={() => openProgressEditor(item)}        // ← 잘못됨
onOpenProgressSetting={() => openProgressEditor(item)}
```

**원인:** `createContinueWatchingLabel`이 `action: "open_episodes" | "open_progress_setting"`을 구분해 반환하는데, 두 핸들러를 같은 함수에 연결해 분기가 무의미해졌다. `docs/12_episode_progress_spec.md` §11.3의 계약 위반이다.

**수정:** 두 카드 모두 `onOpenEpisodes`를 에피소드 화면 이동으로 되돌린다.

```tsx
onOpenEpisodes={() =>
  router.push({
    pathname: "/content/[id]/episodes",
    params: { id: item.content_id }
  })
}
onOpenProgressSetting={() => openProgressEditor(item)}
```

**확인:** `시청 위치 설정` 배지 → 모달이 열린다. `다음: N화` 배지 → 에피소드 목록으로 이동한다.

---

## F-3 (P1) — 라이브러리 모달에서 저장하면 상태 전환 제안이 뜨지 않는다

**현상:** 같은 "진행 위치 저장" 동작인데 진입 경로에 따라 결과가 다르다.

- 상세 화면(`app/content/[id].tsx` `saveManualProgress`) → 완주 시 `완료로 표시할까요?`, wishlist면 `보는 중으로 바꿀까요?` 제안이 뜬다
- 라이브러리 모달(`app/(tabs)/library.tsx` `saveProgress`) → **아무 제안도 없다**

**추가로 발견된 버그:** 상세 화면의 wishlist 분기에 `absolute > 0` 가드가 없다. 그래서 wishlist 작품에 **`0화`(아직 안 봄)를 저장해도 `보는 중으로 바꿀까요?`가 뜬다.** 명세 E-10의 의도("시청을 시작했다")와 어긋난다.

**수정 — 판정 로직을 순수 함수로 추출하고 양쪽에서 함께 쓴다.**

**신규 파일:** `src/utils/progressStatusSuggestion.ts`

```ts
import type { WatchStatus } from "@/types/library";

export type ProgressStatusSuggestion = "mark_completed" | "mark_watching" | null;

export function getProgressStatusSuggestion(params: {
  statuses: WatchStatus[];
  absoluteWatchedThrough: number;
  totalEpisodes: number | null;
}): ProgressStatusSuggestion;
```

**판정 순서 (반드시 이 순서):**

1. `totalEpisodes !== null && absoluteWatchedThrough >= totalEpisodes && !statuses.includes("completed")` → `"mark_completed"`
2. `absoluteWatchedThrough > 0 && statuses.includes("wishlist") && !statuses.includes("watching")` → `"mark_watching"`
3. 그 외 → `null`

**신규 테스트:** `src/utils/progressStatusSuggestion.test.ts` — 아래 표 전부

| # | statuses | absolute | total | → 결과 |
|---|---|---|---|---|
| 1 | `["watching"]` | 24 | 24 | `mark_completed` |
| 2 | `["completed"]` | 24 | 24 | `null` |
| 3 | `["watching"]` | 12 | 24 | `null` |
| 4 | `["wishlist"]` | 1 | 24 | `mark_watching` |
| 5 | `["wishlist"]` | 0 | 24 | `null` |
| 6 | `["wishlist","watching"]` | 5 | 24 | `null` |
| 7 | `["wishlist"]` | 24 | 24 | `mark_completed` |
| 8 | `["watching"]` | 30 | null | `null` |
| 9 | `["wishlist"]` | 3 | null | `mark_watching` |
| 10 | `[]` | 5 | 24 | `null` |

**적용:**

- `app/content/[id].tsx`의 `saveManualProgress` `onSuccess`에서 기존 if/else 체인을 `getProgressStatusSuggestion` 호출로 교체한다. Alert 문구와 버튼은 그대로 둔다.
- `app/(tabs)/library.tsx`의 `saveProgress` `onSuccess`에 같은 제안 로직을 추가한다. 모달을 먼저 닫은 뒤 Alert을 띄운다.
- 두 화면 모두 `progress === null`(되돌리기)일 때는 제안하지 않는다.

---

## F-4 (P2) — 입력 검증이 총 화수 상한을 확인하지 않는다

**현상:** 선택 시즌의 `episode_count`가 `null`이고 총 화수(`totalEpisodes`)만 아는 경우, 총 화수를 초과하는 값이 검증을 통과해 DB에 저장된다. 읽기 시 `resolveEpisodeProgress`가 clamp하므로 화면은 정상이지만 **DB에 잘못된 값이 남는다.**

**위치:** `src/utils/episodeProgress.ts` — `normalizeManualEpisodeInput`은 `exceeds_season_total`을 선택 시즌 `episode_count`로만 검사한다. 반면 카드의 `upperBound`는 `selectedSeason?.episode_count ?? totalEpisodes ?? MAX_MANUAL_EPISODE_NUMBER`로 폴백한다. 둘의 상한이 다르다.

**수정:** `normalizeManualEpisodeInput` 파라미터에 `totalEpisodes?: number | null`을 추가하고, 상한을 카드와 동일한 폴백 순서로 계산한다.

```ts
export function normalizeManualEpisodeInput(params: {
  rawEpisodeNumber: string;
  seasonNumber: number | null;
  seasons: SeasonEpisodeCount[];
  totalEpisodes?: number | null;
}): { ok: true; episodeNumber: number } | { ok: false; reason: ManualProgressError };
```

상한 = `선택 시즌의 episode_count ?? totalEpisodes ?? MAX_MANUAL_EPISODE_NUMBER`.
상한을 초과하면 기존 `exceeds_season_total`을 그대로 반환한다(새 reason을 만들지 마라).

**호출부:** `EpisodeProgressCard`의 `save()`에서 `totalEpisodes`를 넘긴다.

**테스트 추가** (`src/utils/episodeProgress.test.ts`):

| seasons | seasonNumber | totalEpisodes | 입력 | → 결과 |
|---|---|---|---|---|
| `[{1, null}]` | 1 | 24 | `"25"` | `exceeds_season_total` |
| `[{1, null}]` | 1 | 24 | `"24"` | `ok, 24` |
| `[{1, 12}]` | 1 | 24 | `"13"` | `exceeds_season_total` *(시즌 값 우선)* |
| `[]` | null | null | `"500"` | `ok, 500` |
| `[]` | null | null | `"10000"` | `exceeds_max` |

---

## F-5 (P2) — 헤더 수치는 미저장 draft, 모드 배지는 저장값이라 서로 모순된다

**현상:** `+`를 눌러 값을 올리면 헤더의 `12 / 24화`와 진행 바가 **저장하기 전에** 즉시 움직인다. 그런데 바로 옆 배지는 저장된 상태인 `직접 설정함`을 계속 표시한다. 사용자는 이미 저장된 것으로 오인한다.

**위치:** `src/components/content/EpisodeProgressCard.tsx` — `draftProgress`(draft 기준)로 헤더·진행 바를 그리는데 `statusLabel`은 `item.progress_source`(저장값) 기준이다.

**수정:** 라이브 프리뷰 자체는 유용하므로 유지하되, **저장 전에는 배지가 저장 상태를 주장하지 않게** 한다.

- `unchanged === false`이면 `statusLabel`을 `"저장 전"`으로 바꾼다.
- `unchanged === true`이면 기존대로 `"직접 설정함"` / `"에피소드 체크 기준"`.
- `"저장 전"` 배지는 `colors.textMuted` 계열로 두어 저장 상태와 시각적으로 구분한다.

---

## 절대 지킬 것

- 위 5건 **외의 동작을 바꾸지 마라.** 리팩터링·스타일 정리·미사용 코드 제거를 함께 하지 마라.
- `docs/12_episode_progress_spec.md`의 설계 결정 D-1~D-7을 바꾸지 마라. **단 F-1은 명세 §11.1이 틀린 것이므로 위 지시를 따르고, 명세 §11.1의 "진행 바도 숨긴다" 문장을 "총 화수를 모르면 진행 바를 숨긴다"로 함께 수정하라.**
- 새 쿼리 키를 만들지 마라.
- `watch_count` / `status` / `status_flags` 로직을 변경하지 마라. (F-3의 상태 전환은 기존 `toggleStatus` / `useUpdateLibraryStatuses`를 그대로 쓴다)
- `queryKeys.profile.stats`를 무효화하지 마라.
- 테스트 파일에서 React·Supabase를 import하지 마라 (`tsx --test`가 깨진다).
- 기존 247개 테스트가 계속 통과해야 한다.

## 검증 (모두 오류 0건이어야 함)

    npm test
    npm run typecheck
    npm run lint

## 완료 후 보고할 것

1. F-1~F-5 각각에 대해 수정한 파일과 라인
2. 위 3개 명령의 실제 출력 (테스트 총 개수 포함)
3. 추가한 테스트 케이스 수
4. 명세와 다르게 구현한 부분과 그 이유 (없으면 "없음")
