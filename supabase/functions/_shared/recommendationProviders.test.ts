import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  enrichTmdbRecommendationCandidates,
  findTmdbKoreanAnimeLocalization,
  TMDB_RECOMMENDATION_KEYWORD_LOOKUP_LIMIT,
  type AniListMedia,
  type TmdbTvItem
} from "./recommendationProviders.ts";
import { hasExcludedTheme } from "./recommendationThemes.ts";
import { createRecommendationIdentityAliases } from "./recommendationEngine.ts";
import { filterRecommendationsForUser, isRecommendationExcludedForUser } from "./recommendationUserFilters.ts";

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
        assert.equal(authenticatedRequests, 6); // KR, JP, movies and three anime localization pages.
      } finally {
        globalThis.fetch = originalFetch;
        if (originalDeno) Object.defineProperty(globalThis,"Deno",originalDeno);
        else Reflect.deleteProperty(globalThis,"Deno");
      }
    });
  }
});

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
