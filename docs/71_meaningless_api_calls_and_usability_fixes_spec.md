# 71. 의미 없는 API 호출 차단 + 사용자 관점 편의성 정정

작성일: 2026-11-16
대상 브랜치 기준: main (c7aeca8)
선행 문서: [00 UI](00_ui_style_rules.md), [63](63_episode_progress_count_choices_fixes_spec.md), [64](64_recommendation_invocation_cost_fixes_spec.md), [65](65_search_debounce_and_request_timeout_fixes_spec.md), [68](68_auth_usability_and_error_copy_qa_2026-11-15.md), [69](69_persistent_public_metadata_cache_fixes_spec.md)

> 정정 작업이다. **앱(클라이언트)만 바꾼다.** Edge Function·DB는 바꾸지 않으므로 배포·마이그레이션이 없다.
> docs/69가 "방영 중 공개 회차는 30분 갱신 유지"로 남겨 둔 `fetch-episodes availability_only` 경로와, docs/65·69가 다루지 않은 TanStack Query 기본값(창 복귀 재조회·자동 재시도)을 점검한 결과다.

## 1. 문제 정의

| ID | 구분 | 사용자가 겪는 것 / 낭비되는 것 |
|----|------|------------------------------|
| F-1 | API | 총 화수를 아는 작품(대부분)의 상세를 열 때마다 "공개 회차 조회" Edge 호출 + 외부 API 호출이 나가지만 **응답을 화면 어디에도 쓰지 않는다** |
| F-2 | API | 홈 "이어 보기"·라이브러리 카드가 "보는 중" 작품마다 공개 회차를 조회한다. 답이 정해진 작품(Kitsu, 완결된 AniList 애니, 이미 전 회차 공개가 확인된 시즌)도 앱을 켤 때마다, 그리고 30분마다 다시 부른다 |
| F-3 | API | 웹에서 다른 탭·창에 다녀오면 검색 결과가 통째로 다시 조회된다. 5쪽을 내려 본 상태면 Edge 호출 5번이 한꺼번에 나간다 |
| F-4 | API | Edge 호출이 실패하면 자동으로 한 번 더 부른다. 제한 시간(14초) 초과면 사용자는 오류 화면까지 약 29초를 기다리고, 400·401·546처럼 다시 해도 같은 실패도 호출이 두 배가 된다 |
| F-5 | UI | 화면 문구에 개발 용어 "API"가 나온다("API에서 이 작품의 화수를 알려 주지 않아요", "API 공개 회차 7개", "일부 외부 API 결과가…") |
| F-6 | UI | 총 화수가 미정인 방영 중 작품은 회차 버튼만 나오고 진행 막대가 없어, 총 화수가 있는 작품(예: "4 / 8화" + 막대)과 카드 틀이 달라진다 |
| F-7 | UI | 앱(iOS·Android)에는 라이브러리·핀·홈을 새로 고칠 방법이 없다. 웹에서 고친 기록이 앱에 안 보일 때 앱을 껐다 켜야 한다 |

## 2. 근본 원인

**F-1.** [EpisodeProgressCard.tsx:63-66](../src/components/content/EpisodeProgressCard.tsx) — `useEpisodeAvailability(..., !completedMode && seasons.length > 0)`. 그런데 응답(`releasedEpisodes`)은 `resolveEpisodeChoiceMode`([contentDetailView.ts:89-100](../src/utils/contentDetailView.ts))에서 **화수(1~200)를 모를 때만** 쓰인다. 화수를 알면 `count` 모드가 먼저 선택되어 응답이 버려진다. 서버 `fetchEpisodeAvailability`는 캐시 없이 매번 TMDB/AniList를 부른다([externalContent.ts:788](../supabase/functions/_shared/externalContent.ts)).

**F-2.** [airingAvailability.ts:10-15](../src/utils/airingAvailability.ts) `seasonToCheck`는 "보는 중 · 영화 아님 · 진행 기록 있음"만 본다.
- Kitsu는 서버가 항상 `null`을 돌려준다(`externalContent.ts:848`). 호출해도 결과가 없다.
- AniList 애니는 `contents.end_date`가 완결일이다(`externalContent.ts:546`, `media.endDate`). 완결일이 지났고 시즌 화수를 알면 "전 회차 공개"가 확정이다.
- [useAiringAvailability.ts:35-36](../src/hooks/useAiringAvailability.ts) `refetchInterval`은 응답이 "전 회차 공개"여도 30분마다 다시 부른다.
- TMDB의 `end_date`는 `last_air_date`(마지막 **방영된** 회차 날짜, `externalContent.ts:206`)라 방영 중에도 과거 날짜다. 완결 판정에 쓸 수 없다(→ D-3).

**F-3·F-4.** [query.ts:8-19](../src/lib/query.ts) 전역 기본값이 `retry: 1`이고 `refetchOnWindowFocus`·`refetchOnReconnect`는 TanStack 기본값(`true`)이다. 아래 Edge 조회는 이를 덮어쓰지 않는다.

