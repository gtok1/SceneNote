import type { WatchProviderCategory, WatchProvidersByCategory, WatchProviderScope, WatchProvidersResponse } from "@/types/watchProviders";
import { stripAnimeSeasonMarkers } from "../../supabase/functions/_shared/watchProviders";
import { isWatchProviderResponseCompatible } from "./watchProviderLookup";

export { DISNEY_PLUS_HOME_URL, normalizeWatchProviderLink } from "../../supabase/functions/_shared/watchProviderLinks";

const regionNames: Record<string, string> = {
  JP: "일본", US: "미국", TW: "대만", HK: "홍콩", SG: "싱가포르", TH: "태국",
  GB: "영국", CA: "캐나다", AU: "호주", FR: "프랑스", DE: "독일"
};

export function pickInitialWatchCategory(providers: WatchProvidersByCategory): WatchProviderCategory {
  for (const category of ["flatrate", "free", "rent", "buy"] as const) {
    if (providers[category].length > 0) return category;
  }
  return "flatrate";
}

export function formatWatchProviderLabel(providers: readonly { name: string }[] | null | undefined, max = 2): string | null {
  if (!providers?.length) return null;
  const shown = providers.slice(0, max).map(provider => provider.name).join(" · ");
  return providers.length > max ? `${shown} 외 ${providers.length - max}` : shown;
}

export function formatRegionNames(codes: readonly string[]): string {
  return codes.map(code => regionNames[code] ?? code).join(", ");
}

export function describeNoKrProviders(otherRegions: readonly string[] | null | undefined): string {
  return otherRegions?.length
    ? `국내 OTT 정보가 아직 없어요. ${formatRegionNames(otherRegions)}에서 제공 중이에요.`
    : "국내 OTT에서 볼 수 있는 곳 정보가 아직 없어요.";
}

export function describeWatchProviderScope(scope: WatchProviderScope | null | undefined): string | null {
  return scope === "series" ? "시리즈 전체 기준이에요. 이 시즌 제공 여부는 플랫폼에서 확인해 주세요." : null;
}

export function canDisplayWatchProviderAvailability(input: {
  response: WatchProvidersResponse;
  seasonNumber: number | null;
  requireSeasonMatch: boolean;
}): boolean {
  if (!input.requireSeasonMatch) return true;
  return isWatchProviderResponseCompatible(input) && input.response.provider_scope === "season";
}

export const WATCH_PROVIDER_REFRESH_MESSAGE = "시청 정보를 새로 확인하지 못했어요. 잠시 후 다시 확인해 주세요.";

export function describeNoSeasonProviders(seasonNumber: number | null): string {
  const label = seasonNumber === null ? "선택한 시즌" : seasonNumber === 0 ? "스페셜" : `시즌 ${seasonNumber}`;
  return `${label}의 국내 OTT 제공 정보를 아직 확인하지 못했어요.`;
}

export function createLaftelSearchLink(title: string | null | undefined, seasonNumber?: number | null): string | null {
  const trimmed = title?.trim();
  if (!trimmed) return null;
  const query = seasonNumber && seasonNumber > 0 ? `${stripAnimeSeasonMarkers(trimmed).base} ${seasonNumber}기` : trimmed;
  return `https://laftel.net/search?keyword=${encodeURIComponent(query)}`;
}
