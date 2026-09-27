import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAtom } from "jotai";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { revealedSpoilerPinIdsAtom } from "@/atoms/spoilerAtom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ContinueWatchingTile } from "@/components/home/ContinueWatchingTile";
import { PosterTile } from "@/components/home/PosterTile";
import { RecentPinCard } from "@/components/pins/RecentPinCard";
import { WATCH_STATUS_LABEL } from "@/constants/status";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { useLibrary, useUpcomingAiring } from "@/hooks/useLibrary";
import { useAllPins } from "@/hooks/useTimelinePins";
import type { LibraryListItem, WatchStatus } from "@/types/library";
import { getHomeLayout, HOME_CONTENT_MAX_WIDTH, type HomeLayout } from "@/utils/homeLayout";
import { formatUpcomingAiringLabel, isAiringToday } from "@/utils/upcomingAiring";

export default function HomeScreen() {
  const router = useRouter();
  const library = useLibrary("all");
  const pins = useAllPins();
  const [revealedSpoilers, setRevealedSpoilers] = useAtom(revealedSpoilerPinIdsAtom);
  const { width } = useWindowDimensions();
  const layout = getHomeLayout(width);
  const insets = useSafeAreaInsets();
  const upcomingAiringItems = useUpcomingAiring(library.data);
  const watchingItems = useMemo(
    () => (library.data ?? []).filter((item) => item.statuses.includes("watching")).slice(0, layout.continueLimit),
    [layout.continueLimit, library.data]
  );
  useFocusEffect(useCallback(() => () => setRevealedSpoilers(new Set()), [setRevealedSpoilers]));
  const recentPins = pins.data?.slice(0, 3) ?? [];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.content, { paddingHorizontal: layout.gutter }]}>
        <View style={{ paddingTop: insets.top + 12 }}>
          <Text style={styles.wordmark}>SceneNote</Text>
          <Pressable
            accessibilityLabel="작품 검색 열기"
            accessibilityRole="button"
            onPress={() => router.push("/search")}
            style={styles.searchEntry}
          >
            <Ionicons color={colors.textMuted} name="search" size={18} />
            <Text style={styles.searchPlaceholder}>작품·배우 검색</Text>
          </Pressable>
        </View>
        {pins.isError ? <ErrorState message="최근 핀을 새로 불러오지 못했습니다." onRetry={() => pins.refetch()} /> : null}
        {recentPins.length ? (
          <>
            <SectionHeader
              title="최근 핀"
              action="전체 보기"
              onAction={() => router.push("/pins")}
            />
            <View style={[styles.grid, { gap: layout.posterGap }]}>
              {recentPins.map((pin) => (
                <View key={pin.id} style={[styles.pinCell, { width: layout.pinWidth }]}>
                  <RecentPinCard
                    isSpoilerRevealed={revealedSpoilers.has(pin.id)}
                    onPress={() => router.push({ pathname: "/pins/[id]", params: { id: pin.id } })}
                    onRevealSpoiler={() =>
                      setRevealedSpoilers((previous) => new Set([...previous, pin.id]))
                    }
                    pin={pin}
                  />
                </View>
              ))}
            </View>
          </>
        ) : !pins.isLoading && !pins.isError ? (
          <>
            <SectionHeader title="최근 핀" />
            <View style={styles.pinIntroduction}>
              <Ionicons color={colors.primary} name="pin-outline" size={22} />
              <View style={styles.pinIntroductionBody}>
                <Text style={styles.pinIntroductionTitle}>첫 장면을 핀으로 남겨보세요</Text>
                <Text style={styles.pinIntroductionDescription}>
                  이어보기에서 회차를 고르고 시간과 메모를 남기면 여기에 모여요.
                </Text>
              </View>
            </View>
          </>
        ) : null}

        <SectionHeader
          title="이어보기"
          action="전체 보기"
          onAction={() =>
            router.push({
              pathname: "/library",
              params: { status: "watching" }
            })
          }
        />
        {library.isLoading ? <LoadingSkeleton count={2} /> : null}
        {library.isError ? <ErrorState onRetry={() => library.refetch()} /> : null}
        {watchingItems.length ? (
          <View style={[styles.grid, { gap: layout.posterGap }]}>
            {watchingItems.map((item) => (
              <ContinueWatchingTile
                key={item.library_item_id}
                item={item}
                width={layout.posterWidth}
                onOpenEpisodes={() => router.push({ pathname: "/content/[id]/episodes", params: { id: item.content_id, libraryItemId: item.library_item_id, ...(item.season_number != null ? { season: String(item.season_number) } : {}) } })}
                onOpenProgressSetting={() => router.push({ pathname: "/content/[id]", params: { id: item.content_id, libraryItemId: item.library_item_id, focus: "progress" } })}
                onPress={() => router.push({ pathname: "/content/[id]", params: { id: item.content_id, libraryItemId: item.library_item_id, ...(item.season_number != null ? { season: String(item.season_number) } : {}) } })}
              />
            ))}
          </View>
        ) : !library.isLoading && !library.isError ? (
          <EmptyState
            actionLabel="작품 검색하기"
            description="라이브러리에 작품을 추가하면 여기에 표시됩니다."
            onAction={() => router.push("/search")}
            title="보는 중인 작품이 없어요"
          />
        ) : null}

        <UpcomingAiringSection
          items={upcomingAiringItems}
          layout={layout}
          onPressItem={(item) => router.push({ pathname: "/content/[id]", params: {
            id: item.content_id,
            libraryItemId: item.library_item_id,
            ...(item.season_number != null ? { season: String(item.season_number) } : {})
          } })}
        />

      </View>
    </ScrollView>
  );
}

