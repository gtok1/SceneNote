import type { CastMemberMeta, ContentMeta, EpisodeMeta, ExternalSource, SeasonMeta } from "./types.ts";
import { normalizeGenreNames } from "./genres.ts";
import { hasTmdbAnimationGenre } from "./tmdbClassification.ts";

const TMDB_LANGUAGE = "ko-KR";

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return stripped.length > 0 ? stripped : null;
}

function yearFromDate(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 4) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function durationMinutesToSeconds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 60);
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function postJson<T>(url: string, body: object, timeoutMs = 5000): Promise<T> {
  return fetchJson<T>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    },
    timeoutMs
  );
}

interface TmdbDetail {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string | null;
  overview?: string | null;
  release_date?: string;
  first_air_date?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  genres?: {
    id?: number;
    name?: string | null;
  }[];
  seasons?: {
    season_number: number;
    name?: string | null;
    episode_count?: number | null;
    air_date?: string | null;
  }[];
  origin_country?: string[];
  translations?: {
    translations?: {
      iso_639_1?: string;
      iso_3166_1?: string;
      data?: {
        title?: string | null;
        name?: string | null;
      };
    }[];
  };
  credits?: {
    cast?: TmdbCastMember[];
  };
}

interface TmdbCastMember {
  id?: number;
  name?: string | null;
  original_name?: string | null;
  character?: string | null;
  profile_path?: string | null;
  order?: number | null;
}

interface TmdbSeasonDetail {
  episodes?: {
    episode_number: number;
    name?: string | null;
    air_date?: string | null;
    runtime?: number | null;
  }[];
}

interface TmdbSearchResponse {
  results?: {
    id: number;
    name?: string | null;
    title?: string | null;
    overview?: string | null;
    poster_path?: string | null;
    first_air_date?: string | null;
    release_date?: string | null;
  }[];
}

interface TmdbKoreanFallback {
  title: string | null;
  overview: string | null;
  poster_url: string | null;
  cast: CastMemberMeta[];
}

export async function fetchTmdbDetail(externalId: string, preferredMediaType?: string): Promise<ContentMeta> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) throw new Error("TMDB_API_KEY is not configured");

  const mediaAttempts = preferredMediaType === "movie" ? ["movie", "tv"] : ["tv", "movie"];
  let detail: TmdbDetail | null = null;
  let resolvedMediaType: "tv" | "movie" | null = null;

  for (const mediaType of mediaAttempts) {
    try {
      const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${externalId}`);
      url.searchParams.set("language", TMDB_LANGUAGE);
      url.searchParams.set("append_to_response", "translations,credits");
      const headers = applyTmdbAuth(url, apiKey);
      detail = await fetchJson<TmdbDetail>(url.toString(), {
        headers
      });
      resolvedMediaType = mediaType as "tv" | "movie";
      break;
    } catch {
      // Try the next TMDB media endpoint. Search results should eventually pass media_type.
    }
  }

  if (!detail || !resolvedMediaType) {
    throw new Error(`TMDB content not found for id ${externalId}`);
  }

  const isMovie = resolvedMediaType === "movie";
  const seasons: SeasonMeta[] = isMovie
    ? []
    : (detail.seasons ?? [])
        .filter((season) => season.season_number > 0)
        .map((season) => ({
          season_number: season.season_number,
          title: season.name ?? null,
          episode_count: season.episode_count ?? null,
          air_year: yearFromDate(season.air_date)
        }));

  const cast = mapTmdbCast(detail.credits?.cast);
  const contentType = isMovie ? "movie" : inferTmdbSeriesType(detail, cast);

  return {
    external_source: "tmdb",
    external_id: externalId,
    content_type: contentType,
    title_primary: chooseKoreanTmdbTitle(detail, isMovie),
    title_original: (isMovie ? detail.original_title : detail.original_name) ?? null,
    poster_url: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
    overview: cleanText(detail.overview),
    air_year: yearFromDate(isMovie ? detail.release_date : detail.first_air_date),
    has_seasons: !isMovie,
    episode_count: seasons.reduce((sum, season) => sum + (season.episode_count ?? 0), 0) || null,
    genres: normalizeGenreNames((detail.genres ?? []).map((genre) => genre.name)),
    seasons,
    cast
  };
}

function mapTmdbCast(cast: TmdbCastMember[] | undefined): CastMemberMeta[] {
  return (cast ?? [])
    .filter((member) => typeof member.id === "number" && Boolean(member.name?.trim()))
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
    .slice(0, 12)
    .map((member, index) => ({
      id: member.id as number,
      name: member.name?.trim() ?? "",
      original_name: member.original_name?.trim() || null,
      character: member.character?.trim() || null,
      profile_url: member.profile_path ? `https://image.tmdb.org/t/p/w185${member.profile_path}` : null,
      order: member.order ?? index
    }));
}

