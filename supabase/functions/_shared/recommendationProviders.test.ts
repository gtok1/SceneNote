import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  enrichTmdbRecommendationCandidates,
  fetchRecommendationProviderPage,
  findTmdbKoreanAnimeLocalization,
  TMDB_RECOMMENDATION_KEYWORD_LOOKUP_LIMIT,
  type AniListMedia,
  type TmdbKeywordCandidate,
  type TmdbTvItem
} from "./recommendationProviders.ts";
import { hasExcludedTheme } from "./recommendationThemes.ts";
import { createRecommendationIdentityAliases } from "./recommendationEngine.ts";
import { filterRecommendationsForUser, isRecommendationExcludedForUser } from "./recommendationUserFilters.ts";
import type { RecommendationCache } from "./recommendationCache.ts";

const anime: AniListMedia = {
  id: 1,
  title: {
    english: "Smoking Behind the Supermarket with You",
    romaji: "Super no Ura de Yani Suu Futari",
    native: "スーパーの裏でヤニ吸うふたり"
  },
  startDate: { year: 2026, month: 7, day: 9 }
};

describe("Korean anime metadata matching", () => {
  it("matches a monthly TMDB Korean row by the exact AniList original title", () => {
    const match = findTmdbKoreanAnimeLocalization(anime, [
      tmdb({ id: 10, name: "외국어 제목", original_name: "다른 작품", first_air_date: "2026-07-01" }),
      tmdb({
        id: 20,
        name: "슈퍼 뒤에서 담배 피우는 두 사람",
        original_name: "スーパーの裏でヤニ吸うふたり",
        overview: "회사원 사사키가 슈퍼 뒤편에서 야니와 담배를 피우며 벌어지는 이야기.",
        first_air_date: "2026-07-09"
      })
    ]);

    assert.equal(match?.id, 20);
    assert.equal(match?.name, "슈퍼 뒤에서 담배 피우는 두 사람");
  });

  it("ignores rows without a Korean title and unrelated release years", () => {
    assert.equal(
      findTmdbKoreanAnimeLocalization(anime, [
        tmdb({ name: "Smoking Behind the Supermarket with You", original_name: "スーパーの裏でヤニ吸うふたり" }),
        tmdb({ name: "슈퍼 뒤에서 담배 피우는 두 사람", original_name: "スーパーの裏でヤニ吸うふたり", first_air_date: "2022-07-09" })
      ]),
      null
    );
  });
});

function tmdb(overrides: Partial<TmdbTvItem>): TmdbTvItem {
  return {
    id: 1,
    name: null,
    original_name: null,
    first_air_date: "2026-07-01",
    ...overrides
  };
}

describe("TMDB authentication request construction", () => {
  for (const credentialKind of ["v3", "bearer"] as const) {
    it(`authenticates drama, movie and anime localization before serializing the URL (${credentialKind})`, async () => {
      const { fetchRecommendationProviderPage } = await import("./recommendationProviders.ts");
      const originalFetch = globalThis.fetch;
      const originalDeno = Object.getOwnPropertyDescriptor(globalThis, "Deno");
      const credential = credentialKind === "v3" ? "test-only-v3-key" : "eyJ.test.signature";
      Object.defineProperty(globalThis, "Deno", { configurable: true, value: { env: { get: (key: string) => key === "TMDB_API_KEY" ? credential : undefined } } });
      let authenticatedRequests = 0;
      globalThis.fetch = async (input, init) => {
        const url = new URL(String(input));
        if (url.hostname === "api.themoviedb.org") {
          const headers = new Headers(init?.headers);
          if (credentialKind === "v3") {
            assert.equal(url.searchParams.get("api_key"), credential);
            assert.equal(headers.has("Authorization"), false);
          } else {
            assert.equal(headers.get("Authorization"), `Bearer ${credential}`);
            assert.equal(url.searchParams.has("api_key"), false);
          }
          authenticatedRequests += 1;
          return new Response(JSON.stringify({results:[],total_pages:0}), {status:200});
        }
        assert.equal(url.hostname, "graphql.anilist.co");
        return new Response(JSON.stringify({data:{Page:{pageInfo:{hasNextPage:false},media:[]}}}), {status:200});
      };
      try {
        const month = credentialKind === "v3" ? "2025-02" : "2025-03";
        for (const provider of ["tmdb_kr", "tmdb_jp", "tmdb_movie", "anilist"] as const) {
          await fetchRecommendationProviderPage({provider,month,asOfDate:`${month}-20`,page:1});
        }
        assert.equal(authenticatedRequests, 4); // KR, JP, movie and the sole available localization page.
      } finally {
        globalThis.fetch = originalFetch;
        if (originalDeno) Object.defineProperty(globalThis,"Deno",originalDeno);
        else Reflect.deleteProperty(globalThis,"Deno");
      }
    });
  }
});

