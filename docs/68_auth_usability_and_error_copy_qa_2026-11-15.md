# 68. 로그인 전 화면 사용성 + 서버 오류 원문 노출 정정 (QA 2026-11-15)

작성일: 2026-11-15
대상 브랜치 기준: main (dc28860 + 커밋되지 않은 작업 트리). 행 번호는 작성 시점 작업 트리 기준이며, 다르면 인용한 코드로 찾는다.
선행 문서: `docs/00_ui_style_rules.md`(UI-4, UI-5, UI-6.3), `docs/31`(웹 `Alert` 무동작·오류 문구), `docs/11_screen_implementation_spec.md`(인증 화면)

점검 방법: 웹 8081에서 로그인 전 화면(온보딩·로그인·가입·비밀번호 설정)을 1024폭과 375폭으로 직접 확인했다. 로그인이 필요한 화면은 대신 로그인하지 않고(UI-13.5) 코드로 점검했다.

## 1. 문제 정의

| ID | 화면 | 증상 | 확인 방법 |
|----|------|------|-----------|
| F-1 | 온보딩 | 첫 장·둘째 장에는 "다음"만 있다. 이미 계정이 있는 사람(새 기기·로그아웃 후)은 "다음"을 두 번 눌러야 로그인으로 갈 수 있고, 앞 장으로 돌아갈 방법도 없다 | 화면 확인(웹 1024·375) |
| F-2 | 로그인·가입·비밀번호 설정 | 실패하면 Supabase 영문 원문이 그대로 빨간 글씨로 나온다(예: `Invalid login credentials`, `Email not confirmed`, `User already registered`). UI-6.3 위반 | 코드 확인 |
| F-3 | 로그인·가입·새 비밀번호 | 입력한 비밀번호를 볼 방법이 없다. 가입은 확인 칸도 없어서 오타를 낸 채 가입하면 바로 비밀번호 재설정을 해야 한다 | 화면 확인 |
| F-4 | 로그인·가입·비밀번호 설정 | 안내 글(placeholder)이 라벨과 같은 말("이메일"/"이메일")이라 정보가 없다. 가입 화면은 "8자 이상" 조건을 제출해서 틀려야 알 수 있다 | 화면 확인 |
| F-5 | 로그인 | 로그인 중에 버튼이 흐려지지 않는다(가입·비밀번호 화면은 흐려진다). 눌러졌는지 알기 어렵다 | 코드 확인 |
| F-6 | 검색·작품 상세·회차·인물·핀 상세·라이브러리 공유·공유 받은 화면 | 불러오기·저장 실패 때 서버 영문 원문(`error.message`)이 오류 영역·토스트에 그대로 나온다. 24곳. UI-6.3 위반 | 코드 확인 |

## 2. 근본 원인

- **F-1** `app/(auth)/onboarding.tsx:53-74` — 마지막 장(`isLast`)일 때만 "계정 만들기"·"이미 계정이 있어요"를 그리고, 그 외에는 "다음" 버튼 하나만 그린다. 이전 장으로 가는 코드가 없다.
- **F-2** `src/hooks/useAuth.ts:18,32,42,50,56,63` — `throw new Error(error.message)`로 Supabase `AuthError.message`(영문)를 그대로 던지고 `code`를 버린다. 화면은 `signIn.error.message` 등을 그대로 그린다(`sign-in.tsx:87`, `sign-up.tsx:96`, `forgot-password.tsx:60`, `reset-password.tsx:98`).
- **F-3·F-4** `sign-in.tsx:69-82`, `sign-up.tsx:78-91`, `reset-password.tsx`의 비밀번호 `TextInput`이 `secureTextEntry` 고정이고 `placeholder`가 라벨과 같다.
- **F-5** `sign-in.tsx:88-95` — `disabled`는 주지만 스타일 배열에 비활성 스타일이 없다(`sign-up.tsx:106-109`에는 있다).
- **F-6** 화면이 `X.error.message`를 직접 쓴다. 서비스·훅은 `throw new Error(error.message)`로 Supabase 원문을 던진다(`src/services`, `src/hooks` 60곳). 한국어 문구만 통과시키는 `userFacingErrorMessage`(`src/utils/profileDashboard.ts:269`)가 이미 있고 일부 화면(`library.tsx:207,225`, `content/[id].tsx:275`)만 쓴다.

