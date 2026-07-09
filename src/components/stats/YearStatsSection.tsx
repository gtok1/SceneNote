import { useMemo, useState } from "react";
import { ActivityIndicator, type DimensionValue, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";
import { useLibrary } from "@/hooks/useLibrary";
import type { LibraryListItem } from "@/types/library";
import {
  countItemsWithWatchedDate,
  isWatchedLibraryItem,
  yearFromDate
} from "@/utils/profileStats";

type YearStatsMode = "recorded" | "aired";

interface YearStat {
  year: number | null;
  itemCount: number;
  watchCount: number;
}

export function YearStatsSection() {
  const library = useLibrary("all");
  const [selectedMode, setSelectedMode] = useState<YearStatsMode | null>(null);

  const defaultMode = useMemo<YearStatsMode>(() => {
    return countItemsWithWatchedDate(library.data ?? []) >= 10 ? "recorded" : "aired";
  }, [library.data]);
  const mode = selectedMode ?? defaultMode;
  const stats = useMemo(() => createYearStats(library.data ?? [], mode), [library.data, mode]);
  const totalItems = stats.reduce((sum, stat) => sum + stat.itemCount, 0);
  const totalWatches = stats.reduce((sum, stat) => sum + stat.watchCount, 0);
  const peakYear = stats.reduce<YearStat | null>(
    (peak, stat) => {
      if (stat.year === null) return peak;
      return !peak || stat.watchCount > peak.watchCount ? stat : peak;
    },
    null
  );

  if (library.isLoading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (stats.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>본 작품을 등록하면{"\n"}연도별 감상 통계를 볼 수 있어요</Text>
      </View>
    );
  }

  const maxWatchCount = Math.max(...stats.map((stat) => stat.watchCount), 1);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>연도별 감상 통계</Text>
          <Text style={styles.subtitle}>
            {mode === "recorded" ? "마지막으로 본 날 기준" : "작품 방영연도 기준"}
          </Text>
        </View>
        <View style={styles.modeTabs}>
          <ModeButton label="기록" selected={mode === "recorded"} onPress={() => setSelectedMode("recorded")} />
          <ModeButton label="방영" selected={mode === "aired"} onPress={() => setSelectedMode("aired")} />
        </View>
      </View>

      <View style={styles.summary}>
        <SummaryItem label="본 작품" value={`${totalItems}개`} />
        <SummaryItem label="시청 횟수" value={`${totalWatches}회`} />
        <SummaryItem label="가장 많음" value={peakYear?.year ? `${peakYear.year}년` : "--"} />
      </View>

      <View style={styles.yearList}>
        {stats.map((stat) => (
          <YearStatRow key={stat.year ?? "unknown"} max={maxWatchCount} stat={stat} />
        ))}
      </View>
    </View>
  );
}

function ModeButton({
  label,
  selected,
  onPress
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.modeButton, selected ? styles.modeButtonSelected : null]}
    >
      <Text style={[styles.modeButtonText, selected ? styles.modeButtonTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function YearStatRow({ stat, max }: { stat: YearStat; max: number }) {
  const percent = max > 0 ? `${(stat.watchCount / max) * 100}%` : "0%";
  const width = percent as DimensionValue;

  return (
    <View style={styles.yearRow}>
      <View style={styles.yearMeta}>
        <Text style={styles.yearLabel}>{stat.year ? `${stat.year}년` : "감상일 미상"}</Text>
        <Text style={styles.yearCount}>
          {stat.itemCount}개 · {stat.watchCount}회
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width }]} />
      </View>
    </View>
  );
}

function createYearStats(items: LibraryListItem[], mode: YearStatsMode): YearStat[] {
  const stats = new Map<number | "unknown", YearStat>();

  items.filter(isWatchedLibraryItem).forEach((item) => {
    const year = mode === "recorded" ? yearFromDate(item.last_watched_at) : item.air_year;
    if (!year && mode === "aired") return;

    const key = year ?? "unknown";
    const previous = stats.get(key) ?? { year, itemCount: 0, watchCount: 0 };
    stats.set(key, {
      year,
      itemCount: previous.itemCount + 1,
      watchCount: previous.watchCount + Math.max(0, item.watch_count ?? 0)
    });
  });

  return Array.from(stats.values()).sort((a, b) => {
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return b.year - a.year;
  });
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
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  headerText: {
    flex: 1,
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
  modeTabs: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexDirection: "row",
    padding: 3
  },
  modeButton: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  modeButtonSelected: {
    backgroundColor: colors.primary
  },
  modeButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900"
  },
  modeButtonTextSelected: {
    color: colors.surface
  },
  summary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  summaryItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flex: 1,
    minWidth: 92,
    padding: spacing.md
  },
  summaryValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  yearList: {
    gap: spacing.md
  },
  yearRow: {
    gap: spacing.xs
  },
  yearMeta: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  yearLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  yearCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  barTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 12,
    overflow: "hidden"
  },
  barFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    height: 12
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
