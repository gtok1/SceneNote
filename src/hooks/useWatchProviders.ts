import { useCallback, useEffect, useMemo } from "react";

import { useAtom } from "jotai";

import { watchProvidersAtom } from "@/atoms/watchProvidersAtom";
import { createEmptyWatchProviders, getWatchProviders } from "@/services/watchProviders";
import type { SearchResult } from "@/types/content";

interface UseWatchProvidersParams {
  source: SearchResult["external_source"] | undefined;
  externalId: string | undefined;
  mediaType: "movie" | "tv";
  title: string | null | undefined;
}

export function useWatchProviders({ source, externalId, mediaType, title }: UseWatchProvidersParams) {
  const [state, setState] = useAtom(watchProvidersAtom);
  const cacheKey = useMemo(
    () => (source && externalId ? `${source}:${mediaType}:${externalId}:KR` : null),
    [externalId, mediaType, source]
  );
  const cached = cacheKey ? state.itemsByKey[cacheKey] : undefined;
  const isLoading = cacheKey ? Boolean(state.loadingByKey[cacheKey]) : false;
  const error = cacheKey ? state.errorByKey[cacheKey] ?? null : null;

  const load = useCallback(
    async (force = false) => {
      if (!cacheKey || !source || !externalId) return;
      if (!force && (state.itemsByKey[cacheKey] || state.loadingByKey[cacheKey])) return;

      setState((current) => ({
        ...current,
        loadingByKey: { ...current.loadingByKey, [cacheKey]: true },
        errorByKey: { ...current.errorByKey, [cacheKey]: null }
      }));

      try {
        const data =
          source === "tmdb"
            ? await getWatchProviders({ source, externalId, mediaType, title })
            : createEmptyWatchProviders(externalId);

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
            [cacheKey]: loadError instanceof Error ? loadError.message : "시청 플랫폼 정보를 불러오지 못했습니다"
          }
        }));
      }
    },
    [cacheKey, externalId, mediaType, setState, source, state.itemsByKey, state.loadingByKey, title]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data: cached ?? createEmptyWatchProviders(externalId ?? ""),
    isLoading,
    error,
    refetch: () => load(true)
  };
}
