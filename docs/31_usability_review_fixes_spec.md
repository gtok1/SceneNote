# 31. 사용성·편의성 검토 결함 수정 명세

작성일: 2026-09-25
대상 브랜치 기준: `main` (`ca4e285`, 미커밋 수정 포함 워킹 트리. 이 시점 `npm test` 474개 통과)
선행 문서: `docs/11_screen_implementation_spec.md`, `docs/12_episode_progress_spec.md`, `docs/17_season_library_tracking_spec.md`, `docs/19_mobile_usability_spec.md`, `docs/21_mobile_usability_qa_2026-09-09.md`, `docs/28_recommendation_scroll_pagination_fixes_spec.md`, `docs/30_recommendation_fill_and_action_consistency_fixes_spec.md`

> **검증 방식.** 이 명세는 코드 리뷰만으로 작성했다(사용자 요청). `docs/21`도 로그인 이후 화면을 실측하지 못했으므로, 로그인 이후 화면에서 실제로 어떻게 보이는지는 검증하지 않았다. 아래 결함은 모두 코드 경로를 끝까지 따라가 확인한 것이며, "보일 것이다"가 아니라 "코드상 이렇게 분기한다"는 근거로 적었다.

---

## 1. 문제 정의

SceneNote의 핵심 흐름은 **작품 찾기 → 내 목록에 넣기 → 회차 고르기 → 핀 남기기 → 핀 다시 보기**다. 이 흐름에서 막히거나, 데이터를 잃거나, 시간 순서가 틀리는 지점을 우선순위 순으로 정리했다.

| ID | 우선 | 화면 | 사용자가 겪는 증상 |
|----|------|------|--------------------|
| U-1 | P0 | 핀 탭 (폭 < 768) | 핀 카드를 눌러도 테두리만 바뀌고 열리지 않는다. 오른쪽 `⋮` 아이콘만 상세로 간다. **타임라인 보기에서는 핀을 열 방법이 아예 없다.** |
| U-2 | P0 | 작품 상세 | 상태 버튼 바로 아래 "삭제"를 누르면 **확인 없이** 즉시 내 목록에서 지워진다. 감상 상태·본 횟수·시청 위치·감상 날짜가 함께 사라진다. |
| U-3 | P0 | 작품 핀 목록, 핀 탭 "시간순" | 작품 핀 타임라인이 회차를 무시하고 초(秒)만으로 정렬된다. 5화 03:00 핀이 1화 20:00 핀보다 위에 온다. 여러 시즌 작품은 "12화"만 보여 어느 시즌인지 모른다. |
| U-4 | P1 | 핀 상세 | 편집 저장 후 보던 핀이 아니라 "작품 핀" 목록으로 튕긴다. 편집 화면에서 삭제하면 **"핀을 찾을 수 없습니다" 막다른 화면**에 갇힌다. |
| U-5 | P1 | 작품 상세 (검색에서 진입) | 아직 등록하지 않은 작품은 "내 목록에 추가" 버튼이 줄거리·시청처·출연진 **아래 맨 끝**에 있다. 등록된 작품도 상태 변경 버튼이 맨 끝이다. |
| U-6 | P1 | 에피소드 목록 | 홈 카드의 "다음: 13화"를 눌러도 목록이 1화부터 시작한다. 긴 작품은 한참 스크롤해야 핀을 남길 회차에 닿는다. 다음 볼 회차 표시도 없다. |
| U-7 | P1 | 핀 탭 (폭 < 768) | 목록 위에 검색·정렬·장르/감정/태그 필터 3줄·감정 요약 카드가 쌓여 첫 핀이 화면 밖으로 밀린다. 검색창 옆 **"필터" 아이콘은 눌러도 아무 일도 없다.** |
| U-8 | P1 | 핀 작성·편집 | 작품·회차 확인 중/실패일 때 저장 버튼이 눌리지 않는데 **활성처럼 보인다.** 저장 실패 메시지는 스크롤 맨 아래에 떠서 하단 고정 저장 버튼 근처에서 보이지 않는다. |
| U-9 | P2 | 핀 작성·편집 | 예전에 쓴 태그를 매번 다시 타이핑해야 한다. 표기가 조금씩 달라져("감동", "감동적") 태그 필터가 쪼개진다. |
| U-10 | P2 | 라이브러리 탭 | 목록을 불러오지 못하면 오류 안내와 **"라이브러리가 비어 있어요"가 동시에** 뜬다. 기록이 날아간 것처럼 보인다. |
| U-11 | P2 | 검색 | 추가 실패 시 "Edge Function 배포 상태, 외부 API secret 설정을 확인하세요" 같은 **개발자용 문구**가 사용자에게 뜬다. 추가 성공 시에는 아무 피드백이 없다(버튼이 회색으로 바뀔 뿐). |

---

## 2. 근본 원인

### U-1 — 모바일에서 카드 탭이 "선택"으로만 연결됨
`app/(tabs)/pins.tsx`
- 39행 `showDetailPanel = shouldShowPinDetailPanel(width, ...)` — 폭 768 미만이면 `false`, 오른쪽 상세 패널이 렌더되지 않는다(280행).
- 272행 `PinCard onSelect={() => setSelectedPinId(pin.id)}` → 532행 `PinCard`의 카드 전체 `onPress={onSelect}`. 패널이 없는 폭에서도 선택만 한다. 상세 진입은 585행 `ellipsis-vertical` 아이콘뿐인데, `⋮`는 통상 "더보기 메뉴"로 읽힌다.
- 264행 `PinTimelineItem ... onSelectPin={setSelectedPinId}` → 489행 로컬 `PinTimelineItem`(※ `src/components/pins/PinTimelineItem.tsx`와 **다른** 파일 내부 함수)은 `onPress={() => onSelectPin(pin.id)}`만 있고 상세로 가는 버튼이 없다. 모바일 타임라인 보기에서는 상세 진입 경로가 0개다.

### U-2 — 라이브러리 삭제에 확인 단계 없음
`app/content/[id].tsx`
- 239~249행 `removeFromLibrary`가 바로 `deleteLibraryItem.mutate(...)`를 호출한다.
- 576~587행 삭제 버튼은 상태 버튼 그리드(551~575행) 바로 아래라 오탭 위험이 크다.
- `src/services/library.ts:350` `deleteLibraryItem`은 `user_library_items` 행만 지운다. 이 행에 `status`/`status_flags`, `watch_count`(0009), `manual_watched_*`(0020), `first/last_watched_at`(0014)이 있다. `timeline_pins`·`user_episode_progress`·`reviews`는 `content_id` 기준이라 **남는다**(트리거 없음, migrations 확인). 확인 문구는 이 사실과 정확히 일치해야 한다.

