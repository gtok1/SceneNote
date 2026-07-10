import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decodeRecommendationCursor,
  getKstMonthKey,
  scanRecommendationCatalog,
  type RecommendationProvider,
  type RecommendationProviderFetcher
} from "./recommendationCatalog.ts";
import {
  createRecommendationIdentityAliases,
  type RecommendationCandidate,
  type RecommendationLibraryItem
} from "./recommendationEngine.ts";

const NOW = "2026-07-10T03:00:00.000Z";
type Catalog = Partial<Record<RecommendationProvider, Record<string, RecommendationCandidate[][]>>>;

describe("monthly recommendation catalog scan", () => {
  it("starts from the KST current month at a UTC month boundary", () => {
    assert.equal(getKstMonthKey("2026-06-30T16:00:00.000Z"), "2026-07");
  });

  it("returns twelve current-month works in popularity order", async () => {
    const july = Array.from({ length: 13 }, (_, index) => candidate(`july-${index}`, "2026-07-01", 13 - index));
    const result = await scanRecommendationCatalog(fetcher({ anilist: { "2026-07": [july] } }), {
      mediaType: "anime",
      now: NOW,
      limit: 12
    });

    assert.equal(result.items.length, 12);
    assert(result.items.every((item) => item.air_date?.startsWith("2026-07")));
    assert.deepEqual(result.items.map((item) => item.external_id), july.slice(0, 12).map((item) => item.external_id));
    assert.equal(result.exhausted, false);
  });

  it("combines five current-month works with seven from the previous month", async () => {
    const july = Array.from({ length: 5 }, (_, index) => candidate(`july-${index}`, "2026-07-01", 100 - index));
    const june = Array.from({ length: 20 }, (_, index) => candidate(`june-${index}`, "2026-06-01", 100 - index));
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [july], "2026-06": [june] } }),
      { mediaType: "anime", now: NOW, limit: 12 }
    );

    assert.deepEqual(result.items.map((item) => item.external_id), [
      ...july.map((item) => item.external_id),
      ...june.slice(0, 7).map((item) => item.external_id)
    ]);
  });

  it("moves to the previous month when the current month is fully seen", async () => {
    const july = Array.from({ length: 12 }, (_, index) => candidate(`seen-${index}`, "2026-07-01"));
    const june = Array.from({ length: 12 }, (_, index) => candidate(`new-${index}`, "2026-06-01"));
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [july], "2026-06": [june] } }),
      {
        mediaType: "anime",
        now: NOW,
        excludeIds: july.flatMap(createRecommendationIdentityAliases)
      }
    );

    assert.deepEqual(result.items.map((item) => item.external_id), june.map((item) => item.external_id));
    assert.equal(result.broadened, true);
  });

  it("continues beyond three fully seen months without reporting exhaustion", async () => {
    const seen = ["2026-07", "2026-06", "2026-05"].flatMap((month) =>
      Array.from({ length: 2 }, (_, index) => candidate(`${month}-${index}`, `${month}-01`))
    );
    const april = Array.from({ length: 12 }, (_, index) => candidate(`april-${index}`, "2026-04-01"));
    const result = await scanRecommendationCatalog(
      fetcher({
        anilist: {
          "2026-07": [seen.slice(0, 2)],
          "2026-06": [seen.slice(2, 4)],
          "2026-05": [seen.slice(4, 6)],
          "2026-04": [april]
        }
      }),
      {
        mediaType: "anime",
        now: NOW,
        excludeIds: seen.flatMap(createRecommendationIdentityAliases),
        maxMonthsPerRequest: 4
      }
    );

    assert.equal(result.items[0]?.external_id, "april-0");
    assert.equal(result.exhausted, false);
  });

  it("crosses a year boundary from January to the previous December", async () => {
    const december = Array.from({ length: 12 }, (_, index) => candidate(`dec-${index}`, "2025-12-01"));
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-01": [[]], "2025-12": [december] } }),
      {
        mediaType: "anime",
        now: "2026-01-10T03:00:00.000Z"
      }
    );

    assert.equal(result.items[0]?.air_date, "2025-12-01");
  });

  it("continues through 2026 and 2025 into 2024", async () => {
    const older = Array.from({ length: 12 }, (_, index) => candidate(`older-${index}`, "2024-12-01"));
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2024-12": [older] } }),
      {
        mediaType: "anime",
        now: "2026-01-10T03:00:00.000Z",
        maxMonthsPerRequest: 14,
        maxProviderRoundsPerRequest: 20
      }
    );

    assert.equal(result.items[0]?.air_year, 2024);
    assert.equal(result.exhausted, false);
  });

  it("returns an empty continuation page when the request scan budget is reached", async () => {
    const result = await scanRecommendationCatalog(fetcher({}), {
      mediaType: "anime",
      now: NOW,
      maxMonthsPerRequest: 1
    });

    assert.deepEqual(result.items, []);
    assert.equal(result.hasMore, true);
    assert.equal(result.exhausted, false);
    assert.equal(result.scanBudgetReached, true);
    assert(result.nextCursor);
  });

  it("reports exhaustion only after the configured catalog floor is scanned", async () => {
    const result = await scanRecommendationCatalog(fetcher({}), {
      mediaType: "anime",
      now: NOW,
      minimumMonth: "2026-07"
    });

    assert.equal(result.exhausted, true);
    assert.equal(result.hasMore, false);
    assert.equal(result.nextCursor, null);
  });
});

