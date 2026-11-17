import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { LIBRARY_SHARE_MAX_ITEMS, LIBRARY_SHARE_QUERY_CHUNK, chunk } from "../_shared/libraryShare.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import { readAllRows } from "../_shared/readAllRows.ts";

interface CreateLibraryShareRequest {
  title?: string;
  filters?: Record<string, unknown>;
  content_ids?: string[];
  library_item_ids?: string[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");

  let userId: string;
  try {
    userId = (await requireUser(req)).id;
  } catch {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const body = await parseJson<CreateLibraryShareRequest>(req);
  if (!body.ok) return jsonError(400, "INVALID_REQUEST", body.message);

  const registrationScoped = body.value.library_item_ids !== undefined;
  const requestedIds = normalizeShareIds(registrationScoped ? body.value.library_item_ids : body.value.content_ids);
  if (!requestedIds.length) return jsonError(400, "INVALID_REQUEST", "Selected library items are required");
  if (requestedIds.length > LIBRARY_SHARE_MAX_ITEMS) {
    return jsonError(400, "TOO_MANY_ITEMS", `Share up to ${LIBRARY_SHARE_MAX_ITEMS} items at once`, {
      max_items: LIBRARY_SHARE_MAX_ITEMS
    });
  }

  const adminClient = createAdminClient();
  const ownedResults = await Promise.all(
    chunk(requestedIds, LIBRARY_SHARE_QUERY_CHUNK).map((ids) =>
      readAllRows((from, to) => adminClient.from("user_library_items")
        .select("id,content_id")
        .eq("user_id", userId)
        .in(registrationScoped ? "id" : "content_id", ids)
        .order("id")
        .range(from, to))
    )
  );
  const ownedError = ownedResults.find((result) => result.error)?.error;
  if (ownedError) return jsonError(500, "DB_ERROR", ownedError.message);

  const ownedRows = ownedResults.flatMap(result => result.data ?? []) as { id: string; content_id: string }[];
  const ownedSet = new Set(ownedRows.map(row => registrationScoped ? row.id : row.content_id));
  const validatedIds = requestedIds.filter(id => ownedSet.has(id));
  if (registrationScoped && validatedIds.length !== requestedIds.length) {
    return jsonError(403, "FORBIDDEN", "All selected library items must belong to the authenticated user");
  }
  const ownedById = new Map(ownedRows.map(row => [row.id, row.content_id]));
  const validatedContentIds = registrationScoped
    ? [...new Set(validatedIds.map(id => ownedById.get(id)!))]
    : validatedIds;
  if (!validatedContentIds.length) return jsonError(400, "INVALID_REQUEST", "No owned library items to share");

  const title = normalizeTitle(body.value.title);
  const { data: share, error: shareError } = await adminClient
    .from("library_shares")
    .insert({
      owner_user_id: userId,
      title,
      filters: normalizeFilters(body.value.filters),
      content_ids: validatedContentIds,
      library_item_ids: registrationScoped ? validatedIds : null,
      item_count: registrationScoped ? validatedIds.length : validatedContentIds.length
    })
    .select("id,title,item_count,created_at")
    .single();

  if (shareError || !share) {
    return jsonError(500, "DB_ERROR", shareError?.message ?? "Failed to create library share");
  }

  return json({ ...share, scope: registrationScoped ? "library-item-v1" : "content-v1" }, 201);
});

function normalizeShareIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    const id = String(item ?? "").trim().toLowerCase();
    if (!UUID_PATTERN.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function normalizeTitle(value: unknown): string {
  const title = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!title) return "SceneNote 공유 목록";
  return title.slice(0, 80);
}

function normalizeFilters(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
