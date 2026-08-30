import { cleanText, compactSearchText, parseSeasonQuery } from "./normalize.ts";
import type { AdapterSearchParams, AdapterSearchResponse, SearchResult } from "./types.ts";

const TMDB_LANGUAGE = "ko-KR";
const TMDB_ANIMATION_GENRE_ID = 16;
const MAX_SEASON_RELATION_DEPTH = 8;

function createAniListMediaFields(relationDepth: number): string {
  return `
    id
    type
    title { romaji english native }
    synonyms
    coverImage { large }
    description(asHtml: false)
    startDate { year month day }
    episodes
    format
    genres
    ${relationDepth > 0 ? `
      relations {
        edges {
          relationType
          node { ${createAniListMediaFields(relationDepth - 1)} }
        }
      }
    ` : ""}
  `;
}

const ANILIST_SEARCH_QUERY = `
  query SearchAnime($search: String!, $page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        hasNextPage
      }
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        ${createAniListMediaFields(MAX_SEASON_RELATION_DEPTH)}
      }
    }
  }
`;

export interface AniListMedia {
  id: number;
  type?: string | null;
  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  synonyms?: string[] | null;
  coverImage?: {
    large?: string | null;
  };
  description?: string | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  };
  episodes?: number | null;
  format?: string | null;
  genres?: string[] | null;
  relations?: {
    edges?: {
      relationType?: string | null;
      node?: AniListMedia | null;
    }[] | null;
  } | null;
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
    id?: number | null;
    name?: string | null;
    original_name?: string | null;
    genre_ids?: number[] | null;
    overview?: string | null;
    poster_path?: string | null;
    first_air_date?: string | null;
  }[];
}

export interface TmdbAnimeSearchCandidate {
  name?: string | null;
  original_name?: string | null;
  genre_ids?: number[] | null;
}

export interface AniListSearchTranslation {
  query: string;
  koreanTitle: string;
}

interface TmdbTranslationResponse {
  translations?: {
    translations?: {
      iso_639_1?: string | null;
      iso_3166_1?: string | null;
      data?: {
        name?: string | null;
        title?: string | null;
      } | null;
    }[];
  };
}

export interface AniListSearchMediaItem {
  item: AniListMedia;
  base: AniListMedia;
  resolved: boolean;
  seasonNumber?: number;
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

  const seasonQuery = parseSeasonQuery(query);
  const requestedSearchQuery = seasonQuery?.baseQuery ?? query;
  const translatedSearch = await resolveAniListSearchInput(requestedSearchQuery, signal);
  const searchQuery = translatedSearch?.query ?? requestedSearchQuery;
  const anilistApiUrl = Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co";

  const response = await fetch(anilistApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: ANILIST_SEARCH_QUERY,
      variables: { search: searchQuery, page, perPage: 20 }
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
  const directMediaItems = addKoreanSearchAlias(
    pageData?.media ?? [],
    translatedSearch?.koreanTitle ?? null
  );
  const translatedBaseId = translatedSearch ? directMediaItems[0]?.id : undefined;
  const rawMediaItems: AniListSearchMediaItem[] = seasonQuery
    ? directMediaItems.map((base, index) => {
      if (index >= 3) return { item: base, base, resolved: false };
      const resolved = resolveSeasonFromRelations(base, seasonQuery.seasonNumber);
      return resolved
        ? { item: resolved, base, resolved: true, seasonNumber: seasonQuery.seasonNumber }
        : { item: base, base, resolved: false };
    })
    : page === 1
      ? expandDirectSeasonRelations(directMediaItems)
      : directMediaItems.map((base) => ({ item: base, base, resolved: false }));
  const mediaItems = dedupeAniListSearchMediaItems(rawMediaItems);
  const baseResults = mediaItems.map(({ item, base, resolved, seasonNumber }) => {
    const normalized = normalizeAniListItem(
      item,
      resolved && seasonNumber ? { base, seasonNumber } : undefined
    );

    return translatedSearch && !resolved && base.id === translatedBaseId
      ? { ...normalized, title_primary: translatedSearch.koreanTitle }
      : normalized;
  });
  const results = await Promise.all(
    baseResults.map(async (result, index) => {
      const mediaItem = mediaItems[index];
      const belongsToTranslatedBase = translatedSearch && mediaItem?.base.id === translatedBaseId;
      const enriched = index < 6 && !belongsToTranslatedBase
        ? await enrichWithTmdbKorean(result, mediaItem?.item, signal)
        : result;
      return mediaItem?.resolved && mediaItem.seasonNumber
        ? applySeasonDisplayTitle(enriched, mediaItem.item, mediaItem.base, mediaItem.seasonNumber)
        : enriched;
    })
  );

  return {
    source: "anilist",
    results,
    total: pageData?.pageInfo?.total ?? 0,
    hasNextPage: pageData?.pageInfo?.hasNextPage ?? false
  };
}

export function expandDirectSeasonRelations(mediaItems: AniListMedia[]): AniListSearchMediaItem[] {
  const expanded: AniListSearchMediaItem[] = [];
  const seenIds = new Set<number>();

  for (const [index, base] of mediaItems.entries()) {
    if (!seenIds.has(base.id)) {
      expanded.push({ item: base, base, resolved: false });
      seenIds.add(base.id);
    }

    if (index >= 3 || hasEligiblePrequel(base)) continue;

    const sequel = resolveSeasonFromRelations(base, 2);
    if (!sequel || seenIds.has(sequel.id)) continue;

    expanded.push({ item: sequel, base, resolved: true, seasonNumber: 2 });
    seenIds.add(sequel.id);
  }

  return expanded;
}

export function dedupeAniListSearchMediaItems(
  mediaItems: AniListSearchMediaItem[]
): AniListSearchMediaItem[] {
  const byItemId = new Map<number, AniListSearchMediaItem>();

  for (const mediaItem of mediaItems) {
    const existing = byItemId.get(mediaItem.item.id);
    if (!existing || (!existing.resolved && mediaItem.resolved)) {
      byItemId.set(mediaItem.item.id, mediaItem);
    }
  }

  return [...byItemId.values()];
}

export function resolveSeasonFromRelations(
  base: AniListMedia,
  seasonNumber: number
): AniListMedia | null {
  let current = base;
  const visited = new Set<number>([base.id]);

  for (let step = 1; step < seasonNumber; step += 1) {
    const next = findNextEligibleSeason(current, visited);
    if (!next) return null;

    visited.add(next.id);
    current = next;
  }

  return current.id === base.id ? null : current;
}

function findNextEligibleSeason(
  current: AniListMedia,
  visited: ReadonlySet<number>
): AniListMedia | null {
  const currentDate = dateSortValue(current.startDate);
  const queue = (current.relations?.edges ?? [])
    .filter((edge) => edge.relationType === "SEQUEL")
    .map((edge) => edge.node)
    .filter((node): node is AniListMedia => Boolean(node));
  const discovered = new Set(visited);
  const candidates: AniListMedia[] = [];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || discovered.has(node.id) || node.type !== "ANIME") continue;
    discovered.add(node.id);

