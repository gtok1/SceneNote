import assert from "node:assert/strict";
import { it } from "node:test";

import type { WatchProvider, WatchProviderCategory, WatchProvidersByCategory } from "../types/watchProviders";
import { DISNEY_PLUS_HOME_URL } from "./watchProviderDisplay";

const N = "https://www.netflix.com/search?q=x";
const T = "https://www.tving.com/search?keyword=x";
const L = "https://laftel.net/search?keyword=x";
const load = () => import("./subscribedOtt");

function provider(id: number, name = String(id), link: string | null = null, category: WatchProviderCategory = "flatrate"): WatchProvider {
  return {
    provider_id: id, provider_name: name, link, service_type: category,
    service_type_label: category, logo_url: null, display_priority: 0
  };
}

function providers(values: Partial<WatchProvidersByCategory> = {}): WatchProvidersByCategory {
  return { flatrate: [], free: [], rent: [], buy: [], ...values };
}

it("74 T-1: non-array saved values normalize to an empty subscription", async () => {
  const { normalizeSubscribedOtts } = await load();
  for (const value of [null, undefined, "netflix", {}, 3]) assert.deepEqual(normalizeSubscribedOtts(value), []);
});

it("74 T-2: saved values are trimmed, lowercased, deduplicated and validated", async () => {
  const { normalizeSubscribedOtts } = await load();
  assert.deepEqual(normalizeSubscribedOtts(["TVING", " netflix ", "netflix", "hbo", 3, null]), ["netflix", "tving"]);
});

it("74 T-3: subscriptions use the catalog order with Laftel last", async () => {
  const { normalizeSubscribedOtts } = await load();
  assert.deepEqual(normalizeSubscribedOtts(["laftel", "watcha", "netflix"]), ["netflix", "watcha", "laftel"]);
});

it("74 T-4: the ten service groups retain their names, order and matching contract", async () => {
  const { SUBSCRIBABLE_OTTS } = await load();
  assert.deepEqual(SUBSCRIBABLE_OTTS, [
    { group: "netflix", name: "넷플릭스", matchable: true },
    { group: "tving", name: "티빙", matchable: true },
    { group: "coupang", name: "쿠팡플레이", matchable: true },
    { group: "wavve", name: "웨이브", matchable: true },
    { group: "disney", name: "디즈니+", matchable: true },
    { group: "watcha", name: "왓챠", matchable: true },
    { group: "apple", name: "Apple TV+", matchable: true },
    { group: "prime", name: "프라임 비디오", matchable: true },
    { group: "crunchyroll", name: "크런치롤", matchable: true },
    { group: "laftel", name: "라프텔", matchable: false }
  ]);
});

it("74 T-5: toggling adds or removes a known group and ignores unknown groups", async () => {
  const { toggleSubscribedOtt } = await load();
  assert.deepEqual(toggleSubscribedOtt(["netflix"], "tving"), ["netflix", "tving"]);
  assert.deepEqual(toggleSubscribedOtt(["netflix", "tving"], "netflix"), ["tving"]);
  assert.deepEqual(toggleSubscribedOtt(["netflix"], "hbo"), ["netflix"]);
});

it("74 T-6: provider ids resolve advertising variants and reject unknown ids", async () => {
  const { ottGroupOfProviderId } = await load();
  for (const [id, expected] of [[8, "netflix"], [1796, "netflix"], [1883, "tving"], [2, null], [NaN, null]] as const) {
    assert.equal(ottGroupOfProviderId(id), expected);
  }
});

it("74 T-7: subscribed services match flatrate and free provider variants", async () => {
  const { isSubscribedProvider } = await load();
  assert.equal(isSubscribedProvider(8, "flatrate", ["netflix"]), true);
  assert.equal(isSubscribedProvider(1796, "free", ["netflix"]), true);
  assert.equal(isSubscribedProvider(1883, "flatrate", ["netflix"]), false);
});

