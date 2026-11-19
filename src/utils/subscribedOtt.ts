// 묶음 키의 단일 출처는 KR_OTT_PROVIDERS. 라프텔은 제공 정보가 없어
// matchable false, 찾기 버튼으로만 쓴다(docs/74 D-10).
import type { WatchProviderCategory, WatchProvidersByCategory } from "@/types/watchProviders";
import { KR_OTT_PROVIDERS } from "../../supabase/functions/_shared/watchProviders";
import { DISNEY_PLUS_HOME_URL, normalizeWatchProviderLink, pickInitialWatchCategory } from "./watchProviderDisplay";

export const LAFTEL_OTT_GROUP = "laftel";

export interface SubscribableOtt {
  group: string;
  name: string;
  matchable: boolean;
}

const serviceGroups = new Map<string, SubscribableOtt>();
for (const provider of KR_OTT_PROVIDERS) {
  if (!serviceGroups.has(provider.group)) {
    serviceGroups.set(provider.group, { group: provider.group, name: provider.name, matchable: true });
  }
}

export const SUBSCRIBABLE_OTTS: readonly SubscribableOtt[] = [
  ...serviceGroups.values(),
  { group: LAFTEL_OTT_GROUP, name: "라프텔", matchable: false }
];

export function normalizeSubscribedOtts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const selected = new Set(value.filter((group): group is string => typeof group === "string").map(group => group.trim().toLowerCase()));
  return SUBSCRIBABLE_OTTS.filter(ott => selected.has(ott.group)).map(ott => ott.group);
}

export function toggleSubscribedOtt(current: readonly string[], group: string): string[] {
  const groups = normalizeSubscribedOtts(current);
  if (!SUBSCRIBABLE_OTTS.some(ott => ott.group === group)) return groups;
  return groups.includes(group)
    ? groups.filter(value => value !== group)
    : normalizeSubscribedOtts([...groups, group]);
}

export function ottGroupOfProviderId(providerId: number): string | null {
  if (typeof providerId !== "number" || !Number.isFinite(providerId)) return null;
  return KR_OTT_PROVIDERS.find(provider => provider.id === providerId)?.group ?? null;
}

export function isSubscribedProvider(providerId: number, category: WatchProviderCategory, subscribed: readonly string[]): boolean {
  if (category !== "flatrate" && category !== "free") return false;
  const group = ottGroupOfProviderId(providerId);
  return group !== null && normalizeSubscribedOtts(subscribed).includes(group);
}

export function sortProvidersBySubscription<T extends { provider_id: number }>(
  providers: readonly T[], category: WatchProviderCategory, subscribed: readonly string[]
): T[] {
  const groups = normalizeSubscribedOtts(subscribed);
  if ((category !== "flatrate" && category !== "free") || groups.length === 0) return [...providers];
  const mine: T[] = [];
  const others: T[] = [];
  for (const provider of providers) {
    (isSubscribedProvider(provider.provider_id, category, groups) ? mine : others).push(provider);
  }
  return [...mine, ...others];
}

export function pickInitialWatchCategoryForSubscription(
  providers: WatchProvidersByCategory, subscribed: readonly string[]
): WatchProviderCategory {
  for (const category of ["flatrate", "free"] as const) {
    if (providers[category].some(provider => isSubscribedProvider(provider.provider_id, category, subscribed))) return category;
  }
  return pickInitialWatchCategory(providers);
}

export interface SubscribedWatchAction {
  kind: "provider" | "laftel";
  providerId: number | null;
  providerName: string;
  link: string;
  label: string;
}

export function pickSubscribedWatchAction(input: {
  providers: WatchProvidersByCategory;
  subscribed: readonly string[];
  laftelSearchUrl?: string | null;
}): SubscribedWatchAction | null {
  const subscribed = normalizeSubscribedOtts(input.subscribed);
  for (const category of ["flatrate", "free"] as const) {
    for (const provider of input.providers[category]) {
      if (!isSubscribedProvider(provider.provider_id, category, subscribed)) continue;
      const link = normalizeWatchProviderLink(provider.link);
      if (link === null) continue;
      return {
        kind: "provider", providerId: provider.provider_id, providerName: provider.provider_name, link,
        label: link === DISNEY_PLUS_HOME_URL ? `${provider.provider_name} 열기` : `${provider.provider_name}에서 보기`
      };
    }
  }
  if (subscribed.includes(LAFTEL_OTT_GROUP) && typeof input.laftelSearchUrl === "string" && input.laftelSearchUrl.trim()) {
    return {
      kind: "laftel", providerId: null, providerName: "라프텔",
      link: input.laftelSearchUrl, label: "라프텔에서 찾기"
    };
  }
  return null;
}

export function subscribedOttAvailabilityNote(input: {
  providers: WatchProvidersByCategory;
  subscribed: readonly string[];
}): string | null {
  const subscribed = normalizeSubscribedOtts(input.subscribed);
  const hasMatchableSubscription = SUBSCRIBABLE_OTTS.some(ott => ott.matchable && subscribed.includes(ott.group));
  if (!hasMatchableSubscription || !Object.values(input.providers).some(providers => providers.length > 0)) return null;
  const hasSubscribedProvider = (["flatrate", "free"] as const).some(category =>
    input.providers[category].some(provider => isSubscribedProvider(provider.provider_id, category, subscribed)));
  return hasSubscribedProvider ? null : SUBSCRIBED_OTT_COPY.notAvailable;
}

export function describeSubscribedOtts(subscribed: readonly string[]): string {
  const groups = normalizeSubscribedOtts(subscribed);
  if (groups.length === 0) return SUBSCRIBED_OTT_COPY.unset;
  const names = SUBSCRIBABLE_OTTS.filter(ott => groups.includes(ott.group)).map(ott => ott.name);
  const firstTwo = names.slice(0, 2).join(" · ");
  return names.length > 2 ? `${firstTwo} 외 ${names.length - 2}` : firstTwo;
}

export function nextSubscribedOttWrite(input: {
  inFlight: readonly string[] | null;
  desired: readonly string[];
  saved: readonly string[];
}): string[] | null {
  if (input.inFlight !== null) return null;
  const desired = normalizeSubscribedOtts(input.desired);
  const saved = normalizeSubscribedOtts(input.saved);
  return desired.join(",") === saved.join(",") ? null : desired;
}

export type SubscribedOttSaveState = "idle" | "saving" | "saved" | "error";

export function subscribedOttSaveStatusText(state: SubscribedOttSaveState): string | null {
  switch (state) {
    case "idle": return null;
    case "saving": return "저장하는 중이에요.";
    case "saved": return "저장했어요.";
    case "error": return SUBSCRIBED_OTT_COPY.saveFailed;
  }
}

export const SUBSCRIBED_OTT_COPY = {
  screenTitle: "구독 중인 OTT",
  description: "구독 중인 서비스를 고르면 작품 상세에서 바로 보러 갈 수 있어요.",
  laftelNote: "라프텔은 제공 정보를 받을 수 없어요. 애니 상세에서 '라프텔에서 찾기' 버튼으로 연결해 드려요.",
  loadFailed: "구독 OTT 설정을 불러오지 못했어요. 다시 시도해 주세요.",
  saveFailed: "구독 OTT를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
  badge: "내 OTT",
  registerHint: "구독 중인 OTT를 등록하면 작품 상세에서 바로 보러 갈 수 있어요.",
  registerAction: "구독 OTT 등록",
  notAvailable: "구독 중인 OTT에서는 아직 제공 정보를 찾지 못했어요.",
  unset: "미설정"
} as const;
