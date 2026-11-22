# 88. 라이브러리 공유 링크 관리·중지 명세

작성일: 2026-11-20
대상 브랜치 기준: main (`0ca4651`, 작업 트리에 docs/84·85·87 미커밋 변경 있음)
선행 문서: `docs/00_ui_style_rules.md`, `src/constants/features.ts`의 `SHARE_FEATURES_ENABLED` 주석(2026-10-02 사용자 결정: 공유가 앱의 핵심 목적), `docs/74_subscribed_ott_spec.md`(프로필 계정 행·설정 화면 형식)

기능 보완 명세다. 앱 코드만 바꾼다. DB 정책·Edge Function·마이그레이션·배포는 없다(필요한 권한과 색인이 이미 있다).

## 1. 문제 정의

| ID | 지금 사용자가 겪는 것 | 고친 뒤 |
|----|----------------------|---------|
| F-1 | 라이브러리에서 공유 링크를 만들면 **영구히 열려 있고, 앱에서 멈출 방법이 없다.** 누르는 대로 새 링크가 계속 쌓인다 | 프로필 → "공유 링크"에서 만든 링크를 보고, 링크별로 "공유 중지"할 수 있다. 멈춘 링크는 받은 사람에게 바로 열리지 않는다 |
| F-2 | 링크를 받은 사람은 작품 목록뿐 아니라 **표시 이름·상태·본 횟수·별점·한줄 후기**를 본다. 이 값은 공유한 뒤에 바뀐 것까지 실시간으로 보인다. 공유할 때 이 사실을 알려 주지 않는다 | 공유 성공 안내에 무엇이 보이는지와 멈추는 곳을 한 줄로 알린다 |

## 2. 근본 원인

1. 만료가 없다. Edge Function `create-library-share`와 앱의 직접 생성 경로(`src/services/libraryShare.ts:174-185`의 `insert`) 모두 `expires_at`을 넣지 않는다. 공개 조회 `get-library-share`는 `expires_at`이 있을 때만 막는다(`supabase/functions/get-library-share/index.ts:100-102`).
2. 공개 조회는 공유 시점의 작품 목록에 대해 **지금의** 기록을 서비스 권한으로 읽는다: 표시 이름(`:109`), 라이브러리 상태·본 횟수·날짜(`:110-120`), 별점·한줄 후기(`:121-128`, `reviews` 조회는 `:123`). 공개 화면은 이름·상태 배지·후기를 보여 준다(`src/components/library/LibraryShareScreenContent.tsx:66`, `:130`, `:151`).
3. 앱에는 공유를 만들고(`createLibraryShare`) 여는(`getLibraryShare`) 함수만 있다. 목록·삭제 함수와 화면이 없다(`src/services/libraryShare.ts` 내보내기 목록).
4. 그런데 DB는 이미 준비돼 있다. `library_shares`에 본인 조회·삭제 RLS 정책(`supabase/migrations/0012_library_shares.sql:24-26`, `:40-42`)과 `(owner_user_id, created_at DESC)` 색인(`:44-45`)이 있다. 삭제하면 공개 조회가 404를 돌려주고, 받는 사람 화면은 기존 문구 "공유 링크가 만료되었거나 존재하지 않습니다."를 보여 준다(`src/utils/libraryShareErrors.ts:42-44`).

## 3. 재현 시나리오

1. 로그인 → 라이브러리 → 필터를 고르고 공유한다. 링크가 만들어진다.
2. 프로필·설정 어디에도 만든 링크를 보거나 멈추는 곳이 없다.
3. 같은 링크를 다른 브라우저(로그인 없음)로 연다. 표시 이름과 상태·별점·한줄 후기가 보인다.
4. 그 작품의 한줄 후기를 고친 뒤 링크를 다시 열면 고친 후기가 보인다.

## 4. 설계 결정

### D-1. 공유 중지 = 그 행 삭제 (최우선)
본인 RLS 삭제 정책으로 `library_shares` 행을 지운다. 새 Edge Function·DB 정책·마이그레이션·배포를 만들지 않는다. 받는 사람은 기존 404 문구를 본다. 되돌리기 없음(같은 필터로 다시 공유하면 새 링크).