describe("recommendation provider query and persistent cache", () => {
  it("sends user genre and theme exclusions before requesting provider candidates", async () => {
    const requests: string[] = [];
    await withMockProviderFetch(async (input, init) => {
      const url = new URL(String(input));
      requests.push(url.toString());
      if (url.hostname === "graphql.anilist.co") {
        const body = JSON.parse(String(init?.body));
        assert.deepEqual(body.variables.excludedGenres, ["Comedy", "Romance"]);
        assert.deepEqual(body.variables.excludedTags, ["Boys' Love", "LGBTQ+ Themes", "Yuri"]);
        assert.match(body.query, /genre_not_in: \$excludedGenres/);
        assert.match(body.query, /tag_not_in: \$excludedTags/);
        assert.match(body.query, /minimumTagRank: 0/);
        return animePageResponse();
      }
      if (url.searchParams.get("with_genres") !== "16") {
        assert.equal(url.searchParams.get("without_keywords"), "280003,289844");
        assert.equal(url.searchParams.get("without_genres"),
          url.pathname.endsWith("/movie") ? "35,10749" : "16,35,10749");
      } else {
        // Korean title localization is reusable public metadata, not a ranked feed.
        assert.equal(url.searchParams.has("without_keywords"), false);
      }
      return new Response(JSON.stringify({ results: [], total_pages: 0 }));
    }, async () => {
      const filters = { excludedGenres: ["romance", "comedy"], excludedThemeKeys: ["boys-love", "girls-love", "queer-romance"] };
      for (const provider of ["tmdb_kr", "tmdb_movie", "anilist"] as const) {
        await fetchRecommendationProviderPage({ provider, month: "2024-01", page: 1, asOfDate: "2024-01-20" }, { filters });
      }
      assert.equal(requests.length, 4);
    });
  });

  it("persists shared pages with separate filter keys and reuses equivalent settings", async () => {
    const cache = memoryProviderCache();
    let calls = 0;
    await withMockProviderFetch(async () => {
      calls += 1;
      return new Response(JSON.stringify({ results: [], total_pages: 0 }));
    }, async () => {
      const request = { provider: "tmdb_kr" as const, month: "2024-02", page: 1, asOfDate: "2024-02-20" };
      await fetchRecommendationProviderPage(request, { cache, filters: { excludedGenres: ["romance", "comedy"], excludedThemeKeys: [] } });
      await fetchRecommendationProviderPage(request, { cache, filters: { excludedGenres: ["Comedy", "romance"], excludedThemeKeys: [] } });
      await fetchRecommendationProviderPage(request, { cache });
      assert.equal(calls, 2);
      assert.equal(cache.writes.length, 2);
      assert(cache.writes.every((entry) => entry.source === "tmdb" && entry.ttlMs === 600_000));
      assert.notEqual(cache.writes[0]?.key, cache.writes[1]?.key);
    });
  });

  it("uses a persisted page on a cold in-memory cache without contacting the provider", async () => {
    let calls = 0;
    const storedPage = { items: [], hasMore: true };
    const cache: RecommendationCache = {
      async get<T>(key: string, source: "tmdb" | "anilist") {
        assert.match(key, /^recommendation-provider-v3:tmdb_jp:2024-03:1/);
        assert.equal(source, "tmdb");
        return { page: storedPage, expiresAt: Date.now() + 600_000 } as T;
      },
      async set() { assert.fail("an existing persisted page must not be rewritten"); }
    };
    await withMockProviderFetch(async () => { calls += 1; throw new Error("unexpected upstream call"); }, async () => {
      const page = await fetchRecommendationProviderPage({ provider: "tmdb_jp", month: "2024-03", page: 1, asOfDate: "2024-03-20" }, { cache });
      assert.deepEqual(page, storedPage);
      assert.equal(calls, 0);
    });
  });

  it("does not refetch a recently failed provider and stores only a short failure TTL", async () => {
    const cache = memoryProviderCache();
    let calls = 0;
    await withMockProviderFetch(async () => {
      calls += 1;
      return new Response("unavailable", { status: 503 });
    }, async () => {
      const request = { provider: "tmdb_kr" as const, month: "2024-04", page: 1, asOfDate: "2024-04-20" };
      await assert.rejects(fetchRecommendationProviderPage(request, { cache }), /HTTP 503/);
      await assert.rejects(fetchRecommendationProviderPage(request, { cache }), /HTTP 503/);
      assert.equal(calls, 1);
      assert.equal(cache.writes.length, 1);
      assert.equal(cache.writes[0]?.ttlMs, 60_000);
    });
  });

  it("requests only localization pages that exist, still capped at three", async () => {
    for (const totalPages of [1, 2, 6]) {
      const requested: number[] = [];
      const month = `2023-0${totalPages}`;
      await withMockProviderFetch(async (input) => {
        const url = new URL(String(input));
        if (url.hostname === "graphql.anilist.co") return animePageResponse();
        requested.push(Number(url.searchParams.get("page")));
        return new Response(JSON.stringify({ results: [], total_pages: totalPages }));
      }, async () => {
        await fetchRecommendationProviderPage({ provider: "anilist", month, page: 1, asOfDate: `${month}-20` });
        assert.deepEqual(requested, Array.from({ length: Math.min(totalPages, 3) }, (_, index) => index + 1));
      });
    }
  });

  it("reuses persisted Korean localization while fetching a new AniList page", async () => {
    const cache: RecommendationCache = {
      async get<T>(key: string, source: "tmdb" | "anilist") {
        if (!key.startsWith("recommendation-anime-ko-v2:")) return null;
        assert.equal(source, "tmdb");
        return { items: [], expiresAt: Date.now() + 600_000 } as T;
      },
      async set() {}
    };
    let calls = 0;
    await withMockProviderFetch(async (input) => {
      assert.equal(new URL(String(input)).hostname, "graphql.anilist.co");
      calls += 1;
      return animePageResponse();
    }, async () => {
      await fetchRecommendationProviderPage({ provider: "anilist", month: "2024-05", page: 1, asOfDate: "2024-05-20" }, { cache });
      assert.equal(calls, 1);
    });
  });
});