| 훅 | 좌표 | staleTime | 호출 |
|----|------|-----------|------|
| `useContentSearch` | `src/hooks/useContentSearch.ts:19-28` | 5분 | `search-content` × 불러온 쪽 수(`useInfiniteQuery`는 전 쪽을 다시 받는다) |
| `usePersonContentSearch` | `src/hooks/usePeople.ts:24-31` | 1분 | `search-person-content` 1~2회(로마자 폴백, `src/services/people.ts:34`) |
| `usePopularRecommendations` | `src/hooks/usePopularRecommendations.ts:20-25` | 30분 | `popular-recommendations` |
| `useEpisodeAvailability` | `src/hooks/useAiringAvailability.ts:31-37` | 30분 | `fetch-episodes` × 카드 수 |
| `useEpisodes` | `src/hooks/useLibrary.ts:68-73` | 10분 | DB에 회차가 없으면 `fetch-episodes`(`src/services/library.ts:595`) |
| 공유 라이브러리 | `src/components/library/LibraryShareScreenContent.tsx:38-43` | 5분 | `get-library-share` |
| `useSimilarContent` | `src/hooks/useSimilarContent.ts:22-31` | 10분 | `similar-content` × 쪽 수 (`retry: 0`은 이미 있음) |

창 복귀 재조회는 웹에서만 일어난다(앱은 `focusManager`를 연결하지 않았다). 상세·인물·보러가기는 docs/69의 `MANUAL_METADATA_QUERY_OPTIONS`로, 개인화 추천은 `usePersonalizedRecommendations.ts:192-193`으로 이미 막혀 있다.

**F-5.** `contentDetailView.ts:87`, `:110`, `app/search.tsx:851`, `app/(tabs)/people.tsx:196`, `app/content/[id]/episodes.tsx:60`.

**F-6.** `EpisodeProgressCard.tsx:157-178` — 요약과 진행 막대가 `totalEpisodes !== null`일 때만 분모를 가진다. `released` 모드에는 "공개된 회차 중 어디까지 봤는지"라는 분모(최근 공개 회차)가 있는데 쓰지 않는다.

**F-7.** `RefreshControl`·`onRefresh`가 저장소 전체에 없다(`grep -rn "RefreshControl\|onRefresh" app src` 0줄). 목록 좌표: `app/(tabs)/library.tsx:701`(FlashList), `app/(tabs)/pins.tsx:254`(FlashList), `app/(tabs)/index.tsx:41`(ScrollView).

## 3. 재현 시나리오

웹 8081, 로그인 상태, 브라우저 개발자 도구 Network에서 `functions/v1` 필터.

1. (F-1) 총 화수가 있는 "보는 중" 드라마 상세를 연다 → `fetch-episodes`(`availability_only: true`) 1건. 화면은 1~N화 버튼뿐이고 응답을 쓰지 않는다.
2. (F-2) 완결된 AniList 애니를 "보는 중"으로 둔 채 홈을 연다 → 그 카드 때문에 `fetch-episodes` 1건. 30분 뒤 다시 1건.
3. (F-3) 검색어 입력 → 아래로 3쪽 → 다른 탭에서 6분 뒤 복귀 → `search-content` 3건이 다시 나간다.
4. (F-4) 개발자 도구에서 `search-content`를 차단(Block request URL)하고 검색 → 실패 요청 2건 뒤에야 오류 화면.
5. (F-5·F-6) 총 화수 미정 방영작(예: AniList 185756) 상세 → "API 공개 회차 7개 …" 문구, 진행 막대 없음.
6. (F-7) 앱에서 라이브러리를 아래로 당겨도 아무 일이 없다.

## 4. 설계 결정

### D-1. 공개 회차 조회는 "응답을 쓸 화면"에서만 켠다 (F-1)
`resolveEpisodeChoiceMode`의 `count` 판정과 **같은 조건**을 `needsReleasedEpisodeLookup`으로 뽑아 `EpisodeProgressCard`의 `enabled`에 건다. 조건을 두 곳에 따로 쓰면 한쪽만 바뀌어 "버튼도 없고 조회도 없는" 구멍이 생기므로, `resolveEpisodeChoiceMode`도 이 함수를 호출하게 한다.

### D-2. 카드의 조회 계획을 순수 함수 하나로 정한다 (F-2)
`planAiringAvailability(item, todayKst)`가 `none`(조회 안 함) / `local`(앱에서 확정) / `remote`(서버 조회) 중 하나를 돌려준다. 판정 순서는 6장. 훅은 `remote`일 때만 `useEpisodeAvailability`를 켠다.

### D-3. `local`은 AniList 완결작에만 쓴다. TMDB·TVmaze는 계속 서버에 묻는다
TMDB `end_date`는 방영 중에도 과거 날짜라 완결 근거가 못 된다(2장). 저장된 날짜로 추정하면 새 시즌이 시작돼도 "전 회차 공개"로 고정되는 오표시가 생긴다. 근거가 확실한 AniList `endDate`만 쓴다.

### D-4. `local` 결과는 "시즌 전 회차 공개"다
`{ releasedEpisodeNumber: 시즌 화수, upcomingEpisodeNumber: null, nextAirDate: null }`. 완결작의 사실과 같고, TMDB 완결작이 지금 받는 값과 같다.
> **동작 변화(의도함).** 지금은 AniList가 `streamingEpisodes`·방영 일정을 비워 둔 옛 완결 애니가 서버에서 `null`을 받아 카드에 공개 회차 표시가 없다. 수정 후에는 TMDB 완결작과 똑같이 "남은 N화 공개" 표시가 나온다.

