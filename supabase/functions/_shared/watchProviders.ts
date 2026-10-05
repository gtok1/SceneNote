import { normalizeTitleForMatch } from "./titleMatch.ts";
import { DISNEY_PLUS_HOME_URL } from "./watchProviderLinks.ts";
import type { RecommendationExternalId } from "./recommendationEngine.ts";

export type WatchProviderCategory = "flatrate" | "free" | "rent" | "buy";
export interface TmdbProvider {
  display_priority?: number;
  logo_path?: string | null;
  provider_id?: number;
  provider_name?: string | null;
}
export interface TmdbWatchProviderRegion {
  link?: string;
  flatrate?: TmdbProvider[];
  free?: TmdbProvider[];
  ads?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
}
export interface KrOttProvider { id: number; group: string; name: string }
export const KR_OTT_PROVIDERS: readonly KrOttProvider[] = [
  { id: 8, group: "netflix", name: "넷플릭스" },
  { id: 1796, group: "netflix", name: "넷플릭스(광고형)" },
  { id: 1883, group: "tving", name: "티빙" },
  { id: 1881, group: "coupang", name: "쿠팡플레이" },
  { id: 356, group: "wavve", name: "웨이브" },
  { id: 337, group: "disney", name: "디즈니+" },
  { id: 97, group: "watcha", name: "왓챠" },
  { id: 350, group: "apple", name: "Apple TV+" },
  { id: 119, group: "prime", name: "프라임 비디오" },
  { id: 283, group: "crunchyroll", name: "크런치롤" }
];
export const KR_OTT_PROVIDER_IDS: readonly number[] = KR_OTT_PROVIDERS.map(provider => provider.id);
export const KR_OTT_MONETIZATION_TYPES = ["flatrate", "free", "ads"] as const;
const categories: readonly WatchProviderCategory[] = ["flatrate", "free", "rent", "buy"];
const labels: Record<WatchProviderCategory, string> = { flatrate: "정액제", free: "무료", rent: "대여", buy: "구매" };
const regionPriority = ["JP", "US", "TW", "HK", "SG", "TH", "GB", "CA", "AU", "FR", "DE"];

export function applyKrOttDiscoverFilter(url: URL): void {
  url.searchParams.set("watch_region", "KR");
  url.searchParams.set("with_watch_providers", KR_OTT_PROVIDER_IDS.join("|"));
  url.searchParams.set("with_watch_monetization_types", KR_OTT_MONETIZATION_TYPES.join("|"));
}

export interface KrOttProviderSummary { provider_id: number; name: string }
export function summarizeKrOttProviders(region: TmdbWatchProviderRegion | null | undefined): KrOttProviderSummary[] {
  if (!region) return [];
  const available = new Set([...region.flatrate ?? [], ...region.free ?? [], ...region.ads ?? []].map(provider => provider.provider_id));
  const seenGroups = new Set<string>();
  return KR_OTT_PROVIDERS.flatMap(provider => {
    if (!available.has(provider.id) || seenGroups.has(provider.group)) return [];
    seenGroups.add(provider.group);
    const first = KR_OTT_PROVIDERS.find(entry => entry.group === provider.group)!;
    return [{ provider_id: first.id, name: first.name }];
  });
}