describe("bounded keyword cache miss budget", () => {
  it("retains cached metadata for already-emitted candidates so a warm page keeps stable cursor offsets", async () => {
    const items = keywordCandidates(991800000, 20);
    let calls = 0;
    await withMockProviderFetch(async () => {
      calls += 1;
      return new Response(JSON.stringify({ results: [{ name: "family" }] }));
    }, async () => {
      // Three bounded passes warm all twenty candidates on a single provider page.
      for (let pass = 0; pass < 3; pass += 1) await enrichTmdbRecommendationCandidates(items);
      assert.equal(calls, 20);
      const firstPage = await enrichTmdbRecommendationCandidates(items);
      const emitted = new Set(firstPage.slice(0, 12).map((item) => item.external_id));
      const nextPage = await enrichTmdbRecommendationCandidates(items, (item) => !emitted.has(item.external_id), {
        onDeferred: () => assert.fail("all candidates already have reusable metadata")
      });
      const visible = filterRecommendationsForUser(nextPage, { excludedThemeKeys: ["boys-love"], excludedGenres: [] });
      assert.equal(visible.length, 20);
      assert.deepEqual(visible.slice(12).map((item) => item.external_id), items.slice(12).map((item) => item.external_id));
      assert.equal(calls, 20);
    });
  });

  it("shares a sixteen-request ceiling across provider pages and keeps excess work pending", async () => {
    const items = keywordCandidates(991500000, 20);
    const lookupBudget = { remaining: 16 };
    let calls = 0;
    await withMockProviderFetch(async () => {
      calls += 1;
      return new Response(JSON.stringify({ results: [{ name: "family" }] }));
    }, async () => {
      for (const expectedCalls of [8, 16, 16]) {
        let deferred = 0;
        await enrichTmdbRecommendationCandidates(items, () => true, { lookupBudget, onDeferred: () => { deferred += 1; } });
        assert.equal(calls, expectedCalls);
        assert.equal(deferred, 20 - expectedCalls);
      }
      assert.equal(lookupBudget.remaining, 0);
    });
  });

  it("checks cached keywords across the entire page before spending eight new requests", async () => {
    const cachedIds = new Set(Array.from({ length: 9 }, (_, index) => String(991000000 + index)));
    const writes: number[] = [];
    const cache: RecommendationCache = {
      async get<T>(key: string) {
        const id = key.split(":").at(-1);
        return cachedIds.has(id ?? "") ? { keywords: ["family"], expiresAt: Date.now() + 86_400_000 } as T : null;
      },
      async set(_key, _source, _value, ttlMs) { writes.push(ttlMs); }
    };
    let calls = 0;
    await withMockProviderFetch(async () => {
      calls += 1;
      return new Response(JSON.stringify({ results: [{ name: "school" }] }));
    }, async () => {
      const items = keywordCandidates(991000000, 18);
      const deferred: string[] = [];
      const result = await enrichTmdbRecommendationCandidates(items, () => true, {
        cache, onDeferred: (item) => deferred.push(item.external_id)
      });
      assert.equal(calls, 8);
      assert(result.slice(0, 9).every((item) => item.keywords?.[0] === "family"));
      assert(result.slice(9, 17).every((item) => item.keywords?.[0] === "school"));
      assert.deepEqual(deferred, [items[17]?.external_id]);
      assert(writes.every((ttl) => ttl === 86_400_000));
    });
  });

  it("progresses through an excluded first eight to twelve valid alternatives without rechecking cached works", async () => {
    const items = keywordCandidates(991100000, 20);
    const requests: string[] = [];
    await withMockProviderFetch(async (input) => {
      const id = new URL(String(input)).pathname.split("/").at(-2) ?? "";
      requests.push(id);
      const keyword = Number(id) < 991100008 ? "gay" : "family";
      return new Response(JSON.stringify({ results: [{ name: keyword }] }));
    }, async () => {
      const expectedDeferred = [12, 4, 0];
      const expectedVisible = [0, 8, 12];
      for (let pass = 0; pass < 3; pass += 1) {
        let deferred = 0;
        const result = await enrichTmdbRecommendationCandidates(items, () => true, { onDeferred: () => { deferred += 1; } });
        assert.equal(deferred, expectedDeferred[pass]);
        assert.equal(filterRecommendationsForUser(result, { excludedThemeKeys: ["queer-romance"], excludedGenres: [] }).length, expectedVisible[pass]);
      }
      assert.equal(requests.length, 20);
      assert.equal(new Set(requests).size, 20);
    });
  });

  it("does not spend lookup budget on supplied keywords or duplicate identities", async () => {
    const supplied = keywordCandidates(991200000, 10).map((item, index) => ({ ...item, keywords: index === 0 ? [] : ["family"] }));
    const [newItem] = keywordCandidates(991200020, 1);
    assert(newItem);
    let calls = 0;
    await withMockProviderFetch(async () => {
      calls += 1;
      return new Response(JSON.stringify({ results: [{ name: "school" }] }));
    }, async () => {
      const result = await enrichTmdbRecommendationCandidates([...supplied, newItem, newItem]);
      assert.equal(calls, 1);
      assert.deepEqual(result[0]?.keywords, []);
      assert.deepEqual(result.at(-1)?.keywords, ["school"]);
    });
  });

  it("reuses persisted empty and failed metadata without treating them as deferred new requests", async () => {
    const cache: RecommendationCache = {
      async get<T>(key: string) {
        return { keywords: key.endsWith(":991300000") ? [] : null, expiresAt: Date.now() + 60_000 } as T;
      },
      async set() { assert.fail("cached keyword result should not be rewritten"); }
    };
    await withMockProviderFetch(async () => { throw new Error("unexpected upstream call"); }, async () => {
      const result = await enrichTmdbRecommendationCandidates(keywordCandidates(991300000, 2), () => true, {
        cache, onDeferred: () => assert.fail("cached empty/failure is attempted, not deferred")
      });
      assert.deepEqual(result[0]?.keywords, []);
      assert.equal(result[1]?.keywords, undefined);
      assert.equal(filterRecommendationsForUser(result, { excludedThemeKeys: ["boys-love"], excludedGenres: [] }).length, 0);
    });
  });

  it("keeps failed keyword results briefly to stop repeated external requests", async () => {
    const cache = memoryProviderCache();
    let calls = 0;
    await withMockProviderFetch(async () => {
      calls += 1;
      return new Response("unavailable", { status: 503 });
    }, async () => {
      const items = keywordCandidates(991400000, 1);
      await enrichTmdbRecommendationCandidates(items, () => true, { cache });
      await enrichTmdbRecommendationCandidates(items, () => true, { cache });
      assert.equal(calls, 1);
      assert.equal(cache.writes.length, 1);
      assert.equal(cache.writes[0]?.ttlMs, 60_000);
    });
  });
});