## 3. 재현 시나리오

1. 로그아웃 상태로 `http://localhost:8081/onboarding`을 연다 → 첫 장에 "다음"만 보인다(F-1).
2. `/sign-in`에서 가입하지 않은 이메일과 8자 이상 아무 비밀번호로 로그인한다 → 영문 오류가 나온다(F-2). 요청 중 버튼 모양이 그대로다(F-5).
3. `/sign-up`에서 비밀번호 칸을 본다 → 보기 버튼·조건 안내가 없다(F-3, F-4).
4. 로그인 후 네트워크를 끊고 검색 탭에서 검색한다 → 오류 영역에 영문 원문이 나온다(F-6).

## 4. 설계 결정

### D-1. 인증 오류는 `useAuth` 한 곳에서 한국어로 바꾼다 (최우선)
순수 함수 `authErrorMessage(error, action)`(6장)을 만들고 `useAuth.ts`의 모든 `throw new Error(error.message)`를 `throw new Error(authErrorMessage(error, "<action>"))`로 바꾼다. 화면 4곳은 그대로 `X.error.message`를 그린다(이미 한국어). 판정은 `code` 우선, 없으면 영문 문구 패턴, 그것도 없으면 action별 고정 문구. **모르는 영문 원문을 화면에 내보내는 경로를 남기지 않는다.**

### D-2. 로그인 실패는 이메일·비밀번호 중 무엇이 틀렸는지 구분하지 않는다
"이메일 또는 비밀번호가 맞지 않아요." 한 문구만 쓴다. 가입 여부를 알려 주지 않기 위해서다(계정 탐색 방지). 비밀번호 설정 메일 요청도 성공 문구를 바꾸지 않는다.

### D-3. 온보딩은 모든 장에 "이미 계정이 있어요"를 두고, 둘째 장부터 "이전"을 둔다
장 수·문구·순서는 바꾸지 않는다. 버튼 구성은 순수 함수 `getOnboardingActions(index, total)`(6장)로 정한다. 첫 장에 건너뛰기 대신 로그인 링크를 두는 이유: 건너뛸 곳이 결국 가입/로그인 선택 화면(마지막 장)이라 한 번 더 눌러야 한다.

### D-4. 비밀번호 칸은 공용 `PasswordInput` 하나로 만들고 기본은 가림
`src/components/common/PasswordInput.tsx`. 오른쪽에 눈 아이콘 버튼(44×44, 라벨 "비밀번호 보기"/"비밀번호 숨기기", `accessibilityState={{ checked }}` 아님 — `accessibilityRole="button"` + 라벨 전환). 보기 상태는 칸마다 따로이고 화면을 떠나면 사라진다. 버튼은 값을 지우거나 제출하지 않는다. 가입에 확인 칸을 추가하지 않는다(5장).

### D-5. 화면 오류 문구는 `userFacingErrorMessage(error, 고정 문구)`로 통일한다
새 판정 함수를 만들지 않는다. 고정 문구는 `src/utils/errorCopy.ts`의 `ERROR_COPY` 상수에 모으고 화면은 키로 꺼내 쓴다(문구를 테스트로 고정). 서비스가 던지는 한국어 문구(검색 시간 초과 안내 등)는 지금처럼 그대로 보인다.

### D-6. 인증 화면의 글자 크기·색 토큰 정리는 하지 않는다 (`UI-13.2 대체`)
인증 화면 입력칸은 16px이다. 토큰 `typography.body`(14px)로 바꾸면 iOS Safari 웹에서 입력칸을 누를 때 화면이 확대된다(16px 미만 입력칸). 토큰 정리는 16px 입력 토큰을 정하는 별도 명세에서 한다. 이번 UI-13.2 검사는 **새로 만드는 파일**(`PasswordInput.tsx`)에만 적용하고, 문구만 바꾸는 기존 화면은 검사 대상에서 뺀다(UI-12.3).

> D-N은 임의로 바꾸지 않는다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