### U-3 — 장면 순서 정렬이 회차를 모름
- `src/services/pins.ts:64~74` `getPinsByContent`가 `.order("timestamp_seconds")` → `.order("created_at")`만 한다. 회차가 정렬 키에 없다.
- `app/(tabs)/pins.tsx:83~94` "시간순"은 `content_title` → `timestamp_seconds`로 정렬한다. 역시 회차가 빠져 있다. 게다가 라벨이 "시간순"이라 "작성 시간순"으로 오해된다.
- `src/services/pins.ts:30` `PIN_SELECT`가 `episodes(episode_number,title)`만 가져와 **시즌 번호가 클라이언트에 없다.** `episodes.season_id → seasons(id)` FK(0001_initial_schema.sql:198)는 있으므로 임베드로 가져올 수 있다.
- 회차 라벨 조립이 4곳에 복제되어 있다: `app/(tabs)/pins.tsx:682` `getEpisodeLabel`, `src/components/pins/PinTimelineItem.tsx:30`, `src/components/pins/RecentPinCard.tsx:24`, `src/components/pins/PinShareCard.tsx:71`. 모두 `N화`만 쓴다.

### U-4 — 핀 상세의 편집/삭제 후 이동
`app/pins/[id].tsx`
- 45~48행 편집 `onSuccess`가 `router.dismissTo("/content/[id]/pins")`를 호출한다. 핀 탭 → 핀 상세 경로에는 그 화면이 스택에 없으므로 현재 화면이 작품 핀 목록으로 **교체**된다.
- 삭제: `src/hooks/useTimelinePins.ts:125~131` `useDeletePin.onMutate`가 모든 `["pins"]` 캐시에서 핀을 낙관적으로 제거한다 → 단건 캐시가 `null` → `app/pins/[id].tsx:33` `if (!pin.data) return <EmptyState .../>`로 **PinComposer가 언마운트**된다 → `PinComposer.remove()`의 성공 후 `leave(onCancel)`이 언마운트된 컴포넌트에서 실행되어 이동이 일어나지 않는다. 사용자는 행동 버튼 없는 "핀을 찾을 수 없습니다"에 남는다.

### U-5 — 작품 상세의 상태 패널 위치
`app/content/[id].tsx`
- 396행 `{!externalResult || libraryItem ? <actions/> : null}` — 검색에서 온 미등록 작품은 상단 행동 영역이 통째로 숨겨진다.
- 546~589행 `addPanel`("내 목록에 추가"/"내 목록 상태" + 삭제)이 본문 **맨 끝**(줄거리 485행, 시청처 488행, 출연진 494행 뒤)에 있다.

### U-6 — 에피소드 목록 초기 스크롤 없음
- `src/utils/continueWatching.ts:59~` 홈 카드가 "다음: N화"를 보여주고 `open_episodes`로 보낸다.
- `app/content/[id]/episodes.tsx:58` `EpisodeSelector`에 스크롤 위치 정보가 전달되지 않는다. `src/components/content/EpisodeSelector.tsx:47` `FlashList`에 ref도, 초기 위치도 없다. 행에 "다음 볼 회차" 표시도 없다.

### U-7 — 핀 탭 헤더 과밀 + 죽은 버튼
`app/(tabs)/pins.tsx`
- 176행 `<ToolbarIconButton icon="filter-outline" label="필터" />` — `onPress`가 없다(313행 정의상 optional). 누를 수 있어 보이지만 동작 없음.
- 194~224행 장르·감정·태그 `FilterRow` 3줄 + `SummaryCards`가 폭과 무관하게 항상 목록 헤더에 렌더된다.

### U-8 — 핀 작성 저장 버튼·오류 위치
`src/components/pins/PinComposer.tsx`
- 328행 `disabled={isSaving || context.isPending || context.isError}`인데 331행 스타일은 `isSaving && styles.disabled`뿐이다.
- 316행 `{error ? <Text style={styles.error}>{error}</Text> : null}`이 ScrollView 끝(편집 모드면 삭제 버튼 위)에 있다. 저장 버튼은 325~336행 ScrollView 밖 하단 고정 영역이다. 서버 저장 실패 시 사용자는 스크롤을 내려야 이유를 본다.

### U-9 — 태그 재사용 수단 없음
- `src/components/pins/PinComposer.tsx:253~284` 태그는 자유 입력 + "추가" 버튼만 있다. `src/hooks/useTags.ts` `useTags()`(이름순, `src/services/tags.ts:5`)가 이미 있는데 작성 화면에서 쓰지 않는다.

### U-10 — 오류와 빈 상태 동시 표시
- `app/(tabs)/library.tsx:662` `{library.isError ? <ErrorState/> : null}` 다음 663행 `{!library.isLoading && !filteredItems.length ? <EmptyState .../> : null}`. 오류 시 `library.data`가 `undefined` → `filteredItems = []` → 두 개가 함께 렌더된다. (홈 `app/(tabs)/index.tsx`는 `!library.isError`로 올바르게 막고 있다.)

### U-11 — 검색 추가 피드백
- `app/search.tsx:345~367` `addResult`: `onError`가 `Alert.alert("라이브러리 추가 실패", \`${error.message}\n\n로그인 상태, Edge Function 배포 상태, 외부 API secret 설정을 확인하세요.\`)`. `onSuccess`는 `setAddedSearchKeys`만 한다. 같은 파일 추천 추가 경로(383행~)는 이미 `addToast`로 성공을 알린다.
- `Alert.alert`는 react-native-web에서 빈 함수라 웹에서는 실패도 보이지 않는다(`app/content/[id].tsx:315` 주석이 이미 이 문제를 기록).

---

## 3. 재현 시나리오