function inferTmdbSeriesType(
  detail: Pick<
    TmdbDetail,
    "origin_country" | "title" | "name" | "original_title" | "original_name" | "overview" | "genres"
  >,
  cast: CastMemberMeta[]
): ContentMeta["content_type"] {
  if (isLikelyAnime(detail, cast)) return "anime";
  if (detail.origin_country?.includes("KR")) return "kdrama";
  if (detail.origin_country?.includes("JP")) return "jdrama";
  return "other";
}

function isLikelyAnime(
  detail: Pick<
    TmdbDetail,
    "origin_country" | "title" | "name" | "original_title" | "original_name" | "overview" | "genres"
  >,
  cast: CastMemberMeta[]
): boolean {
  if (hasTmdbAnimationGenre(detail.genres)) return true;

  const text = [detail.title, detail.name, detail.original_title, detail.original_name, detail.overview]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const voiceCastCount = cast.filter((member) => /\bvoice\b/i.test(member.character ?? "")).length;

  if (voiceCastCount >= 2) return true;
  if (/\banime\b|animation|애니|アニメ|만화/.test(text)) return true;

  const animeTitleHints = [
    "츠가이",
    "ブリーチ",
    "bleach",
    "鬼滅",
    "ポケットモンスター",
    "naruto",
    "one piece"
  ];

  return Boolean(detail.origin_country?.includes("JP") && animeTitleHints.some((hint) => text.includes(hint.toLowerCase())));
}

function chooseKoreanTmdbTitle(detail: TmdbDetail, isMovie: boolean): string {
  const localizedTitle = isMovie ? detail.title : detail.name;
  if (localizedTitle?.trim()) return localizedTitle;

  const koreanTranslation = detail.translations?.translations?.find(
    (translation) => translation.iso_639_1 === "ko" || translation.iso_3166_1 === "KR"
  );
  const translatedTitle = isMovie
    ? koreanTranslation?.data?.title
    : koreanTranslation?.data?.name;

  return (
    translatedTitle?.trim() ??
    (isMovie ? detail.original_title : detail.original_name)?.trim() ??
    "Untitled"
  );
}

async function fetchTmdbKoreanAnimeFallback(params: {
  titles: (string | null | undefined)[];
  year?: number | null;
}): Promise<TmdbKoreanFallback | null> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return null;

  const seenQueries = new Set<string>();
  const queries = params.titles
    .map((title) => title?.trim())
    .filter((title): title is string => Boolean(title && title.length > 0))
    .filter((title) => {
      const key = title.toLocaleLowerCase();
      if (seenQueries.has(key)) return false;
      seenQueries.add(key);
      return true;
    });

  for (const query of queries) {
    const url = new URL("https://api.themoviedb.org/3/search/tv");
    url.searchParams.set("query", query);
    url.searchParams.set("language", TMDB_LANGUAGE);
    url.searchParams.set("region", "KR");
    url.searchParams.set("include_adult", "false");
    const headers = applyTmdbAuth(url, apiKey);

    try {
      const payload = await fetchJson<TmdbSearchResponse>(
        url.toString(),
        {
          headers
        },
        3000
      );

      const match =
        payload.results?.find((result) => isCloseYear(yearFromDate(result.first_air_date), params.year)) ??
        payload.results?.[0];

      if (!match) continue;

      const title = match.name?.trim() || match.title?.trim() || null;
      const overview = cleanText(match.overview);

      if (title || overview) {
        let cast: CastMemberMeta[] = [];
        try {
          const detailUrl = new URL(`https://api.themoviedb.org/3/tv/${match.id}`);
          detailUrl.searchParams.set("language", TMDB_LANGUAGE);
          detailUrl.searchParams.set("append_to_response", "credits");
          const detail = await fetchJson<TmdbDetail>(
            detailUrl.toString(),
            { headers: applyTmdbAuth(detailUrl, apiKey) },
            3000
          );
          cast = mapTmdbCast(detail.credits?.cast);
        } catch {
          // Cast is an optional enhancement for anime fallback.
        }

        return {
          title,
          overview,
          poster_url: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null,
          cast
        };
      }
    } catch {
      // AniList/Kitsu are the source of truth for this row; TMDB Korean text is a best-effort enhancement.
    }
  }

  return null;
}

