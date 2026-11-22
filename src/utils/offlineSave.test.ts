import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";
import { MutationObserver, onlineManager, QueryClient } from "@tanstack/react-query";

import { queryClient } from "../lib/query";
import { ERROR_COPY } from "./errorCopy";

const src = fileURLToPath(new URL("../", import.meta.url).href);
const offlineMessage = "인터넷 연결 후 다시 저장해 주세요.";

it("89 T-1: offline means a definite false from the device", async () => {
  const { isNetworkOffline } = await import("./networkStatus");
  for (const state of [
    { isConnected: false }, { isInternetReachable: false },
    { isConnected: true, isInternetReachable: false }
  ]) assert.equal(isNetworkOffline(state), true);
  for (const state of [
    { isConnected: true, isInternetReachable: true }, { isConnected: true, isInternetReachable: null },
    { isConnected: null, isInternetReachable: null }, {}, null, undefined
  ]) assert.equal(isNetworkOffline(state), false);
});

it("89 T-2: saves never pause while offline", async () => {
  const defaults = queryClient.getDefaultOptions();
  const client = new QueryClient({ defaultOptions: defaults });
  const networkError = new TypeError("Failed to fetch");
  const failed = new MutationObserver(client, { mutationFn: async () => { throw networkError; } });
  const saved = new MutationObserver(client, { mutationFn: async () => "saved" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  client.mount();
  try {
    onlineManager.setOnline(false);
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("still pending")), 300);
    });
    await Promise.race([
      Promise.all([
        assert.rejects(failed.mutate(), (error) => error === networkError),
        saved.mutate().then((value) => assert.equal(value, "saved"))
      ]),
      deadline
    ]);
    assert.equal(failed.getCurrentResult().isPaused, false);
    assert.equal(saved.getCurrentResult().isPaused, false);
    assert.equal(defaults.mutations?.networkMode, "always");
    assert.equal(defaults.mutations?.retry, 0);
    assert.equal(defaults.queries?.networkMode, undefined);
  } finally {
    clearTimeout(timer);
    onlineManager.setOnline(true);
    client.unmount();
    client.clear();
  }
});

it("89 T-3: review editor and pin composer check offline before saving", () => {
  const editor = readFileSync(join(src, "components/content/ContentReviewEditor.tsx"), "utf8");
  const submit = editor.split("const submit = async () => {")[1]?.split("\n  };")[0] ?? "";
  const guard = /if\s*\(isNetworkOffline\(network\)\)\s*\{\s*setSubmitError\(ERROR_COPY\.offlineSave\);\s*return;\s*\}/;
  const offlineIndex = submit.search(guard);
  const clearErrorIndex = submit.indexOf("setSubmitError(null)");
  assert.ok(clearErrorIndex >= 0 && offlineIndex > clearErrorIndex, "Missing offline guard after clearing the error");
  assert.ok(offlineIndex < submit.indexOf("toIsoWatchDate("));
  assert.ok(offlineIndex < submit.indexOf("saveLock.current = true"));

  const pin = readFileSync(join(src, "components/pins/PinComposer.tsx"), "utf8");
  assert.match(pin, /if\s*\(isNetworkOffline\(network\)\)\s*\{\s*setError\(ERROR_COPY\.offlineSave\);\s*return;\s*\}/);
  const copies = readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .filter((path) => readFileSync(join(src, path), "utf8").includes(offlineMessage));
  assert.deepEqual(copies, [join("utils", "errorCopy.ts")]);
});

it("89 T-4: offline save copy is unchanged", () => {
  assert.equal(ERROR_COPY.offlineSave, offlineMessage);
  assert.deepEqual(Object.keys(ERROR_COPY).sort(), [
    "anchorResolve", "contentLoad", "episodesLoad", "favoritePeopleLoad", "offlineSave",
    "peopleSearch", "personAdd", "personLoad", "pinLoad", "recommendationExclusionLoad",
    "recommendationExclusionSave", "recommendationFeedbackSave", "recommendationLoad", "reviewLoad",
    "searchFilterLoad", "searchFilterSave", "searchLoad", "seasonsLoad", "shareCreate", "shareOpen",
    "watchCountSave"
  ]);
});
