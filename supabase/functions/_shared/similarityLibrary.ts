import { isSameRecommendationWork } from "./recommendationEngine.ts";
import type { SimilarityWork } from "./similarityEngine.ts";

/** Only registration identity is needed; watch status never changes exclusion. */
export interface SimilarityLibraryEntry {
  content_type?: string | null;
  source_api?: string | null;
  source_id?: string | null;
  title_primary?: string | null;
  title_original?: string | null;
  air_year?: number | null;
  air_date?: string | null;
  season_number?: number | null;
  has_seasons?: boolean | null;
  external_ids?: readonly {
    api_source?: string | null;
    external_id?: string | null;
  }[] | null;
  titles?: readonly string[] | null;
}

interface WorkIdentity {
  external_source?: string | null;
  external_id?: string | null;
  content_type?: string | null;
  title_primary?: string | null;
  title_original?: string | null;
  air_year?: number | null;
  air_date?: string | null;
  has_seasons?: boolean | null;
  season_number?: number | null;
}

interface IndexedRegistration {
  identities: WorkIdentity[];
  titles: readonly string[];
  season: number | null;
}

interface SimilarityLibraryIndex {
  ids: Map<string, Set<IndexedRegistration>>;
  titles: Map<string, Set<IndexedRegistration>>;
}

/** Matches public provider aliases without collapsing different seasons or anime films. */
export function isSimilarWorkRegistered(
  candidate: SimilarityWork,
  entries: readonly SimilarityLibraryEntry[]
): boolean {
  return matchesLibraryIndex(candidate, createLibraryIndex(entries));
}

export function filterUnregisteredSimilarWorks<T extends SimilarityWork>(
  candidates: readonly T[],
  entries: readonly SimilarityLibraryEntry[]
): T[] {
  if (entries.length === 0 || candidates.length === 0) return [...candidates];
  const index = createLibraryIndex(entries);
  return candidates.filter((candidate) => !matchesLibraryIndex(candidate, index));
}

function createLibraryIndex(entries: readonly SimilarityLibraryEntry[]): SimilarityLibraryIndex {
  const index: SimilarityLibraryIndex = { ids: new Map(), titles: new Map() };
  for (const entry of entries) {
    const identities = identitiesForRegistration(entry);
    const titles = [...(entry.titles ?? [])];
    const registration: IndexedRegistration = {
      identities,
      titles,
      season: seasonNumber(identities[0]?.season_number)
    };
    for (const identity of identities) {
      addToIndex(index.ids, externalIdentityKey(identity), registration);
    }
    for (const title of [identities[0]?.title_primary, identities[0]?.title_original, ...titles]) {
      addToIndex(index.titles, normalizeTitle(title), registration);
    }
  }
  return index;
}

function matchesLibraryIndex(candidate: SimilarityWork, index: SimilarityLibraryIndex): boolean {
  for (const alias of identitiesForCandidate(candidate)) {
    const possible = new Set<IndexedRegistration>();
    for (const registration of index.ids.get(externalIdentityKey(alias)) ?? []) possible.add(registration);
    for (const title of [alias.title_primary, alias.title_original]) {
      for (const registration of index.titles.get(normalizeTitle(title)) ?? []) possible.add(registration);
    }
    for (const registration of possible) {
      if (seasonsOverlap(alias.season_number, registration.season) &&
          registration.identities.some((registered) => sameRegisteredWork(alias, registered, registration.titles))) {
        return true;
      }
    }
  }
  return false;
}

function addToIndex(
  index: Map<string, Set<IndexedRegistration>>,
  key: string,
  registration: IndexedRegistration
): void {
  if (!key) return;
  let entries = index.get(key);
  if (!entries) {
    entries = new Set();
    index.set(key, entries);
  }
  entries.add(registration);
}

function externalIdentityKey(identity: WorkIdentity): string {
  const source = normalize(identity.external_source);
  const id = normalize(identity.external_id);
  return source && source !== "manual" && id ? `${source}:${id}` : "";
}

/**
 * Opaque, deterministic cache identity, independent of status, row order and duplicate rows.
 * This is a cache fingerprint, not an authorization token; server scopes must also bind the user.
 */