1. **U-1** 폭 375에서 핀 탭 → 아무 핀 카드 본문 탭 → 상세로 가지 않음. 보기 방식 아이콘을 눌러 타임라인 → 항목 탭 → 상세로 가지 않음, 상세 버튼 없음.
2. **U-2** 라이브러리 작품 상세 → 맨 아래 "삭제" 한 번 탭 → 확인 없이 라이브러리 목록으로 이동, 작품 사라짐.
3. **U-3** 시리즈 1화 20:00, 5화 03:00에 핀 하나씩 → 작품 상세 "핀 목록" → 5화 핀이 위. 핀 탭 "시간순"도 동일.
4. **U-4** 핀 탭 → 핀 상세 → "핀 편집" → 메모 수정 저장 → 핀 상세가 아니라 "작품 핀" 목록. 다시 핀 상세 → 편집 → "삭제" 확인 → "핀을 찾을 수 없습니다"에서 멈춤.
5. **U-5** 검색 → 미등록 작품 결과 본문 탭 → 상세 → "내 목록에 추가"를 찾으려면 끝까지 스크롤.
6. **U-6** 12화까지 체크한 24화 작품 → 홈 "다음: 13화" → 에피소드 목록이 1화부터 표시.
7. **U-7** 폭 375 핀 탭 → 첫 핀 카드가 첫 화면에 보이지 않음. 검색창 옆 필터 아이콘 탭 → 변화 없음.
8. **U-8** 네트워크를 끊고 핀 작성 진입 → 작품·회차 확인 실패 → 저장 버튼이 파란 활성색 그대로, 눌러도 무반응.
9. **U-9** 핀 두 개에 같은 태그를 달려면 두 번 모두 타이핑.
10. **U-10** 네트워크를 끊고 라이브러리 탭 진입(캐시 없음) → 오류 박스와 "라이브러리가 비어 있어요" 동시 노출.
11. **U-11** Edge Function이 실패하는 상태에서 검색 결과 "보고 싶음" → 개발자용 문구 Alert(웹은 무반응).

---

## 4. 설계 결정

### D-1. DB 스키마·마이그레이션·RLS·Edge Function을 바꾸지 않는다
시즌 번호는 기존 FK를 이용한 **select 임베드**로만 가져온다. 서비스 함수의 시그니처도 바꾸지 않는다(반환 필드 추가만 허용).

### D-2. 태블릿(상세 패널 표시, `showDetailPanel === true`) 동작은 그대로다
패널이 있는 폭에서는 카드 탭 = 선택(패널 갱신)이 맞는 동작이다. U-1·U-7 변경은 `showDetailPanel === false`일 때만 동작을 바꾼다. 필터 버튼만은 모든 폭에서 실제로 펼침/접힘을 토글한다.

### D-3. 장면 순서는 순수 함수 하나로 정의한다
작품 안의 장면 순서 = **시즌 → 회차 → 초 → 작성 시각 → id**. 회차 없는 핀(영화, 작품 전체 핀)은 같은 작품 안에서 맨 앞. 초가 없는 핀("시간 미지정")은 같은 회차 안에서 맨 뒤(현재 DB `nullsFirst: false`와 동일). `getPinsByContent`와 핀 탭 정렬 모드 둘 다 이 함수를 쓴다. DB `.order(...)` 절은 남겨둔다(무해, 변경 최소화).

### D-4. 시즌 표기는 시즌 2 이상과 특별편(0)만 붙인다
대부분의 단일 시즌 작품에 "시즌 1 · "을 붙이면 소음이다. `season_number >= 2` → `시즌 N`, `season_number === 0` → `특별편`, 그 외(null·1) → 생략.

### D-5. 라이브러리 삭제는 확인 후에만 실행하고, 문구는 실제 삭제 범위와 일치한다
지워지는 것: 감상 상태, 본 횟수, 시청 위치, 감상 날짜. 남는 것: 핀, 회차 체크, 평점. `deleteLibraryItem` 서비스는 바꾸지 않는다. 삭제 버튼은 본문 맨 끝 독립 영역으로 옮겨 상태 버튼과 떨어뜨린다.

### D-6. 작품 상세 순서: 기록 CTA → 상태 패널 → 나머지
`docs/19` M-09("기록 CTA가 부가 정보보다 먼저")를 유지한다. 등록된 작품은 기존 상단 행동 영역(에피소드 보기/영화 핀 추가·핀 목록·목록)이 먼저, 그 바로 아래 상태 패널. 미등록 외부 작품은 상단 행동 영역이 없으므로 상태 패널("내 목록에 추가")이 제목 바로 아래에 온다. 시청 진행 카드는 본 횟수보다 위로 올린다(사용 빈도).

### D-7. 에피소드 목록은 "다음 볼 회차"로 한 번만 스크롤하고, 진행 데이터는 건드리지 않는다
- **수동 시청 위치가 체크보다 우선**한다(`docs/12`·`docs/14` 계약).
- 스크롤은 시즌 선택마다 **한 번**. 체크박스를 토글해도 다시 점프하지 않는다.
- 다음 회차가 있는 **시즌으로 자동 전환하지 않는다.** 절대/시즌 상대 회차 의미가 `docs/12`·`docs/17`에서 얽혀 있어 이 작업 범위에서 판정하지 않는다.
- 쓰기(진행 저장·상태 변경)는 전혀 하지 않는다.

### D-8. 태그 제안은 기존 태그만 보여주고 탭해도 서버에 쓰지 않는다
제안 칩을 누르면 `draft.tags`에만 추가된다. 저장 시 기존 `tagNames` 흐름으로 처리된다. 기존 20자·10개·중복 검증을 그대로 거친다.

### D-9. 검색·추천 카드의 행동 버튼 구성은 바꾸지 않는다
`docs/28` D-5, `docs/30` D-4의 카드 행동 결정을 건드리지 않는다. U-11은 피드백 문구(토스트)만 바꾼다.

### D-10. 사용자에게 보이는 실패는 토스트로 알린다
이번에 손대는 경로(라이브러리 삭제, 검색 추가, 핀 삭제)의 성공·실패 피드백은 `useAppUIStore.addToast`를 쓴다. `Alert.alert`는 웹에서 빈 함수다. **확인 대화상자**(삭제 확인)는 기존 `confirmDiscard`처럼 웹 `window.confirm` / 네이티브 `Alert.alert` 분기로 한다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

