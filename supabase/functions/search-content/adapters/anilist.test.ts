import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addKoreanSearchAlias,
  applySeasonDisplayTitle,
  dedupeAniListSearchMediaItems,
  expandDirectSeasonRelations,
  resolveSeasonFromRelations,
  selectTmdbAnimeSearchTranslation,
  type AniListMedia
} from "./anilist.ts";
import type { SearchResult } from "./types.ts";

function media(
  id: number,
  format: string,
  year: number,
  relations: AniListMedia["relations"] = { edges: [] }
): AniListMedia {
  return {
    id,
    type: "ANIME",
    format,
    startDate: { year, month: 1, day: 1 },
    title: { romaji: `Anime ${id}` },
    relations
  };
}

function sequel(node: AniListMedia) {
  return { relationType: "SEQUEL", node };
}

describe("resolveSeasonFromRelations", () => {
  it("resolves the measured first-to-second-season relation", () => {
    const second = media(194829, "TV", 2026);
    const first = media(179955, "TV", 2025, { edges: [sequel(second)] });

    assert.equal(resolveSeasonFromRelations(first, 2)?.id, 194829);
  });

  it("returns null when the sequel chain is too short", () => {
    const second = media(194829, "TV", 2026);
    const first = media(179955, "TV", 2025, { edges: [sequel(second)] });

    assert.equal(resolveSeasonFromRelations(first, 3), null);
  });

  it("skips movie sequels and chooses the next TV sequel", () => {
    const movie = media(200000, "MOVIE", 2025);
    const second = media(194829, "TV", 2026);
    const first = media(179955, "TV", 2025, { edges: [sequel(movie), sequel(second)] });

    assert.equal(resolveSeasonFromRelations(first, 2)?.id, 194829);
  });

  it("traverses a movie between the base and second TV season", () => {
    const second = media(135865, "TV", 2026);
    const movie = media(100878, "MOVIE", 2019, { edges: [sequel(second)] });
    const first = media(21613, "TV", 2017, { edges: [sequel(movie)] });

    assert.equal(resolveSeasonFromRelations(first, 2)?.id, 135865);
  });

  it("returns null when a relation cycle is encountered", () => {
    const first = media(1, "TV", 2025);
    const second = media(2, "TV", 2026);
    first.relations = { edges: [sequel(second)] };
    second.relations = { edges: [sequel(first)] };

    assert.equal(resolveSeasonFromRelations(first, 3), null);
  });
});

describe("Korean AniList search translation", () => {
  const auditedCases = [
    ["여성향 게임 세계는 모브에게 가혹한 세계입니다", "乙女ゲー世界はモブに厳しい世界です", "乙女ゲー世界はモブに厳しい世界です"],
    ["해골기사님은 지금 이세계 모험 중", "骸骨騎士様、只今異世界へお出掛け中", "骸骨騎士様、只今異世界へお出掛け中"],
    ["클레바테스", "クレバテス-魔獣の王と赤子と屍の勇者", "クレバテス-魔獣の王と赤子と屍の勇者"],
    ["헬 모드 ~파고들기 좋아하는 게이머는 폐급 설정 이세계에서 무쌍한다~", "ヘルモード ～やり込み好きのゲーマーは廃設定の異世界で無双する～ はじまりの召喚士", "ヘルモード ～やり込み好きのゲーマーは廃設定の異世界で無双する～"],
    ["도망을 잘 치는 도련님", "逃げ上手の若君", "逃げ上手の若君"],
    ["유녀전기", "幼女戦記", "幼女戦記"]
  ] as const;

  for (const [koreanTitle, originalTitle, expectedQuery] of auditedCases) {
    it(`uses the verified TMDB original title for ${koreanTitle}`, () => {
      assert.deepEqual(
        selectTmdbAnimeSearchTranslation(koreanTitle, [{
          name: koreanTitle,
          original_name: originalTitle,
          genre_ids: [16, 10759]
        }]),
        { query: expectedQuery, koreanTitle }
      );
    });
  }

  it("rejects a non-animation TMDB title", () => {
    assert.equal(
      selectTmdbAnimeSearchTranslation("한국 드라마", [{
        name: "한국 드라마",
        original_name: "Korean Drama",
        genre_ids: [18]
      }]),
      null
    );
  });

  it("adds the Korean title only to the first AniList match", () => {
    const first = media(142074, "TV", 2022);
    const unrelated = media(999999, "TV", 2022);
    const updated = addKoreanSearchAlias([first, unrelated], "여성향 게임 세계는 모브에게 가혹한 세계입니다");

    assert.deepEqual(updated[0]?.synonyms, ["여성향 게임 세계는 모브에게 가혹한 세계입니다"]);
    assert.equal(updated[1], unrelated);
  });
});

