import { useMemo, useState } from "react";
import { ActivityIndicator, type DimensionValue, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";
import { useLibrary } from "@/hooks/useLibrary";
import type { LibraryListItem, WatchStatus } from "@/types/library";

type YearStatsMode = "recorded" | "aired";

interface YearStat {
  year: number;
  itemCount: number;
  watchCount: number;
}

const WATCHED_STATUSES = new Set<WatchStatus>([
  "watching",
  "completed",
  "recommended",
  "not_recommended",
  "dropped"
]);

export function YearStatsSection() {
  const library = useLibrary("all");
  const [mode, setMode] = useState<YearStatsMode>("recorded");

  const stats = useMemo(() => createYearStats(library.data ?? [], mode), [library.data, mode]);
  const totalItems = stats.reduce((sum, stat) => sum + stat.itemCount, 0);
  const totalWatches = stats.reduce((sum, stat) => sum + stat.watchCount, 0);
  const peakYear = stats.reduce<YearStat | null>(
    (peak, stat) => (!peak || stat.watchCount > peak.watchCount ? stat : peak),
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
            {mode === "recorded" ? "내 목록에서 마지막으로 기록한 연도 기준" : "작품 방영연도 기준"}
          </Text>
        </View>
        <View style={styles.modeTabs}>
          <ModeButton label="기록" selected={mode === "recorded"} onPress={() => setMode("recorded")} />
          <ModeButton label="방영" selected={mode === "aired"} onPress={() => setMode("aired")} />
        </View>
      </View>

      <View style={styles.summary}>
        <SummaryItem label="본 작품" value={`${totalItems}개`} />
        <SummaryItem label="시청 횟수" value={`${totalWatches}회`} />
        <SummaryItem label="가장 많음" value={peakYear ? `${peakYear.year}년` : "--"} />
      </View>

      <View style={styles.yearList}>
        {stats.map((stat) => (
          <YearStatRow key={stat.year} max={maxWatchCount} stat={stat} />
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
        <Text style={styles.yearLabel}>{stat.year}년</Text>
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
  const stats = new Map<number, YearStat>();

  items.filter(isWatchedItem).forEach((item) => {
    const year = mode === "recorded" ? yearFromDate(item.updated_at) : item.air_year;
    if (!year) return;

    const previous = stats.get(year) ?? { year, itemCount: 0, watchCount: 0 };
    stats.set(year, {
      year,
      itemCount: previous.itemCount + 1,
      watchCount: previous.watchCount + Math.max(0, item.watch_count ?? 0)
    });
  });

  return Array.from(stats.values()).sort((a, b) => b.year - a.year);
}

function isWatchedItem(item: LibraryListItem): boolean {
  if ((item.watch_count ?? 0) > 0) return true;
  return item.statuses.some((status) => WATCHED_STATUSES.has(status));
}

function yearFromDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const year = new Date(value).getFullYear();
  return Number.isFinite(year) ? year : null;
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
