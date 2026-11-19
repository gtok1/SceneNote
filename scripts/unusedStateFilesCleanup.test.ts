import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url).href);

it("83 T-1: unused state files are removed", () => {
  const files = [
    "src/stores/pinComposerStore.ts",
    "src/stores/episodeSelectionStore.ts",
    "src/atoms/watchProvidersAtom.ts",
    "src/atoms/tagFilterAtom.ts"
  ];
  assert.deepEqual(
    files.map(file => [file, existsSync(join(root, file))]),
    files.map(file => [file, false])
  );
});

it("83 T-2: no source references the removed state files", () => {
  const removedReferences = [
    "pinComposerStore",
    "episodeSelectionStore",
    "watchProvidersAtom",
    "tagFilterAtom",
    "usePinComposerStore",
    "useEpisodeSelectionStore",
    "selectedTagFilterIdsAtom"
  ];
  const references = ["app", "src", "scripts"].flatMap(directory =>
    readdirSync(join(root, directory), { recursive: true, encoding: "utf8" })
      .filter(file => /\.tsx?$/.test(file))
      .map(file => `${directory}/${file.replaceAll("\\", "/")}`)
  ).sort().filter(file => file !== "scripts/unusedStateFilesCleanup.test.ts")
    .flatMap(file => {
      const source = readFileSync(join(root, file), "utf8");
      const matches = removedReferences.filter(reference => source.includes(reference));
      return matches.length ? [{ file, references: matches }] : [];
    });
  assert.deepEqual(references, []);
});

it("83 T-3: state files in use are kept", () => {
  const files = [
    "src/atoms/pinFormAtom.ts",
    "src/atoms/spoilerAtom.ts",
    "src/stores/appUIStore.ts",
    "src/stores/authStore.ts",
    "src/stores/libraryUiStore.ts",
    "src/stores/listScrollStore.ts",
    "src/stores/pinsUiStore.ts",
    "src/stores/recommendationUiStore.ts",
    "src/stores/searchHistoryStore.ts",
    "src/stores/searchUiStore.ts"
  ];
  assert.deepEqual(
    files.map(file => [file, existsSync(join(root, file))]),
    files.map(file => [file, true])
  );
});

it("83 T-4: current guidance docs no longer name the removed files", () => {
  const names = ["pinComposerStore", "episodeSelectionStore", "watchProvidersAtom", "tagFilterAtom"];
  const references = ["docs/08_frontend_architecture.md", "docs/04_architecture.md", "AGENTS.md"]
    .flatMap(file => {
      const source = readFileSync(join(root, file), "utf8");
      const matches = names.filter(name => source.includes(name));
      return matches.length ? [{ file, references: matches }] : [];
    });
  assert.deepEqual(references, []);
});
