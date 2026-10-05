import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decodeRecommendationCursor,
  encodeRecommendationCursor,
  getKstMonthKey,
  hasKoreanDisplayTitle,
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

  it("skips capped current-month niche candidates and fills the batch from the previous month", async () => {
    const niche = Array.from({ length: 6 }, (_, index) => candidate(`niche-${index}`, "2026-07-01", 100 - index, {
      source_tags: [{ name: "Boys' Love", source: "anilist", rank: 90 }],
      keywords: ["Boys' Love"]
    }));
    const june = Array.from({ length: 20 }, (_, index) => candidate(`general-${index}`, "2026-06-01", 80 - index, {
      genres: ["Crime", `Specific ${index}`]
    }));
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [niche], "2026-06": [june] } }),
      { mediaType: "anime", now: NOW, limit: 12 }
    );

    assert.equal(result.items.length, 12);
    assert.equal(result.items.filter((item) => item.themes.some((theme) => theme.key === "boys-love")).length, 1);
    assert.equal(result.broadened, true);
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

describe("bounded keyword verification continuation", () => {
  it("keeps a twenty-item provider page until candidates beyond the first eight are verified", async () => {
    const works = Array.from({ length: 20 }, (_, index) => candidate(`verification-${index}`, "2026-07-01", 100 - index));
    const calls: number[] = [];
    let verifiedCount = 0;
    const provider: RecommendationProviderFetcher = async ({ page }) => {
      calls.push(page);
      verifiedCount = Math.min(works.length, verifiedCount + 8);
      return {
        items: works.map((work, index) => ({
          ...work,
          keywords: index < verifiedCount ? [index < 8 ? "excluded" : "allowed"] : []
        })),
        hasMore: false,
        pendingVerification: verifiedCount < works.length
      };
    };
    const first = await scanRecommendationCatalog(provider, {
      mediaType: "anime", now: NOW, minimumMonth: "2026-07", maxProviderRoundsPerRequest: 1,
      candidateFilter: (work) => work.keywords?.includes("allowed") ?? false
    });
    const firstCursor = decodeRecommendationCursor(first.nextCursor, "anime", NOW);
    assert.deepEqual(first.items, []);
    assert.equal(firstCursor.providers.anilist.page, 1);
    assert.equal(firstCursor.providers.anilist.done, false);
    assert.equal(firstCursor.providers.anilist.verificationPass, 1);
    const next = await scanRecommendationCatalog(provider, {
      mediaType: "anime", now: NOW, minimumMonth: "2026-07", cursor: first.nextCursor,
      candidateFilter: (work) => work.keywords?.includes("allowed") ?? false
    });
    assert.deepEqual(calls, [1, 1, 1]);
    assert.deepEqual(next.items.map((item) => item.external_id), works.slice(8).map((item) => item.external_id));
    assert.equal(new Set(next.items.map((item) => item.external_id)).size, 12);
    assert.equal(next.exhausted, true);
  });

  it("rescans the changing ranked pool from zero without skipping newly verified higher-ranked works", async () => {
    const works = Array.from({ length: 4 }, (_, index) => candidate(`rank-${index}`, "2026-07-01", 100 - index));
    let call = 0;
    const provider: RecommendationProviderFetcher = async () => ({
      items: ++call === 1 ? works.slice(2) : works,
      hasMore: false,
      pendingVerification: call === 1
    });
    const first = await scanRecommendationCatalog(provider, { mediaType: "anime", now: NOW, limit: 1 });
    const firstCursor = decodeRecommendationCursor(first.nextCursor, "anime", NOW);
    assert.equal(firstCursor.offset, 0);
    assert.equal(firstCursor.providers.anilist.verificationPass, 1);
    const second = await scanRecommendationCatalog(provider, {
      mediaType: "anime", now: NOW, limit: 1, cursor: first.nextCursor,
      excludeIds: first.items.flatMap(createRecommendationIdentityAliases)
    });
    assert.equal(second.items[0]?.external_id, "rank-0");
    const third = await scanRecommendationCatalog(provider, {
      mediaType: "anime", now: NOW, cursor: second.nextCursor, minimumMonth: "2026-07",
      excludeIds: [...first.items, ...second.items].flatMap(createRecommendationIdentityAliases)
    });
    assert.deepEqual(third.items.map((item) => item.external_id), ["rank-1", "rank-3"]);
    assert.equal(third.exhausted, true);
  });

  it("bounds repeated pending pages by the round budget and advances only the verification marker", async () => {
    const calls: number[] = [];
    const provider: RecommendationProviderFetcher = async ({ page }) => {
      calls.push(page);
      return { items: [], hasMore: true, pendingVerification: true };
    };
    const first = await scanRecommendationCatalog(provider, {
      mediaType: "anime", now: NOW, maxProviderRoundsPerRequest: 3
    });
    const firstCursor = decodeRecommendationCursor(first.nextCursor, "anime", NOW);
    const second = await scanRecommendationCatalog(provider, {
      mediaType: "anime", now: NOW, cursor: first.nextCursor, maxProviderRoundsPerRequest: 2
    });
    const secondCursor = decodeRecommendationCursor(second.nextCursor, "anime", NOW);
    assert.deepEqual(calls, [1, 1, 1, 1, 1]);
    assert.equal(first.scanBudgetReached, true);
    assert.equal(second.scanBudgetReached, true);
    assert.equal(firstCursor.providers.anilist.verificationPass, 3);
    assert.equal(secondCursor.providers.anilist.verificationPass, 5);
    assert.notEqual(first.nextCursor, second.nextCursor);
  });

  it("finishes verification before advancing to the next provider page", async () => {
    const calls: number[] = [];
    const provider: RecommendationProviderFetcher = async ({ page }) => {
      calls.push(page);
      return {
        items: page === 2 ? [candidate("page-two", "2026-07-01")] : [],
        hasMore: page === 1,
        pendingVerification: page === 1 && calls.length === 1
      };
    };
    const result = await scanRecommendationCatalog(provider, { mediaType: "anime", now: NOW, limit: 1 });
    assert.deepEqual(calls, [1, 1, 2]);
    assert.equal(result.items[0]?.external_id, "page-two");
  });

  it("honors a shared request deadline before another provider round while keeping safe results", async () => {
    let calls = 0;
    const provider: RecommendationProviderFetcher = async () => {
      calls += 1;
      return { items: [candidate("safe", "2026-07-01")], hasMore: true, pendingVerification: true };
    };
    const result = await scanRecommendationCatalog(provider, {
      mediaType: "anime", now: NOW, canContinue: () => false
    });
    assert.equal(calls, 1);
    assert.equal(result.items[0]?.external_id, "safe");
    assert.equal(result.scanBudgetReached, true);
    assert.equal(decodeRecommendationCursor(result.nextCursor, "anime", NOW).providers.anilist.page, 1);
  });

  it("accepts existing v2 cursors without a verification marker and rejects invalid markers", () => {
    const state = decodeRecommendationCursor(null, "anime", NOW);
    for (const provider of Object.values(state.providers)) delete provider.verificationPass;
    assert.equal(decodeRecommendationCursor(encodeRecommendationCursor(state), "anime", NOW).providers.anilist.verificationPass, 0);
    for (const invalid of [-1, 0.5, 101, Number.POSITIVE_INFINITY]) {
      state.providers.anilist.verificationPass = invalid;
      assert.throws(() => decodeRecommendationCursor(encodeRecommendationCursor(state), "anime", NOW), /INVALID_RECOMMENDATION_CURSOR/);
    }
  });
});

