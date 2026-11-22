# 94. 핀 태그 입력 오류·편의성 보완 명세

작성일: 2026-11-22
대상 브랜치 기준: main (0ca4651) + 미커밋 docs/84~93 작업
선행 문서: [86 감상 작성 중 이탈 보호](86_review_draft_leave_guard_fixes_spec.md), [89 오프라인 저장 갇힘 정정](89_offline_save_trap_fixes_spec.md)

## 1. 문제 정의

UI 편의성과 오류를 점검하다가 핀 작성 화면의 태그 입력에서 발견했다. 핀은 앱의 핵심 기록이고, 태그는 핀 탭의 태그 필터(`app/(tabs)/pins.tsx:221`)로 다시 찾는 수단이다.

| ID | 증상 | 종류 | 심각도 |
|----|------|------|--------|
| F-1 | 태그 칸에 "액션"을 쓰고 "추가"나 Enter 없이 바로 "저장"을 누르면, 그 태그가 **조용히 버려진다**. 저장 성공 토스트가 뜨므로 사용자는 모른다. 편집 화면도 같다. | 오류 | 높음 |
| F-2 | 앞에 "#"를 붙여 "#액션"으로 쓰면 `#액션`으로 저장되고 칩은 "##액션"으로 보인다. 칩이 "#"를 붙여 보여 주므로 사용자가 따라 쓰기 쉽다. 태그 필터에서 "액션"과 "#액션"이 다른 태그가 된다. | 오류 | 중간 |
| F-3 | "액션, 감동"처럼 쉼표로 여러 개를 쓰면 끝 쉼표만 지우고 **"액션, 감동" 한 개 태그**가 된다. | 오류 | 중간 |
| F-4 | 이미 쓴 태그를 매번 다시 타이핑해야 한다. "액션"과 "액션씬"처럼 표기가 흩어지면 핀 탭 태그 필터가 둘로 갈린다. 이미 쓴 태그 목록은 핀 탭이 쓰는 `useTags`로 이미 받아 둔다. | 편의성 | 중간 |
| F-5 | 앱에서 Enter(완료)로 태그를 추가하면 키보드가 닫혀, 다음 태그를 쓰려면 칸을 다시 눌러야 한다. 안내 문구 "태그 입력 후 Enter"는 휴대폰 키보드에 맞지 않는다. 자동 대문자·자동 수정도 켜져 있다(UI-5.3). | 편의성 | 낮음 |
| F-6 | 저장 실패 문구(`:333`)가 화면 낭독기에 알려지지 않는다(UI-4.7). 메모·태그 칸의 placeholder 색이 규칙 색이 아니다(UI-5.2). | 접근성 | 낮음 |

**사용자 작업 단계 비교 (F-4)**: 이미 쓴 "감정선" 태그를 다시 붙이는 경우
- 지금: 칸 누르기, 3글자 입력, Enter, (다음 태그면 칸 다시 누르기)
- 보완 후: 후보 칩 한 번 누르기

## 2. 근본 원인

모두 `src/components/pins/PinComposer.tsx`에 있다.

1. **F-1**: `save`(`:147-202`)는 `tagNames: draft.tags`(`:162`)만 보낸다. 입력 중인 `tagInput`(`:56`)은 보지 않는다. 변경 판정(`isPinDraftDirty(draft, initialDraft, tagInput)`)은 `tagInput`을 보므로 이탈 때는 묻는다. 하지만 저장은 그 값을 버리고 `leave(() => onSuccess(pin))`로 나간다.
2. **F-2·F-3**: `addTag`(`:137-145`)는 `tagInput.trim().replace(/,$/, "")`만 한다. 앞의 "#"와 중간 쉼표를 처리하지 않는다. 서버 RPC(`save_timeline_pin`)도 이름을 그대로 저장한다.
3. **F-4**: 태그 칸 근처에 기존 태그를 보여 주는 요소가 없다.
   - `useTags`(`src/hooks/useTags.ts:7-16`, `getTags`는 이름순 전체)는 핀 탭에서만 쓴다.
   - `Tag`에는 `created_at`이 있다(`src/types/pins.ts:15-20`).
