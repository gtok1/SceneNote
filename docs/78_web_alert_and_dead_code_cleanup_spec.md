# 78. 웹 `Alert` 무동작 정리 및 미사용 추천 섹션 제거 명세

작성일: 2026-11-19
대상 브랜치 기준: main (519ddc7) + docs/74~77 미커밋 변경
선행 문서: [docs/00_ui_style_rules.md](00_ui_style_rules.md) UI-6.1·UI-6.3·UI-13.2, [docs/31](31_usability_review_fixes_spec.md)(웹 `Alert` 무동작), [docs/77](77_cast_card_selection_state_fix_spec.md)

docs/74~77 검증 후 남은 보완점을 모았다.
- 코드로 고칠 것은 이 명세의 F-1~F-3이다.
- 코드 밖에서 사람이 할 일은 12.1절에 따로 둔다.

## 1. 문제 정의

| ID | 증상 |
|----|------|
| F-1 | react-native-web의 `Alert.alert`는 빈 함수다(`node_modules/react-native-web/dist/exports/Alert/index.js`: `static alert() {}`). 확장 기능(`EXTENDED_FEATURES_ENABLED`)을 켜면 웹에서 아래 일이 생긴다. ① 추천 제외 목록 **"전체 해제"를 눌러도 아무 일도 일어나지 않는다**(확인 창이 뜨지 않아 해제 콜백이 실행되지 않음). ② 엑셀 업로드·사진에서 작품 찾기의 입력 안내, 등록 완료, 등록 실패가 화면에 전혀 나오지 않는다. 지금은 스위치가 꺼져 있어 화면에 드러나지 않을 뿐인 결함이다 |
| F-2 | 앱에서도 같은 오류가 인라인 안내와 `Alert`로 두 번 뜨는 곳이 있다(취향 카드 공유, 엑셀 읽기, 사진 업로드). 서버 영문 원문(`error.message`)이 그대로 노출되는 곳도 있다(UI-6.3 위반) |
| F-3 | `src/components/content/PopularRecommendationSection.tsx`(와 그것만 쓰는 `src/hooks/usePopularRecommendations.ts`)는 어떤 화면에서도 불러오지 않는다. 그런데도 docs/76처럼 일괄 수정할 때 변경 대상에 섞이고, `Alert.alert` 1곳과 토큰 위반 20줄을 갖고 있다 |

## 2. 근본 원인

현재 `app`·`src`의 `Alert.alert` 호출 15곳:

| 위치 | 용도 | 웹에서 도달 | 판정 |
|------|------|------------|------|
| `src/utils/confirmDestructive.ts:18` | 삭제 확인(앱 분기) | 웹은 위 `window.confirm` 분기 | **유지** (UI-6.1 공식 경로) |
| `src/utils/confirmDiscard.ts:7` | 작성 이탈 확인(앱 분기) | 웹은 `window.confirm` 분기 | **유지** |
| `app/(tabs)/pins.tsx:146` | 스포일러 핀 공유 방식 3지선다 | 아니다. `sharePin` 130행 `if (Platform.OS === "web") return;` | **유지** (앱 전용, 선택지 3개라 `confirmDestructive`로 대체 불가) |
| `app/(tabs)/pins.tsx:137` | 핀 이미지 공유 실패 | 앱 전용 | 토스트로 |
| `app/(tabs)/profile.tsx:193` | 취향 카드 공유 실패 | 웹·앱 | **삭제**. 바로 위 `setShareFeedback({ status: "error", … })`가 같은 문구를 인라인으로 보여 준다 |
| `app/settings/excluded-recommendations.tsx:28` | 전체 해제 확인 | 웹(확장 켜면) | `confirmDestructive`로 |
| `app/library/import.tsx:87` | 엑셀 읽기 실패 | 웹 | **삭제**. 86행 `setParseError` → 179행 `ErrorPanel`이 이미 보여 준다 |
| `app/library/import.tsx:93` | 엑셀 미선택 | 웹 | 토스트로 |
| `app/library/import.tsx:107` | 검사·등록 요청 실패 | 웹 | 토스트로(+한국어 변환) |
| `app/library/import.tsx:114` | 검사 전 등록 시도 | 웹 | 토스트로 |
| `app/library/photo-import.tsx:97` | 사진 읽기 실패 | 웹 | **삭제**. 96행 `setErrorMessage`가 이미 보여 준다 |
| `app/library/photo-import.tsx:122` | 검색 결과 미선택 | 웹 | 토스트로 |
| `app/library/photo-import.tsx:130` | 등록 완료 + "라이브러리 보기" | 웹 | 액션 토스트로 |
| `app/library/photo-import.tsx:135` | 등록 실패 | 웹 | 토스트로(+한국어 변환) |
| `src/components/content/PopularRecommendationSection.tsx:118` | 보고싶음 추가 실패 | 화면 없음 | 파일 삭제(F-3) |