- **화면마다 `signIn.error.message`를 감싸기** — 4곳에 흩어지고 `code`를 이미 잃은 뒤라 문구 패턴에만 의존한다. `useAuth`에서 바꾼다.
- **가입에 비밀번호 확인 칸 추가** — 입력이 늘어 가입이 길어진다. 보기 버튼으로 오타를 확인할 수 있고, 틀려도 재설정 경로가 있다.
- **온보딩 건너뛰기 버튼** — D-3 근거.
- **`ErrorState`가 받은 문구를 안에서 걸러내기** — 화면별 맞는 대체 문구를 줄 수 없고, 한국어 서버 문구를 넘기는 다른 화면 동작이 바뀐다.
- **서비스 60곳의 `throw`를 모두 한국어로 바꾸기** — 범위가 크고 호출부마다 문맥이 다르다. 화면 경계에서 거른다.

## 6. 계약 (타입 · 판정 순서)

### 6.1 `src/utils/authErrorMessage.ts` (import 없음)

```ts
export type AuthAction = "signIn" | "signUp" | "requestPasswordReset" | "updatePassword" | "signOut";
export function authErrorMessage(error: unknown, action: AuthAction): string;
```

판정 순서(위에서부터 처음 맞는 것):

1. `error`가 객체이고 `message`가 문자열이며 한글(`/[가-힣]/`)을 포함 → 그 문구 그대로.
2. 네트워크: `name === "AuthRetryableFetchError"` 또는 `status === 0` 또는 `message`가 `/network request failed|failed to fetch|load failed|network ?error/i` → `"인터넷 연결을 확인한 뒤 다시 시도해 주세요."`
3. `code`(문자열)로 판정:

| code | 문구 |
|------|------|
| `invalid_credentials` | 이메일 또는 비밀번호가 맞지 않아요. |
| `email_not_confirmed` | 이메일 인증이 아직 끝나지 않았어요. 받은 메일의 링크를 눌러 주세요. |
| `user_already_exists`, `email_exists` | 이미 가입한 이메일이에요. 로그인해 주세요. |
| `weak_password` | 비밀번호가 너무 단순해요. 8자 이상으로 다시 정해 주세요. |
| `same_password` | 이전과 다른 비밀번호를 입력해 주세요. |
| `over_email_send_rate_limit` | 메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요. |
| `over_request_rate_limit` | 요청이 너무 많아요. 잠시 후 다시 시도해 주세요. |
| `email_address_invalid`, `validation_failed` | 올바른 이메일을 입력해 주세요. |
| `signup_disabled`, `email_provider_disabled` | 지금은 가입할 수 없어요. 잠시 후 다시 시도해 주세요. |
| `session_not_found`, `session_expired`, `otp_expired` | 링크가 만료됐어요. 설정 링크를 다시 받아 주세요. |

4. `code`가 없거나 표에 없으면 `message` 패턴: `/invalid login credentials/i` → `invalid_credentials` 문구, `/email not confirmed/i` → `email_not_confirmed` 문구, `/already registered/i` → `user_already_exists` 문구, `/rate limit/i` → `over_request_rate_limit` 문구.
5. action별 고정 문구: `signIn` "로그인하지 못했어요. 잠시 후 다시 시도해 주세요." / `signUp` "가입하지 못했어요. 잠시 후 다시 시도해 주세요." / `requestPasswordReset` "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." / `updatePassword` "비밀번호를 저장하지 못했어요. 잠시 후 다시 시도해 주세요." / `signOut` "로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요."

`error`가 `null`·문자열·숫자여도 던지지 않고 5번 문구를 준다.

### 6.2 `src/utils/onboarding.ts` (import 없음)

```ts
export interface OnboardingActions { showBack: boolean; showNext: boolean; showSignUp: boolean; showSignInLink: true }
export function getOnboardingActions(index: number, total: number): OnboardingActions;
```

- `total`이 1 미만·`NaN`이면 1로, `index`는 정수로 내린 뒤 `0..total-1`로 가둔다(`NaN`은 0).
- `showBack = index > 0`, `showSignUp = index === total - 1`, `showNext = !showSignUp`, `showSignInLink`는 항상 `true`.

### 6.3 `src/utils/errorCopy.ts` (import 없음)

```ts
export const ERROR_COPY = { /* 8장 표의 키 → 문구 */ } as const;
export type ErrorCopyKey = keyof typeof ERROR_COPY;
```

모든 값은 한글을 포함하고 "주세요."로 끝난다(예외: `shareOpen`).

### 6.4 `PasswordInput` props

```ts
interface PasswordInputProps extends Omit<TextInputProps, "secureTextEntry"> { inputRef?: Ref<TextInput>; }
```

