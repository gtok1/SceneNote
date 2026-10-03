# 00. UI 스타일 규칙 (웹·앱 공통) — AI 작업용

> **이 문서는 AI(Codex·Claude)가 화면·컴포넌트를 만들거나 고치기 전에, 그리고 UI 명세·프롬프트를 쓰기 전에 읽는 규칙이다.**
> 모든 규칙은 **Expo 웹(8081)과 iOS·Android 앱 양쪽**에 적용된다. 한쪽에서만 맞는 구현은 완료가 아니다.
> 명세서·프롬프트는 이 문서를 READ FIRST에 넣고 **여기와 다른 점만** 쓴다. 이 문서의 규칙을 바꾸려면 명세에 `UI-xx 대체`라고 명시하고 이유를 쓴다. 명시 없이 어긋나면 구현하지 말고 보고한다.
> 근거 문서: `docs/32`(토큰·컨테이너), `docs/19`(모바일 사용성 M-01~M-11), `docs/31`(웹 `Alert` 무동작), `docs/36`·`docs/37`·`docs/39`(SaaS 카드 패턴).
> 작성일: 2026-10-03. 코드와 다르면 코드를 확인하고 이 문서를 고치는 작업을 보고한다.

---

## UI-0. 플랫폼 전제 (사실)

| 항목 | 값 | 근거 |
|------|-----|------|
| 런타임 | Expo SDK 54, React Native 0.81.5(New Architecture), react-native-web | `package.json` |
| 웹 | Metro, `output: "static"`, 폭 320~2560, 마우스·키보드, 휴대폰 가로(예: 844×390) 가능 | `app.config.ts` |
| 앱 | **세로 고정**(`orientation: "portrait"`), **라이트 모드만**(`userInterfaceStyle: "light"`) | `app.config.ts` |
| 코드 분기 | 한 코드베이스. `.web.tsx`/`.native.tsx` 파일 분리 금지(명세가 요구할 때만). 분기는 `Platform.OS`로 최소한 | — |
| 다크 모드 | 없음. 다크 전용 스타일을 만들지 않는다 | `docs/32` 4장 |

---

## UI-1. 토큰 (MUST)

`src/constants/theme.ts`의 값만 쓴다. 이 파일은 **import 없는 순수 상수 파일**로 유지한다(`Platform` 등 추가 금지 — 유틸 테스트가 import한다).

```ts
colors = { background "#F6F7F9", surface "#FFFFFF", surfaceMuted "#F1F3F5", text "#171717", textMuted "#6B7280",
           textSubtle "#9CA3AF", border "#E5E7EB", primary "#2563EB", primarySoft "#DBEAFE", danger "#DC2626",
           dangerSoft "#FEE2E2", success "#047857", successSoft "#D1FAE5", warning "#B45309", warningSoft "#FEF3C7",
           overlay "rgba(23, 23, 23, 0.48)" }
spacing = { xs 4, sm 8, md 12, lg 16, xl 24, xxl 32 }
radius  = { sm 8, md 12, lg 16, xl 20, pill 999 }
typography = { display 26/32/800, title 20/26/700, headline 15/20/700, body 14/20/400, label 13/18/600, caption 12/16/500, micro 11/14/600 }
elevation  = { card: boxShadow 2겹, bar: 상단 1px 선 }
```

- **UI-1.1** 화면·컴포넌트 파일에 16진 색·`rgba()`를 쓰지 않는다. 예외: 차트 계열색 상수 `CONTENT_TYPE_COLORS`(`src/constants/contentTypeColors.ts`), `GENRE_COLORS`(`src/constants/genreColors.ts`).
- **UI-1.2** 글자는 `...typography.X`를 펼쳐 쓴다. `fontSize`·`fontWeight` 숫자를 직접 쓰지 않는다(`fontWeight: "900"` 금지). 강조가 필요하면 다른 typography 단계를 고른다.
- **UI-1.3** 모서리: 카드·패널 `radius.lg`, 입력칸·작은 박스 `radius.md`, 버튼·칩·세그먼트 `radius.pill`, 아주 작은 요소 `radius.sm`.
- **UI-1.4** 테두리는 `StyleSheet.hairlineWidth` + `colors.border`.
- **UI-1.5** 숫자(개수·퍼센트·시간)에는 `fontVariant: ["tabular-nums"]`.
- **UI-1.6** 새 색이 꼭 필요하면 `theme.ts`에 토큰을 **추가**하는 것으로 명세에 쓴다. 기존 토큰 값 변경은 전 화면 영향이라 별도 명세.

