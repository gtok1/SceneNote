import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/constants/theme";
import type { LibraryListItem } from "@/types/library";
import {
  type YearComparisonModel,
  createYearComparisonModel,
  formatCount,
  yearComparisonAccessibilityLabel,
  yearComparisonFootnotes
} from "@/utils/profileDashboard";

import { DashboardPanel } from "./DashboardPanel";

const BAR_MAX_HEIGHT = 120;
const WATCHED_COLOR = colors.primary;
const RELEASED_COLOR = colors.textSubtle;

interface YearComparisonPanelProps {
  items: LibraryListItem[];
  maxBars: number;
  width?: number | undefined;
}

// 감상 연도별·작품 연도별을 한 축에 나란히: 같은 "본 작품" 묶음을 본 해(파랑)와 공개 연도(회색)로 센다.
export function YearComparisonPanel({ items, maxBars, width }: YearComparisonPanelProps) {
  const model = useMemo(() => createYearComparisonModel(items, { maxBars }), [items, maxBars]);
  const footnotes = yearComparisonFootnotes(model);

  return (
    <DashboardPanel
      accessory={<Legend />}
      subtitle={`본 작품 ${formatCount(model.watchedTotal)}개 기준`}
      title="연도별 감상"
      width={width}
    >
      <View style={styles.summary}>
        <SummaryItem label={`${model.currentYear}년에 본 작품`} value={`${formatCount(model.currentYearWatched)}개`} />
        <SummaryItem label="가장 많이 본 해" value={model.peakWatchedYear ? `${model.peakWatchedYear}년` : "--"} />
        <SummaryItem label="작품이 가장 많은 공개 연도" value={model.peakReleasedYear ? `${model.peakReleasedYear}년` : "--"} />
      </View>
      {model.bars.length === 0 ? (
        <Text style={styles.empty}>본 작품을 등록하면 연도별 감상을 볼 수 있어요.</Text>
      ) : (
        <YearBars model={model} />
      )}
      {footnotes.map((note) => (
        <Text key={note} style={styles.footnote}>
          {note}
        </Text>
      ))}
    </DashboardPanel>
  );
}

function YearBars({ model }: { model: YearComparisonModel }) {
  return (
    <View accessibilityLabel={yearComparisonAccessibilityLabel(model)} accessible style={styles.chart}>
      {model.bars.map((bar) => (
        <View importantForAccessibility="no-hide-descendants" key={bar.year} style={styles.group}>
          <View style={styles.pair}>
            <Bar color={WATCHED_COLOR} count={bar.watchedCount} ratio={bar.watchedRatio} />
            <Bar color={RELEASED_COLOR} count={bar.releasedCount} ratio={bar.releasedRatio} />
          </View>
          <Text style={[styles.year, bar.year === model.currentYear ? styles.yearCurrent : null]}>{bar.year}</Text>
        </View>
      ))}
    </View>
  );
}

function Bar({ count, ratio, color }: { count: number; ratio: number; color: string }) {
  return (
    <View style={styles.barSlot}>
      {count > 0 ? <Text numberOfLines={1} style={styles.value}>{formatCount(count)}</Text> : null}
      <View
        style={[
          styles.bar,
          { backgroundColor: color, height: count > 0 ? Math.max(4, Math.round(BAR_MAX_HEIGHT * ratio)) : 0 }
        ]}
      />
    </View>
  );
}

function Legend() {
  return (
    <View style={styles.legend}>
      <LegendItem color={WATCHED_COLOR} label="본 해" />
      <LegendItem color={RELEASED_COLOR} label="공개 연도" />
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: "row",
    gap: spacing.md
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  legendDot: {
    borderRadius: radius.pill,
    height: 10,
    width: 10
  },
  legendLabel: {
    ...typography.caption,
    color: colors.textMuted
  },
  summary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  summaryItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexGrow: 1,
    gap: 2,
    minWidth: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted
  },
  summaryValue: {
    ...typography.headline,
    color: colors.text,
    fontVariant: ["tabular-nums"]
  },
  empty: {
    ...typography.body,
    color: colors.textMuted
  },
  chart: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  group: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  pair: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 3,
    height: BAR_MAX_HEIGHT + 16,
    justifyContent: "center",
    width: "100%"
  },
  barSlot: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    maxWidth: 18
  },
  value: {
    ...typography.micro,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
    minWidth: 28,
    textAlign: "center"
  },
  bar: {
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    width: "100%"
  },
  year: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"]
  },
  yearCurrent: {
    color: colors.text,
    fontWeight: typography.label.fontWeight
  },
  footnote: {
    ...typography.caption,
    color: colors.textMuted
  }
});
