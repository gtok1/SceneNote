import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { ErrorState } from "@/components/common/ErrorState";
import { colors, radius, spacing } from "@/constants/theme";
import { useAddToLibrary, useLibrary } from "@/hooks/useLibrary";
import { usePopularRecommendations } from "@/hooks/usePopularRecommendations";
import type {
  RecommendationCategory,
  PopularRecommendation
} from "@/services/popularRecommendations";
import { useRecommendationUiStore } from "@/stores/recommendationUiStore";

const CATEGORY_OPTIONS: { value: RecommendationCategory; label: string }[] = [
  { value: "drama", label: "드라마 Top 10" },
  { value: "anime", label: "애니 Top 10" }
];
const CURRENT_RELEASE_YEAR = new Date().getFullYear();
const VISIBLE_TOP_LIMIT = 10;

export function PopularRecommendationSection() {
  const router = useRouter();
  const recommendations = usePopularRecommendations();
  const library = useLibrary("all");
  const addToLibrary = useAddToLibrary();
  const { excludedRecommendationKeys, excludeRecommendation } = useRecommendationUiStore();
  const [category, setCategory] = useState<RecommendationCategory>("drama");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(() => new Set());
  const [pageByCategory, setPageByCategory] = useState<Record<RecommendationCategory, number>>({
    drama: 0,
    anime: 0
  });
  const emptyAlertKeyRef = useRef<string | null>(null);
  const libraryKeys = useMemo(
    () =>
      new Set(
        (library.data ?? [])
          .filter((item) => item.source_api !== "manual")
          .map((item) => `${item.source_api}:${item.source_id}`)
      ),
    [library.data]
  );
  const excludedKeys = useMemo(
    () => new Set(excludedRecommendationKeys),
    [excludedRecommendationKeys]
  );
  const activeItems = useMemo(
    () =>
      createVisibleRecommendations(
        recommendations.data?.categories[category] ?? [],
        libraryKeys,
        addedKeys,
        excludedKeys,
        pageByCategory[category]
      ),
    [
      addedKeys,
      category,
      excludedKeys,
      libraryKeys,
      pageByCategory,
      recommendations.data?.categories
    ]
  );
  const hasRecommendations = activeItems.length > 0;
  const isLoading = recommendations.isLoading || library.isLoading;
  const activePage = pageByCategory[category];

  useEffect(() => {
    if (
      category !== "drama" ||
      isLoading ||
      recommendations.isError ||
      !recommendations.data ||
      hasRecommendations
    ) {
      return;
    }

    const alertKey = [
      category,
      activePage,
      recommendations.data.generated_at,
      excludedRecommendationKeys.length,
      libraryKeys.size,
      addedKeys.size
    ].join(":");
    if (emptyAlertKeyRef.current === alertKey) return;

    emptyAlertKeyRef.current = alertKey;
    Alert.alert("최신 작품 없음", "최신 작품은 없습니다.");
  }, [
    activePage,
    addedKeys.size,
    category,
    excludedRecommendationKeys.length,
    hasRecommendations,
    isLoading,
    libraryKeys.size,
    recommendations.data,
    recommendations.isError
  ]);

  const openRecommendation = (item: PopularRecommendation) => {
    router.push({
      pathname: "/content/[id]",
      params: {
        id: `${item.external_source}:${item.external_id}`,
        source: item.external_source,
        externalId: item.external_id,
        title: item.title_primary,
        originalTitle: item.title_original ?? "",
        posterUrl: item.poster_url ?? "",
        overview: item.localized_overview ?? item.overview ?? "",
        contentType: item.content_type,
        airYear: item.air_year ? String(item.air_year) : "",
        hasSeasons: item.has_seasons ? "true" : "false",
        episodeCount: item.episode_count ? String(item.episode_count) : ""
      }
    });
  };

  const addRecommendation = (item: PopularRecommendation) => {
    const key = createRecommendationKey(item);
    setPendingKey(key);

    addToLibrary.mutate(
      { result: item, status: "wishlist" },
      {
        onSuccess: () => {
          setAddedKeys((previous) => new Set(previous).add(key));
        },
        onError: (error) => {
          Alert.alert("보고싶음 추가 실패", error.message);
        },
        onSettled: () => {
          setPendingKey(null);
        }
      }
    );
  };

  const excludeRecommendationItem = (item: PopularRecommendation) => {
    excludeRecommendation(createRecommendationKey(item));
  };

  const refreshRecommendations = () => {
    setPageByCategory((previous) => ({
      ...previous,
      [category]: previous[category] + 1
    }));
    void recommendations.refetch();
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>인기 추천</Text>
          <Text style={styles.title}>지금 많이 찾는 작품</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={refreshRecommendations}
          style={styles.refreshButton}
        >
          <Ionicons color={colors.primary} name="refresh-outline" size={18} />
        </Pressable>
      </View>

      <View style={styles.segmented}>
        {CATEGORY_OPTIONS.map((option) => {
          const selected = option.value === category;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => setCategory(option.value)}
              style={[styles.segment, selected ? styles.segmentSelected : null]}
            >
              <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ScrollView
          contentContainerStyle={styles.cardList}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={styles.skeletonCard} />
          ))}
        </ScrollView>
      ) : null}

      {recommendations.isError ? (
        <ErrorState
          message="인기 추천을 불러오지 못했습니다"
          onRetry={() => recommendations.refetch()}
        />
      ) : null}

      {!isLoading && !recommendations.isError && hasRecommendations ? (
        <ScrollView
          contentContainerStyle={styles.cardList}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {activeItems.map((item) => {
            const key = createRecommendationKey(item);
            const isPending = pendingKey === key && addToLibrary.isPending;
            const isDisabled = addToLibrary.isPending;

            return (
              <RecommendationCard
                isAdded={false}
                isDisabled={isDisabled}
                isPending={isPending}
                item={item}
                key={key}
                onAdd={() => addRecommendation(item)}
                onExclude={() => excludeRecommendationItem(item)}
                onPress={() => openRecommendation(item)}
              />
            );
          })}
        </ScrollView>
      ) : null}

      {!isLoading && !recommendations.isError && !hasRecommendations ? (
        <View style={styles.emptyFrame}>
          <Ionicons color={colors.textMuted} name="albums-outline" size={24} />
          <Text style={styles.emptyText}>표시할 인기 추천이 없습니다.</Text>
        </View>
      ) : null}

      {recommendations.data?.partial ? (
        <Text style={styles.partialText}>일부 추천 소스를 불러오지 못했습니다.</Text>
      ) : null}
    </View>
  );
}

