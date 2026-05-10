export type WatchProviderCategory = "flatrate" | "free" | "rent" | "buy";

export const WATCH_PROVIDER_CATEGORY_LABEL: Record<WatchProviderCategory, string> = {
  flatrate: "정액제",
  free: "무료",
  rent: "대여",
  buy: "구매"
};

export const WATCH_PROVIDER_CATEGORIES: WatchProviderCategory[] = ["flatrate", "free", "rent", "buy"];

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_url: string | null;
  service_type: WatchProviderCategory;
  service_type_label: string;
  display_priority: number;
  link: string | null;
}

export type WatchProvidersByCategory = Record<WatchProviderCategory, WatchProvider[]>;

export interface WatchProvidersResponse {
  external_source: "tmdb";
  external_id: string;
  region: "KR";
  link: string | null;
  providers: WatchProvidersByCategory;
  updated_at: string;
}
