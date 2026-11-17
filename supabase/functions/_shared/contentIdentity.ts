import type { ContentType, ExternalSource } from "./types.ts";

export type SourceMediaType = "" | "movie" | "tv";

/** TMDB numeric ids only identify a work together with their endpoint namespace. */
export function requestMediaType(source: ExternalSource | "manual", mediaType: unknown): SourceMediaType | null {
  if (source !== "tmdb") return "";
  return mediaType === "movie" || mediaType === "tv" ? mediaType : null;
}

export function contentMediaType(source: ExternalSource | "manual", contentType: ContentType): SourceMediaType {
  return source !== "tmdb" ? "" : contentType === "movie" ? "movie" : "tv";
}

export function matchesStoredMediaType(value: unknown, source: ExternalSource | "manual", mediaType: SourceMediaType): boolean {
  const content = Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
  if (!content || typeof content !== "object") return false;
  if (source !== "tmdb") return true;
  const row = content as { content_type?: string; source_api?: string; source_media_type?: string };
  if (mediaType !== "movie" && mediaType !== "tv") return false;
  if (!["anime", "kdrama", "jdrama", "movie", "other"].includes(row.content_type ?? "")) return false;
  if ((row.content_type === "movie" ? "movie" : "tv") !== mediaType) return false;
  return row.source_api !== "tmdb" || row.source_media_type === mediaType;
}
