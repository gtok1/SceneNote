import { useMemo } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";

import { queryKeys } from "@/lib/query";
import { createEmptyWatchProviders, getWatchProviders } from "@/services/watchProviders";
import { createWatchProviderCacheKey, shouldLoadWatchProviders, shouldWaitForWatchProviderMetadata, supportsWatchProviderLookup, WATCH_PROVIDER_QUERY_POLICY, type WatchProviderLookupInput } from "@/utils/watchProviderLookup";
import { userFacingErrorMessage } from "@/utils/profileDashboard";

interface UseWatchProvidersParams extends WatchProviderLookupInput {
  metadataLoading?: boolean;
  seasonSelectionLoading?: boolean;
}

export function useWatchProviders({ source, externalId, mediaType, title, originalTitle, airYear, airDate, seasonNumber, hasSeasons, metadataLoading = false, seasonSelectionLoading = false }: UseWatchProvidersParams) {
  const queryClient = useQueryClient();
  const focused = useIsFocused();
  const supported = supportsWatchProviderLookup({ source, mediaType });
  const waitingForMetadata = supported && shouldWaitForWatchProviderMetadata({ source, externalId, mediaType, title, originalTitle: originalTitle ?? null, airYear: airYear ?? null, airDate: airDate ?? null, seasonNumber: seasonNumber ?? null, hasSeasons: hasSeasons ?? null }, metadataLoading, seasonSelectionLoading);
  const cacheKey = useMemo(
    () => !supported || waitingForMetadata ? null : createWatchProviderCacheKey({ source, externalId, mediaType, title, originalTitle: originalTitle ?? null, airYear: airYear ?? null, airDate: airDate ?? null, seasonNumber: seasonNumber ?? null }),
    [airDate, airYear, externalId, mediaType, originalTitle, seasonNumber, source, supported, title, waitingForMetadata]
  );
  const queryKey = useMemo(() => queryKeys.content.watchProviders(cacheKey ?? "unavailable"), [cacheKey]);
  const enabled = focused && Boolean(cacheKey && source && externalId);
  const request = (forceRefresh: boolean) => getWatchProviders({
    source: source!, externalId: externalId!, mediaType, title,
    originalTitle: originalTitle ?? null, airYear: airYear ?? null,
    airDate: airDate ?? null, seasonNumber: seasonNumber ?? null, forceRefresh
  });
  const queryOptions = { queryKey, queryFn: () => request(false), ...WATCH_PROVIDER_QUERY_POLICY };
  const query = useQuery({
    ...queryOptions,
    // Re-enabling a focused screen can otherwise retry an error even with retryOnMount:false.
    enabled: currentQuery => enabled && shouldLoadWatchProviders({
      hasData: currentQuery.state.data !== undefined,
      isLoading: currentQuery.state.fetchStatus === "fetching",
      error: currentQuery.state.status === "error" ? "lookup-failed" : null
    })
  });
  const data = cacheKey ? query.data : undefined;
  const error = query.error ? userFacingErrorMessage(query.error, "시청 플랫폼 정보를 불러오지 못했어요. 다시 확인해 주세요.") : null;

  return {
    data: data ?? createEmptyWatchProviders(externalId ?? ""),
    isLoading: !data && (waitingForMetadata || query.isFetching || (enabled && query.isPending)),
    isRefreshing: Boolean(data) && query.isFetching,
    error,
    refetch: () => {
      if (!enabled || queryClient.getQueryState(queryKey)?.fetchStatus === "fetching") return Promise.resolve(undefined);
      // fetchQuery shares any in-flight request and keeps successful data on a failed refresh.
      return queryClient.fetchQuery({ ...queryOptions, queryFn: () => request(true), staleTime: 0 }).catch(() => undefined);
    }
  };
}
