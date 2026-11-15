import assert from "node:assert/strict";
import { it } from "node:test";

import { getStoredAniListStaffName, getStoredTmdbPersonProfile, readSavedTmdbPersonProfile, PERSON_PROVIDER_RECHECK_MS } from "./personProviderStore.ts";
import type { PersistentMetadataStore } from "./persistentMetadataCache.ts";

const NOW = Date.parse("2026-11-15T00:00:00Z");
const profile = { id: 76933, name: "사카이 마사토", also_known_as: ["堺雅人"], biography: "Actor",
  combined_credits: { cast: [{ id: 1, media_type: "tv", genre_ids: [18], character: "주인공" }] },
  translations: { translations: [{ iso_639_1: "ja", data: { name: "堺雅人" } }] } };

function fixture() {
  const rows = new Map<string, unknown>();
  const calls: { reads: number; writes: number; requests: { url: string; auth: string | null }[] } = { reads: 0, writes: 0, requests: [] };
  const store: PersistentMetadataStore = {
    async read(key, source) { calls.reads++; return rows.get(JSON.stringify([source, key])) ?? null; },
    async write(key, source, value) { calls.writes++; rows.set(JSON.stringify([source, key]), value); }
  };
  const fetcher: typeof fetch = async (input, init) => {
    calls.requests.push({ url: String(input), auth: new Headers(init?.headers).get("Authorization") });
    return Response.json(profile);
  };
  return { rows, calls, store, fetcher, options: { store, fetcher, apiKey: "fixture", now: () => NOW } };
}

it("PP-1 shares one ko-KR full raw profile across detail, classification, names and credits callers", async () => {
  const { calls, options } = fixture();
  assert.deepEqual(await getStoredTmdbPersonProfile("76933", options), profile);
  for (let index = 0; index < 3; index++) assert.deepEqual(await getStoredTmdbPersonProfile("76933", {
    ...options, apiKey: null, recheckAfterMs: PERSON_PROVIDER_RECHECK_MS
  }), profile);
  assert.equal(calls.requests.length, 1);
  assert.equal(calls.writes, 1);
  const url = new URL(calls.requests[0]!.url);
  assert.equal(url.pathname, "/3/person/76933");
  assert.equal(url.searchParams.get("language"), "ko-KR");
  assert.equal(url.searchParams.get("append_to_response"), "combined_credits,translations");
});

it("PP-2 manual detail reuses an old profile while automatic corrections recheck at exactly 30 days", async () => {
  const { calls, options } = fixture();
  await getStoredTmdbPersonProfile("76933", options);
  await getStoredTmdbPersonProfile("76933", { ...options, now: () => NOW + PERSON_PROVIDER_RECHECK_MS - 1, recheckAfterMs: PERSON_PROVIDER_RECHECK_MS });
  assert.equal(calls.requests.length, 1);
  await getStoredTmdbPersonProfile("76933", { ...options, now: () => NOW + PERSON_PROVIDER_RECHECK_MS * 2 });
  assert.equal(calls.requests.length, 1);
  await getStoredTmdbPersonProfile("76933", { ...options, now: () => NOW + PERSON_PROVIDER_RECHECK_MS, recheckAfterMs: PERSON_PROVIDER_RECHECK_MS });
  assert.equal(calls.requests.length, 2);
});

it("PP-3 an explicit detail refresh replaces the shared raw snapshot even before the recheck date", async () => {
  const { calls, options } = fixture();
  await getStoredTmdbPersonProfile("76933", options);
  const changed = { ...profile, biography: "Updated" };
  assert.deepEqual(await getStoredTmdbPersonProfile("76933", { ...options, forceRefresh: true,
    fetcher: async () => { calls.requests.push({ url: "refresh", auth: null }); return Response.json(changed); } }), changed);
  assert.deepEqual(await getStoredTmdbPersonProfile("76933", options), changed);
  assert.equal(calls.requests.length, 2);
});

