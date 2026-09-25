import { EXCLUDED_THEME_KEYS, hasExcludedTheme, type ExcludedThemeInput } from "./recommendationThemes.ts";

export interface RecommendationFilterFeedback {
  target_type?: string | null;
  target_key?: string | null;
  action?: string | null;
}

export interface UserRecommendationFilters {
  excludedThemeKeys: string[];
  excludedGenres: string[];
}

export interface FilterableRecommendation extends ExcludedThemeInput {
  // A successful TMDB keyword lookup can still return an empty list. In that
  // case the provider has supplied no evidence with which to classify themes.
  external_source?: string | null;
}

export function normalizeRecommendationGenre(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, " ");
}

export function userRecommendationFiltersFromFeedback(
  feedback: readonly RecommendationFilterFeedback[]
): UserRecommendationFilters {
  const themes = new Set<string>();
  const genres = new Set<string>();
  const allowed = new Set<string>(EXCLUDED_THEME_KEYS);
  for (const row of feedback) {
    if (row.action !== "exclude" || !row.target_key) continue;
    if (row.target_type === "theme") {
      const key = row.target_key.startsWith("relationship:")
        ? row.target_key.slice("relationship:".length)
        : "";
      if (allowed.has(key)) themes.add(key);
    } else if (row.target_type === "genre") {
      const key = normalizeRecommendationGenre(row.target_key);
      if (key) genres.add(key);
    }
  }
  return { excludedThemeKeys: [...themes], excludedGenres: [...genres] };
}

export function isRecommendationExcludedForUser(
  candidate: FilterableRecommendation,
  filters: UserRecommendationFilters
): boolean {
  if (filters.excludedGenres.length > 0) {
    const excludedGenres = new Set(filters.excludedGenres);
    if (candidate.genres?.some((genre) => excludedGenres.has(normalizeRecommendationGenre(genre)))) {
      return true;
    }
  }
  if (filters.excludedThemeKeys.length === 0) return false;
  if (hasExcludedTheme(candidate, filters.excludedThemeKeys)) return true;

  // TMDB discovery/trending rows have broad genres only. A keywordless row
  // cannot be verified against a user's hard relationship-theme exclusions.
  // Suppress it rather than claiming the filter succeeded without evidence.
  return candidate.external_source === "tmdb" && !candidate.keywords?.length;
}

export function filterRecommendationsForUser<T extends FilterableRecommendation>(
  candidates: readonly T[],
  filters: UserRecommendationFilters
): T[] {
  return candidates.filter((candidate) => !isRecommendationExcludedForUser(candidate, filters));
}
