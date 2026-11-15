import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import { createPersistentMetadataStore, PersistentMetadataCacheError, readThroughPersistentMetadata, type PersistentMetadataStore } from "../_shared/persistentMetadataCache.ts";
import { calculateStoredPersonAge, createPersonMetadataKey, isStoredPersonDetail, type StoredPersonCredit as PersonCredit, type StoredPersonDetail as PersonDetail } from "../_shared/personMetadataCache.ts";
import { getStoredTmdbPersonProfile, readSavedTmdbPersonProfile } from "../_shared/personProviderStore.ts";
import { inferTmdbTvContentType } from "../_shared/tmdbClassification.ts";
import { hasHangul, resolveKoreanName } from "../_shared/japaneseReading.ts";
import { anilistKoreanNameInput, tmdbKoreanNameInput } from "../_shared/personNames.ts";
import { classifyTmdbPersonCategory } from "../_shared/personCredits.ts";

type PersonSource = "tmdb" | "anilist";
type PersonCategory = "actor" | "voice_actor";

interface RequestBody {
  source?: PersonSource;
  external_id?: string;
  category?: PersonCategory;
  force_refresh?: boolean;
}

interface TmdbPersonFallback {
  name: string | null;
  original_name: string | null;
  profile_url: string | null;
}

interface TmdbMultiSearchItem {
  id: number;
  media_type?: "movie" | "tv" | "person";
  name?: string | null;
  title?: string | null;
  original_name?: string | null;
  original_title?: string | null;
  poster_path?: string | null;
  first_air_date?: string | null;
  release_date?: string | null;
}

const TMDB_LANGUAGE = "ko-KR";
const TMDB_REGION = "KR";
const ANILIST_CREDIT_KOREAN_ENRICH_LIMIT = 30;

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
  const externalId = typeof body.value.external_id === "string" ? body.value.external_id.trim() : "";
  const category = body.value.category;

  if (!source || !["tmdb", "anilist"].includes(source)) {
    return jsonError(400, "INVALID_REQUEST", "invalid source");
  }
  if (!/^\d+$/.test(externalId)) return jsonError(400, "INVALID_REQUEST", "external_id must be numeric");
  if (body.value.force_refresh !== undefined && typeof body.value.force_refresh !== "boolean") {
    return jsonError(400, "INVALID_REQUEST", "force_refresh must be boolean");
  }
  if (!category || !["actor", "voice_actor"].includes(category)) {
    return jsonError(400, "INVALID_REQUEST", "invalid category");
  }

  try {
    const store = createPersistentMetadataStore(createAdminClient());
    const cached = await readThroughPersistentMetadata<PersonDetail & { updated_at: string }>({
      key: createPersonMetadataKey(source, externalId, category), source,
      store,
      forceRefresh: body.value.force_refresh === true,
      isValid: (value): value is PersonDetail & { updated_at: string } => isStoredPersonDetail(value, source, externalId) &&
        typeof (value as { updated_at?: unknown }).updated_at === "string",
      fetchFresh: async () => ({
        ...(source === "tmdb" ? await getTmdbPersonDetail(externalId, category, store, body.value.force_refresh === true) : await getAniListPersonDetail(externalId, category)),
        updated_at: new Date().toISOString()
      })
    });
    let person = cached.data;
    // Name/category sync can update the shared profile without re-fetching this saved biography.
    // Read it without a miss fallback, so a stored detail hit never triggers an upstream request.
    if (source === "tmdb" && cached.fromCache) {
      const profile = await readSavedTmdbPersonProfile(externalId, { store });
      if (profile) {
        const koreanName = resolveKoreanName(tmdbKoreanNameInput(profile));
        person = { ...person, category: classifyTmdbPersonCategory(profile.combined_credits?.cast ?? [], category),
          name_ko: koreanName?.nameKo ?? null, name_ko_source: koreanName?.source ?? null };
      }
    }
    return json({ ...person, age: calculateStoredPersonAge(person.birthday, person.deathday),
      cache_policy: "manual-v1", from_cache: cached.fromCache });
  } catch (error) {
    return jsonError(503, error instanceof PersistentMetadataCacheError ? error.code : "PERSON_DETAIL_UNAVAILABLE",
      "Unable to load person information");
  }
});

