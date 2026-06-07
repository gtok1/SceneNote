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
import { getAuthLinkSession } from "@/utils/authLinks";

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
        <AuthLinkHandler />
        <GlobalBottomNav />
        <AuthLoadingOverlay />
      </AppProviders>
    </GestureHandlerRootView>
  );
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

function AuthLinkHandler() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) return;

    let isMounted = true;

    const handleUrl = async (url: string | null) => {
      if (!url) return;

      const authLinkSession = getAuthLinkSession(url);
      if (!authLinkSession) return;

      if (authLinkSession.kind === "tokens") {
        const { error } = await supabase.auth.setSession({
          access_token: authLinkSession.access_token,
          refresh_token: authLinkSession.refresh_token
        });
        if (error) return;
      } else {
        const { error } = await supabase.auth.exchangeCodeForSession(authLinkSession.code);
        if (error) return;
      }

      if (isMounted && authLinkSession.shouldSetPassword) {
        router.replace("/reset-password");
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      void handleUrl(window.location.href);
      return () => {
        isMounted = false;
      };
    }

    void Linking.getInitialURL().then(handleUrl);

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [rootNavigationState?.key, router]);

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
