# 91. 공유 링크의 스포일러 한줄 후기 가리기 명세

작성일: 2026-11-22
대상 브랜치 기준: main (0ca4651) + 미커밋 docs/84~90 작업
선행 문서: [88 공유 링크 관리·중지](88_library_share_link_management_spec.md), [90 앱 공유 진입점·중지 확인](90_native_share_availability_and_stop_check_fixes_spec.md)

## 1. 문제 정의

| ID | 증상 | 심각도 |
|----|------|--------|
| F-1 | 작품 상세 "내 감상"에서 "스포일러 포함"을 켜고 저장해도, 라이브러리 공유 링크를 받은 사람의 화면에 그 한줄 후기가 그대로 보인다. 링크를 받은 사람은 대개 그 작품을 아직 보지 않은 사람이다. | 중간 |
| F-2 | "스포일러 포함" 값은 저장만 되고 앱 어디에서도 쓰이지 않는다. 사용자가 켠 의도가 어떤 화면에도 반영되지 않는다. 다른 사람에게 보이는 곳은 공유 화면뿐이라 F-1만 고치면 된다. | F-1에 포함 |

## 2. 근본 원인

1. **서버가 스포일러 여부를 읽지 않는다.**
   - `supabase/functions/get-library-share/index.ts:124`는 후기를 `.select("content_id,rating,one_line_review")`로만 읽는다.
   - 응답 행 타입 `ReviewRow`(`:55-59`)에도, 응답 항목(`:182-183`)에도 스포일러 값이 없다.
   - DB에는 값이 있다. `reviews.is_spoiler BOOLEAN NOT NULL DEFAULT false`(`supabase/migrations/0001_initial_schema.sql:275`)이고, 편집기는 이 값을 저장한다(`ContentReviewEditor.tsx:170`).
2. **공유 카드는 후기를 무조건 보여 준다.**
   - `src/components/library/LibraryShareScreenContent.tsx:133`이 `createReviewLabel(item.rating, item.one_line_review)`로 문구를 만들고, `:151`에서 그대로 표시한다.
3. **핀에는 같은 문제의 해법이 이미 있다.**
   - `PinTimelineItem.tsx:26`에서 `pin.is_spoiler && !isSpoilerRevealed`이면 메모 대신 "스포일러 포함 · 보기" 버튼(`:54-61`)을 보여 준다.
   - 공유 카드에는 이 장치가 없다.

공유 화면이 쓰는 대체 경로 `getLibraryShareDirectly`(`src/services/libraryShare.ts:289`)는 함수 호출이 실패했을 때만 쓴다. 이 경로는 소유자 본인의 라이브러리를 읽으므로 받는 사람에게는 해당하지 않는다(12장).

## 3. 재현 시나리오

1. 테스트 계정에서 한 작품의 한줄 후기를 "결말에 주인공이 죽는다"로 쓰고 "스포일러 포함"을 켠 뒤 저장한다.
2. 라이브러리에서 그 작품이 들어간 필터로 공유 링크를 만든다.
3. 비로그인 창에서 링크를 연다. 카드에 "★ 8/10 · 결말에 주인공이…"가 그대로 보인다.

## 4. 설계 결정

### D-1. 서버는 스포일러 여부를 함께 보내고, 계약 버전은 올리지 않는다 (최우선)
- `get-library-share`가 후기를 읽을 때 `is_spoiler`를 더 읽는다.
- 각 항목에 `review_is_spoiler: boolean`을 더한다. 값은 `review?.is_spoiler === true`다.
- `contract_version`은 `"library-share-v2"` 그대로 둔다. 클라이언트는 이 값이 정확히 같지 않으면 오류를 내므로(`src/services/libraryShare.ts:274-276`), 올리면 기존 웹 번들이 공유 링크를 못 연다.
- 필드 추가만 하므로 배포 순서와 상관없이 안전하다. 서버만 먼저 바뀌면 기존 화면은 지금처럼 보인다. 웹만 먼저 바뀌면 필드가 없어 지금처럼 보인다.

### D-2. 받는 사람은 눌러서 볼 수 있다 (핀과 같은 방식)
- 서버가 한줄 후기 본문을 빼지 않는다. 스포일러는 비밀이 아니라 배려 장치다. 핀도 가린 뒤 누르면 보여 준다.
- 카드에는 별점만 보이고, 그 아래에 "스포일러 포함 · 보기" 버튼이 나온다. 누르면 그 카드만 기존 문구(`createReviewLabel`) 그대로 보인다.
- 펼친 상태는 카드별 화면 상태다. 저장하지 않고, 새로고침하면 다시 가려진다.

