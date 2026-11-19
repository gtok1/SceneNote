# 74. 내 구독 OTT로 바로 보러 가기 명세

작성일: 2026-11-17
대상 브랜치 기준: main (`519ddc7`)
선행 문서: `docs/00_ui_style_rules.md`, `docs/39_content_detail_saas_redesign_spec.md`, `docs/54_anime_sequel_watch_providers_fixes_spec.md`(15~16장), `docs/69_persistent_public_metadata_cache_fixes_spec.md`, `docs/37_profile_dashboard_redesign_spec.md`

이 문서는 기능 추가 명세다. 앱 코드와 마이그레이션 SQL 파일 1개를 만든다. Edge Function은 바꾸지 않는다(배포 없음). 마이그레이션 적용은 사람이 한다.

---

## 1. 문제 정의

### 1.1 비교 방법과 채택 기준

키노라이츠(OTT 통합 검색 앱)와 SceneNote에서 **사용자가 같은 일을 할 때 거치는 단계**를 비교했다. 키노라이츠에 있는 기능을 맞추는 것이 목적이 아니다. 아래 네 가지를 모두 만족하는 것만 구현한다(2026-11-17 사용자 결정: 편의성이 뛰어난 것만).

1. **자주 반복하는 일이다.** 한두 번 쓰고 마는 기능은 뺀다.
2. **단계가 분명히 줄어든다.** 누르기·스크롤·눈으로 찾기가 줄어야 한다. 표시만 바뀌는 것은 뺀다.
3. **사용자 부담이 한 번의 설정으로 끝난다.**
4. **확인하지 못한 정보를 확신처럼 보여 주지 않는다.**

