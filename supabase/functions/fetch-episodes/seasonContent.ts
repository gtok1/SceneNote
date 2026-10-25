import type { ExternalSource } from "../_shared/types.ts";

export interface SeasonContentSource {
  source_api: ExternalSource;
  source_id: string;
}

/** Supabase embeds may be an object or a one-item array; never guess between multiple parents. */
export function resolveSeasonContent(value: unknown): SeasonContentSource | null {
  const content = Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  if (!("source_api" in content) || !("source_id" in content)) return null;
  const { source_api, source_id } = content;
  if (source_api !== "tmdb" && source_api !== "anilist" && source_api !== "kitsu" && source_api !== "tvmaze") return null;
  if (typeof source_id !== "string" || !source_id.trim()) return null;
  return { source_api, source_id: source_id.trim() };
}
