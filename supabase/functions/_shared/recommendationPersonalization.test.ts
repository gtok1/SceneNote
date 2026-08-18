import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyBatchDiversityConstraints,
  buildPreferenceProfile,
  calculateCandidateScore,
  calculatePreferenceEvidence,
  calculateSimilarity,
  classifyExplorationCandidate,
  createRecommendationIdentity,
  rankCandidates,
  RECOMMENDATION_DIVERSITY_CONFIG,
  type RecommendationCandidate,
  type RecommendationFeedback,
  type RecommendationLibraryItem
} from "./recommendationEngine.ts";
import { normalizeContentThemes, type SourceContentTag } from "./recommendationThemes.ts";

const BL_TAG = { name: "Boys' Love", source: "anilist", rank: 90 } as const;
const REVENGE_TAG = { name: "Revenge", source: "anilist", rank: 88 } as const;

describe("content theme normalization", () => {
  it("maps provider aliases to canonical themes and preserves AniList rank as centrality", () => {
    const themes = normalizeContentThemes({
      external_source: "anilist",
      source_tags: [BL_TAG, { name: "Yaoi", source: "anilist", rank: 70 }]
    });
    assert.equal(themes.length, 1);
    assert.equal(themes[0]?.key, "boys-love");
    assert.equal(themes[0]?.centrality, 0.9);
  });

  it("keeps unranked provider keywords below central-theme confidence", () => {
    const theme = normalizeContentThemes({ external_source: "tmdb", keywords: ["Courtroom"] })[0];
    assert.equal(theme?.key, "legal");
    assert.equal(theme?.centrality, 0.45);
  });

  it("is null-safe and does not invent themes", () => {
    assert.deepEqual(normalizeContentThemes({ genres: null, keywords: null, source_tags: null }), []);
  });

  it("uses specific genres as lower-centrality themes and ignores broad genres", () => {
    const themes = normalizeContentThemes({ external_source: "tmdb", genres: ["Medical", "Drama"] });
    assert.deepEqual(themes.map((theme) => [theme.key, theme.centrality]), [["medical", 0.3]]);
  });
});

describe("three-state preference evidence", () => {
  it("keeps an unseen niche theme unknown instead of positive or negative", () => {
    const profile = buildPreferenceProfile(generalLibrary());
    const evidence = calculatePreferenceEvidence(profile, themedCandidate("unknown", BL_TAG))[0];
    assert.equal(evidence?.state, "unknown");
    assert.equal(evidence?.strength, "none");
  });

  it("treats one low-centrality library work as weak evidence", () => {
    const profile = buildPreferenceProfile([themedLibrary("one", { ...BL_TAG, rank: 35 })]);
    const evidence = calculatePreferenceEvidence(profile, themedCandidate("candidate", BL_TAG))[0];
    assert.equal(evidence?.state, "positive");
    assert.equal(evidence?.strength, "weak");
  });

  it("allows two central works to become strong evidence", () => {
    const profile = buildPreferenceProfile([
      themedLibrary("one", BL_TAG),
      themedLibrary("two", { ...BL_TAG, rank: 85 })
    ]);
    assert.equal(calculatePreferenceEvidence(profile, themedCandidate("candidate", BL_TAG))[0]?.strength, "strong");
  });

  it("applies less as explicit negative content-theme evidence", () => {
    const profile = buildPreferenceProfile([], [themeFeedback("less")]);
    const evidence = calculatePreferenceEvidence(profile, themedCandidate("candidate", BL_TAG))[0];
    assert.equal(evidence?.state, "negative");
    assert.equal(evidence?.strength, "reduced");
  });

  it("applies more as explicit strong positive evidence", () => {
    const profile = buildPreferenceProfile([], [themeFeedback("more")]);
    const evidence = calculatePreferenceEvidence(profile, themedCandidate("candidate", BL_TAG))[0];
    assert.equal(evidence?.state, "positive");
    assert.equal(evidence?.strength, "strong");
    assert.equal(evidence?.explicit, true);
  });

  it("never creates identity or sexual-orientation profile fields", () => {
    const profile = buildPreferenceProfile([]) as unknown as Record<string, unknown>;
    assert.equal("sexualOrientation" in profile, false);
    assert.equal("presumedIdentity" in profile, false);
    assert.equal("inferredLGBTPreference" in profile, false);
  });
});