- 세 확장 화면은 `MvpRoute`에서 `EXTENDED_FEATURES_ENABLED ? <Screen/> : <Redirect href="/library" />`로 막혀 있다(`excluded-recommendations.tsx:198`, `import.tsx:793`, `photo-import.tsx:600`).
- 저장소에는 `accessibilityState`처럼 `Alert.alert` 사용을 막는 자동 검사가 없다. 그래서 UI-13.2의 grep을 사람이 돌리지 않으면 다시 생긴다.

## 3. 재현 시나리오

1. 로컬에서만 `src/constants/features.ts`의 `EXTENDED_FEATURES_ENABLED`를 `true`로 바꾸고 웹 8081을 연다(확인 뒤 되돌린다).
2. `/settings/excluded-recommendations`에서 제외 작품이 1개 이상일 때 "전체 해제"를 누른다 → 아무 반응이 없다(F-1①).
3. `/library/import`에서 파일 없이 "검사"를 누른다 → 아무 안내가 없다(F-1②).
4. `/library/photo-import`에서 결과를 고르지 않고 등록을 누른다 → 아무 안내가 없다.

## 4. 설계 결정

### D-1. 결과·오류·입력 안내는 토스트, 되돌릴 수 없는 확인은 `confirmDestructive` (최우선)

- UI-6.1을 그대로 따른다. 토스트는 `useAppUIStore((s) => s.addToast)`(`src/stores/appUIStore.ts`)를 쓴다.
- `window.confirm`이나 `Platform.OS` 분기를 화면에 새로 만들지 않는다. 플랫폼 분기는 `confirmDestructive`·`confirmDiscard` 안에만 둔다.

### D-2. 이미 인라인으로 보이는 오류는 `Alert`만 지우고 토스트를 더하지 않는다

- 대상: `profile.tsx:193`, `import.tsx:87`, `photo-import.tsx:97`.
- 같은 오류를 두 번 보이지 않기 위해서다(F-2). 인라인 상태 코드는 바꾸지 않는다.

### D-3. 화면에 내보내는 `error.message`는 `userFacingErrorMessage(error, fallback)`를 거친다

- 함수는 `src/utils/profileDashboard.ts:269`에 있다. 한국어가 들어간 메시지만 그대로 통과시키고 나머지는 fallback으로 바꾼다.
- fallback 문구는 6.2 표의 값을 그대로 쓴다.

### D-4. 기존 한국어 안내 문구는 바꾸지 않는다

- 토스트로 옮길 때 원래 `Alert`의 **본문**(message)을 그대로 쓴다. 제목(title)은 버린다. 토스트는 한 줄이기 때문이다.
- 해요체 정리(UI-6.5)는 이번 범위가 아니다. 단, 새로 만드는 fallback 문구만 해요체로 쓴다.

### D-5. 앱 전용 스포일러 공유 3지선다(`pins.tsx:146`)는 유지한다

- 웹에서는 130행에서 먼저 반환되어 도달하지 않는다.
- 선택지가 3개여서 `confirmDestructive`(확인/취소 2개)로는 표현할 수 없다.
- 이것은 검사기의 허용 목록에 명시한 예외다.

### D-6. `Alert.alert` 사용 위치를 테스트로 고정한다

- `scripts/alertUsageGuard.test.ts`가 `app`·`src` 전체를 읽는다. `Alert.alert(` 호출 위치가 허용 목록 3곳과 **정확히 같은지** 확인한다.
- 새 호출이 생기면 테스트가 실패한다. 예외를 늘리려면 허용 목록과 이 명세를 함께 고쳐야 한다.

