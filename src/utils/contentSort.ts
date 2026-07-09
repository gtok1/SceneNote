export type DateSortOrder = "latest" | "oldest";

export interface YearSortableItem {
  air_year: number | null;
  air_date?: string | null;
  title_primary?: string;
  title?: string;
}

export function normalizeYearFilter(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{4}$/.test(trimmed)) return null;

  const year = Number.parseInt(trimmed, 10);
  if (year < 1900 || year > 2100) return null;
  return year;
}

export function filterByYear<T extends YearSortableItem>(items: T[], year: number | null): T[] {
  if (!year) return items;
  return items.filter((item) => item.air_year === year);
}

export function sortByYear<T extends YearSortableItem>(
  items: T[],
  order: DateSortOrder
): T[] {
  return [...items].sort((a, b) => {
    const aMonth = monthSortValue(a);
    const bMonth = monthSortValue(b);
    const aHasMonth = aMonth !== null;
    const bHasMonth = bMonth !== null;
    if (aHasMonth !== bHasMonth) return aHasMonth ? -1 : 1;

    if (aMonth !== null && bMonth !== null && aMonth !== bMonth) {
      return order === "latest" ? bMonth - aMonth : aMonth - bMonth;
    }

    const aTitle = a.title_primary ?? a.title ?? "";
    const bTitle = b.title_primary ?? b.title ?? "";
    return aTitle.localeCompare(bTitle, "ko");
  });
}

function monthSortValue(item: YearSortableItem): number | null {
  const parsedMonth = parseYearMonthValue(item.air_date);
  if (parsedMonth !== null) return parsedMonth;
  return typeof item.air_year === "number" ? item.air_year * 100 : null;
}

function parseYearMonthValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, yearValue, monthValue] = match;
  if (!yearValue || !monthValue) return null;
  const year = Number.parseInt(yearValue, 10);
  const month = Number.parseInt(monthValue, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return year * 100 + month;
}
