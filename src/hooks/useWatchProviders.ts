import { useCallback, useEffect, useMemo, useRef } from "react";

import { useAtom } from "jotai";
import { useIsFocused } from "@react-navigation/native";

import { watchProvidersAtom } from "@/atoms/watchProvidersAtom";
import { createEmptyWatchProviders, getWatchProviders } from "@/services/watchProviders";
import { createWatchProviderCacheKey, isWatchProviderResponseCompatible, shouldLoadWatchProviders, shouldWaitForWatchProviderMetadata, supportsWatchProviderLookup, type WatchProviderLookupInput } from "@/utils/watchProviderLookup";
import { userFacingErrorMessage } from "@/utils/profileDashboard";

interface UseWatchProvidersParams extends WatchProviderLookupInput {
  metadataLoading?: boolean;
  seasonSelectionLoading?: boolean;
}

export function useWatchProviders({ source, externalId, mediaType, title, originalTitle, airYear, airDate, seasonNumber, hasSeasons, metadataLoading = false, seasonSelectionLoading = false }: UseWatchProvidersParams) {
  const [state, setState] = useAtom(watchProvidersAtom);
  const focused = useIsFocused();
  const attemptedKeys = useRef(new Set<string>());
  const pendingKeys = useRef(new Set<string>());
  const supported = supportsWatchProviderLookup({ source, mediaType });
  const waitingForMetadata = supported && shouldWaitForWatchProviderMetadata({ source, externalId, mediaType, title, originalTitle: originalTitle ?? null, airYear: airYear ?? null, airDate: airDate ?? null, seasonNumber: seasonNumber ?? null, hasSeasons: hasSeasons ?? null }, metadataLoading, seasonSelectionLoading);
  const cacheKey = useMemo(
    () => !supported || waitingForMetadata ? null : createWatchProviderCacheKey({ source, externalId, mediaType, title, originalTitle: originalTitle ?? null, airYear: airYear ?? null, airDate: airDate ?? null, seasonNumber: seasonNumber ?? null }),
    [airDate, airYear, externalId, mediaType, originalTitle, seasonNumber, source, supported, title, waitingForMetadata]
  );
  const cached = cacheKey ? state.itemsByKey[cacheKey] : undefined;
  const isLoading = cacheKey ? Boolean(state.loadingByKey[cacheKey]) : false;
  const error = cacheKey ? state.errorByKey[cacheKey] ?? null : null;

  const load = useCallback(
    async (force = false) => {
      if (!cacheKey || !source || !externalId) return;
      if (pendingKeys.current.has(cacheKey) || (!force && attemptedKeys.current.has(cacheKey))) return;
      const responseCompatible = cached ? isWatchProviderResponseCompatible({
        response: cached,
        seasonNumber: seasonNumber ?? null,
        requireSeasonMatch: seasonNumber != null || (source === "anilist" && mediaType === "tv")
      }) : true;
      if (!shouldLoadWatchProviders({ isLoading, hasData: Boolean(cached), error, updatedAt: cached?.updated_at ?? null, responseCompatible, force })) return;
      // At most one automatic request per key and focus visit, even if a server returns an old timestamp.
      attemptedKeys.current.add(cacheKey);
      pendingKeys.current.add(cacheKey);

      setState((current) => ({
        ...current,
        loadingByKey: { ...current.loadingByKey, [cacheKey]: true },
        errorByKey: { ...current.errorByKey, [cacheKey]: null }
      }));

      try {
        const data = await getWatchProviders({
          source,
          externalId,
          mediaType,
          title,
          originalTitle: originalTitle ?? null,
          airYear: airYear ?? null,
          airDate: airDate ?? null,
          seasonNumber: seasonNumber ?? null
        });

        setState((current) => ({
          ...current,
          itemsByKey: { ...current.itemsByKey, [cacheKey]: data },
          loadingByKey: { ...current.loadingByKey, [cacheKey]: false },
          errorByKey: { ...current.errorByKey, [cacheKey]: null }
        }));
      } catch (loadError) {
        setState((current) => ({
          ...current,
          loadingByKey: { ...current.loadingByKey, [cacheKey]: false },
          errorByKey: {
            ...current.errorByKey,
            [cacheKey]: userFacingErrorMessage(loadError, "시청 플랫폼 정보를 불러오지 못했어요. 다시 확인해 주세요.")
          }
        }));
      } finally {
        pendingKeys.current.delete(cacheKey);
      }
    },
    [airDate, airYear, cacheKey, cached, error, externalId, isLoading, mediaType, originalTitle, seasonNumber, setState, source, title]
  );

  useEffect(() => {
    if (focused) attemptedKeys.current.clear();
  }, [focused]);

  useEffect(() => {
    if (focused) void load();
  }, [focused, load]);

  return {
    data: cached ?? createEmptyWatchProviders(externalId ?? ""),
    isLoading: waitingForMetadata || isLoading || Boolean(cacheKey && !cached && !error),
    error,
    refetch: () => load(true)
  };
}
