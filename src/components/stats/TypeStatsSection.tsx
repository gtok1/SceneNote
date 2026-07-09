import { useMemo } from "react";
import { ActivityIndicator, type DimensionValue, StyleSheet, Text, View } from "react-native";

import { CONTENT_TYPE_COLORS } from "@/constants/contentTypeColors";
import { colors, radius, spacing } from "@/constants/theme";
import { useLibrary } from "@/hooks/useLibrary";
import { createContentTypeStats } from "@/utils/profileStats";

export function TypeStatsSection() {
  const library = useLibrary("all");
  const stats = useMemo(() => createContentTypeStats(library.data ?? []), [library.data]);
  const total = library.data?.length ?? 0;
  const visibleSegments = stats.filter((stat) => stat.count > 0);

  if (library.isLoading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (total === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>라이브러리에 작품을 추가하면{"\n"}타입별 취향을 볼 수 있어요</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>타입별 분포</Text>
        <Text style={styles.subtitle}>애니 · 한국 드라마 · 일본 드라마 · 영화</Text>
      </View>

      <View style={styles.stackTrack}>
        {visibleSegments.map((stat) => (
          <View
            key={stat.type}
            style={[
              styles.stackSegment,
              {
                backgroundColor: CONTENT_TYPE_COLORS[stat.type],
                width: `${stat.percent}%` as DimensionValue
              }
            ]}
          />
        ))}
      </View>

      <View style={styles.rows}>
        {stats.map((stat) => (
          <View key={stat.type} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: CONTENT_TYPE_COLORS[stat.type] }]} />
            <Text style={styles.label}>{stat.label}</Text>
            <Text style={styles.percent}>{Math.round(stat.percent)}%</Text>
            <Text style={styles.count}>{stat.count}개</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg
  },
  header: {
    gap: 2
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  stackTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flexDirection: "row",
    height: 16,
    overflow: "hidden"
  },
  stackSegment: {
    height: 16
  },
  rows: {
    gap: spacing.sm
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  swatch: {
    borderRadius: 4,
    height: 10,
    width: 10
  },
  label: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "800"
  },
  percent: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
    width: 44
  },
  count: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    width: 48
  },
  empty: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 120,
    justifyContent: "center",
    padding: spacing.lg
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center"
  }
});
