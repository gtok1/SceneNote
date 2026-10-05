import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISNEY_PLUS_HOME_URL, normalizeWatchProviderLink } from "./watchProviderLinks.ts";

describe("watch provider link repair", () => {
  it("repairs old Disney search links from deployed responses and caches", () => {
    for (const path of ["/search?q=메이드%20인%20코리아", "/ko-kr/search?q=X", "/ko-kr/browse/search", "/search/"]) {
      assert.equal(normalizeWatchProviderLink(`https://www.disneyplus.com${path}`), DISNEY_PLUS_HOME_URL);
    }
    assert.equal(normalizeWatchProviderLink("https://disneyplus.com/search?q=X"), DISNEY_PLUS_HOME_URL);
  });
  it("preserves Disney title links, homepage and other provider destinations", () => {
    for (const link of [DISNEY_PLUS_HOME_URL, "https://www.disneyplus.com/browse/entity-123", "https://www.netflix.com/search?q=X", "https://www.tving.com/search?keyword=X", "https://www.themoviedb.org/tv/246473/watch?locale=KR", "https://disneyplus.com.example.com/search?q=X"]) {
      assert.equal(normalizeWatchProviderLink(link), link);
    }
  });
  it("returns no destination for missing or malformed links", () => {
    for (const link of [null, "", "not a URL"]) assert.equal(normalizeWatchProviderLink(link), null);
  });
});
