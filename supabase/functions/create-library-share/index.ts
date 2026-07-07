import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";

interface CreateLibraryShareRequest {
  title?: string;
  filters?: Record<string, unknown>;
  content_ids?: string[];
}

const MAX_SHARED_ITEMS = 300;
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

  const contentIds = normalizeContentIds(body.value.content_ids);
  if (!contentIds.length) return jsonError(400, "INVALID_REQUEST", "content_ids are required");
  if (contentIds.length > MAX_SHARED_ITEMS) {
    return jsonError(400, "TOO_MANY_ITEMS", `Share up to ${MAX_SHARED_ITEMS} items at once`);
  }

  const adminClient = createAdminClient();
  const { data: ownedRows, error: ownedError } = await adminClient
    .from("user_library_items")
    .select("content_id")
    .eq("user_id", userId)
    .in("content_id", contentIds);

  if (ownedError) return jsonError(500, "DB_ERROR", ownedError.message);

  const ownedSet = new Set((ownedRows ?? []).map((row) => row.content_id as string));
  const validatedContentIds = contentIds.filter((contentId) => ownedSet.has(contentId));
  if (!validatedContentIds.length) return jsonError(400, "INVALID_REQUEST", "No owned library items to share");

  const title = normalizeTitle(body.value.title);
  const { data: share, error: shareError } = await adminClient
    .from("library_shares")
    .insert({
      owner_user_id: userId,
      title,
      filters: normalizeFilters(body.value.filters),
      content_ids: validatedContentIds,
      item_count: validatedContentIds.length
    })
    .select("id,title,item_count,created_at")
    .single();

  if (shareError || !share) {
    return jsonError(500, "DB_ERROR", shareError?.message ?? "Failed to create library share");
  }

  return json(share, 201);
});

function normalizeContentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    const id = String(item ?? "").trim();
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
