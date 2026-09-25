import { hasExcludedTheme } from "../../supabase/functions/_shared/recommendationThemes";

export interface ExcludableRecommendation {
  genres?: readonly string[] | null;
  keywords?: readonly string[] | null;
  source_tags?: readonly { name: string; source: string; rank?: number | null }[] | null;
  themes?: readonly { family?: string | null; key?: string | null }[] | null;
  external_source?: string | null;
}

export interface RecommendationExclusions {
  excludedThemeKeys: readonly string[];
  excludedGenres: readonly string[];
}

export function normalizeRecommendationGenre(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function isExcludedRecommendation(
  item: ExcludableRecommendation,
  exclusions: RecommendationExclusions
): boolean {
  const themeKeys = exclusions.excludedThemeKeys;
  if (themeKeys.length > 0 && hasExcludedTheme(item, themeKeys)) return true;

  if (exclusions.excludedGenres.length > 0) {
    const genres = new Set(exclusions.excludedGenres.map(normalizeRecommendationGenre));
    if (item.genres?.some((genre) => genres.has(normalizeRecommendationGenre(genre)))) return true;
  }

  // TMDB discovery rows do not include relationship tags. If the detail keyword
  // lookup was unavailable, the item cannot be cleared against an explicit
  // relationship exclusion, so keep it out of that account's recommendation feed.
  if (
    item.external_source === "tmdb" &&
    themeKeys.some((key) => key === "boys-love" || key === "girls-love" || key === "queer-romance") &&
    !item.keywords?.some((keyword) => keyword.trim().length > 0)
  ) {
    return true;
  }

  return false;
}

export function filterExcludedRecommendations<T extends ExcludableRecommendation>(
  items: readonly T[],
  exclusions: RecommendationExclusions
): T[] {
  return items.filter((item) => !isExcludedRecommendation(item, exclusions));
}
