import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPreferenceProfile,
  calculateSimilarity,
  createExternalRecommendationKey,
  createRecommendationIdentity,
  createRecommendationIdentityAliases,
  createRecommendationSignals,
  getRecommendationBatch,
  rankCandidates,
  type RecommendationCandidate,
  type RecommendationLibraryItem
} from "./recommendationEngine.ts";

const NOW = "2026-07-10T00:00:00.000Z";

function candidate(id: string, overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    external_source: "tmdb",
    external_id: id,
    content_type: "kdrama",
    title_primary: `작품 ${id}`,
    title_original: null,
    air_year: 2026,
    air_date: "2026-06-01",
    genres: ["Drama"],
    episode_count: 12,
    season_count: 1,
    popularity: 10,
    rank: 1,
    ...overrides
  };
}

function libraryItem(overrides: Partial<RecommendationLibraryItem> = {}): RecommendationLibraryItem {
  return {
    content_id: "library-1",
    source_api: "tmdb",
    source_id: "library-source-1",
    content_type: "kdrama",
    title_primary: "등록 작품",
    title_original: null,
    air_year: 2024,
    air_date: "2024-01-01",
    genres: ["Mystery", "Thriller"],
    episode_count: 12,
    season_count: 1,
    status: "completed",
    status_flags: ["completed"],
    watch_count: 1,
    ...overrides
  };
}

describe("preference profile and similarity", () => {
  it("uses cold-start, light, and personalized modes at 0, 1-2, and 3+ library items", () => {
    assert.equal(buildPreferenceProfile([]).mode, "cold_start");
    assert.equal(buildPreferenceProfile([libraryItem()]).mode, "light");
    assert.equal(buildPreferenceProfile([libraryItem(), libraryItem({ content_id: "2" })]).mode, "light");
    assert.equal(
      buildPreferenceProfile([
        libraryItem(),
        libraryItem({ content_id: "2" }),
        libraryItem({ content_id: "3" })
      ]).mode,
      "personalized"
    );
  });

  it("makes genre the strongest signal and normalizes over signals that are actually available", () => {
    const profile = buildPreferenceProfile([
      libraryItem({ genres: ["Mystery"], content_type: "kdrama" }),
      libraryItem({ content_id: "2", genres: ["Mystery"], content_type: "kdrama" }),
      libraryItem({ content_id: "3", genres: ["Romance"], content_type: "anime" })
    ]);
    const genreMatch = calculateSimilarity(
      profile,
      candidate("genre", { genres: ["Mystery"], content_type: "anime", episode_count: null, season_count: null })
    );
    const typeOnly = calculateSimilarity(
      profile,
      candidate("type", { genres: ["Comedy"], content_type: "kdrama", episode_count: null, season_count: null })
    );

    assert(genreMatch > typeOnly);
    assert(genreMatch >= 0 && genreMatch <= 1);
  });

  it("is null-safe when optional candidate and library metadata is absent", () => {
    const profile = buildPreferenceProfile([
      {
        content_type: null,
        title_primary: null,
        genres: null,
        status_flags: null,
        watch_count: null
      }
    ]);
    const score = calculateSimilarity(
      profile,
      candidate("nulls", {
        genres: null,
        episode_count: null,
        season_count: null,
        air_year: null,
        air_date: null,
        popularity: null,
        rank: null
      })
    );

    assert.equal(Number.isFinite(score), true);
  });
});