describe("expandDirectSeasonRelations", () => {
  it("includes the immediate sequel for a base-title search", () => {
    const second = media(194829, "TV", 2026);
    const first = {
      ...media(179955, "TV", 2025, { edges: [sequel(second)] }),
      synonyms: ["촌구석 아저씨, 검성이 되다"]
    };

    assert.deepEqual(
      expandDirectSeasonRelations([first]).map(({ item, seasonNumber }) => ({ id: item.id, seasonNumber })),
      [
        { id: 179955, seasonNumber: undefined },
        { id: 194829, seasonNumber: 2 }
      ]
    );
  });

  it("does not relabel a sequel search result as season two", () => {
    const first = media(179955, "TV", 2025);
    const second = media(194829, "TV", 2026, {
      edges: [{ relationType: "PREQUEL", node: first }]
    });

    assert.deepEqual(
      expandDirectSeasonRelations([second]).map(({ item, seasonNumber }) => ({ id: item.id, seasonNumber })),
      [{ id: 194829, seasonNumber: undefined }]
    );
  });
});

describe("dedupeAniListSearchMediaItems", () => {
  it("keeps the season-relation result when the same season is also returned directly", () => {
    const base = media(179955, "TV", 2025);
    const second = media(194829, "TV", 2026);
    const resolved = { item: second, base, resolved: true, seasonNumber: 2 };

    assert.deepEqual(
      dedupeAniListSearchMediaItems([
        resolved,
        { item: second, base: second, resolved: false }
      ]),
      [resolved]
    );
  });
});

describe("applySeasonDisplayTitle", () => {
  const result: SearchResult = {
    external_source: "anilist",
    external_id: "194829",
    content_type: "anime",
    title_primary: "Katainaka no Ossan, Kensei ni Naru II",
    title_original: null,
    poster_url: null,
    overview: null,
    air_year: 2026,
    has_seasons: true,
    episode_count: 12
  };

  it("prefers a Korean title supplied for the resolved season", () => {
    const base = { ...media(179955, "TV", 2025), synonyms: ["촌구석 아저씨, 검성이 되다"] };
    const season = { ...media(194829, "TV", 2026), synonyms: ["촌구석 아저씨, 검성이 되다 2기"] };

    assert.deepEqual(applySeasonDisplayTitle(result, season, base, 2), {
      ...result,
      title_primary: "촌구석 아저씨, 검성이 되다 2기"
    });
  });

  it("synthesizes a season title from the base Korean title", () => {
    const base = { ...media(179955, "TV", 2025), synonyms: ["촌구석 아저씨, 검성이 되다"] };
    const season = { ...media(194829, "TV", 2026), synonyms: [] };

    assert.deepEqual(applySeasonDisplayTitle(result, season, base, 2), {
      ...result,
      title_primary: "촌구석 아저씨, 검성이 되다 2기",
      title_is_synthesized: true
    });
  });

  it("keeps the original title when no Korean title is available", () => {
    assert.deepEqual(
      applySeasonDisplayTitle(result, media(194829, "TV", 2026), media(179955, "TV", 2025), 2),
      result
    );
  });
});