function isCloseYear(candidate: number | null, expected?: number | null): boolean {
  if (!candidate || !expected) return true;
  return Math.abs(candidate - expected) <= 1;
}

const ANILIST_DETAIL_QUERY = `
  query GetAnimeDetail($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
      }
      description(asHtml: false)
      startDate {
        year
      }
      episodes
      format
      genres
      characters(page: 1, perPage: 12, sort: [ROLE, RELEVANCE, ID]) {
        edges {
          role
          node {
            name {
              full
              native
            }
          }
          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
            id
            name {
              full
              native
            }
            image {
              large
              medium
            }
          }
        }
      }
    }
  }
`;

interface AniListDetailResponse {
  data?: {
    Media?: {
      title?: {
        romaji?: string | null;
        english?: string | null;
        native?: string | null;
      };
      coverImage?: {
        large?: string | null;
      };
      description?: string | null;
      startDate?: {
        year?: number | null;
      };
      episodes?: number | null;
      format?: string | null;
      genres?: string[] | null;
      characters?: {
        edges?: {
          role?: string | null;
          node?: {
            name?: {
              full?: string | null;
              native?: string | null;
            } | null;
          } | null;
          voiceActors?: {
            id: number;
            name?: {
              full?: string | null;
              native?: string | null;
            } | null;
            image?: {
              large?: string | null;
              medium?: string | null;
            } | null;
          }[] | null;
        }[] | null;
      } | null;
    };
  };
  errors?: { message?: string }[];
}

function mapAniListVoiceActors(media: AniListDetailResponse["data"] extends { Media?: infer Media } ? Media : never): CastMemberMeta[] {
  const edges = media?.characters?.edges ?? [];
  const seen = new Set<number>();
  const cast: CastMemberMeta[] = [];

  for (const edge of edges) {
    const voiceActor = edge?.voiceActors?.[0];
    if (!voiceActor || seen.has(voiceActor.id)) continue;
    const name = voiceActor.name?.native?.trim() || voiceActor.name?.full?.trim();
    if (!name) continue;

    seen.add(voiceActor.id);
    cast.push({
      id: voiceActor.id,
      name,
      original_name: voiceActor.name?.full?.trim() || null,
      character: edge.node?.name?.native?.trim() || edge.node?.name?.full?.trim() || null,
      profile_url: voiceActor.image?.large ?? voiceActor.image?.medium ?? null,
      order: cast.length
    });
  }

  return cast;
}

export async function fetchAniListDetail(externalId: string): Promise<ContentMeta> {
  const endpoint = Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co";
  const payload = await postJson<AniListDetailResponse>(endpoint, {
    query: ANILIST_DETAIL_QUERY,
    variables: { id: Number.parseInt(externalId, 10) }
  });

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "AniList GraphQL error");
  }

  const media = payload.data?.Media;
  if (!media) throw new Error(`AniList content not found for id ${externalId}`);

  const isMovie = media.format === "MOVIE";
  const episodeCount = media.episodes ?? null;
  const aniListCast = mapAniListVoiceActors(media);
  const koreanFallback = await fetchTmdbKoreanAnimeFallback({
    titles: [media.title?.native, media.title?.romaji, media.title?.english],
    year: media.startDate?.year ?? null
  });

  return {
    external_source: "anilist",
    external_id: externalId,
    content_type: "anime",
    title_primary:
      koreanFallback?.title ??
      media.title?.english ??
      media.title?.romaji ??
      media.title?.native ??
      "Untitled",
    title_original: media.title?.native ?? null,
    poster_url: koreanFallback?.poster_url ?? media.coverImage?.large ?? null,
    overview: koreanFallback?.overview ?? cleanText(media.description),
    localized_overview: koreanFallback?.overview ?? null,
    air_year: media.startDate?.year ?? null,
    has_seasons: !isMovie,
    episode_count: episodeCount,
    genres: normalizeGenreNames(media.genres ?? []),
    seasons: isMovie
      ? []
      : [
          {
            season_number: 1,
            title: null,
            episode_count: episodeCount,
            air_year: media.startDate?.year ?? null
          }
        ],
    cast: aniListCast.length ? aniListCast : koreanFallback?.cast ?? []
  };
}

