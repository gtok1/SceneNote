import assert from "node:assert/strict";
import { it } from "node:test";

import {
  PersistentMetadataCacheError,
  createPersistentMetadataStore,
  readThroughPersistentMetadata,
  type PersistentMetadataDbClient,
  type PersistentMetadataStore
} from "./persistentMetadataCache.ts";

interface Metadata { title: string; providers: string[]; updated_at: string }
const saved: Metadata = { title: "시즌 3", providers: ["티빙"], updated_at: "2020-01-01T00:00:00Z" };
const fresh: Metadata = { ...saved, providers: ["넷플릭스"], updated_at: "2026-11-15T00:00:00Z" };
function isMetadata(value: unknown): value is Metadata {
  return value !== null && typeof value === "object" && "providers" in value &&
    Array.isArray(value.providers) && "title" in value && typeof value.title === "string" &&
    "updated_at" in value && typeof value.updated_at === "string";
}
function storage() {
  const rows = new Map<string, unknown>();
  const calls = { reads: 0, writes: 0, upstream: 0 };
  const store: PersistentMetadataStore = {
    async read(key, source) { calls.reads++; return rows.get(JSON.stringify([source, key])) ?? null; },
    async write(key, source, value) { calls.writes++; rows.set(JSON.stringify([source, key]), value); }
  };
  return { rows, calls, store };
}
function errorCode(code: string) {
  return (error: unknown) => error instanceof PersistentMetadataCacheError && error.code === code;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

it("PM-1 reads saved metadata regardless of age without an upstream request or rewrite", async () => {
  const { store, calls } = storage();
  await store.write("pm-1", "tmdb", saved);
  const result = await readThroughPersistentMetadata({ key: "pm-1", source: "tmdb", store, isValid: isMetadata,
    async fetchFresh() { calls.upstream++; return fresh; } });
  assert.deepEqual(result, { data: saved, fromCache: true });
  assert.deepEqual(calls, { reads: 1, writes: 1, upstream: 0 });
});

it("PM-2 saves the first lookup before returning and reuses it from a cold caller", async () => {
  const { store, calls } = storage();
  const input = { key: "pm-2", source: "anilist", store, isValid: isMetadata,
    async fetchFresh() { calls.upstream++; return fresh; } };
  assert.deepEqual(await readThroughPersistentMetadata(input), { data: fresh, fromCache: false });
  assert.deepEqual(await readThroughPersistentMetadata({ ...input }), { data: fresh, fromCache: true });
  assert.deepEqual(calls, { reads: 2, writes: 1, upstream: 1 });
});

it("PM-3 persists valid empty and unknown metadata instead of repeatedly looking it up", async () => {
  const { store, calls } = storage();
  const unknown = { ...saved, providers: [] };
  const input = { key: "pm-3", source: "tmdb", store, isValid: isMetadata,
    async fetchFresh() { calls.upstream++; return unknown; } };
  await readThroughPersistentMetadata(input);
  assert.deepEqual(await readThroughPersistentMetadata(input), { data: unknown, fromCache: true });
  assert.equal(calls.upstream, 1);
});

it("PM-4 bypasses saved values only for an explicit refresh and replaces them after success", async () => {
  const { store, calls } = storage();
  await store.write("pm-4", "tmdb", saved);
  const input = { key: "pm-4", source: "tmdb", store, isValid: isMetadata,
    async fetchFresh() { calls.upstream++; return fresh; } };
  assert.deepEqual(await readThroughPersistentMetadata({ ...input, forceRefresh: true }), { data: fresh, fromCache: false });
  assert.equal(calls.reads, 0);
  assert.deepEqual(await readThroughPersistentMetadata(input), { data: fresh, fromCache: true });
  assert.equal(calls.upstream, 1);
});

it("PM-5 reports DB read failure without converting it into a paid upstream cache miss", async () => {
  let upstream = 0;
  await assert.rejects(readThroughPersistentMetadata({ key: "pm-5", source: "tmdb", isValid: isMetadata,
    store: { async read() { throw new Error("DB down"); }, async write() { assert.fail("write"); } },
    async fetchFresh() { upstream++; return fresh; } }), errorCode("CACHE_READ_FAILED"));
  assert.equal(upstream, 0);
});

it("PM-6 reports a failed save and leaves the previous saved value available", async () => {
  const { store } = storage();
  await store.write("pm-6", "tmdb", saved);
  await assert.rejects(readThroughPersistentMetadata({ key: "pm-6", source: "tmdb", forceRefresh: true,
    isValid: isMetadata, store: { ...store, async write() { throw new Error("write rejected"); } },
    async fetchFresh() { return fresh; } }), errorCode("CACHE_WRITE_FAILED"));
  assert.deepEqual(await store.read("pm-6", "tmdb"), saved);
});

it("PM-7 a provider failure never overwrites an existing success with an empty result", async () => {
  const { store, calls } = storage();
  await store.write("pm-7", "tmdb", saved);
  const failure = new Error("provider unavailable");
  await assert.rejects(readThroughPersistentMetadata({ key: "pm-7", source: "tmdb", forceRefresh: true,
    isValid: isMetadata, store, async fetchFresh() { throw failure; } }), error => error === failure);
  assert.equal(calls.writes, 1);
  assert.deepEqual(await store.read("pm-7", "tmdb"), saved);
});

it("PM-8 rejects malformed or legacy saved metadata without automatic upstream lookup", async () => {
  const { store, calls } = storage();
  await store.write("pm-8", "tmdb", { providers: "invalid" });
  await assert.rejects(readThroughPersistentMetadata({ key: "pm-8", source: "tmdb", store, isValid: isMetadata,
    async fetchFresh() { calls.upstream++; return fresh; } }), errorCode("INVALID_CACHE_ENTRY"));
  assert.equal(calls.upstream, 0);
});

it("PM-9 rejects malformed fresh metadata before writing and allows a later explicit retry", async () => {
  const { store, calls } = storage();
  await assert.rejects(readThroughPersistentMetadata({ key: "pm-9", source: "tmdb", store, isValid: isMetadata,
    async fetchFresh() { return { providers: "invalid" } as unknown as Metadata; } }), errorCode("INVALID_METADATA_RESPONSE"));
  assert.equal(calls.writes, 0);
  assert.deepEqual(await readThroughPersistentMetadata({ key: "pm-9", source: "tmdb", store, isValid: isMetadata,
    forceRefresh: true, async fetchFresh() { return fresh; } }), { data: fresh, fromCache: false });
});

it("PM-10 separates source, content type, season and schema-version keys", async () => {
  const { store, calls } = storage();
  for (const [source, key] of [["tmdb", "v1:tv:1"], ["anilist", "v1:tv:1"], ["tmdb", "v1:movie:1"],
    ["tmdb", "v1:tv:2"], ["tmdb", "v2:tv:1"]]) {
    const result = await readThroughPersistentMetadata({ key: key!, source: source!, store, isValid: isMetadata,
      async fetchFresh() { calls.upstream++; return fresh; } });
    assert.equal(result.fromCache, false);
  }
  assert.equal(calls.upstream, 5);
  assert.equal(calls.writes, 5);
});

it("PM-11 coalesces concurrent same-key misses in one isolate until the value is saved", async () => {
  const { store, calls } = storage();
  const response = deferred<Metadata>();
  const started = deferred<void>();
  const input = { key: "pm-11", source: "tmdb", store, isValid: isMetadata,
    async fetchFresh() { calls.upstream++; started.resolve(); return response.promise; } };
  const first = readThroughPersistentMetadata(input);
  await started.promise;
  const second = readThroughPersistentMetadata(input);
  const refresh = readThroughPersistentMetadata({ ...input, forceRefresh: true });
  response.resolve(fresh);
  const results = await Promise.all([first, second, refresh]);
  assert.ok(results.every(result => result.data === fresh));
  assert.equal(calls.upstream, 1);
  assert.equal(calls.writes, 1);
});

it("PM-12 never coalesces different identities or sources", async () => {
  const { store, calls } = storage();
  const response = deferred<Metadata>();
  const input = { key: "pm-12", source: "tmdb", store, isValid: isMetadata, forceRefresh: true,
    async fetchFresh() { calls.upstream++; return response.promise; } };
  const jobs = [readThroughPersistentMetadata(input), readThroughPersistentMetadata({ ...input, source: "anilist" }),
    readThroughPersistentMetadata({ ...input, key: "pm-12-season-2" })];
  response.resolve(fresh);
  await Promise.all(jobs);
  assert.equal(calls.upstream, 3);
  assert.equal(calls.writes, 3);
});

it("PM-13 clears a failed in-flight lookup so a user can explicitly retry", async () => {
  const { store, calls } = storage();
  const input = { key: "pm-13", source: "tmdb", store, isValid: isMetadata, forceRefresh: true,
    async fetchFresh() { calls.upstream++; if (calls.upstream === 1) throw new Error("offline"); return fresh; } };
  await assert.rejects(readThroughPersistentMetadata(input), /offline/);
  assert.deepEqual(await readThroughPersistentMetadata(input), { data: fresh, fromCache: false });
  assert.equal(calls.upstream, 2);
});

it("PM-14 the DB adapter reads only the exact namespace/source and writes non-expiring rows", async () => {
  const seen: unknown[] = [];
  const query = {
    eq(column: string, value: string) { seen.push(["eq", column, value]); return query; },
    async maybeSingle() { return { data: { response_json: saved }, error: null }; }
  };
  const client: PersistentMetadataDbClient = {
    from(table) {
      seen.push(["from", table]);
      return {
        select(columns) { seen.push(["select", columns]); return query; },
        async upsert(row, options) { seen.push(["upsert", row, options]); return { error: null }; }
      };
    }
  };
  const store = createPersistentMetadataStore(client);
  assert.deepEqual(await store.read("watch:v3:season-3", "anilist"), saved);
  await store.write("watch:v3:season-3", "anilist", fresh);
  assert.deepEqual(seen, [
    ["from", "external_search_cache"], ["select", "response_json"],
    ["eq", "query_hash", "watch:v3:season-3"], ["eq", "source", "anilist"],
    ["from", "external_search_cache"],
    ["upsert", { query_hash: "watch:v3:season-3", query_text: "watch:v3:season-3", source: "anilist",
      response_json: fresh, expires_at: "infinity" }, { onConflict: "query_hash,source" }]
  ]);
});

it("PM-15 the DB adapter reports read and write errors without swallowing them", async () => {
  const failure = new Error("database unavailable");
  const query = {
    eq() { return query; },
    async maybeSingle() { return { data: null, error: failure }; }
  };
  const store = createPersistentMetadataStore({
    from() { return { select() { return query; }, async upsert() { return { error: failure }; } }; }
  });
  await assert.rejects(store.read("error", "tmdb"), error => error === failure);
  await assert.rejects(store.write("error", "tmdb", fresh), error => error === failure);
});