### D-3. 판정은 순수 함수 하나로 한다
새 순수 함수 `createSharedReviewView`(`src/utils/sharedReviewDisplay.ts`)로 판정한다.
- 가리는 조건은 `isSpoiler === true`이면서 한줄 후기에 공백이 아닌 글자가 있고 아직 펼치지 않았을 때뿐이다.
- 가릴 때 문구는 별점만 담은 `createReviewLabel(rating, null)`이다.
- 그 밖에는 지금과 같은 `createReviewLabel(rating, oneLineReview)`다.
- 스포일러지만 한줄 후기가 비어 있으면 가릴 것이 없으므로 버튼을 내지 않는다.

### D-4. 기존 표시·데이터 계약은 그대로다
- `createReviewLabel`(10자 자르기 포함), `LibraryListItem` 타입, 소유자 화면의 카드(`ContentCard`·`ContentGalleryCard`), 편집기는 바꾸지 않는다.
- 공유 응답 항목 타입은 `src/types/libraryShare.ts`에 `SharedLibraryItem = LibraryListItem & { review_is_spoiler?: boolean }`로 따로 두고, `LibraryShareDetail.items`만 이 타입으로 바꾼다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|-----------|
| 서버가 스포일러 한줄 후기를 아예 빼기 | 보고 싶은 사람도 볼 수 없다. 핀의 "눌러서 보기"와 다르다 |
| 계약 버전을 `library-share-v3`로 올리기 | 배포된 기존 웹이 "공유 서버가 아직 업데이트되지 않았어요"로 공유 링크를 못 연다 |
| `LibraryListItem`에 `review_is_spoiler` 추가 | 라이브러리·검색·추천 등 많은 곳의 타입이 바뀐다. 공유 응답에만 필요하다 |
| 공유를 만들 때 스포일러 후기를 빼고 만들기 | 공유는 실시간 조회라, 만든 뒤에 켠 스포일러는 반영되지 않는다 |
| 소유자 본인 카드에서도 가리기 | 본인이 쓴 후기라 가릴 이유가 없다 |

## 6. 계약

```ts
// src/utils/sharedReviewDisplay.ts (신규, 순수 — RN import 금지)
import { createReviewLabel } from "@/utils/reviewDisplay";

export const SHARED_REVIEW_COPY = {
  reveal: "스포일러 포함 · 보기"
} as const;

export interface SharedReviewView {
  label: string | null;   // 카드에 보일 별점·후기 문구 (없으면 null)
  spoilerHidden: boolean; // true면 "스포일러 포함 · 보기" 버튼을 보인다
}

export function createSharedReviewView(input: {
  rating: number | null | undefined;
  oneLineReview: string | null | undefined;
  isSpoiler: boolean | null | undefined;
  revealed: boolean;
}): SharedReviewView;
// hidden = input.isSpoiler === true && typeof input.oneLineReview === "string" && input.oneLineReview.trim() !== "" && !input.revealed
// hidden → { label: createReviewLabel(input.rating, null), spoilerHidden: true }
// else   → { label: createReviewLabel(input.rating, input.oneLineReview), spoilerHidden: false }

// src/types/libraryShare.ts
export type SharedLibraryItem = LibraryListItem & { review_is_spoiler?: boolean };
// LibraryShareDetail.items: SharedLibraryItem[]

// supabase/functions/get-library-share/index.ts
// ReviewRow에 is_spoiler: boolean | null
// .select("content_id,rating,one_line_review,is_spoiler")
// 항목에 review_is_spoiler: review?.is_spoiler === true  (one_line_review 바로 다음 줄)
// contract_version: "library-share-v2" 유지
```

## 7. 데이터 모델 / SQL

해당 없음. `reviews.is_spoiler`는 이미 있다. 마이그레이션은 없다.

## 8. 화면 명세

UI 규칙 준수(UI-1~UI-13). 공유 화면의 `SharedGalleryItem`(`LibraryShareScreenContent.tsx:129-160`)만 바꾼다.

| 상태 | 표시 |
|------|------|
| 스포일러 아님 | 지금과 같음(`:151`) |
| 스포일러, 별점 있음, 펼치기 전 | 별점 문구 한 줄(기존 `styles.review`) + 그 아래 "스포일러 포함 · 보기" 버튼 |
| 스포일러, 별점 없음, 펼치기 전 | 별점 줄 없이 버튼만 |
| 펼친 뒤 | 버튼이 사라지고 기존 문구(별점 · 한줄 후기) 한 줄 |