---

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| 핀 정렬을 DB에서(`order("episodes(season_number)")` 등 관계 정렬) | PostgREST 관계 정렬은 embed 필터 규칙이 까다롭고 테스트할 수 없다. 핀 수는 작품당 수십 개 수준이라 클라이언트 정렬 비용이 무시할 만하다. |
| `timeline_pins`에 `season_number`/`episode_number` 비정규화 컬럼 추가 | 마이그레이션·백필 필요. D-1 위반. 임베드로 충분하다. |
| 라이브러리 삭제를 "실행 취소" 토스트(지연 삭제)로 | 삭제를 지연하려면 낙관적 캐시 제거 + 타이머 + 앱 종료 시 처리까지 필요. 확인 대화상자가 더 단순하고 확실하다. |
| 모바일 핀 카드: 탭 = 선택 유지, `⋮`를 크게 | 모바일에는 선택 결과를 보여줄 패널이 없다. "선택"은 의미 없는 상태다. |
| 에피소드 화면에서 다음 회차의 시즌으로 자동 전환 | D-7. 시즌 등록(`season_number`)과 절대 회차 계산의 조합이 `docs/17`에서 아직 검증 중이라 틀린 시즌으로 보낼 위험이 있다. 같은 시즌 안 스크롤만으로 대부분의 이득을 얻는다. |
| 태그 제안을 사용 빈도순으로 | `useAllPins` 전체를 작성 화면에서 집계해야 한다. 이름순 + 입력 필터로 먼저 충분한지 본다. |
| 검색 결과 카드에 "보는 중" 빠른 추가 | D-9. 카드 행동 개수·순서는 `docs/30`에서 방금 확정했다. 별도 논의 대상. |
| 작품 상세의 상태 배지 행 제거(상태 패널과 중복) | 이번 결함과 무관한 시각 변경이다. 범위를 늘리지 않는다. |

---

## 6. 계약 (타입 · 판정 순서)

모든 새 순수 함수는 `src/utils/`에 둔다. **런타임 import는 상대 경로**(`./genre`), 타입은 `import type`만. React Native·Supabase·expo 모듈 import 금지.

### 6.1 `src/types/pins.ts`
```ts
export interface TimelinePin {
  // ...기존 필드 유지
  season_number?: number | null | undefined; // episodes → seasons 임베드. 회차 없는 핀은 null
}
```

### 6.2 `src/utils/pinSort.ts`
```ts
import type { PinSortMode, TimelinePin } from "@/types/pins";

type ScenePin = Pick<TimelinePin, "id" | "season_number" | "episode_number" | "timestamp_seconds" | "created_at">;
type ListPin = ScenePin & Pick<TimelinePin, "content_id" | "content_title">;

export function compareScenePins(a: ScenePin, b: ScenePin): number;
export function sortPinsByScene<T extends ScenePin>(pins: readonly T[]): T[];
export function sortPins<T extends ListPin>(pins: readonly T[], mode: PinSortMode): T[];
```
`compareScenePins` 판정 순서 (앞에서 0이 아니면 즉시 반환):
1. `season_number` — `null`/`undefined`가 앞, 그다음 오름차순
2. `episode_number` — `null`/`undefined`가 앞, 그다음 오름차순
3. `timestamp_seconds` — **`null`이 뒤**, 그다음 오름차순
4. `created_at` 문자열 오름차순 (`localeCompare`)
5. `id` 문자열 오름차순

`sortPins(pins, mode)`:
- `"latest"`: `created_at` 내림차순 (기존 동작과 동일), 동률이면 `id` 오름차순
- `"timeline"`: ① `content_title ?? ""`을 `localeCompare(b, "ko")` ② `content_id` 오름차순(같은 제목의 다른 작품이 섞이지 않게) ③ `compareScenePins`
- 두 함수 모두 **입력 배열을 변형하지 않고** 새 배열을 반환한다.

### 6.3 `src/utils/pinLabels.ts`
```ts
import type { TimelinePin } from "@/types/pins";

export function formatPinEpisodeLabel(
  pin: Pick<TimelinePin, "season_number" | "episode_number" | "episode_title">,
  options?: { includeTitle?: boolean } // 기본 true
): string | null;
```
판정 순서:
1. 조각 배열 `parts = []`
2. `season_number === 0` → `"특별편"` 추가, `season_number >= 2` → `` `시즌 ${n}` `` 추가, 그 외 추가하지 않음
3. `episode_number`가 1 이상 정수 → `` `${n}화` `` 추가
4. `includeTitle !== false`이고 `episode_title?.trim()`이 비어 있지 않으면 추가
5. `parts`에 회차 번호도 제목도 없으면(= 3·4에서 아무것도 추가 안 됨) `null` 반환 — 시즌 조각만 있는 경우도 `null`
6. `parts.join(" · ")`

### 6.4 `src/utils/episodeResume.ts`
```ts
import type { Episode } from "@/types/content";

export interface EpisodeResumeInput {
  episodes: ReadonlyArray<Pick<Episode, "id" | "episode_number">>; // 화면 표시 순서 그대로
  watchedEpisodeIds: ReadonlySet<string>;
  selectedSeasonNumber: number | null;
  isOnlySeason: boolean;
  manualProgress: { seasonNumber: number | null; episodeNumber: number } | null;
}

/** 목록에서 "다음 볼 회차"의 인덱스. 목록이 비면 null. */
export function findResumeEpisodeIndex(input: EpisodeResumeInput): number | null;
```
판정 순서:
1. `episodes.length === 0` → `null`
2. `manualProgress`가 있고, `manualProgress.seasonNumber === selectedSeasonNumber` **또는** (`manualProgress.seasonNumber === null && isOnlySeason`)이면:
   - `episode_number === manualProgress.episodeNumber + 1`인 첫 인덱스가 있으면 반환
   - 없고 `episode_number === manualProgress.episodeNumber`인 인덱스가 있으면 반환(마지막 화까지 본 경우)
   - 둘 다 없으면 3으로 진행
3. `watchedEpisodeIds`에 id가 있는 **가장 큰 인덱스** `last`가 있으면 `Math.min(last + 1, episodes.length - 1)` 반환
4. `0` 반환

### 6.5 `src/utils/tagSuggestions.ts`
```ts
export function suggestTags(
  allTagNames: readonly string[],
  input: string,
  selected: readonly string[],
  limit?: number // 기본 8
): string[];
```
판정 순서:
1. `allTagNames`를 순서 유지하며 중복 제거, `selected`에 정확히 같은 이름이 있으면 제외
2. `query = input.trim().replace(/,$/, "").trim().toLocaleLowerCase()`
3. `query`가 비었으면 1의 결과 앞에서 `limit`개
4. 아니면 `name.toLocaleLowerCase().startsWith(query)`인 것(원래 순서) → 그다음 `includes(query)`이지만 startsWith가 아닌 것(원래 순서) → 합쳐서 앞에서 `limit`개