it("74 T-8: rental and purchase do not count as subscribed availability", async () => {
  const { isSubscribedProvider } = await load();
  assert.equal(isSubscribedProvider(8, "rent", ["netflix"]), false);
  assert.equal(isSubscribedProvider(8, "buy", ["netflix"]), false);
});

it("74 T-9: subscription sorting is stable within both groups and does not mutate input", async () => {
  const { sortProvidersBySubscription } = await load();
  const input = [{ provider_id: 1883 }, { provider_id: 8 }, { provider_id: 356 }];
  const result = sortProvidersBySubscription(input, "flatrate", ["wavve", "netflix"]);
  assert.deepEqual(result.map(value => value.provider_id), [8, 356, 1883]);
  assert.deepEqual(input.map(value => value.provider_id), [1883, 8, 356]);
  assert.notEqual(result, input);
  assert.equal(result[0], input[1]);
  assert.equal(result[1], input[2]);
});

it("74 T-10: rental and unset subscriptions preserve order in a fresh array", async () => {
  const { sortProvidersBySubscription } = await load();
  const input = [{ provider_id: 1883 }, { provider_id: 8 }, { provider_id: 356 }];
  for (const [category, subscribed] of [["rent", ["wavve", "netflix"]], ["buy", ["wavve", "netflix"]], ["flatrate", []]] as const) {
    const result = sortProvidersBySubscription(input, category, subscribed);
    assert.deepEqual(result, input);
    assert.notEqual(result, input);
    assert.deepEqual(input.map(value => value.provider_id), [1883, 8, 356]);
  }
});

it("74 T-11: a subscribed free provider wins over unrelated flatrate providers", async () => {
  const { pickInitialWatchCategoryForSubscription } = await load();
  const value = providers({ flatrate: [provider(1883)], free: [provider(1796)] });
  assert.equal(pickInitialWatchCategoryForSubscription(value, ["netflix"]), "free");
  assert.equal(pickInitialWatchCategoryForSubscription(value, []), "flatrate");
});

it("74 T-12: a subscribed flatrate provider wins over a subscribed free provider", async () => {
  const { pickInitialWatchCategoryForSubscription } = await load();
  assert.equal(pickInitialWatchCategoryForSubscription(providers({ flatrate: [provider(8)], free: [provider(1796)] }), ["netflix"]), "flatrate");
});

it("74 T-13: unavailable subscriptions retain the existing rental fallback", async () => {
  const { pickInitialWatchCategoryForSubscription } = await load();
  assert.equal(pickInitialWatchCategoryForSubscription(providers({ rent: [provider(8)] }), ["tving"]), "rent");
});

it("74 T-14: a rental listing cannot select a subscribed provider tab", async () => {
  const { pickInitialWatchCategoryForSubscription } = await load();
  assert.equal(pickInitialWatchCategoryForSubscription(providers({ free: [provider(1883)], rent: [provider(8)] }), ["netflix"]), "free");
});

it("74 T-15: no providers or no subscriptions produce no watch action", async () => {
  const { pickSubscribedWatchAction } = await load();
  assert.equal(pickSubscribedWatchAction({ providers: providers(), subscribed: ["netflix"] }), null);
  assert.equal(pickSubscribedWatchAction({ providers: providers({ flatrate: [provider(8, "넷플릭스", N)] }), subscribed: [] }), null);
});

it("74 T-16: an actionable subscribed provider supplies the existing link and Korean label", async () => {
  const { pickSubscribedWatchAction } = await load();
  const value = providers({ flatrate: [provider(1883, "티빙", T), provider(8, "넷플릭스", N)] });
  assert.deepEqual(pickSubscribedWatchAction({ providers: value, subscribed: ["netflix"] }), {
    kind: "provider", providerId: 8, providerName: "넷플릭스", link: N, label: "넷플릭스에서 보기"
  });
  assert.equal(pickSubscribedWatchAction({ providers: value, subscribed: ["netflix", "tving"] })?.providerId, 1883);
});