describe("ranking, exclusions, and stream continuity", () => {
  it("does not let popularity overwrite a stronger preference match within the same month", async () => {
    const library = preferenceLibrary();
    const popular = candidate("popular", "2026-07-01", 100, { genres: ["Comedy"] });
    const tasteMatch = candidate("taste", "2026-07-20", 10, { genres: ["Mystery"] });
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [[tasteMatch, popular]] } }),
      { mediaType: "anime", now: NOW, limit: 2, libraryItems: library }
    );

    assert.deepEqual(result.items.map((item) => item.external_id), ["taste", "popular"]);
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

  it("starts from the head after reopening but skips recent account-persisted impressions", async () => {
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
  it("rescans the expanded ranked pool after blocked providers recover with an outstanding offset", async () => {
    const korean = Array.from({ length: 5 }, (_, index) => candidate(`recovered-korean-${index}`, "2026-07-01", 100 - index, {
      external_source: "tmdb", content_type: "kdrama"
    }));
    const japanese = Array.from({ length: 5 }, (_, index) => candidate(`recovered-japanese-${index}`, "2026-07-01", 90 - index, {
      external_source: "tmdb", content_type: "jdrama"
    }));
    const anime = Array.from({ length: 5 }, (_, index) => candidate(`recovered-anime-${index}`, "2026-07-01", 80 - index));
    const failures = new Set(["tmdb_kr:2026-07:1"]);
    const provider = fetcher({
      tmdb_kr: { "2026-07": [korean] },
      tmdb_jp: { "2026-07": [japanese] },
      anilist: { "2026-07": [anime] }
    }, failures);
    const first = await scanRecommendationCatalog(provider, {
      mediaType: "all", now: NOW, minimumMonth: "2026-07", limit: 6
    });
    assert.equal(first.items.length, 6);
    assert.equal(decodeRecommendationCursor(first.nextCursor, "all", NOW).offset, 6);
    failures.add("tmdb_jp:2026-07:1");
    failures.add("anilist:2026-07:1");
    const blocked = await scanRecommendationCatalog(provider, {
      mediaType: "all", now: NOW, minimumMonth: "2026-07", cursor: first.nextCursor,
      excludeIds: first.items.flatMap(createRecommendationIdentityAliases)
    });
    assert.equal(blocked.allProvidersFailed, true);
    failures.clear();
    const recovered = await scanRecommendationCatalog(provider, {
      mediaType: "all", now: NOW, minimumMonth: "2026-07", cursor: blocked.nextCursor,
      excludeIds: first.items.flatMap(createRecommendationIdentityAliases)
    });
    assert.deepEqual(recovered.items.map((item) => item.external_id), [
      ...korean.map((item) => item.external_id),
      ...anime.slice(1).map((item) => item.external_id)
    ]);
    assert.equal(recovered.items.length, 9);
    assert.equal(recovered.exhausted, true);
    assert.deepEqual(recovered.failedProviders, []);
  });

  it("rescans the healthy ranked pool when a failed provider removes entries before the saved offset", async () => {
    const korean = Array.from({ length: 5 }, (_, index) => candidate(`korean-${index}`, "2026-07-01", 100 - index, {
      external_source: "tmdb", content_type: "kdrama"
    }));
    const japanese = Array.from({ length: 5 }, (_, index) => candidate(`japanese-${index}`, "2026-07-01", 90 - index, {
      external_source: "tmdb", content_type: "jdrama"
    }));
    const anime = Array.from({ length: 5 }, (_, index) => candidate(`anime-${index}`, "2026-07-01", 80 - index));
    const failures = new Set<string>();
    const provider = fetcher({
      tmdb_kr: { "2026-07": [korean] },
      tmdb_jp: { "2026-07": [japanese] },
      anilist: { "2026-07": [anime] }
    }, failures);
    const first = await scanRecommendationCatalog(provider, {
      mediaType: "all", now: NOW, minimumMonth: "2026-07"
    });
    assert.equal(first.items.length, 12);
    assert.equal(decodeRecommendationCursor(first.nextCursor, "all", NOW).offset, 12);
    failures.add("tmdb_kr:2026-07:1");
    const next = await scanRecommendationCatalog(provider, {
      mediaType: "all", now: NOW, minimumMonth: "2026-07", cursor: first.nextCursor,
      excludeIds: first.items.flatMap(createRecommendationIdentityAliases)
    });
    assert.deepEqual(next.items.map((item) => item.external_id), anime.slice(2).map((item) => item.external_id));
    assert.equal(next.allProvidersFailed, false);
    assert.equal(next.providersBlocked, true);
  });

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
      { mediaType: "all", now: NOW, minimumMonth: "2026-07" }
    );

    assert.equal(result.items.length, 5);
    assert.equal(result.providersBlocked, true);
    assert.equal(result.allProvidersFailed, false);
    assert.equal(result.exhausted, false);
  });

  it("continues into older healthy results when an unavailable provider has no current-month results", async () => {
    const calls: string[] = [];
    const older = candidate("older-drama", "2026-06-01", 100, {
      external_source: "tmdb", content_type: "kdrama"
    });
    const provider = fetcher({ tmdb_kr: { "2026-06": [[older]] } },
      new Set(["anilist:2026-07:1", "anilist:2026-06:1"]), calls);
    const first = await scanRecommendationCatalog(provider, {
      mediaType: "all", now: NOW, maxMonthsPerRequest: 1, maxProviderRoundsPerRequest: 1
    });
    assert.equal(first.allProvidersFailed, false);
    assert.equal(first.scanBudgetReached, true);
    assert.equal(first.providersBlocked, false);
    const next = await scanRecommendationCatalog(provider, {
      mediaType: "all", now: NOW, cursor: first.nextCursor, limit: 1,
      maxMonthsPerRequest: 1, maxProviderRoundsPerRequest: 1
    });
    assert.deepEqual(next.items.map((item) => item.external_id), ["older-drama"]);
    assert.equal(next.allProvidersFailed, false);
    assert(next.failedProviders.includes("anilist"));
    assert.equal(calls.filter((call) => call === "anilist:2026-07:1").length, 1);
    assert.equal(calls.length, 6);
  });

  it("recovers an existing cursor stalled on a failed provider without querying that month again", async () => {
    const cursor = decodeRecommendationCursor(null, "all", NOW);
    cursor.providers.tmdb_kr.done = true;
    cursor.providers.tmdb_jp.done = true;
    cursor.providers.anilist.failures = 1;
    const calls: string[] = [];
    const result = await scanRecommendationCatalog(fetcher({ tmdb_kr: { "2026-06": [[
      candidate("recovered", "2026-06-01", 10, { external_source: "tmdb", content_type: "kdrama" })
    ]] } }, new Set(), calls), {
      mediaType: "all", now: NOW, cursor: encodeRecommendationCursor(cursor), limit: 1,
      maxMonthsPerRequest: 1, maxProviderRoundsPerRequest: 1
    });
    assert.equal(result.items.length, 1);
    assert(calls.every((call) => call.includes("2026-06")));
    assert.equal(result.allProvidersFailed, false);
  });

  it("does not repeatedly retry a failed provider while healthy pages remain", async () => {
    const calls: string[] = [];
    const result = await scanRecommendationCatalog(fetcher({ tmdb_kr: { "2026-07": [[], [
      candidate("page-two", "2026-07-01", 10, { external_source: "tmdb", content_type: "kdrama" })
    ]] } }, new Set(["anilist:2026-07:1"]), calls), {
      mediaType: "all", now: NOW, limit: 1
    });
    assert.equal(result.items.length, 1);
    assert.equal(calls.filter((call) => call.startsWith("anilist:")).length, 1);
  });

  it("keeps an anime-only outage retryable and recovers on the next attempt", async () => {
    const failed = await scanRecommendationCatalog(fetcher({}, new Set(["anilist:2026-07:1"])), {
      mediaType: "anime", now: NOW
    });
    assert.equal(failed.allProvidersFailed, true);
    assert.equal(failed.exhausted, false);
    const recovered = await scanRecommendationCatalog(fetcher({ anilist: { "2026-07": [[
      candidate("recovered-anime", "2026-07-01")
    ]] } }), { mediaType: "anime", now: NOW, cursor: failed.nextCursor, limit: 1 });
    assert.equal(recovered.items.length, 1);
    assert.equal(recovered.allProvidersFailed, false);
    assert.deepEqual(recovered.failedProviders, []);
    assert.deepEqual(recovered.warnings, []);
  });

  it("keeps reporting a provider that fails again on retry", async () => {
    const unavailable = new Set(["anilist:2026-07:1"]);
    const failed = await scanRecommendationCatalog(fetcher({}, unavailable), {
      mediaType: "anime", now: NOW
    });
    const retried = await scanRecommendationCatalog(fetcher({}, unavailable), {
      mediaType: "anime", now: NOW, cursor: failed.nextCursor
    });
    assert(retried.failedProviders.includes("anilist"));
    assert(retried.warnings.includes("anilist:unavailable"));
  });

  it("keeps a failed provider reported when it is not retried this round", async () => {
    const cursor = decodeRecommendationCursor(null, "all", NOW);
    cursor.providers.anilist.failures = 1;
    const calls: string[] = [];
    const result = await scanRecommendationCatalog(fetcher({ tmdb_kr: { "2026-07": [[
      candidate("healthy-drama", "2026-07-01", 10, { external_source: "tmdb", content_type: "kdrama" })
    ]] } }, new Set(), calls), {
      mediaType: "all", now: NOW, cursor: encodeRecommendationCursor(cursor), limit: 1
    });
    assert(result.failedProviders.includes("anilist"));
    assert(!calls.some((call) => call.startsWith("anilist:")));
  });
});