### D-7. 미사용 추천 섹션은 컴포넌트와 그것만 쓰는 훅을 함께 삭제한다

- `src/services/popularRecommendations.ts`는 `scripts/smoke-edge-functions.ts:9`가 타입을 쓰므로 **남긴다**.
- Edge Function `popular-recommendations`와 관련 query key도 건드리지 않는다.

> D-N은 Codex가 임의로 바꾸면 안 되는 항목이다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 웹용 `Alert` 폴리필(`window.alert`/`confirm`으로 `Alert.alert` 대체) | 버튼 3개 이상, `style` 같은 RN 의미를 브라우저 기본 창이 표현하지 못한다. UI-6.1이 이미 토스트·`confirmDestructive`로 정했다 |
| 확장 기능을 켤 때 함께 고치기 | 그때 잊기 쉽고, "전체 해제"처럼 데이터 동작이 막히는 결함이다. 지금 범위가 작다(13곳) |
| 스포일러 3지선다를 새 모달 컴포넌트로 바꾸기 | 앱 전용 경로이고 네이티브 Alert가 정상 동작한다. 모달을 새로 만들 이유가 없다 |
| 토큰 위반 538줄 일괄 정리 | 12장. 화면 모양이 바뀔 위험에 비해 사용자 효과가 없다 |
| 미사용 컴포넌트를 남기고 `Alert`만 고치기 | 쓰이지 않는 코드를 계속 고치게 된다(docs/76에서 실제로 발생) |

## 6. 계약

### 6.1 허용 목록 (D-6)

`scripts/alertUsageGuard.test.ts`의 상수다. 경로는 저장소 루트 기준이고 `/` 구분자를 쓴다. 정렬해서 비교한다.

```ts
const ALLOWED_ALERT_CALLS = [
  "app/(tabs)/pins.tsx",          // 1회. 앱 전용 스포일러 공유 3지선다(docs/78 D-5)
  "src/utils/confirmDestructive.ts", // 1회. 앱 분기
  "src/utils/confirmDiscard.ts"      // 1회. 앱 분기
];
```

판정:

1. `app`·`src` 아래 `.ts`·`.tsx` 파일 가운데 `.test.ts`를 뺀 모든 파일을 읽는다.
2. 각 파일에서 `/\bAlert\.alert\(/g`로 매치 수를 센다.
3. 매치가 1개 이상인 파일과 그 수의 목록이 `[["app/(tabs)/pins.tsx", 1], ["src/utils/confirmDestructive.ts", 1], ["src/utils/confirmDiscard.ts", 1]]`와 같아야 한다.

### 6.2 호출부 교체 (D-1~D-4)

`addToast`는 각 화면 컴포넌트 안에서 `const addToast = useAppUIStore((state) => state.addToast);`로 얻는다. `profile.tsx:68`과 같은 방식이다.

| 위치 | 교체 후 |
|------|--------|
| `pins.tsx:137` | `addToast(userFacingErrorMessage(error, "핀 이미지를 공유하지 못했어요. 잠시 후 다시 시도해 주세요."), "error");` (136행 `console.error`는 유지) |
| `profile.tsx:193` | 삭제 |
| `excluded-recommendations.tsx:28` | `confirmDestructive({ title: "전체 해제", message: "추천 제외 목록을 모두 비울까요?", confirmLabel: "해제", onConfirm: clearExclusions });` (`if (!hasItems) return;` 유지) |
| `import.tsx:87` | 삭제 |
| `import.tsx:93` | `addToast("먼저 업로드할 엑셀 파일을 선택해 주세요.", "info");` |
| `import.tsx:107` | `onError: (error) => addToast(userFacingErrorMessage(error, commit ? "등록하지 못했어요. 잠시 후 다시 시도해 주세요." : "검사하지 못했어요. 잠시 후 다시 시도해 주세요."), "error")` |
| `import.tsx:114` | `addToast("실제 등록 전에 Dry-run으로 중복과 검토 항목을 확인해 주세요.", "info");` |
| `photo-import.tsx:97` | 삭제 |
| `photo-import.tsx:122` | `addToast("등록할 검색 결과를 먼저 선택해 주세요.", "info");` |
| `photo-import.tsx:130` | `addToast("보고 싶음으로 라이브러리에 추가했습니다.", "success", { actionLabel: "라이브러리 보기", onAction: () => router.replace("/library") });` |
| `photo-import.tsx:135` | `onError: (error) => addToast(userFacingErrorMessage(error, "등록하지 못했어요. 잠시 후 다시 시도해 주세요."), "error")` |