### D-2. 목록은 본인 링크만, 최신순 최대 100개
`owner_user_id = 본인`을 명시하고(RLS와 이중), `created_at` 내림차순, `limit(100)`. 100개를 넘으면 목록 아래 안내 한 줄(6.4 `tooManyNote`).

### D-3. 들어가는 곳은 두 군데
- 프로필 "계정" 패널의 "공유 링크" 행(구독 중인 OTT 바로 아래). 오른쪽 요약은 `없음`/`N개`, 불러오는 중·오류면 비운다. `SHARE_FEATURES_ENABLED`가 거짓이면 행도 화면도 없다(화면은 `/profile`로 돌려보냄).
- 라이브러리 공유 성공 안내(`app/(tabs)/library.tsx:664-687`)의 링크 아래에 6.4 `createdHint` 한 줄.

### D-4. 링크 한 줄의 구성
제목, 메타 `작품 N개 · YYYY.MM.DD 만듦`(한국 시간), 버튼 2개: "다시 보내기"(기존 `shareLibraryUrl`) / "공유 중지"(`confirmDestructive` → 삭제). 링크 주소는 기존 `buildLibraryShareUrl(id)`로 만든다.

### D-5. 공유 방식·공개 화면은 바꾸지 않는다
만드는 흐름, 공개 화면, 실시간 후기 노출, 최대 1,000개, 기본 만료 없음은 그대로다. 공유가 핵심 목적이라 만료를 강제하지 않고, 멈출 수 있게 하는 것으로 통제권을 준다(5장).

### D-6. 캐시
삭제 성공: 목록 캐시에서 그 행 제거, 공개 조회 캐시 `["library-share", id]` 제거. 실패: 목록 유지, 실패 토스트. 공유를 새로 만들면 목록 캐시를 무효화해 프로필 요약이 바로 맞는다.

### D-7. 문구·날짜·요약은 순수 함수
`src/utils/libraryShareManagement.ts`. 날짜는 `Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul" })`(기존 `formatWatchProviderUpdatedAt`과 같은 방식).

> D-N은 임의로 바꾸지 않는다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 기본 만료(예: 30일) | 공유가 핵심 목적이라 받은 사람의 링크가 예고 없이 끊긴다. 멈추는 권한이 먼저다 |
| `expires_at = now()`로 숨김 처리(행 보존) | 기록 목록·"중지됨" 상태 관리가 늘고, 공유 시점 스냅샷(제목·필터·작품 목록)이 남는다 |
| 공유 시점 후기 스냅샷 저장 | 공개 계약·Edge Function·마이그레이션 변경. 멈출 수 있으면 우선순위가 낮다 |
| "모두 중지" 버튼 하나 | 친구에게 보낸 링크까지 끊긴다. 링크별 중지가 기본이다 |
| 새 Edge Function으로 삭제 | RLS 삭제 정책이 이미 있다. 배포가 늘어난다 |

## 6. 계약

### 6.1 타입 (`src/types/libraryShare.ts`에 추가)
```ts
export interface MyLibraryShare { id: string; title: string; itemCount: number; createdAt: string }
```

### 6.2 서비스 (`src/services/libraryShare.ts`에 추가)
```ts
export const MY_LIBRARY_SHARE_LIMIT = 100;
export async function listMyLibraryShares(): Promise<MyLibraryShare[]>;
// getSessionUserId → 없으면 Error("로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.")
// from("library_shares").select("id,title,item_count,created_at").eq("owner_user_id", userId)
//   .order("created_at", { ascending: false }).limit(MY_LIBRARY_SHARE_LIMIT)
// error → Error(LIBRARY_SHARE_MANAGEMENT_COPY.loadFailed)
export async function deleteLibraryShare(id: string): Promise<void>;
// from("library_shares").delete().eq("id", id).eq("owner_user_id", userId).select("id")
// error → Error(LIBRARY_SHARE_MANAGEMENT_COPY.stopFailed). 0행이면 이미 없는 것으로 보고 성공(멱등)
```

