import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { inferTmdbTvContentType } from "../_shared/tmdbClassification.ts";

type ContentType = "anime" | "kdrama" | "jdrama" | "movie" | "other";
type PersonCategory = "actor" | "voice_actor";

interface RequestBody {
  query?: string;
  category?: PersonCategory | "all";
}

interface SearchResult {
  external_source: "tmdb" | "anilist";
  external_id: string;
  content_type: ContentType;
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  localized_overview?: string | null;
  air_year: number | null;
  has_seasons: boolean;
  episode_count: number | null;
  matched_people?: string[];
}

interface PersonResult {
  source: "tmdb" | "anilist";
  external_id: string;
  category: PersonCategory;
  name: string;
  original_name: string | null;
  profile_url: string | null;
  known_for: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");

  try {
    await requireUser(req);
  } catch {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const body = await parseJson<RequestBody>(req);
  if (!body.ok) return jsonError(400, "INVALID_REQUEST", body.message);

  const query = body.value.query?.trim();
  const category = body.value.category ?? "all";
  if (!query || query.length < 2) return json({ people: [], results: [], failedSources: [], query: query ?? "" });

  const tasks = [
    category !== "voice_actor" ? searchTmdbPeople(query) : Promise.resolve({ people: [], results: [] }),
    category !== "actor" ? searchAniListStaff(query) : Promise.resolve({ people: [], results: [] })
  ];

  const settled = await Promise.allSettled(tasks);
  const failedSources: string[] = [];
  const people: PersonResult[] = [];
  const results: SearchResult[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      people.push(...result.value.people);
      results.push(...result.value.results);
    } else {
      failedSources.push(index === 0 ? "tmdb" : "anilist");
    }
  });

  return json({
    people: dedupePeople(people),
    results: dedupeResults(results),
    failedSources,
    query
  });
});

async function searchTmdbPeople(query: string): Promise<{ people: PersonResult[]; results: SearchResult[] }> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) throw new Error("TMDB_API_KEY is not configured");

  const url = new URL("https://api.themoviedb.org/3/search/person");
  url.searchParams.set("query", query);
  url.searchParams.set("language", "ko-KR");
  url.searchParams.set("include_adult", "false");
  const headers = applyTmdbAuth(url, apiKey);
  const payload = await fetchJson<{
    results?: {
      id: number;
      name?: string | null;
      original_name?: string | null;
      profile_path?: string | null;
      known_for_department?: string | null;
      known_for?: {
        id: number;
        media_type?: "movie" | "tv";
        title?: string | null;
        name?: string | null;
        original_title?: string | null;
        original_name?: string | null;
        poster_path?: string | null;
        overview?: string | null;
        release_date?: string | null;
        first_air_date?: string | null;
        origin_country?: string[];
        genre_ids?: number[];
        popularity?: number | null;
        vote_count?: number | null;
      }[];
    }[];
  }>(url.toString(), { headers });

  const candidatePeople = (payload.results ?? [])
    .filter((person) => person.known_for_department === "Acting" || (person.known_for?.length ?? 0) > 0)
    .slice(0, 6);

  const people = candidatePeople.map((person) => ({
      source: "tmdb" as const,
      external_id: String(person.id),
      category: "actor" as const,
      name: person.name?.trim() || person.original_name?.trim() || "Unknown",
      original_name: person.original_name?.trim() || null,
      profile_url: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null,
      known_for: (person.known_for ?? []).slice(0, 3).map((item) => item.title || item.name || "").filter(Boolean)
    }));

  const creditResults = await Promise.allSettled(
    candidatePeople.slice(0, 3).map((person) => fetchTmdbPersonCredits(String(person.id), apiKey))
  );

  const results = [
    ...candidatePeople.flatMap((person) =>
      (person.known_for ?? []).map((item) => ({
        ...item,
        matched_person_name: person.name?.trim() || person.original_name?.trim() || null
      }))
    ),
    ...creditResults.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
  ]
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .sort((a, b) => {
      const bScore = (b.popularity ?? 0) + (b.vote_count ?? 0) / 1000;
      const aScore = (a.popularity ?? 0) + (a.vote_count ?? 0) / 1000;
      return bScore - aScore;
    })
    .map(mapTmdbCreditToSearchResult);

  return { people, results };
}

type TmdbCreditItem = {
  id: number;
  media_type?: "movie" | "tv";
  title?: string | null;
  name?: string | null;
  original_title?: string | null;
  original_name?: string | null;
  poster_path?: string | null;
  overview?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  origin_country?: string[];
  genre_ids?: number[];
  popularity?: number | null;
  vote_count?: number | null;
  matched_person_name?: string | null;
};

