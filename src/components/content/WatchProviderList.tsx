import { useEffect, useMemo, useState } from "react";
import { Platform, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { canDisplayWatchProviderAvailability, describeNoKrProviders, describeNoSeasonProviders, DISNEY_PLUS_HOME_URL, formatRegionNames, normalizeWatchProviderLink, WATCH_PROVIDER_REFRESH_MESSAGE } from "@/utils/watchProviderDisplay";
import { isSubscribedProvider, pickInitialWatchCategoryForSubscription, sortProvidersBySubscription, subscribedOttAvailabilityNote, SUBSCRIBED_OTT_COPY } from "@/utils/subscribedOtt";
import { formatWatchProviderUpdatedAt, isWatchProviderResponseCompatible, watchProviderPersistenceNotice } from "@/utils/watchProviderLookup";
import { useAppUIStore } from "@/stores/appUIStore";
import {
  WATCH_PROVIDER_CATEGORIES,
  WATCH_PROVIDER_CATEGORY_LABEL,
  type WatchProvider,
  type WatchProviderCategory,
  type WatchProvidersByCategory,
  type WatchProvidersResponse
} from "@/types/watchProviders";
import { selectionAriaProps } from "@/utils/selectionAria";

interface WatchProviderListProps {
  response: WatchProvidersResponse;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  seasonNumber?: number | null;
  requireSeasonMatch?: boolean;
  onRetry: (() => void) | null;
  laftelSearchUrl?: string | null;
  subscribedOtts?: readonly string[];
  subscribedOttsReady?: boolean;
  onOpenOttSettings?: (() => void) | null;
}

const emptyProviders: WatchProvidersByCategory = { flatrate: [], free: [], rent: [], buy: [] };
const emptySubscriptions: readonly string[] = [];

export function WatchProviderList({ response, isLoading = false, isRefreshing = false, error = null, seasonNumber = null, requireSeasonMatch = false, onRetry, laftelSearchUrl = null, subscribedOtts = emptySubscriptions, subscribedOttsReady = false, onOpenOttSettings = null }: WatchProviderListProps) {
  const addToast = useAppUIStore(state => state.addToast);
  const canShowAvailability = canDisplayWatchProviderAvailability({ response, seasonNumber, requireSeasonMatch });
  const responseCompatible = isWatchProviderResponseCompatible({ response, seasonNumber, requireSeasonMatch });
  const hasLookupResult = response.lookup_version === 2 && responseCompatible;
  const lastCheckedLabel = hasLookupResult ? formatWatchProviderUpdatedAt(response.updated_at) : null;
  const persistenceNotice = hasLookupResult ? watchProviderPersistenceNotice(response) : null;
  const pending = isLoading || isRefreshing;
  const providers = canShowAvailability ? response.providers : emptyProviders;
  const otherRegions = canShowAvailability ? response.other_regions ?? [] : [];
  const [selectedCategory, setSelectedCategory] = useState<WatchProviderCategory>(() => pickInitialWatchCategoryForSubscription(providers, subscribedOtts));
  const providerIds = WATCH_PROVIDER_CATEGORIES.map(category =>
    `${category}:${providers[category].map(provider => provider.provider_id).join(",")}`
  ).join("|");
  const subscriptionSignature = subscribedOtts.join(",");
  useEffect(() => {
    setSelectedCategory(pickInitialWatchCategoryForSubscription(providers, subscribedOtts));
    // Keep a user's tab until provider identities or account subscriptions change.
  }, [providerIds, subscriptionSignature]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasAnyProvider = WATCH_PROVIDER_CATEGORIES.some((category) => providers[category].length > 0);
  const activeProviders = useMemo(() => sortProvidersBySubscription(providers[selectedCategory], selectedCategory, subscribedOtts), [providers, selectedCategory, subscribedOtts]);
  const subscriptionNote = useMemo(() => subscribedOttAvailabilityNote({ providers, subscribed: subscribedOtts }), [providers, subscribedOtts]);
  const laftelLabel = seasonNumber === null ? "라프텔에서 찾아보기" : seasonNumber === 0 ? "라프텔에서 스페셜 찾아보기" : `라프텔에서 ${seasonNumber}기 찾아보기`;

  const openProvider = (provider: WatchProvider) => {
    const link = normalizeWatchProviderLink(provider.link);
    if (!link) return;
    void Linking.openURL(link).catch(() => {
      addToast("시청 플랫폼을 열지 못했어요. 잠시 후 다시 시도해 주세요.", "error");
    });
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title}>보러가기</Text>
          {requireSeasonMatch ? <Text style={styles.scopeHint}>{seasonNumber === null ? "선택 시즌 기준" : seasonNumber === 0 ? "스페셜 기준" : `시즌 ${seasonNumber} 기준`}</Text> : null}
        </View>
        <Text style={styles.region}>KR</Text>
      </View>

      {!isLoading && hasAnyProvider ? <View style={styles.tabs}>
        {WATCH_PROVIDER_CATEGORIES.map((category) => {
          const selected = selectedCategory === category;
          const count = providers[category].length;

          return (
            <Pressable
              accessibilityRole="button"
              {...selectionAriaProps("button", selected, Platform.OS)}
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[styles.tab, selected ? styles.tabSelected : null]}
            >
              <Text style={[styles.tabText, selected ? styles.tabTextSelected : null]}>
                {WATCH_PROVIDER_CATEGORY_LABEL[category]}
              </Text>
              {count > 0 ? <Text style={[styles.tabCount, selected ? styles.tabTextSelected : null]}>{count}</Text> : null}
            </Pressable>
          );
        })}
      </View> : null}

      {isLoading ? <Text style={styles.emptyText}>시청 가능한 플랫폼 정보를 불러오는 중입니다.</Text> : null}
      {isRefreshing ? <Text accessibilityLiveRegion="polite" style={styles.scopeHint}>새로운 시청 정보를 확인하고 있어요. 저장된 정보는 계속 볼 수 있어요.</Text> : null}
      {!isLoading && error ? <Text style={styles.emptyText}>{error}</Text> : null}
      {!isLoading && (!error || hasLookupResult) && !hasAnyProvider ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{!responseCompatible ? WATCH_PROVIDER_REFRESH_MESSAGE : requireSeasonMatch ? describeNoSeasonProviders(seasonNumber) : describeNoKrProviders(otherRegions)}</Text>
          {requireSeasonMatch ? <Text style={styles.scopeHint}>다른 시즌의 제공처는 표시하지 않아요.</Text> : null}
          {requireSeasonMatch && otherRegions.length > 0 ? <Text style={styles.scopeHint}>{formatRegionNames(otherRegions)}에서 이 시즌의 제공 정보가 확인됐어요.</Text> : null}
        </View>
      ) : null}
      {!isLoading && hasAnyProvider && activeProviders.length === 0 ? (
        <Text style={styles.emptyText}>이 이용 방식의 제공 정보를 아직 확인하지 못했어요.</Text>
      ) : null}

      {!isLoading && activeProviders.length > 0 ? (
        <View style={styles.list}>
          {activeProviders.map((provider) => {
            const subscribed = isSubscribedProvider(provider.provider_id, selectedCategory, subscribedOtts);
            return (
              <Pressable
                accessibilityRole="link"
                {...(subscribed ? { accessibilityLabel: `${provider.provider_name}, 내 OTT, ${provider.service_type_label}` } : {})}
                disabled={!normalizeWatchProviderLink(provider.link)}
                key={`${provider.service_type}:${provider.provider_id}`}
                onPress={() => openProvider(provider)}
                style={styles.item}
              >
                <Image
                  contentFit="cover"
                  source={provider.logo_url ? { uri: provider.logo_url } : null}
                  style={styles.logo}
                />
                <View style={styles.providerTextBox}>
                  {subscribed ? <View style={styles.providerNameRow}>
                    <Text numberOfLines={1} style={[styles.providerName, styles.subscribedProviderName]}>{provider.provider_name}</Text>
                    <Text style={styles.subscribedBadge}>{SUBSCRIBED_OTT_COPY.badge}</Text>
                  </View> : <Text numberOfLines={1} style={styles.providerName}>
                    {provider.provider_name}
                  </Text>}
                  <Text style={styles.providerType}>{provider.service_type_label}</Text>
                </View>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={20} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {!isLoading && subscriptionNote ? <Text style={styles.scopeHint}>{subscriptionNote}</Text> : null}
      {!isLoading && subscribedOttsReady && subscribedOtts.length === 0 && hasAnyProvider && onOpenOttSettings ? <>
        <Text style={styles.scopeHint}>{SUBSCRIBED_OTT_COPY.registerHint}</Text>
        <Pressable accessibilityRole="button" onPress={onOpenOttSettings}
          style={({ pressed }) => [styles.retryButton, pressed ? styles.laftelPressed : null]}>
          <Text style={styles.laftelLabel}>{SUBSCRIBED_OTT_COPY.registerAction}</Text>
        </Pressable>
      </> : null}
      {lastCheckedLabel ? <Text style={styles.scopeHint}>{lastCheckedLabel}</Text> : null}
      {persistenceNotice ? <Text style={styles.scopeHint}>{persistenceNotice}</Text> : null}
      {onRetry ? <Pressable
        accessibilityRole="button"
        accessibilityLabel="시청 정보 다시 불러오기"
        aria-disabled={pending} aria-busy={pending}
        disabled={pending}
        onPress={onRetry}
        style={({ pressed }) => [styles.retryButton, pending || pressed ? styles.laftelPressed : null]}
      ><Text style={styles.laftelLabel}>{pending ? "불러오는 중…" : "다시 불러오기"}</Text></Pressable> : null}
      {!isLoading && activeProviders.some(provider => normalizeWatchProviderLink(provider.link) === DISNEY_PLUS_HOME_URL) ? (
        <Text style={styles.emptyText}>디즈니+ 홈으로 연결돼요. 로그인 후 작품명을 검색해 주세요.</Text>
      ) : null}
      {laftelSearchUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={laftelLabel}
          onPress={() => { void Linking.openURL(laftelSearchUrl).catch(() => {
            addToast("시청 플랫폼을 열지 못했어요. 잠시 후 다시 시도해 주세요.", "error");
          }); }}
          style={({ pressed }) => [styles.laftelSearch, pressed ? styles.laftelPressed : null]}
        >
          <Ionicons name="search" size={16} color={colors.primarySoft} />
          <View style={styles.laftelTextBox}>
            <Text style={styles.laftelLabel}>{laftelLabel}</Text>
            <Text style={styles.scopeHint}>제공 여부는 라프텔에서 확인해 주세요.</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={colors.textSubtle} />
        </Pressable>
      ) : null}
      <Text style={styles.attribution}>시청 정보 제공: JustWatch</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  providerNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 },
  subscribedProviderName: { flexShrink: 1, minWidth: 0 },
  subscribedBadge: { ...typography.micro, backgroundColor: colors.primary, color: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm },
  heading: { flex: 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  emptyState: { gap: spacing.sm },
  retryButton: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.textSubtle, borderRadius: radius.pill },
  scopeHint: { ...typography.caption, color: colors.textSubtle },
  laftelSearch: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  laftelPressed: { opacity: 0.72 },
  laftelTextBox: { flex: 1, minWidth: 0, gap: spacing.xs },
  laftelLabel: { ...typography.label, color: colors.primarySoft },
  section: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.md,
    gap: spacing.md,
    padding: spacing.md
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  title: {
    ...typography.headline,
    color: colors.textOnDark
  },
  region: {
    ...typography.micro,
    backgroundColor: colors.surfaceDarkRaised,
    borderRadius: radius.sm,
    color: colors.textOnDarkMuted,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  tab: {
    minHeight: 44,
    alignItems: "center",
    backgroundColor: colors.surfaceDarkRaised,
    borderColor: colors.borderDark,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  tabSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.focusOnDark
  },
  tabText: {
    ...typography.label,
    color: colors.textOnDarkMuted
  },
  tabTextSelected: {
    color: colors.surface
  },
  tabCount: {
    ...typography.caption,
    color: colors.textSubtle
  },
  list: {
    gap: spacing.sm
  },
  item: {
    alignItems: "center",
    backgroundColor: colors.surfaceDarkRaised,
    borderColor: colors.borderDark,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  logo: {
    backgroundColor: colors.borderDark,
    borderRadius: radius.sm,
    height: 42,
    width: 42
  },
  providerTextBox: {
    flex: 1,
    gap: spacing.xs
  },
  providerName: {
    ...typography.headline,
    color: colors.textOnDark
  },
  providerType: {
    ...typography.caption,
    color: colors.textSubtle
  },
  emptyText: {
    ...typography.label,
    color: colors.textOnDarkMuted
  },
  attribution: { ...typography.micro, color: colors.textSubtle }
});
