import type { WatchDateParts } from "@/utils/reviewDraft";

export const WATCH_DATE_INPUT_COPY = {
  emptyYear: "기록 안 함",
  today: "오늘",
  todayAccessibilityLabel: "마지막 본 시기를 오늘로 채우기"
} as const;

export function todayWatchDateParts(now: Date): WatchDateParts {
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    day: String(now.getDate())
  };
}
