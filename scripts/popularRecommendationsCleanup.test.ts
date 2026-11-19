import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url).href);

it("80 T-1: unused client popular recommendation files are removed", () => {
  const files = [
    "src/services/popularRecommendations.ts",
    "src/utils/popularRanking.ts",
    "src/utils/popularRanking.test.ts"
  ];
  assert.deepEqual(
    files.map(file => [file, existsSync(join(root, file))]),
    files.map(file => [file, false])
  );
});

it("80 T-2: no source references the removed client popular code", () => {
  const removedReferences = [
    "services/popularRecommendations",
    "utils/popularRanking",
    "getPopularRecommendations",
    "scenenote-popular-recommendations-last-good"
  ];
  const references = ["app", "src", "scripts"].flatMap(directory =>
    readdirSync(join(root, directory), { recursive: true, encoding: "utf8" })
      .filter(file => /\.tsx?$/.test(file))
      .map(file => `${directory}/${file.replaceAll("\\", "/")}`)
  ).sort().filter(file => file !== "scripts/popularRecommendationsCleanup.test.ts")
    .flatMap(file => {
      const source = readFileSync(join(root, file), "utf8");
      const matches = removedReferences.filter(reference => source.includes(reference));
      return matches.length ? [{ file, references: matches }] : [];
    });
  assert.deepEqual(references, []);
});

it("80 T-3: popular recommendation types live in a type-only module", () => {
  const file = join(root, "src/types/popularRecommendations.ts");
  assert.ok(existsSync(file), "Popular recommendation type module must exist");
  const source = readFileSync(file, "utf8");
  assert.ok(source.includes("export type RecommendationCategory"));
  assert.ok(source.includes("export interface PopularRecommendation "));
  assert.ok(source.includes("export interface PopularRecommendationsResponse"));
  const imports = source.split("\n").filter(line => /^\s*import\b/.test(line));
  assert.ok(imports.every(line => line.trimStart().startsWith("import type")));
  assert.doesNotMatch(source, /\bfunction\b/);
  assert.doesNotMatch(source, /\bconst\s/);
});

it("80 T-4: the smoke script imports the response type from the types module", () => {
  const source = readFileSync(join(root, "scripts/smoke-edge-functions.ts"), "utf8");
  assert.ok(source.includes('import type { PopularRecommendationsResponse } from "../src/types/popularRecommendations";'));
  assert.ok(source.includes('supabase.functions.invoke<PopularRecommendationsResponse>("popular-recommendations")'));
});

it("80 T-5: the unused popular query key is removed", () => {
  const source = readFileSync(join(root, "src/lib/query.ts"), "utf8");
  assert.equal(source.includes('"popular"'), false);
  assert.ok(source.includes("personalized:"));
});

it("80 T-6: server popular recommendation code is kept", () => {
  const files = [
    "supabase/functions/popular-recommendations/index.ts",
    "supabase/functions/_shared/popularRanking.ts",
    "supabase/functions/_shared/popularRanking.test.ts"
  ];
  assert.deepEqual(
    files.map(file => [file, existsSync(join(root, file))]),
    files.map(file => [file, true])
  );
});
