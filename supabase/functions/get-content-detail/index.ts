import { fetchContentDetail } from "../_shared/externalContent.ts";
import { extractGenreNames, upsertGenres } from "../_shared/genres.ts";
import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import type { ExternalSource } from "../_shared/types.ts";

interface GetContentDetailRequest {
  api_source?: ExternalSource;
  external_source?: ExternalSource;
  external_id?: string;
  media_type?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");

  try {
    await requireUser(req);
  } catch {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const body = await parseJson<GetContentDetailRequest>(req);
  if (!body.ok) return jsonError(400, "INVALID_REQUEST", body.message);

  const source = body.value.api_source ?? body.value.external_source;
  const externalId = body.value.external_id?.trim();

  if (!source || !["tmdb", "anilist", "kitsu", "tvmaze"].includes(source)) {
    return jsonError(400, "INVALID_REQUEST", "api_source must be tmdb, anilist, kitsu, or tvmaze");
  }

  if (!externalId) {
    return jsonError(400, "INVALID_REQUEST", "external_id is required");
  }

  const adminClient = createAdminClient();

  const { data: externalRow, error: externalError } = await adminClient
    .from("content_external_ids")
    .select("content_id")
    .eq("api_source", source)
    .eq("external_id", externalId)
    .maybeSingle();

  if (externalError) return jsonError(500, "DB_ERROR", externalError.message);

  if (externalRow?.content_id) {
    try {
      const contentMeta = await fetchContentDetail(source, externalId, body.value.media_type);
      await adminClient
        .from("contents")
        .update({
          content_type: contentMeta.content_type,
          title_primary: contentMeta.title_primary,
          title_original: contentMeta.title_original,
          poster_url: contentMeta.poster_url,
          overview: contentMeta.overview,
          air_year: contentMeta.air_year
        })
        .eq("id", externalRow.content_id);

      try {
        await upsertGenres(adminClient, externalRow.content_id, contentMeta.genres);
      } catch (error) {
        console.error("Genre upsert skipped:", error);
      }

      return json({
        content: {
          content_id: externalRow.content_id,
          external_source: contentMeta.external_source,
          external_id: contentMeta.external_id,
          content_type: contentMeta.content_type,
          title_primary: contentMeta.title_primary,
          title_original: contentMeta.title_original,
          poster_url: contentMeta.poster_url,
          overview: contentMeta.overview,
          localized_overview: contentMeta.localized_overview,
          air_year: contentMeta.air_year,
          has_seasons: contentMeta.has_seasons,
          episode_count: contentMeta.episode_count,
          genres: contentMeta.genres,
          cast: contentMeta.cast
        },
        seasons: contentMeta.seasons,
        from_db: false
      });
    } catch {
      // Fall back to the stored DB snapshot below when an external API is unavailable.
    }

    const [{ data: content, error: contentError }, { data: seasons, error: seasonsError }] =
      await Promise.all([
        adminClient
          .from("contents")
          .select("*,content_genres(genres(name))")
          .eq("id", externalRow.content_id)
          .single(),
        adminClient
          .from("seasons")
          .select("*")
          .eq("content_id", externalRow.content_id)
          .order("season_number", { ascending: true })
      ]);

    if (contentError) return jsonError(500, "DB_ERROR", contentError.message);
    if (seasonsError) return jsonError(500, "DB_ERROR", seasonsError.message);

    return json({
      content: {
        content_id: content.id,
        external_source: content.source_api,
        external_id: content.source_id,
        content_type: content.content_type,
        title_primary: content.title_primary,
        title_original: content.title_original,
        poster_url: content.poster_url,
        overview: content.overview,
        localized_overview: null,
        air_year: content.air_year,
        has_seasons: content.content_type !== "movie",
        episode_count:
          seasons?.reduce((sum: number, season: { episode_count: number | null }) => {
            return sum + (season.episode_count ?? 0);
          }, 0) || null,
        genres: extractGenreNames(content.content_genres),
        cast: []
      },
      seasons:
        seasons?.map(
          (season: {
            id: string;
            season_number: number;
            title: string | null;
            episode_count: number | null;
            air_year: number | null;
          }) => ({
            season_id: season.id,
            season_number: season.season_number,
            title: season.title,
            episode_count: season.episode_count,
            air_year: season.air_year
          })
        ) ?? [],
      from_db: true
    });
  }

  try {
    const contentMeta = await fetchContentDetail(source, externalId, body.value.media_type);
    return json({
      content: {
        external_source: contentMeta.external_source,
        external_id: contentMeta.external_id,
        content_type: contentMeta.content_type,
        title_primary: contentMeta.title_primary,
        title_original: contentMeta.title_original,
        poster_url: contentMeta.poster_url,
        overview: contentMeta.overview,
        localized_overview: contentMeta.localized_overview,
        air_year: contentMeta.air_year,
        has_seasons: contentMeta.has_seasons,
        episode_count: contentMeta.episode_count,
        genres: contentMeta.genres,
        cast: contentMeta.cast
      },
      seasons: contentMeta.seasons,
      from_db: false
    });
  } catch (error) {
    return jsonError(
      503,
      "API_ERROR",
      error instanceof Error ? error.message : "Failed to fetch content detail"
    );
  }
});
