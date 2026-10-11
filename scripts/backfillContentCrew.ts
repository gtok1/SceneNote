export interface BackfillArgs { apply: boolean; limit: number }

export function parseBackfillArgs(argv: readonly string[]): BackfillArgs {
  let limit = 200;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = arg === "--limit" ? argv[++index] : arg?.startsWith("--limit=") ? arg.slice(8) : undefined;
    if (value !== undefined) {
      const parsed = Number(value);
      limit = /^\d+$/.test(value) && Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 2000) : 200;
    }
  }
  return { apply: argv.includes("--apply"), limit };
}

export function backfillTarget(row: { source_api: string; source_id: string | null; content_type: string }):
  { kind: "tmdb"; mediaType: "movie" | "tv"; id: string } | { kind: "anilist"; id: string } | { kind: "skip" } {
  if (!row.source_id || !/^\d+$/.test(row.source_id)) return { kind: "skip" };
  if (row.source_api === "tmdb") return { kind: "tmdb", mediaType: row.content_type === "movie" ? "movie" : "tv", id: row.source_id };
  if (row.source_api === "anilist") return { kind: "anilist", id: row.source_id };
  return { kind: "skip" };
}

export function retryDelayMs(retryAfterHeader: string | null): number {
  if (retryAfterHeader === null || !/^\d+$/.test(retryAfterHeader)) return 60000;
  const seconds = Number(retryAfterHeader);
  return Number.isFinite(seconds) ? Math.max(1, Math.min(seconds, 300)) * 1000 : 60000;
}