### 6.3 훅 (새 파일 `src/hooks/useLibraryShares.ts`) · 쿼리 키
- `src/lib/query.ts`의 `queryKeys`에 `libraryShares: { mine: (userId: string) => ["library-shares", userId, "mine"] as const }`.
- `useMyLibraryShares()` — 로그인 사용자일 때만, `staleTime: 60_000`.
- `useDeleteLibraryShare()` — 성공 시 D-6. 진행 중인 행 id를 돌려줘 그 행 버튼만 잠근다.

### 6.4 순수 함수 (새 파일 `src/utils/libraryShareManagement.ts`)
```ts
export const LIBRARY_SHARE_MANAGEMENT_COPY = {
  screenTitle: "공유 링크",
  description: "만든 공유 링크예요. 링크를 받은 사람은 그 작품들의 상태·본 횟수·별점·한줄 후기를 볼 수 있어요. 공유를 멈추면 그 링크는 바로 열리지 않아요.",
  emptyTitle: "만든 공유 링크가 없어요.",
  emptyDescription: "라이브러리에서 필터를 고른 뒤 공유하면 여기에 모여요.",
  emptyAction: "라이브러리로 가기",
  loadFailed: "공유 링크를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
  resend: "다시 보내기",
  stop: "공유 중지",
  stopping: "멈추는 중",
  stopped: "공유를 멈췄어요.",
  stopFailed: "공유를 멈추지 못했어요. 잠시 후 다시 시도해 주세요.",
  copied: "링크를 복사했어요.",
  resendFailed: "링크를 보내지 못했어요. 잠시 후 다시 시도해 주세요.",
  tooManyNote: "최근 100개만 보여요. 오래된 링크는 최근 링크를 멈춘 뒤 확인할 수 있어요.",
  createdHint: "링크를 받은 사람은 이 작품들의 상태·별점·한줄 후기를 볼 수 있어요. 프로필 > 공유 링크에서 언제든 멈출 수 있어요."
} as const;
export function formatLibraryShareCreatedAt(iso: string): string;         // 한국 시간 "YYYY.MM.DD", 잘못된 값 ""
export function libraryShareRowMeta(share: Pick<MyLibraryShare, "itemCount" | "createdAt">): string;
// "작품 {itemCount.toLocaleString("ko-KR")}개 · {날짜} 만듦", 날짜가 ""이면 "작품 N개"
export function describeLibraryShareCount(count: number | null): string;  // null "" / 0 "없음" / n "{n ko-KR}개"
export function libraryShareStopConfirm(title: string): { title: string; message: string; confirmLabel: string };
// { title: "공유를 멈출까요?", message: `「${title}」 링크를 받은 사람은 더 이상 이 목록을 볼 수 없어요. 되돌릴 수 없어요.`, confirmLabel: "공유 중지" }
export function removeLibraryShare<T extends { id: string }>(list: readonly T[], id: string): T[]; // 새 배열, 입력 불변
```

## 7. 데이터 모델 / SQL
없음. 0012의 RLS 조회·삭제 정책과 색인을 쓴다.

## 8. 화면 명세

UI 규칙 준수(UI-1~UI-13). 화면 고유 값만 적는다.