버튼 조건:
- `accessibilityRole="button"`, `accessibilityLabel`은 `` `스포일러 포함 한줄 후기 보기, ${item.title_primary}` ``다.
- 누를 수 있는 높이는 최소 44(UI 규칙 터치 크기)다.
- 모양은 핀의 `spoilerBox`·`spoilerText`(`PinTimelineItem.tsx:156-170`)와 같은 토큰(`colors.surfaceMuted` 배경, `colors.textMuted` 글자)을 쓴다. 카드 폭에 맞게 한 줄이고 넘치면 말줄임이다.
- 카드의 다른 요소(포스터, 제목, 배지)의 순서와 크기는 그대로다.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 스포일러 + 한줄 후기 + 별점 | 별점만 + 보기 버튼, 누르면 별점 · 후기 | T-1, M-1 |
| E-2 | 스포일러 + 한줄 후기, 별점 없음 | 버튼만, 누르면 후기 | T-1, M-1 |
| E-3 | 스포일러 + 한줄 후기 빈칸·공백 | 버튼 없음, 별점만(있으면) | T-1 |
| E-4 | 스포일러 아님 | 지금과 같음 | T-1 |
| E-5 | 후기 없음 | `review_is_spoiler=false`, 지금과 같음 | T-1, T-2 |
| E-6 | 새 서버 + 기존 웹 | 필드를 무시하고 지금처럼 보임, 링크는 열림 | T-2 |
| E-7 | 기존 서버 + 새 웹 | `review_is_spoiler`가 없으면 가리지 않음(지금과 같음) | T-1 |
| E-8 | 여러 카드 중 하나만 펼침 | 그 카드만 보이고 다른 카드는 가린 채 유지 | M-1 |
| E-9 | 새로고침 | 다시 가려짐 | M-1 |
| E-10 | 공유를 만든 뒤 스포일러를 켬 | 다음 열기부터 가려짐(공유는 실시간 조회) | M-2 |

## 10. 테스트 표

새 파일 `src/utils/sharedReviewDisplay.test.ts`에 둔다. `node:test`와 `node:assert/strict`를 쓴다. import 범위는 다음과 같다.
- 순수 `sharedReviewDisplay`·`reviewDisplay`
- 소스 문자열 검사용 `node:fs`

RN·expo·Supabase·Deno 모듈은 import하지 않는다.

| ID | 이름 | 내용 | 수정 전 |
|----|------|------|---------|
| T-1 | 91 T-1: spoiler one-liners stay hidden until revealed | `createSharedReviewView`의 기대값은 다음과 같다(입력 순서는 rating, oneLineReview, isSpoiler, revealed). (8, "결말에 주인공이 죽는다", true, false)→`{ label: createReviewLabel(8,null), spoilerHidden: true }`. 같은 입력에 revealed=true→`{ label: createReviewLabel(8,"결말에 주인공이 죽는다"), spoilerHidden: false }`. (null, "결말", true, false)→`{ label: null, spoilerHidden: true }`. (8, "   ", true, false)→`{ label: createReviewLabel(8,"   "), spoilerHidden: false }`. (8, "좋았다", false, false)·(8, "좋았다", undefined, false)·(8, "좋았다", null, false)→가리지 않음, 기존 문구와 같음. (null, null, true, false)→`{ label: null, spoilerHidden: false }` | 실패(모듈 없음) |
| T-2 | 91 T-2: the share function sends the spoiler flag without a contract bump | `supabase/functions/get-library-share/index.ts` 소스 검사. `.select("content_id,rating,one_line_review,is_spoiler")`가 있다. `ReviewRow`에 `is_spoiler`가 있다. `review_is_spoiler: review?.is_spoiler === true`가 있다. `contract_version: "library-share-v2"`가 그대로 있고 `library-share-v3`는 없다 | 실패 |
| T-3 | 91 T-3: shared cards use the spoiler view | `LibraryShareScreenContent.tsx`에 `createSharedReviewView(`와 `SHARED_REVIEW_COPY.reveal`가 있다. `createReviewLabel(item.rating, item.one_line_review)`는 없다. `src/types/libraryShare.ts`에 `review_is_spoiler?: boolean`가 있고 `items: SharedLibraryItem[]`이다. `src/types/library.ts`에는 `review_is_spoiler`가 없다 | 실패 |
| T-4 | 91 T-4: reveal copy matches pins | `SHARED_REVIEW_COPY.reveal === "스포일러 포함 · 보기"`이고, `PinTimelineItem.tsx` 소스에도 같은 문구가 있다 | 실패(모듈 없음) |
| 보존 | 기존 전체 | `createReviewLabel` 관련 기존 테스트, 88·90 공유 테스트, 89 T-1~T-4 그대로 통과 | 통과 |

**수동 확인 (UI-14.3)**

