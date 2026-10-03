# 40. 작품 상세 "내 목록에서 삭제" 영역 정정

작성일: 2026-10-03
대상 브랜치 기준: `main` (`b9a67cd`) + 미커밋 `docs/39` 구현과 헤더 통일 작업(`ScreenHeader` 등). 이 시점 `npm test` 840개 중 839개 통과 — 실패 1개는 무관한 기존 결함
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙 — 이 명세는 다른 점만 쓴다)**, `docs/39_content_detail_saas_redesign_spec.md`(D-4 삭제 위치·확인)

> **근거.** 사용자 캡처(넓은 웹, 등록된 애니 상세). 옆 열에 "보러가기"·"본 횟수" 카드 아래로 구분선과 빨간 글자 "내 목록에서 삭제"만 카드 밖에 떠 있다.
> 사용자 요청: "내 목록에서 삭제 버튼이 너무 안 어울리게 있다. 빨간색으로 표시하되 화면에 어울리게 UI 구성에 맞게."

---

## 1. 문제 정의

| ID | 증상 | 원인 |
|----|------|------|
| Z-1 | 삭제 버튼만 카드 밖에 맨 글자로 있어 다른 섹션(모두 카드)과 어울리지 않는다 | `LibraryDangerZone`이 위 hairline 선 + 맨 `Pressable`만 그린다(`src/components/content/LibraryDangerZone.tsx`) |
| Z-2 | 무엇이 지워지는지 누르기 전에는 알 수 없다 | 설명 문구 없음(확인 창에서만 보임) |
| Z-3 | 버튼처럼 보이지 않는다(배경·테두리 없음, 다른 행동 버튼은 알약형) | 위와 같음 |
| Z-4 | 삭제 실패 토스트에 서버 영문 원문이 나갈 수 있다 | `removeFromLibrary`의 `onError: addToast(error.message || "삭제하지 못했어요.")`(`app/content/[id].tsx:252`). `docs/00_ui_style_rules.md` UI-6.3 위반 |

## 2. 목표 모습

```
┌ 목록 관리 ──────────────────────────────┐   ← 다른 섹션과 같은 DashboardPanel 카드
│ 삭제하면 감상 상태·본 횟수·시청 위치·     │   ← caption, textMuted
│ 감상 날짜가 지워져요. 핀·회차 체크·평점은  │
│ 남아요.                                  │
│ ( 🗑 내 목록에서 삭제 )                   │   ← 알약형 테두리 버튼: 흰 배경 + danger 테두리·글자·아이콘
└──────────────────────────────────────────┘      눌림 시 dangerSoft 배경. 내용 폭(왼쪽 정렬)
```
- 넓은 화면: 옆 열 맨 아래(위치는 `docs/39` 그대로). 좁은 화면: 한 열 맨 아래.
- 빨간색은 버튼 테두리·글자·아이콘에만. 카드 자체는 다른 카드와 같다(빨간 카드 배경·빨간 카드 테두리 금지 — 화면에서 가장 강한 요소가 되면 안 된다).

## 3. 설계 결정

- **D-1.** `LibraryDangerZone`을 `DashboardPanel`(title "목록 관리") 카드로 바꾼다. 카드 모양은 다른 섹션과 같다.
- **D-2.** 버튼: 높이 44, `paddingHorizontal: spacing.lg`, `radius.pill`, 배경 `colors.surface`, 테두리 `StyleSheet.hairlineWidth` `colors.danger`, 아이콘 `trash-outline` 16 + `typography.label`, 둘 다 `colors.danger`, `alignSelf: "flex-start"`. 눌림 `({ pressed })` 시 배경 `colors.dangerSoft`. 진행 중 "삭제 중" + `disabled` + `opacity: 0.6`. `ContentActionBar` 버튼과 같은 높이·모서리.
- **D-3.** 문구는 순수 상수 `LIBRARY_DELETE_ZONE_COPY`(`src/utils/libraryFeedbackCopy.ts`)에 둔다. 설명의 지워지는 항목 4개(감상 상태·본 횟수·시청 위치·감상 날짜)는 확인 창 문구(`createLibraryDeleteConfirmCopy`)와 같아야 한다 — 테스트로 고정.
- **D-4.** 실패 토스트는 `userFacingErrorMessage(error, LIBRARY_DELETE_ZONE_COPY.errorFallback)`(`src/utils/profileDashboard.ts`).
- **D-5.** 위치·확인 창(`confirmDestructive`)·성공 토스트·목록 이동·`contentDetailSections`의 `"danger"` 배치는 바꾸지 않는다.

