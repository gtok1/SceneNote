import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { canDisplayWatchProviderAvailability, describeNoKrProviders, describeNoSeasonProviders, DISNEY_PLUS_HOME_URL, formatRegionNames, normalizeWatchProviderLink, pickInitialWatchCategory, WATCH_PROVIDER_REFRESH_MESSAGE } from "@/utils/watchProviderDisplay";
import { isWatchProviderResponseCompatible } from "@/utils/watchProviderLookup";
import { useAppUIStore } from "@/stores/appUIStore";
import {
  WATCH_PROVIDER_CATEGORIES,
  WATCH_PROVIDER_CATEGORY_LABEL,
  type WatchProvider,
  type WatchProviderCategory,
  type WatchProvidersByCategory,
  type WatchProvidersResponse
} from "@/types/watchProviders";

interface WatchProviderListProps {
  response: WatchProvidersResponse;
  isLoading?: boolean;
  error?: string | null;
  seasonNumber?: number | null;
  requireSeasonMatch?: boolean;
  onRetry: (() => void) | null;
  laftelSearchUrl?: string | null;
}

const emptyProviders: WatchProvidersByCategory = { flatrate: [], free: [], rent: [], buy: [] };

export function WatchProviderList({ response, isLoading = false, error = null, seasonNumber = null, requireSeasonMatch = false, onRetry, laftelSearchUrl = null }: WatchProviderListProps) {
  const addToast = useAppUIStore(state => state.addToast);
  const canShowAvailability = canDisplayWatchProviderAvailability({ response, seasonNumber, requireSeasonMatch });
  const responseCompatible = isWatchProviderResponseCompatible({ response, seasonNumber, requireSeasonMatch });
  const providers = canShowAvailability ? response.providers : emptyProviders;
  const otherRegions = canShowAvailability ? response.other_regions ?? [] : [];
  const [selectedCategory, setSelectedCategory] = useState<WatchProviderCategory>(() => pickInitialWatchCategory(providers));
  const providerIds = WATCH_PROVIDER_CATEGORIES.map(category =>
    `${category}:${providers[category].map(provider => provider.provider_id).join(",")}`
  ).join("|");
  useEffect(() => {
    setSelectedCategory(pickInitialWatchCategory(providers));
    // Reset only when the available provider identities change, not after a user's tab selection.
  }, [providerIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasAnyProvider = WATCH_PROVIDER_CATEGORIES.some((category) => providers[category].length > 0);
  const activeProviders = providers[selectedCategory];
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

      {!isLoading && !error && hasAnyProvider ? <View style={styles.tabs}>
        {WATCH_PROVIDER_CATEGORIES.map((category) => {
          const selected = selectedCategory === category;
          const count = providers[category].length;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
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
      {!isLoading && error ? <Text style={styles.emptyText}>{error}</Text> : null}
      {!isLoading && !error && !hasAnyProvider ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{!responseCompatible ? WATCH_PROVIDER_REFRESH_MESSAGE : requireSeasonMatch ? describeNoSeasonProviders(seasonNumber) : describeNoKrProviders(otherRegions)}</Text>
          {requireSeasonMatch ? <Text style={styles.scopeHint}>다른 시즌의 제공처는 표시하지 않아요.</Text> : null}
          {requireSeasonMatch && otherRegions.length > 0 ? <Text style={styles.scopeHint}>{formatRegionNames(otherRegions)}에서 이 시즌의 제공 정보가 확인됐어요.</Text> : null}
        </View>
      ) : null}
      {!isLoading && !error && hasAnyProvider && activeProviders.length === 0 ? (
        <Text style={styles.emptyText}>이 이용 방식의 제공 정보를 아직 확인하지 못했어요.</Text>
      ) : null}

      {!isLoading && !error && activeProviders.length > 0 ? (
        <View style={styles.list}>
          {activeProviders.map((provider) => (
            <Pressable
              accessibilityRole="link"
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
                <Text numberOfLines={1} style={styles.providerName}>
                  {provider.provider_name}
                </Text>
                <Text style={styles.providerType}>{provider.service_type_label}</Text>
              </View>
              <Ionicons color="#9CA3AF" name="chevron-forward" size={20} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {!isLoading && onRetry && (error || !hasAnyProvider) ? <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.retryButton, pressed ? styles.laftelPressed : null]}
      ><Text style={styles.laftelLabel}>다시 확인하기</Text></Pressable> : null}
      {!isLoading && !error && activeProviders.some(provider => normalizeWatchProviderLink(provider.link) === DISNEY_PLUS_HOME_URL) ? (
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
  heading: { flex: 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  emptyState: { gap: spacing.sm },
  retryButton: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.textSubtle, borderRadius: radius.pill },
  scopeHint: { ...typography.caption, color: colors.textSubtle },
  laftelSearch: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  laftelPressed: { opacity: 0.72 },
  laftelTextBox: { flex: 1, minWidth: 0, gap: spacing.xs },
  laftelLabel: { ...typography.label, color: colors.primarySoft },
  section: {
    backgroundColor: "#111827",
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
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "900"
  },
  region: {
    backgroundColor: "#1F2937",
    borderRadius: radius.sm,
    color: "#D1D5DB",
    fontSize: 11,
    fontWeight: "900",
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
    backgroundColor: "#1F2937",
    borderColor: "#374151",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  tabSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#60A5FA"
  },
  tabText: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "800"
  },
  tabTextSelected: {
    color: "#FFFFFF"
  },
  tabCount: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "900"
  },
  list: {
    gap: spacing.sm
  },
  item: {
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderColor: "#374151",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  logo: {
    backgroundColor: "#374151",
    borderRadius: radius.sm,
    height: 42,
    width: 42
  },
  providerTextBox: {
    flex: 1,
    gap: 2
  },
  providerName: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "900"
  },
  providerType: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700"
  },
  emptyText: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  attribution: { fontSize: 11, color: "#9CA3AF" }
});
