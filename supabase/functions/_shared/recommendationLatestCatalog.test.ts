import assert from "node:assert/strict";
import { test } from "node:test";
import {
  scanLatestRecommendationCatalog,
  createLatestRecommendationStreams,
  type LatestRecommendationFetcher
} from "./recommendationLatestCatalog.ts";
import type { RecommendationCandidate } from "./recommendationEngine.ts";

const now = "2026-11-15T03:00:00.000Z";
const candidate = (id: string, date: string): RecommendationCandidate => ({
  external_source: "anilist",
  external_id: id,
  content_type: "anime",
  title_primary: `작품 ${id}`,
  air_year: Number(date.slice(0, 4)),
  air_date: date,
  genres: ["Action"],
  popularity: 20,
  countries: ["JP"]
});
const base = {
  mediaType: "all" as const,
  now,
  minimumMonth: "2026-11",
  maxProviderRoundsPerRequest: 20
};

function fixtures(pages: Record<string, RecommendationCandidate[][]>) {
  const calls: string[] = [];
  const fetcher: LatestRecommendationFetcher<RecommendationCandidate> = async (request) => {
    const key = `${request.provider}:${request.lane ?? "base"}:${request.month}`;
    calls.push(`${key}:${request.page}`);
    const list = pages[key] ?? [];
    return { items: list[request.page - 1] ?? [], hasMore: request.page < list.length };
  };
  return { fetcher, calls };
}

test("LC-1 merges each provider's next page before consuming another provider's older head", async () => {
  const { fetcher } = fixtures({
    "tmdb_kr:native:2026-11": [[candidate("a", "2026-11-15")], [candidate("b", "2026-11-14")]],
    "anilist:base:2026-11": [[candidate("c", "2026-11-13")]]
  });
  const result = await scanLatestRecommendationCatalog(fetcher, base);
  assert.deepEqual(
    result.items.map((item) => item.external_id),
    ["a", "b", "c"]
  );
  assert.equal(result.hasMore, false);
});

test("LC-2 keeps unreturned provider offsets across twelve-card boundaries", async () => {
  const values = Array.from({ length: 15 }, (_, index) =>
    candidate(String(index + 1), `2026-11-${String(15 - index).padStart(2, "0")}`)
  );
  const { fetcher } = fixtures({ "anilist:base:2026-11": [values] });
  const first = await scanLatestRecommendationCatalog(fetcher, { ...base, mediaType: "anime" });
  assert.equal(first.items.length, 12);
  assert.equal(first.hasMore, true);
  assert.match(first.nextCursor!, /^lc1\./);
  const second = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    cursor: first.nextCursor
  });
  assert.deepEqual(
    second.items.map((item) => item.external_id),
    ["13", "14", "15"]
  );
  assert.equal(second.hasMore, false);
});

test("LC-3 exhausts the current month before fetching the previous month", async () => {
  const { fetcher, calls } = fixtures({
    "anilist:base:2026-11": [[candidate("n", "2026-11-01")]],
    "anilist:base:2026-10": [[candidate("o", "2026-10-31")]]
  });
  const result = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    minimumMonth: "2026-10"
  });
  assert.deepEqual(
    result.items.map((item) => item.external_id),
    ["n", "o"]
  );
  assert.deepEqual(calls, ["anilist:base:2026-11:1", "anilist:base:2026-10:1"]);
});

test("LC-4 a source failure blocks older heads and preserves its exact cursor for retry", async () => {
  let failed = true;
  const fetcher: LatestRecommendationFetcher<RecommendationCandidate> = async (request) => {
    if (request.provider === "tmdb_kr" && failed) throw new Error("provider down");
    return {
      items: request.provider === "anilist" ? [candidate("old", "2026-11-01")] : [],
      hasMore: false
    };
  };
  const first = await scanLatestRecommendationCatalog(fetcher, base);
  assert.equal(first.items.length, 0);
  assert.equal(first.hasMore, true);
  assert.equal(first.providersBlocked, true);
  failed = false;
  const next = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    cursor: first.nextCursor
  });
  assert.deepEqual(
    next.items.map((item) => item.external_id),
    ["old"]
  );
});