- 교체 후 `Alert`를 더 쓰지 않는 파일은 `react-native` import에서 `Alert`를 뺀다. `pins.tsx`는 146행 때문에 남긴다.
- `userFacingErrorMessage`, `confirmDestructive`, `useAppUIStore` import는 필요한 파일에만 더한다(`profile.tsx`에는 이미 있다).

## 7. 데이터 모델 / SQL

해당 없음. DB 마이그레이션을 만들지 않는다.

## 8. 화면 명세

- 화면 모양과 배치는 바뀌지 않는다.
- 안내는 기존 전역 토스트 위치에 나온다.
- "전체 해제" 확인 창: 웹은 브라우저 확인 창 "전체 해제\n\n추천 제외 목록을 모두 비울까요?", 앱은 네이티브 Alert(취소/해제)다.
- 사진에서 작품 등록 성공 토스트에는 "라이브러리 보기" 버튼이 붙는다. 누르면 `/library`로 이동한다. 이전 "계속 등록" 버튼의 역할은 토스트를 무시하는 것으로 대신한다.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 웹, 제외 작품 있음, 전체 해제 → 확인 | 목록이 비워진다 | M-1 |
| E-2 | 웹, 전체 해제 → 취소 | 목록이 유지된다 | M-1 |
| E-3 | 제외 작품 0개 | 확인 창 없이 아무 일도 없다(기존 `hasItems` 가드) | M-1 |
| E-4 | 엑셀 읽기 실패 | `ErrorPanel` 한 번만 보이고 토스트·Alert는 없다 | T-1, M-2 |
| E-5 | 검사·등록 요청이 영문 오류로 실패 | 한국어 fallback 토스트 | T-1, M-2 |
| E-6 | 사진 등록 성공 → "라이브러리 보기" | `/library`로 이동 | M-3 |
| E-7 | 앱, 스포일러 핀 공유 | 기존 3지선다 Alert 그대로 | T-1, T-2, M-5 |
| E-8 | 앱·웹, 취향 카드 공유 실패 | 인라인 오류 문구만 보인다(Alert 없음) | T-1, M-4 |
| E-9 | 누군가 새 `Alert.alert`를 추가 | `npm test`의 T-1 실패 | T-1 |
| E-10 | 미사용 섹션 삭제 후 | 어떤 파일도 `PopularRecommendationSection`·`usePopularRecommendations`를 참조하지 않는다. smoke 스크립트 타입 import는 유지된다 | T-3, T-4 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.**

새 파일은 `scripts/alertUsageGuard.test.ts` 하나다. `node:test`의 `it`, `node:assert/strict`, `node:fs`, `node:path`, `node:url`만 쓴다. 저장소 루트는 `fileURLToPath(new URL("../", import.meta.url).href)`이고, 이것은 `scripts/a11yAriaStateGuard.test.ts`와 같은 방식이다.

| ID | 테스트 이름 | 기대 | 수정 전 |
|----|------------|------|---------|
| T-1 | `78 T-1: Alert.alert appears only in the documented allowlist` | 6.1 판정 3과 정확히 같다 | **실패**(15곳, 8파일) |
| T-2 | `78 T-2: the pins Alert is reachable only after the web early return` | `app/(tabs)/pins.tsx`에서 `if (Platform.OS === "web") return;`의 위치가 `Alert.alert(`보다 앞이다. 둘 다 `const sharePin =` 뒤에 있다 | 통과 |
| T-3 | `78 T-3: the unused popular recommendation section and hook are removed` | `src/components/content/PopularRecommendationSection.tsx`, `src/hooks/usePopularRecommendations.ts`가 없다(`existsSync` false) | **실패** |
| T-4 | `78 T-4: no source file references the removed section or hook while the smoke type import remains` | `app`·`src`·`scripts`에서 **이 테스트 파일과 삭제 대상 두 파일(T-3의 목록)을 뺀** 모든 `.ts`·`.tsx`에 `PopularRecommendationSection`·`usePopularRecommendations` 문자열 0회(외부 참조 검사). `scripts/smoke-edge-functions.ts`는 `services/popularRecommendations`를 계속 포함한다 | 통과(삭제 대상 밖에는 참조가 없음) |

