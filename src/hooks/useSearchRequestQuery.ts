import { useCallback, useEffect, useRef, useState } from "react";

import { nextSearchRequestQuery, SEARCH_QUERY_DEBOUNCE_MS } from "@/utils/searchRequestQuery";

export function useSearchRequestQuery(query: string, delayMs = SEARCH_QUERY_DEBOUNCE_MS): {
  requestQuery: string;
  flush: (value?: string) => boolean;
} {
  const [requestQuery, setRequestQuery] = useState(() => nextSearchRequestQuery("", query));
  const current = useRef(requestQuery);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = useCallback((value: string): boolean => {
    const next = nextSearchRequestQuery(current.current, value);
    if (next === current.current) return false;
    current.current = next;
    setRequestQuery(next);
    return true;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pending.current !== timer) return;
      pending.current = null;
      update(query);
    }, delayMs);
    pending.current = timer;
    return () => {
      clearTimeout(timer);
      if (pending.current === timer) pending.current = null;
    };
  }, [query, delayMs, update]);

  const flush = useCallback((value = query): boolean => {
    if (pending.current !== null) clearTimeout(pending.current);
    pending.current = null;
    return update(value);
  }, [query, update]);

  return { requestQuery, flush };
}
