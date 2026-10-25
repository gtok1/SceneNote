import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createWatchProviderCacheKey, isWatchProviderResponseCompatible, resolveWatchProviderMediaType, shouldLoadWatchProviders, shouldWaitForWatchProviderMetadata, supportsWatchProviderLookup, WATCH_PROVIDER_CACHE_TTL_MS, type WatchProviderLookupInput } from "./watchProviderLookup";
import { resolveWatchSeasonNumber } from "../../supabase/functions/_shared/watchProviderSeason";
import type { WatchProvidersResponse } from "@/types/watchProviders";

const input: WatchProviderLookupInput = {
  source: "anilist", externalId: "123", mediaType: "tv", title: "전생 귀족, 감정 스킬로 성공하다",
  originalTitle: "転生貴族、鑑定スキルで成り上がる 第3期", airYear: 2026, airDate: "2026-09-01", seasonNumber: 3, hasSeasons: true
};

describe("season watch provider cache", () => {
  it("separates every request input and excludes the old cache key", () => {
    const key = createWatchProviderCacheKey(input);
    assert.notEqual(key, "anilist:tv:123:KR");
    const variations: Partial<WatchProviderLookupInput>[] = [
      { source: "tmdb" }, { externalId: "456" }, { mediaType: "movie" }, { seasonNumber: 1 },
      { title: "다른 작품" }, { originalTitle: null }, { airYear: 2025 }, { airDate: "2026-10-01" }
    ];
    for (const variation of variations) assert.notEqual(createWatchProviderCacheKey({ ...input, ...variation }), key);
    assert.deepEqual(JSON.parse(key!), ["watch-providers", 2, "anilist", "tv", "123", "KR", 3, input.title, input.originalTitle, 2026, "2026-09-01"]);
  });

  it("keeps same inputs stable and refuses requests without an identity", () => {
    assert.equal(createWatchProviderCacheKey({ ...input }), createWatchProviderCacheKey(input));
    assert.equal(createWatchProviderCacheKey({ ...input, externalId: undefined }), null);
    assert.equal(createWatchProviderCacheKey({ ...input, source: undefined }), null);
  });

  it("waits for incomplete AniList title and date metadata while it is loading", () => {
    assert.equal(shouldWaitForWatchProviderMetadata({ ...input, originalTitle: null }, true), true);
    assert.equal(shouldWaitForWatchProviderMetadata({ ...input, title: undefined }, true), true);
    assert.equal(shouldWaitForWatchProviderMetadata({ ...input, airDate: null, airYear: null }, true), true);
    assert.equal(shouldWaitForWatchProviderMetadata(input, true), false);
    assert.equal(shouldWaitForWatchProviderMetadata({ ...input, airDate: null }, true), false);
    assert.equal(shouldWaitForWatchProviderMetadata({ ...input, originalTitle: null }, false), false);
    assert.equal(shouldWaitForWatchProviderMetadata({ ...input, source: "tmdb", title: null, originalTitle: null }, true), false);
    assert.equal(shouldWaitForWatchProviderMetadata({ ...input, source: "tmdb", seasonNumber: null }, false, true), true);
    assert.equal(shouldWaitForWatchProviderMetadata({ ...input, source: "tmdb", mediaType: "movie" }, false, true), false);
    assert.equal(shouldWaitForWatchProviderMetadata({ ...input, hasSeasons: null }, true), true);
  });

  it("stops automatic retries after an error and allows a deliberate retry", () => {
    assert.equal(shouldLoadWatchProviders({ hasData: false, isLoading: false, error: null }), true);
    assert.equal(shouldLoadWatchProviders({ hasData: false, isLoading: false, error: "요청 실패" }), false);
    assert.equal(shouldLoadWatchProviders({ hasData: false, isLoading: false, error: "요청 실패", force: true }), true);
    assert.equal(shouldLoadWatchProviders({ hasData: true, isLoading: false, error: null, updatedAt: new Date().toISOString() }), false);
    assert.equal(shouldLoadWatchProviders({ hasData: true, isLoading: false, error: null, force: true }), true);
    assert.equal(shouldLoadWatchProviders({ hasData: false, isLoading: true, error: null, force: true }), false);
  });

  it("refreshes an hour-old response on reentry while keeping recent data", () => {
    const now = Date.parse("2026-10-20T10:00:00Z");
    const cached = { hasData: true, isLoading: false, error: null, now };
    assert.equal(shouldLoadWatchProviders({ ...cached, updatedAt: new Date(now - WATCH_PROVIDER_CACHE_TTL_MS + 1).toISOString() }), false);
    assert.equal(shouldLoadWatchProviders({ ...cached, updatedAt: new Date(now - WATCH_PROVIDER_CACHE_TTL_MS).toISOString() }), true);
    assert.equal(shouldLoadWatchProviders({ ...cached, updatedAt: "invalid" }), true);
    assert.equal(shouldLoadWatchProviders({ ...cached, updatedAt: null }), true);
    assert.equal(shouldLoadWatchProviders({ ...cached, updatedAt: "2026-10-20T08:00:00Z", error: "요청 실패" }), false);
    assert.equal(shouldLoadWatchProviders({ ...cached, updatedAt: "2026-10-20T08:00:00Z", error: "요청 실패", force: true }), true);
  });
});

