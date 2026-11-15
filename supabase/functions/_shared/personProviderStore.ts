import type { AniListStaffName, TmdbPersonNameDetail } from "./personNames.ts";
import { PersistentMetadataCacheError, readThroughPersistentMetadata, type PersistentMetadataStore } from "./persistentMetadataCache.ts";

export const PERSON_PROVIDER_RECHECK_MS = 30 * 24 * 60 * 60_000;

export interface TmdbPersonProviderCredit {
  id: number;
  media_type?: "movie" | "tv";
  title?: string | null;
  name?: string | null;
  original_title?: string | null;
  original_name?: string | null;
  poster_path?: string | null;
  overview?: string | null;
  character?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  origin_country?: string[];
  genre_ids?: number[];
  popularity?: number | null;
  vote_count?: number | null;
}

export interface TmdbPersonProviderProfile extends TmdbPersonNameDetail {
  id: number;
  name: string;
  also_known_as?: string[];
  profile_path?: string | null;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  gender?: number | null;
  biography?: string | null;
  combined_credits: { cast: TmdbPersonProviderCredit[] };
  translations: NonNullable<TmdbPersonNameDetail["translations"]>;
}

export interface PersonProviderOptions {
  store: PersistentMetadataStore;
  forceRefresh?: boolean;
  recheckAfterMs?: number;
  apiKey?: string | null;
  fetcher?: typeof fetch;
  now?: () => number;
}

export async function getStoredAniListStaffName(id: string, options: Omit<PersonProviderOptions, "apiKey"> & { endpoint?: string }): Promise<AniListStaffName> {
  if (!/^\d+$/.test(id)) throw new Error("Invalid AniList staff ID");
  const now = options.now ?? Date.now;
  interface SavedName { id: number; name: AniListStaffName; saved_at: string }
  const isValid = (value: unknown): value is SavedName => isRecord(value) && value.id === Number(id) &&
    typeof value.saved_at === "string" && Number.isFinite(Date.parse(value.saved_at)) && isAniListName(value.name);
  const cached = await readThroughPersistentMetadata<SavedName>({
    key: JSON.stringify(["person-provider-name", 1, "anilist", id]), source: "anilist",
    forceRefresh: options.forceRefresh === true,
    store: {
      async read(key, source) {
        const saved = await options.store.read(key, source);
        if (isValid(saved) && options.recheckAfterMs !== undefined &&
          now() - Date.parse(saved.saved_at) >= options.recheckAfterMs) return null;
        return saved;
      },
      write: (key, source, value) => options.store.write(key, source, value)
    },
    isValid,
    async fetchFresh() {
      const response = await (options.fetcher ?? fetch)(options.endpoint ?? "https://graphql.anilist.co", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "query ($id: Int) { Staff(id: $id) { id name { first last full native alternative } } }",
          variables: { id: Number(id) }
        })
      });
      if (!response.ok) throw new Error(`AniList name HTTP ${response.status}`);
      const payload = await response.json() as { data?: { Staff?: { id?: unknown; name?: unknown } | null }; errors?: unknown[] };
      if (payload.errors?.length) throw new Error("AniList error");
      return { id: payload.data?.Staff?.id, name: payload.data?.Staff?.name,
        saved_at: new Date(now()).toISOString() } as SavedName;
    }
  });
  return cached.data.name;
}

export async function readSavedTmdbPersonProfile(id: string, options: Pick<PersonProviderOptions, "store">): Promise<TmdbPersonProviderProfile | null> {
  let saved: unknown;
  try {
    saved = await options.store.read(tmdbProfileKey(id), "tmdb");
  } catch {
    throw new PersistentMetadataCacheError("CACHE_READ_FAILED");
  }
  if (saved === null) return null;
  if (!isStoredTmdbPersonProfile(saved, id)) throw new PersistentMetadataCacheError("INVALID_CACHE_ENTRY");
  return saved.profile;
}

interface StoredTmdbPersonProfile {
  profile: TmdbPersonProviderProfile;
  saved_at: string;
}

