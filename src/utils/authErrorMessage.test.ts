import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { authErrorMessage, type AuthAction } from "./authErrorMessage";

interface AuthErrorCase {
  error: unknown;
  action: AuthAction;
  expected: string;
}

const invalidCredentials: AuthErrorCase = {
  error: { code: "invalid_credentials", message: "Invalid login credentials" },
  action: "signIn",
  expected: "이메일 또는 비밀번호가 맞지 않아요."
};
const legacyInvalidCredentials: AuthErrorCase = {
  error: new Error("Invalid login credentials"),
  action: "signIn",
  expected: "이메일 또는 비밀번호가 맞지 않아요."
};
const koreanMessage: AuthErrorCase = {
  error: new Error("비밀번호 재설정 링크로 다시 접속해 주세요"),
  action: "updatePassword",
  expected: "비밀번호 재설정 링크로 다시 접속해 주세요"
};
const fallbackCases: AuthErrorCase[] = [
  { action: "signIn", expected: "로그인하지 못했어요. 잠시 후 다시 시도해 주세요." },
  { action: "signUp", expected: "가입하지 못했어요. 잠시 후 다시 시도해 주세요." },
  { action: "requestPasswordReset", expected: "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." },
  { action: "updatePassword", expected: "비밀번호를 저장하지 못했어요. 잠시 후 다시 시도해 주세요." },
  { action: "signOut", expected: "로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요." }
].map(({ action, expected }) => ({
  error: { code: "unexpected_failure", message: "Database error" },
  action: action as AuthAction,
  expected
}));
const networkCases: AuthErrorCase[] = [
  { name: "AuthRetryableFetchError", message: "x", status: 0 },
  new TypeError("Failed to fetch"),
  new Error("Network request failed")
].map((error) => ({ error, action: "signIn", expected: "인터넷 연결을 확인한 뒤 다시 시도해 주세요." }));
const primitiveCases: AuthErrorCase[] = [null, undefined, "oops", 42].map((error) => ({
  error,
  action: "signIn",
  expected: "로그인하지 못했어요. 잠시 후 다시 시도해 주세요."
}));
const emailRateLimit: AuthErrorCase = {
  error: { code: "over_email_send_rate_limit" },
  action: "requestPasswordReset",
  expected: "메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요."
};
const alreadyRegisteredCases: AuthErrorCase[] = [
  { code: "user_already_exists" },
  { code: "email_exists" },
  new Error("User already registered")
].map((error) => ({ error, action: "signUp", expected: "이미 가입한 이메일이에요. 로그인해 주세요." }));
const remainingCodeCases: AuthErrorCase[] = [
  {
    error: { code: "email_not_confirmed" },
    action: "signIn",
    expected: "이메일 인증이 아직 끝나지 않았어요. 받은 메일의 링크를 눌러 주세요."
  },
  {
    error: { code: "weak_password" },
    action: "signUp",
    expected: "비밀번호가 너무 단순해요. 8자 이상으로 다시 정해 주세요."
  },
  {
    error: { code: "same_password" },
    action: "updatePassword",
    expected: "이전과 다른 비밀번호를 입력해 주세요."
  },
  {
    error: { code: "over_request_rate_limit" },
    action: "signIn",
    expected: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요."
  },
  { error: { code: "email_address_invalid" }, action: "signUp", expected: "올바른 이메일을 입력해 주세요." },
  { error: { code: "validation_failed" }, action: "signUp", expected: "올바른 이메일을 입력해 주세요." },
  {
    error: { code: "signup_disabled" },
    action: "signUp",
    expected: "지금은 가입할 수 없어요. 잠시 후 다시 시도해 주세요."
  },
  {
    error: { code: "email_provider_disabled" },
    action: "signUp",
    expected: "지금은 가입할 수 없어요. 잠시 후 다시 시도해 주세요."
  },
  {
    error: { code: "session_not_found" },
    action: "updatePassword",
    expected: "링크가 만료됐어요. 설정 링크를 다시 받아 주세요."
  },
  {
    error: { code: "session_expired" },
    action: "updatePassword",
    expected: "링크가 만료됐어요. 설정 링크를 다시 받아 주세요."
  },
  {
    error: { code: "otp_expired" },
    action: "updatePassword",
    expected: "링크가 만료됐어요. 설정 링크를 다시 받아 주세요."
  }
];

function assertMessage({ error, action, expected }: AuthErrorCase) {
  assert.equal(authErrorMessage(error, action), expected);
}

describe("authErrorMessage", () => {
  it("T-1 maps invalid credentials without identifying the incorrect field", () => {
    assertMessage(invalidCredentials);
  });

  it("T-2 maps legacy invalid login credentials without an error code", () => {
    assertMessage(legacyInvalidCredentials);
  });

  it("T-3 preserves an existing Korean password-reset message", () => {
    assertMessage(koreanMessage);
  });

  it("T-4 uses the exact fallback for each of the five auth actions", () => {
    for (const scenario of fallbackCases) assertMessage(scenario);
  });

  it("T-5 translates retryable fetch and native/web network errors", () => {
    for (const scenario of networkCases) assertMessage(scenario);
  });

  it("T-6 accepts null, undefined, string and number errors without throwing", () => {
    for (const scenario of primitiveCases) {
      assert.doesNotThrow(() => assertMessage(scenario));
    }
  });

  it("T-7 explains the email sending rate limit", () => {
    assertMessage(emailRateLimit);
  });

  it("T-8 translates both registered-email codes and the legacy message", () => {
    for (const scenario of alreadyRegisteredCases) assertMessage(scenario);
  });

  it("T-9 translates all eleven remaining auth error codes", () => {
    for (const scenario of remainingCodeCases) assertMessage(scenario);
  });

  it("T-10 returns Korean text and never echoes the English input in every preceding case", () => {
    const scenarios = [
      invalidCredentials,
      legacyInvalidCredentials,
      koreanMessage,
      ...fallbackCases,
      ...networkCases,
      ...primitiveCases,
      emailRateLimit,
      ...alreadyRegisteredCases,
      ...remainingCodeCases
    ];

    for (const { error, action } of scenarios) {
      const result = authErrorMessage(error, action);
      assert.match(result, /[가-힣]/);
      if (typeof error === "string") assert.notEqual(result, error);
      if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
        if (!/[가-힣]/.test(error.message)) assert.notEqual(result, error.message);
      }
    }
  });
});