    const candidateDate = dateSortValue(node.startDate);
    const isAfterCurrent = currentDate === null || candidateDate === null || candidateDate > currentDate;
    if (["TV", "TV_SHORT", "ONA"].includes(node.format ?? "") && isAfterCurrent) {
      candidates.push(node);
      continue;
    }

    for (const edge of node.relations?.edges ?? []) {
      if (edge.relationType === "SEQUEL" && edge.node) queue.push(edge.node);
    }
  }

  candidates.sort((left, right) => (dateSortValue(left.startDate) ?? Number.MAX_SAFE_INTEGER)
    - (dateSortValue(right.startDate) ?? Number.MAX_SAFE_INTEGER));
  return candidates[0] ?? null;
}

export function selectTmdbAnimeSearchTranslation(
  query: string,
  candidates: TmdbAnimeSearchCandidate[]
): AniListSearchTranslation | null {
  if (!hasHangul(query)) return null;

  const compactQuery = compactSearchText(query);
  if (compactQuery.length < 2) return null;

  for (const candidate of candidates) {
    const koreanTitle = candidate.name?.trim();
    const originalTitle = candidate.original_name?.trim();
    if (
      !koreanTitle
      || !originalTitle
      || !hasHangul(koreanTitle)
      || !candidate.genre_ids?.includes(TMDB_ANIMATION_GENRE_ID)
    ) {
      continue;
    }

    const compactKoreanTitle = compactSearchText(koreanTitle);
    if (
      compactKoreanTitle.includes(compactQuery)
      || compactQuery.includes(compactKoreanTitle)
    ) {
      return { query: normalizeAniListTranslationQuery(originalTitle), koreanTitle };
    }
  }

  return null;
}

function normalizeAniListTranslationQuery(originalTitle: string): string {
  for (const delimiter of ["～", "〜", "~"]) {
    const openingIndex = originalTitle.indexOf(delimiter);
    if (openingIndex < 0) continue;

    const closingIndex = originalTitle.indexOf(delimiter, openingIndex + delimiter.length);
    if (closingIndex < 0) continue;

    const titleEnd = closingIndex + delimiter.length;
    if (originalTitle.slice(titleEnd).trim()) {
      return originalTitle.slice(0, titleEnd).trim();
    }
  }

  return originalTitle;
}

export function addKoreanSearchAlias(
  mediaItems: AniListMedia[],
  koreanTitle: string | null
): AniListMedia[] {
  const first = mediaItems[0];
  const normalizedTitle = koreanTitle?.trim();
  if (!first || !normalizedTitle) return mediaItems;

  const synonyms = first.synonyms ?? [];
  if (synonyms.some((synonym) => compactSearchText(synonym) === compactSearchText(normalizedTitle))) {
    return mediaItems;
  }

  return [
    { ...first, synonyms: [...synonyms, normalizedTitle] },
    ...mediaItems.slice(1)
  ];
}

