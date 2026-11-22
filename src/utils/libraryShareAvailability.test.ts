import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

import * as management from "./libraryShareManagement";
import * as shareUrl from "./libraryShareUrl";

it("90 T-1: share links need a usable origin", () => {
  const cases = [
    [{ platform: "web" }, true],
    [{ platform: "web", configuredOrigin: null }, true],
    [{ platform: "web", configuredOrigin: "https://share.example.com" }, true],
    [{ platform: "web", configuredOrigin: "not a url" }, false],
    [{ platform: "ios" }, false],
    [{ platform: "android", configuredOrigin: null }, false],
    [{ platform: "ios", configuredOrigin: "  " }, false],
    [{ platform: "ios", configuredOrigin: "https://share.example.com/" }, true],
    [{ platform: "ios", configuredOrigin: "http://example.com" }, false],
    [{ platform: "android", configuredOrigin: "https://localhost" }, false],
    [{ platform: "ios", configuredOrigin: "https://share.example.com/path" }, false]
  ] as const;
  for (const [input, expected] of cases) {
    assert.equal(shareUrl.canBuildLibraryShareUrl(input), expected, JSON.stringify(input));
  }
});

it("90 T-2: stopping reports only a real deletion", () => {
  assert.equal(management.resolveLibraryShareStop({ deletedCount: 1, stillExists: false }), "stopped");
  assert.equal(management.resolveLibraryShareStop({ deletedCount: 1, stillExists: true }), "stopped");
  assert.equal(management.resolveLibraryShareStop({ deletedCount: 0, stillExists: false }), "already_gone");
  assert.equal(management.resolveLibraryShareStop({ deletedCount: 0, stillExists: true }), "denied");
});

it("90 T-3: app-only copy is fixed", () => {
  assert.deepEqual(management.LIBRARY_SHARE_APP_ONLY_COPY, {
    resendUnavailable: "앱에서는 아직 링크를 보낼 수 없어요. 공유 중지는 여기서 할 수 있어요.",
    emptyDescription: "공유 링크는 웹에서 만들 수 있어요."
  });
  assert.deepEqual(Object.keys(management.LIBRARY_SHARE_MANAGEMENT_COPY).sort(), [
    "copied", "createdHint", "description", "emptyAction", "emptyDescription", "emptyTitle",
    "loadFailed", "resend", "resendFailed", "screenTitle", "stop", "stopFailed", "stopped",
    "stopping", "tooManyNote"
  ]);
});

it("90 T-4: the profile entry shows only when there is something to do", () => {
  for (const linksAvailable of [false, true]) {
    for (const count of [null, 0, 2]) {
      assert.equal(management.shouldShowLibrarySharesEntry({ featureEnabled: false, linksAvailable, count }), false);
    }
  }
  const cases = [[true, null, true], [false, null, false], [false, 0, false], [false, 2, true]] as const;
  for (const [linksAvailable, count, expected] of cases) {
    assert.equal(management.shouldShowLibrarySharesEntry({ featureEnabled: true, linksAvailable, count }), expected);
  }
});

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

it("90 T-5: entry points and stop check are wired", () => {
  const library = readSource("app/(tabs)/library.tsx");
  assert.equal((library.match(/\{\s*SHARE_FEATURES_ENABLED\s*\?\s*\(\s*<Pressable\b/g) ?? []).length, 0,
    "share buttons must check the configured origin");
  assert.ok((library.match(/SHARE_FEATURES_ENABLED\s*&&\s*LIBRARY_SHARE_LINKS_AVAILABLE/g) ?? []).length >= 2,
    "both library toolbars need the availability check");

  const settings = readSource("app/settings/library-shares.tsx");
  for (const marker of ["LIBRARY_SHARE_LINKS_AVAILABLE", "LIBRARY_SHARE_APP_ONLY_COPY.resendUnavailable", "LIBRARY_SHARE_APP_ONLY_COPY.emptyDescription"]) {
    assert.ok(settings.includes(marker), marker);
  }
  assert.ok(readSource("app/(tabs)/profile.tsx").includes("shouldShowLibrarySharesEntry("));
  const service = readSource("src/services/libraryShare.ts");
  assert.ok(service.includes("export const LIBRARY_SHARE_LINKS_AVAILABLE = canBuildLibraryShareUrl("));
  const deleteBody = service.split("export async function deleteLibraryShare(")[1]?.split("\n}")[0] ?? "";
  assert.ok(deleteBody.includes(".maybeSingle()"), "missing existence check after zero deleted rows");
  assert.ok(deleteBody.includes("resolveLibraryShareStop("), "missing stop outcome check");
});