export async function getStoredTmdbPersonProfile(id: string, options: PersonProviderOptions): Promise<TmdbPersonProviderProfile> {
  const now = options.now ?? Date.now;
  const key = tmdbProfileKey(id);
  const isValid = (value: unknown): value is StoredTmdbPersonProfile => isStoredTmdbPersonProfile(value, id);
  const result = await readThroughPersistentMetadata<StoredTmdbPersonProfile>({
    key, source: "tmdb", forceRefresh: options.forceRefresh === true,
    store: {
      async read(cacheKey, source) {
        const saved = await options.store.read(cacheKey, source);
        // Only automatic name/classification/search correction requests use this 30-day recheck.
        // Manual detail calls omit recheckAfterMs and keep the same public snapshot until refresh.
        if (isValid(saved) && options.recheckAfterMs !== undefined &&
          now() - Date.parse(saved.saved_at) >= options.recheckAfterMs) return null;
        return saved;
      },
      write: (cacheKey, source, value) => options.store.write(cacheKey, source, value)
    },
    isValid,
    async fetchFresh() {
      const apiKey = options.apiKey?.trim();
      if (!apiKey) throw new Error("TMDB_API_KEY is not configured");
      const url = new URL(`https://api.themoviedb.org/3/person/${id}`);
      url.searchParams.set("language", "ko-KR");
      url.searchParams.set("append_to_response", "combined_credits,translations");
      const headers: HeadersInit = apiKey.startsWith("eyJ") ? { Authorization: `Bearer ${apiKey}` } : {};
      if (!apiKey.startsWith("eyJ")) url.searchParams.set("api_key", apiKey);
      const response = await (options.fetcher ?? fetch)(url.toString(), { headers });
      if (!response.ok) throw new Error(`TMDB person HTTP ${response.status}`);
      return { profile: await response.json() as TmdbPersonProviderProfile, saved_at: new Date(now()).toISOString() };
    }
  });
  return result.data.profile;
}

function tmdbProfileKey(id: string): string {
  if (!/^\d+$/.test(id)) throw new Error("Invalid TMDB person ID");
  return JSON.stringify(["person-provider-profile", 1, "tmdb", id, "ko-KR", "combined_credits,translations"]);
}

function isStoredTmdbPersonProfile(value: unknown, id: string): value is StoredTmdbPersonProfile {
  return isRecord(value) && typeof value.saved_at === "string" && Number.isFinite(Date.parse(value.saved_at)) &&
    isTmdbProfile(value.profile, id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): boolean { return value == null || typeof value === "string"; }

function isAniListName(value: unknown): value is AniListStaffName {
  return isRecord(value) && ["first", "last", "full", "native"].some(key => key in value) &&
    ["first", "last", "full", "native"].every(key => optionalString(value[key])) &&
    (value.alternative == null || Array.isArray(value.alternative) && value.alternative.every(alias => optionalString(alias)));
}

function isTmdbProfile(value: unknown, id: string): value is TmdbPersonProviderProfile {
  if (!isRecord(value) || value.id !== Number(id) || typeof value.name !== "string" || !value.name.trim() ||
    !["profile_path", "birthday", "deathday", "place_of_birth", "biography"].every(key => optionalString(value[key])) ||
    !(value.gender == null || typeof value.gender === "number" && Number.isFinite(value.gender)) ||
    !(value.also_known_as === undefined || Array.isArray(value.also_known_as) && value.also_known_as.every(alias => typeof alias === "string")) ||
    !isRecord(value.combined_credits) || !Array.isArray(value.combined_credits.cast) ||
    !isRecord(value.translations) || !Array.isArray(value.translations.translations)) return false;

  return value.combined_credits.cast.every(credit => isRecord(credit) && Number.isSafeInteger(credit.id) &&
    (credit.id as number) > 0 && (credit.media_type === undefined || credit.media_type === "movie" || credit.media_type === "tv") &&
    ["title", "name", "original_title", "original_name", "poster_path", "overview", "character", "release_date", "first_air_date"]
      .every(key => optionalString(credit[key])) &&
    ["popularity", "vote_count"].every(key => credit[key] == null || typeof credit[key] === "number" && Number.isFinite(credit[key])) &&
    (credit.genre_ids === undefined || Array.isArray(credit.genre_ids) && credit.genre_ids.every(genre => Number.isInteger(genre))) &&
    (credit.origin_country === undefined || Array.isArray(credit.origin_country) && credit.origin_country.every(country => typeof country === "string"))) &&
    value.translations.translations.every(translation => isRecord(translation) &&
      optionalString(translation.iso_639_1) && optionalString(translation.iso_3166_1) &&
      (translation.data == null || isRecord(translation.data) && optionalString(translation.data.name)));
}
