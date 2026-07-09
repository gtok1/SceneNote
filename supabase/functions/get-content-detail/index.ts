import { fetchContentDetail, fetchEpisodesForSeason } from "../_shared/externalContent.ts";
import { extractGenreNames, upsertGenres } from "../_shared/genres.ts";
import { corsHeaders, json, jsonError, parseJson } from "../_shared/http.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import type { ContentMeta, ExternalSource } from "../_shared/types.ts";

interface GetContentDetailRequest {
  api_source?: ExternalSource;
  external_source?: ExternalSource;
  external_id?: string;
  media_type?: string;
}

interface SeasonRow {
  id: string;
  season_number: number;
  episode_count: number | null;
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
      await updateContentSnapshot(adminClient, externalRow.content_id, contentMeta);

      try {
        await upsertGenres(adminClient, externalRow.content_id, contentMeta.genres);
      } catch (error) {
        console.error("Genre upsert skipped:", error);
      }

      await upsertSeasonsAndPrefetchFirstSeason(adminClient, {
        contentId: externalRow.content_id,
        source,
        externalId,
        contentMeta
      });

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
          air_date: contentMeta.air_date,
          end_date: contentMeta.end_date,
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
        air_date: content.air_date ?? null,
        end_date: content.end_date ?? null,
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
        air_date: contentMeta.air_date,
        end_date: contentMeta.end_date,
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

function buildContentPatch(contentMeta: ContentMeta, includeDateColumns: boolean) {
  const patch: Record<string, unknown> = {
    content_type: contentMeta.content_type,
    title_primary: contentMeta.title_primary,
    title_original: contentMeta.title_original,
    poster_url: contentMeta.poster_url,
    overview: contentMeta.overview,
    air_year: contentMeta.air_year
  };

  if (includeDateColumns) {
    patch.air_date = contentMeta.air_date;
    patch.end_date = contentMeta.end_date;
  }

  return patch;
}

async function updateContentSnapshot(
  adminClient: ReturnType<typeof createAdminClient>,
  contentId: string,
  contentMeta: ContentMeta
): Promise<void> {
  let result = await adminClient
    .from("contents")
    .update(buildContentPatch(contentMeta, true))
    .eq("id", contentId);

  if (result.error && isMissingDateColumnError(result.error)) {
    result = await adminClient
      .from("contents")
      .update(buildContentPatch(contentMeta, false))
      .eq("id", contentId);
  }

  if (result.error) throw new Error(result.error.message);
}

async function upsertSeasonsAndPrefetchFirstSeason(
  adminClient: ReturnType<typeof createAdminClient>,
  params: {
    contentId: string;
    source: ExternalSource;
    externalId: string;
    contentMeta: ContentMeta;
  }
): Promise<void> {
  if (!params.contentMeta.seasons.length) return;

  const { data: seasons, error } = await adminClient.from("seasons").upsert(
    params.contentMeta.seasons.map((season) => ({
      content_id: params.contentId,
      season_number: season.season_number,
      title: season.title,
      episode_count: season.episode_count,
      air_year: season.air_year
    })),
    { onConflict: "content_id,season_number" }
  ).select("id,season_number,episode_count");

  if (error) {
    console.error("Season upsert skipped:", error);
    return;
  }

  try {
    await prefetchFirstSeasonEpisodes(adminClient, {
      contentId: params.contentId,
      source: params.source,
      externalId: params.externalId,
      contentMeta: params.contentMeta,
      seasons: (seasons ?? []) as SeasonRow[]
    });
  } catch (error) {
    console.error("First season episode prefetch skipped:", error);
  }
}

async function prefetchFirstSeasonEpisodes(
  adminClient: ReturnType<typeof createAdminClient>,
  params: {
    contentId: string;
    source: ExternalSource;
    externalId: string;
    contentMeta: ContentMeta;
    seasons: SeasonRow[];
  }
): Promise<void> {
  if (params.contentMeta.content_type === "movie") return;

  const firstSeason = [...params.seasons]
    .filter((season) => season.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number)[0];
  if (!firstSeason) return;

  const episodes =
    params.source === "tmdb" || params.source === "tvmaze"
      ? await fetchEpisodesForSeason({
          source: params.source,
          externalId: params.externalId,
          seasonNumber: firstSeason.season_number,
          episodeCount: firstSeason.episode_count
        })
      : params.contentMeta.air_date
        ? [
            {
              episode_number: 1,
              title: null,
              air_date: params.contentMeta.air_date,
              duration_seconds: null
            }
          ]
        : [];
  const usefulEpisodes = episodes.filter((episode) => episode.air_date || episode.title || episode.duration_seconds);
  if (!usefulEpisodes.length) return;

  const { error } = await adminClient.from("episodes").upsert(
    usefulEpisodes.map((episode) => ({
      season_id: firstSeason.id,
      content_id: params.contentId,
      episode_number: episode.episode_number,
      title: episode.title,
      air_date: episode.air_date,
      duration_seconds: episode.duration_seconds
    })),
    { onConflict: "season_id,episode_number" }
  );

  if (error) throw new Error(error.message);
}

function isMissingDateColumnError(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return error.code === "42703" || message.includes("air_date") || message.includes("end_date");
}
