import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compactResults,
  createSearchQueryVariants,
  filterResultsByCompactQuery
} from "./normalize.ts";
import type { SearchResult } from "./types.ts";

function result(
  titlePrimary: string,
  titleOriginal: string | null = null,
  overrides: Partial<SearchResult> = {}
): SearchResult {
  return {
    external_source: "tmdb",
    external_id: titlePrimary,
    content_type: "kdrama",
    title_primary: titlePrimary,
    title_original: titleOriginal,
    poster_url: null,
    overview: null,
    air_year: null,
    has_seasons: true,
    episode_count: null,
    ...overrides
  };
}

describe("search query normalization", () => {
  it("adds Korean spacing and compact-title fallback variants", () => {
    const variants = createSearchQueryVariants("신사의품격");

    assert.deepEqual(
      variants.map((variant) => [variant.query, variant.matchMode]),
      [
        ["신사의품격", "direct"],
        ["신사의 품격", "direct"],
        ["신사의", "compact-title"]
      ]
    );
  });

  it("adds anchor variants for Korean titles without particles", () => {
    const variants = createSearchQueryVariants("오징어게임");

    assert(variants.some((variant) => variant.query === "오징어" && variant.matchMode === "compact-title"));
  });

  it("filters fallback results by comparing titles without spaces", () => {
    const filtered = filterResultsByCompactQuery(
      [result("신사의 품격"), result("신사와 아가씨"), result("A Gentleman's Dignity", "신사의 품격")],
      "신사의품격"
    );

    assert.deepEqual(
      filtered.map((item) => item.title_primary),
      ["신사의 품격", "A Gentleman's Dignity"]
    );
  });

  it("compacts the same anime returned by TMDB and AniList into one result", () => {
    const compacted = compactResults([
      result("용사 파티에서 쫓겨난 다재무능", null, {
        external_source: "tmdb",
        external_id: "123",
        content_type: "anime",
        air_year: 2026
      }),
      result("용사 파티에서 쫓겨난 다재무능", null, {
        external_source: "anilist",
        external_id: "456",
        content_type: "anime",
        air_year: 2026
      })
    ]);

    assert.equal(compacted.length, 1);
    assert.equal(compacted[0]?.external_source, "anilist");
    assert.equal(compacted[0]?.duplicate_hint, true);
  });

  it("keeps works with the same title but different years separate", () => {
    const compacted = compactResults([
      result("신사의 품격", null, { external_id: "2012", air_year: 2012 }),
      result("신사의 품격", null, { external_id: "2026", air_year: 2026 })
    ]);

    assert.equal(compacted.length, 2);
  });
});