test("LC-5 verifies only the newest head, and a deferred head never loses its offset", async () => {
  const { fetcher } = fixtures({
    "anilist:base:2026-11": [[candidate("new", "2026-11-15"), candidate("old", "2026-11-01")]]
  });
  const verified: string[] = [];
  const first = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    verifyCandidate: async (value) => {
      verified.push(value.external_id);
      return { candidate: value, pending: true };
    }
  });
  assert.deepEqual(verified, ["new"]);
  assert.equal(first.items.length, 0);
  assert.equal(first.hasMore, true);
  const next = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    cursor: first.nextCursor,
    verifyCandidate: async (value) => ({ candidate: value, pending: false })
  });
  assert.deepEqual(
    next.items.map((item) => item.external_id),
    ["new", "old"]
  );
});

test("LC-6 a scan budget produces a short response with a continuation rather than false exhaustion", async () => {
  const { fetcher } = fixtures({
    "anilist:base:2026-11": [[candidate("a", "2026-11-15")], [candidate("b", "2026-11-14")]]
  });
  const first = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    maxProviderRoundsPerRequest: 1
  });
  assert.deepEqual(
    first.items.map((item) => item.external_id),
    ["a"]
  );
  assert.equal(first.scanBudgetReached, true);
  assert.equal(first.hasMore, true);
  const next = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    cursor: first.nextCursor
  });
  assert.deepEqual(
    next.items.map((item) => item.external_id),
    ["b"]
  );
});

test("LC-7 rejects mixed, mismatched filter/media, corrupt and old-version cursors explicitly", async () => {
  const { fetcher } = fixtures({
    "anilist:base:2026-11": [[candidate("a", "2026-11-15")], [candidate("b", "2026-11-14")]]
  });
  const first = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    limit: 1
  });
  for (const cursor of ["tf1.legacy", "lc2.abc", "lc1.invalid"]) {
    await assert.rejects(
      scanLatestRecommendationCatalog(fetcher, { ...base, cursor }),
      /INVALID_LATEST_RECOMMENDATION_CURSOR/
    );
  }
  await assert.rejects(
    scanLatestRecommendationCatalog(fetcher, { ...base, cursor: first.nextCursor }),
    /INVALID_LATEST_RECOMMENDATION_CURSOR/
  );
  await assert.rejects(
    scanLatestRecommendationCatalog(fetcher, {
      ...base,
      mediaType: "anime",
      discoveryFilters: { countries: ["KR"] },
      cursor: first.nextCursor
    }),
    /INVALID_LATEST_RECOMMENDATION_CURSOR/
  );
});

test("LC-8 rejects wrong-month and future provider pollution without showing it", async () => {
  const { fetcher } = fixtures({
    "anilist:base:2026-11": [
      [
        candidate("pollution", "1981-04-01"),
        candidate("future", "2026-11-16"),
        candidate("valid", "2026-11-10")
      ]
    ]
  });
  const result = await scanLatestRecommendationCatalog(fetcher, { ...base, mediaType: "anime" });
  assert.deepEqual(
    result.items.map((item) => item.external_id),
    ["valid"]
  );
});

test("LC-9 known registration, country and title exclusions do not spend verification requests", async () => {
  const a = candidate("registered", "2026-11-15");
  const { fetcher } = fixtures({
    "anilist:base:2026-11": [
      [
        a,
        { ...candidate("foreign", "2026-11-14"), countries: ["US"] },
        { ...candidate("english", "2026-11-13"), title_primary: "English" },
        candidate("valid", "2026-11-12")
      ]
    ]
  });
  const verified: string[] = [];
  const result = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    discoveryFilters: { countries: ["JP"] },
    excludeIds: ["anilist:registered"],
    verifyCandidate: async (value) => {
      verified.push(value.external_id);
      return { candidate: value, pending: false };
    }
  });
  assert.deepEqual(
    result.items.map((item) => item.external_id),
    ["valid"]
  );
  assert.deepEqual(verified, ["valid"]);
});

test("LC-10 changing the excluded identities does not shift a persisted raw offset", async () => {
  const { fetcher } = fixtures({
    "anilist:base:2026-11": [
      [candidate("a", "2026-11-15"), candidate("b", "2026-11-14"), candidate("c", "2026-11-13")]
    ]
  });
  const first = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    limit: 1
  });
  const second = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    cursor: first.nextCursor,
    excludeIds: ["anilist:a"]
  });
  assert.deepEqual(
    second.items.map((item) => item.external_id),
    ["b", "c"]
  );
});

