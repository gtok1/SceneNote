/** Positive discovery choices. Recommendation exclusions remain a separate, stricter rule. */
export type DiscoveryMediaType = "anime" | "drama" | "movie";

export interface DiscoveryFilters {
  year?: number;
  genres: string[];
  countries: string[];
  mediaTypes: DiscoveryMediaType[];
}

export interface DiscoveryFilterInput {
  year?: number | null | undefined;
  genres?: readonly string[] | undefined;
  countries?: readonly string[] | undefined;
  mediaTypes?: readonly DiscoveryMediaType[] | undefined;
  /** Legacy single-selection requests remain valid. Explicit arrays take precedence. */
  genre?: string | undefined;
  country?: string | undefined;
}

export interface DiscoveryCandidate {
  air_year?: number | null;
  genres?: readonly string[] | null;
  countries?: readonly string[] | null;
  origin_country?: readonly string[] | null;
  /** Query evidence: at least one requested country matched, not a list of coproduction countries. */
  matched_countries?: readonly string[] | null;
  matched_genres?: readonly string[] | null;
  content_type?: string;
  category?: string;
  has_seasons?: boolean | null;
}

const GENRE_ALIASES: Record<string, string> = {
  액션: "action", 어드벤처: "adventure", 모험: "adventure",
  "액션/어드벤처": "action & adventure", "액션·어드벤처": "action & adventure",
  애니메이션: "animation", anime: "animation", 코미디: "comedy", 범죄: "crime",
  드라마: "drama", 가족: "family", 판타지: "fantasy", 공포: "horror",
  미스터리: "mystery", 로맨스: "romance", sf: "sci-fi", "science fiction": "sci-fi",
  "sf/판타지": "sci-fi & fantasy", "sf·판타지": "sci-fi & fantasy", 스릴러: "thriller",
  다큐멘터리: "documentary", 에치: "ecchi", 하렘: "harem", 성인: "hentai",
  역사: "history", 시대극: "history", 이세계: "isekai", 키즈: "kids",
  마법소녀: "mahou shoujo", 메카: "mecha", 음악: "music", 뉴스: "news",
  심리: "psychological", 리얼리티: "reality", 연속극: "soap", 일상: "slice of life",
  학원: "school", 스포츠: "sports", 초자연: "supernatural", 토크: "talk",
  "tv 영화": "tv movie", 전쟁: "war", "전쟁/정치": "war & politics",
  서부극: "western", 야오이: "yaoi", 유리: "yuri", 성장: "coming of age"
};

export function normalizeDiscoveryGenre(value?: string): string {
  const key = (value ?? "all").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  return GENRE_ALIASES[key] ?? (key || "all");
}

export function normalizeDiscoveryFilters(input: DiscoveryFilterInput = {}): DiscoveryFilters {
  const genreValues = (input.genres ?? [input.genre ?? "all"]).map(normalizeDiscoveryGenre);
  const genres = genreValues.includes("all") ? [] : uniqueSorted(genreValues);
  const countryValues = (input.countries ?? [input.country ?? "all"]).map((value) => value.trim().toUpperCase()).filter(Boolean);
  const countries = countryValues.includes("ALL") ? [] : uniqueSorted(countryValues);
  const mediaTypes = uniqueSorted((input.mediaTypes ?? []).filter((value) => ["anime", "drama", "movie"].includes(value))) as DiscoveryMediaType[];
  const year = typeof input.year === "number" && Number.isInteger(input.year) && input.year >= 1900 && input.year <= 2100 ? input.year : undefined;
  return { ...(year !== undefined ? { year } : {}), genres, countries, mediaTypes: mediaTypes.length === 3 ? [] : mediaTypes };
}

