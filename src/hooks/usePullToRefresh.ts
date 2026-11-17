import { useCallback, useEffect, useRef, useState } from "react";

/** Only a user's pull controls the indicator; background queries keep their own state. */
export function usePullToRefresh(refetchers: readonly (() => Promise<unknown>)[]): { refreshing: boolean; onRefresh: () => void } {
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const currentRefetchers = useRef(refetchers);
  currentRefetchers.current = refetchers;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const onRefresh = useCallback(() => {
    if (inFlight.current || !mounted.current) return;
    inFlight.current = true;
    setRefreshing(true);
    // Defer each invocation so synchronous throws also settle and release the lock.
    void Promise.allSettled(currentRefetchers.current.map(run => Promise.resolve().then(run))).finally(() => {
      inFlight.current = false;
      if (mounted.current) setRefreshing(false);
    });
  }, []);

  return { refreshing, onRefresh };
}