it("PP-4 rejects 404, a different person, absent full credits and missing translations without storing them", async () => {
  for (const payload of [null, { ...profile, id: 1 }, { ...profile, combined_credits: undefined },
    { ...profile, translations: undefined }, { ...profile, name: "" }]) {
    const { calls, options } = fixture();
    await assert.rejects(getStoredTmdbPersonProfile("76933", { ...options,
      fetcher: async () => payload === null ? new Response("missing", { status: 404 }) : Response.json(payload) }),
    payload === null ? /HTTP 404/ : /INVALID_METADATA_RESPONSE/);
    assert.equal(calls.writes, 0);
  }
});

it("PP-5 saves a genuine full profile with no cast or translations as valid empty public metadata", async () => {
  const { calls, options } = fixture();
  const empty = { ...profile, combined_credits: { cast: [] }, translations: { translations: [] } };
  await getStoredTmdbPersonProfile("76933", { ...options, fetcher: async () => Response.json(empty) });
  assert.deepEqual(await getStoredTmdbPersonProfile("76933", options), empty);
  assert.equal(calls.requests.length, 0);
  assert.equal(calls.writes, 1);
});

it("PP-6 failed rechecks preserve the old raw profile and never store a transport error as empty", async () => {
  const { rows, calls, options } = fixture();
  await getStoredTmdbPersonProfile("76933", options);
  const before = structuredClone([...rows]);
  await assert.rejects(getStoredTmdbPersonProfile("76933", { ...options, now: () => NOW + PERSON_PROVIDER_RECHECK_MS,
    recheckAfterMs: PERSON_PROVIDER_RECHECK_MS, fetcher: async () => new Response("failure", { status: 503 }) }));
  assert.deepEqual([...rows], before);
  assert.equal(calls.writes, 1);
  assert.deepEqual(await getStoredTmdbPersonProfile("76933", options), profile);
});

it("PP-7 DB failures do not fall back to provider calls, and DB write failure is explicit", async () => {
  const { calls, options } = fixture();
  await assert.rejects(getStoredTmdbPersonProfile("76933", { ...options,
    store: { ...options.store, async read() { throw new Error("DB down"); } } }), /CACHE_READ_FAILED/);
  assert.equal(calls.requests.length, 0);
  await assert.rejects(getStoredTmdbPersonProfile("76933", { ...options,
    store: { ...options.store, async write() { throw new Error("DB full"); } } }), /CACHE_WRITE_FAILED/);
  assert.equal(calls.requests.length, 1);
});

it("PP-8 stores no per-user category or account state and distinguishes person IDs", async () => {
  const { rows, calls, options } = fixture();
  await getStoredTmdbPersonProfile("76933", options);
  await getStoredTmdbPersonProfile("66155", { ...options, fetcher: async () => Response.json({ ...profile, id: 66155 }) });
  assert.equal(rows.size, 2);
  for (const [key, value] of rows) {
    assert.match(key, /person-provider-profile/);
    assert.ok(!key.includes("actor") && !key.includes("user"));
    assert.deepEqual(Object.keys(value as object).sort(), ["profile", "saved_at"]);
  }
  assert.equal(calls.writes, 2);
});

it("PP-9 sends token credentials in a header and refuses missing credentials only on a real cache miss", async () => {
  const { calls, options } = fixture();
  await assert.rejects(getStoredTmdbPersonProfile("76933", { ...options, apiKey: null }), /TMDB_API_KEY/);
  assert.equal(calls.requests.length, 0);
  await getStoredTmdbPersonProfile("76933", { ...options, apiKey: "eyJfixture" });
  assert.equal(calls.requests[0]!.auth, "Bearer eyJfixture");
  assert.equal(new URL(calls.requests[0]!.url).searchParams.has("api_key"), false);
});

