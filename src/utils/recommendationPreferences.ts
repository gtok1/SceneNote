export type RecommendationExclusionTargetType = "theme" | "genre";

export interface RecommendationExclusionPreferences {
  excludedThemeKeys: string[];
  excludedGenres: string[];
}

export interface RecommendationExclusionRow {
  target_type: string;
  target_key: string;
}

const RELATIONSHIP_THEME_PREFIX = "relationship:";

export function normalizeRecommendationPreferenceKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function recommendationExclusionTargetKey(
  targetType: RecommendationExclusionTargetType,
  key: string
): string {
  const normalized = normalizeRecommendationPreferenceKey(key);
  if (!normalized) throw new Error("제외할 장르 또는 테마를 선택해 주세요.");
  if (targetType === "genre") return normalized;
  const themeKey = normalized.startsWith(RELATIONSHIP_THEME_PREFIX)
    ? normalized.slice(RELATIONSHIP_THEME_PREFIX.length)
    : normalized;
  if (!themeKey) throw new Error("제외할 테마를 선택해 주세요.");
  return `${RELATIONSHIP_THEME_PREFIX}${themeKey}`;
}

export function parseRecommendationExclusions(
  rows: readonly RecommendationExclusionRow[]
): RecommendationExclusionPreferences {
  const excludedThemeKeys = new Set<string>();
  const excludedGenres = new Set<string>();

  for (const row of rows) {
    const key = normalizeRecommendationPreferenceKey(row.target_key);
    if (row.target_type === "theme" && key.startsWith(RELATIONSHIP_THEME_PREFIX)) {
      const themeKey = key.slice(RELATIONSHIP_THEME_PREFIX.length);
      if (themeKey) excludedThemeKeys.add(themeKey);
    } else if (row.target_type === "genre" && key) {
      excludedGenres.add(key);
    }
  }

  return {
    excludedThemeKeys: [...excludedThemeKeys],
    excludedGenres: [...excludedGenres]
  };
}

export function updateRecommendationExclusions(
  current: RecommendationExclusionPreferences,
  targetType: RecommendationExclusionTargetType,
  targetKey: string,
  excluded: boolean
): RecommendationExclusionPreferences {
  const normalizedTargetKey = recommendationExclusionTargetKey(targetType, targetKey);
  const themeKey = normalizedTargetKey.slice(RELATIONSHIP_THEME_PREFIX.length);
  const collection = targetType === "theme" ? "excludedThemeKeys" : "excludedGenres";
  const key = targetType === "theme" ? themeKey : normalizedTargetKey;
  const next = new Set(current[collection]);
  if (excluded) next.add(key);
  else next.delete(key);
  return { ...current, [collection]: [...next] };
}