웹 확인은 로컬 대체 API나 함수 로컬 실행으로 한다. 운영 함수는 재배포 전이라 필드가 없다.

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440·375 | 테스트 계정의 검증용 작품에 스포일러 한줄 후기를 두고 공유 링크를 만든다. 비로그인 창에서 별점만과 "스포일러 포함 · 보기"가 보인다. 누르면 그 카드만 후기가 보이고, 새로고침하면 다시 가려진다. 375에서 버튼이 카드를 넘치지 않고 Tab으로 이동된다. 확인 뒤 검증용 후기와 링크를 원래대로 되돌린다(사용자의 실제 감상은 바꾸지 않는다). |
| M-2 | 웹 1440 | 같은 링크에서 스포일러를 끄고 다시 열면 후기가 바로 보인다(E-10). |
| M-3 | iOS 세로 | 공유 화면을 열 수 있으면 M-1과 같다. 앱에 공유 웹 주소가 없어(docs/90) 앱 안 공유 화면 진입이 어려우면 미실행 사유를 보고한다. |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `supabase/functions/get-library-share/index.ts` | `ReviewRow.is_spoiler`, select, `review_is_spoiler`(D-1) |
| `src/types/libraryShare.ts` | `SharedLibraryItem`, `LibraryShareDetail.items` 타입(D-4) |
| `src/utils/sharedReviewDisplay.ts` | 신규(D-3) |
| `src/components/library/LibraryShareScreenContent.tsx` | 카드 문구·보기 버튼·카드별 펼침 상태(D-2) |
| `src/utils/sharedReviewDisplay.test.ts` | 신규 T-1~T-4 |
| `docs/development_next_steps.md`, `docs/README.md` | 작업 기록·91행 상태 |

`src/services/libraryShare.ts`는 응답 `data.items`를 그대로 넘기므로 바꾸지 않는다. 타입 오류가 나면 반환 타입 표기만 맞추고 보고한다.

## 12. 범위 밖

- 소유자 본인 화면(라이브러리 카드, 작품 상세)에서 가리기.
- 함수 실패 때 쓰는 `getLibraryShareDirectly`의 스포일러 값. 소유자 본인 데이터를 읽는 경로다. 필드가 없으면 가리지 않는다.
- 편집기 "스포일러 포함" 옆 설명 문구 추가, 소감 본문 공유.
- 운영 배포. 사람이 `get-library-share` 재배포와 웹 재빌드를 한다.

## 13. 확실하지 않음 — 별도 검증 필요

- 운영 `reviews` 테이블에 `is_spoiler` 컬럼이 있는지. 0001 마이그레이션에 있으므로 있을 것으로 보지만 확인하지 않았다. 없으면 함수가 오류를 낸다. 재배포 직후 공유 링크 하나를 열어 확인한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 라이브러리 공유 링크에서 "스포일러 포함"으로 저장한 한줄 후기를 가리고, 받는 사람이 눌러서 볼 수 있게 한다. 정정 작업이다.

| ID | 결함 |
|----|------|
| F-1 | 스포일러로 표시한 한줄 후기가 공유 링크를 받은 사람에게 그대로 보인다 |

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙.
2. `docs/91_shared_review_spoiler_fixes_spec.md` — 이 명세. D-1~D-4, 9장 E-1~E-10, 10장 테스트 표.
3. `AGENTS.md` — 테스트 규칙. 테스트 파일에서 React Native·expo·Supabase·Deno 모듈을 import하면 실행이 깨진다.
4. `supabase/functions/get-library-share/index.ts`(:55-59, :124, :182-183, :201), `src/components/library/LibraryShareScreenContent.tsx`(:129-160, :285-289), `src/components/pins/PinTimelineItem.tsx`(:26, :54-61, :156-170), `src/utils/reviewDisplay.ts`, `src/types/libraryShare.ts`, `src/services/libraryShare.ts`(:263-286).

# 시작 상태 (반드시 유지)
- 현재 `npm test` 1,944개 통과. 시작할 때 실제 값을 다시 기록한다.
- docs/84~90 미커밋 변경, 공유 화면의 `useHydrated` 수화 처리를 보존한다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** `contract_version`은 `"library-share-v2"` 그대로 둔다. 필드만 추가한다. 어기면 배포된 웹이 공유 링크를 못 연다.
- **D-2.** 서버는 한줄 후기 본문을 빼지 않는다. 가리기는 공유 화면에서 하고, 카드별로 눌러서 본다.
- **D-3.** 가릴지는 `createSharedReviewView` 하나로 판정한다. 화면에 조건식을 다시 쓰지 않는다.
- **D-4.** `LibraryListItem`, `createReviewLabel`, 소유자 카드, 편집기, `getLibraryShareDirectly`는 바꾸지 않는다.
- 마이그레이션을 만들지 않는다.