test("LC-11 applies year bounds and ends only after every selected stream is exhausted", async () => {
  const { fetcher } = fixtures({ "anilist:base:2025-12": [[candidate("dec", "2025-12-31")]] });
  const result = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    discoveryFilters: { year: 2025 },
    maxMonthsPerRequest: 24,
    maxProviderRoundsPerRequest: 40
  });
  assert.deepEqual(
    result.items.map((item) => item.external_id),
    ["dec"]
  );
  assert.equal(result.exhausted, true);
  assert.equal(result.nextCursor, null);
});

test("LC-12 creates distinct inner genre/native/keyword streams and deduplicates explicit-country TV", () => {
  const streams = createLatestRecommendationStreams("all", {
    countries: ["KR", "JP"],
    genres: ["crime", "romance", "comedy"]
  });
  assert.equal(streams.filter((stream) => stream.provider === "tmdb_jp").length, 0);
  assert.deepEqual(
    streams.filter((stream) => stream.provider === "tmdb_kr").map((stream) => stream.lane),
    ["native", "keywords"]
  );
  assert.equal(streams.filter((stream) => stream.provider === "anilist").length, 2);
});

test("LC-13 a newer source page appearing behind the consumed frontier requires a restart", async () => {
  const { fetcher } = fixtures({
    "anilist:base:2026-11": [[candidate("a", "2026-11-10")], [candidate("b", "2026-11-14")]]
  });
  const first = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    limit: 1
  });
  await assert.rejects(
    scanLatestRecommendationCatalog(fetcher, {
      ...base,
      mediaType: "anime",
      cursor: first.nextCursor
    }),
    /INVALID_LATEST_RECOMMENDATION_CURSOR/
  );
});

test("LC-14 a month budget preserves the unvisited month without drawing from an all-year filler", async () => {
  const { fetcher, calls } = fixtures({});
  const result = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    minimumMonth: "2026-01",
    maxMonthsPerRequest: 1
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.hasMore, true);
  assert.equal(result.scanBudgetReached, true);
  assert.equal(calls.length, 1);
});

test("LC-X1 retains independent OR-lane offsets and consumes a lane's newer second page first", async () => {
  const drama = (id: string, date: string, genre: string): RecommendationCandidate => ({
    ...candidate(id, date),
    external_source: "tmdb",
    content_type: "kdrama",
    category: "drama",
    countries: ["KR"],
    genres: [genre]
  });
  const { fetcher, calls } = fixtures({
    "tmdb_kr:native:2026-11": [
      [drama("native-15", "2026-11-15", "Crime")],
      [drama("native-14", "2026-11-14", "Crime")]
    ],
    "tmdb_kr:keywords:2026-11": [
      [drama("keyword-13", "2026-11-13", "Romance"), drama("keyword-12", "2026-11-12", "Romance")]
    ]
  });
  const options = {
    ...base,
    mediaType: "drama" as const,
    discoveryFilters: { countries: ["KR"], genres: ["crime", "romance"] }
  };
  const first = await scanLatestRecommendationCatalog(fetcher, { ...options, limit: 1 });
  assert.deepEqual(
    first.items.map((item) => item.external_id),
    ["native-15"]
  );
  const second = await scanLatestRecommendationCatalog(fetcher, {
    ...options,
    cursor: first.nextCursor
  });
  assert.deepEqual(
    second.items.map((item) => item.external_id),
    ["native-14", "keyword-13", "keyword-12"]
  );
  assert.ok(calls.includes("tmdb_kr:native:2026-11:2"));
  assert.equal(second.hasMore, false);
});

test("LC-X2 preserves a partial batch and the untouched older head when a later source page fails", async () => {
  let failSecondPage = true;
  const fetcher: LatestRecommendationFetcher<RecommendationCandidate> = async (request) => {
    if (request.provider === "tmdb_kr") {
      if (request.page === 2 && failSecondPage) throw new Error("second page unavailable");
      return {
        items: [
          candidate(
            request.page === 1 ? "first-15" : "second-14",
            request.page === 1 ? "2026-11-15" : "2026-11-14"
          )
        ],
        hasMore: request.page === 1
      };
    }
    return {
      items: request.provider === "anilist" ? [candidate("untouched-13", "2026-11-13")] : [],
      hasMore: false
    };
  };
  const first = await scanLatestRecommendationCatalog(fetcher, base);
  assert.deepEqual(
    first.items.map((item) => item.external_id),
    ["first-15"]
  );
  assert.equal(first.providersBlocked, true);
  assert.equal(first.hasMore, true);
  assert.deepEqual(first.failedProviders, ["tmdb_kr"]);
  failSecondPage = false;
  const next = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    cursor: first.nextCursor
  });
  assert.deepEqual(
    next.items.map((item) => item.external_id),
    ["second-14", "untouched-13"]
  );
  assert.equal(next.providersBlocked, false);
  assert.equal(next.hasMore, false);
});

