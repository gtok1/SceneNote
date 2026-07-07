import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { WatchStatusBadge } from "@/components/content/WatchStatusBadge";
import { colors, radius, spacing } from "@/constants/theme";
import { getLibraryShare } from "@/services/libraryShare";
import type { LibraryListItem } from "@/types/library";
import { createEpisodeCountLabel, createWatchCountLabel } from "@/utils/contentMetaDisplay";
import { CONTENT_TYPE_LABELS } from "@/utils/libraryFilters";
import { createReviewLabel } from "@/utils/reviewDisplay";

export default function LibraryShareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const shareId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { width } = useWindowDimensions();
  const columns = width >= 1280 ? 6 : width >= 960 ? 5 : width >= 700 ? 4 : 2;
  const cardWidth = `${100 / columns}%` as const;
  const share = useQuery({
    queryKey: ["library-share", shareId],
    queryFn: () => getLibraryShare(shareId ?? ""),
    enabled: Boolean(shareId),
    staleTime: 5 * 60_000
  });
  const filterLabel = useMemo(() => {
    const filters = share.data?.filters;
    if (!filters) return "";
    return [
      filters.statusFilter === "all" ? "전체" : undefined,
      filters.contentTypeFilter ? CONTENT_TYPE_LABELS[filters.contentTypeFilter] : undefined,
      filters.genreFilter && filters.genreFilter !== "all" ? filters.genreFilter : undefined,
      filters.year || undefined,
      filters.searchQuery ? `"${filters.searchQuery}"` : undefined
    ].filter(Boolean).join(" · ");
  }, [share.data?.filters]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={styles.homeButton}>
          <Ionicons color={colors.text} name="home-outline" size={18} />
          <Text style={styles.homeButtonText}>SceneNote</Text>
        </Pressable>
        <View style={styles.titleBox}>
          <Text style={styles.eyebrow}>{share.data?.ownerDisplayName ?? "SceneNote"}님의 공유 목록</Text>
          <Text style={styles.title}>{share.data?.title ?? "공유 라이브러리"}</Text>
          {filterLabel ? <Text style={styles.meta}>{filterLabel}</Text> : null}
        </View>
      </View>

      {share.isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.centerText}>공유 목록을 불러오고 있습니다.</Text>
        </View>
      ) : null}

      {share.isError ? (
        <View style={styles.errorPanel}>
          <Ionicons color={colors.danger} name="warning-outline" size={22} />
          <View style={styles.errorTextBox}>
            <Text style={styles.errorTitle}>공유 목록을 열 수 없습니다</Text>
            <Text style={styles.errorText}>
              {share.error instanceof Error ? share.error.message : "공유 링크가 만료되었거나 존재하지 않습니다."}
            </Text>
          </View>
        </View>
      ) : null}

      {share.data && !share.data.items.length ? (
        <View style={styles.centerPanel}>
          <Text style={styles.centerTitle}>공유된 작품이 없습니다</Text>
          <Text style={styles.centerText}>공유 후 라이브러리 항목이 삭제되었을 수 있습니다.</Text>
        </View>
      ) : null}

      {share.data?.items.length ? (
        <View style={styles.grid}>
          {share.data.items.map((item) => (
            <SharedGalleryItem cardWidth={cardWidth} item={item} key={item.library_item_id} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function SharedGalleryItem({ item, cardWidth }: { item: LibraryListItem; cardWidth: `${number}%` }) {
  const episodeLabel = createEpisodeCountLabel(item.episode_count);
  const watchCountLabel = createWatchCountLabel(item.watch_count, { includeZero: true });
  const reviewLabel = createReviewLabel(item.rating, item.one_line_review);

  return (
    <View style={[styles.cell, { width: cardWidth }]}>
      <View style={styles.card}>
        <Image
          contentFit="cover"
          source={item.poster_url ? { uri: item.poster_url } : null}
          style={styles.poster}
        />
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.itemTitle}>{item.title_primary}</Text>
          <Text numberOfLines={1} style={styles.itemMeta}>
            {[item.air_year, CONTENT_TYPE_LABELS[item.content_type], episodeLabel, watchCountLabel].filter(Boolean).join(" · ")}
          </Text>
          <GenreBadgeList genres={item.genres} maxVisible={2} />
          {reviewLabel ? <Text numberOfLines={1} style={styles.review}>{reviewLabel}</Text> : null}
          <View style={styles.badges}>
            {item.statuses.slice(0, 2).map((status) => (
              <WatchStatusBadge key={status} status={status} size="sm" />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    gap: spacing.lg,
    minHeight: "100%",
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  header: {
    gap: spacing.lg
  },
  homeButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: spacing.xs
  },
  homeButtonText: {
    color: colors.text,
    fontWeight: "900"
  },
  titleBox: {
    gap: spacing.xs
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800"
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900"
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700"
  },
  centerPanel: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.xl
  },
  centerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  centerText: {
    color: colors.textMuted,
    fontWeight: "700"
  },
  errorPanel: {
    alignItems: "flex-start",
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  errorTextBox: {
    flex: 1,
    gap: spacing.xs
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "900"
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.sm
  },
  cell: {
    padding: spacing.sm
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  poster: {
    aspectRatio: 2 / 3,
    backgroundColor: colors.surfaceMuted,
    width: "100%"
  },
  body: {
    gap: spacing.xs,
    minHeight: 104,
    padding: spacing.sm
  },
  itemTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  review: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800"
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    minHeight: 22
  }
});
