import { normalizeRecommendationGenre, type UserRecommendationFilters } from "./recommendationUserFilters.ts";
import { matchesDiscoveryGenre, normalizeDiscoveryFilters, normalizeDiscoveryGenre, type DiscoveryFilterInput } from "./discoveryFilters.ts";

// Only map exact provider genre names. For example, excluding TMDB's "Action"
// must not silently also exclude its distinct "Action & Adventure" genre.
export const TMDB_RECOMMENDATION_GENRES = new Map<number, string>([
  [12, "Adventure"], [14, "Fantasy"], [16, "Animation"], [18, "Drama"],
  [27, "Horror"], [28, "Action"], [35, "Comedy"], [36, "History"],
  [53, "Thriller"], [80, "Crime"], [878, "Science Fiction"], [9648, "Mystery"],
  [10749, "Romance"], [10751, "Family"], [10759, "Action & Adventure"],
  [10765, "Sci-Fi & Fantasy"], [10766, "Soap"], [10768, "War & Politics"],
  [99, "Documentary"], [10402, "Music"], [10752, "War"]
]);

const ANILIST_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Hentai", "Horror",
  "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi",
  "Slice of Life", "Sports", "Supernatural", "Thriller"
] as const;

const ANILIST_RELATIONSHIP_TAGS: Readonly<Record<string, readonly string[]>> = {
  "boys-love": ["Boys' Love"],
  "girls-love": ["Yuri"],
  // Keep this limited to tags already covered by the hard-filter aliases.
  // The response still passes through the complete shared theme classifier.
  "queer-romance": ["LGBTQ+ Themes"]
};

// Verified provider keyword pages, not guessed IDs. These are an upstream
// optimization; the complete keyword/theme check still runs after discovery.
// https://www.themoviedb.org/keyword/289844-boys-love-bl/tv
// https://www.themoviedb.org/keyword/280003-girls-love/tv
const TMDB_RELATIONSHIP_KEYWORD_IDS: Readonly<Record<string, number>> = {
  "boys-love": 289844,
  "girls-love": 280003
};

export function recommendationProviderFilterKey(filters?: UserRecommendationFilters): string {
  return JSON.stringify({
    themes: sortedUnique(filters?.excludedThemeKeys ?? []),
    genres: sortedUnique((filters?.excludedGenres ?? []).map(normalizeRecommendationGenre))
  });
}

export function tmdbExcludedGenreIds(filters?: UserRecommendationFilters): number[] {
  const excluded = new Set((filters?.excludedGenres ?? []).map(normalizeRecommendationGenre));
  return [...TMDB_RECOMMENDATION_GENRES]
    .filter(([, name]) => excluded.has(normalizeRecommendationGenre(name)))
    .map(([id]) => id)
    .sort((left, right) => left - right);
}

export function tmdbExcludedKeywordIds(filters?: UserRecommendationFilters): number[] {
  return [...new Set((filters?.excludedThemeKeys ?? [])
    .map((key) => TMDB_RELATIONSHIP_KEYWORD_IDS[key])
    .filter((id): id is number => id !== undefined))].sort((left, right) => left - right);
}

export function aniListExcludedFilters(filters?: UserRecommendationFilters): {
  genres: string[];
  tags: string[];
} {
  const excluded = new Set((filters?.excludedGenres ?? []).map(normalizeRecommendationGenre));
  return {
    genres: ANILIST_GENRES.filter((genre) => excluded.has(normalizeRecommendationGenre(genre))),
    tags: sortedUnique((filters?.excludedThemeKeys ?? [])
      .flatMap((key) => ANILIST_RELATIONSHIP_TAGS[key] ?? []))
  };
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

const TMDB_TV_GENRE_IDS = new Set([16, 18, 35, 80, 99, 10751, 10759, 10762, 10763, 10764, 10765, 10766, 10767, 10768, 10770, 9648]);
const TMDB_MOVIE_GENRE_IDS = new Set([12, 14, 16, 18, 27, 28, 35, 36, 53, 80, 99, 878, 9648, 10402, 10749, 10751, 10752, 10770]);
const TMDB_DISCOVERY_GENRES = new Map([...TMDB_RECOMMENDATION_GENRES, [99, "Documentary"], [10402, "Music"], [10752, "War"]]);
export const TMDB_TV_KEYWORD_GENRES = new Set(["romance", "horror", "thriller"]);

/** undefined means all genres; null means this endpoint does not expose that genre. */
export function tmdbIncludedGenreId(genre: string | undefined, endpoint: "tv" | "movie"): number | null | undefined {
  const selected = normalizeDiscoveryGenre(genre);
  if (selected === "all") return undefined;
  const supported = endpoint === "tv" ? TMDB_TV_GENRE_IDS : TMDB_MOVIE_GENRE_IDS;
  return [...TMDB_DISCOVERY_GENRES].find(([id, name]) =>
    supported.has(id) && matchesDiscoveryGenre([name], selected)
  )?.[0] ?? null;
}

export function aniListIncludedGenre(genre?: string): string | null | undefined {
  const selected = normalizeDiscoveryGenre(genre);
  if (selected === "all" || selected === "animation") return undefined;
  return ANILIST_GENRES.find((name) => normalizeDiscoveryGenre(name) === selected) ?? null;
}

export function canFetchRecommendationProvider(
  provider: "tmdb_kr" | "tmdb_jp" | "anilist" | "tmdb_movie",
  discoveryFilters?: DiscoveryFilterInput,
  exclusions?: UserRecommendationFilters
): boolean {
  const selected = normalizeDiscoveryFilters(discoveryFilters);
  const mediaType = provider === "anilist" ? "anime" : provider === "tmdb_movie" ? "movie" : "drama";
  if (selected.mediaTypes.length && !selected.mediaTypes.includes(mediaType)) return false;
  const genres = selected.genres.filter((genre) => !exclusions?.excludedGenres.some((excluded) => normalizeDiscoveryGenre(excluded) === genre));
  if (selected.genres.length && genres.length === 0) return false;
  if (provider === "anilist") return !genres.length || genres.some((genre) => aniListIncludedGenre(genre) !== null);
  if (provider === "tmdb_movie") return !genres.length || genres.some((genre) => tmdbIncludedGenreId(genre, "movie") !== null);
  // One explicit-country TV query handles their OR union. Default browsing
  // retains the two existing country slots and unchanged request volume.
  if (selected.countries.length) {
    const japanOnly = selected.countries.length === 1 && selected.countries[0] === "JP";
    if (provider === "tmdb_jp" && !japanOnly) return false;
    if (provider === "tmdb_kr" && japanOnly) return false;
  }
  return !genres.length || genres.some((genre) => {
    const id = tmdbIncludedGenreId(genre, "tv");
    return (id !== null || TMDB_TV_KEYWORD_GENRES.has(genre)) && id !== 16;
  });
}
