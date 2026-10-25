import {
  advanceRecommendationNoProgressStreak,
  decideEmptyRecommendationContinuation,
  MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS,
  MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS,
  MAX_CONSECUTIVE_RECOMMENDATION_NO_PROGRESS_ATTEMPTS
} from "./recommendationFeed";

export type RecommendationInvocationReason =
  | "initial" | "continuation" | "scroll_batch" | "action_batch" | "refill"
  | "resume" | "refresh" | "impressions" | "feedback";
export interface RecommendationInvocationLog {
  scope: string;
  entries: { reason: RecommendationInvocationReason; atMs: number }[];
}
export const AUTOMATIC_INVOCATION_WINDOW_MS = 60_000;
export const MAX_AUTOMATIC_INVOCATIONS_PER_WINDOW = 12;

export function recordRecommendationInvocation(
  log: RecommendationInvocationLog, scope: string, reason: RecommendationInvocationReason, atMs: number
): RecommendationInvocationLog {
  const entries = log.scope === scope ? log.entries : [];
  return { scope, entries: [...entries, { reason, atMs }].slice(-200) };
}

export function summarizeRecommendationInvocations(log: RecommendationInvocationLog): {
  total: number; byReason: Partial<Record<RecommendationInvocationReason, number>>;
} {
  const byReason: Partial<Record<RecommendationInvocationReason, number>> = {};
  for (const { reason } of log.entries) byReason[reason] = (byReason[reason] ?? 0) + 1;
  return { total: log.entries.length, byReason };
}

export function canStartAutomaticRecommendationInvocation(
  log: RecommendationInvocationLog, scope: string, nowMs: number
): boolean {
  return log.scope !== scope || log.entries.filter(entry =>
    (entry.reason === "continuation" || entry.reason === "action_batch") &&
    nowMs - entry.atMs < AUTOMATIC_INVOCATION_WINDOW_MS
  ).length < MAX_AUTOMATIC_INVOCATIONS_PER_WINDOW;
}

export function simulateRecommendationBatch(input: {
  trigger: "initial" | "scroll_batch" | "action_batch";
  startVisible: number; target: number; yields: readonly number[];
  log: RecommendationInvocationLog; scope: string; startMs: number;
}): {
  calls: number; finalVisible: number;
  stoppedBy: "target" | "no_progress" | "attempts" | "cap" | "exhausted";
  log: RecommendationInvocationLog; endMs: number;
} {
  let calls = 0;
  let finalVisible = input.startVisible;
  let log = input.log;
  let endMs = input.startMs;
  let noProgress = 0;
  const result = (stoppedBy: "target" | "no_progress" | "attempts" | "cap" | "exhausted") =>
    ({ calls, finalVisible, stoppedBy, log, endMs });
  if (finalVisible >= input.target) return result("target");
  for (const yielded of input.yields) {
    const reason = calls === 0 ? input.trigger : "continuation";
    if ((reason === "continuation" || reason === "action_batch") &&
      !canStartAutomaticRecommendationInvocation(log, input.scope, endMs)) return result("cap");
    log = recordRecommendationInvocation(log, input.scope, reason, endMs);
    const previousVisible = finalVisible;
    finalVisible += yielded;
    calls += 1;
    endMs += 1000;
    noProgress = advanceRecommendationNoProgressStreak(noProgress, previousVisible, finalVisible);
    const decision = decideEmptyRecommendationContinuation({
      hasData: true, itemCount: finalVisible, targetItemCount: input.target,
      isLoading: false, hasError: false, hasMore: true, nextCursor: "simulation",
      isExhausted: false, continuationAttempts: calls,
      consecutiveNoProgressAttempts: noProgress,
      maxContinuationAttempts: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_CONTINUATIONS,
      elapsedMs: endMs - input.startMs,
      maxDurationMs: MAX_AUTOMATIC_EMPTY_RECOMMENDATION_DURATION_MS
    });
    if (finalVisible >= input.target) return result("target");
    if (decision === "stopped") return result(
      noProgress >= MAX_CONSECUTIVE_RECOMMENDATION_NO_PROGRESS_ATTEMPTS ? "no_progress" : "attempts"
    );
  }
  return result("exhausted");
}