### D-5. "전 회차 공개"가 확인된 시즌은 30분 재조회를 멈춘다
`isAvailabilitySettled(data, seasonEpisodeCount)`가 참이면 `refetchInterval`을 `false`로 한다. 시즌 화수를 모르면(총 화수 미정 방영작) 절대 settled가 아니다 — 새 회차가 계속 나오는 작품의 갱신을 끊으면 안 된다.

### D-6. Edge 목록 조회는 자동 재시도·창 복귀·재연결 재조회를 끈다 (F-3·F-4)
공용 상수 `EDGE_LIST_QUERY_OPTIONS = { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false }`를 2장 표의 7개 조회에 펼쳐 넣는다. 모두 화면에 "다시 시도"가 있거나(검색·인물·인기 추천·회차·공유), 조용히 비워 두는 보조 표시(카드 공개 회차)다. `staleTime`·`gcTime`·`enabled`·`refetchInterval`은 건드리지 않는다. **전역 기본값(`query.ts`)은 바꾸지 않는다** — 사용자 기록(DB) 조회는 창 복귀 때 최신화되는 것이 맞다.

### D-7. 문구에서 "API"를 뺀다 (F-5)
8장 문구 표 그대로. 톤은 해요체(UI-6.5).

### D-8. `released` 모드 진행 막대의 분모는 "최근 공개 회차"다 (F-6)
총 화수가 없고, 시즌 선택이 없는(단일 시즌 범위) `released` 모드에서만 분모를 최근 공개 회차로 둔다. 요약은 "7 / 공개 7화". 방영 예정 회차(AniList 일정의 12화 등)를 총 화수로 쓰지 않는다 — 2026-10-16 결정(추정 금지)을 유지한다. 여러 시즌 범위는 `watchedThrough`가 전체 누적값이라 시즌 내 공개 회차와 단위가 달라 제외한다.

### D-9. 당겨서 새로고침은 앱에서만, 사용자 기록 조회만 다시 부른다 (F-7)
`Platform.OS !== "web"`일 때만 `RefreshControl`을 단다(웹은 창 복귀 재조회가 있고, 마우스로 당길 수 없다). 다시 부르는 것은 `useLibrary`·핀 조회(DB)뿐이다. 공개 회차·추천 등 Edge 조회를 함께 무효화하지 않는다.

> D-1~D-9는 임의로 바꾸지 않는다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

- **서버에 공개 회차 캐시 테이블 추가.** 마이그레이션·배포가 필요하고, 앱 재시작 때의 Edge 호출 횟수 자체는 줄지 않는다. 호출을 아예 안 하는 D-1·D-2가 먼저다. 이후에도 TMDB 방영작 카드가 많아 문제가 되면 별도 명세로 다룬다.
- **TMDB도 `end_date`로 완결 판정.** D-3의 오표시 위험.
- **전역 `refetchOnWindowFocus: false`.** 핀·라이브러리·진행률이 다른 기기에서 바뀐 것을 웹이 따라가지 못한다.
- **전역 `retry` 함수로 오류 종류 판별.** 서비스가 `new Error(error.message)`로 상태 코드를 버려(`contentSearch.ts:80` 등) 판별 근거가 없다. 서비스 전체 수정은 범위가 크다.
- **앱에 `focusManager`(AppState) 연결.** 앱 복귀 때마다 조회가 늘어난다. 사용자가 원할 때만 부르는 D-9가 docs/69의 "명시 갱신" 방향과 같다.
- **방영 예정 마지막 회차를 총 화수로 사용.** 추정이다(D-8).

## 6. 계약 (타입 · 판정 순서)

`src/utils/contentDetailView.ts`

```ts
/** 화수(1~EPISODE_CHOICE_MAX)를 모를 때만 공개 회차 조회가 필요하다. resolveEpisodeChoiceMode의 count 판정과 같은 조건. */
export function needsReleasedEpisodeLookup(input: {
  seasonEpisodeCount: number | null | undefined;
  totalEpisodes: number | null;
}): boolean;

export function episodeProgressHeader(input: {
  watchedThrough: number;        // draftProgress.watchedThrough
  draftEpisodeNumber: number;    // 시즌 내 회차
  totalEpisodes: number | null;
  mode: EpisodeChoiceMode;
  hasSeasonSelector: boolean;
}): { summary: string; barMax: number | null; barNow: number };
```

`episodeProgressHeader` 판정 순서:
1. `totalEpisodes !== null` → `{ summary: "${watchedThrough} / ${totalEpisodes}화", barMax: totalEpisodes, barNow: watchedThrough }` (현행 유지)
2. `mode.kind === "released"` 이고 `!hasSeasonSelector` → `latest = mode.numbers.at(-1)`, `{ summary: "${draftEpisodeNumber} / 공개 ${latest}화", barMax: latest, barNow: min(draftEpisodeNumber, latest) }`
3. 그 외 → `{ summary: "${watchedThrough}화까지 시청", barMax: null, barNow: watchedThrough }` (현행 유지)

`src/utils/airingAvailability.ts`

```ts
export function koreaToday(now?: Date): string; // "YYYY-MM-DD" (KST). 파일 안의 기존 인라인 계산과 같은 식

export type AiringAvailabilityPlan =
  | { kind: "none" }
  | { kind: "local"; seasonNumber: number; availability: { releasedEpisodeNumber: number; upcomingEpisodeNumber: null; nextAirDate: null } }
  | { kind: "remote"; seasonNumber: number };

export function planAiringAvailability(item: WatchingItem, todayKst: string): AiringAvailabilityPlan;

export function isAvailabilitySettled(
  data: { releasedEpisodeNumber: number | null; nextAirDate: string | null } | undefined,
  seasonEpisodeCount: number | null | undefined
): boolean;
```