it("74 T-17: missing or malformed links skip candidates and allow a later free service", async () => {
  const { pickSubscribedWatchAction } = await load();
  const subscribed = ["netflix", "tving"];
  const value = providers({ flatrate: [provider(8, "넷플릭스", null)], free: [provider(1883, "티빙", T, "free")] });
  assert.deepEqual(pickSubscribedWatchAction({ providers: value, subscribed }), {
    kind: "provider", providerId: 1883, providerName: "티빙", link: T, label: "티빙에서 보기"
  });
  assert.equal(pickSubscribedWatchAction({ providers: providers({ flatrate: value.flatrate, free: [provider(1883, "티빙", null, "free")] }), subscribed }), null);
  assert.equal(pickSubscribedWatchAction({ providers: providers({ flatrate: [provider(8, "넷플릭스", "not a url")] }), subscribed }), null);
});

it("74 T-18: a Disney home link is labeled as opening the service", async () => {
  const { pickSubscribedWatchAction } = await load();
  const action = pickSubscribedWatchAction({ providers: providers({ flatrate: [provider(337, "디즈니+", DISNEY_PLUS_HOME_URL)] }), subscribed: ["disney"] });
  assert.ok(action);
  assert.equal(action.kind, "provider");
  assert.equal(action.label, "디즈니+ 열기");
  assert.equal(action.link, DISNEY_PLUS_HOME_URL);
});

it("74 T-19: subscribed rental providers do not produce a watch action", async () => {
  const { pickSubscribedWatchAction } = await load();
  assert.equal(pickSubscribedWatchAction({ providers: providers({ rent: [provider(8, "넷플릭스", N, "rent")] }), subscribed: ["netflix"] }), null);
});

it("74 T-20: unavailable matchable subscriptions get a qualified availability note", async () => {
  const { subscribedOttAvailabilityNote } = await load();
  assert.equal(subscribedOttAvailabilityNote({ providers: providers({ flatrate: [provider(1883)] }), subscribed: ["netflix"] }), "구독 중인 OTT에서는 아직 제공 정보를 찾지 못했어요.");
  assert.equal(subscribedOttAvailabilityNote({ providers: providers({ flatrate: [provider(8)] }), subscribed: ["netflix"] }), null);
});

it("74 T-21: Laftel-only, unset and empty provider results do not assert unavailability", async () => {
  const { subscribedOttAvailabilityNote } = await load();
  const value = providers({ flatrate: [provider(1883)] });
  assert.equal(subscribedOttAvailabilityNote({ providers: value, subscribed: ["laftel"] }), null);
  assert.equal(subscribedOttAvailabilityNote({ providers: value, subscribed: [] }), null);
  assert.equal(subscribedOttAvailabilityNote({ providers: providers(), subscribed: ["netflix"] }), null);
});

it("74 T-22: an empty subscription summary says unset", async () => {
  const { describeSubscribedOtts } = await load();
  assert.equal(describeSubscribedOtts([]), "미설정");
});

it("74 T-23: summaries use catalog order and count services after the first two", async () => {
  const { describeSubscribedOtts } = await load();
  assert.equal(describeSubscribedOtts(["netflix"]), "넷플릭스");
  assert.equal(describeSubscribedOtts(["tving", "netflix"]), "넷플릭스 · 티빙");
  assert.equal(describeSubscribedOtts(["netflix", "tving", "wavve"]), "넷플릭스 · 티빙 외 1");
});

it("74 T-24: the summary includes the unmatchable Laftel subscription", async () => {
  const { describeSubscribedOtts } = await load();
  assert.equal(describeSubscribedOtts(["laftel"]), "라프텔");
});

it("74 T-25: Laftel uses only the separate search action", async () => {
  const { pickSubscribedWatchAction } = await load();
  assert.deepEqual(pickSubscribedWatchAction({ providers: providers(), subscribed: ["laftel"], laftelSearchUrl: L }), {
    kind: "laftel", providerId: null, providerName: "라프텔", link: L, label: "라프텔에서 찾기"
  });
});