4. **F-5**: 태그 `TextInput`(`:272-280`)에 `returnKeyType`·`autoCapitalize`·`autoCorrect`·`submitBehavior`/`blurOnSubmit`이 없다.
   - 한 줄 입력은 기본으로 제출 때 키보드를 닫는다(RN 0.81, react-native-web 0.21 `blurOnSubmit` 기본값).
   - placeholder는 `:277`이다.
5. **F-6**:
   - `:333` 오류 문구에 `accessibilityLiveRegion`이 없다(같은 화면의 `tagError`는 `accessibilityRole="alert"`).
   - 메모(`:261`)·태그(`:277`) 칸에 `placeholderTextColor`가 없다.

## 3. 재현 시나리오

1. 테스트 계정에서 검증용 작품의 핀 작성을 연다. 시간 `1432`, 태그 칸에 `감정선`을 쓰고 "추가" 없이 "저장"을 누른다. 저장된 핀에 태그가 없다(F-1).
2. 태그 칸에 `#액션`을 추가하면 칩이 "##액션"이다(F-2).
3. `액션, 감동`을 추가하면 칩 하나 "#액션, 감동"이다(F-3).
4. 휴대폰에서 태그를 Enter로 추가하면 키보드가 닫힌다(F-5).

## 4. 설계 결정

### D-1. 저장할 때 입력 중인 태그도 함께 저장한다 (최우선)
- `save`는 서버 확인(`getPinContext`) 전, 기존 입력 검증 단계에서 `tagInput`에 글자가 있는지 본다. 있으면 D-2 규칙으로 `draft.tags`에 합친다.
- 합치기가 실패하면(20자 초과·10개 초과) 저장하지 않는다. 그 오류를 `tagError`에 보이고 태그 칸에 포커스한다.
- 성공하면 합친 목록을 `tagNames`로 보내고, `draft.tags`를 갱신하고, `tagInput`을 비운다.
- 이미 있는 태그만 쓴 경우("이미 추가한 태그입니다.")는 저장을 막지 않는다. 입력을 비우고 그대로 저장한다(보낼 목록이 같으므로).
- 입력만 있고 칸을 비운 것과 같은 공백뿐이면 무시한다.

### D-2. 태그 입력은 한 순수 함수로 해석한다
새 순수 함수 `addTagsFromInput(current, raw)`(`src/utils/pinTagInput.ts`)를 "추가" 버튼, Enter, 저장(D-1), 후보 누르기(D-3)가 모두 쓴다.
- 쉼표(`,` `，`)와 줄바꿈으로 나눈다. 각 조각은 공백을 자르고 앞의 `#`를 모두 지운 뒤 다시 공백을 자른다. 빈 조각은 버린다.
- 같은 입력 안의 중복과 이미 있는 태그는 건너뛴다.
- 새 조각 중 하나라도 20자를 넘으면 아무것도 추가하지 않고 `"태그는 20자까지 입력할 수 있어요."`.
- 추가 후 10개를 넘으면 아무것도 추가하지 않고 `"태그는 10개까지 추가할 수 있어요."`.
- 조각이 하나도 없으면 `"태그를 입력해 주세요."`.
- 조각이 모두 이미 있는 태그면 추가 없이 `"이미 추가한 태그입니다."`.
- 문구는 지금 `:140`의 네 문구와 같다(새 문구 없음). 대소문자는 바꾸지 않는다. 비교는 정확히 같은 문자열로 한다(서버 `tags(user_id, name)` 유일성과 같음).