---

## UI-2. 레이아웃·반응형

- **UI-2.1 콘텐츠 컨테이너.** 화면 본문은 하나의 컨테이너 안에 둔다: `{ width: "100%", maxWidth: HOME_CONTENT_MAX_WIDTH(1200), alignSelf: "center", paddingHorizontal: gutter }`. 섹션마다 따로 좌우 padding을 주지 않는다(시작선 하나).
- **UI-2.2 구간(브레이크포인트).** `src/utils/homeLayout.ts` `getHomeLayout(width)`가 기준이다.

  | 폭 | gutter | gap | 의미 |
  |----|--------|-----|------|
  | < 600 | 16 | 12 | 휴대폰. 1열, 세로 쌓기 |
  | 600~959 | 24 | 16 | 태블릿·좁은 웹. 카드 2열 가능, 패널 1열 |
  | ≥ 960 | 24 | 16 | 넓은 화면. 패널 2열(주+옆) 가능 |
  | ≥ 1280 | 24 | 16 | 포스터 격자 6열 |
- **UI-2.3 레이아웃 순수 함수.** 화면마다 `getXxxLayout(width)`를 `src/utils/`에 두고 `getHomeLayout`의 `gutter`·`contentWidth`·`posterGap`을 **옮겨 쓴다**(구간 새로 정의 금지). 잘못된 폭(`NaN`, 0, 음수)은 375로 본다. 테스트 폭: 375, 599, 600, 768, 959, 960, 1440, 2000, NaN. 기존 예: `getPeopleLayout`, `getProfileLayout`, `getContentDetailLayout`(docs/39).
- **UI-2.4 폭은 `useWindowDimensions()`**로 읽는다(`Dimensions.get` 금지 — 웹 리사이즈·회전에 갱신되지 않는다).
- **UI-2.5 격자.** `flexDirection: "row"`, `flexWrap: "wrap"`, `gap`. 카드 폭은 레이아웃 함수가 준 **픽셀 값**(퍼센트+gap 조합은 웹·앱 반올림이 달라 넘칠 수 있다). 같은 행 높이 맞춤: 부모 `alignItems: "stretch"`, 셀 `alignSelf: "stretch"`, 카드 `flexGrow: 1`.
- **UI-2.6 행동 버튼 위치.** 넓은 행의 오른쪽 끝으로 버튼을 밀지 않는다(`marginLeft: "auto"`를 600 이상 폭 행에 쓰지 않는다). 이름과 행동은 같은 카드 안, 붙여서. 카드 격자나 최대 폭으로 거리를 제한한다.
- **UI-2.7 글자 넘침.** 텍스트를 담는 flex 자식에는 `minWidth: 0`(웹에서 줄임표가 동작하려면 필요). 제목·이름은 `numberOfLines`(1~2).
- **UI-2.8 가로 스크롤 레일**은 항목이 적은 보조 목록에만(예: 곧 방영). 주 목록은 격자(웹 마우스로 가로 스크롤이 어렵다).
- **UI-2.9 높이.** 텍스트가 들어가는 상자에 고정 `height`를 주지 않는다(`minHeight` 사용). 고정 높이는 이미지·막대·아이콘 원에만.

---

## UI-3. 안전 영역·헤더·하단 탭