async function getTmdbPersonDetail(externalId: string, category: PersonCategory, store: PersistentMetadataStore, forceRefresh: boolean): Promise<PersonDetail> {
  const detail = await getStoredTmdbPersonProfile(externalId, {
    store, forceRefresh, apiKey: Deno.env.get("TMDB_API_KEY") ?? null
  });

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
      air_date: dateOnly(item.release_date ?? item.first_air_date),
      role: item.character?.trim() || null
    }));
  const displayName = detail.name?.trim() || "Unknown";
  const koreanName = resolveKoreanName(tmdbKoreanNameInput(detail));

  return {
    source: "tmdb",
    external_id: String(detail.id),
    category: classifyTmdbPersonCategory(detail.combined_credits?.cast ?? [], category),
    name: displayName,
    original_name: pickTmdbAlias(displayName, detail.also_known_as),
    name_ko: koreanName?.nameKo ?? null,
    name_ko_source: koreanName?.source ?? null,
    profile_url: detail.profile_path ? `https://image.tmdb.org/t/p/w342${detail.profile_path}` : null,
    birthday: detail.birthday ?? null,
    deathday: detail.deathday ?? null,
    age: calculateStoredPersonAge(detail.birthday, detail.deathday),
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
        first
        last
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
              month
              day
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
        name?: { first?: string | null; last?: string | null; full?: string | null; native?: string | null; alternative?: string[] | null } | null;
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
              startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
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
              startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
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
  if (!staff || staff.id !== id || !Array.isArray(staff.characterMedia?.edges)) throw new Error("Incomplete AniList staff response");

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

    // A failed required page is not a completed credit list that can be saved indefinitely.
    const edges = pagePayload.data?.Staff?.characterMedia?.edges;
    if (pagePayload.errors?.length || !Array.isArray(edges)) throw new Error("Incomplete AniList credit page");
    allCharacterEdges.push(...edges);
  }

  const credits = allCharacterEdges
    .filter((edge) => edge.node)
    .map((edge): PersonCredit => {
      const media = edge.node!;
      const title = media.title?.english ?? media.title?.romaji ?? media.title?.native ?? "Untitled";
      const nativeTitle = media.title?.native?.trim() || null;
      const characterNames = (edge.characters ?? [])
        .map((character) => character.name?.native?.trim() || character.name?.full?.trim() || "")
        .filter(Boolean);
      const roleLabel = mapAniListCharacterRole(edge.characterRole);
      const role = characterNames.length
        ? `${characterNames.join(", ")}${roleLabel ? ` (${roleLabel})` : ""}`
        : roleLabel;

      return {
        external_source: "anilist",
        external_id: String(media.id),
        title,
        original_title: nativeTitle && nativeTitle !== title ? nativeTitle : pickSecondaryTitle(media.title),
        poster_url: media.coverImage?.large ?? null,
        content_type: "anime",
        air_year: media.startDate?.year ?? null,
        air_date: dateFromParts(media.startDate),
        role
      };
    });
  const fullName = staff.name?.full?.trim() || null;
  const nativeName = staff.name?.native?.trim() || null;
  const sortedCredits = sortCreditsByDate(credits);
  const localizedCredits = await enrichAniListCreditsWithKoreanTitles(sortedCredits);
  const koreanFallback = await fetchTmdbKoreanPersonFallback({
    fullName,
    nativeName,
    alternatives: staff.name?.alternative
  });
  const koreanName = koreanFallback?.name && hasHangul(koreanFallback.name)
    ? { nameKo: koreanFallback.name.trim(), source: "tmdb" as const }
    : resolveKoreanName(anilistKoreanNameInput(staff.name));

  return {
    source: "anilist",
    external_id: String(staff.id),
    category,
    name_ko: koreanName?.nameKo ?? null,
    name_ko_source: koreanName?.source ?? null,
    name: koreanFallback?.name ?? fullName ?? nativeName ?? "Unknown",
    original_name:
      koreanFallback?.original_name ??
      pickPreferredAlias(fullName, nativeName, staff.name?.alternative),
    native_name: nativeName,
    profile_url: staff.image?.large ?? staff.image?.medium ?? koreanFallback?.profile_url ?? null,
    birthday,
    age: calculateStoredPersonAge(birthday) ?? staff.age ?? null,
    birthplace: formatPlaceForKorean(staff.homeTown),
    gender: mapAniListGender(staff.gender),
    biography: pickKoreanText(cleanText(staff.description)),
    credits: localizedCredits
  };
}