it("74 T-26: confirmed subscribed availability wins over Laftel search", async () => {
  const { pickSubscribedWatchAction } = await load();
  const action = pickSubscribedWatchAction({ providers: providers({ flatrate: [provider(8, "넷플릭스", N)] }), subscribed: ["netflix", "laftel"], laftelSearchUrl: L });
  assert.ok(action);
  assert.equal(action.kind, "provider");
  assert.equal(action.label, "넷플릭스에서 보기");
  assert.equal(action.link, N);
});

it("74 T-27: a Laftel action needs both the subscription and a nonempty anime search URL", async () => {
  const { pickSubscribedWatchAction } = await load();
  for (const laftelSearchUrl of [null, ""]) {
    assert.equal(pickSubscribedWatchAction({ providers: providers(), subscribed: ["laftel"], laftelSearchUrl }), null);
  }
  assert.equal(pickSubscribedWatchAction({ providers: providers(), subscribed: ["laftel"] }), null);
  assert.equal(pickSubscribedWatchAction({ providers: providers(), subscribed: ["netflix"], laftelSearchUrl: L }), null);
});

it("74 T-28: unrelated providers do not suppress the subscribed Laftel search", async () => {
  const { pickSubscribedWatchAction } = await load();
  const action = pickSubscribedWatchAction({ providers: providers({ flatrate: [provider(1883, "티빙", T)] }), subscribed: ["netflix", "laftel"], laftelSearchUrl: L });
  assert.ok(action);
  assert.equal(action.kind, "laftel");
  assert.equal(action.link, L);
});

it("74 T-29: a pending save prevents another write", async () => {
  const { nextSubscribedOttWrite } = await load();
  assert.equal(nextSubscribedOttWrite({ inFlight: ["netflix"], desired: ["netflix", "tving"], saved: [] }), null);
});

it("74 T-30: normalized equal saved and desired sets need no write", async () => {
  const { nextSubscribedOttWrite } = await load();
  assert.equal(nextSubscribedOttWrite({ inFlight: null, desired: ["tving", "netflix"], saved: ["netflix", "tving"] }), null);
});

it("74 T-31: a changed desired set writes only normalized known groups", async () => {
  const { nextSubscribedOttWrite } = await load();
  assert.deepEqual(nextSubscribedOttWrite({ inFlight: null, desired: ["tving", "netflix", "hbo"], saved: ["netflix"] }), ["netflix", "tving"]);
});

it("74 T-32: rapid choices coalesce into the first save and one latest-value save", async () => {
  const { nextSubscribedOttWrite } = await load();
  let saved: string[] = [];
  let desired = ["netflix"];
  let inFlight: string[] | null = null;
  const results: (string[] | null)[] = [];
  const writes: string[][] = [];
  const poll = () => {
    const next = nextSubscribedOttWrite({ inFlight, desired, saved });
    results.push(next);
    if (next) { inFlight = next; writes.push(next); }
  };
  poll();
  desired = ["netflix", "tving"];
  poll();
  desired = ["netflix", "tving", "wavve"];
  poll();
  saved = inFlight!;
  inFlight = null;
  poll();
  saved = inFlight!;
  inFlight = null;
  poll();
  assert.deepEqual(results, [["netflix"], null, null, ["netflix", "tving", "wavve"], null]);
  assert.deepEqual(writes, [["netflix"], ["netflix", "tving", "wavve"]]);
});

it("74 T-33: save states use fixed Korean status text", async () => {
  const { subscribedOttSaveStatusText } = await load();
  assert.equal(subscribedOttSaveStatusText("idle"), null);
  assert.equal(subscribedOttSaveStatusText("saving"), "저장하는 중이에요.");
  assert.equal(subscribedOttSaveStatusText("saved"), "저장했어요.");
  assert.equal(subscribedOttSaveStatusText("error"), "구독 OTT를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
});