### 6.6 `src/utils/pinListUi.ts`
```ts
import type { EmotionType } from "@/types/pins";

export function getPinCardPressAction(showDetailPanel: boolean): "select" | "open";
export function countActivePinFilters(filters: { tagId: string | null; emotion: EmotionType | "all"; genre: string }): number;
export function resolvePinFiltersVisible(expanded: boolean | null, showDetailPanel: boolean): boolean;
```
- `getPinCardPressAction`: `showDetailPanel ? "select" : "open"`
- `countActivePinFilters`: `tagId !== null`, `emotion !== "all"`, `genre !== ALL_GENRE_FILTER`(`./genre`에서 import) 각각 1
- `resolvePinFiltersVisible`: `expanded ?? showDetailPanel`

### 6.7 `src/utils/libraryFeedbackCopy.ts`
```ts
export interface ConfirmCopy { title: string; message: string; confirmLabel: string; cancelLabel: string }
export function createLibraryDeleteConfirmCopy(contentTitle: string): ConfirmCopy;
export function createLibraryAddFeedback(status: "wishlist" | "completed", outcome: "success" | "error"): string;
```
정확한 문자열:
- `createLibraryDeleteConfirmCopy("무빙")` →
  - `title`: `"내 목록에서 삭제할까요?"`
  - `message`: `"‘무빙’의 감상 상태, 본 횟수, 시청 위치, 감상 날짜가 삭제됩니다. 남긴 핀과 회차 체크, 평점은 그대로 남아요."`
  - `confirmLabel`: `"삭제"`, `cancelLabel`: `"취소"`
  - 제목이 공백뿐이면 `‘이 작품’`으로 대체
- `createLibraryAddFeedback("wishlist", "success")` → `"보고 싶음에 추가했어요."`
- `createLibraryAddFeedback("completed", "success")` → `"완료로 기록했어요."`
- `createLibraryAddFeedback(_, "error")` → `"라이브러리에 추가하지 못했어요. 잠시 후 다시 시도해 주세요."`

### 6.8 `src/utils/confirmDestructive.ts` (RN import — 테스트 대상 아님, `confirmDiscard.ts`와 같은 형태)
```ts
import { Alert, Platform } from "react-native";
import type { ConfirmCopy } from "./libraryFeedbackCopy";

export function confirmDestructive(copy: ConfirmCopy, onConfirm: () => void): void {
  if (Platform.OS === "web") {
    if (window.confirm(`${copy.title}\n\n${copy.message}`)) onConfirm();
    return;
  }
  Alert.alert(copy.title, copy.message, [
    { text: copy.cancelLabel, style: "cancel" },
    { text: copy.confirmLabel, style: "destructive", onPress: onConfirm }
  ]);
}
```

---

## 7. 데이터 모델 / SQL

**없음.** `src/services/pins.ts`의 select 문자열만 바뀐다.
```ts
const PIN_SELECT =
  "*,contents(title_primary,poster_url,source_api,source_id,content_genres(genres(name))),episodes(episode_number,title,seasons(season_number)),timeline_pin_tags(tag_id,tags(*))";
```
`RawPinRow.episodes`에 `seasons?: { season_number: number | null } | null` 추가, `mapPin`에 `season_number: row.episodes?.seasons?.season_number ?? row.season_number ?? null` 추가. `getPinsByContent`만 반환 직전에 `sortPinsByScene(...)` 적용.

---

## 8. 화면 명세

### 8.1 핀 탭 `app/(tabs)/pins.tsx` (U-1, U-3, U-7)
- `const pressAction = getPinCardPressAction(showDetailPanel)`. 리스트 보기 `PinCard`와 타임라인 보기 로컬 `PinTimelineItem` 모두: `"open"`이면 항목 탭 → `router.push({ pathname: "/pins/[id]", params: { id } })`, `"select"`면 기존처럼 선택.
- `PinCard` 오른쪽 아이콘 `ellipsis-vertical` → `chevron-forward`(접근성 라벨 "핀 상세 열기" 유지).
- 정렬 세그먼트 라벨 "시간순" → **"작품별"**. `sortedPins`는 `sortPins(filteredPins, sortMode)`.
- 필터: `const [filtersExpanded, setFiltersExpanded] = useState<boolean | null>(null)`, `filtersVisible = resolvePinFiltersVisible(filtersExpanded, showDetailPanel)`, `activeFilterCount = countActivePinFilters({ tagId: selectedTagId, emotion: selectedEmotion, genre: genreFilter })`.
  - 필터 아이콘: `onPress={() => setFiltersExpanded(!filtersVisible)}`, `selected={filtersVisible || activeFilterCount > 0}`, 접근성 라벨 `activeFilterCount ? "필터 N개 적용됨" : "필터"`, `accessibilityState.expanded = filtersVisible`, `activeFilterCount > 0`이면 아이콘 우상단에 숫자 배지.
  - `FilterRow` 3개와 `SummaryCards`는 `filtersVisible`일 때만 렌더.
  - `!filtersVisible && activeFilterCount > 0`이면 툴바의 "N개의 핀" 옆에 "필터 초기화" 텍스트 버튼(최소 44pt): 태그·감정·장르를 전체로.
- 회차 라벨: `getEpisodeLabel` 본문을 `formatPinEpisodeLabel(pin)`으로 교체.

### 8.2 작품 핀 목록 `app/content/[id]/pins.tsx`
화면 코드는 변경 없음. 서비스 정렬(D-3)과 `PinTimelineItem` 라벨(D-4)로 결과가 바뀐다.

### 8.3 핀 상세 `app/pins/[id].tsx` (U-4)
- 마지막으로 로드된 핀을 ref로 보관: 편집 중 낙관적 삭제로 `pin.data`가 `null`이 되어도 PinComposer를 언마운트하지 않는다.
- 편집 성공 → `setEditing(false)`만 한다(단건 쿼리 무효화로 최신 내용 표시). `router.dismissTo` 제거.
- PinComposer에 `onDeleted` 전달 → `router.canGoBack() ? router.back() : router.replace("/pins")`.
- 핀이 없을 때 EmptyState에 행동 버튼 "핀 목록으로" → `router.replace("/pins")`.