- **새 화면 `app/settings/library-shares.tsx`** — `app/settings/subscribed-otts.tsx`와 같은 틀(ScrollView, `FORM_CONTENT_MAX_WIDTH`, `getHomeLayout` 여백, `DashboardPanel title={screenTitle}`). 순서: 설명 → 상태 영역 하나(로딩 `LoadingSkeleton variant="episode-row" count={3}` / 오류 `ErrorState message={loadFailed}` 재시도 / 빈 `EmptyState` 버튼 → `/library` / 목록) → 100개면 `tooManyNote`.
- **한 줄**: 제목(2줄까지) · 메타(caption, muted) · 오른쪽 또는 좁은 화면 아래에 버튼 2개(44pt). "공유 중지"는 위험 색 글자. 진행 중인 행만 "멈추는 중" + 비활성(`aria-busy`). 버튼 이름: `다시 보내기, {제목}`, `공유 중지, {제목}`.
- **다시 보내기**: `shareLibraryUrl({ title, url: buildLibraryShareUrl(id) })` → `"copied"`면 `copied` 토스트, 오류면 `resendFailed` 토스트, 나머지는 토스트 없음.
- **스택 등록** `app/_layout.tsx`: `<Stack.Screen name="settings/library-shares" options={{ title: "공유 링크" }} />`(구독 OTT 줄 다음).
- **프로필 계정 행** `src/components/profile/AccountSection.tsx`: 선택 props `librarySharesSummary?: string`, `onOpenLibraryShares?: () => void`. 아이콘 `link-outline`, 이름 "공유 링크", 접근성 이름 요약이 있으면 `공유 링크, {요약}`. 구분선 규칙은 기존 행과 같게.
- **라이브러리 공유 안내**: 성공 상태의 링크 텍스트 아래 caption 한 줄 `createdHint`. 공유 생성 성공 시 D-6 무효화.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 링크 0개 | 빈 상태 + 라이브러리로 가기, 프로필 요약 "없음" | T-3, M-1 |
| E-2 | 공유 중지 확인 → 성공 | 행이 사라지고 `stopped` 토스트, 공개 링크는 기존 404 문구 | T-5, M-1 |
| E-3 | 확인 창 취소 | 아무 일 없음 | M-1 |
| E-4 | 삭제 실패(네트워크) | 행 유지, `stopFailed` 토스트 | M-2 |
| E-5 | 다른 기기에서 이미 지움(0행) | 성공으로 처리하고 행 제거 | 6.2, M-2 |
| E-6 | 중지 중 다른 행 누름 | 진행 중인 행만 잠김 | M-1 |
| E-7 | 한국 시간 날짜 경계(UTC 15:30 = 다음 날) | 다음 날 날짜 | T-1 |
| E-8 | 100개 초과 | 최근 100개 + 안내 | T-7 |
| E-9 | 새 공유 생성 직후 프로필 | 요약 개수 즉시 반영 | M-1 |
| E-10 | `SHARE_FEATURES_ENABLED` 거짓 | 행 없음, 화면은 `/profile`로 | T-6 |
| E-11 | 웹에서 `navigator.share` 없음 | 복사 후 `copied` 토스트 | M-2 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 위치는 새 파일 `src/utils/libraryShareManagement.test.ts`, 이름은 `88 T-N: …`. 수정 전에는 모듈·파일이 없어 모두 **실패**한다.

| ID | 이름 | 입력 | 기대 |
|----|------|------|------|
| T-1 | `88 T-1: created dates are shown in Korean time` | `"2026-11-19T15:30:00.000Z"`, `"2026-11-19T14:59:00.000Z"`, `"bad"` | `"2026.11.20"`, `"2026.11.19"`, `""` |
| T-2 | `88 T-2: row meta shows count and date` | `{ itemCount: 12, createdAt: "2026-11-19T15:30:00.000Z" }`, `{ itemCount: 1234, createdAt: "bad" }` | `"작품 12개 · 2026.11.20 만듦"`, `"작품 1,234개"` |
| T-3 | `88 T-3: profile summary counts links` | `null`, `0`, `3`, `1200` | `""`, `"없음"`, `"3개"`, `"1,200개"` |
| T-4 | `88 T-4: stopping asks with the share title` | `"완료한 한국 드라마"` | 6.4의 객체와 정확히 같음 |
| T-5 | `88 T-5: removing a link keeps the others and the input` | 3개 중 가운데 id / 없는 id | 2개(순서 유지) / 같은 내용의 새 배열, 입력 불변 |
| T-6 | `88 T-6: the management screen is wired` | 원문(`node:fs`): `app/_layout.tsx`, `app/settings/library-shares.tsx`, `src/components/profile/AccountSection.tsx`, `app/(tabs)/profile.tsx`, `app/(tabs)/library.tsx` | `name="settings/library-shares"` / 화면에 `confirmDestructive(`·`useDeleteLibraryShare(`·`SHARE_FEATURES_ENABLED`, `Alert.alert` 없음 / `onOpenLibraryShares` / profile에 `SHARE_FEATURES_ENABLED`와 `/settings/library-shares` / library에 `LIBRARY_SHARE_MANAGEMENT_COPY.createdHint` |
| T-7 | `88 T-7: management copy is fixed` | `LIBRARY_SHARE_MANAGEMENT_COPY`, `MY_LIBRARY_SHARE_LIMIT`는 원문 확인(서비스는 Supabase를 import하므로 import 금지) | 6.4 문자열 그대로, `src/services/libraryShare.ts` 원문에 `MY_LIBRARY_SHARE_LIMIT = 100`·`.limit(MY_LIBRARY_SHARE_LIMIT)`·`.eq("owner_user_id"` |