interface KitsuDetail {
  id: string;
  attributes?: {
    canonicalTitle?: string;
    titles?: Record<string, string | undefined>;
    posterImage?: {
      medium?: string;
      large?: string;
    };
    synopsis?: string;
    startDate?: string;
    episodeCount?: number | null;
    subtype?: string;
  };
}

interface KitsuDetailResponse {
  data?: KitsuDetail;
}

export async function fetchKitsuDetail(externalId: string): Promise<ContentMeta> {
  const baseUrl = Deno.env.get("KITSU_API_URL") ?? "https://kitsu.io/api/edge";
  const payload = await fetchJson<KitsuDetailResponse>(`${baseUrl}/anime/${externalId}`, {
    headers: { Accept: "application/vnd.api+json" }
  });
  const attributes = payload.data?.attributes;
  if (!payload.data || !attributes) throw new Error(`Kitsu content not found for id ${externalId}`);

  const isMovie = attributes.subtype === "movie";
  const episodeCount = attributes.episodeCount ?? null;
  const koreanFallback = await fetchTmdbKoreanAnimeFallback({
    titles: [
      attributes.titles?.ko_kr,
      attributes.titles?.ko,
      attributes.titles?.ja_jp,
      attributes.titles?.en_jp,
      attributes.titles?.en,
      attributes.canonicalTitle
    ],
    year: yearFromDate(attributes.startDate)
  });

  return {
    external_source: "kitsu",
    external_id: externalId,
    content_type: isMovie ? "movie" : "anime",
    title_primary:
      koreanFallback?.title ??
      attributes.titles?.ko_kr ??
      attributes.titles?.ko ??
      attributes.titles?.en ??
      attributes.titles?.en_jp ??
      attributes.titles?.ja_jp ??
      attributes.canonicalTitle ??
      "Untitled",
    title_original: attributes.titles?.ja_jp ?? null,
    poster_url:
      koreanFallback?.poster_url ?? attributes.posterImage?.large ?? attributes.posterImage?.medium ?? null,
    overview: koreanFallback?.overview ?? cleanText(attributes.synopsis),
    localized_overview: koreanFallback?.overview ?? null,
    air_year: yearFromDate(attributes.startDate),
    has_seasons: !isMovie,
    episode_count: episodeCount,
    genres: [],
    seasons: isMovie
      ? []
      : [
          {
            season_number: 1,
            title: null,
            episode_count: episodeCount,
            air_year: yearFromDate(attributes.startDate)
          }
        ],
    cast: koreanFallback?.cast ?? []
  };
}

interface TvmazeShow {
  id: number;
  name?: string;
  premiered?: string;
  summary?: string | null;
  genres?: string[];
  image?: {
    medium?: string;
    original?: string;
  } | null;
}

interface TvmazeSeason {
  number?: number | null;
  name?: string | null;
  episodeOrder?: number | null;
  premiereDate?: string | null;
}

export async function fetchTvmazeDetail(externalId: string): Promise<ContentMeta> {
  const baseUrl = Deno.env.get("TVMAZE_API_URL") ?? "https://api.tvmaze.com";
  const [show, seasons] = await Promise.all([
    fetchJson<TvmazeShow>(`${baseUrl}/shows/${externalId}`),
    fetchJson<TvmazeSeason[]>(`${baseUrl}/shows/${externalId}/seasons`).catch(() => [])
  ]);

  const seasonRows: SeasonMeta[] = seasons
    .filter((season) => typeof season.number === "number" && season.number > 0)
    .map((season) => ({
      season_number: season.number ?? 1,
      title: season.name ?? null,
      episode_count: season.episodeOrder ?? null,
      air_year: yearFromDate(season.premiereDate)
    }));

  return {
    external_source: "tvmaze",
    external_id: externalId,
    content_type: "other",
    title_primary: show.name ?? "Untitled",
    title_original: null,
    poster_url: show.image?.original ?? show.image?.medium ?? null,
    overview: cleanText(show.summary),
    air_year: yearFromDate(show.premiered),
    has_seasons: true,
    episode_count: seasonRows.reduce((sum, season) => sum + (season.episode_count ?? 0), 0) || null,
    genres: normalizeGenreNames(show.genres ?? []),
    seasons: seasonRows,
    cast: []
  };
}

