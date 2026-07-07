/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/types/database";

type ContentRow = Database["public"]["Tables"]["contents"]["Row"];

interface DateLookupResult {
  airDate: string | null;
  airYear: number | null;
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
  const { data, error } = await supabase
    .from("contents")
    .select("id,content_type,source_api,source_id,title_primary,air_year,air_date")
    .is("air_date", null)
    .neq("source_api", "manual")
    .limit(limit);

  if (error) {
    fail(`Failed to load contents. Apply supabase/migrations/0013_content_air_date.sql first. ${error.message}`);
  }

  const contents = data ?? [];
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const content of contents) {
    try {
      const lookup = await lookupAirDate(content);
      if (!lookup.airDate) {
        skipped += 1;
        console.log(`skip: ${content.title_primary} (${content.source_api}:${content.source_id})`);
        continue;
      }

      const { error: updateError } = await supabase
        .from("contents")
        .update({
          air_date: lookup.airDate,
          air_year: lookup.airYear ?? content.air_year
        })
        .eq("id", content.id);

      if (updateError) throw new Error(updateError.message);
      updated += 1;
      console.log(`updated: ${content.title_primary} -> ${lookup.airDate}`);
    } catch (error) {
      failed += 1;
      console.warn(
        `failed: ${content.title_primary} (${content.source_api}:${content.source_id}) - ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  console.log(`done: updated=${updated}, skipped=${skipped}, failed=${failed}, scanned=${contents.length}`);
}

async function lookupAirDate(content: Pick<ContentRow, "content_type" | "source_api" | "source_id">): Promise<DateLookupResult> {
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
  const day = parts?.day;
  if (!year || !month || !day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

function assertNever(value: never): never {
  throw new Error(`Unhandled source: ${value}`);
}
