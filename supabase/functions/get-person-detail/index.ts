import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { inferTmdbTvContentType } from "../_shared/tmdbClassification.ts";

type PersonSource = "tmdb" | "anilist";
type PersonCategory = "actor" | "voice_actor";
type ContentType = "anime" | "kdrama" | "jdrama" | "movie" | "other";

interface RequestBody {
  source?: PersonSource;
  external_id?: string;
  category?: PersonCategory;
}

interface PersonCredit {
  external_source: PersonSource;
  external_id: string;
  title: string;
  original_title: string | null;
  poster_url: string | null;
  content_type: ContentType;
  air_year: number | null;
  role: string | null;
}

interface PersonDetail {
  source: PersonSource;
  external_id: string;
  category: PersonCategory;
  name: string;
  original_name: string | null;
  native_name?: string | null;
  profile_url: string | null;
  birthday: string | null;
  deathday?: string | null;
  age: number | null;
  birthplace: string | null;
  gender?: string | null;
  biography: string | null;
  credits: PersonCredit[];
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

  const source = body.value.source;
  const externalId = body.value.external_id?.trim();
  const category = body.value.category;

  if (!source || !["tmdb", "anilist"].includes(source)) {
    return jsonError(400, "INVALID_REQUEST", "invalid source");
  }
  if (!externalId) return jsonError(400, "INVALID_REQUEST", "external_id is required");
  if (!category || !["actor", "voice_actor"].includes(category)) {
    return jsonError(400, "INVALID_REQUEST", "invalid category");
  }

  if (source === "tmdb") return json(await getTmdbPersonDetail(externalId, category));
  return json(await getAniListPersonDetail(externalId, category));
});

async function getTmdbPersonDetail(externalId: string, category: PersonCategory): Promise<PersonDetail> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) throw new Error("TMDB_API_KEY is not configured");

  const detailUrl = new URL(`https://api.themoviedb.org/3/person/${externalId}`);
  detailUrl.searchParams.set("language", "ko-KR");
  detailUrl.searchParams.set("append_to_response", "combined_credits");
  const headers = applyTmdbAuth(detailUrl, apiKey);

  const detail = await fetchJson<{
    id: number;
    name?: string | null;
    also_known_as?: string[];
    profile_path?: string | null;
    birthday?: string | null;
    deathday?: string | null;
    place_of_birth?: string | null;
    gender?: number | null;
    biography?: string | null;
    combined_credits?: {
      cast?: {
        id: number;
        media_type?: "movie" | "tv";
        title?: string | null;
        name?: string | null;
        original_title?: string | null;
        original_name?: string | null;
        poster_path?: string | null;
        character?: string | null;
        release_date?: string | null;
        first_air_date?: string | null;
        origin_country?: string[];
        genre_ids?: number[];
        popularity?: number | null;
      }[];
    };
  }>(detailUrl.toString(), { headers });

  const credits = (detail.combined_credits?.cast ?? [])
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 120)
    .map((item): PersonCredit => ({
      external_source: "tmdb",
      external_id: String(item.id),
      title: item.title ?? item.name ?? "Untitled",
      original_title: item.original_title ?? item.original_name ?? null,
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
      content_type: item.media_type === "movie"
        ? "movie"
        : inferTmdbTvContentType({ originCountry: item.origin_country, genreIds: item.genre_ids }),
      air_year: yearFromDate(item.release_date ?? item.first_air_date),
      role: item.character?.trim() || null
    }));
  const displayName = detail.name?.trim() || "Unknown";

  return {
    source: "tmdb",
    external_id: String(detail.id),
    category: inferPersonCategory(category, credits),
    name: displayName,
    original_name: pickTmdbAlias(displayName, detail.also_known_as),
    profile_url: detail.profile_path ? `https://image.tmdb.org/t/p/w342${detail.profile_path}` : null,
    birthday: detail.birthday ?? null,
    deathday: detail.deathday ?? null,
    age: calculateAge(detail.birthday, detail.deathday),
    birthplace: detail.place_of_birth ?? null,
    gender: mapTmdbGender(detail.gender),
    biography: cleanText(detail.biography),
    credits: sortCreditsByDate(credits)
  };
}

