import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { useRouter } from "expo-router";
import { useAtom } from "jotai";

import { revealedSpoilerPinIdsAtom } from "@/atoms/spoilerAtom";
import { AppImage as Image } from "@/components/common/AppImage";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ContentGalleryCard } from "@/components/content/ContentGalleryCard";
import { PopularRecommendationSection } from "@/components/content/PopularRecommendationSection";
import { RecentPinCard } from "@/components/pins/RecentPinCard";
import { colors, radius, spacing } from "@/constants/theme";
import { useLibrary, useUpcomingAiring } from "@/hooks/useLibrary";
import { useAllPins } from "@/hooks/useTimelinePins";
import type { LibraryListItem } from "@/types/library";
import { formatUpcomingAiringLabel } from "@/utils/upcomingAiring";

export default function HomeScreen() {
  const router = useRouter();
  const library = useLibrary("all");
  const pins = useAllPins();
  const [revealedSpoilers, setRevealedSpoilers] = useAtom(revealedSpoilerPinIdsAtom);
  const { width } = useWindowDimensions();
  const galleryColumns = width >= 1280 ? 6 : width >= 960 ? 5 : width >= 700 ? 4 : 3;
  const galleryCardWidth = `${100 / galleryColumns}%` as const;
  const recentPinColumns = width >= 700 ? 3 : 1;
  const recentPinCardWidth = `${100 / recentPinColumns}%` as const;
  const upcomingAiringItems = useUpcomingAiring(library.data);
  const watchingItems = useMemo(
    () => (library.data ?? []).filter((item) => item.statuses.includes("watching")).slice(0, galleryColumns),
    [galleryColumns, library.data]
  );
  const recentPins = pins.data?.slice(0, 3) ?? [];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>SceneNote</Text>
        <Text style={styles.subtitle}>보고 있는 작품과 다시 찾고 싶은 장면</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/search")}
          style={styles.searchButton}
        >
          <Text style={styles.searchText}>작품 검색</Text>
        </Pressable>
      </View>

      {recentPins.length ? (
        <>
          <SectionHeader title="최근 핀" action="전체 보기" onAction={() => router.push("/pins")} />
          <View style={styles.recentPinGrid}>
            {recentPins.map((pin) => (
              <View key={pin.id} style={[styles.recentPinCell, { width: recentPinCardWidth }]}>
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
      ) : null}

      <UpcomingAiringSection
        items={upcomingAiringItems}
        onPressItem={(item) => router.push({ pathname: "/content/[id]", params: { id: item.content_id } })}
      />

      <PopularRecommendationSection />

      <SectionHeader
        title="보는 중"
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
      {!library.isError && watchingItems.length ? (
        <View style={styles.galleryGrid}>
          {watchingItems.map((item) => (
            <View key={item.library_item_id} style={[styles.galleryCell, { width: galleryCardWidth }]}>
              <ContentGalleryCard
                item={item}
                onAddPin={() =>
                  router.push({
                    pathname: "/pins/new",
                    params: { contentId: item.content_id }
                  })
                }
                onOpenEpisodes={() =>
                  router.push({ pathname: "/content/[id]/episodes", params: { id: item.content_id } })
                }
                onPress={() =>
                  router.push({ pathname: "/content/[id]", params: { id: item.content_id } })
                }
              />
            </View>
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
    </ScrollView>
  );
}

function UpcomingAiringSection({
  items,
  onPressItem
}: {
  items: LibraryListItem[];
  onPressItem: (item: LibraryListItem) => void;
}) {
  if (!items.length) return null;

  return (
    <View style={styles.upcomingSection}>
      <View style={styles.upcomingHeader}>
        <Text style={styles.upcomingEyebrow}>라이브러리</Text>
        <Text style={styles.upcomingTitle}>곧 방영 시작</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.upcomingList}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {items.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.library_item_id}
            onPress={() => onPressItem(item)}
            style={styles.upcomingCard}
          >
            <Image
              accessibilityLabel={item.title_primary}
              contentFit="cover"
              source={item.poster_url ? { uri: item.poster_url } : null}
              style={styles.upcomingPoster}
            />
            <View style={styles.upcomingBody}>
              <Text numberOfLines={2} style={styles.upcomingCardTitle}>
                {item.title_primary}
              </Text>
              <Text numberOfLines={1} style={styles.upcomingDate}>
                {formatUpcomingAiringLabel(item.air_date)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  onAction
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable accessibilityRole="button" onPress={onAction}>
        <Text style={styles.sectionAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: colors.background,
    flex: 1
  },
  container: {
    gap: 6,
    paddingBottom: 92
  },
  hero: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14
  },
  searchButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 7
  },
  searchText: {
    color: colors.surface,
    fontWeight: "800"
  },
  upcomingSection: {
    gap: spacing.sm,
    paddingVertical: spacing.md
  },
  upcomingHeader: {
    gap: 2,
    paddingHorizontal: spacing.lg
  },
  upcomingEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  upcomingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  upcomingList: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs
  },
  upcomingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    width: 132
  },
  upcomingPoster: {
    backgroundColor: colors.surfaceMuted,
    height: 184,
    width: "100%"
  },
  upcomingBody: {
    gap: spacing.xs,
    minHeight: 72,
    padding: spacing.sm
  },
  upcomingCardTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  upcomingDate: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 22,
    paddingHorizontal: spacing.lg
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  sectionAction: {
    color: colors.primary,
    fontWeight: "700"
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.xs
  },
  recentPinGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.sm
  },
  recentPinCell: {
    minWidth: 0,
    padding: spacing.xs
  },
  galleryCell: {
    minWidth: 0
  }
});