`WatchingItem`에 `Partial<Pick<LibraryListItem, "end_date">>`를 더한다(기존 `source_api`와 같은 방식).

`planAiringAvailability` 판정 순서:
1. `seasonToCheck(item) === null` → `none`
2. `item.source_api === "kitsu"` → `none`
3. `item.source_api === "anilist"` 이고 `item.end_date`가 `YYYY-MM-DD` 형식이며 `end_date <= todayKst` 이고, `season_episode_counts`에서 그 시즌의 `episode_count`가 1 이상의 정수 → `local`(`releasedEpisodeNumber = episode_count`)
4. 그 외 → `remote`

`isAvailabilitySettled`: `data`가 있고, `seasonEpisodeCount`가 1 이상의 정수이고, `releasedEpisodeNumber !== null && releasedEpisodeNumber >= seasonEpisodeCount`이고, `nextAirDate === null`일 때만 `true`.

`src/utils/metadataQuery.ts`

```ts
/** 외부 API를 부르는 Edge 목록 조회. 실패는 화면의 "다시 시도"로만 다시 부른다(docs/71 D-6). */
export const EDGE_LIST_QUERY_OPTIONS = { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;
```

`src/hooks/useAiringAvailability.ts`
- `useAiringAvailability(item)`: `plan = planAiringAvailability(item, koreaToday())`. `useEpisodeAvailability(item.content_id, plan.kind === "remote" ? plan.seasonNumber : null)`를 **항상 호출**(훅 순서 고정). `plan.kind === "none"` → `{ availableCount: 0, upcomingLabel: null }`. `local` → `plan.availability`로, `remote` → 조회 결과로 기존 `releasedUnwatchedCount`·`upcomingEpisodeDate` 계산.
- `useEpisodeAvailability`: 시그니처 유지. `...EDGE_LIST_QUERY_OPTIONS` 추가, `refetchInterval: (query) => enabled && !isAvailabilitySettled(query.state.data, season?.episode_count) ? REFRESH_INTERVAL_MS : false`.

`src/hooks/usePullToRefresh.ts` (신규)

```ts
/** 사용자가 당겼을 때만 refreshing이 참이다(백그라운드 재조회에 표시가 돌지 않게). */
export function usePullToRefresh(refetchers: readonly (() => Promise<unknown>)[]): { refreshing: boolean; onRefresh: () => void };
```
`onRefresh`: 이미 `refreshing`이면 무시. `Promise.allSettled(refetchers.map(run))` 뒤 `refreshing = false`(언마운트 뒤 setState 금지).

## 7. 데이터 모델 / SQL

없음.

## 8. 화면 명세

UI 규칙 준수(UI-1~UI-13). 화면 고유 값만 적는다.

**문구 (F-5)**

| 좌표 | 현재 | 변경 |
|------|------|------|
| `contentDetailView.ts:87` `EPISODE_CHOICE_MANUAL_COPY` | API에서 이 작품의 화수를 알려 주지 않아요. 본 회차를 직접 입력해 주세요. | 아직 화수 정보가 없어요. 본 회차를 직접 입력해 주세요. |
| `contentDetailView.ts:110` | API 공개 회차 N개 · 최근 M화[ · 총 화수 미정] | 공개된 회차 N개 · 최근 M화[ · 총 화수 미정] |
| `app/search.tsx:851`, `app/(tabs)/people.tsx:196` | 일부 외부 API 결과가 표시되지 않을 수 있습니다. | 일부 검색 결과를 불러오지 못했어요. 빠진 결과가 있을 수 있어요. |
| `app/content/[id]/episodes.tsx:60` | 외부 API에서 아직 시즌 정보를 찾지 못했거나, 이 작품은 에피소드 정보가 없는 형식입니다. | 아직 시즌 정보를 찾지 못했거나, 회차 정보가 없는 작품이에요. |

**시청 진행 카드 (F-6)** — `EpisodeProgressCard.tsx:157-178`. 요약 글자와 진행 막대를 `episodeProgressHeader` 결과로 그린다: 요약 = `summary`, 막대는 `barMax !== null`일 때만, `accessibilityValue={{ min: 0, max: barMax, now: barNow }}`, 채움 폭 = `round(barNow / barMax * 100)%`(`barMax`가 0이면 0%). 스타일은 기존 `progressTrack`·`progressFill` 그대로.

**당겨서 새로고침 (F-7)** — 앱에서만(`Platform.OS !== "web"`), `RefreshControl`의 `tintColor={colors.primary}`.

| 화면 | 대상 | 다시 부르는 것 |
|------|------|----------------|
| `app/(tabs)/library.tsx:701` FlashList | `refreshControl` | `library.refetch` |
| `app/(tabs)/pins.tsx:254` FlashList | `refreshControl` | 현재 보이는 조회(`selectedTagId ? taggedPins.refetch : allPins.refetch`, `pins.tsx:122`의 `retry`와 같은 선택) |
| `app/(tabs)/index.tsx:41` ScrollView | `refreshControl` | `library.refetch`, `pins.refetch` |

## 9. 엣지 케이스

