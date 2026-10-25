# 60. 핀 탭 맥락 패널·작품별 묶음·시즌 표기 보완

작성일: 2026-10-15
대상 브랜치 기준: `main` (`bfcc3fd`) + 미커밋 작업(인물 탭·하단 탭·`classify-people` 등 `docs/57`~`59`. **핀 관련 파일은 모두 깨끗함**). 이 시점 `npm test` 1167개 중 1166개 통과 — 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙 — 이 명세는 다른 점과 화면 고유 값만 쓴다)**, `docs/44_pins_tab_saas_redesign_spec.md`(현재 핀 탭 구조·계약. 이 명세는 그 위에 더한다), `docs/31_usability_review_fixes_spec.md`(U-3 시즌 임베드 계약 6.1·7장)

> **근거.** 사용자 캡처(웹, 약 1000px, 핀 6개, "최신순", 첫 핀 선택). 옆 미리보기 패널이 첫 카드와 같은 내용(작품명·회차·40:28·감동·메모·저장일)을 그대로 반복하고, 패널 아래(폭 360 × 화면 높이의 절반 이상)가 비어 있다. 같은 작품("로또 1등도 출근합니다" 3화·10화) 핀이 다른 작품 핀 사이에 흩어져 있다.
> 사용자 요청: "핀 화면 개선할 점 찾아서 보완 프롬프트 작성."

---

## 1. 문제 정의

| ID | 증상 | 원인 |
|----|------|------|
| F-1 | 넓은 화면(≥ 960) 미리보기 패널이 선택한 카드와 **같은 정보만** 보여 준다. 새로 주는 것은 "핀 상세 열기" 버튼 하나, 아래는 빈 공간 | `src/components/pins/PinDetailPanel.tsx:29~73`이 카드와 같은 `createPinCardModel` 필드 + 제작진 한 줄 + 버튼만 그린다 |
| F-2 | 같은 작품의 핀이 최신순 목록에 흩어져, 한 작품의 장면 흐름(3화 36:30 → 10화 40:28)을 핀 탭에서 볼 수 없다. 패널에서 그 작품으로 이동하거나 같은 회차에 핀을 더할 길도 없다 | 핀 탭에 작품 단위 장면순 보기·작품 이동·핀 추가 진입점이 없다(`app/(tabs)/pins.tsx`, `PinDetailPanel.tsx:64~73`) |
| F-3 | "작품별" 정렬은 같은 작품 카드를 붙여 놓기만 하고, 카드마다 포스터·작품명을 반복한다. 작품 경계가 보이지 않는다 | `app/(tabs)/pins.tsx:254` `data={sortedPins}` 평면 목록. `docs/44` 4장 기각한 대안에서 "작품 머리글로 묶기"를 후속으로 미뤘다 |
| F-4 | 좁은 화면(375)에서 회차 제목이 길면 **저장일이 잘려 보이지 않는다**(예: "86화 · 히루루크의 벚꽃과 이어지는 의지! · 2026. 05. 03") | `src/utils/pinListUi.ts:194` `subtitle = [episodeLabel, dateLabel].join(" · ")`를 `PinListCard.tsx:46`이 `numberOfLines={1}`로 그린다. 375에서 카드 본문 폭 ≈ 343 − 24(좌우 패딩) − 56(포스터) − 12(간격) − 30(`›`+간격) = 221px, caption 12px 한글 약 18자에서 잘린다 |
| F-5 | 시즌이 2 이상인 핀도 "12화"로만 보인다. 장면순(작품별·F-2 타임라인)에서 **시즌 2 3화가 시즌 1 12화보다 앞에** 온다 | `src/services/pins.ts:31~32` `PIN_SELECT`가 `episodes(episode_number,title)`만 가져와 `season_number`가 늘 비어 있다. `compareScenePins` 1단계(시즌)가 무력화되어 회차 번호만 비교한다. `docs/31` U-3 미구현분, `docs/development_next_steps.md:160` P0 |

## 2. 근본 원인

- **F-1·F-2.** `PinDetailPanel`은 `docs/44` 6.4에서 "카드 내용 + 상세 열기"로만 정의됐다. 패널이 가진 정보 우위(넓은 폭·고정 위치)를 쓰지 않는다. 핀 목록에는 같은 작품 핀이 모두 들어 있으므로(`useAllPins`) 추가 조회 없이 작품 단위 타임라인을 만들 수 있다.
- **F-3.** 목록 행이 핀 하나뿐이라 머리글 행을 끼울 자리가 없다. FlashList는 `getItemType`으로 행 종류를 섞을 수 있다.
- **F-4.** 회차 라벨(길이 가변)과 날짜(짧고 중요)를 한 줄 줄임표 안에 같이 넣었다.
- **F-5.** `episodes.season_id → seasons.id` FK(`supabase/migrations/0001_initial_schema.sql:198`)가 있는데 임베드하지 않았다. **2026-10-15 운영 PostgREST에서 확인:** anon 키로 `timeline_pins?select=*,contents(*,content_genres(genres(name))),episodes(episode_number,title,seasons(season_number)),timeline_pin_tags(tag_id,tags(*))` → HTTP 200(RLS로 행 0개, 관계 해석 성공). 같은 경로로 `timeline_pin_tags?select=timeline_pins(<같은 select>)` → 200. 오타 관계(`seasonz`) → HTTP 400 `PGRST200`. 즉 **구문은 운영 스키마에서 유효**하다. 실제 행의 값 매핑은 로그인 없이 확인하지 못했다(13장).

## 3. 재현 시나리오

1. 웹 8081, 폭 1000~1440, 핀이 있는 계정으로 핀 탭을 연다(최신순).
2. 첫 카드가 선택되고 패널이 같은 내용을 반복한다(F-1). 같은 작품의 다른 핀은 목록 아래쪽에 따로 있다(F-2).
3. "작품별"을 누른다 → 카드마다 같은 포스터·작품명이 반복된다(F-3).
4. 폭 375로 줄이고 회차 제목이 긴 핀을 본다 → 둘째 줄 끝 날짜가 "…"로 잘린다(F-4).
5. 시즌 2 이상 작품에 핀이 있으면 카드·패널에 "시즌 N"이 없다(F-5).

## 4. 설계 결정

### D-1. 범위는 핀 탭과 핀 조회 select 한 줄이다
핀 탭(목록·카드·패널)과 `PIN_SELECT`의 시즌 임베드만 바꾼다. 핀 상세·작성·편집 화면, 작품 핀 화면(`app/content/[id]/pins.tsx`), 홈, DB는 바꾸지 않는다. 마이그레이션 없음.

### D-2. (최우선) `PIN_SELECT`는 아래 문자열과 정확히 같아야 한다
```
*,contents(*,content_genres(genres(name))),episodes(episode_number,title,seasons(season_number)),timeline_pin_tags(tag_id,tags(*))
```
현재 문자열에서 `episodes(episode_number,title)` → `episodes(episode_number,title,seasons(season_number))`만 바뀐다. `contents(*,...)`를 `docs/31` 7장처럼 열 목록으로 줄이지 **않는다**(제작진 `crew` 등 현재 매핑이 `*`에 기대고 있다). 임베드가 틀리면 **핀 목록 전체가 오류**가 되므로 S-1이 문자열을 고정한다.

### D-3. 시즌 매핑을 테스트할 수 있게 `PIN_SELECT`·`RawPinRow`·`mapPin`을 `src/utils/pinRow.ts`로 옮긴다
`src/services/pins.ts`는 Supabase 클라이언트를 import해 테스트 파일에서 불러올 수 없다(AGENTS.md). 옮긴 함수 이름은 `mapPinRow`. **본문은 시즌 한 줄 추가 외에 그대로 옮긴다.** 서비스의 `mapPins`는 `rows.map(mapPinRow)`로, `getPinsByTag`의 `mapPin`도 `mapPinRow`로 바꾼다. `getPinsByContent`의 DB 정렬(`docs/31` 7장 나머지)은 바꾸지 않는다(작품 핀 화면 범위).
- `season_number: row.episodes?.seasons?.season_number ?? row.season_number ?? null`
- `parseStoredCrew`는 상대 경로 `../../supabase/functions/_shared/contentCrew`, 장르는 `./genre`, 타입은 `import type`(`../types/pins`).