async function fetchTmdbKoreanPersonFallback(params: {
  fullName?: string | null;
  nativeName?: string | null;
  alternatives?: string[] | null;
}): Promise<TmdbPersonFallback | null> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return null;

  const queries = uniqueNonEmpty([params.fullName, params.nativeName, ...(params.alternatives ?? [])]);

  for (const query of queries) {
    const url = new URL("https://api.themoviedb.org/3/search/person");
    url.searchParams.set("query", query);
    url.searchParams.set("language", TMDB_LANGUAGE);
    url.searchParams.set("include_adult", "false");

    try {
      const headers = applyTmdbAuth(url, apiKey);
      const payload = await fetchJson<{
        results?: {
          name?: string | null;
          original_name?: string | null;
          profile_path?: string | null;
          known_for_department?: string | null;
        }[];
      }>(url.toString(), { headers });

      const match = (payload.results ?? [])
        .map((person) => ({
          person,
          score:
            (person.name && hasKorean(person.name) ? 8 : 0) +
            (person.known_for_department === "Acting" ? 3 : 0) +
            (isSameCompactText(person.original_name, params.nativeName) ? 4 : 0) +
            (isSameCompactText(person.name, params.fullName) ? 2 : 0)
        }))
        .sort((left, right) => right.score - left.score)[0]?.person;

      const name = match?.name?.trim() || null;
      if (!name || !hasKorean(name)) continue;

      const originalName =
        params.fullName?.trim() ||
        match?.original_name?.trim() ||
        params.nativeName?.trim() ||
        null;

      return {
        name,
        original_name: originalName && originalName !== name ? originalName : null,
        profile_url: match?.profile_path ? `https://image.tmdb.org/t/p/w342${match.profile_path}` : null
      };
    } catch {
      // TMDB person matching is a best-effort Korean display enhancement for AniList staff.
    }
  }

  return null;
}

async function enrichAniListCreditsWithKoreanTitles(credits: PersonCredit[]): Promise<PersonCredit[]> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return credits;

  const enriched = await Promise.all(
    credits.map((credit, index) =>
      index < ANILIST_CREDIT_KOREAN_ENRICH_LIMIT
        ? enrichAniListCreditWithKoreanTitle(credit, apiKey)
        : credit
    )
  );

  return enriched;
}

async function enrichAniListCreditWithKoreanTitle(
  credit: PersonCredit,
  apiKey: string
): Promise<PersonCredit> {
  const queries = uniqueNonEmpty([credit.original_title, credit.title]);

  for (const query of queries) {
    const url = new URL("https://api.themoviedb.org/3/search/multi");
    url.searchParams.set("query", query);
    url.searchParams.set("language", TMDB_LANGUAGE);
    url.searchParams.set("region", TMDB_REGION);
    url.searchParams.set("include_adult", "false");

    try {
      const headers = applyTmdbAuth(url, apiKey);
      const payload = await fetchJson<{ results?: TmdbMultiSearchItem[] }>(
        url.toString(),
        { headers }
      );
      const match =
        payload.results
          ?.filter((item) => item.media_type === "tv" || item.media_type === "movie")
          .find((item) => isCloseYear(yearFromDate(item.first_air_date ?? item.release_date), credit.air_year)) ??
        payload.results?.find((item) => item.media_type === "tv" || item.media_type === "movie");

      if (!match) continue;
      const title = match.name?.trim() || match.title?.trim() || null;
      if (!title || !hasKorean(title)) continue;

      return {
        ...credit,
        title,
        air_date: dateOnly(match.first_air_date ?? match.release_date) ?? credit.air_date,
        poster_url: match?.poster_path
          ? `https://image.tmdb.org/t/p/w342${match.poster_path}`
          : credit.poster_url
      };
    } catch {
      // Keep the AniList credit when TMDB cannot provide a Korean title.
    }
  }

  return credit;
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

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function dateFromParts(date?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!date?.year || !date.month) return null;
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day ?? 1).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

