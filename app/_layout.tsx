import { useEffect } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { Stack, usePathname, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { AppProviders } from "@/providers/AppProviders";
import { useAuthStore } from "@/stores/authStore";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AppProviders>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="people/[id]" />
        </Stack>
        <AuthRedirect />
        <NativePasswordRecoveryLinkHandler />
        <GlobalBottomNav />
        <AuthLoadingOverlay />
      </AppProviders>
    </GestureHandlerRootView>
  );
}

function getRecoverySessionTokens(url: string) {
  const marker = url.includes("#") ? "#" : url.includes("?") ? "?" : null;
  if (!marker) return null;

  const params = new URLSearchParams(url.slice(url.indexOf(marker) + 1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) return null;

  return {
    access_token: accessToken,
    refresh_token: refreshToken
  };
}

function AuthRedirect() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    if (isLoading || !rootNavigationState?.key) return;

    const routeSegments = segments as readonly string[];
    const inAuthGroup = routeSegments[0] === "(auth)";
    const inPasswordReset = inAuthGroup && routeSegments[1] === "reset-password";
    const nextPath = !session && !inAuthGroup ? "/onboarding" : session && inAuthGroup && !inPasswordReset ? "/" : null;

    if (!nextPath) return;

    const redirectTimer = setTimeout(() => {
      router.replace(nextPath);
    }, 0);

    return () => clearTimeout(redirectTimer);
  }, [isLoading, rootNavigationState?.key, router, segments, session]);

  return null;
}

function NativePasswordRecoveryLinkHandler() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleUrl = (url: string | null) => {
      if (!url) return;

      const tokens = getRecoverySessionTokens(url);
      if (!tokens) return;

      void supabase.auth.setSession(tokens);
    };

    void Linking.getInitialURL().then(handleUrl);

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}

function AuthLoadingOverlay() {
  const isLoading = useAuthStore((state) => state.isLoading);

  if (!isLoading) return null;

  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const navItems = [
  { href: "/", label: "홈", icon: "home-outline" },
  { href: "/search", label: "검색", icon: "search-outline" },
  { href: "/library", label: "라이브러리", icon: "albums-outline" },
  { href: "/pins", label: "핀", icon: "pin-outline" },
  { href: "/people", label: "인물", icon: "star-outline" },
  { href: "/profile", label: "프로필", icon: "person-outline" }
] as const;

function GlobalBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((state) => state.session);
  const segments = useSegments();

  if (!session || segments[0] === "(auth)") return null;

  return (
    <View style={styles.bottomNav}>
      {navItems.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={item.href}
            onPress={() => router.replace(item.href)}
            style={styles.navItem}
          >
            <Ionicons
              color={active ? colors.primary : colors.textMuted}
              name={item.icon}
              size={24}
            />
            <Text style={[styles.navLabel, active ? styles.navLabelActive : null]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.background,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 2000
  },
  bottomNav: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: "row",
    height: 64,
    justifyContent: "space-around",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 1000
  },
  navItem: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    justifyContent: "center"
  },
  navLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  navLabelActive: {
    color: colors.primary
  }
});