export interface MappedWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_url: string | null;
  service_type: WatchProviderCategory;
  service_type_label: string;
  display_priority: number;
  link: string | null;
}
export function mapKrWatchProvidersByCategory(
  region: TmdbWatchProviderRegion | null | undefined,
  title: string | null
): Record<WatchProviderCategory, MappedWatchProvider[]> {
  const result = { flatrate: [], free: [], rent: [], buy: [] } as Record<WatchProviderCategory, MappedWatchProvider[]>;
  for (const category of categories) {
    const byId = new Map<number, { provider: TmdbProvider; label: string }>();
    const candidates = category === "free"
      ? [...(region?.ads ?? []).map(provider => ({provider,label:"무료(광고)"})), ...(region?.free ?? []).map(provider => ({provider,label:"무료"}))]
      : (region?.[category] ?? []).map(provider => ({provider,label:labels[category]}));
    candidates.sort((a,b) => (b.provider.display_priority ?? 9999) - (a.provider.display_priority ?? 9999));
    for (const candidate of candidates) {
      const id = candidate.provider.provider_id;
      if (typeof id !== "number") continue;
      if (candidate.label === "무료(광고)" && byId.get(id)?.label === "무료") continue;
      byId.set(id, candidate);
    }
    if (byId.has(8)) byId.delete(1796);
    result[category] = [...byId.entries()]
      .sort(([aId,a],[bId,b]) => {
        const aIndex = KR_OTT_PROVIDER_IDS.indexOf(aId);
        const bIndex = KR_OTT_PROVIDER_IDS.indexOf(bId);
        const aOrder = aIndex >= 0 ? aIndex : 100 + (a.provider.display_priority ?? 9999);
        const bOrder = bIndex >= 0 ? bIndex : 100 + (b.provider.display_priority ?? 9999);
        return aOrder - bOrder || aId - bId;
      })
      .map(([id,{provider,label}]) => ({
        provider_id: id,
        provider_name: KR_OTT_PROVIDERS.find(entry => entry.id === id)?.name ?? (provider.provider_name?.trim() || "Unknown"),
        logo_url: provider.logo_path ? `https://image.tmdb.org/t/p/original${provider.logo_path}` : null,
        service_type: category,
        service_type_label: label,
        display_priority: provider.display_priority ?? 9999,
        link: createProviderLink(id === 8 || id === 1796 ? {...provider,provider_name:"Netflix"} : provider,title) ?? region?.link ?? null
      }));
  }
  return result;
}

export function createProviderLink(provider: TmdbProvider, title: string | null): string | null {
  if (!title) return null;
  const encodedTitle = encodeURIComponent(title);
  const providerName = provider.provider_name?.toLocaleLowerCase() ?? "";
  if (providerName.includes("netflix")) return `https://www.netflix.com/search?q=${encodedTitle}`;
  // Do not invent a title-query route: Disney+'s old /search URL returns 404.
  if (provider.provider_id === 337 || providerName.includes("disney") || providerName.includes("디즈니")) return DISNEY_PLUS_HOME_URL;
  if (providerName.includes("watcha") || providerName.includes("왓챠")) return `https://watcha.com/search?query=${encodedTitle}`;
  if (providerName.includes("wavve") || providerName.includes("웨이브")) return `https://www.wavve.com/search?searchWord=${encodedTitle}`;
  if (providerName.includes("tving") || providerName.includes("티빙")) return `https://www.tving.com/search?keyword=${encodedTitle}`;
  if (providerName.includes("coupang") || providerName.includes("쿠팡")) return `https://www.coupangplay.com/search?query=${encodedTitle}`;
  if (providerName.includes("apple tv")) return `https://tv.apple.com/kr/search?term=${encodedTitle}`;
  if (providerName.includes("google play")) return `https://play.google.com/store/search?q=${encodedTitle}&c=movies`;
  if (providerName.includes("naver") || providerName.includes("네이버")) return `https://serieson.naver.com/v3/search?keyword=${encodedTitle}`;
  if (providerName.includes("laftel") || providerName.includes("라프텔")) return `https://laftel.net/search?keyword=${encodedTitle}`;
  if (providerName.includes("prime video") || providerName.includes("amazon")) return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodedTitle}`;
  if (providerName.includes("youtube")) return `https://www.youtube.com/results?search_query=${encodedTitle}`;
  return null;
}

export function listOtherAvailableRegions(
  results: Record<string, TmdbWatchProviderRegion | undefined> | null | undefined,
  limit = 5
): string[] {
  if (!results) return [];
  return Object.entries(results)
    .filter(([code,region]) => code !== "KR" && Boolean((region?.flatrate?.length ?? 0) + (region?.free?.length ?? 0) + (region?.ads?.length ?? 0)))
    .map(([code]) => code)
    .sort((a,b) => {
      const ai = regionPriority.indexOf(a), bi = regionPriority.indexOf(b);
      return (ai < 0 ? regionPriority.length : ai) - (bi < 0 ? regionPriority.length : bi) || a.localeCompare(b);
    })
    .slice(0,limit);
}

