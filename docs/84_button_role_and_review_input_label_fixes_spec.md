# 84. 역할 없는 버튼 13곳·후기 입력칸 이름 정정 명세

작성일: 2026-11-20
대상 브랜치 기준: main (0ca4651)
선행 문서: [docs/00_ui_style_rules.md](00_ui_style_rules.md)(UI-4.4), [docs/75](75_web_aria_state_fixes_spec.md)·[docs/77](77_cast_card_selection_state_fix_spec.md)(`findJsxOpeningTags` 소스 검사 방식)

## 1. 문제 정의

| ID | 증상 |
|----|------|
| F-1 | 누를 수 있는 `Pressable` 13곳에 `accessibilityRole`이 없다. 웹에서는 `role` 없는 `div`로 그려져 화면 낭독기가 "버튼"이라고 알려 주지 않고, 키보드 사용자는 무엇인지 모르는 정지점을 만난다. iOS VoiceOver도 "버튼" 특성을 읽지 않는다. 회차 진행 카드의 "아직 안 봄"·"전부 봤음"·"되돌리기"처럼 핵심 기록 화면도 포함된다 |
| F-2 | 작품 상세의 후기 작성(`ContentReviewEditor`) 입력칸 2개에 이름이 없다. 화면에는 "한줄 후기"·"소감" 제목이 보이지만 입력칸과 연결되지 않아, 낭독기는 placeholder("짧게 남기는 한 문장" 등)만 읽고 글자를 입력하면 그마저 사라진다 |

F-1 대상(2026-11-20 `findJsxOpeningTags` 전수 검사, `Pressable` 256개 중):

| # | 파일:행 | 요소 | 현재 이름 |
|---|--------|------|----------|
| 1 | `src/components/content/EpisodeProgressCard.tsx:326` | 빠른 버튼 | 글자 "아직 안 봄" |
| 2 | `src/components/content/EpisodeProgressCard.tsx:330` | 빠른 버튼 | 글자 "전부 봤음" |
| 3 | `src/components/content/EpisodeProgressCard.tsx:334` | 빠른 버튼 | 글자 "되돌리기" |
| 4 | `src/components/content/PersonalizedRecommendationListItem.tsx:45` | 카드 본문(빠른 보기 열기) | `${title} 빠른 보기` |
| 5 | `src/components/content/PersonalizedRecommendationListItem.tsx:87` | 아이콘 버튼 | `${title} 관심 없음` |
| 6 | `src/components/content/PersonalizedRecommendationListItem.tsx:88` | 아이콘 버튼 | `${title} 비슷한 작품 더 보기` |
| 7 | `src/components/content/PersonalizedRecommendationListItem.tsx:101` | 빠른 보기 버튼 | `${title} 빠른 보기` |
| 8 | `src/components/library/LibraryFilterBottomSheet.tsx:92` | 머리글 닫기 | "필터 닫기" |
| 9 | `src/components/library/LibraryFilterBottomSheet.tsx:80` | 배경 닫기 | "필터 닫기" |
| 10 | `src/components/content/RecommendationExclusionSheet.tsx:76` | 배경 닫기 | "추천 제외 설정 닫기" |
| 11 | `src/components/content/ThemeReductionSheet.tsx:38` | 배경 닫기 | "테마 선택 닫기" |
| 12 | `src/components/content/SimilarContentQuickViewModal.tsx:19` | 배경 닫기(한 줄 파일 안의 첫 `Pressable`) | "빠른 보기 닫기" |
| 13 | `app/people/[id].tsx:761` | 배경 닫기 | "상태 메뉴 닫기" |

- `src/components/common/FilterSheet.tsx:39` 배경은 `accessible={false}`로 낭독기에서 일부러 뺐다. 대상이 아니다.
- `disabled`만 주고 `aria-disabled`가 없는 곳(51곳)은 결함이 아니다. react-native-web 0.21 `Pressable`은 `disabled`를 `aria-disabled`로 내보내고(`dist/exports/Pressable/index.js:125`), RN 0.81 `Pressable`도 `accessibilityState.disabled`로 합친다(`Pressable.js:229`). 그래서 이번 범위에 넣지 않는다.

## 2. 근본 원인

- F-1: `Pressable`은 역할을 기본으로 주지 않는다. 작성할 때 `accessibilityRole="button"`을 빠뜨렸고, 이를 잡는 검사가 없었다. `a11yAriaStateGuard`는 상태 속성만 본다.
- F-2: 화면 제목 `<Text style={styles.label}>`과 `TextInput`이 형제일 뿐 연결되지 않았다(`ContentReviewEditor.tsx:155-180`). 같은 파일의 다른 입력(297행)은 `accessibilityLabel={`${label} 입력`}`을 이미 쓴다.

