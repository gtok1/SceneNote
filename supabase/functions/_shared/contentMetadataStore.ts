import { readThroughPersistentMetadata, type PersistentMetadataStore } from "./persistentMetadataCache.ts";
import type { ContentMeta, ExternalSource } from "./types.ts";

export function contentMetadataCacheKey(source: ExternalSource, externalId: string, mediaType?: string): string {
  const kind = mediaType === "movie" ? "movie" : mediaType === "tv" ? "tv" : "unknown";
  return `content-metadata:v1:${source}:${kind}:${externalId.trim()}`;
}

/** Only public normalized metadata is persisted; registration identity is resolved by each handler. */
export async function readContentMetadata(options: {
  source: ExternalSource;
  externalId: string;
  mediaType?: string;
  store: PersistentMetadataStore;
  forceRefresh?: boolean;
  fetchFresh: () => Promise<ContentMeta>;
}): Promise<{ data: ContentMeta; fromCache: boolean }> {
  return readThroughPersistentMetadata({
    key: contentMetadataCacheKey(options.source, options.externalId, options.mediaType),
    source: options.source,
    store: options.store,
    forceRefresh: options.forceRefresh,
    fetchFresh: async () => publicContentMetadata(await options.fetchFresh()),
    isValid: (value): value is ContentMeta => isContentMetadata(value, options)
  });
}

function publicContentMetadata(value: ContentMeta): ContentMeta {
  return {
    external_source: value.external_source, external_id: value.external_id, content_type: value.content_type,
    title_primary: value.title_primary, title_original: value.title_original, poster_url: value.poster_url,
    overview: value.overview, localized_overview: value.localized_overview ?? null,
    air_year: value.air_year, air_date: value.air_date, end_date: value.end_date,
    has_seasons: value.has_seasons, episode_count: value.episode_count,
    genres: value.genres, ...(value.source_tags ? { source_tags: value.source_tags } : {}), seasons: value.seasons,
    cast: value.cast, crew: value.crew
  };
}

function isContentMetadata(value: unknown, expected: {
  source: ExternalSource; externalId: string; mediaType?: string;
}): value is ContentMeta {
  if (!value || typeof value !== "object") return false;
  const meta = value as Partial<ContentMeta>;
  return meta.external_source === expected.source && meta.external_id === expected.externalId &&
    typeof meta.title_primary === "string" && meta.title_primary.trim().length > 0 &&
    ["anime", "kdrama", "jdrama", "movie", "other"].includes(meta.content_type ?? "") &&
    (expected.source !== "tmdb" || expected.mediaType !== "movie" || meta.content_type === "movie") &&
    (expected.source !== "tmdb" || expected.mediaType !== "tv" || meta.content_type !== "movie") &&
    nullableString(meta.title_original) && nullableString(meta.poster_url) && nullableString(meta.overview) &&
    (meta.localized_overview === undefined || nullableString(meta.localized_overview)) &&
    nullableInteger(meta.air_year, 1) && nullableString(meta.air_date) && nullableString(meta.end_date) &&
    nullableInteger(meta.episode_count, 0) && typeof meta.has_seasons === "boolean" &&
    Array.isArray(meta.genres) && meta.genres.every(name => typeof name === "string") &&
    Array.isArray(meta.seasons) && meta.seasons.every(season => record(season) &&
      positiveId(season.season_number) && nullableString(season.title) &&
      nullableInteger(season.episode_count, 0) && nullableInteger(season.air_year, 1)) &&
    Array.isArray(meta.cast) && meta.cast.every(member => record(member) &&
      (member.source === "tmdb" || member.source === "anilist") && positiveId(member.id) && nonEmptyString(member.name) &&
      nullableString(member.original_name) && nullableString(member.character) && nullableString(member.profile_url) &&
      typeof member.order === "number" && Number.isInteger(member.order) && member.order >= 0) &&
    Array.isArray(meta.crew) && meta.crew.every(member => record(member) && positiveId(member.id) && nonEmptyString(member.name) &&
      ["director", "writer", "original", "creator"].includes(String(member.role)) && typeof member.job === "string" &&
      nullableString(member.original_name) && nullableString(member.profile_url)) &&
    (meta.source_tags === undefined || Array.isArray(meta.source_tags) && meta.source_tags.every(tag => record(tag) &&
      nonEmptyString(tag.name) && typeof tag.source === "string" &&
      (tag.rank === undefined || tag.rank === null || typeof tag.rank === "number" && Number.isFinite(tag.rank)))) &&
    !("content_id" in meta) && !("registered" in meta);
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function nonEmptyString(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function nullableString(value: unknown): value is string | null { return value === null || typeof value === "string"; }
function positiveId(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value > 0; }
function nullableInteger(value: unknown, minimum: number): value is number | null {
  return value === null || typeof value === "number" && Number.isInteger(value) && value >= minimum;
}