- **UI-3.1 탭 화면**(`app/(tabs)/*`): 개편된 화면은 기본 탭 헤더를 끄고(`app/(tabs)/_layout.tsx` 해당 항목 `headerShown: false`) 본문 맨 위에 `insets.top + 12` 여백 뒤 화면 제목 `typography.display`. 현재 적용: 홈·핀·인물·프로필. 라이브러리·검색은 개편할 때 같은 방식으로.
- **UI-3.2 스택 화면**(작품 상세·인물 상세·공유 등): 루트 Stack 헤더 + `StackBackButton`을 쓴다(직접 뒤로 버튼 만들지 않음). 본문 `paddingBottom: 24 + insets.bottom`.
- **UI-3.3 하단 탭**(`GlobalBottomNav`, `app/_layout.tsx`)은 `(tabs)` 그룹·로그인 상태에서만 보이고 **레이아웃 흐름 안**에 있다(본문과 겹치지 않음). 하단 안전 영역은 탭 바가 처리한다. 탭 화면 본문 하단 여백은 `spacing.xxl`(32)이면 충분하다. 화면 하단에 `position: "absolute"` 고정 바를 새로 만들지 않는다(토스트가 `bottom: 88`에 뜬다).
- **UI-3.4** 앱은 세로 고정이지만 **웹은 가로 휴대폰이 가능**하다. 화면 전체 높이를 고정으로 쓰는 레이아웃 금지 — 본문은 항상 `ScrollView`(또는 FlashList) 안.
- **UI-3.5** 좌우 안전 영역이 필요한 가로 요소(전체 폭 바)는 `Math.max(spacing, insets.left/right)`.

---

## UI-4. 터치·포인터·접근성

- **UI-4.1 터치 영역 최소 44×44**(`docs/19` M-05). 시각 크기가 작으면 `hitSlop`으로 채운다. 주요 버튼 높이 44~48. 예: 알약 버튼 높이 32 + `hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}`, 아이콘 버튼 36 + `hitSlop={4}`.
- **UI-4.2 눌림 피드백**은 `Pressable`의 `({ pressed }) =>` 스타일(투명도 0.72 또는 배경 `surfaceMuted`). **hover에만 의존하는 표시 금지**(앱에는 hover가 없다). hover는 웹 부가 효과로만.
- **UI-4.3 Pressable 중첩 금지**(웹에서 button 안 button). 카드 열기와 카드 안 행동 버튼은 **형제**로 둔다.
- **UI-4.4** 모든 상호작용 요소에 `accessibilityRole`, 글자가 없거나 모호하면 `accessibilityLabel`, 상태는 `accessibilityState`(`selected`/`disabled`/`expanded`/`checked`/`busy`). 아이콘만 있는 버튼은 라벨 필수.
- **UI-4.5 비활성**은 `disabled` + `opacity: 0.5~0.6`. 처리 중인 항목만 비활성(한 항목 저장 중에 목록 전체를 막지 않는다 — 항목별 Set으로 관리, `docs/36` D-7).
- **UI-4.6 글자 확대.** `allowFontScaling={false}` 금지. 앱 글자 크기 1.3배에서도 잘리거나 겹치지 않게: `flexWrap`, `numberOfLines`, `minHeight`. 열 수를 글자 크기에 맞춰야 하면 `useWindowDimensions().fontScale`을 넘긴다(예: `getResponsiveRecommendationColumns(width, fontScale)`).
- **UI-4.7** 로딩 영역 `accessibilityState={{ busy: true }}` + 라벨, 동적 안내문 `accessibilityLiveRegion="polite"`.

---

## UI-5. 입력·키보드

- **UI-5.1** 입력이 있는 화면: `KeyboardScreen`(`src/components/common/KeyboardScreen.tsx`) 또는 같은 구성 — `KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight}` + `ScrollView keyboardShouldPersistTaps="handled"`(키보드가 열린 채 버튼을 한 번에 누를 수 있게).
- **UI-5.2** 입력칸 높이 44~48, `typography.body`(숫자 강조는 `headline`), 배경 `surface` 또는 `surfaceMuted`, `radius.md`(검색창은 `radius.pill`), `placeholderTextColor={colors.textSubtle}`.
- **UI-5.3** 키보드 종류: 숫자 `inputMode="numeric"` + `keyboardType="number-pad"`, 이름·검색 `autoCapitalize="none"` + `autoCorrect={false}`, `returnKeyType`과 `onSubmitEditing` 지정. 값이 있으면 지우기(⊗) 버튼(라벨 "검색어 지우기" 등).
- **UI-5.4** 웹 포커스 테두리를 전역으로 지우지 않는다. 컨테이너가 포커스 표시를 대신할 때만 `outlineStyle: "none" as never`.
- **UI-5.5** 입력 검증·정규화는 `src/utils/` 순수 함수(문구 포함)로 두고 테스트한다. 실패 문구는 입력칸 아래 `typography.caption` `colors.danger`.
- **UI-5.6** 변경 중인 폼을 떠나면 `confirmDiscard`(`src/utils/confirmDiscard.ts`).

