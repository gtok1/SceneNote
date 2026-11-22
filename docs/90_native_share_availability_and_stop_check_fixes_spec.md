# 90. 앱 공유 진입점 정리·공유 중지 확인 보강 명세

작성일: 2026-11-20
대상 브랜치 기준: main (0ca4651) + 미커밋 docs/84~89 작업
선행 문서: [88 공유 링크 관리·중지](88_library_share_link_management_spec.md), [89 오프라인 저장 갇힘 정정](89_offline_save_trap_fixes_spec.md)

## 1. 문제 정의

docs/88·89 구현을 검증하다 찾은 결함이다.

검증 결과:
- 테스트 1,939개, typecheck, lint는 모두 통과한다.
- 웹 8081에서 로그인 없이 확인했다.
  - `/share?id=<없는 ID>`에는 "공유 링크가 만료되었거나 존재하지 않습니다."가 나온다.
  - `/share`에는 "공유 링크에 필요한 ID가 없습니다."가 나온다.
  - `/library`·`/settings/library-shares`는 시작 화면으로 이동한다.
  - 이 과정에서 React 수화(hydration) 오류는 0건이다.

| ID | 증상 | 심각도 |
|----|------|--------|
| F-1 | iOS·Android 앱의 라이브러리 탭에 "라이브러리 공유" 버튼이 보인다. 누르면 "공유 웹 주소가 설정되지 않았어요. 앱 설정을 확인해 주세요."라는 개발자용 오류만 나온다. 앱에서는 공유가 한 번도 성공하지 않는다. docs/88로 생긴 프로필 "공유 링크" 화면의 "다시 보내기"도 앱에서는 항상 "링크를 보내지 못했어요."로 실패한다. 빈 상태 안내 "라이브러리에서 필터를 고른 뒤 공유하면 여기에 모여요."도 앱에서는 사실이 아니다. | 중간 |
| F-2 | "공유 중지"가 DB에서 한 행도 지우지 못해도 "공유를 멈췄어요."를 보여 준다. 삭제 권한(RLS)이 운영에 빠졌거나 막히면 링크는 계속 공개되는데 사용자는 멈췄다고 믿는다. | 낮음(발생 조건이 드묾, 결과는 개인정보 노출) |

## 2. 근본 원인

**F-1**
- `app.config.ts:30-32`의 `extra.publicWebOrigin`이 `null`이다. 저장소에서 정식 웹 주소는 확인되지 않는다. `.vercel/project.json`이 없고, `docs/development_next_steps.md:1690`에도 기록돼 있다.
- `src/utils/libraryShareUrl.ts`의 `resolveLibraryShareOrigin`은 웹이 아니면 설정 주소를 요구한다. 없으면 `SHARE_ORIGIN_ERROR`를 던진다(웹은 `window.location.origin`을 쓴다).
- 그런데 공유 진입점은 `SHARE_FEATURES_ENABLED`만 보고 그린다.
  - 라이브러리 탭: `app/(tabs)/library.tsx:417`(좁은 화면 도구), `:507`(넓은 화면 도구). 누르면 `:354`의 `getLibraryShareOrigin()`이 던지고 그 문구가 그대로 표시된다.
  - 공유 링크 화면: `app/settings/library-shares.tsx:97-106`의 "다시 보내기"는 `buildLibraryShareUrl`에서 던져 `resendFailed`로 끝난다.
  - 프로필: `app/(tabs)/profile.tsx:301`.

**F-2**
- `src/services/libraryShare.ts:85-93`의 `deleteLibraryShare`는 `.delete()…select("id")`의 `error`만 본다.
- PostgREST는 RLS가 행을 가리면 오류 없이 0행을 지운다. docs/88 6장은 0행을 "이미 지워짐"으로 보고 성공 처리했다. 이 때문에 "다른 기기에서 이미 지움"과 "권한이 없어 못 지움"을 구분하지 못한다.
- 마이그레이션 `0012_library_shares.sql:39-42`에 삭제 정책이 있다. 운영 적용 여부는 이번에 확인하지 못했다. 운영 DB 정책 조회 경로가 없고, Management API 조회는 허용되지 않았다.

