import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as sequelDisplay from "./watchProviderDisplay";

import { describeNoKrProviders, formatRegionNames, formatWatchProviderLabel, pickInitialWatchCategory } from "./watchProviderDisplay";
import type { WatchProvidersByCategory, WatchProvider, WatchProvidersResponse } from "@/types/watchProviders";

function providers(categories: Partial<Record<keyof WatchProvidersByCategory, WatchProvider[]>> = {}): WatchProvidersByCategory {
  return { flatrate: [], free: [], rent: [], buy: [], ...categories };
}
const item = { provider_id: 8 } as WatchProvider;
const names = (...values: string[]) => values.map(name => ({ name }));

describe("watch provider display contracts", () => {
  it("D-1 defaults to flatrate when all are empty", () => assert.equal(pickInitialWatchCategory(providers()), "flatrate"));
  it("D-2 selects rent when only rent is present", () => assert.equal(pickInitialWatchCategory(providers({ rent: [item] })), "rent"));
  it("D-3 selects free ahead of buy", () => assert.equal(pickInitialWatchCategory(providers({ free: [item], buy: [item] })), "free"));
  it("D-4 returns null for absent and empty labels", () => { assert.equal(formatWatchProviderLabel(null), null); assert.equal(formatWatchProviderLabel([]), null); });
  it("D-5 formats one provider", () => assert.equal(formatWatchProviderLabel(names("넷플릭스")), "넷플릭스"));
  it("D-6 joins two provider names", () => assert.equal(formatWatchProviderLabel(names("넷플릭스", "티빙")), "넷플릭스 · 티빙"));
  it("D-7 counts providers beyond two", () => assert.equal(formatWatchProviderLabel(names("넷플릭스", "티빙", "웨이브", "왓챠")), "넷플릭스 · 티빙 외 2"));
  it("D-8 translates known regions and leaves unknown codes", () => assert.equal(formatRegionNames(["JP", "US", "XX"]), "일본, 미국, XX"));
  it("D-9 describes absent and empty KR data", () => { const expected="국내 OTT에서 볼 수 있는 곳 정보가 아직 없어요.";assert.equal(describeNoKrProviders([]),expected);assert.equal(describeNoKrProviders(undefined),expected); });
  it("D-10 describes known overseas availability", () => assert.equal(describeNoKrProviders(["JP"]), "국내 OTT 정보가 아직 없어요. 일본에서 제공 중이에요."));
});


describe("anime watch provider scope and search display", () => {
  it("V-1 explains series-wide availability", () => assert.equal(sequelDisplay.describeWatchProviderScope("series"),"시리즈 전체 기준이에요. 이 시즌 제공 여부는 플랫폼에서 확인해 주세요."));
  it("V-2 omits scope hints for content, seasons and old responses", () => { for(const scope of ["season","content",null,undefined] as const) assert.equal(sequelDisplay.describeWatchProviderScope(scope),null); });
  it("V-3 encodes Korean titles and trims whitespace", () => { for(const title of ["전생했더니 슬라임이었던 건에 대하여","  진격의 거인  "]) assert.equal(sequelDisplay.createLaftelSearchLink(title),`https://laftel.net/search?keyword=${encodeURIComponent(title.trim())}`); });
  it("V-4 rejects missing and blank search titles", () => { for(const title of [null,undefined,"","   "]) assert.equal(sequelDisplay.createLaftelSearchLink(title),null); });
  it("V-5 encodes reserved search characters", () => assert.equal(sequelDisplay.createLaftelSearchLink("Re:Zero & 2"),"https://laftel.net/search?keyword=Re%3AZero%20%26%202"));
});

describe("selected season availability", () => {
  const response: WatchProvidersResponse = {
    external_source: "tmdb", external_id: "123", region: "KR", link: null, updated_at: "2026-10-20",
    providers: providers({ flatrate: [item] }), other_regions: ["JP"],
    lookup_version: 2, requested_season_number: 3, provider_scope: "season", tmdb_season_number: 3
  };
  const allowed = (value: WatchProvidersResponse, seasonNumber: number | null = 3, requireSeasonMatch = true) =>
    sequelDisplay.canDisplayWatchProviderAvailability({ response: value, seasonNumber, requireSeasonMatch });

  it("keeps a verified response for the requested season", () => {
    assert.equal(allowed(response), true);
    assert.equal(allowed({ ...response, providers: providers() }), true);
    assert.equal(allowed({ ...response, requested_season_number: 0, tmdb_season_number: 0 }, 0), true);
  });

  it("blocks old versions, missing season context, series fallbacks and mismatched seasons", () => {
    for (const variation of [
      { lookup_version: 1 },
      { requested_season_number: null }, { requested_season_number: 1 },
      { provider_scope: null }, { provider_scope: "series" as const }, { provider_scope: "content" as const }
    ]) assert.equal(allowed({ ...response, ...variation }), false, JSON.stringify(variation));
    for (const field of ["lookup_version", "requested_season_number", "provider_scope"] as const) {
      const missingField = { ...response };
      delete missingField[field];
      assert.equal(allowed(missingField), false, field);
    }
    assert.equal(allowed(response, null), false);
  });

  it("preserves movie and unselected-series responses", () => {
    const legacyContent = { ...response, provider_scope: "content" as const };
    delete legacyContent.lookup_version;
    assert.equal(allowed(legacyContent, null, false), true);
  });

  it("says the selected season is unconfirmed without asserting no availability", () => {
    assert.equal(sequelDisplay.describeNoSeasonProviders(3), "시즌 3의 국내 OTT 제공 정보를 아직 확인하지 못했어요.");
    assert.equal(sequelDisplay.describeNoSeasonProviders(null), "선택한 시즌의 국내 OTT 제공 정보를 아직 확인하지 못했어요.");
    assert.equal(sequelDisplay.describeNoSeasonProviders(0), "스페셜의 국내 OTT 제공 정보를 아직 확인하지 못했어요.");
    assert.equal(sequelDisplay.WATCH_PROVIDER_REFRESH_MESSAGE, "시청 정보를 새로 확인하지 못했어요. 잠시 후 다시 확인해 주세요.");
  });

  it("includes the selected season in the separate Laftel search", () => {
    const title = "전생 귀족, 감정 스킬로 성공하다";
    assert.equal(sequelDisplay.createLaftelSearchLink(title, 3), `https://laftel.net/search?keyword=${encodeURIComponent(`${title} 3기`)}`);
    assert.equal(sequelDisplay.createLaftelSearchLink("  ", 3), null);
    for (const markedTitle of [`${title} 3기`, `${title} 시즌 3`, `${title} 第3期`, `${title} 3rd Season`]) {
      assert.equal(sequelDisplay.createLaftelSearchLink(markedTitle, 3), `https://laftel.net/search?keyword=${encodeURIComponent(`${title} 3기`)}`);
    }
  });
});