describe("watch provider media type", () => {
  it("treats a confirmed AniList anime movie as a movie without a season label", () => {
    const mediaType = resolveWatchProviderMediaType({ source: "anilist", contentType: "anime", hasSeasons: false });
    assert.equal(mediaType, "movie");
    assert.equal(resolveWatchSeasonNumber({ source: "anilist", mediaType, titles: ["劇場版"], seasonNumber: 1 }), null);
    assert.equal(supportsWatchProviderLookup({ source: "anilist", mediaType }), false);
    assert.equal(shouldWaitForWatchProviderMetadata({ ...input, mediaType, hasSeasons: false }, true), false);
  });

  it("keeps unknown AniList formats pending and preserves TV and other source contracts", () => {
    for (const hasSeasons of [true, null]) {
      assert.equal(resolveWatchProviderMediaType({ source: "anilist", contentType: "anime", hasSeasons }), "tv");
    }
    assert.equal(shouldWaitForWatchProviderMetadata({ ...input, hasSeasons: null }, true), true);
    assert.equal(resolveWatchProviderMediaType({ source: "tmdb", contentType: "anime", hasSeasons: false }), "tv");
    assert.equal(resolveWatchProviderMediaType({ source: "tmdb", contentType: "movie", hasSeasons: null }), "movie");
  });

  it("allows only supported requests so old movie cache and server responses stay unused", () => {
    assert.equal(supportsWatchProviderLookup({ source: "tmdb", mediaType: "movie" }), true);
    assert.equal(supportsWatchProviderLookup({ source: "tmdb", mediaType: "tv" }), true);
    assert.equal(supportsWatchProviderLookup({ source: "anilist", mediaType: "tv" }), true);
    assert.equal(supportsWatchProviderLookup({ source: "anilist", mediaType: "movie" }), false);
    assert.equal(supportsWatchProviderLookup({ source: "kitsu", mediaType: "tv" }), false);
    assert.equal(supportsWatchProviderLookup({ source: undefined, mediaType: "tv" }), false);
  });
});

describe("watch provider response migration", () => {
  const response: WatchProvidersResponse = {
    external_source: "tmdb", external_id: "123", region: "KR", link: null,
    updated_at: "2026-10-20T10:00:00Z", providers: { flatrate: [], free: [], rent: [], buy: [] },
    lookup_version: 2, requested_season_number: 1, provider_scope: "season", tmdb_season_number: 1
  };
  const compatible = (value: WatchProvidersResponse, seasonNumber: number | null = 1) =>
    isWatchProviderResponseCompatible({ response: value, seasonNumber, requireSeasonMatch: true });
  const cached = { isLoading: false, hasData: true, error: null, updatedAt: response.updated_at, now: Date.parse(response.updated_at) + 60_000 };

  it("retries a fresh legacy response on reentry instead of waiting for its one-hour TTL", () => {
    const legacy = { ...response, provider_scope: "content" as const };
    delete legacy.lookup_version;
    delete legacy.requested_season_number;
    assert.equal(compatible(legacy), false);
    assert.equal(shouldLoadWatchProviders({ ...cached, responseCompatible: compatible(legacy) }), true);
    assert.equal(shouldLoadWatchProviders({ ...cached, responseCompatible: false, error: "재조회 실패" }), true);
    assert.equal(shouldLoadWatchProviders({ ...cached, responseCompatible: false, isLoading: true }), false);
  });

  it("does not cache mismatched seasons or unexpected series fallbacks for the full TTL", () => {
    for (const variation of [
      { requested_season_number: 3 }, { provider_scope: "series" as const }, { provider_scope: "content" as const }
    ]) {
      assert.equal(compatible({ ...response, ...variation }), false);
      assert.equal(shouldLoadWatchProviders({ ...cached, responseCompatible: compatible({ ...response, ...variation }) }), true);
    }
  });

  it("keeps current confirmed and scoped-unknown responses for the normal TTL", () => {
    for (const provider_scope of ["season", null] as const) {
      assert.equal(compatible({ ...response, provider_scope }), true);
      assert.equal(shouldLoadWatchProviders({ ...cached, responseCompatible: compatible({ ...response, provider_scope }) }), false);
      assert.equal(shouldLoadWatchProviders({ ...cached, responseCompatible: true, now: Date.parse(response.updated_at) + WATCH_PROVIDER_CACHE_TTL_MS }), true);
    }
    assert.equal(compatible({ ...response, provider_scope: null, requested_season_number: null }, null), true);
  });
});