function normalizeAniListItem(
  item: AniListMedia,
  seasonContext?: { base: AniListMedia; seasonNumber: number }
): SearchResult {
  const synthesizedMatchTitle = seasonContext
    ? createSynthesizedSeasonTitle(getKoreanTitle(seasonContext.base), seasonContext.seasonNumber)
    : null;
  return {
    external_source: "anilist",
    external_id: String(item.id),
    content_type: "anime",
    title_primary: item.title?.english ?? item.title?.romaji ?? item.title?.native ?? "Untitled",
    title_original: item.title?.native ?? null,
    poster_url: item.coverImage?.large ?? null,
    overview: cleanText(item.description),
    air_year: item.startDate?.year ?? null,
    air_date: dateFromParts(item.startDate),
    has_seasons: item.format !== "MOVIE",
    episode_count: item.episodes ?? null,
    genres: Array.from(new Set(item.genres ?? [])),
    match_titles: Array.from(new Set([...(item.synonyms ?? []), synthesizedMatchTitle].filter((title): title is string => Boolean(title)))),
    matched_via: seasonContext ? "season_relation" : "direct",
    season_number: seasonContext?.seasonNumber,
    resolved_from_id: seasonContext ? String(seasonContext.base.id) : undefined
  };
}

export function applySeasonDisplayTitle(
  result: SearchResult,
  season: AniListMedia,
  base: AniListMedia,
  seasonNumber: number
): SearchResult {
  const seasonKoreanTitle = getKoreanTitle(season);
  if (seasonKoreanTitle) {
    return { ...result, title_primary: seasonKoreanTitle };
  }

  const synthesizedTitle = createSynthesizedSeasonTitle(getKoreanTitle(base), seasonNumber);
  return synthesizedTitle
    ? { ...result, title_primary: synthesizedTitle, title_is_synthesized: true }
    : result;
}

function getKoreanTitle(item: AniListMedia): string | null {
  return [
    ...(item.synonyms ?? []),
    item.title?.native,
    item.title?.english,
    item.title?.romaji
  ].find((title): title is string => Boolean(title?.trim() && hasHangul(title)))?.trim() ?? null;
}

function createSynthesizedSeasonTitle(baseTitle: string | null, seasonNumber: number): string | null {
  return baseTitle ? `${baseTitle} ${seasonNumber}기` : null;
}

function dateSortValue(parts?: AniListMedia["startDate"]): number | null {
  if (!parts?.year) return null;
  return parts.year * 10_000 + (parts.month ?? 1) * 100 + (parts.day ?? 1);
}

function hasEligiblePrequel(item: AniListMedia): boolean {
  return (item.relations?.edges ?? []).some((edge) => {
    const node = edge.node;
    return edge.relationType === "PREQUEL"
      && node?.type === "ANIME"
      && ["TV", "TV_SHORT", "ONA"].includes(node.format ?? "");
  });
}

function dateFromParts(parts?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  const year = parts?.year;
  const month = parts?.month;
  if (!year || !month) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(parts?.day ?? 1).padStart(2, "0")}`;
}

async function resolveAniListSearchInput(
  query: string,
  signal: AbortSignal
): Promise<AniListSearchTranslation | null> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey || !hasHangul(query)) return null;

  const url = new URL("https://api.themoviedb.org/3/search/tv");
  url.searchParams.set("query", query);
  url.searchParams.set("language", TMDB_LANGUAGE);
  url.searchParams.set("region", "KR");
  url.searchParams.set("include_adult", "false");

  try {
    const response = await fetch(url, {
      headers: applyTmdbAuth(url, apiKey),
      signal
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as TmdbSearchResponse;
    return selectTmdbAnimeSearchTranslation(query, payload.results ?? []);
  } catch {
    return null;
  }
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
      const koreanTitle = typeof tmdb.id === "number"
        ? await fetchTmdbKoreanTitle(tmdb.id, apiKey, signal)
        : null;

      return {
        ...result,
        title_primary: (koreanTitle ?? tmdb.name?.trim()) || result.title_primary,
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

async function fetchTmdbKoreanTitle(
  tmdbId: number,
  apiKey: string,
  signal: AbortSignal
): Promise<string | null> {
  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}`);
  url.searchParams.set("language", TMDB_LANGUAGE);
  url.searchParams.set("append_to_response", "translations");

  try {
    const response = await fetch(url, {
      headers: applyTmdbAuth(url, apiKey),
      signal
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as TmdbTranslationResponse;
    const translations = payload.translations?.translations ?? [];
    const korean = translations.find(
      (translation) => translation.iso_639_1 === "ko" || translation.iso_3166_1 === "KR"
    );
    const title = korean?.data?.name?.trim() || korean?.data?.title?.trim();

    return title && hasHangul(title) ? title : null;
  } catch {
    return null;
  }
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

function hasHangul(value: string): boolean {
  return /[가-힣]/.test(value);
}