export interface TmdbTvSearchItem {
  id: number;
  name?: string | null;
  original_name?: string | null;
  first_air_date?: string | null;
  genre_ids?: number[] | null;
  popularity?: number | null;
}
export function matchTmdbAnimeForAniList(
  input: { titles: readonly (string | null | undefined)[]; year: number | null },
  results: readonly TmdbTvSearchItem[]
): number | null {
  const titles = new Set(input.titles.map(normalizeTitleForMatch).filter(Boolean));
  if (titles.size === 0) return null;
  const scored = results.flatMap(item => {
    if (!item.genre_ids?.includes(16)) return [];
    const year = Number.parseInt(item.first_air_date?.slice(0,4) ?? "",10);
    if (input.year !== null && Number.isFinite(year) && Math.abs(year-input.year)>1) return [];
    const originalScore = titles.has(normalizeTitleForMatch(item.original_name)) ? 2 : 0;
    const score = originalScore || (titles.has(normalizeTitleForMatch(item.name)) ? 1 : 0);
    return score ? [{item,score,yearDifference:input.year !== null && Number.isFinite(year) ? Math.abs(year-input.year) : 99}] : [];
  });
  scored.sort((a,b) => b.score-a.score || a.yearDifference-b.yearDifference || (b.item.popularity ?? 0)-(a.item.popularity ?? 0) || a.item.id-b.item.id);
  return scored[0]?.item.id ?? null;
}

export interface KrOttLookupTarget {
  external_source: string;
  external_id: string;
  content_type: string;
  external_ids?: Readonly<Record<string, string | number | null | undefined>> | readonly RecommendationExternalId[] | null;
}
export type KrWatchRegionFetcher = (kind: "tv" | "movie", tmdbId: string) => Promise<TmdbWatchProviderRegion | null>;
export function resolveTmdbLookupKey(item: KrOttLookupTarget): { kind: "tv" | "movie"; tmdbId: string } | null {
  const externalTmdbId = Array.isArray(item.external_ids)
    ? item.external_ids.find(entry => (entry.api_source ?? entry.external_source ?? entry.source) === "tmdb")?.external_id
    : (item.external_ids as Readonly<Record<string, string | number | null | undefined>> | null | undefined)?.tmdb;
  const id = item.external_source === "tmdb" ? item.external_id : externalTmdbId;
  const tmdbId = id == null ? null : String(id);
  return tmdbId && /^\d+$/u.test(tmdbId) ? {kind:item.content_type === "movie" ? "movie" : "tv",tmdbId} : null;
}
export async function attachKrOttProviders<T extends KrOttLookupTarget>(
  items: readonly T[], fetchRegion: KrWatchRegionFetcher,
  options: { deadlineMs?: number; concurrency?: number; minRemainingMs?: number } = {}
): Promise<(T & { watch_providers_kr: KrOttProviderSummary[] | null })[]> {
  const result = items.map(item => ({...item,watch_providers_kr:null as KrOttProviderSummary[] | null}));
  const concurrency = Math.max(1,Math.floor(options.concurrency ?? 6));
  const minRemainingMs = options.minRemainingMs ?? 1000;
  let next = 0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async () => {
    while(next < items.length) {
      const index=next++;
      const item=items[index]!;
      const key=resolveTmdbLookupKey(item);
      if(!key || (options.deadlineMs !== undefined && options.deadlineMs-Date.now()<minRemainingMs)) continue;
      try { result[index]!.watch_providers_kr=summarizeKrOttProviders(await fetchRegion(key.kind,key.tmdbId)); }
      catch { result[index]!.watch_providers_kr=null; }
    }
  }));
  return result;
}
