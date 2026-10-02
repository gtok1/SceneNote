import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { resolveKoreanName, type KoreanNameSource } from "../_shared/japaneseReading.ts";
import {
  anilistKoreanNameInput,
  tmdbKoreanNameInput,
  type AniListStaffName,
  type TmdbPersonNameDetail
} from "../_shared/personNames.ts";

type PersonSource = "tmdb" | "anilist";

interface RequestBody {
  people?: { source?: unknown; external_id?: unknown }[];
}

interface PersonRef {
  source: PersonSource;
  external_id: string;
}

interface ResolvedPerson extends PersonRef {
  name_ko: string | null;
  name_ko_source: Exclude<KoreanNameSource, "user"> | null;
}

const MAX_PEOPLE = 20;
const CONCURRENCY = 4;

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

  const people = parsePeople(body.value?.people);
  if (!people) return jsonError(400, "INVALID_REQUEST", `people must be 1-${MAX_PEOPLE} valid { source, external_id } items`);

  return json({ results: await mapWithConcurrency(people, CONCURRENCY, resolvePerson) });
});

function parsePeople(value: unknown): PersonRef[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PEOPLE) return null;

  const seen = new Set<string>();
  const people: PersonRef[] = [];
  for (const item of value as { source?: unknown; external_id?: unknown }[]) {
    if (!item || (item.source !== "tmdb" && item.source !== "anilist")) return null;
    if (typeof item.external_id !== "string" || !/^\d{1,10}$/.test(item.external_id)) return null;
    const key = `${item.source}:${item.external_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    people.push({ source: item.source, external_id: item.external_id });
  }
  return people;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index] as T);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function resolvePerson(person: PersonRef): Promise<ResolvedPerson> {
  try {
    const resolved = person.source === "tmdb"
      ? await resolveTmdb(person.external_id)
      : await resolveAniList(person.external_id);
    return { ...person, name_ko: resolved?.nameKo ?? null, name_ko_source: resolved?.source ?? null };
  } catch {
    return { ...person, name_ko: null, name_ko_source: null };
  }
}

async function resolveTmdb(id: string) {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) throw new Error("TMDB_API_KEY is not configured");

  const url = new URL(`https://api.themoviedb.org/3/person/${id}`);
  url.searchParams.set("language", "ko-KR");
  url.searchParams.set("append_to_response", "translations");
  const headers = applyTmdbAuth(url, apiKey);
  const detail = await fetchJson<TmdbPersonNameDetail>(url.toString(), { headers });
  return resolveKoreanName(tmdbKoreanNameInput(detail));
}

async function resolveAniList(id: string) {
  const endpoint = Deno.env.get("ANILIST_API_URL") ?? "https://graphql.anilist.co";
  const payload = await fetchJson<{
    data?: { Staff?: { name?: AniListStaffName | null } | null };
    errors?: { message?: string }[];
  }>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "query ($id: Int) { Staff(id: $id) { name { first last full native alternative } } }",
      variables: { id: Number.parseInt(id, 10) }
    })
  });

  if (payload.errors?.length) throw new Error("AniList error");
  return resolveKoreanName(anilistKoreanNameInput(payload.data?.Staff?.name));
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
