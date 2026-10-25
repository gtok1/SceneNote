import type { CastMember, ContentType } from "../types/content";
import { formatPersonName } from "./japaneseName";
import { getGenreDisplayName } from "./genre";

export function recommendationCastLabel(contentType: ContentType, genres: readonly string[] = []): "성우" | "출연배우" {
  return contentType === "anime" || genres.some(genre => getGenreDisplayName(genre) === "애니메이션")
    ? "성우" : "출연배우";
}

export function recommendationCastMediaType(contentType: ContentType): "movie" | "tv" {
  return contentType === "movie" ? "movie" : "tv";
}

/** API billing order, with duplicate people/blank names removed before taking two. */
export function recommendationCastNames(cast: readonly CastMember[], fallbackSource: "tmdb" | "anilist" = "tmdb"): string[] {
  const seen = new Set<string>();
  return [...cast].sort((a, b) => a.order - b.order).flatMap(member => {
    const name = member.name.trim();
    const identity = `${member.source ?? fallbackSource}:${member.id}`;
    if (!name || seen.has(identity)) return [];
    seen.add(identity);
    const formatted = formatPersonName({
      source: member.source ?? fallbackSource, name, original_name: member.original_name
    });
    return [formatted.koreanName ?? name];
  }).slice(0, 2);
}