# STEP 1 — 실패하는 테스트부터
`src/utils/sharedReviewDisplay.test.ts`에 10장 T-1~T-4를 쓴다. `npm test`로 T-1~T-4가 실패하는 것을 눈으로 확인한다. 실패하지 않는 행이 있으면 멈추고 보고한다.

# STEP 2 — 순수 함수
6장 계약대로 `src/utils/sharedReviewDisplay.ts`를 만든다. T-1·T-4가 통과한다.

# STEP 3 — 서버 함수
`get-library-share/index.ts`의 `ReviewRow`, 후기 select, 항목 매핑을 6장대로 바꾼다. 다른 select·매핑·오류 처리는 그대로 둔다. T-2가 통과한다.

# STEP 4 — 타입과 화면
- `src/types/libraryShare.ts`에 `SharedLibraryItem`을 추가하고 `LibraryShareDetail.items`를 바꾼다.
- `SharedGalleryItem`의 `item` 타입을 `SharedLibraryItem`으로 바꾼다.
- 카드 안에서 `const [revealed, setRevealed] = useState(false);`를 둔다. `createSharedReviewView({ rating: item.rating, oneLineReview: item.one_line_review, isSpoiler: item.review_is_spoiler, revealed })`로 `label`과 `spoilerHidden`을 얻는다.
- `label`은 기존 `:151` 자리에 같은 스타일로 그린다.
- `spoilerHidden`이면 그 아래에 8장 조건의 버튼을 그린다. 누르면 `setRevealed(true)`다.
- 버튼 스타일은 이 파일의 `StyleSheet`에 핀과 같은 토큰으로 새로 둔다. 핀 파일은 바꾸지 않는다.
- T-3와 전체 테스트가 통과한다.

# 엣지 케이스 (전부 처리, 명세 9장)
9장 표 E-1~E-10 전부.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
npm run build
```
`npm test`는 기존 테스트가 하나도 깨지지 않아야 한다(기준선: 시작 때 기록한 값, 예상 1,944개). 타입·린트는 Edge Function을 검사하지 않으므로, 바꾼 `get-library-share/index.ts`는 저장소의 기존 Edge 검사 방법(Deno가 없으면 번들 검사 등)으로 따로 확인하고 방법을 보고한다. Node 24가 필요하면 `scenenote-verify`의 `--node-bin` 방식을 쓴다.

# DEFINITION OF DONE
- [ ] T-1~T-4가 수정 전에 실패하는 것을 확인했고 수정 후 통과한다.
- [ ] 기존 테스트 개수가 줄지 않았고, 기존 assertion을 바꾸지 않았다.
- [ ] `contract_version`이 `"library-share-v2"` 그대로다.
- [ ] 공유 화면 직접 열기에서 React 418이 0건이다.
- [ ] UI-13.2 토큰·`Alert` 검사 0줄.
- [ ] 웹·앱 수동 확인 표(M-1~M-3)를 보고했다. 실행하지 못한 행은 사유를 적는다.
- [ ] typecheck·lint 오류 0, `npm run build` 성공.

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
supabase/functions/get-library-share/index.ts
src/types/libraryShare.ts
src/utils/sharedReviewDisplay.ts
src/utils/sharedReviewDisplay.test.ts
src/components/library/LibraryShareScreenContent.tsx
docs/development_next_steps.md
docs/README.md
```
`docs/README.md`는 91행 상태 칸만, `docs/development_next_steps.md`는 맨 위 작업 기록만 고친다.

# 보고 항목
1. STEP 1 실패 테스트의 실제 출력
2. `npm test` before / after 통과 개수
3. `npm run typecheck`, `npm run lint`, `npm run build`, Edge 함수 별도 검사 결과
4. 추가한 테스트 ID와 이름
5. 변경 diff 요약(파일별 줄 수)
6. M-1~M-3 결과 또는 미실행 사유
7. D-1~D-4 중 문제라고 본 항목(바꾸지 말고 보고만)
8. 사람이 할 후속 작업(`get-library-share` 재배포, 웹 재빌드, 운영 `reviews.is_spoiler` 확인)

# 금지사항
- 배포 명령(`npx supabase functions deploy`, vercel 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다. 운영 DB에 쓰지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 의존성을 추가·변경하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
- 수동 확인 때 사용자의 실제 감상·공유 링크를 바꾸거나 멈추지 않는다. 검증용 데이터만 만들고 원래대로 되돌린다.
