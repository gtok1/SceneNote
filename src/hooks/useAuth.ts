import { useMutation } from "@tanstack/react-query";

import { queryClient } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

export function useAuth() {
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const reset = useAuthStore((state) => state.reset);

  const signIn = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    }
  });

  const signUp = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
    }
  });

  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      reset();
      queryClient.clear();
    }
  });

  return {
    session,
    user,
    isLoading,
    isAuthenticated: Boolean(session?.user),
    signIn,
    signUp,
    signOut
  };
}