---

## UI-6. 피드백·확인·오류 문구 (웹 결함의 주원인)

- **UI-6.1 `Alert.alert`로 결과·오류·확인을 처리하지 않는다.** react-native-web에서 `Alert.alert`는 **아무것도 하지 않는다**. 웹 사용자는 실패를 모른다.
  - 결과·오류·제안 → `useAppUIStore((s) => s.addToast)(message, "success" | "error" | "info", { actionLabel?, onAction?, durationMs? })`
  - 되돌릴 수 없는 삭제 확인 → `confirmDestructive({ title, message, confirmLabel, onConfirm })`(`src/utils/confirmDestructive.ts`, 웹 `window.confirm` / 앱 `Alert.alert`)
  - 작성 중 이탈 → `confirmDiscard`
- **UI-6.2 되돌릴 수 있는 가벼운 삭제**(좋아하는 인물 빼기 등)는 확인 창 대신 "되돌리기" 액션 토스트(`docs/36` D-4). 감상 기록이 함께 사라지는 삭제는 확인 창(`docs/31` U-2).
- **UI-6.3 오류 문구는 한국어.** 서버·Supabase·Edge Function 영문 원문("Edge Function returned a non-2xx status code" 등)을 화면에 내보내지 않는다. 한국어 검증 문구만 통과시키는 `userFacingErrorMessage(error, fallback)`(`src/utils/profileDashboard.ts`), 오류 코드별 문구 함수(`src/utils/libraryShareErrors.ts`) 패턴을 쓴다. 고정 문구 형식: "~하지 못했어요. 잠시 후 다시 시도해 주세요."
- **UI-6.4 데이터 영역 상태 순서**(한 영역에 하나만): 로딩 → 스켈레톤(빙글이 상자 대신, 실제 카드 모양) / 오류(데이터 없음) → `ErrorState`(재시도) / 빈 결과 → `EmptyState`(다음 행동 버튼) / 데이터. **오류와 빈 상태를 같이 그리지 않는다**(`docs/31` U-10). 데이터가 있는데 일부 실패면 목록 위 `typography.caption` 안내 한 줄.
- **UI-6.5 문구 톤.** 해요체, 짧게. 버튼은 동사("추가", "저장", "모두 보기"). 빈 상태는 사과 대신 안내("작품을 라이브러리에 추가하면 …"). 숫자는 `toLocaleString("ko-KR")`. 문구는 순수 함수에 두면 테스트로 고정한다.

---

## UI-7. 이미지·아이콘

- **UI-7.1** 이미지는 `AppImage`(`src/components/common/AppImage.tsx`)만 쓴다(웹 `<img>`, 앱 `expo-image`, 실패·없음 대체 배경을 처리). 사람 사진은 `PersonAvatar`(원형, 사진 없으면 이니셜).
- **UI-7.2** 포스터 비율 2:3. 대체 배경 `surfaceMuted`.
- **UI-7.3** 아이콘은 `Ionicons`(`@expo/vector-icons`) — 16(버튼 안), 18(입력·작은 버튼), 20(아이콘 버튼), 22 이상은 장식용. 색은 토큰.

---

## UI-8. 그림자·모서리·잘림

- **UI-8.1** 그림자는 `...elevation.card`(카드), `...elevation.bar`(바)만. `shadowColor`/`shadowOffset` 등 `shadow*` 속성과 `elevation` 숫자(안드로이드) 직접 사용 금지 — `boxShadow` 문자열을 RN 0.81과 react-native-web이 모두 지원한다(`docs/32` 기각 대안).
- **UI-8.2** 그림자가 있는 카드에 `overflow: "hidden"` 금지(웹에서 그림자가 잘린다). 잘라야 하는 것은 안쪽 트랙(진행 막대 등)에만.