`style`은 안쪽 `TextInput`에 그대로 적용한다(화면의 기존 `styles.input`을 넘긴다). 버튼 자리를 위해 오른쪽 안쪽 여백만 덧붙인다.

## 7. 데이터 모델 / SQL

해당 없음. 마이그레이션·Edge Function 변경 없음.

## 8. 화면 명세

UI 규칙 준수(UI-1~UI-13, D-6 예외). 화면 고유 값만 적는다.

### 8.1 온보딩 (`app/(auth)/onboarding.tsx`)
- 아래 버튼 영역(위에서 아래로): 주 버튼("다음" 또는 마지막 장 "계정 만들기") → `showBack`이면 "이전"(글자 버튼, 높이 48, `colors.textMuted`) → "이미 계정이 있어요"(`/sign-in` 링크, 높이 48).
- 점 표시 영역에 `accessibilityLabel={`${index + 1} / ${total}`}`.

### 8.2 인증 입력칸
| 화면 | 칸 | placeholder | 그 외 |
|------|----|-------------|-------|
| sign-in, sign-up, forgot-password | 이메일 | `name@example.com` | `autoCorrect={false}` 추가 |
| sign-in | 비밀번호 | `비밀번호` | `PasswordInput` |
| sign-up | 비밀번호 | `8자 이상` | `PasswordInput`, 칸 아래 안내 "8자 이상으로 입력해 주세요."(오류가 있으면 오류 문구로 대체) |
| reset-password | 새 비밀번호 / 확인 | `8자 이상` / `한 번 더 입력` | 둘 다 `PasswordInput` |

- 로그인 버튼: 요청 중 `opacity: 0.65`(sign-up의 `disabledButton`과 같은 값) + `accessibilityState={{ disabled, busy }}`. 네 화면의 주 버튼에 눌림 피드백(UI-4.2).

### 8.3 오류 문구 교체 (F-6)

`X.error.message` / `error instanceof Error ? error.message : "…"` / `error.message || "…"` 를 `userFacingErrorMessage(error, ERROR_COPY.<키>)`로 바꾼다.

| 파일:행 | 키 | 문구 |
|---------|----|------|
| `app/search.tsx:123,131` | `searchFilterSave` | 검색 조건을 저장하지 못했어요. 다시 시도해 주세요. |
| `app/search.tsx:366` | `anchorResolve` | 기준 작품을 찾지 못했어요. 잠시 후 다시 시도해 주세요. |
| `app/search.tsx:416`, `app/content/[id].tsx:296` | `personAdd` | 등록하지 못했어요. 잠시 후 다시 시도해 주세요. |
| `app/search.tsx:546` | `recommendationExclusionSave` | 추천 제외 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요. |
| `app/search.tsx:561,576,606` | `recommendationFeedbackSave` | 피드백을 저장하지 못했어요. 잠시 후 다시 시도해 주세요. |
| `app/search.tsx:682` | `searchFilterLoad` | 검색 조건을 불러오지 못했어요. 다시 시도해 주세요. |
| `app/search.tsx:905` | `searchLoad` | 검색하지 못했어요. 잠시 후 다시 시도해 주세요. |
| `app/search.tsx:939` | `recommendationExclusionLoad` | 추천 제외 설정을 불러오지 못했어요. 다시 시도해 주세요. |
| `app/search.tsx:945` | `recommendationLoad` | 추천을 불러오지 못했어요. 다시 시도해 주세요. |
| `app/pins/[id].tsx:37` | `pinLoad` | 핀을 불러오지 못했어요. 다시 시도해 주세요. |
| `app/(tabs)/library.tsx:375` | `shareCreate` | 공유 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요. |
| `app/content/[id].tsx:331` | `contentLoad` | 작품 정보를 불러오지 못했어요. 다시 시도해 주세요. |
| `app/content/[id].tsx:355` | `watchCountSave` | 본 횟수를 저장하지 못했어요. 잠시 후 다시 시도해 주세요. |
| `app/(tabs)/people.tsx:188` | `peopleSearch` | 인물을 검색하지 못했어요. 잠시 후 다시 시도해 주세요. |
| `app/(tabs)/people.tsx:221` | `favoritePeopleLoad` | 좋아하는 인물을 불러오지 못했어요. 다시 시도해 주세요. |
| `app/content/[id]/episodes.tsx:53` | `seasonsLoad` | 시즌 정보를 불러오지 못했어요. 다시 시도해 주세요. |
| `app/content/[id]/episodes.tsx:70` | `episodesLoad` | 회차 목록을 불러오지 못했어요. 다시 시도해 주세요. |
| `app/people/[id].tsx:315` | `personLoad` | 인물 정보를 불러오지 못했어요. 다시 시도해 주세요. |
| `src/components/content/ContentReviewEditor.tsx:218` | `reviewLoad` | 감상 기록을 불러오지 못했어요. 다시 시도해 주세요. |
| `src/components/library/LibraryShareScreenContent.tsx:98` | `shareOpen` | 공유 링크가 만료되었거나 존재하지 않습니다. |

