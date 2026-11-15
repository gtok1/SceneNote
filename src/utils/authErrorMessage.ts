export type AuthAction = "signIn" | "signUp" | "requestPasswordReset" | "updatePassword" | "signOut";

const messagesByCode: Readonly<Record<string, string>> = {
  invalid_credentials: "이메일 또는 비밀번호가 맞지 않아요.",
  email_not_confirmed: "이메일 인증이 아직 끝나지 않았어요. 받은 메일의 링크를 눌러 주세요.",
  user_already_exists: "이미 가입한 이메일이에요. 로그인해 주세요.",
  email_exists: "이미 가입한 이메일이에요. 로그인해 주세요.",
  weak_password: "비밀번호가 너무 단순해요. 8자 이상으로 다시 정해 주세요.",
  same_password: "이전과 다른 비밀번호를 입력해 주세요.",
  over_email_send_rate_limit: "메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.",
  over_request_rate_limit: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
  email_address_invalid: "올바른 이메일을 입력해 주세요.",
  validation_failed: "올바른 이메일을 입력해 주세요.",
  signup_disabled: "지금은 가입할 수 없어요. 잠시 후 다시 시도해 주세요.",
  email_provider_disabled: "지금은 가입할 수 없어요. 잠시 후 다시 시도해 주세요.",
  session_not_found: "링크가 만료됐어요. 설정 링크를 다시 받아 주세요.",
  session_expired: "링크가 만료됐어요. 설정 링크를 다시 받아 주세요.",
  otp_expired: "링크가 만료됐어요. 설정 링크를 다시 받아 주세요."
};

const fallbackByAction: Record<AuthAction, string> = {
  signIn: "로그인하지 못했어요. 잠시 후 다시 시도해 주세요.",
  signUp: "가입하지 못했어요. 잠시 후 다시 시도해 주세요.",
  requestPasswordReset: "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.",
  updatePassword: "비밀번호를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
  signOut: "로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요."
};

export function authErrorMessage(error: unknown, action: AuthAction): string {
  if (error === null || typeof error !== "object") return fallbackByAction[action];
  const fields = error as { message?: unknown; name?: unknown; status?: unknown; code?: unknown };
  const message = typeof fields.message === "string" ? fields.message : "";
  if (/[가-힣]/.test(message)) return message;
  if (fields.name === "AuthRetryableFetchError" || fields.status === 0 ||
    /network request failed|failed to fetch|load failed|network ?error/i.test(message)) {
    return "인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
  }
  if (typeof fields.code === "string" && Object.prototype.hasOwnProperty.call(messagesByCode, fields.code)) {
    return messagesByCode[fields.code]!;
  }
  const legacyCode = /invalid login credentials/i.test(message) ? "invalid_credentials"
    : /email not confirmed/i.test(message) ? "email_not_confirmed"
    : /already registered/i.test(message) ? "user_already_exists"
    : /rate limit/i.test(message) ? "over_request_rate_limit" : null;
  return legacyCode ? messagesByCode[legacyCode]! : fallbackByAction[action];
}
