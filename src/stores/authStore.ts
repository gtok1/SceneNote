import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (isLoading: boolean) => void;
  reset: () => void;
}

const canUsePersistentStorage = Platform.OS !== "web" || typeof window !== "undefined";
const noopStorage = {
  getItem: async (_name: string) => null,
  setItem: async (_name: string, _value: string) => undefined,
  removeItem: async (_name: string) => undefined
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      isLoading: true,
      setSession: (session) => set({ session, user: session?.user ?? null, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => set({ session: null, user: null, isLoading: false })
    }),
    {
      name: "scenenote-auth",
      storage: createJSONStorage(() => (canUsePersistentStorage ? AsyncStorage : noopStorage)),
      partialize: (state) => ({
        session: state.session,
        user: state.user
      }),
      onRehydrateStorage: () => (state) => {
        state?.setLoading(false);
      }
    }
  )
);