### D-4. 패널에 "이 작품의 핀" 장면순 미니 타임라인을 둔다
- **원천은 `filteredPins`**(현재 검색어·감정·장르·태그 조건을 적용한 목록) 중 선택 핀과 `content_id`가 같은 핀. 목록과 같은 집합이라 타임라인에서 고른 핀은 **항상 목록에 있다**(선택이 실패하지 않는다).
- 정렬은 `sortPinsByScene`(시즌 → 회차 → 초 → 작성 시각 → id). F-5가 고쳐지면 시즌 순서도 맞는다.
- **보이는 조건:** 정렬이 `"latest"`이고 같은 작품 핀이 **2개 이상**일 때만. `"timeline"`(작품별)에서는 목록이 이미 작품으로 묶이므로(D-6) 숨긴다.
- 최대 `PIN_PANEL_TIMELINE_LIMIT = 5`행. 선택 핀이 가운데 오도록 창을 잡는다(6장 판정 순서).
- 제목: 조건 없음 `이 작품의 핀 N개`, 조건 있음 `조건에 맞는 핀 N개`(N = 창이 아니라 전체 같은 작품 핀 수).
- 행: `회차(시즌 포함, 회차 제목 제외) · 시간` + 메모 1줄. 메모 가림·없음 규칙은 `createPinCardModel`과 같다(같은 스포일러 atom 사용).
- 현재 핀 행은 누를 수 없고 `primarySoft` 배경 + 접근성 "지금 보는 핀". 다른 행을 누르면 그 핀을 선택하고 **목록을 그 카드로 스크롤**한다(D-7).
- 오른쪽 위 "모두 보기" → 작품 핀 화면 `/content/[id]/pins`(전체 핀 + 핀 추가 버튼이 이미 있다).

### D-5. 패널 행동: 주 버튼 "핀 상세 열기" 아래에 "작품 보기" · "핀 추가" 보조 버튼 두 개
- "작품 보기" → `router.push({ pathname: "/content/[id]", params: { id: pin.content_id } })`(홈 `app/(tabs)/index.tsx:118`과 같은 형식, 시즌 파라미터 없음).
- "핀 추가" → `router.push({ pathname: "/pins/new", params: { contentId: pin.content_id, episodeId: pin.episode_id ?? "" } })`(작품 핀 화면 `app/content/[id]/pins.tsx:38~39`과 같은 형식). 보이는 글자는 "핀 추가", 접근성 라벨은 `episode_id`가 있으면 "이 회차에 핀 추가", 없으면 "이 작품에 핀 추가".
- 저장 뒤 이동(`app/pins/new.tsx:25~27` `dismissTo` 작품 핀 화면)은 기존 동작 그대로 둔다(12장).
- 좁은 화면(패널 없음)에는 이 버튼들을 만들지 않는다(핀 상세 화면 개편은 별도).

### D-6. "작품별" 정렬에서는 작품 머리글 행으로 묶는다 — `docs/44` 기각한 대안("후속") 이행
- 목록 데이터는 `buildPinListRows(sortedPins, sortMode)`의 행 배열이다. `"latest"`는 핀 행만(지금과 같은 모양). `"timeline"`은 작품마다 머리글 행 1개 + 그 작품 핀 행들.
- 묶음은 `content_id` 기준, 작품 순서는 **입력에서 처음 나온 순서**, 묶음 안 핀 순서는 입력 순서. 같은 작품이 떨어져 있어도 머리글은 한 번만 나온다(키 중복 방지).
- 머리글 행: 카드 배경 없는 한 줄. 포스터 `PIN_GROUP_POSTER_WIDTH = 40`(×60) · 작품명 · "핀 N개" · `›`. 누르면 작품 상세(`/content/[id]`).
- 머리글 아래 핀 카드는 `variant="grouped"`: **포스터·작품명을 그리지 않고** 회차 라벨을 첫 줄로 올린다. 접근성 라벨은 그대로(작품명 포함).
- FlashList `keyExtractor={(row) => row.key}`, `getItemType={(row) => row.type}`.

### D-7. 패널 타임라인에서 고를 때만 목록을 스크롤한다
`listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 })`. `index = findPinRowIndex(rows, id)`, `-1`이면 호출하지 않는다. 목록 카드를 눌러 고를 때는 이미 보이므로 스크롤하지 않는다. `scrollToIndex`는 Promise를 돌려주므로 실패는 무시한다(`.catch(() => undefined)`).

### D-8. 카드 저장일은 메타 줄로 옮기고 상대 날짜로 보여 준다
- 카드 둘째 줄은 **회차 라벨만**(`episodeLabel`, 회차 제목 포함, 1줄 줄임표). 날짜는 메타 줄(시간 칩·감정 배지 뒤)에 `typography.caption` `textSubtle` `tabular-nums`로 둔다. 메타 줄은 줄바꿈되므로 날짜가 잘리지 않는다.
- 형식 `formatPinRelativeDate(value, now)`: 오늘 / 어제 / `N일 전`(2~6) / 같은 해 `M월 D일` / 다른 해 `YYYY. MM. DD`(`formatPinDate`). 날짜 차이는 **로컬 달력 날짜** 기준(`formatPinDate`와 같은 기준).
- 패널 "저장일 2026. 10. 09"와 카드 **접근성 라벨의 "저장일 …"은 절대 날짜 그대로** 둔다(시간에 따라 바뀌지 않게).
- `PinCardModel.subtitle`은 **삭제**하고 `relativeDateLabel`을 더한다. 사용처는 `PinListCard.tsx:46` 한 곳뿐이다(`grep` 확인).

### D-9. 기존 계약 중 바뀌는 것은 아래뿐이다
- `PinCardModel`: `subtitle` 삭제, `relativeDateLabel: string` 추가. `createPinCardModel(pin, { spoilerRevealed, now? })`(`now` 기본 `new Date()`).
- 그래서 기존 테스트 **P-C1·P-C4·P-C7·P-C8의 기대값만** 10장 표대로 바꾼다(의도된 계약 변경). 그 외 기존 테스트(`P-L*`·`P-K1` 포함)는 한 글자도 바꾸지 않는다.
- `PINS_SCREEN_COPY`·`PinsLayout`·`getPinsLayout`은 바꾸지 않는다(P-K1·P-L1~P-L9 고정). 새 문구는 새 상수 `PIN_CONTEXT_COPY`에 둔다.

### D-10. 판정·문구는 `src/utils/pinListUi.ts` 순수 함수에 둔다
`docs/44` D-13 그대로. 행 구성·타임라인 창·상대 날짜·라벨은 화면·컴포넌트 파일에 두지 않는다(UI-11.3·UI-12.1). 화면은 라우팅(`router.push`)·상태·렌더만.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 패널 타임라인 원천을 전체 핀(`allPins.data`)으로 | 조건 밖 핀을 누르면 목록에 없어 선택할 수 없다. "누르면 선택 / 어떤 건 상세로" 두 동작이 섞인다. 전체는 "모두 보기"(작품 핀 화면)가 맡는다 |
| 작품별에서도 패널 타임라인 표시 | 목록 묶음과 같은 내용이 두 번 보인다 |
| 패널 타임라인을 별도 쿼리(`usePinsByContent`)로 | 이미 받은 목록에 같은 핀이 있다. 요청·로딩 상태가 늘어난다 |
| 좁은 화면에도 "작품 보기·핀 추가"를 카드 안 버튼으로 | Pressable 중첩(UI-4.3). 핀 상세 화면 개편에서 다룬다 |
| 작품 머리글을 붙박이(sticky)로 | 웹·앱 FlashList sticky 동작 차이와 머리글 높이 측정 문제. 묶음만으로 경계가 보인다 |
| 머리글 아래 카드를 들여쓰기 | 375에서 52px를 잃는다. 머리글(배경 없음)과 카드(배경 있음)의 차이로 충분하다 |
| 날짜를 둘째 줄에 두고 회차 라벨을 2줄로 | 카드 높이가 늘고, 회차 제목이 길면 여전히 날짜가 밀린다 |
| 접근성 라벨도 상대 날짜로 | 시간이 지나면 같은 핀의 라벨이 바뀌고 테스트가 시각에 의존한다 |
| 조건이 없을 때 "핀 6개" 결과 줄 숨기기("전체 6" 칩과 중복) | 검토했으나 `docs/44` D-11을 유지. 조건 전후로 줄 위치가 흔들린다 |
| `PIN_SELECT`를 `docs/31` 7장처럼 `contents(title_primary,...)` 열 목록으로 | `crew` 등 현재 쓰는 열이 빠진다. 이번 목적(시즌)과 무관한 위험 |
| `getPinsByContent` 장면순 정렬까지 | 작품 핀 화면 동작 변경. 별도 |
| `timeline_pins`에 `season_number` 비정규화 컬럼 | 마이그레이션·백필 필요. 임베드로 충분하다(`docs/31` 5장과 같은 결론) |
| 상대 날짜에 KST 고정(`upcomingAiring.ts` 방식) | 저장일은 사용자 기기 날짜 기준이 자연스럽고 `formatPinDate`(로컬)와 일치해야 한다 |

