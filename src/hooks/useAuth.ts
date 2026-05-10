import { useMutation } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

import { queryClient } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

function getPasswordResetRedirectUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/reset-password`;
  }

  return Linking.createURL("/reset-password");
}

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

  const requestPasswordReset = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl()
      });
      if (error) throw new Error(error.message);
    }
  });

  const updatePassword = useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      const {
        data: { session: currentSession },
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError) throw new Error(sessionError.message);
      if (!currentSession) throw new Error("비밀번호 재설정 링크로 다시 접속해 주세요");

      const { error } = await supabase.auth.updateUser({ password });
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
    requestPasswordReset,
    updatePassword,
    signOut
  };
}