describe("Korean display title policy", () => {
  it("accepts only titles containing verified Hangul", () => {
    assert.equal(hasKoreanDisplayTitle(candidate("ko", "2026-07-01")), true);
    assert.equal(
      hasKoreanDisplayTitle(candidate("jp", "2026-07-01", 10, { title_primary: "救い、巣喰われ" })),
      false
    );
    assert.equal(
      hasKoreanDisplayTitle(candidate("en", "2026-07-01", 10, { title_primary: "The Boy Next World" })),
      false
    );
  });

  it("filters untranslated titles while continuing catalog selection", async () => {
    const result = await scanRecommendationCatalog(
      fetcher({ anilist: { "2026-07": [[
        candidate("foreign", "2026-07-02", 100, { title_primary: "北方謙三 水滸伝" }),
        candidate("korean", "2026-07-01", 90, { title_primary: "한국어 제목" })
      ]] } }),
      { mediaType: "anime", now: NOW, limit: 1, candidateFilter: hasKoreanDisplayTitle }
    );

    assert.deepEqual(result.items.map((item) => item.external_id), ["korean"]);
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

describe("positive catalog filters", () => {
  it("fills twelve matching international dramas and resumes a filter-bound cursor without skipped works", async () => {
    const works = Array.from({ length: 15 }, (_, index) => candidate(`us-${index}`, "2026-07-01", 100 - index, {
      external_source: "tmdb", content_type: "other", category: "drama", has_seasons: true,
      countries: ["US"], genres: ["Drama", "Crime"]
    }));
    const calls: string[] = [];
    const getPage = fetcher({ tmdb_kr: { "2026-07": [[
      candidate("wrong-country", "2026-07-01", 200, { content_type: "kdrama", countries: ["KR"], genres: ["Crime"] }),
      ...works
    ]] } }, new Set(), calls);
    const discoveryFilters = { genre: "crime", country: "US" };
    const first = await scanRecommendationCatalog(getPage, { mediaType: "drama", now: NOW, discoveryFilters });
    assert.equal(first.items.length, 12);
    assert(first.items.every((item) => item.countries?.includes("US") && item.content_type === "other"));
    assert(calls.every((key) => key.startsWith("tmdb_kr:")));
    const second = await scanRecommendationCatalog(getPage, {
      mediaType: "drama", now: NOW, discoveryFilters, cursor: first.nextCursor,
      excludeIds: first.items.flatMap(createRecommendationIdentityAliases), minimumMonth: "2026-07"
    });
    assert.deepEqual(second.items.map((item) => item.external_id), works.slice(12).map((item) => item.external_id));
    assert.throws(() => decodeRecommendationCursor(first.nextCursor, "drama", NOW, { genre: "crime", country: "CN" }), /INVALID_RECOMMENDATION_CURSOR/);
    assert.throws(() => decodeRecommendationCursor(first.nextCursor, "drama", NOW), /INVALID_RECOMMENDATION_CURSOR/);
    const oldCursor = encodeRecommendationCursor(decodeRecommendationCursor(null, "drama", NOW));
    assert.doesNotThrow(() => decodeRecommendationCursor(oldCursor, "drama", NOW));
    assert.throws(() => decodeRecommendationCursor(oldCursor, "drama", NOW, discoveryFilters), /INVALID_RECOMMENDATION_CURSOR/);
  });

  it("returns exhausted without provider calls for an unsupported media and genre combination", async () => {
    let calls = 0;
    const result = await scanRecommendationCatalog(async () => { calls += 1; return { items: [], hasMore: false }; }, {
      mediaType: "anime", now: NOW, discoveryFilters: { genre: "crime", country: "all" }
    });
    assert.equal(calls, 0);
    assert.equal(result.exhausted, true);
    assert.equal(result.hasMore, false);
  });
});

describe("multiselect catalog boundaries", () => {
  it("stops without requests when all selected genres are excluded for the account", async () => {
    let calls = 0;
    const result = await scanRecommendationCatalog(async () => { calls += 1; return { items: [], hasMore: false }; }, {
      mediaType: "all", now: NOW,
      discoveryFilters: { genres: ["romance", "comedy"], mediaTypes: [] },
      feedback: [
        { target_type: "genre", target_key: "romance", action: "exclude" },
        { target_type: "genre", target_key: "comedy", action: "exclude" }
      ]
    });
    assert.equal(calls, 0);
    assert.equal(result.exhausted, true);
  });
  it("selects a provider union for multiple types and treats explicit all identically to all three boxes", async () => {
    const calls: string[] = [];
    const works = Array.from({ length: 13 }, (_, index) => candidate(`mixed-${index}`, "2026-07-01", 100 - index));
    const getPage = fetcher({ anilist: { "2026-07": [works] } }, new Set(), calls);
    const first = await scanRecommendationCatalog(getPage, { mediaType: "drama", now: NOW, discoveryFilters: { mediaTypes: ["anime", "movie"] } });
    assert.equal(first.items.length, 12);
    assert(calls.some((value) => value.startsWith("tmdb_movie:")));
    assert(calls.some((value) => value.startsWith("anilist:")));
    assert(calls.every((value) => !value.startsWith("tmdb_kr:") && !value.startsWith("tmdb_jp:")));
    assert.doesNotThrow(() => decodeRecommendationCursor(first.nextCursor, "drama", NOW, { mediaTypes: ["movie", "anime"] }));
    assert.throws(() => decodeRecommendationCursor(first.nextCursor, "drama", NOW, { mediaTypes: ["anime"] }), /INVALID_RECOMMENDATION_CURSOR/);
    calls.length = 0;
    const all = await scanRecommendationCatalog(getPage, { mediaType: "all", now: NOW, discoveryFilters: { mediaTypes: [] } });
    assert.equal(calls.length, 4);
    assert.doesNotThrow(() => decodeRecommendationCursor(all.nextCursor, "all", NOW, { mediaTypes: ["drama", "anime", "movie"] }));
    assert.throws(() => decodeRecommendationCursor(all.nextCursor, "all", NOW), /INVALID_RECOMMENDATION_CURSOR/);
  });

  it("accepts deployed single-filter cursors for legacy scalar callers but resets changed multiselects", () => {
    const state = decodeRecommendationCursor(null, "drama", NOW, { genre: "crime", country: "US" });
    const legacy = encodeRecommendationCursor({ ...state, discoveryFilterKey: JSON.stringify(["crime", "US"]) });
    assert.doesNotThrow(() => decodeRecommendationCursor(legacy, "drama", NOW, { genre: "Crime", country: "us" }));
    assert.throws(() => decodeRecommendationCursor(legacy, "drama", NOW, { genres: ["crime", "comedy"], countries: ["US"] }), /INVALID_RECOMMENDATION_CURSOR/);
    const unicode = { genres: ["crime", "미등록 장르"], countries: ["US"] };
    const unicodeCursor = encodeRecommendationCursor(decodeRecommendationCursor(null, "drama", NOW, unicode));
    assert.doesNotThrow(() => decodeRecommendationCursor(unicodeCursor, "drama", NOW, unicode));
  });
});

it("Y-4 year catalog starts in December and ends in January, retaining real as-of date", async () => {
  const requests: { month: string; asOfDate: string }[] = [];
  const result = await scanRecommendationCatalog(async request => {
    requests.push(request);
    return { items: [], hasMore: false };
  }, { mediaType: 'anime', now: NOW, discoveryFilters: { year: 2025 }, maxMonthsPerRequest: 20, maxProviderRoundsPerRequest: 20 });
  assert.equal(requests[0]?.month, '2025-12');
  assert.equal(requests.at(-1)?.month, '2025-01');
  assert.equal(requests.length, 12);
  assert.ok(requests.every(request => request.asOfDate === '2026-07-10'));
  assert.equal(result.exhausted, true);
  const cursor = encodeRecommendationCursor(decodeRecommendationCursor(null, 'anime', NOW, { year: 2025 }));
  assert.throws(() => decodeRecommendationCursor(cursor, 'anime', NOW, { year: 2026 }), /INVALID_RECOMMENDATION_CURSOR/);
});