export function discoveryFilterKey(input: DiscoveryFilterInput = {}): string {
  const { genres, countries, mediaTypes, year } = normalizeDiscoveryFilters(input);
  return JSON.stringify([genres, countries, mediaTypes, ...(year !== undefined ? [year] : [])]);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

/** Provider compound genres include either of their named constituent genres. */
export function matchesDiscoveryGenre(genres: readonly string[] | null | undefined, selected: string): boolean {
  const genre = normalizeDiscoveryGenre(selected);
  if (genre === "all") return true;
  return (genres ?? []).some((value) => {
    const candidate = normalizeDiscoveryGenre(value);
    return candidate === genre ||
      (candidate === "action & adventure" && (genre === "action" || genre === "adventure")) ||
      (candidate === "sci-fi & fantasy" && (genre === "sci-fi" || genre === "fantasy")) ||
      (candidate === "war & politics" && genre === "war");
  });
}

export function matchesDiscoveryFilters(candidate: DiscoveryCandidate, input: DiscoveryFilterInput = {}): boolean {
  const filters = normalizeDiscoveryFilters(input);
  const genreMatches = filters.genres.length === 0 || filters.genres.some((genre) =>
    matchesDiscoveryGenre(candidate.genres, genre) ||
    (genre === "animation" && (candidate.content_type === "anime" || candidate.category === "anime"))
  ) || Boolean(candidate.matched_genres?.length && candidate.matched_genres.every((possibleGenre) =>
    filters.genres.some((genre) => matchesDiscoveryGenre([possibleGenre], genre))
  ));
  const countries = [...(candidate.countries ?? []), ...(candidate.origin_country ?? [])];
  const countryMatches = filters.countries.length === 0 || countries.some((country) => filters.countries.includes(country.trim().toUpperCase())) ||
    Boolean(candidate.matched_countries?.length && candidate.matched_countries.every((country) => filters.countries.includes(country.trim().toUpperCase())));
  const type = discoveryMediaType(candidate);
  const typeMatches = filters.mediaTypes.length === 0 || (type !== null && filters.mediaTypes.includes(type));
  return genreMatches && countryMatches && typeMatches && (filters.year === undefined || candidate.air_year === filters.year);
}

export function discoveryMediaType(candidate: DiscoveryCandidate): DiscoveryMediaType | null {
  if (candidate.content_type === "anime" || candidate.category === "anime") return "anime";
  if (candidate.content_type === "movie" || candidate.category === "movie") return "movie";
  if (["kdrama", "jdrama"].includes(candidate.content_type ?? "") || candidate.category === "drama" ||
    (candidate.content_type === "other" && candidate.has_seasons === true)) return "drama";
  return null;
}


export interface AppliedDiscoveryFilters {
  year: number | null;
  genres: string[];
  countries: string[];
  media_types: DiscoveryMediaType[];
}

export function toAppliedDiscoveryFilters(input?: DiscoveryFilterInput): AppliedDiscoveryFilters {
  const normalized = normalizeDiscoveryFilters(input);
  return { year: normalized.year ?? null, genres: normalized.genres, countries: normalized.countries, media_types: normalized.mediaTypes };
}

export type UnsupportedDiscoveryFilter = "year" | "filters";

export function detectUnsupportedDiscoveryFilter(
  requested: DiscoveryFilterInput | undefined,
  applied: unknown
): UnsupportedDiscoveryFilter | null {
  const request = toAppliedDiscoveryFilters(requested);
  const value = applied as Partial<AppliedDiscoveryFilters> | null;
  const isStringArray = (items: unknown): items is string[] => Array.isArray(items) && items.every(item => typeof item === "string");
  if (!value || typeof value !== "object" ||
    !(value.year === null || Number.isInteger(value.year)) ||
    !isStringArray(value.genres) || !isStringArray(value.countries) || !isStringArray(value.media_types)) {
    return request.year !== null ? "year" : null;
  }
  const response = toAppliedDiscoveryFilters({ year: value.year, genres: value.genres, countries: value.countries, mediaTypes: value.media_types as DiscoveryMediaType[] });
  if (response.year !== request.year) return "year";
  return JSON.stringify([response.genres, response.countries, response.media_types]) !==
    JSON.stringify([request.genres, request.countries, request.media_types]) ? "filters" : null;
}