### 8.4 핀 작성 `src/components/pins/PinComposer.tsx` (U-4, U-8, U-9)
- 새 선택 prop `onDeleted?: () => void`. 삭제 성공 시 `addToast("핀을 삭제했어요.", "success")` 후 `leave(onDeleted ?? onCancel)`. 네이티브·웹 두 분기 모두.
- `const saveDisabled = isSaving || context.isPending || context.isError;` — `disabled`, `accessibilityState.disabled`, 스타일 `saveDisabled && styles.disabled` 모두 이 값.
- 316행 오류 텍스트를 하단 고정 영역(저장 버튼 **위**)으로 이동, `accessibilityRole="alert"`.
- 태그: `addTag`를 `commitTag(raw: string)`로 일반화(검증 문구·순서 동일, 성공 시 `setTagInput("")`). 입력행 아래 "내 태그" 제안 칩: `suggestTags(tagNames, tagInput, draft.tags, 8)`, `draft.tags.length >= 10`이거나 `isSaving`이거나 결과가 비면 영역을 렌더하지 않는다. 칩은 `TagChip`에 `onPress={() => commitTag(name)}`, 접근성 라벨 `"태그 ${name} 추가"`.

### 8.5 작품 상세 `app/content/[id].tsx` (U-2, U-5)
본문 순서(현재 행 번호 기준 블록 이동):
1. 제목·원제·메타·경고 (379~386) — 유지
2. 상태 배지 행 (388~394) — 유지
3. 행동 영역 (396~445) — 유지
4. **상태 패널** (547~575의 제목+그리드, 삭제 버튼 제외) — 여기로 이동
5. 장르 (446)
6. **시청 진행 카드** (457~470, `onLayout` 래퍼 포함) — 본 횟수보다 위로
7. 본 횟수 (448~455)
8. 감상 (472~483), 줄거리 (485~486), 시청처 (488~492), 출연진 (494~544) — 유지
9. **삭제 영역** — 본문 맨 끝, `libraryItem`일 때만. 버튼 문구 `"내 목록에서 삭제"`(진행 중 `"삭제 중"`). 누르면 `confirmDestructive(createLibraryDeleteConfirmCopy(view.title), 실제삭제)`.
   - 실제삭제 성공: `addToast("내 목록에서 삭제했어요.", "success")` 후 기존 `openLibraryList()`
   - 실패: `addToast(error.message || "삭제하지 못했어요.", "error")`

### 8.6 에피소드 목록 `app/content/[id]/episodes.tsx` + `src/components/content/EpisodeSelector.tsx` (U-6)
- 화면: `resumeReady = !episodes.isLoading && !progress.isLoading && !library.isLoading && (episodes.data?.length ?? 0) > 0`. 준비되면 `findResumeEpisodeIndex(...)`, 아니면 `null`. `manualProgress`는 `libraryItem?.manual_watched_episode_number != null`일 때 `{ seasonNumber: libraryItem.manual_watched_season_number, episodeNumber: libraryItem.manual_watched_episode_number }`.
- `EpisodeSelector` 새 선택 prop `resumeEpisodeIndex?: number | null`, `scrollKey?: string | null`(= `selectedSeasonId`).
  - `FlashListRef<Episode>` ref + `scrolledKeyRef`. `resumeEpisodeIndex`가 숫자이고 `scrollKey`가 아직 소비되지 않았으면 소비 표시 후, 인덱스가 0보다 크면 `requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.3 }))`.
  - `EpisodeRow`에 `isResume` prop: `index === resumeEpisodeIndex`이고 미시청이면 테두리를 `colors.primary`로, 메타 줄 앞에 "다음 볼 회차" 표시. `FlashList`에 `extraData={resumeEpisodeIndex}`.

### 8.7 라이브러리 탭 `app/(tabs)/library.tsx` (U-10)
663행 조건을 `!library.isLoading && !library.isError && !filteredItems.length`로.

### 8.8 검색 `app/search.tsx` (U-11)
`addResult`의 `onSuccess`에 `addToast(createLibraryAddFeedback(status, "success"), "success")`, `onError`의 `Alert.alert(...)` 전체를 `addToast(createLibraryAddFeedback(status, "error"), "error")`로 교체. 개발자 진단용으로 `console.warn("[search] addToLibrary failed", error)`는 남겨도 된다.

### 8.9 회차 라벨 공통화 (U-3)
- `src/components/pins/PinTimelineItem.tsx:30~33` → `formatPinEpisodeLabel(pin)`
- `src/components/pins/RecentPinCard.tsx:24` → `formatPinEpisodeLabel(pin, { includeTitle: false })`(홈 카드는 짧게)
- `src/components/pins/PinShareCard.tsx:71~76` 로컬 함수 본문 → `formatPinEpisodeLabel(pin)`
- `app/(tabs)/pins.tsx:682~685` 로컬 함수 본문 → `formatPinEpisodeLabel(pin)`

---

## 9. 엣지 케이스

| # | 상황 | 기대 동작 |
|---|------|-----------|
| E-1 | 같은 작품 1화 20:00, 5화 03:00 | 1화 핀이 먼저 (T-1) |
| E-2 | 시즌 2 1화 vs 시즌 1 12화 | 시즌 1 12화가 먼저 (T-2) |
| E-3 | 같은 회차에 시간 미지정 핀 | 그 회차의 맨 뒤 (T-4) |
| E-4 | 같은 회차·같은 초에 핀 2개 | 먼저 만든 핀이 위 (T-5) |
| E-5 | 영화 핀 / 작품 전체 핀과 회차 핀 혼재 | 회차 없는 핀이 먼저 (T-6) |
| E-6 | 제목이 같은 서로 다른 작품 | "작품별"에서 섞이지 않음 (T-10) |
| E-7 | 시즌 0(특별편) 핀 | "특별편 · 1화" (T-14), 정렬상 시즌 1보다 앞 (T-2 변형 아님, 규칙 1로 자연 충족) |
| E-8 | 회차 정보가 없는 핀 | 라벨 `null`, 기존처럼 회차 부분 생략 (T-15) |
| E-9 | 에피소드 목록이 비었음 | 스크롤 없음 (T-17) |
| E-10 | 수동 시청 위치와 체크가 다를 때 | 수동값 기준 (T-23) |
| E-11 | 수동 위치가 다른 시즌 | 무시하고 체크 기준 (T-24) |
| E-12 | 단일 시즌 작품의 수동 위치(seasonNumber null) | 적용 (T-25) |
| E-13 | 마지막 화까지 수동으로 봄 | 마지막 화 (T-27) |
| E-14 | 회차 번호가 1부터 시작하지 않는 시즌 (13~24화) | 번호로 찾음 (T-29) |
| E-15 | 체크 토글로 진행 데이터가 바뀜 | 다시 스크롤하지 않음 (수동 검증 M-6) |
| E-16 | 태그 10개 이미 선택 | 제안 영역 숨김 (수동 M-9) |
| E-17 | 태그 입력에 "감동, " (쉼표·공백) | "감동"으로 필터 (T-36) |
| E-18 | 모바일 타임라인 보기 | 항목 탭 → 상세 (T-39, 수동 M-1) |
| E-19 | 태블릿(768+) | 기존대로 선택 + 패널 (T-40, 수동 M-2) |
| E-20 | 모바일에서 필터 접힘 + 감정 필터 적용 중 | 필터 배지 1, "필터 초기화" 노출 (T-42, 수동 M-3) |
| E-21 | 삭제 확인에서 취소 | 아무것도 삭제되지 않음 (수동 M-4) |
| E-22 | 편집 화면에서 핀 삭제 | 이전 화면으로 이동, 토스트 (수동 M-5) |
| E-23 | 삭제 실패(네트워크) | 캐시 복원, 편집 화면 유지, 오류 표시 (기존 `onError` 스냅샷 복원 + 수동 M-5) |
| E-24 | 추가 실패 문구 | 개발자 용어("Edge Function", "secret") 없음 (T-49) |
| E-25 | 라이브러리 오류 + 캐시 없음 | 오류만 표시, 빈 상태 없음 (수동 M-8) |