describe("identity and exclusions", () => {
  it("creates a normalized source:id external key", () => {
    assert.equal(
      createExternalRecommendationKey(candidate(" 123 ", { external_source: "TMDB" })),
      "tmdb:123"
    );
  });

  it("gives the same title/year/type identity to the same work from different sources", () => {
    const tmdb = candidate("10", { title_primary: "비밀의 숲", air_year: 2020 });
    const anilist = candidate("20", {
      external_source: "anilist",
      content_type: "kdrama",
      title_primary: "비밀의 숲",
      air_year: 2020
    });

    assert.equal(createRecommendationIdentity(tmdb), createRecommendationIdentity(anilist));
  });

  it("excludes library works by exact external ID and by cross-source title/year/type identity", () => {
    const exact = candidate("already-added");
    const crossSource = candidate("anilist-id", {
      external_source: "anilist",
      content_type: "anime",
      title_primary: "같은 애니",
      title_original: "同じアニメ",
      air_year: 2025
    });
    const items = [
      libraryItem({ source_api: "tmdb", source_id: "already-added" }),
      libraryItem({
        content_id: "anime-library",
        source_api: "tmdb",
        source_id: "tmdb-anime-id",
        content_type: "anime",
        title_primary: "같은 애니",
        title_original: "同じアニメ",
        air_year: 2025
      })
    ];
    const batch = getRecommendationBatch(items, [exact, crossSource, candidate("new")], {
      limit: 12,
      now: NOW
    });

    assert.deepEqual(batch.items.map((item) => item.external_id), ["new"]);
  });

  it("excludes current recommendation IDs and session-seen IDs while unseen candidates remain", () => {
    const current = candidate("current");
    const seen = candidate("seen");
    const unseen = candidate("unseen");
    const secondUnseen = candidate("second-unseen");
    const batch = getRecommendationBatch([], [current, seen, unseen, secondUnseen], {
      limit: 2,
      excludeIds: [createRecommendationIdentity(current)],
      sessionSeenIds: [createRecommendationIdentity(seen)],
      now: NOW
    });

    assert.deepEqual(batch.items.map((item) => item.external_id), ["unseen", "second-unseen"]);
  });

  it("deduplicates the same work inside one batch across external sources", () => {
    const first = candidate("tmdb-one", { title_primary: "중복 작품", air_year: 2026 });
    const duplicate = candidate("anilist-one", {
      external_source: "anilist",
      title_primary: "중복 작품",
      air_year: 2026
    });
    const batch = getRecommendationBatch([], [first, duplicate, candidate("unique")], {
      limit: 12,
      now: NOW
    });

    assert.equal(batch.items.filter((item) => item.title_primary === "중복 작품").length, 1);
    assert.equal(batch.items.length, 2);
  });

  it("deduplicates matching titles when one source has no release year and keeps year-specific identities", () => {
    const unknownYear = candidate("unknown-year", {
      external_source: "anilist",
      title_primary: "연도 없는 작품",
      air_year: null,
      air_date: null
    });
    const knownYear = candidate("known-year", {
      title_primary: "연도 없는 작품",
      air_year: 2026
    });
    const remake = candidate("remake", {
      title_primary: "연도 없는 작품",
      air_year: 2020,
      air_date: "2020-01-01"
    });
    const batch = getRecommendationBatch([], [unknownYear, knownYear], {
      limit: 12,
      now: NOW
    });

    assert.equal(batch.items.length, 1);
    assert.notEqual(createRecommendationIdentity(knownYear), createRecommendationIdentity(remake));
  });
});