기준선은 1,835개 통과이고, 목표는 1,839개 통과다.

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `scripts/alertUsageGuard.test.ts` | 새 파일. T-1~T-4 |
| `app/(tabs)/pins.tsx` | 137행 토스트. `useAppUIStore`·`userFacingErrorMessage` import |
| `app/(tabs)/profile.tsx` | 193행 삭제. `Alert` import 제거 |
| `app/settings/excluded-recommendations.tsx` | 28행 `confirmDestructive`. `Alert` import 제거 |
| `app/library/import.tsx` | 87 삭제, 93·107·114 토스트. `Alert` import 제거 |
| `app/library/photo-import.tsx` | 97 삭제, 122·130·135 토스트. `Alert` import 제거 |
| `src/components/content/PopularRecommendationSection.tsx` | 삭제 |
| `src/hooks/usePopularRecommendations.ts` | 삭제 |
| `docs/00_ui_style_rules.md` | UI-13.2의 "`grep -n "Alert.alert" <파일들>` 0줄(확인 창은 `confirmDestructive` 안에만)." 뒤에 "저장소 전체 허용 목록은 `npm test`의 `alertUsageGuard`가 확인한다(docs/78)."를 추가 |
| `docs/development_next_steps.md` | 맨 위에 docs/78 절 추가 |
| `docs/README.md` | 78번 줄 상태 갱신 |

## 12. 범위 밖

- **토큰 위반 538줄**(`app`·`src` `.tsx`, 상위 `people/[id]` 40·`search` 37·`library/import` 34·공유 카드 2종 48줄): 화면 모양이 바뀔 위험이 크고, 공유 이미지 카드는 의도한 고정 색일 수 있다. 화면별 UI 작업 때 그 파일만 정리한다(UI-13.2는 "새·수정한 파일" 기준이다).
- 해요체 문구 정리(UI-6.5), 토스트 컴포넌트 변경, `EXTENDED_FEATURES_ENABLED` 값 변경.
- `src/services/popularRecommendations.ts`, Edge Function, query key.
- 인라인 오류 표시 방식(`ErrorPanel`, `shareFeedback`, `errorMessage`) 변경.

### 12.1 코드 밖 보완 항목 (사람이 할 일, Codex 작업 아님)

| 항목 | 내용 |
|------|------|
| iOS 확인 묶음 | docs/74 M-11·M-12(M-8은 웹도 미실행), docs/75 M-6·M-7, docs/76 M-5, docs/77 M-3, 이 문서 M-5. 시뮬레이터 VoiceOver로 한 번에 확인 |
| 커밋 | docs/74~78 변경(현재 69개 파일, 새 마이그레이션 `20261117062800_profile_subscribed_otts.sql` 포함)이 미커밋이다. 작업 단위로 나눠 커밋 |
| 개발 서버 | Codex 수정 뒤 8081 서버가 이전 번들을 계속 낼 수 있다. 화면 확인 전에 서버를 재시작한다(2026-11-18 docs/77 확인 때 발생) |

## 13. 확실하지 않음 — 별도 검증 필요

- 확장 화면은 스위치가 꺼져 있어 평소에는 볼 수 없다. M-1~M-3은 로컬에서 잠시 스위치를 켜야 확인할 수 있다.
- 토스트 표시 시간 3.5초 안에 "라이브러리 보기"를 누를 수 있는지(E-6)는 실제 화면에서 확인한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 이번 작업은 **정정 작업**이다. 웹에서 아무 동작도 하지 않는 `Alert.alert` 호출을 UI-6.1 규칙(토스트, `confirmDestructive`)으로 바꾸고, 허용 목록 검사 테스트로 재발을 막는다. 또 어디서도 쓰지 않는 추천 섹션 컴포넌트와 그 훅을 삭제한다.