## 6. 계약

### 6.1 `src/utils/pinRow.ts` (신규, 순수)
```ts
import { parseStoredCrew } from "../../supabase/functions/_shared/contentCrew";
import type { Tag, TimelinePin } from "../types/pins";
import { extractGenreNames, type ContentGenreJoin } from "./genre";

export const PIN_SELECT =
  "*,contents(*,content_genres(genres(name))),episodes(episode_number,title,seasons(season_number)),timeline_pin_tags(tag_id,tags(*))";

interface RawPinTag { tag_id: string; tags: Tag | null }

export type RawPinRow = TimelinePin & {
  timeline_pin_tags?: RawPinTag[];
  contents?: {
    crew?: unknown;
    title_primary: string | null;
    poster_url: string | null;
    source_api: string | null;
    source_id: string | null;
    content_genres?: ContentGenreJoin[] | null;
  } | null;
  episodes?: {
    episode_number: number | null;
    title: string | null;
    seasons?: { season_number: number | null } | null;
  } | null;
};

/** src/services/pins.ts:161~187 mapPin 본문 그대로 + season_number 한 줄 */
export function mapPinRow(row: RawPinRow): TimelinePin;
```
`mapPinRow` 반환 필드(순서 무관): `id, user_id, content_id, episode_id, content_crew, content_title, content_poster_url, content_source_api, content_source_id, genres, episode_title, episode_number, season_number, timestamp_seconds, display_time_label, memo, emotion, is_spoiler, created_at, updated_at, tags`. `season_number` 외 필드의 계산식은 현재 `mapPin`과 한 글자도 다르지 않다.

`src/services/pins.ts`: 10~32행(`RawPinTag`·`RawPinRow`·`PIN_SELECT`)과 161~187행(`mapPin`)을 지우고 `import { mapPinRow, PIN_SELECT, type RawPinRow } from "@/utils/pinRow"`. `mapPins`는 `(rows ?? []).map(mapPinRow)`. 쓰지 않게 된 import(`parseStoredCrew`, `extractGenreNames`, `ContentGenreJoin`, `Tag`)는 지운다. 나머지 함수 본문·순서·정렬은 그대로.

### 6.2 `src/utils/pinListUi.ts` (확장)
런타임 import는 상대 경로만(`./pinSort` 추가), 타입은 `import type`.
```ts
export const PIN_PANEL_TIMELINE_LIMIT = 5;
export const PIN_GROUP_POSTER_WIDTH = 40;

export const PIN_CONTEXT_COPY = {
  today: "오늘",
  yesterday: "어제",
  currentPin: "지금 보는 핀",
  showAllPins: "모두 보기",
  showAllPinsLabel: "이 작품의 핀 모두 보기",
  openContent: "작품 보기",
  addPin: "핀 추가",
  addPinToEpisode: "이 회차에 핀 추가",
  addPinToContent: "이 작품에 핀 추가",
  timelineSelectHint: "이 핀을 미리보기로 보여 줘요",
  groupHint: "작품 상세를 열어요"
} as const;

/** 로컬 달력 날짜 기준. 잘못된 값은 "" */
export function formatPinRelativeDate(value: string, now?: Date): string;

export interface PinCardModel {
  title: string;
  episodeLabel: string | null;
  dateLabel: string;          // formatPinDate(created_at) — 패널·접근성용 절대 날짜
  relativeDateLabel: string;  // formatPinRelativeDate(created_at, now) — 카드 메타 줄용
  timeLabel: string;
  emotionLabel: string | null;
  memo: string;
  memoHidden: boolean;
  memoEmpty: boolean;
  tags: string[];
  allTags: string[];
  extraTagCount: number;
  posterUrl: string | null;
  accessibilityLabel: string; // 현재 규칙 그대로(절대 날짜 "저장일 …")
}
export function createPinCardModel(
  pin: TimelinePin,
  options: { spoilerRevealed: boolean; now?: Date }
): PinCardModel;

export type PinListRow =
  | {
      type: "group";
      key: string;              // `group:${contentId}`
      contentId: string;
      title: string;            // 첫 핀 content_title?.trim() || "제목 없음"
      posterUrl: string | null; // 첫 핀 content_poster_url?.trim() || null
      count: number;
      countLabel: string;       // `핀 ${count.toLocaleString("ko-KR")}개`
      accessibilityLabel: string; // `${title}, ${countLabel}`
    }
  | { type: "pin"; key: string /* `pin:${pin.id}` */; pin: TimelinePin; grouped: boolean };

export function buildPinListRows(pins: readonly TimelinePin[], mode: PinSortMode): PinListRow[];
export function findPinRowIndex(rows: readonly PinListRow[], pinId: string): number;

export interface PinPanelTimelineItem {
  id: string;
  label: string;          // [formatPinEpisodeLabel(pin, { includeTitle: false }), getPinTimeLabel(pin)] 빈 값 빼고 " · "
  memo: string;           // createPinCardModel과 같은 규칙
  memoHidden: boolean;
  memoEmpty: boolean;
  current: boolean;
  accessibilityLabel: string;
}
export interface PinPanelTimeline {
  title: string;
  total: number;
  items: PinPanelTimelineItem[];
}
export function createPinPanelTimeline(input: {
  pins: readonly TimelinePin[];      // 화면의 filteredPins
  selectedId: string;
  mode: PinSortMode;
  filtered: boolean;                 // filterSummary.hasActive
  revealedIds: ReadonlySet<string>;
  limit?: number;                    // 기본 PIN_PANEL_TIMELINE_LIMIT
}): PinPanelTimeline | null;

export function getPinAddAccessibilityLabel(pin: Pick<TimelinePin, "episode_id">): string;
```

판정 순서:
- **`formatPinRelativeDate(value, now = new Date())`**
  1. `date = new Date(value)`가 `NaN`이면 `""`.
  2. `day(d) = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)`(로컬 연·월·일로 만든 날짜 번호. 서머타임 영향 없음). `diff = day(now) - day(date)`.
  3. `diff <= 0` → `"오늘"`(미래 값은 시계 차이로 보고 오늘).
  4. `diff === 1` → `"어제"`.
  5. `2 <= diff <= 6` → `` `${diff}일 전` ``.
  6. 같은 연도(`date.getFullYear() === now.getFullYear()`) → `` `${월}월 ${일}일` ``(앞자리 0 없음).
  7. 그 외 → `formatPinDate(value)`.
- **`createPinCardModel`**: 현재 규칙 그대로 + `relativeDateLabel = formatPinRelativeDate(pin.created_at, options.now)`. `subtitle` 필드는 만들지 않는다.
- **`buildPinListRows(pins, mode)`**: 입력 배열을 바꾸지 않고 새 배열.
  1. `mode === "latest"` → `pins.map((pin) => ({ type: "pin", key: \`pin:${pin.id}\`, pin, grouped: false }))`.
  2. `"timeline"` → `content_id`별로 묶는다(`Map`, 처음 나온 순서 유지, 묶음 안 입력 순서 유지). 묶음마다 머리글 행 1개(첫 핀으로 제목·포스터) 뒤에 그 핀들을 `grouped: true`로.