`ContentReviewEditor.tsx:98`은 바로 위에서 한국어로 던진 오류를 받는 곳이라 그대로 둔다.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 |
|---|------|-----------|
| E-1 | `code: "invalid_credentials"` | D-2 문구 |
| E-2 | `code` 없이 `message: "Invalid login credentials"`(구버전 응답) | E-1과 같은 문구 |
| E-3 | `updatePassword`에서 던진 "비밀번호 재설정 링크로 다시 접속해 주세요" | 그대로 통과 |
| E-4 | 표에 없는 `code` + 영문 `message` | action별 고정 문구. 영문이 나오지 않는다 |
| E-5 | 오프라인(`Failed to fetch`, `AuthRetryableFetchError`, `status: 0`) | 인터넷 연결 안내 |
| E-6 | `error`가 `null`·문자열·`undefined` | 던지지 않고 고정 문구 |
| E-7 | 메일 요청 한도(`over_email_send_rate_limit`) | 한도 안내 |
| E-8 | 가입 시 이미 있는 이메일(`user_already_exists`, 또는 `User already registered`) | "이미 가입한 이메일이에요…" |
| E-9 | 온보딩 `index`가 범위 밖·`NaN`, `total`이 0 | 범위 안으로 가둔다 |
| E-10 | 온보딩 첫 장 | 이전 없음, 로그인 링크 있음 |
| E-11 | 온보딩 마지막 장 | 다음 없음, 계정 만들기·이전·로그인 링크 |
| E-12 | 비밀번호 보기 상태에서 제출 실패 | 값·보기 상태 유지 |
| E-13 | 서비스가 한국어 문구를 던짐(검색 시간 초과 등) | F-6 교체 뒤에도 그 문구 그대로 |
| E-14 | 서비스가 영문 원문을 던짐(`duplicate key value`, `Edge Function returned a non-2xx status code`) | 8.3 표의 고정 문구 |

## 10. 테스트 표

모든 행을 테스트로 옮긴다. 줄이지 않는다.

`src/utils/authErrorMessage.test.ts`

| ID | 입력 | 기대 | 엣지 |
|----|------|------|------|
| T-1 | `{ code: "invalid_credentials", message: "Invalid login credentials" }`, `signIn` | 이메일 또는 비밀번호가 맞지 않아요. | E-1 |
| T-2 | `new Error("Invalid login credentials")`, `signIn` | T-1과 같음 | E-2 |
| T-3 | `new Error("비밀번호 재설정 링크로 다시 접속해 주세요")`, `updatePassword` | 그대로 | E-3 |
| T-4 | `{ code: "unexpected_failure", message: "Database error" }`, 다섯 action 각각 | 6.1의 5번 문구 다섯 가지 | E-4 |
| T-5 | `{ name: "AuthRetryableFetchError", message: "x", status: 0 }` / `new TypeError("Failed to fetch")` / `new Error("Network request failed")` | 인터넷 연결 안내 | E-5 |
| T-6 | `null`, `undefined`, `"oops"`, `42` | `signIn` 고정 문구, 던지지 않음 | E-6 |
| T-7 | `{ code: "over_email_send_rate_limit" }`, `requestPasswordReset` | 메일 한도 안내 | E-7 |
| T-8 | `{ code: "user_already_exists" }`, `{ code: "email_exists" }`, `new Error("User already registered")`, `signUp` | 이미 가입한 이메일이에요. 로그인해 주세요. | E-8 |
| T-9 | 6.1 표의 나머지 code 전부(`email_not_confirmed`, `weak_password`, `same_password`, `over_request_rate_limit`, `email_address_invalid`, `validation_failed`, `signup_disabled`, `email_provider_disabled`, `session_not_found`, `session_expired`, `otp_expired`) | 표의 문구 | E-4 |
| T-10 | 위 모든 결과 | 한글 포함, 영문 원문과 다름 | E-4 |

