interface ReleaseDatedRecommendation {
  air_year: number | null;
  air_date?: string | null;
}

/** Sort the accumulated feed without changing identities or the incoming order of ties. */
export function sortRecommendationsByRelease<T extends ReleaseDatedRecommendation>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index, release: releaseSortValue(item) }))
    .sort((left, right) => right.release - left.release || left.index - right.index)
    .map(({ item }) => item);
}

function releaseSortValue(item: ReleaseDatedRecommendation): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.air_date?.trim() ?? "");
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    // Validate calendar components directly, avoiding local timezones and Date's day rollover.
    if (isValidYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= monthDays[month - 1]!) {
      return year * 10_000 + month * 100 + day;
    }
  }
  // Month/day zero places a year-only value behind every known date in that same year.
  return isValidYear(item.air_year) ? item.air_year * 10_000 : 0;
}

function isValidYear(year: number | null): year is number {
  return year !== null && Number.isFinite(year) && Number.isInteger(year) && year >= 1 && year <= 9999;
}