- **`findPinRowIndex(rows, pinId)`**: `rows.findIndex((row) => row.type === "pin" && row.pin.id === pinId)`.
- **`createPinPanelTimeline`**
  1. `selected = pins.find((pin) => pin.id === selectedId)`. 없으면 `null`.
  2. `mode !== "latest"`면 `null`.
  3. `sorted = sortPinsByScene(pins.filter((pin) => pin.content_id === selected.content_id))`. `total = sorted.length`. `total < 2`면 `null`.
  4. `L = Math.max(1, Math.floor(limit ?? PIN_PANEL_TIMELINE_LIMIT))`. `index = sorted.findIndex(id 일치)`.
  5. `start = Math.min(Math.max(0, index - Math.floor(L / 2)), Math.max(0, total - L))`. `window = sorted.slice(start, start + L)`.
  6. 각 행: `model = createPinCardModel(pin, { spoilerRevealed: revealedIds.has(pin.id) })`. `label`은 위 정의. `memo`·`memoHidden`·`memoEmpty`는 `model`에서. `current = pin.id === selectedId`.
  7. `accessibilityLabel = [label, memoHidden ? "스포일러 메모 숨김" : memoEmpty ? null : memo, current ? PIN_CONTEXT_COPY.currentPin : null]`에서 빈 값 빼고 `", "`.
  8. `title = filtered ? \`조건에 맞는 핀 ${n}개\` : \`이 작품의 핀 ${n}개\``(`n = total.toLocaleString("ko-KR")`).
- **`getPinAddAccessibilityLabel`**: `episode_id`가 있으면 `addPinToEpisode`, 없으면 `addPinToContent`.

## 7. 데이터 모델 / SQL
없음. 마이그레이션을 만들지 않는다. select 문자열만 바뀐다(D-2).

## 8. 화면 명세
UI 규칙 준수(UI-1~UI-13). 아래는 화면 고유 값이다.

### 8.1 `app/(tabs)/pins.tsx`
- `const listRef = useRef<FlashListRef<PinListRow>>(null)`(`import { FlashList, type FlashListRef } from "@shopify/flash-list"`, `app/(tabs)/library.tsx:18·94`와 같은 방식).
- `rows = useMemo(() => buildPinListRows(sortedPins, sortMode), [sortedPins, sortMode])`.
- `panelTimeline = useMemo(() => layout.showDetailPanel && selectedPin ? createPinPanelTimeline({ pins: filteredPins, selectedId: selectedPin.id, mode: sortMode, filtered: filterSummary.hasActive, revealedIds: revealedSpoilers }) : null, [...])`.
- `selectFromPanel = useCallback((id) => { setSelectedPinId(id); const index = findPinRowIndex(rows, id); if (index >= 0) void listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 }).catch(() => undefined); }, [rows])`.
- `FlashList`: `ref={listRef}`, `data={rows}`, `keyExtractor={(row) => row.key}`, `getItemType={(row) => row.type}`, `extraData`에 지금 값 + `sortMode`. `renderItem`:
  - `row.type === "group"` → `PinGroupHeader`(8.4), `onPress` → `router.push({ pathname: "/content/[id]", params: { id: row.contentId } })`.
  - `row.type === "pin"` → 지금 `PinListCard` 속성 그대로 + `variant={row.grouped ? "grouped" : "full"}`.
- `ListEmptyComponent`·머리글·구분 간격(`spacing.md`)·나머지 상태는 그대로. `rows`가 비면 지금과 같은 빈·오류·로딩 상태가 나온다.
- `PinDetailPanel`에 8.3의 새 속성을 넘긴다. 라우팅은 화면에서 한다:
  - `onOpenContent` → `/content/[id]` `{ id: selectedPin.content_id }`
  - `onAddPin` → `/pins/new` `{ contentId: selectedPin.content_id, episodeId: selectedPin.episode_id ?? "" }`
  - `onOpenAllPins` → `/content/[id]/pins` `{ id: selectedPin.content_id }`
  - `onSelectTimelinePin` → `selectFromPanel`
- `sharePin`·캡처 레이어·`Alert.alert` 2줄은 그대로(`docs/44` D-12, 알려진 예외).

### 8.2 `src/components/pins/PinListCard.tsx`
- 새 속성 `variant?: "full" | "grouped"`(기본 `"full"`). `memo` 유지.
- `"full"`: 포스터 → 본문(작품명 → 회차 라벨 → 메타 줄 → 메모 → 태그). 둘째 줄은 `model.episodeLabel`(있을 때만, `typography.caption` `textMuted`, `numberOfLines={1}`).
- `"grouped"`: 포스터·작품명을 그리지 않는다. 첫 줄 `model.episodeLabel`(있을 때만) `typography.label` `text` `numberOfLines={1}`. 이후 메타 줄·메모·태그는 같다.
- 메타 줄(두 변형 공통): 시간 칩 → 감정 배지(있으면) → `model.relativeDateLabel`(비어 있지 않으면) `typography.caption` `textSubtle` `tabular-nums`. 줄바꿈 유지.
- 선택 테두리·`›`·접근성 라벨/힌트/상태는 그대로.

### 8.3 `src/components/pins/PinDetailPanel.tsx`
새 속성(기존 속성 유지):
```ts
timeline: PinPanelTimeline | null;
onSelectTimelinePin: (id: string) => void;
onOpenContent: () => void;
onAddPin: () => void;
onOpenAllPins: () => void;
```
`pin`이 있을 때 순서(1~6은 지금 그대로):
1. 머리 줄(포스터·제목·회차·제작진) 2. 시간·감정 3. 구분선 4. 메모 5. 태그 6. 저장일
7. 주 행동 "핀 상세 열기"(그대로)
8. **보조 행동 줄(신규)**: 가로 2개, `gap: spacing.sm`, 각 `flex: 1`·`minWidth: 0`. 모양은 기존 공유 버튼(`styles.share`: `surface` 배경, hairline `primary` 테두리, `primary` 글자)과 같은 알약 `minHeight: 44`.
   - "작품 보기": `film-outline` 18 + `openContent` → `onOpenContent`
   - "핀 추가": `add-circle-outline` 18 + `addPin`, `accessibilityLabel={getPinAddAccessibilityLabel(pin)}` → `onAddPin`
9. 공유(`canShare`일 때, 그대로)
10. **타임라인(신규, `timeline`이 있을 때)**: 구분선 → 머리 줄(`timeline.title` `typography.label` `text` `tabular-nums` + 오른쪽 텍스트 버튼 `showAllPins` `typography.label` `primary` 44 확보, `accessibilityLabel={showAllPinsLabel}` → `onOpenAllPins`. `marginLeft: "auto"` 금지 — `justifyContent: "space-between"` 행) → 행 목록(`gap: spacing.xs`).
    - 행 공통: 가로, `gap: spacing.sm`, `minHeight: 44`, 좌우 `spacing.sm`·상하 `spacing.xs`, `radius.md`. 왼쪽 점 8×8 `radius.pill`(현재 `primary`, 그 외 `border`), 오른쪽 열(`flex: 1`, `minWidth: 0`): `label` `typography.label` `text` `tabular-nums` / 메모 `typography.caption` 1줄(`memoEmpty`면 `textSubtle`, 그 외 `textMuted`).
    - 현재 행: `View`, 배경 `primarySoft`, `accessibilityLabel={item.accessibilityLabel}`, `accessibilityState={{ selected: true }}`.
    - 다른 행: `Pressable`, `accessibilityRole="button"`, `accessibilityHint={timelineSelectHint}`, 눌림 `opacity: 0.72` → `onSelectTimelinePin(item.id)`.
- `pin === null` 빈 상태는 그대로.

### 8.4 `src/components/pins/PinGroupHeader.tsx` (신규, `memo`)
```ts
export const PinGroupHeader: React.MemoExoticComponent<(props: {
  row: Extract<PinListRow, { type: "group" }>;
  onPress: (contentId: string) => void;
}) => JSX.Element>;
```
- `Pressable` 하나. 가로, `alignItems: "center"`, `gap: spacing.md`, `minHeight: 44`, `paddingTop: spacing.sm`. 배경·테두리·그림자 없음.
- 포스터 `AppImage` `PIN_GROUP_POSTER_WIDTH × PIN_GROUP_POSTER_WIDTH * 1.5`, `radius.sm`, 장식(접근성 숨김).
- 가운데 열(`flex: 1`, `minWidth: 0`, `gap: spacing.xs`): 작품명 `typography.headline` `text` `numberOfLines={1}`, `countLabel` `typography.caption` `textMuted` `tabular-nums`.
- 오른쪽 `chevron-forward` 18 `textSubtle`(장식).
- `accessibilityRole="button"`, `accessibilityLabel={row.accessibilityLabel}`, `accessibilityHint={PIN_CONTEXT_COPY.groupHint}`. 눌림 `opacity: 0.72`.

