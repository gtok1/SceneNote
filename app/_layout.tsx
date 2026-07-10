import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Stack, useGlobalSearchParams, usePathname, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ToastViewport } from "@/components/common/ToastViewport";
import {
  ArchiveBoxIcon,
  CompassIcon,
  HomeTheaterIcon,
  PersonChatIcon,
  PinQuoteIcon,
  UserSettingsIcon
} from "@/components/icons/FooterIcons";
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
          <Stack.Screen name="share/index" />
          <Stack.Screen name="share/[id]" />
          <Stack.Screen name="people/[id]" />
          <Stack.Screen name="settings/excluded-recommendations" />
        </Stack>
        <AuthRedirect />
        <AuthLinkHandler />
        <GlobalBottomNav />
        <ToastViewport />
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
    const inPublicShare = routeSegments[0] === "share";
    const inPasswordReset = inAuthGroup && routeSegments[1] === "reset-password";
    const nextPath = !session && !inAuthGroup && !inPublicShare
      ? "/onboarding"
      : session && inAuthGroup && !inPasswordReset
        ? "/"
        : null;

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
  { href: "/", label: "홈", icon: HomeTheaterIcon, ariaLabel: "홈으로 이동" },
  { href: "/search", label: "검색", icon: CompassIcon, ariaLabel: "검색으로 이동" },
  { href: "/library", label: "라이브러리", icon: ArchiveBoxIcon, ariaLabel: "라이브러리로 이동" },
  { href: "/pins", label: "핀", icon: PinQuoteIcon, ariaLabel: "핀으로 이동" },
  { href: "/people", label: "인물", icon: PersonChatIcon, ariaLabel: "인물로 이동" },
  { href: "/profile", label: "프로필", icon: UserSettingsIcon, ariaLabel: "프로필로 이동" }
] as const;

type NavHref = (typeof navItems)[number]["href"];

function GlobalBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const session = useAuthStore((state) => state.session);
  const segments = useSegments();
  const [focusedHref, setFocusedHref] = useState<NavHref | null>(null);
  const activeHref = getActiveNavHref(pathname, searchParams);

  if (!session || segments[0] === "(auth)" || segments[0] === "share") return null;

  return (
    <View style={styles.bottomNav}>
      {navItems.map((item) => {
        const active = item.href === activeHref;
        const Icon = item.icon;

        return (
          <Pressable
            accessibilityLabel={item.ariaLabel}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            aria-current={active ? "page" : undefined}
            key={item.href}
            onBlur={() => setFocusedHref(null)}
            onFocus={() => setFocusedHref(item.href)}
            onPress={() => router.replace(item.href)}
            style={({ hovered }) => [
              styles.navItem,
              hovered ? styles.navItemHovered : null,
              focusedHref === item.href ? styles.navItemFocused : null
            ]}
          >
            {active ? <View style={styles.navActiveIndicator} /> : null}
            <Icon active={active} color={active ? colors.primary : "#64748B"} size={24} />
            <Text style={[styles.navLabel, active ? styles.navLabelActive : null]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getActiveNavHref(pathname: string, searchParams: Record<string, unknown>): NavHref | null {
  const route = pathname.replace(/^\/\(tabs\)/, "") || "/";

  if (route === "/") return "/";
  if (route === "/search" || route.startsWith("/search/")) return "/search";
  if (route === "/library" || route.startsWith("/library/")) return "/library";
  if (route === "/pins" || route.startsWith("/pins/")) return "/pins";
  if (route === "/people" || route.startsWith("/people/")) return "/people";
  if (route === "/profile" || route.startsWith("/profile/")) return "/profile";

  if (route === "/content" || route.startsWith("/content/")) {
    return hasSearchParam(searchParams.source) || hasSearchParam(searchParams.externalId) ? "/search" : "/library";
  }

  return null;
}

function hasSearchParam(value: unknown): boolean {
  return Array.isArray(value) ? value.some(Boolean) : Boolean(value);
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
    backgroundColor: "#FFFFFF",
    borderTopColor: "#E5E7EB",
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: "row",
    height: 72,
    justifyContent: "space-around",
    left: 0,
    paddingHorizontal: 16,
    position: "absolute",
    right: 0,
    zIndex: 1000
  },
  navItem: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    gap: 4,
    height: 56,
    justifyContent: "center",
    maxWidth: 112,
    minWidth: 72,
    position: "relative"
  },
  navItemHovered: {
    backgroundColor: "#EFF6FF"
  },
  navItemFocused: {
    outlineColor: colors.primary,
    outlineOffset: 2,
    outlineStyle: "solid",
    outlineWidth: 2
  },
  navActiveIndicator: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 3,
    bottom: 0,
    position: "absolute",
    width: 24
  },
  navLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 12
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: "700"
  }
});
