import { cleanText } from "./normalize.ts";
import type { AdapterSearchParams, AdapterSearchResponse, SearchResult } from "./types.ts";

const ANILIST_API_URL = Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co";
const TMDB_LANGUAGE = "ko-KR";

const ANILIST_SEARCH_QUERY = `
  query SearchAnime($search: String!, $page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        hasNextPage
      }
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
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
      }
    }
  }
`;

interface AniListMedia {
  id: number;
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
}

interface AniListResponse {
  data?: {
    Page?: {
      pageInfo?: {
        total?: number;
        hasNextPage?: boolean;
      };
      media?: AniListMedia[];
    };
  };
  errors?: { message?: string }[];
}

interface TmdbSearchResponse {
  results?: {
    name?: string | null;
    overview?: string | null;
    poster_path?: string | null;
    first_air_date?: string | null;
  }[];
}

export async function searchAniList({
  query,
  mediaType,
  page,
  signal
}: AdapterSearchParams): Promise<AdapterSearchResponse> {
  if (mediaType !== "all" && mediaType !== "anime") {
    return { source: "anilist", results: [], total: 0, hasNextPage: false };
  }

  const response = await fetch(ANILIST_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: ANILIST_SEARCH_QUERY,
      variables: { search: query, page, perPage: 20 }
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`AniList API error: ${response.status}`);
  }

  const payload = (await response.json()) as AniListResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "AniList GraphQL error");
  }

  const pageData = payload.data?.Page;
  const baseResults = (pageData?.media ?? []).map(normalizeAniListItem);
  const results = await Promise.all(
    baseResults.map((result, index) =>
      index < 6 ? enrichWithTmdbKorean(result, pageData?.media?.[index], signal) : result
    )
  );

  return {
    source: "anilist",
    results,
    total: pageData?.pageInfo?.total ?? 0,
    hasNextPage: pageData?.pageInfo?.hasNextPage ?? false
  };
}

function normalizeAniListItem(item: AniListMedia): SearchResult {
  return {
    external_source: "anilist",
    external_id: String(item.id),
    content_type: "anime",
    title_primary: item.title?.english ?? item.title?.romaji ?? item.title?.native ?? "Untitled",
    title_original: item.title?.native ?? null,
    poster_url: item.coverImage?.large ?? null,
    overview: cleanText(item.description),
    air_year: item.startDate?.year ?? null,
    has_seasons: item.format !== "MOVIE",
    episode_count: item.episodes ?? null,
    genres: Array.from(new Set(item.genres ?? []))
  };
}

async function enrichWithTmdbKorean(
  result: SearchResult,
  item: AniListMedia | undefined,
  signal: AbortSignal
): Promise<SearchResult> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey || !item) return result;

  const queries = [item.title?.native, item.title?.romaji, item.title?.english].filter(
    (title): title is string => Boolean(title?.trim())
  );

  for (const query of queries) {
    const url = new URL("https://api.themoviedb.org/3/search/tv");
    url.searchParams.set("query", query);
    url.searchParams.set("language", TMDB_LANGUAGE);
    url.searchParams.set("region", "KR");
    url.searchParams.set("include_adult", "false");
    const headers = applyTmdbAuth(url, apiKey);

    try {
      const response = await fetch(url, {
        headers,
        signal
      });
      if (!response.ok) continue;

      const payload = (await response.json()) as TmdbSearchResponse;
      const tmdb = payload.results?.[0];
      if (!tmdb) continue;

      return {
        ...result,
        title_primary: tmdb.name?.trim() || result.title_primary,
        poster_url: tmdb.poster_path
          ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`
          : result.poster_url,
        overview: cleanText(tmdb.overview) ?? result.overview,
        localized_overview: cleanText(tmdb.overview)
      };
    } catch {
      // Keep the AniList result if TMDB Korean enrichment fails.
    }
  }

  return result;
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
