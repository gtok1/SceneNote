import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getSearchFilterPreferences, saveSearchFilterPreferences } from "@/services/searchFilterPreferences";
import { useAuthStore } from "@/stores/authStore";
import { useSearchHistoryStore } from "@/stores/searchHistoryStore";
import { useSearchUiStore } from "@/stores/searchUiStore";
import type { SearchFilterDraft } from "@/utils/searchFilterDraft";
import { createSearchFilterPreferenceScope, normalizeSavedSearchFilters } from "@/utils/searchFilterPreferences";

const preferenceKey = (userId: string | null, accountRevision: number) => ["search-filter-preferences", userId, accountRevision] as const;
type PreferenceScope = ReturnType<typeof createSearchFilterPreferenceScope>;

export function useSearchFilterPreferences() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const filterUserId = useSearchUiStore((state) => state.filterUserId);
  const accountRevision = useSearchUiStore((state) => state.accountRevision);
  const historyOwner = useSearchHistoryStore((state) => state.ownerId);
  const historyHydrated = useSearchHistoryStore((state) => state.hasHydrated);
  const queryClient = useQueryClient();
  const scopeRef = useRef<PreferenceScope | null>(null);
  const [saveState, setSaveState] = useState<{ scope: PreferenceScope | null; pending: boolean; error: Error | null }>({ scope: null, pending: false, error: null });
  const query = useQuery({
    queryKey: preferenceKey(userId, accountRevision),
    queryFn: ({ signal }) => getSearchFilterPreferences(userId!, signal),
    enabled: Boolean(userId),
    retry: 1,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    const scope = createSearchFilterPreferenceScope(userId, () => useAuthStore.getState().user?.id ?? null);
    scopeRef.current = scope;
    useSearchUiStore.getState().beginAccount(userId);
    useSearchHistoryStore.getState().setUser(userId);
    // Close irreversibly on every transition, including a rapid A → B → A switch.
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.user?.id !== previous.user?.id) scope.close();
    });
    return () => { scope.close(); unsubscribe(); };
  }, [userId, accountRevision]);

  const isSaving = saveState.pending && Boolean(saveState.scope?.isCurrent());
  useEffect(() => {
    // Cached data from a prior login is never treated as this login's completed read.
    if (!userId || !query.isSuccess || query.isFetching || !query.isFetchedAfterMount || isSaving) return;
    scopeRef.current?.hydrate(query.data, (filters) => useSearchUiStore.getState().hydrateFilters(userId, filters));
  }, [userId, accountRevision, query.data, query.isSuccess, query.isFetching, query.isFetchedAfterMount, isSaving]);

  const isReady = Boolean(userId) && filterUserId === userId && historyOwner === userId && historyHydrated
    && query.isSuccess && query.isFetchedAfterMount;
  const applyFilters = useCallback(async (filters: SearchFilterDraft): Promise<void> => {
    const scope = scopeRef.current;
    if (!userId || !isReady || !scope?.isCurrent()) throw new Error("로그인한 계정의 필터를 먼저 불러와 주세요.");
    if (scope.isSaving()) throw new Error("필터를 저장하는 중입니다.");
    setSaveState({ scope, pending: true, error: null });
    try {
      await scope.save(async () => {
        await queryClient.cancelQueries({ queryKey: preferenceKey(userId, accountRevision), exact: true });
        if (!scope.isCurrent()) throw new Error("계정이 변경되었어요. 다시 시도해 주세요.");
        return saveSearchFilterPreferences(userId, normalizeSavedSearchFilters(filters));
      }, (saved) => {
        queryClient.setQueryData(preferenceKey(userId, accountRevision), saved);
        useSearchUiStore.getState().hydrateFilters(userId, saved);
      });
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error("필터를 저장하지 못했어요.");
      if (scope.isCurrent()) setSaveState({ scope, pending: false, error: normalized });
      throw normalized;
    } finally {
      if (scope.isCurrent()) setSaveState((state) => state.scope === scope ? { ...state, pending: false } : state);
    }
  }, [isReady, queryClient, userId, accountRevision]);

  return {
    isReady,
    isLoading: Boolean(userId) && !isReady && !query.isError,
    loadError: userId ? query.error : null,
    saveError: saveState.scope?.isCurrent() ? saveState.error : null,
    isSaving,
    refetch: query.refetch,
    applyFilters
  };
}
