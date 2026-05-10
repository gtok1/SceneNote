export type DateSortOrder = "latest" | "oldest";

export interface YearSortableItem {
  air_year: number | null;
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
    const aHasYear = typeof a.air_year === "number";
    const bHasYear = typeof b.air_year === "number";
    if (aHasYear !== bHasYear) return aHasYear ? -1 : 1;

    const aYear = a.air_year ?? 0;
    const bYear = b.air_year ?? 0;
    if (aYear !== bYear) return order === "latest" ? bYear - aYear : aYear - bYear;

    const aTitle = a.title_primary ?? a.title ?? "";
    const bTitle = b.title_primary ?? b.title ?? "";
    return aTitle.localeCompare(bTitle, "ko");
  });
}