## 3. 재현 시나리오

1. 웹 8081에서 로그인된 상태로 라이브러리의 "보는 중" 작품 상세를 연다.
2. 개발자 도구에서 "아직 안 봄" 요소를 본다. `role` 속성이 없다.
3. 같은 화면 아래 후기 작성의 "한줄 후기" 입력칸을 본다. `aria-label`이 없고 placeholder만 있다.

## 4. 설계 결정

### D-1. 13곳 모두 `accessibilityRole="button"`을 더한다 (최우선)

- 배경 닫기도 포함한다. 이미 `RecommendationQuickViewModal.tsx:83`이 배경에 `accessibilityRole="button"`을 쓰고 있어 같은 방식으로 맞춘다.
- 배경을 `accessible={false}`로 바꾸는 방식은 기각한다(5장).
- **이름·`onPress`·`disabled`·스타일·`ref`는 바꾸지 않는다.** 역할 한 줄만 더한다.
- 선택·토글 상태가 없는 단순 버튼이므로 `selectionAriaProps`를 쓰지 않는다(UI-4.4, docs/77).

### D-2. 후기 입력칸 이름은 화면 제목과 같게

- `onChangeText={setOneLineReview}` 입력칸에 `accessibilityLabel="한줄 후기"`.
- `onChangeText={setBody}` 입력칸에 `accessibilityLabel="소감"`.
- placeholder·`maxLength`·스타일은 그대로다. 보이는 제목과 이름이 같아 음성 제어("한줄 후기 누르기")와도 맞는다.

### D-3. 저장소 전체 가드 테스트로 다시 생기지 않게 한다

- 새 `scripts/a11yRoleLabelGuard.test.ts`가 `app`·`src`의 모든 `.tsx`를 `findJsxOpeningTags`로 검사한다.
  - `<Pressable`·`<TouchableOpacity`·`<TouchableHighlight` 여는 태그는 `accessibilityRole=`, `role=`, `accessible={false}` 중 하나를 가져야 한다.
  - `<TextInput ` 여는 태그(공백 포함. `useRef<TextInput>` 같은 타입 인자 `<TextInput>`는 대상이 아니다)는 `accessibilityLabel=`, `aria-label=`, `aria-labelledby=`, 펼침 `{...` 중 하나를 가져야 한다. 펼침은 `PasswordInput`처럼 호출부가 이름을 넘기는 경우다.
- 위반 목록을 `파일:행`으로 모아 `deepEqual(위반, [])`로 비교한다. 실패 메시지에 위치가 바로 보인다.

### D-4. `scripts/a11yAriaStateGuard.ts`는 바꾸지 않는다

`findJsxOpeningTags`를 import해서 쓰기만 한다.

> D-N은 Codex가 임의로 바꾸면 안 되는 항목이다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 배경 닫기를 `accessible={false}`로 | 웹에서 `accessible={false}`가 키보드 정지점까지 없애는지 화면별로 확인해야 한다. 이미 있는 `RecommendationQuickViewModal` 방식과도 달라진다. 배경 정리 방식은 별도로 정할 일이다(12장) |
| 공통 `AppPressable` 컴포넌트를 만들어 역할 기본값 주기 | 256곳을 바꾸는 리팩터링이다. 가드 테스트로 충분하다 |
| `aria-disabled` 51곳 추가 | 1장 끝. 라이브러리가 이미 내보낸다 |
| 후기 입력칸에 `aria-labelledby`로 제목 연결 | 앱(iOS)은 `accessibilityLabelledBy`가 Android 전용이라 동작이 갈린다. 같은 글자를 `accessibilityLabel`로 주는 쪽이 웹·앱에서 같다 |
| 개별 화면 테스트만 추가 | 같은 실수가 다른 파일에서 다시 생긴다(이번 13곳이 그 예) |

## 6. 계약

### 6.1 버튼 13곳

각 여는 태그에 `accessibilityRole="button"`을 더한다. 속성 순서는 그 파일의 기존 순서를 따른다(알파벳순이면 알파벳순). 다른 속성은 바꾸지 않는다.

예(`EpisodeProgressCard.tsx:326`):

```diff
-        <Pressable disabled={disabled} onPress={() => changeDraft(0)} style={styles.quickButton}>
+        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => changeDraft(0)} style={styles.quickButton}>
```

### 6.2 후기 입력칸

```diff
         <TextInput
+          accessibilityLabel="한줄 후기"
           editable={!pending}
           maxLength={120}
           onChangeText={setOneLineReview}
```