async function fetchTmdbPersonCredits(personId: string, apiKey: string): Promise<TmdbCreditItem[]> {
  const url = new URL(`https://api.themoviedb.org/3/person/${personId}/combined_credits`);
  url.searchParams.set("language", "ko-KR");
  const headers = applyTmdbAuth(url, apiKey);
  const personUrl = new URL(`https://api.themoviedb.org/3/person/${personId}`);
  personUrl.searchParams.set("language", "ko-KR");
  const personHeaders = applyTmdbAuth(personUrl, apiKey);
  const [payload, person] = await Promise.all([
    fetchJson<{ cast?: TmdbCreditItem[] }>(url.toString(), { headers }),
    fetchJson<{ name?: string | null }>(personUrl.toString(), { headers: personHeaders }).catch(() => ({ name: null }))
  ]);
  const matchedPersonName = person.name?.trim() || null;
  return (payload.cast ?? []).slice(0, 40).map((item) => ({
    ...item,
    matched_person_name: matchedPersonName
  }));
}

function mapTmdbCreditToSearchResult(item: TmdbCreditItem): SearchResult {
  return {
    external_source: "tmdb",
    external_id: String(item.id),
    content_type: item.media_type === "movie"
      ? "movie"
      : inferTmdbTvContentType({ originCountry: item.origin_country, genreIds: item.genre_ids }),
    title_primary: item.title?.trim() || item.name?.trim() || "제목 없음",
    title_original: item.original_title ?? item.original_name ?? null,
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    overview: cleanText(item.overview),
    air_year: yearFromDate(item.release_date ?? item.first_air_date),
    has_seasons: item.media_type !== "movie",
    episode_count: null,
    matched_people: item.matched_person_name ? [item.matched_person_name] : []
  };
}

const STAFF_QUERY = `
  query SearchStaff($search: String!) {
    Page(page: 1, perPage: 8) {
      staff(search: $search, sort: [SEARCH_MATCH, FAVOURITES_DESC]) {
        id
        name { full native }
        image { large medium }
        staffMedia(page: 1, perPage: 8, type: ANIME, sort: [POPULARITY_DESC]) {
          nodes {
            id
            title { romaji english native }
            coverImage { large }
            description(asHtml: false)
            startDate { year }
            episodes
            format
          }
        }
      }
    }
  }
`;

async function searchAniListStaff(query: string): Promise<{ people: PersonResult[]; results: SearchResult[] }> {
  const endpoint = Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co";
  const payload = await fetchJson<{
    data?: {
      Page?: {
        staff?: {
          id: number;
          name?: { full?: string | null; native?: string | null } | null;
          image?: { large?: string | null; medium?: string | null } | null;
          staffMedia?: {
            nodes?: {
              id: number;
              title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
              coverImage?: { large?: string | null } | null;
              description?: string | null;
              startDate?: { year?: number | null } | null;
              episodes?: number | null;
              format?: string | null;
            }[] | null;
          } | null;
        }[] | null;
      };
    };
    errors?: { message?: string }[];
  }>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: STAFF_QUERY, variables: { search: query } })
  });

  if (payload.errors?.length) throw new Error(payload.errors[0]?.message ?? "AniList error");

  const staff = payload.data?.Page?.staff ?? [];
  const people = staff.map((person) => ({
    source: "anilist" as const,
    external_id: String(person.id),
    category: "voice_actor" as const,
    name: person.name?.native?.trim() || person.name?.full?.trim() || "Unknown",
    original_name: person.name?.full?.trim() || null,
    profile_url: person.image?.large ?? person.image?.medium ?? null,
    known_for: (person.staffMedia?.nodes ?? [])
      .slice(0, 3)
      .map((media) => media.title?.english || media.title?.romaji || media.title?.native || "")
      .filter(Boolean)
  }));

  const results = staff.flatMap((person) =>
    (person.staffMedia?.nodes ?? []).map((media) => ({
      external_source: "anilist" as const,
      external_id: String(media.id),
      content_type: "anime" as const,
      title_primary: media.title?.english ?? media.title?.romaji ?? media.title?.native ?? "Untitled",
      title_original: media.title?.native ?? null,
      poster_url: media.coverImage?.large ?? null,
      overview: cleanText(media.description),
      air_year: media.startDate?.year ?? null,
      has_seasons: media.format !== "MOVIE",
      episode_count: media.episodes ?? null,
      matched_people: [person.name?.native?.trim() || person.name?.full?.trim() || ""].filter(Boolean)
    }))
  );

  return { people, results };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

function applyTmdbAuth(url: URL, apiKey: string): HeadersInit {
  if (apiKey.startsWith("eyJ")) return { Authorization: `Bearer ${apiKey}` };
  url.searchParams.set("api_key", apiKey);
  return {};
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return stripped.length ? stripped : null;
}

function yearFromDate(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 4) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function dedupePeople(people: PersonResult[]): PersonResult[] {
  return Array.from(new Map(people.map((person) => [`${person.source}:${person.external_id}`, person])).values());
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const byKey = new Map<string, SearchResult>();
  for (const result of results) {
    const key = `${result.external_source}:${result.external_id}`;
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, result);
      continue;
    }

    byKey.set(key, {
      ...previous,
      matched_people: Array.from(new Set([...(previous.matched_people ?? []), ...(result.matched_people ?? [])]))
    });
  }
  return Array.from(byKey.values());
}
