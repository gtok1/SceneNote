import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import type { Database } from "@/types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";
const canPersistAuth = Platform.OS !== "web" || typeof window !== "undefined";
const canDetectSessionInUrl = Platform.OS === "web" && typeof window !== "undefined";
const noopAuthStorage = {
  getItem: async (_key: string) => null,
  setItem: async (_key: string, _value: string) => undefined,
  removeItem: async (_key: string) => undefined
};

export const hasSupabaseConfig =
  Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: canPersistAuth ? AsyncStorage : noopAuthStorage,
    autoRefreshToken: canPersistAuth,
    persistSession: canPersistAuth,
    detectSessionInUrl: canDetectSessionInUrl
  }
});