describe("provider deadline bounds", () => {
  it("defers new keyword requests when less than five hundred milliseconds remain", async () => {
    let deferred = 0;
    await withMockProviderFetch(async () => { throw new Error("unexpected upstream call"); }, async () => {
      const items = keywordCandidates(991600000, 2);
      const result = await enrichTmdbRecommendationCandidates(items, () => true, {
        deadlineMs: Date.now() + 100,
        onDeferred: () => { deferred += 1; }
      });
      assert.deepEqual(result, items);
      assert.equal(deferred, 2);
    });
  });

  it("bounds queued keyword waiters and removes expired work without leaking a concurrency slot", async () => {
    let release: () => void = () => {};
    let started: () => void = () => {};
    const blocker = new Promise<void>((resolve) => { release = resolve; });
    const firstStarted = new Promise<void>((resolve) => { started = resolve; });
    let calls = 0;
    await withMockProviderFetch(async () => {
      calls += 1;
      if (calls === 8) started();
      await blocker;
      return new Response(JSON.stringify({ results: [{ name: "family" }] }));
    }, async () => {
      const first = enrichTmdbRecommendationCandidates(keywordCandidates(991700000, 8));
      await firstStarted;
      let deferred = 0;
      try {
        await enrichTmdbRecommendationCandidates(keywordCandidates(991700020, 8), () => true, {
          deadlineMs: Date.now() + 520,
          onDeferred: () => { deferred += 1; }
        });
        assert.equal(calls, 8);
        assert.equal(deferred, 8);
      } finally {
        release();
        await first;
      }
      await enrichTmdbRecommendationCandidates(keywordCandidates(991700020, 8));
      assert.equal(calls, 16);
    });
  });

  it("caps provider fetch time and leaves deadline-aborted pages retryable instead of caching failure", async () => {
    const cache = memoryProviderCache();
    let calls = 0;
    await withMockProviderFetch(async (_input, init) => {
      calls += 1;
      if (calls > 1) return new Response(JSON.stringify({ results: [], total_pages: 0 }));
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("fetch aborted")), { once: true });
      });
    }, async () => {
      const request = { provider: "tmdb_kr" as const, month: "2024-06", page: 1, asOfDate: "2024-06-20" };
      await assert.rejects(fetchRecommendationProviderPage(request, { cache, deadlineMs: Date.now() + 20 }), /RECOMMENDATION_PROVIDER_DEADLINE/);
      assert.equal(cache.writes.length, 0);
      await fetchRecommendationProviderPage(request, { cache });
      assert.equal(calls, 2);
      assert.equal(cache.writes.length, 1);
    });
  });

  it("does not let a stalled persistent cache exceed the provider deadline", async () => {
    const cache: RecommendationCache = {
      async get() { return new Promise(() => {}); },
      async set() { assert.fail("no upstream fetch should start after cache read exhausts deadline"); }
    };
    await withMockProviderFetch(async () => { throw new Error("unexpected upstream call"); }, async () => {
      const request = { provider: "tmdb_jp" as const, month: "2024-07", page: 1, asOfDate: "2024-07-20" };
      await assert.rejects(fetchRecommendationProviderPage(request, { cache, deadlineMs: Date.now() + 20 }), /RECOMMENDATION_PROVIDER_DEADLINE/);
    });
  });
});

function keywordCandidates(firstId: number, count: number): TmdbKeywordCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    external_source: "tmdb", external_id: String(firstId + index), content_type: "kdrama",
    genres: ["Drama"]
  }));
}

function animePageResponse() {
  return new Response(JSON.stringify({ data: { Page: { pageInfo: { hasNextPage: false }, media: [] } } }));
}

function memoryProviderCache() {
  const records = new Map<string, unknown>();
  const writes: { key: string; source: string; ttlMs: number }[] = [];
  const cache: RecommendationCache & { writes: typeof writes } = {
    writes,
    async get<T>(key: string, source: "tmdb" | "anilist") { return records.get(`${source}:${key}`) as T ?? null; },
    async set(key, source, value, ttlMs) {
      writes.push({ key, source, ttlMs });
      records.set(`${source}:${key}`, value);
    }
  };
  return cache;
}

async function withMockProviderFetch(mockFetch: typeof fetch, run: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalDeno = Object.getOwnPropertyDescriptor(globalThis, "Deno");
  globalThis.fetch = mockFetch;
  Object.defineProperty(globalThis, "Deno", {
    configurable: true,
    value: { env: { get: (key: string) => key === "TMDB_API_KEY" ? "test-only-key" : undefined } }
  });
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDeno) Object.defineProperty(globalThis, "Deno", originalDeno);
    else Reflect.deleteProperty(globalThis, "Deno");
  }
}