test("LC-X3 a deferred verification at a nonzero raw offset resumes at that exact candidate", async () => {
  const { fetcher } = fixtures({
    "anilist:base:2026-11": [
      [
        candidate("consumed-15", "2026-11-15"),
        candidate("pending-14", "2026-11-14"),
        candidate("tail-13", "2026-11-13")
      ]
    ]
  });
  const first = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    limit: 1
  });
  assert.deepEqual(
    first.items.map((item) => item.external_id),
    ["consumed-15"]
  );
  const verified: string[] = [];
  const pending = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    cursor: first.nextCursor,
    verifyCandidate: async (value) => {
      verified.push(value.external_id);
      return { candidate: value, pending: true };
    }
  });
  assert.deepEqual(verified, ["pending-14"]);
  assert.deepEqual(pending.items, []);
  assert.equal(pending.hasMore, true);
  assert.equal(pending.scanBudgetReached, true);
  const resumed = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    cursor: pending.nextCursor,
    verifyCandidate: async (value) => ({ candidate: value, pending: false })
  });
  assert.deepEqual(
    resumed.items.map((item) => item.external_id),
    ["pending-14", "tail-13"]
  );
  assert.equal(resumed.hasMore, false);
});

test("LC-X4 detects newly inserted latest work in a previously empty completed stream", async () => {
  let inserted = false;
  const fetcher: LatestRecommendationFetcher<RecommendationCandidate> = async (request) => {
    if (request.provider === "tmdb_kr")
      return {
        items: inserted
          ? [
              {
                ...candidate("inserted-15", "2026-11-15"),
                external_source: "tmdb",
                content_type: "kdrama"
              }
            ]
          : [],
        hasMore: false
      };
    if (request.provider === "anilist")
      return {
        items: [
          candidate(
            request.page === 1 ? "first-14" : "second-13",
            request.page === 1 ? "2026-11-14" : "2026-11-13"
          )
        ],
        hasMore: request.page === 1
      };
    return { items: [], hasMore: false };
  };
  const first = await scanLatestRecommendationCatalog(fetcher, { ...base, limit: 1 });
  assert.deepEqual(
    first.items.map((item) => item.external_id),
    ["first-14"]
  );
  inserted = true;
  await assert.rejects(
    scanLatestRecommendationCatalog(fetcher, { ...base, cursor: first.nextCursor }),
    /INVALID_LATEST_RECOMMENDATION_CURSOR/
  );
});

test("LC-15 rejects missing and impossible full dates instead of inventing a monthly release date", async () => {
  const { fetcher } = fixtures({
    "anilist:base:2026-11": [
      [
        { ...candidate("invalid", "2026-11-31"), release_month: 11 } as RecommendationCandidate,
        {
          ...candidate("missing", "2026-11-01"),
          air_date: null,
          release_month: 11
        } as RecommendationCandidate,
        candidate("valid", "2026-11-01")
      ]
    ]
  });
  assert.deepEqual(
    (await scanLatestRecommendationCatalog(fetcher, { ...base, mediaType: "anime" })).items.map(
      (item) => item.external_id
    ),
    ["valid"]
  );
});

test("LC-16 explicit discovery media selection takes precedence over the legacy media argument", async () => {
  const value = { ...candidate("drama", "2026-11-15"), content_type: "jdrama" as const };
  const { fetcher } = fixtures({ "tmdb_jp:native:2026-11": [[value]] });
  const result = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    discoveryFilters: { mediaTypes: ["drama"], countries: ["JP"] }
  });
  assert.deepEqual(
    result.items.map((item) => item.external_id),
    ["drama"]
  );
  assert(
    createLatestRecommendationStreams("anime", { mediaTypes: [] }).some(
      (stream) => stream.provider === "tmdb_movie"
    )
  );
});