### D-3. 이미 쓴 태그를 후보 칩으로 보여 준다
- 태그 칸 아래에 `suggestPinTags(allTags, added, input)`가 돌려준 후보를 최대 8개 보인다. 누르면 그 태그를 추가한다.
- 입력이 비어 있으면 최근에 만든 순(`created_at` 내림차순)이다.
- 입력이 있으면 입력의 **마지막 쉼표 뒤** 조각(앞 `#`·공백 제거, 소문자 비교)을 포함하는 태그만 고른다. 그 조각으로 시작하는 것이 먼저, 그다음 이름순이다.
- 이미 추가한 태그는 빼고, 추가한 태그가 10개면 후보를 숨긴다.
- 목록은 `useTags()`를 그대로 쓴다. 새 서버 호출·쿼리 키는 없다. 불러오는 중이거나 실패하면 후보 영역을 숨긴다. 오류 문구는 없다(입력은 그대로 가능).
- 후보를 누르면 입력 칸의 마지막 쉼표 뒤 조각을 지운다. 앞부분에 남은 조각은 그대로 둔다.

### D-4. 태그 칸은 연속 입력에 맞춘다
- `returnKeyType="done"`, `autoCapitalize="none"`, `autoCorrect={false}`를 준다.
- 제출 때 키보드를 유지한다(`submitBehavior="submit"`와 웹용 `blurOnSubmit={false}`).
- placeholder는 `"태그 입력 (쉼표로 여러 개)"`, 색은 규칙 색이다.

### D-5. 접근성·토큰 보정
- `:333` 저장 오류에 `accessibilityLiveRegion="polite"`를 준다.
- 메모·태그 칸에 `placeholderTextColor={colors.textSubtle}`를 준다.
- 다른 스타일은 바꾸지 않는다.

### D-6. 기존 계약은 그대로다
- 이탈 보호(`isPinDraftDirty`·`usePreventRemove`), 오프라인 확인, 저장 순서, `client_request_id`, 서버 RPC·DB는 바꾸지 않는다.
- 이미 저장된 `#` 붙은 태그는 고치지 않는다(12장).

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| 입력 중 태그가 있으면 저장을 막고 "추가를 누르세요" 안내 | 사용자가 의도한 값을 한 번 더 확인시킨다. 저장에 포함하면 한 단계 줄어든다 |
| 서버(RPC)에서 `#` 제거·쉼표 분리 | DB 함수 변경과 마이그레이션이 필요하다. 화면 입력 단계에서 막으면 충분하다 |
| 사용 횟수순 후보 | 핀-태그 집계 조회가 새로 필요하다. 최근 만든 순과 입력 일치로 충분하다 |
| 대소문자 무시 중복 판정 | 서버 유일성(`user_id, name`)과 달라 저장 결과와 화면이 어긋난다 |
| 쓰이지 않는 태그 숨기기 | 집계 조회가 필요하다(12장) |

## 6. 계약

```ts
// src/utils/pinTagInput.ts (신규, 순수 — RN import 금지)
import type { Tag } from "@/types/pins";

export const PIN_TAG_LIMITS = { maxLength: 20, maxCount: 10, maxSuggestions: 8 } as const;
export const PIN_TAG_COPY = {
  empty: "태그를 입력해 주세요.",
  tooLong: "태그는 20자까지 입력할 수 있어요.",
  duplicate: "이미 추가한 태그입니다.",
  tooMany: "태그는 10개까지 추가할 수 있어요.",
  placeholder: "태그 입력 (쉼표로 여러 개)",
  suggestionsLabel: "내 태그"
} as const;

export function splitTagInput(raw: string): string[];
// 쉼표(, ，)·줄바꿈으로 나눔 → trim → 앞 # 모두 제거 → trim → 빈 값 제거 → 입력 순서 유지 중복 제거

export function addTagsFromInput(current: readonly string[], raw: string): { tags: string[]; error: string | null };
// 판정 순서: 조각 0개 → empty / 새 조각(current에 없는 것) 0개 → duplicate(tags=current)
//           / 새 조각 중 20자 초과 → tooLong(tags=current) / current+새 조각 > 10 → tooMany(tags=current)
//           / 그 밖 → { tags: [...current, ...새 조각], error: null }

export function lastTagFragment(raw: string): string;
// 마지막 쉼표·줄바꿈 뒤 조각에서 앞 #·공백 제거

export function removeLastTagFragment(raw: string): string;
// 마지막 쉼표·줄바꿈까지 남기고 그 뒤를 지움(쉼표가 없으면 "")

export function suggestPinTags(all: readonly Pick<Tag, "name" | "created_at">[], added: readonly string[], raw: string): string[];
// added.length >= 10 → [] / added에 있는 이름 제외
// q = lastTagFragment(raw).toLowerCase()
// q 없음 → created_at 내림차순(같으면 이름순) / q 있음 → name.toLowerCase().includes(q)만, startsWith 먼저, 그다음 이름순(localeCompare "ko")
// 앞 8개의 name
```

