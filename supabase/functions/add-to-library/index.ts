import { fetchContentDetail } from "../_shared/externalContent.ts";
import { upsertGenres } from "../_shared/genres.ts";
import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import type { ExternalSource, WatchStatus } from "../_shared/types.ts";

interface AddToLibraryRequest {
  api_source?: ExternalSource;
  external_source?: ExternalSource;
  external_id?: string;
  watch_status?: WatchStatus;
  watch_statuses?: WatchStatus[];
  media_type?: string;
}

const WATCH_STATUS_OPTIONS: WatchStatus[] = ["wishlist", "watching", "completed", "recommended", "not_recommended"];

function normalizeWatchStatuses(statuses: WatchStatus[] | undefined, fallback: WatchStatus): WatchStatus[] {
  const normalized = Array.from(new Set(statuses?.length ? statuses : [fallback])).filter((status) =>
    WATCH_STATUS_OPTIONS.includes(status)
  ).sort(
    (a, b) => WATCH_STATUS_OPTIONS.indexOf(a) - WATCH_STATUS_OPTIONS.indexOf(b)
  );
  return normalized.length > 0 ? normalized : ["wishlist"];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");

  let userId: string;
  try {
    userId = (await requireUser(req)).id;
  } catch {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const body = await parseJson<AddToLibraryRequest>(req);
  if (!body.ok) return jsonError(400, "INVALID_REQUEST", body.message);

  const source = body.value.api_source ?? body.value.external_source;
  const externalId = body.value.external_id?.trim();
  const watchStatus = body.value.watch_status ?? "wishlist";
  const watchStatuses = normalizeWatchStatuses(body.value.watch_statuses, watchStatus);
  const initialWatchCount = watchStatuses.includes("completed") ? 1 : 0;

  if (!source || !["tmdb", "anilist", "kitsu", "tvmaze"].includes(source)) {
    return jsonError(400, "INVALID_REQUEST", "api_source must be tmdb, anilist, kitsu, or tvmaze");
  }

  if (!externalId) {
    return jsonError(400, "INVALID_REQUEST", "external_id is required");
  }

  if (!WATCH_STATUS_OPTIONS.includes(watchStatus)) {
    return jsonError(400, "INVALID_REQUEST", "watch_status is invalid");
  }

  if (watchStatuses.some((status) => !WATCH_STATUS_OPTIONS.includes(status))) {
    return jsonError(400, "INVALID_REQUEST", "watch_statuses contains invalid status");
  }

  const adminClient = createAdminClient();

  const { data: existingExternalId, error: externalLookupError } = await adminClient
    .from("content_external_ids")
    .select("content_id")
    .eq("api_source", source)
    .eq("external_id", externalId)
    .maybeSingle();

  if (externalLookupError) {
    return jsonError(500, "DB_ERROR", externalLookupError.message);
  }

  if (existingExternalId?.content_id) {
    const { data: existingLibraryItem, error: libraryLookupError } = await adminClient
      .from("user_library_items")
      .select("id, status, status_flags")
      .eq("user_id", userId)
      .eq("content_id", existingExternalId.content_id)
      .maybeSingle();

    if (libraryLookupError) {
      return jsonError(500, "DB_ERROR", libraryLookupError.message);
    }

    if (existingLibraryItem) {
      return json(
        {
          library_item_id: existingLibraryItem.id,
          content_id: existingExternalId.content_id,
          status: existingLibraryItem.status,
          statuses: existingLibraryItem.status_flags ?? [existingLibraryItem.status],
          already_exists: true
        },
        200
      );
    }
  }

  let contentMeta;
  try {
    contentMeta = await fetchContentDetail(source, externalId, body.value.media_type);
  } catch (error) {
    await logSync(adminClient, {
      content_id: null,
      api_source: source,
      operation: "add_to_library",
      status: "failed",
      request_payload: { source, externalId, watchStatus },
      error_message: error instanceof Error ? error.message : String(error)
    });
    return jsonError(503, "API_ERROR", "Failed to fetch content metadata");
  }

  const { data: contentRow, error: contentError } = await adminClient
    .from("contents")
    .upsert(
      {
        content_type: contentMeta.content_type,
        source_api: source,
        source_id: externalId,
        title_primary: contentMeta.title_primary,
        title_original: contentMeta.title_original,
        poster_url: contentMeta.poster_url,
        overview: contentMeta.overview,
        air_year: contentMeta.air_year
      },
      { onConflict: "source_api,source_id" }
    )
    .select("id")
    .single();

  if (contentError || !contentRow) {
    await logSync(adminClient, {
      content_id: null,
      api_source: source,
      operation: "upsert_content",
      status: "failed",
      request_payload: { source, externalId },
      error_message: contentError?.message ?? "Unknown content upsert error"
    });
    return jsonError(500, "DB_ERROR", "Failed to save content metadata");
  }

  const contentId = contentRow.id as string;

  try {
    await upsertGenres(adminClient, contentId, contentMeta.genres);
  } catch (error) {
    console.error("Genre upsert skipped:", error);
  }

  const { error: externalIdError } = await adminClient.from("content_external_ids").upsert(
    {
      content_id: contentId,
      api_source: source,
      external_id: externalId
    },
    { onConflict: "api_source,external_id", ignoreDuplicates: true }
  );

  if (externalIdError) {
    return jsonError(500, "DB_ERROR", externalIdError.message);
  }

  if (contentMeta.seasons.length > 0) {
    const { error: seasonsError } = await adminClient.from("seasons").upsert(
      contentMeta.seasons.map((season) => ({
        content_id: contentId,
        season_number: season.season_number,
        title: season.title,
        episode_count: season.episode_count,
        air_year: season.air_year
      })),
      { onConflict: "content_id,season_number" }
    );

    if (seasonsError) {
      await logSync(adminClient, {
        content_id: contentId,
        api_source: source,
        operation: "upsert_seasons",
        status: "partial",
        request_payload: { source, externalId },
        error_message: seasonsError.message
      });
    }
  }

  const { data: libraryItem, error: libraryError } = await adminClient
    .from("user_library_items")
    .insert({
      user_id: userId,
      content_id: contentId,
      status: watchStatus,
      status_flags: watchStatuses,
      watch_count: initialWatchCount
    })
    .select("id, status, status_flags, watch_count")
    .single();

  if (libraryError) {
    if (libraryError.code === "23505") {
      return jsonError(409, "ALREADY_IN_LIBRARY", "Content already exists in library", {
        content_id: contentId
      });
    }
    return jsonError(500, "DB_ERROR", libraryError.message);
  }

  await logSync(adminClient, {
    content_id: contentId,
    api_source: source,
    operation: "add_to_library",
    status: "success",
    request_payload: { source, externalId, watchStatus },
    response_snapshot: {
      title_primary: contentMeta.title_primary,
      content_type: contentMeta.content_type,
      season_count: contentMeta.seasons.length
    }
  });

  return json(
    {
      library_item_id: libraryItem.id,
      content_id: contentId,
      status: libraryItem.status,
      statuses: libraryItem.status_flags ?? [libraryItem.status],
      watch_count: libraryItem.watch_count ?? initialWatchCount
    },
    201
  );
});

async function logSync(
  adminClient: ReturnType<typeof createAdminClient>,
  params: {
    content_id: string | null;
    api_source: ExternalSource;
    operation: string;
    status: "success" | "partial" | "failed";
    request_payload?: object;
    response_snapshot?: object;
    error_message?: string;
  }
): Promise<void> {
  await adminClient.from("metadata_sync_logs").insert({
    content_id: params.content_id,
    api_source: params.api_source,
    operation: params.operation,
    status: params.status,
    request_payload: params.request_payload ?? null,
    response_snapshot: params.response_snapshot ?? null,
    error_message: params.error_message ?? null
  });
}
