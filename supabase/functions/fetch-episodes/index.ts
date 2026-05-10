import { fetchEpisodesForSeason } from "../_shared/externalContent.ts";
import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import type { ExternalSource } from "../_shared/types.ts";

interface FetchEpisodesRequest {
  content_id?: string;
  season_id?: string;
  force_refresh?: boolean;
}

interface SeasonRow {
  id: string;
  content_id: string;
  season_number: number;
  episode_count: number | null;
  contents: {
    source_api: ExternalSource;
    source_id: string;
  } | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");

  try {
    await requireUser(req);
  } catch {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const body = await parseJson<FetchEpisodesRequest>(req);
  if (!body.ok) return jsonError(400, "INVALID_REQUEST", body.message);

  const contentId = body.value.content_id?.trim();
  const seasonId = body.value.season_id?.trim();
  const forceRefresh = body.value.force_refresh ?? false;

  if (!contentId || !seasonId) {
    return jsonError(400, "INVALID_REQUEST", "content_id and season_id are required");
  }

  const adminClient = createAdminClient();

  const { data: season, error: seasonError } = await adminClient
    .from("seasons")
    .select("id,content_id,season_number,episode_count,contents(source_api,source_id)")
    .eq("id", seasonId)
    .eq("content_id", contentId)
    .maybeSingle();

  if (seasonError) return jsonError(500, "DB_ERROR", seasonError.message);
  if (!season) return jsonError(404, "SEASON_NOT_FOUND", "Season was not found");

  const seasonRow = season as SeasonRow;

  if (!forceRefresh) {
    const { data: existingEpisodes, error: existingError } = await adminClient
      .from("episodes")
      .select("*")
      .eq("season_id", seasonId)
      .order("episode_number", { ascending: true });

    if (existingError) return jsonError(500, "DB_ERROR", existingError.message);

    if (existingEpisodes && existingEpisodes.length > 0) {
      return json({
        episodes: existingEpisodes,
        from_db: true,
        season_id: seasonId
      });
    }
  }

  if (!seasonRow.contents) {
    return jsonError(404, "CONTENT_NOT_FOUND", "Related content metadata was not found");
  }

  let episodeMeta;
  try {
    episodeMeta = await fetchEpisodesForSeason({
      source: seasonRow.contents.source_api,
      externalId: seasonRow.contents.source_id,
      seasonNumber: seasonRow.season_number,
      episodeCount: seasonRow.episode_count
    });
  } catch (error) {
    await logSync(adminClient, {
      content_id: contentId,
      api_source: seasonRow.contents.source_api,
      operation: "fetch_episodes",
      status: "failed",
      request_payload: { contentId, seasonId, seasonNumber: seasonRow.season_number },
      error_message: error instanceof Error ? error.message : String(error)
    });

    return jsonError(503, "API_ERROR", "Failed to fetch episodes from external API");
  }

  if (episodeMeta.length === 0) {
    return json({
      episodes: [],
      from_db: false,
      season_id: seasonId,
      warning: "NO_EPISODE_METADATA"
    });
  }

  const { error: upsertError } = await adminClient.from("episodes").upsert(
    episodeMeta.map((episode) => ({
      season_id: seasonId,
      content_id: contentId,
      episode_number: episode.episode_number,
      title: episode.title,
      air_date: episode.air_date,
      duration_seconds: episode.duration_seconds
    })),
    { onConflict: "season_id,episode_number" }
  );

  if (upsertError) return jsonError(500, "DB_ERROR", upsertError.message);

  const { data: episodes, error: episodesError } = await adminClient
    .from("episodes")
    .select("*")
    .eq("season_id", seasonId)
    .order("episode_number", { ascending: true });

  if (episodesError) return jsonError(500, "DB_ERROR", episodesError.message);

  await logSync(adminClient, {
    content_id: contentId,
    api_source: seasonRow.contents.source_api,
    operation: "fetch_episodes",
    status: "success",
    request_payload: { contentId, seasonId, seasonNumber: seasonRow.season_number },
    response_snapshot: { episode_count: episodes?.length ?? 0 }
  });

  return json({
    episodes: episodes ?? [],
    from_db: false,
    season_id: seasonId
  });
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