```diff
         <TextInput
+          accessibilityLabel="소감"
           editable={!pending}
           maxLength={2000}
           multiline
```

### 6.3 가드 판정 순서 (`scripts/a11yRoleLabelGuard.test.ts`)

1. `app`·`src` 아래 `.tsx` 파일 목록을 만든다(`readdirSync(..., { recursive: true })`, 정렬).
2. 각 파일에서 `findJsxOpeningTags(source)`를 부른다.
3. 버튼 규칙: `ownText`가 `/^<(Pressable|TouchableOpacity|TouchableHighlight)\b/`이고 `/accessibilityRole=|\brole=|accessible=\{false\}/`가 없으면 위반 `` `${file}:${line}` ``.
4. 입력 규칙: `ownText`가 `/^<TextInput\s/`이고 `/accessibilityLabel=|aria-label=|aria-labelledby=|\{\.\.\./`가 없으면 위반.

## 7. 데이터 모델 / SQL

해당 없음.

## 8. 화면 명세

보이는 화면은 바뀌지 않는다. 웹 DOM에 `role="button"`(13곳)과 `aria-label="한줄 후기"`·`aria-label="소감"`이 생긴다.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 회차 진행 빠른 버튼 3개 | 역할 button, 기존 `disabled`·`aria-disabled`·동작 그대로 | T-1, T-2, M-1 |
| E-2 | 개인화 추천 카드·아이콘 버튼 4개 | 역할 button, 이름 그대로 | T-1, T-3, M-2 |
| E-3 | 시트·모달 배경 닫기 5개 | 역할 button, `disabled`(저장 중) 유지 | T-1, M-3 |
| E-4 | `FilterSheet` 배경 `accessible={false}` | 가드가 위반으로 보지 않는다 | T-1 |
| E-5 | `useRef<TextInput>` 같은 타입 인자 | 가드 대상이 아니다 | T-4 |
| E-6 | `PasswordInput` 내부 `{...inputProps}` | 위반 아님(호출부가 이름을 준다) | T-4 |
| E-7 | 후기 입력칸 2개 | 이름 "한줄 후기"·"소감", placeholder 유지 | T-4, T-5, M-1 |
| E-8 | 여러 줄 JSX(배경 닫기 `/>` 자기 닫힘 포함) | `findJsxOpeningTags`가 한 태그로 읽는다 | T-1 |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.**

- 새 파일은 `scripts/a11yRoleLabelGuard.test.ts` 하나다. `node:test`의 `it`, `node:assert/strict`, `node:fs`, `node:path`, `node:url`, `./a11yAriaStateGuard`만 import한다.

| ID | 테스트 이름 | 기대 | STEP 1 직후 |
|----|------------|------|------------|
| T-1 | `84 T-1: every pressable has a role or is hidden from accessibility` | 6.3 버튼 규칙 위반 `[]` | **실패**(1장 13곳) |
| T-2 | `84 T-2: episode progress quick buttons keep their handlers` | `EpisodeProgressCard.tsx`에서 `changeDraft(0)`·`changeDraft(upperBound)`·`onPress={reset}`을 가진 `Pressable` 태그가 각각 1개이고, 모두 `accessibilityRole="button"`을 포함한다 | **실패** |
| T-3 | `84 T-3: personalized recommendation actions keep their labels` | `PersonalizedRecommendationListItem.tsx`의 `관심 없음`·`비슷한 작품 더 보기`·`빠른 보기` 이름을 가진 `Pressable` 태그가 모두 `accessibilityRole="button"`을 포함하고, 이름 문자열이 그대로다 | **실패** |
| T-4 | `84 T-4: every text input has an accessible name` | 6.3 입력 규칙 위반 `[]` | **실패**(`ContentReviewEditor` 2곳) |
| T-5 | `84 T-5: review inputs are named after their visible headings` | `onChangeText={setOneLineReview}` 태그에 `accessibilityLabel="한줄 후기"`, `onChangeText={setBody}` 태그에 `accessibilityLabel="소감"` | **실패** |
| T-6 | `84 T-6: guard ignores type arguments and spread inputs` | 가드 판정 함수에 `<TextInput>`(타입 인자)과 `<TextInput {...inputProps} ref={inputRef}>`를 넣으면 위반 0, `<TextInput placeholder="x">`는 위반 1, `<Pressable accessible={false} onPress={f}>`는 위반 0, `<Pressable onPress={f}>`는 위반 1 | 통과(판정 함수 단위 테스트) |