### 8.5 목표 모습
넓은 화면(≥ 960), 최신순:
```
[카드 목록 …]                                  ┌ 패널 360 ───────────────────┐
                                               │ [포스터] 로또 1등도 출근합니다 │
┌──────────────────────────────────────┐     │  72×108  10화 · 로또 1등도 계속…│
│[포스터] 로또 1등도 출근합니다           │     │ 40:28 [감동]                  │
│ 64×96  10화 · 로또 1등도 계속 출근합니다│     │ ─────────                     │
│        [40:28] [감동] 6일 전            │     │ 메모 …  저장일 2026. 10. 09   │
│        로또 1등에 당첨되어 …            │     │ (↗ 핀 상세 열기)               │
└──────────────────────────────────────┘     │ (🎬 작품 보기) (⊕ 핀 추가)      │
                                               │ ─────────                     │
                                               │ 이 작품의 핀 2개      모두 보기 │
                                               │ ○ 3화 · 36:30                 │
                                               │   팀장님은 뭘 믿으세요? …      │
                                               │ ● 10화 · 40:28  (현재, 파란 배경)│
                                               │   로또 1등에 당첨되어 …        │
                                               └──────────────────────────────┘
```
작품별(모든 폭):
```
[40×60] 로또 1등도 출근합니다                          ›
        핀 2개
┌ 3화 · 내가 믿는 것 / [36:30] [감동] 10월 2일 / 메모 … ┐
┌ 10화 · 로또 1등도 계속 출근합니다 / [40:28] [감동] 6일 전 / … ┐
[40×60] 수사반장 1958                                  ›
        핀 1개
┌ 6화 · 겨울의 시작 / [03:26] [감동] 10월 5일 / … ┐
```

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 연결 |
|---|------|----------|------|
| E-1 | 폭 375, 회차 제목이 긴 핀 | 둘째 줄 회차 라벨만 줄임표, 날짜는 메타 줄에 온전히 보임 | P-C1, M-3 |
| E-2 | 폭 1440 최신순, 선택 핀 작품에 핀 2개 이상 | 패널 아래 "이 작품의 핀 N개" 타임라인, 현재 행 강조 | TL-1, M-1 |
| E-3 | 선택 핀 작품에 핀 1개 | 타임라인 없음, 보조 행동은 있음 | TL-2, M-1 |
| E-4 | 작품별 정렬 | 패널 타임라인 없음, 목록은 작품 머리글로 묶임 | TL-3, G-2, M-1 |
| E-5 | 감정·검색 조건 적용 중 | 타임라인은 조건에 맞는 같은 작품 핀만, 제목 "조건에 맞는 핀 N개" | TL-4, M-1 |
| E-6 | 같은 작품 핀 9개, 마지막 핀 선택 | 창 5~9번째, 현재 행 맨 아래 | TL-5 |
| E-7 | 타임라인 행 누름(목록 아래쪽 카드) | 선택 바뀜 + 목록이 그 카드로 스크롤 + 선택 테두리 | G-5, M-1 |
| E-8 | 가려진 스포일러 핀이 타임라인에 있음 | 행 메모 "스포일러가 포함된 메모예요". 그 핀을 골라 패널 "보기" → 행·카드 모두 표시 | TL-6, M-1 |
| E-9 | 영화 핀(`episode_id` null) | 타임라인 라벨은 시간만, "핀 추가" 라벨 "이 작품에 핀 추가", `episodeId: ""`로 이동 | TL-8, AD-1, M-1 |
| E-10 | 시간 미지정 핀 | 라벨 "N화 · 시간 미지정", 같은 회차 맨 뒤 | TL-1 |
| E-11 | 시즌 1 12화 / 시즌 2 3화 핀(임베드 반영 후) | 타임라인·작품별 모두 S1E12 → S2E3, 라벨 "시즌 2 · 3화" | TL-9, S-2, M-1 |
| E-12 | 영화 핀 행(`episodes` null) | `season_number: null`, 오류 없음 | S-3 |
| E-13 | 시즌 임베드가 null | `season_number: null` | S-4 |
| E-14 | 같은 제목 다른 작품 | 머리글 따로(`content_id` 기준) | G-3 |
| E-15 | 묶음 입력에 같은 작품이 떨어져 있음 | 머리글 한 번, 키 중복 없음 | G-3 |
| E-16 | 핀 0개·조건 결과 0개 | `rows` 빈 배열 → 지금과 같은 빈 상태 | G-4, M-1 |
| E-17 | 날짜 경계(자정 직후·어제 밤·6일/7일·작년) | 오늘/어제/6일 전/10월 8일/2025. 12. 31 | R-D1~R-D7 |
| E-18 | 기기 시계가 늦어 저장일이 미래 | "오늘" | R-D8 |
| E-19 | `created_at` 잘못된 값 | 메타 줄 날짜 없음, 접근성 "저장일" 없음 | P-C7, R-D9 |
| E-20 | 앱 글자 1.3배 | 머리글 제목 1줄, 메타 줄 줄바꿈, 보조 버튼 글자 잘림 없음 | M-5 |
| E-21 | 웹 키보드 Tab | 카드 → 패널 버튼들 → "모두 보기" → 타임라인 행 순으로 이동 | M-1 |
| E-22 | 태그 필터(서버 조회) + 작품별 | 태그 결과로 묶음 | G-2, M-1 |
| E-23 | 768·959(패널 없음) | 타임라인·보조 버튼 없음, 작품별 머리글은 있음 | M-2 |
| E-24 | 타임라인 누른 핀이 행 배열에 없음(경쟁 상태) | 스크롤 호출 안 함, 선택만 | G-5 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다. 한 행 = `it` 하나.** `node:test` + `node:assert/strict`. 픽스처 `pin(overrides)`·`tag(name)`은 `src/utils/pinListUi.test.ts` 1~9행의 것을 그대로 쓴다. 날짜는 시간대에 무관하게 **로컬 생성자**(`new Date(2026, 9, 15, 12)`)로 만들고 `toISOString()`으로 넘긴다. 공통 `NOW = new Date(2026, 9, 15, 12, 0, 0)`.

### `src/utils/pinRow.test.ts` (신규)
`base(overrides)` 헬퍼: `{ id: "p1", user_id: "u1", content_id: "c1", episode_id: "e1", timestamp_seconds: 2530, display_time_label: "42:10", memo: "메모", emotion: "moved", is_spoiler: false, created_at: "2026-10-02T12:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z", contents: { crew: null, title_primary: "무빙", poster_url: "https://p", source_api: "tmdb", source_id: "123", content_genres: [{ genres: { name: "드라마" } }] }, episodes: { episode_number: 7, title: "감정선", seasons: { season_number: 1 } }, timeline_pin_tags: [{ tag_id: "t1", tags: { id: "t1", user_id: "u1", name: "눈물", created_at: "2026-10-02T12:00:00.000Z" } }, { tag_id: "t2", tags: null }] }` (`RawPinRow`).

| ID | 입력 | 기대 |
|----|------|------|
| S-1 | `PIN_SELECT` | D-2 문자열과 `===` |
| S-2 | `base({ episodes: { episode_number: 3, title: "각성", seasons: { season_number: 2 } } })` | `season_number 2`, `episode_number 3`, `episode_title "각성"` |
| S-3 | `base({ episode_id: null, episodes: null })` | `season_number null`, `episode_number null`, `episode_title null` |
| S-4 | `base({ episodes: { episode_number: 5, title: null, seasons: null } })` | `season_number null`, `episode_number 5` |
| S-5 | `base()` | `deepEqual` `{ id: "p1", user_id: "u1", content_id: "c1", episode_id: "e1", content_crew: [], content_title: "무빙", content_poster_url: "https://p", content_source_api: "tmdb", content_source_id: "123", genres: ["드라마"], episode_title: "감정선", episode_number: 7, season_number: 1, timestamp_seconds: 2530, display_time_label: "42:10", memo: "메모", emotion: "moved", is_spoiler: false, created_at: "2026-10-02T12:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z", tags: [{ id: "t1", user_id: "u1", name: "눈물", created_at: "2026-10-02T12:00:00.000Z" }] }`(null 태그 제외) |

### `src/utils/pinListUi.test.ts` — 기존 테스트 기대값 변경(의도된 계약 변경, D-9)