## 3. 재현 시나리오

- F-1: iOS 시뮬레이터에서 로그인하고 라이브러리 탭의 공유 아이콘을 누른다. 공유 실패 안내에 "공유 웹 주소가 설정되지 않았어요…"가 뜬다. 프로필 → 공유 링크(웹에서 만든 링크가 있을 때) → 다시 보내기를 누르면 "링크를 보내지 못했어요…" 토스트가 뜬다.
- F-2: 삭제 정책이 없는 DB에서 공유 중지를 누른다. "공유를 멈췄어요." 토스트가 뜨고 목록에서 사라진다. 비로그인 창에서는 링크가 계속 열린다. 목록을 새로 고치면 그 행이 다시 나타난다.

## 4. 설계 결정

### D-1. 공유 링크를 만들 수 있는지는 설정만으로 판정한다 (최우선)
새 순수 함수 `canBuildLibraryShareUrl({ platform, configuredOrigin })`(`src/utils/libraryShareUrl.ts`)로 판정한다.
- 설정 주소가 비어 있으면 `platform === "web"`일 때만 true다.
- 설정 주소가 있으면 `resolveLibraryShareOrigin`이 통과할 때만 true다.
- `window`를 보지 않는다. 그래서 웹의 정적 HTML과 첫 브라우저 렌더 결과가 같다(수화 불일치 없음).
- 서비스 `src/services/libraryShare.ts`에서 앱 실행 중 바뀌지 않는 상수 `LIBRARY_SHARE_LINKS_AVAILABLE`로 한 번 계산한다(`Platform.OS`, `Constants.expoConfig?.extra?.publicWebOrigin`).
- 나중에 사람이 `publicWebOrigin`에 정식 HTTPS 주소를 넣으면 코드 변경 없이 모든 진입점이 다시 나타난다.

### D-2. 만들 수 없으면 만들기·보내기 진입점을 그리지 않는다
- 라이브러리 탭의 공유 버튼 두 곳(`:417`, `:507`)은 `SHARE_FEATURES_ENABLED && LIBRARY_SHARE_LINKS_AVAILABLE`일 때만 그린다.
- 공유 링크 화면의 "다시 보내기"는 `LIBRARY_SHARE_LINKS_AVAILABLE`일 때만 그린다.
- 보내기를 숨길 때는 설명 아래에 `LIBRARY_SHARE_APP_ONLY_COPY.resendUnavailable` 한 줄을 표시한다.
- 빈 상태 설명은 `LIBRARY_SHARE_APP_ONLY_COPY.emptyDescription`으로 바꾸고 "라이브러리로 가기" 행동을 빼서, 할 수 없는 일을 권하지 않는다.
- **공유 중지는 언제나 남긴다.** 웹에서 만든 링크를 앱에서도 멈출 수 있어야 한다.

### D-3. 프로필 행은 할 일이 있을 때만 보인다
새 순수 함수 `shouldShowLibrarySharesEntry({ featureEnabled, linksAvailable, count })`로 판정한다.
- `featureEnabled && (linksAvailable || (count ?? 0) > 0)`이다.
- 앱에서 웹 주소가 없고 링크도 없으면 행을 숨긴다. 링크가 있으면 멈추러 갈 수 있게 보인다.
- 웹은 `linksAvailable`가 true라 지금과 같다.

### D-4. 공유 중지는 실제로 지웠는지 확인한다
`deleteLibraryShare`에서 삭제가 반환한 행 수가 0이면, 같은 `id`와 `owner_user_id`로 `select("id").maybeSingle()`을 한 번 더 조회한다. 결과는 새 순수 함수 `resolveLibraryShareStop({ deletedCount, stillExists })`로 판정한다.
- `deletedCount > 0` → `"stopped"`
- `deletedCount === 0 && !stillExists` → `"already_gone"`(docs/88 E-5 그대로, 성공)
- `deletedCount === 0 && stillExists` → `"denied"` → `Error(LIBRARY_SHARE_MANAGEMENT_COPY.stopFailed)`. 행은 목록에 남는다.
- 확인 조회가 오류이면 `stopFailed`를 던진다. 성공이라고 단정하지 않는다.

