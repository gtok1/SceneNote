import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findTmdbKoreanAnimeLocalization,
  type AniListMedia,
  type TmdbTvItem
} from "./recommendationProviders.ts";

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
