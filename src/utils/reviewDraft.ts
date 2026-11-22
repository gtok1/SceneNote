export interface WatchDateParts {
  year: string;
  month: string;
  day: string;
}

export const EMPTY_WATCH_DATE: WatchDateParts = { year: "", month: "", day: "" };

export function parseWatchDateParts(value: string | null, fallback?: WatchDateParts | null): WatchDateParts {
  if (!value) return fallback ?? EMPTY_WATCH_DATE;
  const [year = "", month = "", day = ""] = value.split("-");
  return { year, month, day };
}

export interface ReviewDraft {
  rating: number | null;
  oneLineReview: string;
  body: string;
  isSpoiler: boolean;
  firstWatchedDate: WatchDateParts;
  lastWatchedDate: WatchDateParts;
}

export function createReviewDraftSnapshot(input: {
  review: { rating: number | null; one_line_review: string | null; body: string | null; is_spoiler: boolean } | null;
  firstWatchedAt: string | null;
  lastWatchedAt: string | null;
  firstFallback: WatchDateParts | null;
  lastFallback: WatchDateParts | null;
}): ReviewDraft {
  return {
    rating: input.review?.rating ?? null,
    oneLineReview: input.review?.one_line_review ?? "",
    body: input.review?.body ?? "",
    isSpoiler: input.review?.is_spoiler ?? false,
    firstWatchedDate: parseWatchDateParts(input.firstWatchedAt, input.firstFallback),
    lastWatchedDate: parseWatchDateParts(input.lastWatchedAt, input.lastFallback)
  };
}

function sameWatchDate(left: WatchDateParts, right: WatchDateParts): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

export function isReviewDraftDirty(current: ReviewDraft, baseline: ReviewDraft): boolean {
  return current.rating !== baseline.rating
    || current.oneLineReview !== baseline.oneLineReview
    || current.body !== baseline.body
    || current.isSpoiler !== baseline.isSpoiler
    || !sameWatchDate(current.firstWatchedDate, baseline.firstWatchedDate)
    || !sameWatchDate(current.lastWatchedDate, baseline.lastWatchedDate);
}

export function rebaseReviewDraft(current: ReviewDraft, previousBaseline: ReviewDraft, nextBaseline: ReviewDraft): ReviewDraft {
  return {
    rating: current.rating === previousBaseline.rating ? nextBaseline.rating : current.rating,
    oneLineReview: current.oneLineReview === previousBaseline.oneLineReview ? nextBaseline.oneLineReview : current.oneLineReview,
    body: current.body === previousBaseline.body ? nextBaseline.body : current.body,
    isSpoiler: current.isSpoiler === previousBaseline.isSpoiler ? nextBaseline.isSpoiler : current.isSpoiler,
    firstWatchedDate: sameWatchDate(current.firstWatchedDate, previousBaseline.firstWatchedDate)
      ? nextBaseline.firstWatchedDate : current.firstWatchedDate,
    lastWatchedDate: sameWatchDate(current.lastWatchedDate, previousBaseline.lastWatchedDate)
      ? nextBaseline.lastWatchedDate : current.lastWatchedDate
  };
}