`src/utils/onboarding.test.ts`

| ID | 입력 | 기대 | 엣지 |
|----|------|------|------|
| T-11 | `(0, 3)` | back false, next true, signUp false, signInLink true | E-10 |
| T-12 | `(1, 3)` | back true, next true, signUp false | E-10 |
| T-13 | `(2, 3)` | back true, next false, signUp true | E-11 |
| T-14 | `(-1, 3)`, `(9, 3)`, `(NaN, 3)`, `(0, 0)`, `(1.7, 3)` | 각각 index 0, 2, 0, 0(total 1 → signUp true), 1로 판정 | E-9 |

`src/utils/errorCopy.test.ts`

| ID | 입력 | 기대 | 엣지 |
|----|------|------|------|
| T-15 | `ERROR_COPY` 전체 | 키 20개가 8.3 표와 같고 문구가 표와 글자까지 같다 | E-14 |
| T-16 | `userFacingErrorMessage(new Error("Edge Function returned a non-2xx status code"), ERROR_COPY.searchLoad)` | `ERROR_COPY.searchLoad` | E-14 |
| T-17 | `userFacingErrorMessage(new Error("검색 시간이 초과됐어요."), ERROR_COPY.searchLoad)` | 넘긴 한국어 문구 그대로 | E-13 |

E-12는 화면 동작이라 수동 확인 표(M-3, M-6)로 확인한다.

### 수동 확인 표

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 온보딩 세 장: 첫 장에 로그인 링크, 둘째 장부터 "이전". 버튼이 화면 끝으로 밀리지 않는다 |
| M-2 | 웹 375 | 온보딩·로그인·가입·비밀번호 설정에서 넘침 없음, 버튼 영역이 화면 안 |
| M-3 | 웹 375 | 비밀번호 보기/숨기기 전환, Tab으로 입력칸 → 보기 버튼 → 다음 칸 순서, Enter 제출 유지 |
| M-4 | 웹 | 틀린 계정으로 로그인 → 한국어 문구, 요청 중 버튼 흐려짐 |
| M-5 | 웹 | 로그인 후 개발자 도구에서 오프라인 → 검색·작품 상세·인물 탭 오류가 한국어, "다시 시도" 동작 |
| M-6 | 앱(iOS 세로) | 안전 영역, 키보드가 입력·버튼을 가리지 않음, 보기 버튼 44, 글자 1.3배에서 잘림 없음, 제출 실패 뒤 값·보기 상태 유지 |

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/utils/authErrorMessage.ts`, `.test.ts` | 신규(6.1, T-1~T-10) |
| `src/utils/onboarding.ts`, `.test.ts` | 신규(6.2, T-11~T-14) |
| `src/utils/errorCopy.ts`, `.test.ts` | 신규(6.3, T-15~T-17) |
| `src/components/common/PasswordInput.tsx` | 신규(6.4, D-4) |
| `src/hooks/useAuth.ts` | `authErrorMessage` 적용(D-1) |
| `app/(auth)/onboarding.tsx` | 8.1 |
| `app/(auth)/sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `reset-password.tsx` | 8.2 |
| `app/search.tsx`, `app/pins/[id].tsx`, `app/(tabs)/library.tsx`, `app/(tabs)/people.tsx`, `app/content/[id].tsx`, `app/content/[id]/episodes.tsx`, `app/people/[id].tsx`, `src/components/content/ContentReviewEditor.tsx`, `src/components/library/LibraryShareScreenContent.tsx` | 8.3 표의 행만 |
| `docs/00_ui_style_rules.md` | UI-9 표에 `PasswordInput`, UI-6.3에 `authErrorMessage`·`ERROR_COPY` 한 줄 |
| `docs/README.md`, `docs/development_next_steps.md` | 상태 갱신(구현됨·수동 확인 남음) |

## 12. 범위 밖

