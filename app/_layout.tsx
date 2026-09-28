import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Stack, useGlobalSearchParams, usePathname, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StackBackButton } from "@/components/common/StackBackButton";
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
import { colors, elevation, radius, typography } from "@/constants/theme";
import { PEOPLE_FEATURES_ENABLED } from "@/constants/features";
import { supabase } from "@/lib/supabase";
import { AppProviders } from "@/providers/AppProviders";
import { useAuthStore } from "@/stores/authStore";
import { getAuthLinkSession } from "@/utils/authLinks";
import { getBottomNavMetrics } from "@/utils/bottomNavLayout";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AppProviders>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: true, title: "SceneNote", headerBackVisible: false, headerLeft: () => <StackBackButton /> }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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

const visibleNavItems = navItems.filter(item => PEOPLE_FEATURES_ENABLED || item.href !== "/people");

type NavHref = (typeof navItems)[number]["href"];

function GlobalBottomNav() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const metrics = getBottomNavMetrics(width, visibleNavItems.length);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const session = useAuthStore((state) => state.session);
  const segments = useSegments();
  const [focusedHref, setFocusedHref] = useState<NavHref | null>(null);
  const activeHref = getActiveNavHref(pathname, searchParams);

  if (!session || segments[0] !== "(tabs)") return null;

  return (
    <View style={[styles.bottomNav, { paddingBottom: insets.bottom, paddingLeft: Math.max(4, insets.left), paddingRight: Math.max(4, insets.right) }]}>
      <View style={styles.navRow}>
        {visibleNavItems.map((item) => {
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
              <View style={[styles.navIcon, { width: metrics.iconPillWidth }, active ? styles.navIconActive : null]}>
                <Icon active={active} color={active ? colors.primary : colors.textMuted} size={24} />
              </View>
              <Text numberOfLines={1} style={[styles.navLabel, { fontSize: metrics.labelFontSize }, active ? styles.navLabelActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
    ...elevation.bar,
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "column",
    flexShrink: 0,
    paddingTop: 6
  },
  navRow: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center"
  },
  navItem: {
    alignItems: "center",
    borderRadius: radius.md,
    flex: 1,
    minWidth: 0,
    gap: 2,
    minHeight: 56,
    paddingVertical: 4,
    justifyContent: "center",
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
  navIcon: {
    width: 56,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  navIconActive: {
    backgroundColor: colors.primarySoft
  },
  navLabel: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: "center"
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: "700"
  }
});