| ID | 바꾸는 내용 |
|----|-------------|
| P-C1 | 호출에 `now: NOW` 추가. 기대 객체에서 `subtitle` 삭제, `relativeDateLabel: "10월 2일"` 추가. 나머지 필드 값은 그대로 |
| P-C4 | 호출에 `now: NOW` 추가. 기대 객체에서 `subtitle` 삭제, `relativeDateLabel: "10월 2일"` 추가. 나머지 그대로 |
| P-C7 | `model.subtitle === "7화 · 감정선"` → `model.episodeLabel === "7화 · 감정선"`, `model.relativeDateLabel === ""` 추가. 나머지 그대로 |
| P-C8 | `.subtitle === "시즌 2 · 3화 · 2026. 10. 02"` → `.episodeLabel === "시즌 2 · 3화"` |

다른 기존 테스트(T-39·T-40·P-L*·P-D1·P-T1·P-F*·P-E*·P-G*·P-A*·P-R*·P-C2·P-C3·P-C4b·P-C5·P-C6·P-K1)는 **수정하지 않는다.**

### `src/utils/pinListUi.test.ts` — 추가

| ID | 입력 | 기대 |
|----|------|------|
| R-D1 | `formatPinRelativeDate(new Date(2026, 9, 15, 0, 5).toISOString(), NOW)` | `"오늘"` |
| R-D2 | `new Date(2026, 9, 14, 23, 50)` | `"어제"` |
| R-D3 | `new Date(2026, 9, 13, 12)` | `"2일 전"` |
| R-D4 | `new Date(2026, 9, 9, 12)` | `"6일 전"` |
| R-D5 | `new Date(2026, 9, 8, 12)` | `"10월 8일"` |
| R-D6 | `new Date(2026, 0, 3, 12)` | `"1월 3일"` |
| R-D7 | `new Date(2025, 11, 31, 12)` | `"2025. 12. 31"` |
| R-D8 | `new Date(2026, 9, 16, 9)`(미래) | `"오늘"` |
| R-D9 | `"not-a-date"` / `""` | `""` / `""` |
| R-D10 | `formatPinRelativeDate(new Date().toISOString())`(`now` 생략) | `"오늘"` |
| P-C9 | `createPinCardModel(pin({ created_at: new Date(2026, 9, 14, 20).toISOString() }), { spoilerRevealed: false, now: NOW })` | `relativeDateLabel "어제"`, `dateLabel "2026. 10. 14"`, `accessibilityLabel`에 `"저장일 2026. 10. 14"` 포함, `"subtitle" in model === false` |
| G-1 | `A = pin({ id: "a", content_id: "c1", content_poster_url: " https://x/p.jpg " })`, `B = pin({ id: "b", content_id: "c1" })`, `C = pin({ id: "c", content_id: "c2", content_title: null })`. `buildPinListRows([A, B, C], "latest")` | `[{ type: "pin", key: "pin:a", pin: A, grouped: false }, { …"pin:b", B, false }, { …"pin:c", C, false }]`, 각 `row.pin`은 입력 객체와 `===`, 반환 배열 `!==` 입력 |
| G-2 | `buildPinListRows([A, B, C], "timeline")` | `[{ type: "group", key: "group:c1", contentId: "c1", title: "무빙", posterUrl: "https://x/p.jpg", count: 2, countLabel: "핀 2개", accessibilityLabel: "무빙, 핀 2개" }, { pin A, grouped: true }, { pin B, grouped: true }, { type: "group", key: "group:c2", contentId: "c2", title: "제목 없음", posterUrl: null, count: 1, countLabel: "핀 1개", accessibilityLabel: "제목 없음, 핀 1개" }, { pin C, grouped: true }]` |
| G-3 | `buildPinListRows([A, C, B], "timeline")` | 행 키 순서 `["group:c1", "pin:a", "pin:b", "group:c2", "pin:c"]`, 키 중복 없음(`new Set(keys).size === keys.length`) |
| G-4 | `buildPinListRows([], "latest")`, `([], "timeline")` | 둘 다 `[]` |
| G-5 | `rows = buildPinListRows([A, B, C], "timeline")`. `findPinRowIndex(rows, "b")` / `"c"` / `"zzz"` / `"c1"` | `2` / `4` / `-1` / `-1`(머리글 `contentId`와 혼동하지 않음) |
| TL-1 | 같은 작품 `p1 = pin({ id: "p1", episode_number: 3, timestamp_seconds: 60, memo: "셋" })`, `p2 = pin({ id: "p2", episode_number: 1, timestamp_seconds: 20, memo: "하나" })`, `p3 = pin({ id: "p3", episode_number: 2 })`, 다른 작품 `x = pin({ id: "x", content_id: "c2", episode_number: 1 })`. `input = [p1, x, p2, p3]`, `createPinPanelTimeline({ pins: input, selectedId: "p2", mode: "latest", filtered: false, revealedIds: new Set() })` | `{ title: "이 작품의 핀 3개", total: 3, items: [{ id: "p2", label: "1화 · 00:20", memo: "하나", memoHidden: false, memoEmpty: false, current: true, accessibilityLabel: "1화 · 00:20, 하나, 지금 보는 핀" }, { id: "p3", label: "2화 · 시간 미지정", memo: "메모 없음", memoHidden: false, memoEmpty: true, current: false, accessibilityLabel: "2화 · 시간 미지정" }, { id: "p1", label: "3화 · 01:00", memo: "셋", memoHidden: false, memoEmpty: false, current: false, accessibilityLabel: "3화 · 01:00, 셋" }] }`. `input` 순서 그대로 |
| TL-2 | `pins: [p1, x]`, `selectedId: "p1"` | `null` |
| TL-3 | TL-1 입력, `mode: "timeline"` | `null` |
| TL-4 | TL-1 입력, `filtered: true` | `title "조건에 맞는 핀 3개"`, 나머지 TL-1과 같음 |
| TL-5 | `e1`~`e9`(`id: "e{i}"`, `episode_number: i`, `timestamp_seconds: 0`)를 **역순**으로 입력. `selectedId` `"e1"` / `"e5"` / `"e9"` | `items` id `["e1".."e5"]` / `["e3".."e7"]` / `["e5".."e9"]`, `total 9` |
| TL-6 | `p2s = { ...p2, is_spoiler: true }`, `pins: [p1, p2s, p3]`, `selectedId: "p1"`. `revealedIds` `new Set()` / `new Set(["p2"])` | p2 행 `memo "스포일러가 포함된 메모예요"`, `memoHidden true`, `accessibilityLabel "1화 · 00:20, 스포일러 메모 숨김"` / `memo "하나"`, `memoHidden false` |
| TL-7 | TL-1 입력, `selectedId: "nope"` | `null` |
| TL-8 | 영화 `m1 = pin({ id: "m1", timestamp_seconds: 3725 })`, `m2 = pin({ id: "m2", timestamp_seconds: 600 })`, `selectedId: "m1"` | `items` `[{ id: "m2", label: "10:00", current: false, … }, { id: "m1", label: "1:02:05", current: true, accessibilityLabel: "1:02:05, 지금 보는 핀" }]`(두 핀 메모 없음 → `memoEmpty true`) |
| TL-9 | `s1 = pin({ id: "s1", season_number: 1, episode_number: 12, timestamp_seconds: 100 })`, `s2 = pin({ id: "s2", season_number: 2, episode_number: 3, timestamp_seconds: 50 })`, 입력 `[s2, s1]`, `selectedId: "s2"` | `items` 라벨 `["12화 · 01:40", "시즌 2 · 3화 · 00:50"]` 순 |
| TL-10 | `e1`~`e5`, `limit: 3`. `selectedId` `"e3"` / `"e1"` | `["e2", "e3", "e4"]` / `["e1", "e2", "e3"]` |
| AD-1 | `getPinAddAccessibilityLabel({ episode_id: "e1" })` / `({ episode_id: null })` | `"이 회차에 핀 추가"` / `"이 작품에 핀 추가"` |
| K-2 | 상수 | `PIN_PANEL_TIMELINE_LIMIT === 5`, `PIN_GROUP_POSTER_WIDTH === 40`, `PIN_CONTEXT_COPY`가 6.2 값과 `deepEqual` |

추가 테스트 수: `pinRow.test.ts` 5(S-1~S-5) + `pinListUi.test.ts` 28(R-D1~R-D10 10, P-C9 1, G-1~G-5 5, TL-1~TL-10 10, AD-1 1, K-2 1) = **33개**. 기대 결과: 1167 + 33 = **1200개 중 1199개 통과**(기존 무관 실패 1개 유지).

