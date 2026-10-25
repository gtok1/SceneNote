import { useEffect, type ReactNode } from "react";

import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { createAuthSessionSync } from "@/utils/authSessionSync";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const setSession = useAuthStore((state) => state.setSession);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    setLoading(true);
    let timeout: ReturnType<typeof setTimeout>;
    const sync = createAuthSessionSync<Session>({
      getCurrentUserId: () => useAuthStore.getState().user?.id ?? null,
      setSession: (session) => {
        clearTimeout(timeout);
        setSession(session);
      },
      clearUserCache: () => queryClient.clear()
    });
    timeout = setTimeout(() => sync.onInitializationTimeout(), 2000);

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      sync.onAuthStateChange(session);
    });

    void supabase.auth.getSession()
      .then(({ data }) => sync.onInitialSession(data.session))
      .catch(() => sync.onInitialSession(null));

    return () => {
      sync.dispose();
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [setLoading, setSession]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