### D-5. 기존 계약과 문구는 그대로다
- `LIBRARY_SHARE_MANAGEMENT_COPY`는 키와 값을 바꾸지 않는다(88 T-7이 객체 전체를 고정한다). 새 문구는 별도 상수 `LIBRARY_SHARE_APP_ONLY_COPY`에 둔다.
- `resolveLibraryShareOrigin`, 웹 공유 흐름, 공개 공유 화면, `get-library-share` Edge Function은 바꾸지 않는다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| 앱 공유 버튼을 그대로 두고 오류 문구만 다듬기 | 한 번도 성공하지 않는 버튼을 남긴다 |
| 앱에서 Supabase URL이나 임시 주소로 링크 만들기 | 공개 공유 웹 화면이 없는 주소다. `resolveLibraryShareOrigin`의 HTTPS·사설 주소 차단 계약을 깬다 |
| `typeof window`로 웹 가능 여부 판정 | 정적 HTML에서는 false, 브라우저에서는 true라 수화 불일치가 생긴다(웹 직접 열기 수정과 충돌) |
| 0행이면 실패로 처리 | 다른 기기에서 이미 멈춘 링크(docs/88 E-5)가 영원히 실패한다 |
| 운영 정책을 Edge Function으로 우회 삭제 | 서버 변경과 배포가 필요하다. RLS-first 원칙을 우회한다 |

## 6. 계약

```ts
// src/utils/libraryShareUrl.ts (추가, 순수)
export function canBuildLibraryShareUrl(input: { platform: string; configuredOrigin?: unknown }): boolean;
// const configured = typeof input.configuredOrigin === "string" ? input.configuredOrigin.trim() : "";
// if (!configured) return input.platform === "web";
// try { resolveLibraryShareOrigin({ platform: input.platform, configuredOrigin: configured }); return true; } catch { return false; }

// src/utils/libraryShareManagement.ts (추가, 순수 — 기존 export 변경 금지)
export const LIBRARY_SHARE_APP_ONLY_COPY = {
  resendUnavailable: "앱에서는 아직 링크를 보낼 수 없어요. 공유 중지는 여기서 할 수 있어요.",
  emptyDescription: "공유 링크는 웹에서 만들 수 있어요."
} as const;
export function shouldShowLibrarySharesEntry(input: { featureEnabled: boolean; linksAvailable: boolean; count: number | null }): boolean;
export type LibraryShareStopOutcome = "stopped" | "already_gone" | "denied";
export function resolveLibraryShareStop(input: { deletedCount: number; stillExists: boolean }): LibraryShareStopOutcome;

// src/services/libraryShare.ts
export const LIBRARY_SHARE_LINKS_AVAILABLE: boolean; // canBuildLibraryShareUrl({ platform: Platform.OS, configuredOrigin: Constants.expoConfig?.extra?.publicWebOrigin })
```

`deleteLibraryShare(id, expectedOwnerId)`의 판정 순서:
1. `requireShareOwnerId`(기존)
2. `delete().eq("id").eq("owner_user_id").select("id")`. `error`가 있으면 `stopFailed`.
3. `data.length > 0`이면 끝(`stopped`).
4. 확인 조회 `select("id").eq("id").eq("owner_user_id").maybeSingle()`. `error`가 있으면 `stopFailed`.
5. `resolveLibraryShareStop({ deletedCount: 0, stillExists: Boolean(row) })`가 `"denied"`이면 `stopFailed`를 던지고, 아니면 끝.

화면 쪽(`library-shares.tsx`의 `stop`, `useDeleteLibraryShare`의 `onSuccess`)은 바꾸지 않는다. 던지면 기존 `catch`가 `stopFailed` 토스트를 내고 행을 남긴다.