| ID | 결함 |
|----|------|
| F-1 | 웹에서 추천 제외 "전체 해제"가 동작하지 않고, 엑셀·사진 가져오기의 안내·완료·실패가 보이지 않음(확장 기능 켜면) |
| F-2 | 인라인 오류와 Alert가 겹치고, 영문 서버 오류가 노출됨 |
| F-3 | 미사용 `PopularRecommendationSection`·`usePopularRecommendations` |

# READ FIRST
1. `docs/78_web_alert_and_dead_code_cleanup_spec.md` — 이 명세. D-1~D-7, 계약 6장, E-1~E-10, T-1~T-4.
2. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙(UI-6.1·UI-6.3·UI-13.2).
3. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
4. `src/stores/appUIStore.ts`(`addToast`), `src/utils/confirmDestructive.ts`, `src/utils/profileDashboard.ts:269`(`userFacingErrorMessage`).
5. 2장 표의 각 호출 위치. `scripts/a11yAriaStateGuard.test.ts`(파일 순회 방식).

# 시작 상태 (반드시 유지)
- `npm test` 1,835개 통과, `typecheck`·`lint` 통과.
- 작업 트리에는 docs/74~77의 미커밋 변경이 있다. 되돌리거나 정리하지 않는다.
- `EXTENDED_FEATURES_ENABLED = false`는 그대로 둔다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 화면에 `window.confirm`이나 `Platform.OS` 분기를 새로 만들지 않는다. 확인 창은 `confirmDestructive`, 그 밖에는 `addToast`를 쓴다.
- **D-2.** `profile.tsx:193`, `import.tsx:87`, `photo-import.tsx:97`은 `Alert`만 삭제한다. 토스트를 더하지 않는다.
- **D-3.** 화면에 내보내는 `error.message`는 `userFacingErrorMessage`를 거친다. fallback은 6.2 표 그대로 쓴다.
- **D-4.** 기존 한국어 본문은 6.2 표 그대로 둔다. 문구를 다듬지 않는다.
- **D-5.** `pins.tsx:146` 3지선다 Alert는 유지한다.
- **D-6.** 허용 목록은 6.1의 3곳뿐이다. 테스트를 통과시키려고 허용 목록을 늘리지 않는다.
- **D-7.** `src/services/popularRecommendations.ts`, Edge Function, query key는 지우지 않는다.
- DB 마이그레이션을 만들지 않는다.

# STEP 1 — 실패하는 테스트부터
> 정정(2026-11-19): 첫 실행에서 T-4가 삭제 대상 파일 자신의 심볼을 잡아 실패했다. T-4는 삭제 대상 두 파일을 뺀 외부 참조 검사다. 이미 만든 `scripts/alertUsageGuard.test.ts`가 있으면 T-4의 제외 목록에 `REMOVED_FILES`만 더하고 다시 실행해 이어 간다. T-1은 STEP 3 뒤에야 통과한다.

- `scripts/alertUsageGuard.test.ts`를 만들고 10장 T-1~T-4를 그대로 옮긴다.
- `npm test`를 돌려 **T-1·T-3이 실패하고 T-2·T-4가 통과**하는지 눈으로 확인한다.
- T-1 실패 출력에 2장 표의 8개 파일이 보여야 한다.
- 다르면 멈추고 보고한다.

# STEP 2 — 호출부 교체
6.2 표대로 바꾼다.
- 교체한 줄과 필요한 import 외에는 손대지 않는다.
- `Alert`를 더 쓰지 않는 파일에서는 import의 `Alert`만 뺀다.
- 주석은 달지 않는다.

`npm test`에서 T-2가 통과하고, T-1은 **`src/components/content/PopularRecommendationSection.tsx` 1회만 남아** 실패하는지 확인한다(이 파일은 STEP 3에서 삭제한다). 다른 파일이 남아 있으면 STEP 2를 다시 본다.

# STEP 3 — 미사용 코드 삭제
- `src/components/content/PopularRecommendationSection.tsx`, `src/hooks/usePopularRecommendations.ts`를 삭제한다.
- `grep -rn "PopularRecommendationSection\|usePopularRecommendations" app src scripts`가 이 테스트 파일 말고는 0줄인지 확인한다.
- `npm test`에서 T-1~T-4가 모두 통과하는지 확인한다.