describe("provider page continuation", () => {
  it("requests page two when page one is fully excluded", async () => {
    const first = Array.from({ length: 12 }, (_, index) => candidate(`seen-${index}`, "2026-07-01"));
    const second = Array.from({ length: 12 }, (_, index) => candidate(`new-${index}`, "2026-07-01"));
    const calls: string[] = [];
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [first, second] } }, new Set(), calls),
      {
        mediaType: "anime",
        now: NOW,
        excludeIds: first.flatMap(createRecommendationIdentityAliases)
      }
    );

    assert(calls.includes("anilist:2026-07:2"));
    assert.deepEqual(result.items.map((item) => item.external_id), second.map((item) => item.external_id));
  });

  it("reaches page three without moving to an older month", async () => {
    const first = Array.from({ length: 4 }, (_, index) => candidate(`first-${index}`, "2026-07-01"));
    const second = Array.from({ length: 4 }, (_, index) => candidate(`second-${index}`, "2026-07-01"));
    const third = Array.from({ length: 12 }, (_, index) => candidate(`third-${index}`, "2026-07-01"));
    const calls: string[] = [];
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [first, second, third] } }, new Set(), calls),
      {
        mediaType: "anime",
        now: NOW,
        excludeIds: [...first, ...second].flatMap(createRecommendationIdentityAliases)
      }
    );

    assert(calls.includes("anilist:2026-07:3"));
    assert.equal(calls.some((call) => call.includes("2026-06")), false);
    assert.equal(result.items[0]?.external_id, "third-0");
  });

  it("moves to the previous month only after all pages are consumed", async () => {
    const julyOne = [candidate("july-one", "2026-07-01")];
    const julyTwo = [candidate("july-two", "2026-07-01")];
    const june = Array.from({ length: 10 }, (_, index) => candidate(`june-${index}`, "2026-06-01"));
    const calls: string[] = [];
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [julyOne, julyTwo], "2026-06": [june] } }, new Set(), calls),
      { mediaType: "anime", now: NOW }
    );

    assert.deepEqual(calls.slice(0, 3), ["anilist:2026-07:1", "anilist:2026-07:2", "anilist:2026-06:1"]);
    assert.equal(result.items.length, 12);
  });
});

