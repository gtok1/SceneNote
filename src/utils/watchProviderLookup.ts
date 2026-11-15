import type { SearchResult } from "@/types/content";
import type { WatchProvidersResponse } from "@/types/watchProviders";
import { MANUAL_METADATA_QUERY_OPTIONS } from "./metadataQuery";

export const WATCH_PROVIDER_QUERY_POLICY = {
  ...MANUAL_METADATA_QUERY_OPTIONS,
  refetchInterval: false
} as const;

export function watchProviderPersistenceNotice(response: { cache_policy?: string; from_cache?: boolean }): string | null {
  return response.cache_policy === "manual-v1" && typeof response.from_cache === "boolean"
    ? null : "저장 기능을 아직 사용할 수 없어요. 표시된 정보는 이번에 확인한 결과예요.";
}

export function formatWatchProviderUpdatedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `마지막 확인 ${part("year")}.${part("month")}.${part("day")} ${part("hour")}:${part("minute")}`;
}

export interface WatchProviderLookupInput {
  source: SearchResult["external_source"] | undefined;
  externalId: string | undefined;
  mediaType: "movie" | "tv";
  title: string | null | undefined;
  originalTitle?: string | null;
  airYear?: number | null;
  airDate?: string | null;
  seasonNumber?: number | null;
  hasSeasons?: boolean | null;
}

export function resolveWatchProviderMediaType(input: {
  source: SearchResult["external_source"] | undefined;
  contentType: SearchResult["content_type"] | undefined;
  hasSeasons: boolean | null;
}): "movie" | "tv" {
  return input.contentType === "movie" || (input.source === "anilist" && input.hasSeasons === false) ? "movie" : "tv";
}

export function supportsWatchProviderLookup(input: Pick<WatchProviderLookupInput, "source" | "mediaType">): boolean {
  return input.source === "tmdb" || (input.source === "anilist" && input.mediaType === "tv");
}

export function isWatchProviderResponseCompatible(input: {
  response: WatchProvidersResponse;
  seasonNumber: number | null;
  requireSeasonMatch: boolean;
}): boolean {
  if (!input.requireSeasonMatch) return true;
  if (input.response.lookup_version !== 2 || input.response.requested_season_number !== input.seasonNumber) return false;
  // A current, correctly scoped unknown result is cacheable, but it cannot confirm availability.
  if (input.response.provider_scope === null) return true;
  return input.response.provider_scope === "season" && input.seasonNumber !== null &&
    Number.isSafeInteger(input.seasonNumber) && input.seasonNumber >= 0;
}

export function createWatchProviderCacheKey(input: WatchProviderLookupInput): string | null {
  if (!input.source || !input.externalId) return null;
  return JSON.stringify([
    "watch-providers", 2, input.source, input.mediaType, input.externalId, "KR",
    input.seasonNumber ?? null, input.title?.trim() ?? "", input.originalTitle?.trim() ?? "",
    input.airYear ?? null, input.airDate ?? null
  ]);
}

export function shouldWaitForWatchProviderMetadata(input: WatchProviderLookupInput, metadataLoading: boolean, seasonSelectionLoading = false): boolean {
  if (input.mediaType === "tv" && seasonSelectionLoading) return true;
  if (input.source !== "anilist" || !metadataLoading) return false;
  if (input.mediaType === "tv" && input.hasSeasons == null) return true;
  // The original title can carry the season marker missing from a localized title.
  const hasTitles = Boolean(input.title?.trim() && input.originalTitle?.trim());
  const hasDate = Boolean(input.airDate) || (Number.isInteger(input.airYear) && (input.airYear ?? 0) > 0);
  return !hasTitles || !hasDate;
}

export function shouldLoadWatchProviders(input: {
  isLoading: boolean;
  hasData: boolean;
  error: string | null;
  updatedAt?: string | null;
  responseCompatible?: boolean;
  now?: number;
  force?: boolean;
}): boolean {
  if (input.isLoading) return false;
  if (input.force) return true;
  if (input.hasData && input.responseCompatible === false) return true;
  if (input.error) return false;
  if (!input.hasData) return true;
  return false;
}