describe("ranking and media filters", () => {
  const profile = buildPreferenceProfile([
    libraryItem(),
    libraryItem({ content_id: "2" }),
    libraryItem({ content_id: "3" })
  ]);

  it("sorts fitting candidates by release date descending before similarity", () => {
    const ranked = rankCandidates(profile, [
      candidate("older", { genres: ["Mystery"], air_date: "2025-12-01" }),
      candidate("newer", { genres: ["Mystery", "Comedy"], air_date: "2026-05-01" })
    ]);

    assert.deepEqual(ranked.map((item) => item.external_id), ["newer", "older"]);
  });

  it("uses similarity when release dates are identical", () => {
    const ranked = rankCandidates(profile, [
      candidate("weak", { genres: ["Mystery", "Comedy"], air_date: "2026-05-01" }),
      candidate("strong", { genres: ["Mystery"], air_date: "2026-05-01" })
    ]);

    assert.equal(ranked[0]?.external_id, "strong");
    assert((ranked[0]?.similarity_score ?? 0) > (ranked[1]?.similarity_score ?? 0));
  });

  it("uses popularity and then rank as stable tie-breakers", () => {
    const coldProfile = buildPreferenceProfile([]);
    const ranked = rankCandidates(coldProfile, [
      candidate("rank-low", { popularity: 10, rank: 5 }),
      candidate("popular", { popularity: 20, rank: 9 }),
      candidate("rank-high", { popularity: 10, rank: 1 })
    ]);

    assert.deepEqual(ranked.map((item) => item.external_id), ["popular", "rank-high", "rank-low"]);
  });

  it("puts candidates without a release date after dated candidates", () => {
    const ranked = rankCandidates(profile, [
      candidate("unknown-date", { air_date: null, air_year: 2026 }),
      candidate("known-date", { air_date: "2025-01-01", air_year: 2025 })
    ]);

    assert.equal(ranked[0]?.external_id, "known-date");
  });

  it("applies drama, anime, and movie filters", () => {
    const candidates = [
      candidate("kdrama", { content_type: "kdrama" }),
      candidate("jdrama", { content_type: "jdrama" }),
      candidate("anime", { content_type: "anime" }),
      candidate("movie", { content_type: "movie" })
    ];

    assert.deepEqual(
      rankCandidates(profile, candidates, { mediaType: "drama" }).map((item) => item.external_id),
      ["kdrama", "jdrama"]
    );
    assert.deepEqual(
      rankCandidates(profile, candidates, { mediaType: "anime" }).map((item) => item.external_id),
      ["anime"]
    );
    assert.deepEqual(
      rankCandidates(profile, candidates, { mediaType: "movie" }).map((item) => item.external_id),
      ["movie"]
    );
  });
});

describe("structured recommendation signals", () => {
  const items = [
    libraryItem({
      title_primary: "라이브러리 작품 A",
      people: ["Actor A"],
      studios: ["Studio A"],
      keywords: ["Youth", "Growth"],
      genres: ["Drama", "Coming of Age"]
    }),
    libraryItem({
      content_id: "library-2",
      title_primary: "라이브러리 작품 B",
      people: ["Actor A"],
      studios: ["Studio B"],
      keywords: ["Youth", "School"],
      genres: ["Drama", "Comedy"]
    })
  ];
  const profile = buildPreferenceProfile(items);

  it("prioritizes verified shared people over studio, tag, and genre matches", () => {
    const signals = createRecommendationSignals(profile, candidate("people", {
      people: ["Actor A"],
      studios: ["Studio A"],
      keywords: ["Youth", "Growth"],
      genres: ["Drama", "Coming of Age"]
    }), items);

    assert.deepEqual(signals[0], {
      type: "shared_people",
      values: ["Actor A"],
      library_titles: ["라이브러리 작품 A", "라이브러리 작품 B"]
    });
  });

  it("uses a verified studio match when no shared person exists", () => {
    const signals = createRecommendationSignals(profile, candidate("studio", {
      people: [],
      studios: ["Studio A"],
      keywords: [],
      genres: ["Mystery"]
    }), items);
    assert.equal(signals[0]?.type, "shared_studios");
    assert.deepEqual(signals[0]?.library_titles, ["라이브러리 작품 A"]);
  });

  it("requires multiple shared tags before naming a library work", () => {
    const oneTag = createRecommendationSignals(profile, candidate("one-tag", {
      people: [], studios: [], keywords: ["Youth"], genres: ["Mystery"]
    }), items);
    const twoTags = createRecommendationSignals(profile, candidate("two-tags", {
      people: [], studios: [], keywords: ["Youth", "Growth"], genres: ["Mystery"]
    }), items);

    assert.notEqual(oneTag[0]?.type, "shared_keywords");
    assert.equal(twoTags[0]?.type, "shared_keywords");
    assert.deepEqual(twoTags[0]?.library_titles, ["라이브러리 작품 A"]);
  });

  it("does not invent a popular fallback without rank or popularity data", () => {
    const signals = createRecommendationSignals(
      buildPreferenceProfile([]),
      candidate("plain", { popularity: null, popularity_count: null, rank: null }),
      []
    );
    assert.equal(signals[0]?.type, "latest");
  });
});