### 수동 확인 (UI-14.3)

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440(및 1000) | 최신순: 같은 작품 핀 2개 이상인 핀을 고르면 패널 아래 타임라인(현재 행 파란 배경), 다른 행 누름 → 선택·목록 스크롤·테두리. 1개짜리 작품은 타임라인 없음. "작품 보기" → 작품 상세, "핀 추가" → 핀 작성(같은 회차), "모두 보기" → 작품 핀. 조건 적용 시 "조건에 맞는 핀 N개". 스포일러 행 가림 → 패널 "보기" 뒤 표시. 작품별: 머리글 묶음, 카드에 포스터·작품명 없음, 패널 타임라인 없음, 머리글 누름 → 작품 상세. 시즌 2 이상 작품 핀이 있으면 "시즌 N · M화"(F-5). 키보드 Tab 순서(E-21) |
| M-2 | 웹 768 | 패널 없음, 작품별 머리글 있음, 카드 누름 → 핀 상세 |
| M-3 | 웹 375 | 회차 제목이 긴 핀의 날짜가 메타 줄에 온전히 보임, 작품별 머리글 1줄 줄임표, 가로 스크롤 없음 |
| M-4 | 웹 844×390(가로 휴대폰) | 작품별 머리글·카드 스크롤 정상 |
| M-5 | 앱(iOS 세로) | 노치 아래 제목, 작품별 머리글 누름 → 작품 상세, 카드 누름 → 핀 상세, 글자 1.3배에서 머리글·메타 줄·날짜 잘림 없음, 하단 탭과 겹침 없음 |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/pinRow.ts` | 신규(6.1): `PIN_SELECT`(시즌 임베드), `RawPinRow`, `mapPinRow` |
| `src/utils/pinRow.test.ts` | 신규, S-1~S-5 |
| `src/services/pins.ts` | 6.1 끝 문단: 옮긴 정의 삭제, `pinRow` import, `mapPins`·`getPinsByTag`에서 `mapPinRow` 사용 |
| `src/utils/pinListUi.ts` | 6.2: 상수·`PIN_CONTEXT_COPY`·`formatPinRelativeDate`·`PinCardModel` 변경·`buildPinListRows`·`findPinRowIndex`·`createPinPanelTimeline`·`getPinAddAccessibilityLabel` |
| `src/utils/pinListUi.test.ts` | P-C1·P-C4·P-C7·P-C8 기대값 변경, R-D1~R-D10·P-C9·G-1~G-5·TL-1~TL-10·AD-1·K-2 추가 |
| `src/components/pins/PinListCard.tsx` | 8.2: `variant`, 둘째 줄 회차 라벨, 메타 줄 날짜 |
| `src/components/pins/PinDetailPanel.tsx` | 8.3: 보조 행동 줄, 타임라인 |
| `src/components/pins/PinGroupHeader.tsx` | 신규(8.4) |
| `app/(tabs)/pins.tsx` | 8.1: 행 배열·`getItemType`·`listRef`·패널 타임라인·라우팅 연결 |

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| 핀 상세 화면(`app/pins/[id].tsx`, `fontWeight: "900"` 등 토큰 위반)·편집·작성 화면 | 다른 화면. 좁은 화면의 "작품 보기·핀 추가"는 핀 상세 개편에서 |
| `app/pins/new.tsx` 저장 뒤 이동(`dismissTo` 작품 핀 화면) | 다른 진입점과 공유하는 기존 동작 |
| 작품 핀 화면(`app/content/[id]/pins.tsx`)·`getPinsByContent` 장면순 정렬(`docs/31` 7장 나머지)·`PinTimelineList` 라벨 | 다른 화면 |
| `PIN_SELECT`의 `contents(*)` 열 축소 | D-2 |
| `enrichLocalizedPinTitles`가 조회마다 Edge Function을 최대 8번 부르는 지연 | 성능 작업. 별도 |
| 당겨서 새로고침(앱) | 다른 탭에도 없다. 전 탭 공통으로 별도 |
| 웹 방향키로 카드 선택 이동 | 포커스 관리가 필요한 별도 기능 |
| `PINS_SCREEN_COPY`·`getPinsLayout`·`pinResponsive.ts` | D-9 |
| 공유(`sharePin`·`PinShareCard`·`Alert.alert` 2줄) | 기능 꺼짐(`docs/44` D-12) |
| 미커밋 다른 작업(인물 탭·하단 탭·`classify-people`·`docs/57`~`59`) | 무관. 건드리지 않는다 |

## 13. 확실하지 않음 — 별도 검증 필요

1. **시즌 임베드의 실제 값.** 구문은 운영 PostgREST에서 200을 확인했지만(2장), 로그인 없이 행을 읽지 못해 `episodes.seasons`가 객체로 오는지(다대일이라 객체여야 한다), 실제 시즌 번호가 맞는지는 확인하지 못했다. 사람이 여러 시즌 작품의 핀으로 M-1을 확인한다. 핀 목록 전체가 오류가 되면 즉시 `PIN_SELECT`를 되돌린다.
2. **`scrollToIndex` + `ListHeaderComponent` + 행 높이 가변**에서 웹·iOS 모두 목표 카드가 화면 안으로 오는지(FlashList 2.0.2). 안 맞으면 구현을 바꾸지 말고 관찰 결과를 보고한다(M-1·M-5).
3. 패널이 길어졌을 때(타임라인 5행) `maxHeight: "100%"` + 안쪽 `ScrollView`가 패널 안에서 스크롤되는지(`docs/44` 13장 1과 같은 질문, M-1).
4. 운영 Expo 웹의 `toLocaleString("ko-KR")` 출력은 기존 테스트(P-R3)와 같은 환경 가정이다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다.
핀 탭을 보완한다: 넓은 화면 미리보기 패널에 "이 작품의 핀" 장면순 타임라인과 "작품 보기·핀 추가" 행동을 더하고, "작품별" 정렬을 작품 머리글로 묶고, 카드 저장일을 잘리지 않는 메타 줄의 상대 날짜로 옮기고, 핀 조회에 시즌 번호를 임베드한다. 기능 보완 + 정정 작업이다.

| ID | 증상 | 원인 |
|----|------|------|
| F-1 | 패널이 선택 카드와 같은 정보만 반복 | `PinDetailPanel.tsx:29~73` |
| F-2 | 같은 작품 핀 흐름·작품 이동·핀 추가 진입점 없음 | 핀 탭에 없음 |
| F-3 | 작품별 정렬이 카드마다 포스터·작품명 반복 | `pins.tsx:254` 평면 목록 |
| F-4 | 375에서 저장일 잘림 | `pinListUi.ts:194` + `PinListCard.tsx:46` 한 줄 |
| F-5 | 시즌 표기 없음, S2E3가 S1E12보다 앞 | `services/pins.ts:31~32` 시즌 미조회 |

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙(UI-1~UI-13). 이 지시에 다시 쓰지 않는다.
2. `docs/60_pins_tab_context_and_grouping_fixes_spec.md` — 이 작업의 명세서. 설계 결정 D-1~D-10, 계약 6장, 화면 8장, 엣지 케이스 9장, 테스트 표 10장.
3. `docs/44_pins_tab_saas_redesign_spec.md` — 현재 핀 탭 구조와 계약(D-12 공유 예외, D-13 순수 함수 위치).
4. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
5. `app/(tabs)/pins.tsx`, `src/utils/pinListUi.ts`, `src/utils/pinListUi.test.ts`, `src/components/pins/PinListCard.tsx`, `src/components/pins/PinDetailPanel.tsx`, `src/services/pins.ts`, `src/utils/pinSort.ts`, `src/utils/pinLabels.ts`

# 시작 상태 (반드시 유지)
- `npm test` 1167개 중 1166개 통과. 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함이다. 고치지 않는다.
- 핀 탭 기존 동작: 검색·감정 칩·필터 카드·결과 줄·빈/오류/로딩 상태·960 이상 패널 선택·좁은 화면 카드 → 핀 상세·스포일러 atom.
- 작업 트리에 핀과 무관한 미커밋 변경이 있다(인물 탭·하단 탭 등). 건드리지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-2 (최우선).** `PIN_SELECT`는 `*,contents(*,content_genres(genres(name))),episodes(episode_number,title,seasons(season_number)),timeline_pin_tags(tag_id,tags(*))`와 정확히 같아야 한다. `contents(*)`를 열 목록으로 줄이지 않는다. 틀리면 핀 목록 전체가 오류가 된다.
- **D-3.** `mapPin`을 `src/utils/pinRow.ts` `mapPinRow`로 옮길 때 `season_number` 한 줄 외에는 계산식을 바꾸지 않는다(S-5가 고정).
- **D-9.** 기존 테스트 중 기대값을 바꾸는 것은 P-C1·P-C4·P-C7·P-C8뿐이다(10장 표). `PINS_SCREEN_COPY`·`getPinsLayout`·`PinsLayout`을 바꾸지 않는다(P-K1·P-L* 고정). 새 문구는 `PIN_CONTEXT_COPY`.
- **D-4.** 패널 타임라인 원천은 `filteredPins`, 최신순 + 같은 작품 2개 이상일 때만, 최대 5행, 선택 핀 가운데 창.
- **D-6.** 묶음은 `content_id` 기준, 처음 나온 순서, 머리글 한 번.
- **D-8.** 카드 접근성 라벨·패널 "저장일"은 절대 날짜 그대로. 상대 날짜는 카드 메타 줄에만.
- `src/utils/pinResponsive.ts`, `src/utils/pinSort.ts`, `src/utils/pinLabels.ts`는 **바꾸지 않는다.**
- DB 마이그레이션을 만들지 않는다. `getPinsByContent` 정렬을 바꾸지 않는다.

# STEP 1 — 시즌 임베드 (테스트 먼저)
1. `src/utils/pinRow.test.ts`에 10장 S-1~S-5를 쓴다. `npm test`로 실패(모듈 없음)를 눈으로 확인한다.
2. `src/utils/pinRow.ts`를 6.1대로 만든다. `src/services/pins.ts:31~32`의
   ```ts
   const PIN_SELECT =
     "*,contents(*,content_genres(genres(name))),episodes(episode_number,title),timeline_pin_tags(tag_id,tags(*))";
   ```
   와 10~29행 타입, 161~187행 `mapPin`을 옮기고, 옮긴 `mapPinRow`에 다음 한 줄을 더한다.
   ```ts
   season_number: row.episodes?.seasons?.season_number ?? row.season_number ?? null,
   ```
3. 서비스는 `import { mapPinRow, PIN_SELECT, type RawPinRow } from "@/utils/pinRow"`. `mapPins`는 `(rows ?? []).map(mapPinRow)`, `getPinsByTag`도 `mapPinRow`. 쓰지 않게 된 import를 지운다. S-1~S-5 통과.

# STEP 2 — 상대 날짜와 카드 모델 (테스트 먼저)
1. `pinListUi.test.ts`에 R-D1~R-D10·P-C9를 추가하고, P-C1·P-C4·P-C7·P-C8을 10장 "기대값 변경" 표대로만 고친다. 실패를 확인한다.
2. `pinListUi.ts`에 `formatPinRelativeDate`(6.2 판정 순서)를 만들고, `PinCardModel`에서 `subtitle`을 지우고 `relativeDateLabel`을 더한다. `createPinCardModel(pin, { spoilerRevealed, now })`.
3. `PinListCard.tsx`: 둘째 줄을 `model.episodeLabel`로, 메타 줄 끝에 `model.relativeDateLabel`(8.2). 통과 확인.

# STEP 3 — 작품별 묶음 (테스트 먼저)
1. G-1~G-5를 추가하고 실패를 확인한다.
2. `buildPinListRows`·`findPinRowIndex`·`PIN_GROUP_POSTER_WIDTH`(6.2).
3. `src/components/pins/PinGroupHeader.tsx`(8.4), `PinListCard`의 `variant`(8.2).
4. `app/(tabs)/pins.tsx`: `rows`, `FlashList` `data={rows}`·`keyExtractor`·`getItemType`·`renderItem`(8.1). 머리글 누름 → `/content/[id]`.

# STEP 4 — 패널 타임라인·행동 (테스트 먼저)
1. TL-1~TL-10·AD-1·K-2를 추가하고 실패를 확인한다.
2. `PIN_PANEL_TIMELINE_LIMIT`·`PIN_CONTEXT_COPY`·`createPinPanelTimeline`·`getPinAddAccessibilityLabel`(6.2). `sortPinsByScene`는 `./pinSort`에서 import한다.
3. `PinDetailPanel.tsx` 8.3(보조 행동 줄 → 공유 → 타임라인 순서).
4. `app/(tabs)/pins.tsx` 8.1: `listRef`(`FlashListRef<PinListRow>`), `panelTimeline`, `selectFromPanel`(D-7), 라우팅 콜백 4개.

# STEP 5 — 검증
아래 검증 명령, UI-13.2 토큰·`Alert` 검사, 웹 수동 확인(로그인 필요 시 하지 말고 미확인으로 보고).

# 엣지 케이스 (전부 처리, 명세서 9장 E-1~E-24)
명세서 9장 표 전부. 특히 E-6(창 끝), E-11(시즌 순서), E-15(떨어진 같은 작품), E-19(잘못된 날짜), E-24(행 없음 → 스크롤 안 함).

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test` 기준선: 1167개 중 1166개 통과(무관 실패 1개). 완료 후 기대: **1200개 중 1199개 통과**, 새 실패 0개.
토큰·`Alert` 검사(UI-13.2):
```
grep -nE "#[0-9A-Fa-f]{3,6}\b|rgba?\(|fontWeight: \"|fontSize: [0-9]" src/components/pins/PinListCard.tsx src/components/pins/PinDetailPanel.tsx src/components/pins/PinGroupHeader.tsx "app/(tabs)/pins.tsx"
grep -n "Alert.alert" src/components/pins/PinListCard.tsx src/components/pins/PinDetailPanel.tsx src/components/pins/PinGroupHeader.tsx "app/(tabs)/pins.tsx"
```
첫 줄 0줄. 둘째 줄은 `app/(tabs)/pins.tsx`의 기존 `sharePin` 2곳(알려진 예외, `docs/44` D-12)만 나와야 한다.