describe("ranking, exclusions, and stream continuity", () => {
  it("uses popularity before preference within the same release month", async () => {
    const library = preferenceLibrary();
    const popular = candidate("popular", "2026-07-01", 100, { genres: ["Comedy"] });
    const tasteMatch = candidate("taste", "2026-07-20", 10, { genres: ["Mystery"] });
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [[tasteMatch, popular]] } }),
      { mediaType: "anime", now: NOW, limit: 2, libraryItems: library }
    );

    assert.deepEqual(result.items.map((item) => item.external_id), ["popular", "taste"]);
  });

  it("uses preference as the tie-breaker when popularity is equal", async () => {
    const weak = candidate("weak", "2026-07-01", 10, { genres: ["Comedy"] });
    const strong = candidate("strong", "2026-07-01", 10, { genres: ["Mystery"] });
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [[weak, strong]] } }),
      { mediaType: "anime", now: NOW, limit: 2, libraryItems: preferenceLibrary() }
    );

    assert.equal(result.items[0]?.external_id, "strong");
  });

  it("returns zero-similarity candidates instead of filtering them out", async () => {
    const works = Array.from({ length: 12 }, (_, index) =>
      candidate(`comedy-${index}`, "2026-07-01", 100 - index, { genres: ["Comedy"] })
    );
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [works] } }),
      { mediaType: "anime", now: NOW, libraryItems: preferenceLibrary() }
    );

    assert.equal(result.items.length, 12);
  });

  it("excludes library, persisted impressions, and current cards in one batch", async () => {
    const libraryWork = candidate("library", "2026-07-01");
    const persisted = candidate("persisted", "2026-07-01");
    const current = candidate("current", "2026-07-01");
    const fresh = candidate("fresh", "2026-07-01");
    const libraryItem: RecommendationLibraryItem = {
      source_api: libraryWork.external_source,
      source_id: libraryWork.external_id,
      content_type: libraryWork.content_type,
      title_primary: libraryWork.title_primary,
      air_year: libraryWork.air_year,
      status: "completed"
    };
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [[libraryWork, persisted, current, fresh]] } }),
      {
        mediaType: "anime",
        now: NOW,
        limit: 4,
        libraryItems: [libraryItem],
        excludeIds: createRecommendationIdentityAliases(current),
        resolveSeenIds: async (candidates) =>
          candidates.some((item) => item.external_id === persisted.external_id)
            ? createRecommendationIdentityAliases(persisted)
            : []
      }
    );

    assert.deepEqual(result.items.map((item) => item.external_id), ["fresh"]);
  });

  it("deduplicates the same work returned by TMDB and AniList", async () => {
    const tmdb = candidate("tmdb-1", "2026-07-01", 100, {
      external_source: "tmdb",
      content_type: "anime",
      title_primary: "같은 작품",
      title_original: "Same Work"
    });
    const anilist = candidate("anilist-1", "2026-07-01", 90, {
      title_primary: "같은 작품",
      title_original: "Same Work"
    });
    const unique = candidate("unique", "2026-07-01", 80);
    const result = await scanRecommendationCatalog(
      fetcher({
        tmdb_kr: { "2026-07": [[tmdb]] },
        tmdb_jp: { "2026-07": [[]] },
        anilist: { "2026-07": [[anilist, unique]] }
      }),
      { mediaType: "all", now: NOW, limit: 3, minimumMonth: "2026-07" }
    );

    assert.equal(result.items.filter((item) => item.title_primary === "같은 작품").length, 1);
  });

  it("continues the same cursor stream across two non-overlapping refresh batches", async () => {
    const works = Array.from({ length: 30 }, (_, index) => candidate(`stream-${index}`, "2026-07-01", 100 - index));
    const provider = fetcher({ anilist: { "2026-07": [works] } });
    const first = await scanRecommendationCatalog(provider, { mediaType: "anime", now: NOW });
    const second = await scanRecommendationCatalog(provider, {
      mediaType: "anime",
      now: NOW,
      cursor: first.nextCursor,
      excludeIds: first.items.flatMap(createRecommendationIdentityAliases)
    });

    assert.deepEqual(first.items.map((item) => item.external_id), works.slice(0, 12).map((item) => item.external_id));
    assert.deepEqual(second.items.map((item) => item.external_id), works.slice(12, 24).map((item) => item.external_id));
    assert.equal(first.items.some((item) => second.items.some((next) => next.external_id === item.external_id)), false);
  });

  it("starts from the head after reopening but skips account-persisted impressions", async () => {
    const works = Array.from({ length: 24 }, (_, index) => candidate(`persist-${index}`, "2026-07-01", 100 - index));
    const provider = fetcher({ anilist: { "2026-07": [works] } });
    const first = await scanRecommendationCatalog(provider, { mediaType: "anime", now: NOW });
    const persistedKeys = first.items.flatMap(createRecommendationIdentityAliases);
    const reopened = await scanRecommendationCatalog(provider, {
      mediaType: "anime",
      now: NOW,
      resolveSeenIds: async () => persistedKeys
    });

    assert.deepEqual(reopened.items.map((item) => item.external_id), works.slice(12, 24).map((item) => item.external_id));
  });

  it("rejects a cursor when a different media filter tries to consume it", async () => {
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [[candidate("one", "2026-07-01")]] } }),
      { mediaType: "anime", now: NOW, limit: 1 }
    );

    assert.throws(() => decodeRecommendationCursor(result.nextCursor, "drama", NOW), /INVALID_RECOMMENDATION_CURSOR/);
  });
});

