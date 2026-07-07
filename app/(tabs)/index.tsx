import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ContentGalleryCard } from "@/components/content/ContentGalleryCard";
import { PopularRecommendationSection } from "@/components/content/PopularRecommendationSection";
import { colors, radius, spacing } from "@/constants/theme";
import { useLibrary } from "@/hooks/useLibrary";

export default function HomeScreen() {
  const router = useRouter();
  const library = useLibrary("watching");
  const { width } = useWindowDimensions();
  const galleryColumns = width >= 1280 ? 6 : width >= 960 ? 5 : width >= 700 ? 4 : 3;
  const galleryCardWidth = `${100 / galleryColumns}%` as const;
  const watchingItems = library.data?.slice(0, galleryColumns) ?? [];

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
      {watchingItems.length ? (
        <View style={styles.galleryGrid}>
          {watchingItems.map((item) => (
            <View key={item.library_item_id} style={[styles.galleryCell, { width: galleryCardWidth }]}>
              <ContentGalleryCard
                item={item}
                onPress={() =>
                  router.push({ pathname: "/content/[id]", params: { id: item.content_id } })
                }
              />
            </View>
          ))}
        </View>
      ) : !library.isLoading ? (
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
  galleryCell: {
    minWidth: 0
  }
});