`PinComposer` 연결:
- `addTag`(`:137-145`): `addTagsFromInput(draft.tags, tagInput)`.
  - 오류이면 `setTagError(error)`. duplicate일 때도 `tagInput`은 그대로 둔다(지금 동작).
  - 성공이면 `draft.tags` 갱신, `tagInput` 비움, `tagError` 비움.
- `save`(`:147`~): 오프라인 확인 다음, 시간 검증 전에 실행한다.
  - `tagInput.trim()`이 있으면 `addTagsFromInput`을 부른다.
  - duplicate는 `tags=current`로 계속 진행하고 `tagInput`을 비운다.
  - empty(공백·`#`·쉼표뿐)도 계속 진행한다.
  - tooLong·tooMany는 `setTagError` 후 태그 칸 포커스, return한다.
  - 그 뒤 `createPinSchema`와 payload의 `tagNames`는 합친 목록을 쓴다.
- 후보: 태그 칩 목록 아래에 `PIN_TAG_COPY.suggestionsLabel` 라벨과 후보 `TagChip`(`onPress`)을 그린다.
  - 누르면 `addTagsFromInput(draft.tags, name)`을 부르고 `setTagInput(removeLastTagFragment(tagInput))`를 한다.
  - `isSaving`이면 비활성이다.

## 7. 데이터 모델 / SQL

해당 없음.

## 8. 화면 명세

UI 규칙 준수(UI-1~UI-13). 핀 작성·편집 화면의 태그 영역만 바뀐다.

| 순서 | 요소 |
|------|------|
| 1 | 라벨 "태그 · 20자 / 최대 10개 (n/10)"(그대로) |
| 2 | `tagError`(그대로, `accessibilityRole="alert"`) |
| 3 | 입력 칸 + "추가"(그대로, D-4 속성) |
| 4 | 추가한 태그 칩(그대로) |
| 5 | **새**: 후보가 있을 때만 `typography.caption`·`colors.textMuted` 라벨 "내 태그" + 후보 칩 줄(줄바꿈). 칩은 기존 `TagChip`(`onPress`, 선택 표시 없음, 높이 44)을 쓴다. 칩 글자는 "#이름" 그대로다 |

후보 칩 낭독 라벨은 `TagChip`을 바꾸지 않고 보이는 글자("#이름")를 그대로 읽는다. 후보 줄 컨테이너에는 `accessibilityLabel="내 태그 후보"`를 준다.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 태그 입력 후 "추가" 없이 저장 | 그 태그 포함 저장, 입력 비움 | T-2, T-6, M-1 |
| E-2 | 입력 "#액션" | 태그 "액션" | T-1, M-1 |
| E-3 | 입력 "액션, 감동，여운" | 태그 3개 | T-1, M-1 |
| E-4 | 입력 ",,#, " | 추가 없음, "태그를 입력해 주세요." / 저장 시에는 무시하고 진행 | T-2, T-6 |
| E-5 | 이미 "액션" 있음, 입력 "액션, 감동" | "감동"만 추가 | T-2 |
| E-6 | 입력이 모두 기존 태그 | 추가 시 "이미 추가한 태그입니다." / 저장 시 진행 | T-2, T-6 |
| E-7 | 9개 있음, 입력 "a, b" | 추가 없음, "10개까지" / 저장 시 저장 막고 태그 칸 포커스 | T-2, T-6 |
| E-8 | 21자 조각 포함 | 추가 없음, "20자까지" / 저장 시 저장 막음 | T-2, T-6 |
| E-9 | 기존 태그 없음·불러오는 중·실패 | 후보 영역 없음, 입력은 그대로 | T-3, M-2 |
| E-10 | 입력 "감" | "감정선", "감동"처럼 "감"으로 시작하는 태그 먼저, 그다음 포함하는 태그 | T-3 |
| E-11 | 입력 "액션, 감" 상태에서 후보 "감정선" 누름 | "감정선" 추가, 입력은 "액션, " | T-4, M-2 |
| E-12 | 태그 10개 | 후보 숨김 | T-3 |
| E-13 | 휴대폰 Enter로 추가 | 키보드 유지, 다음 태그 바로 입력 | T-5, M-3 |
| E-14 | 저장 중 | 입력·후보·추가 비활성 | T-5 |
| E-15 | 기존 `#` 붙은 저장 태그(편집) | 그대로 표시·유지(D-6) | — |