---

## UI-9. 공용 컴포넌트 (새로 만들기 전에 재사용)

| 컴포넌트·함수 | 위치 | 용도 |
|---------------|------|------|
| `DashboardPanel` | `src/components/profile/DashboardPanel.tsx` | **섹션 카드 셸**(제목·부제·오른쪽 accessory·폭). 프로필 폴더에 있지만 범용으로 재사용한다(이동은 별도 작업) |
| `SegmentedControl` | `src/components/common/SegmentedControl.tsx` | 2~4개 중 하나 선택(높이 44, `stretch`로 균등 폭) |
| `PersonAvatar` | `src/components/people/PersonAvatar.tsx` | 원형 인물 사진·이니셜 |
| `PosterTile`, `ContinueWatchingTile` | `src/components/home/` | 포스터 타일 |
| `EmptyState`, `ErrorState`, `LoadingSkeleton` | `src/components/common/` | 상태 표시(UI-6.4). 스켈레톤 variant: `content-card`·`search-result`·`pin-item`·`episode-row`·`recommendation-card` |
| `AppImage` | `src/components/common/AppImage.tsx` | 이미지(UI-7.1) |
| `KeyboardScreen` | `src/components/common/KeyboardScreen.tsx` | 입력 화면 골격(UI-5.1) |
| `StackBackButton` | `src/components/common/StackBackButton.tsx` | 스택 헤더 뒤로 |
| `FilterSheet` | `src/components/common/FilterSheet.tsx` | 필터 시트 |
| `GenreBadgeList`, `WatchStatusBadge` | `src/components/GenreBadge.tsx`, `src/components/content/WatchStatusBadge.tsx` | 장르·상태 배지 |
| `useAppUIStore().addToast` | `src/stores/appUIStore.ts` | 토스트(UI-6.1) |
| `confirmDestructive`, `confirmDiscard` | `src/utils/` | 확인 창(UI-6.1) |
| `useModalFocus` | `src/hooks/useModalFocus.ts` | 모달 포커스(웹 Tab 가두기·닫을 때 포커스 복귀, 앱 접근성 포커스) |
| `useDebouncedValue` | `src/hooks/useDebouncedValue.ts` | 입력 디바운스(검색 300ms) |

---

## UI-10. 모달·시트

- **UI-10.1** `Modal transparent` + 배경 `colors.overlay`. `onRequestClose` 필수(안드로이드 뒤로·웹 Esc). 패널은 `useModalFocus`의 `panelRef`/`firstRef` 연결.
- **UI-10.2** 패널 `maxWidth` 지정(예: 460~560), 좁은 화면은 좌우 `spacing.lg` 여백. 닫기 버튼 44.
- **UI-10.3** 모달 안 긴 내용은 `ScrollView`. 키보드가 있는 모달은 UI-5.1 구성.

---

## UI-11. 목록·성능

- **UI-11.1** 길이가 정해지지 않은 목록(검색 결과·라이브러리·핀 등)은 `FlashList`. 항목이 적고 고정된 목록은 `map` + `ScrollView` 허용.
- **UI-11.2** 행·카드 컴포넌트는 `memo`, `key`는 안정적인 식별자(`${source}:${id}` 등, 인덱스 금지).
- **UI-11.3** 화면에서 판정·정렬·집계를 인라인으로 하지 않는다. `src/utils/` 순수 함수 + `useMemo`.

---

## UI-12. 코드 구조·테스트

- **UI-12.1** 판정·레이아웃·문구는 `src/utils/*.ts` 순수 함수, 테스트는 `src/utils/*.test.ts`(`node:test` + `node:assert/strict`). 테스트 파일은 `react-native`·`expo-*`·Supabase 클라이언트를 import하지 않는다(타입은 `import type`). `.tsx`와 `app/`은 테스트되지 않으므로 로직을 거기 두지 않는다.
- **UI-12.2** 화면 파일은 데이터 훅 연결·이동·렌더만. 섹션이 커지면 `src/components/<기능>/`로 나눈다.
- **UI-12.3** 기존 하위 카드의 내부를 "김에" 바꾸지 않는다. 바꿀 범위는 명세의 파일 목록으로 한정한다.