확인한 자료(2026-11-17): 키노라이츠 공개 웹 화면(홈·작품 상세·탐색·랭킹·예정작), App Store 한국 페이지의 앱 설명과 버전 기록(<https://apps.apple.com/kr/app/id1411855404>). 로그인 뒤 화면은 직접 열지 않았다(13장 U-1).

### 1.2 사용자 작업별 비교

| # | 사용자가 하려는 일 | 키노라이츠 | SceneNote (코드 확인) | 판단 |
|---|-------------------|-----------|----------------------|------|
| C-1 | 보던 작품을 내 OTT에서 이어 보러 간다 | 구독 OTT를 한 번 등록. 작품 상세 맨 위 `바로보기` 한 번 | 구독 개념이 없다. 작품 상세에서 보러가기 카드까지 내려가(좁은 화면은 히어로·진행 카드·본 횟수 카드 아래, `contentDetailSections` `src/utils/contentDetailView.ts:65`) 탭을 고르고 목록에서 내가 가입한 곳을 찾아 누른다 | **채택.** 시청할 때마다 반복하는 일이고, "스크롤 + 탭 고르기 + 찾기 + 누르기"가 "누르기 한 번"이 된다 |
| C-2 | 이 작품이 내 OTT에 있는지 확인한다 | 구독 OTT 기준으로 보여 준다 | 제공처 순서가 누구에게나 같다. 가입한 곳이 "무료" 탭에만 있어도 "정액제" 탭이 먼저 열린다(`pickInitialWatchCategory`, `src/utils/watchProviderDisplay.ts:12-17`) | **채택.** C-1과 같은 설정으로 해결되고, 찾는 수고가 없어진다 |
| C-3 | 라프텔 구독자가 애니를 보러 간다 | 라프텔을 OTT로 다룬다 | 보러가기 카드 맨 아래 "라프텔에서 찾아보기" 줄까지 내려가야 한다(`WatchProviderList.tsx:148-164`) | **채택.** 애니 기록이 이 앱의 주 용도다. 다만 제공 여부는 확인할 수 없으므로 "찾기"로만 연결한다(기준 4) |
| C-4 | 본 작품의 상태를 기록한다 | 찜하기·보는중·봤어요 | 히어로의 상태 선택 6종, 한 번 누르기 | 이미 같거나 더 낫다. 손대지 않는다 |
| C-5 | 어디까지 봤는지 기록한다 | 없음 | 홈 이어보기 타일의 "N화" 버튼, 진행 카드 | SceneNote가 낫다. 손대지 않는다 |
| C-6 | 추천에서 볼 만한 작품을 고른다 | 구독 OTT 기준 추천 | 국내 OTT 제공작만 추천하고(docs/33) 카드에 제공처 이름을 보여 준다 | **제외.** "내 OTT" 글자를 붙여도 누르는 횟수가 줄지 않는다(기준 2) |
| C-7 | 홈에서 바로 OTT를 연다 | 홈의 보는 중 작품에서 바로 이동 | 타일 → 상세 → 보러가기 | **제외.** C-1을 고치면 "타일 → 히어로 버튼" 두 번이 된다. 한 번을 더 줄이려면 작은 타일에 아이콘 버튼을 얹고 타일마다 제공처를 알아야 한다. 이득이 작다(5장) |
| C-8 | 종료 예정작·랭킹·지수·공개 리뷰를 본다 | 있음 | 없음 | **제외.** 단계를 줄이는 개선이 아니라 새로운 정보 기능이다. 감상 기록 앱의 방향과도 다르다 |

### 1.3 이번에 고칠 것

| ID | 지금 사용자가 겪는 것 | 고친 뒤 |
|----|----------------------|---------|
| F-1 | 내가 구독하는 OTT를 앱에 알려 줄 방법이 없다 | 프로필 → "구독 중인 OTT"에서 한 번 고르면 계정에 저장된다 |
| F-2 | 보러가기 목록에서 내가 가입한 곳을 직접 찾아야 한다. 가입한 곳이 "무료" 탭에만 있어도 "정액제" 탭이 먼저 열린다 | 내 OTT가 목록 맨 앞에 "내 OTT" 표시와 함께 나오고, 내 OTT가 있는 탭이 먼저 열린다. 내 OTT에 없으면 없다고 알려 준다 |
| F-3 | 작품 상세 맨 위에서 바로 보러 갈 수 없다 | 히어로에 "넷플릭스에서 보기" 버튼이 생긴다(내 OTT에서 볼 수 있을 때만) |
| F-4 | 라프텔 구독자는 애니 상세 맨 아래 줄까지 내려가야 한다 | 라프텔을 구독으로 등록하면 애니 상세 히어로에 "라프텔에서 찾기" 버튼이 생긴다(확인된 내 OTT가 없을 때) |

---

## 2. 근본 원인

결함이 아니라 빠진 기능이다. 빠진 지점은 세 곳이다.

1. **저장할 곳이 없다.** `profiles` 테이블에는 `search_filters`(0022)까지만 있다(`src/types/database.ts:423-448`).
2. **제공처 → 서비스 묶음 표를 앱이 쓰지 않는다.** `KR_OTT_PROVIDERS`(`supabase/functions/_shared/watchProviders.ts:22-33`)는 TMDB 제공처 번호를 서비스 묶음(`group`)으로 묶는 표다(넷플릭스 8번과 광고형 1796번이 같은 `netflix`). 지금은 서버가 추천 후보를 국내 OTT로 한정하는 데만 쓴다.
3. **화면이 구독 여부를 받지 않는다.** `WatchProviderList`는 `response`만 받는다(`src/components/content/WatchProviderList.tsx:20-29`). 히어로 영역에는 시청 행동이 없다(`app/content/[id].tsx:423-436`).

---

## 3. 재현 시나리오

수정 전 상태를 확인하는 순서다. 수정 후에는 10장 수동 확인 표로 검증한다.

1. 로그인 → 프로필 탭. "계정" 카드에 로그아웃·회원 탈퇴만 있다(구독 OTT 항목 없음).
2. 웹 폭 375에서 넷플릭스와 티빙에 모두 있는 "보는 중" 작품의 상세를 연다.
3. 히어로(포스터와 행동 버튼 영역)에 시청하러 가는 버튼이 없다.
4. 진행 카드와 본 횟수 카드를 지나 보러가기 카드까지 스크롤해야 한다.
5. 제공처 순서는 누구에게나 같고 "내 OTT" 표시가 없다.

---

## 4. 설계 결정

### D-1. 구독 OTT는 계정에 저장한다 — `profiles.subscribed_otts TEXT[]`

웹과 앱을 함께 쓰므로 기기 저장이 아니라 계정 저장이다(채택 기준 3: 설정은 한 번). 검색 필터를 계정으로 옮긴 0022와 같은 이유다. 값은 서비스 묶음 키(`netflix`, `tving` …)의 배열이다. 기존 `profiles` RLS(`0001_initial_schema.sql:540-551`, 본인 행만 SELECT/INSERT/UPDATE)가 그대로 보호한다. 새 정책은 만들지 않는다.

### D-2. 저장 값은 TMDB 제공처 번호가 아니라 서비스 묶음 키다

넷플릭스는 8번(일반)과 1796번(광고형)이 따로 있다. 번호를 저장하면 요금제가 바뀔 때마다 표시가 어긋난다. 묶음 키와 이름의 단일 출처는 `KR_OTT_PROVIDERS`다. 앱은 이 표를 **import만** 하고 `_shared` 파일은 고치지 않는다(고치면 Edge Function 재배포가 필요해진다).

### D-3. 알 수 없는 값은 읽을 때 버린다. DB에는 값 목록 제약을 두지 않는다

제공처가 늘 때 마이그레이션 없이 앱만 고치면 되도록, DB에는 개수 상한(20)만 둔다. 읽기·쓰기 모두 `normalizeSubscribedOtts`를 거친다. `normalizeSavedSearchFilters`(`src/utils/searchFilterPreferences.ts:11`)와 같은 방식이다.

### D-4. 구독 표시는 정액제·무료 분류에만 적용한다

대여·구매는 구독과 무관하다. `isSubscribedProvider`는 분류가 `flatrate` 또는 `free`일 때만 참을 돌려준다. 대여·구매 탭의 순서와 표시는 지금과 같다.

### D-5. 구독 정보를 못 읽으면 "미설정"으로 동작한다 (최우선)

`profiles.subscribed_otts` 칸이 아직 없거나(마이그레이션 적용 전) 네트워크 오류로 읽지 못하면, 작품 상세는 **지금과 똑같이** 보여야 한다. 오류 문구는 설정 화면에만 낸다. 그래서:

- `getProfile`(`src/services/profile.ts:9-26`)의 select에 새 칸을 **넣지 않는다.** 넣으면 마이그레이션 전에 프로필 화면 전체가 깨진다. 구독 OTT는 별도 조회(`getSubscribedOtts`)로 읽는다.
- 화면은 훅의 `groups`만 쓴다. 조회 실패·로딩 중이면 `groups`는 빈 배열이다.

### D-6. 선택 즉시 저장하되, 저장은 한 번에 하나만 보낸다 (UI-5.6 대체)

설정 화면에는 "저장" 버튼이 없다. 칩을 누르면 화면에 바로 반영하고 저장한다. 저장 버튼 + 이탈 확인(`confirmDiscard`)보다 단계가 적고, 처음 설정할 때 여러 개를 연달아 고르기 쉽다. **UI-5.6 대체:** 이 화면은 "변경 중인 폼"이 없으므로 `confirmDiscard`를 쓰지 않는다.

연달아 누르면 요청이 뒤섞일 수 있으므로 저장은 직렬로 한다. 진행 중인 저장이 있으면 기다렸다가, 끝난 뒤 화면 값이 저장된 값과 다르면 **최신 값으로 한 번만** 더 보낸다(6.1의 `nextSubscribedOttWrite`). 저장 중에도 칩은 잠그지 않는다(UI-4.5).

### D-7. 저장 실패 시 마지막으로 저장된 값으로 되돌린다

실패하면 화면 값을 마지막 저장 성공 값으로 되돌리고 토스트로 알린다. 부분 반영 상태를 남기지 않는다.

### D-8. "○○에서 보기" 버튼은 내 OTT에서 볼 수 있다는 근거가 있을 때만 나온다

- 보러가기 카드가 제공 여부를 표시할 수 있는 응답(`canDisplayWatchProviderAvailability`가 참)일 때만 제공처로 버튼을 만든다. 시즌이 맞지 않는 응답으로 버튼을 만들지 않는다(docs/54 15~16장의 "시리즈 대체 금지"를 지킨다).
- 구독한 곳이 정액제·무료 분류에 있고, 열 수 있는 링크(`normalizeWatchProviderLink`가 null이 아님)가 있어야 한다.
- 후보가 여럿이면 정액제가 무료보다 먼저, 같은 분류 안에서는 응답 순서(이미 `KR_OTT_PROVIDERS` 순서로 정렬됨)의 첫 번째다.
- 버튼은 보조 버튼(흰 배경 + 테두리)이다. 기록 행동(에피소드 보기·핀)이 이 앱의 주 행동이므로 파란 주 버튼을 하나 더 만들지 않는다.
- 제공처 조회가 진행 중이면 버튼을 그리지 않는다(결과가 오면서 문구가 바뀌는 것을 막는다).

### D-9. 링크는 지금 쓰는 제공처 링크 그대로다

TMDB는 작품별 OTT 직행 주소를 주지 않는다. 현재 링크는 대부분 OTT 검색 주소이고 디즈니+는 홈이다(`createProviderLink`, `_shared/watchProviders.ts:107-125`). 새 주소 규칙을 만들지 않는다. 디즈니+처럼 홈으로 가는 경우 버튼 문구는 "디즈니+ 열기"로 한다("보기"라고 쓰면 작품으로 바로 가는 것처럼 읽힌다).

### D-10. 라프텔은 "찾기" 버튼으로만 쓴다. 제공 여부 판정에는 참여하지 않는다

TMDB/JustWatch 국내 제공처에 라프텔 정보가 없다(docs/54: 라프텔은 검색 링크로만). 그래서 라프텔은 `matchable: false`다.

- 효과는 하나다. 애니 상세에서 **확인된 내 OTT가 없을 때** 히어로에 "라프텔에서 찾기" 버튼을 낸다. 링크는 지금 보러가기 카드가 쓰는 라프텔 검색 주소(`createLaftelSearchLink`)다.
- 문구는 "보기"가 아니라 "찾기"다. 제공 여부를 모르기 때문이다(채택 기준 4).
- 확인된 내 OTT(예: 넷플릭스)가 있으면 그쪽이 우선이다.
- 보러가기 카드의 초기 탭·정렬·"내 OTT" 표시·"내 OTT에 없음" 안내는 라프텔을 무시한다. 카드 맨 아래 "라프텔에서 찾아보기" 줄은 지금 그대로다.

### D-11. 검색·추천 화면과 홈 화면은 바꾸지 않는다

추천 카드에 "내 OTT" 글자를 붙이는 것은 채택 기준 2(단계가 줄어든다)를 만족하지 못해 제외했다. 홈 타일의 OTT 버튼도 이득이 작아 제외했다(5장). `app/search.tsx`, `src/utils/recommendationPresentation.ts`, 추천 카드 컴포넌트, `app/(tabs)/index.tsx`, `src/components/home/`은 **수정하지 않는다.**

### D-12. 기능 플래그 `SUBSCRIBED_OTT_FEATURES_ENABLED = true`

`src/constants/features.ts`에 추가한다. `false`면 프로필 행·설정 화면·등록 안내·조회가 모두 꺼지고 화면은 지금과 같다. 순수 함수는 플래그를 보지 않는다(훅이 빈 배열을 넘긴다).

> D-N은 임의로 바꾸지 않는다. 바꿔야 한다고 판단되면 구현하지 말고 이유를 보고한다.

---

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| 추천 카드에 "내 OTT: 넷플릭스" 표시 | 글자만 바뀌고 누르는 횟수가 그대로다(채택 기준 2). 추천 화면을 건드리는 위험만 생긴다 |
| 홈 이어보기 타일에서 OTT 바로 열기 | 이번 수정 뒤 "타일 → 히어로 버튼" 두 번이면 된다. 한 번을 더 줄이려면 폭 106px 타일(`getHomeLayout(375).posterWidth`)에 아이콘만 있는 버튼을 얹어야 하고(어느 OTT인지 글자로 못 보여 줌), 타일마다 제공처를 미리 알아야 한다(호출이 늘거나 기기별 기억이 필요). 웹은 조회를 기다린 뒤 새 창을 열면 팝업 차단에 걸린다. 이득에 비해 복잡하다 |
| 보러가기 행에 "내 OTT" 표시만 하고 히어로 버튼은 생략 | 좁은 화면에서 스크롤이 그대로 남는다. 이번 작업의 가장 큰 이득이 사라진다 |
| 구독 등록 없이 첫 번째 정액제 제공처로 히어로 버튼 | 가입하지 않은 곳으로 보낼 수 있다(채택 기준 4) |
| 사용자가 누른 제공처를 자동으로 "내 OTT"로 기억 | 설정이 필요 없지만, 한 번 눌러 본 곳이 내 OTT가 되어 틀릴 수 있고 되돌릴 화면이 결국 필요하다. 웹·앱이 따로 기억한다 |
| 기기에만 저장(Zustand persist) | 웹과 앱에서 각각 다시 설정해야 한다(채택 기준 3) |
| `profiles.search_filters` JSON 안에 넣기 | 검색 필터 저장이 문서를 통째로 덮어쓴다(`serializeSearchFilters`). 두 기능이 서로의 값을 지울 수 있다 |
| 별도 테이블 `user_subscribed_otts` | 값이 최대 10개인 집합 하나다. 조인·RLS 정책을 새로 만들 이유가 없다 |
| "저장" 버튼 + 이탈 확인 | D-6. 단계가 늘고 스택 헤더 뒤로가기에 이탈 확인을 걸어야 한다 |
| 저장 중 칩 전체 잠금 | 처음 설정할 때 3~4개를 연달아 고르는 동작이 매번 끊긴다(UI-4.5) |
| 라프텔 줄에 "내 OTT" 표시만 붙이기 | 표시뿐이고 단계가 줄지 않는다. 히어로 "찾기" 버튼으로 대신한다(D-10) |
| 라프텔을 "볼 수 있음"으로 표시 | 제공 정보가 없다. 확인하지 못한 것을 확신처럼 보여 주게 된다(채택 기준 4) |
| OTT 작품 직행 주소 만들기 | D-9. 주소 규칙을 추측하면 404가 난다(디즈니+ 전례: `_shared/watchProviders.ts:112` 주석) |
| `pickInitialWatchCategory`에 인자 추가 | `watchProviderDisplay.ts`와 새 유틸이 서로 import하게 된다. 새 함수가 기존 함수를 호출하는 한 방향으로 둔다 |
| 종료 예정작·랭킹·키노라이츠 지수·컬렉션·예고편·알림 | 단계를 줄이는 개선이 아니라 새 정보·콘텐츠 기능이다. 이번 채택 기준의 대상이 아니다 |

---

## 6. 계약 (타입 · 판정 순서)

### 6.1 `src/utils/subscribedOtt.ts` (새 파일, 순수 함수)

```ts
import type { WatchProviderCategory, WatchProvidersByCategory } from "@/types/watchProviders";
import { KR_OTT_PROVIDERS } from "../../supabase/functions/_shared/watchProviders";
import { DISNEY_PLUS_HOME_URL, normalizeWatchProviderLink, pickInitialWatchCategory } from "./watchProviderDisplay";

export const LAFTEL_OTT_GROUP = "laftel";

export interface SubscribableOtt { group: string; name: string; matchable: boolean }

/** KR_OTT_PROVIDERS의 group 첫 등장 순서·그 묶음의 첫 이름(matchable true) + 마지막에 라프텔(matchable false). */
export const SUBSCRIBABLE_OTTS: readonly SubscribableOtt[];

export function normalizeSubscribedOtts(value: unknown): string[];
export function toggleSubscribedOtt(current: readonly string[], group: string): string[];
export function ottGroupOfProviderId(providerId: number): string | null;
export function isSubscribedProvider(providerId: number, category: WatchProviderCategory, subscribed: readonly string[]): boolean;
export function sortProvidersBySubscription<T extends { provider_id: number }>(
  providers: readonly T[], category: WatchProviderCategory, subscribed: readonly string[]
): T[];
export function pickInitialWatchCategoryForSubscription(
  providers: WatchProvidersByCategory, subscribed: readonly string[]
): WatchProviderCategory;

export interface SubscribedWatchAction {
  kind: "provider" | "laftel";
  providerId: number | null;   // laftel이면 null
  providerName: string;
  link: string;
  label: string;
}
export function pickSubscribedWatchAction(input: {
  providers: WatchProvidersByCategory;
  subscribed: readonly string[];
  laftelSearchUrl?: string | null;
}): SubscribedWatchAction | null;

export function subscribedOttAvailabilityNote(input: {
  providers: WatchProvidersByCategory; subscribed: readonly string[];
}): string | null;

export function describeSubscribedOtts(subscribed: readonly string[]): string;

export function nextSubscribedOttWrite(input: {
  inFlight: readonly string[] | null; desired: readonly string[]; saved: readonly string[];
}): string[] | null;

export type SubscribedOttSaveState = "idle" | "saving" | "saved" | "error";
export function subscribedOttSaveStatusText(state: SubscribedOttSaveState): string | null;

export const SUBSCRIBED_OTT_COPY: {
  readonly screenTitle: "구독 중인 OTT";
  readonly description: "구독 중인 서비스를 고르면 작품 상세에서 바로 보러 갈 수 있어요.";
  readonly laftelNote: "라프텔은 제공 정보를 받을 수 없어요. 애니 상세에서 '라프텔에서 찾기' 버튼으로 연결해 드려요.";
  readonly loadFailed: "구독 OTT 설정을 불러오지 못했어요. 다시 시도해 주세요.";
  readonly saveFailed: "구독 OTT를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
  readonly badge: "내 OTT";
  readonly registerHint: "구독 중인 OTT를 등록하면 작품 상세에서 바로 보러 갈 수 있어요.";
  readonly registerAction: "구독 OTT 등록";
  readonly notAvailable: "구독 중인 OTT에서는 아직 제공 정보를 찾지 못했어요.";
  readonly unset: "미설정";
};
```

`SUBSCRIBABLE_OTTS`의 기대 값(이 순서·이 이름):

| group | name | matchable |
|-------|------|-----------|
| netflix | 넷플릭스 | true |
| tving | 티빙 | true |
| coupang | 쿠팡플레이 | true |
| wavve | 웨이브 | true |
| disney | 디즈니+ | true |
| watcha | 왓챠 | true |
| apple | Apple TV+ | true |
| prime | 프라임 비디오 | true |
| crunchyroll | 크런치롤 | true |
| laftel | 라프텔 | false |

판정 규칙:

1. **`normalizeSubscribedOtts`** — 배열이 아니면 `[]`. 문자열 항목만 `trim().toLowerCase()` 한 뒤 `SUBSCRIBABLE_OTTS`에 있는 키만 남긴다. 중복을 없애고 **`SUBSCRIBABLE_OTTS` 순서**로 돌려준다.
2. **`toggleSubscribedOtt`** — `current`를 정규화한 뒤, `group`이 있으면 빼고 없으면 넣는다. 알 수 없는 `group`이면 정규화한 `current`를 그대로 돌려준다.
3. **`ottGroupOfProviderId`** — `KR_OTT_PROVIDERS`에서 `id`가 같은 항목의 `group`. 없거나 숫자가 아니면 `null`. 라프텔 키는 돌려주지 않는다.
4. **`isSubscribedProvider`** — `category`가 `flatrate` 또는 `free`이고, `ottGroupOfProviderId(providerId)`가 정규화한 `subscribed`에 들어 있으면 참(D-4).
5. **`sortProvidersBySubscription`** — 구독한 제공처를 앞으로 모은다. 두 무리 안에서는 입력 순서를 유지한다(안정 정렬). 입력 배열을 바꾸지 않고 새 배열을 돌려준다. `rent`·`buy`이거나 구독이 비면 입력 순서 그대로(새 배열).
6. **`pickInitialWatchCategoryForSubscription`** — ① `flatrate`에 구독한 제공처가 있으면 `"flatrate"` ② 아니면 `free`에 있으면 `"free"` ③ 둘 다 아니면 기존 `pickInitialWatchCategory(providers)`.
7. **`pickSubscribedWatchAction`**
   1. `flatrate` → `free` 순서로, 각 분류의 입력 순서대로 훑어 `isSubscribedProvider`가 참이고 `normalizeWatchProviderLink(provider.link)`가 null이 아닌 첫 제공처를 고른다. 있으면 `{ kind: "provider", providerId, providerName: provider_name, link: 정규화된 링크, label }`. `label`은 링크가 `DISNEY_PLUS_HOME_URL`이면 `` `${provider_name} 열기` ``, 아니면 `` `${provider_name}에서 보기` ``.
   2. 1이 없고, 정규화한 `subscribed`에 `LAFTEL_OTT_GROUP`이 있고, `laftelSearchUrl`이 빈 문자열이 아닌 문자열이면 `{ kind: "laftel", providerId: null, providerName: "라프텔", link: laftelSearchUrl, label: "라프텔에서 찾기" }`.
   3. 둘 다 아니면 `null`.
8. **`subscribedOttAvailabilityNote`** — 다음을 모두 만족하면 `SUBSCRIBED_OTT_COPY.notAvailable`, 아니면 `null`: ① 정규화한 `subscribed`에 `matchable`인 키가 하나 이상 ② 네 분류 중 하나라도 제공처가 있음 ③ `flatrate`·`free` 어디에도 구독한 제공처가 없음.
9. **`describeSubscribedOtts`** — 정규화 후 0개면 `"미설정"`, 아니면 이름을 `SUBSCRIBABLE_OTTS` 순서로 앞 2개까지 `" · "`로 잇고 나머지는 `` ` 외 ${n}` ``. 라프텔도 이름에 포함한다.
10. **`nextSubscribedOttWrite`** — ① `inFlight`가 null이 아니면 `null`(기다림) ② `desired`와 `saved`를 정규화해 같은 집합이면 `null` ③ 아니면 정규화한 `desired`.
11. **`subscribedOttSaveStatusText`** — `idle` → `null`, `saving` → `"저장하는 중이에요."`, `saved` → `"저장했어요."`, `error` → `SUBSCRIBED_OTT_COPY.saveFailed`.

### 6.2 서비스·훅

`src/services/subscribedOtts.ts` (새 파일)

```ts
export async function getSubscribedOtts(userId: string, signal?: AbortSignal): Promise<string[]>;
export async function saveSubscribedOtts(groups: readonly string[]): Promise<string[]>;
```

- `getSubscribedOtts`: `supabase.from("profiles").select("subscribed_otts").eq("id", userId).maybeSingle()`. 오류면 `throw new Error(error.message)`(화면에는 내보내지 않는다 — 훅과 화면이 고정 문구를 쓴다). 결과는 `normalizeSubscribedOtts(data?.subscribed_otts)`. 행이 없으면 `[]`.
- `saveSubscribedOtts`: `getSessionUserId()`(`src/services/sessionUser.ts`)로 사용자 id를 얻는다. 없으면 `throw new Error("로그인이 필요합니다")`(기존 서비스와 같은 문구). `upsert({ id: userId, subscribed_otts: normalizeSubscribedOtts(groups) }, { onConflict: "id" }).select("subscribed_otts").single()`. 반환은 정규화한 저장 값. `saveSearchFilterPreferences`(`src/services/searchFilterPreferences.ts:12-18`)와 같은 형태다.

`src/hooks/useSubscribedOtts.ts` (새 파일)

```ts
export function useSubscribedOtts(): {
  groups: string[];          // 조회 성공 값. 로딩·오류·로그아웃·플래그 꺼짐이면 []
  isReady: boolean;          // 조회 성공
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  saveState: SubscribedOttSaveState;
  setGroups: (desired: readonly string[]) => void;   // 설정 화면 전용
};
```

- 조회 키: `queryKeys.profile.subscribedOtts(userId)` = `["profile", userId, "subscribed-otts"]`. `enabled: SUBSCRIBED_OTT_FEATURES_ENABLED && Boolean(userId)`. 옵션: `staleTime: 5 * 60_000`, `retry: 1`, `refetchOnWindowFocus: false`. 사용자 id는 `useAuthStore((state) => state.user?.id ?? null)`.
- `groups`는 값이 같으면 같은 배열 참조를 유지한다(빈 배열 기본값은 모듈 상수 하나를 쓴다). 작품 상세의 `useEffect` 의존값이 매 렌더마다 바뀌지 않게 하기 위해서다.
- `setGroups(desired)`: ① `queryClient.setQueryData(key, normalizeSubscribedOtts(desired))`로 즉시 반영 ② `nextSubscribedOttWrite`가 값을 주면 `saveSubscribedOtts` 호출(`saveState = "saving"`) ③ 끝나면 저장된 값을 기억하고, 그 사이 화면 값이 달라졌으면 ②를 다시 한 번 ④ 더 보낼 것이 없으면 `saveState = "saved"`.
- 실패: 캐시를 마지막 저장 성공 값(없으면 조회 값)으로 되돌리고 `saveState = "error"`, `addToast(SUBSCRIBED_OTT_COPY.saveFailed, "error")`. 대기 중이던 값은 버린다(D-7).
- 계정이 바뀌면(사용자 id 변경) 진행 상태를 초기화한다. 이전 계정의 응답을 새 계정 캐시에 쓰지 않는다(키에 사용자 id가 있다).

---

## 7. 데이터 모델 / SQL

새 파일 `supabase/migrations/20261117062800_profile_subscribed_otts.sql` (전문):

```sql
-- docs/74: OTT services the account subscribes to. Values are provider group keys
-- (netflix, tving, ...) validated by the app; unknown keys are ignored when read.
-- Existing profiles SELECT/INSERT/UPDATE policies all require auth.uid() = id.
ALTER TABLE public.profiles
  ADD COLUMN subscribed_otts TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD CONSTRAINT profiles_subscribed_otts_limit CHECK (cardinality(subscribed_otts) <= 20);

COMMENT ON COLUMN public.profiles.subscribed_otts IS
  'Subscribed OTT group keys (docs/74). Empty array means not set. Protected by profiles own-user RLS.';
```

- RLS 정책·트리거·함수는 추가하지 않는다. `handle_new_user` 트리거는 칸을 지정해 넣으므로 기본값 `'{}'`이 들어간다.
- 파일은 작성만 한다. 적용은 사람이 한다. 적용 도구가 다른 버전 번호를 만들면 docs/73 때처럼 파일명을 그 번호에 맞춘다(보고 항목 8).

`src/types/database.ts`의 `profiles`(423-448행)에 추가:

- `Row`: `subscribed_otts: string[]`
- `Insert`, `Update`: `subscribed_otts?: string[]`

---

## 8. 화면 명세

UI 규칙은 `docs/00_ui_style_rules.md`(UI-1~UI-13)를 따른다. 아래는 화면 고유 값과 다른 점만 적는다.

### 8.1 프로필 탭 — "계정" 카드에 행 추가

`src/components/profile/AccountSection.tsx`에 선택 속성 두 개를 추가한다.

```ts
subscribedOttSummary?: string | undefined;        // describeSubscribedOtts 결과
onOpenSubscribedOtts?: (() => void) | undefined;  // 없으면 행을 그리지 않는다
```

- 행 위치: 카드의 **첫 행**("추천에서 제외한 작품"보다 위).
- 구성: `Ionicons "tv-outline"`(20, `colors.textMuted`) + 라벨 "구독 중인 OTT" + 오른쪽 메타(`subscribedOttSummary`, `numberOfLines={1}`, 기존 `styles.meta`) + `chevron-forward`.
- 구분선: 위에 다른 행이 있는 행에만 `styles.divider`가 붙도록 조건을 고친다(지금은 로그아웃 행이 `onOpenExclusions` 유무만 본다, 45행).
- `app/(tabs)/profile.tsx`(293-303행): `SUBSCRIBED_OTT_FEATURES_ENABLED`일 때 `onOpenSubscribedOtts={() => router.push("/settings/subscribed-otts")}`, `subscribedOttSummary={describeSubscribedOtts(subscribedOtts.groups)}`를 넘긴다.

### 8.2 설정 화면 `app/settings/subscribed-otts.tsx` (새 파일)

- `app/_layout.tsx` 53행 아래에 `<Stack.Screen name="settings/subscribed-otts" options={{ title: "구독 중인 OTT" }} />` 추가.
- 플래그가 꺼져 있으면 `<Redirect href="/profile" />`.
- 골격: `ScrollView` → 컨테이너 `{ width: "100%", maxWidth: FORM_CONTENT_MAX_WIDTH(720), alignSelf: "center" }`, 좌우 여백 `Math.max(getHomeLayout(width).gutter, insets.left/right)`, 위 `spacing.lg`, 아래 `24 + insets.bottom`. 레이아웃 함수는 새로 만들지 않는다(칩은 내용 폭으로 줄바꿈한다. UI-2.5의 픽셀 폭 격자 대상이 아니다).
- 내용: `DashboardPanel title="구독 중인 OTT"` 안에 순서대로
  1. 설명 `SUBSCRIBED_OTT_COPY.description` (`typography.body`, `colors.textMuted`)
  2. 칩 묶음(`flexDirection: "row"`, `flexWrap: "wrap"`, `gap: spacing.sm`): `SUBSCRIBABLE_OTTS` 10개
  3. 저장 상태 한 줄: `subscribedOttSaveStatusText(saveState)` (`typography.caption`, 오류면 `colors.danger`, 그 외 `colors.textMuted`, `accessibilityLiveRegion="polite"`). `null`이면 글자는 그리지 않되 `minHeight: 16`을 유지해 칩이 흔들리지 않게 한다
  4. 라프텔 안내 `SUBSCRIBED_OTT_COPY.laftelNote` (`typography.caption`, `colors.textSubtle`)
- 칩: 높이 44, `paddingHorizontal: spacing.lg`, `radius.pill`, 테두리 `hairlineWidth`.
  - 선택: 배경 `colors.primarySoft`, 테두리 `colors.primary`, 글자 `colors.primary`, 앞에 `Ionicons "checkmark"`(16)
  - 미선택: 배경 `colors.surface`, 테두리 `colors.border`, 글자 `colors.text`
  - `accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`, `accessibilityLabel`은 이름(예: "넷플릭스")
  - 누르면 `setGroups(toggleSubscribedOtt(groups, group))`
- 상태(한 번에 하나, UI-6.4):
  - 로딩: 칩 자리에 `LoadingSkeleton`
  - 조회 오류: `ErrorState message={SUBSCRIBED_OTT_COPY.loadFailed} onRetry={refetch}`. 칩을 그리지 않는다(읽지 못한 값 위에 덮어쓰지 않게)
  - 성공: 위 내용

### 8.3 작품 상세 보러가기 카드 `WatchProviderList`

속성 세 개를 추가한다(모두 선택, 기본값은 지금 동작).

```ts
subscribedOtts?: readonly string[];      // 기본 []
subscribedOttsReady?: boolean;           // 기본 false
onOpenOttSettings?: (() => void) | null; // 기본 null
```

- **초기 탭**(43-49행): `pickInitialWatchCategory(providers)` 두 곳을 `pickInitialWatchCategoryForSubscription(providers, subscribedOtts)`로 바꾼다. 다시 계산하는 조건(`useEffect` 의존값 문자열)에 구독 목록을 `subscribedOtts.join(",")`으로 더한다. 사용자가 탭을 직접 고른 뒤에는 제공처 구성이나 구독 목록이 바뀔 때만 다시 계산한다(지금 주석의 의도 유지).
- **목록 순서**: `activeProviders`를 `sortProvidersBySubscription(providers[selectedCategory], selectedCategory, subscribedOtts)`로 만든다.
- **"내 OTT" 표시**: `isSubscribedProvider(provider.provider_id, selectedCategory, subscribedOtts)`가 참인 행의 제공처 이름 오른쪽에 알약 표시. 글자 `SUBSCRIBED_OTT_COPY.badge`, `typography.micro`, 배경 `colors.primary`, 글자색 `colors.surface`, `radius.pill`, `paddingHorizontal: spacing.sm`. 그 행의 `accessibilityLabel`은 `` `${provider_name}, 내 OTT, ${service_type_label}` ``(구독 아닌 행은 지금처럼 라벨을 따로 주지 않는다).
- **내 OTT에 없음 안내**: 목록 아래, "마지막 확인" 줄 위에 `subscribedOttAvailabilityNote({ providers, subscribed: subscribedOtts })`가 문자열이면 `styles.scopeHint`로 한 줄.
- **등록 안내**: `subscribedOttsReady && subscribedOtts.length === 0 && hasAnyProvider && onOpenOttSettings`일 때 같은 자리에 `SUBSCRIBED_OTT_COPY.registerHint`(`styles.scopeHint`) + 버튼 `SUBSCRIBED_OTT_COPY.registerAction`(`retryButton`과 같은 모양, `accessibilityRole="button"`). 누르면 `onOpenOttSettings()`.
- 맨 아래 "라프텔에서 찾아보기" 줄은 바꾸지 않는다(D-10).
- 이 카드는 어두운 배경(`colors.surfaceDark`)이다. 기존 토큰만 쓴다.

`app/content/[id].tsx`(402-405행 `case "providers"`)에서 `subscribedOtts={subscribedOtts.groups}`, `subscribedOttsReady={subscribedOtts.isReady}`, `onOpenOttSettings={SUBSCRIBED_OTT_FEATURES_ENABLED ? () => router.push("/settings/subscribed-otts") : null}`를 넘긴다.

### 8.4 작품 상세 히어로 버튼

새 컴포넌트 `src/components/content/WatchNowButton.tsx`:

```ts
interface WatchNowButtonProps { label: string; icon: "play" | "search"; onPress: () => void }
```

- 모양: 높이 44, `paddingHorizontal: spacing.lg`, `radius.pill`, 배경 `colors.surface`, 테두리 `hairlineWidth` `colors.primary`, `alignSelf: "flex-start"`, 가로 정렬 + `gap: 6`. 아이콘 `Ionicons`(16, `colors.primary`), 글자 `typography.label` `colors.primary`. 눌림 시 배경 `colors.surfaceMuted`.
- `accessibilityRole="link"`, `accessibilityLabel={label}`.

`app/content/[id].tsx`:

- 계산(`view`가 있는 구간, 렌더 전):
  ```ts
  const laftelSearchUrl = view.contentType === "anime" ? createLaftelSearchLink(watchProviderTitle, watchProviderSeason) : null;
  const canShowWatchAvailability = canDisplayWatchProviderAvailability({
    response: watchProviders.data, seasonNumber: watchProviderSeason, requireSeasonMatch: requireWatchProviderSeason
  });
  const watchAction = watchProviders.isLoading ? null : pickSubscribedWatchAction({
    providers: canShowWatchAvailability ? watchProviders.data.providers : emptyWatchProviders,
    subscribed: subscribedOtts.groups,
    laftelSearchUrl
  });
  ```
  `emptyWatchProviders`는 `src/services/watchProviders.ts`의 기존 export다. 405행의 `laftelSearchUrl={…}`은 위 상수를 그대로 넘기도록 바꾼다(값은 같다).
- 위치: 히어로 자식 중 `ContentActionBar` 블록(424-428행) **다음**, "작품 정보 다시 불러오기" 버튼(429행) **앞**. `watchAction`이 있을 때만 그린다. 라이브러리에 없는 검색 결과 상세에서도 나온다.
- `icon`은 `watchAction.kind === "laftel"`이면 `"search"`, 아니면 `"play"`.
- 누르면 `Linking.openURL(watchAction.link)`, 실패하면 `addToast("시청 플랫폼을 열지 못했어요. 잠시 후 다시 시도해 주세요.", "error")`(보러가기 카드와 같은 문구).

---

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 저장 값이 배열이 아님(null·문자열·객체·숫자) | `[]` | T-1 |
| E-2 | 알 수 없는 키, 대문자, 앞뒤 공백, 중복, 문자열 아닌 항목 | 아는 키만, 소문자, 중복 없이, 표준 순서 | T-2, T-3 |
| E-3 | 알 수 없는 키를 토글 | 값이 바뀌지 않는다 | T-5 |
| E-4 | 넷플릭스 광고형(1796) | 넷플릭스 구독으로 인정 | T-6, T-7 |
| E-5 | 구독한 회사가 대여·구매 분류에만 있음 | "내 OTT" 표시·정렬·버튼 없음 | T-8, T-10, T-14, T-19 |
| E-6 | 구독한 곳이 무료 탭에만 있고 정액제 탭에는 다른 곳이 있음 | 무료 탭이 먼저 열린다 | T-11 |
| E-7 | 구독한 곳이 어디에도 없음 | 초기 탭은 기존 규칙, "구독 중인 OTT에서는 아직 …" 안내 | T-13, T-20 |
| E-8 | 라프텔만 구독 | 제공처 판정에 참여하지 않는다. "없음" 안내도 없다. 요약에는 "라프텔" | T-21, T-24 |
| E-9 | 구독 제공처의 링크가 없거나 주소 형식이 아님(`normalizeWatchProviderLink`가 null) | 다음 후보로. 후보가 없으면 버튼 없음 | T-17 |
| E-10 | 디즈니+ | 문구 "디즈니+ 열기"(홈으로 연결) | T-18 |
| E-11 | 제공처가 하나도 없음 / 구독 미설정 | 버튼 없음, 안내 없음 | T-15, T-21 |
| E-12 | 라프텔 구독 + 애니 + 확인된 내 OTT 없음 | "라프텔에서 찾기" 버튼 | T-25, T-28 |
| E-13 | 라프텔과 넷플릭스를 구독, 넷플릭스에 있음 | "넷플릭스에서 보기"가 우선 | T-26 |
| E-14 | 라프텔 구독이지만 애니가 아님(라프텔 주소 없음), 또는 라프텔을 구독하지 않음 | 라프텔 버튼 없음 | T-27 |
| E-15 | 저장 중에 다시 토글 | 요청을 겹쳐 보내지 않는다. 끝난 뒤 최신 값으로 한 번만 | T-29, T-32 |
| E-16 | 화면 값이 저장된 값과 같아짐(켰다가 바로 끔) | 추가 저장 없음 | T-30 |
| E-17 | 시즌이 맞지 않는 응답(표시 불가) | 제공처 버튼 없음(라프텔 구독 + 애니면 "라프텔에서 찾기"). 보러가기 카드는 기존 안내 | M-4 |
| E-18 | 마이그레이션 적용 전 또는 조회 실패 | 상세는 지금과 같음. 설정 화면만 오류 + 다시 시도 | M-6 |
| E-19 | 저장 실패 | 마지막 저장 값으로 되돌림 + 오류 토스트 + 상태 줄 | M-7 |
| E-20 | 다른 계정으로 로그인 | 이전 계정의 구독이 보이지 않는다 | M-8 |
| E-21 | 구독 3개 이상의 프로필 요약 | "넷플릭스 · 티빙 외 1" | T-23 |
| E-22 | 제공처 조회가 진행 중 | 히어로 버튼을 그리지 않는다(문구가 바뀌며 깜빡이지 않게) | M-2 |

---

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 전부 `src/utils/subscribedOtt.test.ts`(새 파일)에 둔다. 테스트 이름은 `74 T-N: …` 형식. 기존 테스트 파일은 수정하지 않는다.

아래에서 제공처는 `{ provider_id, provider_name, link }`만 적는다(나머지 칸은 테스트 도우미로 채운다). `N` = `https://www.netflix.com/search?q=x`, `T` = `https://www.tving.com/search?keyword=x`, `L` = `https://laftel.net/search?keyword=x`.

| ID | 입력 | 기대 |
|----|------|------|
| T-1 | `normalizeSubscribedOtts`에 `null`, `undefined`, `"netflix"`, `{}`, `3` | 모두 `[]` |
| T-2 | `normalizeSubscribedOtts(["TVING", " netflix ", "netflix", "hbo", 3, null])` | `["netflix", "tving"]` |
| T-3 | `normalizeSubscribedOtts(["laftel", "watcha", "netflix"])` | `["netflix", "watcha", "laftel"]` |
| T-4 | `SUBSCRIBABLE_OTTS` | 6.1 표의 10개와 순서·이름·`matchable`이 같다 |
| T-5 | `toggleSubscribedOtt(["netflix"], "tving")` / `(["netflix","tving"], "netflix")` / `(["netflix"], "hbo")` | `["netflix","tving"]` / `["tving"]` / `["netflix"]` |
| T-6 | `ottGroupOfProviderId`에 8, 1796, 1883, 2, `NaN` | `"netflix"`, `"netflix"`, `"tving"`, `null`, `null` |
| T-7 | `isSubscribedProvider(8,"flatrate",["netflix"])`, `(1796,"free",["netflix"])`, `(1883,"flatrate",["netflix"])` | `true`, `true`, `false` |
| T-8 | `isSubscribedProvider(8,"rent",["netflix"])`, `(8,"buy",["netflix"])` | `false`, `false` |
| T-9 | `sortProvidersBySubscription([1883, 8, 356], "flatrate", ["wavve","netflix"])` (번호는 provider_id) | provider_id 순서 `[8, 356, 1883]` |
| T-10 | 같은 입력에 분류 `"rent"`, 그리고 분류 `"flatrate"` + 구독 `[]` | 둘 다 `[1883, 8, 356]`. 반환 배열은 입력과 다른 참조이고 입력 배열은 그대로 |
| T-11 | `pickInitialWatchCategoryForSubscription({ flatrate:[1883], free:[1796] }, ["netflix"])`, 같은 제공처에 구독 `[]` | `"free"`, `"flatrate"` |
| T-12 | `{ flatrate:[8], free:[1796] }`, `["netflix"]` | `"flatrate"` |
| T-13 | `{ rent:[8] }`(나머지 빔), `["tving"]` | `"rent"` |
| T-14 | `{ free:[1883], rent:[8] }`, `["netflix"]` | `"free"` (대여 탭은 구독으로 고르지 않는다) |
| T-15 | `pickSubscribedWatchAction`에 제공처 모두 빔 + `["netflix"]`, 그리고 `{ flatrate:[8 N] }` + `[]` | 둘 다 `null` |
| T-16 | `{ flatrate:[{1883,"티빙",T},{8,"넷플릭스",N}], free:[] }`, `["netflix"]` | `{ kind: "provider", providerId: 8, providerName: "넷플릭스", link: N, label: "넷플릭스에서 보기" }` |
| T-17 | `{ flatrate:[{8,"넷플릭스",null}], free:[{1883,"티빙",T}] }`, `["netflix","tving"]` / 같은 입력에서 티빙 링크도 `null` / 넷플릭스 링크가 `"not a url"`(주소 형식이 아님)이고 티빙 없음 | 티빙 행동(`label: "티빙에서 보기"`) / `null` / `null` |
| T-18 | `{ flatrate:[{337,"디즈니+",DISNEY_PLUS_HOME_URL}] }`, `["disney"]` | `kind: "provider"`, `label: "디즈니+ 열기"`, `link: DISNEY_PLUS_HOME_URL` |
| T-19 | `{ rent:[{8,"넷플릭스",N}] }`, `["netflix"]` | `null` |
| T-20 | `subscribedOttAvailabilityNote`에 `{ flatrate:[1883] }` + `["netflix"]` / `{ flatrate:[8] }` + `["netflix"]` | `"구독 중인 OTT에서는 아직 제공 정보를 찾지 못했어요."` / `null` |
| T-21 | `{ flatrate:[1883] }` + `["laftel"]` / 같은 제공처 + `[]` / 제공처 모두 빔 + `["netflix"]` | 모두 `null` |
| T-22 | `describeSubscribedOtts([])` | `"미설정"` |
| T-23 | `["netflix"]` / `["tving","netflix"]` / `["netflix","tving","wavve"]` | `"넷플릭스"` / `"넷플릭스 · 티빙"` / `"넷플릭스 · 티빙 외 1"` |
| T-24 | `describeSubscribedOtts(["laftel"])` | `"라프텔"` |
| T-25 | `pickSubscribedWatchAction({ providers: 모두 빔, subscribed: ["laftel"], laftelSearchUrl: L })` | `{ kind: "laftel", providerId: null, providerName: "라프텔", link: L, label: "라프텔에서 찾기" }` |
| T-26 | `{ flatrate:[{8,"넷플릭스",N}] }`, `["netflix","laftel"]`, `laftelSearchUrl: L` | 넷플릭스 행동(`kind: "provider"`, `label: "넷플릭스에서 보기"`) |
| T-27 | 제공처 모두 빔 + `["laftel"]` + `laftelSearchUrl`이 `null` / `""` / 생략, 그리고 제공처 모두 빔 + `["netflix"]` + `laftelSearchUrl: L` | 모두 `null` |
| T-28 | `{ flatrate:[{1883,"티빙",T}] }`, `["netflix","laftel"]`, `laftelSearchUrl: L` | 라프텔 행동(`kind: "laftel"`, `link: L`) |
| T-29 | `nextSubscribedOttWrite({ inFlight:["netflix"], desired:["netflix","tving"], saved:[] })` | `null` |
| T-30 | `{ inFlight:null, desired:["tving","netflix"], saved:["netflix","tving"] }` | `null` |
| T-31 | `{ inFlight:null, desired:["tving","netflix","hbo"], saved:["netflix"] }` | `["netflix","tving"]` |
| T-32 | 순서 모의: 저장 값 `[]`. 화면 값 `["netflix"]`로 첫 호출 → 보냄. 진행 중에 화면 값이 `["netflix","tving"]` → `["netflix","tving","wavve"]`로 바뀌며 두 번 더 호출. 첫 저장 완료 후 한 번 호출. 두 번째 완료 후 한 번 호출 | 반환 순서 `["netflix"]`, `null`, `null`, `["netflix","tving","wavve"]`, `null` (실제 저장 2번) |
| T-33 | `subscribedOttSaveStatusText`에 `"idle"`, `"saving"`, `"saved"`, `"error"` | `null`, `"저장하는 중이에요."`, `"저장했어요."`, `"구독 OTT를 저장하지 못했어요. 잠시 후 다시 시도해 주세요."` |

### 수동 확인 표

로그인이 필요한 화면이다. 확인하지 못한 행은 웹/앱을 구분해 사유와 함께 보고한다(UI-13.5). M-6을 뺀 나머지는 마이그레이션 적용 후에만 확인할 수 있다.

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 프로필 → 계정 카드 첫 행 "구독 중인 OTT · 미설정" → 누르면 설정 화면. 칩 10개, 넷플릭스·티빙을 연달아 눌러도 끊기지 않고 "저장했어요." 표시. 뒤로 가면 요약이 "넷플릭스 · 티빙". 새로고침 후에도 유지 |
| M-2 | 웹 1440 | 넷플릭스에 있는 작품 상세: 제공처를 불러오는 동안에는 히어로 버튼이 없다가 "넷플릭스에서 보기"가 나온다. 누르면 새 탭으로 넷플릭스가 열린다. 옆 단 보러가기 카드에서 넷플릭스가 맨 위 + "내 OTT" |
| M-3 | 웹 1440 | 내 OTT에 없는 작품 상세: 히어로 버튼 없음, 보러가기 카드에 "구독 중인 OTT에서는 아직 제공 정보를 찾지 못했어요." |
| M-4 | 웹 1440 | 시즌 제공 정보를 확인하지 못한 애니 후속 시즌 상세: "○○에서 보기" 버튼이 나오지 않는다(다른 시즌 제공처로 버튼을 만들지 않음). 라프텔을 구독으로 등록했다면 "라프텔에서 찾기"가 나오고 라프텔 검색 화면이 열린다 |
| M-5 | 웹 375 | 설정 화면 칩이 줄바꿈되고 넘치지 않는다. 작품 상세 히어로 버튼이 포스터 아래 행동 영역에 나오고, 스크롤 없이 누를 수 있다. 보러가기 행의 "내 OTT" 표시 때문에 제공처 이름이 잘리면 줄임표로 처리된다 |
| M-6 | 웹 1440 | (마이그레이션 적용 **전**) 작품 상세·프로필 통계가 이전과 같게 보인다. 설정 화면은 "구독 OTT 설정을 불러오지 못했어요…" + 다시 시도. 영문 오류 원문이 보이지 않는다 |
| M-7 | 웹 1440 | 개발자 도구로 오프라인 전환 후 칩을 누름: 칩이 원래 상태로 돌아가고 오류 토스트와 상태 줄이 나온다 |
| M-8 | 웹 1440 | 로그아웃 → 다른 계정 로그인: 이전 계정의 구독이 보이지 않는다 |
| M-9 | 웹 1440 | 구독을 모두 해제한 상태의 작품 상세: 보러가기 카드에 등록 안내 + "구독 OTT 등록" 버튼, 누르면 설정 화면 |
| M-10 | 웹 1440 | 검색 탭 추천 카드·검색 결과·홈 이어보기가 이전과 같다(이번 작업이 건드리지 않음) |
| M-11 | 앱(iOS 세로) | M-1 ~ M-3 흐름. 설정 화면 하단이 홈 인디케이터에 가리지 않는다. 글자 크기 1.3배에서 칩·"내 OTT" 표시·히어로 버튼이 잘리지 않는다. 버튼을 누르면 OTT 앱 또는 브라우저가 열린다 |
| M-12 | 앱(iOS 세로) | 라프텔만 구독으로 등록 → 애니 상세 히어로에 "라프텔에서 찾기". 애니가 아닌 작품 상세에는 나오지 않는다 |

---

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/subscribedOtt.ts` | 새 파일. 6.1 계약 |
| `src/utils/subscribedOtt.test.ts` | 새 파일. T-1 ~ T-33 |
| `src/services/subscribedOtts.ts` | 새 파일. 조회·저장(6.2) |
| `src/hooks/useSubscribedOtts.ts` | 새 파일. 조회·직렬 저장(6.2) |
| `src/lib/query.ts` | `queryKeys.profile.subscribedOtts` 추가(75-78행 블록) |
| `src/constants/features.ts` | `SUBSCRIBED_OTT_FEATURES_ENABLED = true` |
| `src/types/database.ts` | `profiles`에 `subscribed_otts`(423-448행) |
| `supabase/migrations/20261117062800_profile_subscribed_otts.sql` | 새 파일. 7장 SQL(작성만) |
| `app/settings/subscribed-otts.tsx` | 새 파일. 설정 화면(8.2) |
| `app/_layout.tsx` | `Stack.Screen` 한 줄(53행 아래) |
| `src/components/profile/AccountSection.tsx` | 행 추가·구분선 조건(8.1) |
| `app/(tabs)/profile.tsx` | 훅 연결·속성 전달(293-303행) |
| `src/components/content/WatchProviderList.tsx` | 속성 3개·초기 탭·정렬·표시·안내(8.3) |
| `src/components/content/WatchNowButton.tsx` | 새 파일(8.4) |
| `app/content/[id].tsx` | 훅 연결·히어로 버튼·보러가기 속성(8.3, 8.4) |
| `docs/development_next_steps.md` | 맨 위에 이 작업의 검증 기록 항목 추가 |
| `docs/README.md` | 74행 점검 상태 갱신 |

---

## 12. 범위 밖

이번에 건드리지 않는다. "김에" 고치지 않는다.

- **Edge Function 전부와 `supabase/functions/_shared/`.** import만 한다. 배포가 필요한 변경은 없다.
- **검색·추천 화면 전체**(`app/search.tsx`, `src/utils/recommendationPresentation.ts`, 추천 카드 컴포넌트). D-11.
- **홈 화면**(`app/(tabs)/index.tsx`, `ContinueWatchingTile`, `PosterTile`). D-11, 5장 "홈 이어보기 타일" 기각 사유.
- **`src/utils/watchProviderDisplay.ts`, `watchProviderLookup.ts`, `useWatchProviders.ts`.** 조회 정책·캐시 키·시즌 판정은 그대로다.
- **`ContentActionBar`, `ContentDetailHero`.** 히어로 버튼은 `app/content/[id].tsx`에서 자식으로 추가한다.
- **`getProfile`의 select**(D-5).
- **`app/settings/excluded-recommendations.tsx`의 기존 `Alert.alert`·숫자 글꼴.** 이 화면을 본뜨지 않는다(UI 규칙 위반이 남아 있다). 고치는 것은 별도 작업.
- **키노라이츠의 나머지 기능**(랭킹·종료 예정작·지수·컬렉션·예고편·알림). 1.1의 채택 기준에 들지 않는다. 후속 과제로 등록하지 않는다.

---

## 13. 확실하지 않음 — 별도 검증 필요

| # | 가정 | 확인 방법 |
|---|------|-----------|
| U-1 | 키노라이츠 로그인 뒤 화면(구독 OTT 설정 위치 등)은 직접 보지 못했다. 앱 설명과 버전 기록 문구만 근거다 | 이 명세의 설계는 그 화면 구성에 의존하지 않는다. 비교 결론(C-1 ~ C-3)은 공개 화면과 SceneNote 코드로 확인했다 |
| U-2 | TMDB 국내 제공처에 라프텔이 없다는 것은 docs/54의 결론을 따랐다. 이번에 다시 실측하지 않았다 | `get-watch-providers` 응답에서 라프텔 번호가 보이면 `KR_OTT_PROVIDERS` 추가를 별도 명세로(재배포 필요). 그때 D-10을 다시 정한다 |
| U-3 | 운영 DB의 마이그레이션 이력은 `docs/development_next_steps.md` 기준 0001~0022 + 2026-11-16의 3개다. 0023·0024의 운영 적용 여부는 이번에 확인하지 않았다 | 적용 전에 운영 이력을 읽기 전용으로 확인한다. 이 마이그레이션은 0023·0024에 의존하지 않는다 |
| U-4 | iOS에서 OTT 검색 주소가 설치된 OTT 앱으로 열리는지(유니버설 링크)는 OTT마다 다르다 | M-11에서 넷플릭스·티빙으로 확인하고 결과를 기록한다. 브라우저로 열려도 결함이 아니다 |
| U-5 | 좁은 화면에서 줄어드는 스크롤 양은 진행 카드·본 횟수 카드의 높이에 달려 있다. 화면에서 재지 않았다 | M-5에서 "스크롤 없이 히어로 버튼을 누를 수 있는지"로 확인한다 |

---

## 14. Codex 실행 지시

# ROLE & GOAL

너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다.
사용자가 구독 중인 OTT를 계정에 한 번 등록하면, 작품 상세에서 그 OTT로 바로 보러 갈 수 있게 하는 **기능 추가** 작업이다. 앱 코드와 마이그레이션 SQL 파일 1개만 만든다. Edge Function, 검색·추천 화면, 홈 화면은 바꾸지 않는다.

| ID | 고친 뒤 |
|----|---------|
| F-1 | 프로필 → "구독 중인 OTT"에서 고르면 계정에 저장된다 |
| F-2 | 보러가기에서 내 OTT가 맨 앞 + "내 OTT" 표시, 내 OTT가 있는 탭이 먼저 열림, 없으면 없다고 안내 |
| F-3 | 히어로에 "넷플릭스에서 보기" 버튼(볼 수 있을 때만) |
| F-4 | 라프텔 구독자는 애니 상세 히어로에 "라프텔에서 찾기" 버튼(확인된 내 OTT가 없을 때) |

# READ FIRST

1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙. 토큰·터치·접근성·`Alert` 금지·오류 문구·검증 절차는 이 문서를 따른다.
2. `docs/74_subscribed_ott_spec.md` — 이 명세. 4장 D-1 ~ D-12, 6장 계약, 8장 화면, 9장 E-N, 10장 테스트 표.
3. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
4. `docs/54_anime_sequel_watch_providers_fixes_spec.md` 15~16장 — 선택 시즌 제공처만 표시하는 규칙. 히어로 버튼이 이 규칙을 지켜야 한다(D-8).
5. `supabase/functions/_shared/watchProviders.ts` 22-34행 — `KR_OTT_PROVIDERS`. **읽기만 한다.**
6. `src/components/content/WatchProviderList.tsx`, `src/utils/watchProviderDisplay.ts`, `app/content/[id].tsx`, `src/services/searchFilterPreferences.ts`(같은 저장 형태의 선례).

# 시작 상태 (반드시 유지)

- `npm test` 기준선: **1769개 통과, 실패 0** (2026-11-17, `519ddc7`, Node 24).
- 이 기기의 기본 `node`(Homebrew 26.7.0)는 `libsimdjson` 오류로 실행되지 않는다. 명령 앞에 `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`를 붙인다. 프로젝트 의존성·환경 파일은 바꾸지 않는다.
- 구독을 설정하지 않은 사용자에게는 작품 상세·프로필 통계가 지금과 똑같이 보여야 한다. 검색·추천·홈은 누구에게나 지금과 같다.
- 시작할 때 `git status --short`를 기록한다. 다른 작업의 변경이 있으면 보존한다.

# 바꾸면 안 되는 설계 결정

- **D-5 (최우선).** 구독 정보를 못 읽으면(칸 없음·오류·로딩) 미설정으로 동작한다. `getProfile`의 select에 `subscribed_otts`를 넣지 않는다. 어기면 마이그레이션 적용 전에 프로필 화면 전체가 깨진다.
- **D-8.** "○○에서 보기" 버튼은 `canDisplayWatchProviderAvailability`가 참인 응답에서만 만든다. 어기면 다른 시즌의 제공처로 "보기" 버튼이 생긴다(docs/54에서 고친 결함의 재발). 제공처 조회 중에는 버튼을 그리지 않는다.
- **D-10.** 라프텔은 `matchable: false`. 문구는 "라프텔에서 찾기"(보기 아님). 제공처 판정·초기 탭·정렬·"없음" 안내에 참여시키지 않는다. 확인된 내 OTT가 있으면 그쪽이 우선이다.
- **D-4.** "내 OTT" 표시·정렬·버튼은 정액제·무료 분류에만.
- **D-11.** `app/search.tsx`, `src/utils/recommendationPresentation.ts`, 추천 카드 컴포넌트, 홈 화면을 **바꾸지 않는다.**
- **D-2.** `supabase/functions/` 아래 파일은 **바꾸지 않는다.** `KR_OTT_PROVIDERS`는 import만 한다.
- **D-6 / D-7.** 저장 버튼 없음, 직렬 저장, 실패 시 마지막 저장 값으로 되돌림. 저장 중 칩을 잠그지 않는다.
- 기존 `pickInitialWatchCategory`는 기존 테스트(D-1 ~ D-3)가 쓴다. **삭제·시그니처 변경 금지.** `src/utils/watchProviderDisplay.ts`는 바꾸지 않는다.
- 마이그레이션 파일은 7장의 1개만 만든다. RLS 정책·함수·트리거를 추가하지 않는다. 기존 마이그레이션 파일을 고치지 않는다.

# STEP 1 — 실패하는 테스트부터

1. `src/utils/subscribedOtt.test.ts`를 만들고 10장 T-1 ~ T-33을 전부 옮긴다. `node:test` + `node:assert/strict`. 타입은 `import type`.
2. `npm test`를 돌려 **T-1 ~ T-33이 실패하는 것을 눈으로 확인한다**(모듈 없음). 실패하지 않는 행이 있으면 멈추고 보고해라. 기존 1769개는 그대로 통과해야 한다.

# STEP 2 — 순수 함수

`src/utils/subscribedOtt.ts`를 6.1 계약과 판정 규칙 1 ~ 11대로 만든다. `SUBSCRIBABLE_OTTS`는 `KR_OTT_PROVIDERS`에서 만들고(하드코딩하지 않는다) 라프텔만 덧붙인다. 파일 맨 위 주석에 "묶음 키의 단일 출처는 KR_OTT_PROVIDERS. 라프텔은 제공 정보가 없어 matchable false, 찾기 버튼으로만 쓴다(docs/74 D-10)"를 남긴다.

`npm test`로 T-1 ~ T-33 통과를 확인한다.

# STEP 3 — 저장 구조

1. `supabase/migrations/20261117062800_profile_subscribed_otts.sql`을 7장 전문 그대로 만든다. 적용은 사람이 한다(보고 항목 8).
2. `src/types/database.ts`의 `profiles` Row/Insert/Update에 칸을 추가한다.
3. `src/lib/query.ts`의 `profile` 블록에 `subscribedOtts: (userId: string) => ["profile", userId, "subscribed-otts"] as const`를 추가한다.
4. `src/constants/features.ts`에 `SUBSCRIBED_OTT_FEATURES_ENABLED = true`와 한 줄 주석(docs/74)을 추가한다.
5. `src/services/subscribedOtts.ts`, `src/hooks/useSubscribedOtts.ts`를 6.2대로 만든다. 훅의 직렬 저장은 `nextSubscribedOttWrite`만으로 판단한다(훅 안에 별도 판정 로직을 두지 않는다).

# STEP 4 — 설정 화면과 프로필 행

8.1, 8.2대로 `app/settings/subscribed-otts.tsx`, `app/_layout.tsx`, `AccountSection.tsx`, `app/(tabs)/profile.tsx`를 고친다. `app/settings/excluded-recommendations.tsx`의 스타일을 복사하지 않는다(UI 규칙 위반이 있다).

# STEP 5 — 작품 상세

8.3, 8.4대로 `WatchProviderList.tsx`, `WatchNowButton.tsx`, `app/content/[id].tsx`를 고친다. `WatchProviderList`의 새 속성은 모두 선택이며 기본값에서는 렌더 결과가 지금과 같아야 한다.

# STEP 6 — 문서

- `docs/development_next_steps.md` 맨 위에 "내 구독 OTT (docs/74, 날짜)" 항목을 추가한다: 상태, 검사 결과, 수동 확인 표(M-1 ~ M-12 각각 실행/미실행과 사유), 사람이 할 후속 작업.
- `docs/README.md`의 74행 점검 상태를 실제 상태로 고친다. 화면을 직접 보지 않았으면 "구현·자동 검사 통과, 화면 미확인, 마이그레이션 적용 전"이라고 쓴다. "검증 완료"라고 쓰지 않는다.

# 엣지 케이스 (전부 처리)

9장 E-1 ~ E-22 전부. E-17 ~ E-20, E-22는 수동 확인 항목이다.

# 검증 명령

순서대로 전부 통과해야 한다.

```
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm test
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run typecheck
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run lint
```

`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(기준선 1769개 통과 → 1802개 이상 통과).

UI-13.2 검사(새로 만들거나 고친 화면·컴포넌트 파일 대상, 결과 0줄이어야 한다. `app/content/[id].tsx`·`app/(tabs)/profile.tsx`는 **이번에 추가한 줄**만 본다):

```
grep -nE "#[0-9A-Fa-f]{3,6}\b|rgba?\(|fontWeight: \"|fontSize: [0-9]" app/settings/subscribed-otts.tsx src/components/content/WatchNowButton.tsx src/components/content/WatchProviderList.tsx src/components/profile/AccountSection.tsx
grep -n "Alert.alert" app/settings/subscribed-otts.tsx src/components/content/WatchNowButton.tsx src/components/content/WatchProviderList.tsx src/components/profile/AccountSection.tsx
```

범위 확인(출력이 없어야 한다):

```
git status --short supabase/functions app/search.tsx "app/(tabs)/index.tsx" src/components/home src/utils/recommendationPresentation.ts src/utils/watchProviderDisplay.ts src/utils/watchProviderLookup.ts src/hooks/useWatchProviders.ts src/services/profile.ts
```

# DEFINITION OF DONE

- [ ] T-1 ~ T-33이 수정 전에 실패하는 것을 확인했고 수정 후 전부 통과한다
- [ ] 기존 테스트 1769개가 그대로 통과한다. 기존 테스트 파일을 고치지 않았다
- [ ] `npm run typecheck`, `npm run lint` 통과
- [ ] UI-13.2 토큰·`Alert` 검사 0줄
- [ ] 범위 확인 명령의 출력이 없다(`supabase/functions`, 검색·추천·홈 포함)
- [ ] `getProfile`의 select가 그대로다
- [ ] 마이그레이션 파일이 7장 전문과 같다
- [ ] 구독 미설정일 때 `WatchProviderList`의 렌더 결과가 이전과 같다(속성 기본값)
- [ ] 웹·앱 수동 확인 표(M-1 ~ M-12)를 실행/미실행 사유와 함께 보고했다
- [ ] `docs/development_next_steps.md`, `docs/README.md`를 실제 상태로 갱신했다

# 변경해야 할 파일 (이 외 파일 수정 금지)

```
src/utils/subscribedOtt.ts
src/utils/subscribedOtt.test.ts
src/services/subscribedOtts.ts
src/hooks/useSubscribedOtts.ts
src/lib/query.ts
src/constants/features.ts
src/types/database.ts
supabase/migrations/20261117062800_profile_subscribed_otts.sql
app/settings/subscribed-otts.tsx
app/_layout.tsx
src/components/profile/AccountSection.tsx
app/(tabs)/profile.tsx
src/components/content/WatchProviderList.tsx
src/components/content/WatchNowButton.tsx
app/content/[id].tsx
docs/development_next_steps.md
docs/README.md
```

# 보고 항목

1. STEP 1에서 실패했던 테스트의 실제 출력(대표 3개)
2. `npm test` 결과 (before / after 통과 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. UI-13.2 검사와 범위 확인 명령의 출력
6. 수동 확인 표 M-1 ~ M-12: 웹/앱별 실행 여부와 미실행 사유
7. D-1 ~ D-12 중 문제가 있다고 판단한 항목(바꾸지는 말고 보고만)
8. 사람이 해야 할 후속 작업: ① 마이그레이션 `20261117062800_profile_subscribed_otts.sql` 운영 적용(적용 도구가 만든 버전 번호가 다르면 파일명 맞추기) ② 적용 후 M-1 ~ M-12 화면 확인 ③ Edge Function 재배포는 **필요 없음**

# 금지사항

- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
