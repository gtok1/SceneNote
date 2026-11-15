import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import { createPersistentMetadataStore, type PersistentMetadataStore } from "../_shared/persistentMetadataCache.ts";
import { getStoredTmdbPersonProfile, PERSON_PROVIDER_RECHECK_MS } from "../_shared/personProviderStore.ts";
import {
  classifyTmdbPersonCategoryOrNull,
  type PersonCategory
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
  let store: PersistentMetadataStore;
  try {
    store = createPersistentMetadataStore(createAdminClient());
  } catch {
    return jsonError(503, "PERSON_METADATA_UNAVAILABLE", "Unable to read person metadata");
  }

  const results = new Array<PersonCategoryResult>(people.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < people!.length) {
      const index = next++;
      results[index] = await classifyPerson(people![index] as PersonRef, store, apiKey ?? null);
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

async function classifyPerson(person: PersonRef, store: PersistentMetadataStore, apiKey: string | null): Promise<PersonCategoryResult> {
  try {
    const detail = await getStoredTmdbPersonProfile(person.external_id, {
      store, apiKey, recheckAfterMs: PERSON_PROVIDER_RECHECK_MS
    });
    return { ...person, category: classifyTmdbPersonCategoryOrNull(detail.combined_credits?.cast ?? []) };
  } catch {
    return { ...person, category: null };
  }
}
