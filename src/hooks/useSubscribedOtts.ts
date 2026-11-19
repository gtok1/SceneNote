import { useCallback, useMemo, useSyncExternalStore } from "react";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { SUBSCRIBED_OTT_FEATURES_ENABLED } from "@/constants/features";
import { queryKeys } from "@/lib/query";
import { getSubscribedOtts, saveSubscribedOtts } from "@/services/subscribedOtts";
import { useAppUIStore } from "@/stores/appUIStore";
import { useAuthStore } from "@/stores/authStore";
import {
  nextSubscribedOttWrite,
  normalizeSubscribedOtts,
  SUBSCRIBED_OTT_COPY,
  type SubscribedOttSaveState
} from "@/utils/subscribedOtt";

const EMPTY_GROUPS: string[] = [];
const idleSnapshot = (): SubscribedOttSaveState => "idle";
const emptySubscribe = (_listener: () => void) => () => undefined;

interface SaveController {
  query: object;
  getSnapshot: () => SubscribedOttSaveState;
  subscribe: (listener: () => void) => () => void;
  setGroups: (desired: readonly string[]) => void;
}

// Profile, settings and content detail may observe the same account together.
// All observers share one queue and one successful baseline (docs/74 D-6/D-7).
const controllers = new WeakMap<QueryClient, Map<string, SaveController>>();

function getSaveController(queryClient: QueryClient, userId: string, query: object): SaveController {
  let accounts = controllers.get(queryClient);
  if (!accounts) {
    accounts = new Map();
    controllers.set(queryClient, accounts);
  }
  const existing = accounts.get(userId);
  if (existing?.query === query) return existing;

  const key = queryKeys.profile.subscribedOtts(userId);
  const listeners = new Set<() => void>();
  let state: SubscribedOttSaveState = "idle";
  let saved = queryClient.getQueryData<string[]>(key) ?? EMPTY_GROUPS;
  let desired = saved;
  let inFlight: string[] | null = null;
  const isCurrent = () => SUBSCRIBED_OTT_FEATURES_ENABLED
    && useAuthStore.getState().user?.id === userId
    && queryClient.getQueryCache().find({ queryKey: key, exact: true }) === query;
  const setState = (next: SubscribedOttSaveState) => {
    if (state === next) return;
    state = next;
    listeners.forEach(listener => listener());
  };

  const flush = async (): Promise<void> => {
    if (!isCurrent()) return;
    const next = nextSubscribedOttWrite({ inFlight, desired, saved });
    if (next === null) return;
    inFlight = next;
    setState("saving");
    try {
      const result = await saveSubscribedOtts(next);
      // Cache clearing gives this account a new Query object. A late write must
      // neither recreate the old cache nor continue its queued selection.
      if (!isCurrent()) return;
      saved = result;
      inFlight = null;
      if (nextSubscribedOttWrite({ inFlight, desired, saved }) !== null) {
        void flush();
      } else {
        queryClient.setQueryData(key, saved);
        setState("saved");
      }
    } catch {
      if (!isCurrent()) return;
      inFlight = null;
      desired = saved;
      queryClient.setQueryData(key, saved);
      setState("error");
      useAppUIStore.getState().addToast(SUBSCRIBED_OTT_COPY.saveFailed, "error");
    }
  };

  const controller: SaveController = {
    query,
    getSnapshot: () => state,
    subscribe: listener => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setGroups: nextDesired => {
      if (!isCurrent() || queryClient.getQueryState(key)?.status !== "success") return;
      // A completed refetch can replace the last baseline between edit sessions.
      if (inFlight === null) saved = queryClient.getQueryData<string[]>(key) ?? EMPTY_GROUPS;
      desired = normalizeSubscribedOtts(nextDesired);
      void queryClient.cancelQueries({ queryKey: key, exact: true });
      queryClient.setQueryData(key, desired);
      void flush();
    }
  };
  accounts.set(userId, controller);
  return controller;
}

export function useSubscribedOtts(): {
  groups: string[];
  isReady: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  saveState: SubscribedOttSaveState;
  setGroups: (desired: readonly string[]) => void;
} {
  const userId = useAuthStore(state => state.user?.id ?? null);
  const queryClient = useQueryClient();
  const enabled = SUBSCRIBED_OTT_FEATURES_ENABLED && Boolean(userId);
  const key = queryKeys.profile.subscribedOtts(userId ?? "anonymous");
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getSubscribedOtts(userId!, signal),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false
  });
  const cacheQuery = queryClient.getQueryCache().find({ queryKey: key, exact: true });
  const controller = useMemo(
    () => enabled && userId && cacheQuery ? getSaveController(queryClient, userId, cacheQuery) : null,
    [enabled, queryClient, userId, cacheQuery]
  );
  const saveState = useSyncExternalStore(
    controller?.subscribe ?? emptySubscribe,
    controller?.getSnapshot ?? idleSnapshot,
    idleSnapshot
  );
  const isReady = enabled && query.isSuccess;
  const { refetch: refetchQuery } = query;
  const refetch = useCallback(() => {
    if (enabled) void refetchQuery();
  }, [enabled, refetchQuery]);
  const setGroups = useCallback((desired: readonly string[]) => {
    if (isReady) controller?.setGroups(desired);
  }, [controller, isReady]);

  return {
    groups: isReady ? query.data ?? EMPTY_GROUPS : EMPTY_GROUPS,
    isReady,
    isLoading: enabled && query.isLoading,
    isError: enabled && query.isError,
    refetch,
    saveState,
    setGroups
  };
}