| # | 상황 | 기대 동작 |
|---|------|-----------|
| E-1 | 시즌 화수 12, 총 화수 12 | 조회 불필요(`needsReleasedEpisodeLookup` false), 1~12화 버튼 |
| E-2 | 시즌 화수 null, 총 화수 null | 조회 필요 |
| E-3 | 화수 1100(200 초과) | 조회 필요(`count` 모드 불가) |
| E-4 | 화수 0·소수·음수 | 조회 필요 |
| E-5 | 시즌 화수 null, 총 화수 24 | 조회 불필요(기존 `??` 순서 유지) |
| E-6 | "보는 중"이 아님 / 영화 / 진행 기록 없음 | `none` |
| E-7 | Kitsu "보는 중" | `none` |
| E-8 | AniList, 완결일 어제, 시즌 12화 | `local`, 공개 12 |
| E-9 | AniList, 완결일 오늘(KST) | `local` |
| E-10 | AniList, 완결일 내일 | `remote` |
| E-11 | AniList, 완결일 null(방영 중) | `remote` |
| E-12 | AniList, 완결일 지남, 시즌 화수 null | `remote` |
| E-13 | AniList, `end_date` 형식 오류("2026") | `remote` |
| E-14 | TMDB, `end_date` 과거, 화수 있음 | `remote`(D-3) |
| E-15 | `source_api` 없음(구 호출부) | `remote` |
| E-16 | 응답 공개 12, 시즌 12, 다음 방영 없음 | settled → 30분 재조회 중단 |
| E-17 | 응답 공개 7, 시즌 12 | settled 아님 |
| E-18 | 응답 공개 7, 시즌 화수 null | settled 아님(D-5) |
| E-19 | 응답 공개 12, 시즌 12, 다음 방영일 있음 | settled 아님 |
| E-20 | 응답 없음(undefined) / 공개 null | settled 아님 |
| E-21 | 총 화수 8, 4화 선택 | 요약 "4 / 8화", 막대 4/8 |
| E-22 | 총 화수 없음, `released` [1..7], 단일 시즌, 7화 선택 | 요약 "7 / 공개 7화", 막대 7/7 |
| E-23 | E-22에서 0화 선택 | "0 / 공개 7화", 막대 0 |
| E-24 | 총 화수 없음, `released`, 시즌 선택 있음 | "N화까지 시청", 막대 없음(D-8) |
| E-25 | 총 화수 없음, `manual` | "N화까지 시청", 막대 없음 |
| E-26 | `released`인데 저장값이 최근 공개보다 큼(9 > 7) | "9 / 공개 7화", `barNow` 7(넘치지 않음) |
| E-27 | 당기는 중 다시 당김 | 두 번째는 무시 |
| E-28 | 새로고침 실패 | 표시가 멈추고 기존 목록 유지(기존 `ErrorState` 규칙 그대로) |

## 10. 테스트 표

모든 행을 테스트로 옮긴다. 줄이지 않는다.

| ID | 파일 | 입력 | 기대 | 엣지 |
|----|------|------|------|------|
| T-1 | `contentDetailView.test.ts` | `needsReleasedEpisodeLookup({12, 12})` | false | E-1 |
| T-2 | 〃 | `({null, null})`, `({undefined, null})` | true | E-2 |
| T-3 | 〃 | `({null, 1100})`, `({201, null})` | true | E-3 |
| T-4 | 〃 | `({0, null})`, `({1.5, null})`, `({-1, null})` | true | E-4 |
| T-5 | 〃 | `({null, 24})`, `({200, null})`, `({1, null})` | false | E-5 |
| T-6 | 〃 | T-1~T-5의 각 입력에서 `resolveEpisodeChoiceMode(...releasedEpisodes: []).kind === "count"` ⇔ `needsReleasedEpisodeLookup === false` | 항상 일치 | D-1 |
| T-7 | 〃 | `episodeChoiceInfoText` released [1,2,3], total null | "공개된 회차 3개 · 최근 3화 · 총 화수 미정" (기존 `:100` 단언 수정) | F-5 |
| T-8 | 〃 | released [1,2], total 1100 | "공개된 회차 2개 · 최근 2화" (기존 `:101` 수정) | F-5 |
| T-9 | 〃 | `EPISODE_CHOICE_MANUAL_COPY` | "아직 화수 정보가 없어요. 본 회차를 직접 입력해 주세요." (기존 `:105` 수정) | F-5 |
| T-10 | 〃 | `episodeProgressHeader` total 8, watched 4 | `{ "4 / 8화", 8, 4 }` | E-21 |
| T-11 | 〃 | total null, released [1..7], 단일 시즌, draft 7 | `{ "7 / 공개 7화", 7, 7 }` | E-22 |
| T-12 | 〃 | T-11에서 draft 0 | `{ "0 / 공개 7화", 7, 0 }` | E-23 |
| T-13 | 〃 | total null, released, `hasSeasonSelector: true`, watched 15 | `{ "15화까지 시청", null, 15 }` | E-24 |
| T-14 | 〃 | total null, manual, watched 3 | `{ "3화까지 시청", null, 3 }` | E-25 |
| T-15 | 〃 | total null, released [1..7], draft 9 | `{ "9 / 공개 7화", 7, 7 }` | E-26 |
| T-16 | `airingAvailability.test.ts` | 완료 상태 / 영화 / `progress_source: "none"` | `none` | E-6 |
| T-17 | 〃 | kitsu 보는 중 | `none` | E-7 |
| T-18 | 〃 | anilist, end "2026-11-15", 오늘 "2026-11-16", 시즌 12 | `local`, released 12, upcoming null, nextAirDate null | E-8 |
| T-19 | 〃 | anilist, end == 오늘 | `local` | E-9 |
| T-20 | 〃 | anilist, end 내일 | `remote` | E-10 |
| T-21 | 〃 | anilist, end null | `remote` | E-11 |
| T-22 | 〃 | anilist, end 과거, 시즌 화수 null | `remote` | E-12 |
| T-23 | 〃 | anilist, end "2026" | `remote` | E-13 |
| T-24 | 〃 | tmdb, end 과거, 화수 12 | `remote` | E-14 |
| T-25 | 〃 | `source_api` 없음 | `remote` | E-15 |
| T-26 | 〃 | T-18의 `local` 결과를 `releasedUnwatchedCount`에 넣음(5화까지 봄) | 7 | D-4 |
| T-27 | 〃 | `isAvailabilitySettled({12, null}, 12)` | true | E-16 |
| T-28 | 〃 | `({7, null}, 12)` | false | E-17 |
| T-29 | 〃 | `({7, null}, null)`, `({7, null}, undefined)` | false | E-18 |
| T-30 | 〃 | `({12, "2026-11-22"}, 12)` | false | E-19 |
| T-31 | 〃 | `(undefined, 12)`, `({null, null}, 12)` | false | E-20 |
| T-32 | 〃 | `koreaToday(new Date("2026-11-15T15:00:00Z"))` / `("2026-11-15T14:59:59Z")` | "2026-11-16" / "2026-11-15" | E-9 |
| T-33 | `metadataQuery.test.ts`(신규) | `EDGE_LIST_QUERY_OPTIONS` | `{ retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false }` 깊은 일치 | D-6 |
| T-34 | 〃 | `MANUAL_METADATA_QUERY_OPTIONS` | 현재 값 그대로(회귀 고정) | docs/69 |