- T-6을 위해 판정은 테스트 파일 안의 작은 함수 `roleLabelViolations(ownText: string): ("role" \| "label")[]`로 둔다. T-1·T-4도 이 함수를 쓴다.
- 기준선은 1,870개 통과다. STEP 1 직후에는 1,876개 중 1,871개 통과·5개 실패(T-1~T-5)다. 목표는 **1,876개 통과**다.
- 다른 작업이 같은 작업 트리에서 테스트를 늘렸다면 시작 기준선 N을 기록하고 N+6을 목표로 한다.

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `scripts/a11yRoleLabelGuard.test.ts` | 새 파일. T-1~T-6 |
| `src/components/content/EpisodeProgressCard.tsx` | 역할 3곳 |
| `src/components/content/PersonalizedRecommendationListItem.tsx` | 역할 4곳 |
| `src/components/library/LibraryFilterBottomSheet.tsx` | 역할 2곳 |
| `src/components/content/RecommendationExclusionSheet.tsx` | 역할 1곳 |
| `src/components/content/ThemeReductionSheet.tsx` | 역할 1곳 |
| `src/components/content/SimilarContentQuickViewModal.tsx` | 역할 1곳(배경 `Pressable`) |
| `app/people/[id].tsx` | 역할 1곳 |
| `src/components/content/ContentReviewEditor.tsx` | 입력칸 이름 2곳 |
| `docs/00_ui_style_rules.md` | UI-13.2 끝에 한 문장: "`Pressable` 역할·`TextInput` 이름은 `npm test`의 `a11yRoleLabelGuard`가 저장소 전체를 확인한다(docs/84)." |
| `docs/development_next_steps.md` | 맨 위에 docs/84 절 추가 |
| `docs/README.md` | 84번 줄 상태 갱신 |

## 12. 범위 밖

- 배경 닫기를 낭독기에서 뺄지(`accessible={false}`) 화면별로 통일하는 일.
- 토큰 규칙(UI-1.1·1.2) 위반 정리. 2026-11-20 기준 `.tsx` 46개 파일에 518줄이 있다. 화면이 바뀌는 큰 작업이라 별도로 다룬다.
- 같은 이름이 두 번 나오는 카드(개인화 추천 카드 본문과 "빠른 보기" 버튼이 같은 이름). 동작이 같아 이번에는 두지 않는다.
- `aria-disabled` 추가(1장 끝).
- 아이콘·글자·스타일·문구 변경.

## 13. 확실하지 않음 — 별도 검증 필요

- iOS에서 시트 배경이 화면 전체를 덮는 버튼으로 읽힐 때 VoiceOver 탐색 순서가 어떻게 되는지는 M-4로 본다. 문제가 있으면 12장 첫 항목으로 따로 다룬다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 이번 작업은 **정정 작업**이다. 역할(`accessibilityRole`)이 빠진 `Pressable` 13곳에 `accessibilityRole="button"`을 더하고, 후기 입력칸 2개에 보이는 제목과 같은 이름을 준다. 같은 실수를 잡는 저장소 전체 가드 테스트를 더한다. 보이는 화면과 동작은 바뀌지 않는다.

| ID | 결함 |
|----|------|
| F-1 | 누를 수 있는 `Pressable` 13곳이 웹·앱 낭독기에 버튼으로 알려지지 않는다 |
| F-2 | 후기 작성 입력칸 2개에 이름이 없어 placeholder만 읽힌다 |

# READ FIRST
1. `docs/84_button_role_and_review_input_label_fixes_spec.md` — 이 명세. 1장 대상 표, D-1~D-4, 6장 계약, E-1~E-8, T-1~T-6.
2. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙(UI-4.4).
3. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
4. `scripts/a11yAriaStateGuard.ts`(`findJsxOpeningTags`), `scripts/castSectionA11y.test.ts`(소스 검사 예).

# 시작 상태 (반드시 유지)
- `npm test` 1,870개 통과, `typecheck`·`lint` 통과. 다르면 실제 기준선 N을 기록한다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 각 대상 태그에 `accessibilityRole="button"` **한 속성만** 더한다. 이름·`onPress`·`disabled`·`aria-*`·`ref`·스타일·자식은 바꾸지 않는다. `selectionAriaProps`를 쓰지 않는다. `FilterSheet.tsx`는 바꾸지 않는다.
- **D-2.** 후기 입력칸 이름은 정확히 "한줄 후기"·"소감"이다. placeholder는 그대로다.
- **D-3.** 가드는 6.3 판정 순서대로 저장소 전체를 본다. 예외 목록(허용 목록)을 두지 않는다.
- **D-4.** `scripts/a11yAriaStateGuard.ts`는 바꾸지 않는다.
- DB 마이그레이션을 만들지 않는다.

