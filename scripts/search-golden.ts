/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { evaluateGoldenCase, SEARCH_GOLDEN_CASES } from "./searchGolden";

loadEnvFile(".env");
loadEnvFile(".env.local");
if (!process.env.TMDB_API_KEY?.trim()) {
  console.error("TMDB_API_KEY가 필요합니다.");
  process.exit(2);
}

Object.assign(globalThis, { Deno: { env: { get: (key: string) => process.env[key] } } });
void main();

async function main(): Promise<void> {
  const tmdbModulePath: string = "../supabase/functions/search-content/adapters/tmdb.ts";
  const normalizeModulePath: string = "../supabase/functions/search-content/adapters/normalize.ts";
  const { searchTmdb } = await import(tmdbModulePath);
  const { compactResults, createSearchQueryVariants, filterResponseForVariant } =
    await import(normalizeModulePath);
  let passed = 0;
  for (const expectation of SEARCH_GOLDEN_CASES) {
    const variants = createSearchQueryVariants(expectation.query);
    const responses = await Promise.all(variants.map(async (variant: { query: string; matchMode: "direct" | "compact-title"; compactQuery: string }) => {
      try {
        const response = await searchTmdb({
          query: variant.query, mediaType: "all", page: 1, signal: AbortSignal.timeout(8_000)
        });
        return filterResponseForVariant(response, variant).results;
      } catch {
        console.warn(`${expectation.query}: 변형 "${variant.query}" 조회 실패`);
        return [];
      }
    }));
    const verdict = evaluateGoldenCase(compactResults(responses.flat()), expectation);
    if (verdict.ok) passed += 1;
    else for (const failure of verdict.failures) console.error(failure);
  }
  console.log(`통과 ${passed}/${SEARCH_GOLDEN_CASES.length}`);
  if (passed !== SEARCH_GOLDEN_CASES.length) process.exitCode = 1;
}

function loadEnvFile(filename: string): void {
  const filePath = resolve(process.cwd(), filename);
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    if (process.env[key]) continue;
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const first = rawValue[0], last = rawValue[rawValue.length - 1];
    process.env[key] = (first === '"' && last === '"') || (first === "'" && last === "'")
      ? rawValue.slice(1, -1) : rawValue;
  }
}