## 7. 데이터 모델 / SQL

해당 없음. 마이그레이션, RLS, Edge Function을 바꾸지 않는다. 운영 `library_shares_delete_own` 정책 존재 여부는 사람이 확인한다(13장).

## 8. 화면 명세

UI 규칙 준수(UI-1~UI-13). 웹은 화면 변화가 없다.

앱에서 웹 주소가 없을 때:

| 위치 | 표시 |
|------|------|
| 라이브러리 탭(좁은·넓은 화면 도구) | 공유 버튼 없음. 남은 도구의 간격·정렬은 기존 레이아웃 그대로 |
| 프로필 계정 패널 | 링크 0개이거나 아직 모르면 "공유 링크" 행 없음. 1개 이상이면 행 표시(개수 요약 기존 그대로) |
| 공유 링크 화면 | 설명 아래 `typography.caption`·`colors.textMuted`로 `resendUnavailable` 한 줄. 각 행에는 "공유 중지"만 |
| 공유 링크 화면 빈 상태 | 제목은 기존 `emptyTitle`, 설명은 `LIBRARY_SHARE_APP_ONLY_COPY.emptyDescription`, 행동 버튼 없음 |

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 웹, 설정 주소 없음 | 지금과 같음(버튼·다시 보내기·프로필 행 표시) | T-1, T-4, M-1 |
| E-2 | 앱, 설정 주소 없음, 링크 0개 | 라이브러리 공유 버튼 없음, 프로필 행 없음 | T-1, T-3, T-4, M-3 |
| E-3 | 앱, 설정 주소 없음, 웹에서 만든 링크 있음 | 프로필 행 있음 → 화면에서 "공유 중지"만, 안내 한 줄 | T-3, T-4, M-3 |
| E-4 | 앱, 정식 HTTPS 주소 설정 | 웹과 같이 모든 진입점 표시 | T-1 |
| E-5 | 설정 주소가 http·사설 주소·경로 포함 | 만들 수 없음으로 보고 진입점 숨김 | T-1 |
| E-6 | 웹 정적 HTML 첫 렌더 | 서버 HTML과 브라우저 첫 렌더에 공유 버튼이 똑같이 있음(418 없음) | T-1, M-1 |
| E-7 | 중지: 1행 삭제 | "공유를 멈췄어요.", 행 제거(기존) | T-2 |
| E-8 | 중지: 0행, 확인 조회에도 없음(다른 기기에서 이미 지움) | 성공 처리(docs/88 E-5 그대로) | T-2 |
| E-9 | 중지: 0행, 확인 조회에 남아 있음(권한 없음) | "공유를 멈추지 못했어요…", 행 유지 | T-2, T-5 |
| E-10 | 중지: 확인 조회 오류 | 실패 처리, 행 유지 | T-5 |
| E-11 | 앱 빈 상태 | 웹에서 만들 수 있다는 안내, 라이브러리 이동 버튼 없음 | T-3, M-3 |

## 10. 테스트 표

새 파일 `src/utils/libraryShareAvailability.test.ts`에 둔다. `node:test`와 `node:assert/strict`를 쓴다. import 범위는 다음과 같다.
- 순수 `libraryShareUrl`·`libraryShareManagement`
- 소스 문자열 검사용 `node:fs`

RN·expo·Supabase는 import하지 않는다.