describe("candidate scoring and reasons", () => {
  it("keeps Drama and Comedy alone as a low personalization score", () => {
    const profile = buildPreferenceProfile(generalLibrary());
    const score = calculateSimilarity(profile, candidate("broad", { genres: ["Drama", "Comedy"] }));
    assert(score <= 0.15);
  });

  it("ranks repeated specific tags and themes above broad genres", () => {
    const profile = buildPreferenceProfile([
      themedLibrary("one", REVENGE_TAG),
      themedLibrary("two", REVENGE_TAG)
    ]);
    const specific = themedCandidate("specific", REVENGE_TAG);
    const broad = candidate("broad", { genres: ["Drama", "Comedy"] });
    assert(calculateSimilarity(profile, specific) > calculateSimilarity(profile, broad));
  });

  it("classifies a popular unknown-theme candidate as exploration", () => {
    const profile = buildPreferenceProfile(generalLibrary());
    const item = themedCandidate("popular", BL_TAG, { popularity: 100 });
    assert.equal(classifyExplorationCandidate(profile, item), true);
    assert(calculateCandidateScore(profile, item).popularity > 0);
  });

  it("uses an exploration reason without unsupported preference claims", () => {
    const ranked = rankCandidates(buildPreferenceProfile(generalLibrary()), [themedCandidate("unknown", BL_TAG)], { libraryItems: generalLibrary() });
    assert.equal(ranked[0]?.recommendation_reason_detail.label, "취향 탐색");
    assert.equal(ranked[0]?.recommendation_reason.includes("자주 선택한"), false);
    assert.deepEqual(ranked[0]?.recommendation_reason_detail.source_content_ids, []);
  });

  it("names a real library title for a verified theme match", () => {
    const library = [themedLibrary("anchor", REVENGE_TAG, "복수의 밤")];
    const ranked = rankCandidates(buildPreferenceProfile(library), [themedCandidate("match", REVENGE_TAG)], { libraryItems: library });
    assert(ranked[0]?.recommendation_reason.includes("복수의 밤"));
    assert((ranked[0]?.recommendation_reason_detail.source_content_ids.length ?? 0) > 0);
    assert(ranked[0]?.recommendation_reason.includes("복수극"));
    assert.equal(ranked[0]?.recommendation_reason.includes("narrative:revenge"), false);
    assert.deepEqual(ranked[0]?.recommendation_reason_detail.signals.map((signal) => signal.value), ["복수극"]);
    assert.deepEqual(ranked[0]?.recommendation_reason_detail.signals.map((signal) => signal.key), ["narrative:revenge"]);
  });

  it("does not rank equivalent anime and drama differently because optional metadata is absent", () => {
    // Only AniList candidates carry provider tags; TMDB catalog rows never do. The two
    // must stay comparable, so the anime here is tagged and the drama deliberately is not.
    // The library is content-type balanced so the format signal cannot explain a gap.
    const profile = buildPreferenceProfile([
      { ...generalLibrary()[0], genres: ["Crime"] },
      { ...generalLibrary()[2], genres: ["Crime"] }
    ]);
    const anime = themedCandidate("anime", REVENGE_TAG, { content_type: "anime", genres: ["Crime"] });
    const drama = candidate("drama", { external_source: "tmdb", content_type: "kdrama", genres: ["Crime"] });
    assert.equal(calculateSimilarity(profile, anime), calculateSimilarity(profile, drama));
  });

  it("never penalizes a candidate for carrying theme metadata the profile cannot judge", () => {
    const profile = buildPreferenceProfile(generalLibrary());
    assert.equal(profile.theme_evidence.size, 0);
    const withTheme = themedCandidate("tagged", REVENGE_TAG, { genres: ["Crime"] });
    const withoutTheme = candidate("untagged", { genres: ["Crime"] });
    assert.equal(calculateSimilarity(profile, withTheme), calculateSimilarity(profile, withoutTheme));
  });

  it("scores a fully matched theme the same whichever provider supplied it", () => {
    // centrality is not comparable across sources: AniList ranks span 0.4-1.0, TMDB
    // keywords are a flat 0.45 and genre backfill a flat 0.3. It must weight how much a
    // theme counts toward the average, not cap how well a match can score.
    const profile = buildPreferenceProfile([themedLibrary("one", REVENGE_TAG)]);
    const fromAniList = themedCandidate("anilist", REVENGE_TAG, { keywords: null });
    const fromTmdb = themedCandidate("tmdb", { name: "Revenge", source: "tmdb", rank: null }, {
      external_source: "tmdb",
      keywords: null
    });
    assert.equal(calculateSimilarity(profile, fromAniList), calculateSimilarity(profile, fromTmdb));
  });

  it("scores a matching library theme above the same candidate without theme metadata", () => {
    const profile = buildPreferenceProfile([themedLibrary("one", REVENGE_TAG)]);
    // keywords are cleared on both sides so the theme signal is the only difference.
    const matching = themedCandidate("matching", REVENGE_TAG, { keywords: null });
    const untagged = candidate("untagged", { keywords: null });
    assert(calculateSimilarity(profile, matching) > calculateSimilarity(profile, untagged));
  });

  it("preserves negative final scores for explicitly excluded content", () => {
    const excluded = candidate("excluded");
    const profile = buildPreferenceProfile(generalLibrary(), [{
      target_type: "content",
      target_key: createRecommendationIdentity(excluded),
      action: "exclude"
    }]);
    assert(calculateCandidateScore(profile, excluded).final_score < 0);
  });
});

