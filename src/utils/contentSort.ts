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
    const aDate = dateSortValue(a);
    const bDate = dateSortValue(b);
    const aHasDate = aDate !== null;
    const bHasDate = bDate !== null;
    if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;

    if (aDate !== null && bDate !== null && aDate !== bDate) {
      return order === "latest" ? bDate - aDate : aDate - bDate;
    }

    const aTitle = a.title_primary ?? a.title ?? "";
    const bTitle = b.title_primary ?? b.title ?? "";
    return aTitle.localeCompare(bTitle, "ko");
  });
}

function dateSortValue(item: YearSortableItem): number | null {
  const parsedDate = parseDateValue(item.air_date);
  if (parsedDate !== null) return parsedDate;
  return typeof item.air_year === "number" ? item.air_year * 10000 : null;
}

function parseDateValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, yearValue, monthValue, dayValue] = match;
  if (!yearValue || !monthValue || !dayValue) return null;
  const year = Number.parseInt(yearValue, 10);
  const month = Number.parseInt(monthValue, 10);
  const day = Number.parseInt(dayValue, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return year * 10000 + month * 100 + day;
}