# STEP 1 — 실패하는 테스트부터
1. `scripts/a11yRoleLabelGuard.test.ts`에 10장 T-1~T-6을 그대로 옮긴다.
2. `npm test`를 돌려 **T-1~T-5만 실패**하는지(1,876개 중 1,871개 통과) 눈으로 확인한다.
3. T-1 실패 출력의 위반 목록이 1장 표 13곳과 같은지, T-4가 `ContentReviewEditor` 2곳인지 확인한다. 다르면 멈추고 보고한다.

# STEP 2 — 버튼 역할 (F-1)
1장 표 13곳에 6.1대로 `accessibilityRole="button"`을 더한다. `npm test`에서 T-4·T-5만 실패하는지 확인한다.

# STEP 3 — 후기 입력칸 이름 (F-2)
6.2대로 고친다. `npm test` 1,876개가 모두 통과하는지 확인한다.

# STEP 4 — 기록
- `docs/00_ui_style_rules.md` UI-13.2 끝에 11장의 한 문장을 더한다.
- `docs/development_next_steps.md` 맨 위에 `## 버튼 역할·후기 입력칸 이름 정정 (docs/84, <날짜>)` 절을 추가한다. 상태, 테스트 before/STEP 1/after, 수동 확인 결과 또는 미실행 사유를 적는다.
- `docs/README.md`의 84번 줄 상태를 "구현, 화면 미확인"으로 바꾼다. 화면을 실제로 봤다면 그 결과대로 적는다.

# 엣지 케이스 (전부 처리, 명세서 9장)
E-1~E-8 전부.

# 수동 확인
UI 규칙 준수(UI-1~UI-13). 화면 고유 확인만 적는다. 로그인이 필요한 화면을 볼 수 없으면 대신 로그인하지 말고 미실행으로 보고한다. 저장·상태 변경 버튼은 누르지 않는다(속성만 확인).

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 작품 상세: "아직 안 봄"·"전부 봤음"·"되돌리기"가 `role="button"`, 후기 입력칸이 `aria-label="한줄 후기"`·`"소감"` |
| M-2 | 웹 1440 | 검색의 개인화 추천 목록 보기: 카드·관심 없음·비슷한 작품·빠른 보기가 `role="button"` |
| M-3 | 웹 375 | 라이브러리 필터 시트: 머리글 닫기·배경이 `role="button"`이고, 배경을 누르면 시트가 닫힌다 |
| M-4 | 앱(iOS 세로) | VoiceOver가 위 버튼을 "…, 버튼"으로, 후기 입력칸을 "한줄 후기, 텍스트 필드"로 읽는다. 시트 배경의 탐색 순서를 적는다 |

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
기준선 1,870개 통과, 목표 1,876개 통과. 기존 테스트는 하나도 깨지지 않아야 한다.

# DEFINITION OF DONE
- [ ] STEP 1에서 T-1~T-5가 실패하고 위반 목록이 1장 표와 같았으며, STEP 3 뒤 T-1~T-6이 모두 통과한다
- [ ] `npm test` 1,876개(또는 N+6개) 통과, 기존 테스트 개수가 줄지 않았다
- [ ] `typecheck`·`lint` 통과
- [ ] 바뀐 줄은 `accessibilityRole="button"` 13개와 `accessibilityLabel` 2개뿐이다(문서·새 테스트 제외)
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(이번에 바꾼 줄 기준)
- [ ] 웹·앱 수동 확인 표(M-1~M-4) 결과 또는 미실행 사유를 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
scripts/a11yRoleLabelGuard.test.ts
src/components/content/EpisodeProgressCard.tsx
src/components/content/PersonalizedRecommendationListItem.tsx
src/components/library/LibraryFilterBottomSheet.tsx
src/components/content/RecommendationExclusionSheet.tsx
src/components/content/ThemeReductionSheet.tsx
src/components/content/SimilarContentQuickViewModal.tsx
app/people/[id].tsx
src/components/content/ContentReviewEditor.tsx
docs/00_ui_style_rules.md
docs/development_next_steps.md
docs/README.md
```

# 보고 항목
1. STEP 1에서 실패한 T-1~T-5의 실제 출력(T-1·T-4 위반 목록 포함)
2. `npm test` 결과 (before / STEP 1 / STEP 2 / after 통과·실패 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. 소스 파일 diff 요약(파일별 추가 줄 수)
6. 수동 확인 M-1~M-4 결과 또는 미실행 사유
7. D-1~D-4 중 문제가 있다고 판단한 항목 (바꾸지는 말고 보고만)
8. 사람이 해야 할 후속 작업

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.** 가드에 허용 목록을 넣지 않는다.
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
