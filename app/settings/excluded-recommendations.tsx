import { Redirect , useRouter } from "expo-router";
import { EXTENDED_FEATURES_ENABLED } from "@/constants/features";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { EmptyState } from "@/components/common/EmptyState";
import { colors, radius, spacing } from "@/constants/theme";
import { useRecommendationUiStore } from "@/stores/recommendationUiStore";

function ExcludedRecommendationsScreen() {
  const router = useRouter();
  const excludedRecommendations = useRecommendationUiStore((state) => state.excludedRecommendations);
  const removeExclusion = useRecommendationUiStore((state) => state.removeExclusion);
  const clearExclusions = useRecommendationUiStore((state) => state.clearExclusions);
  const sortedItems = [...excludedRecommendations].sort(
    (a, b) => new Date(b.excludedAt).getTime() - new Date(a.excludedAt).getTime()
  );
  const hasItems = sortedItems.length > 0;

  const confirmClear = () => {
    if (!hasItems) return;

    Alert.alert("전체 해제", "추천 제외 목록을 모두 비울까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "해제",
        style: "destructive",
        onPress: clearExclusions
      }
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons color={colors.text} name="chevron-back" size={22} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>추천에서 제외한 작품</Text>
          <Text style={styles.subtitle}>{sortedItems.length}개</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!hasItems}
          onPress={confirmClear}
          style={[styles.clearButton, !hasItems ? styles.disabled : null]}
        >
          <Text style={styles.clearButtonText}>전체 해제</Text>
        </Pressable>
      </View>

      {hasItems ? (
        <View style={styles.list}>
          {sortedItems.map((item) => (
            <View key={item.key} style={styles.row}>
              <View style={styles.rowCopy}>
                <Text numberOfLines={2} style={styles.rowTitle}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.rowMeta}>
                  {formatExcludedAt(item.excludedAt)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => removeExclusion(item.key)}
                style={styles.removeButton}
              >
                <Ionicons color={colors.primary} name="refresh-outline" size={16} />
                <Text style={styles.removeButtonText}>해제</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyFrame}>
          <EmptyState
            description="제외한 작품이 여기에 표시됩니다."
            title="제외한 작품이 없어요"
          />
        </View>
      )}
    </ScrollView>
  );
}

function formatExcludedAt(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "이전 버전에서 제외됨";

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    gap: spacing.lg,
    minHeight: "100%",
    padding: spacing.lg,
    paddingBottom: 104
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  headerCopy: {
    flex: 1,
    gap: 2
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800"
  },
  clearButton: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    minHeight: 40,
    paddingHorizontal: spacing.md
  },
  clearButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 40
  },
  disabled: {
    opacity: 0.5
  },
  list: {
    gap: spacing.sm
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xs
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  removeButton: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md
  },
  removeButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  emptyFrame: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 220,
    justifyContent: "center",
    padding: spacing.lg
  }
});

export default function MvpRoute() { return EXTENDED_FEATURES_ENABLED ? <ExcludedRecommendationsScreen /> : <Redirect href="/library" />; }
