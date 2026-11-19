/** Explicit nonfiction evidence; comedy/crime/SF alone are still scripted drama. */
const NON_DRAMA_GENRES = new Set([
  "reality", "리얼리티", "talk", "토크", "news", "뉴스",
  "documentary", "다큐멘터리", "예능"
]);

export function hasNonDramaGenre(genres?: readonly string[] | null): boolean {
  return (genres ?? []).some((genre) => NON_DRAMA_GENRES.has(genre.normalize("NFKC").trim().toLowerCase()));
}

export function hasJapaneseOriginalTitle(title?: string | null): boolean {
  const original = title?.normalize("NFKC") ?? "";
  return /[ぁ-ゖァ-ヺ]/u.test(original) && !/[ᄀ-ᇿ㄰-㆏가-힣]/u.test(original);
}

/** A regional drama display choice, not proof of a work's production countries. */
export function dramaRegionalCountry(candidate: {
  external_source?: string;
  title_original?: string | null;
  original_language?: string | null;
  languages?: readonly string[] | null;
}): "KR" | "JP" | null {
  if (candidate.external_source !== "tmdb") return null;
  const explicit = candidate.original_language?.trim().toLowerCase();
  const languages = [...new Set((candidate.languages ?? []).map((language) => language.trim().toLowerCase()).filter(Boolean))];
  if (explicit || languages.length) {
    const language = explicit || (languages.length === 1 ? languages[0] : null);
    return language === "ja" ? "JP" : language === "ko" ? "KR" : null;
  }
  return hasJapaneseOriginalTitle(candidate.title_original) ? "JP" : null;
}
