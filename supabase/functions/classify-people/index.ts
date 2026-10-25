import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import {
  classifyTmdbPersonCategoryOrNull,
  type PersonCategory,
  type TmdbPersonCredit
} from "../_shared/personCredits.ts";

interface RequestBody {
  people?: unknown;
}

interface PersonRef {
  external_id: string;
}

interface PersonCategoryResult extends PersonRef {
  category: PersonCategory | null;
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
  if (!people) return jsonError(400, "INVALID_REQUEST", `people must be 1-${MAX_PEOPLE} valid { external_id } items`);

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return jsonError(500, "SERVER_MISCONFIGURED", "TMDB_API_KEY is not configured");

  const results = new Array<PersonCategoryResult>(people.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < people!.length) {
      const index = next++;
      results[index] = await classifyPerson(people![index] as PersonRef, apiKey as string);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, people.length) }, worker));
  return json({ results });
});

function parsePeople(value: unknown): PersonRef[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PEOPLE) return null;
  const people: PersonRef[] = [];
  for (const item of value) {
    if (!item || typeof item.external_id !== "string" || !/^\d+$/.test(item.external_id)) return null;
    people.push({ external_id: item.external_id });
  }
  return people;
}

async function classifyPerson(person: PersonRef, apiKey: string): Promise<PersonCategoryResult> {
  try {
    const url = new URL(`https://api.themoviedb.org/3/person/${person.external_id}`);
    url.searchParams.set("append_to_response", "combined_credits");
    const headers = applyTmdbAuth(url, apiKey);
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const detail = await response.json() as { combined_credits?: { cast?: TmdbPersonCredit[] } };
    return { ...person, category: classifyTmdbPersonCategoryOrNull(detail.combined_credits?.cast ?? []) };
  } catch {
    return { ...person, category: null };
  }
}

function applyTmdbAuth(url: URL, apiKey: string): HeadersInit {
  if (apiKey.startsWith("eyJ")) return { Authorization: `Bearer ${apiKey}` };
  url.searchParams.set("api_key", apiKey);
  return {};
}