## 10. 테스트 표

새 파일 `src/utils/pinTagInput.test.ts`에 둔다. `node:test`와 `node:assert/strict`를 쓴다. import 범위는 다음과 같다.
- 순수 `pinTagInput`
- 소스 문자열 검사용 `node:fs`

RN·expo·Supabase는 import하지 않는다.

| ID | 이름 | 내용 | 수정 전 |
|----|------|------|---------|
| T-1 | 94 T-1: tag input splits commas and strips hashes | `splitTagInput`의 기대값은 다음과 같다. `"#액션"`→`["액션"]`, `"액션, 감동，여운"`→`["액션","감동","여운"]`, `"  ##감정선 "`→`["감정선"]`, `"a,\nb"`→`["a","b"]`, `",,#, "`→`[]`, `"액션,액션"`→`["액션"]`, `"Action"`→`["Action"]`(대소문자 유지) | 실패(모듈 없음) |
| T-2 | 94 T-2: adding tags follows the existing limits and copy | `addTagsFromInput`의 기대값은 다음과 같다. ([], "액션")→추가. (["액션"], "액션, 감동")→`["액션","감동"]`. (["액션"], "액션")→duplicate, tags 그대로. ([], ",,")→empty. 9개+"a, b"→tooMany, 그대로. ([], "가".repeat(21))→tooLong. ([], "a, " + "가".repeat(21))→tooLong, a도 추가 안 됨. `PIN_TAG_COPY`의 네 오류 문구가 6장과 정확히 같다 | 실패 |
| T-3 | 94 T-3: suggestions prefer recent tags, then matches | `suggestPinTags`의 기대값은 다음과 같다. 입력 없음이면 created_at 내림차순 최대 8개이고 이미 추가한 이름은 빠진다. `"감"`이면 startsWith 먼저, 그다음 포함, 각 이름순이다. `"#감"`도 `"감"`과 같다. `"액션, 감"`이면 마지막 조각 "감"으로 고른다. added 10개면 `[]`, all `[]`이면 `[]` | 실패 |
| T-4 | 94 T-4: picking a suggestion clears only the last fragment | `lastTagFragment("액션, #감")==="감"`, `removeLastTagFragment("액션, 감")==="액션, "`, `removeLastTagFragment("감")===""`, `removeLastTagFragment("a\nb")==="a\n"` | 실패 |
| T-5 | 94 T-5: the tag field keeps the keyboard and uses the shared parser | `PinComposer.tsx` 소스 검사. `addTagsFromInput(`, `suggestPinTags(`, `useTags(`, `submitBehavior="submit"`, `blurOnSubmit={false}`, `autoCapitalize="none"`, `autoCorrect={false}`, `PIN_TAG_COPY.placeholder`가 있다. `"태그 입력 후 Enter"`와 `.replace(/,$/, "")`는 없다. 저장 오류 `<Text`에 `accessibilityLiveRegion="polite"`가 있다. 메모·태그 `TextInput`에 `placeholderTextColor={colors.textSubtle}`가 있다 | 실패 |
| T-6 | 94 T-6: save merges a pending tag before validation | `PinComposer.tsx`의 `save` 본문 소스 검사. `isNetworkOffline(` 다음, `resolveTimecodeInput(`보다 앞에 `addTagsFromInput(draft.tags, tagInput)`가 있다. `createPinSchema.safeParse`의 `tagNames:`가 `draft.tags`가 아닌 합친 목록 변수다 | 실패 |
| 보존 | 89 T-1~T-4(오프라인 확인 순서 포함), 93 T-1~T-6(구현되어 있으면), `pinDraft`·`pinSave`·`a11yRoleLabelGuard`, 기존 전체 | 그대로 통과 | 통과 |

