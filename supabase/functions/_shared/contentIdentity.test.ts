import assert from "node:assert/strict";
import { it } from "node:test";

it("integrity ID-1 requires an explicit TMDB movie or TV request namespace", async () => {
  const identity = await import("./contentIdentity.ts");
  for (const value of [undefined, null, "", "anime", "MOVIE", 1]) assert.equal(identity.requestMediaType("tmdb", value), null);
  assert.equal(identity.requestMediaType("tmdb", "movie"), "movie");
  assert.equal(identity.requestMediaType("tmdb", "tv"), "tv");
});
it("integrity ID-2 preserves the empty namespace of non-TMDB providers", async () => {
  const identity = await import("./contentIdentity.ts");
  for (const source of ["anilist", "kitsu", "tvmaze", "manual"] as const) {
    assert.equal(identity.requestMediaType(source, undefined), "");
    assert.equal(identity.contentMediaType(source, "movie"), "");
  }
});
it("integrity ID-3 derives stored TMDB kind without changing its raw external id", async () => {
  const identity = await import("./contentIdentity.ts");
  assert.equal(identity.contentMediaType("tmdb", "movie"), "movie");
  for (const type of ["anime", "kdrama", "jdrama", "other"] as const) assert.equal(identity.contentMediaType("tmdb", type), "tv");
});
it("integrity ID-4 rejects a TMDB movie mapping during a TV read or refresh", async () => {
  const identity = await import("./contentIdentity.ts");
  assert.equal(identity.matchesStoredMediaType({ content_type: "movie", source_api: "tmdb", source_media_type: "movie" }, "tmdb", "tv"), false);
  assert.equal(identity.matchesStoredMediaType({ content_type: "jdrama", source_api: "tmdb", source_media_type: "tv" }, "tmdb", "movie"), false);
});
it("integrity ID-5 rejects missing or contradictory stored TMDB namespaces", async () => {
  const identity = await import("./contentIdentity.ts");
  assert.equal(identity.matchesStoredMediaType({ content_type: "movie", source_api: "tmdb" }, "tmdb", "movie"), false);
  assert.equal(identity.matchesStoredMediaType({ content_type: "movie", source_api: "tmdb", source_media_type: "tv" }, "tmdb", "tv"), false);
});
it("integrity ID-6 accepts only a matching stored movie or TV mapping", async () => {
  const identity = await import("./contentIdentity.ts");
  assert.equal(identity.matchesStoredMediaType({ content_type: "movie", source_api: "tmdb", source_media_type: "movie" }, "tmdb", "movie"), true);
  assert.equal(identity.matchesStoredMediaType({ content_type: "anime", source_api: "tmdb", source_media_type: "tv" }, "tmdb", "tv"), true);
  assert.equal(identity.matchesStoredMediaType({ content_type: "anime", source_api: "anilist" }, "anilist", ""), true);
});