it("PP-10 a read-only person peek returns null for a miss and never requests provider data", async () => {
  const { calls, options } = fixture();
  assert.equal(await readSavedTmdbPersonProfile("76933", options), null);
  assert.equal(calls.reads, 1);
  assert.equal(calls.requests.length, 0);
  assert.equal(calls.writes, 0);
});

it("PP-11 a read-only peek returns the shared profile after a correction refresh", async () => {
  const { calls, options } = fixture();
  await getStoredTmdbPersonProfile("76933", options);
  const changed = { ...profile, name: "새 공식 이름", combined_credits: { cast: [] } };
  await getStoredTmdbPersonProfile("76933", { ...options, forceRefresh: true, fetcher: async () => Response.json(changed) });
  assert.deepEqual(await readSavedTmdbPersonProfile("76933", options), changed);
  assert.equal(calls.requests.length, 1);
  assert.equal(calls.writes, 2);
});

it("PP-12 a read-only peek exposes invalid stored data and DB errors without provider fallback", async () => {
  const { rows, calls, options } = fixture();
  await getStoredTmdbPersonProfile("76933", options);
  for (const key of rows.keys()) rows.set(key, { profile: { id: 76933 }, saved_at: new Date(NOW).toISOString() });
  await assert.rejects(readSavedTmdbPersonProfile("76933", options), /INVALID_CACHE_ENTRY/);
  await assert.rejects(readSavedTmdbPersonProfile("76933", { store: {
    ...options.store, async read() { throw new Error("DB down"); }
  } }), /CACHE_READ_FAILED/);
  assert.equal(calls.requests.length, 1);
});

it("PP-13 stores and reuses AniList's public staff-name fields without another GraphQL call", async () => {
  const { calls, options } = fixture();
  const name = { first: "Natsuki", last: "Hanae", full: "Natsuki Hanae", native: "花江夏樹", alternative: ["하나에 나츠키"] };
  let requests = 0;
  const input = { ...options, fetcher: (async (_input, init) => {
    requests++;
    assert.match(JSON.parse(String(init?.body)).query, /Staff/);
    return Response.json({ data: { Staff: { id: 111635, name } } });
  }) as typeof fetch };
  assert.deepEqual(await getStoredAniListStaffName("111635", input), name);
  assert.deepEqual(await getStoredAniListStaffName("111635", input), name);
  assert.equal(requests, 1);
  assert.equal(calls.writes, 1);
});

it("PP-14 rejects AniList HTTP/GraphQL errors, missing staff and malformed names before saving", async () => {
  for (const payload of [null, { errors: [{ message: "rate limited" }] }, { data: { Staff: null } },
    { data: { Staff: { id: 2, name: { full: "other" } } } }, { data: { Staff: { id: 111635, name: null } } }]) {
    const { calls, options } = fixture();
    await assert.rejects(getStoredAniListStaffName("111635", { ...options,
      fetcher: async () => payload === null ? new Response("failure", { status: 429 }) : Response.json(payload) }),
    /HTTP 429|AniList error|INVALID_METADATA_RESPONSE/);
    assert.equal(calls.writes, 0);
  }
});

it("PP-15 AniList automatic names recheck after thirty days and allow manual refresh earlier", async () => {
  const { options } = fixture();
  let requests = 0;
  const input = { ...options, recheckAfterMs: PERSON_PROVIDER_RECHECK_MS,
    fetcher: (async () => { requests++; return Response.json({ data: { Staff: { id: 111635, name: { full: "Natsuki" } } } }); }) as typeof fetch };
  await getStoredAniListStaffName("111635", input);
  await getStoredAniListStaffName("111635", { ...input, now: () => NOW + PERSON_PROVIDER_RECHECK_MS - 1 });
  assert.equal(requests, 1);
  await getStoredAniListStaffName("111635", { ...input, now: () => NOW + PERSON_PROVIDER_RECHECK_MS });
  assert.equal(requests, 2);
  await getStoredAniListStaffName("111635", { ...input, forceRefresh: true });
  assert.equal(requests, 3);
});