| ID | 이름 | 내용 | 수정 전 |
|----|------|------|---------|
| T-1 | 90 T-1: share links need a usable origin | `canBuildLibraryShareUrl`의 기대값은 다음과 같다. web+없음→true, web+`null`→true, web+`"https://share.example.com"`→true, web+`"not a url"`→false, ios+없음→false, android+`null`→false, ios+`"  "`→false, ios+`"https://share.example.com/"`→true, ios+`"http://example.com"`→false, android+`"https://localhost"`→false, ios+`"https://share.example.com/path"`→false | 실패(함수 없음) |
| T-2 | 90 T-2: stopping reports only a real deletion | `resolveLibraryShareStop`의 기대값은 다음과 같다. `{1,false}`→stopped, `{1,true}`→stopped, `{0,false}`→already_gone, `{0,true}`→denied | 실패 |
| T-3 | 90 T-3: app-only copy is fixed | `LIBRARY_SHARE_APP_ONLY_COPY`가 6장 두 문구와 정확히 같다. `LIBRARY_SHARE_MANAGEMENT_COPY`에 새 키가 섞이지 않았다(키 목록이 88 T-7의 15개와 같음) | 실패 |
| T-4 | 90 T-4: the profile entry shows only when there is something to do | `shouldShowLibrarySharesEntry`의 기대값은 다음과 같다. feature false→항상 false, available true+count null→true, available false+null→false, available false+0→false, available false+2→true | 실패 |
| T-5 | 90 T-5: entry points and stop check are wired | 소스 문자열 검사. `library.tsx`에 `{SHARE_FEATURES_ENABLED ? (<Pressable`가 0번, `SHARE_FEATURES_ENABLED && LIBRARY_SHARE_LINKS_AVAILABLE`가 2번 이상이다. `library-shares.tsx`에 `LIBRARY_SHARE_LINKS_AVAILABLE`, `LIBRARY_SHARE_APP_ONLY_COPY.resendUnavailable`, `LIBRARY_SHARE_APP_ONLY_COPY.emptyDescription`가 있다. `profile.tsx`에 `shouldShowLibrarySharesEntry(`가 있다. `services/libraryShare.ts`의 `deleteLibraryShare` 본문에 `.maybeSingle()`과 `resolveLibraryShareStop(`가 있고, `export const LIBRARY_SHARE_LINKS_AVAILABLE = canBuildLibraryShareUrl(`가 있다 | 실패 |
| 보존 | 88 T-1~T-7, `libraryShareUrl.test.ts` 전체, 89 T-1~T-4, 기존 전체 | 그대로 통과. 88 T-6의 `/settings/library-shares`·`SHARE_FEATURES_ENABLED` 검사 포함 | 통과 |