describe("niche-theme batch diversity", () => {
  it("lets twelve different unknown themes fill the same batch", () => {
    const profile = buildPreferenceProfile(generalLibrary());
    const names = ["Revenge", "Isekai", "Survival", "School", "Time Travel", "Psychological", "Military", "Dystopia", "Detective", "Coming of Age", "Medical", "Legal"];
    const candidates = names.map((name, index) => themedCandidate(`distinct-${index}`, { name, source: "anilist", rank: 80 }));
    const selected = applyBatchDiversityConstraints(rankCandidates(profile, candidates), 12, profile, RECOMMENDATION_DIVERSITY_CONFIG, false);
    assert.equal(selected.length, 12);
  });
  it("limits six unknown candidates of one niche theme to one in a twelve-item batch", () => {
    const profile = buildPreferenceProfile(generalLibrary());
    const candidates = [
      ...Array.from({ length: 6 }, (_, index) => themedCandidate(`bl-${index}`, BL_TAG, { popularity: 100 - index })),
      ...Array.from({ length: 20 }, (_, index) => candidate(`general-${index}`, { genres: ["Crime", `Specific ${index}`], popularity: 80 - index }))
    ];
    const selected = applyBatchDiversityConstraints(
      rankCandidates(profile, candidates),
      12,
      profile,
      RECOMMENDATION_DIVERSITY_CONFIG,
      false
    );
    assert.equal(selected.length, 12);
    assert.equal(selected.filter((item) => item.themes.some((theme) => theme.key === "boys-love")).length, 1);
  });

  it("uses the configured weak and strong caps", () => {
    const candidates = Array.from({ length: 6 }, (_, index) => themedCandidate(`theme-${index}`, BL_TAG));
    const weak = buildPreferenceProfile([themedLibrary("one", BL_TAG)]);
    const strong = buildPreferenceProfile([themedLibrary("one", BL_TAG), themedLibrary("two", BL_TAG)]);
    assert.equal(applyBatchDiversityConstraints(rankCandidates(weak, candidates), 12, weak).length, RECOMMENDATION_DIVERSITY_CONFIG.weakNicheThemeCap);
    assert.equal(applyBatchDiversityConstraints(rankCandidates(strong, candidates), 12, strong).length, RECOMMENDATION_DIVERSITY_CONFIG.strongNicheThemeCap);
  });

  it("returns no excluded-theme candidates", () => {
    const profile = buildPreferenceProfile([], [themeFeedback("exclude")]);
    const ranked = rankCandidates(profile, Array.from({ length: 3 }, (_, index) => themedCandidate(`excluded-${index}`, BL_TAG)));
    assert.equal(applyBatchDiversityConstraints(ranked, 12, profile).length, 0);
  });

  it("applies the same policy to a non-relationship niche theme", () => {
    const profile = buildPreferenceProfile(generalLibrary());
    const ranked = rankCandidates(profile, Array.from({ length: 4 }, (_, index) => themedCandidate(`revenge-${index}`, REVENGE_TAG)));
    assert.equal(applyBatchDiversityConstraints(ranked, 12, profile).length, 1);
  });
});

function candidate(id: string, overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    external_source: "anilist",
    external_id: id,
    content_type: "anime",
    title_primary: `작품 ${id}`,
    air_year: 2026,
    air_date: "2026-07-01",
    genres: ["Drama"],
    popularity: 50,
    ...overrides
  };
}

function themedCandidate(id: string, tag: SourceContentTag, overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return candidate(id, { source_tags: [tag], keywords: [tag.name], ...overrides });
}

function themedLibrary(id: string, tag: SourceContentTag, title = `라이브러리 ${id}`): RecommendationLibraryItem {
  return {
    content_id: id,
    source_api: "anilist",
    source_id: id,
    content_type: "anime",
    title_primary: title,
    genres: ["Drama"],
    source_tags: [tag],
    keywords: [tag.name],
    status: "completed"
  };
}

function generalLibrary(): RecommendationLibraryItem[] {
  return [
    { content_id: "comedy-1", content_type: "kdrama", title_primary: "가족 코미디", genres: ["Drama", "Comedy"], status: "completed" },
    { content_id: "crime-1", content_type: "kdrama", title_primary: "범죄 수사", genres: ["Drama", "Crime"], status: "completed" },
    { content_id: "sf-1", content_type: "anime", title_primary: "우주 액션", genres: ["Science Fiction", "Action"], status: "completed" }
  ];
}

function themeFeedback(action: RecommendationFeedback["action"]): RecommendationFeedback {
  return { target_type: "theme", target_key: "relationship:boys-love", action, source_content_id: "source" };
}