---

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 파일은 각 util 옆 `*.test.ts`. `node:test` + `node:assert/strict`.

공통 픽스처(pinSort): `pin(overrides)` 헬퍼로 `{ id, content_id: "c1", content_title: "무빙", season_number: null, episode_number: null, timestamp_seconds: null, created_at: "2026-09-01T00:00:00Z" }` 기본값을 만든다.

### `src/utils/pinSort.test.ts`
| ID | 입력 | 기대 |
|----|------|------|
| T-1 | A(ep1, 1200s), B(ep5, 180s) → `sortPinsByScene([B, A])` | `[A, B]` |
| T-2 | A(s2 ep1), B(s1 ep12), C(s0 ep1) | `[C, B, A]` |
| T-3 | 같은 ep3: A(900s), B(60s), C(300s) | `[B, C, A]` |
| T-4 | 같은 ep3: A(null), B(60s) | `[B, A]` |
| T-5 | 같은 ep3·같은 60s: A(created 09-02), B(created 09-01) | `[B, A]` |
| T-6 | A(episode null, 30s), B(ep1, 10s) | `[A, B]` |
| T-7 | `sortPins([...], "latest")`: created 09-01 / 09-03 / 09-02 | 09-03, 09-02, 09-01 순 |
| T-8 | `sortPins(..., "timeline")`: "진격의 거인" ep5 10s, "무빙" ep2 5s, "무빙" ep1 999s | 무빙 ep1 → 무빙 ep2 → 진격의 거인 ep5 |
| T-9 | 입력 배열 `input`으로 `sortPinsByScene(input)`, `sortPins(input, "timeline")` 호출 | 반환값 `!== input`, `input` 원래 순서 그대로 |
| T-10 | "timeline": content c2 "무빙" ep1, c1 "무빙" ep2, c2 "무빙" ep2, c1 "무빙" ep1 | c1 ep1, c1 ep2, c2 ep1, c2 ep2 |

### `src/utils/pinLabels.test.ts`
| ID | 입력 (season, episode, title) | 기대 |
|----|------|------|
| T-11 | (null, 12, null) | `"12화"` |
| T-12 | (1, 12, "각성") | `"12화 · 각성"` |
| T-13 | (2, 3, null) | `"시즌 2 · 3화"` |
| T-14 | (0, 1, null) | `"특별편 · 1화"` |
| T-15 | (null, null, null) 및 (2, null, "  ") | 둘 다 `null` |
| T-16 | (null, null, "파일럿") | `"파일럿"` |
| T-16b | (2, 3, "각성"), `{ includeTitle: false }` | `"시즌 2 · 3화"` |

### `src/utils/episodeResume.test.ts`
공통: `eps = [1..5]` → id `e1`~`e5`, `selectedSeasonNumber: 2`, `isOnlySeason: false`, `manualProgress: null`, `watchedEpisodeIds: new Set()` 기본.
| ID | 변경 | 기대 |
|----|------|------|
| T-17 | `episodes: []` | `null` |
| T-18 | 기본 | `0` |
| T-19 | watched {e1, e2} | `2` |
| T-20 | watched {e5} | `4` |
| T-21 | watched {e1, e3} | `3` |
| T-22 | manual {2, 2} | `2` |
| T-23 | manual {2, 2}, watched {e1, e2, e3, e4} | `2` (수동 우선) |
| T-24 | manual {1, 2}, watched {e1} | `1` (다른 시즌 수동값 무시) |
| T-25 | manual {null, 3}, `isOnlySeason: true` | `3` |
| T-26 | manual {null, 3}, `isOnlySeason: false`, watched {e1} | `1` |
| T-27 | manual {2, 5} | `4` |
| T-28 | manual {2, 9} | `0` |
| T-29 | episodes 번호 [13..17](id e13~e17), manual {2, 13} | `1` |
| T-30 | manual {2, 0} | `0` (0화까지 = 1화부터) |

### `src/utils/tagSuggestions.test.ts`
공통: `all = ["감동", "감동실화", "눈물", "명대사", "사랑", "액션", "작화"]`
| ID | 입력 | 기대 |
|----|------|------|
| T-31 | `suggestTags(all, "", [])` | 7개 전부, 원래 순서 |
| T-32 | input `"감"` | `["감동", "감동실화"]` |
| T-33 | input `"사"` | `["사랑", "명대사"]` (접두 먼저) |
| T-34 | input `"감"`, selected `["감동"]` | `["감동실화"]` |
| T-35 | input `""`, limit `2` | `["감동", "감동실화"]` |
| T-36 | input `" 감동, "` | `["감동", "감동실화"]` |
| T-37 | all `["Action", "act", "Drama"]`, input `"AC"` | `["Action", "act"]` |
| T-38 | all `["감동", "감동", "눈물"]`, input `""` | `["감동", "눈물"]` |

### `src/utils/pinListUi.test.ts`
| ID | 입력 | 기대 |
|----|------|------|
| T-39 | `getPinCardPressAction(false)` | `"open"` |
| T-40 | `getPinCardPressAction(true)` | `"select"` |
| T-41 | `countActivePinFilters({ tagId: null, emotion: "all", genre: "all" })` | `0` |
| T-42 | `{ tagId: "t1", emotion: "sad", genre: "액션" }` / `{ tagId: null, emotion: "sad", genre: "all" }` | `3` / `1` |
| T-43 | `resolvePinFiltersVisible(null, false)` / `(null, true)` | `false` / `true` |
| T-44 | `resolvePinFiltersVisible(true, false)` / `(false, true)` | `true` / `false` |

