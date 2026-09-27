/**
 * Country filter for the search screen.
 *
 * The search screen applies this production-country choice to title search and
 * personal recommendations. Empty input still shows personal recommendations.
 * The browse helpers are retained for the search service's explicit browse API.
 */

export const ALL_COUNTRY_FILTER = "all";

export interface CountryFilterOption {
  /** ISO 3166-1 alpha-2, matching TMDB `origin_country` and `with_origin_country`. */
  code: string;
  label: string;
}

export const COUNTRY_FILTER_OPTIONS: CountryFilterOption[] = [
  { code: "KR", label: "한국" },
  { code: "JP", label: "일본" },
  { code: "US", label: "미국" },
  { code: "CN", label: "중국" }
];

export function getCountryFilterLabel(countryFilter: string): string {
  if (countryFilter === ALL_COUNTRY_FILTER) return "모든 제작 국가";
  const code = countryFilter.trim().toUpperCase();
  return COUNTRY_FILTER_OPTIONS.find((option) => option.code === code)?.label ?? code;
}

export function matchesCountryFilter(
  originCountry: readonly string[] | null | undefined,
  countryFilter: string
): boolean {
  if (countryFilter === ALL_COUNTRY_FILTER) return true;

  const target = countryFilter.toUpperCase();
  return (originCountry ?? []).some((code) => code.trim().toUpperCase() === target);
}

/** No query but a country picked: list that country's titles instead of searching. */
export function isBrowseMode(query: string, countryFilter: string): boolean {
  return query.trim().length === 0 && countryFilter !== ALL_COUNTRY_FILTER;
}

export function canRunSearch(query: string, countryFilter: string): boolean {
  return query.trim().length > 0 || isBrowseMode(query, countryFilter);
}