**수동 확인 (UI-14.3)**

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 검증용 작품에서 E-1~E-3을 확인한다. 저장된 핀 상세에서 태그가 맞다. 확인 뒤 검증용 핀을 삭제한다. |
| M-2 | 웹 375 | 기존 태그가 있는 계정에서 후보가 보이고, 입력에 따라 좁혀지고, 눌러 추가된다(E-11). 줄바꿈되며 가로 넘침이 없다. Tab으로 후보에 이동해 Enter로 추가된다. |
| M-3 | iOS 세로 | Enter("완료")로 태그를 연속 추가할 때 키보드가 유지된다. 자동 대문자가 없다. 키보드가 후보·저장 버튼을 가리지 않는다. 실행 환경이 없으면 미실행 사유를 보고한다. |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/pinTagInput.ts` | 신규(D-2, D-3) |
| `src/utils/pinTagInput.test.ts` | 신규 T-1~T-6 |
| `src/components/pins/PinComposer.tsx` | `addTag`·`save`·태그 칸·후보·D-5 |
| `docs/development_next_steps.md`, `docs/README.md` | 작업 기록·94행 상태 |

`TagChip.tsx`, `useTags.ts`, 서비스·서버는 바꾸지 않는다.

## 12. 범위 밖

- 이미 저장된 `#` 붙은 태그·쉼표 든 태그 정리(DB). 필요하면 사람이 별도로 결정한다.
- 쓰이지 않는 태그 정리·숨기기, 태그 이름 바꾸기·합치기 화면.
- 핀 탭 태그 필터 UI 변경.
- 감상 편집기의 placeholder 색(`ContentReviewEditor.tsx:223, :238`)·인물 화면(`app/people/[id].tsx:513`) 같은 다른 화면의 같은 토큰 차이. 해당 화면을 고칠 때 함께 다룬다.

## 13. 확실하지 않음 — 별도 검증 필요

- RN 0.81의 `submitBehavior="submit"`가 iOS·Android 한 줄 입력에서 키보드를 실제로 유지하는지. 문서상 그렇다. M-3로 확인한다. 웹은 react-native-web 0.21의 `blurOnSubmit={false}`로 유지된다(`TextInput/index.js:274-284`).
- `getTags`는 사용자의 전체 태그를 한 번에 읽는다. 태그가 매우 많은 사용자(수천 개)의 성능은 확인하지 않았다. 지금 핀 탭도 같은 조회를 쓴다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 핀 작성·편집 화면의 태그 입력을 고친다. 정정·편의성 보완 작업이다.
- 입력 중 태그가 저장 때 버려지는 오류를 고친다.
- `#`와 쉼표를 처리한다.
- 이미 쓴 태그를 후보로 보여 준다.
- 연속 입력 키보드, 접근성·토큰을 보완한다.

| ID | 결함 |
|----|------|
| F-1 | "추가" 없이 저장하면 입력 중 태그가 조용히 버려진다 |
| F-2 | "#액션"이 "##액션"으로 저장·표시된다 |
| F-3 | "액션, 감동"이 태그 하나가 된다 |
| F-4 | 이미 쓴 태그를 매번 다시 타이핑한다 |
| F-5 | 앱에서 Enter로 추가하면 키보드가 닫히고, 안내 문구가 휴대폰에 맞지 않는다 |
| F-6 | 저장 오류가 낭독되지 않고, placeholder 색이 규칙과 다르다 |

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙(UI-4.7, UI-5.2, UI-5.3).
2. `docs/94_pin_tag_input_fixes_spec.md` — 이 명세. D-1~D-6, 9장 E-1~E-15, 10장 테스트 표.
3. `AGENTS.md` — 테스트 규칙. 테스트 파일에서 React Native·expo·Supabase 모듈을 import하면 실행이 깨진다.
4. `src/components/pins/PinComposer.tsx`(:56, :112-115, :137-202, :252-300, :333), `src/components/pins/TagChip.tsx`, `src/hooks/useTags.ts`, `src/types/pins.ts`(:15-20), `src/utils/validation.ts`(:42).

