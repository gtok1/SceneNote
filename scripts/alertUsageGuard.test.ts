import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url).href);
const ALLOWED_ALERT_CALLS = [
  "app/(tabs)/pins.tsx",
  "src/utils/confirmDestructive.ts",
  "src/utils/confirmDiscard.ts"
];
const REMOVED_FILES = [
  "src/components/content/PopularRecommendationSection.tsx",
  "src/hooks/usePopularRecommendations.ts"
];

function sourceFiles(directories: readonly string[], excludeTests: boolean): string[] {
  return directories.flatMap((directory) =>
    readdirSync(join(root, directory), { recursive: true, encoding: "utf8" })
      .filter((path) => /\.tsx?$/.test(path) && (!excludeTests || !path.endsWith(".test.ts")))
      .map((path) => `${directory}/${path.replaceAll("\\", "/")}`)
  ).sort();
}

it("78 T-1: Alert.alert appears only in the documented allowlist", () => {
  const actual = sourceFiles(["app", "src"], true).flatMap((file) => {
    const source = readFileSync(join(root, file), "utf8");
    const count = [...source.matchAll(/\bAlert\.alert\(/g)].length;
    return count > 0 ? [[file, count]] : [];
  });
  const expected = [...ALLOWED_ALERT_CALLS].sort().map((file) => [file, 1]);
  assert.deepEqual(actual, expected);
});

it("78 T-2: the pins Alert is reachable only after the web early return", () => {
  const source = readFileSync(join(root, "app/(tabs)/pins.tsx"), "utf8");
  const sharePin = source.indexOf("const sharePin =");
  const webReturn = source.indexOf('if (Platform.OS === "web") return;', sharePin);
  const alert = source.indexOf("Alert.alert(", sharePin);
  assert.ok(sharePin >= 0);
  assert.ok(webReturn > sharePin);
  assert.ok(alert > webReturn);
});

it("78 T-3: the unused popular recommendation section and hook are removed", () => {
  assert.deepEqual(
    REMOVED_FILES.map((file) => [file, existsSync(join(root, file))]),
    REMOVED_FILES.map((file) => [file, false])
  );
});

it("78 T-4: no source file references the removed section or hook while the smoke type import remains", () => {
  const references = sourceFiles(["app", "src", "scripts"], false)
    .filter((file) => file !== "scripts/alertUsageGuard.test.ts" && !REMOVED_FILES.includes(file))
    .flatMap((file) => {
      const source = readFileSync(join(root, file), "utf8");
      return /PopularRecommendationSection|usePopularRecommendations/.test(source) ? [file] : [];
    });
  assert.deepEqual(references, []);
  assert.ok(readFileSync(join(root, "scripts/smoke-edge-functions.ts"), "utf8").includes("types/popularRecommendations"));
});
