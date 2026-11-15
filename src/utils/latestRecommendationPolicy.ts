export const LATEST_RECOMMENDATION_CACHE_VERSION = "latest-catalog-v1";
export const RECOMMENDATION_POLICY_UNAVAILABLE_MESSAGE = "최신 추천 업데이트가 아직 적용되지 않았어요. 잠시 후 다시 시도해 주세요.";
const INVALID_CURSOR_MESSAGE = "추천 탐색 정보가 오래되었어요. 처음부터 다시 찾아 주세요.";

type RecommendationRequestErrorCode = "POLICY_UNAVAILABLE" | "INVALID_CURSOR" | "REQUEST_FAILED";

export class RecommendationRequestError extends Error {
  readonly code: RecommendationRequestErrorCode;
  constructor(code: RecommendationRequestErrorCode, message: string) {
    super(message);
    this.name = "RecommendationRequestError";
    this.code = code;
  }
}

export function createLatestRecommendationBody<T extends object>(body: T): T & { discovery_mode: "latest" } {
  return { ...body, discovery_mode: "latest" };
}

export function assertLatestRecommendationMode(mode: unknown): void {
  if (mode !== "latest") throw new RecommendationRequestError("POLICY_UNAVAILABLE", RECOMMENDATION_POLICY_UNAVAILABLE_MESSAGE);
}

export function createRecommendationRequestError(status: number | null, code: unknown): RecommendationRequestError {
  if (code === "INVALID_CURSOR" || code === "INVALID_LATEST_RECOMMENDATION_CURSOR") {
    return new RecommendationRequestError("INVALID_CURSOR", INVALID_CURSOR_MESSAGE);
  }
  return new RecommendationRequestError("REQUEST_FAILED", status === null
    ? "추천 연결이 끊겼거나 응답 시간이 초과되었습니다. 다시 시도해 주세요."
    : "추천 서버가 처리를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

export function recommendationRequiresRestart(error: unknown): boolean {
  return error instanceof RecommendationRequestError ? error.code === "INVALID_CURSOR"
    : errorMessage(error) === INVALID_CURSOR_MESSAGE;
}

export function isLatestRecommendationPolicyError(error: unknown): boolean {
  return error instanceof RecommendationRequestError ? error.code === "POLICY_UNAVAILABLE"
    : errorMessage(error) === RECOMMENDATION_POLICY_UNAVAILABLE_MESSAGE;
}

function errorMessage(error: unknown): string | null {
  return typeof error === "string" ? error : error instanceof Error ? error.message : null;
}