export async function fetchContentDetail(
  source: ExternalSource,
  externalId: string,
  preferredMediaType?: string
): Promise<ContentMeta> {
  switch (source) {
    case "tmdb":
      return fetchTmdbDetail(externalId, preferredMediaType);
    case "anilist":
      return fetchAniListDetail(externalId);
    case "kitsu":
      return fetchKitsuDetail(externalId);
    case "tvmaze":
      return fetchTvmazeDetail(externalId);
  }
}

export async function fetchEpisodesForSeason(params: {
  source: ExternalSource;
  externalId: string;
  seasonNumber: number;
  episodeCount?: number | null;
}): Promise<EpisodeMeta[]> {
  switch (params.source) {
    case "tmdb":
      return fetchTmdbEpisodes(params.externalId, params.seasonNumber);
    case "tvmaze":
      return fetchTvmazeEpisodes(params.externalId, params.seasonNumber);
    case "anilist":
    case "kitsu":
      return generateNumberedEpisodes(params.episodeCount);
  }
}

async function fetchTmdbEpisodes(externalId: string, seasonNumber: number): Promise<EpisodeMeta[]> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) throw new Error("TMDB_API_KEY is not configured");

  const url = new URL(`https://api.themoviedb.org/3/tv/${externalId}/season/${seasonNumber}`);
  url.searchParams.set("language", TMDB_LANGUAGE);
  const headers = applyTmdbAuth(url, apiKey);

  const payload = await fetchJson<TmdbSeasonDetail>(url.toString(), {
    headers
  });

  return (payload.episodes ?? [])
    .filter((episode) => episode.episode_number > 0)
    .map((episode) => ({
      episode_number: episode.episode_number,
      title: episode.name ?? null,
      air_date: episode.air_date ?? null,
      duration_seconds: durationMinutesToSeconds(episode.runtime)
    }));
}

function applyTmdbAuth(url: URL, apiKeyOrToken: string): HeadersInit {
  if (looksLikeJwt(apiKeyOrToken)) {
    return {
      Authorization: `Bearer ${apiKeyOrToken}`,
      "Content-Type": "application/json"
    };
  }

  url.searchParams.set("api_key", apiKeyOrToken);
  return {
    "Content-Type": "application/json"
  };
}

function looksLikeJwt(value: string): boolean {
  return value.startsWith("eyJ") || value.split(".").length === 3;
}

interface TvmazeEpisode {
  season?: number;
  number?: number | null;
  name?: string | null;
  airdate?: string | null;
  runtime?: number | null;
}

async function fetchTvmazeEpisodes(externalId: string, seasonNumber: number): Promise<EpisodeMeta[]> {
  const baseUrl = Deno.env.get("TVMAZE_API_URL") ?? "https://api.tvmaze.com";
  const payload = await fetchJson<TvmazeEpisode[]>(`${baseUrl}/shows/${externalId}/episodes`);

  return payload
    .filter((episode) => episode.season === seasonNumber && typeof episode.number === "number")
    .map((episode) => ({
      episode_number: episode.number ?? 1,
      title: episode.name ?? null,
      air_date: episode.airdate ?? null,
      duration_seconds: durationMinutesToSeconds(episode.runtime)
    }));
}

function generateNumberedEpisodes(episodeCount?: number | null): EpisodeMeta[] {
  if (!episodeCount || episodeCount <= 0) {
    // TODO: AniList/Kitsu often provide total episode count but not full episode metadata.
    return [];
  }

  return Array.from({ length: episodeCount }, (_, index) => ({
    episode_number: index + 1,
    title: null,
    air_date: null,
    duration_seconds: null
  }));
}
