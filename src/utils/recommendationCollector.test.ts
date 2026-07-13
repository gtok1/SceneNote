import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectRecommendationPages,
  type RecommendationContinuationPage
} from "./recommendationCollector";

interface Item {
  id: string;
}

type Page = RecommendationContinuationPage<Item>;

describe("recommendation continuation collection", () => {
  it("keeps following an empty page while hasMore is true", async () => {
    const pages: Page[] = [
      { items: [], nextCursor: "older-month", hasMore: true, exhausted: false },
      { items: items(1, 12), nextCursor: "next", hasMore: true, exhausted: false }
    ];
    let call = 0;
    const result = await collectRecommendationPages(async () => pages[call++] as Page, options(12));

    assert.equal(result.items.length, 12);
    assert.equal(result.requestCount, 2);
  });

  it("combines partial pages and publishes one complete twelve-item result", async () => {
    const pages: Page[] = [
      { items: items(1, 5), nextCursor: "page-2", hasMore: true, exhausted: false },
      { items: items(6, 7), nextCursor: "page-3", hasMore: true, exhausted: false }
    ];
    let call = 0;
    const result = await collectRecommendationPages(async () => pages[call++] as Page, options(12));

    assert.deepEqual(result.items.map((item) => item.id), items(1, 12).map((item) => item.id));
  });

  it("deduplicates works across continuation responses", async () => {
    const pages: Page[] = [
      { items: items(1, 6), nextCursor: "page-2", hasMore: true, exhausted: false },
      { items: [...items(4, 3), ...items(7, 6)], nextCursor: "page-3", hasMore: true, exhausted: false }
    ];
    let call = 0;
    const result = await collectRecommendationPages(async () => pages[call++] as Page, options(12));

    assert.equal(new Set(result.items.map((item) => item.id)).size, 12);
  });

  it("refill continues into an older month until one unseen work is found", async () => {
    const pages: Page[] = [
      { items: [], nextCursor: "previous-month", hasMore: true, exhausted: false },
      { items: [{ id: "replacement" }], nextCursor: "after-replacement", hasMore: true, exhausted: false }
    ];
    let call = 0;
    const result = await collectRecommendationPages(async () => pages[call++] as Page, options(1));

    assert.deepEqual(result.items, [{ id: "replacement" }]);
  });

  it("returns fewer than twelve only when the catalog is actually exhausted", async () => {
    const result = await collectRecommendationPages(
      async () => ({ items: items(1, 3), nextCursor: null, hasMore: false, exhausted: true }),
      options(12)
    );

    assert.equal(result.items.length, 3);
    assert.equal(result.exhausted, true);
  });

  it("fails instead of rendering an empty state when a cursor does not advance", async () => {
    await assert.rejects(
      collectRecommendationPages(
        async () => ({ items: [], nextCursor: "same", hasMore: true, exhausted: false }),
        { ...options(12), cursor: "same" }
      ),
      /RECOMMENDATION_CURSOR_DID_NOT_ADVANCE/
    );
  });

  it("can pause with a partial batch without changing hasMore into exhaustion", async () => {
    const result = await collectRecommendationPages(
      async () => ({
        items: items(1, 5),
        nextCursor: "retry-provider",
        hasMore: true,
        exhausted: false,
        providersBlocked: true
      }),
      {
        ...options(12),
        shouldPause: (page) => page.providersBlocked
      }
    );

    assert.equal(result.items.length, 5);
    assert.equal(result.hasMore, true);
    assert.equal(result.exhausted, false);
  });

  it("returns the collected partial batch when the request budget is reached", async () => {
    let call = 0;
    const result = await collectRecommendationPages(
      async () => ({
        items: [{ id: `item-${++call}` }],
        nextCursor: `cursor-${call}`,
        hasMore: true,
        exhausted: false
      }),
      { ...options(12), maxRequests: 2 }
    );

    assert.deepEqual(result.items, [{ id: "item-1" }, { id: "item-2" }]);
    assert.equal(result.requestCount, 2);
    assert.equal(result.hasMore, true);
    assert.equal(result.exhausted, false);
  });
});

function options(limit: number) {
  return {
    limit,
    identityKeys: (item: Item) => [item.id]
  };
}

function items(start: number, count: number): Item[] {
  return Array.from({ length: count }, (_, index) => ({ id: `item-${start + index}` }));
}