export function similarityLibrarySignature(entries: readonly SimilarityLibraryEntry[]): string {
  const registrations = [...new Set(entries.map((entry) => JSON.stringify({
    source: normalize(entry.source_api),
    id: normalize(entry.source_id),
    type: normalize(entry.content_type),
    year: releaseYear(entry),
    season: seasonNumber(entry.season_number),
    hasSeasons: typeof entry.has_seasons === "boolean" ? entry.has_seasons : null,
    titles: sortedValues([entry.title_primary, entry.title_original, ...(entry.titles ?? [])], normalizeTitle),
    externalIds: sortedValues((entry.external_ids ?? []).map((alias) => {
      const source = normalize(alias.api_source);
      const id = normalize(alias.external_id);
      return source && id ? `${source}:${id}` : "";
    }), normalize)
  })))].sort();
  // Two independent 32-bit passes need only standard JavaScript in Expo and Deno.
  const serialized = JSON.stringify(registrations);
  let forward = 0x811c9dc5;
  let backward = 0x9e3779b9;
  for (let index = 0; index < serialized.length; index += 1) {
    forward = Math.imul(forward ^ serialized.charCodeAt(index), 0x01000193);
    backward = Math.imul(backward ^ serialized.charCodeAt(serialized.length - index - 1), 0x01000193);
  }
  return `sl1.${(forward >>> 0).toString(16).padStart(8, "0")}${(backward >>> 0).toString(16).padStart(8, "0")}`;
}

function identitiesForCandidate(candidate: SimilarityWork): WorkIdentity[] {
  const aliases = (candidate as SimilarityWork & {
    identity_aliases?: readonly WorkIdentity[];
  }).identity_aliases ?? [];
  return [candidate, ...aliases.map((alias) => ({
    ...alias,
    // A provider alias without a season must not erase the selected card's scope.
    season_number: alias.season_number ?? candidate.season_number ?? null
  }))];
}

function identitiesForRegistration(entry: SimilarityLibraryEntry): WorkIdentity[] {
  const canonical: WorkIdentity = {
    external_source: entry.source_api ?? null,
    external_id: entry.source_id ?? null,
    content_type: entry.content_type ?? null,
    title_primary: entry.title_primary ?? null,
    title_original: entry.title_original ?? null,
    air_year: entry.air_year ?? null,
    air_date: entry.air_date ?? null,
    season_number: entry.season_number ?? null,
    has_seasons: entry.has_seasons ?? null
  };
  return [canonical, ...(entry.external_ids ?? []).map((alias) => ({
    ...canonical,
    external_source: alias.api_source ?? null,
    external_id: alias.external_id ?? null
  }))];
}

function sameRegisteredWork(
  candidate: WorkIdentity,
  registered: WorkIdentity,
  titleAliases?: readonly string[] | null
): boolean {
  if (knownDifferentAnimeMedia(candidate, registered)) return false;
  const candidateSource = normalize(candidate.external_source);
  const registeredSource = normalize(registered.external_source);
  const candidateId = normalize(candidate.external_id);
  const registeredId = normalize(registered.external_id);
  if (candidateSource && candidateSource !== "manual" && candidateSource === registeredSource &&
      candidateId && candidateId === registeredId) {
    if (candidateSource !== "tmdb") return true;
    const candidateNamespace = tmdbNamespace(candidate);
    const registeredNamespace = tmdbNamespace(registered);
    // TMDB numbers are not globally unique. Unknown anime medium needs title evidence.
    if (candidateNamespace !== null && candidateNamespace === registeredNamespace) return true;
  }
  if (isSameRecommendationWork(candidate, registered)) return true;
  return (titleAliases ?? []).some((title) => isSameRecommendationWork(candidate, {
    ...registered,
    title_primary: title
  }));
}

function knownDifferentAnimeMedia(left: WorkIdentity, right: WorkIdentity): boolean {
  return normalize(left.content_type) === "anime" && normalize(right.content_type) === "anime" &&
    typeof left.has_seasons === "boolean" && typeof right.has_seasons === "boolean" &&
    left.has_seasons !== right.has_seasons;
}

function tmdbNamespace(item: WorkIdentity): "movie" | "tv" | null {
  const type = normalize(item.content_type);
  if (type === "movie") return "movie";
  if (type === "anime") {
    return typeof item.has_seasons === "boolean" ? item.has_seasons ? "tv" : "movie" : null;
  }
  return type ? "tv" : null;
}

function seasonsOverlap(left?: number | null, right?: number | null): boolean {
  const leftSeason = seasonNumber(left);
  const rightSeason = seasonNumber(right);
  // A generic series already represented by a registered season should not be recommended again.
  return leftSeason === null || rightSeason === null || leftSeason === rightSeason;
}

function seasonNumber(value?: number | null): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function releaseYear(entry: SimilarityLibraryEntry): number | null {
  if (typeof entry.air_year === "number" && Number.isFinite(entry.air_year)) return entry.air_year;
  return entry.air_date && /^\d{4}-/u.test(entry.air_date) ? Number(entry.air_date.slice(0, 4)) : null;
}

function sortedValues(
  values: readonly (string | null | undefined)[],
  normalizeValue: (value: string | null | undefined) => string
): string[] {
  return [...new Set(values.map(normalizeValue).filter(Boolean))].sort();
}

function normalizeTitle(value?: string | null): string {
  return normalize(value).replace(/[\s\p{P}\p{S}]+/gu, "");
}

function normalize(value?: string | null): string {
  return (value ?? "").normalize("NFKC").trim().toLocaleLowerCase();
}
