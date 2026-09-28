import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeNoKrProviders, formatRegionNames, formatWatchProviderLabel, pickInitialWatchCategory } from "./watchProviderDisplay";
import type { WatchProvidersByCategory, WatchProvider } from "@/types/watchProviders";

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