**수동 확인 (UI-14.3)**

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440·375 | 라이브러리 공유 버튼, 프로필 행, 다시 보내기가 지금과 같다. `/library` 직접 열기에서 React 418이 0건이다. |
| M-2 | 웹 1440 | 검증용 링크 하나를 만든 뒤 멈춘다. 성공 토스트가 뜨고 비로그인 창에서 404 안내가 나온다. 사용자의 기존 링크는 멈추지 않는다. |
| M-3 | iOS 세로 | 설정 주소 없음, 링크 0개이면 라이브러리 공유 버튼과 프로필 행이 없다. 웹에서 만든 검증용 링크가 있으면 프로필 행 → 안내 한 줄 → 공유 중지만 있고, 멈추면 빈 상태 안내(이동 버튼 없음)가 나온다. |
| M-4 | Android 세로 | M-3와 같다(실행 환경이 없으면 미실행 사유를 보고한다). |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/libraryShareUrl.ts` | `canBuildLibraryShareUrl` 추가(D-1) |
| `src/utils/libraryShareManagement.ts` | `LIBRARY_SHARE_APP_ONLY_COPY`, `shouldShowLibrarySharesEntry`, `resolveLibraryShareStop` 추가(D-2~D-4) |
| `src/services/libraryShare.ts` | `LIBRARY_SHARE_LINKS_AVAILABLE`, `deleteLibraryShare` 확인 조회(D-1, D-4) |
| `app/(tabs)/library.tsx` | 공유 버튼 두 곳 조건(D-2) |
| `app/(tabs)/profile.tsx` | 프로필 행 조건(D-3) |
| `app/settings/library-shares.tsx` | 다시 보내기·안내·빈 상태(D-2) |
| `src/utils/libraryShareAvailability.test.ts` | 신규 T-1~T-5 |
| `docs/development_next_steps.md`, `docs/README.md` | 작업 기록·90행 상태 |

## 12. 범위 밖

- 정식 웹 주소 결정·배포·`publicWebOrigin` 설정. 사람이 한다. 넣으면 D-1에 따라 자동으로 열린다.
- 운영 RLS 정책 조회·수정, 마이그레이션.
- 프로필 요약이 다시 불러오는 동안 비는 표시, 100개일 때 "100개 이상" 표기.
- 느린 연결의 저장 시간 제한(docs/89 범위 밖 그대로).

## 13. 확실하지 않음 — 별도 검증 필요

- 운영 DB에 `library_shares_delete_own` 정책이 적용됐는지. Supabase 대시보드 → Authentication → Policies에서 사람이 확인한다. 없으면 D-4 덕분에 "멈추지 못했어요"로 드러난다. 정책 적용은 별도 작업이다.
- 앱의 `Constants.expoConfig?.extra?.publicWebOrigin`이 개발 빌드와 배포 빌드에서 같은 값인지. 지금은 둘 다 `null`이다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 공유 웹 주소가 없는 앱 빌드에서 동작하지 않는 공유 진입점을 정리하고, 공유 중지가 실제로 지웠는지 확인하게 한다. 정정 작업이다.

| ID | 결함 |
|----|------|
| F-1 | 앱(iOS·Android)에서 공유 버튼·다시 보내기가 항상 실패하고 개발자용 오류를 보여 준다 |
| F-2 | 공유 중지가 0행을 지워도 성공으로 안내해 링크가 공개된 채 남을 수 있다 |

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙.
2. `docs/90_native_share_availability_and_stop_check_fixes_spec.md` — 이 명세. D-1~D-5, 9장 E-1~E-11, 10장 테스트 표.
3. `docs/88_library_share_link_management_spec.md` — 공유 링크 화면 계약(88 T-7 문구 고정, E-5 멱등 중지).
4. `AGENTS.md` — 테스트 규칙. 테스트 파일에서 React Native·expo·Supabase 모듈을 import하면 실행이 깨진다.
5. `src/utils/libraryShareUrl.ts`, `src/services/libraryShare.ts`(:85-93, :302-313), `app/(tabs)/library.tsx`(:354, :417, :507), `app/(tabs)/profile.tsx`(:66, :300-301), `app/settings/library-shares.tsx`(:74, :78-84, :97-106).

# 시작 상태 (반드시 유지)
- 현재 `npm test` 1,939개 통과. 시작할 때 실제 값을 다시 기록한다.
- 웹의 공유 흐름·직접 열기 수화 수정(`useHydrated`)·docs/84~89 미커밋 변경을 보존한다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 가능 여부는 설정만으로 판정하고 `window`를 보지 않는다. 웹은 설정 주소가 없으면 true다. 어기면 웹 정적 HTML과 첫 렌더가 달라져 React 418이 재발한다.
- **D-2.** 공유 중지는 어떤 경우에도 숨기지 않는다.
- **D-4.** 0행이면 확인 조회 결과로 판정한다. 확인 조회 오류는 실패다. 0행을 무조건 실패로 바꾸지 않는다(docs/88 E-5).
- **D-5.** `LIBRARY_SHARE_MANAGEMENT_COPY`, `resolveLibraryShareOrigin`, 공개 공유 화면, Edge Function, 마이그레이션은 바꾸지 않는다.

# STEP 1 — 실패하는 테스트부터
`src/utils/libraryShareAvailability.test.ts`에 10장 T-1~T-5를 쓴다. `npm test`로 T-1~T-5가 실패하는 것을 눈으로 확인한다. 실패하지 않는 행이 있으면 멈추고 보고한다.

# STEP 2 — 순수 함수
6장 계약대로 `canBuildLibraryShareUrl`, `LIBRARY_SHARE_APP_ONLY_COPY`, `shouldShowLibrarySharesEntry`, `resolveLibraryShareStop`을 추가한다. T-1~T-4가 통과한다.

# STEP 3 — 서비스
- `LIBRARY_SHARE_LINKS_AVAILABLE`을 export한다(6장).
- `deleteLibraryShare`를 6장 판정 순서대로 바꾼다. 삭제는 `const { data, error } = await …select("id")`로 받고, `data.length === 0`일 때만 확인 조회한다.

# STEP 4 — 화면
- `library.tsx`: `:417`, `:507`의 조건을 `SHARE_FEATURES_ENABLED && LIBRARY_SHARE_LINKS_AVAILABLE`로 바꾼다. 다른 도구의 순서·스타일은 그대로 둔다.
- `profile.tsx:301`을 다음으로 바꾼다. `librarySharesSummary`는 그대로다.
  `onOpenLibraryShares={shouldShowLibrarySharesEntry({ featureEnabled: SHARE_FEATURES_ENABLED, linksAvailable: LIBRARY_SHARE_LINKS_AVAILABLE, count: libraryShares.isSuccess ? libraryShares.data.length : null }) ? () => router.push("/settings/library-shares") : undefined}`
- `library-shares.tsx`
  - "다시 보내기" `Pressable`을 `LIBRARY_SHARE_LINKS_AVAILABLE ? (…) : null`로 감싼다.
  - 설명 아래에 `!LIBRARY_SHARE_LINKS_AVAILABLE`일 때 안내 한 줄을 넣는다(8장).
  - 빈 상태는 `!LIBRARY_SHARE_LINKS_AVAILABLE`일 때 `description={LIBRARY_SHARE_APP_ONLY_COPY.emptyDescription}`으로 하고 `actionLabel`·`onAction`을 넘기지 않는다.
- T-5와 전체 테스트가 통과한다.

# 엣지 케이스 (전부 처리, 명세 9장)
9장 표 E-1~E-11 전부.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
npm run build
```
`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(기준선: 시작 때 기록한 값, 예상 1,939개). `npm run build`는 웹 정적 HTML이 계속 만들어지는지 확인한다. Node 24가 필요하면 `scenenote-verify`의 `--node-bin` 방식을 쓴다.

# DEFINITION OF DONE
- [ ] T-1~T-5가 수정 전에 실패하는 것을 확인했고 수정 후 통과한다.
- [ ] 기존 테스트 개수가 줄지 않았고, 기존 assertion(88 T-7 포함)을 바꾸지 않았다.
- [ ] 웹에서 `/library` 직접 열기 React 418이 0건이다(M-1).
- [ ] UI-13.2 토큰·`Alert` 검사 0줄.
- [ ] 웹·앱 수동 확인 표(M-1~M-4)를 보고했다. 실행하지 못한 행은 사유를 적는다.
- [ ] typecheck·lint 오류 0, `npm run build` 성공.

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/libraryShareUrl.ts
src/utils/libraryShareManagement.ts
src/utils/libraryShareAvailability.test.ts
src/services/libraryShare.ts
app/(tabs)/library.tsx
app/(tabs)/profile.tsx
app/settings/library-shares.tsx
docs/development_next_steps.md
docs/README.md
```
`docs/README.md`는 90행 상태 칸만, `docs/development_next_steps.md`는 맨 위 작업 기록만 고친다.

# 보고 항목
1. STEP 1 실패 테스트의 실제 출력
2. `npm test` before / after 통과 개수
3. `npm run typecheck`, `npm run lint`, `npm run build` 결과
4. 추가한 테스트 ID와 이름
5. 변경 diff 요약(파일별 줄 수)
6. M-1~M-4 결과 또는 미실행 사유
7. D-1~D-5 중 문제라고 본 항목(바꾸지 말고 보고만)
8. 사람이 할 후속 작업(정식 웹 주소·`publicWebOrigin` 설정, 운영 삭제 정책 확인, 웹 재빌드)

# 금지사항
- 배포 명령(`npx supabase functions deploy`, vercel 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다. 운영 DB에 쓰지 않는다.
- `app.config.ts`의 `publicWebOrigin`에 임시·추측 주소를 넣지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 의존성을 추가·변경하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- 수동 확인 때 사용자가 만든 기존 공유 링크를 멈추지 않는다. 검증용 링크만 만들고 멈춘다.