# DEFINITION OF DONE
- [ ] S-1~S-5, R-D1~R-D10, P-C9, G-1~G-5, TL-1~TL-10, AD-1, K-2를 추가했고 각각 수정 전에 실패하는 것을 확인했다
- [ ] P-C1·P-C4·P-C7·P-C8 외 기존 테스트를 고치지 않았다. 기존 테스트 개수가 줄지 않았다
- [ ] `npm test` 1200개 중 1199개 통과(무관 기존 실패 1개만), `npm run typecheck`, `npm run lint` 통과
- [ ] `PIN_SELECT`가 D-2 문자열과 같고 `src/services/pins.ts`에 `mapPin`·`RawPinRow` 정의가 남아 있지 않다
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(알려진 예외 2줄 제외)
- [ ] 웹·앱 수동 확인 표(M-1~M-5)를 보고했다(미확인은 사유와 함께)

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/pinRow.ts
src/utils/pinRow.test.ts
src/services/pins.ts
src/utils/pinListUi.ts
src/utils/pinListUi.test.ts
src/components/pins/PinListCard.tsx
src/components/pins/PinDetailPanel.tsx
src/components/pins/PinGroupHeader.tsx
app/(tabs)/pins.tsx
```

# 보고 항목
1. STEP별로 처음 실패했던 테스트의 실제 출력(요약)
2. `npm test` 결과 (before 1166/1167 / after 통과·전체 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름, 기대값을 바꾼 기존 테스트 4개의 전/후
5. UI-13.2 검사 결과
6. 웹·앱 수동 확인 표 M-1~M-5(확인/미확인과 사유). 명세서 13장 1~3 관찰 결과
7. D-N 중 문제가 있다고 판단한 항목(바꾸지는 말고 보고만)
8. 사람이 해야 할 후속 작업(로그인 계정으로 시즌 2 이상 작품 핀 확인 등). 배포·마이그레이션은 필요 없다

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 이 작업은 배포가 필요 없다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.** 기대값 변경은 10장 표의 4개뿐이다.
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다(옮기는 `mapPin`도 본문 그대로).
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- 로그인이 필요한 화면을 확인하려고 실제 계정으로 로그인하지 않는다. 미확인으로 보고한다.