function RecommendationCard({
  item,
  isAdded,
  isDisabled,
  isPending,
  onAdd,
  onExclude,
  onPress
}: {
  item: PopularRecommendation;
  isAdded: boolean;
  isDisabled: boolean;
  isPending: boolean;
  onAdd: () => void;
  onExclude: () => void;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.posterButton}>
        <Image
          accessibilityLabel={item.title_primary}
          contentFit="cover"
          source={item.poster_url ? { uri: item.poster_url } : null}
          style={styles.poster}
        />
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{item.rank}</Text>
        </View>
      </Pressable>

      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.cardTitle}>
          {item.title_primary}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {[item.air_year, item.content_type, item.trend_source].filter(Boolean).join(" · ")}
        </Text>
        <GenreBadgeList genres={item.genres} maxVisible={2} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onAdd}
        style={[
          styles.addButton,
          isAdded ? styles.addButtonDone : null,
          isPending ? styles.addButtonPending : null
        ]}
      >
        <Ionicons
          color={isAdded ? colors.success : colors.surface}
          name={isAdded ? "checkmark" : "add"}
          size={16}
        />
        <Text style={[styles.addText, isAdded ? styles.addTextDone : null]}>
          {isPending ? "추가 중" : isAdded ? "보고싶음" : "추가"}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onExclude}
        style={styles.excludeButton}
      >
        <Ionicons color={colors.textMuted} name="remove-circle-outline" size={16} />
        <Text style={styles.excludeText}>제외</Text>
      </Pressable>
    </View>
  );
}

function createRecommendationKey(item: PopularRecommendation): string {
  return `${item.external_source}:${item.external_id}`;
}

function createVisibleRecommendations(
  items: PopularRecommendation[],
  libraryKeys: Set<string>,
  addedKeys: Set<string>,
  excludedKeys: Set<string>,
  page: number
): PopularRecommendation[] {
  const eligibleItems = items
    .filter((item) => item.air_year === CURRENT_RELEASE_YEAR)
    .sort(compareRecommendationRecency)
    .filter((item) => {
      const key = createRecommendationKey(item);
      return !libraryKeys.has(key) && !addedKeys.has(key) && !excludedKeys.has(key);
    });

  if (!eligibleItems.length) return [];
  const startIndex = page * VISIBLE_TOP_LIMIT;
  if (startIndex >= eligibleItems.length) return [];

  return eligibleItems.slice(startIndex, startIndex + VISIBLE_TOP_LIMIT).map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}

function compareRecommendationRecency(a: PopularRecommendation, b: PopularRecommendation): number {
  return getReleaseMonthScore(b) - getReleaseMonthScore(a) || a.rank - b.rank;
}

function getReleaseMonthScore(item: PopularRecommendation): number {
  const month = item.release_month ?? 0;
  if (month > 0 && month <= new Date().getMonth() + 1) return month;
  return 0;
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
    paddingVertical: spacing.md
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg
  },
  headerText: {
    gap: 2
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  segmented: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg
  },
  segment: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  segmentSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800"
  },
  segmentTextSelected: {
    color: colors.surface
  },
  cardList: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    width: 156
  },
  posterButton: {
    backgroundColor: colors.surfaceMuted,
    height: 218,
    position: "relative",
    width: "100%"
  },
  poster: {
    backgroundColor: colors.surfaceMuted,
    height: "100%",
    width: "100%"
  },
  rankBadge: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderBottomRightRadius: radius.md,
    height: 32,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    top: 0,
    width: 34
  },
  rankText: {
    color: colors.warning,
    fontSize: 16,
    fontWeight: "900"
  },
  cardBody: {
    gap: spacing.xs,
    minHeight: 92,
    padding: spacing.sm
  },
  cardTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  meta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  addButtonDone: {
    backgroundColor: colors.successSoft
  },
  addButtonPending: {
    opacity: 0.7
  },
  addText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900"
  },
  addTextDone: {
    color: colors.success
  },
  excludeButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  excludeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900"
  },
  skeletonCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    height: 396,
    width: 156
  },
  emptyFrame: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    justifyContent: "center",
    marginHorizontal: spacing.lg,
    minHeight: 396,
    paddingHorizontal: spacing.lg
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  partialText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: spacing.lg
  }
});