function formatAniListDate(date?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  if (!date?.year) return null;
  const month = String(date.month ?? 1).padStart(2, "0");
  const day = String(date.day ?? 1).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

function mapTmdbGender(value?: number | null): string | null {
  if (value === 1) return "여성";
  if (value === 2) return "남성";
  if (value === 3) return "논바이너리";
  return null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value
    .replace(/<[^>]*>/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length ? stripped : null;
}

function pickKoreanText(value: string | null): string | null {
  if (!value) return null;
  return hasKorean(value) ? value : null;
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

function mapAniListGender(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "male") return "남성";
  if (normalized === "female") return "여성";
  if (normalized === "non-binary" || normalized === "nonbinary") return "논바이너리";
  return hasKorean(value ?? "") ? value?.trim() ?? null : null;
}

function mapAniListCharacterRole(value?: string | null): string | null {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "MAIN") return "주연";
  if (normalized === "SUPPORTING") return "조연";
  if (normalized === "BACKGROUND") return "단역";
  return value?.trim() ?? null;
}

function formatPlaceForKorean(value?: string | null): string | null {
  const cleaned = value?.trim();
  if (!cleaned) return null;
  if (hasKorean(cleaned)) return cleaned;

  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;

  const country = PLACE_NAME_KO.get(parts.at(-1) ?? "");
  if (!country) return null;

  const region = parts.length > 1 ? PLACE_NAME_KO.get(parts.at(-2) ?? "") : undefined;
  const city = PLACE_NAME_KO.get(parts[0] ?? "");
  return [country, region, city].filter(Boolean).join(" ") || null;
}

const PLACE_NAME_KO = new Map<string, string>([
  ["Japan", "일본"],
  ["South Korea", "대한민국"],
  ["Korea", "대한민국"],
  ["United States", "미국"],
  ["United States of America", "미국"],
  ["USA", "미국"],
  ["China", "중국"],
  ["Kanagawa Prefecture", "가나가와현"],
  ["Tokyo", "도쿄도"],
  ["Tokyo Metropolis", "도쿄도"],
  ["Osaka Prefecture", "오사카부"],
  ["Fujisawa", "후지사와시"]
]);

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

function hasLatin(value: string): boolean {
  return /[A-Za-z]/.test(value);
}

function hasKorean(value: string): boolean {
  return /[가-힣]/.test(value);
}

function hasJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;

    const key = compactText(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(normalized);
  }

  return results;
}

function compactText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function isSameCompactText(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return false;
  return compactText(left) === compactText(right);
}

function isCloseYear(candidate: number | null, expected?: number | null): boolean {
  if (!candidate || !expected) return true;
  return Math.abs(candidate - expected) <= 1;
}

function sortCreditsByDate(credits: PersonCredit[]): PersonCredit[] {
  return [...credits].sort((a, b) => {
    const bMonth = parseYearMonthSortValue(b.air_date, b.air_year);
    const aMonth = parseYearMonthSortValue(a.air_date, a.air_year);
    if (bMonth !== aMonth) return bMonth - aMonth;
    return a.title.localeCompare(b.title);
  });
}

function parseYearMonthSortValue(airDate?: string | null, airYear?: number | null): number {
  const match = typeof airDate === "string" ? /^(\d{4})-(\d{2})/.exec(airDate) : null;
  if (match?.[1] && match[2]) return Number.parseInt(`${match[1]}${match[2]}`, 10);
  return typeof airYear === "number" && Number.isFinite(airYear) ? airYear * 100 : -1;
}
