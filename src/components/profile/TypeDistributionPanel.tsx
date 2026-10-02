import { StyleSheet, Text, View } from "react-native";

import { CONTENT_TYPE_COLORS } from "@/constants/contentTypeColors";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { createTypeDistribution, formatCount, formatPercent } from "@/utils/profileDashboard";
import type { ContentTypeStat } from "@/utils/profileStats";

import { DashboardPanel } from "./DashboardPanel";

interface TypeDistributionPanelProps {
  stats: ContentTypeStat[];
  totalCount: number;
  width?: number | undefined;
  wide: boolean;
}

export function TypeDistributionPanel({ stats, totalCount, width, wide }: TypeDistributionPanelProps) {
  const rows = createTypeDistribution(stats);

  return (
    <DashboardPanel subtitle={`등록 작품 ${formatCount(totalCount)}개 기준`} title="타입별 분포" width={width}>
      <View style={styles.track}>
        {rows.map((row) => (
          <View
            key={row.type}
            style={{ backgroundColor: CONTENT_TYPE_COLORS[row.type], width: `${row.percent}%` }}
          />
        ))}
      </View>
      <View style={styles.legend}>
        {rows.map((row) => (
          <View key={row.type} style={[styles.legendItem, { width: wide ? "50%" : "100%" }]}>
            <View style={[styles.dot, { backgroundColor: CONTENT_TYPE_COLORS[row.type] }]} />
            <Text style={styles.name}>{row.label}</Text>
            <Text style={styles.count}>{formatCount(row.count)}</Text>
            <Text style={styles.percent}>{formatPercent(row.percent)}</Text>
          </View>
        ))}
      </View>
    </DashboardPanel>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: "row",
    height: 12,
    overflow: "hidden"
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.sm
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.md
  },
  dot: {
    borderRadius: radius.pill,
    height: 10,
    width: 10
  },
  name: {
    ...typography.label,
    color: colors.text
  },
  count: {
    ...typography.label,
    color: colors.text,
    fontVariant: ["tabular-nums"]
  },
  percent: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"]
  }
});
