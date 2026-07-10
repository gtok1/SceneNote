import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PersonalizedRecommendation } from "@/services/personalizedRecommendations";
import {
  buildPersonalizedReason,
  buildRatingPresentation,
  buildRecommendationHook,
  buildReleaseMetadata,
  buildReleaseStatusLabel,
  cleanOfficialOverview,
  chooseRecommendationOverview,
  mapRecommendationToCardViewModel
} from "@/utils/recommendationPresentation";

function recommendation(overrides: Partial<PersonalizedRecommendation> = {}): PersonalizedRecommendation {
  return {
    external_source: "anilist",
    external_id: "1",
    content_type: "anime",
    title_primary: "추천 작품",
    title_original: null,
    poster_url: null,
    overview: null,
    air_year: 2026,
    air_date: "2026-07-01",
    has_seasons: true,
    episode_count: 12,
    genres: ["Drama"],
    canonical_id: "anilist:1",
    similarity_score: 0.5,
    recommendation_reason: "",
    category: "anime",
    rank: 30,
    trend_source: "2026-07 AniList 인기순",
    ...overrides
  };
}

describe("recommendation overview presentation", () => {
  it("removes HTML, markdown, extra line breaks, and a generic Korean lead-in", () => {
    assert.equal(
      cleanOfficialOverview("<p>이 작품은 **서로 다른 두 사람**이<br>비밀을 좇는다.</p>"),
      "서로 다른 두 사람이 비밀을 좇는다."
    );
  });

  it("limits a long official overview without adding facts outside the source", () => {
    const source = "낯선 도시로 이사 온 주인공은 오래된 극장에서 발견한 기록을 따라 잊힌 사건의 흔적을 좇기 시작한다. 서로 다른 목적을 가진 동료들과 단서를 모으며 도시가 감춰 온 비밀에 다가간다. 마지막 문장은 카드에 필요하지 않은 추가 설명이다.";
    const hook = buildRecommendationHook(recommendation({ overview: source }));

    assert(hook);
    assert(hook.length <= 131);
    assert.equal(source.startsWith(hook.replace(/…$/u, "")), true);
  });

  it("uses only available metadata for a missing-overview fallback and remains null without signals", () => {
    assert.equal(
      buildRecommendationHook(recommendation({ genres: ["Slice of Life"], format: "TV", release_status: "RELEASING" })),
      "일상 · TV 시리즈 · 방영 중 작품"
    );
    assert.equal(
      buildRecommendationHook(recommendation({ genres: [], format: null, studios: [], release_status: null })),
      null
    );
  });
});

describe("personalized reason presentation", () => {
  it("uses an actual library title for shared people, studio, and multiple-tag signals", () => {
    const item = recommendation();
    assert.equal(
      buildPersonalizedReason(item, [{ type: "shared_people", values: ["김성우"], library_titles: ["작품 A"] }]),
      "‘작품 A’와 김성우 참여진이 같아요."
    );
    assert.equal(
      buildPersonalizedReason(item, [{ type: "shared_studios", values: ["Studio A"], library_titles: ["작품 B"] }]),
      "‘작품 B’와 같은 Studio A 제작 작품이에요."
    );
    assert.equal(
      buildPersonalizedReason(item, [{ type: "shared_keywords", values: ["Youth", "Growth"], library_titles: ["작품 C"] }]),
      "‘작품 C’와 핵심 태그 2개가 겹쳐요."
    );
  });

  it("translates English genre names and uses no more than two library titles", () => {
    assert.equal(
      buildPersonalizedReason(recommendation(), [{
        type: "shared_genres",
        values: ["Comedy", "Coming of Age"],
        library_titles: ["작품 A", "작품 B", "작품 C"]
      }]),
      "‘작품 A’, ‘작품 B’와 코미디·성장 장르가 겹쳐요."
    );
  });

  it("does not claim popularity without popularity evidence and hides an unsupported reason", () => {
    const recent = buildPersonalizedReason(recommendation({ rank: 30, popularity_count: null }), []);
    assert.equal(recent, "최근 공개된 드라마 작품이에요.");
    assert.equal(recent?.includes("인기"), false);
    assert.equal(
      buildPersonalizedReason(recommendation({ air_date: null, air_year: null, rank: 30, genres: [] }), []),
      null
    );
  });

  it("does not expose an English anime overview when Korean metadata is unavailable", () => {
    assert.equal(
      chooseRecommendationOverview("anime", "An English synopsis for the anime."),
      null
    );
    assert.equal(
      chooseRecommendationOverview("anime", "An English synopsis.", "한국어로 제공된 공식 줄거리입니다."),
      "한국어로 제공된 공식 줄거리입니다."
    );
    assert.equal(
      buildRecommendationHook(recommendation({
        overview: "An English synopsis for the anime.",
        genres: ["Comedy", "Slice of Life"],
        format: "TV"
      })),
      "코미디 · 일상 · TV 시리즈 작품"
    );
  });
});

describe("rating and release metadata presentation", () => {
  it("shows source-specific rating scales only with a sufficient sample", () => {
    assert.equal(
      buildRatingPresentation(recommendation({ rating_score: 8.14, rating_scale: 10, rating_count: 320 })),
      "평점 8.1 · 320명"
    );
    assert.equal(
      buildRatingPresentation(recommendation({ rating_score: 8.14, rating_scale: 10, rating_count: 3 })),
      null
    );
    assert.equal(
      buildRatingPresentation(recommendation({ rating_score: 81, rating_scale: 100, rating_count: 2_000 })),
      "평점 81%"
    );
    assert.equal(buildRatingPresentation(recommendation({ rating_score: null })), null);
  });

  it("translates release statuses and tolerates missing date and episode data", () => {
    assert.equal(buildReleaseStatusLabel("RELEASING"), "방영 중");
    assert.equal(buildReleaseStatusLabel("FINISHED"), "완결");
    assert.equal(buildReleaseStatusLabel("NOT_YET_RELEASED"), "공개 예정");
    assert.equal(
      buildReleaseMetadata(recommendation({ release_status: "FINISHED" })),
      "2026.07 공개 · 12화 · 완결"
    );
    assert.equal(
      buildReleaseMetadata(recommendation({ air_date: null, air_year: null, episode_count: null, release_status: null, format: null })),
      ""
    );
  });

  it("keeps source information out of primary card labels and available for quick view", () => {
    const presentation = mapRecommendationToCardViewModel(recommendation(), new Date("2026-07-10T00:00:00.000Z"));
    assert.equal(presentation.sourceLabel, "AniList");
    assert.equal(presentation.statusBadges.includes("신작"), true);
  });
});
