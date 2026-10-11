/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../src/types/database";
import {
  mapAniListStaff, mapTmdbCrew,
  type AniListStaffEdgeInput, type CrewMemberMeta, type TmdbCreatorInput, type TmdbCrewInput
} from "../supabase/functions/_shared/contentCrew.ts";
import { saveContentCrew, type CrewStoreClient } from "../supabase/functions/_shared/contentCrewStore.ts";
import { backfillTarget, parseBackfillArgs, retryDelayMs } from "./backfillContentCrew";

const STAFF_QUERY = `query ContentCrew($id: Int!) {
  Media(id: $id, type: ANIME) {
    staff(perPage: 25, sort: [RELEVANCE, ID]) {
      edges { role node { id name { full native } image { large medium } } }
    }
  }
}`;

type ContentCandidate = Pick<Database["public"]["Tables"]["contents"]["Row"], "id" | "source_api" | "source_id" | "content_type">;

loadEnvFile(".env");
loadEnvFile(".env.local");

void main().catch(() => {
  // Never print provider errors: their messages may contain request URLs or credentials.
  console.error("대상: 0 · 저장: 0 · 빈 결과: 0 · 실패: 1 · 건너뜀: 0");
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const { apply, limit } = parseBackfillArgs(process.argv.slice(2));
  if (!apply) console.log("dry-run: 저장하지 않음");
  const url = readEnv("EXPO_PUBLIC_SUPABASE_URL") ?? readEnv("SUPABASE_URL");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Required environment is missing");
  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const store: CrewStoreClient = {
    from: table => ({
      update: patch => supabase.from(table).update({ ...patch, crew: patch.crew as Json })
    })
  };
  const { data, error } = await supabase.from("contents")
    .select("id,source_api,source_id,content_type")
    .is("crew_updated_at", null)
    .in("source_api", ["tmdb", "anilist"])
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw new Error("Target query failed");
  const contents: ContentCandidate[] = data ?? [];
  let saved = 0;
  let empty = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of contents) {
    const target = backfillTarget(row);
    if (target.kind === "skip") { skipped += 1; continue; }
    try {
      const crew = await fetchCrew(target);
      if (!crew.length) empty += 1;
      if (apply) {
        const result = await saveContentCrew(store, row.id, crew);
        if (result === "saved") saved += 1;
        else failed += 1;
      }
    } catch {
      failed += 1;
    } finally {
      await pause(target.kind === "tmdb" ? 250 : 800);
    }
  }
  console.log(`대상: ${contents.length} · 저장: ${saved} · 빈 결과: ${empty} · 실패: ${failed} · 건너뜀: ${skipped}`);
  if (failed) process.exitCode = 1;
}

async function fetchCrew(target: Exclude<ReturnType<typeof backfillTarget>, { kind: "skip" }>): Promise<CrewMemberMeta[]> {
  if (target.kind === "tmdb") {
    const key = readEnv("TMDB_API_KEY");
    if (!key) throw new Error("Provider credential is missing");
    const url = new URL(`https://api.themoviedb.org/3/${target.mediaType}/${target.id}`);
    url.searchParams.set("language", "ko-KR");
    url.searchParams.set("append_to_response", "credits");
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (key.startsWith("eyJ") || key.split(".").length === 3) headers.Authorization = `Bearer ${key}`;
    else url.searchParams.set("api_key", key);
    const response = await request(url.toString(), { headers });
    if (!response.ok) throw new Error("Provider request failed");
    const detail = await response.json() as { credits?: { crew?: TmdbCrewInput[] }; created_by?: TmdbCreatorInput[] };
    return mapTmdbCrew(detail.credits?.crew, target.mediaType === "tv" ? detail.created_by : undefined);
  }
  const init: RequestInit = {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: STAFF_QUERY, variables: { id: Number(target.id) } })
  };
  let response = await request("https://graphql.anilist.co", init);
  if (response.status === 429) {
    const delay = retryDelayMs(response.headers.get("Retry-After"));
    await response.body?.cancel();
    await pause(delay);
    response = await request("https://graphql.anilist.co", init);
  }
  if (!response.ok) throw new Error("Provider request failed");
  const payload = await response.json() as {
    data?: { Media?: { staff?: { edges?: AniListStaffEdgeInput[] | null } | null } | null };
    errors?: unknown[];
  };
  if (payload.errors?.length || !payload.data?.Media) throw new Error("Provider detail is unavailable");
  return mapAniListStaff(payload.data.Media.staff?.edges ?? undefined);
}

function request(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
}
function pause(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
function readEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[name] ??= value;
  }
}
