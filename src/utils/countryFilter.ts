/**
 * Country filter for the search screen.
 *
 * Selecting a country without typing anything switches the screen into browse mode,
 * where the backend lists titles from that country instead of searching by title.
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