describe("window expansion, diversity, and refill behavior", () => {
  it("uses latest-popular fallback ordering with an empty library", () => {
    const batch = getRecommendationBatch(
      [],
      [
        candidate("older-popular", { air_date: "2026-01-01", popularity: 100 }),
        candidate("newer", { air_date: "2026-06-01", popularity: 1 })
      ],
      { limit: 2, now: NOW }
    );

    assert.equal(batch.profile_mode, "cold_start");
    assert.deepEqual(batch.items.map((item) => item.external_id), ["newer", "older-popular"]);
    assert(batch.items.every((item) => item.recommendation_reason.includes("최신")));
  });

  it("includes older candidates without a fixed release-window cutoff", () => {
    const batch = getRecommendationBatch(
      [],
      [
        candidate("recent", { air_date: "2026-06-01" }),
        candidate("twenty-months", { air_date: "2024-11-01", air_year: 2024 }),
        candidate("four-years", { air_date: "2022-08-01", air_year: 2022 })
      ],
      { limit: 3, now: NOW }
    );

    assert.equal(batch.broadened, true);
    assert.deepEqual(batch.items.map((item) => item.external_id), ["recent", "twenty-months", "four-years"]);
  });

  it("keeps at most one season from the same franchise", () => {
    const batch = getRecommendationBatch(
      [],
      [
        candidate("season-1", { title_primary: "미스터리 쇼 시즌 1" }),
        candidate("season-2", { title_primary: "미스터리 쇼 시즌 2" }),
        candidate("other", { title_primary: "다른 작품" })
      ],
      { limit: 3, now: NOW }
    );

    assert.equal(batch.items.filter((item) => item.title_primary.startsWith("미스터리 쇼")).length, 1);
    assert.equal(batch.items.some((item) => item.external_id === "other"), true);
  });

  it("prevents one primary genre from occupying the entire batch", () => {
    const candidates = Array.from({ length: 6 }, (_, index) =>
      candidate(`action-${index}`, { genres: ["Action"], title_primary: `액션 ${index}` })
    );
    candidates.push(candidate("romance", { genres: ["Romance"], title_primary: "로맨스" }));
    const batch = getRecommendationBatch([], candidates, { limit: 6, now: NOW });

    assert.equal(batch.items.length, 6);
    assert((batch.items.filter((item) => item.genres?.[0] === "Action").length ?? 0) < 6);
  });

  it("supports a limit=1 refill without returning current or already-seen candidates", () => {
    const current = candidate("current");
    const seen = candidate("seen");
    const refill = candidate("refill");
    const batch = getRecommendationBatch([], [current, seen, refill], {
      limit: 1,
      excludeIds: [createRecommendationIdentity(current)],
      sessionSeenIds: [createRecommendationIdentity(seen)],
      now: NOW
    });

    assert.deepEqual(batch.items.map((item) => item.external_id), ["refill"]);
  });

  it("does not double-skip when the client sends both cursor and session-seen IDs", () => {
    const candidates = Array.from({ length: 6 }, (_, index) =>
      candidate(`page-${index}`, {
        title_primary: `페이지 작품 ${index}`,
        genres: [`Genre ${index}`],
        popularity: 100 - index
      })
    );
    const first = getRecommendationBatch([], candidates, { limit: 3, now: NOW });
    const second = getRecommendationBatch([], candidates, {
      limit: 3,
      sessionSeenIds: first.items.map((item) => item.canonical_id),
      cursor: first.next_cursor,
      now: NOW
    });

    assert.deepEqual(first.items.map((item) => item.external_id), ["page-0", "page-1", "page-2"]);
    assert.deepEqual(second.items.map((item) => item.external_id), ["page-3", "page-4", "page-5"]);
  });

  it("does not double-skip when current exclusions accompany a cursor", () => {
    const candidates = Array.from({ length: 6 }, (_, index) =>
      candidate(`exclude-page-${index}`, {
        title_primary: `제외 페이지 작품 ${index}`,
        genres: [`Genre ${index}`],
        popularity: 100 - index
      })
    );
    const first = getRecommendationBatch([], candidates, { limit: 3, now: NOW });
    const second = getRecommendationBatch([], candidates, {
      limit: 3,
      excludeIds: first.items.map((item) => item.canonical_id),
      cursor: first.next_cursor,
      now: NOW
    });

    assert.deepEqual(second.items.map((item) => item.external_id), [
      "exclude-page-3",
      "exclude-page-4",
      "exclude-page-5"
    ]);
  });

  it("never re-exposes session-seen works when all unseen works are exhausted", () => {
    const oldest = candidate("oldest-seen");
    const newest = candidate("newest-seen");
    const batch = getRecommendationBatch([], [newest, oldest], {
      limit: 2,
      sessionSeenIds: [
        ...createRecommendationIdentityAliases(oldest),
        ...createRecommendationIdentityAliases(newest)
      ],
      now: NOW
    });

    assert.equal(batch.is_exhausted, true);
    assert.deepEqual(batch.items, []);
  });

  it("excludes a previously seen source ID even if its canonical title identity changes", () => {
    const firstExposure = candidate("stable-source-id", {
      title_primary: "첫 번째 번역 제목",
      title_original: null
    });
    const changedMetadata = candidate("stable-source-id", {
      title_primary: "Changed Localized Title",
      title_original: null
    });
    const batch = getRecommendationBatch([], [changedMetadata], {
      limit: 1,
      sessionSeenIds: createRecommendationIdentityAliases(firstExposure),
      now: NOW
    });

    assert.deepEqual(batch.items, []);
  });

  it("returns only the two unseen works instead of filling a refreshed batch with seen works", () => {
    const candidates = Array.from({ length: 14 }, (_, index) =>
      candidate(`refresh-${index + 1}`, {
        title_primary: `서로 다른 추천 ${index + 1}`,
        genres: [`Genre ${index + 1}`],
        popularity: 100 - index
      })
    );
    const first = getRecommendationBatch([], candidates, {
      limit: 12,
      now: NOW
    });
    const second = getRecommendationBatch([], candidates, {
      limit: 12,
      sessionSeenIds: first.items.flatMap(createRecommendationIdentityAliases),
      now: NOW
    });
    const firstIds = new Set(first.items.flatMap(createRecommendationIdentityAliases));
    const secondIds = new Set(second.items.flatMap(createRecommendationIdentityAliases));

    assert.equal(first.items.length, 12);
    assert.equal(second.items.length, 2);
    assert.equal([...secondIds].some((id) => firstIds.has(id)), false);
    assert.equal(second.is_exhausted, true);
  });

  it("does not refill a partial refresh with an older session-seen work", () => {
    const olderSeen = candidate("older-session-seen", { genres: ["Mystery"] });
    const current = candidate("current-card", { genres: ["Romance"] });
    const unseen = candidate("only-unseen", { genres: ["Thriller"] });
    const batch = getRecommendationBatch([], [olderSeen, current, unseen], {
      limit: 3,
      excludeIds: createRecommendationIdentityAliases(current),
      sessionSeenIds: [
        ...createRecommendationIdentityAliases(olderSeen),
        ...createRecommendationIdentityAliases(current)
      ],
      now: NOW
    });

    assert.deepEqual(batch.items.map((item) => item.external_id), ["only-unseen"]);
    assert.equal(batch.is_exhausted, true);
  });

  it("returns an exhausted empty batch safely when there are no candidates", () => {
    const batch = getRecommendationBatch([], [], { limit: 12, now: NOW });

    assert.deepEqual(batch.items, []);
    assert.equal(batch.is_exhausted, true);
    assert.equal(batch.next_cursor, null);
  });
});