const ANILIST_STAFF_DETAIL_QUERY = `
  query StaffDetail($id: Int, $page: Int) {
    Staff(id: $id) {
      id
      name {
        full
        native
        alternative
      }
      image {
        large
        medium
      }
      dateOfBirth {
        year
        month
        day
      }
      age
      gender
      homeTown
      description(asHtml: false)
      characterMedia(sort: [POPULARITY_DESC], page: $page, perPage: 50) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        edges {
          characterRole
          characters {
            name {
              full
              native
            }
          }
          node {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
            }
            startDate {
              year
            }
            episodes
            format
          }
        }
      }
    }
  }
`;

async function getAniListPersonDetail(externalId: string, category: PersonCategory): Promise<PersonDetail> {
  const endpoint = Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co";
  const id = Number.parseInt(externalId, 10);
  if (!Number.isFinite(id)) throw new Error("invalid AniList staff id");

  const payload = await fetchJson<{
    data?: {
      Staff?: {
        id: number;
        name?: { full?: string | null; native?: string | null; alternative?: string[] | null } | null;
        image?: { large?: string | null; medium?: string | null } | null;
        dateOfBirth?: { year?: number | null; month?: number | null; day?: number | null } | null;
        age?: number | null;
        gender?: string | null;
        homeTown?: string | null;
        description?: string | null;
        staffMedia?: {
          edges?: {
            staffRole?: string | null;
            node?: {
              id: number;
              title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
              coverImage?: { large?: string | null } | null;
              startDate?: { year?: number | null } | null;
              format?: string | null;
            } | null;
          }[] | null;
        } | null;
        characterMedia?: {
          pageInfo?: {
            total?: number | null;
            currentPage?: number | null;
            lastPage?: number | null;
            hasNextPage?: boolean | null;
          } | null;
          edges?: {
            characterRole?: string | null;
            characters?: {
              name?: { full?: string | null; native?: string | null } | null;
            }[] | null;
            node?: {
              id: number;
              title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
              coverImage?: { large?: string | null } | null;
              startDate?: { year?: number | null } | null;
              format?: string | null;
            } | null;
          }[] | null;
        } | null;
      } | null;
    };
    errors?: { message?: string }[];
  }>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: ANILIST_STAFF_DETAIL_QUERY, variables: { id, page: 1 } })
  });

  if (payload.errors?.length) throw new Error(payload.errors[0]?.message ?? "AniList error");
  const staff = payload.data?.Staff;
  if (!staff) throw new Error("staff not found");

  const birthday = formatAniListDate(staff.dateOfBirth);
  const allCharacterEdges = [...(staff.characterMedia?.edges ?? [])];
  const maxPages = Math.min(staff.characterMedia?.pageInfo?.lastPage ?? 1, 6);

  for (let page = 2; page <= maxPages; page += 1) {
    const pagePayload = await fetchJson<{
      data?: {
        Staff?: {
          characterMedia?: typeof staff.characterMedia;
        } | null;
      };
      errors?: { message?: string }[];
    }>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: ANILIST_STAFF_DETAIL_QUERY, variables: { id, page } })
    });

    if (pagePayload.errors?.length) break;
    allCharacterEdges.push(...(pagePayload.data?.Staff?.characterMedia?.edges ?? []));
  }

  const credits = allCharacterEdges
    .filter((edge) => edge.node)
    .map((edge): PersonCredit => {
      const media = edge.node!;
      const characterNames = (edge.characters ?? [])
        .map((character) => character.name?.native?.trim() || character.name?.full?.trim() || "")
        .filter(Boolean);
      const role = characterNames.length
        ? `${characterNames.join(", ")}${edge.characterRole ? ` (${edge.characterRole.toLowerCase()})` : ""}`
        : edge.characterRole?.trim() || null;

      return {
        external_source: "anilist",
        external_id: String(media.id),
        title: media.title?.native ?? media.title?.english ?? media.title?.romaji ?? "Untitled",
        original_title: pickSecondaryTitle(media.title),
        poster_url: media.coverImage?.large ?? null,
        content_type: "anime",
        air_year: media.startDate?.year ?? null,
        role
      };
    });
  const fullName = staff.name?.full?.trim() || null;
  const nativeName = staff.name?.native?.trim() || null;

  return {
    source: "anilist",
    external_id: String(staff.id),
    category,
    name: nativeName || fullName || "Unknown",
    original_name: pickPreferredAlias(fullName, nativeName, staff.name?.alternative),
    native_name: nativeName,
    profile_url: staff.image?.large ?? staff.image?.medium ?? null,
    birthday,
    age: staff.age ?? calculateAge(birthday),
    birthplace: staff.homeTown ?? null,
    gender: staff.gender ?? null,
    biography: cleanText(staff.description),
    credits: sortCreditsByDate(credits)
  };
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

