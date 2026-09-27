import { supabase } from "@/lib/supabase";
import type { SearchFilterDraft } from "@/utils/searchFilterDraft";
import { normalizeSavedSearchFilters, serializeSearchFilters } from "@/utils/searchFilterPreferences";

export async function getSearchFilterPreferences(userId: string, signal?: AbortSignal): Promise<SearchFilterDraft> {
  const request = supabase.from("profiles").select("search_filters").eq("id", userId);
  const { data, error } = await (signal ? request.abortSignal(signal) : request).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeSavedSearchFilters(data?.search_filters);
}

export async function saveSearchFilterPreferences(userId: string, filters: SearchFilterDraft): Promise<SearchFilterDraft> {
  const { data, error } = await supabase.from("profiles")
    .upsert({ id: userId, search_filters: serializeSearchFilters(filters) }, { onConflict: "id" })
    .select("search_filters").single();
  if (error) throw new Error(error.message);
  return normalizeSavedSearchFilters(data.search_filters);
}