- **노출되지 않는 화면의 `Alert.alert`** — `app/library/import.tsx`, `app/library/photo-import.tsx`, `app/settings/excluded-recommendations.tsx`, 핀·취향 카드 공유(`pins.tsx:135,144`, `profile.tsx:190`), `PopularRecommendationSection.tsx:117`(사용처 없음). 모두 `EXTENDED_FEATURES_ENABLED = false` 뒤에 있다. 기능을 켜는 명세에서 고친다.
- **토큰 정리** — 인증 화면(D-6), `app/people/[id].tsx`의 `shadow*`(894, 977, 1153행. 웹 콘솔에 "shadow* style props are deprecated" 경고), `app/search.tsx`·`app/(tabs)/library.tsx`의 숫자 글자 크기. 화면 단위 별도 명세.
- **핀 상세 화면 개편**(`app/pins/[id].tsx`), 가입 비밀번호 확인 칸, 소셜 로그인, 온보딩 문구·장 수 변경.
- 서비스·훅의 `throw` 문구(60곳), `userFacingErrorMessage` 판정, `ErrorState` 컴포넌트.

## 13. 확실하지 않음 — 별도 검증 필요

- Supabase가 실제로 돌려주는 `code` 값은 설치된 `@supabase/auth-js` 2.105.1의 타입(`error-codes.d.ts`)으로만 확인했다. 실제 응답은 받아 보지 않았다(대신 로그인하지 않음). M-4에서 확인한다. 이메일 확인이 켜진 프로젝트는 이미 가입한 이메일에도 오류 없이 성공처럼 응답할 수 있다(이 경우 E-8 문구는 나오지 않고 "인증 메일을 보냈습니다"가 나온다).
- 로그인이 필요한 화면(F-6)은 화면으로 보지 못했고 코드로만 확인했다. M-5로 확인한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다.
로그인 전 화면의 사용성 결함과 서버 영문 오류 원문 노출을 고친다. **정정 작업**이다(새 기능 아님). 결함은 1장 F-1~F-6.

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙. 이 명세의 D-6만 예외.
2. `docs/68_auth_usability_and_error_copy_qa_2026-11-15.md` — 이 문서 1~13장.
3. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
4. `src/hooks/useAuth.ts`, `app/(auth)/*.tsx`, `src/utils/profileDashboard.ts:269`(`userFacingErrorMessage`)

# 시작 상태 (반드시 유지)
- `npm test` 기준선: 1432개 통과(2026-11-15, 커밋되지 않은 작업 트리 포함). 시작 전에 직접 돌려 실제 수를 기록한다.
- 작업 트리에 이 작업과 무관한 미커밋 변경이 있다(`app/content/[id].tsx` 등). 되돌리거나 정리하지 않는다.
- 인증 흐름(로그인 성공 시 `/`로 이동, 가입 후 인증 메일 안내, 비밀번호 설정 링크)은 그대로 동작해야 한다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 인증 오류는 `useAuth.ts`에서 `authErrorMessage`로 바꾼다. 모르는 영문 원문이 화면에 나가는 경로를 남기지 않는다.
- **D-2.** 로그인 실패 문구는 이메일·비밀번호를 구분하지 않는다.
- **D-5.** `userFacingErrorMessage`의 시그니처·판정을 바꾸지 않는다. `ErrorState`를 바꾸지 않는다.
- **D-6.** 인증 화면의 기존 글자 크기·색 스타일을 토큰으로 바꾸지 않는다(입력칸 16px 유지).
- D-3, D-4, 6장 계약의 문구는 글자 그대로 쓴다.
- DB 마이그레이션·Edge Function을 만들거나 고치지 않는다.

# STEP 1 — 실패하는 테스트부터
`src/utils/authErrorMessage.test.ts`, `src/utils/onboarding.test.ts`, `src/utils/errorCopy.test.ts`에 10장 T-1~T-17을 전부 쓴다(`node:test` + `node:assert/strict`). `npm test`를 돌려 새 테스트가 실패(모듈 없음)하는 것을 눈으로 확인한다. 실패하지 않으면 멈추고 보고한다.

# STEP 2 — 순수 함수
6.1~6.3 계약대로 `authErrorMessage.ts`, `onboarding.ts`, `errorCopy.ts`를 만든다(세 파일 모두 import 없음). T-1~T-17 통과.