function yearFromDate(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 4) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function formatAniListDate(date?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!date?.year) return null;
  const month = String(date.month ?? 1).padStart(2, "0");
  const day = String(date.day ?? 1).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

function calculateAge(birthday?: string | null, deathday?: string | null): number | null {
  if (!birthday) return null;
  const birth = new Date(`${birthday}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const end = deathday ? new Date(`${deathday}T00:00:00Z`) : new Date();
  let age = end.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthday =
    end.getUTCMonth() > birth.getUTCMonth() ||
    (end.getUTCMonth() === birth.getUTCMonth() && end.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function mapTmdbGender(value?: number | null): string | null {
  if (value === 1) return "여성";
  if (value === 2) return "남성";
  if (value === 3) return "논바이너리";
  return null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return stripped.length ? stripped : null;
}

function pickSecondaryTitle(title?: { romaji?: string | null; english?: string | null; native?: string | null } | null): string | null {
  const nativeTitle = title?.native?.trim() || null;
  const englishTitle = title?.english?.trim() || null;
  const romajiTitle = title?.romaji?.trim() || null;

  return [englishTitle, romajiTitle, nativeTitle].find((value) => value && value !== nativeTitle) ?? romajiTitle ?? null;
}

function pickPreferredAlias(
  fullName?: string | null,
  nativeName?: string | null,
  alternatives?: string[] | null
): string | null {
  const candidates = [fullName, ...(alternatives ?? []), nativeName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return (
    candidates.find((value) => value !== nativeName && hasLatin(value)) ??
    candidates.find((value) => value !== nativeName && hasJapanese(value)) ??
    candidates.find((value) => value !== nativeName) ??
    null
  );
}

function pickTmdbAlias(displayName: string, aliases?: string[] | null): string | null {
  const candidates = (aliases ?? [])
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value !== displayName))
    .filter((value) => hasJapanese(value) || hasLatin(value));

  return (
    candidates.find((value) => hasJapanese(value)) ??
    candidates.find((value) => hasLatin(value)) ??
    null
  );
}

function inferPersonCategory(category: PersonCategory, credits: PersonCredit[]): PersonCategory {
  if (category === "voice_actor") return category;

  const roleCount = credits.filter((credit) => credit.role).length;
  const voiceRoleCount = credits.filter((credit) => /\bvoice\b/i.test(credit.role ?? "")).length;

  if (voiceRoleCount >= 3 || (roleCount > 0 && voiceRoleCount / roleCount >= 0.5)) {
    return "voice_actor";
  }

  return category;
}

function hasLatin(value: string): boolean {
  return /[A-Za-z]/.test(value);
}

function hasJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

function sortCreditsByDate(credits: PersonCredit[]): PersonCredit[] {
  return [...credits].sort((a, b) => {
    const bYear = b.air_year ?? -1;
    const aYear = a.air_year ?? -1;
    if (bYear !== aYear) return bYear - aYear;
    return a.title.localeCompare(b.title);
  });
}
