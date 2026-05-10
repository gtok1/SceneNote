import { useEffect, type ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const setSession = useAuthStore((state) => state.setSession);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const timeout = new Promise<{ data: { session: null } }>((resolve) => {
      setTimeout(() => resolve({ data: { session: null } }), 2000);
    });

    Promise.race([supabase.auth.getSession(), timeout])
      .then(({ data }) => {
        if (isMounted) setSession(data.session);
      })
      .catch(() => {
        if (isMounted) setSession(null);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [setLoading, setSession]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
