export interface ContentGenreJoin {
  genres: { name: string } | { name: string }[] | null;
}

export const ALL_GENRE_FILTER = "all";

export const DEFAULT_GENRE_FILTERS = [
  "액션",
  "어드벤처",
  "애니메이션",
  "코미디",
  "범죄",
  "드라마",
  "가족",
  "판타지",
  "공포",
  "미스터리",
  "로맨스",
  "SF",
  "스릴러"
];

const GENRE_DISPLAY_NAMES: Record<string, string> = {
  action: "액션",
  "action & adventure": "액션/어드벤처",
  adventure: "어드벤처",
  animation: "애니메이션",
  anime: "애니메이션",
  comedy: "코미디",
  crime: "범죄",
  documentary: "다큐멘터리",
  drama: "드라마",
  ecchi: "에치",
  family: "가족",
  fantasy: "판타지",
  harem: "하렘",
  hentai: "성인",
  history: "역사",
  horror: "공포",
  isekai: "이세계",
  kids: "키즈",
  "mahou shoujo": "마법소녀",
  mecha: "메카",
  music: "음악",
  mystery: "미스터리",
  news: "뉴스",
  psychological: "심리",
  reality: "리얼리티",
  romance: "로맨스",
  "sci-fi": "SF",
  "sci-fi & fantasy": "SF/판타지",
  "science fiction": "SF",
  soap: "연속극",
  sports: "스포츠",
  supernatural: "초자연",
  talk: "토크",
  thriller: "스릴러",
  "tv movie": "TV 영화",
  war: "전쟁",
  "war & politics": "전쟁/정치",
  western: "서부극",
  yaoi: "야오이",
  yuri: "유리"
};

export function getGenreDisplayName(name: string): string {
  const trimmedName = name.trim();
  if (!trimmedName) return trimmedName;

  return GENRE_DISPLAY_NAMES[trimmedName.toLocaleLowerCase()] ?? trimmedName;
}

export function createDisplayGenreNames(genres?: string[] | null): string[] {
  return Array.from(
    new Set(
      (genres ?? [])
        .map((genre) => getGenreDisplayName(genre))
        .filter((genre) => genre.length > 0)
    )
  );
}

export function createGenreFilterOptions(genres?: string[] | null, includeDefaults = true): string[] {
  const displayGenres = createDisplayGenreNames(genres);
  const options = includeDefaults ? [...DEFAULT_GENRE_FILTERS, ...displayGenres] : displayGenres;

  return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b, "ko-KR"));
}

export function matchesGenreFilter(genres: string[] | null | undefined, genreFilter: string): boolean {
  if (genreFilter === ALL_GENRE_FILTER) return true;

  return createDisplayGenreNames(genres).includes(genreFilter);
}

export function extractGenreNames(contentGenres?: ContentGenreJoin[] | null): string[] {
  if (!contentGenres) return [];

  return Array.from(
    new Set(
      contentGenres
        .flatMap((contentGenre) => {
          const genres = contentGenre.genres;
          if (Array.isArray(genres)) return genres.map((genre) => genre.name);
          return genres?.name ? [genres.name] : [];
        })
        .filter((name): name is string => Boolean(name?.trim()))
        .map((name) => name.trim())
    )
  );
}