test("LC-17 a page insertion before its saved raw offset explicitly expires the cursor", async () => {
  let values = [candidate("a", "2026-11-15"), candidate("b", "2026-11-14")];
  const fetcher: LatestRecommendationFetcher<RecommendationCandidate> = async () => ({
    items: values,
    hasMore: false
  });
  const first = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    limit: 1
  });
  values = [candidate("new", "2026-11-15"), ...values];
  await assert.rejects(
    scanLatestRecommendationCatalog(fetcher, {
      ...base,
      mediaType: "anime",
      cursor: first.nextCursor
    }),
    /INVALID_LATEST_RECOMMENDATION_CURSOR/
  );
});

test("LC-18 binds a continuation to its requesting account context", async () => {
  const { fetcher } = fixtures({
    "anilist:base:2026-11": [[candidate("a", "2026-11-15"), candidate("b", "2026-11-14")]]
  });
  const first = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    limit: 1,
    scopeKey: "account-a"
  });
  await assert.rejects(
    scanLatestRecommendationCatalog(fetcher, {
      ...base,
      mediaType: "anime",
      cursor: first.nextCursor,
      scopeKey: "account-b"
    }),
    /INVALID_LATEST_RECOMMENDATION_CURSOR/
  );
});

test("LC-19 a PostgreSQL JSONB key-order round trip preserves nested page fingerprints", async () => {
  const rows = ["jsonb-a", "jsonb-b"].map((id, index) => ({
    ...candidate(id, index === 0 ? "2026-11-15" : "2026-11-14"),
    external_ids: { anilist: id, tmdb: `tmdb-${id}` },
    source_tags: [{ name: "School", source: "anilist", rank: 90 }],
    themes: [
      {
        family: "tone" as const,
        key: "dark",
        label: "어두운",
        centrality: 1,
        source: "anilist",
        source_key: "dark"
      }
    ]
  }));
  let fromJsonb = false;
  const reorder = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(reorder)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([key, entry]) => [key, reorder(entry)])
          )
        : value;
  const fetcher: LatestRecommendationFetcher<RecommendationCandidate> = async () => ({
    items: (fromJsonb ? reorder(rows) : rows) as RecommendationCandidate[],
    hasMore: false
  });
  const first = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    limit: 1
  });
  assert.deepEqual(
    first.items.map((item) => item.external_id),
    ["jsonb-a"]
  );
  fromJsonb = true;
  const resumed = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    cursor: first.nextCursor
  });
  assert.deepEqual(
    resumed.items.map((item) => item.external_id),
    ["jsonb-b"]
  );
  assert.equal(resumed.exhausted, true);
});

test("LC-20 canonical fingerprint still rejects a real nested filter-evidence change", async () => {
  let rows = ["evidence-a", "evidence-b"].map((id, index) => ({
    ...candidate(id, index === 0 ? "2026-11-15" : "2026-11-14"),
    external_ids: { anilist: id, tmdb: `tmdb-${id}` },
    source_tags: [{ name: "School", source: "anilist", rank: 90 }]
  }));
  const fetcher: LatestRecommendationFetcher<RecommendationCandidate> = async () => ({
    items: rows,
    hasMore: false
  });
  const first = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    limit: 1
  });
  rows = rows.map((row) => ({
    ...row,
    source_tags: [{ name: "Boys' Love", source: "anilist", rank: 90 }]
  }));
  await assert.rejects(
    scanLatestRecommendationCatalog(fetcher, {
      ...base,
      mediaType: "anime",
      cursor: first.nextCursor
    }),
    /INVALID_LATEST_RECOMMENDATION_CURSOR/
  );
});

test("LC-21 a cursor from the former key-order fingerprint policy explicitly requires a restart", async () => {
  const { fetcher } = fixtures({
    "anilist:base:2026-11": [[candidate("a", "2026-11-15"), candidate("b", "2026-11-14")]]
  });
  const first = await scanLatestRecommendationCatalog(fetcher, {
    ...base,
    mediaType: "anime",
    limit: 1
  });
  const state = JSON.parse(Buffer.from(first.nextCursor!.slice(4), "base64url").toString("utf8"));
  delete state.fingerprintPolicy;
  const cursor = "lc1." + Buffer.from(JSON.stringify(state)).toString("base64url");
  await assert.rejects(
    scanLatestRecommendationCatalog(fetcher, { ...base, mediaType: "anime", cursor }),
    /INVALID_LATEST_RECOMMENDATION_CURSOR/
  );
});