보존: 기존 전체 테스트 assertion을 바꾸지 않는다(`a11yRoleLabelGuard`·`alertUsageGuard`·`a11yAriaStateGuard` 포함).

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/types/libraryShare.ts` | 6.1 |
| `src/services/libraryShare.ts` | 6.2 두 함수·상수 추가(기존 함수 본문 불변) |
| `src/lib/query.ts` | 6.3 키 |
| `src/hooks/useLibraryShares.ts` | 새 파일 |
| `src/utils/libraryShareManagement.ts` | 새 파일 |
| `src/utils/libraryShareManagement.test.ts` | 새 파일, T-1~T-7 |
| `app/settings/library-shares.tsx` | 새 화면 |
| `app/_layout.tsx` | 스택 한 줄 |
| `src/components/profile/AccountSection.tsx` | 행 추가 |
| `app/(tabs)/profile.tsx` | 행 연결 |
| `app/(tabs)/library.tsx` | 안내 한 줄·생성 후 무효화 |
| `docs/development_next_steps.md`, `docs/README.md` | 기록·88행 상태 |

## 12. 범위 밖
- 공개 화면·`get-library-share`·`create-library-share`·DB 정책·마이그레이션(D-1, D-5).
- 기본 만료, 후기 스냅샷, "모두 중지"(5장).
- 함께 남아 있는 별도 과제: 운영에 `delete-account` 미배포(회원 탈퇴 실패), `search-content`·`personalized-recommendations` 재배포 대기(docs/82·85·87), docs/86 미구현.

## 13. 확실하지 않음
- 운영 DB에 0012의 삭제 정책이 실제로 적용돼 있는지는 마이그레이션 파일로만 확인했다. M-1에서 검증용 링크 하나를 멈춰 확인한다. 실패하면 구현을 바꾸지 말고 보고한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 라이브러리 공유 링크를 사용자가 보고 링크별로 멈출 수 있게 하고(F-1), 공유 성공 안내에 무엇이 공개되는지와 멈추는 곳을 알린다(F-2). 기능 보완이며 서버·DB는 바꾸지 않는다.

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙.
2. `docs/88_library_share_link_management_spec.md` — 이 명세(D-1~D-7, 6장 계약·문구, 8장 화면, 9·10장).
3. `AGENTS.md` — 테스트 규칙. 테스트에서 React Native·Expo·Supabase를 import하지 않는다.
4. `app/settings/subscribed-otts.tsx`, `src/components/profile/AccountSection.tsx` — 따라 할 화면·행 형식.
5. `src/services/libraryShare.ts`, `supabase/migrations/0012_library_shares.sql`(읽기만).

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 중지는 RLS 삭제. Edge Function·마이그레이션·정책을 만들거나 바꾸지 않는다. `supabase/` 아래 파일은 수정하지 않는다.
- **D-5.** 공유 생성 흐름·공개 화면·`createLibraryShare`·`getLibraryShare`·`shareLibraryUrl` 본문을 바꾸지 않는다.
- **D-2·D-4·D-6.** 본인 필터 명시·최신순 100개, 행 구성, 캐시 규칙.
- 문구는 6.4 그대로. 확인 창은 `confirmDestructive`, 결과는 토스트(`Alert.alert` 금지).

# STEP 1 — 실패하는 테스트부터
10장 T-1~T-7을 쓰고 `npm test`로 모두 실패하는 것을 확인한다. 아니면 멈추고 보고한다.

# STEP 2 — 순수 함수·타입·키
6.1, 6.3 키, 6.4. T-1~T-5와 T-7의 문구 부분 통과.

# STEP 3 — 서비스·훅
6.2, 6.3. T-7 통과.

# STEP 4 — 화면·진입점
8장대로 새 화면, 스택, 프로필 행, 라이브러리 안내·무효화. T-6과 전체 테스트 통과.

# STEP 5 — 기록
`docs/development_next_steps.md` 맨 위 "공유 링크 관리·중지 (docs/88, 날짜)"(상태, 실패 출력, 검사, 수동 확인 실행/미실행 사유, 사람이 할 후속), `docs/README.md` 88행 상태.

# 수동 확인
| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 검증용 공유 링크를 하나 만든다 → 프로필 요약 증가 → "공유 링크" 화면에 최신순 표시 → 다시 보내기 → 공유 중지 확인/취소 → 행 제거·토스트 → 로그인 없는 다른 창에서 그 링크가 기존 404 문구 |
| M-2 | 웹 375 | 좁은 화면 버튼 배치·44pt, 키보드 포커스 이동, 오류 토스트(네트워크 끊김 재현이 가능할 때), 빈 상태 |
| M-3 | 웹 768 | 넓은 화면에서 시작선 하나·버튼이 끝으로 밀리지 않음 |
| M-4 | 앱(iOS 세로) | 안전 영역, 네이티브 확인 창, 다시 보내기의 공유 시트, 글자 1.3배 잘림 |

**사용자가 이미 만든 링크는 멈추지 않는다.** 중지는 이번에 만든 검증용 링크에만 한다. 로그인할 수 없으면 대신 로그인하지 말고 미실행으로 적는다.

# 검증 명령
```
npm test
npm run typecheck
npm run lint
```
기존 테스트가 하나도 깨지지 않아야 한다(시작 때 기준선 직접 기록, 끝난 뒤 = 기준선 + 7).

# DEFINITION OF DONE
- [ ] T-1~T-7이 수정 전 실패, 수정 후 통과
- [ ] 기존 테스트 개수가 줄지 않았고 assertion을 바꾸지 않았다
- [ ] `supabase/` 아래 diff 0줄
- [ ] UI-13.2 토큰·`Alert` 검사 0줄
- [ ] 웹·앱 수동 확인 표를 보고했다
- [ ] `npm run typecheck`, `npm run lint` 통과

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/types/libraryShare.ts
src/services/libraryShare.ts
src/lib/query.ts
src/hooks/useLibraryShares.ts
src/utils/libraryShareManagement.ts
src/utils/libraryShareManagement.test.ts
app/settings/library-shares.tsx
app/_layout.tsx
src/components/profile/AccountSection.tsx
app/(tabs)/profile.tsx
app/(tabs)/library.tsx
docs/development_next_steps.md
docs/README.md
```

# 보고 항목
1. STEP 1 실패 출력 2. `npm test` before/after 3. typecheck·lint 4. 추가 테스트 ID·이름 5. 파일별 diff 요약 6. M-1~M-4 결과 또는 미실행 사유(검증용 링크 id 앞 8자리) 7. D-1~D-7 중 문제라고 본 항목(보고만) 8. 사람이 할 후속 작업

# 금지사항
- 배포 명령을 실행하지 않는다. DB 마이그레이션·정책을 만들지 않는다.
- 사용자가 만든 기존 공유 링크를 지우지 않는다.
- 테스트 표 행을 줄이지 않고, assertion을 완화하지 않는다.
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다.
- 테스트 파일에서 React Native·Expo·Supabase를 import하지 않는다(타입은 `import type`).
