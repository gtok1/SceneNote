/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/types/database";

type ContentRow = Database["public"]["Tables"]["contents"]["Row"];
type ContentCandidate = Pick<
  ContentRow,
  "id" | "content_type" | "source_api" | "source_id" | "title_primary" | "air_year"
> & {
  air_date?: string | null;
};

interface DateLookupResult {
  airDate: string | null;
  airYear: number | null;
}

interface SeasonRow {
  id: string;
  season_number: number;
  episode_count: number | null;
}

interface EpisodeLookupResult {
  episode_number: number;
  title: string | null;
  air_date: string | null;
  duration_seconds: number | null;
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const supabaseUrl = readEnv("EXPO_PUBLIC_SUPABASE_URL") ?? readEnv("SUPABASE_URL");
const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const limitArg = Number.parseInt(process.argv[2] ?? "", 10);
const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 500;

if (!supabaseUrl || !serviceRoleKey) {
  fail("EXPO_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

void main();

async function main() {
  const hasContentAirDate = await hasContentAirDateColumn();
  let query = supabase
    .from("contents")
    .select("*")
    .neq("source_api", "manual")
    .limit(limit);
  if (hasContentAirDate) query = query.is("air_date", null);

  const { data, error } = await query;

  if (error) {
    fail(`Failed to load contents. ${error.message}`);
  }

  const contents = (data ?? []) as unknown as ContentCandidate[];
  const contentIdsWithEpisodeDate = hasContentAirDate
    ? new Set<string>()
    : await getContentIdsWithEpisodeDates(contents.map((content) => content.id));
  let updatedContents = 0;
  let updatedEpisodes = 0;
  let skippedExisting = 0;
  let skipped = 0;
  let failed = 0;

  for (const content of contents) {
    try {
      if (!hasContentAirDate && contentIdsWithEpisodeDate.has(content.id)) {
        skippedExisting += 1;
        continue;
      }

      const lookup = await lookupAirDate(content);
      if (!lookup.airDate) {
        skipped += 1;
        console.log(`skip: ${content.title_primary} (${content.source_api}:${content.source_id})`);
        continue;
      }

      if (hasContentAirDate) {
        const { error: updateError } = await supabase
          .from("contents")
          .update({
            air_date: lookup.airDate,
            air_year: lookup.airYear ?? content.air_year
          })
          .eq("id", content.id);

        if (updateError) throw new Error(updateError.message);
        updatedContents += 1;
      }

      const episodeCount = await backfillFirstSeasonEpisodes(content, lookup.airDate);
      updatedEpisodes += episodeCount;
      console.log(
        `updated: ${content.title_primary} -> ${lookup.airDate}${
          episodeCount > 0 ? `, episodes=${episodeCount}` : ""
        }`
      );
    } catch (error) {
      failed += 1;
      console.warn(
        `failed: ${content.title_primary} (${content.source_api}:${content.source_id}) - ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  console.log(
    `done: updated_contents=${updatedContents}, updated_episodes=${updatedEpisodes}, skipped_existing=${skippedExisting}, skipped=${skipped}, failed=${failed}, scanned=${contents.length}, content_air_date_column=${hasContentAirDate}`
  );
}

async function hasContentAirDateColumn(): Promise<boolean> {
  const { error } = await supabase
    .from("contents")
    .select("id,air_date")
    .limit(1);
  if (!error) return true;
  if (isMissingColumnError(error)) return false;
  throw new Error(error.message);
}

async function lookupAirDate(
  content: Pick<ContentRow, "content_type" | "source_api" | "source_id">
): Promise<DateLookupResult> {
  switch (content.source_api) {
    case "tmdb":
      return lookupTmdbAirDate(content.source_id, content.content_type === "movie" ? "movie" : "tv");
    case "anilist":
      return lookupAniListAirDate(content.source_id);
    case "kitsu":
      return lookupKitsuAirDate(content.source_id);
    case "tvmaze":
      return lookupTvmazeAirDate(content.source_id);
    case "manual":
      return { airDate: null, airYear: null };
    default:
      return assertNever(content.source_api);
  }
}

async function getContentIdsWithEpisodeDates(contentIds: string[]): Promise<Set<string>> {
  if (!contentIds.length) return new Set();

  const result = new Set<string>();
  const chunkSize = 100;
  for (let index = 0; index < contentIds.length; index += chunkSize) {
    const chunk = contentIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("episodes")
      .select("content_id")
      .in("content_id", chunk)
      .not("air_date", "is", null);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      result.add(row.content_id);
    }
  }

  return result;
}

async function backfillFirstSeasonEpisodes(content: ContentCandidate, airDate: string): Promise<number> {
  if (content.content_type === "movie") return 0;

  const episodes = await lookupFirstSeasonEpisodes(content, airDate);
  const usefulEpisodes = episodes.filter((episode) => episode.air_date || episode.title || episode.duration_seconds);
  if (!usefulEpisodes.length) return 0;

  const season = await ensureSeason(content);
  const { error } = await supabase.from("episodes").upsert(
    usefulEpisodes.map((episode) => ({
      season_id: season.id,
      content_id: content.id,
      episode_number: episode.episode_number,
      title: episode.title,
      air_date: episode.air_date,
      duration_seconds: episode.duration_seconds
    })),
    { onConflict: "season_id,episode_number" }
  );
  if (error) throw new Error(error.message);
  return usefulEpisodes.length;
}

async function lookupFirstSeasonEpisodes(
  content: ContentCandidate,
  airDate: string
): Promise<EpisodeLookupResult[]> {
  if (content.source_api === "tmdb") return lookupTmdbEpisodes(content.source_id, 1);
  if (content.source_api === "tvmaze") return lookupTvmazeEpisodes(content.source_id, 1);
  if (content.source_api === "anilist" || content.source_api === "kitsu") {
    return [
      {
        episode_number: 1,
        title: null,
        air_date: airDate,
        duration_seconds: null
      }
    ];
  }
  return [];
}

async function ensureSeason(content: ContentCandidate): Promise<SeasonRow> {
  const { data: existingSeason, error: existingError } = await supabase
    .from("seasons")
    .select("id,season_number,episode_count")
    .eq("content_id", content.id)
    .eq("season_number", 1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existingSeason) return existingSeason as SeasonRow;

  const { data: createdSeason, error: createError } = await supabase
    .from("seasons")
    .insert({
      content_id: content.id,
      season_number: 1,
      title: null,
      episode_count: null,
      air_year: content.air_year
    })
    .select("id,season_number,episode_count")
    .single();

  if (createError || !createdSeason) throw new Error(createError?.message ?? "Failed to create season");
  return createdSeason as SeasonRow;
}

async function lookupTmdbAirDate(sourceId: string, preferredMediaType: "movie" | "tv"): Promise<DateLookupResult> {
  const apiKey = readEnv("TMDB_API_KEY");
  if (!apiKey) return { airDate: null, airYear: null };

  const attempts = preferredMediaType === "movie" ? ["movie", "tv"] : ["tv", "movie"];
  for (const mediaType of attempts) {
    const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${sourceId}`);
    url.searchParams.set("language", "ko-KR");
    const response = await fetch(url, { headers: tmdbHeaders(url, apiKey) });
    if (!response.ok) continue;

    const payload = (await response.json()) as { release_date?: string | null; first_air_date?: string | null };
    const value = mediaType === "movie" ? payload.release_date : payload.first_air_date;
    const airDate = dateOnly(value);
    if (airDate) return { airDate, airYear: yearFromDate(airDate) };
  }

  return { airDate: null, airYear: null };
}

async function lookupTmdbEpisodes(sourceId: string, seasonNumber: number): Promise<EpisodeLookupResult[]> {
  const apiKey = readEnv("TMDB_API_KEY");
  if (!apiKey) return [];

  const url = new URL(`https://api.themoviedb.org/3/tv/${sourceId}/season/${seasonNumber}`);
  url.searchParams.set("language", "ko-KR");
  const response = await fetch(url, { headers: tmdbHeaders(url, apiKey) });
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    episodes?: {
      episode_number?: number | null;
      name?: string | null;
      air_date?: string | null;
      runtime?: number | null;
    }[];
  };

  return (payload.episodes ?? [])
    .filter((episode) => typeof episode.episode_number === "number" && episode.episode_number > 0)
    .map((episode) => ({
      episode_number: episode.episode_number as number,
      title: episode.name ?? null,
      air_date: dateOnly(episode.air_date),
      duration_seconds: durationMinutesToSeconds(episode.runtime)
    }));
}

async function lookupAniListAirDate(sourceId: string): Promise<DateLookupResult> {
  const endpoint = readEnv("ANILIST_API_URL") ?? "https://graphql.anilist.co";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        query GetAnimeDate($id: Int!) {
          Media(id: $id, type: ANIME) {
            startDate { year month day }
          }
        }
      `,
      variables: { id: Number.parseInt(sourceId, 10) }
    })
  });

  if (!response.ok) return { airDate: null, airYear: null };
  const payload = (await response.json()) as {
    data?: { Media?: { startDate?: { year?: number | null; month?: number | null; day?: number | null } | null } | null };
  };
  const airDate = dateFromParts(payload.data?.Media?.startDate);
  return { airDate, airYear: yearFromDate(airDate) };
}

async function lookupKitsuAirDate(sourceId: string): Promise<DateLookupResult> {
  const baseUrl = readEnv("KITSU_API_URL") ?? "https://kitsu.io/api/edge";
  const response = await fetch(`${baseUrl}/anime/${sourceId}`, {
    headers: { Accept: "application/vnd.api+json" }
  });
  if (!response.ok) return { airDate: null, airYear: null };

  const payload = (await response.json()) as { data?: { attributes?: { startDate?: string | null } | null } | null };
  const airDate = dateOnly(payload.data?.attributes?.startDate);
  return { airDate, airYear: yearFromDate(airDate) };
}

async function lookupTvmazeAirDate(sourceId: string): Promise<DateLookupResult> {
  const baseUrl = readEnv("TVMAZE_API_URL") ?? "https://api.tvmaze.com";
  const response = await fetch(`${baseUrl}/shows/${sourceId}`);
  if (!response.ok) return { airDate: null, airYear: null };

  const payload = (await response.json()) as { premiered?: string | null };
  const airDate = dateOnly(payload.premiered);
  return { airDate, airYear: yearFromDate(airDate) };
}

async function lookupTvmazeEpisodes(sourceId: string, seasonNumber: number): Promise<EpisodeLookupResult[]> {
  const baseUrl = readEnv("TVMAZE_API_URL") ?? "https://api.tvmaze.com";
  const response = await fetch(`${baseUrl}/shows/${sourceId}/episodes`);
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    season?: number | null;
    number?: number | null;
    name?: string | null;
    airdate?: string | null;
    runtime?: number | null;
  }[];

  return payload
    .filter((episode) => episode.season === seasonNumber && typeof episode.number === "number" && episode.number > 0)
    .map((episode) => ({
      episode_number: episode.number as number,
      title: episode.name ?? null,
      air_date: dateOnly(episode.airdate),
      duration_seconds: durationMinutesToSeconds(episode.runtime)
    }));
}

function tmdbHeaders(url: URL, apiKey: string): HeadersInit {
  if (apiKey.startsWith("eyJ") || apiKey.split(".").length === 3) {
    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };
  }

  url.searchParams.set("api_key", apiKey);
  return { "Content-Type": "application/json" };
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function dateFromParts(parts?: { year?: number | null; month?: number | null; day?: number | null } | null): string | null {
  const year = parts?.year;
  const month = parts?.month;
  if (!year || !month) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(parts?.day ?? 1).padStart(2, "0")}`;
}

function durationMinutesToSeconds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 60);
}

function yearFromDate(value: string | null): number | null {
  if (!value) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] ??= value;
  }
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  return error.code === "42703" || /column .* does not exist/i.test(error.message ?? "");
}

function assertNever(value: never): never {
  throw new Error(`Unhandled source: ${value}`);
}