describe("TMDB recommendation keyword enrichment", () => {
  it("adds structured TV/movie keywords and reuses their cached response", async () => {
    const originalFetch = globalThis.fetch;
    const originalDeno = Object.getOwnPropertyDescriptor(globalThis, "Deno");
    Object.defineProperty(globalThis, "Deno", {
      configurable: true,
      value: { env: { get: (key: string) => key === "TMDB_API_KEY" ? "test-only-key" : undefined } }
    });
    const requested: string[] = [];
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("api_key"), "test-only-key");
      requested.push(url.pathname);
      return new Response(JSON.stringify(url.pathname.includes("/movie/")
        ? { id: 990000002, keywords: [{ name: "family" }] }
        : { id: 990000001, results: [{ name: "gay" }] }), { status: 200 });
    };
    const items = [
      { external_source: "tmdb", external_id: "990000001", content_type: "kdrama", genres: ["Drama"] },
      { external_source: "tmdb", external_id: "990000002", content_type: "movie", genres: ["Romance"] },
      { external_source: "anilist", external_id: "88", content_type: "anime", genres: ["Boys' Love"] }
    ];
    try {
      const enriched = await enrichTmdbRecommendationCandidates(items);
      assert.deepEqual(enriched[0]?.keywords, ["gay"]);
      assert.equal(hasExcludedTheme(enriched[0] ?? {}, ["queer-romance"]), true);
      assert.deepEqual(enriched[1]?.keywords, ["family"]);
      assert.deepEqual(enriched[2], items[2]);
      assert.deepEqual(requested.sort(), ["/3/movie/990000002/keywords", "/3/tv/990000001/keywords"]);
      await enrichTmdbRecommendationCandidates(items);
      assert.equal(requested.length, 2);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalDeno) Object.defineProperty(globalThis, "Deno", originalDeno);
      else Reflect.deleteProperty(globalThis, "Deno");
    }
  });

  it("keeps missing provider metadata unverified for fail-closed filtering", async () => {
    const originalFetch = globalThis.fetch;
    const originalDeno = Object.getOwnPropertyDescriptor(globalThis, "Deno");
    Object.defineProperty(globalThis, "Deno", {
      configurable: true,
      value: { env: { get: (key: string) => key === "TMDB_API_KEY" ? "test-only-key" : undefined } }
    });
    globalThis.fetch = async () => new Response(JSON.stringify({ results: [] }), { status: 200 });
    try {
      const [item] = await enrichTmdbRecommendationCandidates([
        { external_source: "tmdb", external_id: "990000003", content_type: "kdrama", genres: ["Drama"] }
      ]);
      assert.deepEqual(item?.keywords, []);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalDeno) Object.defineProperty(globalThis, "Deno", originalDeno);
      else Reflect.deleteProperty(globalThis, "Deno");
    }
  });

  it("bounds cold keyword requests and leaves overflow candidates unverified", async () => {
    const originalFetch = globalThis.fetch;
    const originalDeno = Object.getOwnPropertyDescriptor(globalThis, "Deno");
    Object.defineProperty(globalThis, "Deno", {
      configurable: true,
      value: { env: { get: (key: string) => key === "TMDB_API_KEY" ? "test-only-key" : undefined } }
    });
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ results: [{ name: "family" }] }), { status: 200 });
    };
    try {
      const items = Array.from({ length: TMDB_RECOMMENDATION_KEYWORD_LOOKUP_LIMIT + 1 }, (_, index) => ({
        external_source: "tmdb",
        external_id: String(990001000 + index),
        content_type: "kdrama",
        genres: ["Drama"]
      }));
      const enriched = await enrichTmdbRecommendationCandidates(items);
      assert.equal(calls, TMDB_RECOMMENDATION_KEYWORD_LOOKUP_LIMIT);
      assert.deepEqual(enriched[0]?.keywords, ["family"]);
      assert.equal(enriched.at(-1)?.keywords, undefined);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalDeno) Object.defineProperty(globalThis, "Deno", originalDeno);
      else Reflect.deleteProperty(globalThis, "Deno");
    }
  });

  it("spends the eight lookups on eligible works after seen, library, feedback, and genre exclusions", async () => {
    const originalFetch = globalThis.fetch;
    const originalDeno = Object.getOwnPropertyDescriptor(globalThis, "Deno");
    Object.defineProperty(globalThis, "Deno", {
      configurable: true,
      value: { env: { get: (key: string) => key === "TMDB_API_KEY" ? "test-only-key" : undefined } }
    });
    const requested: string[] = [];
    globalThis.fetch = async (input) => {
      requested.push(new URL(String(input)).pathname);
      return new Response(JSON.stringify({ results: [{ name: "family" }] }), { status: 200 });
    };
    try {
      const items = Array.from({ length: 17 }, (_, index) => ({
        external_source: "tmdb",
        external_id: String(990002000 + index),
        content_type: "kdrama",
        title_primary: `한국 드라마 ${index}`,
        air_year: 2026,
        genres: index === 6 || index === 7 ? ["Romance"] : ["Drama"]
      }));
      const sessionSeen = items.slice(0, 2).flatMap(createRecommendationIdentityAliases);
      const libraryItems = items.slice(2, 4).map((item) => ({
        source_api: "tmdb",
        source_id: item.external_id,
        content_type: item.content_type,
        title_primary: item.title_primary,
        air_year: item.air_year
      }));
      const feedbackExcluded = items.slice(4, 6).flatMap(createRecommendationIdentityAliases);
      const excluded = new Set([
        ...sessionSeen,
        ...libraryItems.flatMap(createRecommendationIdentityAliases),
        ...feedbackExcluded
      ]);
      const eligibleGenres = filterRecommendationsForUser(items, {
        excludedThemeKeys: [],
        excludedGenres: ["romance"]
      });
      const enriched = await enrichTmdbRecommendationCandidates(
        eligibleGenres,
        (candidate) => createRecommendationIdentityAliases(candidate)
          .every((identity) => !excluded.has(identity))
      );

      assert.equal(requested.length, TMDB_RECOMMENDATION_KEYWORD_LOOKUP_LIMIT);
      assert.deepEqual(requested, items.slice(8, 16).map((item) => `/3/tv/${item.external_id}/keywords`));
      assert.equal(enriched.length, 15);
      assert(enriched.slice(0, 6).every((item) => item.keywords === undefined));
      assert(enriched.slice(6, 14).every((item) => item.keywords?.[0] === "family"));
      assert.equal(enriched[14]?.keywords, undefined);
      assert.equal(isRecommendationExcludedForUser(enriched[14] ?? {}, {
        excludedThemeKeys: ["boys-love"], excludedGenres: []
      }), true);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalDeno) Object.defineProperty(globalThis, "Deno", originalDeno);
      else Reflect.deleteProperty(globalThis, "Deno");
    }
  });
});

