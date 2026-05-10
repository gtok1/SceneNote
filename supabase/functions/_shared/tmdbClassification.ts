import type { ContentType } from "./types.ts";

export const TMDB_ANIMATION_GENRE_ID = 16;

export interface TmdbGenre {
  id?: number;
  name?: string | null;
}

export function hasTmdbAnimationGenreIds(genreIds?: number[] | null): boolean {
  return genreIds?.includes(TMDB_ANIMATION_GENRE_ID) ?? false;
}

export function hasTmdbAnimationGenre(genres?: TmdbGenre[] | null): boolean {
  return (
    genres?.some((genre) => {
      if (genre.id === TMDB_ANIMATION_GENRE_ID) return true;
      return /animation|애니메이션/i.test(genre.name ?? "");
    }) ?? false
  );
}

export function inferTmdbTvContentType(params: {
  originCountry?: string[] | null;
  genreIds?: number[] | null;
  genres?: TmdbGenre[] | null;
  likelyAnime?: boolean;
}): ContentType {
  if (hasTmdbAnimationGenreIds(params.genreIds) || hasTmdbAnimationGenre(params.genres) || params.likelyAnime) {
    return "anime";
  }
  if (params.originCountry?.includes("KR")) return "kdrama";
  if (params.originCountry?.includes("JP")) return "jdrama";
  return "other";
}