---

## UI-13. 검증 (웹·앱 둘 다)

1. `npm test`, `npm run typecheck`, `npm run lint`.
2. 토큰 검사: 새·수정한 화면·컴포넌트에서
   ```
   grep -nE "#[0-9A-Fa-f]{3,6}\b|rgba?\(|fontWeight: \"|fontSize: [0-9]" <파일들>
   ```
   결과 0줄(UI-1.1 예외 상수 제외). `grep -n "Alert.alert" <파일들>` 0줄(확인 창은 `confirmDestructive` 안에만).
3. **웹**(8081만, `npm run web -- --port 8081 --localhost --clear`, 사용 중이면 기존 서버 재사용): 폭 375·768·1440. 확인 — 시작선 하나, 넓은 화면 빈 공간·끝으로 밀린 버튼 없음, 키보드 포커스 이동, 토스트·확인 창 동작.
4. **앱**(가능하면 `npm run ios` iOS 시뮬레이터 세로): 안전 영역(노치·홈 인디케이터), 키보드가 입력·저장 버튼을 가리지 않음, 글자 크기 1.3배(설정 > 손쉬운 사용 > 더 큰 텍스트)에서 잘림 없음, 확인 창은 네이티브 Alert로 뜸.
5. 로그인이 필요한 화면을 AI가 확인할 수 없으면 대신 로그인하지 않는다. 확인하지 못한 항목을 **웹/앱 구분해** 수동 확인 표로 보고한다.

---

## UI-14. 명세·프롬프트 작성 규칙 (중복 서술 줄이기)

- **UI-14.1** UI 명세의 "선행 문서"와 프롬프트의 READ FIRST 첫 줄에 `docs/00_ui_style_rules.md`를 넣는다.
- **UI-14.2** 이 문서에 이미 있는 규칙(토큰, 44pt, `Alert` 금지, 컨테이너, 상태 순서, 검증 절차 등)은 명세·프롬프트에 다시 풀어 쓰지 않는다. "UI 규칙 준수(UI-1~UI-13)" 한 줄 + 화면 고유 값(레이아웃 함수 기대값, 문구, 섹션 순서)만 쓴다.
- **UI-14.3** 수동 확인 표는 웹과 앱 행을 모두 둔다:

  | ID | 플랫폼 | 확인 |
  |----|--------|------|
  | M-1 | 웹 1440 | … |
  | M-2 | 웹 375 | … |
  | M-3 | 앱(iOS 세로) | 안전 영역·키보드·글자 1.3배 … |
- **UI-14.4** 프롬프트 DoD에 다음 두 줄을 넣는다: "UI-13.2 토큰·`Alert` 검사 0줄", "웹·앱 수동 확인 표를 보고했다".

---

## UI-15. 완료 체크리스트 (UI 작업마다)

- [ ] 토큰만 사용(16진 색·`fontWeight`·`fontSize` 숫자 없음)
- [ ] 콘텐츠 컨테이너(최대 1200·gutter) 안, 레이아웃은 순수 함수 + 폭별 테스트
- [ ] 375 / 768 / 1440에서 넘침·끝으로 밀린 버튼·빈 공간 없음
- [ ] 터치 44, `accessibilityRole`/`Label`/`State`, Pressable 중첩 없음
- [ ] 입력 화면 키보드 회피 + `keyboardShouldPersistTaps="handled"`
- [ ] `Alert.alert` 없음 — 토스트·`confirmDestructive`·`confirmDiscard`
- [ ] 오류 문구 한국어, 서버 원문 노출 없음
- [ ] 로딩·오류·빈 상태 한 번에 하나
- [ ] 그림자 카드에 `overflow: "hidden"` 없음
- [ ] 안전 영역: 탭 화면 `insets.top + 12`, 스택 화면 `24 + insets.bottom`
- [ ] 글자 확대 1.3배에서 잘림 없음(앱)
- [ ] 웹·앱 수동 확인 결과(또는 미확인 사유) 보고