describe("provider failure semantics", () => {
  it("keeps AniList results when TMDB fails", async () => {
    const anime = Array.from({ length: 12 }, (_, index) => candidate(`anime-${index}`, "2026-07-01"));
    const failures = new Set(["tmdb_kr:2026-07:1", "tmdb_jp:2026-07:1"]);
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [anime] } }, failures),
      { mediaType: "all", now: NOW }
    );

    assert.equal(result.items.length, 12);
    assert.equal(result.exhausted, false);
    assert.equal(result.allProvidersFailed, false);
    assert.equal(result.providersBlocked, false);
    assert(result.failedProviders.includes("tmdb_kr"));
  });

  it("keeps TMDB results when AniList fails", async () => {
    const drama = Array.from({ length: 12 }, (_, index) =>
      candidate(`drama-${index}`, "2026-07-01", 100 - index, {
        external_source: "tmdb",
        content_type: "kdrama"
      })
    );
    const result = await scanRecommendationCatalog(
      fetcher(
        { tmdb_kr: { "2026-07": [drama] }, tmdb_jp: { "2026-07": [[]] } },
        new Set(["anilist:2026-07:1"])
      ),
      { mediaType: "all", now: NOW }
    );

    assert.equal(result.items.length, 12);
    assert.equal(result.allProvidersFailed, false);
    assert(result.failedProviders.includes("anilist"));
  });

  it("does not report catalog exhaustion when every provider fails", async () => {
    const failures = new Set([
      "tmdb_kr:2026-07:1",
      "tmdb_jp:2026-07:1",
      "anilist:2026-07:1"
    ]);
    const result = await scanRecommendationCatalog(fetcher({}, failures), {
      mediaType: "all",
      now: NOW
    });

    assert.equal(result.items.length, 0);
    assert.equal(result.allProvidersFailed, true);
    assert.equal(result.exhausted, false);
    assert.equal(result.hasMore, true);
  });

  it("returns a non-exhausted partial batch when healthy providers run out and another provider is blocked", async () => {
    const drama = Array.from({ length: 5 }, (_, index) =>
      candidate(`partial-${index}`, "2026-07-01", 100 - index, {
        external_source: "tmdb",
        content_type: "kdrama"
      })
    );
    const result = await scanRecommendationCatalog(
      fetcher(
        { tmdb_kr: { "2026-07": [drama] }, tmdb_jp: { "2026-07": [[]] } },
        new Set(["anilist:2026-07:1"])
      ),
      { mediaType: "all", now: NOW }
    );

    assert.equal(result.items.length, 5);
    assert.equal(result.providersBlocked, true);
    assert.equal(result.allProvidersFailed, false);
    assert.equal(result.exhausted, false);
  });
});

function fetcher(
  catalog: Catalog,
  failures = new Set<string>(),
  calls: string[] = []
): RecommendationProviderFetcher {
  return async ({ provider, month, page }) => {
    const key = `${provider}:${month}:${page}`;
    calls.push(key);
    if (failures.has(key)) throw new Error(`${provider} unavailable`);
    const pages = catalog[provider]?.[month] ?? [];
    return {
      items: pages[page - 1] ?? [],
      hasMore: page < pages.length
    };
  };
}

function candidate(
  id: string,
  airDate: string,
  popularity = 10,
  overrides: Partial<RecommendationCandidate> = {}
): RecommendationCandidate {
  return {
    external_source: "anilist",
    external_id: id,
    content_type: "anime",
    title_primary: `작품 ${id}`,
    title_original: null,
    air_year: Number.parseInt(airDate.slice(0, 4), 10),
    air_date: airDate,
    genres: ["Drama"],
    popularity,
    rank: 1,
    ...overrides
  };
}

function preferenceLibrary(): RecommendationLibraryItem[] {
  return [1, 2, 3].map((index) => ({
    content_id: `library-${index}`,
    source_api: "tmdb",
    source_id: `library-${index}`,
    content_type: "anime",
    title_primary: `라이브러리 ${index}`,
    air_year: 2025,
    air_date: "2025-01-01",
    genres: ["Mystery"],
    status: "completed"
  }));
}
