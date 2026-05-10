import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { radius, spacing } from "@/constants/theme";
import {
  WATCH_PROVIDER_CATEGORIES,
  WATCH_PROVIDER_CATEGORY_LABEL,
  type WatchProvider,
  type WatchProviderCategory,
  type WatchProvidersByCategory
} from "@/types/watchProviders";

interface WatchProviderListProps {
  providers: WatchProvidersByCategory;
  isLoading?: boolean;
  error?: string | null;
}

export function WatchProviderList({ providers, isLoading = false, error = null }: WatchProviderListProps) {
  const [selectedCategory, setSelectedCategory] = useState<WatchProviderCategory>("flatrate");
  const hasAnyProvider = WATCH_PROVIDER_CATEGORIES.some((category) => providers[category].length > 0);
  const activeProviders = providers[selectedCategory];

  const openProvider = (provider: WatchProvider) => {
    if (!provider.link) return;
    void Linking.openURL(provider.link);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>보러가기</Text>
        <Text style={styles.region}>KR</Text>
      </View>

      <View style={styles.tabs}>
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
      </View>

      {isLoading ? <Text style={styles.emptyText}>시청 가능한 플랫폼 정보를 불러오는 중입니다.</Text> : null}
      {!isLoading && error ? <Text style={styles.emptyText}>{error}</Text> : null}
      {!isLoading && !error && !hasAnyProvider ? (
        <Text style={styles.emptyText}>시청 가능한 플랫폼 정보가 없습니다.</Text>
      ) : null}
      {!isLoading && !error && hasAnyProvider && activeProviders.length === 0 ? (
        <Text style={styles.emptyText}>시청 가능한 플랫폼 정보가 없습니다.</Text>
      ) : null}

      {!isLoading && !error && activeProviders.length > 0 ? (
        <View style={styles.list}>
          {activeProviders.map((provider) => (
            <Pressable
              accessibilityRole="link"
              disabled={!provider.link}
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
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: "#111827",
    borderRadius: radius.md,
    gap: spacing.md,
    padding: spacing.md
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
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
  }
});
