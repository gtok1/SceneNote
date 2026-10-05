import type { WatchProviderCategory, WatchProvidersByCategory } from "@/types/watchProviders";

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