describe("positive discovery provider requests", () => {
  it("constrains country and genre upstream, retains international TV identity, and partitions cached pages", async () => {
    const calls: URL[] = [];
    await withPositiveProviderFetch(async (input) => {
      const url = new URL(String(input));
      calls.push(url);
      assert.equal(url.searchParams.get("with_genres"), "80");
      const country = url.searchParams.get("with_origin_country");
      return providerJson({ results: [{ id: country === "US" ? 901 : 902, name: "국제 범죄 작품", first_air_date: "2031-02-01", genre_ids: [18, 80], origin_country: [country] }], total_pages: 1 });
    }, async () => {
      const request = { provider: "tmdb_kr" as const, month: "2031-02", asOfDate: "2031-02-20", page: 1 };
      const us = { discoveryFilters: { genre: "crime", country: "US" } };
      const page = await fetchRecommendationProviderPage(request, us);
      assert.equal(page.items[0]?.content_type, "other");
      assert.equal(page.items[0]?.category, "drama");
      assert.deepEqual(page.items[0]?.countries, ["US"]);
      await fetchRecommendationProviderPage(request, us);
      await fetchRecommendationProviderPage({ ...request, provider: "tmdb_jp" }, us);
      assert.equal(calls.length, 1);
      const cn = await fetchRecommendationProviderPage(request, { discoveryFilters: { genre: "crime", country: "CN" } });
      assert.deepEqual(cn.items[0]?.countries, ["CN"]);
      assert.equal(calls.length, 2);
    });
  });

  it("resolves TV romance by exact provider keyword once, constrains discovery and retains query evidence", async () => {
    let resolutions = 0;
    let discoveries = 0;
    await withPositiveProviderFetch(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/search/keyword")) {
        resolutions += 1;
        assert.equal(url.searchParams.get("query"), "romance");
        assert.equal(url.searchParams.get("api_key"), "positive-tests-key");
        return providerJson({ results: [{ id: 8990, name: "romantic comedy" }, { id: 8991, name: "romance" }] });
      }
      discoveries += 1;
      assert.equal(url.searchParams.get("with_keywords"), "8991");
      const country = url.searchParams.get("with_origin_country");
      return providerJson({ results: [{ id: 9800 + discoveries, name: "조건에 맞는 로맨스", first_air_date: "2031-03-01", genre_ids: [18], origin_country: [country] }], total_pages: 1 });
    }, async () => {
      const request = { provider: "tmdb_kr" as const, month: "2031-03", asOfDate: "2031-03-20", page: 1 };
      const pages = await Promise.all([
        fetchRecommendationProviderPage(request, { discoveryFilters: { genre: "romance", country: "KR" } }),
        fetchRecommendationProviderPage({ ...request, provider: "tmdb_jp" }, { discoveryFilters: { genre: "romance", country: "JP" } })
      ]);
      assert.equal(resolutions, 1);
      assert.equal(discoveries, 2);
      assert(pages.every((page) => page.items[0]?.genres.includes("romance")));
      const excluded = await fetchRecommendationProviderPage(request, {
        discoveryFilters: { genre: "romance", country: "KR" },
        filters: { excludedGenres: ["Romance"], excludedThemeKeys: [] }
      });
      assert.equal(excluded.items.length, 0);
      assert.equal(discoveries, 2);
    });
  });

  it("never falls back to an unfiltered TV request when a genre keyword cannot be verified", async () => {
    let calls = 0;
    await withPositiveProviderFetch(async (input) => {
      calls += 1;
      assert(new URL(String(input)).pathname.endsWith("/search/keyword"));
      return providerJson({ results: [{ id: 8771, name: "psychological thriller" }] });
    }, async () => {
      const page = await fetchRecommendationProviderPage({ provider: "tmdb_kr", month: "2031-04", asOfDate: "2031-04-20", page: 1 }, {
        discoveryFilters: { genre: "thriller", country: "KR" }
      });
      assert.equal(calls, 1);
      assert.deepEqual(page, { items: [], hasMore: false });
    });
  });

  it("preserves selected country as evidence for constrained movie discovery", async () => {
    await withPositiveProviderFetch(async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("with_origin_country"), "CN");
      assert.equal(url.searchParams.get("with_genres"), "10749");
      return providerJson({ results: [{ id: 9301, title: "중국 로맨스 영화", genre_ids: [10749], release_date: "2031-05-01", original_language: "en" }], total_pages: 1 });
    }, async () => {
      const page = await fetchRecommendationProviderPage({ provider: "tmdb_movie", month: "2031-05", asOfDate: "2031-05-20", page: 1 }, {
        discoveryFilters: { genre: "romance", country: "CN" }
      });
      assert.deepEqual(page.items[0]?.countries, ["CN"]);
      assert.deepEqual(page.items[0]?.languages, ["en"]);
    });
  });

  it("passes AniList genre and country filters and localizes the same selected country", async () => {
    let animeRequests = 0;
    let localizationRequests = 0;
    await withPositiveProviderFetch(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "graphql.anilist.co") {
        animeRequests += 1;
        const body = JSON.parse(String(init?.body));
        assert.equal(body.variables.includedGenre, "Romance");
        assert.equal(body.variables.country, "CN");
        assert.match(body.query, /genre: \$includedGenre/);
        assert.match(body.query, /countryOfOrigin: \$country/);
        return providerJson({ data: { Page: { pageInfo: { hasNextPage: false }, media: [{ id: 9401, title: { native: "测试作品" }, startDate: { year: 2031, month: 6, day: 1 }, genres: ["Romance"], countryOfOrigin: "CN" }] } } });
      }
      localizationRequests += 1;
      assert.equal(url.searchParams.get("with_origin_country"), "CN");
      assert.equal(url.searchParams.get("with_genres"), "16");
      return providerJson({ results: [{ id: 9402, name: "중국 애니메이션", original_name: "测试作品", first_air_date: "2031-06-01", origin_country: ["CN"], genre_ids: [16] }], total_pages: 1 });
    }, async () => {
      const page = await fetchRecommendationProviderPage({ provider: "anilist", month: "2031-06", asOfDate: "2031-06-20", page: 1 }, {
        discoveryFilters: { genre: "romance", country: "CN" }
      });
      assert.equal(animeRequests, 1);
      assert.equal(localizationRequests, 1);
      assert.equal(page.items[0]?.title_primary, "중국 애니메이션");
      assert.deepEqual(page.items[0]?.countries, ["CN"]);
    });
  });
});

function providerJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200 });
}

async function withPositiveProviderFetch(fetchMock: typeof fetch, run: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalDeno = Object.getOwnPropertyDescriptor(globalThis, "Deno");
  Object.defineProperty(globalThis, "Deno", { configurable: true, value: { env: { get: (key: string) => key === "TMDB_API_KEY" ? "positive-tests-key" : undefined } } });
  globalThis.fetch = fetchMock;
  try { await run(); }
  finally {
    globalThis.fetch = originalFetch;
    if (originalDeno) Object.defineProperty(globalThis, "Deno", originalDeno);
    else Reflect.deleteProperty(globalThis, "Deno");
  }
}

it("caches a failed positive-genre keyword resolution briefly instead of repeating it for each month", async () => {
  let calls = 0;
  await withPositiveProviderFetch(async () => { calls += 1; throw new Error("keyword provider unavailable"); }, async () => {
    for (const month of ["2031-07", "2031-08"]) {
      await assert.rejects(fetchRecommendationProviderPage({ provider: "tmdb_kr", month, asOfDate: `${month}-20`, page: 1 }, {
        discoveryFilters: { genre: "horror", country: "KR" }
      }), /keyword provider unavailable/);
    }
    assert.equal(calls, 1);
  });
});

describe("multiselect recommendation providers", () => {
  it("uses one TV discover request for a native genre/country OR union and shares reordered selections", async () => {
    let calls = 0;
    await withPositiveProviderFetch(async (input) => {
      calls += 1;
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("with_origin_country"), "JP|KR");
      assert.equal(url.searchParams.get("with_genres"), "35|80");
      return providerJson({ results: [
        { id: 99101, name: "한국 코미디", first_air_date: "2032-01-01", genre_ids: [35], origin_country: ["KR"] },
        { id: 99102, name: "일본 범죄극", first_air_date: "2032-01-01", genre_ids: [18, 80], origin_country: ["JP"] },
        { id: 99103, name: "다른 나라 작품", first_air_date: "2032-01-01", genre_ids: [80], origin_country: ["US"] }
      ], total_pages: 1 });
    }, async () => {
      const request = { provider: "tmdb_kr" as const, month: "2032-01", asOfDate: "2032-01-20", page: 1 };
      const page = await fetchRecommendationProviderPage(request, { discoveryFilters: { genres: ["crime", "Comedy"], countries: ["KR", "JP"], mediaTypes: ["drama"] } });
      assert.deepEqual(page.items.map((item) => item.external_id), ["99101", "99102"]);
      await fetchRecommendationProviderPage(request, { discoveryFilters: { genres: ["comedy", "crime", "crime"], countries: ["jp", "kr"], mediaTypes: ["drama"] } });
      assert.equal(calls, 1);
    });
  });

  it("does not turn multiple movie-country query matches into coproduction metadata", async () => {
    await withPositiveProviderFetch(async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("with_origin_country"), "KR|US");
      assert.equal(url.searchParams.get("with_genres"), "35|10749");
      return providerJson({ results: [{ id: 99111, title: "한 작품", genre_ids: [35], release_date: "2032-02-01" }], total_pages: 1 });
    }, async () => {
      const page = await fetchRecommendationProviderPage({ provider: "tmdb_movie", month: "2032-02", asOfDate: "2032-02-20", page: 1 }, {
        discoveryFilters: { genres: ["comedy", "romance"], countries: ["US", "KR"] }
      });
      assert.deepEqual(page.items[0]?.countries, []);
      assert.deepEqual(page.items[0]?.matched_countries, ["KR", "US"]);
    });
  });

  it("unions AniList genres using one aliased GraphQL request within the same fifty-candidate budget", async () => {
    let graphqlCalls = 0;
    let localizationCalls = 0;
    await withPositiveProviderFetch(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "graphql.anilist.co") {
        graphqlCalls += 1;
        const body = JSON.parse(String(init?.body));
        assert.match(body.query, /genre0: Page/);
        assert.match(body.query, /genre1: Page/);
        assert.match(body.query, /genre: "Comedy"/);
        assert.match(body.query, /genre: "Romance"/);
        assert.doesNotMatch(body.query, /genre_in:/);
        assert.doesNotMatch(body.query, /\$includedGenre/);
        assert.deepEqual(body.variables.countries, ["CN", "KR"]);
        assert.equal(body.variables.perPage, 25);
        return providerJson({ data: {
          genre0: { pageInfo: { hasNextPage: false }, media: [{ id: 99201, title: { native: "喜剧测试" }, genres: ["Comedy"], countryOfOrigin: "CN", startDate: { year: 2032, month: 3, day: 1 } }] },
          genre1: { pageInfo: { hasNextPage: true }, media: [{ id: 99202, title: { native: "로맨스 검사" }, genres: ["Romance"], countryOfOrigin: "KR", startDate: { year: 2032, month: 3, day: 1 } }] }
        } });
      }
      localizationCalls += 1;
      assert.equal(url.searchParams.get("with_origin_country"), "CN|KR");
      return providerJson({ results: [
        { id: 99203, name: "중국 코미디 애니", original_name: "喜剧测试", first_air_date: "2032-03-01", genre_ids: [16] },
        { id: 99204, name: "한국 로맨스 애니", original_name: "로맨스 검사", first_air_date: "2032-03-01", genre_ids: [16] }
      ], total_pages: 1 });
    }, async () => {
      const page = await fetchRecommendationProviderPage({ provider: "anilist", month: "2032-03", asOfDate: "2032-03-20", page: 1 }, {
        discoveryFilters: { genres: ["romance", "comedy"], countries: ["KR", "CN"], mediaTypes: ["anime"] }
      });
      assert.equal(graphqlCalls, 1);
      assert.equal(localizationCalls, 1);
      assert.equal(page.items.length, 2);
      assert.equal(page.hasMore, true);
    });
  });
});