function UpcomingAiringSection({
  items,
  layout,
  onPressItem
}: {
  items: LibraryListItem[];
  layout: HomeLayout;
  onPressItem: (item: LibraryListItem) => void;
}) {
  if (!items.length) return null;

  return (
    <View>
      <SectionHeader title="곧 방영 시작" />
      <ScrollView
        contentContainerStyle={[styles.upcomingList, { paddingHorizontal: layout.gutter }]}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -layout.gutter }}
      >
        {items.map((item) => {
          const airingToday = isAiringToday(item.air_date);
          const upcomingLabel = formatUpcomingAiringLabel(item.air_date);

          return (
            <PosterTile
              accessibilityLabel={`${item.title_primary} 상세 보기`}
              badge={airingToday
                ? { tone: "today", text: "오늘" }
                : upcomingLabel ? { tone: "upcoming", text: upcomingLabel } : null}
              caption={WATCH_STATUS_LABEL[upcomingBadgeStatus(item)]}
              key={item.library_item_id}
              onPress={() => onPressItem(item)}
              posterUrl={item.poster_url}
              title={item.title_primary}
              width={layout.railTileWidth}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function upcomingBadgeStatus(item: LibraryListItem): WatchStatus {
  return item.statuses.includes("watching") ? "watching" : "wishlist";
}

function SectionHeader({
  title,
  action,
  onAction
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.sectionActionButton}>
          <Text style={styles.sectionAction}>{action}</Text>
          <Ionicons color={colors.primary} name="chevron-forward" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: colors.background,
    flex: 1
  },
  container: {
    paddingBottom: 32
  },
  content: {
    width: "100%",
    maxWidth: HOME_CONTENT_MAX_WIDTH,
    alignSelf: "center"
  },
  wordmark: {
    ...typography.display,
    color: colors.text
  },
  searchEntry: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    height: 48,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg
  },
  searchPlaceholder: {
    ...typography.body,
    color: colors.textMuted
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: spacing.md
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text
  },
  sectionActionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    minHeight: 44
  },
  sectionAction: {
    ...typography.label,
    color: colors.primary
  },
  grid: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap"
  },
  pinCell: {
    alignSelf: "stretch",
    minWidth: 0
  },
  pinIntroduction: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg
  },
  pinIntroductionBody: {
    flex: 1,
    gap: 2
  },
  pinIntroductionTitle: {
    ...typography.headline,
    color: colors.text
  },
  pinIntroductionDescription: {
    ...typography.body,
    color: colors.textMuted
  },
  upcomingList: {
    gap: spacing.md,
    paddingBottom: spacing.xs
  }
});