# 시작 상태 (반드시 유지)
- 시작할 때 `npm test` 통과 개수를 기록한다. docs/93이 구현됐으면 1,951개보다 많다.
- docs/84~93 미커밋 변경을 보존한다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 저장할 때 입력 중 태그를 합친다. 길이·개수 오류면 저장하지 않고 태그 오류를 보인다. duplicate·empty는 저장을 막지 않는다. 오프라인 확인(docs/89)보다 뒤, 시간 검증보다 앞이다.
- **D-2.** 태그 해석은 `addTagsFromInput` 하나로 한다. 오류 문구 네 개는 지금 문구 그대로다. 대소문자를 바꾸지 않는다.
- **D-3.** 후보는 `useTags()` 결과만 쓴다. 새 쿼리·서비스·서버 변경은 금지다.
- **D-6.** 이탈 보호·저장 순서·`client_request_id`·서버 RPC·DB·`TagChip`·`useTags`는 바꾸지 않는다.

# STEP 1 — 실패하는 테스트부터
`src/utils/pinTagInput.test.ts`에 10장 T-1~T-6을 쓴다. `npm test`로 T-1~T-6이 실패하는 것을 눈으로 확인한다. 실패하지 않는 행이 있으면 멈추고 보고한다.

# STEP 2 — 순수 함수
6장 계약대로 `src/utils/pinTagInput.ts`를 만든다. T-1~T-4가 통과한다.

# STEP 3 — 화면 연결
- 6장 "PinComposer 연결"과 8장대로 `addTag`·`save`·태그 칸(D-4)·후보 줄(D-3)·D-5를 바꾼다.
- `save`에서 태그 오류로 멈출 때는 태그 입력 ref를 새로 두고 포커스한다(시간·메모 포커스와 같은 방식).
- T-5·T-6과 전체 테스트가 통과한다.

# 엣지 케이스 (전부 처리, 명세 9장)
9장 표 E-1~E-15 전부.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(기준선: 시작 때 기록한 값). Node 24가 필요하면 `scenenote-verify`의 `--node-bin` 방식을 쓴다.

# DEFINITION OF DONE
- [ ] T-1~T-6이 수정 전에 실패하는 것을 확인했고 수정 후 통과한다.
- [ ] 기존 테스트 개수가 줄지 않았고, 기존 assertion을 바꾸지 않았다.
- [ ] "추가" 없이 저장해도 태그가 저장된다(M-1).
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(바꾼 줄 기준).
- [ ] 웹·앱 수동 확인 표(M-1~M-3)를 보고했다. 실행하지 못한 행은 사유를 적는다.
- [ ] typecheck·lint 오류 0.

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/pinTagInput.ts
src/utils/pinTagInput.test.ts
src/components/pins/PinComposer.tsx
docs/development_next_steps.md
docs/README.md
```
`docs/README.md`는 94행 상태 칸만, `docs/development_next_steps.md`는 맨 위 작업 기록만 고친다.

# 보고 항목
1. STEP 1 실패 테스트의 실제 출력
2. `npm test` before / after 통과 개수
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. 변경 diff 요약(파일별 줄 수)
6. M-1~M-3 결과 또는 미실행 사유
7. 13장 "확실하지 않음"에서 확인한 것
8. D-1~D-6 중 문제라고 본 항목(바꾸지 말고 보고만)
9. 사람이 할 후속 작업(웹 재빌드, 기존 `#` 태그 정리 여부 결정)

# 금지사항
- 배포 명령(`npx supabase functions deploy`, vercel 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다. 운영 DB에 쓰지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 의존성을 추가·변경하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- 수동 확인 때 사용자의 실제 핀·태그를 바꾸지 않는다. 검증용 핀만 만들고 삭제한다.