## 4. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 빨간 채움 버튼 | 화면에서 가장 강한 요소가 되어 주 행동(에피소드 보기·상태)보다 눈에 띈다 |
| 카드 전체를 `dangerSoft` 배경·빨간 테두리로 | 같은 이유. 오탭을 줄이려는 영역이 오히려 시선을 끈다 |
| 히어로의 "⋯" 메뉴로 숨기기 | 메뉴 컴포넌트가 없다. `docs/39` D-4 기각 대안과 같음 |
| "본 횟수" 카드 안에 같이 넣기 | 성격이 다른 행동(기록 수정 vs 기록 삭제)이 한 카드에 섞인다 |

## 5. 계약

```ts
// src/utils/libraryFeedbackCopy.ts (추가)
export const LIBRARY_DELETE_ZONE_COPY = {
  title: "목록 관리",
  description: "삭제하면 감상 상태·본 횟수·시청 위치·감상 날짜가 지워져요. 핀·회차 체크·평점은 남아요.",
  actionLabel: "내 목록에서 삭제",
  pendingLabel: "삭제 중",
  errorFallback: "내 목록에서 삭제하지 못했어요. 잠시 후 다시 시도해 주세요."
} as const;
```
```ts
// src/components/content/LibraryDangerZone.tsx (props 그대로)
export function LibraryDangerZone({ pending, onDelete }: { pending: boolean; onDelete: () => void }): JSX.Element;
```

## 6. 엣지 케이스

| # | 상황 | 기대 | 테스트 |
|---|------|------|--------|
| E-1 | 폭 1440 | 옆 열 "본 횟수" 카드 아래 같은 폭·같은 모양 카드 | 수동 M-1 |
| E-2 | 폭 375 | 한 열 맨 아래 카드, 버튼 내용 폭 | 수동 M-2 |
| E-3 | 누름 | 확인 창(웹 `window.confirm`, 앱 네이티브 Alert) → 취소 무변화 / 확인 시 기존 흐름 | 수동 M-3·M-4 |
| E-4 | 삭제 중 | "삭제 중", 비활성, 투명도 0.6 | 수동 M-3 |
| E-5 | 실패(영문 서버 오류) | "내 목록에서 삭제하지 못했어요. 잠시 후 다시 시도해 주세요." | Z-T2 |
| E-6 | 문구 일관성 | 설명과 확인 창이 같은 4개 항목을 말함 | Z-T3 |
| E-7 | 앱 글자 1.3배 | 설명 줄바꿈, 버튼 글자 안 잘림 | 수동 M-4 |

## 7. 테스트 표

**모든 행을 테스트로 옮긴다.** `src/utils/libraryFeedbackCopy.test.ts`에 추가.

| ID | 입력 | 기대 |
|----|------|------|
| Z-T1 | `LIBRARY_DELETE_ZONE_COPY` | 5장 값과 `deepEqual` |
| Z-T2 | `userFacingErrorMessage(new Error("Edge Function returned a non-2xx status code"), LIBRARY_DELETE_ZONE_COPY.errorFallback)` | `"내 목록에서 삭제하지 못했어요. 잠시 후 다시 시도해 주세요."` |
| Z-T3 | `["감상 상태", "본 횟수", "시청 위치", "감상 날짜"]` 각각 | `LIBRARY_DELETE_ZONE_COPY.description`과 `createLibraryDeleteConfirmCopy("무빙").message`에 모두 포함 |

### 수동 확인 (UI-14.3)

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 옆 열에서 "본 횟수" 카드와 같은 폭·모서리·그림자, 빨간색은 버튼에만 |
| M-2 | 웹 375 | 한 열 맨 아래, 버튼 왼쪽 정렬·내용 폭, 넘침 없음 |
| M-3 | 웹 | 눌림 배경 변화, 확인 창 취소/확인, 삭제 중 표시 |
| M-4 | 앱(iOS 세로) | 홈 인디케이터에 가리지 않음, 네이티브 확인 창, 글자 1.3배에서 잘림 없음 |

## 8. 변경 파일

| 파일 | 변경 |
|------|------|
| `src/utils/libraryFeedbackCopy.ts` | `LIBRARY_DELETE_ZONE_COPY` 추가 |
| `src/utils/libraryFeedbackCopy.test.ts` | Z-T1~Z-T3 추가(기존 D-1·D-2 그대로) |
| `src/components/content/LibraryDangerZone.tsx` | D-1·D-2로 재작성 |
| `app/content/[id].tsx` | `removeFromLibrary`의 `onError` 한 줄(D-4) + import |

## 9. 범위 밖

| 항목 | 이유 |
|------|------|
| "보러가기" 카드의 어두운 배경(`WatchProviderList` 자체 스타일) | 다른 카드와 톤이 다르지만 `docs/39` D-8(하위 카드 내부 유지). 별도 정정 |
| 히어로 상태·행동 묶음 간격, iOS 배지 모서리, 상태 세그먼트 터치 높이 36 | `docs/39` 검증에서 나온 별도 항목 |
| 헤더 통일 작업(`ScreenHeader`) | 별도 작업 |