describe("AniList optional GraphQL filters", () => {
  const cases = [
    { genres: [], countries: ["JP"], genre: undefined, country: "JP" },
    { genres: [], countries: [], genre: undefined, country: undefined },
    { genres: ["romance"], countries: [], genre: "Romance", country: undefined },
    { genres: [], countries: ["JP", "CN"], genre: undefined, country: undefined },
    { genres: ["comedy", "romance"], countries: ["JP", "CN"], genre: undefined, country: undefined },
    { genres: ["animation", "romance"], countries: ["JP"], genre: undefined, country: "JP" }
  ];

  for (const [index, selection] of cases.entries()) {
    it(`omits absent arguments for ${JSON.stringify(selection)}`, async () => {
      let graphqlCalls = 0;
      await withPositiveProviderFetch(async (input, init) => {
        if (new URL(String(input)).hostname !== "graphql.anilist.co") {
          return providerJson({ results: [], total_pages: 0 });
        }
        graphqlCalls += 1;
        const body = JSON.parse(String(init?.body));
        // The live API returns HTTP 500, despite the nullable schema, when this
        // list argument is present with null. Mocks must exercise that behavior.
        if (/countryOfOrigin_in: \$countries/.test(body.query) && body.variables.countries == null) {
          return new Response(JSON.stringify({ errors: [{ message: "Internal Server Error" }], data: { Page: null } }), { status: 500 });
        }
        assert(Object.values(body.variables).every((value) => value !== null));
        const expectedOptional = {
          includedGenre: selection.genre,
          country: selection.country,
          countries: selection.countries.length > 1 ? ["CN", "JP"] : undefined,
          excludedGenres: undefined,
          excludedTags: undefined
        };
        for (const [name, expected] of Object.entries(expectedOptional)) {
          assert.deepEqual(body.variables[name], expected);
          assert.equal(new RegExp(`\\$${name}\\b`).test(body.query), expected !== undefined, name);
        }
        const multiGenre = selection.genres.length === 2 && !selection.genres.includes("animation");
        assert.equal((body.query.match(/: Page\(/g) ?? []).length, multiGenre ? 2 : 0);
        assert.equal(body.variables.perPage, multiGenre ? 25 : 50);
        return animePageResponse();
      }, async () => {
        const month = `2034-0${index + 1}`;
        const page = await fetchRecommendationProviderPage({ provider: "anilist", month, asOfDate: `${month}-20`, page: 1 }, {
          discoveryFilters: { genres: selection.genres, countries: selection.countries, mediaTypes: ["anime"] }
        });
        assert.equal(graphqlCalls, 1);
        assert.equal(page.hasMore, false);
      });
    });
  }

  it("bypasses failures cached by the old nullable-country query without changing TMDB cache versions", async () => {
    let graphqlCalls = 0;
    const cache: RecommendationCache = {
      async get<T>(key: string, source: "tmdb" | "anilist") {
        if (source === "anilist" && key.startsWith("recommendation-provider-v3:anilist:")) {
          return { page: null, expiresAt: Date.now() + 60_000 } as T;
        }
        return null;
      },
      async set() {}
    };
    await withPositiveProviderFetch(async (input) => {
      if (new URL(String(input)).hostname === "graphql.anilist.co") {
        graphqlCalls += 1;
        return animePageResponse();
      }
      return providerJson({ results: [], total_pages: 0 });
    }, async () => {
      await fetchRecommendationProviderPage({ provider: "anilist", month: "2034-07", asOfDate: "2034-07-20", page: 1 }, {
        cache, discoveryFilters: { countries: ["JP"], mediaTypes: ["anime"] }
      });
      assert.equal(graphqlCalls, 1);
    });
  });
});
