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
