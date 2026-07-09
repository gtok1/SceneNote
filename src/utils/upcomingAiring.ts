import type { LibraryListItem, WatchStatus } from "@/types/library";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UPCOMING_STATUS_SET = new Set<WatchStatus>(["watching", "wishlist"]);
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function filterUpcomingAiringItems<T extends Pick<LibraryListItem, "air_date" | "statuses">>(
  items: T[],
  today: Date = new Date()
): T[] {
  const todayDay = getKstDayNumber(today);
  const startDay = todayDay - 1;
  const endDay = todayDay + 7;

  return items
    .filter((item) => item.statuses.some((status) => UPCOMING_STATUS_SET.has(status)))
    .filter((item) => {
      const airDay = parseDateOnlyDayNumber(item.air_date);
      return airDay !== null && airDay >= startDay && airDay <= endDay;
    })
    .sort((a, b) => {
      const aDay = parseDateOnlyDayNumber(a.air_date) ?? Number.MAX_SAFE_INTEGER;
      const bDay = parseDateOnlyDayNumber(b.air_date) ?? Number.MAX_SAFE_INTEGER;
      return aDay - bDay;
    });
}

export function formatUpcomingAiringLabel(airDate: string | null, today: Date = new Date()): string {
  const airDay = parseDateOnlyDayNumber(airDate);
  if (airDay === null) return "";

  const diff = airDay - getKstDayNumber(today);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";

  const date = parseDateOnlyParts(airDate);
  if (!date) return "";

  return `${date.month}월 ${date.day}일 (${getKoreanWeekday(date.dayNumber)})`;
}

function getKstDayNumber(date: Date): number {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth() + 1;
  const day = kstDate.getUTCDate();
  return toDayNumber(year, month, day);
}

function parseDateOnlyDayNumber(value: string | null | undefined): number | null {
  return parseDateOnlyParts(value)?.dayNumber ?? null;
}

function parseDateOnlyParts(value: string | null | undefined): {
  year: number;
  month: number;
  day: number;
  dayNumber: number;
} | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  const day = Number.parseInt(match[3] ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    dayNumber: toDayNumber(year, month, day)
  };
}

function toDayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function getKoreanWeekday(dayNumber: number): string {
  return ["목", "금", "토", "일", "월", "화", "수"][dayNumber % 7] ?? "";
}