# STEP 4 — 문서
- `docs/00_ui_style_rules.md` UI-13.2에 11장의 문장을 추가한다.
- `docs/development_next_steps.md` 맨 위에 `## 웹 Alert 정리·미사용 추천 섹션 제거 (docs/78, <날짜>)` 절을 추가한다. 상태, 테스트 before/after, 수동 확인 표 결과 또는 미실행 사유를 적는다.
- `docs/README.md` 78번 줄 상태를 "구현, 화면 미확인"으로 바꾼다. 실제로 화면을 봤다면 그 결과대로 적는다.

# 엣지 케이스 (전부 처리, 명세서 9장)
E-1~E-10 전부.

# 수동 확인
확장 화면(M-1~M-3)은 로컬에서 `EXTENDED_FEATURES_ENABLED`를 잠시 `true`로 바꿔야 볼 수 있다. 확인한 뒤 반드시 `false`로 되돌리고, 되돌렸다고 보고한다. 브라우저를 조작할 수 없으면 미실행 사유를 적는다.

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 | 추천 제외 "전체 해제": 확인 창이 뜨고, 확인하면 비워지고, 취소하면 유지된다. 목록이 0개면 반응이 없다 |
| M-2 | 웹 8081 | 엑셀 업로드: 파일 없이 검사하면 안내 토스트가 뜬다. 잘못된 파일이면 `ErrorPanel`만 보이고 토스트는 없다 |
| M-3 | 웹 8081 | 사진에서 작품 찾기: 미선택 등록 시 안내 토스트, 등록 성공 시 "라이브러리 보기" 토스트가 뜨고 누르면 `/library`로 이동한다 |
| M-4 | 웹 8081 | 프로필 취향 카드 공유가 실패하면 인라인 오류만 보인다(실패를 만들기 어려우면 미실행 사유를 적는다) |
| M-5 | 앱(iOS 세로) | 전체 해제 확인이 네이티브 Alert(취소/해제)로 뜬다. 스포일러 핀 공유 3지선다가 그대로다. 오류가 토스트로 한 번만 보인다 |

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트를 하나도 깨뜨리지 않아야 한다. 기준선은 1,835개 통과이고, 목표는 1,839개 통과다.

# DEFINITION OF DONE
- [ ] T-1·T-3이 수정 전에 실패하는 것을 확인했고, 수정 후 T-1~T-4가 모두 통과한다
- [ ] `npm test` 1,839개 통과, 기존 테스트 개수가 줄지 않았다
- [ ] `typecheck`·`lint` 통과(삭제·import 정리로 생긴 미사용 변수 0)
- [ ] `grep -rn "Alert.alert" app src`가 허용 목록 3곳뿐이다
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(이번에 바꾼 줄 기준. 기존 토큰 위반은 12장)
- [ ] `EXTENDED_FEATURES_ENABLED`가 `false`다
- [ ] 웹·앱 수동 확인 표(M-1~M-5) 결과 또는 미실행 사유를 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
scripts/alertUsageGuard.test.ts
app/(tabs)/pins.tsx
app/(tabs)/profile.tsx
app/settings/excluded-recommendations.tsx
app/library/import.tsx
app/library/photo-import.tsx
src/components/content/PopularRecommendationSection.tsx   (삭제)
src/hooks/usePopularRecommendations.ts                    (삭제)
docs/00_ui_style_rules.md
docs/development_next_steps.md
docs/README.md
```

# 보고 항목
1. STEP 1에서 실패한 T-1·T-3의 실제 출력
2. `npm test` 결과 (before / after 통과 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. 6.2 표 각 행의 교체 결과(파일:행)와 삭제한 파일
6. 수동 확인 M-1~M-5 결과 또는 미실행 사유, `EXTENDED_FEATURES_ENABLED`를 되돌렸는지
7. D-1~D-7 중 문제가 있다고 판단한 항목 (바꾸지는 말고 보고만)
8. 사람이 해야 할 후속 작업 (12.1절 포함)

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하거나 허용 목록을 늘리지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다. 특히 토큰 위반과 문구 톤은 고치지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