### `src/utils/libraryFeedbackCopy.test.ts`
| ID | 입력 | 기대 |
|----|------|------|
| T-45 | `createLibraryDeleteConfirmCopy("무빙")` | 6.7의 네 문자열과 정확히 일치 |
| T-46 | `createLibraryDeleteConfirmCopy("  ")` | message가 `"‘이 작품’의 "`로 시작 |
| T-47 | `createLibraryAddFeedback("wishlist", "success")` | `"보고 싶음에 추가했어요."` |
| T-48 | `createLibraryAddFeedback("completed", "success")` | `"완료로 기록했어요."` |
| T-49 | `createLibraryAddFeedback("wishlist", "error")`, `("completed", "error")` | 둘 다 6.7 오류 문구, `"Edge Function"`·`"secret"`·`"API"` 미포함 |

### 수동 검증 (화면 — 자동 테스트 불가, 구현자가 웹 8081에서 확인 가능한 범위만)
| ID | 절차 | 기대 |
|----|------|------|
| M-1 | 375폭 핀 탭: 카드 본문 탭, 타임라인 보기에서 항목 탭 | 둘 다 핀 상세 |
| M-2 | 1024폭 핀 탭: 카드 탭 | 선택 + 오른쪽 패널 갱신, 상세로 이동하지 않음 |
| M-3 | 375폭: 필터 아이콘 탭 → 감정 선택 → 다시 접기 | 행 3개 펼침/접힘, 배지 1, "필터 초기화" 동작 |
| M-4 | 작품 상세: "내 목록에서 삭제" → 취소 / 확인 | 취소 시 변화 없음, 확인 시 토스트 + 라이브러리 목록 |
| M-5 | 핀 상세 → 편집 → 저장 / 편집 → 삭제 | 저장: 같은 핀 상세(수정 반영). 삭제: 이전 화면 + 토스트 |
| M-6 | 12화까지 체크한 작품 → 에피소드 목록 → 체크 하나 토글 | 13화 근처로 1회 스크롤, 토글 시 다시 점프 없음 |
| M-7 | 검색 미등록 작품 상세 | "내 목록에 추가"가 제목 바로 아래 |
| M-8 | 오프라인 라이브러리 탭 | 오류만 표시 |
| M-9 | 핀 작성에서 태그 10개 채움 | 제안 영역 사라짐 |

---

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/types/pins.ts` | `TimelinePin.season_number` 선택 필드 추가 |
| `src/services/pins.ts` | `PIN_SELECT` 시즌 임베드, `RawPinRow`/`mapPin` 시즌 매핑, `getPinsByContent` 장면순 정렬 |
| `src/utils/pinSort.ts` (+test) | 신규 — 6.2 |
| `src/utils/pinLabels.ts` (+test) | 신규 — 6.3 |
| `src/utils/episodeResume.ts` (+test) | 신규 — 6.4 |
| `src/utils/tagSuggestions.ts` (+test) | 신규 — 6.5 |
| `src/utils/pinListUi.ts` (+test) | 신규 — 6.6 |
| `src/utils/libraryFeedbackCopy.ts` (+test) | 신규 — 6.7 |
| `src/utils/confirmDestructive.ts` | 신규 — 6.8 (테스트 없음) |
| `app/(tabs)/pins.tsx` | 8.1 |
| `app/pins/[id].tsx` | 8.3 |
| `src/components/pins/PinComposer.tsx` | 8.4 |
| `app/content/[id].tsx` | 8.5 |
| `app/content/[id]/episodes.tsx` | 8.6 |
| `src/components/content/EpisodeSelector.tsx` | 8.6 |
| `app/(tabs)/library.tsx` | 8.7 (한 줄) |
| `app/search.tsx` | 8.8 (`addResult`만) |
| `src/components/pins/PinTimelineItem.tsx` | 8.9 라벨 |
| `src/components/pins/RecentPinCard.tsx` | 8.9 라벨 |
| `src/components/pins/PinShareCard.tsx` | 8.9 라벨 |

---

## 12. 범위 밖

| 항목 | 이유 |
|------|------|
| `Alert.alert` 전반의 웹 대응(진행 상태 제안, 에피소드 길게 누르기, 상태 변경 실패 등) | 네이티브가 주 대상. 이번에 손대는 경로만 토스트로 바꾼다(D-10). 별도 작업 권장 |
| 다음 회차가 있는 시즌 자동 선택 | D-7 |
| 검색 카드 "보는 중" 빠른 추가, 카드 행동 구성 | D-9 |
| 홈 화면 구성(하단 "SceneNote / 작품 검색" 영역 위치, 핀이 0개일 때 핀 소개 부재) | 흐름을 막지 않는 배치 문제. 별도 기획 필요 |
| 라이브러리 검색창이 키 입력마다 `router.setParams` 호출 | 성능 관찰 사항. 실측 없이 판단하지 않는다 |
| 핀 저장의 본문/태그 2단계 원자성 | `docs/21` 기존 제한. RPC 재설계 필요 |
| 상태 배지 행 제거, 감정 "없음" 선택지 정리 | 결함 아님. 시각 변경만 늘어난다 |
| 태그 사용 빈도순 제안 | 5장 |

## 13. 확실하지 않음 — 별도 검증 필요

1. **PostgREST 임베드** `episodes(episode_number,title,seasons(season_number))`: `episodes.season_id → seasons.id` FK가 하나뿐이라 동작해야 하지만 실제 DB로 실행하지 않았다. 사람이 앱에서 여러 시즌 작품의 핀 목록을 열어 `시즌 2 · N화`가 나오는지 확인한다. 실패하면 핀 목록 전체가 오류가 되므로 **배포 전 필수 확인**.
2. **FlashList v2 `scrollToIndex` + `viewPosition`**: 가변 높이 행에서 네이티브·웹 모두 정확한 위치로 가는지 실기기 미검증. 목표 행이 화면 안에만 들어오면 합격으로 본다.
3. **로그인 이후 화면 실측 없음**: 이 명세의 모든 판단은 코드 경로 분석이다. 특히 U-7(첫 핀이 첫 화면 밖으로 밀림)은 헤더 구성 요소 수로 판단했으며 픽셀 실측이 아니다.
