import { Pressable, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";

import { ContentCard } from "@/components/content/ContentCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { PinTimelineItem } from "@/components/pins/PinTimelineItem";
import { colors, radius, spacing } from "@/constants/theme";
import { useLibrary } from "@/hooks/useLibrary";
import { useAllPins } from "@/hooks/useTimelinePins";

export default function HomeScreen() {
  const router = useRouter();
  const library = useLibrary("watching");
  const pins = useAllPins();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>SceneNote</Text>
        <Text style={styles.subtitle}>보고 있는 작품과 다시 찾고 싶은 장면</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push("/search")} style={styles.searchButton}>
          <Text style={styles.searchText}>작품 검색</Text>
        </Pressable>
      </View>

      <SectionHeader title="보는 중" action="전체 보기" onAction={() => router.push("/library")} />
      {library.isLoading ? <LoadingSkeleton count={2} /> : null}
      {library.isError ? <ErrorState onRetry={() => library.refetch()} /> : null}
      {library.data?.length ? (
        <View style={styles.list}>
          {library.data.slice(0, 3).map((item) => (
            <ContentCard
              compact
              item={item}
              key={item.library_item_id}
              onPress={() => router.push({ pathname: "/content/[id]", params: { id: item.content_id } })}
            />
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

      <SectionHeader title="최근 핀" action="전체 보기" onAction={() => router.push("/pins")} />
      <View style={styles.pinList}>
        {pins.data?.slice(0, 3).map((pin) => (
          <PinTimelineItem
            compact
            isSpoilerRevealed={false}
            key={pin.id}
            onPress={() => router.push({ pathname: "/pins/[id]", params: { id: pin.id } })}
            onRevealSpoiler={() => undefined}
            pin={pin}
          />
        ))}
      </View>
      {!pins.isLoading && !pins.data?.length ? (
        <EmptyState description="에피소드에서 첫 핀을 남겨보세요." title="아직 핀이 없어요" />
      ) : null}
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
  container: {
    backgroundColor: colors.background,
    flex: 1,
    gap: 6,
    paddingBottom: 68
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
  list: {
    gap: 6
  },
  pinList: {
    gap: 6
  }
});