# STEP 3 — 인증 오류 적용 (F-2)
`src/hooks/useAuth.ts`의 `signIn`·`signUp`·`requestPasswordReset`·`updatePassword`(`sessionError` 포함)·`signOut`에서 `throw new Error(error.message)` → `throw new Error(authErrorMessage(error, "<action>"))`. `updatePassword`의 한국어 `throw`와 `deleteAccount`는 그대로 둔다.

# STEP 4 — 온보딩 (F-1)
8.1대로. 버튼 구성은 `getOnboardingActions(index, slides.length)` 결과만 쓴다.

# STEP 5 — 비밀번호 칸·입력 안내·로그인 버튼 (F-3, F-4, F-5)
`PasswordInput`(6.4, D-4)을 만들고 8.2 표대로 네 화면에 적용한다. react-hook-form `field.ref`는 `inputRef`로 넘겨 `setFocus`가 계속 동작하게 한다.

# STEP 6 — 화면 오류 문구 (F-6)
8.3 표의 행만 바꾼다. 각 파일에서 그 행 외에는 건드리지 않는다. 행 번호가 다르면 인용 코드로 찾고, 표에 없는 `error.message` 노출을 발견하면 고치지 말고 보고한다.

# STEP 7 — 문서
11장의 문서 3개를 갱신한다.

# 엣지 케이스 (전부 처리)
9장 E-1~E-14 전부.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
grep -nE "#[0-9A-Fa-f]{3,6}\b|rgba?\(|fontWeight: \"|fontSize: [0-9]" src/components/common/PasswordInput.tsx
grep -nE "error\??\.message" "app/(auth)" app/search.tsx "app/pins/[id].tsx" "app/(tabs)/people.tsx" "app/content/[id].tsx" "app/content/[id]/episodes.tsx" "app/people/[id].tsx" src/components/library/LibraryShareScreenContent.tsx
```
- 네 번째 명령은 0줄(D-6에 따라 새 파일만 검사).
- 다섯 번째 명령은 인증 화면 4줄(`signIn.error.message` 등, 이미 한국어)과 `fieldState.error.message`만 남아야 한다.
- 웹 확인은 8081만 쓴다(`npm run web -- --port 8081 --localhost --clear`, 사용 중이면 기존 서버 재사용).

# DEFINITION OF DONE
- [ ] T-1~T-17이 수정 전에 실패했고 수정 후 통과한다
- [ ] 기존 테스트 개수가 줄지 않았다(기준선 + 새 테스트)
- [ ] `npm run typecheck`, `npm run lint` 통과
- [ ] UI-13.2 토큰·`Alert` 검사 0줄(D-6 범위: `PasswordInput.tsx`)
- [ ] 8.3 표의 24곳이 모두 `userFacingErrorMessage(…, ERROR_COPY.…)`를 쓴다
- [ ] 웹·앱 수동 확인 표(M-1~M-6)를 보고했다. 로그인이 필요한 항목은 대신 로그인하지 않고 "미확인"으로 적는다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/authErrorMessage.ts
src/utils/authErrorMessage.test.ts
src/utils/onboarding.ts
src/utils/onboarding.test.ts
src/utils/errorCopy.ts
src/utils/errorCopy.test.ts
src/components/common/PasswordInput.tsx
src/hooks/useAuth.ts
app/(auth)/onboarding.tsx
app/(auth)/sign-in.tsx
app/(auth)/sign-up.tsx
app/(auth)/forgot-password.tsx
app/(auth)/reset-password.tsx
app/search.tsx
app/pins/[id].tsx
app/(tabs)/library.tsx
app/(tabs)/people.tsx
app/content/[id].tsx
app/content/[id]/episodes.tsx
app/people/[id].tsx
src/components/content/ContentReviewEditor.tsx
src/components/library/LibraryShareScreenContent.tsx
docs/00_ui_style_rules.md
docs/README.md
docs/development_next_steps.md
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력
2. `npm test` 결과(before / after 통과 개수)
3. `npm run typecheck`, `npm run lint`, grep 두 개의 결과
4. 추가한 테스트 ID와 이름
5. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)
6. 표에 없는데 발견한 오류 원문 노출 지점
7. 수동 확인 표 M-1~M-6 결과(웹/앱 구분, 미확인 사유 포함)
8. 사람이 해야 할 후속 작업(배포 불필요. 실제 계정으로 M-4·M-5 확인)

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다. 타입만 `import type`으로 가져온다.