보존: `airingAvailability.test.ts`의 기존 `seasonToCheck`·`releasedUnwatchedCount`·`upcomingEpisodeDate` 단언은 그대로 통과해야 한다. `contentDetailView.test.ts`는 `:100`, `:101`, `:105` 세 줄만 문구를 바꾼다.

수동 확인(E-27·E-28과 D-6·D-9는 훅·화면이라 자동 테스트 불가):

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 3장 1번: 총 화수가 있는 작품 상세에서 `fetch-episodes` 0건 |
| M-2 | 웹 1440 | 3장 2번: 완결 AniList 애니 카드로 인한 `fetch-episodes` 0건, 카드에 남은 회차 표시 |
| M-3 | 웹 1440 | 3장 3번: 창 복귀 뒤 `search-content` 0건, 결과 목록 유지 |
| M-4 | 웹 1440 | 3장 4번: 차단 시 실패 요청 1건 뒤 오류 + "다시 시도" 동작 |
| M-5 | 웹 375 | 총 화수 미정 방영작 상세: "공개된 회차 N개 …", "N / 공개 M화" + 막대, 넘침 없음 |
| M-6 | 웹 375 | 검색·인물 탭 부분 실패 안내 문구, 에피소드 빈 화면 문구 |
| M-7 | 앱(iOS 세로) | 라이브러리·핀·홈 당겨서 새로고침: 표시가 돌고 멈춤, 연속 당김 무시, 실패 시 목록 유지 |
| M-8 | 앱(iOS 세로) | 글자 1.3배에서 시청 진행 카드 요약·막대 잘림 없음 |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/contentDetailView.ts` | `needsReleasedEpisodeLookup`, `episodeProgressHeader` 추가, `resolveEpisodeChoiceMode`가 전자를 호출, 문구 2건 |
| `src/utils/contentDetailView.test.ts` | T-1~T-15 |
| `src/utils/airingAvailability.ts` | `koreaToday`, `planAiringAvailability`, `isAvailabilitySettled`, `WatchingItem`에 `end_date` |
| `src/utils/airingAvailability.test.ts` | T-16~T-32 |
| `src/utils/metadataQuery.ts` | `EDGE_LIST_QUERY_OPTIONS` |
| `src/utils/metadataQuery.test.ts` | 신규, T-33·T-34 |
| `src/hooks/useAiringAvailability.ts` | 조회 계획 적용, settled 시 재조회 중단, D-6 |
| `src/hooks/useContentSearch.ts` | `useContentSearch`에 D-6 |
| `src/hooks/usePeople.ts` | `usePersonContentSearch`에 D-6 |
| `src/hooks/usePopularRecommendations.ts` | D-6 |
| `src/hooks/useSimilarContent.ts` | `queryOptions`에 `refetchOnWindowFocus: false`, `refetchOnReconnect: false`(`retry: 0` 유지) |
| `src/hooks/useLibrary.ts` | `useEpisodes`(68-73행)에만 D-6 |
| `src/components/library/LibraryShareScreenContent.tsx` | 38-43행 조회에 D-6 |
| `src/components/content/EpisodeProgressCard.tsx` | `enabled`에 `needsReleasedEpisodeLookup`, 요약·막대를 `episodeProgressHeader`로 |
| `src/hooks/usePullToRefresh.ts` | 신규 |
| `app/(tabs)/library.tsx`, `app/(tabs)/pins.tsx`, `app/(tabs)/index.tsx` | 앱 전용 `RefreshControl` |
| `app/search.tsx`, `app/(tabs)/people.tsx`, `app/content/[id]/episodes.tsx` | 문구 1줄씩 |
| `docs/development_next_steps.md`, `docs/README.md` | 구현 상태·미확인 항목 기록 |

## 12. 범위 밖

- **Edge Function·DB.** 서버 응답 계약은 그대로다. 배포 없음.
- **TMDB·TVmaze 방영 종료 판정**(D-3)과 서버 공개 회차 캐시(5장).
- **카드마다 나가는 `useSeasons` DB 조회**(`useAiringAvailability.ts:29`). 시즌 id가 서버 호출에 필요하다. `none`·`local`이면 이미 조회하지 않게 된다.
- **`usePinContext`·`useEpisodeDuration`의 `staleTime: 0`**, 설정 조회의 `refetchOnMount: "always"`. 모두 본인 DB 조회이고 최신값이 필요한 폼이다.
- **개인화 추천·유사 작품의 호출 정책**(docs/64·70).
- **합쇼체("~습니다") 문구 일괄 정리.** 앱 전체 134곳이라 별도 QA 명세로 다룬다. 이번에는 8장 표의 5곳만.
- **전역 `queryClient` 기본값**(`src/lib/query.ts`).

## 13. 확실하지 않음 — 별도 검증 필요

- AniList `endDate`가 완결 전에 미리 채워지는 작품이 있을 수 있다. 날짜 비교(`<= 오늘`)로 막았지만, 완결일이 실제보다 이르게 등록된 경우는 검증하지 못했다.
- 등록 시점에 방영 중이던 AniList 작품은 저장된 `end_date`가 null로 남아 완결 뒤에도 `remote`다(안전한 쪽). docs/69의 "다시 불러오기"가 `contents.end_date`를 갱신하는지는 확인하지 않았다.
- react-native-web에서 `RefreshControl`의 동작은 확인하지 않았다. 그래서 웹에는 달지 않는다(D-9).
- 호출 감소량은 계정의 "보는 중" 구성에 따라 다르다. M-1~M-4의 요청 건수로 확인한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다.
응답을 쓰지 않거나 답이 정해진 Edge Function 호출을 앱에서 막고(F-1~F-4), 사용자 화면의 개발 용어·진행 막대·새로고침 부재를 고친다(F-5~F-7). **정정 작업이며 앱 코드만 바꾼다.** 결함 표는 1장.

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙
2. `docs/71_meaningless_api_calls_and_usability_fixes_spec.md` — 이 명세. D-1~D-9, E-1~E-28
3. `docs/69_persistent_public_metadata_cache_fixes_spec.md` — `MANUAL_METADATA_QUERY_OPTIONS`와 호출 경로 점검표(이번 변경이 건드리지 않는 범위)
4. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
5. `src/utils/contentDetailView.ts`, `src/utils/airingAvailability.ts`, `src/hooks/useAiringAvailability.ts`, `src/components/content/EpisodeProgressCard.tsx`

# 시작 상태 (반드시 유지)
- `npm test` 1634/1634 통과(2026-11-16, c7aeca8 + 작업 트리).
- 총 화수 미정 작품의 회차 버튼(`released` 모드), 카드의 "N화 공개"·"공개 예정" 표시, docs/69의 수동 갱신 동작.

# 바꾸면 안 되는 설계 결정
- **D-3 (최우선).** `local` 판정은 `source_api === "anilist"`에만. TMDB·TVmaze에 `end_date` 판정을 넓히면 방영 중 작품이 "전 회차 공개"로 고정된다.
- **D-5.** 시즌 화수를 모르면 settled가 아니다. 어기면 방영 중 작품의 새 회차가 앱을 다시 켤 때까지 안 나온다.
- **D-1.** `needsReleasedEpisodeLookup`과 `resolveEpisodeChoiceMode`의 `count` 조건은 한 곳에서만 정의한다.
- **D-6.** `src/lib/query.ts` 전역 기본값을 **바꾸지 않는다.** 2장 표의 7개 조회에만 적용한다. `staleTime`·`gcTime`·`enabled`·queryKey는 그대로.
- **D-8.** 방영 예정 회차를 분모·총 화수로 쓰지 않는다.
- **D-9.** `RefreshControl`은 `Platform.OS !== "web"`에서만. Edge 조회를 무효화하지 않는다.
- `seasonToCheck`, `releasedUnwatchedCount`, `upcomingEpisodeDate`, `useEpisodeAvailability(contentId, seasonNumber, enabled)`는 **시그니처 변경 금지.**
- `supabase/` 아래는 **바꾸지 않는다.** DB 마이그레이션을 만들지 않는다.

# STEP 1 — 실패하는 테스트부터
10장 T-1~T-34를 세 테스트 파일에 쓴다(`metadataQuery.test.ts`는 신규). 기존 `contentDetailView.test.ts:100`, `:101`, `:105`는 T-7~T-9 문구로 고친다.
`npm test`를 돌려 새 테스트가 실패하는 것을 눈으로 확인한다(없는 export, 문구 불일치). T-34만 처음부터 통과한다. 그 외에 실패하지 않는 테스트가 있으면 멈추고 보고해라.

# STEP 2 — 순수 함수 (6장 계약)
`contentDetailView.ts`, `airingAvailability.ts`, `metadataQuery.ts`에 6장의 함수·상수를 추가하고 8장 문구 2건을 바꾼다. `resolveEpisodeChoiceMode`는:

```ts
if (!needsReleasedEpisodeLookup(input)) {
  const count = (input.seasonEpisodeCount ?? input.totalEpisodes) as number;
  return { kind: "count", numbers: Array.from({ length: count }, (_, i) => i + 1) };
}
```
`airingAvailability.ts`의 기존 `todayInKorea` 인라인 계산 두 곳은 `koreaToday(now)`로 바꿔도 된다(결과 동일할 때만).
`npm test`로 T-1~T-34 통과 확인.

# STEP 3 — 공개 회차 조회 차단 (F-1·F-2)
- `EpisodeProgressCard.tsx:63-66`: 세 번째 인자를
  `!completedMode && seasons.length > 0 && needsReleasedEpisodeLookup({ seasonEpisodeCount: selectedSeason?.episode_count, totalEpisodes })`로.
- `useAiringAvailability.ts`: 6장 "useAiringAvailability" 항목대로. 주석으로 "답이 정해진 작품은 서버에 묻지 않는다(docs/71 D-2)"를 남긴다.

# STEP 4 — Edge 목록 조회 옵션 (F-3·F-4)
2장 표의 조회 7곳에 `...EDGE_LIST_QUERY_OPTIONS`를 펼친다(`useSimilarContent`는 두 재조회 옵션만, `retry: 0` 유지). `useLibrary.ts`는 `useEpisodes`만 — `useSeasons`·`useContent`·`useEpisodeProgress`는 건드리지 않는다.

# STEP 5 — 화면 (F-5·F-6·F-7)
8장대로. `EpisodeProgressCard`의 요약·막대는 `episodeProgressHeader`로, 문구 3곳 교체, `usePullToRefresh` 신규 + 세 탭 화면에 앱 전용 `RefreshControl`.

# STEP 6 — 문서
`docs/development_next_steps.md` 맨 위 "의미 없는 API 호출 차단·편의성 (docs/71)" 항목과 `docs/README.md`의 71행 상태를 갱신한다. 실제 화면에서 보지 못한 M 항목은 "코드 검사 통과, 화면 미확인"으로 적는다("검증 완료"라고 쓰지 않는다).

# 엣지 케이스 (전부 처리)
9장 E-1~E-28 전부.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(현재 기준선: 1634개 통과).

추가 검사:
```
grep -rn "EDGE_LIST_QUERY_OPTIONS" src --include="*.ts" --include="*.tsx" | grep -v "\.test\." | wc -l
grep -rnE "API|외부 API" src/utils/contentDetailView.ts "app/(tabs)/people.tsx" "app/content/[id]/episodes.tsx"
grep -n "외부 API" app/search.tsx
git status --short supabase
```
첫 줄은 7(정의 1 + 사용 6) 이상, 둘째·셋째는 사용자 문구 0줄(주석 제외), 넷째는 빈 출력.

웹 확인은 8081만 쓴다(`npm run web -- --port 8081 --localhost --clear`, 사용 중이면 기존 서버 재사용). 로그인이 필요한 화면은 대신 로그인하지 않고 수동 확인 표로 보고한다.

# DEFINITION OF DONE
- [ ] T-1~T-33이 수정 전에 실패하는 것을 확인했고 수정 후 통과한다
- [ ] 기존 테스트 개수가 줄지 않았다(1634 + 신규)
- [ ] `typecheck`, `lint` 통과
- [ ] 추가 검사 4줄이 기대값과 같다
- [ ] `supabase/`·`src/lib/query.ts` 변경 없음
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(수정한 화면·컴포넌트)
- [ ] 웹·앱 수동 확인 표(M-1~M-8)를 확인/미확인으로 구분해 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/contentDetailView.ts
src/utils/contentDetailView.test.ts
src/utils/airingAvailability.ts
src/utils/airingAvailability.test.ts
src/utils/metadataQuery.ts
src/utils/metadataQuery.test.ts
src/hooks/useAiringAvailability.ts
src/hooks/useContentSearch.ts
src/hooks/usePeople.ts
src/hooks/usePopularRecommendations.ts
src/hooks/useSimilarContent.ts
src/hooks/useLibrary.ts
src/hooks/usePullToRefresh.ts
src/components/library/LibraryShareScreenContent.tsx
src/components/content/EpisodeProgressCard.tsx
app/(tabs)/library.tsx
app/(tabs)/pins.tsx
app/(tabs)/index.tsx
app/search.tsx
app/(tabs)/people.tsx
app/content/[id]/episodes.tsx
docs/development_next_steps.md
docs/README.md
```

# 보고 항목
1. STEP 1에서 실패했던 테스트의 실제 출력
2. `npm test` 결과(before / after 통과 개수)
3. `npm run typecheck`, `npm run lint`, 추가 검사 4줄 결과
4. 추가한 테스트 ID와 이름
5. D-1~D-9 중 문제가 있다고 판단한 항목(바꾸지는 말고 보고만)
6. M-1~M-8 확인 결과(웹/앱 구분, 미확인 사유)
7. 사람이 해야 할 후속 작업(배포는 없음. 실제 화면 확인만)

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
